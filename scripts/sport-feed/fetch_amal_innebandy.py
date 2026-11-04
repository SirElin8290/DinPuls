import json,re,urllib.request,sys,hashlib
from datetime import datetime
from zoneinfo import ZoneInfo
from html import unescape
from pathlib import Path
STOCKHOLM=ZoneInfo('Europe/Stockholm')
MONTHS={'JANUARI':1,'FEBRUARI':2,'MARS':3,'APRIL':4,'MAJ':5,'JUNI':6,'JULI':7,'AUGUSTI':8,'SEPTEMBER':9,'OKTOBER':10,'NOVEMBER':11,'DECEMBER':12}
PROGRAM='https://www.amalsibk.com/match/?ID=230024&AS=2356967'
TABLE='https://stats.innebandy.se/sasong/44/serie/44047/serietabell'
def text(value):return unescape(re.sub('<[^>]*>',' ',value)).strip()
def parse_matches(markup,source):
 selected=re.search(r'<option\b[^>]*\bselected(?:=[\"\'][^\"\']*[\"\'])?[^>]*>(.*?)</option>',markup,re.S)
 if not selected or text(selected[1])!='2026/2027: Herrar Division 3':raise ValueError('Fel eller saknad vald seniorserie')
 parts=re.split(r'<div class="sa-matches__(month|row)">',markup);month=year=None;matches=[]
 for i in range(1,len(parts),2):
  kind,body=parts[i:i+2]
  if kind=='month':
   m=re.match(r'([A-ZÅÄÖ]+)\s+(20\d\d)',text(body));month=MONTHS.get(m[1]) if m else None;year=int(m[2]) if m else None;continue
  if not month or year not in [2026,2027]:raise ValueError('Match saknar verifierad säsongsmånad')
  def field(name):
   m=re.search(r'<span class="sa-matches__'+name+r'[^\"]*">(.*?)</span>',body,re.S);return text(m[1]) if m else ''
  teams=[text(x) for x in re.findall(r'<span class="sa-matches__team-name[^\"]*">(.*?)</span>',body,re.S)]
  if len(teams)!=2 or 'Åmåls IBK' not in teams:continue
  if not re.fullmatch(r'\d{1,2}:\d{2}',field('time')):continue
  day=int(field('day'));hour,minute=map(int,field('time').split(':'));date=datetime(year,month,day,hour,minute,tzinfo=STOCKHOLM)
  scores=[int(text(x)) for x in re.findall(r'<span class="sa-matches__team-score">(.*?)</span>',body,re.S) if re.fullmatch(r'\d+',text(x))]
  finished=len(scores)==2
  matches.append({'id':hashlib.sha1((source['id']+date.isoformat()+'|'.join(teams)).encode()).hexdigest()[:20],'sourceId':source['id'],'sourceName':source['sourceName'],'sourceUrl':PROGRAM,'municipality':'Åmål','sport':'Innebandy','competition':'Herrar Division 3 2026/27','startTime':date.isoformat(),'timeTbd':False,'status':'finished' if finished else 'scheduled','homeTeam':teams[0],'awayTeam':teams[1],'homeScore':scores[0] if finished else None,'awayScore':scores[1] if finished else None,'venue':field('place'),'updatedAt':datetime.now(STOCKHOLM).isoformat()})
 if not matches:raise ValueError('Inga verifierade seniormatcher')
 return matches

def parse_standings(payload,competition,source):
 if competition.get('CompetitionID')!=44047 or competition.get('SeasonID')!=44:raise ValueError('Fel serie eller säsong')
 rows=payload.get('StandingsRows')
 if not isinstance(rows,list) or not any(r.get('TeamName')=='Åmåls IBK' for r in rows):raise ValueError('Åmål saknas i tabellen')
 result=[]
 for row in rows:
  fields=['Position','PlayedMatchesHome','PlayedMatchesAway','WinsHome','WinsAway','DrawsHome','DrawsAway','LossesHome','LossesAway','Points','ScoringDiff','GoalsScoredHome','GoalsScoredAway','GoalsAgainstHome','GoalsAgainstAway']
  if any(not isinstance(row.get(k),int) for k in fields):raise ValueError('Ofullständig tabellrad')
  result.append({'position':row['Position'],'team':row['TeamName'],'played':row['PlayedMatchesHome']+row['PlayedMatchesAway'],'won':row['WinsHome']+row['WinsAway'],'drawn':row['DrawsHome']+row['DrawsAway'],'lost':row['LossesHome']+row['LossesAway'],'goalsFor':row['GoalsScoredHome']+row['GoalsScoredAway'],'goalsAgainst':row['GoalsAgainstHome']+row['GoalsAgainstAway'],'goalDifference':row['ScoringDiff'],'points':row['Points']})
 return [{'id':source['id']+'-table','sourceId':source['id'],'sourceName':'Svensk Innebandy','sourceUrl':TABLE,'municipality':'Åmål','sport':'Innebandy','competition':'Herrar Division 3 2026/27','updatedAt':datetime.now(STOCKHOLM).isoformat(),'rows':result}]

def collect(source):
 with urllib.request.urlopen(urllib.request.Request(PROGRAM,headers={'User-Agent':'DinPuls/1.0 (+https://dinpuls.se/)'}),timeout=25) as r:markup=r.read().decode('utf8')
 matches=parse_matches(markup,source)
 from playwright.sync_api import sync_playwright
 responses={}
 with sync_playwright() as p:
  browser=p.chromium.launch();page=browser.new_page()
  def capture(response):
   base='https://api.innebandy.se/v2/api/public/competitions/44047'
   if response.url in [base,base+'/standings'] and response.ok:
    responses['table' if response.url.endswith('/standings') else 'competition']=response.json()
  page.on('response',capture);page.goto(TABLE,wait_until='domcontentloaded',timeout=45000)
  for _ in range(40):
   if 'table' in responses and 'competition' in responses:break
   page.wait_for_timeout(250)
  browser.close()
 if 'table' not in responses or 'competition' not in responses:raise ValueError('Officiell tabell kunde inte verifieras')
 return {'matches':matches,'standings':parse_standings(responses['table'],responses['competition'],source)}
if __name__=='__main__':
 source=json.loads(sys.argv[1]);print(json.dumps(collect(source),ensure_ascii=False))
