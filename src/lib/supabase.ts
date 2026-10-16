import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Listing {
  id: string;
  created_at: string;
  expires_at?: string;
  title: string;
  description: string | null;
  category: string;
  commercial_type?: string | null;
  area_sqft?: number | null;
  advertiser_type?: 'Owner' | 'Broker' | 'Third Party' | null;
  rent_monthly: number;
  rent_negotiable?: boolean;
  deposit: number;
  district: string;
  locality: string;
  landmark: string | null;
  contact_name: string;
  contact_phone: string;
  whatsapp_number: string | null;
  images: string[];
  amenities: string[];
  is_featured: boolean;
  is_active: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
  id_verified?: boolean;
  ranking_score?: number;
  portal_listing?: boolean;
  boost_expires_at?: string | null;
}
