const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.runInNewContext(fs.readFileSync('admin/source-monitor.js','utf8'),context);
const render=context.window.DinPulsSourceMonitoring.render,now=Date.parse('2026-10-07T12:00:00Z');
const report={completed:true,generatedAt:'2026-10-07T01:00:00Z',summary:{reachable:2,unverified:1},sources:[{url:'https://example.org/a',state:'unverified',contexts:[{entity:'<script>alert(1)</script>',municipality:'Åmål'}]}],updates:{lunch:'failure'}};
const html=render(report,now);assert(html.includes('Misslyckade uppdateringar'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes('Kunde inte verifieras'));
assert(render({...report,generatedAt:'2026-10-05T01:00:00Z'},now).includes('uteblivit'));assert(render({...report,generatedAt:'invalid'},now).includes('uteblivit'));
const index=fs.readFileSync('admin/index.html','utf8');assert(index.includes('id="sourceMonitoring"'));assert(index.includes('source-monitor.js'));assert(fs.readFileSync('admin/admin.js','utf8').includes('DinPulsSourceMonitoring?.load'));
console.log('Nattkontrollens administration: varningar, utebliven körning och säker rendering PASS');

assert(render({...report,completed:false},now).includes("uteblivit"));
