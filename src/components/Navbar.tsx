'use client';

import React from 'react';
import Link from 'next/link';
import { Home, PlusCircle, Globe, Sparkles } from 'lucide-react';

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
            <p className="text-[11px] font-medium text-slate-500 -mt-0.5">
              {isOdia ? 'ଆମ ପକ୍ଷରୁ କୌଣସି କମିଶନ୍ ନାହିଁ' : 'No commission charged by ToLet Odisha'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dedicated Advertise With Us Link */}
          <a
            href="/advertise"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
            title="Advertise your local restaurant, coaching or business"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{isOdia ? 'ବ୍ୟବସାୟ ପ୍ରଚାର' : 'Advertise With Us'}</span>
          </a>

          <Link href="/dashboard" className="text-xs font-semibold text-[#005B94] underline">{isOdia ? 'ମୋ ଖାତା' : 'My Dashboard'}</Link>

          {/* Language Toggle */}
          <button
            onClick={() => setIsOdia(!isOdia)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>{isOdia ? 'English' : 'ଓଡ଼ିଆ'}</span>
          </button>

          {/* Post Free Listings CTA */}
          <button
            onClick={onOpenPostModal}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold text-white bg-[#005B94] hover:bg-[#004A7C] active:scale-95 shadow-sm shadow-[#005B94]/30 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isOdia ? 'ମାଗଣାରେ ବିଜ୍ଞାପନ ଦିଅନ୍ତୁ' : 'Post Free Listings'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
