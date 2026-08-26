const ADMIN_USER='snuttis8290';
// PROTOTYPE ONLY: do not place the real password in public GitHub. Temporary local-only verifier.
const EXPECTED_PASSWORD='Flisan5917';
const municipalities=['Åmål','Bengtsfors','Dals-Ed','Färgelanda','Mellerud','Arvika','Eda','Filipstad','Forshaga','Grums','Hagfors','Hammarö','Karlstad','Kil','Kristinehamn','Munkfors','Storfors','Sunne','Säffle','Torsby','Årjäng'];
const slots=['A1','A2','A3','B1','B2','B3','C1','C2','C3'];
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
function contracts(){try{return JSON.parse(localStorage.getItem('dp-contracts')||'[]')}catch{return []}}
function login(){sessionStorage.setItem('dp-admin','1');$('#loginView').hidden=true;$('#appView').hidden=false;render()}
function save(c){const x=contracts();x.push(c);localStorage.setItem('dp-contracts',JSON.stringify(x))}
function render(){const cs=contracts();const active=cs.filter(c=>c.status==='Aktivt');const drafts=cs.filter(c=>c.status==='Utkast');const mrr=active.reduce((s,c)=>s+c.price*c.placements.length,0);$('#activeContracts').textContent=active.length;$('#mrr').textContent=mrr.toLocaleString('sv-SE')+' kr';$('#arr').textContent=(mrr*12).toLocaleString('sv-SE')+' kr';$('#drafts').textContent=drafts.length;$('#contractList').innerHTML=cs.length?`<div class="contract-row"><strong>Avtal</strong><strong>Företag</strong><strong>Kommun/plats</strong><strong>Status</strong></div>`+cs.map(c=>`<div class="contract-row"><span>${c.id}</span><span>${escapeHtml(c.company)}</span><span>${escapeHtml(c.municipality)} · ${c.placements.map(p=>p.slot).join(', ')}</span><span>${c.status}</span></div>`).join(''):'<p class="muted">Inga avtal ännu. Skapa första avtalsutkastet här.</p>'}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function addPlacement(){const row=document.createElement('div');row.className='placement';row.innerHTML=`<label>Sida/modul<select class="module"><option>Startsida</option><option>Bostäder</option><option>Evenemang</option><option>Bio</option><option>Lunch</option><option>Service</option></select></label><label>Annonsplats<select class="slot">${slots.map(s=>`<option>${s}</option>`).join('')}</select></label><button type="button" class="secondary">Ta bort</button>`;row.querySelector('button').onclick=()=>row.remove();$('#placements').append(row)}
function init(){
 const loginForm=$('#loginForm');
 loginForm.addEventListener('submit',e=>{e.preventDefault();const user=$('#username').value.trim();const pass=$('#password').value;if(user===ADMIN_USER&&pass===EXPECTED_PASSWORD){$('#loginError').hidden=true;login()}else $('#loginError').hidden=false});
 $('#logout').onclick=()=>{sessionStorage.removeItem('dp-admin');location.reload()};
 $$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(v=>v.hidden=true);$('#'+b.dataset.view).hidden=false});
 municipalities.sort((a,b)=>a.localeCompare(b,'sv')).forEach(m=>$('#municipality').add(new Option(m,m)));
 $('#addPlacement').onclick=addPlacement;addPlacement();
 $('#newContract').onclick=()=>{$('#contractForm').hidden=false;$('#contractForm').scrollIntoView({behavior:'smooth'})};
 $('#cancelContract').onclick=()=>$('#contractForm').hidden=true;
 $('#contractForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);const placements=$$('.placement').map(r=>({module:r.querySelector('.module').value,slot:r.querySelector('.slot').value}));if(!placements.length)return alert('Lägg till minst en annonsplats.');const c={id:'DP-'+String(Date.now()).slice(-6),company:f.get('company'),orgNo:f.get('orgNo'),contact:f.get('contact'),email:f.get('email'),phone:f.get('phone'),municipality:f.get('municipality'),placements,price:Number(f.get('price')),months:12,status:'Utkast',created:new Date().toISOString()};save(c);e.target.reset();$('#placements').innerHTML='';addPlacement();$('#contractForm').hidden=true;render()});
 if(sessionStorage.getItem('dp-admin')==='1')login();else render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();