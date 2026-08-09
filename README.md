# DinPuls v0.23.3

DinPuls är en lokal webbportal för Åmål, Säffle, Bengtsfors, Mellerud, Årjäng, Arvika och Grums. Den publicerade webbplatsen finns på [dinpuls.se](https://dinpuls.se/).

## Utveckling och drift

- [Teknisk handbok](docs/TEKNISK-HANDBOK.md) – arkitektur, kodansvar, säkerhet, testning och versionshantering.
- [Publicering och återställning](docs/PUBLICERING.md) – checklista för säker publicering, produktionskontroll och rollback.

Version 0.23.3 avslutar webbplatsens första stabiliseringsomgång: säkerhetsfunktioner och gemensamma hjälpfunktioner är centraliserade, CSS använder en gemensam palett och testerna körs automatiskt före lansering.

## Versionshistorik

# DinPuls v0.21.9 – integritet, kakor och lokal lagring

## Integritetsvänlig grund

- Fullständig och lättillgänglig information om integritet, lokal lagring, externa anrop och användarens rättigheter.
- Ingen samtyckesruta visas så länge DinPuls saknar valfria analys- och marknadsföringskakor.
- Besökaren kan rensa samtliga lokala DinPuls-inställningar med en knapp.
- Väder och namnsdag sparas inte längre permanent i webbläsaren.
- Google Fonts har tagits bort och Lucide-ikoner laddas lokalt för att minska automatiska tredjepartsanrop.
- Google-sökresultat öppnas i en ny flik så att DinPuls ligger kvar som startsida.
- Åmålsbilden är konverterad till WebP och minskad med drygt 80 procent.
- Ikonpaketet innehåller bara de ikoner DinPuls använder och har minskats med cirka 90 procent.
- Datafiler återvalideras utan unika tidsstämplar, vilket möjliggör webbläsarcache och mindre datatrafik.
- Gemensam annonslogik ersätter sex separata kopior och alla aktiva resurser använder samma versionsnummer.
- Versionen är byggd för granskning och ännu inte publicerad på huvudgrenen.

# Tidigare version: DinPuls v0.21.8 – Google-sökning på startsidan

## Google-sökning på startsidan

- En ny tydligt märkt Google-sökrad ligger direkt under sidhuvudet.
- Sökfrasen skickas med en vanlig GET-förfrågan till `https://www.google.se/search`.
- DinPuls egen modulsökning finns kvar i sidhuvudet och har fått en tydligare platshållartext.
- Sökningen kräver ingen egen datainsamling eller extern kod på DinPuls.
- Versionen är publicerad på huvudgrenen och ingår på DinPuls startsida.

# Tidigare version: DinPuls v0.21.7 – Myndigheter & samhällsservice

## Myndigheter & samhällsservice

- Ny kommunanpassad startsidemodul och undersida `myndigheter.html`.
- Uppgiftsbaserad sökning på ord som VAB, socialen, pension, flytt, skuld och körkort.
- Samlar central statlig service och sju kommuners socialtjänst, ekonomiska bistånd, budget- och skuldrådgivning, överförmyndare, bygglov och kontaktcenter.
- Skiljer tydligt på kommunal verksamhet, statlig myndighet och annan statlig samhällstjänst.
- Inga personuppgifter, ansökningar eller inloggningar hanteras av DinPuls; externa länkar går till officiella aktörer.
- Fyra tydligt märkta annonsplatser ligger avskilda från akuta kontakter och myndighetskort.
- Versionen är publicerad på huvudgrenen och ingår i DinPuls för samtliga sju startkommuner.

# Tidigare version: DinPuls v0.21.4

## Sprint 6 – lanseringskontroll

- Den synliga sökrutan leder nu till rätt aktiv modul i stället för att visa
  ett meddelande om en framtida funktion.
- Den inaktiva favoritknappen är borttagen.
- Vald kommun följer automatiskt med till jobb, bostäder, lunch, evenemang,
  sport, matkasse och trafik.
- Startsidelogotypen och Hem-länken leder alltid tillbaka till startsidan.
- Alla aktiva sidor använder samma cacheversion.
- Ett permanent lanseringstest kontrollerar sidor, filer, kommunmotor,
  kollektivtrafik, jobb, bostäder, evenemang, lunch, sport, felaktiga ortsnamn
  och annonsplatser.
- GitHub Actions kör lanseringstestet vid varje uppdatering av `main`.

## Sprint 5 – dagens lunch

- Lunchrullen på startsidan visar restaurangnamn och verifierade rätter för den
  valda kommunen och den aktuella dagen.
- På helger visas restaurangutbudet utan att felaktigt påstå att en vardagslunch
  finns.
- Lunchsidan har tydlig status för verifierad, äldre, direktlänkad eller
  tillfälligt onåbar meny.
- Restauranger med verifierad meny för vald dag sorteras först.
- Direktlänkar från lunchrullen markerar rätt restaurang på lunchsidan.
- Desktopvyn använder två balanserade kolumner och mobilvyn ett tydligt
  enkolumnsläge.
- Menyinsamlingen filtrerar bort telefonnummer, navigationsord och annan text
  som inte är maträtter.
- Fyra lokala annonsplatser ligger kvar på lunchsidan.

## Sprint 4 – lokala evenemang

- Evenemangsinsamlingen kan nu läsa den publika besökskalender som används av
  Västsverige-sidorna, utöver befintlig JSON-LD.
- Återkommande evenemang delas upp i riktiga datum och tider i stället för att
  visas som en odaterad kalenderlänk.
- Ortlistan kontrolleras mot vald kommun så att evenemang från närliggande
  kommuner inte blandas in.
- Källstatus skiljer mellan automatiskt importerade evenemang och kontrollerade
  kalendrar som besökaren behöver öppna för fullständigt program.
- Svenska kyrkan, kommunernas kalendrar och de regionala besökskalendrarna
  finns kvar som officiella källor i samtliga sju kommuner.

## Sprint 3 – lokal sport som snabb hubb

- Startsidan och sportsidan använder nu samma sammanslagna sportflöde. Antalet
  matcher på startsidan blir därför inte längre felaktigt noll när ett
  automatiskt sportflöde innehåller matcher.
- Startsidan länkar till den valda sporten i stället för till borttagna
  föreningsprofiler.
- Sporthubben visar spelade matcher, kommande matcher, resultat, preliminära
  tabeller samt arenor och sporthallar.
- Officiella länkar kopplas endast till rätt sport. En fotbollssektion kan
  exempelvis inte längre råka länka till en ishockey- eller innebandykälla.
- Källstatus skiljer mellan automatiskt inlästa matcher och officiella
  referenslänkar, vilket gör säsongsuppehåll tydligare.
- Exakt åtta lokala annonsplatser behålls på sportsidan.

## Sprint 2 – trovärdig lokal information

- Kommunala informationssidor utan ett verifierat färskt publiceringsdatum
  visas inte längre som aktiva driftmeddelanden.
- Generella sidor om VMA, fjärrvärme och SMS-tjänster filtreras bort från
  Dagens viktigaste.
- Jobb kontrolleras mot den faktiska arbetsplatsorten och annonser från andra
  kommuner tas bort ur det lokala resultatet.
- Notiscentret prioriterar viktiga händelser, visar färre poster och tar bort
  generella länkar som inte är nya händelser.
- Föråldrade kommunala meddelanden återanvänds inte när en källa tillfälligt
  ligger nere.

## Stabilisering av hela webbplatsen

- Viktiga meddelanden filtreras geografiskt. Ett lokalt VMA från exempelvis
  Borlänge visas inte längre i DinPuls startkommuner.
- Notiscentret använder samma kommunfilter och beskriver pågående händelser
  med slutdatum i stället för ett missvisande gammalt startdatum.
- Jobbsidan skiljer på totalantalet hos källan och de annonser som faktiskt
  har hämtats och kan visas.
- Kommuner utan exakt lokal nyhetsträff får ett tydligt märkt regionalt urval
  i stället för en tom eller missvisande modul.
- Evenemangskällor kontrolleras automatiskt flera gånger per dag och sidan
  visar när kontrollen gjordes samt vilka källor som svarade.
- Sport- och matkassesidorna visar öppet när det saknas importerade matcher
  eller publicerade butikpriser. DinPuls fyller aldrig luckorna med demodata.
- Äldre avancerade sportvyer för spelare, matchdetaljer, favoriter och
  föreningsprofiler är borttagna.
- Alla aktiva sidor använder samma versions- och cachemarkering.

## Förenklad lokal sporthub

- Sportsidan fokuserar på spelade matcher, kommande matcher, resultat,
  aktuella tabeller samt arenor och sporthallar.
- Alla lokala sporter visas även under säsongsuppehåll eller när nästa
  spelschema ännu inte är publicerat.
- Spelarprofiler, laguppställningar och överflödiga matchdetaljer har tagits
  bort ur det aktiva besökarflödet.
- Tabellvyn visar lagets aktuella serie och leder direkt till ansvarig
  förening eller förbund, så att placering och poäng alltid är aktuella.
- Arenavyn visar endast praktiska uppgifter: namn, sport, adress, telefon när
  det finns, kartlänk och officiell information.
- Åtta lokala annonsplatser är strategiskt fördelade genom sporthubben.
- Matchvalideringen stoppar rubriktext och andra trasiga värden från att bli
  lag eller tabellrader.

## Lokal sport i v0.18.0

- En kompakt sportöversikt på startsidan följer den centrala kommunmotorn.
- Den nya stora sportsidan har kommun-, sport- och sökfilter samt separata vyer
  för kommande matcher, spelade matcher, tabeller och föreningar.
- 47 lokala föreningar är katalogiserade i de sju startkommunerna, inklusive
  mindre sporter som kanot, skytte, paintball, trav, bandy, båtsport, boxning,
  orientering och mountainbike.
- Match-, resultat- och tabellvyer leder till verifierade livekällor hos
  föreningar och specialförbund. DinPuls visar inte påhittade resultat.
- Sportsidan har åtta numrerade icke-premiumplatser för lokala annonsörer.

## Rättningar i v0.17.1

- Logotypens fasta text ”Åmåls kommun” är ersatt med en kommunneutral
  beskrivning.
- Klockan i sidhuvudet öppnar nu ett riktigt lokalt notiscenter.
- Notiscentret samlar nya jobb, bostäder, evenemang, lokala nyheter,
  trafikmeddelanden, viktiga händelser, kollektivtrafikvarningar och
  verifierade drivmedelspriser för vald kommun.
- Lästa notiser sparas lokalt per kommun och webbläsare utan konto.
- Komponenter och logotyp hämtas versionsstyrt för att undvika gammal cache.

## Nytt i v0.17.0

- Sektionen ”Personligt för dig” och länken ”Alla tjänster” är borttagna tills
  det finns fler funktioner som behöver samlas där.
- Automatiska årstidsteman för vår, sommar, höst och vinter.
- Sommarläge med ljusare himmel, solvärme, gröna accenter och neutrala
  vita/gula ängsblommor.
- Automatiska specialteman för nyår, alla hjärtans dag, påsk, May the 4th,
  mors dag, midsommar, kanelbullens dag, Halloween, fars dag, Lucia och jul.
- Rörliga svenska datum beräknas automatiskt för påsk, midsommar, mors dag och
  fars dag.

## Rättningar i v0.16.1

- Luncherna har fått en separat flygplatsremsa på startsidan.
- Remsan visar endast verifierade rätter för aktuell dag. När ingen vardagslunch
  finns visas ett tydligt helg- eller uppdateringsmeddelande.
- De tre premiumannonsgrupperna är utspridda högt, mitt på och längre ned på
  startsidan.
- Besökaren kan bläddra bakåt och framåt mellan annonserna med tydliga knappar.

## Nytt i v0.16.0

- Ny kommunstyrd lunchsida för Åmål, Säffle, Bengtsfors, Mellerud, Årjäng,
  Arvika och Grums.
- Dagens luncher visas i den rullande remsan på startsidan.
- Exakta rätter visas endast när restaurangens originalkälla anger den
  aktuella veckan.
- Restauranger utan maskinläsbar meny visas med direktlänk till sin aktuella
  meny.
- Fyra lokala annonsplatser på lunchsidan för 500 kr per månad.
- Lunchdata uppdateras automatiskt med GitHub Actions.

## Rättningar i v0.15.1

- Kollektivtrafik, vägtrafik och Dagens viktigaste uppdateras i ett samordnat
  GitHub-flöde var femtonde minut. Det förhindrar samtidiga commits och för
  många GitHub Pages-byggen.
- Buss- och tågtider laddas om automatiskt medan sidan är öppen och gamla
  uppdateringar märks tydligt.
- Dagens viktigaste visar ett informativt lugnt läge med kontrollerade
  originalkällor när inga prioriterade händelser finns.
- Evenemang publiceras tillsammans med resten av versionen i en enda komplett
  commit så att livesidan inte blandar v0.14- och v0.15-filer.

---

# Tidigare: DinPuls v0.15.0

## Nytt i v0.15.0 – Evenemang

- Ny klickbar evenemangsmodul på startsidan som följer vald kommun.
- Ny mellansida `evenemang.html` med kommun-, kategori-, tids- och sökfilter.
- Samlade originalkällor för alla sju kommuner: kommunernas kalendrar, regionala besökskalendrar och Svenska kyrkans lokala församlingar/pastorat.
- Tydlig källmärkning och direktlänkar; tider och ändringar kontrolleras alltid hos arrangören.
- Fyra separata lokala annonsplatser på evenemangssidan enligt 500 kr/mån-modellen.
- Version 0.15.0 publiceras komplett från projektets huvudgren.

## Nytt i v0.14.0 – Trafik

- Trafikkortet visar olyckor, vägarbeten, köer, hinder och väglag inom 35 km.
- En ny mellansida i `trafik.html` samlar alla vägmeddelanden och fyra kategoriannonser.
- Kommunval, filtrering och sökning följer DinPuls centrala kommunmotor.
- Riktig data hämtas från Trafikverkets öppna API med hemligheten `TRAFIKVERKET_API_KEY`.
- GitHub-flödet **Uppdatera vägtrafik** uppdaterar data var femtonde minut.
- Om nyckel eller händelser saknas visas ett ärligt tomläge utan demodata.

---

# Tidigare: DinPuls v0.13.0

## Nytt i v0.13.0 – Dagens viktigaste

- Panelen ovanpå huvudbilden visar aktuella händelser för vald kommun.
- Officiella uppgifter hämtas från Krisinformation.se och Polisen.
- Inställda avgångar och trafikmeddelanden hämtas från befintlig Trafiklab-data.
- GitHub-flödet **Uppdatera dagens viktigaste** körs var femtonde minut.
- Om inga händelser finns visas ett tydligt kontrollerat tomläge – aldrig påhittad data.
- Kommunbyte uppdaterar panelen genom samma centrala kommunmotor som övriga moduler.

---

# Tidigare: DinPuls v0.12.0

## Nytt i v0.12.0 – Matkassar för fyra

- Ny startsidemodul och mellansida i `matkasse.html`.
- Vardagskasse, lunchkasse och helgkasse med måltider och inköpslista för exakt fyra personer.
- Inköpslistan kan bockas av och sparas lokalt i webbläsaren.
- Kommunvalet följer samma centrala kommun som resten av DinPuls.
- `data/grocery.json` skiljer kassinnehåll, lokala butikslänkar och verifierade prisuppgifter åt.
- Butikspris visas bara när total, källa och kontrolldatum finns. Saknade priser uppskattas aldrig.
- Matkassesidan har fyra kategoriannonsplatser enligt nivån 500 kr per månad.

## Klickbar drivmedelsruta

Hela drivmedelskortet på startsidan öppnar nu drivmedelssidan. De enskilda
stationsraderna och länken längst ned fungerar fortfarande separat. Kortet kan
även öppnas med Enter eller mellanslag för tangentbordsanvändare.

## Tankning och billaddning

- `drivmedel.html` samlar tank- och laddstationer för vald kommun och har
  filtrering efter stationstyp, prisstatus och fritext.
- Startsidans drivmedelskort och snabbrad följer den centrala kommunmotorn.
- `scripts/update_fuel.py` hämtar öppna stationsuppgifter i ett samlat
  Overpass-anrop och fördelar stationerna inom 15 km till de sju kommunerna.
- GitHub-flödet **Uppdatera tank- och laddstationer** körs var sjätte timme.
- Lokala pumppriser gissas aldrig. Pris saknas visas när det inte finns en
  tillförlitlig prisuppgift. Operatörspriser märks uttryckligen som sådana.
- En verifierad officiell grundlista per kommun finns kvar om den öppna
  karttjänsten tillfälligt inte svarar.

## Jobb- och bostadssidor samt annonsnivåer

- `bostader.html` visar samtliga hämtade bostäder i vald kommun med sökning,
  rumsfilter och högsta hyra. Besökaren går vidare till hyresvärden först via
  knappen på DinPuls-sidan.
- `jobb.html` visar samtliga hämtade jobb i vald kommun med lokal sökning och
  en tydlig ansökningslänk till originalannonsen.
- Startsidan har tre roterande premiumannonsgrupper med tio platser per grupp,
  totalt 30 platser avsedda för 1 500 kr per månad.
- Jobb- och bostadssidorna har kategoriannonser avsedda för 500 kr per månad.
- Kommunvalet delas via `localStorage`, så mellansidorna öppnas för kommunen
  som användaren redan följer.

## Bostäder direkt i alla sju startkommuner

Den offentliga Momentum-källan är nu ansluten för Säffle, Bengtsfors, Årjäng
och Grums. Tillsammans med Åmål, Mellerud och Arvika innebär det att samtliga
sju startkommuner kan visa verkliga lediga bostäder direkt i DinPuls.

- Ingen inloggning eller ny GitHub-hemlighet krävs för hämtningen.
- API-inställningarna läses från respektive bostadsbolags offentliga
  webbkonfiguration.
- Alla objekt normaliseras till samma centrala bostadsmodell.
- Senaste fungerande kommundata bevaras om en källa tillfälligt ligger nere.
- Direktlänken på varje objekt går till det officiella bostadsbolaget.

---

# Tidigare: DinPuls v0.9.1

## Korrigerad bostadshämtning för Åmål

Åmåls Kommunfastigheter använder ett eget Vitec-format och delar upp de
lediga objekten på flera resultatsidor. Hämtaren läser nu samtliga sidor och
identifierar Åmåls annonslänkar korrekt. Tidigare kunde Åmål därför felaktigt
visas med 0 bostäder trots publicerade objekt.

---

# Tidigare: DinPuls v0.9.0

## Lediga bostäder från officiella hyresvärdar

Bostadsmodulen följer vald kommun i den centrala kommunmotorn. Den visar
aktuella strukturerade lägenheter från Åmåls Kommunfastigheter, Melleruds
Bostäder och Arvika Fastighets AB när objekten kan läsas säkert. För samtliga
sju startkommuner finns dessutom en direktlänk till respektive officiella
bostadskö.

- `scripts/update_housing.py` hämtar och normaliserar bostadsuppgifter.
- `data/housing.json` innehåller objekt och officiella hyresvärdar per kommun.
- GitHub-flödet **Uppdatera lediga bostäder** körs var fjärde timme och kan
  startas manuellt. Ingen ny API-nyckel krävs.
- Senaste fungerande data bevaras om en strukturerad källa tillfälligt fallerar.
- Säffle, Bengtsfors, Årjäng och Grums använder externa Mina sidor-system som
  inte erbjuder stabil öppen export. DinPuls länkar därför direkt till deras
  verkliga objekt i stället för att presentera osäker eller påhittad data.

Efter uppladdning till GitHub: öppna **Actions**, välj **Uppdatera lediga
bostäder** och kör flödet en gång. Därefter uppdateras modulen automatiskt.

---

# Tidigare: DinPuls v0.8.0

## Lediga jobb med riktig data

Jobbmodulen hämtar aktuella annonser från Arbetsförmedlingens öppna JobSearch-
API och följer alltid kommunen som valts i den centrala kommunmotorn.

- Alla sju startkommuner har ett centralt `jobSearchMunicipalityId` i
  `data/municipalities.json`.
- `scripts/update_jobs.py` hämtar upp till 25 aktuella annonser per kommun och
  skriver normaliserad data till `data/jobs.json`.
- Jobbkortet visar totalt antal annonser, titel, arbetsgivare, ort,
  anställningsform, publiceringsdatum och sista ansökningsdag.
- Sökfältet filtrerar de hämtade annonserna direkt i webbläsaren.
- Snabbraden visar antal jobb och den senast publicerade annonsen för vald
  kommun.
- GitHub-flödet **Uppdatera lediga jobb** körs varannan timme och kan även
  startas manuellt. Ingen API-nyckel krävs.
- Vid tillfälligt API-fel bevaras senaste fungerande kommundata.

Efter uppladdning till GitHub: öppna **Actions**, välj **Uppdatera lediga jobb**
och kör arbetsflödet en gång manuellt. Därefter sköts uppdateringen automatiskt.

Datakälla: Arbetsförmedlingen – Platsbanken via JobTech JobSearch.

---

# Tidigare: DinPuls v0.7.2

## Verifierade hållplatsgrupper

Version 0.7.2 låser de huvudstationer och metahållplatser som verifierats i
Trafiklabs verkliga Stop Lookup-svar:

- Åmål station — `740000076`
- Säffle station — `740000023`
- Bengtsfors — `740098286`
- Mellerud — `740098017`
- Årjäng busstation — `740000364`
- Arvika — `740098080`
- Grums station — `740000217`

Hållplatssökningen accepterar nu antingen en exakt kommunträff eller ett
tidigare manuellt granskat id som fortfarande finns i Trafiklabs svar. Därmed
väljs exempelvis Säffle station, inte den mer trafikerade men felaktiga träffen
Säfflegatan.

---

# Tidigare: DinPuls v0.7.1

## Automatisk aktivering av riktiga avgångar

Version 0.7.1 använder repository-hemligheten `TRAFIKLAB_API_KEY` utan att
skriva nyckeln till filer eller loggar. Det manuella GitHub-flödet
**Hitta hållplatser och aktivera trafikdata** söker hållplatsgrupper för de sju
startkommunerna. Endast exakta namnträffar aktiveras automatiskt. Samtliga
kandidater sparas i `data/stop-candidates.json` för granskning.

När alla sju kommuner har säkra id:n hämtas de första riktiga avgångarna.
Vid saknade id:n eller API-fel bevaras senaste fungerande `transport.json`.
Trafikstörningar från API-svaret förs vidare till webbplatsen när de finns.

## Aktivera efter uppladdning till GitHub

1. Kontrollera att repository-hemligheten heter `TRAFIKLAB_API_KEY`.
2. Öppna fliken **Actions** i GitHub.
3. Välj **Hitta hållplatser och aktivera trafikdata**.
4. Klicka **Run workflow** och därefter den gröna **Run workflow**-knappen.
5. När körningen är grön uppdateras webbplatsen automatiskt efter GitHub Pages nästa publicering.

---

# Tidigare: DinPuls v0.7.0

## Central kommunmotor

Version 0.7.0 bygger vidare direkt på v0.6.1 och inför en gemensam kommunmotor.

- Alla sju startkommuner definieras i `data/municipalities.json`.
- Endast kommunmotorn läser och sparar användarens kommunval.
- Väder, nyheter och kollektivtrafik prenumererar på samma kommunbyte.
- Kommunväljaren byggs automatiskt från kommunfilen.
- Ogiltiga sparade kommunval återställs säkert.
- Gamla väderanrop kan inte skriva över en senare vald kommun.
- Det äldre busskortet använder samma trafikdata som avgångstavlan.
- Demodata märks uttryckligen och presenteras aldrig som liveinformation.
- Oanslutna moduler visar ärliga tomlägen i stället för Åmålsdata under en annan kommunrubrik.
- Versionsnumret är samlat till v0.7.0.

## Starta

Öppna `index.html` med Live Server. Direktöppning via `file://` stöds inte eftersom komponenter och JSON-data hämtas med `fetch`.

---

## Tidigare sprintar

Den här versionen innehåller den kompletta första designsprinten:

- skarp SVG-logga
- premium-header och sökfält
- responsiv mobilmeny
- mörkt läge med sparat val
- val av favoritkommun med LocalStorage
- riktiga SVG-ikoner via Lucide
- förbättrad typografi, kort, hover-effekter och komponentstruktur
- flygplatsticker, liveklocka och demonstrationsnedräkning

## Starta
Öppna `index.html` med Live Server.

## Viktigt
Internetanslutning krävs för Google Fonts och Lucide-ikoner.

## Version 1.1
- Tog bort den bruna bakgrunden runt Nyheter, Evenemang och Kartkollen.
- Rättade en CSS-namnkonflikt mellan rutnätet `.three` och en nyhetsbild.
- Förbättrade avståndet och övergången mellan sektionerna.

## Sprint 1.2 – Mobil
- Ny mobilheader med kompakt logga och sökfält.
- Mobilmeny som öppnas från menyknappen.
- Ticker anpassad för små skärmar.
- Hero och Dagens viktigaste ombyggda för mobil.
- Alla kort staplas i en kolumn.
- Tjänster visas i två kolumner.
- Jobb, bostäder, annonser och footer är mobilanpassade.

## Sprint 2 – SMHI-väder

Väderkortet hämtar nu automatiskt punktprognoser från SMHI:s SNOW1G API.

Det visar:
- temperatur
- väderbeskrivning och symbol
- dagens högsta och lägsta temperatur
- vindhastighet
- luftfuktighet
- nederbörd
- fyra kommande prognostider
- när prognosen uppdaterades

Vädret följer den kommun som väljs i kommunväljaren. Data uppdateras var
trettionde minut.

Källa anges i väderkortet.

Väderkortet använder en högst sex timmar gammal lokal reservprognos om SMHI
tillfälligt inte kan nås. Länken Blixtkarta öppnar SMHI:s officiella kartor.
SMHI:s individuella blixtnedslag i realtid levereras via WebSocket mot
leveransavgift och bäddas därför inte in utan ett separat avtal.

## Sprint 2.1 – Kommunval

Användaren kan nu välja mellan:
- Åmål
- Säffle
- Bengtsfors
- Mellerud
- Årjäng
- Grums
- Arvika

Valet sparas i webbläsaren och ändrar:
- väderdata och väderplats
- kommunnamn i headern
- kommunnamn i hero-sektionen
- trafik-, buss-, drivmedels-, nyhets-, evenemangs-, kart-, jobb- och bostadsrubriker
- sidans webbläsartitel

En tydlig informationsrad förklarar att endast vädret är live ännu och att
övrigt innehåll tills vidare är demonstrationsdata.


## Sprint 4 – Lokala nyheter

Nyhetsmodulen har byggts om till ett kommunanpassat nyhetscenter.

### Funktioner

- nyheter filtreras efter vald kommun
- fria artiklar och prenumerationsartiklar märks tydligt
- filter för alla, fria, prenumeration, myndigheter och kommun
- källor prioriteras efter kvalitet, aktualitet och lokal relevans
- betalväggar kringgås aldrig
- användaren skickas alltid till originalutgivaren
- separat källförteckning anpassas efter vald kommun
- responsiv mobilvy
- GitHub Actions-struktur för återkommande uppdatering

### Viktigt

Versionen innehåller ett konservativt, kvalitetssäkrat starturval och
källlänkar. För verklig automatisk rubrikhämtning från alla redaktionella
källor krävs RSS/API-avtal eller en serverfunktion. GitHub Pages kan inte
på ett stabilt och juridiskt säkert sätt skrapa alla tidningssidor direkt
från användarens webbläsare.


# DinPuls v0.5.0 – komplett helhetsversion

Denna ZIP innehåller hela sidan och ersätter tidigare projektmappar.

## Nytt

- flikarna Lokalt, Sverige och Världen
- kommunanpassat lokalt urval
- DinPuls-index för kvalitet, aktualitet och samhällspåverkan
- panel för viktiga händelser
- tydlig märkning av fria och låsta artiklar
- automatiskt RSS-stöd via GitHub Actions var 15:e minut
- befintligt väder, kommunval, design, jobb, bostäder, tjänster och övriga moduler är bevarade

## Installera lokalt

1. Stäng VS Code.
2. Byt namn på din gamla DinPuls-mapp till DinPuls-backup.
3. Packa upp denna ZIP.
4. Byt namn på den uppackade mappen till DinPuls.
5. Öppna mappen i VS Code.
6. Starta index.html med Live Server.

## Publicera

Ersätt filerna i ditt lokala Git-projekt, kontrollera sidan med Live Server, gör commit och push. GitHub Actions måste ha skrivbehörighet för att nyhetsfilen ska kunna uppdateras automatiskt.

## Version 0.6.0 – buss och tåg

Denna version lägger till en kommunanpassad avgångstavla för buss och tåg.

- Filtrering mellan alla avgångar, buss och tåg.
- Val av hållplats eller station.
- Visning av linje, riktning, operatör, plattform, planerad tid, realtid, försening och inställd avgång.
- Mobilanpassad design och mörkt läge.
- Reservdata i `data/transport.json`, så sidan fungerar direkt i Live Server.
- GitHub Action och Python-skript för kommande automatisk uppdatering via Trafiklab.

### Koppla riktig realtidsdata

1. Skapa konto och API-nyckel hos Trafiklab.
2. Lägg nyckeln i GitHub-repot som secret med namnet `TRAFIKLAB_API_KEY`.
3. Kör arbetsflödet **Hitta hållplatser och aktivera trafikdata**.
4. Hållplats-id:n sparas centralt och de första riktiga avgångarna hämtas automatiskt.

Trafiklab-data måste krediteras. Länken “Data från Trafiklab.se” finns därför i modulen.


## v0.6.1 – rättning
- Buss- och tågtider uppdateras direkt när kommunen byts.
- Hållplatslistan byts till vald kommun.
- Trafikfliken återställs till Alla vid kommunbyte.
- Snabbraden visar nästa faktiska avgång för vald kommun i stället för statisk demodata.
# DinPuls v0.21.5 – Vård och hälsa

- Ny startsidemodul och undersida `vard.html` för samtliga sju startkommuner.
- 112 och 1177 visas som tydliga, direkt ringbara kontaktvägar.
- Offentlig vård länkas till 1177 Hitta vård och rätt regional 1177-ingång.
- Apotek, tandvård, fysioterapi, kiropraktik, naprapati, massage, fotvård,
  psykisk hälsa, arbetsterapi, rehabilitering, syn och hörsel ingår i den
  lokala kategorikatalogen.
- DinPuls ger inga medicinska råd och visar inga påhittade öppettider,
  telefonnummer eller verksamhetsuppgifter.
- Fyra lokala annonsplatser finns på undersidan utan att påverka offentlig
  samhällsinformation.
- Versionen är publicerad på DinPuls huvudgren.

# DinPuls v0.21.6 – Service & hantverk

- Ny startsidemodul och undersida `service.html` för samtliga sju startkommuner.
- Bilverkstäder, däckbyte, bärgning, snickare, byggföretag, VVS, elektriker,
  målare, golvläggare, tak, ventilation, städ, flytt, markarbete, låssmed,
  reparation, byggvaruhus och maskinuthyrning ingår.
- Kategorier öppnar neutrala externa kartsökningar; DinPuls rekommenderar eller
  rangordnar inte enskilda verksamheter.
- Grundöversikten hålls skild från fyra tydligt märkta annonsplatser.
- Sökning, kategoriurval och kommunbyte fungerar för alla sju kommuner.
- Versionen är publicerad på DinPuls huvudgren.
