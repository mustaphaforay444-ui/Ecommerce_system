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
  if (!email || !password) return response.status(400).json({ error: 'Enter your customer email and password.' });

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) return response.status(401).json({ error: 'Invalid customer credentials.' });
    const { data: profile, error: profileError } = await client.from('profiles').select('role').eq('id', data.user.id).single();
    if (profileError || profile?.role !== 'customer') {
      await client.auth.signOut();
      return response.status(401).json({ error: 'Invalid customer credentials.' });
    }
    return response.status(200).json({ session: data.session });
  } catch {
    return response.status(500).json({ error: 'Unable to sign in right now.' });
  }
}
