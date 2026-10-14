import { DISTRICT_LOCALITIES } from '@/data/odisha';
export function LocalityPicker({district,value,customValue,onChange,onCustomChange}:{district:string;value:string;customValue:string;onChange:(value:string)=>void;onCustomChange:(value:string)=>void}){
 const known=DISTRICT_LOCALITIES[district.split(' ')[0]]||[];
 const options=known.length?known:['Other / ଅନ୍ୟାନ୍ୟ'];
 return <div className="space-y-2"><select aria-label="Locality / Area" required value={value} onChange={e=>onChange(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94] bg-white"><option value="">Select Area / Block</option>{options.map(loc=><option key={loc} value={loc}>{loc}</option>)}</select>{value==='Other / ଅନ୍ୟାନ୍ୟ'?<input aria-label="Other locality / area" type="text" placeholder="Type your area, village or block name..." value={customValue} onChange={e=>onCustomChange(e.target.value)} required className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94] bg-slate-50"/>:null}</div>;
}
