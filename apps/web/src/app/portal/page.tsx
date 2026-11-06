import Portal from './portal';
import {publicConnectionConfig} from '../../lib/public-config';
export default function PortalPage(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL??'',key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??'';
 if(!url||!key)return <Portal url="" publishableKey=""/>;
 const config=publicConnectionConfig(url,key);return <Portal url={config.url} publishableKey={config.publishable_key}/>;
}
