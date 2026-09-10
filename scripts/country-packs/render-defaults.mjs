import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../..');
export function renderCountryDefaults(){
 const source=readFileSync(resolve(root,'country-packs/se/v1.json'),'utf8'),pack=JSON.parse(source);
 const defaults=Object.fromEntries(['country_code','timezone','currency','locale'].map(k=>{assert.equal(typeof pack[k],'string');return [k,pack[k]];}));
 const prior=readFileSync(resolve(root,'supabase/migrations/20260909135947_phase0_core_mutations.sql'),'utf8');
 const start=prior.indexOf('create function private.flexexa_normalize_core_input('),end=prior.indexOf('\nend $$;',start);
 assert(start>=0&&end>start);let normalizer=prior.slice(start,end+'\nend $$;'.length).replace('create function','create or replace function');
 for(const [from,to] of [["else 'SE' end;","else private.flexexa_core_v1_country_defaults()->>'country_code' end;"],
  ["else 'Europe/Stockholm' end)","else private.flexexa_core_v1_country_defaults()->>'timezone' end)"]]){
  assert.equal(normalizer.split(from).length,2);normalizer=normalizer.replace(from,to);
 }
 const literal=JSON.stringify(defaults).replaceAll("'","''");
 const columns={organizations:['country_code','timezone','currency'],tenants:['country_code','timezone'],customers:['locale','timezone'],sites:['country_code','timezone']};
 const alters=Object.entries(columns).flatMap(([table,keys])=>keys.map(k=>`alter table public.${table} alter column ${k} set default (private.flexexa_core_v1_country_defaults()->>'${k}');`)).join('\n');
 return `-- Generated from immutable country-packs/se/v1.json; source SHA256 ${createHash('sha256').update(source).digest('hex')}.\n-- Preserve V1 normalized requests, hashes, historical receipts and existing rows.\ncreate function private.flexexa_core_v1_country_defaults()\nreturns jsonb language sql immutable set search_path='' as $$\n select '${literal}'::jsonb\n$$;\nrevoke all on function private.flexexa_core_v1_country_defaults() from public,anon,authenticated;\ngrant execute on function private.flexexa_core_v1_country_defaults() to authenticated,service_role;\ncomment on function private.flexexa_core_v1_country_defaults() is 'Immutable core V1 country defaults compiled from country pack version 1.0.0. Metadata is not tax, market or control readiness.';\n\n${normalizer}\n\n${alters}\n`;
}
