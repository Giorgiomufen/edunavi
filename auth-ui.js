/* auth-ui.js — shared login widget for /loo, /lesson, etc.
 *
 * Wires the standard auth markup (top-auth widget + auth-modal form) on any
 * page that includes it. Idempotent: no-ops if the elements are missing.
 *
 * Required HTML IDs (all optional — script ignores absent ones):
 *   #top-auth-loading, #open-signin, #top-auth-user, #user-email, #signout-btn
 *   #auth-modal, #auth-form, #auth-close, #auth-toggle, #auth-toggle-text,
 *   #auth-mode-title, #auth-mode-sub, #auth-submit, #auth-error,
 *   #email-input, #password-input
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let user = null;
  let authMode = "signin";

  function renderTopAuth() {
    const loading = $("top-auth-loading");
    const open = $("open-signin");
    const userArea = $("top-auth-user");
    const emailLabel = $("user-email");
    if (loading) loading.style.display = "none";
    if (user) {
      if (open) open.style.display = "none";
      if (userArea) userArea.style.display = "inline-flex";
      if (emailLabel) emailLabel.textContent = user.email || user.id;
    } else {
      if (open) open.style.display = "inline-flex";
      if (userArea) userArea.style.display = "none";
    }
  }

  function applyAuthMode() {
    const isSignin = authMode === "signin";
    if ($("auth-mode-title")) $("auth-mode-title").textContent = isSignin ? "Logi sisse" : "Loo konto";
    if ($("auth-mode-sub")) $("auth-mode-sub").textContent = isSignin
      ? "Tunnid salvestuvad sinu kontole."
      : "Tasuta konto. Vajame ainult emaili sinu tundide salvestamiseks.";
    if ($("auth-submit")) $("auth-submit").textContent = isSignin ? "Logi sisse" : "Loo konto";
    if ($("auth-toggle-text")) $("auth-toggle-text").textContent = isSignin ? "Pole kontot?" : "On juba konto?";
    if ($("auth-toggle")) $("auth-toggle").textContent = isSignin ? "Loo konto" : "Logi sisse";
  }

  function openModal() {
    authMode = "signin";
    applyAuthMode();
    if ($("auth-error")) $("auth-error").textContent = "";
    if ($("auth-modal")) $("auth-modal").classList.add("show");
    setTimeout(() => { try { $("email-input") && $("email-input").focus(); } catch (e) {} }, 60);
  }

  function closeModal() {
    if ($("auth-modal")) $("auth-modal").classList.remove("show");
  }

  function showError(msg) {
    if ($("auth-error")) $("auth-error").textContent = msg || "";
  }

  function wire() {
    if (!window.EduNaviAuth) return;

    if ($("open-signin")) $("open-signin").addEventListener("click", openModal);
    if ($("auth-close")) $("auth-close").addEventListener("click", closeModal);
    if ($("auth-modal")) {
      $("auth-modal").addEventListener("click", (e) => {
        if (e.target.id === "auth-modal") closeModal();
      });
    }
    if ($("auth-toggle")) $("auth-toggle").addEventListener("click", () => {
      authMode = authMode === "signin" ? "signup" : "signin";
      applyAuthMode();
      showError("");
    });
    if ($("auth-form")) $("auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");
      const email = $("email-input") ? $("email-input").value.trim() : "";
      const password = $("password-input") ? $("password-input").value : "";
      if (!email || !password) return showError("Sisesta email ja parool.");
      if (authMode === "signup" && password.length < 6) {
        return showError("Parool peab olema vähemalt 6 tähemärki.");
      }
      const fn = authMode === "signin"
        ? EduNaviAuth.signInWithEmail
        : EduNaviAuth.signUpWithEmail;
      const { error } = await fn(email, password);
      if (error) {
        showError(error);
      } else if (authMode === "signup") {
        showError("Konto loodud. Kui email kinnitamine on sisse, kontrolli postkasti.");
      } else {
        closeModal();
      }
    });
    if ($("signout-btn")) $("signout-btn").addEventListener("click", async () => {
      await EduNaviAuth.signOut();
    });

    // Initial state + listener
    EduNaviAuth.getUser().then((u) => {
      user = u;
      renderTopAuth();
    });
    EduNaviAuth.onAuthChange((u) => {
      user = u;
      renderTopAuth();
      if (u) closeModal();
    });
  }

  document.addEventListener("DOMContentLoaded", wire);
})();
