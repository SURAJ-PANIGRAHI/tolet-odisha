'use client';

// Equal-width stops keep everyday residential budgets easy to select.
const RENT_STOPS = [1000, 5000, 10000, 20000, 50000, 80000, 120000, 150000, 200000, 300000, 500000] as const;
const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
const ABOVE = RENT_STOPS.length;
const amountAt = (index: number) => RENT_STOPS[index] ?? 500001;

export function RentBudgetSlider({ minValue, value, onMinChange, onChange, isOdia = false }: {
  minValue: number;
  value: number | null;
  onMinChange: (value: number) => void;
  onChange: (value: number | null) => void;
  isOdia?: boolean;
}) {
  const low = minValue > 500000 ? ABOVE : RENT_STOPS.findIndex(stop => stop >= minValue);
  const high = value === null ? ABOVE : RENT_STOPS.findIndex(stop => stop >= value);
  const chooseLow = (index: number) => onMinChange(amountAt(Math.min(index, high)));
  const chooseHigh = (index: number) => onChange(index === ABOVE ? null : amountAt(Math.max(index, low)));
  const inputStyle = 'pointer-events-none absolute inset-0 m-0 h-11 w-full appearance-none bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#005B94] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#005B94] [&::-moz-range-thumb]:bg-white';
  const fieldStyle = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

  return (
    <section aria-label="Monthly rent budget" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:max-w-[360px]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <label className="min-w-0 text-xs font-medium text-slate-600">{isOdia ? 'ସର୍ବନିମ୍ନ ଭଡ଼ା' : 'Min Rent'}
          <select value={low} onChange={event => chooseLow(Number(event.target.value))} className={`${fieldStyle} mt-1`}>
            {RENT_STOPS.map((amount, index) => <option key={amount} value={index} disabled={index > high}>{money(amount)}</option>)}
            <option value={ABOVE} disabled={high < ABOVE}>Above ₹5,00,000</option>
          </select>
        </label>
        <span className="pb-3 text-xs text-slate-500">to</span>
        <label className="min-w-0 text-xs font-medium text-slate-600">{isOdia ? 'ସର୍ବାଧିକ ଭଡ଼ା' : 'Max Rent'}
          <select value={high} onChange={event => chooseHigh(Number(event.target.value))} className={`${fieldStyle} mt-1`}>
            {RENT_STOPS.map((amount, index) => <option key={amount} value={index} disabled={index < low}>{money(amount)}</option>)}
            <option value={ABOVE}>No maximum</option>
          </select>
        </label>
      </div>
      <div className="relative h-11">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-5 h-1.5 rounded-full bg-slate-200">
          <div className="absolute h-full rounded-full bg-[#005B94]" style={{ left: `${low / ABOVE * 100}%`, right: `${100 - high / ABOVE * 100}%` }} />
        </div>
        <input type="range" min={0} max={ABOVE} step={1} value={low} aria-label="Minimum monthly rent" aria-valuetext={low === ABOVE ? 'Above ₹5,00,000' : money(minValue)}
          onChange={event => chooseLow(Number(event.target.value))} className={inputStyle} style={{ zIndex: low === high && high === ABOVE ? 3 : 1 }} />
        <input type="range" min={0} max={ABOVE} step={1} value={high} aria-label="Maximum monthly rent" aria-valuetext={value === null ? 'No maximum' : money(value)}
          onChange={event => chooseHigh(Number(event.target.value))} className={inputStyle} style={{ zIndex: 2 }} />
      </div>
      <div aria-hidden="true" className="hidden justify-between px-3">
        {Array.from({ length: ABOVE + 1 }, (_, index) => <span key={index} className={`h-1.5 w-0.5 rounded-full ${index >= low && index <= high ? 'bg-[#005B94]' : 'bg-slate-200'}`} />)}
      </div>
      <div aria-hidden="true" className="mt-1 flex justify-between text-xs font-medium text-slate-500"><span>₹1,000</span><span>₹5,00,000+</span></div>
    </section>
  );
}
