/* teacher.js — teacher dashboard logic */
(function () {
  const $ = (id) => document.getElementById(id);

  let state = {
    roomCode: null,
    lessonId: null,
    lessonStart: null,
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

  // Persist active lesson so teacher can rejoin after refresh / accidental leave.
  function persistActiveLesson() {
    if (!state.lessonId || !state.roomCode) return;
    try {
      localStorage.setItem("edunavi-active-lesson", JSON.stringify({
        lessonId: state.lessonId,
        roomCode: state.roomCode,
        startedAt: state.lessonStart || Date.now(),
      }));
    } catch (e) {}
  }
  function clearActiveLesson() {
    try { localStorage.removeItem("edunavi-active-lesson"); } catch (e) {}
  }
  function getActiveLesson() {
    try {
      const v = localStorage.getItem("edunavi-active-lesson");
      if (!v) return null;
      const o = JSON.parse(v);
      // Expire after 6 hours so we don't surface ancient sessions.
      if (Date.now() - (o.startedAt || 0) > 6 * 60 * 60 * 1000) {
        clearActiveLesson(); return null;
      }
      return o;
    } catch (e) { return null; }
  }

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

  // ====== Rule-based "AI" step proposal ======
  // For demo: pattern-matches common math problem shapes to plausible steps.
  // Phase 2 plugs in a real LLM via /api/propose endpoint.
  function proposeStepsFor(text) {
    const t = (text || "").toLowerCase().replace(/\s+/g, " ").trim();

    // Linear equation: ax + b = c  or  ax - b = c
    const lin = t.match(/(\d+)\s*x\s*([+\-−])\s*(\d+)\s*=\s*(-?\d+)/);
    if (lin) {
      const a = lin[1], op = lin[2], b = lin[3], c = lin[4];
      const inverseOp = (op === "+" ? "Lahuta" : "Lisa");
      return [
        `${inverseOp} ${b} mõlemale poolele võrrandist`,
        `Jaga mõlemad pooled ${a}-ga`,
        `Saadud x väärtus — kontrolli see algvõrrandis`,
      ];
    }

    // Quadratic: x² + bx + c  =  0  (or any x² appearance with =)
    if (/x\s*\^?\s*2|x²/.test(t) && t.includes("=")) {
      return [
        "Vii kõik liikmed ühele poolele, et oleks 0",
        "Tegurda või kasuta diskriminandi valemit b² − 4ac",
        "Leia x väärtused valemiga (−b ± √D) / 2a",
        "Kontrolli mõlemad lahendid algvõrrandis",
      ];
    }

    // Function analysis: f(x) = …
    if (/f\s*\(\s*x\s*\)/.test(t) || /funktsioon/.test(t) || /tuletis/.test(t)) {
      return [
        "Funktsiooni nullkohtade leidmine",
        "Tuletise leidmine",
        "Märgitabeli koostamine",
        "Kasvamis- ja kahanemisvahemike määramine",
        "Ekstreemumite leidmine",
      ];
    }

    // Fractions
    if (/\d+\/\d+|murru|murd/.test(t)) {
      return [
        "Leia ühine nimetaja",
        "Teisenda kõik murrud ühise nimetajaga",
        "Liida või lahuta lugejad, nimetaja jääb sama",
        "Lihtsusta vastust kui võimalik",
      ];
    }

    // System of equations
    if (t.split("=").length > 2 || /süsteem/.test(t)) {
      return [
        "Avalda üks muutuja teise kaudu ühest võrrandist",
        "Asenda see avaldis teise võrrandisse",
        "Lahenda saadud üks-muutujaline võrrand",
        "Leia ka teine muutuja, kontrolli mõlemas algvõrrandis",
      ];
    }

    // Default: generic 4-step problem-solving structure
    return [
      "Eralda olulised andmed ülesandest",
      "Vali sobiv meetod või valem",
      "Tee arvutused samm-sammult",
      "Kontrolli vastust algse ülesandega",
    ];
  }

  function renderStepsList(steps) {
    const list = $("steps-list");
    list.innerHTML = "";
    steps.forEach((stepText, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="num">${String(i + 1).padStart(2, "0")}</span>
        <input type="text" value="${stepText.replace(/"/g, "&quot;")}" />
        <button class="remove" type="button" title="Eemalda see etapp">×</button>
      `;
      li.querySelector(".remove").addEventListener("click", () => {
        li.remove();
        renumberSteps();
      });
      list.appendChild(li);
    });
  }
  function renumberSteps() {
    const list = $("steps-list");
    Array.from(list.children).forEach((li, i) => {
      li.querySelector(".num").textContent = String(i + 1).padStart(2, "0");
    });
  }
  function readSteps() {
    return Array.from($("steps-list").querySelectorAll("input"))
      .map((i) => i.value.trim())
      .filter(Boolean);
  }
  function showStepsReview(steps) {
    renderStepsList(steps);
    $("steps-review").style.display = "flex";
    $("steps-review").classList.add("show");
    document.querySelector(".lesson-input-bar").style.display = "none";
  }
  function hideStepsReview() {
    $("steps-review").style.display = "none";
    $("steps-review").classList.remove("show");
    document.querySelector(".lesson-input-bar").style.display = "";
  }
  function proposeSteps() {
    const text = $("exercise-input").value.trim();
    if (!text) {
      $("exercise-input").focus();
      return;
    }
    const steps = proposeStepsFor(text);
    showStepsReview(steps);
  }
  function addStepRow() {
    const list = $("steps-list");
    const i = list.children.length;
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="num">${String(i + 1).padStart(2, "0")}</span>
      <input type="text" value="" placeholder="Sisesta etapi kirjeldus" />
      <button class="remove" type="button" title="Eemalda see etapp">×</button>
    `;
    li.querySelector(".remove").addEventListener("click", () => {
      li.remove();
      renumberSteps();
    });
    list.appendChild(li);
    li.querySelector("input").focus();
  }
  function postConfirmedSteps() {
    const steps = readSteps();
    if (steps.length === 0) return;
    hideStepsReview();
    $("exercise-input").value = "";

    // Each student paces themselves through 300 students at once.
    // Post the whole step set as a single broadcast — students see all steps and mark per step.
    const stepSetId = EduNavi.newExerciseId();
    const stepObjects = steps.map((stepText, i) => ({
      id: EduNavi.newExerciseId(),
      text: `${i + 1}. samm — ${stepText}`,
      stepSetId,
      stepIndex: i,
      stepCount: steps.length,
      ts: Date.now(),
    }));

    // Track these in teacher state so the chart aggregates correctly per step.
    state.currentStepSet = { id: stepSetId, steps: stepObjects };
    state.currentExerciseId = stepObjects[stepObjects.length - 1].id; // chart shows the latest
    state.stats.exercises += stepObjects.length;
    state.respondedSessions = new Set();

    // Show the LAST step as "current exercise" — chart will fill from per-step responses
    setCurrentExercise(stepObjects[stepObjects.length - 1].text);
    resetCounts();
    updateStats();
    updateResponseRate();

    // Broadcast as a single step_set event AND each as an exercise (for back-compat).
    if (state.channel) {
      state.channel.channel.send({
        type: "broadcast",
        event: "step_set",
        payload: { stepSetId, steps: stepObjects, ts: Date.now() },
      });
      // Also broadcast each as exercise for any client that doesn't grok step_set yet.
      stepObjects.forEach((ex) => {
        state.channel.sendExercise(ex);
      });
      state.channel.updatePresence({ currentStepSet: { id: stepSetId, steps: stepObjects } });
    }
    if (state.lessonId) {
      stepObjects.forEach((ex) => {
        EduNaviDB.logExercise({ lessonId: state.lessonId, id: ex.id, text: ex.text });
      });
    }
  }

  function postQueuedStep() {
    const i = state.queuedIndex;
    const lines = state.queuedSteps;
    if (!lines || i >= lines.length) return;
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
    updateStepNav();
  }

  function nextQueuedStep() {
    state.queuedIndex++;
    if (state.queuedIndex >= state.queuedSteps.length) {
      hideStepNav();
      return;
    }
    postQueuedStep();
  }

  function endQueuedSteps() {
    state.queuedSteps = [];
    state.queuedIndex = 0;
    hideStepNav();
  }

  function showStepNav() {
    document.querySelector(".lesson-input-bar").style.display = "none";
    $("step-nav").style.display = "flex";
  }
  function hideStepNav() {
    $("step-nav").style.display = "none";
    document.querySelector(".lesson-input-bar").style.display = "";
  }
  function updateStepNav() {
    const total = state.queuedSteps.length;
    const at = state.queuedIndex + 1;
    $("step-nav-position").textContent = `${at} / ${total}`;
    const isLast = state.queuedIndex >= total - 1;
    $("step-nav-next").textContent = isLast ? "Lõpeta jada" : "Järgmine samm →";
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

  async function startLesson(resume) {
    const code = resume ? resume.roomCode : EduNavi.generateRoomCode();
    state.roomCode = code;
    state.lessonStart = resume ? resume.startedAt : Date.now();

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

    if (resume && resume.lessonId) {
      state.lessonId = resume.lessonId;
    } else {
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
    }
    persistActiveLesson();

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
    clearActiveLesson();
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
    // Tell students the lesson has ended BEFORE closing the channel.
    if (state.channel) state.channel.sendLessonEnd({ at: Date.now() });
    if (state.lessonId) EduNaviDB.endLesson(state.lessonId);
    const startTs = state.lessonStart || Date.now();
    showLessonSummary(startTs);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!EduNavi.isConfigured) EduNavi.showConfigBanner();
    $("start-btn").addEventListener("click", () => startLesson());

    // Resume an unfinished lesson if there is one
    const active = getActiveLesson();
    if (active) {
      $("resume-banner").style.display = "flex";
      $("resume-banner-text").textContent = `Tuba ${active.roomCode}`;
      $("resume-btn").addEventListener("click", () => startLesson(active));
      $("resume-discard").addEventListener("click", () => {
        if (state.lessonId == null) {
          // Best-effort end the persisted lesson server-side, then clear
          if (active.lessonId) EduNaviDB.endLesson(active.lessonId);
        }
        clearActiveLesson();
        $("resume-banner").style.display = "none";
      });
    }
    // Kahoot-style: student can join from the same landing page
    const joinForm = $("join-form");
    if (joinForm) {
      const ji = $("join-code-input");
      ji.addEventListener("input", () => {
        ji.value = ji.value.toUpperCase().replace(/[^A-Z]/g, "");
      });
      joinForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const code = ji.value.toUpperCase().trim();
        if (!/^[A-Z]{4}$/.test(code)) { ji.focus(); return; }
        window.location.href = `student?room=${encodeURIComponent(code)}`;
      });
    }
    $("post-btn").addEventListener("click", postExercise);
    $("propose-btn").addEventListener("click", proposeSteps);
    $("steps-cancel").addEventListener("click", hideStepsReview);
    $("steps-add").addEventListener("click", addStepRow);
    $("steps-post-all").addEventListener("click", postConfirmedSteps);
    $("step-nav-next").addEventListener("click", nextQueuedStep);
    $("step-nav-cancel").addEventListener("click", endQueuedSteps);
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
