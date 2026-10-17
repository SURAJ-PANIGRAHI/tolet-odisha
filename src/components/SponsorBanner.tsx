'use client';

import React, { useState, useEffect } from 'react';
import { LOCAL_SPONSORS, LocalSponsor } from '@/data/sponsors';
import { MessageSquare, Phone, Sparkles, Store } from 'lucide-react';

interface SponsorBannerProps {
  district: string;
  isOdia: boolean;
  startIndex?: number;
}

export const SponsorBanner: React.FC<SponsorBannerProps> = (props) => (
  <DistrictSponsorBanner key={props.district} {...props} />
);

const DistrictSponsorBanner: React.FC<SponsorBannerProps> = ({ district, isOdia, startIndex=0 }) => {
  const cleanDistrict = district === 'All' ? 'Balasore' : district.split(' ')[0];
  const sponsorsList = (LOCAL_SPONSORS[cleanDistrict] || []).slice(0,3);

  const [currentIndex, setCurrentIndex] = useState(startIndex % Math.max(1,sponsorsList.length));
  const [paused,setPaused]=useState(false);
  const [hovered,setHovered]=useState(false);
  const [focused,setFocused]=useState(false);

  // Rotate up to three local ads, pausing while the visitor interacts.
  useEffect(() => {
    if (sponsorsList.length <= 1 || paused || hovered || focused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sponsorsList.length);
    }, 10000);

    return () => clearInterval(timer);
  }, [sponsorsList.length,paused,hovered,focused]);

  // Business enquiries are handled personally through WhatsApp or email.
  const advertiseUrl = '/advertise';

  const currentSponsor: LocalSponsor | undefined = sponsorsList[currentIndex];

  return (
    <div aria-label="Local business advertisement" className="col-span-full my-2" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setFocused(false);}}>
      <div className="relative bg-gradient-to-r from-amber-500/10 via-sky-50 to-amber-500/10 border border-amber-300/80 rounded-2xl p-4 sm:p-5 shadow-2xs overflow-hidden transition-all duration-300">
        
        {/* Top Tag Row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>{isOdia ? 'ସ୍ଥାନୀୟ ବ୍ୟବସାୟ ସହଭାଗୀ' : 'Featured Local Partner'}</span>
            </span>
            <span className="text-xs font-bold text-slate-700 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200">
              {cleanDistrict}
            </span>
          </div>

          {/* If multiple sponsors exist, show slide dots */}
          {sponsorsList.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={()=>setPaused(value=>!value)} aria-pressed={paused} className="mr-2 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white">{paused?'Resume':'Pause'}</button>
              {sponsorsList.map((_, idx) => (
                <button
                  type="button"
                  key={idx}
                  aria-pressed={currentIndex===idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    currentIndex === idx ? 'w-5 bg-amber-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          {currentSponsor ? (
            <>
              {/* Sponsor Information - 100% Dedicated */}
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {currentSponsor.businessName}
                  </h4>
                  <p className="text-xs font-semibold text-amber-900 mt-0.5">
                    {currentSponsor.tagline}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {currentSponsor.description}
                  </p>
                </div>
              </div>

              {/* Sponsor's Direct CTAs Only (No distraction) */}
              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                <a
                  href={`https://wa.me/91${currentSponsor.whatsappNumber}?text=${encodeURIComponent(
                    `Namaskar! I found your service "${currentSponsor.businessName}" on ToLetOdisha.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{currentSponsor.actionText}</span>
                </a>

                <a
                  href={`tel:${currentSponsor.contactPhone}`}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-2xs"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-600" />
                  <span>Call</span>
                </a>
              </div>
            </>
          ) : (
            <>
              {/* Fallback Invite When No Sponsor Exists */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#005B94] text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {isOdia 
                      ? `${cleanDistrict}ର ବ୍ୟବସାୟୀଙ୍କ ପାଇଁ ସୁବର୍ଣ୍ଣ ସୁଯୋଗ!` 
                      : `Promote Your Business in ${cleanDistrict}!`}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    {isOdia
                      ? `ଆପଣଙ୍କ ରେଷ୍ଟୁରାଣ୍ଟ, କୋଚିଂ, ଟିଫିନ୍ କିମ୍ବା ଦୋକାନକୁ ${cleanDistrict}ର ହଜାର ହଜାର ଛାତ୍ର ଓ ପରିବାରଙ୍କ ନିକଟରେ ପହଞ୍ଚାନ୍ତୁ।`
                      : `Get your restaurant, coaching, tiffin or transport service seen by thousands searching for rooms in ${cleanDistrict}.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                <a
                  href={advertiseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isOdia ? 'ଏଠାରେ ବିଜ୍ଞାପନ ଦିଅନ୍ତୁ' : 'Advertise With Us'}</span>
                </a>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
