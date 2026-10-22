// Supabase project used by the CRM page (crm.html).
// Find both values in Supabase: Project Settings → API.
// The anon key is designed to be public; row level security (supabase/crm-schema.sql)
// means nothing can be read or changed without a signed-in, active CRM team account.
window.MEETXPORT_SUPABASE = {
  url: '',      // e.g. 'https://abcdefgh.supabase.co'
  anonKey: ''   // the "anon public" key
};
