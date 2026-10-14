import type { Listing } from '@/lib/supabase';
export function verificationPoints(listing: Listing) {
 return (listing.id_verified ? 200 : 0) + (listing.phone_verified ? 100 : 0) + (listing.email_verified ? 50 : 0);
}
export function compareListings(a: Listing, b: Listing, sort: string, boostedFirst: boolean) {
 const dateDifference = Date.parse(a.created_at) - Date.parse(b.created_at);
 if (boostedFirst && a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
 const tie = -dateDifference || a.id.localeCompare(b.id);
 if (sort === 'verified') return verificationPoints(b) - verificationPoints(a) || tie;
 if (sort === 'recommended') return Number(b.ranking_score || 0) - Number(a.ranking_score || 0) || tie;
 if (sort === 'oldest') return dateDifference || a.id.localeCompare(b.id);
 if (sort === 'price-low') return a.rent_monthly - b.rent_monthly || tie;
 if (sort === 'price-high') return b.rent_monthly - a.rent_monthly || tie;
 return tie;
}
