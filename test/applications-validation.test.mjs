import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateApplication,privacyVersion} from '../src/domains/applications/validation.ts';
const valid={first_name:' Anna ',last_name:' Andersson ',email:'ANNA@example.com',annual_miles:'1500',car:'Volvo EX30',privacy_ack:true,privacy_version:privacyVersion};
test('blank mileage is not an explicit zero',()=>{for(const annual_miles of ['   ','\t','0xFF','1e3'])assert.throws(()=>validateApplication({...valid,annual_miles}));for(const annual_miles of [0,' 0 '])assert.equal(validateApplication({...valid,annual_miles}).annual_miles,0);assert.equal(validateApplication({...valid,annual_miles:'100000'}).annual_miles,100000);});
test('normalizes identity and keeps additional marketing opt-in separate',()=>{const a=validateApplication(valid);assert.equal(a.email,'anna@example.com');assert.equal(a.first_name,'Anna');assert.equal(a.annual_miles,1500);assert.equal(a.marketing_consent,false);assert.equal(validateApplication({...valid,marketing_consent:true}).marketing_consent,true);});
test('rejects missing privacy acknowledgment, stale policy and malformed fields',()=>{for(const patch of [{privacy_ack:false},{privacy_version:'old'},{email:'broken'},{first_name:'Anna\nInjected'},{annual_miles:null},{annual_miles:true},{annual_miles:''},{annual_miles:-1},{annual_miles:1.5},{annual_miles:100001},{website:'bot'}])assert.throws(()=>validateApplication({...valid,...patch}));assert.throws(()=>validateApplication(null));});

test('normalizes multilingual text and preserves valid supplementary characters',()=>{
 const result=validateApplication({...valid,first_name:'A\u030Asa',last_name:'𠮷田',car:'Volvo 🚗'});
 assert.equal(result.first_name,'Åsa');
 assert.equal(result.last_name,'𠮷田');
 assert.equal(result.car,'Volvo 🚗');
 assert.equal(validateApplication({...valid,first_name:'𠮷'.repeat(50)}).first_name.length,100);
 assert.throws(()=>validateApplication({...valid,first_name:'𠮷'.repeat(51)}));
});

test('rejects retained control characters and lone surrogates before storing input',()=>{
 for(const character of ['\u0000','\u007f','\u0085','\ud800','\udc00']){
  assert.throws(()=>validateApplication({...valid,first_name:'A'+character+'sa'}));
 }
});
