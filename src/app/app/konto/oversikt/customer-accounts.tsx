"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { accountRoleLabels, type CustomerAccount } from "@/lib/customer-accounts";
import type { RequestedProductKey } from "@/lib/customer-product-access";
import { CustomerProducts, type ProductSelection } from "./customer-products";

const unavailable = "Kontona kunde inte hämtas. Försök igen eller öppna kundportalen.";
const productsUnavailable = "Produkterna kunde inte hämtas. Försök igen eller öppna kundportalen.";
const expired = "Sessionen har löpt ut. Logga in igen.";
const invalidCode = "Koden kunde inte bekräftas. Försök igen.";
type CustomerLogin = { client: SupabaseClient; session: Session };
type VerificationFactor = { id: string; name: string };

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

export function CustomerAccounts({ authUrl, publishableKey }: { authUrl: string; publishableKey: string }) {
  const active = useRef<CustomerLogin | null>(null);
  const pending = useRef<{ login: CustomerLogin; factors: VerificationFactor[] } | null>(null);
  const operation = useRef<AbortController | null>(null);
  const expiration = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const email = useRef<HTMLInputElement | null>(null);
  const password = useRef<HTMLInputElement | null>(null);
  const code = useRef<HTMLInputElement | null>(null);
  const factor = useRef<HTMLSelectElement | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [accounts, setAccounts] = useState<CustomerAccount[] | null>(null);
  const [products, setProducts] = useState<ProductSelection | null>(null);
  const [factors, setFactors] = useState<VerificationFactor[] | null>(null);

  const clear = useCallback((reason = "") => {
    const client = active.current?.client ?? pending.current?.login.client;
    operation.current?.abort();
    operation.current = null;
    clearTimeout(expiration.current);
    active.current = null;
    pending.current = null;
    setFactors(null);
    setAccounts(null);
    setProducts(null);
    setSignedIn(false);
    setWorking(false);
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

  const load = useCallback(async () => {
    const login = active.current;
    if (!login) return;
    operation.current?.abort();
    const request = new AbortController();
    operation.current = request;
    setAccounts(null);
    setProducts(null);
    setMessage("");
    setWorking(true);
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
        if (response.ok) setAccounts(result.items);
        else setMessage(accountError(result.error));
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

  async function showProducts(account: CustomerAccount, productKey?: RequestedProductKey) {
    const login = active.current;
    if (!login || working) return;
    operation.current?.abort();
    const request = new AbortController();
    operation.current = request;
    const selection = { accountId: account.id, accountName: account.name };
    setMessage("");
    setProducts({ ...selection, status: "loading", sending: !!productKey });
    try {
      const path = `/api/kundkonto/${encodeURIComponent(account.id)}/produkter`;
      const options = {
        headers: { Authorization: `Bearer ${login.session.access_token}` },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: request.signal,
      } as const;
      const submission = productKey ? await fetch(`${path}/${productKey}`, { ...options, method: "POST" }) : null;
      if (operation.current !== request) return;
      const response = submission && !submission.ok ? submission : await fetch(path, options);
      const result = await response.json();
      if (operation.current !== request) return;
      if (response.status === 401 || (response.status === 403 && result.error !== "ACCESS_DENIED")) {
        void clear(accountError(result.error));
      } else if (response.status === 403 && response === submission) {
        setProducts({ ...selection, status: "error", message: "Din inloggning har inte rätt att begära åtkomst till produkten. Uppdatera kontona om din roll har ändrats." });
      } else if (response.status === 403) {
        setProducts(null);
        setAccounts(current => current?.filter(item => item.id !== account.id) ?? null);
        setMessage("Du saknar åtkomst till kontot. Uppdatera för att hämta aktuella konton.");
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
      client = createClient(authUrl, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, {
          ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
        }) },
      });
      const { data, error } = await client.auth.signInWithPassword(credentials);
      if (operation.current !== request) return;
      if (error || !data.session) {
        setMessage(error?.status === 429 ? accountError("RATE_LIMITED") : "Inloggningen lyckades inte. Kontrollera dina uppgifter eller fortsätt i kundportalen.");
        return;
      }
      active.current = { client, session: data.session };
      handedOff = true;
      expiration.current = setTimeout(() => { void clear(expired); }, sessionDuration(data.session));
      void load();
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
      clearTimeout(expiration.current);
      active.current = { client: login.client, session };
      expiration.current = setTimeout(() => { void clear(expired); }, sessionDuration(session));
      void load();
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

  return <section id="produkter" className="wizard-panel" style={{ maxWidth: 680, overflowWrap: "anywhere" }}>
    {signedIn ? <>
      <h2>Mina konton</h2>
      {working && <p role="status">Hämtar dina konton …</p>}
      {accounts?.length === 0 && <p>Du har inga konton att visa ännu.</p>}
      {!!accounts?.length && <ul>{accounts.map(account => <li key={account.id}>
        <strong>{account.name}</strong> <span>· {account.kind === "business" ? "Företag" : "Privat"} · {accountRoleLabels[account.role]}</span>
        <div><button type="button" className="button" aria-pressed={account.id === products?.accountId}
          onClick={() => showProducts(account)}>Visa produkter för {account.name}</button></div>
      </li>)}</ul>}
      {products && selected && <CustomerProducts account={selected} products={products}
        retry={() => void showProducts(selected)} requestAccess={key => void showProducts(selected, key)} />}
      <div className="actions">
        <button type="button" className="button" onClick={load} disabled={working}>Uppdatera</button>
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
    </form> : <form className="wizard-form" method="post" onSubmit={signIn} aria-busy={working}>
      <h2>Logga in</h2>
      {/* Unnamed inputs stay out of native form submissions before hydration. */}
      <label>E-post<input id="account-email" ref={email} type="email" autoComplete="username" maxLength={254} required disabled={working} /></label>
      <label>Lösenord<input id="account-password" ref={password} type="password" autoComplete="current-password" required disabled={working} /></label>
      <button type="submit" className="button primary" disabled={working}>{working ? "Loggar in …" : "Logga in"}</button>
    </form>}
    {message && <p className="fine" role="status">{message}</p>}
  </section>;
}
