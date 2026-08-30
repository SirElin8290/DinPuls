# Säker driftsättning av admin- och företagsportalen

Admin- och företagsportalen använder samma Cloudflare Worker och D1-databas som DinPuls pushserver. Webbplatsen får inte slås över till den nya portalversionen innan Worker-koden och två hemligheter är driftsatta.

## 1. Välj nya adminuppgifter

Återanvänd inte det lösenord som tidigare låg i klientkoden. Välj ett nytt unikt lösenord på minst 16 tecken och förmedla det inte i GitHub, källkod eller chattloggar.

## 2. Lägg in Cloudflare-secrets

Kör följande från projektroten i en behörig terminal. Wrangler frågar efter värdet utan att skriva in det i Git:

```bash
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put PORTAL_PASSWORD_PEPPER
```

Kontrollera att befintliga push-hemligheter fortfarande finns kvar. `keep_vars` är aktiverat, men VAPID-värden får inte tas bort.

## 3. Driftsätt Worker först

Kontrollera först att R2-bucketen `dinpuls-ad-assets` finns i samma Cloudflare-konto. Worker-konfigurationen binder den som `AD_ASSETS`; byt inte bindingnamnet eftersom både uppladdning och bildvisning använder det.

```bash
npm ci
npx wrangler deploy
```

Kontrollera därefter:

- `GET /health` svarar med status 200.
- `POST /portal/auth/admin` accepterar de nya adminuppgifterna.
- Ett felaktigt lösenord ger 401 och inga sessionsuppgifter.
- Åtta felaktiga försök ger tillfällig 429-spärr.
- `GET /ads/current/SERV-01?municipality=%C3%85rj%C3%A4ng` svarar med status 200 (bannern kan vara `null` innan material har laddats upp).
- `npm run test:banner` godkänner R2-uppladdning, tidsstyrt byte, bibehållen gammal banner, bildhämtning, klicklänk, visningar, klick och CTR lokalt.

D1-tabellerna skapas av Worker vid första anropet. Företagslösenord lagras som saltad HMAC-SHA-256 med en separat hemlig servernyckel (`PORTAL_PASSWORD_PEPPER`). Det skyddar lösenorden vid en fristående D1-läcka och ryms inom Workers CPU-budget. Sessionsnycklar lagras endast som SHA-256-hash och löper ut efter åtta timmar.

## 4. Publicera webbgränssnittet

När Worker-kontrollen är godkänd kan webbgrenen slås ihop. `data/business-config.json` pekar på den befintliga Worker-adressen.

## 5. Skapa första företagskontot

Logga in på `/admin/`, skapa ett avtalsutkast och skriv företagslösenordet direkt i lösenordsfältet. Lösenordet måste ha minst 12 tecken och skickas till Worker över HTTPS; endast saltad PBKDF2-hash lagras i D1. När avtalet markeras som aktivt visas det i företagets portal.

Avtal kan vara ordinarie betalande eller kostnadsfria. Båda har samma 12-månadersperiod, portal, statistik och annonsbyten. För kostnadsfria avtal väljs `Kostnadsfri plats`, faktisk debitering blir 0 kr och ordinarie värde kan anges i avtalsnoteringen. Om signatur inte krävs kan utkastet aktiveras direkt. `Årlig förnyelseprövning` innebär att avtalet hanteras på nytt efter periodens slut; det är inte en automatisk debitering.

## Säkerhetsgränser

- Bannerfiler lagras privat i R2-bucketen `dinpuls-ad-assets` och levereras endast genom Worker-rutten `/ads/assets/:id`. Worker verifierar filstorlek, deklarerad bildtyp och filsignatur för PNG, JPG och WebP före lagring.
- Lösenordsåterställning sker tills vidare manuellt via DinPuls; ingen osäker automatisk e-postlänk finns.
- Portalernas tokens lagras i `sessionStorage`, inte permanent i webbläsaren.
- Verkliga avtal eller företagsuppgifter får aldrig flyttas tillbaka till `localStorage`.
