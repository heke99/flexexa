"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { accountRoleLabels, type CustomerAccount } from "@/lib/customer-accounts";

const unavailable = "Kontona kunde inte hämtas. Försök igen eller öppna kundportalen.";
const expired = "Sessionen har löpt ut. Logga in igen.";

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
  const active = useRef<{ client: SupabaseClient; session: Session } | null>(null);
  const operation = useRef<AbortController | null>(null);
  const expiration = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const email = useRef<HTMLInputElement | null>(null);
  const password = useRef<HTMLInputElement | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [accounts, setAccounts] = useState<CustomerAccount[] | null>(null);

  const clear = useCallback((reason = "") => {
    operation.current?.abort();
    operation.current = null;
    clearTimeout(expiration.current);
    active.current = null;
    setAccounts(null);
    setSignedIn(false);
    setWorking(false);
    setMessage(reason);
  }, []);

  const load = useCallback(async () => {
    const token = active.current?.session.access_token;
    if (!token) return;
    operation.current?.abort();
    const request = new AbortController();
    operation.current = request;
    setAccounts(null);
    setMessage("");
    setWorking(true);
    try {
      const response = await fetch("/api/kundkonto", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: request.signal,
      });
      const result = await response.json();
      if (operation.current !== request) return;
      if (response.status === 401 || response.status === 403) {
        const login = active.current;
        clear(accountError(result.error));
        void login?.client.auth.signOut({ scope: "local" });
      } else if (response.ok) {
        setAccounts(result.items);
      } else {
        setMessage(accountError(result.error));
      }
    } catch {
      if (operation.current === request) setMessage(unavailable);
    } finally {
      if (operation.current === request) {
        operation.current = null;
        setWorking(false);
      }
    }
  }, [clear]);

  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === "visible" && !operation.current) void load();
    };
    const leave = () => clear();
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      operation.current?.abort();
      operation.current = null;
      clearTimeout(expiration.current);
      active.current = null;
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [clear, load]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation.current || active.current) return;
    const form = event.currentTarget;
    const credentials = { email: email.current?.value.trim() ?? "", password: password.current?.value ?? "" };
    form.reset();
    const request = new AbortController();
    operation.current = request;
    setWorking(true);
    setMessage("");
    try {
      const client = createClient(authUrl, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, {
          ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
        }) },
      });
      const { data, error } = await client.auth.signInWithPassword(credentials);
      if (operation.current !== request) {
        if (data.session) void client.auth.signOut({ scope: "local" });
        return;
      }
      if (error || !data.session) {
        setMessage(error?.status === 429 ? accountError("RATE_LIMITED") : "Inloggningen lyckades inte. Kontrollera dina uppgifter eller fortsätt i kundportalen.");
        return;
      }
      active.current = { client, session: data.session };
      expiration.current = setTimeout(() => clear(expired), data.session.expires_in * 1000);
      setSignedIn(true);
      void load();
    } catch {
      if (operation.current === request) setMessage("Inloggningen kunde inte slutföras. Försök igen eller öppna kundportalen.");
    } finally {
      if (operation.current === request) {
        operation.current = null;
        setWorking(false);
      }
    }
  }

  async function signOut() {
    const login = active.current;
    clear("Du är utloggad.");
    const request = new AbortController();
    operation.current = request;
    setWorking(true);
    const result = await login?.client.auth.signOut({ scope: "local" }).catch(() => null);
    if (operation.current !== request) return;
    operation.current = null;
    setWorking(false);
    if (!result || result.error) {
      setMessage("Du är utloggad här. Inloggningstjänsten kunde inte bekräfta utloggningen.");
    }
  }

  return <section className="wizard-panel" style={{ maxWidth: 680, overflowWrap: "anywhere" }}>
    {signedIn ? <>
      <h2>Mina konton</h2>
      {working && <p role="status">Hämtar dina konton …</p>}
      {accounts?.length === 0 && <p>Du har inga konton att visa ännu.</p>}
      {!!accounts?.length && <ul>{accounts.map(account => <li key={account.id}>
        <strong>{account.name}</strong> <span>· {account.kind === "business" ? "Företag" : "Privat"} · {accountRoleLabels[account.role]}</span>
      </li>)}</ul>}
      <div className="actions">
        <button type="button" className="button" onClick={load} disabled={working}>Uppdatera</button>
        <button type="button" className="button" onClick={signOut}>Logga ut</button>
      </div>
    </> : <form className="wizard-form" method="post" onSubmit={signIn} aria-busy={working}>
      <h2>Logga in</h2>
      {/* Unnamed inputs stay out of native form submissions before hydration. */}
      <label>E-post<input id="account-email" ref={email} type="email" autoComplete="username" maxLength={254} required disabled={working} /></label>
      <label>Lösenord<input id="account-password" ref={password} type="password" autoComplete="current-password" required disabled={working} /></label>
      <button type="submit" className="button primary" disabled={working}>{working ? "Loggar in …" : "Logga in"}</button>
    </form>}
    {message && <p className="fine" role="status">{message}</p>}
  </section>;
}
