import type {Listing} from '@/lib/supabase';
import {propertyPath} from '@/lib/property-links';

export function ListingIdLink({listing}:{listing:Pick<Listing,'listing_ref'>}){
 const href=propertyPath(listing);
 if(!href)return null;
 return <a href={href} onClick={event=>event.stopPropagation()} className="inline-block rounded text-xs font-semibold text-[#005B94] underline decoration-sky-200 underline-offset-4 transition-colors hover:text-sky-800 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#005B94]">Listing ID: {listing.listing_ref}</a>;
}
