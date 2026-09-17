import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
function sources(directory) {
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?sources(path.join(directory,item.name)):[path.join(directory,item.name)]).filter(file=>/\.[cm]?[jt]sx?$/u.test(file));
}
test('canonical/core packages do not import an Enode adapter or call its endpoints',()=>{
 for(const pkg of ['domain','kernel','events','api-contracts'])for(const file of sources(path.join(root,'packages',pkg,'src'))) {
  const source=fs.readFileSync(file,'utf8');
  assert(!/(?:from|import\s*\()\s*['"]@flexexa\/enode-adapter/u.test(source),file);
  assert(!/https:\/\/[^\s'"]*enode\.(?:com|io)/u.test(source),file);
 }
});
test('database verification replays tracked migrations and never generates proposal history',()=>{
 const workflow=read('.github/workflows/database-verification.yml');
 assert.match(workflow,/supabase db reset --local/u);assert.match(workflow,/supabase test db/u);
 assert(!workflow.includes('supabase/proposals/'));assert(!workflow.includes('supabase migration new'));
});
test('historical applied SQL remains byte-identical while future migrations may append',()=>{
 const baseline=JSON.parse(read('docs/quality/phase0-applied-sql-hashes.json'));
 for(const [file,sha256] of Object.entries(baseline.files)) {
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),sha256,file);
 }
});
