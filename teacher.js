/* teacher.js — teacher dashboard logic */
(function () {
  const $ = (id) => document.getElementById(id);

  let state = {
    roomCode: null,
    lessonId: null,
    channel: null,
    currentExerciseId: null,
    counts: { yes: 0, unsure: 0, no: 0 },
    stats: { exercises: 0, responses: 0, yes: 0 },
    chart: null,
    jitsi: null,
  };

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
    setCurrentExercise(text);
    resetCounts();
    updateStats();
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

  async function startLesson() {
    const code = EduNavi.generateRoomCode();
    state.roomCode = code;

    $("start-screen").style.display = "none";
    $("app").style.display = "flex";

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
    state.lessonId = await EduNaviDB.createLesson({ roomCode: code });

    state.channel = EduNavi.openRoomChannel(code, "teacher", {
      onResponse: (r) => {
        if (!state.currentExerciseId || r.exerciseId === state.currentExerciseId) {
          if (r.answer === "yes") { state.counts.yes++; state.stats.yes++; }
          else if (r.answer === "no") state.counts.no++;
          else if (r.answer === "unsure") state.counts.unsure++;
          state.stats.responses++;
          updateChart();
          updateStats();
        }
      },
      onPresence: (n) => {
        $("student-count").textContent = String(n);
      },
      onStatus: setConnection,
    });
  }

  function endLesson() {
    if (!confirm("Kas lõpetada tund?")) return;
    if (state.lessonId) EduNaviDB.endLesson(state.lessonId);
    if (state.channel) state.channel.close();
    if (state.chart) { try { state.chart.destroy(); } catch (e) {} }
    if (state.jitsi) { try { state.jitsi.dispose(); } catch (e) {} }
    state = {
      roomCode: null,
      lessonId: null,
      channel: null,
      currentExerciseId: null,
      counts: { yes: 0, unsure: 0, no: 0 },
      stats: { exercises: 0, responses: 0, yes: 0 },
      chart: null,
      jitsi: null,
    };
    $("app").style.display = "none";
    $("start-screen").style.display = "grid";
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!EduNavi.isConfigured) EduNavi.showConfigBanner();
    $("start-btn").addEventListener("click", startLesson);
    $("post-btn").addEventListener("click", postExercise);
    $("reset-btn").addEventListener("click", manualReset);
    $("end-btn").addEventListener("click", endLesson);
    $("mic-btn").addEventListener("click", toggleAudio);
    $("cam-btn").addEventListener("click", toggleVideo);
    $("exercise-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        postExercise();
      }
    });
  });
})();
