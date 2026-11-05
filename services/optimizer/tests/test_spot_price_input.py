# SPDX-License-Identifier: AGPL-3.0-only
import unittest
from datetime import datetime,UTC,timedelta
from decimal import Decimal as D
from flexexa_optimizer.spot_price_input import priced_slots
from flexexa_optimizer.charging_cost import PriceComponents
class SpotInputTests(unittest.TestCase):
 def setUp(self):
  self.now=datetime(2026,11,5,tzinfo=UTC);self.tariff=PriceComponents(D(9),D('.1'),D('.2'),D('.3'),D('.25'),version='test-tariff')
  self.day={'source':'elprisetjustnu.se','currency':'SEK','unit':'kWh','vat_included':False,'area':'SE3','date':'2026-11-05','fetched_at':self.now.isoformat(),'intervals':[{'starts_at':(self.now+timedelta(minutes=i*15)).isoformat(),'ends_at':(self.now+timedelta(minutes=(i+1)*15)).isoformat(),'spot_sek_per_kwh_ex_vat':'-0.1'} for i in range(96)]}
 def run_slots(self,**kw):return priced_slots(self.day,expected_area='SE3',expected_date='2026-11-05',now=kw.get('now',self.now),maximum_age=timedelta(minutes=5),headroom_by_start={},voltage_v=(D(230),)*3,tariff=self.tariff)
 def test_no_implicit_grid_budget_and_explicit_added_tariff(self):
  s=self.run_slots()[0];self.assertIsNone(s.headroom_a);self.assertEqual(s.price.market,D('-.1'));self.assertEqual(s.price.grid_transfer,D('.2'))
 def test_stale_rejected(self):
  with self.assertRaises(ValueError):self.run_slots(now=self.now+timedelta(minutes=6))
 def test_including_vat_rejected(self):
  self.day['vat_included']=True
  with self.assertRaises(ValueError):self.run_slots()
 def test_gap_rejected(self):
  self.day['intervals'].pop(2)
  with self.assertRaises(ValueError):self.run_slots()
