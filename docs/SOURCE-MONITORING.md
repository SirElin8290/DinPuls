# Automatisk nattkontroll av DinPuls källor

## Drift

`.github/workflows/nightly-source-monitor.yml` körs varje natt 01.00 i
`Europe/Stockholm`, även när sommar-/vintertid ändras. GitHub Actions kan
fördröja starten; det är inte ett minutprecist realtidssystem.

Nattjobbet återanvänder befintliga, testade uppdateringar i följande ordning:
nyheter, evenemang, restauranglunch, skolmat och föreningsregister. Därefter
hämtas senaste main och källkontrollen körs. Ett misslyckat importjobb stoppar
inte övriga kontroller, men redovisas och gör nattkörningen misslyckad efter
att rapporten sparats. Ordinarie tätare uppdateringar fortsätter som tidigare.

Resultatet sparas i `data/source-monitor.json` och
`docs/SOURCE-MONITOR-LATEST.md`, i körningens sammanfattning och som bilaga.
Admin → Driftstatus visar senaste kontroll, problem och misslyckade importer.
Publicering till main följs av en explicit begäran om GitHub Pages-byggning.

## Kontroll och säker hantering

- Aktiva publicerade föreningar, kommun-/servicekällor, menyer, nyheter och
  aktuella evenemang ingår. Ej publicerade föreningskandidater ingår inte.
- Varje URL kontrolleras högst två gånger per körning. Högst åtta samtidiga
  hämtningar och två per värddator begränsar belastningen.
- 404/410 klassas bekräftat trasigt först efter två misslyckade nattkörningar.
  Timeout, 403, inloggning eller skyddssida klassas ej verifierbar, aldrig
  automatiskt nedlagd förening eller saknad verksamhet.
- Om en värddator upprepade gånger nekar åtkomst (403/429/451) avbryts fler
  hämtningar där den natten. Övriga URL:er på värddatorn markeras uttryckligen
  som ej verifierade, inte som trasiga eller individuellt kontrollerade.
  En ny körning inom sex timmar kan återanvända nyligen lyckade kontroller;
  den ordinarie nattkörningen kontrollerar dem på nytt.
- Omdirigeringar följs. URL:er eller verksamhetsuppgifter skrivs inte om till
  osäkra kandidater. Befintliga importer använder originalkällornas parsers,
  aktuella datum/veckor och publiceringsgrindar; inga rätter eller fakta gissas.
- Synlig text på statiska källsidor jämförs med första lyckade kontrollen.
  Ändringar blir granskningsärenden och betyder inte automatiskt felaktiga
  fakta. Dynamiska nyhets-/evenemangs-/menysidor får förändras normalt.
- Menyvecka, importernas ålder, evenemangsdatum/källlänk och aktuella
  skolmatsrader kontrolleras. Hammarö/Hagfors skolmat och Storfors lunch
  fortsätter enligt dokumenterade rapportundantag.
- Nattjobbet ändrar inte på egen hand föreningsnamn, adresser, telefonnummer
  eller verksamhetsbeskrivningar utifrån en allmän HTML-förändring. Sådana
  ändringar kräver verifierad information innan de publiceras.
- Hämtning och omdirigeringar till privata/nätinterna adresser blockeras.
  Rapporten innehåller endast offentliga källor; inga autentiseringsuppgifter.

## Bevakning av bevakningen

Den befintliga timvisa driftkontrollen läser även nattkontrollens tidsstämpel.
Saknad/ofullständig rapport eller mer än 28 timmar gammal kontroll
markeras kritisk. Från 05.00 svensk tid krävs dessutom en slutförd kontroll
från dagens datum, så att en utebliven nattkontroll syns på morgonen. Rapportvyn visar själv samma varning även om den timvisa
kontrollen slutat uppdateras. En misslyckad import syns separat från källfel.

GitHub markerar misslyckade körningar. Den befintliga valfria
`HEALTH_WEBHOOK_URL` används även för nattkontrollproblem om den redan är
konfigurerad. Ingen ny mejladress, webhook eller extern mottagare skapas.
E-postavisering kan därför inte utlovas utan en konfigurerad mottagningskanal.

## Verifiering och manuell återställning

Kör tester med `PYTHONPATH=scripts python -m unittest scripts/test_public_sources.py scripts/test_system_health.py`
och `node scripts/test_source_monitor_admin.js`.

En kontroll kan startas via GitHub Actions → DinPuls nattkontroll och
källuppdatering → Run workflow. Normal daglig drift kräver inte detta.

Första körningen skapar jämförelsebasen. En nåbar källa är inte ett bevis på
att varje uppgift är korrekt eller att den kommer vara nåbar nästa natt.
Granskningsärenden för statiska sidor kvarstår mot sin jämförelsebas tills en
verifierad rättning/granskning uppdaterar motsvarande bas i statusfilen.

GitHub kan automatiskt inaktivera schemalagda körningar i publika repos som
inte har haft aktivitet på 60 dagar. DinPuls ordinarie datakörningar skapar
fortlöpande aktivitet; tidsstämpelkontrollen upptäcker utebliven nattkontroll.

Schemaläggningens officiella dokumentation:
https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule
