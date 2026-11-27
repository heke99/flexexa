import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const applicant = {
 email: "applicant@example.invalid", first_name: "Lokal", last_name: "Test", car: "Provbil",
 annual_miles: 0, privacy_ack: true, privacy_version: "applications-2026-11-02-v1",
};
const secret = "local-submit-fixture";
const privateDetail = "unexpected-private-upstream-detail";
const actions = [];
const errors = [];
const reply = (response, value, status = 200, headers = {}) => response
 .writeHead(status, { "Content-Type": "application/json", ...headers }).end(JSON.stringify(value));
let upstream;
const fixture = createServer(async (request, response) => {
 try {
  assert.equal(request.method, "POST");
  assert.equal(request.url, "/functions/v1/flexexa-applications");
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks));
  assert.equal(input.secret, secret);
  actions.push(input.action);
  if (input.action === "claim_email") return reply(response, null);
  assert.equal(input.action, "submit");
  assert.equal(input.data.email, applicant.email);
  assert.equal(input.data.is_test, false);
  assert.match(input.data.network_hash, /^[0-9a-f]{64}$/);
  return upstream(response);
 } catch (error) {
  errors.push(error);
  return reply(response, {}, 500);
 }
});

async function listen(server) {
 server.listen(0, "127.0.0.1");
 await once(server, "listening");
 return server.address().port;
}

const upstreamPort = await listen(fixture);
const probe = createServer();
const port = await listen(probe);
await new Promise(done => probe.close(done));
const base = "http://127.0.0.1:" + port;
const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
 stdio: ["ignore", "pipe", "pipe"],
 env: {
  ...process.env, NEXT_TELEMETRY_DISABLED: "1", VERCEL_ENV: "production", RESEND_API_KEY: "",
  FLEXEXA_SUPABASE_URL: "http://127.0.0.1:" + upstreamPort, FLEXEXA_SUPABASE_KEY: "fixture",
  FLEXEXA_WAITLIST_SECRET: secret,
 },
});
const exited = once(child, "exit");
let logs = "";
for (const stream of [child.stdout, child.stderr]) stream.setEncoding("utf8").on("data", chunk => { logs += chunk; });

async function until(predicate, name) {
 for (let attempt = 0; attempt < 100; attempt += 1) {
  if (await predicate()) return;
  await delay(50);
 }
 assert.fail(name);
}

async function submitRaw(status, body, duplex) {
 const response = await fetch(base + "/api/applications", {
  method: "POST", headers: { Origin: "http://localhost:" + port, "Content-Type": "application/json" },
  body, duplex, signal: AbortSignal.timeout(5_000),
 });
 const result = await response.json();
 if (errors.length) throw errors[0];
 assert.equal(response.status, status);
 return { response, result };
}

function submit(status, body = applicant) {
 return submitRaw(status, JSON.stringify(body));
}

function streamBody(body) {
 return new Blob([body]).stream();
}

async function expectEarlyRejection(body) {
 const request = httpRequest(base + "/api/applications", {
  method: "POST", signal: AbortSignal.timeout(5_000),
  headers: { Origin: "http://localhost:" + port, "Transfer-Encoding": "chunked", "Content-Type": "application/json" },
 });
 const pending = once(request, "response");
 // Keep the upload open. The response must not depend on an end-of-body marker.
 request.write(body);
 try {
  const [response] = await pending;
  assert.equal(response.statusCode, 413);
  assert.equal(response.headers["cache-control"], "no-store");
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  assert.deepEqual(JSON.parse(Buffer.concat(chunks)), { error: "För mycket data." });
 } finally {
  request.destroy();
 }
}

