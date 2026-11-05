# SPDX-License-Identifier: AGPL-3.0-only
import unittest
from dataclasses import replace
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal as D, Inexact, ROUND_FLOOR, localcontext
from flexexa_optimizer.charging_goals import GoalInput, GoalStatus, WeeklyDeparture, evaluate_goal, next_weekly_departure

NOW = datetime(2026, 11, 5, 18, tzinfo=UTC)

class GoalTests(unittest.TestCase):
    def setUp(self):
        self.goal = GoalInput('tenant-a', 'site-a', 'car-a', True, D(80), NOW+timedelta(hours=12), D(40), D(20), D('.8'))
    def evaluate(self, goal=None):
        return evaluate_goal(goal or self.goal, now=NOW, tenant_id='tenant-a', site_id='site-a')
    def test_energy_respects_explicit_efficiency(self):
        demand=self.evaluate()
        self.assertEqual(demand.required_battery_energy_kwh,D(8))
        self.assertEqual(demand.required_input_energy_kwh,D(10))
        self.assertEqual(demand.status,GoalStatus.NEEDS_CHARGE)
    def test_arithmetic_is_independent_of_caller_precision(self):
        baseline=self.evaluate(replace(self.goal,charge_efficiency=D(".83")))
        with localcontext() as context:
            context.prec=3
            context.rounding=ROUND_FLOOR
            context.traps[Inexact]=True
            low=self.evaluate(replace(self.goal,charge_efficiency=D(".83")))
        self.assertEqual(low.required_input_energy_kwh,baseline.required_input_energy_kwh)
    def test_disabled_has_no_morning_floor(self):
        result=self.evaluate(replace(self.goal,enabled=False,departure_at=None,current_soc_percent=D(10)))
        self.assertEqual(result.status,GoalStatus.DISABLED)
        self.assertIsNone(result.departure_at)
        self.assertEqual(result.required_input_energy_kwh,D(0))
    def test_low_customer_target_is_not_raised(self):
        self.assertEqual(self.evaluate(replace(self.goal,target_soc_percent=D(45))).required_battery_energy_kwh,D(1))
    def test_unknown_inputs_are_not_fabricated(self):
        for field in ('current_soc_percent','battery_capacity_kwh','charge_efficiency','departure_at'):
            with self.subTest(field=field):
                result=self.evaluate(replace(self.goal,**{field:None}))
                self.assertEqual(result.status,GoalStatus.UNKNOWN)
                self.assertIsNone(result.required_input_energy_kwh)
    def test_satisfied_does_not_need_capacity_or_efficiency(self):
        result=self.evaluate(replace(self.goal,current_soc_percent=D(90),battery_capacity_kwh=None,charge_efficiency=None))
        self.assertEqual(result.status,GoalStatus.SATISFIED)
        self.assertEqual(result.required_input_energy_kwh,D(0))
    def test_expired_goal_cannot_claim_historical_success(self):
        result=self.evaluate(replace(self.goal,departure_at=NOW-timedelta(hours=1),current_soc_percent=D(90)))
        self.assertEqual(result.status,GoalStatus.EXPIRED)
    def test_margin_never_silently_falls_back(self):
        result=self.evaluate(replace(self.goal,departure_at=NOW+timedelta(minutes=20),finish_margin=timedelta(hours=1)))
        self.assertEqual(result.status,GoalStatus.EXPIRED)
    def test_100_percent_has_no_implicit_one_hour_margin(self):
        result=self.evaluate(replace(self.goal,target_soc_percent=D(100)))
        self.assertEqual(result.departure_at,result.planning_deadline_at)
    def test_invalid_numbers_and_naive_time_rejected(self):
        for field,value in [('target_soc_percent',D('NaN')),('current_soc_percent',D(101)),('charge_efficiency',D(0)),('battery_capacity_kwh',D(-1)),('target_soc_percent',80),('departure_at',datetime(2026,11,6)),('enabled','false')]:
            with self.subTest(field=field):
                with self.assertRaises(ValueError): self.evaluate(replace(self.goal,**{field:value}))
    def test_cross_tenant_and_site_rejected(self):
        for field,value in [('tenant_id','tenant-b'),('site_id','site-b')]:
            with self.assertRaises(PermissionError): self.evaluate(replace(self.goal,**{field:value}))
    def test_two_vehicles_are_independent_and_immutable(self):
        first=self.evaluate()
        second=self.evaluate(replace(self.goal,asset_id='car-b',target_soc_percent=D(60)))
        self.assertEqual(first.required_input_energy_kwh,D(10))
        self.assertEqual(second.required_input_energy_kwh,D(5))
        self.assertEqual(self.goal.target_soc_percent,D(80))
    def test_output_is_always_utc(self):
        result=self.evaluate(replace(self.goal,departure_at=datetime.fromisoformat('2026-11-06T07:00:00+01:00')))
        self.assertEqual(result.departure_at,datetime(2026,11,6,6,tzinfo=UTC))

class WeeklyTests(unittest.TestCase):
    def test_empty_schedule_has_no_default(self):
        self.assertIsNone(next_weekly_departure({},now=NOW,timezone='Europe/Stockholm'))
    def test_next_week_is_considered_if_today_passed(self):
        result=next_weekly_departure({3:WeeklyDeparture(time(7),D(80))},now=NOW,timezone='Europe/Stockholm')
        self.assertEqual(result.departure_at,datetime(2026,11,12,6,tzinfo=UTC))
    def test_repeated_autumn_hour_requires_explicit_fold(self):
        now=datetime(2026,10,24,18,tzinfo=UTC)
        with self.assertRaisesRegex(ValueError,'Ambiguous'):
            next_weekly_departure({6:WeeklyDeparture(time(2,30),D(80))},now=now,timezone='Europe/Stockholm')
        first=next_weekly_departure({6:WeeklyDeparture(time(2,30),D(80),0)},now=now,timezone='Europe/Stockholm')
        second=next_weekly_departure({6:WeeklyDeparture(time(2,30),D(80),1)},now=now,timezone='Europe/Stockholm')
        self.assertEqual(second.departure_at-first.departure_at,timedelta(hours=1))
    def test_nonexistent_spring_time_rejected(self):
        with self.assertRaisesRegex(ValueError,'Nonexistent'):
            next_weekly_departure({6:WeeklyDeparture(time(2,30),D(80))},now=datetime(2026,3,28,18,tzinfo=UTC),timezone='Europe/Stockholm')
    def test_invalid_weekday_and_fold_rejected(self):
        for schedule in [{7:WeeklyDeparture(time(7),D(80))},{True:WeeklyDeparture(time(7),D(80))},{1:WeeklyDeparture(time(7),D(80),2)}]:
            with self.assertRaises(ValueError):next_weekly_departure(schedule,now=NOW,timezone='Europe/Stockholm')

if __name__ == '__main__': unittest.main()
