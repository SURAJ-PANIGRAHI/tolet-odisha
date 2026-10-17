import 'server-only';
import {serverDb} from './lifecycle';
export async function cleanupInactiveListings(){
 const db=serverDb();const purged=await db.rpc('purge_inactive_listings',{p_limit:100});if(purged.error)throw purged.error;
 const jobs=await db.from('listing_photo_cleanup').select('photo_url').order('created_at').limit(30);if(jobs.error)throw jobs.error;
 const prefix=process.env.NEXT_PUBLIC_SUPABASE_URL+'/storage/v1/object/public/listing-images/';let photos=0;
 for(const job of jobs.data||[]){
  const url=job.photo_url;
  // Only this application's listing bucket may be cleaned; never follow remote URLs.
  if(url.startsWith(prefix)){
   let path:string|null=null;try{path=decodeURIComponent(url.slice(prefix.length));}catch{/* Invalid paths are discarded without touching storage. */}
   if(path&&path.startsWith('listings/')&&!path.includes('..')&&!path.includes('?')&&!path.includes('#')){
    const references=await db.from('listings').select('id').contains('images',[url]).limit(1);if(references.error)throw references.error;
    if(!references.data?.length){const removed=await db.storage.from('listing-images').remove([path]);if(removed.error)continue;photos++;}
   }
  }
  const done=await db.from('listing_photo_cleanup').delete().eq('photo_url',url);if(done.error)throw done.error;
 }
 return {listings:purged.data||0,photos};
}
