'use client';

import React, { useState } from 'react';
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Boys Mess');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [district, setDistrict] = useState(ODISHA_DISTRICTS.find(d => d.startsWith('Balasore')) || ODISHA_DISTRICTS[0]);
  const [locality, setLocality] = useState('');
  const [landmark, setLandmark] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

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
      const { error: insertError } = await supabase.from('listings').insert([
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
      ]);

      if (insertError) {
        throw insertError;
      }

      onSuccess();
      onClose();
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
              {isOdia ? '୧୦୦% ମାଗଣା • ଅନୁମୋଦନ ପରେ ପ୍ରକାଶିତ ହେବ' : '100% Free • Published after admin approval'}
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
                onChange={(e) => setContactPhone(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-[#005B94]"
              />
            </div>
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
