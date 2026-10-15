import {after} from 'next/server';
import { consumeQuota, readInput, dispatchEmails } from '@/lib/server/lifecycle';
import { portalUser } from '@/lib/server/portal-auth';
import { validatePortalListing } from '@/lib/server/portal-listing';
import { randomBytes } from 'node:crypto';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
 try {
  const auth=await portalUser(request);
  if(!auth) return Response.json({error:'Sign in with WhatsApp, Google or email before posting.'},{status:401,headers});
  let input: Record<string,unknown>,row: Record<string,unknown>;
  try {input=await readInput(request);row=validatePortalListing(input.listing);}catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid listing.'},{status:400,headers});}
  if(typeof input.request_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.request_id))return Response.json({error:'Reload the posting form and try again.'},{status:400,headers});
  if(!await consumeQuota('listings-global',50))return Response.json({error:'Please try again later.'},{status:429,headers});
  const {data,error}=await auth.db.rpc('submit_account_listing',{p_listing:row,p_user:auth.user.id,p_email:auth.user.email_confirmed_at?auth.user.email:null,p_request:input.request_id,p_management_hash:randomBytes(32).toString('hex')});
  if(error)throw error;
  after(async()=>{try{await dispatchEmails(2,String(data));}catch{console.error('listing_confirmation_delivery_pending');}});
  return Response.json({saved:true,account_owned:true,listing_id:data},{headers});
 } catch(e) {
  const code=typeof e==='object'&&e&&'code' in e?String(e.code):'configuration_or_network';
  console.error('account_listing_submission_failed',{code});
  return Response.json({error:'Unable to submit your listing. Please try again later.'},{status:503,headers});
 }
}
