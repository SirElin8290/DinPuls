# DinPuls – STRICT LIVE 100 % kommunregel v2

Detta dokument ersätter alla tidigare regler för kommunanalys och är den enda bindande standarden för att avgöra om en DinPuls-kommun är 100 % klar.

## 1. Grundprincip

Varje kommun bedöms från noll vid varje full revision. Tidigare grönt, pilot-/produktionsstatus, äldre rapporter eller tidigare godkännanden ger inget frikort.

Frågan är endast:

> Om en vanlig besökare öppnar DinPuls för kommunen nu – fungerar samtliga obligatoriska moduler, visar de rätt kommun och ger de ett aktuellt, lokalt, tillräckligt representativt och användbart innehåll?

En kommun är **🟢 100 % GRÖN** endast när alla obligatoriska moduler samtidigt är gröna.

En enda gul eller röd obligatorisk modul innebär att kommunen som helhet inte är 100 % grön.

## 2. Statusfärger

### 🟢 GRÖN
Modulen fungerar, visar rätt kommun, använder aktiv/live kod och data, innehållet är aktuellt, når miniminivån och är tillräckligt representativt för det verifierbara lokala utbudet.

### 🟡 GUL
Modulen fungerar tekniskt men är för tunn, för gammal, når inte miniminivån, bygger bara på en referenslänk där verkligt innehåll ska visas eller når miniminivån men täcker uppenbart bara en liten del av kommunens verifierbara utbud.

### 🔴 RÖD
Modulen är trasig, tom på grund av fel, visar fel kommun/fel data, saknar nödvändig källa eller kan inte användas som avsett.

## 3. Obligatoriska moduler och krav för 🟢

| Modul | Krav för 🟢 |
|---|---|
| Grundkonfiguration / kommunval | Rätt kommun ska väljas, visas och bestå vid navigation/refresh. |
| Dagens viktigaste | Lokal källa/fallback fungerar. Ett legitimt nolläge är okej om källorna faktiskt är friska. |
| Väder | Aktuell väderdata för rätt kommun. |
| Vägtrafik | Aktiv fungerande källa för kommunen. 0 händelser är okej om källan är frisk. |
| Kollektivtrafik | Rätt hållplats/område och aktuell användbar information. |
| Flyg | Korrekt och användbar flyginformation. Realtid krävs inte. |
| Jobb | Minst **10 aktuella lokala jobb** och rimligt representativ täckning av det verifierbara lokala utbudet. 0–9 = 🟡 om modulen i övrigt fungerar. |
| Bostäder | Minst **10 faktiskt aktuella lediga objekt** och rimligt representativ täckning av det verifierbara lokala utbudet. Endast länk eller 0–9 objekt = 🟡 om modulen i övrigt fungerar. |
| Evenemang | Minst **10 aktuella/framtida lokala evenemang** och rimligt representativ täckning. 0–9 = 🟡 om modulen i övrigt fungerar. |
| Lokala/kommunala nyheter | Minst **10 aktuella lokala nyheter**. Huvuddelen ska normalt vara högst cirka 30 dagar gamla och urvalet ska vara rimligt representativt. |
| Missing People | Korrekt lokal/grannkommunal logik och fungerande källa/fallback. 0 aktiva efterlysningar är okej. |
| Vård & hälsa | Minst **8 relevanta verksamheter** med tydlig bredd. Vårdcentral/läkare ska finnas där sådan verksamhet finns lokalt och flera relevanta kategorier ska täckas, exempelvis tandvård, BVC/barnmorska, rehab/fysioterapi, apotek och privat vård/behandling. |
| Service & hantverk | Minst **12 verifierade lokala företag** och minst **5 relevanta kategorier**, exempelvis el, VVS, bygg, bil/däck, lås och städ. Resultatet ska vara rimligt representativt. |
| Myndigheter & samhällsservice | Centrala funktioner ska täckas: kontaktcenter, socialtjänst, ekonomiskt bistånd, budget/skuld, äldreomsorg, LSS, bygglov/boende och relevanta statliga funktioner. |
| Dagens lunch | Normalt minst **5 verifierade lokala lunchställen** som faktiskt serverar lunch. Dagsmeny behöver inte vara maskinläst. Verifierat verklighetsundantag enligt avsnitt 5 får användas när kommunens hela faktiska ordinarie utbud är mindre än fem. |
| Bio | Finns aktiv lokal bio ska korrekt biograf samt aktuell program-/visningsinformation eller fungerande direkt programkälla finnas. Om lokal bio saknas får modulen vara grön endast om detta hanteras korrekt och tydligt. |
| Fritid & aktiviteter | Minst **15 verkliga lokala aktiviteter/anläggningar** med tydlig bredd, exempelvis bibliotek/kultur, bad, friluftsliv, motionsområde, ungdomsverksamhet och anläggningar. |
| Idrott & föreningar | Minst **25 verkliga lokala föreningar** med tydlig bredd mellan verksamhetstyper. Verifierat verklighetsundantag enligt avsnitt 5 får användas om kommunens hela faktiska lokala föreningsutbud är mindre än 25. |
| Community / Det pratas om | Funktionen ska bete sig korrekt. Privata grupper får inte skrapas utan godkännande. Avsaknad av godkänd community-källa är inte i sig blockerande. |

