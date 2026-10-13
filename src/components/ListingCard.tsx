'use client';
import { EmailVerifiedBadge } from './EmailVerifiedBadge';

import React from 'react';
import { Listing } from '@/lib/supabase';
import { MapPin, Phone, MessageSquare, CheckCircle2 } from 'lucide-react';

interface ListingCardProps {
  listing: Listing;
  isOdia: boolean;
  onSelect: (listing: Listing) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, isOdia, onSelect }) => {
  const cleanPhone = (listing.whatsapp_number || listing.contact_phone).replace(/\D/g, '');
  const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
    `Namaskar! I found your listing "${listing.title}" on ToLetOdisha. Is it still available?`
  )}`;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Boys Mess':
        return 'bg-[#005B94]/10 text-[#005B94] border-[#005B94]/20';
      case 'Girls Hostel':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'Bachelor Room':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Tutor / Tuition':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-sky-50 text-[#005B94] border-sky-200';
    }
  };

  const hasPhotos = listing.images && listing.images.length > 0;

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-[#005B94]/40 transition-all duration-200 overflow-hidden flex flex-col justify-between">
      
      {/* Top Media / Header */}
      <div className="cursor-pointer" onClick={() => onSelect(listing)}>
        {hasPhotos ? (
          <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute top-3 left-3">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border shadow-2xs backdrop-blur-md ${getCategoryColor(listing.category)}`}>
                {listing.commercial_type || listing.category}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 pb-1">
            <div className="flex items-center justify-between mb-2">
              <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${getCategoryColor(listing.category)}`}>
                {listing.commercial_type || listing.category}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {new Date(listing.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 pt-2">
          {/* Rent and Deposit */}
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              ₹{listing.rent_monthly.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-500 font-medium">/ {isOdia ? 'ମାସିକ' : 'month'}</span>
            {listing.deposit > 0 && (
              <span className="ml-auto text-[11px] text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-medium">
                {isOdia ? 'ଅଗ୍ରିମ' : 'Dep.'}: ₹{listing.deposit.toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-bold text-slate-900 text-sm sm:text-base line-clamp-1 group-hover:text-[#005B94] transition">
            {listing.title}
          </h3>

          <EmailVerifiedBadge verified={listing.email_verified} isOdia={isOdia} />
          {listing.advertiser_type && <p className="mt-1 text-xs text-slate-600">Listed by: {listing.advertiser_type} <span className="text-slate-400">(self-declared)</span></p>}

          {listing.area_sqft != null && <p className="mt-2 text-sm font-semibold text-slate-700">{listing.area_sqft.toLocaleString('en-IN')} sq ft</p>}

          {/* Location */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-2">
            <MapPin className="w-3.5 h-3.5 text-[#005B94] shrink-0" />
            <span className="font-semibold text-slate-800">{listing.locality}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 truncate">{listing.district}</span>
          </div>

          {/* Amenities Chips */}
          {listing.amenities && listing.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {listing.amenities.slice(0, 3).map((amenity, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded-md border border-slate-100 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-[#005B94]" />
                  {amenity}
                </span>
              ))}
              {listing.amenities.length > 3 && (
                <span className="text-[10px] text-slate-400 self-center font-medium">
                  +{listing.amenities.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Contact CTAs */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
        {/* WhatsApp Button */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>WhatsApp</span>
        </a>

        {/* Call Button - KLM Royal Blue */}
        <a
          href={`tel:${listing.contact_phone}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#005B94] text-xs font-bold transition active:scale-95 cursor-pointer"
        >
          <Phone className="w-3.5 h-3.5 text-[#005B94]" />
          <span>{isOdia ? 'କଲ୍ କରନ୍ତୁ' : 'Call'}</span>
        </a>
      </div>

    </div>
  );
};
