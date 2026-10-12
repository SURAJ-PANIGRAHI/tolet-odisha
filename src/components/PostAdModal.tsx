'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ODISHA_DISTRICTS, DISTRICT_LOCALITIES, CATEGORIES, POPULAR_AMENITIES } from '@/data/odisha';
import { X, Upload, Check, Loader2, Sparkles } from 'lucide-react';

interface PostAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isOdia: boolean;
}

export const PostAdModal: React.FC<PostAdModalProps> = ({ isOpen, onClose, onSuccess, isOdia }) => {
  const [loading, setLoading] = useState(false);
  const [managementPath, setManagementPath] = useState('');
  const phoneOtpEnabled = process.env.NEXT_PUBLIC_PHONE_OTP_ENABLED === 'true';
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [phoneProof, setPhoneProof] = useState<{ phone: string; token: string } | null>(null);
  const otpInFlight = useRef(false);
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = window.setTimeout(() => setOtpCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [otpCooldown]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Boys Mess');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [district, setDistrict] = useState(ODISHA_DISTRICTS.find(d => d.startsWith('Balasore')) || ODISHA_DISTRICTS[0]);
  const [locality, setLocality] = useState('');
  const [landmark, setLandmark] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  async function phoneOtp(action: 'start' | 'verify') {
    if (otpInFlight.current || (action === 'start' && otpCooldown > 0)) return;
    const phone = contactPhone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(phone)) { setOtpMessage('Enter a valid Indian mobile number.'); return; }
    otpInFlight.current = true;
    setOtpBusy(true);
    setOtpMessage('');
    try {
      const response = await fetch(`/api/phone/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code: otpCode }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to verify your phone.');
      if (action === 'start') { setOtpSent(true); setOtpCooldown(60); setOtpMessage('OTP sent. Enter the code from your SMS.'); }
      else { setPhoneProof({ phone, token: result.access_token }); setOtpMessage('Mobile number verified.'); }
    } catch (error) { setOtpMessage(error instanceof Error ? error.message : 'Please retry.'); }
    finally { otpInFlight.current = false; setOtpBusy(false); }
  }
  if (!isOpen) return null;
  if (managementPath) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div role="dialog" aria-modal="true" aria-labelledby="submitted-heading" className="max-w-lg w-full rounded-3xl bg-white p-6 space-y-4">
        <h2 id="submitted-heading" className="text-xl font-bold">{isOdia ? 'ବିଜ୍ଞାପନ ପଠାଯାଇଛି' : 'Listing submitted'}</h2>
        <p>{isOdia ? 'ନିଜ ବିଜ୍ଞାପନ ହଟାଇବା ପାଇଁ ଏହି ଗୋପନୀୟ ଲିଙ୍କ୍ ସଞ୍ଚୟ କରନ୍ତୁ। ଏହା ଅନ୍ୟ କାହାକୁ ଦିଅନ୍ତୁ ନାହିଁ।' : 'Save this private link to remove your listing whenever you want. Anyone with this link can remove your ad, so keep it private.'}</p>
        <label htmlFor="management-link" className="block font-semibold">{isOdia ? 'ଗୋପନୀୟ ଲିଙ୍କ୍' : 'Your private management link'}</label>
        <input id="management-link" readOnly value={`${window.location.origin}${managementPath}`} onFocus={event => event.currentTarget.select()} className="w-full rounded border p-3 text-sm" />
        <a href={managementPath} className="block text-[#005B94] underline">{isOdia ? 'ବିଜ୍ଞାପନ ପରିଚାଳନା କରନ୍ତୁ' : 'Open management page'}</a>
        <p className="text-sm text-slate-600">{isOdia ? '୩୦ ଦିନ ପରେ ବିଜ୍ଞାପନ ହଟିବ।' : (phoneOtpEnabled ? 'Your listing is live and expires after 30 days. Email is optional; a verified email receives a reminder three days before expiry.' : 'Your listing requires review and expires after 30 days. Email is optional; a verified email receives a reminder three days before expiry.')}</p>
        <button type="button" onClick={() => { setManagementPath(''); onClose(); }} className="rounded bg-[#005B94] px-5 py-3 text-white">{isOdia ? 'ସମାପ୍ତ' : 'Done — I have saved the link'}</button>
      </div>
    </div>
  );

  const currentLocalities = DISTRICT_LOCALITIES[district.split(' ')[0]] || [];

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
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

    if (!title || !rent || !district || !locality || !contactName || !contactPhone) {
      setErrorMsg(isOdia ? 'ଦୟାକରି ସମସ୍ତ ଆବଶ୍ୟକୀୟ ତଥ୍ୟ ପୂରଣ କରନ୍ତୁ।' : 'Please fill all required fields.');
      return;
    }

    const phone = contactPhone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(phone) || !Number.isInteger(Number(rent)) || Number(rent) < 0 || !Number.isInteger(Number(deposit || 0)) || Number(deposit || 0) < 0) {
      setErrorMsg('Enter a valid Indian mobile number and non-negative whole rupee amounts.');
      return;
    }
    if (phoneOtpEnabled && (!phoneProof || phoneProof.phone !== phone)) { setErrorMsg('Verify your mobile number with OTP before posting.'); return; }
    if (imageFiles.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setErrorMsg('Photos must be JPEG, PNG or WebP and at most 5 MB each.');
      return;
    }
    setLoading(true);

    try {
      const imageUrls: string[] = [];

      // Upload photos if any
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `listings/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('listing-images')
            .getPublicUrl(filePath);
          if (publicUrlData.publicUrl) {
            imageUrls.push(publicUrlData.publicUrl);
          }
        }
      }

      // Insert listing into Supabase
      const response = await fetch('/api/listings', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(phoneOtpEnabled && phoneProof ? { Authorization: `Bearer ${phoneProof.token}` } : {}) },
        body: JSON.stringify({ email: contactEmail, listing:
        {
          title,
          description: description || null,
          category,
          rent_monthly: parseInt(rent, 10),
          deposit: deposit ? parseInt(deposit, 10) : 0,
          district: district.split(' ')[0],
          locality,
          landmark: landmark || null,
          contact_name: contactName,
          contact_phone: phone,
          whatsapp_number: phone,
          amenities: selectedAmenities,
          images: imageUrls,
          is_active: false,
          is_featured: false
        }
      }),
      });
      if (!response.ok) {
        const result = await response.json();
        if (response.status === 401 && phoneOtpEnabled) { setPhoneProof(null); setOtpSent(false); setOtpMessage('Phone verification expired. Request a new OTP.'); }
        throw new Error(result.error || 'Unable to submit listing');
      }

      const result = await response.json();
      setManagementPath(result.management_path);
      setPhoneProof(null);
      setOtpSent(false);
      setOtpCode('');
      onSuccess();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Error creating listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-[#005B94]" />
              <span>{isOdia ? 'ନୂତନ ବିଜ୍ଞାପନ ପୋଷ୍ଟ କରନ୍ତୁ' : 'Post Free Advertisement'}</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isOdia ? '୧୦୦% ମାଗଣା • ଅନୁମୋଦନ ପରେ ପ୍ରକାଶିତ ହେବ' : (phoneOtpEnabled ? '100% Free • Goes live after mobile OTP verification' : '100% Free • Published after admin approval')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isOdia ? 'ବିଜ୍ଞାପନର ଶୀର୍ଷକ *' : 'Ad Title *'}
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
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94] bg-white"
            >
              {CATEGORIES.filter(c => c.id !== 'All').map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {isOdia ? `${cat.labelOdia} (${cat.label})` : cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Rent & Deposit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
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
            </div>
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
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setLocality('');
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
              {currentLocalities.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94] bg-white"
                  >
                    <option value="">Select Area / Block</option>
                    {currentLocalities.map((loc, idx) => (
                      <option key={idx} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  {(locality === 'Other / ଅନ୍ୟାନ୍ୟ' || !currentLocalities.includes(locality)) && (
                    <input
                      type="text"
                      placeholder="Type your area, village or block name..."
                      value={locality === 'Other / ଅନ୍ୟାନ୍ୟ' ? '' : locality}
                      onChange={(e) => setLocality(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94] bg-slate-50"
                    />
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Nalamganj"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94]"
                />
              )}
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
                {isOdia ? 'ମୋବାଇଲ୍ ନମ୍ବର *' : 'Mobile / WhatsApp *'}
              </label>
              <input
                type="tel"
                placeholder="9876543210"
                value={contactPhone}
                disabled={otpBusy || loading}
                onChange={(e) => { setContactPhone(e.target.value); setPhoneProof(null); setOtpSent(false); setOtpCode(''); setOtpMessage(''); }}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94]"
              />
            </div>
          </div>

          {phoneOtpEnabled && <section className="space-y-3 rounded-xl border border-slate-200 p-4" aria-label="Mobile OTP verification">
            {phoneProof ? <p className="text-sm font-semibold text-green-700">Mobile number verified</p> : <>
              <button type="button" disabled={otpBusy || loading || otpCooldown > 0} onClick={() => void phoneOtp('start')} className="rounded bg-[#005B94] px-4 py-2 text-sm text-white disabled:opacity-50">{otpCooldown > 0 ? `Resend in ${otpCooldown}s` : otpSent ? 'Resend OTP' : 'Send OTP'}</button>
              {otpSent && <div className="flex flex-wrap items-end gap-3"><label htmlFor="phone-otp" className="text-xs font-bold">SMS code<input id="phone-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otpCode} disabled={otpBusy || loading} onChange={event => setOtpCode(event.target.value.replace(/\D/g, ''))} className="mt-1 block w-32 rounded border p-2 text-sm" /></label><button type="button" disabled={otpBusy || loading || otpCode.length !== 6} onClick={() => void phoneOtp('verify')} className="rounded border px-4 py-2 text-sm disabled:opacity-50">Verify OTP</button></div>}
            </>}
            <p role="status" className="text-xs text-slate-600">{otpBusy ? 'Processing…' : otpMessage}</p>
          </section>}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="owner-email">{isOdia ? 'ଆପଣଙ୍କ ଇମେଲ୍ (ଇଚ୍ଛାଧୀନ)' : 'Your email (optional)'}</label>
            <input id="owner-email" type="email" maxLength={254} value={contactEmail} onChange={event => setContactEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
            <p className="mt-1 text-xs text-slate-500">{isOdia ? 'ଇମେଲ୍ ଦେବା ବାଧ୍ୟତାମୂଳକ ନୁହେଁ। କେବଳ ନିଶ୍ଚିତ ଇମେଲ୍‌କୁ ନବୀକରଣ ସୂଚନା ମିଳିବ। ୩୦ ଦିନ ପରେ ବିଜ୍ଞାପନ ହଟିବ।' : 'Email is not required. A renewal reminder is sent three days before expiry only if you provide and verify an email. Without renewal, your ad is removed after 30 days.'}</p>
          </div>
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
