const assert=require('assert'),fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const names=['Åmål','Årjäng','Bengtsfors','Mellerud','Arvika','Grums','Säffle','Dals-Ed','Eda','Filipstad','Forshaga','Färgelanda','Hagfors','Hammarö','Karlstad','Kil','Kristinehamn','Munkfors','Storfors','Sunne','Torsby'];
const data=JSON.parse(fs.readFileSync(path.join(root,'data/school-family.json'),'utf8')),engine=fs.readFileSync(path.join(root,'school-family-engine.js'),'utf8'),page=fs.readFileSync(path.join(root,'school-family-page.js'),'utf8');
assert.deepStrictEqual(Object.keys(data.municipalities).sort(),names.slice().sort(),'Exakt 21 kommuner krävs');
assert(engine.indexOf('new URLSearchParams(location.search).get("kommun")')<engine.indexOf('DinPulsMunicipality?.getName'),'Explicit URL måste ha högst prioritet');
assert(page.includes('params.get("kommun")||window.DinPulsMunicipalityState'),'Undersidan måste prioritera explicit URL');
let meals=0,calendar=0; const results=[];
for(const name of names){const item=data.municipalities[name]; assert(item&&item.mealSource?.url&&item.calendarSource?.url,`${name}: källor saknas`); const mp=item.meals.length>0&&item.meals.every(m=>m.municipality===name); const cp=item.calendar.length>0; if(mp)meals++;if(cp)calendar++; assert(item.meals.every(m=>m.options.every(o=>!/(?:20\d{2}-\d{2}-\d{2})[ T]\d{2}:\d{2}/.test(o.meal))),`${name}: tidsstämpel i maträtt`); results.push(`${name}\tSKOLMAT:${mp?'PASS':'BLOCKED'}\tKALENDER:${cp?'PASS':'BLOCKED'}\tFEL KOMMUN-DATA:NEJ`)}
console.log(results.join('\n')); console.log(`TOTALT skolmat ${meals}/21, kalender ${calendar}/21`);
