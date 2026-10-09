#!/usr/bin/env python3
"""Nightly public-source checks. Never invent facts or replace unverified URLs."""
from __future__ import annotations
import argparse, hashlib, ipaddress, json, re, socket, threading, urllib.request, urllib.error
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, quote
ROOT = Path(__file__).resolve().parents[1]
STATIC_FILES = ['municipalities.json','practical.json','family-places.json','school-family.json','emergency-municipalities.json','emergency-national.json','authorities.json','health.json','health-private.json','health-private-supplement.json','health-local-supplement.json','service.json','service-launch-supplement.json','service-private-supplement.json','important-sources.json']
DYNAMIC_FILES = ['event-sources.json','events.json','news.json','lunch.json','lunch-sources.json','school-family-sources.json']
URL_KEYS = {'url','website','sourceUrl','primaryUrl','externalUrl','directoryUrl','associationDirectoryUrl','facebook','instagram','link','menuUrl','source','feedUrl','rss','listingUrl'}
SOFT_ERROR = re.compile(r'(?:page not found|sidan (?:kunde inte|kan inte|hittades inte)|404\s*[-–: ]\s*(?:not found|sidan)|access denied|request rejected|verify you are human|just a moment)', re.I)
class Text(HTMLParser):
    def __init__(self): super().__init__(); self.skip=0; self.parts=[]; self.title=[]; self.in_title=False
    def handle_starttag(self, tag, attrs):
        if tag in {'script','style','nav','footer','header','noscript','svg'}: self.skip+=1
        if tag=='title': self.in_title=True
    def handle_endtag(self, tag):
        if tag in {'script','style','nav','footer','header','noscript','svg'}: self.skip=max(0,self.skip-1)
        if tag=='title': self.in_title=False
    def handle_data(self, data):
        if not self.skip: self.parts.append(data)
        if self.in_title: self.title.append(data)
def canonical(url):
    p=urlsplit(str(url).strip())
    if p.scheme not in {'http','https'} or not p.hostname or p.username or p.password: return None
    try:
        host=p.hostname.encode('idna').decode('ascii')
        netloc=('['+host+']') if ':' in host else host
        if p.port: netloc+=':'+str(p.port)
        return urlunsplit((p.scheme,netloc,quote(p.path or '/',safe="/:@!$&'()*+,;=-._~%"),quote(p.query,safe="=&?/:@!$'()*+,;~-._%"),''))
    except (ValueError,UnicodeError): return None
def check_public(url):
    p=urlsplit(url); host=p.hostname
    if not canonical(url) or p.port not in {None,80,443} or host in {'localhost'} or host.endswith(('.local','.internal')): raise ValueError('non_public_url')
    addresses={x[4][0] for x in socket.getaddrinfo(host,p.port or (443 if p.scheme=='https' else 80),type=socket.SOCK_STREAM)}
    if not addresses or any(not ipaddress.ip_address(x).is_global for x in addresses): raise ValueError('non_public_address')
class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_public(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)
def fetch(url):
    check_public(url)
    req=urllib.request.Request(url,headers={'User-Agent':'DinPuls-Source-Monitor/1.0 (+https://dinpuls.se/)', 'Accept':'text/html,application/pdf,application/json;q=0.9,*/*;q=0.5'})
    with urllib.request.build_opener(PublicRedirect()).open(req,timeout=14) as r:
        limit=16_000_000 if r.headers.get_content_type()=='application/pdf' else 2_000_000
        body=r.read(limit+1)
        if len(body)>limit: return {'status':r.status,'finalUrl':r.url,'problem':'response_too_large'}
        mime=r.headers.get_content_type(); title=''; content=body
        if mime in {'text/html','application/xhtml+xml'}:
            parser=Text(); parser.feed(body.decode(r.headers.get_content_charset() or 'utf-8',errors='replace'))
            title=' '.join(parser.title).strip(); content=re.sub(r'\s+',' ',' '.join(parser.parts)).strip().encode()
            if SOFT_ERROR.search(title) or (len(content)<1200 and SOFT_ERROR.search(content.decode())): return {'status':r.status,'finalUrl':r.url,'title':title,'problem':'error_or_access_page'}
        return {'status':r.status,'finalUrl':r.url,'title':title[:220],'fingerprint':hashlib.sha256(content).hexdigest(),'contentType':mime}
def publishable(row):
    desc=str(row.get('description','')).strip()
    return bool(desc) and 'bedriver lokal medlemsverksamhet' not in desc.lower() and str(row.get('status','active')).lower() in {'active','active_verified'}
