# DinPuls – STRICT LIVE 100 % kommunregel v3

Detta dokument ersätter alla tidigare regler för kommunanalys och är den enda bindande standarden för att avgöra om en DinPuls-kommun är 100 % klar.

## 1. Grundprincip: 100 % betyder full verifierad täckning

Varje kommun bedöms från noll vid varje full revision. Tidigare grönt, pilot-/produktionsstatus, äldre rapporter eller tidigare godkännanden ger inget frikort.

Frågan är endast:

> Om en vanlig besökare öppnar DinPuls för kommunen nu – fungerar samtliga obligatoriska moduler, visar de rätt kommun och återger de hela det relevanta lokala utbud som rimligen går att verifiera från definierade källor?

En kommun är **🟢 100 % GRÖN** endast när alla obligatoriska moduler samtidigt är gröna.

En enda gul eller röd obligatorisk modul innebär att kommunen som helhet inte är 100 % grön.

## 2. Bindande FULL COVERAGE-princip

För varje innehållsmodul ska revisionen först fastställa ett **verifierat källuniversum**: det aktuella relevanta lokala utbud som kan identifieras genom samtliga definierade primära källor och väsentliga sekundära källor.

Därefter ska DinPuls jämföras mot detta universum.

**Täckningsgrad = antal unika verifierade poster i DinPuls / antal unika verifierade poster i källuniversumet.**

### Status

- **🟢 GRÖN:** 100 % av det verifierade källuniversumet finns korrekt och aktuellt i DinPuls, eller modulen är en teknisk/nollägesmodul där full funktion och korrekt nolläge verifierats.
- **🟡 GUL:** modulen fungerar men täcker mindre än 100 % av det verifierade relevanta utbudet, eller källuniversumet är ännu inte tillräckligt verifierat för att 100 % ska kunna bevisas.
- **🔴 RÖD:** modulen är trasig, visar fel kommun/data, saknar nödvändig källa, importerar felaktigt eller kan inte användas som avsett.

Ett fast numeriskt minimum får aldrig ensamt göra en modul grön.

## 3. Absolut förbud mot att avbryta research vid ett minimiantal

Revisionen får **inte avsluta research när ett visst antal poster har hittats**.

Att exempelvis hitta 10 jobb, 10 bostäder, 10 evenemang, 25 föreningar eller ett annat tidigare gränsvärde är aldrig bevis för fullständighet.

Research ska fortsätta tills:
1. alla definierade primära källor är genomgångna,
2. alla väsentliga sekundära källor som behövs för rimlig full täckning är genomgångna,
3. posterna är deduplicerade,
4. det verifierade totalutbudet är fastställt så långt det rimligen går,
5. DinPuls resultat har jämförts post för post eller på annat verifierbart sätt mot detta totalutbud.

## 4. Små och stora kommuner behandlas efter verkligt utbud – inte samma antal

Kommunstorlek får inte i sig ge ett godkännande eller underkännande.

En liten kommun kan vara 100 % grön med få poster om research visar att dessa få poster utgör hela det verifierade relevanta utbudet.

Exempel:
- Åmål kan vara grön på lunch med 4 lunchställen om aktuell research verifierar att det relevanta ordinarie utbudet faktiskt är 4 och DinPuls visar 4 av 4.
- Dals-Ed kan vara grön på jobb med 6 jobb om aktuell research verifierar att det relevanta aktuella utbudet är 6 och DinPuls visar 6 av 6.
- En större kommun som Karlstad får däremot inte bli grön på bostäder om DinPuls visar 1 objekt när det verifierade aktuella källuniversumet innehåller exempelvis 50, 100 eller fler objekt.

**4 av 4 = 100 %. 6 av 6 = 100 %. 1 av 50 = 2 % och är inte grönt.**

## 5. Källtäckning är lika viktig som posttäckning

En modul kan inte klassas som 100 % grön om DinPuls bara använder en liten del av de relevanta källorna.

