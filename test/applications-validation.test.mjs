import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateApplication,privacyVersion} from '../src/domains/applications/validation.ts';
const valid={first_name:' Anna ',last_name:' Andersson ',email:'ANNA@example.com',annual_miles:'1500',car:'Volvo EX30',privacy_ack:true,privacy_version:privacyVersion};
test('normalizes identity and keeps additional marketing opt-in separate',()=>{const a=validateApplication(valid);assert.equal(a.email,'anna@example.com');assert.equal(a.first_name,'Anna');assert.equal(a.annual_miles,1500);assert.equal(a.marketing_consent,false);assert.equal(validateApplication({...valid,marketing_consent:true}).marketing_consent,true);});
test('rejects missing privacy acknowledgment, stale policy and malformed fields',()=>{for(const patch of [{privacy_ack:false},{privacy_version:'old'},{email:'broken'},{first_name:'Anna\nInjected'},{annual_miles:null},{annual_miles:true},{annual_miles:''},{annual_miles:-1},{annual_miles:1.5},{annual_miles:100001},{website:'bot'}])assert.throws(()=>validateApplication({...valid,...patch}));assert.throws(()=>validateApplication(null));});
