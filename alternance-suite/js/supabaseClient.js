// js/supabaseClient.js
// Nécessite que config.js soit chargé avant ce fichier,
// et que le CDN @supabase/supabase-js soit chargé avant ce fichier.

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
