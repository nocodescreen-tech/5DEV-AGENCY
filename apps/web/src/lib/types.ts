export type Settings = {
  studio?: {
    name?: string;
    tagline?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    address?: string;
    hours?: string;
  };
  currencies?: { base?: 'USD' | 'CDF'; usd_to_cdf?: number; updated_at?: string };
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  position: number;
};

export type Service = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  summary: string;
  description: string;
  deliverables: string[];
  price_from_usd: string | null;
  price_from_cdf: string | null;
  price_note: string | null;
  duration_label: string | null;
  position: number;
  is_published?: boolean;
};

export type Project = {
  id: string;
  slug: string;
  title: string;
  client_name: string | null;
  year: number | null;
  summary: string;
  body?: string;
  cover_url: string | null;
  live_url: string | null;
  category: string | null;
  is_published?: boolean;
  position?: number;
};

export type Lead = {
  id: string;
  kind: 'quote' | 'contact';
  status: 'new' | 'in_progress' | 'quoted' | 'won' | 'lost';
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  service_title: string | null;
  budget_amount: string | null;
  budget_currency: 'USD' | 'CDF';
  message: string;
  admin_note: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  shoot_date: string;
  slot: 'morning' | 'afternoon' | 'evening';
  location: string | null;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'done' | 'cancelled';
  service_title: string | null;
  created_at: string;
};

export type Health = {
  service: string;
  version: string;
  uptimeSeconds: number;
  database: 'up' | 'down' | 'not_configured';
  timestamp: string;
};
