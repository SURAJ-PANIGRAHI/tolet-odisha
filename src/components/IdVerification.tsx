'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ShieldCheck,Clock3,UploadCloud,LockKeyhole,RefreshCw,FileCheck2,AlertCircle} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {ID_TYPES,type IdType,type IdRecord} from '@/lib/id-verification';
async function requestId(method='GET',body?:FormData,signal?:AbortSignal){
 const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Please sign in again.');
 const response=await fetch('/api/verification/id',{method,body,signal,cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`}});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to update ID verification.');return result;
}
export function IdVerification(){
 const [record,setRecord]=useState<IdRecord|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [name,setName]=useState(''),[type,setType]=useState<IdType>('passport'),[file,setFile]=useState<File|null>(null),[consent,setConsent]=useState(false),[masked,setMasked]=useState(false),[withdraw,setWithdraw]=useState(false);
 useEffect(()=>{const abort=new AbortController();requestId('GET',undefined,abort.signal).then(r=>{if(!abort.signal.aborted){setRecord(r.document);setReady(true);}}).catch(e=>{if(!abort.signal.aborted){setError(e.message);setReady(true);}});return()=>abort.abort();},[]);
 async function refresh(){setBusy(true);setError('');try{const result=await requestId();setRecord(result.document);}catch(e){setError(e instanceof Error?e.message:'Unable to refresh.');}finally{setBusy(false);}}
 async function submit(event:React.FormEvent){
  event.preventDefault();if(!file||!consent)return;
  if(file.size>3*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Choose a JPEG, PNG or WebP image under 3 MB.');return;}
  setBusy(true);setError('');try{
   const form=new FormData();form.set('document',file);form.set('name',name);form.set('type',type);form.set('consent','yes');if(masked)form.set('masked','yes');
   await requestId('POST',form);setFile(null);setConsent(false);setRecord((await requestId()).document);
  }catch(e){setError(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(false);}
 }
 async function remove(){setBusy(true);setError('');try{await requestId('DELETE');setRecord((await requestId()).document);setWithdraw(false);}catch(e){setError(e instanceof Error?e.message:'Unable to withdraw ID.');}finally{setBusy(false);}}
 const pending=record?.status==='pending',approved=record?.status==='approved',waiting=record?.has_file;
 return <section id="government-id" className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <div className="flex items-start gap-3 border-b border-slate-100 p-6"><span className="rounded-xl bg-sky-50 p-3 text-[#005B94]"><ShieldCheck size={24}/></span><div className="flex-1"><h2 className="text-xl font-bold text-slate-900">Government ID verification</h2><p className="mt-1 text-sm text-slate-500">Optional identity review. Verification adds trust.</p></div><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-[#005B94]">48-hour review</span></div>
  <div className="space-y-5 p-6">
  <p className="text-sm leading-6 text-slate-600">Upload one accepted ID. Our administrator will manually review it within <strong>48 hours</strong>. Once approved, your listings receive a <strong>Government ID verified</strong> badge.</p>
  {!ready?<p role="status">Loading your verification status…</p>:<>
   {approved?<div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"><FileCheck2 className="shrink-0"/><div><strong>Government ID verified ✓</strong><p className="mt-1 text-sm">{record?.account_name} · {ID_TYPES[record!.document_type]}</p></div></div>:pending?<div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><Clock3 className="shrink-0"/><div><strong>Verification Pending (Up to 48 Hours)</strong><p className="mt-1 text-sm">Submitted {new Date(record!.submitted_at!).toLocaleString('en-IN')}. No further action is needed.</p></div></div>:record?.status==='deleting'||record?.status==='uploading'?<p role="status" className="rounded-xl bg-slate-50 p-4 text-sm">{record.status==='deleting'?'Your ID file is queued for secure deletion. Refresh shortly to submit another ID.':'An upload is being processed. Refresh to check its status.'}</p>:record?.status==='rejected'?<div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><strong>Document needs attention</strong><p className="mt-1 text-sm">{record.rejection_reason}. Please upload a clear, complete photo of an accepted ID.</p></div>:<p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600"><ShieldCheck size={16}/>Not verified</p>}
   {!waiting?<form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-semibold text-slate-700" htmlFor="id-legal-name">Full name as shown on your ID<input id="id-legal-name" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-3 font-normal"/></label>
    <label className="block text-sm font-semibold text-slate-700" htmlFor="id-document-type">Document type<select id="id-document-type" value={type} onChange={e=>{setType(e.target.value as IdType);setMasked(false);}} className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-3 font-normal">{Object.entries(ID_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {type==='masked_aadhaar'?<label className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><input required type="checkbox" checked={masked} onChange={e=>setMasked(e.target.checked)} className="mt-1"/><span>I have hidden the first eight Aadhaar digits. Only the last four digits are visible. Keep the name and photograph readable.</span></label>:null}
    <label className="block rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/40 p-5" htmlFor="government-id-image"><span className="flex items-center gap-2 font-semibold text-[#005B94]"><UploadCloud size={21}/>Choose your ID image</span><span className="mt-2 block text-xs text-slate-500">JPEG, PNG or WebP · Up to 3 MB · No other document types accepted</span><input id="government-id-image" required type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)} className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-[#005B94]"/></label>
    <label className="flex items-start gap-3 text-sm leading-6 text-slate-600"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1"/><span>I consent to a private manual identity review and the retention policy below. This is my own ID.</span></label>
    <button disabled={busy||!file||!consent||(type==='masked_aadhaar'&&!masked)} className="w-full rounded-xl bg-[#005B94] px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'Submitting securely…':'Submit ID for review'}</button>
   </form>:null}
   {record?.delete_after&&waiting?<p className="text-sm leading-6 text-slate-600">No active listings: your ID is scheduled for deletion after the seven-day renewal grace period, on {new Date(record.delete_after).toLocaleDateString('en-IN')}. Renewing before cleanup starts cancels this scheduled deletion.</p>:null}
   <div className="flex flex-wrap items-center gap-4"><button type="button" onClick={()=>void refresh()} disabled={busy} className="inline-flex items-center gap-2 text-sm font-semibold text-[#005B94]"><RefreshCw size={15} className={busy?'animate-spin':''}/>Refresh status</button>{waiting&&record?.status!=='deleting'?<button type="button" onClick={()=>setWithdraw(true)} disabled={busy} className="text-sm text-rose-700 underline">Withdraw and delete my ID</button>:null}{record?.is_admin?<Link href="/admin" className="text-sm font-bold text-[#005B94] underline">Open admin workspace</Link>:null}</div>
   {withdraw?<div role="alert" className="rounded-xl border border-rose-200 p-4 text-sm"><p>Delete your uploaded ID and remove its verification badge? You can submit another document later.</p><div className="mt-3 flex gap-3"><button disabled={busy} onClick={()=>void remove()} className="rounded-lg bg-rose-700 px-4 py-2 text-white">Delete ID</button><button disabled={busy} onClick={()=>setWithdraw(false)} className="rounded-lg border px-4 py-2">Keep ID</button></div></div>:null}
  </>}
  {error?<p role="alert" className="flex gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={18} className="shrink-0"/>{error}</p>:null}
  <div className="flex gap-3 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500"><LockKeyhole size={18} className="mt-1 shrink-0"/><div className="min-w-0"><h3 className="font-semibold text-slate-700">Your ID stays private</h3><ul className="mt-2 list-disc space-y-1.5 pl-4"><li>Only authorised admins can view it.</li><li>Deleted after all your listings are inactive for 7 days. Renew during this time to keep it on file.</li><li>Rejected or withdrawn IDs are queued for deletion immediately.</li></ul><p className="mt-3 border-t border-slate-200 pt-3">The badge verifies your identity, not property ownership.</p></div></div>
  </div>
 </section>;
}
