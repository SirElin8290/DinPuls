# DinPuls v0.10.0

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
