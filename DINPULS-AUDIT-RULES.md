# DinPuls – STRICT LIVE kommunregel v4

Detta dokument ersätter samtliga tidigare kommunregler och är den enda bindande standarden för att avgöra om en DinPuls-kommun är GRÖN, GUL eller RÖD.

## 1. Syfte

Regeln ska avgöra om en kommun är **lanseringsklar och produktionsmässigt användbar**. Den ska inte kräva maximal framtida innehållstäckning för att en kommun ska få bli GRÖN.

Status ska svara på frågan:

> Om en vanlig invånare öppnar DinPuls för kommunen nu – fungerar de avsedda modulerna, visas rätt lokal och aktuell information och känns kommunen tillräckligt komplett för lansering på ungefär samma kvalitetsnivå som Åmål?

Åmål är kalibreringskommun för kvalitet och mognadsgrad, inte en numerisk mall.

## 2. Lanseringsklar är inte samma sak som slututbyggd

DinPuls ska kunna lanseras när de befintliga modulerna fungerar korrekt och innehåller ett trovärdigt lokalt grundutbud.

GRÖNT betyder därför inte att varje möjlig privat källa, företag, hyresvärd, aktivitet eller förening redan är tillagd. Sådan breddning kan ske efter lansering.

En kommun får inte hållas GUL enbart därför att det finns fler möjliga källor som skulle kunna läggas till senare.

## 3. Åmål som kalibreringskommun

Åmål används som kvalitativ referens för:

- fungerande obligatoriska moduler,
- rätt kommun och lokal data,
- aktuella dynamiska flöden,
- rimlig bredd i förhållande till kommunens storlek,
- fungerande länkar och objekt,
- inga kända kritiska luckor i den lanseringsnivå som faktiskt är beslutad.

Små verkliga utbud accepteras. Absoluta antal från Åmål får aldrig användas som krav på andra kommuner.

## 4. Statusdefinitioner

### 🟢 GRÖN – lanseringsklar

En kommun är GRÖN när:

1. samtliga obligatoriska moduler fungerar tekniskt,
2. rätt kommun och rätt lokala data visas,
3. dynamiska flöden är aktuella och användbara,
4. innehållet är rimligt för kommunens storlek och den beslutade lanseringsnivån,
5. inga kända kritiska eller tydligt användarpåverkande luckor finns i de källor som ingår i lanseringsnivån,
6. kommunen sammantaget håller minst Åmål-nivå i användbarhet och lokal trovärdighet.

GRÖNT kräver inte matematisk bevisning att allt möjligt lokalt innehåll är insamlat.

### 🟡 GUL – fungerar men har konkret lanseringsblockerande brist

En kommun är GUL när sajten i huvudsak fungerar men minst en konkret brist hindrar lanseringsklar status, exempelvis:

- en obligatorisk modul visar uppenbart fel eller otillräckligt innehåll,
- en beslutad primärkälla fungerar inte eller importeras ofullständigt,
- rätt data finns men parser, pagination, filter eller automation tappar kända objekt,
- en modul är uppenbart orimligt tunn jämfört med kommunens verkliga grundutbud,
- ett tekniskt workflowfel gör att aktuell data inte kan hållas stabilt uppdaterad.

Framtida förbättringskällor och privata extrakällor utanför lanseringsnivån gör inte kommunen GUL i sig.

### 🔴 RÖD – kritiskt trasig

En kommun är RÖD när en central funktion är trasig eller oanvändbar, exempelvis fel kommun, utebliven central data, trasig navigation, systematiskt stale data eller en viktig aktiv integration som inte fungerar alls.

## 5. Proportionalitetsprincip

Kommuner ska bedömas mot sitt verkliga lokala grundutbud, inte fasta minimiantal.

- Åmål kan vara GRÖN med 4 lunchställen om fyra är ett rimligt faktiskt lanseringsutbud.
- Storfors kan vara GRÖN med 2 lunchställen om 2/2 är verifierat.
- Karlstad kan inte vara GRÖN med ett uppenbart orimligt litet urval om centralt grundutbud saknas.
- Dals-Ed kan vara GRÖN med få jobb om det lokala aktuella utbudet verkligen är litet.

Numeriska värden får användas som varningssignal men aldrig som ensam statusgrind.

## 6. Obligatoriska moduler

- Grundkonfiguration / kommunval
- Dagens viktigaste
- Väder
- Vägtrafik
- Kollektivtrafik
- Flyg
- Jobb
- Bostäder
- Evenemang
- Lokala/kommunala nyheter
- Missing People
- Vård & hälsa
- Service & hantverk
- Myndigheter & samhällsservice
- Dagens lunch
- Bio
- Fritid & aktiviteter
- Idrott & föreningar
- Community / Det pratas om

