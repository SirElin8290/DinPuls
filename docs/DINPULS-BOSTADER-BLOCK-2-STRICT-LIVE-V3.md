# DinPuls bostäder Block 2 – STRICT LIVE 100 % v3

Verifierad: 2026-09-09 (Europe/Stockholm)  
Omfattning: endast Grums, Filipstad och Bengtsfors  
Regel: `DINPULS-AUDIT-RULES.md`, STRICT LIVE 100 % v3

## Metod och deduplicering

Kommunernas egna hyresvärdsförteckningar användes som källinventering. Varje tekniskt åtkomlig primär objektsida kontrollerades. Sekundära portaler användes bara för att upptäcka luckor och definierar inte ensamma totaluniversumet.

Objekt dedupliceras först med provider och stabilt provider-id/objekt-URL. Exakta korsproviderträffar dedupliceras därefter på normaliserad adress, rum, yta och hyra när minst två numeriska identitetsfält finns. Två bostäder i samma hus behålls när deras objekt-id eller lägenhetsegenskaper skiljer sig.

## Grums

### Primära och officiella källor

Kommunens [hyresvärdsförteckning](https://www.grums.se/byggabomiljo/flyttatillgrumskommun/boilagenhet.4737.html) listar GHAB samt Akka Egendom, Aktiebolaget Slottsbron, Aedix, Bo Bra, CR Fastigheter, SM Fastigheter, Maleon, J & J, Klaraborg och Sveaplan. HSB anges också som allmän sökväg.

| Provider | Läge | Adapter | Råantal | Pagination | Källhälsa |
|---|---|---:|---:|---|---|
| Grums Hyresbostäder | automatic | Momentum v2 | 4 | `count`/`offset`, 4 av 4 | ok |
| Maleon Fastigheter AB | automatic | serverrenderad list- och detaljparser | 8 | alla 8 unika detaljlänkar | ok |
| Akka Egendom | primär referens | egen intresse-/ledigtsida utan offentligt Grums-objektflöde | ej verifierbart | saknas | ej automatiserbar som objektkälla |
| SM Fastigheter | primär referens | beståndssida/intressekontakt, inget verifierbart objektflöde | ej verifierbart | saknas | ej automatiserbar som objektkälla |
| Övriga kommunlistade privata värdar | telefon, e-post eller referenssida | ingen publik aktuell objektlista | ej verifierbart | saknas | manuell kontakt krävs |

- Råobjekt: 4 + 8 = 12.
- Dubbletter: 0.
- Verifierat automatiskt universum: 12.
- Repo efter körning: 12.
- Live efter publicering: 12, GHAB 4 + Maleon 8, källstatus ok för båda.
- Sekundär kontroll upptäckte ytterligare aktuella kandidater från bland andra Akka, SM, J & J, Steijner & Nordh, Bernt Johansson och Unifly. De saknar åtkomlig primär objektsida och har därför inte importerats.
- Coverage: kan inte bevisas som 100 % så länge dessa privata kandidater inte kan verifieras mot primär källa.
- Status: **YELLOW**.
- Exakt blockerare: privata hyresvärdar publicerar aktuella objekt via kontaktväg eller externa förmedlare utan öppet stabilt primärflöde. Nästa tekniska åtgärd är ett auktoritativt API/feed från respektive värd eller ett manuellt verifierat supplement med tydlig giltighetstid.

## Filipstad

### Primära och officiella källor

Kommunens [bostads- och hyresvärdssida](https://www.filipstad.se/toppmeny/bogataochmiljo/boende/bostadertomterochmaklare.2078.html) länkar Filipstadsbostäder, Bocentrum, Hemgården, HSB, PJ Fastigheter, Strandell, Podium och kontaktvägar för ACJ Invest, Finnshyttan samt Brattfors. Fastighetsmäklarnas försäljningsobjekt räknas inte som hyresbostäder.

| Provider | Läge | Adapter | Råantal | Pagination | Källhälsa |
|---|---|---:|---:|---|---|
| Filipstadsbostäder | automatic | serverrenderad tabell | 10 | hela publicerade tabellen, 10 av 10 | ok |
| Strandell Fastigheter Värmland AB | automatic | serverrenderad ledigtsida, explicita enhetsantal | 10 | en sida; 6 tvåor + 3 treor + 1 femma | ok |
| Podium Fastigheter | automatic | serverrenderade kort + unika detaljlänkar | 3 | 3 kort och 3 detaljlänkar | ok |
| Bocentrum, Hemgården, HSB och PJ | primär referens | ingen verifierad aktuell publik hyresobjektlista för kommunen | 0 verifierade | ej tillämpligt | referens kontrollerad |
| ACJ Invest, Finnshyttan och Brattfors | telefon/e-post/PDF | ingen publik aktuell maskinläsbar objektlista | ej verifierbart | saknas | manuell kontakt krävs |

- Råobjekt: 10 + 10 + 3 = 23.
- Dubbletter: 0.
- Verifierat automatiskt universum: 23.
- Repo efter körning: 23.
- Live efter publicering: 23, Filipstadsbostäder 10 + Strandell 10 + Podium 3, källstatus ok för samtliga.
- Sekundär kontroll upptäckte tre aktuella annonser hos Bodil Warmland och andra privata kandidater. De har ingen identifierad publik primär objektsida och har inte importerats.
- Coverage: kan inte bevisas som 100 % medan kontaktbaserade privata källor och sekundärt upptäckta annonser återstår att verifiera.
- Status: **YELLOW**.
- Exakt blockerare: flera kommunlistade privata värdar saknar publikt primärflöde; tre aktuella annonser är bara verifierbara i sekundär portal. Nästa tekniska åtgärd är primärt feed/API eller tidsbegränsat manuellt supplement efter direkt verifiering.

## Bengtsfors

### Primära och officiella källor

Kommunens [hyresvärdsförteckning](https://www.bengtsfors.se/bygga-bo-och-miljo/valkommen-till-bengtsfors/hitta-bostad-i-bengtsfors-kommun/hyresvardar) listar Bengtsforshus, Billingsfors Bostäder, DANO, EP Fastigheter, Hallåsens seniorboende, Lumi, Långevi gård, Mer Hem, Orvelin, Pineskär och Tallbacken.

| Provider | Läge | Adapter | Råantal | Pagination | Källhälsa |
|---|---|---:|---:|---|---|
| Bengtsforshus | automatic | Momentum v2 | 37 | `count`/`offset`, 37 av 37 | ok |
| Övriga kommunlistade privata värdar | primär referens/kontakt | inget komplett publikt aktuellt objektflöde för kommunen | ej verifierbart | saknas | manuell kontroll krävs |

- Råobjekt: 37.
- Dubbletter: 0.
- Verifierat automatiskt universum: 37.
- Repo efter körning: 37.
- Live efter publicering: 37 från Bengtsforshus, källstatus ok.
- Sekundär kontroll upptäckte fem privata kandidater: en hos Stendalen, tre hos Hänsjön Fastigheter och en hos BBF Bostäder. De tre namnen finns inte på kommunens aktuella länklista och någon publik primär objektsida kunde inte identifieras.
- Coverage: kan inte bevisas som 100 %; sekundär kontroll indikerar minst fem möjliga saknade privata objekt.
- Status: **YELLOW**.
- Exakt blockerare: de fem privata kandidaterna saknar åtkomlig primär verifieringskälla. Nästa tekniska åtgärd är leverantörsfeed/API eller direkt verifiering och tidsbegränsat supplement.

## Aktiv kedja och kvalitetskontroller

- Filipstad flyttades från den separata launch-överskrivningen till samma gemensamma provider- och source-health-modell som Block 1.
- Nya adapters: Maleon, Strandell och Podium. Filipstadsbostäders befintliga parser återanvänds genom den gemensamma körningen.
- Momentum-adaptern verifierar rapporterat totalantal och full offset-pagination.
- Varje Block 2-provider får `provider`, `url`, `status`, `checkedAt`, `lastSuccessfulFetch`, `rawCount`, `error` och `stale`.
- Tester täcker Momentum-pagination, källfel/stale, oväntat nollresultat, Strandells explicita enhetsantal, Podiums kort/länk-konsistens och korsprovider-deduplicering utan att slå ihop skilda lägenheter.
- Workflowets strikta providerkontroll omfattar nu Grums, Filipstad och Bengtsfors och kräver att alla konfigurerade providers har körts, är friska och att råantalet stämmer med resultatet.

## Återanvändning till Block 3

Den gemensamma server-renderade list-/detaljmodellen, fullständighetskontrollen mellan kort och detaljlänkar, source-health-fälten och den försiktiga korsprovider-dedupliceringen kan återanvändas för Säffle, Munkfors och Torsby. Nya kommuner ska anslutas via `housingProviders` och en provideradapter i den gemensamma uppdateraren.

## Slutstatus efter publicering

Alla tre kommuner har mätbart förbättrad och färsk data i repo och live, men ingen får klassas GREEN enligt STRICT LIVE 100 % v3 innan privata kontakt-/sekundärkällor har primärverifierats. Aktuell status är **3 YELLOW, 0 GREEN, 0 RED**.