## 4. Absoluta spärrar

### Live/aktiv kod före repo
Data i GitHub räknas inte om den aktiva frontend- eller pipeline-koden inte använder den.

### Inga gamla meriter
Vid STRICT-revision nollställs bedömningen. Ingen kommun behåller grönt bara för att den tidigare varit godkänd.

### Minimum är ett golv – inte automatiskt godkänt
Att nå ett numeriskt minimum är nödvändigt men inte alltid tillräckligt. Om aktuell research visar att DinPuls endast återger en uppenbart liten del av kommunens verifierbara lokala utbud ska modulen vara 🟡 även om den numeriska miniminivån är uppnådd.

Exempel: Om DinPuls visar 10 bostäder i en större kommun men aktuella relevanta källor visar ett väsentligt större verifierbart utbud, får bostadsmodulen inte bli grön enbart för att siffran 10 har uppnåtts.

### GRÖN betyder användbar och representativ
**GRÖN betyder inte ”något visas”. GRÖN betyder att modulen ger ett tillräckligt representativt och användbart lokalt resultat.**

Denna princip gäller särskilt jobb, bostäder, evenemang, nyheter, vård, service, lunch, fritid och idrott/föreningar.

### Inget tekniskt grönt med tunn sida
Ett tekniskt fungerande API, en lyckad HTTP-response, en referenslänk eller ett fåtal poster är inte tillräckligt när modulen ska ge ett lokalt utbud. Källan, den aktiva datapipelinen och det synliga resultatet måste tillsammans uppfylla v2-standarden.

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

## 5. Verklighetsundantag

Verklighetsundantag får aldrig användas för att kompensera för ofullständig research, trasig import, dålig källtäckning, säsongsstängda verksamheter eller en pipeline som missar tillgängliga poster.

### Dagens lunch
Fem lunchställen är normalgränsen. En kommun med färre än fem får bara godkännas om aktuell research mot officiell kommunal källa och/eller primära destinations-/verksamhetskällor verifierar att färre ordinarie lunchställen faktiskt finns, det verifierade totalantalet dokumenteras och **hela det verifierade utbudet** finns i aktiv/live data.

### Idrott & föreningar
25 föreningar är normalgränsen. En kommun med färre än 25 får bara godkännas om aktuell och tillräckligt bred research verifierar att kommunens faktiska lokala föreningsutbud är mindre och **hela eller i praktiken fullständigt representativt utbud** visas i aktiv/live data.

### Inga automatiska storleksundantag
En kommun får inte lägre krav enbart för att den är liten. Undantag kräver verifiering av det faktiska lokala utbudet. På motsvarande sätt kan en större kommun kräva betydligt fler poster än minimigränsen för att resultatet ska bedömas representativt.

## 6. Övriga undantag

### Hero
Hero-bilder ingår inte i kommunens 100 %-status.

### Matkassen
Matkassen ingår inte i kommunens 100 %-status.

### Flyg
Flyg behöver inte vara realtid.

### Community
Avsaknad av godkänd privat/community-källa blockerar inte grönt om funktionen i övrigt hanteras korrekt och inget innehåll fabriceras.

## 7. Verifieringsordning

Vid full analys ska varje kommun granskas mot aktuell aktiv data och, när möjligt, publicerad/live sida.

Verifieringsnivåerna ska hållas isär:
1. data/kod finns i repo,
2. aktiv kodväg använder datan,
3. workflow/runtime har producerat aktuell output,
4. live-sidan visar korrekt resultat,
5. resultatet är rimligt representativt jämfört med aktuellt verifierbart lokalt utbud.

En commit är aldrig ensam bevis för att en modul är grön. Ett lyckat tekniskt anrop är aldrig ensamt bevis för att innehållet är tillräckligt.

## 8. Full kommunanalys

Samtliga 21 kommuner ska bedömas från noll enligt exakt samma STRICT LIVE 100 % v2-standard:

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

## 9. Slutregel

> **100 % GRÖN = samtliga obligatoriska moduler är gröna, ingen innehållsmodul ligger under v2-miniminivån utan ett uttryckligen tillåtet och verifierat verklighetsundantag, innehållet är tillräckligt representativt och användbart, och aktuell aktiv/live data är verifierad.**

Om någon obligatorisk modul är gul eller röd ska kommunen rapporteras som **inte 100 % grön**, med exakt blockerare.

## 10. Rapportering

Slutrapporten ska visa:
- totalstatus per kommun,
- vilka moduler som är gröna/gula/röda,
- konkreta antal där miniminivåer används,
- representativitetsproblem även när minimum uppnåtts,
- exakt blockerare för varje icke-grön kommun,
- vilka kommuner som faktiskt når 100 %.

Inga tidigare statusar får användas som argument för grönt. Nuläget är facit.
