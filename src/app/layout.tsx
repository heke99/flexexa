import type { Metadata, Viewport } from "next";
import { Header, Footer } from "@/components/site";
import "./globals.css";
import { CookiePreferences } from "@/components/cookie-preferences";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
export const metadata: Metadata = { metadataBase: new URL("https://flexexa.com"), icons: { icon: "/icon.svg", apple: "/icon-192.png" }, title: { default: "Flexexa — energi i rätt riktning", template: "%s | Flexexa" }, description: "Flexexa — smart laddning, laddabonnemang och energistyrning. Kontakta oss om ett upplägg för din bil eller din verksamhet.", openGraph: { title: "Flexexa — energi i rätt riktning", description: "Smartare laddning. Samordnad energi. Utforska ett partnerskap med Flexexa.", locale: "sv_SE", type: "website" }, robots: { index: true, follow: true } };
export const viewport: Viewport = { themeColor: "#123c35" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="sv"><body><a className="skip-link" href="#main">Hoppa till innehåll</a><Header />{children}<Footer /><CookiePreferences /><ServiceWorkerRegistration /></body></html>; }
