import {notFound} from "next/navigation";
import {partnerCatalog,partnerLinks} from "@/domains/partner-offers/catalog";

export const metadata={title:"Ditt nästa steg hos Flexexa",robots:{index:false,follow:true}};

export default async function PartnerPage({params}:{params:Promise<{partner:string}>}){
  const {partner}=await params;
  const links=partnerLinks(partner);if(!links)notFound();
  const catalog=partnerCatalog(partner);
  if(!catalog)return <main id="main" className="wrap section"><h1>Ditt nästa steg hos Flexexa</h1><p>Erbjudandena kunde inte hämtas. Försök igen senare.</p></main>;
  return <main id="main" className="wrap section partner-entry"><span className="eyebrow">VÄLKOMMEN TILL FLEXEXA</span><h1>Din energi.<br/>Ditt <em>nästa steg.</em></h1><p className="lead">Du är nu hos Flexexa. Jämför laddabonnemangen eller börja med Energioptimering för ett upplägg utifrån din bostad och dina resurser.</p><p className="fine">Den här länken anger Gridex som kampanjkälla. Den verifierar inte ditt elavtal eller någon rätt till rabatt. Dina kontouppgifter delas inte genom länken.</p><div className="actions"><a className="button primary" href={catalog.energy_wizard_url}>Hitta mitt energiupplägg</a><a className="text-link" href={links.orders}>Fortsätt en befintlig beställning</a></div><div className="offer-grid partner-offers">{catalog.offers.map(offer=><article className="partner-offer" key={offer.id}><span className="eyebrow">FLEXEXA LADDABONNEMANG</span><h2>{offer.name}</h2><p className="partner-price">{new Intl.NumberFormat("sv-SE").format(offer.amount_minor/100)} <small>kr/mån</small></p><p className="fine">inklusive moms</p><p>{offer.price_condition}</p><p>Nya avtal: {offer.renewal_binding_months} månaders bindningstid i taget · {offer.notice_months} kalendermånads uppsägningstid. Tjänsten fortsätter till bekräftat slutdatum.</p><p className="launch-status">{offer.availability_reason}</p><a className="button primary" href={offer.url}>Se villkor och nästa steg</a></article>)}</div><p className="fine">En partnerlänk skapar ingen order. Du loggar in hos Flexexa och godkänner aktuella villkor där när köp är tillgängliga.</p></main>;
}
