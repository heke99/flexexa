import {createIdentityServer} from './server.ts';
const required=(name:string)=>{const value=process.env[name];if(!value)throw Error('IDENTITY_CONFIGURATION_MISSING');return value;};
try{
 const port=Number(process.env.PORT??8080);
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('IDENTITY_CONFIGURATION_INVALID');
 const server=createIdentityServer({url:required('SUPABASE_URL'),publishableKey:required('SUPABASE_PUBLISHABLE_KEY'),
  adminKey:required('SUPABASE_AUTH_ADMIN_KEY'),environment:required('FLEXEXA_ENVIRONMENT')});
 server.listen(port,'0.0.0.0');
 process.once('SIGTERM',()=>{server.close();setTimeout(()=>process.exit(1),15000).unref();});
}catch{console.error('IDENTITY_STARTUP_FAILED');process.exitCode=1;}
