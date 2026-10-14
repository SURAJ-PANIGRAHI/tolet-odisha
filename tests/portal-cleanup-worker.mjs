import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=readFileSync(new URL('../supabase/functions/portal-id-cleanup/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/m,'');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});
assert.equal((compiled.diagnostics||[]).length,0);
const secret='x'.repeat(40);
let handler, events=[], removeFails=false, throwRemove=false;
const db={
 rpc:async(name,args)=>{
  events.push({name,args});
  if(name==='portal_claim_id_cleanup')return {data:[{id:'job',claim_token:'claim',object_path:'user/document.jpg'}],error:null};
  return {error:null};
 },
 storage:{from:bucket=>({remove:async paths=>{events.push({name:'remove',bucket,paths});if(throwRemove)throw Error('Timeout');return {error:removeFails?{message:'Failure'}:null};}})},
};
const Deno={env:{get:key=>({PORTAL_CLEANUP_SECRET:secret,SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-key'}[key])},serve:f=>{handler=f;}};
new Function('createClient','Deno',compiled.outputText)(()=>db,Deno);
assert.equal((await handler(new Request('https://example/worker',{method:'POST'}))).status,401);
assert.equal(events.length,0);
assert.equal((await handler(new Request('https://example/worker',{method:'GET',headers:{'x-cron-secret':secret}}))).status,401);
assert.equal(events.length,0);
const request=()=>new Request('https://example/worker',{method:'POST',headers:{'x-cron-secret':secret}});
let response=await handler(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{deleted:1,failed:0});
assert.deepEqual(events.map(x=>x.name),['portal_claim_id_cleanup','remove','portal_finish_id_cleanup']);
assert.equal(events[1].bucket,'portal-government-ids');assert.equal(events[2].args.p_success,true);
events=[];removeFails=true;response=await handler(request());assert.equal(response.status,503);assert.equal(events[2].args.p_success,false);
events=[];throwRemove=true;response=await handler(request());assert.equal(response.status,503);assert.equal(events[2].args.p_success,false);
console.log('PASS ID worker: secret auth, method restriction, Storage-before-ack ordering, failed/uncertain deletion remains retryable');
