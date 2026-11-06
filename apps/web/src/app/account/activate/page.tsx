import type {Metadata} from 'next';
import {publicConnectionConfig} from '../../../lib/public-config';
import AccountActivation from './recovery';
export const metadata:Metadata={title:'Aktivera konto | Flexexa',referrer:'no-referrer',robots:{index:false,follow:false}};
export default function Page(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL??'',key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??'';const config=url&&key?publicConnectionConfig(url,key):null;return <AccountActivation url={config?.url??''} publishableKey={config?.publishable_key??''}/>;}