def collect(data_dir):
    found={}
    def walk(node, filename, municipality='', entity=''):
        if isinstance(node,dict):
            municipality=node.get('municipality') or municipality; entity=node.get('name') or node.get('title') or entity
            for key,value in node.items():
                if isinstance(value,str) and (key in URL_KEYS or re.search(r'\.pdf(?:\?|$)',value,re.I)):
                    url=canonical(value)
                    if url and not urlsplit(url).hostname.endswith(('dinpuls.se','workers.dev')):
                        row=found.setdefault(url,{'url':url,'contexts':[],'reviewChanges':False})
                        context={'file':filename,'municipality':municipality,'entity':entity}
                        if context not in row['contexts']: row['contexts'].append(context)
                        row['reviewChanges'] |= filename not in DYNAMIC_FILES
                else: walk(value,filename,key if key in names else municipality,entity)
        elif isinstance(node,list):
            for value in node: walk(value,filename,municipality,entity)
    cfg=json.loads((data_dir/'municipalities.json').read_text(encoding='utf-8')); names={x['name'] for x in cfg['municipalities']}
    for filename in STATIC_FILES+DYNAMIC_FILES:
        p=data_dir/filename
        if p.exists(): walk(json.loads(p.read_text(encoding='utf-8')),filename)
    for filename,key in [('sports.json','clubs'),('leisure.json','activities')]:
        data=json.loads((data_dir/filename).read_text(encoding='utf-8'))
        for municipality,row in data.get('municipalities',{}).items():
            for item in row.get(key,[]):
                if publishable(item): walk(item,filename,municipality,item.get('name',''))
    return sorted(found.values(),key=lambda x:x['url'])
def inspect(source,previous,now,fetcher=fetch):
    prior=previous.get(source['url'],{}); result={**source,'checkedAt':now.isoformat(timespec='seconds')}; observation={}
    for attempt in range(2):
        try:
            observation=fetcher(source['url'])
            if observation.get('status')==200 and not observation.get('problem'): break
        except urllib.error.HTTPError as error: observation={'status':error.code,'problem':'http_error'}
        except Exception as error: observation={'status':None,'problem':type(error).__name__}
    result.update(observation)
    healthy=result.get('status')==200 and not result.get('problem')
    result['consecutiveFailures']=0 if healthy else prior.get('consecutiveFailures',0)+1
    result['lastSuccessfulAt']=now.isoformat(timespec='seconds') if healthy else prior.get('lastSuccessfulAt')
    result['baselineFingerprint']=prior.get('baselineFingerprint') or (result.get('fingerprint') if healthy else None)
    result['changed']=bool(healthy and result['baselineFingerprint'] and result.get('fingerprint')!=result['baselineFingerprint'])
    if not healthy:
        result['state']='broken' if result.get('status') in {404,410} and result['consecutiveFailures']>=2 else 'unverified'
    elif source['reviewChanges'] and result['changed']: result['state']='changed'
    else: result['state']='reachable'
    # A successful redirect keeps the existing URL working. It is not a licence to rewrite facts.
    result['redirected']=bool(healthy and canonical(result.get('finalUrl',''))!=source['url'])
    return result
def content_issues(data_dir,now):
    issues=[]; today=now.astimezone(__import__('zoneinfo').ZoneInfo('Europe/Stockholm')); week=today.isocalendar().week
    for filename,max_age in [('news.json',24),('events.json',30),('lunch.json',30),('school-family.json',48)]:
        data=json.loads((data_dir/filename).read_text(encoding='utf-8')); stamp=data.get('generatedAt') or data.get('updatedAt'); age=None
        try: age=(now-datetime.fromisoformat(stamp.replace('Z','+00:00')).replace(tzinfo=timezone.utc) if 'T' not in stamp else now-datetime.fromisoformat(stamp.replace('Z','+00:00'))).total_seconds()/3600
        except (ValueError,TypeError,AttributeError): pass
        if age is None or age>max_age: issues.append({'kind':'stale_import','file':filename,'municipality':'','entity':filename,'message':'Uppdateringen saknar aktuell tidsstämpel eller har blivit för gammal.'})
        for municipality,row in data.get('municipalities',{}).items():
            if filename=='lunch.json':
                for item in row.get('restaurants',[]):
                    if (item.get('status') in {'outdated','review_required','source_error'} or (item.get('status')=='unavailable' and not item.get('closureNotice'))) or (item.get('status')=='current' and item.get('weekNumber')!=week): issues.append({'kind':'menu_unverified','file':filename,'municipality':municipality,'entity':item.get('name',''),'message':'Aktuell veckomeny kunde inte verifieras. Ingen ny meny gissas.'})
            if filename=='school-family.json' and today.weekday()<5:
                exceptions=json.loads((data_dir/'reporting-exceptions.json').read_text(encoding='utf-8')).get('entries',[]) if (data_dir/'reporting-exceptions.json').exists() else []
                accepted=any(x.get('municipality')==municipality and x.get('module')=='schoolMeals' for x in exceptions)
                if row.get('mealSource') and not accepted and not any(x.get('date')==today.date().isoformat() for x in row.get('meals',[])):
                    issues.append({'kind':'school_menu_unverified','file':filename,'municipality':municipality,'entity':'Skolmat','message':'Ingen verifierad skolmatsrad för dagens datum. Lov/stängning kan vara orsaken; kontrollera källan.'})
            if filename=='events.json':
                future=[x for x in row.get('events',[]) if str(x.get('endDate') or x.get('startDate') or '')[:10]>=today.date().isoformat()]
                if not future and row.get('sourceHealth'):
                    issues.append({'kind':'empty_calendar','file':filename,'municipality':municipality,'entity':'Evenemang','message':'Kalendern saknar kommande evenemang. Kontrollera källans publicerade innehåll och hämtformat; tom HTML bevisar inte att evenemang saknas.'})
                for item in row.get('events',[]):
                    if not item.get('startDate') or not item.get('url'): issues.append({'kind':'event_invalid','file':filename,'municipality':municipality,'entity':item.get('title',''),'message':'Evenemang saknar datum eller källänk.'})
    return issues
