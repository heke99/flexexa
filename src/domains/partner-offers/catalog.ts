export const catalogVersion="flexexa-partner-offers-2026-11-13-v2";
export const partnerCodes=["gridex"] as const;
export type PartnerCode=typeof partnerCodes[number];

export function partnerCode(value:unknown):PartnerCode|null {
  return typeof value==="string" && partnerCodes.includes(value as PartnerCode)?value as PartnerCode:null;
}

export function partnerCatalog(code:unknown){
  const partner=partnerCode(code);if(!partner)return null;
  return {
    version:catalogVersion,
    partner_code:partner,
    integration_status:"public_handoff_only",
    customer_data_shared:false,
    attribution:"Public campaign source only; not verified identity, supply eligibility or a commission claim.",
    landing_url:"https://flexexa.com/partner/"+partner,
    energy_wizard_url:"https://flexexa.com/energy-wizard?partner="+partner,
    offers:[
      {id:"flexexa",name:"Flexexa",amount_minor:166000,currency:"SEK",vat_included:true,interval:"month",price_condition:"Behåll ditt nuvarande elavtal.",purchase_available:false,availability_reason:"Nya köp är inte öppna ännu.",initial_binding_months:2,notice_months:1,renewal_months:2,renewal_binding_months:2,calendar_timezone:"Europe/Stockholm",terms_version:"privat-2026-11-13-v5",terms_url:"https://ladda.flexexa.com/terms/privat-2026-11-13-v5.pdf",url:"https://ladda.flexexa.com/elbilsabonnemang/flexexa/orderoversikt?partner="+partner},
      {id:"flexexa-gridex",name:"Flexexa med Gridex",amount_minor:157000,currency:"SEK",vat_included:true,interval:"month",price_condition:"Priset för Flexexa gäller endast under bekräftad rabattgrundande elleverans från Gridex. Ordinarie pris 1 660 kr/månad. Gridex elavtal och avgifter faktureras separat.",purchase_available:false,availability_reason:"Nya köp är inte öppna ännu.",initial_binding_months:2,notice_months:1,renewal_months:2,renewal_binding_months:2,calendar_timezone:"Europe/Stockholm",terms_version:"privat-2026-11-13-v5",terms_url:"https://ladda.flexexa.com/terms/privat-2026-11-13-v5.pdf",url:"https://ladda.flexexa.com/elbilsabonnemang/flexexa-gridex?partner="+partner},
    ],
  };
}
