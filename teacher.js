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
    // exerciseId -> { sessionId: 'yes'|'no'|'unsure' }
    perStepResponses: {},
    // ordered list of all exercises this lesson, for the polar chart
    exerciseOrder: [],
    exerciseTextById: {},
    polarChart: null,
    chart: null,
    jitsi: null,
    // Per-class state for the Klassid panel
    school: null,
    targetClasses: [],            // ["8.A", "8.B", "8.C"] from teacher input
    classSessions: {},            // klass -> Set<sessionId> currently joined
    classResponses: {},           // klass -> { yes, unsure, no }
    sessionClass: {},             // sessionId -> klass (for fast lookup)
  };

  function parseClassList(raw) {
    if (!raw) return [];
    return raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  }

  function ensureClassBucket(klass) {
    if (!klass) return;
    if (!state.classSessions[klass]) state.classSessions[klass] = new Set();
    if (!state.classResponses[klass]) state.classResponses[klass] = { yes: 0, unsure: 0, no: 0 };
  }

  function recomputeClassResponses() {
    // Rebuild per-class response counts from the source of truth (perStepResponses + sessionClass).
    state.classResponses = {};
    state.targetClasses.forEach((c) => { state.classResponses[c] = { yes: 0, unsure: 0, no: 0 }; });
    Object.values(state.perStepResponses).forEach((sessionMap) => {
      Object.entries(sessionMap).forEach(([sid, ans]) => {
        const klass = state.sessionClass[sid];
        if (!klass) return;
        ensureClassBucket(klass);
        if (state.classResponses[klass][ans] !== undefined) {
          state.classResponses[klass][ans]++;
        }
      });
    });
  }

  function renderClassesCard() {
    const card = $("classes-card");
    if (!card) return;
    const visible = state.targetClasses.length > 0;
    if (!visible) { card.style.display = "none"; return; }
    card.style.display = "flex";
    if (state.school) $("classes-school").textContent = state.school;
    const ul = $("classes-rows");
    ul.innerHTML = "";
    state.targetClasses.forEach((klass) => {
      ensureClassBucket(klass);
      const joined = state.classSessions[klass].size;
      const counts = state.classResponses[klass];
      const total = counts.yes + counts.unsure + counts.no;
      const yesPct = total === 0 ? 0 : Math.round((counts.yes / total) * 100);
      const li = document.createElement("li");
      li.className = "class-row";
      li.innerHTML = `
        <span class="class-row-name">${klass}</span>
        <span class="class-row-bar"><span class="seg seg-yes" style="width:${total === 0 ? 0 : (counts.yes / total) * 100}%"></span><span class="seg seg-mid" style="width:${total === 0 ? 0 : (counts.unsure / total) * 100}%"></span><span class="seg seg-no" style="width:${total === 0 ? 0 : (counts.no / total) * 100}%"></span></span>
        <span class="class-row-meta mono">${joined} liit · ${total === 0 ? "—" : yesPct + "%"}</span>
      `;
      ul.appendChild(li);
    });
  }

  function recordResponse(exerciseId, sessionId, answer) {
    if (!exerciseId || !sessionId) return false;
    if (!state.perStepResponses[exerciseId]) state.perStepResponses[exerciseId] = {};
    const prev = state.perStepResponses[exerciseId][sessionId];
    if (prev === answer) return false; // idempotent — same answer, no change
    state.perStepResponses[exerciseId][sessionId] = answer;
    return true;
  }
  function countsFor(exerciseId) {
    const m = state.perStepResponses[exerciseId] || {};
    const c = { yes: 0, unsure: 0, no: 0 };
    Object.values(m).forEach((a) => { if (c[a] !== undefined) c[a]++; });
    return c;
  }

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

  // Blend three category colors by their proportions so an "unsure-heavy"
  // step is visually distinct from a "no-heavy" step.
  // 100% yes  → green   (46, 204, 113)
  // 100% unsure → amber (241, 196, 15)
  // 100% no   → red    (231, 76, 60)
  function blendCategoryColor(yes, unsure, no, alpha) {
    const total = yes + unsure + no;
    const a = alpha === undefined ? 0.85 : alpha;
    if (total === 0) return "rgba(255,255,255,0.08)";
    const yp = yes / total, up = unsure / total, np = no / total;
    const r = Math.round(46 * yp + 241 * up + 231 * np);
    const g = Math.round(204 * yp + 196 * up + 76 * np);
    const b = Math.round(113 * yp + 15 * up + 60 * np);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function initPolarChart() {
    if (state.polarChart) { try { state.polarChart.destroy(); } catch (e) {} state.polarChart = null; }
    const canvas = $("polar-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    state.polarChart = new Chart(ctx, {
      type: "polarArea",
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: "#000", borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => {
                const exId = state.exerciseOrder[item.dataIndex];
                const c = countsFor(exId);
                const t = c.yes + c.unsure + c.no;
                if (t === 0) return "Pole vastuseid";
                const pct = Math.round((c.yes / t) * 100);
                return `${pct}% sai aru · ${c.yes}/${c.unsure}/${c.no} (jah/kindel-pole/ei)`;
              },
            },
          },
        },
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { color: "#444", backdropColor: "transparent", font: { size: 9 }, stepSize: 25 },
            grid: { color: "rgba(255,255,255,0.08)" },
            angleLines: { color: "rgba(255,255,255,0.08)" },
            pointLabels: { color: "#888", font: { size: 11 } },
          },
        },
      },
    });
  }

  function updatePolarChart() {
    if (!state.polarChart) initPolarChart();
    if (!state.polarChart) return;
    const wrap = $("polar-chart").parentElement;
    const order = state.exerciseOrder;
    if (order.length === 0) {
      wrap.classList.remove("has-data");
      state.polarChart.data.labels = [];
      state.polarChart.data.datasets[0].data = [];
      state.polarChart.data.datasets[0].backgroundColor = [];
      state.polarChart.update();
      return;
    }
    wrap.classList.add("has-data");
    const labels = []; const data = []; const colors = [];
    order.forEach((exId, i) => {
      const c = countsFor(exId);
      const total = c.yes + c.unsure + c.no;
      const yesPct = total === 0 ? 0 : c.yes / total;
      // bar height: % "got it" + a small visible base so empty steps still show
      const value = total === 0 ? 8 : Math.max(12, Math.round(yesPct * 100));
      labels.push(`Etapp ${i + 1}`);
      data.push(value);
      colors.push(blendCategoryColor(c.yes, c.unsure, c.no, 0.82));
    });
    state.polarChart.data.labels = labels;
    state.polarChart.data.datasets[0].data = data;
    state.polarChart.data.datasets[0].backgroundColor = colors;
    state.polarChart.update();
  }

  function trackExercise(id, text) {
    if (!id) return;
    if (state.exerciseOrder.indexOf(id) === -1) {
      state.exerciseOrder.push(id);
      state.exerciseTextById[id] = text;
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
      // Publish target classes + school onto teacher presence so students can pick a class.
      if (state.channel && (state.targetClasses.length > 0 || state.school)) {
        state.channel.updatePresence({
          targetClasses: state.targetClasses,
          school: state.school,
        });
      }
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
    trackExercise(exercise.id, text);
    setCurrentExercise(text);
    resetCounts();
    updateStats();
    updateResponseRate();
    updatePolarChart();
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
    // No single "current" exercise in step-set mode — students vote per step independently.
    state.currentExerciseId = null;
    state.stats.exercises += stepObjects.length;
    state.respondedSessions = new Set();
    stepObjects.forEach((ex) => trackExercise(ex.id, ex.text));
    updatePolarChart();

    setCurrentExercise(`${stepObjects.length} etapi jada · iga õpilane töötab oma tempos · vaata kuumakaarti`);
    resetCounts();
    updateStats();
    updateResponseRate();

    // Broadcast as a single step_set event AND each as an exercise (for back-compat).
    if (state.channel) {
      try {
        if (state.channel.sendStepSet) {
          state.channel.sendStepSet({ stepSetId, steps: stepObjects, ts: Date.now() });
        }
      } catch (e) { console.warn("step_set broadcast failed", e); }
      // Also broadcast each as exercise — proven path; ensures students see something even if step_set fails.
      stepObjects.forEach((ex) => {
        try { state.channel.sendExercise(ex); } catch (e) { console.warn("exercise broadcast failed", e); }
      });
      try {
        state.channel.updatePresence({ currentStepSet: { id: stepSetId, steps: stepObjects } });
      } catch (e) { console.warn("presence update failed", e); }
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
    initPolarChart();
    updatePolarChart();
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
      const classesRaw = ($("classes-input") && $("classes-input").value.trim()) || "";
      const targetClasses = parseClassList(classesRaw);
      const topic = ($("topic-input") && $("topic-input").value.trim()) || null;
      state.school = school;
      state.targetClasses = targetClasses;
      targetClasses.forEach(ensureClassBucket);
      renderClassesCard();
      state.lessonId = await EduNaviDB.createLesson({
        roomCode: code,
        teacherId: state.user ? state.user.id : null,
        school,
        className: targetClasses[0] || null,  // back-compat with single-class column
        topic,
        targetClasses,
      });
    }
    persistActiveLesson();

    state.channel = EduNavi.openRoomChannel(code, "teacher", {
      onResponse: (r) => {
        if (!r || !r.exerciseId || !r.answer) return;
        // Replace-not-add: a session's answer can only count once per step.
        const changed = recordResponse(r.exerciseId, r.sessionId || `anon-${Math.random()}`, r.answer);
        if (!changed) return;
        if (r.sessionId) state.respondedSessions.add(r.sessionId);
        // Pick up the student's class if they sent one
        if (r.sessionId && r.class) {
          state.sessionClass[r.sessionId] = r.class;
          ensureClassBucket(r.class);
        }
        recomputeClassResponses();
        renderClassesCard();
        // Recompute current step's counts from the source of truth
        if (r.exerciseId === state.currentExerciseId) {
          state.counts = countsFor(r.exerciseId);
          updateChart();
        }
        // Lesson-wide stats: total unique responses + yes responses
        state.stats.responses = 0;
        state.stats.yes = 0;
        Object.values(state.perStepResponses).forEach((sessionMap) => {
          Object.values(sessionMap).forEach((ans) => {
            state.stats.responses++;
            if (ans === "yes") state.stats.yes++;
          });
        });
        updateStats();
        updateResponseRate();
        updatePolarChart();
      },
      onPresence: (n, presenceState) => {
        state.studentCount = n;
        $("student-count").textContent = String(n);
        // Rebuild per-class joined sets from authoritative presence state
        const fresh = {};
        if (presenceState) {
          Object.values(presenceState).forEach((arr) => {
            arr.forEach((p) => {
              if (p && p.role === "student" && p.class) {
                if (!fresh[p.class]) fresh[p.class] = new Set();
                // sessionId comes from the channel's presence key prefix; fall back to a stable proxy
                const sid = p.sessionId || p.joinedAt || JSON.stringify(p);
                fresh[p.class].add(sid);
                state.sessionClass[sid] = p.class;
              }
            });
          });
        }
        // Apply: target classes get their fresh set; others stay (could be added)
        state.targetClasses.forEach((c) => {
          state.classSessions[c] = fresh[c] || new Set();
        });
        // Untagged classes that arrived (free-text fallback) — show them too
        Object.keys(fresh).forEach((c) => {
          if (!state.targetClasses.includes(c)) {
            if (!state.classSessions[c]) state.classSessions[c] = new Set();
            state.classSessions[c] = fresh[c];
          }
        });
        recomputeClassResponses();
        renderClassesCard();
        updateResponseRate();
      },
      onComment: (c) => {
        // (handler below)
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

  // Convert the lesson's per-step responses into a roster the /class view
  // can analyse. Yes/unsure/no map to correct/partial/wrong; missing → blank.
  function buildLiveRoster() {
    const exerciseIds = state.exerciseOrder;
    if (exerciseIds.length === 0) return null;

    // Collect every session that ever responded
    const allSessions = new Set();
    exerciseIds.forEach((exId) => {
      const m = state.perStepResponses[exId] || {};
      Object.keys(m).forEach((sid) => allSessions.add(sid));
    });
    if (allSessions.size === 0) return null;

    const ANS_TO_CELL = { yes: "correct", unsure: "partial", no: "wrong" };
    const sessions = Array.from(allSessions);
    const roster = sessions.map((sid, i) => ({
      name: `Õpilane ${i + 1}`,
      sessionId: sid,
      results: exerciseIds.map((exId) => {
        const ans = (state.perStepResponses[exId] || {})[sid];
        return ANS_TO_CELL[ans] || "blank";
      }),
    }));
    const exercises = exerciseIds.map((exId, i) => ({
      id: exId,
      text: state.exerciseTextById[exId] || `Etapp ${i + 1}`,
      skill: "samm",
    }));
    return {
      roster,
      exercises,
      meta: {
        schoolName: "Reaalajas tund",
        className: state.roomCode || "",
        topic: "Live tagasiside",
        lessonDate: new Date().toLocaleDateString("et-EE"),
      },
    };
  }

  function persistLiveRoster() {
    try {
      const r = buildLiveRoster();
      if (r) {
        r.ts = Date.now();
        sessionStorage.setItem("edunavi-live-roster", JSON.stringify(r));
      }
    } catch (e) {}
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
    if (state.polarChart) { try { state.polarChart.destroy(); } catch (e) {} }
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
    // Snapshot the live data so /class can show buckets from this exact lesson.
    persistLiveRoster();
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
