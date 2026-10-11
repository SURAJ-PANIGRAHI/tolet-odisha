'use client';

import React from 'react';
import { Listing } from '@/lib/supabase';
import { MapPin, Phone, MessageSquare, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ListingCardProps {
  listing: Listing;
  isOdia: boolean;
  onSelect: (listing: Listing) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, isOdia, onSelect }) => {
  const cleanPhone = (listing.whatsapp_number || listing.contact_phone).replace(/\D/g, '');
  const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
    `Namaskar! I found your room/ad "${listing.title}" on ToLetOdisha.in. Is it still available?`
  )}`;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Boys Mess':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Girls Hostel':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'Bachelor Room':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Tutor / Tuition':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const hasPhotos = listing.images && listing.images.length > 0;

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all duration-200 overflow-hidden flex flex-col justify-between">
      
      {/* Top Media / Header */}
      <div className="cursor-pointer" onClick={() => onSelect(listing)}>
        {hasPhotos ? (
          <div className="relative h-44 w-full bg-gray-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute top-3 left-3">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border shadow-2xs backdrop-blur-md ${getCategoryColor(listing.category)}`}>
                {listing.category}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getCategoryColor(listing.category)}`}>
                {listing.category}
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                {new Date(listing.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 pt-2">
          {/* Rent and Deposit */}
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-xl sm:text-2xl font-black text-gray-900">
              ₹{listing.rent_monthly.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-gray-500 font-medium">/ {isOdia ? 'ମାସିକ' : 'month'}</span>
            {listing.deposit > 0 && (
              <span className="ml-auto text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {isOdia ? 'ଅଗ୍ରିମ' : 'Dep.'}: ₹{listing.deposit.toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-bold text-gray-900 text-sm sm:text-base line-clamp-1 group-hover:text-emerald-700 transition">
            {listing.title}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-2">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-gray-800">{listing.locality}</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-500 truncate">{listing.district}</span>
          </div>

          {/* Amenities Chips */}
          {listing.amenities && listing.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {listing.amenities.slice(0, 3).map((amenity, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-gray-50 text-gray-600 px-2 py-0.5 rounded-md border border-gray-100">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  {amenity}
                </span>
              ))}
              {listing.amenities.length > 3 && (
                <span className="text-[10px] text-gray-500 self-center">
                  +{listing.amenities.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Contact CTAs */}
      <div className="p-3 bg-gray-50/80 border-t border-gray-100 flex items-center gap-2">
        {/* WhatsApp Button */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs transition"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>WhatsApp</span>
        </a>

        {/* Call Button */}
        <a
          href={`tel:${listing.contact_phone}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold transition active:scale-95"
        >
          <Phone className="w-3.5 h-3.5 text-gray-600" />
          <span>{isOdia ? 'କଲ୍ କରନ୍ତୁ' : 'Call'}</span>
        </a>
      </div>

    </div>
  );
};
