import webpush from 'web-push';
import municipalities from '../data/municipalities.json';
import {fcmAccessToken} from './native-push.js';

const names=new Set(municipalities.municipalities.map(m=>m.name));
const HOUR=3600000;
const sources=['news','events','jobs','housing','road-traffic','transport','sport-feeds','important','missing-people'];
const pages={news:'nyheter.html',events:'evenemang.html',jobs:'jobb.html',housing:'bostader.html',traffic:'trafik.html',transport:'trafik.html',sport:'sport.html',important:'kris-beredskap.html','extreme-weather':'kris-beredskap.html','missing-people':'kris-beredskap.html'};
const labels={news:'Nya lokala nyheter',events:'Kommande evenemang',jobs:'Nya lediga jobb',housing:'Nya lediga bostäder',traffic:'Ny trafikinformation',transport:'Ändrad kollektivtrafik',sport:'Nya matchresultat',important:'Viktig information','extreme-weather':'Officiell vädervarning','missing-people':'Officiell efterlysning'};
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const date=s=>Date.parse(s||'');
const fresh=(s,now,age)=>Number.isFinite(date(s))&&date(s)<=now+300000&&date(s)>=now-age;
const list=v=>Array.isArray(v)?v:[];
const rows=r=>r.results||[];

// Only real source records are candidates. No inferred warnings or invented events.
export function collectCandidates(source,data,now){
 const output=[];
 if(!fresh(data.generatedAt,now,source==='transport'?HOUR:72*HOUR))return output;
 const add=(municipality,category,id)=>{if(names.has(municipality)&&id)output.push({source,municipality,category,id:String(id)});};
 if(source==='news'){
  for(const a of list(data.articles))if(a.scope==='local'&&fresh(a.publishedAt,now,48*HOUR)){
   const explicit=['important','extreme-weather','missing-people'].includes(a.notificationCategory)&&a.sourceType==='authority'&&fresh(a.verifiedAt,now,48*HOUR);
   for(const m of list(a.municipalities))add(m,explicit?a.notificationCategory:'news',a.id||a.url);
  }
 }else for(const [m,d] of Object.entries(data.municipalities||{})){
  if(source==='important'&&fresh(d.checkedAt,now,4*HOUR))for(const item of list(d.items)){
   const health=list(d.sourceHealth).some(h=>h.id===item.category&&h.status==='ok');
   const category=item.category==='weather'&&item.source==='SMHI'&&[92,98].includes(Number(item.priority))?'extreme-weather':item.category==='crisis'&&item.source==='Krisinformation.se'?'important':null;
   if(category&&health&&item.url&&fresh(item.publishedAt,now,48*HOUR))add(m,category,item.id);
  }
  if(source==='missing-people'&&fresh(data.generatedAt,now,90*60000))for(const item of list(d.items))if(item.source==='Missing People Sweden'&&item.originMunicipality===m&&item.url?.startsWith('https://www.missingpeople.se/efterlysningar/')&&fresh(item.publishedAt,now,48*HOUR))add(m,'missing-people',item.id);
  if(source==='events')for(const e of list(d.events))if(date(e.startDate)>=now-24*HOUR&&date(e.startDate)<=now+30*24*HOUR)add(m,'events',e.id||e.url);
  if(source==='jobs')for(const j of list(d.jobs))if(fresh(j.publicationDate,now,48*HOUR)&&date(j.applicationDeadline)>now)add(m,'jobs',j.id);
  if(source==='housing')for(const h of list(d.listings))if(h.url)add(m,'housing',h.id||h.url);
  if(source==='road-traffic')for(const t of list(d.items))if(t.id&&t.status==='current'&&fresh(t.updatedAt,now,24*HOUR)&&date(t.endTime)>now)add(m,'traffic',t.id+':'+t.updatedAt);
  if(source==='transport')for(const s of list(d.stops))if(!s.retained&&!s.error){
   for(const a of list(s.alerts))if(a.id&&a.message)add(m,'transport',s.id+':'+a.id);
   for(const d of list(s.departures))if(date(d.scheduled)>now&&date(d.scheduled)<now+2*HOUR&&(d.canceled||Number(d.delayMinutes)>=10))add(m,'transport',s.id+':'+d.line+':'+d.scheduled+':'+(d.canceled?'cancelled':'delayed'));
  }
  if(source==='sport-feeds')for(const g of list(d.matches))if(g.status==='finished'&&fresh(g.startTime,now,24*HOUR)&&g.homeScore!=null&&g.awayScore!=null)add(m,'sport',g.id);
 }
 return output;
}

