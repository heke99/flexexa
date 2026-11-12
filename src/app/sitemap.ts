import type { MetadataRoute } from "next";
export default function sitemap():MetadataRoute.Sitemap{return ["","/energi","/utvecklare","/energy-wizard","/ladda","/elbilsabonnemang","/elbilsabonnemang/integritet","/kontakt","/integritet","/cookies","/villkor"].map(path=>({url:`https://flexexa.com${path}`,changeFrequency:"monthly" as const,priority:path?0.7:1}));}
