# Teknisk handbok för DinPuls

Den här handboken beskriver den publicerade strukturen i DinPuls 0.23.4. Målet är att en ny utvecklare ska kunna förstå projektet, göra en säker ändring och kontrollera den utan muntlig överlämning.

## Teknisk grund

DinPuls är en statisk webbplats byggd med HTML, CSS och JavaScript. GitHub Pages publicerar innehållet från `main`. Python-skript och GitHub Actions uppdaterar JSON-filerna som webbplatsens moduler läser. Ingen byggprocess krävs för själva webbplatsen.

Sidan ska köras via en lokal webbserver. Direktöppning med `file://` fungerar inte eftersom komponenter och data hämtas med `fetch`.

```bash
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000/`.

## Projektets struktur

| Sökväg | Ansvar |
|---|---|
| `index.html` | Startsida, komponentplatser och ordning för JavaScript-filer |
| `components/` | Återanvändbara delar som laddas in på startsidan |
| `script.js` | Startsidans initiering och modulsamordning |
| `dp-safety.js` | Central sanering av HTML, attribut, länkar och ikonvärden |
| `dp-core.js` | Gemensamma stabila hjälpfunktioner för datum, text och tal |
| `municipality-engine.js` | Val, lagring och URL-hantering för kommun |
| `*-page.js` och `portal-pages.js` | Logik för undersidor |
| `styles.css` | Gemensam design, teman och startsidans responsiva regler |
| `portal-pages.css` | Gemensam design för undersidor |
| `data/` | Publicerad, kommunindelad JSON-data |
| `scripts/update_*.py` | Hämtning och normalisering av extern data |
| `scripts/test_*` | Enhets- och kontraktstester |
| `scripts/validate_launch.py` | Samlad lanseringskontroll |
| `.github/workflows/` | Automatiska tester och datauppdateringar |

## Laddningsordning på startsidan

Ordningen i `index.html` är ett kontrakt och får inte ändras utan test:

1. lokal Lucide-fil,
2. `dp-safety.js`,
3. `dp-core.js`,
4. `municipality-engine.js`,
5. `sport-data-engine.js`,
6. `script.js`,
7. `privacy-controls.js`.

Säkerhetsmodulen måste finnas före kärnmodulen. Kärnmodulen måste finnas före `script.js`. `scripts/validate_launch.py` kontrollerar ordningen automatiskt.

## Kommunmotorn

De sju startkommunerna definieras centralt i `data/municipalities.json`:

- Åmål
- Säffle
- Bengtsfors
- Mellerud
- Årjäng
- Arvika
- Grums

En modul ska läsa aktiv kommun från kommunmotorn och reagera på kommunbyte. Kommunnamn eller kommunspecifika värden ska inte hårdkodas i en generell modul. Alla kommunindelade datafiler måste innehålla exakt samma sju kommuner i samma ordning.

## Säkerhetsregler

- Text från JSON eller externa källor ska sättas med `textContent` eller saneras med funktionerna i `dp-safety.js`.
- Externa länkar ska gå genom `safeExternalUrl`; interna länkar genom `safeHref` när värdet inte är statiskt.
- HTML-attribut som byggs från data ska saneras med `escapeAttribute`.
- En ny ikon ska finnas i den lokala Lucide-filen och passera ikonvalideringen.
- Hemligheter och API-nycklar får bara ligga i GitHub Secrets, aldrig i HTML, JavaScript, JSON, loggar eller dokumentation.
- Externa länkar som öppnas i ny flik ska använda `rel="noopener noreferrer"`.

## CSS och responsivitet

Färger och återkommande mått ska använda variablerna i `:root` i `styles.css`. Lägg inte in nya nästan identiska färgvärden om en befintlig designvariabel har samma funktion.

Varje synlig ändring ska kontrolleras i:

- ljust och mörkt läge,
- laptopbredd,
- mobilbredd,
- minst en lång svensk text,
- tangentbordsfokus.

Undvik fasta bredder på textfält och moduler. Använd `min-width: 0`, flexibla kolumner och kontrollerad radbrytning när innehåll kan bli längre än förväntat.

## Datauppdateringar

Varje `scripts/update_*.py` ansvarar för att hämta, verifiera och normalisera en datatyp. Grundregler:

1. behåll senast fungerande data om en källa tillfälligt misslyckas,
2. publicera aldrig demodata som aktuell information,
3. blanda aldrig information mellan kommuner,
4. logga fel utan hemligheter eller personuppgifter,
5. skriv bara filen när den nya datan har klarat kontrollen.

De schemalagda arbetsflödena finns i `.github/workflows/`. Arbetsflödet `Kontrollera DinPuls` kör webbplatsens tester vid varje uppdatering av `main`.

## Testa en ändring

Kör hela kontrollen från projektroten:

```bash
for file in *.js scripts/*.js; do node --check "$file"; done
for test in scripts/test_*.js; do node "$test"; done
for test in scripts/test_*.py; do python3 "$test"; done
python3 scripts/validate_launch.py
git diff --check
```

En ändring får inte publiceras om något kommando misslyckas. Testa dessutom den berörda funktionen manuellt i lokal webbserver. En visuell ändring kräver kontroll i både ljust och mörkt läge samt på laptop och mobil.

## Versionshantering

Den aktiva webbversionen finns på följande platser och ska hållas synkroniserad när webbläsarcachade resurser ändras:

- `data-version` och metataggen i `index.html`,
- resursfrågorna `?version=` i aktiva HTML- och komponentfiler,
- `DINPULS_VERSION` i `script.js`,
- `VERSION` i `scripts/validate_launch.py`.

Dokumentationsändringar behöver inte ensamma höja webbversionen. Ändringar i HTML, CSS, JavaScript, komponenter eller bilder ska få ett nytt semantiskt versionsnummer.

## Definition av färdig

En ändring är färdig först när:

- problemet går att beskriva och den avsedda lösningen är avgränsad,
- koden använder befintliga gemensamma moduler där det är möjligt,
- relevanta tester har lagts till eller uppdaterats,
- hela testsviten är grön,
- sidan är manuellt kontrollerad i berörda lägen och bredder,
- versionsnummer är synkroniserade när cachade resurser ändrats,
- ändringen är dokumenterad om den påverkar struktur eller drift,
- produktionen visar rätt version utan nya konsolfel.

## Ansvarsgränser

`script.js` ska samordna startsidan, inte bli en ny samlingsplats för generella hjälpfunktioner. Stabil och återanvändbar logik hör i första hand hemma i `dp-core.js`; säkerhetslogik i `dp-safety.js`; kommunlogik i `municipality-engine.js`; och undersidespecifik logik i respektive sidfil.

När en fil blir svår att förstå ska funktionerna delas efter ansvar, med oförändrat beteende och tester som skyddar gränssnitten. Stora omskrivningar och nya funktioner ska inte blandas i samma publicering.
