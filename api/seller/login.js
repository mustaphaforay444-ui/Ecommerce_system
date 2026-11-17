import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const email = String(request.body?.email || '').trim();
  const password = String(request.body?.password || '');
  if (!url || !anonKey) return response.status(503).json({ error: 'Authentication service is not configured.' });
  if (!email || !password) return response.status(400).json({ error: 'Enter your seller email and password.' });

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) return response.status(401).json({ error: 'Invalid seller credentials.' });
    const { data: profile, error: profileError } = await client.from('profiles').select('role, seller_status').eq('id', data.user.id).single();
    if (profileError) {
      await client.auth.signOut();
      return response.status(503).json({ error: 'Seller approvals are not set up yet. Please contact the bookstore administrator.' });
    }
    if (profile?.role !== 'seller') { await client.auth.signOut(); return response.status(401).json({ error: 'Invalid seller credentials.' }); }
    if (profile.seller_status === 'pending') { await client.auth.signOut(); return response.status(403).json({ error: 'Your seller application is pending admin review.' }); }
    if (profile.seller_status !== 'approved') { await client.auth.signOut(); return response.status(403).json({ error: 'Your seller application was not approved. Please contact the bookstore administrator.' }); }
    return response.status(200).json({ session: data.session });
  } catch {
    return response.status(500).json({ error: 'Unable to sign in right now.' });
  }
}
