/* student.js — student page logic */
(function () {
  const $ = (id) => document.getElementById(id);

  let state = {
    roomCode: null,
    channel: null,
    currentExerciseId: null,
    answered: false,
    jitsi: null,
  };

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
        disableProfile: true,
        readOnlyName: true,
        toolbarButtons: ["microphone", "camera", "fullscreen", "hangup"],
        notifications: [],
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
        TOOLBAR_BUTTONS: ["microphone", "camera", "fullscreen", "hangup"],
        DISABLE_PRESENCE_STATUS: true,
        DISABLE_FOCUS_INDICATOR: true,
        HIDE_DEEP_LINKING_LOGO: true,
      },
    });
  }

  function getRoomFromUrl() {
    const u = new URL(window.location.href);
    const room = (u.searchParams.get("room") || "").toUpperCase().trim();
    return /^[A-Z]{4}$/.test(room) ? room : null;
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
      text.textContent = "ühendamine…";
    }
  }

  function setExercise(text) {
    const box = $("exercise-box");
    if (text && text.trim()) {
      box.textContent = text;
      box.classList.remove("empty");
    } else {
      box.textContent = "Oota — õpetaja postitab kohe ülesande…";
      box.classList.add("empty");
    }
  }

  function enableButtons(enabled) {
    document.querySelectorAll(".student-buttons button").forEach((b) => {
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
        ts: Date.now(),
      });
    }
  }

  function joinRoom(code) {
    state.roomCode = code;
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

    function applyExercise(ex) {
      if (!ex || !ex.id) return;
      if (state.currentExerciseId === ex.id) return; // already showing this one
      state.currentExerciseId = ex.id;
      state.answered = false;
      setExercise(ex.text);
      enableButtons(true);
      setStatus("");
    }

    state.channel = EduNavi.openRoomChannel(code, "student", {
      onExercise: applyExercise,
      onReset: () => {
        state.answered = false;
        enableButtons(!!state.currentExerciseId);
        setStatus("");
      },
      onPresence: (_count, _state, teacherState) => {
        // Late-joiner sync: pull the current exercise from the teacher's presence.
        if (teacherState && teacherState.currentExercise) {
          applyExercise(teacherState.currentExercise);
        }
      },
      onStatus: setConnection,
    });
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

    const room = getRoomFromUrl();
    if (room) {
      joinRoom(room);
    } else {
      showJoinScreen();
    }
  });
})();
