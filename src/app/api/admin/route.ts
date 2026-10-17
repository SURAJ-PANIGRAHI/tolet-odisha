import {randomBytes} from 'node:crypto';
import {validatePortalListing} from '@/lib/server/portal-listing';
import {after} from 'next/server';
import {dispatchSupportReplies} from '@/lib/server/support';
import { portalUser } from '@/lib/server/portal-auth';
import { readInput } from '@/lib/server/lifecycle';
import { cleanupAccountIds,ID_BUCKET } from '@/lib/server/account-id';
import { isUuid } from '@/lib/server/evolution';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
async function administrator(request:Request){
 const auth=await portalUser(request);if(!auth)return null;
 const member=await auth.db.from('admin_users').select('user_id').eq('user_id',auth.user.id).maybeSingle();
 if(member.error)throw member.error;return member.data?auth:null;
}
export async function GET(request:Request){
 try{
  const auth=await administrator(request);if(!auth)return reply({error:'Administrator sign-in required.'},403);
  const params=new URL(request.url).searchParams;
  if(params.get('scope')==='support'){
   const ticket=params.get('ticket');
   if(ticket){
    if(!isUuid(ticket))return reply({error:'Invalid ticket.'},400);
    const [messages,replies]=await Promise.all([auth.db.from('support_messages').select('id,body,created_at').eq('ticket_id',ticket).order('created_at',{ascending:true}).limit(100),auth.db.from('support_replies').select('id,body,created_at,sent_at,last_error').eq('ticket_id',ticket).order('created_at',{ascending:true}).limit(100)]);
    if(messages.error||replies.error)throw new Error('Support messages unavailable');return reply({messages:messages.data,replies:replies.data});
   }
   const tickets=await auth.db.from('support_tickets').select('id,reference,phone,category,summary,status,created_at,updated_at').order('updated_at',{ascending:false}).limit(100);if(tickets.error)throw tickets.error;return reply({tickets:tickets.data});
  }
  const id=new URL(request.url).searchParams.get('document');
  if(id){
   if(!isUuid(id))return reply({error:'Invalid document.'},400);
   const file=await auth.db.rpc('account_admin_id_file',{p_admin:auth.user.id,p_document:id});if(file.error)throw file.error;
   if(!file.data)return reply({error:'Document no longer available.'},404);
   const image=await auth.db.storage.from(ID_BUCKET).download(file.data);if(image.error||!image.data)throw new Error('File unavailable');
   return new Response(await image.data.arrayBuffer(),{headers:{...headers,'Content-Type':image.data.type,'Content-Disposition':'inline'}});
  }
  const [queue,reports,listings]=await Promise.all([
   auth.db.rpc('account_admin_id_queue',{p_admin:auth.user.id}),
   auth.db.from('reports').select('id,listing_id,reason,description,created_at,resolved_at').order('created_at',{ascending:false}).limit(200),
   auth.db.from('listings').select('*').order('created_at',{ascending:false}).limit(200)
  ]);
  if(queue.error||reports.error||listings.error)throw new Error('Queue unavailable');
  const documents=queue.data?.documents||[];
  const owners=[...new Set(documents.map((doc:{user_id:string})=>doc.user_id).filter(Boolean))];
  const ownership=owners.length?await auth.db.from('listing_management_keys').select('verified_user,listings(*)').in('verified_user',owners):{data:[],error:null};
  if(ownership.error)throw ownership.error;
  const linked=documents.map((doc:{user_id:string})=>({...doc,properties:(ownership.data||[]).filter(item=>item.verified_user===doc.user_id).flatMap(item=>item.listings||[])}));
  return reply({...queue.data,documents:linked,reports:reports.data,listings:listings.data});
 }catch{return reply({error:'Unable to load the admin workspace. Please retry.'},503);}
}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Invalid origin."},403);
 try{
  const auth=await administrator(request);if(!auth)return reply({error:'Administrator sign-in required.'},403);
  let input:Record<string,unknown>;try{input=await readInput(request);}catch{return reply({error:'Invalid request.'},400);}
  if(input.action==='create_listing'){
   if(typeof input.request_id!=='string'||!isUuid(input.request_id))return reply({error:'Reload the form and try again.'},400);
   let row:Record<string,unknown>;try{row=validatePortalListing(input.listing);}catch(error){return reply({error:error instanceof Error?error.message:'Invalid listing.'},400);}
   const result=await auth.db.rpc('submit_account_listing',{p_listing:row,p_user:auth.user.id,p_email:auth.user.email_confirmed_at?auth.user.email:null,p_request:input.request_id,p_management_hash:randomBytes(32).toString('hex')});
   if(result.error)throw result.error;return reply({saved:true,listing_id:result.data});
  }
  if(input.action==='edit_listing'){
   if(typeof input.listing_id!=='string'||!isUuid(input.listing_id))return reply({error:'Invalid listing.'},400);
   let row:Record<string,unknown>;try{row=validatePortalListing(input.listing);}catch(error){return reply({error:error instanceof Error?error.message:'Invalid listing.'},400);}
   const result=await auth.db.from('listings').update(row).eq('id',input.listing_id).select('id').maybeSingle();
   if(result.error)throw result.error;if(!result.data)return reply({error:'Listing not found.'},404);
   return reply({saved:true});
  }
  if(input.action==='support_reply'||input.action==='support_resolve'){
   if(typeof input.ticket_id!=='string'||!isUuid(input.ticket_id))return reply({error:'Invalid ticket.'},400);
   const sending=input.action==='support_reply';
   if(sending&&(typeof input.text!=='string'||!input.text.trim()||input.text.length>1500||typeof input.request_id!=='string'||!isUuid(input.request_id)))return reply({error:'Enter a reply up to 1500 characters.'},400);
   const result=await auth.db.rpc('support_admin_action',{p_admin:auth.user.id,p_ticket:input.ticket_id,p_action:sending?'reply':'resolve',p_text:sending?String(input.text).trim():null,p_request:sending?input.request_id:null});if(result.error)throw result.error;if(result.data!==true)return reply({error:'Ticket not found.'},404);
   if(sending)after(async()=>{try{await dispatchSupportReplies(5);}catch{console.error('support_reply_delivery_pending');}});
   return reply({saved:true,queued:sending});
  }
  if(input.action==='review_id'){
   if(typeof input.document_id!=='string'||!isUuid(input.document_id)||typeof input.approve!=='boolean')return reply({error:'Invalid review.'},400);
   const reason=typeof input.reason==='string'?input.reason:null;
   if(!input.approve&&!['Blurry image','Name mismatch','Incomplete ID','Unsupported document'].includes(reason||''))return reply({error:'Choose a rejection reason.'},400);
   const result=await auth.db.rpc('account_review_id',{p_admin:auth.user.id,p_document:input.document_id,p_approve:input.approve,p_reason:reason});
   if(result.error)throw result.error;if(result.data!==true)return reply({error:'This document has already changed. Refresh the queue.'},409);
   // Review is durable even when storage is temporarily unavailable; cron retries cleanup.
   if(!input.approve){try{await cleanupAccountIds(auth.db,5);}catch{/* durable cleanup remains queued */}}
   return reply({reviewed:true});
  }
  if(input.action==='moderate'){
   if(typeof input.listing_id!=='string'||!isUuid(input.listing_id)||typeof input.approve!=='boolean')return reply({error:'Invalid listing action.'},400);
   const result=await auth.db.rpc('account_admin_moderate_listing',{p_admin:auth.user.id,p_listing:input.listing_id,p_approve:input.approve});
   if(result.error)throw result.error;if(result.data!==true)return reply({error:'Listing not found.'},404);
   return reply({reviewed:true});
  }
  return reply({error:'Unknown action.'},400);
 }catch{return reply({error:'Unable to save the review. Refresh and retry.'},503);}
}
