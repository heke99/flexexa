import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
// Managed preview uses the production build so browser QA exercises shipped code.
const command=process.argv.includes('--strictPort')?'start':'dev';
const args=process.argv.slice(2).filter(a=>a!=='--strictPort').map(a=>a==='--host'?'--hostname':a);
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),command,...args],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>process.exit(1));child.on('exit',code=>process.exit(code??1));
