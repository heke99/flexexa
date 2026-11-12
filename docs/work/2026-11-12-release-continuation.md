# Erbjudandesida och privatköp — 2026-11-12

## Senaste inloggningsdiagnos

De två registreringsförsöken loggades som `user_repeated_signup`; inga nya identiteter skapades och neutralt UI-svar var inte bevis för skickade bekräftelsemejl. Portalens sandbox har nu ett mejllänksflöde för befintliga konton, med PKCE-verifiering och fortsatt minneslagring av sessioner. 96 webbtester och 84 webbläsartester samt bygge passerar. En riktig inloggningsbegäran skapade ett nytt mejl, men leverans är ännu inte bekräftad och länken använder Supabases staging-standardadress i stället för sandboxens callback. Ägaren har fått den exakta URL-konfiguration som behöver kontrolleras. Detta blockerar fortfarande autentiserat köp; produktion och marknadsformulär är oförändrade. Full evidens: portalrepots `docs/verification/EMAIL_LOGIN_2026_11_12.md`.

## Senaste sandboxdrift

Portalens nya slutavräkningskod är implementerad och källrevision 43445cf är driftsatt endast i sandbox, tillsammans med matchande webbversion och migration 024. Slutavräkningen har beständig mottagar-/betalningsbindning, balanserad reserverad journal, återkörningsskydd och verifierad återbetalning före kreditsaldots nollställning. 305 backendtester passerar lokalt. Ångerflödets felaktiga krav på ett livemode-fält i Stripes Refund-objekt är också rättat.

Sandboxens API, worker och ingress-probe har verifierade kontrollsummor och godkända beredskaps-/TLS-/rollprober. Webhooksignaturprov är godkänt men verifierar inte verklig Stripe-leverans. Testvillkorens PDF har öppnats i den riktiga webbläsaren från samma sandboxadress; testkatalog och matchande testpris är förberedda med köp spärrade. Tre äldre avtalssnapshots är oförändrade.

Vercelåtkomsten fungerar nu. Nästa konkreta användarsteg är e-postbekräftelse av den nya testidentitet som ägaren angett. Inget verkligt autentiserat testköp eller slututbetalning påstås genomfört. GitHub-betalningsspärren och verifierade laddintegrationer kvarstår. Produktion, ansökningsformulär, räknare och befintliga kunddata är bevarade. Full evidens finns i portalrepots `docs/verification/CLOSING_CREDIT_2026_11_12.md`.

## Senaste genomförande

Portal-PR 14 har nu kod för faktisk elhandelsprisbaserad hemersättning med kvart/månad/portfölj, kostnadsexkluderingar, väntande ofullständigt underlag, gemensam oföränderlig månadsbild för kredit och energitillägg samt momsskydd före fakturaskrivning. Full lokal backendkörning: 294 passerade, noll fel. Ingen ny driftsättning eller produktionsaktivering påstås.

Ett separat riktigt Stripe-API-prov i Flexexas isolerade testkonto visade 480 kr överförd kredit, 100 kr förbrukad av nästa faktura och 380 kr kvar. Inga pengar drogs. Detta ersätter inte webbköpet eller verifierar slututbetalning. Testkunden är anonymiserad men väntar på radering eftersom connectorn saknar raderingsoperation; detaljer i portalrepots `docs/verification/HOME_RETAIL_2026_11_12.md`. Portalens befintliga kunddata, ansökan och räknare är bevarade.

## Senare komplettering: ägarens produktbeslut mottagna

Ägaren har nu fastställt stations-/integrationskraven och hela hemersättningsmodellen; tidigare fråga om dessa affärsbeslut nedan är därmed besvarad. Se `docs/DECISIONS.md` och portalrepots nya v4-villkor/policy/PDF. Inga godkända stationer eller hemmaladdarintegrationer finns ännu. Listorna förblir tomma och köp spärrade.

Avräkningskoden är ännu inte verifierad för de nya kraven på faktiska kvartsspecifika elhandelspriser, överfört kreditsaldo och slututbetalning. Policyn publicerar därför inget löfte om färdig funktion. Energitilläggets fastställda beräkning är bevarad. Vercelåtkomst och GitHub-betalningsspärren återstår enligt tidigare checkpoint.

Marknadsgren `codex/paket1-2-release`, implementation `867325a`, PR 73. Grenen har hämtats och arbetskatalogen återställts. Ingen ändring av ansökan, räknare eller befintliga kunddata.

Färska HTTPS-anrop når www.flexexa.com/elbilsabonnemang (200), ladda.flexexa.com (200), sandbox-API:s /health/ready (200), Supabase och Stripe. Den tidigare CONNECT-spärren är löst i den nya miljön. Dessa anrop verifierar åtkomst, inte köpflödet eller kommersiell produktionsberedskap.

Sandboxwebben är READY på backendmatchande källrevision `15f0ab1`. Delad Chrome når Vercels inloggning; automatisk granskning avvisade verktyget som skapar en tillfällig delningslänk. Specifikt godkännande eller ägarinloggning behövs. Skyddet är oförändrat.

GitHub-run 43007980708 kördes om 12 november och stoppades åter utan teststeg. Den nya annotationen bekräftar betalnings-/förbrukningsgränsen. Ägaren måste åtgärda Billing & plans. Marknads-PR:ns Vercel-kontroll passerar; det är inte bevis för godkänt backend-CI.

Portal-PR 14 innehåller nu förberett isolerat v3-testavtal, PDF och köpstängd testpolicy. Databasens befintliga testprodukt ligger kvar på v2 med NULL contract_policy och tre befintliga order; inga data har ändrats.

Produktbilagan kan inte godkännas från befintlig FAQ: verifierad partner-/stationslista, kompatibel utrustning samt exakt hemersättningsmodell saknas fortfarande i masterplanens öppna beslut. Ägaren har tillfrågats om befintligt godkänt underlag. Den redan beslutade energitilläggsregeln ändras inte och antas inte ange hemersättningssats.

Full evidens och nästa exakta steg: `heke99/charging-subscription`, `docs/verification/CONTINUATION_2026_11_12.md`. Verkligt autentiserat Stripe-testköp, ånger/uppsägning med leverantörsreadback och produktionspromovering återstår. Inget paket markeras färdigt.

Skill-routing: cloud runtime/desktop, Supabase, Vercel deployment/access samt lokala verification/investigation-overlays aktiverade. UI-, monorepo-, AI- och feature-flag-skills ej tillämpliga på denna evidensändring. Kontroll: git diff --check. Ingen ny applikationstestning påstås.
