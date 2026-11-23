"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { accountRoleLabels, type CustomerAccount } from "@/lib/customer-accounts";
import type { RequestedProductKey } from "@/lib/customer-product-access";
import type { CustomerVehiclePage } from "@/lib/customer-vehicles";
import { CustomerProducts, type ProductSelection } from "./customer-products";
import { CustomerOrdersPanel, type OrderSelection } from "./customer-orders";
import { CustomerVehiclesPanel, type VehicleSelection } from "./customer-vehicles";

const unavailable = "Kontona kunde inte hämtas. Försök igen eller öppna kundportalen.";
const productsUnavailable = "Produkterna kunde inte hämtas. Försök igen eller öppna kundportalen.";
const expired = "Sessionen har löpt ut. Logga in igen.";
const accessDenied = "Åtgärden nekades. Kontolistan har hämtats på nytt.";
const invalidCode = "Koden kunde inte bekräftas. Försök igen.";
const emailCodeNotice = "Om adressen har ett konto och en kod kan skickas får du ett mejl.";
const emailCodeCooldownMs = 60_000;
type CustomerLogin = { client: SupabaseClient; session: Session };
function accountRequest(login: CustomerLogin, signal: AbortSignal) {
  return { headers: { Authorization: `Bearer ${login.session.access_token}` },
    credentials: "omit", cache: "no-store", redirect: "error", signal } as const;
}
type VerificationFactor = { id: string; name: string };
type EmailCodeStep = "address" | { address: string };

function customerAuth(authUrl: string, publishableKey: string) {
  return createClient(authUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    }) },
  });
}

async function releaseCustomerAuth(client?: SupabaseClient) {
  if (!client) return null;
  try {
    return await client.auth.signOut({ scope: "local" });
  } catch {
    return null;
  } finally {
    client.auth.dispose();
  }
}

function sessionDuration(session: Session) {
  return Math.max(0, session.expires_at === undefined
    ? session.expires_in * 1000 : session.expires_at * 1000 - Date.now());
}

function accountError(code: string) {
  switch (code) {
    case "MFA_REQUIRED":
    case "RECOVERY_REQUIRED":
      return "Fortsätt i kundportalen för att bekräfta din inloggning.";
    case "VERIFIED_EMAIL_REQUIRED":
      return "Bekräfta din e-postadress och logga in igen.";
    case "UNAUTHENTICATED":
      return expired;
    case "ACCESS_DENIED":
      return "Kontona är inte tillgängliga för den här inloggningen.";
    case "RATE_LIMITED":
      return "För många försök. Vänta en stund och försök igen.";
    default:
      return unavailable;
  }
}

