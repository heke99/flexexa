// Isolated test IPC: the parent owns the real AMQP channel and delivery tag.
import {createInterface} from 'node:readline';
import {execFileSync} from 'node:child_process';
import {consumePolicyPublication} from '../../../packages/events/src/inbox-consumption.ts';
if(process.env.ALLOW_ISOLATED_DB_TESTS!=='1'||process.env.FLEXEXA_OUTBOX_BROKER_TEST!=='1'||process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='54322'||process.env.PGUSER!=='postgres'||process.env.PGDATABASE!=='postgres')throw Error('Refusing non-disposable inbox bridge');
const lines=createInterface({input:process.stdin,crlfDelay:Infinity}),iterator=lines[Symbol.asyncIterator]();
const request=JSON.parse((await iterator.next()).value);
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const database={consume:async(scope,event)=>JSON.parse(execFileSync('psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-XAtq','--set=ON_ERROR_STOP=1','--command',`begin;set local role authenticated;set local request.jwt.claims=${q(JSON.stringify(request.claims))};select public.flexexa_consume_policy_publication(${q(scope.tenant_id)},${q(scope.environment)},${q(JSON.stringify(event))}::jsonb);commit;`],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024}).trim())};
try{
 const status=await consumePolicyPublication(request.scope,request.event,database,{acknowledge:async()=>{
  console.log(JSON.stringify({operation:'ack'}));
  const reply=JSON.parse((await iterator.next()).value);
  if(reply.ack!==true)throw Error('SIMULATED_ACK_LOSS');
 }});
 console.log(JSON.stringify({status}));
}catch(error){console.log(JSON.stringify({error:error.message==='SIMULATED_ACK_LOSS'?'SIMULATED_ACK_LOSS':'CONSUMER_FAILED'}));}
finally{lines.close();process.stdin.pause();}
