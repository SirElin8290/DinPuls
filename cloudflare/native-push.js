import municipalities from '../data/municipalities.json';
const names=new Set(municipalities.municipalities.map(m=>m.name));
const categories=new Set(['traffic','transport','news','events','jobs','housing','sport']);
const origins=new Set(['https://localhost','http://localhost','capacitor://localhost','https://dinpuls.se','https://www.dinpuls.se']);
let cached;
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const b64=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const encode=value=>b64(new TextEncoder().encode(JSON.stringify(value)));
export async function fcmAccessToken(account,send=fetch){
  if(cached?.identity===account.client_email&&cached.until>Date.now()+60000)return cached.token;
  const now=Math.floor(Date.now()/1000);
  const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const der=Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
  const response=await send('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+b64(signature)})});
  if(!response.ok)throw new Error('Firebase authentication failed');
  const data=await response.json();if(!data.access_token)throw new Error('Firebase token missing');
  cached={identity:account.client_email,token:data.access_token,until:Date.now()+Math.min(Number(data.expires_in)||3600,3600)*1000};
  return cached.token;
}
export async function handleNativePush(request,env){
  const url=new URL(request.url);if(!url.pathname.startsWith('/native-push/'))return null;
  const origin=request.headers.get('Origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://dinpuls.se','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, PUT, POST, DELETE, OPTIONS','Vary':'Origin'};
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.has(origin))return reply({ok:false},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  let account;try{account=JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON||'null');}catch{}
  const configured=account?.type==='service_account'&&account.project_id==='dinpuls-57683'&&Boolean(account.private_key&&account.client_email);
  const iosConfigured=configured&&env.IOS_PUSH_ENABLED==='true';
  if(request.method==='GET'&&url.pathname==='/native-push/config')return reply({ok:true,androidConfigured:configured,iosConfigured});
  if(!configured)return reply({ok:false,error:'Androids pushanslutning är inte konfigurerad.'},503);
  const secret=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
  if(!/^[a-f0-9]{64}$/.test(secret))return reply({ok:false,error:'Enhetsbehörighet saknas.'},401);
  const id=await hash(secret);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS native_push_devices (id TEXT PRIMARY KEY,token TEXT NOT NULL,municipality TEXT NOT NULL,categories TEXT NOT NULL,updated_at TEXT NOT NULL,last_test_at INTEGER NOT NULL DEFAULT 0)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS native_push_ios_devices (id TEXT PRIMARY KEY,token TEXT NOT NULL,municipality TEXT NOT NULL,categories TEXT NOT NULL,updated_at TEXT NOT NULL,last_test_at INTEGER NOT NULL DEFAULT 0)').run();
  try{
    if(request.method==='PUT'&&url.pathname==='/native-push/device'){
      if(Number(request.headers.get('Content-Length')||0)>8192)return reply({ok:false},413);
      const text=await request.text();if(text.length>8192)return reply({ok:false},413);
      const body=JSON.parse(text);
      if(!['android','ios'].includes(body.platform)||!names.has(body.municipality)||typeof body.token!=='string'||body.token.length<30||body.token.length>4096||!/^[A-Za-z0-9:_-]+$/.test(body.token)||(body.platform==='ios'&&/^[a-f0-9]{64}$/i.test(body.token)))return reply({ok:false,error:'Ogiltig enhetsregistrering.'},400);
      if(body.platform==='ios'&&!iosConfigured)return reply({ok:false,error:'iPhones pushanslutning är inte konfigurerad.'},503);
      const table=body.platform==='ios'?'native_push_ios_devices':'native_push_devices';
      const selected=['extreme-weather','missing-people','important',...new Set((Array.isArray(body.categories)?body.categories:[]).filter(c=>categories.has(c)))];
      await env.DB.prepare('INSERT INTO '+table+' (id,token,municipality,categories,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,municipality=excluded.municipality,categories=excluded.categories,updated_at=excluded.updated_at').bind(id,body.token,body.municipality,JSON.stringify(selected),new Date().toISOString()).run();
      return reply({ok:true});
    }
    if(request.method==='DELETE'&&url.pathname==='/native-push/device'){
      await env.DB.batch(['native_push_devices','native_push_ios_devices'].map(table=>env.DB.prepare('DELETE FROM '+table+' WHERE id=?').bind(id)));return reply({ok:true});
    }
    if(request.method==='POST'&&url.pathname==='/native-push/test'){
      let table='native_push_devices';
      let device=await env.DB.prepare('SELECT * FROM '+table+' WHERE id=?').bind(id).first();
      if(!device){table='native_push_ios_devices';device=await env.DB.prepare('SELECT * FROM '+table+' WHERE id=?').bind(id).first();}
      if(!device)return reply({ok:false,error:'Enheten är inte registrerad.'},404);
      if(table==='native_push_ios_devices'&&!iosConfigured)return reply({ok:false,error:'iPhones pushanslutning är inte konfigurerad.'},503);
      const now=Date.now();
      const lock=await env.DB.prepare('UPDATE '+table+' SET last_test_at=? WHERE id=? AND last_test_at<?').bind(now,id,now-60000).run();
      if(!lock.meta?.changes)return reply({ok:false,error:'Vänta en minut innan nästa test.'},429);
      const token=await fcmAccessToken(account);
      const result=await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:{token:device.token,notification:{title:'DinPuls – testnotis',body:'Detta är ditt mottagningstest för DinPuls.'},data:{path:'/index.html?kommun='+encodeURIComponent(device.municipality)},android:{priority:'high',ttl:'120s',notification:{channel_id:'dinpuls'}},apns:{headers:{'apns-push-type':'alert','apns-priority':'10','apns-expiration':String(Math.floor(now/1000)+120)},payload:{aps:{sound:'default'}}}}})});
      if(!result.ok){
        const failure=await result.json().catch(()=>({}));
        if(failure.error?.details?.some(d=>d.errorCode==='UNREGISTERED'))await env.DB.prepare('DELETE FROM '+table+' WHERE id=?').bind(id).run();
        return reply({ok:false,error:'Firebase kunde inte ta emot testsändningen.'},502);
      }
      return reply({ok:true,message:'Firebase har accepterat testsändningen. Bekräfta mottagning på telefonen.'});
    }
    return reply({ok:false},404);
  }catch{return reply({ok:false,error:'Pushanslutningen kunde inte behandla anropet.'},502);}
}
