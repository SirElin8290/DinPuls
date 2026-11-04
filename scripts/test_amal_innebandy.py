import json,unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('amal',Path(__file__).parent/'sport-feed/fetch_amal_innebandy.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
class AmalSportTests(unittest.TestCase):
 def setUp(self):self.source={'id':'ibis-amals-ibk','sourceName':'Åmåls IBK'}
 def test_month_year_and_scores_are_read_not_guessed(self):
  markup='<option selected>2026/2027: Herrar Division 3</option><div class="sa-matches__month">NOVEMBER 2026</div><div class="sa-matches__row"><span class="sa-matches__day">6</span><span class="sa-matches__time">19:30</span><span class="sa-matches__team-name">Åmåls IBK</span><span class="sa-matches__team-name">Dotteviks IF</span><span class="sa-matches__place">Karlbergshallen Åmål</span></div>'
  rows=a.parse_matches(markup,self.source);self.assertEqual(rows[0]['startTime'],'2026-11-06T19:30:00+01:00');self.assertIsNone(rows[0]['homeScore']);self.assertEqual(rows[0]['venue'],'Karlbergshallen Åmål')
  with self.assertRaises(ValueError):a.parse_matches(markup.replace(' selected',''),self.source)
  with self.assertRaises(ValueError):a.parse_matches(markup.replace('NOVEMBER 2026','NOVEMBER'),self.source)
  with self.assertRaises(ValueError):a.parse_matches(markup.replace('Åmåls IBK','Other team'),self.source)
 def test_official_table_identity_and_missing_values(self):
  row={'TeamName':'Åmåls IBK',**{k:0 for k in ['Position','PlayedMatchesHome','PlayedMatchesAway','WinsHome','WinsAway','DrawsHome','DrawsAway','LossesHome','LossesAway','Points','ScoringDiff','GoalsScoredHome','GoalsScoredAway','GoalsAgainstHome','GoalsAgainstAway']}}
  comp={'CompetitionID':44047,'SeasonID':44};self.assertEqual(a.parse_standings({'StandingsRows':[row]},comp,self.source)[0]['rows'][0]['team'],'Åmåls IBK')
  with self.assertRaises(ValueError):a.parse_standings({'StandingsRows':[row]},{**comp,'SeasonID':43},self.source)
  with self.assertRaises(ValueError):a.parse_standings({'StandingsRows':[{**row,'Points':None}]},comp,self.source)
if __name__=='__main__':unittest.main()
