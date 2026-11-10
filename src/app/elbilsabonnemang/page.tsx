import styles from "./offers.module.css";
import type {Metadata} from "next";
import {ApplicationCounter,ApplicationForm} from "@/components/application-form";
export const metadata:Metadata={title:"Elbilsabonnemang — ansök utan bindning",description:"Jämför Flexexa med och utan Gridex elavtal. Läs om hemmaladdning och publik laddning och anmäl intresse utan bindning.",alternates:{canonical:"https://www.flexexa.com/elbilsabonnemang"}};
const questions=[['Vad innebär fri laddning?','Det planerade upplägget omfattar verifierad hemmaladdning och publik laddning hos de partner som anges i ditt avtal. Fri laddning betyder inte att alla laddstationer eller avgifter i Sverige automatiskt ingår. Pris, nätverk och fullständiga villkor ska framgå av erbjudandet innan du tecknar avtal.'],['Hur fungerar ersättningen för hemmaladdning?','Du betalar din elhandelsfaktura som vanligt. Vi beräknar månadsvis ersättningen för den verifierade energi som använts till din godkända hemmaladdning, utifrån elhandelspriset för månaden enligt avtalet. Ersättningsunderlaget ska visa laddenergi, pris och belopp. Nätägarens avgifter ingår inte.'],['Betalar ni nätavgifter och effekttariffer?','Nej. Hemersättningen gäller godkänd laddenergi och de elhandelskostnader som anges i avtalet. Nätavgift, nätägarens effekttariff, parkeringsavgift och andra ej avtalade avgifter ingår inte.'],['Måste jag byta elhandelsbolag?','Ansökan kräver inget byte av elhandelsbolag. Eventuella tekniska krav på laddare, bil och mätunderlag framgår av ditt erbjudande.'],['Vad får de första 1 000?','De första 1 000 registrerade platserna tillhör gruppen för specialerbjudandet. Exakt pris och villkor lämnas i erbjudandet. De 93 redan registrerade platserna ingår i denna gräns.'],['Kan jag ansöka efter 1 000?','Ja. Ansökningarna fortsätter och senare sökande får ett annat erbjudande. Din erbjudandegrupp sparas när den nya, unika ansökan registreras.'],['Är ansökan bindande?','Nej. Ansökan är en intresseanmälan, inte ett köp. Inga pengar dras och du förbinder dig inte att teckna ett abonnemang.'],['Kan jag ansöka flera gånger?','En mejladress får en ansökan. Om du behöver rätta uppgifter kontaktar du info@flexexa.com. En upprepad ansökan ger ingen extra plats och påverkar inte räknaren.'],['Hur använder ni mina uppgifter?','Trafexa Nordic AB hanterar din ansökan och kontaktar dig om den. Vi säljer inte uppgifterna. Ytterligare erbjudandeutskick kräver ditt separata, frivilliga samtycke. Läs integritetsinformationen vid formuläret.']];
export default function SubscriptionPage(){return <main id="main"><section className="wrap hero subscription-hero"><div className="hero-copy"><span className="eyebrow">FLEXEXA ELBILSABONNEMANG</span><h1>Laddning hemma<br/>och <em>på vägen.</em></h1><p className="lead">Jämför två sätt att teckna ett laddabonnemang för din bil. Du kan behålla ditt elavtal eller välja Gridex när erbjudandet öppnar.</p><a className="button primary" href="#erbjudanden">Jämför erbjudandena ↗</a> <a href="#ansok">Anmäl intresse</a><p className="fine">De första 1 000 får ett specialerbjudande. Ansökningarna fortsätter även därefter.</p><ApplicationCounter/></div><ApplicationForm/></section><section className="wrap section" id="erbjudanden">
      <span className="eyebrow">TVÅ LADDALTERNATIV</span>
      <h2>Välj hur du vill ladda</h2>
      <p>Planerade erbjudanden. Köp öppnar när laddnätverk och slutliga villkor är klara.</p>
      <div className={styles.cards}>
        <article className={styles.card} aria-labelledby="flexexa-erbjudande">
          <span className="eyebrow">MED DITT NUVARANDE ELAVTAL</span>
          <h3 id="flexexa-erbjudande">Flexexa</h3>
          <dl className={styles.terms}>
            <div><dt>Bindningstid för laddning</dt><dd>3 månader</dd></div>
            <div><dt>Uppsägningstid</dt><dd>1 månad</dd></div>
            <div><dt>Planerad förlängning</dt><dd>6 månader i taget</dd></div>
          </dl>
          <p>Behåll din elleverantör. En verifierad bil och kompatibel mätlösning behövs för ersättning för hemmaladdning.</p>
          <a className="button primary" href="#ansok">Anmäl intresse</a>
        </article>
        <article className={`${styles.card} ${styles.gridex}`} aria-labelledby="gridex-erbjudande">
          <span className="eyebrow">MED SEPARAT ELAVTAL</span>
          <h3 id="gridex-erbjudande">Flexexa med Gridex</h3>
          <dl className={styles.terms}>
            <div><dt>Planerad bindningstid för elavtalet</dt><dd>Minst 2 månader</dd></div>
            <div><dt>Bindningstid för laddning</dt><dd>Meddelas före köp</dd></div>
            <div><dt>Rabattstart</dt><dd>När Gridex levererar el</dd></div>
          </dl>
          <p>Gridex EL AB tecknar och fakturerar det portföljförvaltade elavtalet separat. Rabatten på laddabonnemanget kräver en kvalificerande elleverans.</p>
          <a className="button primary" href="#ansok">Anmäl intresse</a>
        </article>
      </div>
      <div className={styles.note}>
        <p><strong>Ett energitillägg kan tillkomma.</strong> Beräkningssätt, laddnätverk och fullständiga villkor visas innan köp öppnar. Intresseanmälan är utan bindning.</p>
        <a href="https://ladda.flexexa.com/">Logga in på Flexexa Ladda</a>
      </div>
    </section><section className="wrap section"><span className="eyebrow">HEMMA OCH PÅ VÄG</span><h2>Ett laddliv.<br/>Ett samlat upplägg.</h2><div className="three-grid">{[['Hemma','Ladda via din godkända hemmalösning. Vi ersätter verifierad laddenergi månadsvis enligt elhandelspriset i avtalet.'],['I Sverige','Ladda hos de partner som är anslutna till nätverket och omfattas av ditt avtal. Kontrollera vilka stationer som ingår i erbjudandet.'],['På dina villkor','Din ansökan är inte bindande. När erbjudandet kommer får du ta ställning till pris, täckning och fullständiga villkor.']].map(([title,body])=><article className="step" key={title}><span>↗</span><h3>{title}</h3><p>{body}</p></article>)}</div></section><section className="wrap section"><span className="eyebrow">FRÅGOR OCH SVAR</span><h2>Det här gäller.</h2><div className="faq">{questions.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section></main>;}
