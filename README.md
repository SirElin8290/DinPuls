# DinPuls v0.7.1

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
