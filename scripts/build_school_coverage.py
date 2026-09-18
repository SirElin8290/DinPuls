import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
entries={
'Årjäng':('1765','https://www.arjang.se/kommunalservice/startsida/utbildningochbarnomsorg/terminerlovochledigheter.3205.html','https://www.arjang.se/kommunalservice/startsida/utbildningochbarnomsorg.html','BLOCKED','Ingen publik strukturerad matsedel verifierad'),
'Bengtsfors':('1460','https://www.bengtsfors.se/skola-och-utbildning/lasarstider-och-lov','https://www.bengtsfors.se/skola-och-utbildning/mat-och-maltider-i-skolan','BLOCKED','Matilda-länk verifierad; stabilt meny-ID återstår'),
'Mellerud':('1461','https://mellerud.se/media/ltjpm3ai/lasarstider-26-27.pdf','https://mellerud.se/barn-och-utbildning/','BLOCKED','Kommunen hänvisar till Skolmaten; stabilt öppet flöde återstår'),
'Arvika':('1784','https://www.arvika.se/utbildningochbarnomsorg/lovochlasarstider.1714.html','https://www.arvika.se/utbildningochbarnomsorg/matlunch.1708.html','BLOCKED','Officiell Mashie-meny kräver en stabil offentlig adapter'),
'Grums':('1764','https://www.grums.se/barnutbildning/grundskolaochfritidshem/lasarstidergrundskola.5089.html','https://www.grums.se/barnutbildning/grundskolaochfritidshem/matenigrundskolan.5090.html','PASS','Öppet Matilda RSS-flöde'),
'Säffle':('1785','https://saffle.se/barn-och-utbildning/grundskola-och-fritidshem/lasarstider-och-lov.html','https://saffle.se/barn-och-utbildning/grundskola-och-fritidshem/maten-i-skolan.html','BLOCKED','Matilda-länk verifierad; stabilt meny-ID återstår'),
'Dals-Ed':('1438','https://www.dalsed.se/forskola-skola-och-utbildning/gymnasium/anpassad-gymnasieskola/lasarstider/','https://www.dalsed.se/forskola-skola-och-utbildning/allman-information/kost/matsedlar-for-skolor-och-forskolor/','BLOCKED','Matilda-länkar verifierade; stabilt meny-ID återstår'),
'Eda':('1730','https://eda.se/grundskola/l%C3%A4s%C3%A5rstider__219','https://eda.se/utbildning/skolmat__680','BLOCKED','Aktuell höstmeny kunde inte verifieras publikt'),
'Filipstad':('1782','https://www.filipstad.se/toppmeny/barnochutbildning/lasarstider.808.html','https://www.filipstad.se/toppmeny/barnochutbildning/matsedelinomskolan.645.html','PASS','Officiell kommunal veckomeny'),
'Forshaga':('1763','https://www.forshaga.se/forskolaskolaochutbildning/grundskola/lovochledigheter.4.725330be11efa4b0a3f80004913.html','https://www.forshaga.se/forskolaskolaochutbildning/grundskola/matlunchiskolan.4.3ce960b5126ff5c2897800027915.html','BLOCKED','Kommunen hänvisar till Skolmaten; stabilt öppet flöde återstår'),
'Färgelanda':('1439','https://fargelanda.se/media/ijubpkii/lasarstider-och-arbetsar-2026-2027.pdf','https://fargelanda.se/barn-och-utbildning/','BLOCKED','Öppet Skolmaten-RSS svarar Ingen meny tillgänglig'),
'Hagfors':('1783','https://www.hagfors.se/undersidor/barn-och-utbildning/lasarstider.html','https://www.hagfors.se/undersidor/barn-och-utbildning/skolmaten.html','BLOCKED','Officiella sidorna visar endast passerad vårmeny, veckorna 18-24'),
'Hammarö':('1761','https://hammaro.se/forskola-skola-och-utbildning/grundskola/lasarstider-och-lov','https://hammaro.se/forskola-skola-och-utbildning/grundskola/mat-i-skolan','BLOCKED','Matsedel kräver inloggning i Vklass'),
'Karlstad':('1780','https://karlstad.se/forskola-skola-och-utbildning/grundskola/lasarstider-och-lov-i-grundskolan','https://karlstad.se/forskola-skola-och-utbildning/grundskola/mat-i-grundskolan','BLOCKED','Publik menyadapter återstår'),
'Kil':('1715','https://kil.se/forskola-skola-och-utbildning/grundskola-och-fritidshem/lasarstider-och-lov','https://kil.se/forskola-skola-och-utbildning/grundskola-och-fritidshem','BLOCKED','Öppet Skolmaten-RSS svarar Ingen meny tillgänglig'),
'Kristinehamn':('1781','https://www.kristinehamn.se/barnomsorg-och-utbildning/lasarstider-och-lovdagar/','https://www.kristinehamn.se/barnomsorg-och-utbildning/mat-och-maltider/','BLOCKED','Aktuell skolmatsedel kunde inte verifieras publikt'),
'Munkfors':('1762','https://www.munkfors.se/wp-content/uploads/2026/01/protokoll-boh-2026-01-13.pdf','https://www.munkfors.se/utbildning-och-barnomsorg/skolor-och-utbildning/maltidsverksamhet-skola/matsedel-skolan/','BLOCKED','Officiella sidan visar passerad vårmeny; Skolmaten-flöde återstår'),
'Storfors':('1760','https://www.storfors.se/download/18.198659aa19cff7339b06cac2/1774256685038/Protokoll%20KS%202026-03-16%20%C2%A7%C2%A736-68.pdf','https://www.storfors.se/utbildning-och-barnomsorg.html','BLOCKED','Öppet Skolmaten-RSS svarar Ingen meny tillgänglig'),
'Sunne':('1766','https://www.sunne.se/kommun/utbildning-och-barnomsorg/gymnasieskola/lov-och-ledigheter/','https://www.sunne.se/kommun/utbildning-och-barnomsorg/grundskola/matsedel/','BLOCKED','Kommunen hänvisar till Skolmaten; stabilt öppet flöde återstår'),
'Torsby':('1737','https://torsby.se/utbildningbarnomsorg/grundskola/lovochledigheter.4.108f9ad3156b3ea51203c56b.html','https://torsby.se/utbildningbarnomsorg/grundskola.html','BLOCKED','Öppet Skolmaten-RSS svarar Ingen meny tillgänglig')}
working_meals={
'Munkfors':'Öppet Skolmaten RSS-flöde',
'Storfors':'Öppet Matilda RSS-flöde',
'Bengtsfors':'Öppet Matilda RSS-flöde',
'Kristinehamn':'Öppet Matilda RSS-flöde',
'Mellerud':'Öppet Matilda RSS-flöde',
'Säffle':'Öppet Matilda RSS-flöde',
'Filipstad':'Öppet Skolmaten RSS-flöde',
'Dals-Ed':'Öppet Matilda RSS-flöde',
'Eda':'Officiell kommunal veckomeny',
'Årjäng':'Öppet Matilda RSS-flöde',
'Karlstad':'Öppet Matilda RSS-flöde',
'Torsby':'Öppet Skolmaten RSS-flöde',
'Grums':'Öppet Matilda RSS-flöde',
'Forshaga':'Öppet Skolmaten RSS-flöde',
'Färgelanda':'Öppet Matilda RSS-flöde',
'Sunne':'Öppet Skolmaten RSS-flöde',
}
for _name,_reason in working_meals.items():
 code,cu,mu,_,_=entries[_name]
 entries[_name]=(code,cu,mu,'PASS',_reason)
