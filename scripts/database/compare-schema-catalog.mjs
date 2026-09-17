import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const kinds=new Set(['schema','relation','column','constraint','index','function','policy','trigger','sequence','default_acl','enum']);
function index(catalog){
 if(catalog?.schema_version!==1||!Array.isArray(catalog.objects)||!catalog.objects.length)throw Error('SCHEMA_INVALID_CATALOG');
 const map=new Map();
 for(const item of catalog.objects){
  if(!item||Object.keys(item).sort().join(',')!=='key,kind,sha256'||!kinds.has(item.kind)||typeof item.key!=='string'||!item.key||
   typeof item.sha256!=='string'||!/^[a-f0-9]{64}$/u.test(item.sha256))throw Error('SCHEMA_INVALID_OBJECT');
  const id=item.kind+':'+item.key;if(map.has(id))throw Error('SCHEMA_DUPLICATE_OBJECT');map.set(id,item.sha256);
 }
 return map;
}
export function compareSchemaCatalog(expected,actual){
 const left=index(expected),right=index(actual),differences=[];
 for(const key of [...new Set([...left.keys(),...right.keys()])].sort()){
  if(left.get(key)!==right.get(key))differences.push({object:key,expected:left.get(key)??null,actual:right.get(key)??null});
 }
 return {applicationCatalogMatches:differences.length===0,expectedObjects:left.size,actualObjects:right.size,differences};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==4)throw Error('SCHEMA_EXPECTED_TWO_FILES');
  const read=file=>{if(fs.statSync(file).size>2*1024*1024)throw Error('SCHEMA_CATALOG_TOO_LARGE');return JSON.parse(fs.readFileSync(file,'utf8'));};
  const result=compareSchemaCatalog(read(process.argv[2]),read(process.argv[3]));console.log(JSON.stringify(result));
  if(!result.applicationCatalogMatches)process.exitCode=1;
 }catch(error){console.error(/^SCHEMA_[A-Z_]+$/u.test(error.message)?error.message:'SCHEMA_COMPARISON_FAILED');process.exitCode=1;}
}
