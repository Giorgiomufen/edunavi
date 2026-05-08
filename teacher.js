/* teacher.js — teacher dashboard logic */
(function () {
  const $ = (id) => document.getElementById(id);

  let state = {
    roomCode: null,
    lessonId: null,
    user: null,
    channel: null,
    currentExerciseId: null,
    counts: { yes: 0, unsure: 0, no: 0 },
    stats: { exercises: 0, responses: 0, yes: 0 },
    studentCount: 0,
    respondedSessions: new Set(),
    chart: null,
    jitsi: null,
  };

  function renderAuthUi() {
    const loading = $("top-auth-loading");
    const open = $("open-signin");
    const userArea = $("top-auth-user");
    if (loading) loading.style.display = "none";
    if (state.user) {
      open.style.display = "none";
      userArea.style.display = "inline-flex";
      $("user-email").textContent = state.user.email || state.user.id;
    } else {
      open.style.display = "inline-flex";
      userArea.style.display = "none";
    }
  }

  let authMode = "signin";
  function applyAuthMode() {
    const isSignin = authMode === "signin";
    $("auth-mode-title").textContent = isSignin ? "Logi sisse" : "Loo konto";
    $("auth-mode-sub").textContent = isSignin
      ? "Tunnid salvestuvad sinu kontole."
      : "Tasuta konto. Vajame ainult emaili sinu tundide salvestamiseks.";
    $("auth-submit").textContent = isSignin ? "Logi sisse" : "Loo konto";
    $("auth-toggle-text").textContent = isSignin ? "Pole kontot?" : "On juba konto?";
    $("auth-toggle").textContent = isSignin ? "Loo konto" : "Logi sisse";
  }
  function openAuthModal() {
    authMode = "signin";
    applyAuthMode();
    $("auth-error").textContent = "";
    $("auth-modal").classList.add("show");
    setTimeout(() => { try { $("email-input").focus(); } catch (e) {} }, 60);
  }
  function closeAuthModal() {
    $("auth-modal").classList.remove("show");
  }

  function updateStats() {
    $("stat-exercises").textContent = state.stats.exercises;
    $("stat-responses").textContent = state.stats.responses;
    if (state.stats.responses > 0) {
      const pct = Math.round((state.stats.yes / state.stats.responses) * 100);
      $("stat-understanding").textContent = pct + "%";
    } else {
      $("stat-understanding").textContent = "—";
    }
  }

  function updateResponseRate() {
    const el = $("response-rate");
    if (!el) return;
    const responded = state.respondedSessions.size;
    const total = state.studentCount || 0;
    if (total === 0 || !state.currentExerciseId) {
      el.textContent = "—";
    } else {
      el.textContent = `${responded} / ${total}`;
    }
  }

  function initChart() {
    if (state.chart) {
      try { state.chart.destroy(); } catch (e) {}
      state.chart = null;
    }
    const ctx = $("response-chart").getContext("2d");
    state.chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["SAIN ARU", "POLE KINDEL", "EI"],
        datasets: [
          {
            data: [0, 0, 0],
            backgroundColor: ["#ffffff", "#888888", "#3d3d3d"],
            borderColor: ["#ffffff", "#888888", "#5a5a5a"],
            borderWidth: 1,
            borderRadius: 0,
            borderSkipped: false,
            barThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 220 },
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: {
              color: "#767676",
              font: { family: "'Barlow Condensed', sans-serif", size: 10, weight: "500" },
            },
            grid: { display: false },
            border: { color: "rgba(255,255,255,0.16)" },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "#767676",
              precision: 0,
              font: { family: "'JetBrains Mono', monospace", size: 9 },
            },
            grid: { color: "rgba(255,255,255,0.06)", drawTicks: false },
            border: { color: "rgba(255,255,255,0.16)" },
          },
        },
      },
    });
  }

  function updateChart() {
    if (!state.chart) return;
    state.chart.data.datasets[0].data = [
      state.counts.yes,
      state.counts.unsure,
      state.counts.no,
    ];
    state.chart.update();
    $("num-yes").textContent = state.counts.yes;
    $("num-unsure").textContent = state.counts.unsure;
    $("num-no").textContent = state.counts.no;
    updateIntervention();
  }

  function updateIntervention() {
    const card = $("intervention-card");
    if (!card) return;
    const total = state.counts.yes + state.counts.unsure + state.counts.no;
    if (total < 3) { card.style.display = "none"; return; }
    const noPct = state.counts.no / total;
    const unsurePct = state.counts.unsure / total;
    const yesPct = state.counts.yes / total;
    let msg = null;
    if (noPct >= 0.5) {
      msg = `Peatu ja selgita seda etappi uuesti — ${Math.round(noPct * 100)}% ei saanud aru.`;
    } else if (unsurePct >= 0.4 && yesPct < 0.5) {
      msg = `Anna üks lisaharjutus — ${Math.round(unsurePct * 100)}% pole kindel.`;
    } else if (noPct + unsurePct >= 0.5) {
      msg = `Vähemalt pool klassist vajab tuge. Suuna kohapealne abiõpetaja kahtleja juurde.`;
    }
    if (msg) {
      $("intervention-text").textContent = msg;
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  }

  function resetCounts() {
    state.counts = { yes: 0, unsure: 0, no: 0 };
    updateChart();
  }

  function setCurrentExercise(text) {
    const el = $("current-exercise");
    if (text && text.trim()) {
      el.textContent = text;
      el.classList.remove("empty");
    } else {
      el.textContent = "Pole aktiivset ülesannet";
      el.classList.add("empty");
    }
  }

  function renderQR(url) {
    const canvas = $("qr-canvas");
    canvas.innerHTML = "";
    try {
      new QRCode(canvas, {
        text: url,
        width: 88,
        height: 88,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (e) {
      console.error("QR render failed", e);
      canvas.textContent = "QR";
    }
  }

  function setConnection(status) {
    const pill = $("conn-pill");
    const text = $("conn-text");
    pill.classList.remove("live");
    if (status === "SUBSCRIBED") {
      pill.classList.add("live");
      text.textContent = "Eetris";
    } else if (status === "DEMO_MODE") {
      text.textContent = "Demo režiim";
    } else if (status === "CHANNEL_ERROR") {
      text.textContent = "Ühenduse viga";
    } else {
      text.textContent = "ühendamine";
    }
  }

  function startJitsi(roomCode) {
    if (!window.JitsiMeetExternalAPI) {
      console.warn("Jitsi External API not loaded");
      return;
    }
    if (state.jitsi) { try { state.jitsi.dispose(); } catch (e) {} }

    const roomName = (window.EDUNAVI_CONFIG.JITSI_ROOM_PREFIX || "edunavi-") + roomCode;
    const container = $("jitsi-container");
    container.innerHTML = "";

    state.jitsi = new JitsiMeetExternalAPI("meet.jit.si", {
      roomName,
      parentNode: container,
      width: "100%",
      height: "100%",
      userInfo: { displayName: "Õpetaja" },
      configOverwrite: {
        prejoinPageEnabled: false,
        prejoinConfig: { enabled: false },
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        disableInviteFunctions: true,
        disableThirdPartyRequests: true,
        enableNoisyMicDetection: false,
        hideConferenceSubject: true,
        hideConferenceTimer: true,
        hideParticipantsStats: true,
        disableProfile: true,
        readOnlyName: true,
        disableSelfView: false,
        toolbarButtons: [],
        notifications: [],
        defaultLanguage: "et",
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_POWERED_BY: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_PROMOTIONAL_CLOSE_PAGE: false,
        MOBILE_APP_PROMO: false,
        HIDE_INVITE_MORE_HEADER: true,
        SHOW_CHROME_EXTENSION_BANNER: false,
        DEFAULT_BACKGROUND: "#000000",
        DEFAULT_REMOTE_DISPLAY_NAME: "Õpilane",
        DEFAULT_LOCAL_DISPLAY_NAME: "Õpetaja",
        TOOLBAR_BUTTONS: [],
        DISABLE_PRESENCE_STATUS: true,
        DISABLE_FOCUS_INDICATOR: true,
        GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
        HIDE_DEEP_LINKING_LOGO: true,
        DISABLE_VIDEO_BACKGROUND: true,
        DISABLE_DOMINANT_SPEAKER_INDICATOR: true,
        DISABLE_TRANSCRIPTION_SUBTITLES: true,
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        SHOW_DEEP_LINKING_IMAGE: false,
      },
    });

    state.jitsi.addListener("audioMuteStatusChanged", (e) => {
      const btn = $("mic-btn");
      btn.dataset.on = String(!e.muted);
    });
    state.jitsi.addListener("videoMuteStatusChanged", (e) => {
      const btn = $("cam-btn");
      btn.dataset.on = String(!e.muted);
    });
  }

  function toggleAudio() {
    if (state.jitsi) state.jitsi.executeCommand("toggleAudio");
  }
  function toggleVideo() {
    if (state.jitsi) state.jitsi.executeCommand("toggleVideo");
  }

  function postExercise() {
    const input = $("exercise-input");
    const text = input.value.trim();
    if (!text) return;

    const exercise = {
      id: EduNavi.newExerciseId(),
      text,
      ts: Date.now(),
    };
    state.currentExerciseId = exercise.id;
    state.stats.exercises++;
    state.respondedSessions = new Set();
    setCurrentExercise(text);
    resetCounts();
    updateStats();
    updateResponseRate();
    if (state.channel) {
      state.channel.sendExercise(exercise);
      state.channel.updatePresence({ currentExercise: exercise });
    }
    if (state.lessonId) {
      EduNaviDB.logExercise({ lessonId: state.lessonId, id: exercise.id, text });
    }

    input.value = "";
    input.focus();
  }

  function manualReset() {
    resetCounts();
    if (state.channel) state.channel.sendReset({ exerciseId: state.currentExerciseId });
  }

  // Post each newline as a separate exercise, with a delay between them.
  // Lets the teacher decompose a problem into steps without needing AI.
  async function postSteps() {
    const input = $("exercise-input");
    const lines = input.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    if (lines.length === 1) {
      postExercise();
      return;
    }
    const btn = $("post-steps-btn");
    const post = $("post-btn");
    btn.disabled = true; post.disabled = true; input.disabled = true;
    const orig = btn.textContent;
    for (let i = 0; i < lines.length; i++) {
      btn.textContent = `Samm ${i + 1}/${lines.length}…`;
      // Show this step as the current exercise + broadcast it.
      const text = `${i + 1}. samm — ${lines[i]}`;
      const exercise = { id: EduNavi.newExerciseId(), text, ts: Date.now() };
      state.currentExerciseId = exercise.id;
      state.stats.exercises++;
      state.respondedSessions = new Set();
      setCurrentExercise(text);
      resetCounts();
      updateStats();
      updateResponseRate();
      if (state.channel) {
        state.channel.sendExercise(exercise);
        state.channel.updatePresence({ currentExercise: exercise });
      }
      if (state.lessonId) {
        EduNaviDB.logExercise({ lessonId: state.lessonId, id: exercise.id, text });
      }
      // Wait for students to answer before moving on. 4s is short but demoable.
      if (i < lines.length - 1) {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
    btn.textContent = orig;
    btn.disabled = false; post.disabled = false; input.disabled = false;
    input.value = "";
    input.focus();
  }

  async function startLesson() {
    const code = EduNavi.generateRoomCode();
    state.roomCode = code;
    state.lessonStart = Date.now();

    $("start-screen").style.display = "none";
    $("app").style.display = "flex";
    $("top-auth").style.display = "none";

    $("room-code").textContent = code;
    const joinUrl = EduNavi.studentJoinUrl(code);
    renderQR(joinUrl);

    startJitsi(code);

    initChart();
    updateChart();
    updateStats();

    if (!EduNavi.isConfigured) {
      EduNavi.showConfigBanner();
      setConnection("DEMO_MODE");
      return;
    }

    // Persist the lesson row first so we can log exercises/responses against it.
    const school = ($("school-input") && $("school-input").value.trim()) || null;
    const className = ($("class-input") && $("class-input").value.trim()) || null;
    const topic = ($("topic-input") && $("topic-input").value.trim()) || null;
    state.lessonId = await EduNaviDB.createLesson({
      roomCode: code,
      teacherId: state.user ? state.user.id : null,
      school,
      className,
      topic,
    });

    state.channel = EduNavi.openRoomChannel(code, "teacher", {
      onResponse: (r) => {
        if (!state.currentExerciseId || r.exerciseId === state.currentExerciseId) {
          if (r.answer === "yes") { state.counts.yes++; state.stats.yes++; }
          else if (r.answer === "no") state.counts.no++;
          else if (r.answer === "unsure") state.counts.unsure++;
          state.stats.responses++;
          if (r.sessionId) state.respondedSessions.add(r.sessionId);
          updateChart();
          updateStats();
          updateResponseRate();
        }
      },
      onPresence: (n) => {
        state.studentCount = n;
        $("student-count").textContent = String(n);
        updateResponseRate();
      },
      onComment: (c) => {
        if (!c || !c.text) return;
        const list = $("comments-list");
        const li = document.createElement("li");
        li.textContent = c.text;
        list.insertBefore(li, list.firstChild);
        // Keep only last 6 visible
        while (list.children.length > 6) list.removeChild(list.lastChild);
        $("comments-card").style.display = "flex";
      },
      onStatus: setConnection,
    });
  }

  function showLessonSummary(start) {
    const end = Date.now();
    const ms = end - start;
    const min = Math.round(ms / 60000);
    const dur = min < 1 ? "<1 min" : (min < 60 ? min + " min" : Math.floor(min/60) + "h " + (min%60) + "m");
    $("summary-room").textContent = state.roomCode || "----";
    $("summary-duration").textContent = "kestus " + dur;
    $("summary-students").textContent = state.studentCount || 0;
    $("summary-exercises").textContent = state.stats.exercises;
    $("summary-responses").textContent = state.stats.responses;
    if (state.stats.responses > 0) {
      const pct = Math.round((state.stats.yes / state.stats.responses) * 100);
      $("summary-understanding").textContent = pct + "%";
    } else {
      $("summary-understanding").textContent = "—";
    }
    $("summary-meta").textContent = state.lessonId
      ? "Salvestatud: lesson_id " + state.lessonId.slice(0, 8) + "…"
      : "Salvestamata (Supabase pole seadistatud)";
    $("summary-history-link").style.display = state.user && state.lessonId ? "inline-block" : "none";
    $("summary-modal").classList.add("show");
  }

  function tearDown() {
    if (state.channel) state.channel.close();
    if (state.chart) { try { state.chart.destroy(); } catch (e) {} }
    if (state.jitsi) { try { state.jitsi.dispose(); } catch (e) {} }
    const keepUser = state.user;
    state = {
      roomCode: null,
      lessonId: null,
      user: keepUser,
      channel: null,
      currentExerciseId: null,
      counts: { yes: 0, unsure: 0, no: 0 },
      stats: { exercises: 0, responses: 0, yes: 0 },
      studentCount: 0,
      respondedSessions: new Set(),
      chart: null,
      jitsi: null,
    };
    $("app").style.display = "none";
    $("start-screen").style.display = "grid";
    $("top-auth").style.display = "flex";
  }

  function endLesson() {
    if (!confirm("Kas lõpetada tund?")) return;
    if (state.lessonId) EduNaviDB.endLesson(state.lessonId);
    // Snapshot the start time before we tear down so duration math is right.
    const startTs = state.lessonStart || Date.now();
    showLessonSummary(startTs);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!EduNavi.isConfigured) EduNavi.showConfigBanner();
    $("start-btn").addEventListener("click", startLesson);
    $("post-btn").addEventListener("click", postExercise);
    $("post-steps-btn").addEventListener("click", postSteps);
    $("reset-btn").addEventListener("click", manualReset);
    $("end-btn").addEventListener("click", endLesson);
    $("mic-btn").addEventListener("click", toggleAudio);
    $("cam-btn").addEventListener("click", toggleVideo);
    $("summary-close").addEventListener("click", () => {
      $("summary-modal").classList.remove("show");
      tearDown();
    });
    function showAuthError(msg) { $("auth-error").textContent = msg || ""; }
    $("open-signin").addEventListener("click", openAuthModal);
    $("auth-close").addEventListener("click", closeAuthModal);
    $("auth-modal").addEventListener("click", (e) => {
      if (e.target.id === "auth-modal") closeAuthModal();
    });
    $("auth-toggle").addEventListener("click", () => {
      authMode = authMode === "signin" ? "signup" : "signin";
      applyAuthMode();
      showAuthError("");
    });
    $("auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      showAuthError("");
      const email = $("email-input").value.trim();
      const password = $("password-input").value;
      if (!email || !password) return showAuthError("Sisesta email ja parool.");
      if (authMode === "signup" && password.length < 6) {
        return showAuthError("Parool peab olema vähemalt 6 tähemärki.");
      }
      const fn = authMode === "signin"
        ? EduNaviAuth.signInWithEmail
        : EduNaviAuth.signUpWithEmail;
      const { error } = await fn(email, password);
      if (error) {
        showAuthError(error);
      } else if (authMode === "signup") {
        showAuthError("Konto loodud. Kui email kinnitamine on sisse, kontrolli postkasti.");
      }
    });
    $("signout-btn").addEventListener("click", async () => {
      await EduNaviAuth.signOut();
    });
    $("exercise-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        postExercise();
      }
    });

    // Auth bootstrap
    if (EduNavi.isConfigured) {
      state.user = await EduNaviAuth.getUser();
      renderAuthUi();
      EduNaviAuth.onAuthChange((user) => {
        const wasSignedIn = !!state.user;
        state.user = user;
        renderAuthUi();
        // If we just acquired a user (sign-in or auto-confirm signup), close the modal.
        if (user && !wasSignedIn) closeAuthModal();
      });
    } else {
      // Without Supabase, allow anonymous "demo" use so the layout is still testable.
      $("auth-loading").style.display = "none";
      $("signed-in").style.display = "block";
      $("user-email").textContent = "demo (Supabase pole seadistatud)";
    }
  });
})();
