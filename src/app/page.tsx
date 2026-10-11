'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase, Listing } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { ListingCard } from '@/components/ListingCard';
import { ListingDetailModal } from '@/components/ListingDetailModal';
import { PostAdModal } from '@/components/PostAdModal';
import { ODISHA_DISTRICTS, CATEGORIES } from '@/data/odisha';
import { Search, MapPin, Filter, PlusCircle, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOdia, setIsOdia] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [maxRent, setMaxRent] = useState<number>(10000);

  // Fetch listings from Supabase
  const fetchListings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setListings(data);
    } catch (err) {
      console.error('Error fetching listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  // Filter logic
  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      // District filter
      if (selectedDistrict !== 'All') {
        const cleanSelected = selectedDistrict.split(' ')[0].toLowerCase();
        if (!item.district.toLowerCase().includes(cleanSelected)) return false;
      }

      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // Max Rent filter
      if (item.rent_monthly > maxRent) {
        return false;
      }

      // Search query (matches title, locality, landmark, description)
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
  }, [listings, selectedDistrict, selectedCategory, maxRent, searchQuery]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 pb-20 sm:pb-12">
      {/* Navigation */}
      <Navbar
        isOdia={isOdia}
        setIsOdia={setIsOdia}
        onOpenPostModal={() => setIsPostModalOpen(true)}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-emerald-50 via-teal-50/30 to-transparent pt-8 pb-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isOdia ? 'ବାଲେଶ୍ୱର ଓ ସମଗ୍ର ଓଡ଼ିଶାର ଘର ଭଡ଼ା' : 'Balasore & All-Odisha Direct Rental Hub'}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-gray-950 tracking-tight">
            {isOdia ? 'ଘର, ମେସ୍, ହଷ୍ଟେଲ୍ ଖୋଜନ୍ତୁ ବିନା ଦଲାଲିରେ' : 'Rent Rooms, Mess & Hostels Without Brokerage'}
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm mt-2 max-w-xl mx-auto">
            {isOdia
              ? 'ଓଡ଼ିଶାରେ ଛାତ୍ର, ଚାକିରିଆ ଓ ପରିବାର ପାଇଁ ମାଗଣା ଟୁ-ଲେଟ୍ ସେବା। ସିଧା ମାଲିକଙ୍କୁ WhatsApp କରନ୍ତୁ।'
              : 'Direct owner contact for students, bachelors & families. Zero commission. WhatsApp landlord instantly.'}
          </p>

          {/* Search & Quick Filters Box */}
          <div className="mt-6 bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto flex flex-col sm:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isOdia ? 'ସ୍ଥାନ ବା କଲେଜ ଖୋଜନ୍ତୁ (e.g. Nalamganj, FM College)...' : 'Search locality, landmark, college...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm focus:outline-emerald-600"
              />
            </div>

            {/* District Selector */}
            <div className="relative sm:w-48">
              <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm focus:outline-emerald-600 appearance-none font-semibold text-gray-800"
              >
                <option value="All">{isOdia ? 'ସମସ୍ତ ଓଡ଼ିଶା (All)' : 'All Odisha'}</option>
                <option value="Balasore">Balasore (ବାଲେଶ୍ୱର)</option>
                {ODISHA_DISTRICTS.filter(d => !d.startsWith('Balasore')).map((dist, idx) => (
                  <option key={idx} value={dist.split(' ')[0]}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

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
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {isOdia ? cat.labelOdia : cat.label}
              </button>
            );
          })}
        </div>

        {/* Results Info & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-gray-900">
              {isOdia ? 'ଉପଲବ୍ଧ ବିଜ୍ଞାପନ' : 'Available Listings'}
            </h2>
            <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              {filteredListings.length}
            </span>
          </div>

          {/* Max Rent Filter Slider */}
          <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-gray-100 text-xs">
            <span className="text-gray-500 font-medium">
              {isOdia ? 'ସର୍ବାଧିକ ଭଡ଼ା:' : 'Max Rent:'}
            </span>
            <span className="font-bold text-gray-900">₹{maxRent.toLocaleString('en-IN')}</span>
            <input
              type="range"
              min="1000"
              max="20000"
              step="500"
              value={maxRent}
              onChange={(e) => setMaxRent(Number(e.target.value))}
              className="accent-emerald-600 w-24 sm:w-32 cursor-pointer"
            />
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-gray-600">
              {isOdia ? 'ତଥ୍ୟ ଲୋଡ୍ ହେଉଛି...' : 'Loading listings from Odisha...'}
            </p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto border border-gray-100 my-8 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {isOdia ? 'ଏହି ଅଞ୍ଚଳରେ କୌଣସି ବିଜ୍ଞାପନ ମିଳିଲା ନାହିଁ' : 'No listings found for this filter'}
            </h3>
            <p className="text-xs text-gray-500 mb-5">
              {isOdia
                ? 'ଆପଣ ଏହି ସ୍ଥାନର ପ୍ରଥମ ବିଜ୍ଞାପନ ପୋଷ୍ଟ କରିପାରିବେ!'
                : 'Try adjusting your filters or be the first to post a room here!'}
            </p>
            <button
              onClick={() => setIsPostModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isOdia ? 'ମାଗଣା ବିଜ୍ଞାପନ ଦିଅନ୍ତୁ' : 'Post Free Listing'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isOdia={isOdia}
                onSelect={(item) => setSelectedListing(item)}
              />
            ))}
          </div>
        )}

      </main>

      {/* Floating Action Button for Mobile */}
      <div className="sm:hidden fixed bottom-4 right-4 z-30">
        <button
          onClick={() => setIsPostModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/40 active:scale-95 transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{isOdia ? 'ବିଜ୍ଞାପନ ଦିଅନ୍ତୁ' : 'Post Free Ad'}</span>
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
        onSuccess={fetchListings}
        isOdia={isOdia}
      />
    </div>
  );
}