async function expectFailure(status, code, retryAfter = null) {
 const { response, result } = await submit(status);
 assert.equal(response.headers.get("cache-control"), "no-store");
 assert.equal(response.headers.get("retry-after"), retryAfter);
 assert.match(result.requestId, /^[0-9a-f-]{36}$/);
 assert.deepEqual(result, { error: "Ansökan kunde inte sparas. Försök igen om en stund.", requestId: result.requestId });
 await until(() => logs.includes(JSON.stringify({ event: "applications.failure", action: "submit", code, requestId: result.requestId })), code);
}

try {
 await until(async () => {
  const response = await fetch(base + "/robots.txt", { signal: AbortSignal.timeout(500) }).catch(() => null);
  await response?.body?.cancel();
  return response?.ok;
 }, "Production Next fixture did not start");
 await submit(400, { ...applicant, privacy_ack: false });
 const invalidMileage = await submit(400, { ...applicant, annual_miles: { toString: null, valueOf: null } });
 assert.deepEqual(invalidMileage.result, { error: "Ange körsträckan i mil per år." });
 const malformed = await submitRaw(400, `{"email": ${privateDetail}}`);
 assert.equal(malformed.response.headers.get("cache-control"), "no-store");
 assert.deepEqual(malformed.result, { error: "Kontrollera formuläret." });
 const tooLarge = JSON.stringify({ ...applicant, padding: "å".repeat(4096) });
 assert.ok(tooLarge.length < 8192 && Buffer.byteLength(tooLarge) > 8192);
 for (const { response, result } of [await submitRaw(413, tooLarge), await submitRaw(413, streamBody(tooLarge), "half")]) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(result, { error: "För mycket data." });
 }
 await expectEarlyRejection(tooLarge);
 assert.deepEqual(actions, []);

 const confirmations = [];
 const exactLimit = JSON.stringify(applicant).padEnd(8192, " ");
 for (const created of [true, false]) {
  upstream = response => reply(response, { ok: true, created });
  const { result } = created ? await submitRaw(200, streamBody(exactLimit), "half") : await submit(200);
  assert.equal(result.ok, true);
  confirmations.push(result);
  await until(() => actions.at(-1) === "claim_email", "No confirmed queue pass");
 }
 assert.deepEqual(confirmations[0], confirmations[1]);
 assert.deepEqual(actions, ["submit", "claim_email", "submit", "claim_email"]);
 actions.length = 0;

 upstream = response => reply(response, { limited: true });
 const limited = await submit(429);
 assert.equal(limited.response.headers.get("cache-control"), "no-store");
 assert.deepEqual(limited.result, { error: "För många försök. Försök igen senare." });
 const invalid = [null, [], {}, { ok: true }, { ok: false, created: true }, { ok: true, created: "true" },
  { limited: "true" }, { limited: true, ok: true, created: true }, { error: privateDetail }];
 for (const receipt of invalid) {
  upstream = response => reply(response, receipt);
  await expectFailure(502, "INVALID_APPLICATION_RECEIPT");
 }
 upstream = response => response.writeHead(200).end(privateDetail);
 await expectFailure(502, "INVALID_DATABASE_RESPONSE");
 upstream = response => reply(response, { error: privateDetail }, 500);
 await expectFailure(503, "DATABASE_UNAVAILABLE");
 upstream = response => reply(response, { error: privateDetail }, 429, { "Retry-After": "29" });
 await expectFailure(429, "RATE_LIMITED", "29");

 await delay(200);
 assert.deepEqual(actions, Array(invalid.length + 4).fill("submit"));
 for (const privateValue of [privateDetail, applicant.email, secret]) assert.ok(!logs.includes(privateValue));
 assert.deepEqual(errors, []);
 console.log("Production Next application submission: bounded UTF-8 upload; safe input errors; new and duplicate acknowledged; quota and invalid receipts never claim email; safe 429/502/503 correlation.");
} finally {
 if (child.exitCode === null) {
  child.kill("SIGTERM");
  await Promise.race([exited, delay(5000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
 }
 await new Promise(done => { fixture.close(done); fixture.closeAllConnections(); });
}
