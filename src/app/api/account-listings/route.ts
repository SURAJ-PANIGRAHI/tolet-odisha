import { createHash } from 'node:crypto';
import { portalUser } from '@/lib/server/portal-auth';
import { consumeQuota, readInput } from '@/lib/server/lifecycle';
import { validatePortalListing } from '@/lib/server/portal-listing';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export async function GET(request: Request) {
 try{
  const auth=await portalUser(request);if(!auth)return reply({error:'Please sign in.'},401);
  const keys=await auth.db.from('listing_management_keys').select('listing_id,removed_at').eq('verified_user',auth.user.id);
  if(keys.error)throw keys.error;
  if(!keys.data?.length)return reply({listings:[]});
  const rows=await auth.db.from('listings').select('*').in('id',keys.data.map(k=>k.listing_id)).order('created_at',{ascending:false});
  if(rows.error)throw rows.error;
  return reply({listings:rows.data?.map(row=>({...row,removed_at:keys.data.find(k=>k.listing_id===row.id)?.removed_at||null}))||[]});
 }catch{return reply({error:'Unable to load your account listings. Please retry.'},503);}
}
export async function POST(request: Request) {
 try{
  const auth=await portalUser(request);if(!auth)return reply({error:'Please sign in.'},401);
  let input:Record<string,unknown>;
  try{input=await readInput(request);}catch{return reply({error:'Invalid request.'},400);}
  if(!uuid(input.listing_id)||!['edit','remove','renew','claim'].includes(String(input.action)))return reply({error:'Invalid listing or action.'},400);
  if(!await consumeQuota('account-management-global',500))return reply({error:'Please try later.'},429);
  let data,error;
  if(input.action==='claim'){
   if(typeof input.key!=='string'||!/^[0-9a-f]{64}$/.test(input.key))return reply({error:'Invalid management link.'},400);
   ({data,error}=await auth.db.rpc('claim_account_listing',{p_user:auth.user.id,p_listing:input.listing_id,p_hash:createHash('sha256').update(input.key).digest('hex')}));
  }else{
   let row={};
   if(input.action==='edit'){try{row=validatePortalListing(input.listing);}catch(e){return reply({error:e instanceof Error?e.message:'Invalid listing.'},400);}}
   ({data,error}=await auth.db.rpc('manage_account_listing',{p_user:auth.user.id,p_listing:input.listing_id,p_action:input.action,p_data:row}));
  }
  if(error){if(error.code==='P0001'&&error.message.startsWith('Use your verified Phone'))return reply({error:'Use your verified Phone / WhatsApp number. Change it in account settings first.'},409);if(error.code==='P0001')return reply({error:'This listing cannot be changed or renewed in its current state. Renewal opens three days before expiry.'},409);throw error;}
  if(data!==true)return reply({error:'Listing not found in your account, or the private link is invalid.'},403);
  return reply({saved:true});
 }catch{return reply({error:'Unable to update your listing. Please retry.'},503);}
}
