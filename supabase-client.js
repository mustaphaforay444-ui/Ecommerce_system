import { createClient } from '@supabase/supabase-js';

const status = {
  ready: false,
  error: null
};

window.supabaseStatus = status;
window.supabaseReady = (async () => {
  try {
    const response = await fetch('/api/config', { headers: { Accept: 'application/json' } });
    const configuration = await response.json();
    if (!response.ok) throw new Error(configuration.error || 'Could not load Supabase configuration.');
    if (!configuration.url || !configuration.anonKey) throw new Error('Supabase URL or publishable/anon key is missing.');

    window.supabase = createClient(configuration.url, configuration.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    status.ready = true;
    window.dispatchEvent(new CustomEvent('supabase:ready'));
    return window.supabase;
  } catch (error) {
    status.error = error;
    window.dispatchEvent(new CustomEvent('supabase:error', { detail: error }));
    throw error;
  }
})();

// Avoid an unhandled rejection while pages attach their own ready/error UI.
window.supabaseReady.catch(() => {});
