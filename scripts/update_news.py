#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, re, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
NEWS=ROOT/'data'/'news.json'
FEEDS=[
  dict(url='https://rss.dw.com/rdf/rss-en-world',scope='world',source='Deutsche Welle',sourceType='media',quality=96,impact=70,category='Världen',region='Världen'),
  dict(url='https://rss.dw.com/rdf/rss-en-eu',scope='world',source='Deutsche Welle Europe',sourceType='media',quality=96,impact=65,category='Europa',region='Europa'),
]

def text(node,names):
  for name in names:
    found=node.find(name)
    if found is not None and found.text:return re.sub(r'<[^>]+>','',found.text).strip()
  for child in node:
    if child.tag.split('}')[-1] in names and child.text:return re.sub(r'<[^>]+>','',child.text).strip()
  return ''
def date_iso(raw):
  try:return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
  except Exception:return datetime.now(timezone.utc).isoformat()
def fetch(feed):
  req=urllib.request.Request(feed['url'],headers={'User-Agent':'DinPuls/0.7 (+https://sirelin8290.github.io/DinPuls/)'})
  with urllib.request.urlopen(req,timeout=20) as response: data=response.read()
  root=ET.fromstring(data); items=[]
  for node in root.iter():
    if node.tag.split('}')[-1] not in ('item','entry'):continue
    title=text(node,['title']); link=text(node,['link']);
    if not link:
      for c in node:
        if c.tag.split('}')[-1]=='link' and c.attrib.get('href'):link=c.attrib['href'];break
    summary=text(node,['description','summary','content']); published=text(node,['pubDate','published','updated','date'])
    if not title or not link:continue
    item={k:v for k,v in feed.items() if k!='url'}
    item.update(id='feed-'+hashlib.sha1((feed['source']+link).encode()).hexdigest()[:14],title=title,summary=summary[:260],access='free',publishedAt=date_iso(published),url=link,municipalities=[],important=False)
    items.append(item)
  return items[:12]
def main():
  data=json.loads(NEWS.read_text(encoding='utf-8'))
  previous=data.get('articles',[])
  fallback=[a for a in previous if not str(a.get('id','')).startswith('feed-')]
  fetched=[]; successful_sources=set()
  for feed in FEEDS:
    try:
      rows=fetch(feed); fetched.extend(rows); successful_sources.add(feed['source']); print(feed['source'],len(rows))
    except Exception as exc: print('VARNING',feed['source'],exc)
  retained=[a for a in previous if str(a.get('id','')).startswith('feed-') and a.get('source') not in successful_sources]
  articles=fallback+retained+fetched
  if articles == previous:
    print('Inga nyhetsförändringar; lämnar news.json orörd')
    return
  data['articles']=articles
  data['generatedAt']=datetime.now(timezone.utc).isoformat()
  NEWS.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':main()
