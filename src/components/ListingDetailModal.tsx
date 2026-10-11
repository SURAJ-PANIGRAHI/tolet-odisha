'use client';

import React from 'react';
import { Listing } from '@/lib/supabase';
import { X, MapPin, Phone, MessageSquare, CheckCircle, User } from 'lucide-react';

interface ListingDetailModalProps {
  listing: Listing | null;
  onClose: () => void;
  isOdia: boolean;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({ listing, onClose, isOdia }) => {
  if (!listing) return null;

  const cleanPhone = (listing.whatsapp_number || listing.contact_phone).replace(/\D/g, '');
  const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
    `Namaskar! I found your listing "${listing.title}" on ToLetOdisha. Is it still available?`
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
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-slate-100 flex items-center justify-center text-slate-700 shadow-md transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Photos if any */}
        {listing.images && listing.images.length > 0 ? (
          <div className="h-64 w-full bg-slate-100 relative">
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
          <div className="p-6 bg-gradient-to-r from-[#005B94] to-[#0077C8] text-white rounded-t-3xl">
            <span className="bg-white/20 backdrop-blur-md text-xs font-bold px-3 py-1 rounded-full">
              {listing.category}
            </span>
            <h2 className="text-xl font-bold mt-3">{listing.title}</h2>
          </div>
        )}

        <div className="p-6">
          {/* Rent and Deposit Header */}
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <p className="text-xs text-slate-500 font-medium">{isOdia ? 'ମାସିକ ଭଡ଼ା' : 'Monthly Rent'}</p>
              <div className="text-3xl font-black text-slate-900">
                ₹{listing.rent_monthly.toLocaleString('en-IN')}
              </div>
            </div>
            {listing.deposit > 0 && (
              <div className="text-right">
                <p className="text-xs text-slate-500 font-medium">{isOdia ? 'ସୁରକ୍ଷା ଅଗ୍ରିମ' : 'Security Deposit'}</p>
                <div className="text-lg font-bold text-slate-700">
                  ₹{listing.deposit.toLocaleString('en-IN')}
                </div>
              </div>
            )}
          </div>

          {/* Location Info */}
          <div className="bg-slate-50 rounded-2xl p-4 mb-5 border border-slate-100">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-5 h-5 text-[#005B94] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {listing.locality}, {listing.district}
                </h4>
                {listing.landmark && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Landmark: {listing.landmark}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {listing.description && (
            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                {isOdia ? 'ବିବରଣୀ' : 'Description'}
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                {listing.description}
              </p>
            </div>
          )}

          {/* Amenities */}
          {listing.amenities && listing.amenities.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                {isOdia ? 'ସୁବିଧା ସୁଯୋଗ' : 'Facilities & Amenities'}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {listing.amenities.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-[#005B94] shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Landlord Contact Box */}
          <div className="border border-sky-100 bg-[#E6F4FA]/50 rounded-2xl p-4 mb-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#005B94] text-white flex items-center justify-center font-bold text-sm">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{listing.contact_name}</div>
                <div className="text-xs text-slate-500">{isOdia ? 'ଘର ମାଲିକ / ପରିଚାଳକ' : 'Owner / Manager'}</div>
              </div>
            </div>

            <div className="flex gap-2.5">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
              <a
                href={`tel:${listing.contact_phone}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#005B94] hover:bg-[#004A7C] text-white font-bold text-xs transition cursor-pointer"
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
