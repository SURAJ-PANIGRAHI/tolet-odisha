import type {Metadata} from 'next';
import {notFound,permanentRedirect} from 'next/navigation';
import {publicProperty} from '@/lib/server/public-property';
import {PROPERTY_ORIGIN,propertyPath,propertyPrice,propertyUrl} from '@/lib/property-links';
import {PropertyPage} from '@/components/PropertyPage';
export const dynamic='force-dynamic';
type Props={params:Promise<{reference:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {reference}=await params;const listing=await publicProperty(reference);
 if(!listing)return {title:'Listing no longer available | ToLet Odisha',robots:{index:false,follow:false}};
 const title=`${listing.title} | ToLet Odisha`;
 const description=`${propertyPrice(listing)} · ${listing.locality}, ${listing.district}. ${listing.category}. Listing ${listing.listing_ref}. Pay zero platform commission.`;
 const image=listing.images?.[0]||PROPERTY_ORIGIN+'/icons/icon-512.png';
 return {title,description,alternates:{canonical:propertyUrl(listing)!},openGraph:{type:'website',siteName:'ToLet Odisha',title,description,url:propertyUrl(listing)!,images:[{url:image,alt:listing.title}]},twitter:{card:'summary_large_image',title,description,images:[image]}};
}
export default async function Page({params}:Props){
 const {reference}=await params;const listing=await publicProperty(reference);if(!listing)notFound();
 const path=propertyPath(listing)!;if(reference!==listing.listing_ref)permanentRedirect(path);
 return <PropertyPage listing={listing}/>;
}
