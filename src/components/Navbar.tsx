'use client';

import React from 'react';
import { Home, PlusCircle, Globe, MapPin } from 'lucide-react';

interface NavbarProps {
  isOdia: boolean;
  setIsOdia: (val: boolean) => void;
  onOpenPostModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isOdia, setIsOdia, onOpenPostModal }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo - KLM Royal Blue Theme */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer select-none" 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="w-10 h-10 rounded-xl bg-[#005B94] flex items-center justify-center text-white shadow-sm shadow-[#005B94]/20">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center">
              <span className="font-black text-2xl tracking-tight text-slate-900">
                ToLet<span className="text-[#005B94]">Odisha</span>
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1 -mt-0.5">
              <MapPin className="w-2.5 h-2.5 text-[#00A1DE]" />
              {isOdia ? 'ସିଧାସଳଖ ଘର ମାଲିକଙ୍କ ସହ କଥା ହୁଅନ୍ତୁ' : 'Direct Owner • Zero Brokerage'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Toggle */}
          <button
            onClick={() => setIsOdia(!isOdia)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>{isOdia ? 'English' : 'ଓଡ଼ିଆ'}</span>
          </button>

          {/* Post Free Ad CTA */}
          <button
            onClick={onOpenPostModal}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold text-white bg-[#005B94] hover:bg-[#004A7C] active:scale-95 shadow-sm shadow-[#005B94]/30 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isOdia ? 'ମାଗଣାରେ ବିଜ୍ଞାପନ ଦିଅନ୍ତୁ' : 'Post Free Ad'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
