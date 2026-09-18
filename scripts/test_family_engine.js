const assert=require("assert"),fs=require("fs"),path=require("path"),root=path.resolve(__dirname,"..");
const data=JSON.parse(fs.readFileSync(path.join(root,"data/family-places.json"),"utf8")),engine=fs.readFileSync(path.join(root,"family-engine.js"),"utf8"),page=fs.readFileSync(path.join(root,"family-page.js"),"utf8"),html=fs.readFileSync(path.join(root,"skola-familj.html"),"utf8"),css=fs.readFileSync(path.join(root,"school-family.css"),"utf8"),home=fs.readFileSync(path.join(root,"components/primary-cards.html"),"utf8");
assert(Array.isArray(data.categories)&&data.categories.length>=15,"Familjekategorier ska ligga i data/config");
assert.deepStrictEqual(Object.keys(data.municipalities),["Åmål"],"Endast Åmål ska lanseras i detta steg");
const amal=data.municipalities["Åmål"],places=amal.places;assert(places.length===9,"Åmåls referensdataset ska innehålla nio verifierade platser");
const categoryIds=new Set(data.categories.map(item=>item.id)),ids=new Set();
for(const place of places){assert(!ids.has(place.id),`Duplicerat plats-id: ${place.id}`);ids.add(place.id);assert.strictEqual(place.municipality,"Åmål");assert(Number.isFinite(place.coordinates.latitude)&&Number.isFinite(place.coordinates.longitude),`${place.name}: koordinater saknas`);assert(place.categories.length&&place.categories.every(id=>categoryIds.has(id)),`${place.name}: okänd kategori`);assert(place.source?.url===place.primaryUrl&&/^https:\/\//.test(place.source.url),`${place.name}: spårbar primärkälla saknas`);assert.strictEqual(place.verificationStatus,"verified",`${place.name}: ej verifierad`)}
assert(places.some(place=>place.categories.length>=4),"En fysisk plats ska kunna ha flera kategorier utan duplicering");
assert(engine.includes("payload.municipalities?.[name]||null"),"Familjemotorn måste slå upp vald kommun utan Åmål-datafallback");
assert(engine.includes("new URLSearchParams(location.search).get(\"kommun\")"),"Explicit kommunparameter måste prioriteras");
assert(page.includes('select.add(new Option("Visa allt","all"))')&&page.includes('place.categories.includes(filter)'),"Visa allt och kategorifilter saknas");
assert(page.includes('marker.on("click",()=>focusPlace(place.id,true))')&&page.includes('data-focus-place'),"Pins och platskort är inte sammankopplade");
assert(html.includes('id="family-map"')&&html.includes('id="family-category"')&&html.includes('SKOLA-FAMILJ-03'),"Familj-UI eller annonsplats saknas");
assert(home.includes('id="family-home-content"')&&home.includes("Vad kan vi göra idag?"),"Startsidans Familj-del saknas");
assert(css.includes(".strategic-ad-slot[hidden]{display:none!important}")&&css.includes(".family-map-layout"),"0px-annonsbeteende eller responsiv Familj-layout saknas");
console.log(`✓ Familj: generell motor, ${places.length} verifierade Åmål-platser, multitaggar, filter, karta och pins ↔ kort verifierade`);
