export const assessmentVersion = "flexexa-energy-profile-2026-11-12-v1";

export const options = {
  home: {unknown:"Vet inte", house:"Villa", terrace:"Radhus", apartment:"Lägenhet", other:"Annat boende"},
  tenure: {owner:"Jag äger bostaden", tenant:"Jag hyr", association:"Bostadsrätt", unknown:"Vet inte"},
  area: {SE1:"SE1", SE2:"SE2", SE3:"SE3", SE4:"SE4", unknown:"Vet inte"},
  tariff: {quarterly:"Kvartspris", monthly:"Rörligt månadspris", fixed:"Fast pris", portfolio:"Portföljpris", unknown:"Vet inte"},
  heating: {heat_pump:"Värmepump", electric:"Direktverkande el", district:"Fjärrvärme", other:"Annat", unknown:"Vet inte"},
  ev: {yes:"Har elbil eller laddhybrid", planned:"Planerar elbil", no:"Ingen elbil"},
  charger: {yes:"Har laddbox", planned:"Planerar laddbox", no:"Ingen laddbox", unknown:"Vet inte"},
  solar: {yes:"Har solceller", planned:"Planerar solceller", no:"Inga solceller"},
  battery: {yes:"Har husbatteri", planned:"Planerar husbatteri", no:"Inget husbatteri"},
  homeAssistant: {yes:"Använder Home Assistant", no:"Använder inte Home Assistant", unknown:"Vet inte"},
  goals: {overview:"Bättre överblick", cost:"Förstå och minska elkostnaden", peaks:"Minska samtidiga effekttoppar", solar:"Använda mer egen solel"},
} as const;

export type EnergyProfile = {
  [K in Exclude<keyof typeof options,"goals">]: keyof typeof options[K]
} & {annualKwh:number|null; fuseAmps:number|null; solarKwp:number|null; batteryKwh:number|null; goals:(keyof typeof options.goals)[]};

export const emptyProfile: EnergyProfile = {home:"unknown",tenure:"unknown",area:"unknown",tariff:"unknown",heating:"unknown",ev:"no",charger:"no",solar:"no",battery:"no",homeAssistant:"unknown",annualKwh:null,fuseAmps:null,solarKwp:null,batteryKwh:null,goals:["overview"]};

export function validateProfile(input:unknown):EnergyProfile {
  if(!input || typeof input!=="object" || Array.isArray(input))throw Error("Kontrollera uppgifterna i guiden.");
  const value=input as Record<string,unknown>;
  const allowed=[...Object.keys(options),"annualKwh","fuseAmps","solarKwp","batteryKwh"];
  if(Object.keys(value).some(k=>!allowed.includes(k)))throw Error("Profilen innehåller okända fält.");
  for(const [key,values] of Object.entries(options)){
    if(key==="goals")continue;
    if(typeof value[key]!=="string" || !Object.hasOwn(values,value[key] as string))throw Error("Kontrollera valen i guiden.");
  }
  for(const [key,max] of [["annualKwh",200000],["solarKwp",200],["batteryKwh",500]] as const){
    const n=value[key];if(n!==null && (typeof n!=="number" || !Number.isFinite(n) || n<0 || n>max))throw Error("Kontrollera förbrukning och kapacitet. Lämna okända värden tomma.");
  }
  if(value.fuseAmps!==null && ![16,20,25,35,50,63,80,100].includes(value.fuseAmps as number))throw Error("Välj huvudsäkring eller Vet inte.");
  if(!Array.isArray(value.goals) || !value.goals.length || value.goals.length>4 || new Set(value.goals).size!==value.goals.length || value.goals.some(x=>typeof x!=="string"||!Object.hasOwn(options.goals,x)))throw Error("Välj minst ett mål.");
  if(value.solar!=="yes" && value.solarKwp!==null)throw Error("Ange solcellseffekt bara för befintliga solceller.");
  if(value.battery!=="yes" && value.batteryKwh!==null)throw Error("Ange batterikapacitet bara för ett befintligt husbatteri.");
  // Return only schema fields, never retain input objects or authority supplied by a client.
  return Object.fromEntries(allowed.map(k=>[k,k==="goals"?[...value.goals as string[]]:value[k]])) as EnergyProfile;
}

export type Recommendation = {id:string;title:string;reason:string;nextStep:string;href:string;label:string};

