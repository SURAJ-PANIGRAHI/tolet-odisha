import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import assert from 'node:assert/strict';import ts from 'typescript';import {renderToStaticMarkup} from 'react-dom/server';import React from 'react';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const js=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod={exports:{}};new Function('require','module','exports',js)(name=>name in mocks?mocks[name]:require(name),mod,mod.exports);return mod.exports;}
const data=load('src/data/odisha.ts');const {LocalityPicker}=load('src/components/LocalityPicker.tsx',{'@/data/odisha':data});
const picker=(district,value)=>renderToStaticMarkup(React.createElement(LocalityPicker,{district,value,customValue:'Custom area',onChange:()=>{},onCustomChange:()=>{}}));
const blank=picker('Balasore (ବାଲେଶ୍ୱର)','');assert(!blank.includes('<input'));assert(blank.includes('Azimabad'));assert(blank.includes('Mallikashpur'));
assert(!picker('Balasore','Azimabad').includes('<input'));assert(picker('Balasore','Other / ଅନ୍ୟାନ୍ୟ').includes('aria-label="Other locality / area"'));
assert(!picker('A district with no presets','').includes('<input'));assert(picker('A district with no presets','Other / ଅନ୍ୟାନ୍ୟ').includes('<input'));
const {PostAdModal}=load('src/components/PostAdModal.tsx',{'@/lib/supabase':{supabase:{}},'@/lib/client/portal':{portalEnabled:false,postingSession:()=>{}},'@/data/odisha':data,'./LocalityPicker':{LocalityPicker},'next/link':{default:props=>React.createElement('a',props,props.children)}});
const form=renderToStaticMarkup(React.createElement(PostAdModal,{isOpen:true,onClose:()=>{},onSuccess:()=>{},isOdia:false}));
assert(form.includes('<option value="Ladies Mess">'));assert(form.includes('<option value="Paying Guest (PG)">'));assert(!form.includes('aria-label="Other locality / area"'));assert(form.includes('Mallikashpur'));
const nav=readFileSync(new URL('../src/components/Navbar.tsx',import.meta.url),'utf8');assert(nav.includes('No commission charged by ToLet Odisha'));assert(!nav.includes('Direct Owner • Zero Brokerage'));
console.log('PASS rendered posting UI: Ladies Mess/PG, Balasore localities, custom input only under Other (including districts without presets), explicit platform commission wording');
