# DinPuls – STRICT LIVE 100 % kommunregel

Detta dokument ersätter alla tidigare regler för kommunanalys och är den bindande standarden för att avgöra om en DinPuls-kommun är 100 % klar.

## 1. Grundprincip

Varje kommun bedöms från noll vid varje full revision. Tidigare grönt, tidigare pilot-/produktionsstatus, äldre rapporter och tidigare godkännanden ger inget frikort.

Frågan är endast:

> Om en vanlig besökare öppnar DinPuls för kommunen nu – fungerar samtliga obligatoriska moduler, visar de rätt kommun och finns det tillräckligt mycket aktuellt och lokalt innehåll?

En kommun är **🟢 100 % GRÖN** endast när alla obligatoriska moduler samtidigt är gröna.

En enda gul eller röd modul innebär att kommunen som helhet inte är 100 % grön.

## 2. Statusfärger

### 🟢 GRÖN
Modulen fungerar, visar rätt kommun, använder aktiv kod/data, innehållet är aktuellt och den når nedanstående miniminivå.

### 🟡 GUL
Modulen fungerar tekniskt men är för tunn, för gammal, bygger bara på en referenslänk där verkligt innehåll ska visas, eller når inte miniminivån.

### 🔴 RÖD
Modulen är trasig, tom på grund av fel, visar fel kommun/fel data, saknar nödvändig källa eller kan inte användas som avsett.

## 3. Obligatoriska moduler och miniminivåer

| Modul | Krav för 🟢 |
|---|---|
| Grundkonfiguration / kommunval | Rätt kommun ska väljas, visas och bestå vid navigation/refresh. |
| Dagens viktigaste | Lokal källa/fallback fungerar. Ett legitimt nolläge är okej om källorna faktiskt är friska. |
| Väder | Aktuell väderdata för rätt kommun. |
| Vägtrafik | Aktiv fungerande källa för kommunen. 0 händelser är okej om källan är frisk. |
| Kollektivtrafik | Rätt hållplats/område och aktuell användbar information. |
| Flyg | Korrekt och användbar flyginformation. Realtid krävs inte. |
| Jobb | Minst **3 aktuella lokala jobb**. 0–2 = 🟡. |
| Bostäder | Minst **1 faktiskt aktuellt ledigt objekt**. Endast länk eller 0 objekt = 🟡 i STRICT 100 %. |
| Evenemang | Minst **5 aktuella/framtida evenemang**. 1–4 = 🟡. |
| Lokala/kommunala nyheter | Minst **5 aktuella lokala nyheter**. Huvuddelen bör vara högst cirka 30 dagar gamla. |
| Missing People | Korrekt lokal/grannkommunal logik och fungerande källa/fallback. 0 aktiva efterlysningar är okej. |
| Vård & hälsa | Minst **5 relevanta verksamheter** och rimlig bredd: vårdcentral/läkare plus flera av tandvård, BVC/barnmorska, rehab/fysioterapi, apotek, privat vård/behandling. |
| Service & hantverk | Minst **8 verifierade lokala företag** och minst **4 relevanta kategorier**, exempelvis el, VVS, bygg, bil/däck, lås, städ. |
| Myndigheter & samhällsservice | Centrala funktioner ska täckas: kontaktcenter, socialtjänst, ekonomiskt bistånd, budget/skuld, äldreomsorg, LSS, bygglov/boende och relevanta statliga funktioner. |
| Dagens lunch | Minst **4 verifierade lokala lunchställen** som faktiskt serverar lunch. Dagsmeny behöver inte vara maskinläst. |
| Bio | Finns aktiv lokal bio ska korrekt biograf samt aktuell program-/visningsinformation eller fungerande direkt programkälla finnas. Om lokal bio saknas får modulen vara grön endast om detta hanteras korrekt och tydligt. |
| Fritid & aktiviteter | Minst **10 verkliga lokala aktiviteter/anläggningar** med bredd, exempelvis bibliotek/kultur, bad, friluftsliv, motionsområde, ungdomsverksamhet och anläggningar. |
| Idrott & föreningar | Minst **20 verkliga lokala föreningar** för normal kommun och tydlig bredd mellan verksamhetstyper. Färre än 20 = 🟡 om inte ett verifierat faktiskt lokalt föreningsutbud är mindre än så. |
| Community / Det pratas om | Funktionen ska bete sig korrekt. Privata grupper får inte skrapas utan godkännande. Avsaknad av godkänd community-källa är inte i sig blockerande. |

## 4. Absoluta spärrar

### Live/aktiv kod före repo
Data i GitHub räknas inte om den aktiva frontend- eller pipeline-koden inte använder den.

### Inga gamla meriter
Vid STRICT-revision nollställs bedömningen. Ingen kommun behåller grönt bara för att den tidigare varit godkänd.

### Inget tekniskt grönt med tunn sida
Två föreningar, ett evenemang, en ensam vårdcentral eller en referenslänk räcker inte när modulen ska ge ett lokalt utbud.

### Legitimt nolläge skiljs från innehållsbrist
Följande kan vara gröna med 0 aktuella poster om källan fungerar korrekt:
- Dagens viktigaste
- vägtrafik
- Missing People

Följande måste innehålla verkligt lokalt utbud för STRICT 100 %:
- jobb
- bostäder
- evenemang
- nyheter
- vård
- service
- lunch
- fritid
- idrott/föreningar

## 5. Undantag

### Hero
Hero-bilder ingår inte i kommunens 100 %-status.

### Matkassen
Matkassen ingår inte i kommunens 100 %-status.

### Flyg
Flyg behöver inte vara realtid.

### Community
Avsaknad av godkänd privat/community-källa blockerar inte grönt om funktionen i övrigt hanteras korrekt och inget innehåll fabriceras.

## 6. Verifieringsordning

Vid full analys ska varje kommun granskas mot aktuell aktiv data och, när möjligt, publicerad/live sida.

Verifieringsnivåerna ska hållas isär:
1. data/kod finns i repo,
2. aktiv kodväg använder datan,
3. workflow/runtime har producerat aktuell output,
4. live-sidan visar korrekt resultat.

En commit är aldrig ensam bevis för att en modul är grön.

## 7. Full kommunanalys

Samtliga 21 kommuner ska bedömas enligt exakt samma STRICT-standard:

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

## 8. Slutregel

> **100 % GRÖN = samtliga obligatoriska moduler är gröna, ingen innehållsmodul ligger under miniminivån och aktuell aktiv/live data är verifierad.**

Om någon modul är gul eller röd ska kommunen rapporteras som **inte 100 % grön**, med exakt blockerare.

## 9. Rapportering

Slutrapporten för de 21 kommunerna ska visa:
- totalstatus per kommun,
- vilka moduler som är gröna/gula/röda,
- konkreta antal där miniminivåer används,
- exakt blockerare för varje icke-grön kommun,
- vilka kommuner som faktiskt når 100 %.

Inga tidigare statusar får användas som argument för grönt. Nuläget är facit.