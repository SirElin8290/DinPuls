# Säker driftsättning av admin- och företagsportalen

Admin- och företagsportalen använder samma Cloudflare Worker och D1-databas som DinPuls pushserver. Webbplatsen får inte slås över till den nya portalversionen innan Worker-koden och e-postinställningarna är driftsatta.

## 1. Välj nya adminuppgifter

Återanvänd inte det lösenord som tidigare låg i klientkoden. Välj ett nytt unikt lösenord på minst 16 tecken och förmedla det inte i GitHub, källkod eller chattloggar.

## 2. Lägg in Cloudflare-secrets

Kör följande från projektroten i en behörig terminal. Wrangler frågar efter värdet utan att skriva in det i Git:

```bash
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put PORTAL_PASSWORD_PEPPER
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put PORTAL_EMAIL_FROM
```

`PORTAL_EMAIL_FROM` ska innehålla hela avsändaren, exempelvis `DinPuls <foretag@dinpuls.se>`. Lägg inte något av värdena i GitHub, JavaScript eller `wrangler.jsonc`.

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
- `npm run test:banner` godkänner onboarding, engångstoken, återställning, inloggning, R2-uppladdning, tidsstyrt byte, bildhämtning och statistik lokalt.

D1-tabellerna skapas av Worker vid första anropet. Företagslösenord lagras som saltad HMAC-SHA-256 med en separat hemlig servernyckel (`PORTAL_PASSWORD_PEPPER`). Det skyddar lösenorden vid en fristående D1-läcka och ryms inom Workers CPU-budget. Sessionsnycklar lagras endast som SHA-256-hash och löper ut efter åtta timmar.

## 4. Publicera webbgränssnittet

När Worker-kontrollen är godkänd kan webbgrenen slås ihop. `data/business-config.json` pekar på den befintliga Worker-adressen.

## 5. Verifiera dinpuls.se hos Resend

1. Lägg till domänen `dinpuls.se` i Resend.
2. Lägg in de SPF- och DKIM-poster som Resend visar i Cloudflare DNS, exakt med de namn och värden Resend anger.
3. Vänta tills Resend visar domänen som verifierad.
4. Skapa en API-nyckel i Resend med behörighet att skicka från domänen och lägg den i `RESEND_API_KEY`.
5. Sätt `PORTAL_EMAIL_FROM`, till exempel `DinPuls <foretag@dinpuls.se>`.
6. Driftsätt om Worker och kontrollera att `/health` visar `portalEmailConfigured: true`.

## 6. Skapa första företagskontot

Logga in på `/admin/` och skapa ett avtalsutkast. Admin anger inget lösenord. När avtalet för första gången markeras som `Aktivt` skapas en engångslänk och välkomstmejlet skickas automatiskt. Länken gäller i 48 timmar. Företaget väljer ett lösenord med minst 12 tecken, stor bokstav, liten bokstav och siffra, och kan därefter logga in normalt.

Om leveransen misslyckas eller länken går ut finns knappen `Skicka ny aktiveringslänk` i det aktiva avtalet. Varje ny länk gör tidigare oanvända länkar ogiltiga. En vanlig statusredigering skickar aldrig ett andra välkomstmejl.

Avtal kan vara ordinarie betalande eller kostnadsfria. Båda har samma 12-månadersperiod, portal, statistik och annonsbyten. För kostnadsfria avtal väljs `Kostnadsfri plats`, faktisk debitering blir 0 kr och ordinarie värde kan anges i avtalsnoteringen. Om signatur inte krävs kan utkastet aktiveras direkt. `Årlig förnyelseprövning` innebär att avtalet hanteras på nytt efter periodens slut; det är inte en automatisk debitering.

## Säkerhetsgränser

- Bannerfiler lagras privat i R2-bucketen `dinpuls-ad-assets` och levereras endast genom Worker-rutten `/ads/assets/:id`. Worker verifierar filstorlek, deklarerad bildtyp och filsignatur för PNG, JPG och WebP före lagring.
- Aktiverings- och återställningstoken lagras endast som SHA-256-hash, gäller i 48 timmar och kan användas exakt en gång.
- Lösenordsåterställningen svarar likadant oavsett om e-postadressen finns och begränsar upprepade försök.
- Portalernas tokens lagras i `sessionStorage`, inte permanent i webbläsaren.
- Verkliga avtal eller företagsuppgifter får aldrig flyttas tillbaka till `localStorage`.
