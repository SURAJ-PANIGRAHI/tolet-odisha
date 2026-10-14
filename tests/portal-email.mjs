import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const job={id:'job',claim_token:'claim',kind:'report',recipient:'support@toletodisha.in',listing_id:'listing',payload:{title:'Property',reason:'Wrong contact number',description:'Test report'}};
let responseStatus=200,throwFetch=false,sends=[],finished=[];
const db={rpc:async(name,args)=>name==='portal_claim_emails'?{data:[job],error:null}:(finished.push(args),{error:null})};
const mod={exports:{}};const source=ts.transpileModule(readFileSync(new URL('../src/lib/server/portal-email.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
new Function('require','module','exports',source)(name=>name==='server-only'?{}:{serverDb:()=>db},mod,mod.exports);
process.env.RESEND_API_KEY='test';process.env.EMAIL_FROM='support@toletodisha.in';process.env.APP_URL='https://tolet.test';
const originalFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{sends.push({url,options});if(throwFetch)throw Error('Timeout');return {ok:responseStatus===200,status:responseStatus};};
try {
 await mod.exports.dispatchPortalEmails();assert.equal(finished.at(-1).p_sent,true);assert.equal(sends[0].options.headers['Idempotency-Key'],'portal-job');assert.deepEqual(JSON.parse(sends[0].options.body).to,['support@toletodisha.in']);
 responseStatus=503;await mod.exports.dispatchPortalEmails();assert.equal(finished.at(-1).p_sent,false);assert.equal(finished.at(-1).p_permanent,false);
 responseStatus=422;await mod.exports.dispatchPortalEmails();assert.equal(finished.at(-1).p_permanent,true);
 throwFetch=true;await mod.exports.dispatchPortalEmails();assert.equal(finished.at(-1).p_permanent,false);throwFetch=false;
 job.kind='reminder';job.payload.token='nonce';responseStatus=200;await mod.exports.dispatchPortalEmails();assert(JSON.parse(sends.at(-1).options.body).text.includes('/renew?portal=1&token=nonce'));
}finally{globalThis.fetch=originalFetch;}
console.log('PASS portal mail: queued lease acknowledgement, stable idempotency, transient/permanent errors, timeout retries, explicit renewal link; no real emails sent');
