/* auth.js — Supabase auth helpers + session listener */
(function () {
  function client() {
    if (!window.EduNavi || !window.EduNavi.isConfigured) return null;
    if (!window.supabase) return null;
    if (!window._edunaviSb) {
      const cfg = window.EDUNAVI_CONFIG;
      window._edunaviSb = window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      );
    }
    return window._edunaviSb;
  }

  async function getUser() {
    const c = client();
    if (!c) return null;
    const { data, error } = await c.auth.getUser();
    if (error || !data || !data.user) return null;
    return data.user;
  }

  async function signInWithGoogle() {
    const c = client();
    if (!c) return;
    const cfg = window.EDUNAVI_CONFIG;
    const redirectTo =
      (cfg.PUBLIC_BASE_URL && cfg.PUBLIC_BASE_URL.replace(/\/$/, "")) ||
      window.location.origin + window.location.pathname.replace(/[^/]*$/, "");
    await c.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  async function signOut() {
    const c = client();
    if (!c) return;
    await c.auth.signOut();
  }

  function onAuthChange(handler) {
    const c = client();
    if (!c) return () => {};
    const { data } = c.auth.onAuthStateChange((_event, session) => {
      handler(session ? session.user : null);
    });
    return () => data.subscription.unsubscribe();
  }

  window.EduNaviAuth = {
    getUser,
    signInWithGoogle,
    signOut,
    onAuthChange,
  };
})();
