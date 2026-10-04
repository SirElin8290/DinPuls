// Isolated CI backend. Never deployed, no real customers, invoices or email delivery.
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { Miniflare } from '../../node_modules/miniflare/dist/src/index.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const mail=[];
const bundle=await build({entryPoints:[resolve(root,'cloudflare/push-worker.js')],bundle:true,format:'esm',platform:'browser',write:false,
 plugins:[{name:'isolated-push',setup(b){b.onResolve({filter:/^web-push$/},()=>({path:'push',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export default {setVapidDetails(){},async sendNotification(){return {statusCode:201}}}'}));}}]});
const runtime=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-08-06',compatibilityFlags:['nodejs_compat'],
 bindings:{ADMIN_USERNAME:'ci-admin',ADMIN_PASSWORD:'Isolated-CI-Admin-2026',PORTAL_PASSWORD_PEPPER:'isolated-ci-only',RESEND_API_KEY:'isolated-mail',PORTAL_EMAIL_FROM:'DinPuls <test@example.invalid>',SELF_SERVICE_SIGNUP_ENABLED:'true',SELF_SERVICE_PURCHASE_ENABLED:'true',SELF_SERVICE_FIXED_SIGNATURE_ENABLED:'true',SELF_SERVICE_FIXED_SIGNATURE_SHA256:createHash('sha256').update(png).digest('hex')},
 d1Databases:{DB:'isolated-android-e2e'},r2Buckets:['AD_ASSETS','CONTRACT_SIGNATURES'],
 outboundService:async request=>{if(request.url!=='https://api.resend.com/emails')throw Error('External traffic forbidden in CI');mail.push(await request.json());return Response.json({id:'ci-mail-'+mail.length});}});
await (await runtime.getR2Bucket('CONTRACT_SIGNATURES')).put('approved/sirelin-ab/v1.png',png);
const server=createServer(async(req,res)=>{
 try{
  const parts=[];for await(const p of req)parts.push(p);const bytes=Buffer.concat(parts);
  const url=new URL(req.url,'http://127.0.0.1:8788');let response;
  if(url.pathname==='/__test/banner')response=new Response(await readFile(resolve(root,'assets/heroes/amal/amal-06-stadsutsikt.webp')),{headers:{'Content-Type':'image/webp'}});
  else if(url.pathname==='/__test/mail')response=Response.json({messages:mail});
  else if(url.pathname==='/data/business-config.json')response=Response.json({enabled:true,apiBase:'http://127.0.0.1:8788'});
  else if(url.pathname.startsWith('/data/')){const file=url.pathname.slice(1);if(!/^data\/[a-z-]+\.json$/.test(file))throw Error('Invalid path');response=new Response(await readFile(resolve(root,file)),{headers:{'Content-Type':'application/json'}});}
  else if(url.pathname==='/__test/approve'){
   const auth=await runtime.dispatchFetch('http://ci.local/portal/auth/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'ci-admin',password:'Isolated-CI-Admin-2026'})}).then(r=>r.json());
   const db=await runtime.getD1Database('DB');const rows=await db.prepare("SELECT id FROM ad_banners WHERE approval_status='pending'").all();
   for(const b of rows.results)await runtime.dispatchFetch('http://ci.local/portal/admin/banners/'+b.id+'/review',{method:'PATCH',headers:{Authorization:'Bearer '+auth.token,'Content-Type':'application/json'},body:JSON.stringify({approvalStatus:'approved',reviewComment:'Isolated Android CI'})});
   response=Response.json({ok:true,count:rows.results.length});
  }else response=await runtime.dispatchFetch('http://ci.local'+url.pathname+url.search,{method:req.method,headers:{...req.headers,host:'ci.local',origin:'https://dinpuls.se'},...(bytes.length?{body:bytes}:{})});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error('CI backend',e.message);res.writeHead(500);res.end(JSON.stringify({error:e.message}));}
});
server.listen(8788,'127.0.0.1',()=>console.log('Isolated Android E2E backend ready'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{server.close();await runtime.dispose();process.exit();});
