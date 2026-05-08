/* shared.js — Supabase init + room channel helpers used by teacher and student */
(function () {
  const cfg = window.EDUNAVI_CONFIG || {};

  const isConfigured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT-ID") &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR-ANON-PUBLIC-KEY");

  function showConfigBanner() {
    const el = document.getElementById("config-banner");
    if (el) {
      el.classList.add("show");
      el.textContent =
        "Supabase seadistamata — ava config.js ja sisesta projekti URL ning anon key.";
    } else {
      console.warn(
        "[EduNavi] Supabase not configured. Edit config.js with your project URL and anon key."
      );
    }
  }

  let supabaseClient = null;
  function getClient() {
    if (!isConfigured) {
      showConfigBanner();
      return null;
    }
    if (!supabaseClient) {
      // The Supabase UMD bundle exposes a global `supabase` object.
      supabaseClient = window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY,
        { realtime: { params: { eventsPerSecond: 20 } } }
      );
    }
    return supabaseClient;
  }

  function generateRoomCode() {
    // 4 readable letters, no ambiguous I/O/0/1.
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return s;
  }

  function publicBaseUrl() {
    if (cfg.PUBLIC_BASE_URL) return cfg.PUBLIC_BASE_URL.replace(/\/$/, "");
    // Use the current page origin + path (without filename).
    const u = new URL(window.location.href);
    const pathDir = u.pathname.replace(/[^/]*$/, "");
    return `${u.origin}${pathDir}`.replace(/\/$/, "");
  }

  function studentJoinUrl(roomCode) {
    const base = publicBaseUrl();
    return `${base}/student.html?room=${encodeURIComponent(roomCode)}`;
  }

  function jitsiRoomName(roomCode) {
    const prefix = cfg.JITSI_ROOM_PREFIX || "edunavi-";
    return `${prefix}${roomCode}`;
  }

  function jitsiTeacherUrl(roomCode, displayName) {
    const room = jitsiRoomName(roomCode);
    const params = new URLSearchParams({
      "config.prejoinPageEnabled": "false",
      "config.prejoinConfig.enabled": "false",
      "config.disableDeepLinking": "true",
      "userInfo.displayName": displayName || "Õpetaja",
    });
    return `https://meet.jit.si/${encodeURIComponent(room)}#${params.toString()}`;
  }

  function jitsiStudentUrl(roomCode, displayName) {
    const room = jitsiRoomName(roomCode);
    const params = new URLSearchParams({
      "config.prejoinPageEnabled": "false",
      "config.prejoinConfig.enabled": "false",
      "config.startWithAudioMuted": "true",
      "config.startWithVideoMuted": "true",
      "config.disableDeepLinking": "true",
      "userInfo.displayName": displayName || "Õpilane",
    });
    return `https://meet.jit.si/${encodeURIComponent(room)}#${params.toString()}`;
  }

  /**
   * Open a realtime channel for a room. Returns:
   *   { channel, sendExercise, sendResponse, close }
   * Handlers:
   *   onExercise({id, text, ts})       — student usage
   *   onResponse({exerciseId, answer}) — teacher usage
   *   onPresence(count)                — both: number of joined sockets
   *   onStatus(status)                 — "SUBSCRIBED" | "CHANNEL_ERROR" | etc.
   */
  function findTeacherState(presenceState) {
    for (const arr of Object.values(presenceState || {})) {
      for (const p of arr) {
        if (p && p.role === "teacher") return p;
      }
    }
    return null;
  }

  function openRoomChannel(roomCode, role, handlers = {}) {
    const client = getClient();
    if (!client) return null;

    const channelName = `room:${roomCode}`;
    const channel = client.channel(channelName, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: `${role}-${Math.random().toString(36).slice(2, 9)}` },
      },
    });

    let currentTrack = { role, joinedAt: Date.now() };

    channel.on("broadcast", { event: "exercise" }, (payload) => {
      handlers.onExercise && handlers.onExercise(payload.payload);
    });
    channel.on("broadcast", { event: "response" }, (payload) => {
      handlers.onResponse && handlers.onResponse(payload.payload);
    });
    channel.on("broadcast", { event: "reset" }, (payload) => {
      handlers.onReset && handlers.onReset(payload.payload || {});
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      let students = 0;
      Object.values(state).forEach((arr) => {
        arr.forEach((p) => {
          if (p.role === "student") students++;
        });
      });
      const teacherState = findTeacherState(state);
      handlers.onPresence && handlers.onPresence(students, state, teacherState);
    });

    channel.subscribe(async (status) => {
      handlers.onStatus && handlers.onStatus(status);
      if (status === "SUBSCRIBED") {
        await channel.track(currentTrack);
      }
    });

    return {
      channel,
      sendExercise: (exercise) =>
        channel.send({ type: "broadcast", event: "exercise", payload: exercise }),
      sendResponse: (response) =>
        channel.send({ type: "broadcast", event: "response", payload: response }),
      sendReset: (data = {}) =>
        channel.send({ type: "broadcast", event: "reset", payload: data }),
      updatePresence: async (extra) => {
        currentTrack = { ...currentTrack, ...extra };
        return channel.track(currentTrack);
      },
      close: () => client.removeChannel(channel),
    };
  }

  function newExerciseId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    // Fallback: RFC4122-ish v4
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  window.EduNavi = {
    isConfigured,
    generateRoomCode,
    publicBaseUrl,
    studentJoinUrl,
    jitsiTeacherUrl,
    jitsiStudentUrl,
    openRoomChannel,
    newExerciseId,
    showConfigBanner,
  };
})();
