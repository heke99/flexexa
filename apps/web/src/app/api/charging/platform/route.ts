import {createChargingProxy} from '../../../../lib/charging-proxy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const proxy=createChargingProxy();
export async function GET(request:Request){return proxy(request,'platform');}
