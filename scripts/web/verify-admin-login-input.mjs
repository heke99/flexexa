import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const owner = "admin@example.invalid";
const testPassword = "old-pass";
const tokenHash = "ae".repeat(32);
const token = "fixture.login.session";
const actions = [];
const failures = [];
const fixture = createServer(async (request, response) => {
 const reply = (result, status = 200) => response.writeHead(status, {"Content-Type":"application/json"}).end(JSON.stringify(result));
 try {
  const parts = [];
  for await (const chunk of request) parts.push(chunk);
  const input = JSON.parse(Buffer.concat(parts));
  assert.equal(request.method, "POST");
  if (request.url === "/auth/v1/token?grant_type=password") {
   actions.push("password");
   assert.deepEqual(input, {email:owner,password:testPassword});
   return reply({access_token:token,expires_in:120});
  }
  if (request.url === "/auth/v1/verify") {
   actions.push("token");
   assert.deepEqual(input, {token_hash:tokenHash,type:"email"});
   return reply({access_token:token,expires_in:120});
  }
  if (request.url === "/functions/v1/flexexa-applications") {
   assert.equal(request.headers.authorization, "Bearer " + token);
   assert.ok(input.action === "owner_login" || input.action === "admin_list");
   actions.push(input.action);
   return reply({ok:true});
  }
  if (request.url === "/functions/v1/flexexa-owner-auth") {
   actions.push("link");
   assert.equal(input.email, owner);
   return reply({email:owner,token_hash:tokenHash});
  }
  assert.equal(request.url, "/fixture-resend");
  actions.push("mail");
  assert.deepEqual(input.to, [owner]);
  const match = input.text.match(/https:\/\/localhost:\d+\/admin#token_hash=[a-f0-9]+/);
  assert.ok(match);
  assert.equal(new URL(match[0]).hash, "#token_hash=" + tokenHash);
  return reply({id:"fixture-mail"});
 } catch (error) {
  failures.push(error);
  reply({}, 500);
 }
});

async function listen(server) {
 server.listen(0, "127.0.0.1");
 await once(server, "listening");
 return server.address().port;
}

const scratch = mkdtempSync(join(tmpdir(), "fx-admin-login-input-"));
const preload = join(scratch, "fetch-fixture.cjs");
writeFileSync(preload, `
const original=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const url=new URL(typeof input==="string"||input instanceof URL?input:input.url);
 if(url.href==="https://api.resend.com/emails") return original(process.env.FIXTURE_SUPABASE_URL+"/fixture-resend",init);
 if(url.hostname==="127.0.0.1"||url.hostname==="localhost") return original(input,init);
 throw Error("Unexpected fetch outside loopback");
};
`);
const fixtureUrl = "http://127.0.0.1:" + await listen(fixture);
const probe = createServer();
const port = await listen(probe);
await new Promise(done => probe.close(done));
const base = "http://127.0.0.1:" + port;
const localOrigin = "http://localhost:" + port;
const secureOrigin = "https://localhost:" + port;
const child = spawn(process.execPath,[resolve("node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port",String(port)],{
 stdio:"ignore",
 env:{...process.env,NODE_OPTIONS:`--require=${preload}`,NEXT_TELEMETRY_DISABLED:"1",
  FIXTURE_SUPABASE_URL:fixtureUrl,FLEXEXA_SUPABASE_URL:fixtureUrl,FLEXEXA_SUPABASE_KEY:"fixture",
  FLEXEXA_WAITLIST_SECRET:"fixture",FLEXEXA_ADMIN_EMAIL:owner,FLEXEXA_ADMIN_ORIGIN:secureOrigin,RESEND_API_KEY:"fixture"},
});

async function post(status, body, options = {}) {
 const response = await fetch(base + "/api/admin/session", {
  method:"POST",body,signal:AbortSignal.timeout(5_000),
  headers:{Origin:localOrigin,"Content-Type":"application/json",...options.headers},
  ...(options.duplex ? {duplex:"half"} : {}),
 });
 const result = await response.json();
 if (failures.length) throw failures[0];
 assert.equal(response.status, status, JSON.stringify(result));
 assert.match(response.headers.get("cache-control") ?? "", /\bno-store\b/);
 return {response,result};
}

try {
 let ready = false;
 for (let attempt=0; attempt<100 && child.exitCode===null; attempt++) {
  const response = await fetch(base + "/robots.txt", {signal:AbortSignal.timeout(500)}).catch(() => null);
  if (response?.ok) {await response.body.cancel();ready=true;break;}
  await delay(100);
 }
 assert.ok(ready,"Production Next fixture did not start");
 const pass = {email:owner,password:testPassword};
 await post(403, JSON.stringify(pass), {headers:{Origin:"https://wrong.example.invalid"}});
 await post(415, JSON.stringify(pass), {headers:{"Content-Type":"text/plain"}});
 for (const payload of ["{", "null", "[]", JSON.stringify({email:owner,password:{bad:true}}),
   JSON.stringify({...pass,token_hash:tokenHash}), JSON.stringify({token_hash:"no"}),
   JSON.stringify({email:123,password:testPassword}), JSON.stringify({email:owner,password:"x".repeat(129)})]) {
  await post(400,payload);
 }
 const text = new TextEncoder();
 const oversize = new ReadableStream({start(controller){
  controller.enqueue(text.encode('{"email":"' + "å".repeat(3_000)));
  controller.enqueue(text.encode("å".repeat(2_000) + '"}'));
  controller.close();
 }});
 await post(413,oversize,{duplex:true});
 assert.deepEqual(actions,[]);

 const {response:login,result} = await post(200,JSON.stringify({...pass,email:"  ADMIN@EXAMPLE.INVALID  "}),
  {headers:{"Content-Type":"Application/JSON; Charset=UTF-8"}});
 assert.deepEqual(result,{ok:true});
 assert.match(login.headers.get("set-cookie") ?? "",/^flexexa_admin=.*HttpOnly/);
 await post(200,JSON.stringify({token_hash:tokenHash}));
 const neutral=await post(200,JSON.stringify({email:"other@example.invalid",password:""}));
 assert.equal(neutral.result.message,"Om adressen är behörig skickas en inloggningslänk.");
 assert.deepEqual(actions,["password","owner_login","admin_list","token","owner_login","admin_list"]);
 const link=await post(200, JSON.stringify({email:owner,password:""}),
  {headers:{Origin:secureOrigin,"x-forwarded-proto":"https"}});
 assert.match(link.result.message,/inloggningslänk har skickats/i);
 assert.deepEqual(actions.slice(-2),["link","mail"]);
 console.log("Admin login production HTTP: invalid/mixed/oversize requests reach no dependency; password, token and emailed-link modes pass.");
} finally {
 if(child.exitCode===null&&child.signalCode===null){const stopped=once(child,"exit");child.kill();await stopped;}
 await new Promise(done=>{fixture.close(done);fixture.closeAllConnections();});
 rmSync(scratch,{recursive:true,force:true});
}
