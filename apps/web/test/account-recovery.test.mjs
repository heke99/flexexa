import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingPassword,recoveryRedirect,recoveryTokens} from '../src/lib/account-recovery.ts';
const token='#type=recovery&access_token=fixture.access.signature&refresh_token=fixture_refresh_token';
test('recovery parser accepts only the dedicated recovery token shape',()=>{assert.deepEqual(recoveryTokens(token),{access_token:'fixture.access.signature',refresh_token:'fixture_refresh_token'});for(const value of ['',token.replace('recovery','signup'),token+'&type=recovery',token+'&error=expired',token+'&redirect=https://evil.example',token.replace('fixture_refresh_token','x'),'x'.repeat(24577)])assert.equal(recoveryTokens(value),null);});
test('callback destination is fixed to the intended staging app, never query supplied',()=>assert.equal(recoveryRedirect,'https://staging.flexexa.com/account/activate'));
test('password validation requires matching bounded values',()=>{assert.equal(matchingPassword('test-password-123','test-password-123'),true);for(const [a,b] of [['short','short'],['test-password-123','other-password-123'],['x'.repeat(257),'x'.repeat(257)]])assert.equal(matchingPassword(a,b),false);});