export function CustomerAccounts({ authUrl, publishableKey, emailOtpEnabled }: {
  authUrl: string; publishableKey: string; emailOtpEnabled: boolean;
}) {
  const active = useRef<CustomerLogin | null>(null);
  const pending = useRef<{ login: CustomerLogin; factors: VerificationFactor[] } | null>(null);
  const operation = useRef<AbortController | null>(null);
  const expiration = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const accountHeading = useRef<HTMLHeadingElement | null>(null);
  const personalName = useRef<HTMLInputElement | null>(null);
  const email = useRef<HTMLInputElement | null>(null);
  const password = useRef<HTMLInputElement | null>(null);
  const code = useRef<HTMLInputElement | null>(null);
  const factor = useRef<HTMLSelectElement | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [working, setWorking] = useState(false);
  const [creatingPersonal, setCreatingPersonal] = useState(false);
  const [message, setMessage] = useState("");
  const [accounts, setAccounts] = useState<CustomerAccount[] | null>(null);
  const [products, setProducts] = useState<ProductSelection | null>(null);
  const [orders, setOrders] = useState<OrderSelection | null>(null);
  const [vehicles, setVehicles] = useState<VehicleSelection | null>(null);
  const [factors, setFactors] = useState<VerificationFactor[] | null>(null);
  const [emailStep, setEmailStep] = useState<EmailCodeStep | null>(null);
  const [emailRetryAt, setEmailRetryAt] = useState(0);

  const clear = useCallback((reason = "") => {
    const client = active.current?.client ?? pending.current?.login.client;
    operation.current?.abort();
    operation.current = null;
    clearTimeout(expiration.current);
    active.current = null;
    pending.current = null;
    setEmailStep(null);
    setFactors(null);
    setAccounts(null);
    setProducts(null);
    setOrders(null);
    setVehicles(null);
    setSignedIn(false);
    setWorking(false);
    setCreatingPersonal(false);
    setMessage(reason);
    return releaseCustomerAuth(client);
  }, []);

  const beginVerification = useCallback(async (login: CustomerLogin, request: AbortController) => {
    const auth = login.client.auth;
    try {
      const assurance = await auth.mfa.getAuthenticatorAssuranceLevel(login.session.access_token);
      if (operation.current !== request) return;
      if (assurance.data?.currentLevel === "aal1" && assurance.data.nextLevel === "aal2") {
        const result = await auth.mfa.listFactors();
        if (operation.current !== request) return;
        const verified = result.data?.totp.filter(item => item.status === "verified").map((item, index) => ({
          id: item.id, name: item.friendly_name || `Kodapp ${index + 1}`,
        }));
        if (verified?.length) {
          active.current = null;
          pending.current = { login, factors: verified };
          setSignedIn(false);
          setFactors(verified);
          return;
        }
      }
    } catch {
      if (operation.current !== request) return;
    }
    void clear(accountError("MFA_REQUIRED"));
  }, [clear]);

  const load = useCallback(async (notice = "", createdAccount?: string) => {
    const login = active.current;
    if (!login) return;
    operation.current?.abort();
    const request = new AbortController();
    operation.current = request;
    if (notice) accountHeading.current?.focus();
    setAccounts(null);
    setProducts(null);
    setOrders(null);
    setVehicles(null);
    setMessage("");
    setWorking(true);
    setCreatingPersonal(false);
    try {
      const response = await fetch("/api/kundkonto", {
        headers: { Authorization: `Bearer ${login.session.access_token}` },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: request.signal,
      });
      const result = await response.json();
      if (operation.current !== request) return;
      if (response.status === 403 && result.error === "MFA_REQUIRED") {
        await beginVerification(login, request);
      } else if (response.status === 401 || response.status === 403) {
        void clear(accountError(result.error));
      } else {
        setSignedIn(true);
        if (response.ok) {
          setAccounts(result.items);
          const available = !createdAccount || result.items.some((account: CustomerAccount) => account.id === createdAccount &&
            account.kind === "personal" && account.role === "owner");
          setMessage(available ? notice : "Privatkontot kunde inte bekräftas i kontolistan.");
        } else setMessage(accountError(result.error));
      }
    } catch {
      if (operation.current === request) {
        setSignedIn(true);
        setMessage(unavailable);
      }
    } finally {
      if (operation.current === request) {
        operation.current = null;
        setWorking(false);
      }
    }
  }, [beginVerification, clear]);

  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === "visible") void load();
    };
    const leave = () => { void clear(); };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      const client = active.current?.client ?? pending.current?.login.client;
      operation.current?.abort();
      operation.current = null;
      clearTimeout(expiration.current);
      active.current = null;
      pending.current = null;
      void releaseCustomerAuth(client);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [clear, load]);

  useEffect(() => {
    if (!emailRetryAt) return;
    const timer = setTimeout(() => setEmailRetryAt(0), Math.max(0, emailRetryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [emailRetryAt]);

  async function createPersonal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const login = active.current;
    if (!login || operation.current || !accounts || accounts.some(account => account.kind === "personal" && account.role === "owner")) return;
    const name = personalName.current?.value.trim() ?? "";
    if (!name || name.length > 160) {
      setMessage("Ange ett namn på privatkontot.");
      return;
    }

    const request = new AbortController();
    operation.current = request;
    setCreatingPersonal(true);
    setMessage("");
    const uncertain = "Privatkontot kunde inte bekräftas. Försök igen eller uppdatera kontolistan.";
    try {
      const options = accountRequest(login, request.signal);
      const response = await fetch("/api/kundkonto", { ...options, method: "POST",
        headers: { ...options.headers, "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const result = await response.json();
      if (operation.current !== request) return;
      if (response.status === 201) {
        void load("Ditt privatkonto är klart.", result.id);
      } else if (response.status === 401 || (response.status === 403 && result.error !== "ACCESS_DENIED")) {
        void clear(accountError(result.error));
      } else if (response.status === 403) {
        void load(accessDenied);
      } else if (response.status === 409) {
        setMessage("Privatkontot är inte tillgängligt för den här inloggningen. Kontakta kundsupport.");
      } else {
        setMessage(response.status === 429 ? accountError(result.error) : uncertain);
      }
    } catch {
      if (operation.current === request) setMessage(uncertain);
    } finally {
      if (operation.current === request) {
        operation.current = null;
        setCreatingPersonal(false);
      }
    }
  }

  async function showProducts(account: CustomerAccount, productKey?: RequestedProductKey) {
    const login = active.current;
    if (!login || working || creatingPersonal) return;
    operation.current?.abort();
    const request = new AbortController();
    operation.current = request;
    const selection = { accountId: account.id, accountName: account.name };
    setMessage("");
    setOrders(null);
    setVehicles(null);
    setProducts({ ...selection, status: "loading", sending: !!productKey });
    try {
      const path = `/api/kundkonto/${encodeURIComponent(account.id)}/produkter`;
      const options = accountRequest(login, request.signal);
      const submission = productKey ? await fetch(`${path}/${productKey}`, { ...options, method: "POST" }) : null;
      if (operation.current !== request) return;
      const response = submission && !submission.ok ? submission : await fetch(path, options);
      const result = await response.json();
      if (operation.current !== request) return;
      if (response.status === 401 || (response.status === 403 && result.error !== "ACCESS_DENIED")) {
        void clear(accountError(result.error));
      } else if (response.status === 403) {
        void load(accessDenied);
      } else if (response.ok) {
        setProducts({ ...selection, status: "ready", access: result });
      } else {
        setProducts({ ...selection, status: "error", message: response.status === 429 ? accountError(result.error) :
          productKey ? "Begäran kunde inte bekräftas. Läs om produkterna för att se om den registrerades." : productsUnavailable });
      }
    } catch {
      if (operation.current === request) setProducts({ ...selection, status: "error", message: productKey
        ? "Begäran kunde inte bekräftas. Läs om produkterna för att se om den registrerades." : productsUnavailable });
    } finally {
      if (operation.current === request) operation.current = null;
    }
  }

  async function showOrders(account: CustomerAccount) {
    const login = active.current;
    if (!login || working || creatingPersonal || account.role === "driver") return;
    operation.current?.abort();
    const request = new AbortController();
    operation.current = request;
    const selection = { accountId: account.id, accountName: account.name };
    const unavailableOrders = "Beställningarna kunde inte hämtas. Försök igen eller öppna kundportalen.";
    setMessage("");
    setProducts(null);
    setVehicles(null);
    setOrders({ ...selection, status: "loading" });
    try {
      const response = await fetch(`/api/kundkonto/${encodeURIComponent(account.id)}/bestallningar`, accountRequest(login, request.signal));
      const result = await response.json();
      if (operation.current !== request) return;
      if (response.status === 401 || (response.status === 403 && result.error !== "ACCESS_DENIED")) {
        void clear(accountError(result.error));
      } else if (response.status === 403) {
        void load(accessDenied);
      } else if (response.ok) {
        setOrders({ ...selection, status: "ready", orders: result });
      } else {
        const message = response.status === 429 ? accountError(result.error) : unavailableOrders;
        setOrders({ ...selection, status: "error", message });
      }
    } catch {
      if (operation.current === request) setOrders({ ...selection, status: "error", message: unavailableOrders });
    } finally {
      if (operation.current === request) operation.current = null;
    }
  }

  async function showVehicles(account: CustomerAccount, previous?: CustomerVehiclePage) {
    const login = active.current;
    if (!login || working || creatingPersonal) return;
    operation.current?.abort();
    const request = new AbortController();
    operation.current = request;
    const selection = { accountId: account.id, accountName: account.name };
    const unavailableVehicles = "Fordonen kunde inte hämtas. Försök igen eller öppna kundportalen.";
    setMessage("");
    setProducts(null);
    setOrders(null);
    setVehicles({ ...selection, status: "loading" });
    try {
      const query = previous?.nextCursor ? `?after=${encodeURIComponent(previous.nextCursor)}` : "";
      const response = await fetch(`/api/kundkonto/${encodeURIComponent(account.id)}/fordon${query}`, accountRequest(login, request.signal));
      const result = await response.json();
      if (operation.current !== request) return;
      if (response.status === 401 || (response.status === 403 && result.error !== "ACCESS_DENIED")) {
        void clear(accountError(result.error));
      } else if (response.status === 403) {
        void load(accessDenied);
      } else if (response.ok) {
        const page: CustomerVehiclePage = result;
        setVehicles({ ...selection, status: "ready", vehicles: {
          items: [...(previous?.items ?? []), ...page.items], nextCursor: page.nextCursor,
        } });
      } else {
        const message = response.status === 429 ? accountError(result.error) : unavailableVehicles;
        setVehicles({ ...selection, status: "error", message });
      }
    } catch {
      if (operation.current === request) setVehicles({ ...selection, status: "error", message: unavailableVehicles });
    } finally {
      if (operation.current === request) operation.current = null;
    }
  }

  function openSession(client: SupabaseClient, session: Session) {
    active.current = { client, session };
    clearTimeout(expiration.current);
    expiration.current = setTimeout(() => { void clear(expired); }, sessionDuration(session));
    void load();
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation.current || active.current || pending.current) return;
    const form = event.currentTarget;
    const credentials = { email: email.current?.value.trim() ?? "", password: password.current?.value ?? "" };
    form.reset();
    const request = new AbortController();
    operation.current = request;
    setWorking(true);
    setMessage("");
    let client: SupabaseClient | undefined;
    let handedOff = false;
    try {
      client = customerAuth(authUrl, publishableKey);
      const { data, error } = await client.auth.signInWithPassword(credentials);
      if (operation.current !== request) return;
      if (error || !data.session) {
        setMessage(error?.status === 429 ? accountError("RATE_LIMITED") : "Inloggningen lyckades inte. Kontrollera dina uppgifter eller fortsätt i kundportalen.");
        return;
      }
      handedOff = true;
      openSession(client, data.session);
    } catch {
      if (operation.current === request) setMessage("Inloggningen kunde inte slutföras. Försök igen eller öppna kundportalen.");
    } finally {
      if (!handedOff) void releaseCustomerAuth(client);
      if (operation.current === request) {
        operation.current = null;
        setWorking(false);
      }
    }
  }

  async function requestEmailCode() {
    if (!emailOtpEnabled || !emailStep || operation.current || active.current || pending.current || Date.now() < emailRetryAt) return;
    const address = (emailStep === "address" ? email.current?.value : emailStep.address)?.trim().toLowerCase();
    if (!address || address.length > 254 || !/^[^@\s]+@[^@\s]+$/.test(address)) return;
    const request = new AbortController();
    operation.current = request;
    setWorking(true);
    setMessage("");
    setEmailRetryAt(Date.now() + emailCodeCooldownMs);
    let client: SupabaseClient | undefined;
    try {
      client = customerAuth(authUrl, publishableKey);
      await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
    } catch {
      // Delivery and account existence are both unknown to this screen.
    } finally {
      client?.auth.dispose();
      if (operation.current === request) {
        operation.current = null;
        setWorking(false);
        setEmailStep({ address });
        setMessage(emailCodeNotice);
      }
    }
  }

  async function confirmEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailOtpEnabled || !emailStep || emailStep === "address" || operation.current || active.current || pending.current) return;
    const digits = code.current?.value ?? "";
    event.currentTarget.reset();
    if (!/^[0-9]{6}$/.test(digits)) {
      setMessage(invalidCode);
      return;
    }
    const request = new AbortController();
    operation.current = request;
    setWorking(true);
    setMessage("");
    let client: SupabaseClient | undefined;
    let handedOff = false;
    try {
      client = customerAuth(authUrl, publishableKey);
      const { data, error } = await client.auth.verifyOtp({ email: emailStep.address, token: digits, type: "email" });
      if (operation.current !== request) return;
      const session = data.session;
      if (error || !session || session.user.email?.trim().toLowerCase() !== emailStep.address) {
        setMessage(invalidCode);
        return;
      }
      handedOff = true;
      setEmailStep(null);
      openSession(client, session);
    } catch {
      if (operation.current === request) setMessage(invalidCode);
    } finally {
      if (!handedOff) void releaseCustomerAuth(client);
      if (operation.current === request) {
        operation.current = null;
        setWorking(false);
      }
    }
  }

  async function confirmVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const verification = pending.current;
    if (!verification || operation.current) return;
    const factorId = factor.current?.value ?? verification.factors[0]?.id ?? "";
    const digits = code.current?.value ?? "";
    if (code.current) code.current.value = "";
    if (!/^[0-9]{6}$/.test(digits) || !verification.factors.some(item => item.id === factorId)) {
      setMessage(invalidCode);
      return;
    }

    const request = new AbortController();
    operation.current = request;
    setWorking(true);
    setMessage("");
    const { login } = verification;
    const auth = login.client.auth;
    let upgraded = false;
    try {
      const result = await auth.mfa.challengeAndVerify({ factorId, code: digits });
      if (operation.current !== request) {
        if (result.data) void releaseCustomerAuth(login.client);
        return;
      }
      if (result.error || !result.data) {
        setMessage(invalidCode);
        return;
      }
      upgraded = true;
      const { data: { session } } = await auth.getSession();
      if (operation.current !== request) {
        void releaseCustomerAuth(login.client);
        return;
      }
      const assurance = session && await auth.mfa.getAuthenticatorAssuranceLevel(session.access_token);
      if (operation.current !== request) {
        void releaseCustomerAuth(login.client);
        return;
      }
      if (!session || session.user.id !== login.session.user.id || session.access_token !== result.data.access_token ||
        assurance?.data?.currentLevel !== "aal2") {
        void clear(accountError("MFA_REQUIRED"));
        return;
      }
      pending.current = null;
      setFactors(null);
      openSession(login.client, session);
    } catch {
      if (operation.current === request) {
        if (upgraded) {
          void clear(accountError("MFA_REQUIRED"));
        } else setMessage(invalidCode);
      }
    } finally {
      if (operation.current === request) {
        operation.current = null;
        setWorking(false);
      }
    }
  }

  async function signOut() {
    const signingOut = clear("Du är utloggad.");
    const request = new AbortController();
    operation.current = request;
    setWorking(true);
    const result = await signingOut;
    if (operation.current !== request) return;
    operation.current = null;
    setWorking(false);
    if (!result || result.error) {
      setMessage("Du är utloggad här. Inloggningstjänsten kunde inte bekräfta utloggningen.");
    }
  }

  const selected = accounts?.find(account => account.id === products?.accountId);
  const orderAccount = accounts?.find(account => account.id === orders?.accountId && account.role !== "driver");
  const vehicleAccount = accounts?.find(account => account.id === vehicles?.accountId);

  return <section id="produkter" className="wizard-panel" style={{ maxWidth: 680, overflowWrap: "anywhere" }}>
    {signedIn ? <>
      <h2 ref={accountHeading} tabIndex={-1}>Mina konton</h2>
      {working && <p role="status">Hämtar dina konton …</p>}
      {accounts?.length === 0 && <p>Du har inga konton att visa ännu.</p>}
      {!!accounts?.length && <ul>{accounts.map(account => <li key={account.id}>
        <strong>{account.name}</strong> <span>· {account.kind === "business" ? "Företag" : "Privat"} · {accountRoleLabels[account.role]}</span>
        <div className="actions"><button type="button" className="button" aria-pressed={account.id === products?.accountId}
          onClick={() => showProducts(account)}>Visa produkter för {account.name}</button>
          {account.role !== "driver" && <button type="button" className="button" aria-pressed={account.id === orders?.accountId}
            onClick={() => showOrders(account)}>Visa beställningar för {account.name}</button>}
          <button type="button" className="button" aria-pressed={account.id === vehicles?.accountId}
            onClick={() => showVehicles(account)}>Visa fordon för {account.name}</button></div>
      </li>)}</ul>}
      {products && selected && <CustomerProducts account={selected} products={products}
        retry={() => void showProducts(selected)} requestAccess={key => void showProducts(selected, key)} />}
      {orders && orderAccount && <CustomerOrdersPanel selection={orders} business={orderAccount.kind === "business"}
        refresh={() => void showOrders(orderAccount)} />}
      {vehicles && vehicleAccount && <CustomerVehiclesPanel selection={vehicles}
        retry={() => void showVehicles(vehicleAccount)} loadMore={page => void showVehicles(vehicleAccount, page)} />}
      {accounts && !accounts.some(account => account.kind === "personal" && account.role === "owner") &&
        <form className="wizard-form" method="post" onSubmit={createPersonal} aria-busy={creatingPersonal}>
          <h3>Skapa privatkonto</h3>
          <label>Kontonamn<input ref={personalName} maxLength={160} required disabled={creatingPersonal} /></label>
          <button type="submit" className="button primary" disabled={creatingPersonal}>
            {creatingPersonal ? "Skapar privatkonto …" : "Skapa privatkonto"}
          </button>
        </form>}
      <div className="actions">
        <button type="button" className="button" onClick={() => { void load(); }} disabled={working || creatingPersonal}>Uppdatera</button>
        <button type="button" className="button" onClick={signOut}>Logga ut</button>
      </div>
    </> : factors ? <form className="wizard-form" method="post" onSubmit={confirmVerification} aria-busy={working}>
      <h2>Tvåstegsverifiering</h2>
      {factors.length > 1 && <label>Kodapp<select ref={factor} disabled={working}>
        {factors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>}
      <label>Sexsiffrig kod<input id="account-totp" ref={code} type="text" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]{6}" maxLength={6} required disabled={working} /></label>
      <div className="actions">
        <button type="submit" className="button primary" disabled={working}>{working ? "Bekräftar …" : "Bekräfta kod"}</button>
        <button type="button" className="button" onClick={() => { void clear(); }}>Avbryt</button>
      </div>
    </form> : emailStep === "address" ? <form key="email-address" className="wizard-form" method="post" onSubmit={event => {
      event.preventDefault();
      void requestEmailCode();
    }} aria-busy={working}>
      <h2>Logga in med e-postkod</h2>
      <label>E-post<input id="account-otp-email" ref={email} type="email" autoComplete="username" maxLength={254} required disabled={working} /></label>
      <div className="actions">
        <button type="submit" className="button primary" disabled={working || emailRetryAt > 0}>Skicka kod</button>
        <button type="button" className="button" onClick={() => { void clear(); }}>Avbryt</button>
      </div>
      {emailRetryAt > 0 && !working && <p>Vänta en minut mellan kodförfrågningar.</p>}
    </form> : emailStep ? <form key="email-code" className="wizard-form" method="post" onSubmit={confirmEmailCode} aria-busy={working}>
      <h2>Bekräfta e-postkoden</h2>
      <label>Kod från e-post<input id="account-email-code" ref={code} type="text" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]{6}" maxLength={6} required disabled={working} /></label>
      <div className="actions">
        <button type="submit" className="button primary" disabled={working}>Bekräfta e-postkod</button>
        <button type="button" className="button" disabled={working || emailRetryAt > 0} onClick={() => { void requestEmailCode(); }}>Skicka ny kod</button>
        <button type="button" className="button" onClick={() => { void clear(); }}>Avbryt</button>
      </div>
      {emailRetryAt > 0 && !working && <p>Vänta en minut mellan kodförfrågningar.</p>}
    </form> : <form key="password" className="wizard-form" method="post" onSubmit={signIn} aria-busy={working}>
      <h2>Logga in</h2>
      {/* Unnamed inputs stay out of native form submissions before hydration. */}
      <label>E-post<input id="account-email" ref={email} type="email" autoComplete="username" maxLength={254} required disabled={working} /></label>
      <label>Lösenord<input id="account-password" ref={password} type="password" autoComplete="current-password" required disabled={working} /></label>
      <button type="submit" className="button primary" disabled={working}>{working ? "Loggar in …" : "Logga in"}</button>
      {emailOtpEnabled && <button type="button" className="button" disabled={working} onClick={() => {
        setMessage("");
        setEmailStep("address");
      }}>Logga in med e-postkod</button>}
    </form>}
    {message && <p className="fine" role="status">{message}</p>}
  </section>;
}
