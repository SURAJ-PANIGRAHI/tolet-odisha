'use client';

import Link from 'next/link';
import { RentBudgetSlider } from '@/components/RentBudgetSlider';
import { compareListings } from '@/lib/listing-sort';
import { portalEnabled } from '@/lib/client/portal';
import React, { useEffect, useState, useMemo } from 'react';
import { supabase, Listing } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { ListingCard } from '@/components/ListingCard';
import dynamic from 'next/dynamic';
const ListingDetailModal=dynamic(()=>import('@/components/ListingDetailModal').then(module=>module.ListingDetailModal));
const PostAdModal=dynamic(()=>import('@/components/PostAdModal').then(module=>module.PostAdModal));
import { SponsorBanner } from '@/components/SponsorBanner';
import { ODISHA_DISTRICTS, DISTRICT_LOCALITIES, CATEGORIES, COMMERCIAL_TYPES } from '@/data/odisha';
import { Search, MapPin, PlusCircle, Sparkles, AlertCircle, RefreshCw, Grid2X2, House, Check } from 'lucide-react';

export default function RentalLanding({preview=false}:{preview?:boolean}) {
  const [listings, setListings] = useState<Listing[]>(preview?sampleListings:[]);
  const [loading, setLoading] = useState(!preview);
  const [fetchError, setFetchError] = useState(false);
  const [submissionNotice, setSubmissionNotice] = useState(false);
  const [isOdia, setIsOdia] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  // Filter States
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('Balasore');
  const [selectedLocality, setSelectedLocality] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  // A null maximum includes listings above ₹5 lakh too.
  const [minRent, setMinRent] = useState(1000);
  const [maxRent, setMaxRent] = useState<number | null>(null);
  const [commercialType, setCommercialType] = useState('All');
  const [sortBy, setSortBy] = useState(portalEnabled ? 'recommended' : 'newest');
  function selectCategory(value: string) {
    setSelectedCategory(value);
    setCommercialType('All');
  }

  // Fetch public listings once, ignoring results after unmount.
  useEffect(() => {
    if(preview)return;
    let cancelled = false;
    if (new URLSearchParams(window.location.search).get('post') === '1') {
      queueMicrotask(() => { if (!cancelled) setIsPostModalOpen(true); });
    }
    async function load() {
      try {
        const { data, error } = await supabase.from('listings').select('*')
          .eq('is_active', true).order('created_at', { ascending: false });
        if (error) throw error;
        let combined: Listing[] = data || [];
        if (portalEnabled) {
          const response = await fetch('/api/portal?scope=feed', { cache: 'no-store' });
          const portal = await response.json();
          if (!response.ok) throw new Error('Portal feed unavailable');
          combined = [...combined, ...portal.listings];
        }
        if (!cancelled) {setListings(combined);const requested=new URLSearchParams(window.location.search).get('listing');if(requested)setSelectedListing(combined.find(item=>item.id===requested)||null);}
      } catch {
        if (!cancelled) setFetchError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [preview]);

  // Available localities for current selected district
  const availableLocalities = useMemo(() => {
    const cleanDist = selectedDistrict.split(' ')[0];
    return DISTRICT_LOCALITIES[cleanDist] || [];
  }, [selectedDistrict]);

  // Filter logic
  const filteredListings = useMemo(() => {
    return listings.map(item => item.portal_listing && item.is_featured && item.boost_expires_at && Date.parse(item.boost_expires_at) <= clock ? { ...item, is_featured: false, ranking_score: Number(item.ranking_score || 0) - 1000 } : item).filter((item) => {
      if (item.expires_at && Date.parse(item.expires_at) <= clock) return false;
      // District filter
      if (selectedDistrict !== 'All') {
        const cleanSelected = selectedDistrict.split(' ')[0].toLowerCase();
        if (!item.district.toLowerCase().includes(cleanSelected)) return false;
      }

      // Locality / Block dropdown filter
      if (selectedLocality !== 'All') {
        if (!item.locality.toLowerCase().includes(selectedLocality.toLowerCase())) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      if (selectedCategory === 'Commercial / Shop' && commercialType !== 'All' && item.commercial_type !== commercialType) return false;

      // Max Rent filter
      if (item.rent_monthly < minRent || (maxRent !== null && item.rent_monthly > maxRent)) {
        return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = `${item.title} ${item.category} ${item.commercial_type || ''}`.toLowerCase().includes(q);
        const matchesLocality = item.locality.toLowerCase().includes(q);
        const matchesLandmark = item.landmark?.toLowerCase().includes(q) || false;
        const matchesDistrict = item.district.toLowerCase().includes(q);
        if (!matchesTitle && !matchesLocality && !matchesLandmark && !matchesDistrict) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => compareListings(a, b, sortBy, portalEnabled));
  }, [listings, selectedDistrict, selectedLocality, selectedCategory, commercialType, sortBy, minRent, maxRent, searchQuery, clock]);

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-20 sm:pb-12">
      {/* Navigation */}
      <Navbar
        isOdia={isOdia}
        setIsOdia={setIsOdia}
        onOpenPostModal={() => setIsPostModalOpen(true)}
      />

      {preview?<div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">Interactive preview · Sample properties, not real advertisements. No enquiries are sent.</div>:null}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/60 to-white px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="landing-enter relative z-10 max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-2 text-xs font-bold text-[#005B94]"><Check size={14}/>{isOdia?'କୌଣସି କମିଶନ୍ ଦିଅନ୍ତୁ ନାହିଁ':'Pay Zero Commission'}</div>
              <h1 className="text-[2rem] font-medium leading-[1.14] tracking-[-0.035em] text-slate-900 sm:text-5xl lg:text-[3.4rem]">{isOdia?'ଓଡ଼ିଶାରେ ଘର, ମେସ୍ ଓ ହଷ୍ଟେଲ୍ ଖୋଜନ୍ତୁ':<>Find Rooms, Mess &amp;<br className="hidden sm:block"/> Hostels Across <span className="font-extrabold text-blue-600">Odisha.</span></>}</h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{isOdia?'ଆପଣଙ୍କ ଅଞ୍ଚଳରେ ଆପଣଙ୍କ ପସନ୍ଦର ଘର ଖୋଜନ୍ତୁ। ଫଟୋ, ଭଡ଼ା ଓ ଯୋଗାଯୋଗ ସବୁ ଗୋଟିଏ ସ୍ଥାନରେ।':'Your next place, a little closer. Explore local rentals, compare the details and connect with the advertiser.'}</p>
              <div className="mt-5 hidden flex-wrap items-center gap-x-5 sm:flex gap-y-2 text-xs font-semibold text-slate-600"><span className="flex items-center gap-1.5"><MapPin size={14} className="text-blue-600"/>{isOdia?'ସ୍ଥାନୀୟ ଅଞ୍ଚଳ':'Local neighbourhoods'}</span><span className="flex items-center gap-1.5"><House size={14} className="text-blue-600"/>{isOdia?'ଛାତ୍ର ଓ ପରିବାର ପାଇଁ':'For students & families'}</span></div>
            </div>
            <div className="hidden lg:block"><NeighbourhoodGraphic/></div>
          </div>
          <form aria-label="Find a rental" onSubmit={event=>{event.preventDefault();document.getElementById('rental-results')?.scrollIntoView({behavior:'smooth',block:'start'});}} className="landing-search mt-8 grid gap-1 rounded-2xl border border-slate-100 bg-white p-2 shadow-md shadow-slate-200/60 sm:mt-10 md:grid-cols-[1fr_1fr_1.4fr_auto]">
            <label className="relative min-w-0 rounded-xl px-4 py-3 focus-within:bg-blue-50/50"><span className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500"><MapPin size={14} className="text-blue-600"/>{isOdia?'ଜିଲ୍ଲା':'Location'}</span><select aria-label="District" value={selectedDistrict} onChange={e=>{setSelectedDistrict(e.target.value);setSelectedLocality('All');}} className="w-full bg-transparent pr-2 text-sm font-semibold text-slate-900 outline-offset-4"><option value="Balasore">Balasore (ବାଲେଶ୍ୱର)</option><option value="All">{isOdia?'ସମସ୍ତ ଓଡ଼ିଶା':'All Odisha'}</option>{ODISHA_DISTRICTS.filter(d=>!d.startsWith('Balasore')).map(dist=><option key={dist} value={dist.split(' ')[0]}>{dist}</option>)}</select></label>
            <label className="min-w-0 rounded-xl border-t border-slate-100 px-4 py-3 focus-within:bg-blue-50/50 md:border-l md:border-t-0"><span className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Grid2X2 size={14} className="text-blue-600"/>{isOdia?'ଅଞ୍ଚଳ':'Locality / Area'}</span><select aria-label="Locality / Area" value={selectedLocality} onChange={e=>setSelectedLocality(e.target.value)} className="w-full bg-transparent pr-2 text-sm font-semibold text-slate-900 outline-offset-4"><option value="All">{isOdia?'ସମସ୍ତ ଅଞ୍ଚଳ':'All areas'}</option>{availableLocalities.map(loc=><option key={loc} value={loc}>{loc}</option>)}</select></label>
            <label className="min-w-0 rounded-xl border-t border-slate-100 px-4 py-3 focus-within:bg-blue-50/50 md:border-l md:border-t-0"><span className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Search size={14} className="text-blue-600"/>{isOdia?'ଖୋଜନ୍ତୁ':'Landmark or keyword'}</span><input aria-label="Landmark or keyword" type="search" placeholder={isOdia?'କଲେଜ, ଅଞ୍ଚଳ...':'College, landmark, single room…'} value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-500 outline-offset-4"/></label>
            <button type="submit" className="m-1 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#005B94] px-6 text-sm font-bold text-white transition-colors hover:bg-[#004775] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><Search size={18}/>{isOdia?'ଖୋଜନ୍ତୁ':'Search'}</button>
          </form>
          <p className="mt-4 text-xs text-slate-500">{isOdia?'ବାଲେଶ୍ୱରରୁ ଭଦ୍ରକ — ଆପଣଙ୍କ ଅଞ୍ଚଳ ଖୋଜନ୍ତୁ।':'From Balasore to Bhadrak and beyond. Find a place in your part of Odisha.'}</p>
        </div>
      </section>

      {submissionNotice && <p role="status" className="mx-auto max-w-3xl rounded-xl bg-green-50 p-4 text-green-800">{isOdia ? 'ଆପଣଙ୍କ ବିଜ୍ଞାପନ ପ୍ରକାଶିତ ହୋଇଛି।' : 'Your listing is live and expires after 30 days. If you provided an email, confirm it for an Email verified badge and a reminder three days before expiry.'}</p>}
      {/* Main Content Area */}
      <main id="rental-results" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 mt-3">

        {/* Category Pills Bar */}
        <div className="category-strip flex items-center gap-1 overflow-x-auto rounded-2xl bg-slate-50 p-1.5">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                aria-pressed={isSelected}
                onClick={() => selectCategory(cat.id)}
                className={`whitespace-nowrap px-4 py-3 rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-white text-[#005B94] shadow-sm'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                }`}
              >
                {isOdia ? cat.labelOdia : cat.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:items-center gap-4 mt-5 rounded-2xl border border-slate-100 bg-white p-4">
          <label className="text-xs font-bold text-slate-700">
            {isOdia ? 'ସମ୍ପତ୍ତି ପ୍ରକାର (Property type)' : 'Property type'}
            <select value={selectedCategory} onChange={event => selectCategory(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
              {CATEGORIES.map(category => <option key={category.id} value={category.id}>{isOdia ? category.labelOdia : category.label}</option>)}
            </select>
          </label>
          <div className="hidden lg:col-start-2 lg:row-start-1 lg:flex lg:justify-center">
            <RentBudgetSlider minValue={minRent} onMinChange={setMinRent} value={maxRent} onChange={setMaxRent} isOdia={isOdia} />
          </div>
          {selectedCategory === 'Commercial / Shop' && <label className="text-xs font-bold text-slate-700 lg:col-start-1 lg:row-start-2">
            {isOdia ? 'ବ୍ୟବସାୟିକ ପ୍ରକାର (Commercial type)' : 'Commercial type'}
            <select value={commercialType} onChange={event => setCommercialType(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <option value="All">All commercial types</option>
              {COMMERCIAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>}
          <label className="text-xs font-bold text-slate-700 sm:col-start-3 lg:row-start-1">
            {isOdia ? 'ସଜାନ୍ତୁ (Sort by)' : 'Sort by'}
            <select value={sortBy} onChange={event => setSortBy(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
              {portalEnabled ? <option value="recommended">Recommended</option> : null}
              <option value="newest">Newest first</option>
              <option value="verified">Verified Profile</option>
              <option value="oldest">Oldest first</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </label>
        </div>

        {/* Results Header & Max Rent Slider */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-6 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              {isOdia ? 'ଉପଲବ୍ଧ ବିଜ୍ଞାପନ' : 'Find your next place'}
            </h2>
            <span className="text-xs font-bold bg-[#E6F4FA] text-[#005B94] px-2.5 py-0.5 rounded-full">
              {filteredListings.length}
            </span>
          </div>

          <div className="w-full sm:max-w-[360px] lg:hidden">
            <RentBudgetSlider minValue={minRent} onMinChange={setMinRent} value={maxRent} onChange={setMaxRent} isOdia={isOdia} />
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-[#005B94] animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-600">
              {isOdia ? 'ତଥ୍ୟ ଲୋଡ୍ ହେଉଛି...' : 'Loading listings...'}
            </p>
          </div>
        ) : fetchError ? (
          <div role="alert" className="rounded-xl bg-red-50 p-6 text-red-800">
            Unable to load listings. Please refresh to try again.
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto border border-slate-200 my-8 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {isOdia ? 'ଏହି ଅଞ୍ଚଳରେ କୌଣସି ବିଜ୍ଞାପନ ମିଳିଲା ନାହିଁ' : 'No listings found for this selection'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              {isOdia
                ? 'ଆପଣ ଏହି ସ୍ଥାନର ପ୍ରଥମ ବିଜ୍ଞାପନ ପୋଷ୍ଟ କରିପାରିବେ!'
                : 'Try changing the area filter or be the first to post a room here!'}
            </p>
            <button
              onClick={() => setIsPostModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#005B94] hover:bg-[#004A7C] text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isOdia ? 'ମାଗଣା ବିଜ୍ଞାପନ ଦିଅନ୍ତୁ' : 'Post Free Listings'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {filteredListings.map((listing, index) => (
              <React.Fragment key={listing.id}>
                <ListingCard
                  listing={listing}
                  isOdia={isOdia}
                  preview={preview}
                  onSelect={(item) => setSelectedListing(item)}
                />
                {/* Insert Sponsor Banner after the 2nd listing */}
                {!preview && index === 1 && (
                  <div className="col-span-full"><SponsorBanner district={selectedDistrict} isOdia={isOdia} /></div>
                )}
              </React.Fragment>
            ))}
            {/* If fewer than 2 listings, show sponsor banner at the end */}
            {!preview && filteredListings.length < 2 && (
              <div className="col-span-full"><SponsorBanner district={selectedDistrict} isOdia={isOdia} /></div>
            )}
          </div>
        )}

      </main>

      {/* Modals */}
      {!preview&&selectedListing?<ListingDetailModal
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        isOdia={isOdia}
      />:null}
      {preview&&selectedListing?<PreviewProperty listing={selectedListing} onClose={()=>setSelectedListing(null)}/>:null}

      {!preview&&isPostModalOpen?<PostAdModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSuccess={() => {
          setSubmissionNotice(true);
          void (async () => {
            const legacy = await supabase.from('listings').select('*').eq('is_active', true).order('created_at', { ascending: false });
            if (legacy.error) throw legacy.error;
            let rows: Listing[] = legacy.data || [];
            if (portalEnabled) {
              const response = await fetch('/api/portal?scope=feed', { cache: 'no-store' });
              const data = await response.json();
              if (!response.ok) throw new Error('Portal feed unavailable');
              rows = [...rows, ...data.listings];
            }
            setListings(rows); setFetchError(false);
          })().catch(() => setFetchError(true));
        }}
        isOdia={isOdia}
      />:null}
      {preview&&isPostModalOpen?<div role="status" className="fixed bottom-5 left-4 right-4 z-50 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-2xl bg-slate-900 p-5 text-sm text-white shadow-xl"><span>Preview only. Open the live website to post a listing.</span><button onClick={()=>setIsPostModalOpen(false)} className="rounded-lg bg-white/10 px-3 py-2">Close</button></div>:null}
      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200/80 bg-white py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="font-extrabold text-lg text-slate-900">
                ToLet<span className="text-[#005B94]">Odisha</span>
              </span>
              <span className="text-xs text-slate-400">• Built for Odisha</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isOdia
                ? 'ଓଡ଼ିଶାରେ ଘର ଭଡ଼ା ଖୋଜନ୍ତୁ। ToLet Odisha କୌଣସି ଭଡ଼ା କମିଶନ୍ ନିଏ ନାହିଁ।'
                : 'Find rooms, mess, hostels and flats across Odisha. ToLet Odisha charges no rental commission.'}
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-4 text-xs font-semibold text-slate-600">
            <Link href="/disclaimer" className="hover:text-slate-900 underline">{isOdia ? 'ଦାୟିତ୍ୱ ଅସ୍ୱୀକାର' : 'Disclaimer'}</Link>
            <a
              href="/advertise"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#005B94] hover:underline flex items-center gap-1 font-bold"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{isOdia ? 'ବ୍ୟବସାୟ ବିଜ୍ଞାପନ ଦିଅନ୍ତୁ' : 'Advertise Your Business'}</span>
            </a>
            <span className="text-slate-300">•</span>
            <button
              onClick={() => setIsPostModalOpen(true)}
              className="hover:text-slate-900 cursor-pointer"
            >
              {isOdia ? 'ମାଗଣା ଲିଷ୍ଟିଂ' : 'Post Free Listings'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

const sampleListings:Listing[]=[
 {id:'preview-room',created_at:'2026-10-15T08:00:00Z',title:'A bright room. A quieter neighbourhood.',description:'Illustrative preview property only.',category:'Bachelor Room',rent_monthly:5500,deposit:5500,district:'Balasore',locality:'Azimabad',landmark:'Near college',contact_name:'Sample advertiser',contact_phone:'',whatsapp_number:null,images:['/preview-room.svg'],amenities:['Attached bathroom','Water supply','Parking'],is_featured:false,is_active:true,id_verified:true,email_verified:true,phone_verified:true,advertiser_type:'Owner'},
 {id:'preview-pg',created_at:'2026-10-14T08:00:00Z',title:'A comfortable PG, close to college.',description:'Illustrative preview property only.',category:'Paying Guest (PG)',rent_monthly:3500,deposit:3500,district:'Balasore',locality:'Mallikashpur',landmark:'Near FM College',contact_name:'Sample advertiser',contact_phone:'',whatsapp_number:null,images:['/preview-pg.svg'],amenities:['Meals available','Wi-Fi','Water supply'],is_featured:false,is_active:true,id_verified:false,email_verified:false,phone_verified:false,advertiser_type:'Owner'},
];
function NeighbourhoodGraphic(){return <svg aria-hidden="true" viewBox="0 0 420 270" className="landing-graphic mx-auto w-full max-w-sm" fill="none"><ellipse cx="218" cy="238" rx="182" ry="19" fill="#e3edf9"/><circle cx="322" cy="56" r="32" fill="#fff1cf"/><path d="M40 219V125L101 88L161 125V219" fill="#edf4ff" stroke="#abc7ef" strokeWidth="2"/><path d="M26 133L100 86L174 133" stroke="#527fbf" strokeWidth="3" strokeLinecap="round"/><path d="M154 224V69L249 39L334 70V224" fill="#fff" stroke="#adc9ed" strokeWidth="2"/><path d="M249 39V224H334V70L249 39Z" fill="#e2edfc"/><path d="M144 79L249 45L345 78" stroke="#32639e" strokeWidth="4" strokeLinecap="round"/>{[93,138,183].map(y=><g key={y}><rect x="176" y={y} width="24" height="27" rx="3" fill="#d3e5fa"/><rect x="214" y={y} width="22" height="27" rx="3" fill="#d3e5fa"/><path d={`M188 ${y}V${y+27}M176 ${y+13}H200`} stroke="white" strokeWidth="2"/><rect x="270" y={y} width="20" height="27" rx="3" fill="#b1cff2"/><rect x="304" y={y} width="14" height="27" rx="3" fill="#b1cff2"/></g>)}<rect x="81" y="166" width="38" height="58" rx="4" fill="#b9d4f4"/><path d="M46 224H369" stroke="#8eafd9" strokeWidth="2" strokeLinecap="round"/><path d="M361 222V159" stroke="#5a947f" strokeWidth="4"/><ellipse cx="362" cy="148" rx="22" ry="35" fill="#c0ded1"/><path d="M41 224V195" stroke="#5a947f" strokeWidth="3"/><ellipse cx="41" cy="181" rx="16" ry="24" fill="#c0ded1"/><g className="landing-pin"><rect x="43" y="31" width="131" height="40" rx="12" fill="white" stroke="#d8e5f7"/><circle cx="64" cy="51" r="10" fill="#e6f6ee"/><path d="M59 51L63 55L69 47" stroke="#24815c" strokeWidth="2" strokeLinecap="round"/><path d="M84 47H152M84 55H128" stroke="#acc6e7" strokeWidth="5" strokeLinecap="round"/></g><circle cx="359" cy="99" r="4" fill="#8eb6e7"/><circle cx="128" cy="40" r="3" fill="#8eb6e7"/></svg>;}
function PreviewProperty({listing,onClose}:{listing:Listing;onClose:()=>void}){const dialog=React.useRef<HTMLDialogElement>(null);useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);return <dialog ref={dialog} onCancel={onClose} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg portal-dialog portal-form p-6 text-slate-900 backdrop:bg-slate-900/40"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Sample property · Preview only</p><h2 className="mt-3 text-xl font-bold">{listing.title}</h2><p className="mt-3 text-2xl font-bold">₹{listing.rent_monthly.toLocaleString('en-IN')}<span className="text-sm font-normal text-slate-600"> / month</span></p><p className="mt-3 text-sm text-slate-600">{listing.locality}, {listing.district}</p><p className="mt-4 text-sm leading-6 text-slate-600">Explore the filters and layout. These sample properties are not available to rent and enquiries are disabled.</p><button autoFocus onClick={onClose} className="mt-6 rounded-xl bg-[#005B94] px-5 py-3 text-sm font-bold text-white">Close preview</button></dialog>;}
