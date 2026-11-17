import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') return response.status(405).json({ available: false, error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response.status(503).json({ available: false, error: 'Seller registration is not configured yet.' });
  try {
    const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await publicClient.rpc('seller_registration_enabled');
    if (error || data !== true) return response.status(503).json({ available: false, error: 'Seller approval setup must be completed first.' });
    return response.status(200).json({ available: true });
  } catch {
    return response.status(503).json({ available: false, error: 'Seller registration is not available right now.' });
  }
}
