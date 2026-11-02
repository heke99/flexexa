import type {Metadata} from "next";
import {AdminApplications} from "@/components/admin-applications";
export const metadata:Metadata={title:"Superadmin — ansökningar",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function AdminPage(){return <main id="main" className="wrap section"><span className="eyebrow">FLEXEXA / SUPERADMIN</span><h1>Ansökningar.</h1><AdminApplications/></main>;}
