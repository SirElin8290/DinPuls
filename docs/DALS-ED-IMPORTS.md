# Dals-Ed imports — checked 2026-09-03

Started from main `4bf795a11796705be46498846984996690aa9cbc`.
The municipal events adapter and its regular workflow already existed; these are extended, not replaced.

## Housing

Edshus links to https://bostad.edshus.se/properties from https://edshus.se/.
Its public Hogia frontend uses `POST /homeinfo/filter` on the API configured in
`data/housing-launch-sources.json`. Request: `filter: {}`, `pageSize: 100`,
`pageNumber: 1` (then following pages). The Origin and Referer identify Edshus.
No account or secret is required. Category 0 is Dwelling; other categories are excluded.
Map public id, header, searchTags, numberOfRooms, squareMeters, monthlyRent.amount,
vacantFrom and `/properties/p/{id}`. Old availability dates are not expiry dates:
the object remains advertised by the landlord. Do not infer withdrawal from them.

Validated 24 unique apartments. `totalResults: 0` with an empty items array is
a valid empty inventory. Missing schema or incomplete pagination is an error.
The final launch-import step owns this source, preventing the reference fallback
from clearing the imported apartments. Existing source-health reporting is retained.

## Events and cinema

Calendar: https://www.dalsed.se/evenemang/ (41 current/future occurrences at verification).
Keep each card's dates, title and direct link together. Official detail-page map links
provide locations where available; otherwise retain municipality-level location.
Unknown markup is an error, not a successful empty list. An empty calendar without
cards must also have an empty official RSS feed before it is accepted.
All-expired, correctly parsed cards are a legitimate empty future programme.

Svea programme: https://www.dalsed.se/om-webbplatsen/prenumerera/bio-rss/.
This specific feed's pubDate represents performance time in UTC (confirmed against
the official Paw Patrol detail page: 14:30 UTC = 16:30 Swedish summer time).
Group by direct link, deduplicate performances and convert to Europe/Stockholm.
Four films/five performances verified. A failed fetch clears Svea's films and marks
the source unavailable; the official programme link remains. Existing client filtering
of structured showtimes also hides expired films between scheduled runs.

## Lunch

The six existing references are retained; no menus are guessed:

- Local Idiot: official website explicitly directs current menus to Facebook/telephone.
- V8 Garagebar: official destination listing directs menus to Facebook.
- Eds Bowlinghall: destination listing exists; linked official site timed out.
- Ed's Restaurang: website reachable, but no dated weekly lunch text verified.
- Smör & Socker: destination listing links Facebook, not a machine-readable dated menu.
- Kanyas: https://thairestaurangen.se/dagens-lunch/ is reachable and recently modified,
  but contains no readable weekly dishes/dates in its text. Modification date alone
  is not sufficient proof of a current menu. No OCR or speculative import added.

## Verification

`PYTHONPATH=scripts python -m unittest scripts/test_dals_ed_imports.py scripts/test_update_cinemas.py scripts/test_update_housing.py scripts/test_update_housing_launch.py scripts/test_update_events.py`

23 tests passed locally. All three existing relevant workflows run the new tests.
No SSL bypass, credentials, UI rebuild or other municipality content changes.
