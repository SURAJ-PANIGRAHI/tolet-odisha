import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import assert from 'node:assert/strict';import ts from 'typescript';import {renderToStaticMarkup} from 'react-dom/server';import React from 'react';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const js=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod={exports:{}};new Function('require','module','exports',js)(name=>name in mocks?mocks[name]:require(name),mod,mod.exports);return mod.exports;}
const data=load('src/data/odisha.ts');const {LocalityPicker}=load('src/components/LocalityPicker.tsx',{'@/data/odisha':data});
const picker=(district,value)=>renderToStaticMarkup(React.createElement(LocalityPicker,{district,value,customValue:'Custom area',onChange:()=>{},onCustomChange:()=>{}}));
const blank=picker('Balasore (ବାଲେଶ୍ୱର)','');assert(!blank.includes('<input'));assert(blank.includes('Azimabad'));assert(blank.includes('Mallikashpur'));
assert(!picker('Balasore','Azimabad').includes('<input'));assert(picker('Balasore','Other / ଅନ୍ୟାନ୍ୟ').includes('aria-label="Other locality / area"'));
assert(!picker('A district with no presets','').includes('<input'));assert(picker('A district with no presets','Other / ଅନ୍ୟାନ୍ୟ').includes('<input'));
const {PostAdModal}=load('src/components/PostAdModal.tsx',{'./AdvertiserSignIn':{AdvertiserSignIn:()=>null},'./AdvertiserSession':{useAdvertiserSession:()=>({ready:true,session:{user:{email:'test@example.test'}}}),isAdvertiserSession:()=>true},'next/navigation':{useRouter:()=>({push:()=>{}})},'@/lib/client/saved-listings':{},'@/lib/supabase':{supabase:{}},'@/lib/client/portal':{portalEnabled:false,postingSession:()=>{}},'@/data/odisha':data,'./LocalityPicker':{LocalityPicker},'next/link':{default:props=>React.createElement('a',props,props.children)}});
const form=renderToStaticMarkup(React.createElement(PostAdModal,{isOpen:true,onClose:()=>{},onSuccess:()=>{},isOdia:false}));
assert(form.includes('<option value="Ladies Mess">'));assert(form.includes('<option value="Paying Guest (PG)">'));assert(!form.includes('aria-label="Other locality / area"'));assert(form.includes('Mallikashpur'));
const nav=readFileSync(new URL('../src/components/Navbar.tsx',import.meta.url),'utf8');assert(nav.includes('Pay Zero Commission'));assert(!nav.includes('Direct Owner • Zero Brokerage'));
console.log('PASS rendered posting UI: Ladies Mess/PG, Balasore localities, custom input only under Other (including districts without presets), explicit platform commission wording');

assert(form.includes('Post Free Listing')); assert(!form.includes('Post Free Advertisement'));

const sessionRules=load('src/components/AdvertiserSession.tsx',{'@/lib/supabase':{supabase:{}}});
assert.equal(sessionRules.isAdvertiserSession(null),false);
assert.equal(sessionRules.isAdvertiserSession({user:{is_anonymous:true,email_confirmed_at:'2026-01-01'}}),false);
assert.equal(sessionRules.isAdvertiserSession({user:{is_anonymous:false,email_confirmed_at:null}}),false);
const verifiedSession={user:{is_anonymous:false,email_confirmed_at:'2026-01-01'}};
assert.equal(sessionRules.isAdvertiserSession(verifiedSession),true);
let current=null;
const {Navbar}=load('src/components/Navbar.tsx',{'./AdvertiserSession':{useAdvertiserSession:()=>({session:current}),isAdvertiserSession:sessionRules.isAdvertiserSession},'next/link':{default:props=>React.createElement('a',props,props.children)}});
const renderNav=()=>renderToStaticMarkup(React.createElement(Navbar,{isOdia:false,setIsOdia:()=>{},onOpenPostModal:()=>{}}));
assert(!renderNav().includes('Manage My Listings'));assert(renderNav().includes('Post Free Listings'));
current=verifiedSession;assert(renderNav().includes('Manage My Listings'));
console.log('PASS tenant navigation hides management; confirmed advertiser navigation reveals it; anonymous and unconfirmed sessions rejected');

current={user:{is_anonymous:false,email_confirmed_at:null,phone_confirmed_at:"2026-01-01"}};assert.equal(sessionRules.isAdvertiserSession(current),true);assert(renderNav().includes("Manage My Listings"));
