const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const sport = read('sport.html');
const leisure = read('fritid.html');
const health = read('vard.html');
const service = read('service.html');
const stage = read('sport-hub-stage48.js');

const checks = [
  [sport.includes('Idrott &amp; motion'), 'sport.html saknar Idrott & motion'],
  [sport.includes('matcher, resultat'), 'sport.html saknar match/resultat-fokus'],
  [leisure.includes('Gå till Idrott &amp; motion'), 'fritid.html saknar tydlig sportlänk'],
  [health.includes('separata modulen Idrott &amp; motion'), 'vard.html saknar modulavgränsning'],
  [service.includes('hör till Idrott &amp; motion'), 'service.html saknar modulavgränsning'],
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
