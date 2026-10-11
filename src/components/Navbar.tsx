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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-gray-900">
                ToLet<span className="text-emerald-600">Odisha</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                .in
              </span>
            </div>
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-emerald-500" />
              {isOdia ? 'ସିଧାସଳଖ ଘର ମାଲିକଙ୍କ ସହ କଥା ହୁଅନ୍ତୁ' : 'Direct Owner • Zero Brokerage'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Toggle */}
          <button
            onClick={() => setIsOdia(!isOdia)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-gray-500" />
            <span>{isOdia ? 'English' : 'ଓଡ଼ିଆ'}</span>
          </button>

          {/* Post Free Ad CTA */}
          <button
            onClick={onOpenPostModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-sm shadow-emerald-600/30 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isOdia ? 'ମାଗଣାରେ ବିଜ୍ଞାପନ ଦିଅନ୍ତୁ' : 'Post Free Ad'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
