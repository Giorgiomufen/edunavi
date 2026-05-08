/* history.js — Mine tunnid: show past lessons for the signed-in teacher */
(function () {
  const $ = (id) => document.getElementById(id);

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

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("et-EE", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function fmtDuration(start, end) {
    if (!end) return "kestab";
    const ms = new Date(end) - new Date(start);
    if (ms < 0 || isNaN(ms)) return "—";
    const min = Math.round(ms / 60000);
    if (min < 1) return "<1 min";
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return `${h}h ${min % 60}m`;
  }

  function showOnly(id) {
    ["history-loading", "history-empty", "history-needauth", "history-list"].forEach((e) => {
      const el = $(e);
      if (el) el.style.display = e === id ? "block" : "none";
    });
  }

  function renderLessons(rows) {
    if (!rows || rows.length === 0) {
      showOnly("history-empty");
      return;
    }
    const list = $("history-list");
    list.innerHTML = "";
    rows.forEach((row) => {
      const total = row.responses.length;
      const yes = row.responses.filter((r) => r.answer === "yes").length;
      const unsure = row.responses.filter((r) => r.answer === "unsure").length;
      const no = row.responses.filter((r) => r.answer === "no").length;
      const pct = total > 0 ? Math.round((yes / total) * 100) : null;
      const card = document.createElement("article");
      card.className = "history-card";
      card.innerHTML = `
        <div class="history-card-head">
          <div>
            <div class="history-room">${row.room_code}</div>
            <div class="history-when">${fmtDateTime(row.created_at)} · kestus ${fmtDuration(row.created_at, row.ended_at)}</div>
          </div>
          <div class="history-pct">${pct === null ? "—" : pct + "%"}</div>
        </div>
        <div class="history-card-grid">
          <div class="history-stat"><span class="num">${row.exercises.length}</span><span class="label">Ülesandeid</span></div>
          <div class="history-stat"><span class="num">${total}</span><span class="label">Vastuseid</span></div>
          <div class="history-stat yes"><span class="num">${yes}</span><span class="label">Sain aru</span></div>
          <div class="history-stat maybe"><span class="num">${unsure}</span><span class="label">Pole kindel</span></div>
          <div class="history-stat no"><span class="num">${no}</span><span class="label">Ei saanud</span></div>
        </div>
        ${row.exercises.length === 0 ? "" : `
          <details class="history-details">
            <summary>Ülesanded</summary>
            <ol class="history-exercise-list">
              ${row.exercises.map((e) => `<li>${escapeHtml(e.text)}</li>`).join("")}
            </ol>
          </details>
        `}
      `;
      list.appendChild(card);
    });
    showOnly("history-list");
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  async function load() {
    const c = client();
    if (!c) {
      showOnly("history-needauth");
      return;
    }
    const user = await EduNaviAuth.getUser();
    if (!user) {
      showOnly("history-needauth");
      return;
    }
    $("user-email").textContent = user.email || "";

    // 1) lessons for this teacher
    const { data: lessons, error: lessonsErr } = await c
      .from("lessons")
      .select("id, room_code, topic, created_at, ended_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (lessonsErr) {
      console.error(lessonsErr);
      showOnly("history-empty");
      return;
    }
    if (!lessons || lessons.length === 0) {
      showOnly("history-empty");
      return;
    }
    const ids = lessons.map((l) => l.id);

    // 2) exercises for those lessons
    const { data: exercises } = await c
      .from("exercises")
      .select("id, lesson_id, text, posted_at")
      .in("lesson_id", ids)
      .order("posted_at", { ascending: true });

    // 3) responses for those lessons
    const { data: responses } = await c
      .from("responses")
      .select("id, lesson_id, answer")
      .in("lesson_id", ids);

    // Group by lesson
    const exByLesson = {};
    (exercises || []).forEach((e) => {
      (exByLesson[e.lesson_id] = exByLesson[e.lesson_id] || []).push(e);
    });
    const respByLesson = {};
    (responses || []).forEach((r) => {
      (respByLesson[r.lesson_id] = respByLesson[r.lesson_id] || []).push(r);
    });

    const enriched = lessons.map((l) => ({
      ...l,
      exercises: exByLesson[l.id] || [],
      responses: respByLesson[l.id] || [],
    }));
    renderLessons(enriched);
  }

  document.addEventListener("DOMContentLoaded", load);
})();
