# Filipstad – verifiering 2026-09-03

Status: **pilot**. Lokala importer är implementerade och kontrollerade, men full sajtverifiering är inte grön. Ingen produktionspromovering eller merge till main ingår i denna leverans.

## Utgångsläge

Arbetsordern `CODEX-FILIPSTAD-PRODUKTIONSKLAR.md` lästes före implementation. Start-HEAD var `1834a84119c5bd4e89e1f1ac1470ede8a90dd27c`. Arbetet synkroniserades sedan med `3026b4c1` och bevarar dess serviceutbyggnad i Forshaga samt nya transport- och väderdata.

Redan klart: research och servicebreddning (bland annat `0495b5c4`), fem lunchkällor, Bio Monitors baspost, åtta vårdposter, åtta idrottsföreningar och 14 fritidsposter. Generisk jobbfiltrering och bostadsimport fungerade. Ingen tidigare implementation av RSS, Turid eller Bio Monitor-program hittades i aktuell kod/historik.

Kvar var lunch utanför centralorten, officiell RSS, direkt Turid-import, specifik föreningslänk, geografisk anläggningstäckning, automatiskt bioprogram samt regressioner och slutverifiering.

## Genomfört och faktisk output

- Lunch: åtta källor, varav två i Lesjöfors och en i Nykroppa. Lesjöfors Grill och Pizzeria, Café Stationshuset och Prästbäcksrasta tillagda som `source-only`. Visit Värmland bekräftar restaurang/café vid Prästbäcken; modulens referensläge tillåter posten utan dagsmeny. Inga rätter eller lunchöppettider har hittats på.
- Nyheter: Filipstads dokumenterade officiella RSS via befintlig nyhetsimport. Tio hämtade artiklar; sju återstår efter ordinarie 21-dagarsfilter. Verkligt publiceringsdatum krävs och andra värdar avvisas. Ortalias är bevarade.
- Evenemang: kommunens dokumenterade Turid v8-flöde, två sidor och 12 källposter gav 26 aktuella/framtida tillfällen. Direkt JSON med nödvändiga Accept/Referer-huvuden, originaladresser, plats, källkategori och tid. Passerade datum filtreras; olika tider samma dag bevaras. Ingen HTML-skrapning eller inblandning av aktivitetsflödet för Filipstad.
- Bio Monitor: fem filmer, nio framtida visningar. Den gamla HTTP-adressen omdirigerar till `https://filipstad.biosverige.se/`; gamla HTTPS-adressen gav TLS-fel. Biografens offentliga `api/eventschedules` används med samma datum-/antalparametrar som programsidan. Svensk lokal tid, dubblett- och passeratfilter, filmens direktlänk, tydlig felstatus, skydd mot trunkerade svar och bevarade features. Dals-Ed/Bengtsfors bevaras av Filipstad-uppdateringen. Ordinarie bioworkflow används.
- Jobb: livekällan gav 13 annonser; befintlig importer behåller 11 med verifierad lokal arbetsort. Två med arbetsort Karlstad/Falun filtreras bort. Ingen ny jobblösning eller config-ID infördes.
- Bostäder: oförändrad importer gav tio aktuella objekt med adress, rum, yta, hyra och tillträde. Två ligger i Lesjöfors. Inga objekt i Nykroppa/Persberg fanns vid kontrollen; importern filtrerar inte bort dessa orter.
- Förening/fritid: officiell föreningsverksamhetssida ersätter kommunstartsidan. Manual parser och befintliga åtta föreningar/14 fritidsposter bevaras. Sju verifierade hallar införda i `arenas.json`, inklusive Lesjöfors, Nordmark och Nykroppa, separat från föreningslistan. Kalhyttan fanns redan i fritidsdatan.
- Service/vård: 14 sammanlagda serviceposter över de befintliga datakällorna, med el/VVS/bygg/bil-däck, och åtta vårdposter bevarade. Auditens serviceantal är sju eftersom dess summering inte räknar alla frontendens källor.
- Pilotspärr: statusdokumentet sade pilot men config saknade `launchMode`. Config har nu uttryckligen `pilot`, i enlighet med arbetsordern.

## Tester och workflows

76 relevanta Python-tester passerar: Filipstad, bio, Dals-Ed, nyheter, evenemang, lunch, bostäder, kommunintegration, service, vård, Missing People, transport och väder. Äldre testantaganden uppdaterade: lokala servicesupplement följer centralt kommunregister; tre redan använda vårdkategorier godtas utan att vårddata ändras.

Portalstruktur, fritidsdata/UI, sportportal, säsongsmotor och sportavgränsning passerar. Semantisk jämförelse av ändrade gemensamma JSON-filer visar att alla andra kommuners innehåll är bevarat. Gemensamma frontendfiler är orörda.

Filipstads readiness: inga automatiska datagap. Väder var live och transport hade aktuell avgång. Befintliga nyhets-, event- och bioworkflows har fått Filipstad-regressionerna; sajtens PR-workflow kör den relevanta Python-sviten. Inget parallellt uppdateringsschema har införts.

Kvarstående slutgrindar:

1. `scripts/validate_launch.py` stoppar på `Hammarö: lunchställen saknas`. Detta finns redan i baslinjen och är utanför Filipstad-arbetet.
2. `scripts/test_ad_inventory.js` stoppar på strängkontrollen `length: 8` i den befintliga dynamiska sportlayouten. Både test och frontendfil är identiska med start-HEAD. Sportlayout/annonser har inte ändrats för att kringgå detta.
3. Visuell mobil/desktop-slutkontroll återstår: lokal HTTP-förhandsvisning startade, men in-app-webbläsaren fick timeout vid anslutning och hade inga anslutna flikar.
4. Pages för den befintliga main-versionen var grön. Denna ändring har inte Pages-publicerats; PR/CI och eventuell senare publicering måste verifieras separat.

Slutsats: **Filipstad ska inte produktionsklassas ännu**. Importarbetet kan granskas och fortsätta från denna punkt; gör inte om research eller implementation.
