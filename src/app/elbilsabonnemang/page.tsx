import type { Metadata } from "next";
import styles from "./offers.module.css";

const portal = "https://ladda.flexexa.com";
const canonical = "https://www.flexexa.com/elbilsabonnemang";

export const metadata: Metadata = {
  title: "Elbilsabonnemang – Flexexa Ladda",
  description: "Jämför Flexexas laddabonnemang med och utan Gridex elavtal. Se bindningstid och hur köp och laddning fungerar.",
  alternates: { canonical },
};

const questions = [
  ["Måste jag byta elhandelsbolag?", "Du kan välja Flexexa och behålla ditt nuvarande elavtal. Flexexa med Gridex innehåller ett separat portföljförvaltat elavtal från Gridex EL AB."],
  ["Hur fungerar hemmaladdningen?", "Det planerade upplägget ersätter verifierad laddenergi enligt produktvillkoren. Din bil och mätlösning behöver kunna verifieras. Nätavgifter och effekttariffer ingår inte i ersättningen."],
  ["Var kan jag ladda publikt?", "Stationslistan visar vilka anslutna laddstationer som omfattas när abonnemanget öppnar för köp."],
  ["Vad är energitillägget?", "Ett energitillägg kan tillkomma enligt det erbjudande du väljer. Beräkningssättet och vilka laddningar som omfattas ska visas i villkoren före beställning."],
  ["Kan jag använda min befintliga laddbox?", "Du får se vilka laddboxar och mätlösningar som stöds i produktvillkoren. Laddbox och installation kan erbjudas separat."],
];

export default function SubscriptionPage() {
  const flexexaOpen = process.env.FLEXEXA_PRIVATE_CHECKOUT_OPEN === "true";

  return (
    <main id="main">
      <section className="wrap section">
        <span className="eyebrow">FLEXEXA ELBILSABONNEMANG</span>
        <h1>Laddning hemma<br/>och <em>på vägen.</em></h1>
        <p className="lead">Jämför Flexexa med och utan Gridex elavtal. Här ser du vad som skiljer alternativen och hur du går vidare till köp.</p>
        <a className="button primary" href="#erbjudanden">Jämför erbjudandena</a>
      </section>

      <section className="wrap section" id="erbjudanden">
        <span className="eyebrow">TVÅ LADDALTERNATIV</span>
        <h2>Välj hur du vill ladda</h2>
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
            {flexexaOpen
              ? <a className="button primary" href={portal + "/kop"}>Köp Flexexa</a>
              : <p><strong>Köp är ännu inte öppet.</strong> De angivna avtalsperioderna är planerade.</p>}
          </article>
          <article className={`${styles.card} ${styles.gridex}`} aria-labelledby="gridex-erbjudande">
            <span className="eyebrow">MED SEPARAT ELAVTAL</span>
            <h3 id="gridex-erbjudande">Flexexa med Gridex</h3>
            <dl className={styles.terms}>
              <div><dt>Uppsägningstid för elavtalet</dt><dd>1 månad</dd></div>
              <div><dt>Bindningstid för laddning</dt><dd>Meddelas före köp</dd></div>
              <div><dt>Rabattstart</dt><dd>Vid kvalificerande elleverans</dd></div>
            </dl>
            <h4>Välj elavtal vid teckning</h4>
            <dl className={styles.terms}>
              <div><dt>Månadspris</dt><dd>2 månaders bindning. Samma elpris per kWh inom månaden.</dd></div>
              <div><dt>Kvartspris</dt><dd>2 månaders bindning. Elpriset följer elbörsen var 15:e minut.</dd></div>
              <div><dt>Portföljförvaltat</dt><dd>3 månaders bindning. Gridex prissäkrar en del av elinköpen.</dd></div>
            </dl>
            <p>Gridex EL AB tecknar och fakturerar elavtalet separat. Rabatten gäller laddabonnemanget när den kvalificerande elleveransen är aktiv.</p>
            <p><strong>Köp med Gridex är ännu inte öppet.</strong></p>
          </article>
        </div>
        <div className={styles.note}>
          <p><strong>Ett energitillägg kan tillkomma.</strong> Pris, beräkningssätt, laddnätverk och fullständiga villkor visas före beställning.</p>
          <a href={portal + "/"}>Logga in på Flexexa Ladda</a>
        </div>
      </section>

      <section className="wrap section" id="ansok">
        <span className="eyebrow">FRÅN ERBJUDANDE TILL LADDNING</span>
        <h2>Så går köpet till</h2>
        <div className="three-grid">
          <article className="step"><h3>Välj abonnemang</h3><p>Jämför villkoren och välj det erbjudande som passar dig.</p></article>
          <article className="step"><h3>Kontrollera din bil och order</h3><p>I Flexexa Ladda loggar du in, väljer en verifierad bil och granskar pris och avtalsvillkor.</p></article>
          <article className="step"><h3>Betala och följ status</h3><p>Gå vidare till betalning. När den har bekräftats kan du följa abonnemangets status på ditt konto.</p></article>
        </div>
      </section>

      <section className="wrap section">
        <span className="eyebrow">FRÅGOR OCH SVAR</span>
        <h2>Det här gäller</h2>
        <div className="faq">
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<span aria-hidden="true">+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
