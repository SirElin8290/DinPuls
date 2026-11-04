"""Read-only production-adapter verification; never rewrites municipality data."""
import json
from datetime import datetime
from pathlib import Path
import importlib.util
import update_lunch as lunch
ROOT=Path(__file__).resolve().parents[1]
def main():
 source=next(s for s in json.loads((ROOT/'data/lunch-sources.json').read_text(encoding='utf8'))['municipalities']['Åmål'] if s['id']=='dalslands-skafferi')
 now=datetime.now(lunch.TIMEZONE)
 week,days,url=lunch.fetch_ocr_menu(source,now=now)
 assert week in {now.isocalendar().week,(now+lunch.timedelta(days=7)).isocalendar().week},'Menu week not current or next'
 assert all(days.get(k) for k in ['monday','tuesday','wednesday','thursday','friday']),'Missing weekday dishes'
 print('Skafferi native OCR verified: week',week,'five weekdays',url,flush=True)
 spec=importlib.util.spec_from_file_location('amal_sport',ROOT/'scripts/sport-feed/fetch_amal_innebandy.py');sport=importlib.util.module_from_spec(spec);spec.loader.exec_module(sport)
 source=next(s for s in json.loads((ROOT/'data/sport-sources.json').read_text(encoding='utf8'))['municipalities']['Åmål'] if s['id']=='ibis-amals-ibk')
 result=sport.collect(source)
 assert result['matches'] and result['standings']
 print('Åmåls IBK verified:',len(result['matches']),'matches and',len(result['standings']),'table',flush=True)
if __name__=='__main__':main()
