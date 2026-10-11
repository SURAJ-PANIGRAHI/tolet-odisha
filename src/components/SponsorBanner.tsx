'use client';

import React from 'react';
import { ExternalLink, Phone, MessageSquare, Tag } from 'lucide-react';

interface SponsorBannerProps {
  isOdia: boolean;
}

export const SponsorBanner: React.FC<SponsorBannerProps> = ({ isOdia }) => {
  return (
    <div className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 my-2">
      <div className="bg-gradient-to-r from-amber-500/10 via-sky-50 to-amber-500/10 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
        
        {/* Left Side: Badge and Details */}
        <div className="flex items-start sm:items-center gap-3.5 text-center sm:text-left">
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold shadow-xs mx-auto sm:mx-0">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                {isOdia ? 'ସ୍ଥାନୀୟ ବ୍ୟବସାୟ ବିଜ୍ଞାପନ' : 'Featured Local Partner'}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Balasore</span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900">
              {isOdia 
                ? 'ଛାତ୍ର ମେସ୍ ଟିଫିନ୍ ଓ ଘରୋଇ ଖାଦ୍ୟ ଡେଲିଭରି' 
                : 'Need Student Tiffin, Mess Food or Packers & Movers?'}
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              {isOdia
                ? 'ଆପଣଙ୍କ ଦୋକାନ କିମ୍ବା ବ୍ୟବସାୟର ପ୍ରଚାର ପାଇଁ ଏଠାରେ ବ୍ୟାନର ଲଗାନ୍ତୁ।'
                : 'Promote your local restaurant, coaching center or store right here to thousands of students.'}
            </p>
          </div>
        </div>

        {/* Right Side: CTA Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <a
            href="https://wa.me/917873433610?text=Hi%2C%20I%20want%20to%20advertise%20my%20business%20on%20ToLetOdisha"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isOdia ? 'ଏଠାରେ ବିଜ୍ଞାପନ ଦିଅନ୍ତୁ' : 'Advertise With Us'}</span>
          </a>
        </div>

      </div>
    </div>
  );
};
