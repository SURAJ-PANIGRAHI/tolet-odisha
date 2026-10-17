'use client';

import React, { useState } from 'react';
import {useVerifiedPhone} from '@/lib/client/useVerifiedPhone';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { managementPath as normalizeManagementPath, saveListing } from '@/lib/client/saved-listings';
import { LocalityPicker } from './LocalityPicker';
import { AdvertiserSignIn } from './AdvertiserSignIn';
import { useAdvertiserSession, isAdvertiserSession } from './AdvertiserSession';
import { portalEnabled } from '@/lib/client/portal';
import { supabase } from '@/lib/supabase';
import { ODISHA_DISTRICTS, CATEGORIES, POPULAR_AMENITIES, COMMERCIAL_TYPES, toggleAmenitySelection } from '@/data/odisha';
import { X, Upload, Check, Loader2, Sparkles } from 'lucide-react';

interface PostAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isOdia: boolean;
  adminClient?: SupabaseClient;
}

export const PostAdModal: React.FC<PostAdModalProps> = ({ isOpen, onClose, onSuccess, isOdia, adminClient }) => {
  const router = useRouter();
  const auth = useAdvertiserSession();
  const [requestId] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Boys Mess');
  const [advertiserType, setAdvertiserType] = useState(adminClient ? 'Third Party' : '');
  const [priceOnRequest, setPriceOnRequest] = useState(false);
  const [rentNegotiable, setRentNegotiable] = useState(false);
  const [rent, setRent] = useState('');
  const [commercialType, setCommercialType] = useState('');
  const [areaSqft, setAreaSqft] = useState('');
  const isCommercial = category === 'Commercial / Shop';
  const [deposit, setDeposit] = useState('');
  const [district, setDistrict] = useState(ODISHA_DISTRICTS.find(d => d.startsWith('Balasore')) || ODISHA_DISTRICTS[0]);
  const [locality, setLocality] = useState('');
  const [customLocality, setCustomLocality] = useState('');
  const [landmark, setLandmark] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsappPhone,setWhatsappPhone]=useState('');
  const [sameWhatsApp,setSameWhatsApp]=useState(true);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const client = adminClient || supabase;
  const verifiedPhone = useVerifiedPhone(!!adminClient);
  const primaryPhone = verifiedPhone || contactPhone;
  if (!isOpen) return null;
  if (!adminClient && (!auth.ready || !isAdvertiserSession(auth.session))) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div role="dialog" aria-modal="true" aria-label="Sign in to post" className="relative w-full max-w-md"><button type="button" aria-label="Close sign-in" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-slate-100 p-2 text-slate-600"><X size={18}/></button>{auth.ready ? <AdvertiserSignIn forPosting/> : <p role="status" className="rounded-2xl bg-white p-8">Checking your sign-in…</p>}</div></div>;
  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev =>
      toggleAmenitySelection(prev, amenity)
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImageFiles(prev => [...prev, ...newFiles].slice(0, 10));
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImageFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const submittedLocality = (locality === 'Other / ଅନ୍ୟାନ୍ୟ' ? customLocality : locality).trim();
    if (!title || (!priceOnRequest && !rent) || !district || !submittedLocality || !contactName || !primaryPhone || !advertiserType) {
      setErrorMsg(isOdia ? 'ଦୟାକରି ସମସ୍ତ ଆବଶ୍ୟକୀୟ ତଥ୍ୟ ପୂରଣ କରନ୍ତୁ।' : 'Please fill all required fields.');
      return;
    }

    if ((isCommercial && !commercialType) || (isCommercial && areaSqft && (!Number.isInteger(Number(areaSqft)) || Number(areaSqft) <= 0 || Number(areaSqft) > 10000000))) {
      setErrorMsg('Choose a commercial type. Area is optional; if provided, enter a positive whole number up to 10,000,000.');
      return;
    }
    const phone = primaryPhone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(phone) || !Number.isInteger(Number(rent)) || Number(rent) < 0 || !Number.isInteger(Number(deposit || 0)) || Number(deposit || 0) < 0) {
      setErrorMsg('Enter a valid Indian mobile number and non-negative whole rupee amounts.');
      return;
    }
    if (imageFiles.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setErrorMsg('Photos must be JPEG, PNG or WebP and at most 5 MB each.');
      return;
    }
    setLoading(true);

    try {
      const { data: { session } } = await client.auth.getSession();
      if (!isAdvertiserSession(session)) throw new Error('Please sign in again before posting.');
      const imageUrls: string[] = [];

      // Upload photos if any
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `listings/${fileName}`;

        const { error: uploadError } = await client.storage
          .from('listing-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        if (!uploadError) {
          const { data: publicUrlData } = client.storage
            .from('listing-images')
            .getPublicUrl(filePath);
          if (publicUrlData.publicUrl) {
            imageUrls.push(publicUrlData.publicUrl);
          }
        }
      }

      // Insert listing into Supabase
      const response = await fetch(adminClient ? '/api/admin' : portalEnabled ? '/api/portal' : '/api/listings', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ ...(adminClient ? { action: 'create_listing' } : portalEnabled ? { action: 'create' } : {}), request_id: requestId, listing:
        {
          title,
          description: description || null,
          category,
          advertiser_type: advertiserType,
          commercial_type: isCommercial ? commercialType : null,
          area_sqft: isCommercial && areaSqft ? Number(areaSqft) : null,
          rent_monthly: priceOnRequest ? 0 : parseInt(rent, 10),
          price_on_request: priceOnRequest,
          deposit: deposit ? parseInt(deposit, 10) : 0,
          district: district.split(' ')[0],
          locality: submittedLocality,
          landmark: landmark || null,
          contact_name: contactName,
          contact_phone: phone,
          whatsapp_number: sameWhatsApp ? phone : whatsappPhone,
          rent_negotiable: !priceOnRequest && rentNegotiable,
          amenities: selectedAmenities,
          images: imageUrls,
          is_active: false,
          is_featured: false
        }
      }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Unable to submit listing');
      }

      const result = await response.json();
      if (adminClient) { onSuccess(); return; }
      if (result.account_owned && typeof result.listing_id === 'string' && /^[0-9a-f-]{36}$/i.test(result.listing_id)) {
        onSuccess(); router.push('/listing-posted?listing=' + result.listing_id); return;
      }
      const path = normalizeManagementPath(result.management_path);
      if (!path) throw new Error('Your listing was submitted, but the management link could not be loaded. Please contact support before posting again.');
      const id = new URL(path, window.location.origin).searchParams.get('listing')!;
      saveListing({ id, path, title, locality: `${submittedLocality}, ${district.split(' ')[0]}`, rent: Number(rent), savedAt: new Date().toISOString() });
      onSuccess();
      router.push('/listing-posted#manage=' + encodeURIComponent(path));
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Error creating listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div 
        role="dialog" aria-modal="true" aria-label={adminClient ? "Add property" : "Post free listing"}
        className="portal-dialog portal-form max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50/70 to-white px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-[#005B94]" />
              <span>{isOdia ? 'ନୂତନ ବିଜ୍ଞାପନ ପୋଷ୍ଟ କରନ୍ତୁ' : adminClient ? 'Add Property' : 'Post Free Listing'}</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isOdia ? '୧୦୦% ମାଗଣା • ସଙ୍ଗେ ସଙ୍ଗେ ପ୍ରକାଶିତ ହେବ' : '100% Free • Published immediately'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close listing form"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {adminClient ? <div className="rounded-xl bg-sky-50 p-3 text-sm">Publish a property on someone else’s behalf. Use their name and contact number. This listing will be managed by your administrator account.</div> : <div className="rounded-xl bg-sky-50 p-3 text-sm"><p>Your listing will be saved to your account. You can manage it from any device.</p><Link href="/dashboard" className="mt-1 inline-flex font-semibold text-[#005B94]">Manage My Listings</Link></div>}
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isOdia ? 'ବିଜ୍ଞାପନର ଶୀର୍ଷକ *' : 'Listing Title *'}
            </label>
            <input
              type="text"
              placeholder={isOdia ? 'ଉଦାହରଣ: Single Room for Boys in Nalamganj' : 'e.g. Single Room for Boys near FM College'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isOdia ? 'ବର୍ଗ (Category) *' : 'Category *'}
            </label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setCommercialType(''); setAreaSqft(''); }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94] bg-white"
            >
              {CATEGORIES.filter(c => c.id !== 'All').map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {isOdia ? `${cat.labelOdia} (${cat.label})` : cat.label}
                </option>
              ))}
            </select>
          </div>

          {isCommercial && <label className="block text-xs font-bold text-slate-700">
            Commercial type *
            <select required value={commercialType} onChange={event => setCommercialType(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <option value="">Select commercial type</option>
              {COMMERCIAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>}
          {isCommercial && <label className="block text-xs font-bold text-slate-700">
            Floor area (sq ft) — optional
            <input type="number" min="1" max="10000000" step="1" value={areaSqft} onChange={event => setAreaSqft(event.target.value)} placeholder="Leave blank if not known" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            {isCommercial && <span className="mt-1 block font-normal text-slate-500">Add the total space if known, in square feet. Describe floor, access and suitable uses below.</span>}
          </label>}

          <label className="block text-xs font-bold text-slate-700">
            Listed by *
            <select required value={advertiserType} onChange={event => setAdvertiserType(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <option value="">Select your role</option>
              <option value="Owner">Owner</option>
              <option value="Broker">Broker</option>
              <option value="Third Party">Third Party</option>
            </select>
            <span className="mt-1 block font-normal text-slate-500">Choose Third Party if you are posting on someone else’s behalf without acting as a broker.</span>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={priceOnRequest} onChange={e=>setPriceOnRequest(e.target.checked)}/> Price on request</label>
          {!priceOnRequest && <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={rentNegotiable} onChange={e=>setRentNegotiable(e.target.checked)}/> Rent negotiable</label>}
          {/* Rent & Deposit */}
          <div className="grid grid-cols-2 gap-3">
            {!priceOnRequest && <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isOdia ? 'ମାସିକ ଭଡ଼ା (₹) *' : 'Monthly Rent (₹) *'}
              </label>
              <input
                type="number"
                placeholder="1800"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94]"
              />
            </div>}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isOdia ? 'ଅଗ୍ରିମ ଟଙ୍କା (₹)' : 'Security Deposit (₹)'}
              </label>
              <input
                type="number"
                placeholder="0"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94]"
              />
            </div>
          </div>

          {/* District & Locality */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isOdia ? 'ଜିଲ୍ଲା (District) *' : 'District *'}
              </label>
              <select
                aria-label="District"
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setLocality('');
                  setCustomLocality('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94] bg-white"
              >
                {ODISHA_DISTRICTS.map((dist, idx) => (
                  <option key={idx} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isOdia ? 'ସ୍ଥାନ / ଅଞ୍ଚଳ (Locality) *' : 'Locality / Area *'}
              </label>
              <LocalityPicker district={district} value={locality} customValue={customLocality} onChange={setLocality} onCustomChange={setCustomLocality} />

            </div>
          </div>

          {/* Landmark */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isOdia ? 'ନିକଟବର୍ତ୍ତୀ ସ୍ଥାନ (Landmark)' : 'Landmark (Optional)'}
            </label>
            <input
              type="text"
              placeholder="e.g. Near Bus Stand, Opp. FM College"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94]"
            />
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isOdia ? 'ଆପଣଙ୍କ ନାମ *' : 'Your Name *'}
              </label>
              <input
                type="text"
                placeholder="e.g. Muna Bhai"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isOdia ? 'ମୋବାଇଲ୍ ନମ୍ବର *' : 'Call number *'}
              </label>
              <input
                type="tel"
                placeholder="9876543210"
                value={primaryPhone}
                disabled={loading || !!verifiedPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94]"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-100 p-3"><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={sameWhatsApp} onChange={e=>setSameWhatsApp(e.target.checked)}/>Use the same number for WhatsApp</label>{!sameWhatsApp?<label className="block text-xs font-bold text-slate-700">WhatsApp number<input type="tel" required placeholder="10-digit Indian WhatsApp number" value={whatsappPhone} onChange={e=>setWhatsappPhone(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"/></label>:null}<p className="text-xs leading-5 text-slate-500">Call and WhatsApp numbers are verified separately. {verifiedPhone?<Link href="/dashboard#account-access" className="font-semibold text-[#005B94] underline">Change your verified call number in account settings.</Link>:null}</p></div>
          <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-semibold text-slate-700">Your account</p><p className="mt-1 break-all text-sm text-slate-600">{adminClient ? 'Administrator account' : auth.session?.user.email||auth.session?.user.phone}</p><p className="mt-1 text-xs text-slate-500">Verify email to receive renewal reminders. Listings expire after 30 days unless renewed.</p></div>
          {/* Amenities Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isOdia ? 'ଉପଲବ୍ଧ ସୁବିଧା (Amenities)' : 'Available Amenities'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_AMENITIES.map((amenity, i) => {
                const isSelected = selectedAmenities.includes(amenity);
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => toggleAmenity(amenity)}
                    aria-pressed={isSelected}
                    className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-[#005B94] text-white border-[#005B94] font-semibold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{amenity}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Upload (Up to 10 photos) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                {isOdia ? 'ଫଟୋ ଅପଲୋଡ଼ କରନ୍ତୁ (ସର୍ବାଧିକ ୧୦ଟି)' : 'Upload Photos (Up to 10)'}
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {imageFiles.length}/10
              </span>
            </div>
            
            <div className="border border-dashed border-slate-300 rounded-xl p-3 text-center bg-slate-50 hover:bg-slate-100 transition cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={imageFiles.length >= 10}
                onChange={handleImageChange}
                className="hidden"
                id="photo-upload"
              />
              <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-600 font-medium">
                  {imageFiles.length < 10 ? 'Click to select room/property photos' : 'Maximum 10 photos reached'}
                </span>
              </label>
            </div>

            {/* Preview Thumbnails */}
            {imageFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2.5">
                {imageFiles.map((file, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(file)}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isOdia ? 'ଅତିରିକ୍ତ ବିବରଣୀ' : 'Additional Details (Optional)'}
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 24 hours water, independent gate, silent study environment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94]"
            />
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#005B94] hover:bg-[#004A7C] active:scale-98 text-white font-bold text-sm shadow-md shadow-[#005B94]/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isOdia ? 'ପୋଷ୍ଟ ହେଉଛି...' : 'Submitting for review...'}</span>
              </>
            ) : (
              <span>{isOdia ? 'ବିଜ୍ଞାପନ ପୋଷ୍ଟ କରନ୍ତୁ (ମାଗଣା)' : 'Submit Free Listing'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
