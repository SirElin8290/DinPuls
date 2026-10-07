const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const sport = read('sport.html');
const leisure = read('fritid.html');
const health = read('vard.html');
const service = read('service.html');
const stage = read('sport-hub-stage48.js');

const checks = [
  [sport.includes('new URL("foreningsliv.html"'), 'Avvecklad sportsida måste leda till Föreningsliv'],
  [!sport.includes('data-strategic-ad'), 'Avvecklad sportsida får inte visa gamla annonser'],
  [leisure.includes('new URL("foreningsliv.html"'), 'Avvecklad fritidssida måste leda till Föreningsliv'],
  [health.includes('modulen Föreningsliv'), 'vard.html saknar modulavgränsning'],
  [service.includes('hör till Föreningsliv'), 'service.html saknar modulavgränsning'],
  [stage.includes('Senaste match'), 'sporthubben saknar senaste match per klubb'],
  [stage.includes('Nästa match'), 'sporthubben saknar nästa match per klubb'],
  [stage.includes('clubMatchSummary'), 'sporthubben saknar klubbcentrerad matchlogik']
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Sportmodulens avgränsning och klubbmatchlogik: OK');