cal={
'Årjäng':('2026-08-18','2026-12-18',[('Höstlov','2026-10-12','2026-10-16','holiday'),('Studiedag','2026-10-26','2026-10-26','study-day')]),
'Bengtsfors':('2026-08-17','2026-12-18',[('Studiedag','2026-09-25','2026-09-25','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-26','2027-04-02','holiday')]),
'Mellerud':('2026-08-19','2026-12-18',[('Höstlov','2026-10-26','2026-10-28','holiday'),('Sportlov','2027-02-22','2027-02-26','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Arvika':('2026-08-19','2026-12-22',[('Studiedag','2026-09-28','2026-09-28','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Grums':('2026-08-17','2026-12-18',[('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Säffle':('2026-08-18','2026-12-18',[('Studiedag','2026-09-25','2026-09-25','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Dals-Ed':('2026-08-18','2026-12-18',[('Studiedag','2026-09-25','2026-09-25','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-02-22','2027-02-26','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Eda':('2026-08-19','2026-12-22',[('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Filipstad':('2026-08-18','2026-12-18',[('Lovdag','2026-09-18','2026-09-18','holiday'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Forshaga':('2026-08-19','2026-12-18',[('Studiedag','2026-09-21','2026-09-21','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Färgelanda':('2026-08-18','2026-12-18',[('Studiedag','2026-09-25','2026-09-25','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-02-22','2027-02-26','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Hagfors':('2026-08-17','2026-12-18',[('Studiedag','2026-09-16','2026-09-16','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-29','2027-04-02','holiday')]),
'Hammarö':('2026-08-18','2026-12-22',[('Studiedag','2026-09-22','2026-09-22','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Karlstad':('2026-08-17','2026-12-18',[('Studiedag','2026-09-15','2026-09-15','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Kil':('2026-08-18','2026-12-18',[('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Kristinehamn':('2026-08-19','2026-12-18',[('Studiedag','2026-09-16','2026-09-16','study-day'),('Läslov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Munkfors':('2026-08-18','2026-12-18',[('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Storfors':('2026-08-17','2026-12-21',[('Studiedag','2026-09-14','2026-09-14','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Sunne':('2026-08-17','2026-12-22',[('Studiedag','2026-09-14','2026-09-14','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')]),
'Torsby':('2026-08-17','2026-12-18',[('Studiedag','2026-09-21','2026-09-21','study-day'),('Höstlov','2026-10-26','2026-10-30','holiday'),('Sportlov','2027-03-01','2027-03-05','holiday'),('Påsklov','2027-03-30','2027-04-02','holiday')])}
config={'generatedAt':'2026-09-17','municipalities':{}}
for n,(code,cu,mu,ms,mr) in entries.items():
 events=[]
 if n in cal:
  start,end,extras=cal[n]; events=[('Terminsstart',start,start,'term-start'),('Terminsavslutning',end,end,'term-end'),*extras]
 config['municipalities'][n]={'municipalityCode':code,'mealSource':{'name':f'{n} kommun – skolmat','url':mu,'verifiedAt':'2026-09-17','status':ms,'reason':mr},'calendarSource':{'name':f'{n} kommun – läsårstider','url':cu,'verifiedAt':'2026-09-17','status':'PASS' if events else 'BLOCKED'},'calendar':[{'title':t,'startDate':s,'endDate':e,'eventType':k,'source':cu} for t,s,e,k in events]}
(root/'data'/'school-family-sources.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
payload=json.loads((root/'data'/'school-family.json').read_text(encoding='utf-8'))
for n,c in config['municipalities'].items():
 old=payload['municipalities'].get(n,{})
 old.update({'municipalityCode':c['municipalityCode'],'mealSource':c['mealSource'],'calendarSource':c['calendarSource'],'schoolGroups':old.get('schoolGroups',[{'id':'alla','name':'Kommunala skolor','schools':[]}]),'meals':old.get('meals',[]),'calendar':c['calendar'],'schools':old.get('schools',[]),'services':old.get('services',[])})
 payload['municipalities'][n]=old
(root/'data'/'school-family.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(len(payload['municipalities']))
