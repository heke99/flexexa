# SPDX-License-Identifier: AGPL-3.0-only
import unittest
from dataclasses import replace
from datetime import UTC,datetime,timedelta
from decimal import Decimal as D
from flexexa_optimizer.plan_summary import EnergyInterval,summarize_intervals
class SummaryTests(unittest.TestCase):
 def setUp(self):self.row=EnergyInterval('t','s','car',datetime(2026,10,25,0,tzinfo=UTC),datetime(2026,10,25,0,15,tzinfo=UTC),'planned',D(4),D(2))
 def run_summary(self,*rows):return summarize_intervals(rows,tenant_id='t',site_id='s')
 def test_variable_duration(self):
  result=self.run_summary(self.row,replace(self.row,starts_at=self.row.ends_at,ends_at=self.row.ends_at+timedelta(minutes=30)))[0]
  self.assertEqual(result.energy_kwh,D(3));self.assertEqual(result.energy_cost,D(6))
 def test_missing_price_not_partial_cost(self):
  result=self.run_summary(replace(self.row,price_per_kwh=None))[0]
  self.assertEqual(result.energy_kwh,D(1));self.assertIsNone(result.energy_cost)
 def test_unknown_power_not_zero(self):
  result=self.run_summary(replace(self.row,power_kw=None))[0]
  self.assertIsNone(result.energy_kwh);self.assertFalse(result.energy_complete)
 def test_planned_and_measured_not_combined(self):self.assertEqual(len(self.run_summary(self.row,replace(self.row,kind='measured'))),2)
 def test_duplicate_rejected(self):
  with self.assertRaises(ValueError):self.run_summary(self.row,self.row)
 def test_gap_remains_separate(self):self.assertEqual(len(self.run_summary(self.row,replace(self.row,starts_at=self.row.starts_at+timedelta(hours=1),ends_at=self.row.ends_at+timedelta(hours=1)))),2)
 def test_repeated_local_hour_has_real_elapsed_energy(self):
  row=replace(self.row,starts_at=datetime.fromisoformat('2026-10-25T02:00:00+02:00'),ends_at=datetime.fromisoformat('2026-10-25T02:00:00+01:00'))
  self.assertEqual(self.run_summary(row)[0].energy_kwh,D(4))
 def test_foreign_scope_rejected(self):
  with self.assertRaises(PermissionError):self.run_summary(replace(self.row,tenant_id='other'))
 def test_negative_prices_allowed(self):self.assertEqual(self.run_summary(replace(self.row,price_per_kwh=D(-1)))[0].energy_cost,D(-1))
