const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('script.js','utf8');const start=source.indexOf('function selectAmalNews(');const end=source.indexOf('function renderImportantNews(',start);
const context={Date};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
const articles=JSON.parse(fs.readFileSync('data/news.json','utf8')).articles.filter(a=>a.scope==='local'&&(a.municipalities||[]).includes('Åmål')).sort(context.compareNewsQuality);
const selected=context.selectAmalNews(articles,5);assert.equal(selected.length,5);assert.equal(selected.filter(a=>/Karlskoga|toppmatchen/.test(a.title)).length,1);assert(selected.some(a=>/elpriser/.test(a.title)));assert(selected.some(a=>/keramikkurs/.test(a.title)));
assert.equal(context.selectAmalNews([{title:'Samma rubrik - Tidning A'},{title:'Samma rubrik - Tidning B'}],5).length,1);
assert.equal(context.selectAmalNews([{title:'Hockey matchen A'},{title:'Hockey matchen B'}],5).length,1);
console.log('Åmål news variation PASS:',selected.map(a=>a.title));
