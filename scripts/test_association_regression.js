const fs = require('fs');
const assert = require('assert');

const leisure = JSON.parse(fs.readFileSync('data/leisure.json', 'utf8'));
const sports = JSON.parse(fs.readFileSync('data/sports.json', 'utf8'));
const municipalities = JSON.parse(fs.readFileSync('data/municipalities.json', 'utf8')).municipalities.map(item => item.name);

for (const name of municipalities) {
  assert(leisure.municipalities?.[name], `Fritid saknar kommun: ${name}`);
  assert(sports.municipalities?.[name], `Sport saknar kommun: ${name}`);
}

const amalLeisure = leisure.municipalities?.['Åmål']?.activities || [];
assert(!amalLeisure.some(item => /airsoft/i.test(item.name || '')), 'Åmål Airsoftförening får inte hamna i Fritid');

const literature = amalLeisure.find(item => item.name === 'Dalslands Litteraturförening');
assert(literature?.description, 'Verifierad rik fritidsdata får inte skrivas över av rå föreningsimport');

console.log(`Föreningsregressionstest OK för ${municipalities.length} kommuner`);
