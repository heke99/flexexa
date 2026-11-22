"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import { customerPortalEntry } from "@/lib/customer-portal-entry";

const links = [
  ["/energi", "För företag"],
  ["/ladda", "För bilförare"],
  ["/elbilsabonnemang", "Elbilsabonnemang"],
  ["/energy-wizard", "Energioptimering"],
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return <nav aria-label="Huvudnavigation">
    {links.map(([href, label]) => <Link key={href} href={href}
      aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined}>
      {label}
    </Link>)}
    <a href={customerPortalEntry("konto")} className="nav-account">Mitt konto</a>
  </nav>;
}
