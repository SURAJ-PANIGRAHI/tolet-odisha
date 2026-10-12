'use client';

import Link from 'next/link';
import React, { useEffect, useState, useMemo } from 'react';
import { supabase, Listing } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { ListingCard } from '@/components/ListingCard';
import { ListingDetailModal } from '@/components/ListingDetailModal';
import { PostAdModal } from '@/components/PostAdModal';
import { SponsorBanner } from '@/components/SponsorBanner';
import { ODISHA_DISTRICTS, DISTRICT_LOCALITIES, CATEGORIES } from '@/data/odisha';
import { Search, MapPin, PlusCircle, Sparkles, AlertCircle, RefreshCw, Navigation } from 'lucide-react';

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [maxRent, setMaxRent] = useState<number>(10000);

  // Fetch public listings once, ignoring results after unmount.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase.from('listings').select('*')
          .eq('is_active', true).order('created_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) setListings(data || []);
      } catch {
        if (!cancelled) setFetchError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Available localities for current selected district
  const availableLocalities = useMemo(() => {
    const cleanDist = selectedDistrict.split(' ')[0];
    return DISTRICT_LOCALITIES[cleanDist] || [];
  }, [selectedDistrict]);

  // Filter logic
  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
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

      // Max Rent filter
      if (item.rent_monthly > maxRent) {
        return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesLocality = item.locality.toLowerCase().includes(q);
        const matchesLandmark = item.landmark?.toLowerCase().includes(q) || false;
        const matchesDistrict = item.district.toLowerCase().includes(q);
        if (!matchesTitle && !matchesLocality && !matchesLandmark && !matchesDistrict) {
          return false;
        }
      }

      return true;
    });
  }, [listings, selectedDistrict, selectedLocality, selectedCategory, maxRent, searchQuery, clock]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 sm:pb-12">
      {/* Navigation */}
      <Navbar
        isOdia={isOdia}
        setIsOdia={setIsOdia}
        onOpenPostModal={() => setIsPostModalOpen(true)}
      />

      {/* Hero Section - KLM Royal Blue */}
      <section className="bg-gradient-to-b from-[#E6F4FA] via-[#F0F8FC] to-transparent pt-8 pb-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          
          {/* Trust Tagline */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-[#005B94] border border-[#005B94]/20 text-xs font-bold shadow-2xs mb-3.5">
            <Sparkles className="w-4 h-4 text-[#00A1DE]" />
            <span>
              {isOdia 
                ? '✨ ୧୦୦% ସିଧାସଳଖ ଘର ମାଲିକ • ଶୂନ ଦଲାଲି ଓ ହିଡେନ୍ ଚାର୍ଜ' 
                : '✨ 100% Direct Owners • Zero Brokerage & No Middlemen'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            {isOdia ? 'ଘର, ମେସ୍ ଓ ହଷ୍ଟେଲ୍ ଖୋଜନ୍ତୁ ବିନା ଦଲାଲିରେ' : 'Rent Rooms, Mess & Hostels Directly'}
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-2.5 max-w-xl mx-auto font-medium">
            {isOdia
              ? 'ବାଲେଶ୍ୱର ଓ ଓଡ଼ିଶାର ଛାତ୍ର, ଚାକିରିଆ ଓ ପରିବାର ପାଇଁ ମାଗଣା ପୋର୍ଟାଲ୍। ସିଧା ମାଲିକଙ୍କ ସହ WhatsApp କରନ୍ତୁ।'
              : 'Direct owner contact for students, bachelors & families across Odisha. Instant WhatsApp chat.'}
          </p>

          {/* Clean 2-Dropdown + Search Bar */}
          <div className="mt-6 bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-slate-200/80 max-w-3xl mx-auto flex flex-col sm:flex-row gap-2.5">
            
            {/* 1. District Dropdown */}
            <div className="relative sm:w-56">
              <MapPin className="w-4 h-4 text-[#005B94] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setSelectedLocality('All');
                }}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-[#005B94] font-bold text-slate-900 cursor-pointer appearance-none"
              >
                <option value="Balasore">Balasore (ବାଲେଶ୍ୱର)</option>
                <option value="All">{isOdia ? 'ସମସ୍ତ ଓଡ଼ିଶା (All Odisha)' : 'All Odisha'}</option>
                {ODISHA_DISTRICTS.filter(d => !d.startsWith('Balasore')).map((dist, idx) => (
                  <option key={idx} value={dist.split(' ')[0]}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Area / Block Dropdown */}
            <div className="relative sm:w-56">
              <Navigation className="w-3.5 h-3.5 text-[#00A1DE] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedLocality}
                onChange={(e) => setSelectedLocality(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-[#005B94] font-semibold text-slate-800 cursor-pointer appearance-none"
              >
                <option value="All">{isOdia ? 'ସମସ୍ତ ଅଞ୍ଚଳ (All Areas / Blocks)' : 'All Areas / Blocks'}</option>
                {availableLocalities.map((loc, idx) => (
                  <option key={idx} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Search Keywords Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isOdia ? 'ଖୋଜନ୍ତୁ (e.g. FM College, Single Room)...' : 'Search landmark, college, keywords...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-[#005B94]"
              />
            </div>

          </div>
        </div>
      </section>

      {submissionNotice && <p role="status" className="mx-auto max-w-3xl rounded-xl bg-green-50 p-4 text-green-800">{isOdia ? 'ଆପଣଙ୍କ ବିଜ୍ଞାପନ ଅନୁମୋଦନ ପାଇଁ ପଠାଯାଇଛି।' : (process.env.NEXT_PUBLIC_PHONE_OTP_ENABLED === 'true' ? 'Your listing is live and expires after 30 days. If you provided an email, confirm it for a reminder three days before expiry.' : 'Your listing has been submitted for review and expires after 30 days. If you provided an email, confirm it for a reminder three days before expiry.')}</p>}
      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        
        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#005B94] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isOdia ? cat.labelOdia : cat.label}
              </button>
            );
          })}
        </div>

        {/* Results Header & Max Rent Slider */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              {isOdia ? 'ଉପଲବ୍ଧ ବିଜ୍ଞାପନ' : 'Available Listings'}
            </h2>
            <span className="text-xs font-bold bg-[#E6F4FA] text-[#005B94] px-2.5 py-0.5 rounded-full">
              {filteredListings.length}
            </span>
          </div>

          {/* Max Rent Filter Slider */}
          <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/80 text-xs shadow-2xs">
            <span className="text-slate-500 font-medium">
              {isOdia ? 'ସର୍ବାଧିକ ଭଡ଼ା:' : 'Max Rent:'}
            </span>
            <span className="font-black text-[#005B94]">₹{maxRent.toLocaleString('en-IN')}</span>
            <input
              type="range"
              min="1000"
              max="20000"
              step="500"
              value={maxRent}
              onChange={(e) => setMaxRent(Number(e.target.value))}
              className="accent-[#005B94] w-24 sm:w-32 cursor-pointer"
            />
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredListings.map((listing, index) => (
              <React.Fragment key={listing.id}>
                <ListingCard
                  listing={listing}
                  isOdia={isOdia}
                  onSelect={(item) => setSelectedListing(item)}
                />
                {/* Insert Sponsor Banner after the 2nd listing */}
                {index === 1 && (
                  <SponsorBanner district={selectedDistrict} isOdia={isOdia} />
                )}
              </React.Fragment>
            ))}
            {/* If fewer than 2 listings, show sponsor banner at the end */}
            {filteredListings.length < 2 && (
              <SponsorBanner district={selectedDistrict} isOdia={isOdia} />
            )}
          </div>
        )}

      </main>

      {/* Floating Action Button for Mobile */}
      <div className="sm:hidden fixed bottom-4 right-4 z-30">
        <button
          onClick={() => setIsPostModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-[#005B94] hover:bg-[#004A7C] text-white font-bold text-xs shadow-lg shadow-[#005B94]/40 active:scale-95 transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{isOdia ? 'ମାଗଣା ଲିଷ୍ଟିଂ ଦିଅନ୍ତୁ' : 'Post Free Listings'}</span>
        </button>
      </div>

      {/* Modals */}
      <ListingDetailModal
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        isOdia={isOdia}
      />

      <PostAdModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSuccess={() => setSubmissionNotice(true)}
        isOdia={isOdia}
      />
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
                ? 'ଓଡ଼ିଶାର ସମସ୍ତ ଛାତ୍ର, ଚାକିରିଆ ଓ ପରିବାର ପାଇଁ ଘର ଭଡ଼ା ଖୋଜିବାର ବିଶ୍ୱସ୍ତ ମଞ୍ଚ।' 
                : 'Direct student rooms, mess, hostels and flats without brokers across Odisha.'}
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-4 text-xs font-semibold text-slate-600">
            <Link href="/disclaimer" className="hover:text-slate-900 underline">{isOdia ? 'ଦାୟିତ୍ୱ ଅସ୍ୱୀକାର' : 'Disclaimer'}</Link>
            <a
              href="https://wa.me/919437159484?text=Namaskar%20Suraj!%20I%20want%20to%20advertise%20my%20business%20on%20ToLetOdisha."
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
