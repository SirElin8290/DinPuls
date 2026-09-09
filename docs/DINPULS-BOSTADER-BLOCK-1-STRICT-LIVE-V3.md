# DinPuls bostäder block 1 – STRICT LIVE 100 % v3

Kontrolltid: 2026-09-09. Kommuner: Karlstad, Kristinehamn och Hammarö.

## Resultat

| Kommun | Automatiserade källor | Verifierat unikt delutbud | DinPuls repo efter körning | Saknas | Coverage | Status |
|---|---:|---:|---:|---:|---:|---|
| Karlstad | 2 | 53 | 53 | Okänt; fler relevanta privata värdar återstår | Ej beräkningsbar | YELLOW – full coverage ej bevisad |
| Kristinehamn | 1 | 15 | 15 | Okänt; privata värdar återstår | Ej beräkningsbar | YELLOW – full coverage ej bevisad |
| Hammarö | 1 | 2 | 2 | Okänt; privata värdar återstår | Ej beräkningsbar | YELLOW – full coverage ej bevisad |

`Verifierat unikt delutbud` är summan efter deduplicering av de integrerade primärkällorna. Det är en verifierad undre gräns, inte kommunens fullständiga marknad, eftersom alla identifierade privata källor ännu inte har tekniskt verifierats. Ingen kommun deklareras därför GREEN.

## Nuläge före ändringen

- Karlstad hade ett manuellt, datumkodat KBAB-objekt, `Plintgatan 4 C, lgh 1101`, trots att KBAB:s publika Momentum-API gav 17 objekt. KBAB saknade parser och de privata värdarna saknades helt.
- Kristinehamn hade ett manuellt objekt från Bostadscentralen och var `official-reference`. Kristinehamnsbostäders uthyrningsportal saknade parser trots att dess publika Momentum-API gav 15 objekt.
- Hammarö hade ett statiskt supplement med ett objekt, `Skomakargränd 1`. Arbetsflödet kontrollerade bara `>= 1`, vilket lät ett uppenbart ofullständigt resultat passera. Hammaröbostäders Vitec Arena-portal gav två aktuella lägenheter vid kontrollen.
- Publicerad `https://dinpuls.se/data/housing.json` motsvarade före publicering reporesultatet ovan: 1/1/1.

## Källinventering

### Karlstad

Kommunens officiella värdlista anger att listan inte är komplett. Identifierade värdar är KBAB, Akka, Acasa, Albér, Almen 21, Balder, Campus Hills, Campus Living, Capriga, Carlstaden, CIAB, Croisette, Erna, Grava, Hammaröbostäder, Hernö, HSB, K2A, Kamelia, Karlstadshus, Klara, Lancea, Lansa, Lecab, Linstad, Lundbergs, Löfbergs, Neobo, Nyeds, PFA, Profil Invest, Riksbyggen, Rohm, SBB, Stiftelsen Karlstadshus, Steijner & Nordh, SBS, Studentvillan, Sveafastigheter, Uthyrningsportal, Wermlands Invest och Willhem.

| Källa | Typ/metod | Råantal | Pagination/total | Automatiserad | Blockerare |
|---|---|---:|---|---|---|
| Karlstads Bostads AB | Primärkälla, Momentum API | 17 | API-total 17, fullföljd | Ja | Ingen |
| Willhem | Primärkälla, publikt region-API | 36 | API returnerar hela regionlistan | Ja | Ingen |
| Övriga värdar på kommunlistan | Primärkällor | Ej fastställt | Ej fastställt | Nej | Varje värds aktuella utbud och tekniska metod måste verifieras; flera hänvisar vidare till marknadsplatser och kan överlappa |

Officiell inventering: https://karlstad.se/flytta-till-karlstadsregionen/leva-och-bo/boende-i-karlstadsregionen/bostadsbolag-och-fastighetsagare

### Kristinehamn

Kommunens officiella information identifierar Kristinehamnsbostäder, Linnés, Wiréns, Albér, Akka, Hem i Kristinehamn, Riksbyggen, Sigismund, Gayfullin, Rudskoga, Stendalen och Heden.

| Källa | Typ/metod | Råantal | Pagination/total | Automatiserad | Blockerare |
|---|---|---:|---|---|---|
| Kristinehamnsbostäder | Primärkälla, Momentum API | 15 | API-total 15, fullföljd | Ja | Ingen |
| Hem i Kristinehamn, Stendalen, Akka och övriga kommunlistade värdar | Primärkällor | Ej fastställt | Ej fastställt | Nej | Aktuellt utbud, tomt-resultat och eventuell extern marknadsplats måste verifieras per källa |
| Bostadscentralen | Sekundär aggregator, serverrenderad Next-data | 63 annonser, 24 i första strukturerade listan | Total 63; flera annonser kommer från HomeQ | Nej | Överlapp och anonymiserad provider gör den olämplig som sann primärkälla utan korskontroll |

Officiell inventering: https://www.kristinehamn.se/inflyttarservice/hyra-bostad-kristinehamn/

### Hammarö

Kommunens officiella information identifierar AB Hammaröbostäder, Boet Bostad, Per Hansson, Lamina Boltjes och Skoghalls Fastighetsförvaltning.

| Källa | Typ/metod | Råantal | Pagination/total | Automatiserad | Blockerare |
|---|---|---:|---|---|---|
| AB Hammaröbostäder | Primärkälla, Vitec Arena publikt tokenflöde | 2 | Publicerad lägenhetslista returneras komplett | Ja | Ingen |
| Boet Bostad, Per Hansson, Lamina Boltjes och Skoghalls Fastighetsförvaltning | Primärkällor | Ej fastställt | Ej fastställt | Nej | Aktuellt annonserat utbud och stabil teknisk ingång måste verifieras per värd |

Officiell inventering: https://anstalld.hammaro.se/Boendemiljo/bostader/

## Implementerad kedja

- Karlstad: KBAB och Willhem går från provider-konfiguration via gemensamma adapters till `data/housing.json` och frontendens befintliga laddning av filen.
- Kristinehamn: Kristinehamnsbostäder går via samma Momentum-adapter som KBAB.
- Hammarö: det statiska supplementet är borttaget. Den officiella portalen läses via dess publika registrerings-, validerings- och lägenhetsflöde.
- Momentum-adaptern följer `count` med offset-pagination och avbryter vid formatfel, ändrat totalantal eller ofullständig hämtning.
- Varje integrerad källa skriver provider, status, kontrolltid, råantal, fel och stale-status. Objekten har kommun, stabilt käll-ID, adress, provider, objektlänk och tillgängliga attribut.
- Arbetsflödet kräver att samtliga konfigurerade providers för de tre kommunerna har körts, är friska, inte är stale, har råantal som matchar totalen och inte ger dubbletter.

## Kvarvarande blockerare och nästa åtgärd

Alla tre kommuner är YELLOW eftersom ett fullständigt verifierat universum ännu inte kan räknas. Nästa steg är att kontrollera varje kvarvarande kommunlistad värds egen aktuella uthyrningskanal, dokumentera verifierat nollresultat där utbud saknas, bygga adapter där objekt finns och därefter deduplicera mot de nu integrerade källorna. Karlstad har flest kvarvarande värdar och högst risk för HomeQ-överlapp.

Livevärden och commit-SHA fylls i efter publicering och cachefri kontroll av `https://dinpuls.se/data/housing.json`.
