const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const publicPages = [
  'index.html', 'bostader.html', 'jobb.html', 'vard.html', 'service.html',
  'fritid.html', 'sport.html', 'evenemang.html', 'bio.html', 'lunch.html',
  'trafik.html', 'drivmedel.html', 'matkasse.html', 'myndigheter.html',
  'nyheter.html', 'information.html', 'foretag/index.html', 'admin/index.html'
];

for (const file of publicPages) {
  const html = read(file);
  assert(
    /<meta\s+name=["']viewport["'][^>]*width=device-width/i.test(html),
    `${file}: saknar mobil viewport-meta`
  );
}

const portal = read('portal-pages.css');
assert(portal.includes('@media(max-width:620px)'), 'Portal: saknar mobil breakpoint');
assert(portal.includes('.portal-layout{grid-template-columns:1fr}'), 'Portal: layout faller inte till en kolumn');
assert(portal.includes('.portal-toolbar,.portal-toolbar.two{grid-template-columns:1fr}'), 'Portal: verktygsfält faller inte till en kolumn');
assert(portal.includes('.portal-source-button{grid-column:1/-1}'), 'Portal: källknapp saknar mobil helbredd');

const company = read('foretag/foretag.css');
assert(company.includes('html,body{max-width:100%;overflow-x:hidden}'), 'Företagsportal: saknar skydd mot sidoverflow på mobil');
assert(company.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), 'Företagsportal: mobil navigation saknar 2x2-layout');
assert(company.includes('.workspace{width:100%;padding:0 10px 24px;overflow:hidden}'), 'Företagsportal: workspace saknar mobil overflow-skydd');
assert(company.includes('.banner-row>*{min-width:0}'), 'Företagsportal: bannerinnehåll kan tvinga grid bredare än viewport');

const scheduler = read('foretag/banner-scheduler.css');
assert(scheduler.includes('@media(max-width:700px)'), 'Bannerplanerare: saknar mobil breakpoint');
assert(scheduler.includes('.schedule-fields,.simple-steps{grid-template-columns:1fr}'), 'Bannerplanerare: formulär faller inte till en kolumn');

const health = read('health-page.css');
assert(health.includes('column-count: 3'), 'Vård: desktop ska ha tre kategorikolumner');
assert(health.includes('column-count: 2'), 'Vård: tablet ska ha två kategorikolumner');
assert(health.includes('column-count: 1'), 'Vård: mobil ska ha en kategorikolumn');
assert(health.includes('break-inside: avoid'), 'Vård: kategorier får inte brytas mellan kolumner');

const service = read('service-page.css');
assert(service.includes('column-count: 3'), 'Service: desktop ska ha tre kategorikolumner');
assert(service.includes('column-count: 2'), 'Service: tablet ska ha två kategorikolumner');
assert(service.includes('column-count: 1'), 'Service: mobil ska ha en kategorikolumn');
assert(service.includes('break-inside: avoid'), 'Service: kategorier får inte brytas mellan kolumner');

const leisure = read('leisure-layout-fix.css');
assert(leisure.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), 'Fritid: annonser ska ligga två i bredd på desktop');
assert(leisure.includes('@media(max-width:800px)'), 'Fritid: saknar mobil/tablet breakpoint');
assert(leisure.includes('.leisure-ad-row{grid-template-columns:1fr'), 'Fritid: annonser ska staplas på mindre skärmar');

const sport = read('sport-hub-fixes.css');
assert(sport.includes('@media (max-width: 720px)'), 'Sport: saknar mobil breakpoint');
assert(sport.includes('.activity-club-form {\n    grid-template-columns: 1fr;'), 'Sport: klubbdata faller inte till en kolumn på mobil');
assert(sport.includes('.activity-matches article {\n    grid-template-columns: 1fr auto;'), 'Sport: matchrad saknar mobil layout');

const home = read('styles.css');
assert(home.includes('.mobile-menu-button{display:none}'), 'Startsida: mobil menyknapp saknas');
assert(home.includes('.main-nav.open{display:flex}'), 'Startsida: mobil navigation saknar öppet läge');
assert(home.includes('@media(max-width:520px)'), 'Startsida: saknar smal mobil breakpoint');

console.log(`✓ Responsiv layoutkontrakt kontrollerat för ${publicPages.length} sidor och centrala moduler`);
