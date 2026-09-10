import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSchemaCatalog} from '../database/compare-schema-catalog.mjs';
const catalog=()=>({schema_version:1,objects:[{kind:'relation',key:'public.example',sha256:'a'.repeat(64)},{kind:'policy',key:'public.example.read',sha256:'b'.repeat(64)}]});
test('catalog parity compares identities and fingerprints independently of row order',()=>{
 const a=catalog(),b=catalog();b.objects.reverse();assert.equal(compareSchemaCatalog(a,b).applicationCatalogMatches,true);
});
test('long qualified identities retain their distinct suffixes',()=>{
 const a=catalog();a.objects=[{kind:'constraint',key:'private.'+'long_table_name_'.repeat(5)+'.first',sha256:'a'.repeat(64)},
  {kind:'constraint',key:'private.'+'long_table_name_'.repeat(5)+'.second',sha256:'b'.repeat(64)}];
 assert.equal(compareSchemaCatalog(a,a).expectedObjects,2);
 const truncated=structuredClone(a);for(const item of truncated.objects)item.key=item.key.slice(0,63);
 assert.throws(()=>compareSchemaCatalog(truncated,truncated),/SCHEMA_DUPLICATE_OBJECT/);
});
for(const [name,mutate] of [
 ['missing object',c=>c.objects.pop()],['unexpected object',c=>c.objects.push({kind:'function',key:'public.unexpected()',sha256:'c'.repeat(64)})],
 ['changed RLS policy',c=>c.objects[1].sha256='c'.repeat(64)],['renamed object',c=>c.objects[0].key='public.other'],
])test(`catalog comparison detects ${name}`,()=>{const c=catalog();mutate(c);assert.equal(compareSchemaCatalog(catalog(),c).applicationCatalogMatches,false);});
for(const [name,mutate,code] of [
 ['empty',c=>c.objects=[],'SCHEMA_INVALID_CATALOG'],['version',c=>c.schema_version=2,'SCHEMA_INVALID_CATALOG'],
 ['duplicate',c=>c.objects.push({...c.objects[0]}),'SCHEMA_DUPLICATE_OBJECT'],['hash',c=>c.objects[0].sha256='invalid','SCHEMA_INVALID_OBJECT'],
 ['kind',c=>c.objects[0].kind='ignored','SCHEMA_INVALID_OBJECT'],['unknown property',c=>c.objects[0].ignore=true,'SCHEMA_INVALID_OBJECT'],
])test(`catalog comparison rejects ${name}`,()=>{const c=catalog();mutate(c);assert.throws(()=>compareSchemaCatalog(catalog(),c),new RegExp(code));});
