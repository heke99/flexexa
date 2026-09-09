import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flexexa",
  description: "Energy flexibility infrastructure.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
