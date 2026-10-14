import { supabase } from '@/lib/supabase';
export async function accountListings(action?: string, data: Record<string,unknown> = {}, signal?:AbortSignal) {
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)throw new Error('Please sign in.');
 const response=await fetch('/api/account-listings',{method:action?'POST':'GET',signal,cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`,...(action?{'Content-Type':'application/json'}:{})},...(action?{body:JSON.stringify({action,...data})}:{})});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to load listings.');return result;
}
