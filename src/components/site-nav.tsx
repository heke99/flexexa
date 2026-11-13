"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

const links = [
  ["/energi", "För företag"],
  ["/ladda", "För bilförare"],
  ["/elbilsabonnemang", "Elbilsabonnemang"],
  ["/energy-wizard", "Energy Wizard"],
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return <nav aria-label="Huvudnavigation">
    {links.map(([href, label]) => <Link key={href} href={href}
      aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined}>
      {label}
    </Link>)}
    <a href="https://ladda.flexexa.com" className="nav-account">Mitt konto</a>
  </nav>;
}
