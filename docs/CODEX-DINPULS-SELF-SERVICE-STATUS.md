# DinPuls självservice: tekniskt förarbete och beslut före aktivering

Det befintliga systemet har ett företagsregister (`business_users`), engångstoken,
Resend-aktiveringsmejl, företagsinloggning, en v4.1-avtalsmodell (`ad_contracts`),
central annonsinventering (`admin/ad-inventory.js`), D1-skydd för överlappande
avtal, R2-arkiv för signerade PDF:er och banners samt en företagsportal.
Detta arbete återanvänder dessa delar. Ingen skarp fakturering aktiveras.

## Redan byggt

- Självregistrering skriver i `business_users` med `registration_source=self-service`,
  registrerad adress och kontaktuppgifter. Kontot är inaktivt tills befintligt
  engångstoken- och lösenordsflöde har genomförts. Samma e-postsystem används.
- Organisationsnummer normaliseras och kontrolleras formellt (tio siffror,
  tredje siffran minst två, kontrollsiffra). Detta bevisar inte förekomst i
  företagsregister eller behörighet att företräda företaget. Ingen extern
  företagsverifiering finns konfigurerad.
- En autentiserad läs-API-vy kan visa verkligt lediga annonsplatser för vald
  kommun och exakt tolvmånadersperiod. Servern använder samma inventering
  som admin och kontrollerar aktiva D1-reservationer samt äldre aktiva avtal.
- En förberedd platsväljare har begriplig sid-/block-/platsbeskrivning,
  schematisk "Visa placering", flera kommuner i sammanställningen och
  prisöversikt för 500 kr/månad respektive 5 000 kr/år exkl. moms samt 25 % moms.
  Vyn slutför ännu inte köp.
- Ett isolerat, leverantörsneutralt fakturaunderlag kan grupperas över flera
  köp med olika startdatum. `cloudflare/spiris-adapter.js` gör inga nätanrop.

## Aktivering är avsiktligt spärrad

`SELF_SERVICE_SIGNUP_ENABLED` och `SELF_SERVICE_PURCHASE_ENABLED` är båda
avstängda som standard. `SPIRIS_ENABLED` är hårt avstängt. Inga nya kunder
registreras och inga köp görs via det publika flödet innan nedanstående
beslut och återstående backend är färdiga och testade. Inga fakturor skickas.

## Beslut och arbete som återstår

1. **Grundavtal:** v4.1 punkt 1 säger att avtalet *endast* omfattar de
   annonsplatser, den period och de villkor som framgår av det individuella
   avtalet. Punkt 6 kräver att ändrat antal platser dokumenteras i ett nytt
   avtal eller ny skriftlig överenskommelse. Punkt 7 kräver båda parters
   godkännande av väsentliga ändringar, dokumenterat skriftligen. Ägaren
   behöver besluta om den uttryckliga köpbekräftelsen med beständigt
   orderunderlag är en sådan skriftlig överenskommelse, eller om ett separat
   tilläggsavtal krävs. Ändra inte villkoren tyst.
2. **Första signeringen:** befintlig Worker tillåter signering endast för
   admin och kräver två ritade signaturer, kundens och DinPuls företrädares.
   Ägaren behöver besluta hur DinPuls får signera i ett självserviceflöde.
   En lagrad eller påhittad DinPuls-signatur får inte användas utan beslut.
3. **Bindande order:** implementera serverstyrd varukorg, tidsbegränsade
   D1-reservationer, atomisk checkout, beständig order-/purchasepost per
   kommun och plats, status för väntan på lansering samt portalvy för alla
   köp. Nuvarande läs-API och klientöversikt är inte bevis på ledighet vid
   checkout. `SELF_SERVICE_PURCHASE_ENABLED` får inte slås på före detta.
4. **Flera kommuner:** dagens individuella `ad_contracts`-rad har en enda
   `municipality`. Det krävs ett beslutat avtalssnapshot som omfattar
   flera kommuner utan att skapa flera grundavtal.
5. **Fakturering:** D1-status, externa ID:n och idempotensnycklar måste
   kopplas till framtida beständiga purchaseposter innan Spiris-adaptern
   får göra ett enda API-anrop. Kommunernas startdatum får inte klumpas ihop.
6. **Bannergranskning:** nuvarande portal hanterar uppladdning och
   schemaläggning och D1 begränsar publicerade byten till fyra per plats
   och 30-dagarsperiod. Separat granskningsstatus/adminbeslut är inte
   implementerat här och ska inte blandas in i köpaktiveringen.

## Spiris officiella underlag

Spiris/Bookkeeping & Invoicing API använder OAuth2. Partnerregistrering ger
klientuppgifter och en sandboxkund; produktion kräver senare kontakt med
API-support. Begär minst `ea:api`, `offline_access` och relevant `ea:sales`.
API v2 har kunder, fakturautkast och fakturor. Innan liveintegration krävs
partneravtal, client ID/secret, registrerad redirect URI, OAuth-samtycke till
DinPuls bokföringsföretag, säker tokenlagring, verifierad artikel-/momsmodell,
API-behörighet och ett ägarbeslut om skarp fakturering. Inga sådana uppgifter
finns i koden.

- [Officiell startguide](https://developer.vismaonline.com/docs/spiris-eaccounting-api-documentation)
- [Officiell OAuth-guide](https://developer.vismaonline.com/docs/authentication)
- [Officiella miljöer](https://developer.vismaonline.com/docs/environments)
- [Officiell API v2-referens](https://eaccountingapi.vismaonline.com/scalar/v2)

## D1-ändring

`migrations/0001_self_service_account.sql` beskriver fyra bakåtkompatibla
kolumner och ett unikt index för nya självregistrerade organisationsnummer.
Worker-koden använder redan PRAGMA-baserade uppgraderingar och lägger till
kolumnerna om de saknas. Kör inte SQL-filen en andra gång efter att samma
uppgradering redan har skett.
