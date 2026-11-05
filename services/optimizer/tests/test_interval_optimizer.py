# SPDX-License-Identifier: AGPL-3.0-only
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from dataclasses import replace
from datetime import UTC,datetime,timedelta
from decimal import Decimal as D
from flexexa_optimizer.charging_cost import PriceComponents,quote_energy
from flexexa_optimizer.interval_optimizer import PlanningSlot,PlanningVehicle,optimize_intervals

class IntervalTests(unittest.TestCase):
 def setUp(self):
  self.n=datetime(2026,11,5,tzinfo=UTC)
  self.price=PriceComponents(D(1),D('.1'),D('.2'),D('.3'),D('.25'))
  self.slot=PlanningSlot(self.n,self.n+timedelta(hours=1),(16,16,16),(D(230),)*3,self.price)
  self.car=PlanningVehicle('t','s','car','connector',(0,),6,16,D('1.38'),D('1.38'),self.n,self.n+timedelta(hours=2))
 def run_plan(self,cars=None,slots=None):return optimize_intervals(cars or [self.car],slots or [self.slot],tenant_id='t',site_id='s')
 def test_cheapest_slot(self):
  cheap=replace(self.slot,starts_at=self.slot.ends_at,ends_at=self.car.departure_at,price=replace(self.price,market=D('.1')))
  r=self.run_plan(slots=[self.slot,cheap]);self.assertEqual(r.status,'optimal');self.assertEqual(r.intervals[0].starts_at,cheap.starts_at);self.assertFalse(r.physical_charging_verified)
 def test_shared_phase_cannot_oversubscribe(self):
  car=replace(self.car,asset_id='other',connector_id='other')
  r=self.run_plan([self.car,car]);self.assertEqual(r.status,'optimal');self.assertLessEqual(sum(x.current_a for x in r.intervals),16)
 def test_infeasible_combined_demand(self):
  cars=[replace(self.car,required_input_kwh=D('2.3'),maximum_input_kwh=D('2.3')),replace(self.car,asset_id='other',connector_id='other',required_input_kwh=D('2.3'),maximum_input_kwh=D('2.3'))]
  self.assertEqual(self.run_plan(cars).status,'infeasible')
 def test_unknown_headroom_blocks(self):self.assertEqual(self.run_plan(slots=[replace(self.slot,headroom_a=None)]).status,'infeasible')
 def test_deadline_blocks_late_slot(self):self.assertEqual(self.run_plan([replace(self.car,departure_at=self.n+timedelta(minutes=30))]).status,'infeasible')
 def test_negative_price_respects_energy_ceiling(self):
  r=self.run_plan(slots=[replace(self.slot,price=replace(self.price,market=D(-5)))])
  self.assertEqual(sum(x.input_energy_kwh for x in r.intervals),D('1.38'))
 def test_zero_ceiling_no_charge(self):self.assertEqual(self.run_plan([replace(self.car,required_input_kwh=D(0),maximum_input_kwh=D(0))]).intervals,())
 def test_duplicate_connector(self):
  with self.assertRaises(ValueError):self.run_plan([self.car,replace(self.car,asset_id='other')])
 def test_foreign_tenant(self):
  with self.assertRaises(PermissionError):self.run_plan([replace(self.car,tenant_id='other')])
 def test_overlapping_intervals(self):
  with self.assertRaises(ValueError):self.run_plan(slots=[self.slot,self.slot])
 def test_boolean_headroom_rejected(self):
  with self.assertRaises(ValueError):self.run_plan(slots=[replace(self.slot,headroom_a=(True,16,16))])
 def test_quarter_hour_energy(self):
  r=self.run_plan([replace(self.car,required_input_kwh=D('.345'),maximum_input_kwh=D('.345'))],[replace(self.slot,ends_at=self.n+timedelta(minutes=15))])
  self.assertEqual(r.status,'optimal');self.assertEqual(r.intervals[0].input_energy_kwh,D('.345'))
 def test_timeout_emits_no_partial_schedule(self):
  with patch('scipy.optimize.milp',return_value=SimpleNamespace(status=1,x=[6,1])):
   r=self.run_plan();self.assertEqual(r.status,'solver_not_optimal');self.assertEqual(r.intervals,())
 def test_independent_postvalidation_rejects_overcurrent(self):
  with patch('scipy.optimize.milp',return_value=SimpleNamespace(status=0,x=[17,1])):
   self.assertEqual(self.run_plan().status,'invalid_solver_result')
 def test_independent_postvalidation_rejects_energy_shortfall(self):
  with patch('scipy.optimize.milp',return_value=SimpleNamespace(status=0,x=[0,0])):
   self.assertEqual(self.run_plan().status,'invalid_solver_result')

class CostTests(unittest.TestCase):
 def setUp(self):self.p=PriceComponents(D(1),D('.1'),D('.2'),D('.3'),D('.25'))
 def test_component_split(self):
  q=quote_energy(D(10),self.p);self.assertEqual(q['electricity'],D('13.75'));self.assertEqual(q['variable_total'],D('20.00'));self.assertIsNone(q['total']);self.assertFalse(q['total_complete'])
 def test_explicit_zero_peak(self):self.assertEqual(quote_energy(D(10),self.p,peak_increment_ex_vat=D(0))['total'],D('20.00'))
 def test_known_peak(self):self.assertEqual(quote_energy(D(10),self.p,peak_increment_ex_vat=D(2))['total'],D('22.50'))
 def test_negative_market(self):self.assertLess(quote_energy(D(10),replace(self.p,market=D(-1)))['electricity'],0)
 def test_no_negative_energy(self):
  with self.assertRaises(ValueError):quote_energy(D(-1),self.p)
 def test_nonfinite_price(self):
  with self.assertRaises(ValueError):quote_energy(D(1),replace(self.p,market=D('NaN')))
