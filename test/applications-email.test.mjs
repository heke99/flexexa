import {test} from 'node:test';
import {registerHooks} from 'node:module';
import assert from 'node:assert/strict';

const hooks=registerHooks({resolve(specifier,context,next){return specifier==='server-only'?{shortCircuit:true,url:'data:text/javascript,export%20{}'}:next(specifier,context);}});
const {sendPendingEmails}=await import('../src/domains/applications/server.ts');
hooks.deregister();

function setup(t,statuses){
 for(const [name,value] of Object.entries({FLEXEXA_SUPABASE_URL:'https://db.example.test',FLEXEXA_SUPABASE_KEY:'fixture',FLEXEXA_WAITLIST_SECRET:'fixture',RESEND_API_KEY:'fixture'})){
  const previous=process.env[name];process.env[name]=value;
  t.after(()=>{if(previous===undefined)delete process.env[name];else process.env[name]=previous;});
 }
 let claimed=0;
 const outcomes=[];
 t.mock.method(globalThis,'fetch',async(url,{body})=>{
  if(url==='https://api.resend.com/emails'){
   const status=statuses[claimed-1];
   return Response.json(status===200?{id:'provider-job-'+claimed}:{},{status});
  }
  const input=JSON.parse(body);
  if(input.p_action==='claim_email')return Response.json(claimed<statuses.length?{id:String(++claimed),claim_token:'claim-'+claimed,payload:{}}:null);
  assert.equal(input.p_action,'finish_email');outcomes.push(input.p_data.outcome);
  return Response.json({});
 });
 return outcomes;
}

test('permanent email failure does not stop a later job in the same batch',async t=>{
 const outcomes=setup(t,[422,200]);
 assert.equal(await sendPendingEmails(2),1);
 assert.deepEqual(outcomes,['permanent','sent']);
});

test('retryable email failure stops the current batch rather than retrying in a loop',async t=>{
 const outcomes=setup(t,[429,200]);
 assert.equal(await sendPendingEmails(2),0);
 assert.deepEqual(outcomes,['retry']);
});