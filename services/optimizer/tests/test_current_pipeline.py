# SPDX-License-Identifier: AGPL-3.0-only
import unittest
from datetime import UTC,datetime,timedelta
from decimal import Decimal as D
from dataclasses import replace
from itertools import permutations
from flexexa_optimizer.observation_health import Observation
from flexexa_optimizer.phase_budget import phase_headroom
from flexexa_optimizer.session_binding import SessionBinding,BindingStatus
from flexexa_optimizer.current_allocation import CurrentRequest,allocate_current
from flexexa_optimizer.charging_goals import GoalInput,evaluate_goal
from flexexa_optimizer.plan_explanation import explain_goal_current
N=datetime(2026,11,5,18,tzinfo=UTC)
class PipelineTests(unittest.TestCase):
 def setUp(self):
  self.obs=[Observation('t','s','meter',f'other_load_phase_{i+1}_a',D('4.2'),N,N) for i in range(3)]
  self.a=CurrentRequest('t','s','a',SessionBinding('sa','ca','1','a',BindingStatus.BOUND,'confirmed'),(0,),6,16,0)
  self.b=replace(self.a,asset_id='b',binding=SessionBinding('sb','cb','1','b',BindingStatus.BOUND,'confirmed'),policy_rank=1)
 def budget(self,obs=None):return phase_headroom((16,16,16),obs or self.obs,now=N,tenant_id='t',site_id='s',max_age=timedelta(minutes=5))
 def allocate(self,requests=None,budget=(16,16,16)):return allocate_current(requests or [self.a,self.b],budget,tenant_id='t',site_id='s')
 def test_budget_rounds_down(self):self.assertEqual(self.budget(),(11,11,11))
 def test_stale_and_missing_budget_denied(self):
  for change in ({'value':None},{'observed_at':N-timedelta(minutes=5)}):self.assertIsNone(self.budget([replace(o,**change) for o in self.obs]))
 def test_mixed_meter_frame_rejected(self):
  with self.assertRaises(ValueError):self.budget([self.obs[0],replace(self.obs[1],asset_id="other-meter"),self.obs[2]])
 def test_unsynchronized_phase_frame_not_used(self):
  self.assertIsNone(self.budget([self.obs[0],replace(self.obs[1],observed_at=N-timedelta(seconds=1)),self.obs[2]]))
 def test_wrong_phase_signal_rejected(self):
  with self.assertRaises(ValueError):self.budget(list(reversed(self.obs)))
 def test_three_phase_vehicle_limited_by_weakest_phase(self):self.assertEqual(self.allocate([replace(self.a,phases=(0,1,2))],(16,8,12))[0].current_a,8)
 def test_minimum_not_replaced_with_unsafe_trickle(self):self.assertEqual(self.allocate([self.a],(5,16,16))[0].current_a,0)
 def test_disjoint_phases_can_charge_together(self):self.assertEqual([r.current_a for r in self.allocate([self.a,replace(self.b,phases=(1,))])],[16,16])
 def test_shared_phase_never_oversubscribed(self):
  for budget in range(25):self.assertLessEqual(sum(x.current_a for x in self.allocate(budget=(budget,0,0))),budget)
 def test_input_order_does_not_decide_priority(self):
  for order in permutations([self.a,self.b]):self.assertEqual([(x.asset_id,x.current_a) for x in self.allocate(order)],[('a',16),('b',0)])
 def test_unknown_headroom_denies_all(self):self.assertTrue(all(x.current_a==0 for x in self.allocate(budget=None)))
 def test_duplicate_connector_rejected(self):
  with self.assertRaises(ValueError):self.allocate([self.a,replace(self.b,binding=replace(self.b.binding,evse_asset_id='ca'))])
 def test_wrong_scope_and_identity_rejected(self):
  with self.assertRaises(PermissionError):self.allocate([replace(self.a,tenant_id='other')])
  with self.assertRaises(PermissionError):self.allocate([replace(self.a,binding=self.b.binding)])
 def test_unconfirmed_session_gets_no_current(self):self.assertEqual(self.allocate([replace(self.a,binding=replace(self.a.binding,status=BindingStatus.UNKNOWN))])[0].current_a,0)
 def test_goal_budget_allocation_explanation_pipeline(self):
  goal=evaluate_goal(GoalInput('t','s','a',True,D(80),N+timedelta(hours=10),D(40),D(20),D('.8')),now=N,tenant_id='t',site_id='s')
  explanation=explain_goal_current(goal,self.allocate([self.a],self.budget())[0])
  self.assertEqual(explanation.proposed_current_a,11)
  self.assertFalse(explanation.physical_charging_verified)
  self.assertEqual(explanation.departure_feasibility,'not_evaluated')
 def test_disabled_goal_cannot_be_presented_as_charging(self):
  goal=evaluate_goal(GoalInput('t','s','a',False,D(80),None,None,None,None),now=N,tenant_id='t',site_id='s')
  with self.assertRaises(ValueError):explain_goal_current(goal,self.allocate([self.a])[0])
