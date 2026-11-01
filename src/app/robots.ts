import type { MetadataRoute } from "next";
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:"*",allow:"/",disallow:["/app","/admin","/partner"]},sitemap:"https://flexexa.com/sitemap.xml"};}
