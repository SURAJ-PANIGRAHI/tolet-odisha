'use client';

import React from 'react';
import { useAdvertiserSession, isAdvertiserSession } from './AdvertiserSession';
import Link from 'next/link';
import { Home, PlusCircle, Globe, Sparkles, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  isOdia: boolean;
  setIsOdia: (val: boolean) => void;
  onOpenPostModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isOdia, setIsOdia, onOpenPostModal }) => {
  const { session } = useAdvertiserSession();
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-3 flex flex-wrap items-center justify-between gap-3">
        
        {/* Brand Logo - KLM Royal Blue Theme */}
        <Link
          href="/"
          aria-label="ToLet Odisha home"
          className="flex items-center gap-2.5 select-none rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#005B94]"
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
              {isOdia ? 'କୌଣସି କମିଶନ୍ ଦିଅନ୍ତୁ ନାହିଁ' : 'Pay Zero Commission'}
            </p>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Dedicated Advertise With Us Link */}
          <a
            href="/advertise"
            className="inline-flex shrink-0 items-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
            title="Advertise your local restaurant, coaching or business"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{isOdia ? 'ବ୍ୟବସାୟ ପ୍ରଚାର' : 'Advertise With Us'}</span>
          </a>

          {isAdvertiserSession(session) ? <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs sm:text-sm font-bold text-[#005B94] shadow-sm transition hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005B94]"><LayoutDashboard className="h-4 w-4" aria-hidden="true"/>{isOdia ? 'ମୋ ବିଜ୍ଞାପନ' : 'Manage My Listings'}</Link> : null}

          {/* Language Toggle */}
          <button
            onClick={() => setIsOdia(!isOdia)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>{isOdia ? 'English' : 'ଓଡ଼ିଆ'}</span>
          </button>

          {/* Post Free Listings CTA */}
          <button
            onClick={onOpenPostModal}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#005B94] hover:bg-[#004A7C] active:scale-95 shadow-sm shadow-[#005B94]/30 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isOdia ? 'ମାଗଣାରେ ବିଜ୍ଞାପନ ଦିଅନ୍ତୁ' : 'Post Free Listings'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