export function assessProfile(input:unknown){
  const profile=validateProfile(input), recommendations:Recommendation[]=[], missing:string[]=[];
  if(profile.home==="unknown")missing.push("Bostadstyp");
  if(profile.annualKwh===null)missing.push("Din årsförbrukning från elhandelsfakturan");
  if(profile.area==="unknown")missing.push("Bostadens elområde");
  if(profile.tariff==="unknown")missing.push("Vilken prisform ditt nuvarande elavtal har");
  const add=(r:Recommendation)=>recommendations.push(r);
  if(profile.ev!=="no")add({id:"ev",title:profile.ev==="planned"?"Planera bilen och laddningen tillsammans":"Samla bilens laddning och kostnader",reason:profile.ev==="planned"?"Du planerar elbil. Börja med körbehov och möjlighet att ladda där du bor.":"Du har elbil eller laddhybrid. Ett samlat upplägg kan ge bättre överblick över bilens laddning.",nextStep:profile.charger==="yes"?"Kontrollera laddboxmodell, sessionsmätning och vilka bilar som använder boxen. Kompatibilitet behöver verifieras.":"Kartlägg parkeringsplats, tillstånd och möjlighet att installera laddbox före val av laddlösning.",href:"/elbilsabonnemang",label:"Jämför laddabonnemangen"});
  if(profile.solar==="yes" || profile.battery==="yes" || profile.heating==="heat_pump")add({id:"energy",title:"Se bostadens resurser som en helhet",reason:"Du har "+[profile.solar==="yes"?"solceller":null,profile.battery==="yes"?"husbatteri":null,profile.heating==="heat_pump"?"värmepump":null].filter(Boolean).join(", ")+". Förbrukning, produktion och effekt behöver bedömas tillsammans.",nextStep:"Samla fabrikat, modeller och mätunderlag. Anslutning och styrning kräver en separat verifierad integration och ditt uttryckliga mandat.",href:"/energi",label:"Utforska Flexexa Energy"});
  if(profile.solar==="planned" || profile.battery==="planned")add({id:"investment",title:"Planera nya resurser efter ditt hem",reason:"Du planerar solceller eller husbatteri. Förutsättningarna behöver kopplas till bostaden och ditt förbrukningsmönster.",nextStep:"Ta fram förbrukningsprofil, förutsättningar för installation och en specificerad offert. Guiden dimensionerar inte en anläggning eller räknar hem en investering utan underlag.",href:"/kontakt?intresse=energi",label:"Diskutera ditt energiupplägg"});
  if(profile.goals.includes("peaks") || (profile.ev==="yes" && ["heat_pump","electric"].includes(profile.heating)))add({id:"peaks",title:"Börja med de samtidiga lasterna",reason:"Bil och elvärme kan använda effekt samtidigt. Ditt mål eller dina resurser motiverar en kartläggning av effekttoppar.",nextStep:profile.fuseAmps===null?"Ta fram huvudsäkring, nätägarens effekttariff och tim-/kvartsmätning. Guida inte en installation utifrån enbart årsförbrukningen.":"Du har angett "+profile.fuseAmps+" A. Jämför det med uppmätta laster och nätägarens tariff; guiden bedömer inte installationens elsäkerhet.",href:"/kontakt?intresse=energi",label:"Prata om energiplanering"});
  if(profile.tariff==="quarterly")add({id:"tariff",title:"Matcha planeringen med ditt kvartspris",reason:"Ditt elpris varierar per kvart. Tidpunkten för flyttbar förbrukning kan därför påverka kostnaden.",nextStep:"Jämför faktisk förbrukning, pris, komfort och när bilen behövs. Ingen besparing kan fastställas utan mätdata och verkliga priser.",href:"/energi",label:"Läs om energiplanering"});
  else if(profile.goals.includes("cost"))add({id:"tariff",title:"Jämför hela elavtalet",reason:"Du vill förstå elkostnaden. Elpris, påslag, fasta avgifter och nätkostnader påverkar helheten.",nextStep:"Ta fram nuvarande faktura och avtalsvillkor. Gridex är ett separat val; denna guide genomför inget byte och ger ingen automatisk rabatt.",href:"/elbilsabonnemang#erbjudanden",label:"Se Flexexa och Gridexalternativet"});
  if(profile.tenure==="tenant" || profile.tenure==="association")missing.push("Vem som får godkänna installationer och anslutningar i bostaden");
  if(profile.solar==="yes" && profile.solarKwp===null)missing.push("Solcellernas installerade effekt och växelriktarmodell");
  if(profile.battery==="yes" && profile.batteryKwh===null)missing.push("Husbatteriets användbara kapacitet och modell");
  if(!recommendations.length)add({id:"overview",title:"Börja med en tydlig energibild",reason:"Utifrån dina svar är överblick över hemmet och elavtalet ett bra första steg.",nextStep:"Samla årsförbrukning, elavtal och nätfaktura innan du tar ställning till utrustning eller ändrat avtal.",href:"/energi",label:"Utforska energialternativen"});
  return {version:assessmentVersion,profile,recommendations,missing,availability:"Kartläggning och vägledning. Inget avtal tecknas, ingen utrustning ansluts och ingen besparing garanteras."};
}
