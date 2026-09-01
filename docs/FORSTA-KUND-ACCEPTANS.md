# Första kund – acceptanstest

Kör först `npm run test:production-smoke`. Testet är skrivskyddat. Skapa därefter ett tydligt namngivet, kostnadsfritt TEST-avtal manuellt i admin. Radera aldrig poster automatiskt i produktion.

## A. Infrastruktur

- [ ] `/health` svarar HTTP 200
- [ ] Databas visar Ansluten
- [ ] Portal och admin/företagsauth visar Konfigurerad
- [ ] Företagsmejl visar Konfigurerat
- [ ] Bannerlagring/R2 visar Konfigurerad
- [ ] Admininloggning fungerar
- [ ] Felaktigt adminlösenord ger 401

## B. Testkund

- [ ] Företag skapas med ett tydligt TEST-namn och kostnadsfri betalningsform
- [ ] En verklig annonsplats väljs
- [ ] Upptagen plats kan inte dubbelsäljas
- [ ] Tolvmånadersperioden är korrekt
- [ ] Båda signaturerna fungerar
- [ ] Avtalet blir Aktivt
- [ ] PDF genereras och kan hämtas av admin
- [ ] Signerad PDF kommer fram via e-post

## C. Företagskonto

- [ ] Aktiveringsmejl kommer fram och länken fungerar
- [ ] Lösenord kan skapas och länken kan inte återanvändas
- [ ] Företaget kan logga in och ser endast sitt eget avtal
- [ ] Företaget kan hämta signerad PDF
- [ ] Lösenordsåterställning fungerar

## D. Banner

- [ ] Företaget ser endast avtalade platser
- [ ] PNG samt JPG/WebP fungerar
- [ ] För stor fil stoppas
- [ ] Publiceringstid och klicklänk fungerar
- [ ] Bannern visas i rätt kommun och på rätt plats
- [ ] Föregående banner ligger kvar fram till bytestid
- [ ] Ny banner tar över vid rätt tid
- [ ] Femte publicerade bytet på samma plats inom samma 30-dagarsperiod stoppas

## E. Statistik

- [ ] Visning och klick registreras
- [ ] Företagets statistik och CTR uppdateras rimligt
- [ ] Ett annat företag kan inte se statistiken

## F. Spiris

- [ ] Kopiera fakturaunderlag fungerar
- [ ] Företag, org.nr, avtalsnummer och avtalsperiod stämmer
- [ ] Annonsplatser och betalningsform stämmer
- [ ] Belopp exklusive moms och 10 dagar netto framgår

## G. Mejlkvalitet

- [ ] Aktiveringsmejl till Gmail och Outlook/Hotmail
- [ ] Signerad PDF till Gmail och Outlook/Hotmail
- [ ] Lösenordsåterställning kommer fram
- [ ] DinPuls är korrekt avsändare och länkar öppnar dinpuls.se
- [ ] PDF går att öppna
- [ ] Inga uppenbara spam- eller avsändarproblem