Hero och Matkassen är undantagna.

## 7. Modulprinciper

### Jobb
Det beslutade huvudsakliga jobbflödet ska fungera och ge ett trovärdigt aktuellt lokalt utbud. Ett litet antal i en liten kommun är inte i sig fel. Ytterligare privata rekryteringskällor kan läggas på efter lansering om inte en uppenbar central lucka finns.

### Bostäder – särskild lanseringsregel

För lanseringen är grundkravet att kommunens **kommunala fastighetsbolag, kommunala bostadsstiftelse eller motsvarande huvudsakliga kommunala bostadskälla** fungerar där sådan finns och att aktuella objekt därifrån visas korrekt.

Privata hyresvärdar och sekundära bostadskällor är **utbyggnad efter lansering** och blockerar inte GRÖNT, även om ytterligare objekt kan hittas där.

Undantag: kommunen blir GUL eller RÖD om den beslutade kommunala huvudkällan är trasig, fel kommun visas, kända objekt från den källan tappas, eller automation/workflow inte fungerar stabilt.

Detta innebär uttryckligen att Bengtsfors, Grums, Filipstad, Kristinehamn eller Munkfors inte får hållas GULA enbart därför att privata bostadsobjekt finns utanför DinPuls, om deras beslutade kommunala bostadskälla fungerar korrekt.

### Evenemang
Kalendern ska ge ett trovärdigt lokalt grundutbud. Kommunala, kulturella, förenings-, marknads-, loppis- och sportevenemang ska finnas där de är centrala och tillgängliga genom beslutade källor. Inget fast minimiantal gäller.

### Nyheter
Beslutade centrala lokala nyhetskällor ska fungera, vara aktuella, lokalt korrekta och deduplicerade.

### Vård & hälsa
Modulen ska vara användbar och lokalt rimlig. Maximal katalogtäckning krävs inte för lansering.

### Service & hantverk
Modulen ska innehålla ett trovärdigt lokalt grundutbud. Full företagskatalog är en senare utbyggnad.

### Dagens lunch
Verkligt lokalt utbud bedöms proportionerligt. 2/2 eller 4/4 kan vara GRÖNT. Ett uppenbart orimligt urval i en större kommun är GULT.

### Fritid & aktiviteter
Centrala kommunala och lokala fritids-, kultur-, frilufts- och aktivitetsmöjligheter ska vara rimligt representerade för lansering.

### Idrott & föreningar
Ett trovärdigt lokalt grundutbud krävs för lansering. Fullständig framtida föreningskatalog är inte i sig ett lanseringskrav, men en uppenbar grov underrepresentation kan vara GUL.

### Tekniska/nollägesmoduler
Väder, trafik, Missing People, bio och liknande kan vara GRÖNA med 0 poster när funktionen och källan är frisk och nolläget är legitimt.

## 8. BLOCKED-källor

BLOCKED är ett evidensfält, inte automatiskt kommunstatus.

- framtida extrakälla eller privat kompletteringskälla: blockerar inte GRÖNT,
- beslutad aktiv lanseringskälla som är trasig: GUL eller RÖD,
- tekniskt fel i aktiv integration: GUL eller RÖD beroende på konsekvens.

## 9. Auditmetod

Varje revision ska kontrollera:

1. teknisk funktion,
2. rätt kommun och rätt data,
3. aktualitet,
4. de källor som faktiskt ingår i lanseringsnivån,
5. uppenbara konkreta användarpåverkande luckor,
6. proportionalitet mot kommunens storlek och Åmål-benchmark.

Audit får inte flytta mållinjen genom att göra nyfunna framtida förbättringskällor till nya lanseringskrav utan ett uttryckligt produktbeslut.

## 10. Automatisk audit

`DINPULS-AUDIT-RULES.md` är bindande.

Fasta gamla miniminivåer får inte användas som ensam beslutsgrund. Automatiken ska skilja mellan:

- lanseringsblockerande fel,
- proportionella varningssignaler,
- framtida förbättringar.

## 11. De 21 kommunerna

Åmål, Årjäng, Bengtsfors, Mellerud, Arvika, Grums, Säffle, Dals-Ed, Eda, Filipstad, Forshaga, Färgelanda, Hagfors, Hammarö, Karlstad, Kil, Kristinehamn, Munkfors, Storfors, Sunne och Torsby.

## 12. Slutregel

> **GRÖN = lanseringsklar: tekniskt fungerande, aktuell, lokalt trovärdig och tillräckligt komplett enligt den beslutade lanseringsnivån.**

> **GUL = en konkret lanseringsblockerande brist återstår.**

> **RÖD = kritisk funktion eller aktiv datakälla är trasig eller väsentligt fel.**

Framtida förbättringsmöjligheter får inte förväxlas med blockerare för lansering.
