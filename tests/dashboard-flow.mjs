import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
 const code = ts.transpileModule(readFileSync(new URL('../'+path, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',code)(name => Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 return mod.exports;
}
const store=new Map();
globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
globalThis.window={location:{origin:'https://preview.example'},dispatchEvent:()=>{}};
const saved=load('src/lib/client/saved-listings.ts');
const id='550e8400-e29b-41d4-a716-446655440000', key='a'.repeat(64);
const original=`/manage?listing=${id}&key=${key}`, path=`/manage?listing=${id}#key=${key}`;
assert.equal(saved.managementPath(original),path);
assert.equal(saved.managementPath(`https://older-preview.example${original}`),path);
assert.equal(saved.managementPath('javascript:alert(1)'),null);
assert.equal(saved.managementPath(`/manage?listing=${id}&key=nope`),null);
const row={id,path,title:'Test property',locality:'Azimabad, Balasore',rent:4500,savedAt:new Date().toISOString()};
assert(saved.saveListing(row));assert.equal(saved.savedListings().length,1);
assert(saved.saveListing({...row,title:'Updated title'}));assert.equal(saved.savedListings().length,1);assert.equal(saved.savedListings()[0].title,'Updated title');
assert(!saved.saveListing({...row,id:'bad'}));
saved.forgetListing(id);assert.deepEqual(saved.savedListings(),[]);
store.set('tolet:managed-listings:v1','broken');assert.deepEqual(saved.savedListings(),[]);
localStorage.setItem=()=>{throw Error('blocked')};assert.equal(saved.saveListing(row),false);
localStorage.setItem=(k,v)=>store.set(k,v);
const sort=load('src/lib/listing-sort.ts');
const unverified={id:'a',created_at:'2026-10-14',is_featured:false};
const email={...unverified,id:'b',created_at:'2026-10-01',email_verified:true};
const phone={...email,id:'c',email_verified:false,phone_verified:true};
const govt={...email,id:'d',email_verified:false,id_verified:true};
const boosted={...unverified,id:'e',is_featured:true};
assert.deepEqual([unverified,email,phone,govt,boosted].sort((a,b)=>sort.compareListings(a,b,'verified',true)).map(x=>x.id),['e','d','c','b','a']);
assert.equal(sort.compareListings(email,unverified,'verified',false)<0,true);
// Exercise the actual form submit handler, with only network/auth and React state mocked.
const data=load('src/data/odisha.ts');
let stateIndex=0, navigation='', success=0, request;
const values=['00000000-0000-4000-8000-000000000005',false,'Test property','','Boys Mess','Owner','4500','','','','Balasore','Azimabad','','','Test Host','9876543210',[],[],''];
const mockReact={...React,default:React,useState:initial=>{const idx=stateIndex++;return [values[idx]??initial,next=>{values[idx]=next;}];}};
const {PostAdModal}=load('src/components/PostAdModal.tsx',{
 './AdvertiserSignIn':{AdvertiserSignIn:()=>null},'./AdvertiserSession':{useAdvertiserSession:()=>({ready:true,session:{user:{email:'test@example.test'}}}),isAdvertiserSession:()=>true},react:mockReact,'next/navigation':{useRouter:()=>({push:p=>{navigation=p;}})},'next/link':{default:()=>null},
 '@/lib/client/saved-listings':saved,'./LocalityPicker':{LocalityPicker:()=>null},'@/lib/client/portal':{portalEnabled:false},'@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test',user:{email:'test@example.test'}}}})}}},'@/data/odisha':data
});
function find(element,type){if(!element||typeof element!=='object')return; if(element.type===type)return element;for(const child of [element.props?.children].flat(Infinity)){const found=find(child,type);if(found)return found;}}
globalThis.fetch=async (url,options)=>{request={url,body:JSON.parse(options.body)};return {ok:true,json:async()=>({saved:true,account_owned:true,listing_id:id})};};
let tree=PostAdModal({isOpen:true,isOdia:false,onClose:()=>{},onSuccess:()=>{success++;}});
await find(tree,'form').props.onSubmit({preventDefault(){}});
assert.equal(request.url,'/api/listings');assert.equal(request.body.listing.locality,'Azimabad');assert.equal(success,1);
assert.equal(navigation,'/listing-posted?listing='+id);assert.deepEqual(saved.savedListings(),[]);
// A failed request never shows a success page or stores an ownership link.
saved.forgetListing(id);navigation='';stateIndex=0;
globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Please try later'})});
tree=PostAdModal({isOpen:true,isOdia:false,onClose:()=>{},onSuccess:()=>{success++;}});
await find(tree,'form').props.onSubmit({preventDefault(){}});
assert.equal(navigation,'');assert.equal(success,1);assert.deepEqual(saved.savedListings(),[]);
const icons=load('src/components/BrandIcons.tsx');
const {default:Advertise}=load('src/app/advertise/page.tsx',{'next/link':{default:props=>React.createElement('a',props,props.children)},'@/components/BrandIcons':icons});
const html=renderToStaticMarkup(React.createElement(Advertise));
assert(html.includes('Chat on WhatsApp'));assert(!html.includes('WhatsApp: +91'));
const intent=html.match(/href="(https:\/\/wa.me\/[^\"]+)"/)[1].replaceAll('&amp;','&');
assert.equal(new URL(intent).pathname,'/917428975781');assert.match(new URL(intent).searchParams.get('text'),/Business name:/);
console.log('PASS signed-in post → account confirmation; old private-link persistence; failed post; storage unavailable; old-link restoration; verified ranking and boost priority; WhatsApp enquiry intent');
