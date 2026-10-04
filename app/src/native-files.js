import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
export async function savePdf(blob,name,{share=true}={}){
 if(blob.size>20*1024*1024)throw new Error('PDF-filen är för stor för att öppnas i appen.');
 const signature=new Uint8Array(await blob.slice(0,5).arrayBuffer());
 if(String.fromCharCode(...signature)!=='%PDF-')throw new Error('Avtalsfilen är inte en giltig PDF.');
 const safe=String(name).replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,150).replace(/\.pdf$/i,'')+'.pdf';
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
 const {uri}=await Filesystem.writeFile({path:'contracts/'+safe,data,directory:Directory.Cache,recursive:true});
 if(share)await Share.share({title:'DinPuls – annonsavtal',files:[uri],dialogTitle:'Öppna eller spara ditt avtal'});
 return uri;
}
