'use client';

import React from 'react';
import { Listing } from '@/lib/supabase';
import { X, MapPin, Phone, MessageSquare, CheckCircle, Calendar, ShieldCheck, User } from 'lucide-react';

interface ListingDetailModalProps {
  listing: Listing | null;
  onClose: () => void;
  isOdia: boolean;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({ listing, onClose, isOdia }) => {
  if (!listing) return null;

  const cleanPhone = (listing.whatsapp_number || listing.contact_phone).replace(/\D/g, '');
  const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
    `Namaskar! I found your room/ad "${listing.title}" on ToLetOdisha.in. Is it still available?`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-md transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Photos if any */}
        {listing.images && listing.images.length > 0 ? (
          <div className="h-64 w-full bg-gray-100 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full font-medium">
              {listing.category}
            </div>
          </div>
        ) : (
          <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-t-3xl">
            <span className="bg-white/20 backdrop-blur-md text-xs font-bold px-3 py-1 rounded-full">
              {listing.category}
            </span>
            <h2 className="text-xl font-bold mt-3">{listing.title}</h2>
          </div>
        )}

        <div className="p-6">
          {/* Rent and Deposit Header */}
          <div className="flex items-baseline justify-between border-b border-gray-100 pb-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 font-medium">{isOdia ? 'ମାସିକ ଭଡ଼ା' : 'Monthly Rent'}</p>
              <div className="text-3xl font-black text-gray-900">
                ₹{listing.rent_monthly.toLocaleString('en-IN')}
              </div>
            </div>
            {listing.deposit > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium">{isOdia ? 'ସୁରକ୍ଷା ଅଗ୍ରିମ' : 'Security Deposit'}</p>
                <div className="text-lg font-bold text-gray-700">
                  ₹{listing.deposit.toLocaleString('en-IN')}
                </div>
              </div>
            )}
          </div>

          {/* Location Info */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-100">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-gray-900 text-sm">
                  {listing.locality}, {listing.district}
                </h4>
                {listing.landmark && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Landmark: {listing.landmark}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {listing.description && (
            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                {isOdia ? 'ବିବରଣୀ' : 'Description'}
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50/50 p-3.5 rounded-xl border border-gray-100">
                {listing.description}
              </p>
            </div>
          )}

          {/* Amenities */}
          {listing.amenities && listing.amenities.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                {isOdia ? 'ସୁବିଧା ସୁଯୋଗ' : 'Facilities & Amenities'}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {listing.amenities.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Landlord Contact Box */}
          <div className="border border-emerald-100 bg-emerald-50/40 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm">{listing.contact_name}</div>
                <div className="text-xs text-gray-500">{isOdia ? 'ଘର ମାଲିକ / ପରିଚାଳକ' : 'Owner / Manager'}</div>
              </div>
            </div>

            <div className="flex gap-2.5">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
              <a
                href={`tel:${listing.contact_phone}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs transition"
              >
                <Phone className="w-4 h-4" />
                <span>{listing.contact_phone}</span>
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
