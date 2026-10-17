import 'server-only';
import {cache} from 'react';
import {createClient} from '@supabase/supabase-js';
import {referenceNumber} from '@/lib/property-links';
import type {Listing} from '@/lib/supabase';
// Public reads use the anonymous key and existing RLS, never the service-role key.
export const publicProperty=cache(async(reference:string):Promise<Listing|null>=>{
 const number=referenceNumber(reference);if(!number)return null;
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store'})}});
 const result=await db.from('listings').select('*').eq('listing_number',number).eq('is_active',true).eq('moderation_status','approved').gt('expires_at',new Date().toISOString()).maybeSingle();
 if(result.error)throw new Error('Unable to load the property. Please retry.');return result.data as Listing|null;
});
