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
  rent_monthly: number;
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
}
