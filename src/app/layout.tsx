import type { Metadata } from "next";
import { Header, Footer } from "@/components/site";
import "./globals.css";
export const metadata: Metadata = { metadataBase: new URL("https://flexexa.com"), icons: { icon: "/icon.svg" }, title: { default: "Flexexa — energi i rätt riktning", template: "%s | Flexexa" }, description: "Flexexa utvecklar smart laddning, laddabonnemang och energistyrning. Vi tar emot partnerdialoger med elbolag, laddoperatörer och bilhandlare.", openGraph: { title: "Flexexa — energi i rätt riktning", description: "Smartare laddning. Samordnad energi. Utforska ett partnerskap med Flexexa.", locale: "sv_SE", type: "website" }, robots: { index: true, follow: true } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="sv"><body><a className="skip-link" href="#main">Hoppa till innehåll</a><Header />{children}<Footer /></body></html>; }
