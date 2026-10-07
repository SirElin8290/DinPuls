import tempfile, unittest, json
from pathlib import Path
from datetime import datetime, timezone
from urllib.error import HTTPError
from unittest.mock import patch
import check_public_sources as s
class SourceTests(unittest.TestCase):
    now=datetime(2026,10,7,1,tzinfo=timezone.utc)
    src={'url':'https://example.org/club','contexts':[],'reviewChanges':True}
    def ok(self,url): return {'status':200,'finalUrl':url,'fingerprint':'a'}
    def test_redirect_remains_usable_without_rewriting(self):
        row=s.inspect(self.src,{},self.now,lambda u:{'status':200,'finalUrl':'https://example.org/new','fingerprint':'a'})
        self.assertEqual(row['state'],'reachable');self.assertTrue(row['redirected']);self.assertEqual(row['url'],self.src['url'])
    def test_retry_recovers_without_warning(self):
        calls=[]
        def fetch(u):
            calls.append(u)
            if len(calls)==1: raise TimeoutError()
            return self.ok(u)
        row=s.inspect(self.src,{},self.now,fetch);self.assertEqual(row['state'],'reachable');self.assertEqual(len(calls),2)
    def test_broken_requires_two_runs_and_recovers(self):
        def bad(u): raise HTTPError(u,404,'missing',{},None)
        first=s.inspect(self.src,{},self.now,bad); self.assertEqual(first['state'],'unverified')
        second=s.inspect(self.src,{self.src['url']:first},self.now,bad);self.assertEqual(second['state'],'broken')
        recovered=s.inspect(self.src,{self.src['url']:second},self.now,self.ok);self.assertEqual(recovered['consecutiveFailures'],0)
    def test_access_block_is_not_claimed_dead(self):
        row=s.inspect(self.src,{self.src['url']:{'consecutiveFailures':5}},self.now,lambda u:{'status':403,'problem':'http_error'})
        self.assertEqual(row['state'],'unverified')
    def test_content_change_stays_pending_and_dynamic_is_not_alarm(self):
        prior={self.src['url']:{'baselineFingerprint':'old'}}
        row=s.inspect(self.src,prior,self.now,self.ok);self.assertEqual(row['state'],'changed');self.assertEqual(row['baselineFingerprint'],'old')
        row=s.inspect({**self.src,'reviewChanges':False},prior,self.now,self.ok);self.assertEqual(row['state'],'reachable')
    def test_non_public_destination_and_credentials_rejected(self):
        self.assertIsNone(s.canonical('https://user:pass@example.org/a'))
        with patch('socket.getaddrinfo',return_value=[(None,None,None,None,('127.0.0.1',80))]):
            with self.assertRaises(ValueError): s.check_public('https://example.org/a')
        with self.assertRaises(ValueError): s.check_public('http://localhost/a')
    def test_error_page_detection_and_template_noise(self):
        p=s.Text();p.feed('<title>Sidan hittades inte</title><nav>clock changes</nav><main>Hello</main>')
        self.assertTrue(s.SOFT_ERROR.search(' '.join(p.title)));self.assertNotIn('clock changes',' '.join(p.parts))
    def test_only_public_associations_and_menu_week_are_checked(self):
        with tempfile.TemporaryDirectory() as tmp:
            d=Path(tmp);write=lambda f,x:(d/f).write_text(json.dumps(x),encoding='utf-8')
            write('municipalities.json',{'municipalities':[{'name':'Åmål','website':'https://amal.se/'}]})
            write('sports.json',{'municipalities':{'Åmål':{'clubs':[{'name':'Club','description':'Sport','url':'https://example.org/club'},{'name':'Hidden','url':'https://example.org/hidden'}]}}})
            write('leisure.json',{'municipalities':{}})
            for f in ['news.json','events.json','school-family.json']:write(f,{'generatedAt':self.now.isoformat(),'municipalities':{}})
            write('lunch.json',{'generatedAt':self.now.isoformat(),'municipalities':{'Åmål':{'restaurants':[{'name':'Lunch','status':'current','weekNumber':40,'url':'https://example.org/menu'}]}}})
            sources=s.collect(d);self.assertNotIn('https://example.org/hidden',[x['url'] for x in sources]);self.assertIn('https://example.org/club',[x['url'] for x in sources])
            issues=s.content_issues(d,self.now);self.assertEqual(issues[0]['kind'],'menu_unverified')
            report=s.build(d,{},self.now,self.ok,2);self.assertEqual(report['summary']['reachable'],3);self.assertTrue(report['completed'])
if __name__=='__main__':unittest.main()
