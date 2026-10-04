import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(app,'..'),out=resolve(app,'www');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
export function publicFile(path){return path==='admin/ad-inventory.js'||!path.startsWith('app/')&&( /^[^/]+\.(html|css|js|ico|webmanifest)$/.test(path)||/^(assets|components|foretag)\//.test(path));}
let copied=0;
for(const file of files.filter(publicFile)){
 const target=resolve(out,file);await mkdir(dirname(target),{recursive:true});
 if(file.endsWith('.html')){
  let html=await readFile(resolve(root,file),'utf8');
  html=html.replace(/<head>/i,'<head><script src="/native.js"></script><link rel="stylesheet" href="/native.css">');
  html=html.replace('width=device-width,initial-scale=1','width=device-width,initial-scale=1,viewport-fit=cover');
  await writeFile(target,html);
 }else if(file==='push-notifications.js'){
  const source=(await readFile(resolve(root,file),'utf8')).replace(/\r\n/g,'\n');
  const anchor='    const current = await loadConfig();\n    if (isIos() && !isStandalone())';
  if(!source.includes(anchor))throw new Error('Push-UI har ändrats: kontrollera appanpassningen.');
  await writeFile(target,source.replace(anchor,`    const current = await loadConfig();
    if (window.Capacitor?.isNativePlatform?.()) {
      enable.disabled = true; disable.hidden = true;
      setStatus("setup", "Appnotiser är inte anslutna ännu", "Native push kräver en separat anslutning. Dina notisval sparas på enheten.");
      help.textContent = "Notiscentret fungerar när appen är öppen. Push i bakgrunden är ännu inte aktiverat.";
      return;
    }
    if (isIos() && !isStandalone())`));
 }else await copyFile(resolve(root,file),target);
 copied++;
}
// Endast kommunlistan paketeras. Alla föränderliga JSON-data hämtas live.
await mkdir(resolve(out,'data'),{recursive:true});await copyFile(resolve(root,'data/municipalities.json'),resolve(out,'data/municipalities.json'));
await build({entryPoints:[resolve(app,'src/native.js')],bundle:true,format:'iife',outfile:resolve(out,'native.js'),target:'es2022',define:{__DINPULS_PAGES__:JSON.stringify(files.filter(publicFile).filter(p=>p.endsWith('.html')).map(p=>'/'+p))}});
await copyFile(resolve(app,'src/native.css'),resolve(out,'native.css'));
await writeFile(resolve(out,'app-build.json'),JSON.stringify({version:'0.1.0',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),publicFiles:copied},null,2));
console.log(`DinPuls app: ${copied} publika filer paketerade; live-data och befintlig backend återanvänds.`);
