import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
export const ID_BUCKET='account-government-ids';
export async function cleanupAccountIds(db:SupabaseClient,limit=5){
 const result=await db.rpc('account_claim_id_cleanup',{p_limit:limit});
 if(result.error)throw new Error('ID cleanup unavailable');
 let deleted=0,failed=0;
 for(const job of result.data || []){
  let removed=false;
  try{const result=await db.storage.from(ID_BUCKET).remove([job.object_path]);removed=!result.error;}catch{/* Keep metadata until deletion is acknowledged. */}
  try{const done=await db.rpc('account_finish_id_cleanup',{p_document:job.document_id,p_claim:job.claim,p_success:removed});if(removed&&!done.error&&done.data===true)deleted++;else failed++;}catch{failed++;}
 }
 return {deleted,failed};
}
