'use client';

import { POPULAR_AMENITIES, toggleAmenitySelection } from '@/data/odisha';

export function AmenitiesFilter({ selected, onChange, isOdia }: {
  selected: string[];
  onChange: (values: string[]) => void;
  isOdia: boolean;
}) {
  return (
    <div className="relative min-w-0 self-start">
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-700">
        <span>{isOdia ? 'ସୁବିଧା (Amenities)' : 'Amenities'}</span>
        {selected.length > 0 ? <button type="button" onClick={() => onChange([])} className="text-[#005B94] underline underline-offset-2">{isOdia ? 'ସଫା କରନ୍ତୁ' : 'Clear'}</button> : null}
      </div>
      <details className="group rounded-xl border border-slate-200 bg-white">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 p-3 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
          <span className="truncate">{selected.length ? `${selected.length} selected` : (isOdia ? 'ସୁବିଧା ବାଛନ୍ତୁ' : 'Choose amenities')}</span>
          <span aria-hidden="true" className="text-slate-500 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <fieldset className="max-h-72 overflow-y-auto border-t border-slate-100 p-2 sm:absolute sm:inset-x-0 sm:top-full sm:z-20 sm:mt-1 sm:rounded-xl sm:border sm:border-slate-200 sm:bg-white sm:shadow-lg">
          <legend className="sr-only">Select amenities</legend>
          <p className="px-2 py-1 text-xs text-slate-500">{isOdia ? 'ବାଛିଥିବା ସମସ୍ତ ସୁବିଧା ଥିବା ଘର।' : 'Properties must have all selected amenities.'}</p>
          {POPULAR_AMENITIES.map(amenity => <label key={amenity} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-blue-50">
            <input type="checkbox" checked={selected.includes(amenity)} onChange={() => onChange(toggleAmenitySelection(selected, amenity))} className="h-4 w-4 accent-[#005B94]" />
            {amenity}
          </label>)}
        </fieldset>
      </details>
      {selected.length > 0 ? <p className="mt-1 text-xs leading-5 text-slate-500">{selected.join(' · ')}</p> : null}
    </div>
  );
}