Revisionen ska därför kontrollera både:
- **source coverage:** om alla relevanta definierade källor faktiskt används eller täcks,
- **item coverage:** om de relevanta poster som finns i dessa källor faktiskt återges i DinPuls.

Om en viktig lokal eller officiell källa saknas ska modulen vara 🟡 eller 🔴 tills orsaken är utredd och täckningen är verifierad.

## 6. Obligatoriska moduler

### Grundkonfiguration / kommunval
Rätt kommun ska väljas, visas och bestå vid navigation/refresh.

### Dagens viktigaste
Lokal källa/fallback ska fungera. Ett legitimt nolläge är okej om källorna faktiskt är friska.

### Väder
Aktuell väderdata för rätt kommun.

### Vägtrafik
Aktiv fungerande källa för kommunen. 0 händelser är okej om källan är frisk.

### Kollektivtrafik
Rätt hållplats/område och aktuell användbar information.

### Flyg
Korrekt och användbar flyginformation. Realtid krävs inte.

### Jobb
Samtliga rimligen verifierbara aktuella lokala jobb från definierade relevanta källor ska ingå efter deduplicering. Ingen fast miniminivå ersätter full coverage.

### Bostäder
Samtliga rimligen verifierbara faktiskt aktuella lediga bostadsobjekt från definierade relevanta bostadskällor ska ingå efter deduplicering. Audit ska särskilt upptäcka om en kommun bara täcker en hyresvärd eller en liten del av det faktiska utbudet.

### Evenemang
Samtliga rimligen verifierbara aktuella/framtida lokala evenemang från definierade relevanta källor ska ingå efter deduplicering. Lokala loppisar, marknader, föreningsevenemang, kultur, sport och andra relevanta publika aktiviteter ska inkluderas när de kan verifieras.

### Lokala/kommunala nyheter
DinPuls ska täcka hela den definierade relevanta lokala nyhetskällbasen. Innehållet ska vara aktuellt, lokalt korrekt och deduplicerat. Antalet nyheter är inte i sig godkännandekriterium.

### Missing People
Korrekt lokal/grannkommunal logik och fungerande källa/fallback. 0 aktiva efterlysningar är okej.

### Vård & hälsa
Samtliga rimligen verifierbara relevanta lokala verksamheter ska täckas, med kategoribredd där verksamheter faktiskt finns: vårdcentral/läkare, tandvård, BVC/barnmorska, rehab/fysioterapi, apotek, privat vård/behandling och andra relevanta tjänster.

### Service & hantverk
Samtliga rimligen verifierbara relevanta lokala företag inom definierade servicekategorier ska täckas. Audit får inte sluta när ett visst antal företag eller kategorier uppnåtts.

### Myndigheter & samhällsservice
Samtliga definierade centrala kommunala och relevanta statliga samhällsfunktioner ska täckas och länkas korrekt.

### Dagens lunch
Samtliga rimligen verifierbara ordinarie lokala lunchställen som faktiskt serverar lunch ska finnas. En kommun med fyra verifierade relevanta lunchställen kan vara 100 % grön om resultatet är 4 av 4.

### Bio
Finns aktiv lokal bio ska korrekt biograf samt aktuell program-/visningsinformation eller fungerande direkt programkälla finnas. Om lokal bio saknas får modulen vara grön endast om detta hanteras korrekt och tydligt.

### Fritid & aktiviteter
Samtliga rimligen verifierbara relevanta lokala aktiviteter och anläggningar inom definierade kategorier ska täckas, inklusive kultur, bibliotek, bad, friluftsliv, motionsområden, ungdomsverksamhet och andra lokala aktiviteter där sådant finns.

### Idrott & föreningar
Målet är full föreningstäckning. Samtliga verifierbara aktiva lokala föreningar i relevanta kommunala/officiella register och andra definierade källor ska finnas efter deduplicering. Om kommunens verifierade register innehåller 84 aktiva föreningar ska målet vara 84 av 84 – inte 25.