async function schema(db){
 await db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS automatic_push_state (source TEXT PRIMARY KEY,initialized_at INTEGER NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS automatic_push_seen (id TEXT PRIMARY KEY,seen_at INTEGER NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS automatic_push_outbox (id TEXT PRIMARY KEY,municipality TEXT NOT NULL,category TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS automatic_push_outbox_expiry ON automatic_push_outbox(expires_at)'),
  db.prepare('CREATE TABLE IF NOT EXISTS automatic_push_delivery (notification_id TEXT NOT NULL,target_id TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL,last_attempt INTEGER NOT NULL,PRIMARY KEY(notification_id,target_id,kind))'),
  db.prepare('CREATE TABLE IF NOT EXISTS automatic_push_lock (id INTEGER PRIMARY KEY,until_at INTEGER NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS automatic_push_status (id INTEGER PRIMARY KEY,report TEXT NOT NULL)'),
  db.prepare('INSERT OR IGNORE INTO automatic_push_lock(id,until_at) VALUES(1,0)'),
  db.prepare('CREATE TABLE IF NOT EXISTS native_push_devices (id TEXT PRIMARY KEY,token TEXT NOT NULL,municipality TEXT NOT NULL,categories TEXT NOT NULL,updated_at TEXT NOT NULL,last_test_at INTEGER NOT NULL DEFAULT 0)'),
  db.prepare('CREATE TABLE IF NOT EXISTS native_push_ios_devices (id TEXT PRIMARY KEY,token TEXT NOT NULL,municipality TEXT NOT NULL,categories TEXT NOT NULL,updated_at TEXT NOT NULL,last_test_at INTEGER NOT NULL DEFAULT 0)')
 ]);
}
function wanted(target,category){try{return list(JSON.parse(target.categories)).includes(category);}catch{return false;}}
async function stageSource(db,source,data,now,report){
 const initialized=await db.prepare('SELECT source FROM automatic_push_state WHERE source=?').bind(source).first();
 const seen=new Set(rows(await db.prepare('SELECT id FROM automatic_push_seen WHERE id LIKE ?').bind(source+'|%').all()).map(r=>r.id));
 const groups=new Map();
 for(const item of collectCandidates(source,data,now)){
  const key=source+'|'+JSON.stringify([item.municipality,item.category,item.id]);
  if(seen.has(key))continue;
  const g=item.municipality+'|'+item.category;
  if(!groups.has(g))groups.set(g,{...item,keys:[]});groups.get(g).keys.push(key);seen.add(key);
 }
 for(const {municipality,category,keys} of groups.values()){
  if(initialized){
   const recent=await db.prepare('SELECT id FROM automatic_push_outbox WHERE municipality=? AND category=? AND created_at>? LIMIT 1').bind(municipality,category,now-HOUR).first();
   if(recent)continue; // Leave unseen until next digest rather than lose new entries.
  }
  const statements=keys.map(key=>db.prepare('INSERT OR IGNORE INTO automatic_push_seen(id,seen_at) VALUES(?,?)').bind(key,now));
  if(initialized){
   const id=await hash(source+'|'+municipality+'|'+category+'|'+keys.sort().join(','));
   const path='/'+pages[category]+'?kommun='+encodeURIComponent(municipality);
   const payload={title:labels[category]+' · '+municipality,body:'Öppna DinPuls för aktuella uppgifter och originalkällor.',tag:'dinpuls-'+id,path,url:'https://dinpuls.se'+path};
   statements.push(db.prepare('INSERT OR IGNORE INTO automatic_push_outbox(id,municipality,category,payload,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind(id,municipality,category,JSON.stringify(payload),now,now+2*HOUR));report.queued++;
  }else report.baselineItems+=keys.length;
  for(let i=0;i<statements.length;i+=80)await db.batch(statements.slice(i,i+80));
 }
 await db.prepare('INSERT OR IGNORE INTO automatic_push_state(source,initialized_at) VALUES(?,?)').bind(source,now).run();
}

export async function runAutomaticPush(env,{send=fetch,now=Date.now(),sendWeb=(...args)=>webpush.sendNotification(...args)}={}){
 if(env.AUTOMATIC_PUSH_ENABLED!=='true')return {enabled:false};
 await schema(env.DB);
 const claim=await env.DB.prepare('UPDATE automatic_push_lock SET until_at=? WHERE id=1 AND until_at<?').bind(now+10*60000,now).run();
 if(!claim.meta?.changes)return {enabled:true,busy:true};
 const report={enabled:true,checkedAt:new Date(now).toISOString(),sources:0,sourceErrors:0,baselineItems:0,queued:0,accepted:0,failed:0,expiredDevices:0};
 try{
  for(const source of sources){
   try{
    const response=await send('https://dinpuls.se/data/'+source+'.json',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('source');
    const data=await response.json();
    if(!fresh(data.generatedAt,now,source==='transport'?HOUR:72*HOUR)){report.sourceErrors++;continue;}
    await stageSource(env.DB,source,data,now,report);report.sources++;
   }catch{report.sourceErrors++;}
  }
  const notifications=rows(await env.DB.prepare('SELECT * FROM automatic_push_outbox WHERE expires_at>? ORDER BY created_at LIMIT 40').bind(now).all());
  let attempts=0;
  for(const n of notifications){
   const payload=JSON.parse(n.payload);
   const web=rows(await env.DB.prepare('SELECT endpoint_hash id,endpoint,p256dh,auth,categories,created_at FROM subscriptions WHERE municipality=?').bind(n.municipality).all()).map(r=>({...r,kind:'web'}));
   const android=rows(await env.DB.prepare('SELECT id,token,categories,updated_at created_at FROM native_push_devices WHERE municipality=?').bind(n.municipality).all()).map(r=>({...r,kind:'android'}));
   const ios=env.IOS_PUSH_ENABLED==='true'?rows(await env.DB.prepare('SELECT id,token,categories,updated_at created_at FROM native_push_ios_devices WHERE municipality=?').bind(n.municipality).all()).map(r=>({...r,kind:'ios'})):[];
   for(const target of [...web,...android,...ios]){
    if(!wanted(target,n.category)||date(target.created_at)>n.created_at)continue;
    if(attempts>=20)break;
    const lock=await env.DB.prepare("INSERT INTO automatic_push_delivery(notification_id,target_id,kind,status,attempts,last_attempt) VALUES(?,?,?,'pending',1,?) ON CONFLICT(notification_id,target_id,kind) DO UPDATE SET status='pending',attempts=attempts+1,last_attempt=excluded.last_attempt WHERE status IN ('pending','retry') AND attempts<3 AND last_attempt<?").bind(n.id,target.id,target.kind,now,now-5*60000).run();
    if(!lock.meta?.changes)continue;
    attempts++;
    let status='sent';
    try{
     if(target.kind==='web'){
      if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_SUBJECT)throw Error('web configuration');
      webpush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
      await sendWeb({endpoint:target.endpoint,keys:{p256dh:target.p256dh,auth:target.auth}},JSON.stringify(payload),{TTL:900,timeout:8000});
     }else{
      const account=JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON||'null');
      if(account?.project_id!=='dinpuls-57683')throw Error('android configuration');
      const token=await fcmAccessToken(account,send);
      const response=await send('https://fcm.googleapis.com/v1/projects/'+account.project_id+'/messages:send',{method:'POST',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:{token:target.token,notification:{title:payload.title,body:payload.body},data:{path:payload.path},android:{priority:'normal',ttl:'900s',collapse_key:n.id,notification:{channel_id:'dinpuls',tag:payload.tag}},apns:{headers:{'apns-push-type':'alert','apns-priority':'10','apns-expiration':String(Math.floor(now/1000)+900),'apns-collapse-id':n.id},payload:{aps:{sound:'default'}}}}})});
      if(!response.ok){const d=await response.json().catch(()=>({}));throw Object.assign(Error('FCM rejection'),{unregistered:d.error?.details?.some(e=>e.errorCode==='UNREGISTERED'),statusCode:response.status});}
     }
     report.accepted++;
    }catch(error){
     report.failed++;status='retry';
     if(error.unregistered||(target.kind==='web'&&[404,410].includes(Number(error.statusCode)))){
      const table=target.kind==='web'?'subscriptions':target.kind==='ios'?'native_push_ios_devices':'native_push_devices',key=target.kind==='web'?'endpoint_hash':'id';
      await env.DB.prepare('DELETE FROM '+table+' WHERE '+key+'=?').bind(target.id).run();status='expired';report.expiredDevices++;
     }
    }
    await env.DB.prepare('UPDATE automatic_push_delivery SET status=? WHERE notification_id=? AND target_id=? AND kind=?').bind(status,n.id,target.id,target.kind).run();
   }
   if(attempts>=20)break;
  }
  await env.DB.batch([
   env.DB.prepare('DELETE FROM automatic_push_delivery WHERE notification_id IN (SELECT id FROM automatic_push_outbox WHERE expires_at<?)').bind(now-7*24*HOUR),
   env.DB.prepare('DELETE FROM automatic_push_outbox WHERE expires_at<?').bind(now-7*24*HOUR),
   env.DB.prepare('DELETE FROM automatic_push_seen WHERE seen_at<?').bind(now-90*24*HOUR),
   env.DB.prepare('INSERT INTO automatic_push_status(id,report) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET report=excluded.report').bind(JSON.stringify(report))
  ]);
  return report;
 }finally{await env.DB.prepare('UPDATE automatic_push_lock SET until_at=0 WHERE id=1').run();}
}

export async function automaticPushStatus(env){
 let latest=null;try{latest=JSON.parse((await env.DB.prepare('SELECT report FROM automatic_push_status WHERE id=1').first())?.report||'null');}catch{}
 return {ok:true,enabled:env.AUTOMATIC_PUSH_ENABLED==='true',scheduleMinutes:10,municipalities:names.size,latest};
}
