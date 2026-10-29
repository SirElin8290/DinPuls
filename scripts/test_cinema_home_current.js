const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script = fs.readFileSync('script.js','utf8');
const start = script.indexOf('function renderCinemaHome()');
const code = script.slice(start,script.indexOf('\n/*',start));
function render(films) {
  const elements = {'#cinema-home-grid':{},'#cinema-home-subtitle':{},'#cinema-home-link':{}};
  const context = {cinemaHomeData:{featuredFilms:[{title:'Old generic nationwide film'}],municipalities:{Test:[{name:'Local cinema',programUrl:'https://example.org/program',films}]}},DinPulsMunicipality:{getName:()=> 'Test'},document:{querySelector:s=>elements[s]},window:{},escapeHtml:String,escapeAttribute:String,safeExternalUrl:x=>x};
  vm.runInNewContext(code+'\nrenderCinemaHome();',context);
  return elements['#cinema-home-grid'].innerHTML;
}
const fallback = render([{title:'Undated title'},{title:'Expired screening',showtimes:['2000-01-01T12:00:00Z']}]);
assert(!fallback.includes('Old generic nationwide film'));
assert(!fallback.includes('Undated title'));
assert(!fallback.includes('Expired screening'));
assert(fallback.includes('Officiellt bioprogram')&&fallback.includes('https://example.org/program'));
assert(render([{title:'Future local screening',showtimes:['2099-01-01T12:00:00Z']}]).includes('Future local screening'));
console.log('Cinema: future local showtimes or official program, no unverified generic titles PASS');
