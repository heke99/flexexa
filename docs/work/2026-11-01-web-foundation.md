# Första webbversionen — 2026-11-01

## Uppdrag och omfattning

Användaren godkände publicering av masterplan/startkit och bad om byggstart för gemensam hemsida och webbapp. Senare styrning: egen återhållsam design, integritet/cookies/villkor på plats. Kontaktadress info@flexexa.com och ansvarig verksamhet Trafexa Nordic bekräftades av användaren.

Aktiverade riktlinjer: repo nextjs, react-best-practices, shadcn (delade presentationsprimitiver), verification, deployments-cicd samt upstream React/deployment/verification. Sites lästes för webbflöde och managed browser preview; befintligt GitHub/Vercel-projekt bevaras, ingen separat Site eller kodbas skapas. Supabase ändras inte. Inga nya skills installerade.

## Implementerat

- Webb flyttad från apps/web till src/app i ett rotprojekt. En package.json och en ny faktiskt genererad pnpm-låsfil. Turbo/workspaces borttagna från aktiva bygget; Next.js egen bundler är en separat sak.
- Historiskt source-parity-verktyg och manifest bevarade som historik, men aktivt CI verifierar nu rotprojektets struktur och faktiska produktbeteende. Gamla byteidentiska shell-kravet ersatt uttryckligen eftersom användaren beställt ny webb.
- Startsida, företag, bilförare, kontakt, lokal appförhandsvisning, 404, metadata, sitemap och robots.
- Gemensam varm ljus bakgrund, mörkgrön typografi, avgränsad limefärg, egen SVG-energiillustration och responsiv layout. Inga stockbilder, påhittade kundbevis eller fabricerade driftmått.
- Förhandsvisningens laddplan är en separat illustrativ funktion och återanvänds inte som fysisk styrmotor eller faktureringsmotor.
- Kontakt förbereder mejl i användarens mejlprogram; inget serverutskick eller falskt skickat-kvitto. Inga konton, betalningar eller enhetskommandon aktiverade.
- Integritetsinformation, cookies/lokal lagring och villkor för webbplats/förhandsvisning. Inga analys-/marknadsföringsskript eller valfria spårningscookies införda. Policylänkar finns i sidfot och kontaktflöde.

## Faktisk verifiering

- Rootinstallationen behövde regenererad låsfil och ren lokal installation efter flytten: gammalt workspace-importer gav trasig Next-symlänk. Orsaken korrigerad, inte dold.
- ESLint, TypeScript och Next-produktionsbuild passerade efter rotflytten. 77 befintliga/uppdaterade kvalitet-/webbtester och 5 konfigurations-/planeringstester passerade.
- HTTP-smoke på riktig produktionsserver: startsida, JS/CSS, 404, canary och samtliga aktuella routes. Exakt slutlig körning dokumenteras i checkpoint.
- Browser: startsida granskad visuellt. Appens produktionsbuild verifierad för direktläge, återgång, batteri/avresa och tangentbordsreglage. 0→100 % med 100 kWh och avresa 01:00 visar 30,7 kWh som inte ryms.
- Mobil layout granskad i riktiga 390 px iframe-viewports för startsida och app. Det var layout-QA, inte fysisk mobilplattformstestning. Tillfällig QA-fil borttagen före commit/publicering.
- Utvecklingspreview reagerade inte på klienthändelser; bytte preview till verklig produktionsbuild. Där fungerar interaktionerna. Range-fill i automatiseringsverktyget triggade inte React-förändring; riktiga tangentbordshändelser verifierade.
- Index/impact körda: HIGH med behov av app-, CI-, beroende- och browserverifiering. Inga DB-förändringar.
- Peer-varning kvar: befintlig ESLint 10 ligger utanför tre pluginers annonserade peerintervall. Den befintliga kompatibilitetsbryggan bevaras; faktisk lint passerar. Versionsbyte är inte genomfört som en dold sidoändring.

## Juridik och återstående produktdelar

Underlag: https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/de-registrerades-rattigheter/ och https://pts.se/internet-och-telefoni/kakor-cookies/ (kontrollerade 2026-11-01).

Bolagets organisationsnummer och registrerade kontaktadress har inte lämnats. Inga uppgifter gissas. Verifiera registrerat juridiskt namn, orgnummer, adress, e-postleverantör, driftavtal/överföringsskydd och verkliga loggretentioner före en fullständig kommersiell lansering. Policytexterna är anpassade till informationswebb och kontakt, inte färdiga abonnemangsvillkor. Ingen generell juridisk fullständighet påstås.

Nästa produktleverans är verifierad kundidentitet och koppling mot befintliga kanoniska Flexexa-API:er. Foundation-grenens backend/migrationer ska inventeras och föras över kontrollerat; de har inte kastats eller ersatts med mockade kunddata.

Vercelprojektet är befintligt flexexa, team_e3htkJPyBNSw3Ix1KQLlf180. Endast flexexa.vercel.app är konfigurerad domän i läst lista; flexexa.com är inte verifierat ansluten. Projektet har SSO-skydd på förhandsvisningsdomäner. Detta ändras inte tyst.

## Vercel-build och korrigerad installationspolicy

Första previewn nekades av den gamla projektinställningen rootDirectory=apps/web. Den återställdes till projektroten för framtida byggen. Andra previewn nekades av pnpm ERR_PNPM_IGNORED_BUILDS för unrs-resolver. Ingen beroendekod godkändes för körning: installation i Vercel/CI gör nu explicit --ignore-scripts, samma policy som fungerande lokal installation. Konfiguration och regressionstest uppdaterades tillsammans. Produktionsalias och skydd ändrades inte.

## Produktionspresentation — användarbeslut

Användaren begärde att den publika hemsidan inte ska säga ”under utveckling” eller ge ett ofärdigt intryck. Startsida, företagssida, laddsida, kontakt, sidfot och metadata har fått direkt produkt-/kontaktorienterat språk. Utvecklings- och pilotmarkörer är borttagna. Villkor och integritetsinformation beskriver fortsatt verklig omfattning utan utvecklingsstatus som marknadsbudskap. Ingen falsk köp-, nätverks- eller styrfunktion har aktiverats. Ladddemon behåller tydlig märkning av exempeldata. Lint, typkontroll, 82 tester, produktionsbuild och produktions-HTTP-smoke passerade för ändringen.

## Cookiebanner och inställningar

På användarens begäran tillagd informationsbanner med ”Endast nödvändiga” och inställningsdialog. Ingen valfri spårning aktiveras. Native dialog ger tangentbordsfokus och Escape-stängning. Val sparas i versionerad localStorage i 180 dagar; felaktigt/utgånget värde visar bannern igen, blockerad lagring hanteras med sessionens stängning och förklarande status. Inställningarna nås via sidfoten. Cookiesidan beskriver faktisk lagring. Lint, typkontroll, produktionsbuild och HTTP-smoke passerade. Browserbeteende verifieras på driftsatt version eftersom managed preview inte blev tillgänglig vid omstart.
