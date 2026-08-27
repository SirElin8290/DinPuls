# Säker driftsättning av admin- och företagsportalen

Admin- och företagsportalen använder samma Cloudflare Worker och D1-databas som DinPuls pushserver. Webbplatsen får inte slås över till den nya portalversionen innan Worker-koden och två hemligheter är driftsatta.

## 1. Välj nya adminuppgifter

Återanvänd inte det lösenord som tidigare låg i klientkoden. Välj ett nytt unikt lösenord på minst 16 tecken och förmedla det inte i GitHub, källkod eller chattloggar.

## 2. Lägg in Cloudflare-secrets

Kör följande från projektroten i en behörig terminal. Wrangler frågar efter värdet utan att skriva in det i Git:

```bash
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
```

Kontrollera att befintliga push-hemligheter fortfarande finns kvar. `keep_vars` är aktiverat, men VAPID-värden får inte tas bort.

## 3. Driftsätt Worker först

```bash
npm ci
npx wrangler deploy
```

Kontrollera därefter:

- `GET /health` svarar med status 200.
- `POST /portal/auth/admin` accepterar de nya adminuppgifterna.
- Ett felaktigt lösenord ger 401 och inga sessionsuppgifter.
- Åtta felaktiga försök ger tillfällig 429-spärr.

D1-tabellerna skapas av Worker vid första anropet. Företagslösenord lagras med PBKDF2-SHA-256, unik salt och 120 000 iterationer. Sessionsnycklar lagras endast som SHA-256-hash och löper ut efter åtta timmar.

## 4. Publicera webbgränssnittet

När Worker-kontrollen är godkänd kan webbgrenen slås ihop. `data/business-config.json` pekar på den befintliga Worker-adressen.

## 5. Skapa första företagskontot

Logga in på `/admin/`, skapa ett avtalsutkast och ange ett tillfälligt företagslösenord på minst 12 tecken. Skicka e-post och lösenord till företaget via separata kanaler. När avtalet markeras som aktivt visas det i företagets portal.

## Säkerhetsgränser

- Bannerfiler förhandsvisas fortfarande bara lokalt. Skarp uppladdning kräver separat R2-lagring och filskanning.
- Lösenordsåterställning sker tills vidare manuellt via DinPuls; ingen osäker automatisk e-postlänk finns.
- Portalernas tokens lagras i `sessionStorage`, inte permanent i webbläsaren.
- Verkliga avtal eller företagsuppgifter får aldrig flyttas tillbaka till `localStorage`.
