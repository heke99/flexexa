"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";

const storageKey = "flexexa.cookie-preferences.v1";
const changeEvent = "flexexa-cookie-preferences-changed";
const lifetime = 180 * 24 * 60 * 60 * 1000;

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}
function snapshot() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null");
    return value?.version === 1 && value.analytics === false && value.marketing === false &&
      typeof value.expiresAt === "number" && value.expiresAt > Date.now() ? "saved" : "unset";
  } catch { return "unset"; }
}
function openSettings() {
  const dialog = document.getElementById("cookie-settings");
  if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
}
export function CookieSettingsButton() {
  return <button type="button" className="cookie-settings-link" onClick={openSettings}>Cookieinställningar</button>;
}
export function CookiePreferences() {
  const choice = useSyncExternalStore(subscribe, snapshot, () => "saved");
  const [dismissed, setDismissed] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  function save() {
    let failed = false;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, expiresAt: Date.now() + lifetime }));
      window.dispatchEvent(new Event(changeEvent));
    } catch { failed = true; }
    setStorageFailed(failed);
    setDismissed(true);
    dialog.current?.close();
  }
  return <>
    {choice === "unset" && !dismissed ? <section className="cookie-banner" role="region" aria-labelledby="cookie-banner-title">
      <div><span className="eyebrow">DIN INTEGRITET</span><h2 id="cookie-banner-title">Du bestämmer över din webbupplevelse.</h2><p>Vi använder ingen analys- eller reklamspårning. Ditt cookieval sparas i webbläsaren så att du slipper se det här meddelandet igen. <Link href="/cookies">Läs om cookies</Link>.</p></div>
      <div className="cookie-actions"><button type="button" className="button primary" onClick={save}>Endast nödvändiga</button><button type="button" className="button" onClick={openSettings}>Inställningar</button></div>
    </section> : null}
    <dialog id="cookie-settings" className="cookie-dialog" ref={dialog} aria-labelledby="cookie-settings-title" aria-describedby="cookie-settings-description">
      <div className="cookie-dialog-heading"><span className="eyebrow">FLEXEXA / INTEGRITET</span><button type="button" className="cookie-close" aria-label="Stäng cookieinställningar" onClick={() => dialog.current?.close()}>×</button></div>
      <h2 id="cookie-settings-title">Dina cookieinställningar.</h2>
      <p id="cookie-settings-description">Här ser du vad som används på webbplatsen. Analys och marknadsföring är inte aktiverade och kan inte slås på här.</p>
      <div className="cookie-category"><div><h3>Nödvändiga funktioner</h3><p>Ditt val sparas lokalt i 180 dagar. Ingen profil eller något kund-ID skapas.</p></div><span className="cookie-badge">Alltid aktiva</span></div>
      <div className="cookie-category"><div><h3>Statistik och analys</h3><p>Inga analysverktyg eller statistikcookies används av webbplatsen.</p></div><span className="cookie-badge inactive">Används inte</span></div>
      <div className="cookie-category"><div><h3>Marknadsföring</h3><p>Inga reklamcookies, annonspixlar eller spårningsprofiler.</p></div><span className="cookie-badge inactive">Används inte</span></div>
      <p className="fine"><Link href="/cookies">Cookieinformation</Link> · <Link href="/integritet">Integritetsinformation</Link></p>
      <button className="button primary" type="button" onClick={save}>Spara — endast nödvändiga</button>
    </dialog>
    {storageFailed ? <p className="cookie-storage-note" role="status">Din webbläsare blockerar lagring av valet. Inga analys- eller reklamcookies aktiveras. Meddelandet kan visas igen vid nästa besök.</p> : null}
  </>;
}
