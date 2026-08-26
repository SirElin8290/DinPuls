(() => {
 const loginView=document.getElementById('loginView'),appView=document.getElementById('appView'),loginForm=document.getElementById('loginForm'),loginError=document.getElementById('loginError'),logout=document.getElementById('logout');
 const navItems=[...document.querySelectorAll('.nav-item')],views=[...document.querySelectorAll('.view')];
 const showApp=()=>{loginView.hidden=true;appView.hidden=false}; const showLogin=()=>{appView.hidden=true;loginView.hidden=false};
 function showView(id){views.forEach(v=>v.hidden=v.id!==id);navItems.forEach(n=>n.classList.toggle('active',n.dataset.view===id));}
 loginForm.addEventListener('submit',e=>{e.preventDefault();const email=document.getElementById('email').value.trim(),password=document.getElementById('password').value;if(!email||!password){loginError.hidden=false;return}loginError.hidden=true;sessionStorage.setItem('dinpuls_company_demo','1');showApp();});
 document.getElementById('forgot').addEventListener('click',e=>{e.preventDefault();alert('Återställning av lösenord ansluts när företagskonton och backend är på plats.')});
 logout.addEventListener('click',()=>{sessionStorage.removeItem('dinpuls_company_demo');showLogin()});
 navItems.forEach(n=>n.addEventListener('click',()=>showView(n.dataset.view)));document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.open)));
 const upload=document.getElementById('bannerUpload'),preview=document.getElementById('bannerPreview'),status=document.getElementById('uploadStatus');
 upload.addEventListener('change',()=>{const file=upload.files&&upload.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)){status.textContent='Välj PNG, JPG eller WebP.';upload.value='';return}if(file.size>5*1024*1024){status.textContent='Filen är för stor. Max 5 MB.';upload.value='';return}const reader=new FileReader();reader.onload=()=>{preview.innerHTML='';const img=document.createElement('img');img.src=reader.result;img.alt='Förhandsvisning av banner';preview.appendChild(img);status.textContent=file.name+' är vald. Förhandsvisningen är lokal tills lagring/backend är ansluten.'};reader.readAsDataURL(file)});
 if(sessionStorage.getItem('dinpuls_company_demo')==='1')showApp();
})();