### Community / Det pratas om
Funktionen ska bete sig korrekt. Privata grupper får inte skrapas utan godkännande. Avsaknad av godkänd privat/community-källa blockerar inte grönt om funktionen i övrigt hanteras korrekt och inget innehåll fabriceras.

## 7. Källuniversum och beviskrav

För varje dynamisk innehållsmodul ska auditrapporten så långt möjligt redovisa:
- vilka källor som granskats,
- datum och tid för verifieringen,
- antal råposter per källa,
- antal poster efter deduplicering,
- antal poster i DinPuls,
- täckningsgrad i procent,
- saknade poster eller saknade källor,
- källfel/parserfel/importfel,
- om resultatet är live, repo-fallback eller inte verifierbart.

Dynamiska moduler som jobb, bostäder, evenemang och nyheter ska tidsstämplas eftersom källuniversumet förändras löpande.

## 8. Auditmotorn måste följa samma regel

`DINPULS-AUDIT-RULES.md` är bindande och auditmotorn får inte använda lägre eller äldre hårdkodade gränser som kan ge grönt i strid med denna regel.

Om auditkod, workflow eller annan automatik fortfarande använder en äldre v1/v2-gräns ska den automatiska gröna statusen betraktas som ogiltig tills motorn är synkroniserad med v3.

En teknisk lyckad hämtning, HTTP 200, ett antal poster eller en lyckad commit är aldrig ensamt bevis för 100 % täckning.

## 9. Live/aktiv kod är facit

Verifieringsnivåerna ska hållas isär:
1. data/kod finns i repo,
2. aktiv kodväg använder datan,
3. workflow/runtime har producerat aktuell output,
4. live-sidan visar korrekt resultat,
5. källuniversumet har verifierats,
6. DinPuls täcker 100 % av det verifierade relevanta universumet.

Data i GitHub räknas inte som fullgod täckning om den aktiva frontend- eller pipeline-koden inte använder den.

## 10. Full kommunanalys

Samtliga 21 kommuner ska bedömas från noll enligt exakt samma STRICT LIVE 100 % v3-standard:

- Åmål
- Årjäng
- Bengtsfors
- Mellerud
- Arvika
- Grums
- Säffle
- Dals-Ed
- Eda
- Filipstad
- Forshaga
- Färgelanda
- Hagfors
- Hammarö
- Karlstad
- Kil
- Kristinehamn
- Munkfors
- Storfors
- Sunne
- Torsby

Hero och Matkassen undantas. Alla övriga obligatoriska moduler ska kontrolleras.

En kommun som tidigare fungerat väl, exempelvis Åmål, ska fortfarande verifieras i full revision, men den ska inte underkännas för att dess verkliga lokala utbud är mindre än ett gammalt numeriskt minimum. Full coverage mot verkligheten är det bindande kriteriet.

## 11. Slutregel

> **100 % GRÖN = samtliga obligatoriska moduler fungerar korrekt, rätt kommun visas, aktuell aktiv/live data är verifierad, samtliga definierade relevanta källor har granskats tillräckligt för att fastställa källuniversumet, och DinPuls återger 100 % av det rimligen verifierbara relevanta lokala utbudet efter deduplicering.**

Om full täckning inte kan bevisas ska modulen inte klassas som 100 % grön.

## 12. Rapportering

Slutrapporten för de 21 kommunerna ska visa:
- totalstatus per kommun,
- status per obligatorisk modul,
- verifierat totalutbud där detta kan fastställas,
- DinPuls antal,
- täckningsgrad i procent,
- granskade och saknade källor,
- saknade poster,
- tekniska käll-/parser-/importfel,
- exakt blockerare för varje icke-grön modul,
- vilka kommuner som faktiskt når 100 %.

Inga tidigare statusar, fasta miniminivåer eller gamla auditresultat får användas som argument för grönt. Nuläget och verifierad täckning är facit.
