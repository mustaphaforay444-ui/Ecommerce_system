import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const anonKey = SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY;
  const serverKey = SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !anonKey) return response.status(503).json({ error: 'Authentication service is not configured.' });

  const identifier = String(request.body?.identifier || '').trim();
  const password = String(request.body?.password || '');
  if (!identifier || !password) return response.status(400).json({ error: 'Enter your username/email and password.' });

  try {
    let email = identifier;
    if (!identifier.includes('@')) {
      if (!serverKey) {
        return response.status(503).json({ error: 'Admin username sign-in is not configured. Use the administrator email or contact the site owner.' });
      }
      const adminClient = createClient(SUPABASE_URL, serverKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data, error } = await adminClient.from('profiles')
        .select('email')
        .eq('admin_username', identifier)
        .eq('role', 'admin')
        .maybeSingle();
      if (error || !data?.email) return response.status(401).json({ error: 'Invalid admin credentials.' });
      email = data.email;
    }

    const client = createClient(SUPABASE_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password });
    if (authError || !authData.session) return response.status(401).json({ error: 'Invalid admin credentials.' });

    const { data: profile, error: profileError } = await client.from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();
    if (profileError || profile?.role !== 'admin') {
      await client.auth.signOut();
      return response.status(403).json({ error: 'This account does not have administrator access.' });
    }

    return response.status(200).json({ session: authData.session });
  } catch {
    return response.status(500).json({ error: 'Unable to sign in right now.' });
  }
}
