import test from 'node:test';import assert from 'node:assert/strict';
import {sourceSha,validateReleaseContext} from './verify-charging-release-source.mjs';
const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'heke99/flexexa',GITHUB_REPOSITORY_ID:'1362385793',GITHUB_REPOSITORY_OWNER_ID:'129280077',GITHUB_SHA:'a'.repeat(40)};
const branch={protected:true,commit:{sha:env.GITHUB_SHA}};
const runs=['Flexexa quality verification','Supabase replay and authorization tests','OpenTofu AWS plan'].map(name=>({name,head_sha:sourceSha,event:'pull_request',status:'completed',conclusion:'success',head_repository:{id:1362385793},repository:{id:1362385793}}));
test('protected current main and exact successful source is accepted',()=>assert.equal(validateReleaseContext(env,branch,runs).source_sha,sourceSha));
for(const key of ['GITHUB_EVENT_NAME','GITHUB_REF','GITHUB_REPOSITORY_ID','GITHUB_REPOSITORY_OWNER_ID'])test(`reject altered ${key}`,()=>assert.throws(()=>validateReleaseContext({...env,[key]:'other'},branch,runs)));
test('stale or unprotected main cannot deploy',()=>{assert.throws(()=>validateReleaseContext(env,{...branch,protected:false},runs));assert.throws(()=>validateReleaseContext(env,{...branch,commit:{sha:'b'.repeat(40)}},runs));});
test('failed, foreign or missing CI is rejected',()=>{for(const patch of [{conclusion:'failure'},{head_sha:'b'.repeat(40)},{head_repository:{id:1}}]){const changed=structuredClone(runs);Object.assign(changed[0],patch);assert.throws(()=>validateReleaseContext(env,branch,changed));}assert.throws(()=>validateReleaseContext(env,branch,[]));});
