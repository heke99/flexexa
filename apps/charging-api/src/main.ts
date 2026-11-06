import {createChargingReadServer} from './server.ts';
import {createChargingDatabase} from './supabase.ts';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,port=Number(process.env.PORT??8080);
if(!url||!key||!Number.isInteger(port)||port<1||port>65535)throw Error('CHARGING_CONFIGURATION_REQUIRED');
const server=createChargingReadServer(createChargingDatabase({url,publishableKey:key}));
server.listen(port,'0.0.0.0');
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close();setTimeout(()=>{server.closeAllConnections();},10000).unref();});
