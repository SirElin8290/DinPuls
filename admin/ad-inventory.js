// Central och enda tillåtna katalog för säljbara annonsplatser i DinPuls.
// Avtalssystemet får endast använda ID:n som finns här.
window.DINPULS_AD_INVENTORY = Object.freeze([
  ...Array.from({length:10},(_,i)=>({id:`P1-${String(i+1).padStart(2,'0')}`,group:'premium-ad-1',label:`Företag nära dig · plats ${i+1}`,location:'Efter Dagens viktigaste / före huvudmodulerna'})),
  ...Array.from({length:10},(_,i)=>({id:`P2-${String(i+11).padStart(2,'0')}`,group:'premium-ad-2',label:`Aktuellt från företag · plats ${i+11}`,location:'Mellan innehållsblocken på startsidan'})),
  ...Array.from({length:10},(_,i)=>({id:`P3-${String(i+21).padStart(2,'0')}`,group:'premium-ad-3',label:`Mer från företag nära dig · plats ${i+21}`,location:'Nedre annonsblocket på startsidan'}))
].map(slot=>Object.freeze({...slot,module:'Startsida'})));
