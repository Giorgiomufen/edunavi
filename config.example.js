// Copy this file to `config.js` and fill in your Supabase project values.
// Get these at: https://supabase.com  (create a free project, then Settings → API)
window.EDUNAVI_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-ID.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",

  // Public base URL where this site is hosted (used to build the QR code).
  // Examples: "https://edunavi.vercel.app" or "http://localhost:5500"
  // Leave empty to auto-detect from the current page.
  PUBLIC_BASE_URL: "",

  // Prefix for Jitsi room names so we don't collide with random people's rooms.
  JITSI_ROOM_PREFIX: "edunavi-pres2026-",
};
