# SPDX-License-Identifier: AGPL-3.0-only
import unittest
from dataclasses import replace
from datetime import UTC,datetime,timedelta
from decimal import Decimal
from itertools import permutations
from flexexa_optimizer.observation_health import Observation,assess_observation,HealthStatus
from flexexa_optimizer.session_binding import SessionObservation,resolve_session_bindings,BindingStatus,IdentitySource

NOW=datetime(2026,11,5,18,tzinfo=UTC)
TTL=timedelta(minutes=5)
class HealthTests(unittest.TestCase):
    def setUp(self):self.observation=Observation('tenant-a','site-a','meter-a','power_kw',Decimal(0),NOW,NOW)
    def check(self,observation=None,**kwargs):return assess_observation(observation or self.observation,now=NOW,tenant_id='tenant-a',site_id='site-a',max_age=TTL,**kwargs)
    def test_zero_and_false_are_real_values(self):
        self.assertTrue(self.check().usable)
        self.assertTrue(self.check(replace(self.observation,value=False)).usable)
    def test_polling_cached_value_cannot_refresh_source(self):
        result=self.check(replace(self.observation,observed_at=NOW-TTL,received_at=NOW))
        self.assertEqual(result.status,HealthStatus.STALE)
    def test_strict_expiry_boundary(self):
        self.assertTrue(self.check(replace(self.observation,observed_at=NOW-TTL+timedelta(microseconds=1))).usable)
        self.assertFalse(self.check(replace(self.observation,observed_at=NOW-TTL)).usable)
    def test_never_seen_and_unknown_are_not_zero(self):
        for field in ('value','observed_at','received_at'):
            with self.subTest(field=field):self.assertEqual(self.check(replace(self.observation,**{field:None})).status,HealthStatus.MISSING)
    def test_invalid_numeric_values(self):
        for value in (float('nan'),float('inf'),Decimal('NaN'),'0'):
            with self.subTest(value=value):self.assertEqual(self.check(replace(self.observation,value=value)).status,HealthStatus.INVALID)
    def test_future_and_receipt_before_observation(self):
        self.assertEqual(self.check(replace(self.observation,observed_at=NOW+timedelta(seconds=1))).status,HealthStatus.FUTURE)
        self.assertEqual(self.check(replace(self.observation,received_at=NOW-timedelta(seconds=1))).status,HealthStatus.FUTURE)
    def test_explicit_clock_tolerance(self):
        self.assertTrue(self.check(replace(self.observation,observed_at=NOW+timedelta(seconds=1)),future_tolerance=timedelta(seconds=2)).usable)
    def test_scope_and_naive_clock_rejected(self):
        with self.assertRaises(PermissionError):self.check(replace(self.observation,tenant_id='other'))
        with self.assertRaises(ValueError):self.check(replace(self.observation,observed_at=NOW.replace(tzinfo=None)))
    def test_identical_fresh_readings_not_assumed_frozen(self):
        self.assertTrue(self.check().usable)
        self.assertTrue(self.check().usable)

class SessionTests(unittest.TestCase):
    def setUp(self):
        self.first=SessionObservation('tenant-a','site-a','session-a','charger-a','1',True,NOW,NOW,'car-a',IdentitySource.PROVIDER,'session-a')
        self.second=replace(self.first,session_id='session-b',evse_asset_id='charger-b',vehicle_asset_id='car-b',evidence_session_id='session-b')
    def resolve(self,*sessions):return resolve_session_bindings(sessions,now=NOW,tenant_id='tenant-a',site_id='site-a',max_age=TTL,allowed_vehicle_ids=frozenset({'car-a','car-b'}),allowed_connectors=frozenset({('charger-a','1'),('charger-b','1')}))
    def test_two_verified_sessions(self):self.assertTrue(all(d.status==BindingStatus.BOUND for d in self.resolve(self.first,self.second)))
    def test_plugged_state_alone_never_identifies_car(self):
        result=self.resolve(replace(self.first,identity_source=None))[0]
        self.assertEqual(result.status,BindingStatus.UNKNOWN)
        self.assertIsNone(result.vehicle_asset_id)
    def test_old_identity_does_not_survive_new_session(self):
        result=self.resolve(replace(self.first,session_id='new-session'))[0]
        self.assertEqual(result.status,BindingStatus.UNKNOWN)
    def test_disconnect_releases_mapping(self):
        result=self.resolve(replace(self.first,connected=False))[0]
        self.assertEqual(result.status,BindingStatus.DISCONNECTED)
        self.assertIsNone(result.vehicle_asset_id)
    def test_stale_session_never_binds(self):self.assertEqual(self.resolve(replace(self.first,observed_at=NOW-TTL))[0].status,BindingStatus.UNUSABLE)
    def test_vehicle_conflicts_do_not_depend_on_order(self):
        duplicate=replace(self.second,vehicle_asset_id='car-a')
        for order in permutations([self.first,duplicate]):self.assertTrue(all(d.status==BindingStatus.CONFLICT and d.vehicle_asset_id is None for d in self.resolve(*order)))
    def test_connector_conflicts_include_unknown_identity(self):
        duplicate=replace(self.second,evse_asset_id='charger-a',vehicle_asset_id=None,identity_source=None)
        for order in permutations([self.first,duplicate]):self.assertTrue(all(d.status==BindingStatus.CONFLICT for d in self.resolve(*order)))
    def test_foreign_vehicle_connector_and_tenant_rejected(self):
        for changes in ({'vehicle_asset_id':'foreign-car'},{'evse_asset_id':'foreign-charger'},{'tenant_id':'tenant-b'},{'site_id':'site-b'}):
            with self.assertRaises(PermissionError):self.resolve(replace(self.first,**changes))
    def test_duplicate_session_id_rejected(self):
        with self.assertRaises(ValueError):self.resolve(self.first,self.first)
    def test_guest_and_invalid_values_are_not_identity(self):
        with self.assertRaises(ValueError):self.resolve(replace(self.first,identity_source='default_car'))
        with self.assertRaises(ValueError):self.resolve(replace(self.first,connected='true'))
    def test_unknown_connection_and_missing_time_do_not_bind(self):
        for change in ({'connected':None},{'observed_at':None}):self.assertEqual(self.resolve(replace(self.first,**change))[0].status,BindingStatus.UNUSABLE)
    def test_empty_snapshot_still_validates_execution_clock(self):
        with self.assertRaises(ValueError):
            resolve_session_bindings([],now=NOW.replace(tzinfo=None),tenant_id='tenant-a',site_id='site-a',max_age=TTL,allowed_vehicle_ids=frozenset(),allowed_connectors=frozenset())
    def test_disconnected_old_session_does_not_block_current_session(self):
        old=replace(self.first,session_id='old',connected=False)
        result=self.resolve(old,self.first)
        self.assertEqual(result[0].status,BindingStatus.DISCONNECTED)
        self.assertEqual(result[1].status,BindingStatus.BOUND)
    def test_customer_confirmation_is_session_specific(self):
        self.assertEqual(self.resolve(replace(self.first,identity_source=IdentitySource.CUSTOMER))[0].status,BindingStatus.BOUND)

if __name__=='__main__':unittest.main()
