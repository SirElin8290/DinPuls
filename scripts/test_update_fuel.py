import unittest
import update_fuel as fuel
class AmalFuelTests(unittest.TestCase):
 def test_static_tariff_is_not_stamped_as_verified_amal_price(self):
  node={'id':1,'lat':59.05,'lon':12.7,'tags':{'amenity':'charging_station','operator':'Circle K'}}
  place={'name':'Åmål','latitude':59.05,'longitude':12.7}
  row=fuel.normalize(node,place)
  self.assertIsNone(row['price']);self.assertIsNone(row['priceCheckedAt'])
  self.assertEqual(row['sourceUrl'],'https://www.openstreetmap.org/node/1')
  self.assertEqual(row['priceType'],'missing')
  self.assertEqual(fuel.normalize(node,{**place,'name':'Other'})['price'],5.59)
if __name__=='__main__':unittest.main()
