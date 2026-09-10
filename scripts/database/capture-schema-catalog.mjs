import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {compareSchemaCatalog} from './compare-schema-catalog.mjs';
const root=path.resolve(import.meta.dirname,'../..');
// Used immediately after clean replay and before disposable tests create fixtures.
const raw=execFileSync('psql',['-X','-A','-t','-v','ON_ERROR_STOP=1','-f','scripts/database/schema-catalog.sql'],
 {cwd:root,encoding:'utf8',maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
const catalog=JSON.parse(raw);
if(catalog.schema_version!==1||!Array.isArray(catalog.objects)||!catalog.objects.length)throw Error('SCHEMA_CAPTURE_FAILED');
compareSchemaCatalog(catalog,catalog); // Reject duplicate identities before retaining evidence.
fs.mkdirSync(path.join(root,'.flexexa/index'),{recursive:true});
fs.writeFileSync(path.join(root,'.flexexa/index/schema-catalog.json'),JSON.stringify(catalog)+'\n');
console.log('SCHEMA_CATALOG='+JSON.stringify(catalog));
