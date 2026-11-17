export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    response.status(503).json({ error: 'Supabase configuration is not complete.' });
    return;
  }

  // The publishable/anon key is designed for browser use and is protected by RLS.
  // Never return or expose the service-role key here.
  response.status(200).json({ url, anonKey });
}
