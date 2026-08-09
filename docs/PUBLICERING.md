# Publicering och återställning

## Före publicering

1. Kontrollera `git status` och att bara avsedda filer är ändrade.
2. Granska ändringarna med `git diff` och `git diff --check`.
3. Kör samtliga JavaScript-, Python- och lanseringstester enligt den tekniska handboken.
4. Starta en lokal webbserver och prova den berörda funktionen.
5. Vid designändring: kontrollera ljust/mörkt läge samt laptop/mobil.
6. Höj och synkronisera webbversionen om cachade resurser har ändrats.

## Publicera

Publicering sker genom en granskad commit till `main`. GitHub Pages bygger därefter dinpuls.se automatiskt. Publicera inte en ofullständig filgrupp: HTML, CSS, JavaScript, komponenter, tester och versionsändringar som hör ihop ska ligga i samma commit.

Efter publicering:

1. kontrollera att arbetsflödet **Kontrollera DinPuls** är godkänt,
2. öppna `https://dinpuls.se/?verify=VERSION`,
3. bekräfta att `data-version` motsvarar den publicerade versionen,
4. kontrollera startsida, berörd undersida och kommunbyte,
5. kontrollera konsolen efter nya fel,
6. kontrollera att inga komponentplatser är tomma.

## Återställ vid fel

Om en publicering orsakar ett allvarligt fel ska den felaktiga ändringen återställas med en ny revert-commit. Historiken ska bevaras; skriv inte över `main` och använd inte en tvingad uppdatering.

```bash
git revert <commit-id>
```

Kör testerna på återställningen och publicera revert-commiten. Verifiera sedan den skarpa sidan igen. Om felet bara gäller automatiskt uppdaterad data ska senaste kända fungerande JSON-data återställas utan att rulla tillbaka orelaterad kod.

## Akut prioritering

Återställ omedelbart vid:

- vit eller tom sida,
- JavaScript-fel som hindrar sidstart,
- fel kommuninformation,
- osäkra länkar eller osanerad extern text,
- exponerad hemlighet,
- trasig navigation till samhällsviktig information.

Mindre visuella fel dokumenteras och rättas i en separat, testad commit om sidan i övrigt fungerar säkert.
