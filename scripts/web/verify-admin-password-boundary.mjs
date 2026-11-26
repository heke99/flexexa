import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const password = "synthetic-password-for-loopback";
const token = "fixture.admin.session";
const cookie = "flexexa_admin=" + token;
let roleStatus = 200;
let authStatus = 200;
let roleCalls = 0;
let authCalls = 0;
let redirected = 0;
const fixtureErrors = [];

async function start(server) {
 server.listen(0, "127.0.0.1");
 await once(server, "listening");
 return `http://127.0.0.1:${server.address().port}`;
}

const secondOrigin = createServer((request, response) => {
 redirected++;
 request.resume();
 response.writeHead(200).end("{}");
});
const redirectUrl = await start(secondOrigin);
const upstream = createServer(async (request, response) => {
 try {
  assert.equal(request.headers.authorization, `Bearer ${token}`);
  const parts = [];
  for await (const chunk of request) parts.push(chunk);
  const body = JSON.parse(Buffer.concat(parts));
  if (request.url === "/functions/v1/flexexa-applications") {
   roleCalls++;
   assert.equal(request.method, "POST");
   assert.equal(body.action, "admin_list");
   assert.deepEqual(body.data, {page:0});
   response.writeHead(roleStatus, {"Content-Type":"application/json"}).end("{}");
  } else {
   assert.equal(request.url, "/auth/v1/user");
   assert.equal(request.method, "PUT");
   assert.deepEqual(body, {password});
   authCalls++;
   if (authStatus === "timeout") return;
   const headers = authStatus === 307 ? {Location: redirectUrl + "/elsewhere"}
    : authStatus === 429 ? {"Retry-After":"17"} : {};
   response.writeHead(authStatus, {"Content-Type":"application/json", ...headers}).end("{}");
  }
 } catch (error) {
  fixtureErrors.push(error);
  response.writeHead(500).end();
 }
});
const supabaseOrigin = await start(upstream);
const portProbe = createServer();
await start(portProbe);
const {port} = portProbe.address();
await new Promise(done => portProbe.close(done));
const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
 env: {
  ...process.env, NEXT_TELEMETRY_DISABLED:"1", FLEXEXA_SUPABASE_URL:supabaseOrigin,
  FLEXEXA_SUPABASE_KEY:"fixture-publishable", FLEXEXA_WAITLIST_SECRET:"fixture-rpc-key",
 },
 stdio:["ignore","ignore","pipe"],
});
let logs = "";
child.stderr.on("data", chunk => { logs += chunk.toString(); });
const site = `http://127.0.0.1:${port}`;
const browserOrigin = `http://localhost:${port}`;

async function patch(status, {origin=browserOrigin, session=cookie, body=JSON.stringify({password})} = {}) {
 const response = await fetch(site + "/api/admin/session", {
  method:"PATCH", headers:{Origin:origin,Cookie:session,"Content-Type":"application/json"},
  body, signal:AbortSignal.timeout(21_000),
 });
 const payload = await response.json();
 assert.equal(response.status, status, JSON.stringify(payload));
 assert.match(response.headers.get("cache-control") ?? "", /\bno-store\b/);
 assert.doesNotMatch(JSON.stringify(payload), /synthetic-password-for-loopback|fixture\.admin\.session|elsewhere/);
 return {response, payload};
}

async function dependencyError(status, code) {
 const {response, payload} = await patch(status);
 assert.match(payload.requestId, /^[\da-f-]{36}$/);
 const deadline = Date.now() + 1_000;
 while (!logs.includes(payload.requestId) && Date.now() < deadline) await delay(10);
 assert.ok(logs.split("\n").some(line => line.includes(payload.requestId) &&
  line.includes(`"code":"${code}"`) && line.includes('"action":"admin_password_change"')));
 return response;
}

try {
 let ready = false;
 for (let attempt = 0; attempt < 100 && child.exitCode === null; attempt++) {
  const response = await fetch(site + "/robots.txt", {signal:AbortSignal.timeout(500)}).catch(() => null);
  if (response?.ok) { await response.body.cancel(); ready = true; break; }
  await delay(100);
 }
 assert.ok(ready, "Production Next fixture did not start");

 await patch(403, {origin:"https://untrusted.example.invalid"});
 await patch(401, {session:""});
 assert.equal(roleCalls, 0);
 await patch(400, {body:"{"});
 assert.equal(authCalls, 0);

 assert.deepEqual((await patch(200)).payload, {message:"Lösenordet är sparat."});
 roleStatus = 403;
 await patch(403);
 assert.equal(authCalls, 1);
 roleStatus = 503;
 await dependencyError(503, "DATABASE_UNAVAILABLE");
 assert.equal(authCalls, 1);
 roleStatus = 200;

 authStatus = 422;
 await patch(400);
 authStatus = 429;
 assert.equal((await dependencyError(429, "RATE_LIMITED")).headers.get("retry-after"), "17");
 authStatus = 307;
 await dependencyError(503, "AUTH_UNAVAILABLE");
 assert.equal(redirected, 0, "Password update followed a provider redirect");
 authStatus = "timeout";
 await dependencyError(504, "AUTH_TIMEOUT");
 assert.equal(fixtureErrors.length, 0);
 assert.doesNotMatch(logs, /synthetic-password-for-loopback|fixture\.admin\.session|elsewhere/);
 console.log("Admin password update verified on production Next: origin, session, role, validation, 429, timeout, and redirect rejection.");
} finally {
 if (child.exitCode === null) {
  const stopping = once(child, "exit");
  child.kill();
  await stopping;
 }
 for (const server of [upstream, secondOrigin]) {
  server.closeAllConnections();
  await new Promise(done => server.close(done));
 }
}
