import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const backend = process.argv[2];
if (!backend) throw new Error("Usage: node scripts/web/verify-admin-logout.mjs CHARGING_SUBSCRIPTION_CHECKOUT");
const { chromium } = createRequire(join(resolve(backend),"package.json"))("playwright");
const token = "fixture.admin.session";
const applicant = {
 id:"fixture-admin-logout", first_name:"Syntetisk", last_name:"Sökande", email:"logout-fixture@example.invalid",
 annual_miles:1_500, car:"Testbil", position:94, offer_group:"first_1000", marketing_consent:false,
 privacy_version:"applications-2026-11-02-v1", created_at:"2026-11-01T00:00:00Z", is_test:false,
 email_state:"pending", provider_id:null, last_error:null, attempts:0,
};
const listing = {count:94,base:93,new:1,applications:[applicant],next:null};

async function listen(server) {
 server.listen(0,"127.0.0.1");
 await once(server,"listening");
 return server.address().port;
}

const dependency = createServer((request,response)=>{
 const authorized = request.method === "POST" && request.url === "/functions/v1/flexexa-applications" &&
  request.headers.authorization === "Bearer " + token;
 request.resume();
 response.writeHead(authorized?200:401,{"Content-Type":"application/json"}).end(JSON.stringify(authorized?listing:{}));
});
const dependencyPort = await listen(dependency);
const probe = createServer();
const port = await listen(probe);
await new Promise(done=>probe.close(done));
const base = `http://localhost:${port}`;
const child = spawn(process.execPath,[resolve("node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port",String(port)],{
 stdio:"ignore", env:{
  ...process.env, NEXT_TELEMETRY_DISABLED:"1", FLEXEXA_SUPABASE_URL:`http://127.0.0.1:${dependencyPort}`,
  FLEXEXA_SUPABASE_KEY:"local-fixture", FLEXEXA_WAITLIST_SECRET:"local-fixture",
 },
});

let browser;
try {
 let ready = false;
 for(let i=0;i<100 && child.exitCode===null;i++) {
  const response = await fetch(base+"/robots.txt",{signal:AbortSignal.timeout(500)}).catch(()=>null);
  if(response?.ok){await response.body.cancel();ready=true;break;}
  await delay(100);
 }
 assert.ok(ready,"Production Next did not start");
 browser = await chromium.launch({
  executablePath:process.env.CHROME_BINARY || "/usr/bin/chromium",args:["--no-sandbox","--disable-dev-shm-usage"],
 });
 for (const [label,width,networkFailure] of [["desktop",1440,false],["mobile",390,true]]) {
  const context = await browser.newContext({viewport:{width,height:900},isMobile:networkFailure,hasTouch:networkFailure});
  await context.addCookies([{name:"flexexa_admin",value:token,domain:"localhost",path:"/api/admin",httpOnly:true,secure:true,sameSite:"Strict"}]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error=>errors.push(error));
  await page.addInitScript(()=>{
   const original = window.fetch;
   window.fetch = async (input,init)=>{
    if(typeof input!=="string"||!input.startsWith("/api/admin/applications")) return original(input,init);
    // Let the intentionally delayed response reach the client even when the
    // request has been cancelled, so the stale result guard is exercised.
    const {signal: _signal,...options}=init ?? {};
    const response=await original(input,options);
    if(response.headers.has("x-fixture-late")) {
     const json=response.json.bind(response);
     response.json=async()=>{
      const result=await json();
      window.localFixtureDelivered=true;
      return result;
     };
    }
    return response;
   };
  });

  let holdRefresh = false;
  let attempts = 0;
  const lateStarted = Promise.withResolvers();
  const releaseList = Promise.withResolvers();
  const logoutStarted = Promise.withResolvers();
  const releaseLogout = Promise.withResolvers();
  await page.route("**/api/admin/applications",async route=>{
   if(!holdRefresh) return route.continue();
   lateStarted.resolve();
   await releaseList.promise;
   await route.fulfill({headers:{"x-fixture-late":"yes"},json:{...listing,nextCursor:null}});
  });
  await page.route("**/api/admin/session",async route=>{
   assert.equal(route.request().method(),"DELETE");
   if(++attempts>1) return route.continue();
   logoutStarted.resolve();
   await releaseLogout.promise;
   return networkFailure?route.abort():route.fulfill({status:503,json:{error:"Fixture failure"}});
  });

  await page.goto(base+"/admin/ansokningar",{waitUntil:"networkidle"});
  const applicantLink = page.getByRole("link",{name:applicant.email});
  await applicantLink.waitFor({state:"visible"});
  holdRefresh = true;
  await page.getByRole("button",{name:"Uppdatera"}).click();
  await lateStarted.promise;
  await page.getByRole("button",{name:"Logga ut",exact:true}).click();
  await logoutStarted.promise;
  await page.getByText("Loggar ut…",{exact:true}).waitFor();
  await applicantLink.waitFor({state:"hidden"});
  releaseLogout.resolve();
  await page.getByText("Utloggningen kunde inte bekräftas.",{exact:true}).waitFor();
  assert.equal(await page.getByText("Du är utloggad.",{exact:true}).count(),0);
  assert.equal(await applicantLink.count(),0);

  const confirmed = page.waitForResponse(response=>response.url()===base+"/api/admin/session" && response.status()===200);
  await page.getByRole("button",{name:"Försök logga ut igen"}).click();
  await confirmed;
  await page.getByText("Du är utloggad.",{exact:true}).waitFor();
  releaseList.resolve();
  await page.waitForFunction(()=>window.localFixtureDelivered===true);
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  assert.equal(await applicantLink.count(),0);
  assert.equal((await context.cookies()).some(cookie=>cookie.name==="flexexa_admin"),false);
  assert.equal((await context.request.get(base+"/api/admin/applications")).status(),401);
  assert.deepEqual(errors,[]);
  console.log(`${label}: failed sign-out hides private data; retry clears cookie; delayed list ignored.`);
  await context.close();
 }
} finally {
 await browser?.close();
 if(child.exitCode===null && child.signalCode===null){const stopped=once(child,"exit");child.kill();await stopped;}
 await new Promise(done=>{dependency.close(done);dependency.closeAllConnections();});
}
