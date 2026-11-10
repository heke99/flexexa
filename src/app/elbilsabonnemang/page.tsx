import type {Metadata} from "next";
import styles from "./offers.module.css";
import {ApplicationCounter,ApplicationForm} from "@/components/application-form";
export const metadata:Metadata={title:"Elbilsabonnemang — ansök utan bindning",description:"Fri laddning hemma och hos anslutna laddpartner i Sverige. Ansök utan bindning. De första 1 000 får ett specialerbjudande."};
const questions=[['Vad innebär fri laddning?','Abonnemangets upplägg omfattar laddning hemma och hos de laddpartner i Sverige som ingår i ditt avtalade nätverk. Fri laddning betyder inte att alla laddstationer eller avgifter i Sverige automatiskt ingår. Pris, nätverk och fullständiga villkor ska framgå av erbjudandet innan du tecknar avtal.'],['Hur fungerar ersättningen för hemmaladdning?','Du betalar din elhandelsfaktura som vanligt. Vi beräknar månadsvis ersättningen för den verifierade energi som använts till din godkända hemmaladdning, utifrån elhandelspriset för månaden enligt avtalet. Ersättningsunderlaget ska visa laddenergi, pris och belopp. Nätägarens avgifter ingår inte.'],['Betalar ni nätavgifter och effekttariffer?','Nej. Hemersättningen gäller godkänd laddenergi och de elhandelskostnader som anges i avtalet. Nätavgift, nätägarens effekttariff, parkeringsavgift och andra ej avtalade avgifter ingår inte.'],['Måste jag byta elhandelsbolag?','Ansökan kräver inget byte av elhandelsbolag. Eventuella tekniska krav på laddare, bil och mätunderlag framgår av ditt erbjudande.'],['Vad får de första 1 000?','De första 1 000 registrerade platserna tillhör gruppen för specialerbjudandet. Exakt pris och villkor lämnas i erbjudandet. De 93 redan registrerade platserna ingår i denna gräns.'],['Kan jag ansöka efter 1 000?','Ja. Ansökningarna fortsätter och senare sökande får ett annat erbjudande. Din erbjudandegrupp sparas när den nya, unika ansökan registreras.'],['Är ansökan bindande?','Nej. Ansökan är en intresseanmälan, inte ett köp. Inga pengar dras och du förbinder dig inte att teckna ett abonnemang.'],['Kan jag ansöka flera gånger?','En mejladress får en ansökan. Om du behöver rätta uppgifter kontaktar du info@flexexa.com. En upprepad ansökan ger ingen extra plats och påverkar inte räknaren.'],['Hur använder ni mina uppgifter?','Trafexa Nordic AB hanterar din ansökan och kontaktar dig om den. Vi säljer inte uppgifterna. Ytterligare erbjudandeutskick kräver ditt separata, frivilliga samtycke. Läs integritetsinformationen vid formuläret.']];
export default function SubscriptionPage(){return <main id="main"><section className="wrap hero subscription-hero"><div className="hero-copy"><span className="eyebrow">FLEXEXA ELBILSABONNEMANG</span><h1>Fri laddning.<br/>Fler <em>möjligheter.</em></h1><p className="lead">Hemma och hos våra anslutna laddpartner i Sverige. Ett samlat laddabonnemang för din vardag och dina resor.</p><a className="button primary" href="#erbjudanden">Se erbjudandena ↗</a><p className="fine">De första 1 000 får ett specialerbjudande. Ansökningarna fortsätter även därefter.</p><ApplicationCounter/></div><ApplicationForm/></section>
<section className="wrap section" id="erbjudanden" aria-labelledby="erbjudanden-rubrik">
  <span className="eyebrow">TVÅ LADDALTERNATIV</span>
  <h2 id="erbjudanden-rubrik">Välj ditt laddabonnemang</h2>
  <div className={styles.cards}>
    <article className="step" aria-labelledby="flexexa-erbjudande">
      <h3 id="flexexa-erbjudande">Flexexa</h3>
      <p><strong>1 600 kr/mån</strong> inklusive moms</p>
      <p>Behåll ditt nuvarande elavtal.</p>
      <p>2 månaders bindningstid och 1 månads uppsägningstid för laddabonnemanget.</p>
      <a className="button primary" href="#ansok">Anmäl intresse för Flexexa</a>
    </article>
    <article className="step" aria-labelledby="gridex-erbjudande">
      <h3 id="gridex-erbjudande">Flexexa med Gridex elavtal</h3>
      <p><strong>1 569 kr/mån i fasta avgifter</strong> inklusive moms när rabatten gäller.</p>
      <p>Flexexa kostar 1 510 kr/mån efter 90 kr rabatt när elleveransen från Gridex är aktiv. Gridex EL AB fakturerar sitt separata elavtal med en fast avgift på 59 kr/mån. Hushållets elförbrukning och elnätskostnader tillkommer.</p>
      <p>Laddabonnemanget har 2 månaders bindningstid och 1 månads uppsägningstid.</p>
      <h4>Välj mellan tre elavtal</h4>
      <dl>
        <dt><strong>Rörligt månadspris</strong></dt>
        <dd>Elpriset per kWh är detsamma under månaden. 2 månaders bindningstid.</dd>
        <dt><strong>Kvartspris</strong></dt>
        <dd>Elpriset följer elbörsen var 15:e minut. 2 månaders bindningstid.</dd>
        <dt><strong>Portföljförvaltat</strong></dt>
        <dd>Gridex prissäkrar en del av elinköpen. 3 månaders bindningstid.</dd>
      </dl>
      <p>Alla tre elavtalen har 1 månads uppsägningstid.</p>
      <a className="button primary" href="#ansok">Anmäl intresse för Flexexa med Gridex</a>
    </article>
  </div>
  <p>Med båda alternativen kan du ladda hos anslutna laddpartner i Sverige och få ersättning för verifierad hemmaladdning enligt avtalet. Elnätsavgifter och effekttariffer ingår inte i hemersättningen. Energitillägg kan tillkomma enligt villkoren.</p>
</section>
<section className="wrap section"><span className="eyebrow">HEMMA OCH PÅ VÄG</span><h2>Ett laddliv.<br/>Ett samlat upplägg.</h2><div className="three-grid">{[['Hemma','Ladda via din godkända hemmalösning. Vi ersätter verifierad laddenergi månadsvis enligt elhandelspriset i avtalet.'],['I Sverige','Ladda hos de partner som är anslutna till nätverket och omfattas av ditt avtal. Kontrollera vilka stationer som ingår i erbjudandet.'],['På dina villkor','Din ansökan är inte bindande. När erbjudandet kommer får du ta ställning till pris, täckning och fullständiga villkor.']].map(([title,body])=><article className="step" key={title}><span>↗</span><h3>{title}</h3><p>{body}</p></article>)}</div></section><section className="wrap section"><span className="eyebrow">FRÅGOR OCH SVAR</span><h2>Det här gäller.</h2><div className="faq">{questions.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section></main>;}
