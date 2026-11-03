import type {Metadata} from "next";
import {AdminApplications} from "@/components/admin-applications";
export const metadata:Metadata={title:"Kontoinställningar",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function Page(){return <main id="main" className="wrap section"><span className="eyebrow">FLEXEXA / SUPERADMIN</span><h1>Kontoinställningar.</h1><AdminApplications view="settings"/></main>;}
