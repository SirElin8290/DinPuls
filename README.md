# DinPuls – Sprint 1

Den här versionen innehåller den kompletta första designsprinten:

- skarp SVG-logga
- premium-header och sökfält
- responsiv mobilmeny
- mörkt läge med sparat val
- val av favoritkommun med LocalStorage
- riktiga SVG-ikoner via Lucide
- förbättrad typografi, kort, hover-effekter och komponentstruktur
- flygplatsticker, liveklocka och demonstrationsnedräkning

## Starta
Öppna `index.html` med Live Server.

## Viktigt
Internetanslutning krävs för Google Fonts och Lucide-ikoner.

## Version 1.1
- Tog bort den bruna bakgrunden runt Nyheter, Evenemang och Kartkollen.
- Rättade en CSS-namnkonflikt mellan rutnätet `.three` och en nyhetsbild.
- Förbättrade avståndet och övergången mellan sektionerna.

## Sprint 1.2 – Mobil
- Ny mobilheader med kompakt logga och sökfält.
- Mobilmeny som öppnas från menyknappen.
- Ticker anpassad för små skärmar.
- Hero och Dagens viktigaste ombyggda för mobil.
- Alla kort staplas i en kolumn.
- Tjänster visas i två kolumner.
- Jobb, bostäder, annonser och footer är mobilanpassade.

## Sprint 2 – SMHI-väder

Väderkortet hämtar nu automatiskt punktprognoser från SMHI:s SNOW1G API.

Det visar:
- temperatur
- väderbeskrivning och symbol
- dagens högsta och lägsta temperatur
- vindhastighet
- luftfuktighet
- nederbörd
- fyra kommande prognostider
- när prognosen uppdaterades

Vädret följer den kommun som väljs i kommunväljaren. Data uppdateras var
trettionde minut.

Källa anges i väderkortet.

## Sprint 2.1 – Kommunval

Användaren kan nu välja mellan:
- Åmål
- Säffle
- Bengtsfors
- Mellerud
- Årjäng
- Grums
- Arvika

Valet sparas i webbläsaren och ändrar:
- väderdata och väderplats
- kommunnamn i headern
- kommunnamn i hero-sektionen
- trafik-, buss-, drivmedels-, nyhets-, evenemangs-, kart-, jobb- och bostadsrubriker
- sidans webbläsartitel

En tydlig informationsrad förklarar att endast vädret är live ännu och att
övrigt innehåll tills vidare är demonstrationsdata.
