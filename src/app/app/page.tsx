import type { Metadata } from "next";
import { ChargingPreview } from "@/components/charging-preview";
export const metadata: Metadata = { title: "Appförhandsvisning", robots: {index:false,follow:true} };
export default function AppPreviewPage(){return <main id="main" className="app-main"><ChargingPreview /></main>;}
