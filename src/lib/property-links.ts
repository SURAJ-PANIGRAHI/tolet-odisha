import type {Listing} from './supabase';
export const PROPERTY_ORIGIN='https://www.toletodisha.in';
export function referenceNumber(reference:string){
 if(!/^TO-[0-9]{6,19}$/.test(reference))return null;
 const number=BigInt(reference.slice(3));return number>BigInt(0)&&number<=BigInt('9223372036854775807')?number.toString():null;
}
export function propertyPath(listing:Pick<Listing,'listing_ref'>){return listing.listing_ref&&referenceNumber(listing.listing_ref)?'/property/'+listing.listing_ref:null;}
export function propertyUrl(listing:Pick<Listing,'listing_ref'>){const path=propertyPath(listing);return path?PROPERTY_ORIGIN+path:null;}
export function propertyPrice(listing:Pick<Listing,'price_on_request'|'rent_monthly'>){return listing.price_on_request?'Price on request':`₹${listing.rent_monthly.toLocaleString('en-IN')}/month`;}
export function propertyShareText(listing:Pick<Listing,'title'|'locality'|'district'|'price_on_request'|'rent_monthly'|'listing_ref'>){return `${listing.title}\n${propertyPrice(listing)} · ${listing.locality}, ${listing.district}\nListing ID: ${listing.listing_ref}\nFound on ToLet Odisha.`;}
