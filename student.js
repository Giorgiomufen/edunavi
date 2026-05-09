/* student.js — student page logic */
(function () {
  const $ = (id) => document.getElementById(id);

  let state = {
    roomCode: null,
    lessonId: null,
    sessionId: null,
    channel: null,
    currentExerciseId: null,
    answered: false,
    jitsi: null,
    activeStepSet: null,
    perStepAnswers: {},
    lessonEnded: false,
    chosenClass: null,        // student's picked class — included in every response/presence
    offeredClasses: [],       // populated from teacher presence target_classes
  };

  function renderClassPicker(classes) {
    const wrap = $("class-picker");
    if (!wrap) return;
    if (!classes || classes.length === 0) {
      wrap.style.display = "none";
      return;
    }
    if (state.chosenClass) {
      wrap.style.display = "none";
      return;
    }
    state.offeredClasses = classes;
    const opts = $("class-picker-options");
    opts.innerHTML = "";
    classes.forEach((klass) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "class-pick-btn";
      b.textContent = klass;
      b.addEventListener("click", () => pickClass(klass));
      opts.appendChild(b);
    });
    wrap.style.display = "block";
    // Hide voting until a class is chosen
    enableButtons(false);
  }

  function pickClass(klass) {
    state.chosenClass = klass;
    $("class-picker").style.display = "none";
    if (state.channel && state.channel.updatePresence) {
      state.channel.updatePresence({ class: klass, sessionId: state.sessionId });
    }
    if (state.currentExerciseId) enableButtons(true);
    setStatus(`Klass: ${klass}`, true);
  }

  function startJitsi(roomCode) {
    if (!window.JitsiMeetExternalAPI) return;
    if (state.jitsi) { try { state.jitsi.dispose(); } catch (e) {} }
    const roomName = (window.EDUNAVI_CONFIG.JITSI_ROOM_PREFIX || "edunavi-") + roomCode;
    const container = $("jitsi-container");
    container.innerHTML = "";
    state.jitsi = new JitsiMeetExternalAPI("meet.jit.si", {
      roomName,
      parentNode: container,
      width: "100%",
      height: "100%",
      userInfo: { displayName: "Õpilane" },
      configOverwrite: {
        prejoinPageEnabled: false,
        prejoinConfig: { enabled: false },
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        disableDeepLinking: true,
        disableInviteFunctions: true,
        disableThirdPartyRequests: true,
        hideConferenceSubject: true,
        hideConferenceTimer: true,
        hideParticipantsStats: true,
        disableProfile: true,
        readOnlyName: true,
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
        TOOLBAR_BUTTONS: [],
        DISABLE_PRESENCE_STATUS: true,
        DISABLE_FOCUS_INDICATOR: true,
        HIDE_DEEP_LINKING_LOGO: true,
        DISABLE_DOMINANT_SPEAKER_INDICATOR: true,
        DISABLE_TRANSCRIPTION_SUBTITLES: true,
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        SHOW_DEEP_LINKING_IMAGE: false,
      },
    });
  }

  function getRoomFromUrl() {
    const u = new URL(window.location.href);
    const room = (u.searchParams.get("room") || "").toUpperCase().trim();
    return /^[A-Z]{4}$/.test(room) ? room : null;
  }
  function getExerciseFromUrl() {
    const u = new URL(window.location.href);
    const ex = (u.searchParams.get("ex") || "").trim();
    return /^[0-9a-f-]{8,}$/i.test(ex) ? ex : null;
  }

  function setConnection(status) {
    const pill = $("conn-pill");
    const text = $("conn-text");
    pill.classList.remove("live");
    if (status === "SUBSCRIBED" && !state.lessonEnded) {
      pill.classList.add("live");
      text.textContent = "Eetris";
    } else if (status === "ENDED" || state.lessonEnded) {
      text.textContent = "Tund lõppenud";
    } else if (status === "DEMO_MODE") {
      text.textContent = "Demo režiim";
    } else if (status === "CHANNEL_ERROR") {
      text.textContent = "Ühenduse viga";
    } else {
      text.textContent = "ühendamine…";
    }
  }

  function setExercise(text) {
    const box = $("single-exercise-box");
    if (!box) return;
    if (text && text.trim()) {
      box.textContent = text;
      box.classList.remove("empty");
    } else {
      box.textContent = "Oota — õpetaja postitab kohe ülesande…";
      box.classList.add("empty");
    }
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function showStepSetMode() {
    const single = $("single-exercise-box");
    const lbl = $("single-answer-label");
    const sb = $("single-buttons");
    if (single) single.style.display = "none";
    if (lbl) lbl.style.display = "none";
    if (sb) sb.style.display = "none";
    $("steps-container").style.display = "block";
  }

  function showSingleMode() {
    const single = $("single-exercise-box");
    const lbl = $("single-answer-label");
    const sb = $("single-buttons");
    if (single) single.style.display = "";
    if (lbl) lbl.style.display = "";
    if (sb) sb.style.display = "";
    $("steps-container").style.display = "none";
  }

  function renderStudentSteps(steps) {
    const list = $("student-steps-list");
    list.innerHTML = "";
    steps.forEach((step) => {
      const li = document.createElement("li");
      li.className = "student-step";
      li.dataset.stepId = step.id;
      li.innerHTML = `
        <div class="student-step-text">${escapeHtml(step.text)}</div>
        <div class="student-step-buttons">
          <button data-answer="no">Ei saanud aru üldse</button>
          <button data-answer="unsure">Sain aru, aga TI aitas</button>
        </div>
      `;
      li.querySelectorAll("button").forEach((b) => {
        b.addEventListener("click", () => answerStep(step.id, b.getAttribute("data-answer"), li));
      });
      list.appendChild(li);
    });
  }

  function answerStep(exerciseId, answer, li) {
    // Idempotent: clicking same button twice is a no-op
    if (state.perStepAnswers[exerciseId] === answer) return;
    state.perStepAnswers[exerciseId] = answer;
    li.classList.remove("a-yes", "a-no", "a-unsure");
    li.classList.add("answered", `a-${answer}`);
    if (state.channel) {
      state.channel.sendResponse({
        exerciseId, answer,
        sessionId: state.sessionId,
        class: state.chosenClass || null,
        ts: Date.now(),
      });
    }
    if (state.lessonId) {
      EduNaviDB.logResponse({
        lessonId: state.lessonId,
        exerciseId,
        sessionId: state.sessionId,
        answer,
        className: state.chosenClass || null,
      });
    }
  }

  // FR-13 — Teema-režiim: ainult teemanimed kuvatud, üks ühik valik
  // ("kus jäid kinni?"). Klikiga märgib selle teema 'no' või 'unsure'.
  function renderThemeMode(parentId, steps) {
    const single = $("single-exercise-box");
    const lbl = $("single-answer-label");
    const sb = $("single-buttons");
    if (single) single.style.display = "";
    if (lbl) {
      lbl.style.display = "";
      lbl.textContent = "Kui jäid kinni, märgi mille juures:";
    }
    if (sb) sb.style.display = "none";
    const stepsContainer = $("steps-container");
    stepsContainer.style.display = "block";
    const list = $("student-steps-list");
    list.innerHTML = "";
    steps.forEach((step) => {
      const li = document.createElement("li");
      li.className = "student-step student-theme-row";
      li.dataset.stepId = step.id;
      li.innerHTML = `
        <button class="theme-pick-btn" data-answer="no">${escapeHtml(step.text)}</button>
      `;
      li.querySelector("button").addEventListener("click", () => answerStep(step.id, "no", li));
      list.appendChild(li);
    });
    // Lisa "Sain hakkama kõigega" üldine nupp
    const okLi = document.createElement("li");
    okLi.className = "student-step student-theme-ok";
    okLi.innerHTML = `<button class="theme-ok-btn">Sain hakkama kõigega</button>`;
    okLi.querySelector("button").addEventListener("click", () => {
      // Märgi 'yes' iga teemale (tähendab: said hakkama)
      steps.forEach((step) => {
        const dummyLi = document.createElement("li");
        answerStep(step.id, "yes", dummyLi);
      });
      setStatus("Aitäh — märgitud kõik kui hakkama saanud.", true);
      list.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    });
    list.appendChild(okLi);
  }

  function applyStepSet(set) {
    if (!set || !set.steps || set.steps.length === 0) return;
    if (state.activeStepSet && state.activeStepSet.id === set.id) return;
    state.activeStepSet = set;
    state.perStepAnswers = {};
    showStepSetMode();
    renderStudentSteps(set.steps);
    setStatus("");
  }

  function enableButtons(enabled) {
    document.querySelectorAll(".student-buttons button").forEach((b) => {
      b.disabled = !enabled;
    });
    // Step-mode buttons too (?ex= flow) — block answers until class is picked
    document.querySelectorAll(".student-step-buttons button").forEach((b) => {
      b.disabled = !enabled;
    });
  }

  function setStatus(text, ok) {
    const el = $("status-line");
    el.textContent = text || "";
    el.classList.toggle("ok", !!ok);
  }

  function sendAnswer(answer) {
    if (state.answered) return;
    state.answered = true;
    enableButtons(false);
    setStatus("Vastus saadetud", true);
    if (state.channel && state.currentExerciseId) {
      state.channel.sendResponse({
        exerciseId: state.currentExerciseId,
        answer,
        sessionId: state.sessionId,
        class: state.chosenClass || null,
        ts: Date.now(),
      });
    }
    if (state.lessonId && state.currentExerciseId) {
      EduNaviDB.logResponse({
        lessonId: state.lessonId,
        exerciseId: state.currentExerciseId,
        sessionId: state.sessionId,
        answer,
        className: state.chosenClass || null,
      });
    }
  }

  async function joinRoom(code) {
    state.roomCode = code;
    state.sessionId = EduNaviDB && EduNaviDB.getOrCreateSessionId
      ? EduNaviDB.getOrCreateSessionId()
      : null;
    $("join-screen").style.display = "none";
    $("lesson-view").style.display = "block";
    $("room-label").textContent = `tuba ${code}`;

    startJitsi(code);

    if (!EduNavi.isConfigured) {
      EduNavi.showConfigBanner();
      setConnection("DEMO_MODE");
      enableButtons(true);
      setExercise("Demo: õpetaja postitab ülesande siia.");
      return;
    }

    // Look up lesson_id so we can persist responses + presence.
    state.lessonId = await EduNaviDB.findLessonByRoom(code);
    if (state.lessonId && state.sessionId) {
      EduNaviDB.logPresence({
        lessonId: state.lessonId,
        sessionId: state.sessionId,
        action: "join",
      });
    }

    function applyExercise(ex) {
      if (!ex || !ex.id) return;
      if (state.activeStepSet && state.activeStepSet.steps.some((s) => s.id === ex.id)) return;
      if (state.activeStepSet) {
        state.activeStepSet = null;
        state.perStepAnswers = {};
        showSingleMode();
      }
      if (state.currentExerciseId === ex.id) return;
      state.currentExerciseId = ex.id;
      state.answered = false;
      setExercise(ex.text);
      // Only enable voting if no class picker is pending (or class already chosen)
      const needsClass = state.offeredClasses.length > 0 && !state.chosenClass;
      enableButtons(!needsClass);
      setStatus("");
    }

    state.channel = EduNavi.openRoomChannel(code, "student", {
      onExercise: applyExercise,
      onStepSet: applyStepSet,
      onReset: () => {
        state.answered = false;
        enableButtons(!!state.currentExerciseId);
        setStatus("");
      },
      onPresence: (_count, _state, teacherState) => {
        // Surface the class picker if teacher published target classes
        if (teacherState && Array.isArray(teacherState.targetClasses) && teacherState.targetClasses.length > 0) {
          if (!state.chosenClass) renderClassPicker(teacherState.targetClasses);
        }
        // Late-joiner sync: pull current exercise OR step set from teacher's presence.
        if (teacherState && teacherState.currentStepSet) {
          applyStepSet(teacherState.currentStepSet);
        } else if (teacherState && teacherState.currentExercise) {
          applyExercise(teacherState.currentExercise);
        }
      },
      onLessonEnd: () => {
        state.lessonEnded = true;
        enableButtons(false);
        setExercise("Õpetaja lõpetas tunni.");
        setStatus("Tund on lõppenud — võid sulgeda.", false);
        setConnection("ENDED");
        if (state.channel) { try { state.channel.close(); } catch (e) {} state.channel = null; }
        if (state.jitsi) { try { state.jitsi.dispose(); } catch (e) {} state.jitsi = null; }
      },
      onStatus: setConnection,
    });
  }

  // Per-exercise QR mode: /student?ex=<exerciseId>
  // No realtime channel — load problem + steps from DB, render as a step set,
  // log responses directly to Supabase. Teacher reviews async at /lesson?id=...
  async function joinByExercise(exerciseId) {
    state.sessionId = EduNaviDB && EduNaviDB.getOrCreateSessionId
      ? EduNaviDB.getOrCreateSessionId()
      : null;
    $("join-screen").style.display = "none";
    $("lesson-view").style.display = "block";

    if (!EduNavi.isConfigured) {
      EduNavi.showConfigBanner();
      setConnection("DEMO_MODE");
      setExercise("Demo režiim — Supabase pole seadistatud.");
      return;
    }

    const bundle = await EduNaviDB.findExerciseWithSteps(exerciseId);
    if (!bundle || !bundle.parent) {
      setExercise("Ülesannet ei leitud. Palu õpetajalt uut linki.");
      setConnection("CHANNEL_ERROR");
      return;
    }

    state.lessonId = bundle.parent.lesson_id;
    state.roomCode = bundle.lesson ? bundle.lesson.room_code : null;
    state.currentExerciseId = bundle.parent.id;

    const roomLabel = $("room-label");
    if (roomLabel) {
      const topic = bundle.lesson && bundle.lesson.topic;
      roomLabel.textContent = topic ? topic : "Ülesanne";
    }

    if (state.lessonId && state.sessionId) {
      EduNaviDB.logPresence({
        lessonId: state.lessonId,
        sessionId: state.sessionId,
        action: "join",
      });
    }

    // Render the parent problem text.
    setExercise(bundle.parent.text);

    // FR-13/14 — branch on display_mode set by the teacher in /loo
    const mode = bundle.parent.display_mode || "full";

    if (mode === "blind" || !bundle.steps || bundle.steps.length === 0) {
      // Pime tagasiside — õpilane ei näe teemasid ette. Üks valik kogu ülesande kohta.
      showSingleMode();
      enableButtons(true);
    } else if (mode === "theme") {
      // Teema-režiim — õpilane näeb teemade nimesid, valib kus jäi kinni.
      renderThemeMode(bundle.parent.id, bundle.steps);
    } else {
      // Täisrežiim — senine käitumine.
      applyStepSet({
        id: bundle.parent.id,
        steps: bundle.steps.map((s) => ({ id: s.id, text: s.text })),
      });
    }

    // Class picker if lesson has target_classes
    if (bundle.lesson && Array.isArray(bundle.lesson.target_classes) && bundle.lesson.target_classes.length > 0) {
      renderClassPicker(bundle.lesson.target_classes);
    }

    setConnection("SUBSCRIBED");
  }

  function showJoinScreen() {
    $("join-screen").style.display = "grid";
    $("lesson-view").style.display = "none";
    const input = $("join-input");
    input.focus();
    input.addEventListener("input", () => {
      input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "");
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        attemptJoin();
      }
    });
    $("join-btn").addEventListener("click", attemptJoin);
  }

  function attemptJoin() {
    const code = $("join-input").value.toUpperCase().trim();
    if (!/^[A-Z]{4}$/.test(code)) {
      $("join-input").focus();
      return;
    }
    const u = new URL(window.location.href);
    u.searchParams.set("room", code);
    history.replaceState({}, "", u.toString());
    joinRoom(code);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!EduNavi.isConfigured) EduNavi.showConfigBanner();

    document.querySelectorAll(".student-buttons button").forEach((b) => {
      b.addEventListener("click", () => sendAnswer(b.getAttribute("data-answer")));
    });

    const commentBtn = document.getElementById("comment-send-btn");
    if (commentBtn) commentBtn.addEventListener("click", () => {
      const ta = document.getElementById("comment-input");
      const text = ta.value.trim();
      if (!text) return;
      // Realtime room mode (legacy) — still broadcast on channel
      if (state.channel && state.channel.sendComment) {
        state.channel.sendComment({
          text,
          sessionId: state.sessionId,
          exerciseId: state.currentExerciseId,
          ts: Date.now(),
        });
      }
      // FR-22 / FR-27 — persist to comments table for the dashboard
      if (state.lessonId && EduNaviDB && EduNaviDB.logComment) {
        EduNaviDB.logComment({
          lessonId: state.lessonId,
          exerciseId: state.currentExerciseId || null,
          sessionId: state.sessionId,
          text,
          className: state.chosenClass || null,
        });
      }
      ta.value = "";
      setStatus("Kommentaar saadetud", true);
    });

    const exerciseId = getExerciseFromUrl();
    const room = getRoomFromUrl();
    if (exerciseId) {
      joinByExercise(exerciseId);
    } else if (room) {
      joinRoom(room);
    } else {
      showJoinScreen();
    }

    // Best-effort leave log — runs when the tab is closed or hidden.
    // fetch with keepalive lets the request complete during unload AND lets us
    // set the apikey/Authorization headers that Supabase requires.
    function logLeave() {
      if (!state.lessonId || !state.sessionId) return;
      const cfg = window.EDUNAVI_CONFIG;
      try {
        fetch(`${cfg.SUPABASE_URL}/rest/v1/presence_events`, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: cfg.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            lesson_id: state.lessonId,
            session_id: state.sessionId,
            action: "leave",
          }),
        });
      } catch (e) { /* ignore */ }
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") logLeave();
    });
    window.addEventListener("pagehide", logLeave);
  });
})();
