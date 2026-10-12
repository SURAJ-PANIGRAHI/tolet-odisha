/* eslint-disable @typescript-eslint/no-require-imports */
// Run after npm run build; requires Playwright and its Chromium browser.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3001';
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', '3001'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
let logs = '';server.stdout.on('data', x => logs += x);server.stderr.on('data', x => logs += x);
let browser;
(async () => {
 for(let i=0;i<100;i++){try{if((await fetch(base, {signal: AbortSignal.timeout(1000)})).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));if(i===99)throw Error(logs);}
 console.log('Local server ready');
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),args:['--no-sandbox']});
 console.log('Browser launched');
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const rows=[['old','Older room',1000,'Boys Mess','2026-10-01'],['office','Office rental',25000,'Commercial / Shop','2026-10-02'],['warehouse','Warehouse rental',60000,'Commercial / Shop','2026-10-03'],['pg','PG rental',4000,'Paying Guest (PG)','2026-10-04'],['ladies','Ladies rental',3000,'Ladies Mess','2026-10-05']].map(([id,title,rent_monthly,category,created_at])=>({id,title,rent_monthly,category,created_at,expires_at:'2099-01-01',district:'Balasore',locality:'Test locality',contact_name:'Test',contact_phone:'9876543210',images:[],amenities:[],deposit:0,is_active:true,commercial_type:id==='office'?'Office Space':id==='warehouse'?'Warehouse / Godown':null,area_sqft:id==='office'?2100:id==='warehouse'?4000:null}));
 await page.route('**/rest/v1/listings*', route=>route.fulfill({json:rows}));
 await page.goto(base);await page.getByRole('heading',{name:'Ladies rental'}).waitFor();
 const titles=()=>page.locator('main h3').allTextContents();
 assert.deepEqual(await titles(),['Ladies rental','PG rental','Warehouse rental','Office rental','Older room']);
 await page.getByLabel('Sort by',{exact:true}).selectOption('oldest');assert.equal((await titles())[0],'Older room');
 await page.getByLabel('Sort by',{exact:true}).selectOption('price-low');assert.deepEqual(await titles(),['Older room','Ladies rental','PG rental','Office rental','Warehouse rental']);
 await page.getByLabel('Sort by',{exact:true}).selectOption('price-high');assert.equal((await titles())[0],'Warehouse rental');
 await page.getByLabel('Property type',{exact:true}).selectOption('Commercial / Shop');assert.equal((await titles()).length,2);
 await page.getByLabel('Commercial type',{exact:true}).selectOption('Warehouse / Godown');assert.deepEqual(await titles(),['Warehouse rental']);await page.getByText('4,000 sq ft',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Paying Guest (PG)',exact:true}).click();assert.deepEqual(await titles(),['PG rental']);assert.equal(await page.getByLabel('Property type',{exact:true}).inputValue(),'Paying Guest (PG)');
 await page.getByLabel('Property type',{exact:true}).selectOption('All');
 const slider=page.getByRole('slider',{name:'Maximum monthly rent'});assert.equal(await slider.getAttribute('min'),'1000');assert.equal(await slider.getAttribute('max'),'60000');
 await slider.fill('1000');assert.deepEqual(await titles(),['Older room']);await slider.fill('60000');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'No mobile horizontal overflow');
 await page.getByRole('button',{name:/Post Free Listings/}).first().click();
 const category=page.locator('select').filter({has:page.locator('option[value="Boys Mess"]')}).last();
 await category.selectOption('Commercial / Shop');assert.equal(await page.getByLabel('Floor area (sq ft) *',{exact:true}).getAttribute('required'),'');
 await page.getByLabel('Commercial type *',{exact:true}).selectOption('Warehouse / Godown');await page.getByLabel('Floor area (sq ft) *',{exact:true}).fill('4000');
 await category.selectOption('Paying Guest (PG)');assert.equal(await page.getByLabel('Floor area (sq ft) — optional',{exact:true}).getAttribute('required'),null);assert.equal(await page.getByLabel('Floor area (sq ft) — optional',{exact:true}).inputValue(),'');
 const invalid={listing:{title:'Test',district:'Balasore',locality:'Test',contact_name:'Test',contact_phone:'9876543210',category:'Commercial / Shop',rent_monthly:20000,deposit:0,images:[],amenities:[]}};
 const response=await fetch(base+'/api/listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(invalid)});assert.equal(response.status,400);assert.match((await response.json()).error,/floor area/);
 console.log('PASS: all sort orders, commercial filtering, PG and pill sync, budget bounds, mobile layout, conditional fields and server validation');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.kill();});
