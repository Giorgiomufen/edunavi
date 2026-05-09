/* db.js — thin wrappers around Supabase Postgres writes for lesson logging */
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

  async function createLesson({ roomCode, topic, teacherId, school, className, targetClasses }) {
    const c = client();
    if (!c) return null;
    const row = {
      room_code: roomCode,
      topic: topic || null,
      teacher_id: teacherId || null,
      school: school || null,
      class_name: className || null,
    };
    if (Array.isArray(targetClasses) && targetClasses.length > 0) {
      row.target_classes = targetClasses;
    }
    const { data, error } = await c
      .from("lessons")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      console.warn("[db] createLesson failed", error);
      return null;
    }
    return data.id;
  }

  async function endLesson(lessonId) {
    const c = client();
    if (!c || !lessonId) return;
    const { error } = await c
      .from("lessons")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", lessonId);
    if (error) console.warn("[db] endLesson failed", error);
  }

  async function logExercise({ lessonId, id, text, parentExerciseId, displayMode }) {
    const c = client();
    if (!c || !lessonId) return null;
    const row = { lesson_id: lessonId, text };
    if (id) row.id = id;
    if (parentExerciseId) row.parent_exercise_id = parentExerciseId;
    if (displayMode) row.display_mode = displayMode;
    const { data, error } = await c
      .from("exercises")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      console.warn("[db] logExercise failed", error);
      return null;
    }
    return data.id;
  }

  // Same shape as logExercise — used by the prep flow at /loo.
  async function createExercise(args) {
    return logExercise(args);
  }

  // For the per-exercise student QR: load one parent exercise, its child steps,
  // and the lesson it belongs to (so we can log responses + join the channel).
  async function findExerciseWithSteps(exerciseId) {
    const c = client();
    if (!c || !exerciseId) return null;
    const { data: parent, error: pErr } = await c
      .from("exercises")
      .select("id, lesson_id, text, parent_exercise_id, display_mode")
      .eq("id", exerciseId)
      .maybeSingle();
    if (pErr || !parent) {
      if (pErr) console.warn("[db] findExerciseWithSteps parent failed", pErr);
      return null;
    }
    const { data: steps, error: sErr } = await c
      .from("exercises")
      .select("id, text, posted_at")
      .eq("parent_exercise_id", parent.id)
      .order("posted_at", { ascending: true });
    if (sErr) console.warn("[db] findExerciseWithSteps children failed", sErr);
    const { data: lesson } = await c
      .from("lessons")
      .select("id, room_code, topic, school, target_classes")
      .eq("id", parent.lesson_id)
      .maybeSingle();
    return {
      parent,
      steps: steps || [],
      lesson: lesson || null,
    };
  }

  async function logResponse({ lessonId, exerciseId, sessionId, answer, className }) {
    const c = client();
    if (!c || !lessonId || !exerciseId) return;
    const row = {
      lesson_id: lessonId,
      exercise_id: exerciseId,
      session_id: sessionId || null,
      answer,
    };
    if (className) row.class_name = className;
    const { error } = await c.from("responses").insert(row);
    if (error) console.warn("[db] logResponse failed", error);
  }

  async function logComment({ lessonId, exerciseId, sessionId, text, className }) {
    const c = client();
    if (!c || !lessonId || !text) return;
    const row = {
      lesson_id: lessonId,
      exercise_id: exerciseId || null,
      session_id: sessionId || null,
      text,
    };
    if (className) row.class_name = className;
    const { error } = await c.from("comments").insert(row);
    if (error) console.warn("[db] logComment failed", error);
  }

  async function logPresence({ lessonId, sessionId, action }) {
    const c = client();
    if (!c || !lessonId || !sessionId) return;
    const { error } = await c
      .from("presence_events")
      .insert({ lesson_id: lessonId, session_id: sessionId, action });
    if (error) console.warn("[db] logPresence failed", error);
  }

  // Looks up the most recent active lesson for a given room code
  // (for student-side: needs lesson_id to log against).
  async function findLessonByRoom(roomCode) {
    const c = client();
    if (!c) return null;
    const { data, error } = await c
      .from("lessons")
      .select("id")
      .eq("room_code", roomCode)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[db] findLessonByRoom failed", error);
      return null;
    }
    return data ? data.id : null;
  }

  function getOrCreateSessionId() {
    let sid = sessionStorage.getItem("edunavi-session");
    if (!sid) {
      sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("edunavi-session", sid);
    }
    return sid;
  }

  window.EduNaviDB = {
    createLesson,
    endLesson,
    logExercise,
    createExercise,
    findExerciseWithSteps,
    logResponse,
    logComment,
    logPresence,
    findLessonByRoom,
    getOrCreateSessionId,
  };
})();