def build(data_dir,previous,now=None,fetcher=fetch,workers=8,checkpoint=None):
    now=now or datetime.now(timezone.utc); sources=collect(data_dir); grouped={}
    for source in sources: grouped.setdefault(urlsplit(source['url']).hostname,deque()).append(source)
    sources=[]
    while grouped:
        for host in list(grouped):
            sources.append(grouped[host].popleft())
            if not grouped[host]: del grouped[host]
    old={x['url']:x for x in previous.get('sources',[])}; locks={urlsplit(x['url']).hostname:threading.Semaphore(2) for x in sources}
    blocked={}
    def run(source):
        host=urlsplit(source['url']).hostname
        with locks[host]:
            prior=old.get(source['url'],{})
            try: age=(now-datetime.fromisoformat(prior.get('checkedAt',''))).total_seconds()/3600
            except (ValueError,TypeError): age=999
            if previous.get('completed') and prior.get('state')=='reachable' and 0<=age<6 and prior.get('reviewChanges')==source['reviewChanges']:
                return {**prior,**source,'checkMode':'recent_success_reused'}
            if blocked.get(host,0)>=3:
                result=inspect(source,old,now,lambda u:{'status':None,'problem':'host_checks_suspended'})
                result['checkMode']='host_access_blocked';return result
            result=inspect(source,old,now,fetcher);result['checkMode']='direct'
            if result.get('status') in {403,429,451,500,502,503,504} or result.get('problem') in {'TimeoutError','URLError','gaierror'}:
                blocked[host]=blocked.get(host,0)+1
            else: blocked[host]=0
            return result
    results=[]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        pending=[pool.submit(run,source) for source in sources]
        for future in as_completed(pending):
            results.append(future.result())
            if checkpoint and len(results)%100==0:
                partial={'version':'1.0.0','generatedAt':now.isoformat(timespec='seconds'),'completed':False,'summary':{'checked':len(results),'total':len(sources)},'sources':sorted(results,key=lambda x:x['url']),'contentIssues':[]}
                checkpoint(partial)
                print(f'Kontrollerade {len(results)}/{len(sources)} källor',flush=True)
    results.sort(key=lambda x:x['url'])
    counts={state:sum(x['state']==state for x in results) for state in ['reachable','changed','unverified','broken']}
    issues=content_issues(data_dir,now)
    return {'version':'1.0.0','generatedAt':now.isoformat(timespec='seconds'),'schedule':'01:00 Europe/Stockholm','completed':True,'summary':{**counts,'total':len(results),'contentWarnings':len(issues)},'sources':results,'contentIssues':issues,'notice':'Nåbar källa är inte samma sak som verifierade aktuella fakta. Ändrade statiska källor granskas; inga uppgifter gissas.'}
def markdown(report):
    lines=['# DinPuls nattkontroll', '', 'Kontrollerad: '+report['generatedAt'], '', '## Resultat', '',str(report['summary']), '', '## Källor som behöver granskas', '', '| Kommun / verksamhet | Status | Källa |','|---|---|---|']
    for row in report['sources']:
        if row['state']=='reachable': continue
        contexts='; '.join(sorted({(x['municipality']+' – '+x['entity']).strip(' –') for x in row['contexts']}))
        lines.append('| '+contexts.replace('|','/')+' | '+row['state']+' | '+row['url'].replace('|','%7C')+' |')
    lines+=['','## Innehåll och uppdateringar','']+[x['municipality']+' – '+x['entity']+': '+x['message'] for x in report['contentIssues']]
    return '\n'.join(lines)+'\n'
def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--data-dir',type=Path,default=ROOT/'data'); parser.add_argument('--output',type=Path,default=ROOT/'data/source-monitor.json'); parser.add_argument('--report',type=Path,default=ROOT/'docs/SOURCE-MONITOR-LATEST.md'); parser.add_argument('--inventory-only',action='store_true'); args=parser.parse_args()
    if args.inventory_only: print(json.dumps({'sources':len(collect(args.data_dir))})); return
    previous=json.loads(args.output.read_text(encoding='utf-8')) if args.output.exists() else {}
    def checkpoint(partial):
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(partial,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text('# DinPuls nattkontroll – OFULLSTÄNDIG\n\n'+str(partial['summary'])+'\n',encoding='utf-8')
    result=build(args.data_dir,previous,checkpoint=checkpoint)
    args.output.parent.mkdir(parents=True,exist_ok=True); args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); args.report.parent.mkdir(parents=True,exist_ok=True); args.report.write_text(markdown(result),encoding='utf-8'); print(json.dumps(result['summary']))
if __name__=='__main__': main()
