import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {mkdir,writeFile} from 'node:fs/promises';
import {generateKeyPairSync} from 'node:crypto';
import webpush from 'web-push';
await mkdir('tmp',{recursive:true});
const bundled=await build({entryPoints:['cloudflare/automatic-push.js'],bundle:true,format:'esm',write:false,platform:'node',packages:'external'});
await writeFile('tmp/automatic-push-test.mjs',bundled.outputFiles[0].text);
const {collectCandidates,runAutomaticPush,automaticPushStatus}=await import('../tmp/automatic-push-test.mjs');
const now=Date.parse('2026-10-04T20:00:00Z'),stamp=new Date(now).toISOString();
const runtime=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-08-06',d1Databases:{DB:'push-test'}});
const db=await runtime.getD1Database('DB');
const pair=generateKeyPairSync('rsa',{modulusLength:2048}),vapid=webpush.generateVAPIDKeys();
const env={DB:db,AUTOMATIC_PUSH_ENABLED:'true',VAPID_PUBLIC_KEY:vapid.publicKey,VAPID_PRIVATE_KEY:vapid.privateKey,VAPID_SUBJECT:'mailto:test@example.invalid',FCM_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:'dinpuls-57683',client_email:'test@example.invalid',private_key:pair.privateKey.export({type:'pkcs8',format:'pem'})})};
const data={};for(const s of ['news','events','jobs','housing','road-traffic','transport','sport-feeds'])data[s]={generatedAt:stamp,municipalities:{}};
const article=(id,m)=>({id,municipalities:[m],scope:'local',publishedAt:stamp,title:id});
data.news.articles=[article('existing','Åmål')];
const deliveries=[];
const send=async(url,init)=>{
 if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'isolated',expires_in:3600});
 if(url.includes('fcm.googleapis.com')){deliveries.push({kind:'android',body:JSON.parse(init.body)});return Response.json({name:'isolated-message'});}
 const s=new URL(url).pathname.split('/').at(-1).replace('.json','');return Response.json(data[s]);
};
const sendWeb=async(subscription,payload)=>{deliveries.push({kind:'web',endpoint:subscription.endpoint,body:JSON.parse(payload)});if(subscription.endpoint.includes('expired'))throw {statusCode:410};return {statusCode:201};};
try{
 await db.prepare('CREATE TABLE subscriptions(endpoint_hash TEXT PRIMARY KEY,endpoint TEXT,p256dh TEXT,auth TEXT,municipality TEXT,categories TEXT,created_at TEXT)').run();
 for(const [id,m,c] of [['amal','Åmål','news'],['saffle','Säffle','jobs'],['expired','Åmål','news']])await db.prepare('INSERT INTO subscriptions VALUES(?,?,?,?,?,?,?)').bind(id,'https://example.invalid/'+id,'key','auth',m,JSON.stringify([c]),'2026-10-01T00:00:00Z').run();
 let report=await runAutomaticPush(env,{send,sendWeb,now});assert.equal(report.baselineItems,1);assert.equal(report.queued,0);assert.equal(deliveries.length,0);
 await db.prepare('INSERT INTO native_push_devices VALUES(?,?,?,?,?,0)').bind('phone','fake-device-token','Åmål','["news"]','2026-10-01T00:00:00Z').run();
 data.news.articles.push(article('new-amal','Åmål'),article('new-saffle','Säffle'),article('new-arvika','Arvika'));
 report=await runAutomaticPush(env,{send,sendWeb,now:now+600000});assert.equal(report.accepted,2);assert.equal(report.expiredDevices,1);
 assert.equal(deliveries.filter(d=>d.kind==='web'&&d.endpoint.endsWith('/saffle')).length,0);
 assert.equal(deliveries.filter(d=>d.kind==='web'&&d.endpoint.endsWith('/amal')).length,1);
 assert.equal(deliveries.find(d=>d.kind==='android').body.message.data.path,'/nyheter.html?kommun=%C3%85m%C3%A5l');
 assert.equal((await db.prepare("SELECT endpoint_hash FROM subscriptions WHERE endpoint_hash='expired'").all()).results.length,0);
 const count=deliveries.length;await runAutomaticPush(env,{send,sendWeb,now:now+1200000});assert.equal(deliveries.length,count);
 // A category/municipality change must not deliver queued content to the wrong recipient.
 await db.prepare("UPDATE subscriptions SET municipality='Arvika',categories='[\"jobs\"]' WHERE endpoint_hash='amal'").run();
 data.news.articles.push(article('later','Åmål'));
 report=await runAutomaticPush(env,{send,sendWeb,now:now+1800000});assert.equal(report.queued,0); // cooldown
 report=await runAutomaticPush(env,{send,sendWeb,now:now+2*3600000});assert.equal(report.accepted,1);assert.equal(deliveries.at(-1).kind,'android');
 await db.prepare('DELETE FROM native_push_devices').run();data.news.articles.push(article('unsubscribed','Åmål'));
 await runAutomaticPush(env,{send,sendWeb,now:now+4*3600000});assert.equal(deliveries.length,count+1);
 assert.deepEqual(collectCandidates('news',{...data.news,generatedAt:'2025-01-01'},now),[]);
 assert.deepEqual(collectCandidates('news',{generatedAt:stamp,articles:[{...article('national','Åmål'),scope:'national'}]},now),[]);
 assert.deepEqual(collectCandidates('jobs',{generatedAt:stamp,municipalities:{Åmål:{jobs:[{id:'expired',publicationDate:stamp,applicationDeadline:'2026-10-01'}]}}},now),[]);
 assert.equal(collectCandidates('events',{generatedAt:stamp,municipalities:{Åmål:{events:[{id:'past',startDate:'2026-09-01'},{id:'future',startDate:'2026-10-12'}]}}},now).length,1);
 assert.equal(collectCandidates('news',{generatedAt:stamp,articles:[{...article('not-warning','Åmål'),notificationCategory:'extreme-weather',sourceType:'publisher'}]},now)[0].category,'news');
 assert.equal((await automaticPushStatus(env)).municipalities,21);
 assert.deepEqual(await runAutomaticPush({...env,AUTOMATIC_PUSH_ENABLED:'false'}),{enabled:false});
 await db.prepare("INSERT INTO subscriptions VALUES('temporary','https://example.invalid/temporary','key','auth','Eda','[\"news\"]','2026-10-01T00:00:00Z')").run();
 data.news.articles.push(article('retry-ed a','Eda'));
 let retries=0;const failingWeb=async()=>{retries++;throw {statusCode:503};};
 for(let i=0;i<4;i++)await runAutomaticPush(env,{send,sendWeb:failingWeb,now:now+5*3600000+i*600000});
 assert.equal(retries,3);
 // A bounded dispatch must resume remaining devices on the next run.
 await db.prepare('DELETE FROM subscriptions').run();
 for(let i=0;i<22;i++)await db.prepare('INSERT INTO native_push_devices VALUES(?,?,?,?,?,0)').bind('batch-'+i,'fake-token-'+i,'Åmål','["news"]','2026-10-01T00:00:00Z').run();
 data.news.articles.push(article('batch-new','Åmål'));
 report=await runAutomaticPush(env,{send,sendWeb,now:now+7*3600000});assert.equal(report.accepted,20);
 report=await runAutomaticPush(env,{send,sendWeb,now:now+7*3600000+600000});assert.equal(report.accepted,2);
 await db.prepare('UPDATE automatic_push_lock SET until_at=? WHERE id=1').bind(now+9*3600000).run();
 assert.equal((await runAutomaticPush(env,{send,sendWeb,now:now+8*3600000})).busy,true);
 console.log('PASS automatic push: cold start, deduplication, municipality/category isolation, Android/web payloads, cooldown, unsubscribe, stale/expired sources, no inferred warnings. No real notifications sent.');
}finally{await runtime.dispose();}
