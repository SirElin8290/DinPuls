# Forshaga – slutverifiering 2026-09-03

Arbetsorder: `docs/CODEX-FORSHAGA-SLUTVERIFIERING.md`.
Start-HEAD: `282d8fcf5b19cdb87f38d4bfc5c1bae11e7c4afd`.
Senast kontrollerad data-HEAD: `dff6324d70796129d95e3a4db6b17e608c612f01`.

## Slutsats
Forshagas lokala funktioner har verifierats och de identifierade lokala felen är rättade. **Forshaga är ännu inte formellt godkänd och stängd enligt arbetsorderns krav på gröna kontroller**: den gemensamma kontrollen `python scripts/validate_launch.py` stoppar på `Hammarö: lunchställen saknas`. Detta är ett befintligt fel utanför Forshaga. Kontrollens krav har inte sänkts och Hammarös data har inte fyllts med påhittat innehåll.

## Redan fungerande vid start
Automatisk Forshagabostäder-import, FRI-import, bioprogram från lokala Visit Värmland-evenemang, jobb, vård, service, lunchens källänkar, evenemang och lokal frontend fanns redan. Arbetet har fortsatt från aktuell main. Senare gemensamma ändringar i layout, dark mode, hösttema, sport och annonser har behållits.

## Verifierade och rättade fel
- Hållplatsen 740053193 med namnet Forshaga avsåg fel ort och gav buss 344 mot Vetlanda/Målilla/Järnforsen. Central konfiguration och söknamn använder nu **Forshaga centrum, 740000375**. Automatisk output och livevyn visar Värmlandstrafik, linjer 601/602 mot Karlstad och Deje.
- Deje IK och Forshaga IF dubblerades med fullständiga FRI-namn. Supplementet använder nu registernamnen; output har **20 unika idrottsföreningar**. Regressionstest skyddar nästa import.
- Ett tomt RSS-svar räknades som lyckat och raderade tidigare färska artiklar. Tomma svar redovisas nu som källfel och behåller tidigare artiklar inom befintlig åldersgräns. Test verifierar både bevarande och utgång. Aktuella Forshaga-artiklar hämtades på nytt; efterföljande automatiska körningar fungerar.
- Två serviceföretag dubblerades under olika namn. Gemensamma namn gör att befintlig deduplicering fungerar. DäckMäster länkar till sin verkstadssida.

En sportfil trunkerades under överföringen av första rättningen. Den återställdes i separat commit, hämtades tillbaka och kontrollerades. Alla JSON-filer är giltiga; jämförelse mot ursprunget visar endast avsedda Forshaga-ändringar i sportinnehållet.

## Berörda filer och commits
- `data/municipalities.json`, `data/association-launch-supplement.json`, `data/sports.json`, `scripts/test_forshaga_fri.py`, `scripts/test_municipality_integrations.py`: `061a5d7e906d84dd38bb132fd2d1b09c784ab187`.
- Återställd fullständig sportfil: `e1f2cc190898e0534f079e9d9c4d8af832f58ab3`.
- `scripts/update_news.py`, `scripts/test_update_news.py`, `data/news.json`: `91ed5acdda57207ce2712dc044bb83140345374c`.
- `data/service.json`: `e8854ded06a1a9aef3565d2243360be0c8a20a16`.
- Automatiska workflows har därefter uppdaterat sina respektive datafiler.

## Live-QA
Riktig Edge-webbläsare användes på dinpuls.se. Desktop 1440×900 samt mobil 390×844 kontrollerades. Startsida och undersidor för bostäder, jobb, evenemang, lunch, bio, vård, service, sport, fritid, nyheter, trafik och myndigheter öppnades med Forshaga. Kommunval, lokalt innehåll, länkmål och renderad output verifierades. Fotbolls- och ishockeyfilter fungerar; sporthubben har fyra annonsplatser och respektive sportvy tre.

Mobilens mörka läge aktiverades via gränssnittet och följde med till undersidorna. Ingen kontrollerad sida hade horisontell överströmning. Därefter återställdes ljust läge. Desktop granskades visuellt tidigare under arbetet; den avslutande mobilsvepningen använde DOM-, innehålls- och layoutmätningar. Inga nya illustrationsbilder skapades.

## Aktuell lokal output
- Bostäder: **10**, direktkontrollerade mot Forshagabostäder; riktiga adresser, rum, yta, hyra och objektlänkar.
- Jobb: **12**, Forshaga/Deje.
- Evenemang: **80 publicerade**, med direktlänkar till Visit Värmland.
- Bio: **6 filmer och 6 framtida visningar**, 9 september–7 oktober.
- Lunch: **8 ställen**, **0 verifierade dagsmenyer**. Reservlänkar och begränsningen visas öppet.
- FRI: **40 registerposter**, varav **20 idrottsföreningar**. Samlad fritidsoutput: **34 poster** inklusive tidigare verifierade aktiviteter.
- Vård: **11 verksamheter**. Service: **10 unika företag i livevyn**; readiness räknar en mindre delmängd.
- Nyheter: **25 lokala artiklar** vid kvällskontrollen.
- Vägtrafik: **10 meddelanden**. Bussar från rätt Forshaga centrum.
- Missing People: utgången kontroll dolde personuppgifter korrekt och visade officiell reservlänk. Workflow kördes om med lyckat resultat. Schemaläggningens framtida punktlighet är inte bevisad av en manuell omkörning.

## Tester och workflows
- **64 relevanta Python-tester godkända**, inklusive Forshaga-bostäder, FRI, bio, transport, kommunintegration, evenemang, lunch och nyheter.
- Åtta lokala JavaScript-kontroller godkända: portalstruktur, fritidsdata/UI, sportportal, annonsinventering, inloggningsåterkoppling, kommersiell readiness och sportavgränsning.
- `audit_municipality_readiness.py`: **godkänd för aktuell data**.
- `validate_launch.py`: **underkänd**, Hammarö saknar lunchställen.
- [Bostäder](https://github.com/SirElin8290/DinPuls/actions/runs/33758916960): **godkänd efter omkörning**, inklusive explicit Forshaga-verifiering. Första försöket stoppades av Karlstads externa källa.
- [Föreningar](https://github.com/SirElin8290/DinPuls/actions/runs/33758917031): **godkänd**.
- [Bio](https://github.com/SirElin8290/DinPuls/actions/runs/33778721575): **godkänd**.
- [Missing People](https://github.com/SirElin8290/DinPuls/actions/runs/33782741530): **godkänd efter omkörning**.
- [Pages](https://github.com/SirElin8290/DinPuls/actions/runs/33793555107): **godkänd** för kvällens kontrollerade publicering; lokala rättningar verifierade på sajten.
- Senaste tidigare CI-fel avsåg tomma Färgelanda-nyheter; aktuell readiness passerar. Rapportcommitens nya CI/Pages-resultat redovisas i slutmeddelandet.

Forshagas befintliga kommunstatus har inte ändrats under denna slutverifiering.
