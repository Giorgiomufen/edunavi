/* history.js — Minu tunnid: show past lessons for the signed-in teacher */
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

  function blendCategoryColor(yes, unsure, no, alpha) {
    const a = alpha === undefined ? 0.85 : alpha;
    const total = yes + unsure + no;
    if (total === 0) return `rgba(148, 163, 184, ${a})`;
    const yp = yes / total, up = unsure / total, np = no / total;
    const r = Math.round(34 * yp + 250 * up + 239 * np);
    const g = Math.round(197 * yp + 204 * up + 68 * np);
    const b = Math.round(94 * yp + 21 * up + 68 * np);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function perExerciseCounts(exercises, responses) {
    // Dedupe by (exercise, session) so a switched answer counts once.
    const dedup = new Map();
    (responses || []).forEach((r) => {
      const key = `${r.exercise_id}::${r.session_id || "anon-" + Math.random()}`;
      dedup.set(key, { exId: r.exercise_id, ans: r.answer });
    });
    const counts = {};
    dedup.forEach(({ exId, ans }) => {
      if (!counts[exId]) counts[exId] = { yes: 0, unsure: 0, no: 0 };
      if (counts[exId][ans] !== undefined) counts[exId][ans]++;
    });
    return exercises.map((ex) => ({
      id: ex.id,
      text: ex.text,
      ...(counts[ex.id] || { yes: 0, unsure: 0, no: 0 }),
    }));
  }

  function drawMiniPolar(canvas, perEx) {
    if (!canvas || !window.Chart) return;
    if (perEx.length === 0) return;
    const labels = perEx.map((_, i) => `${i + 1}`);
    const data = perEx.map((p) => {
      const total = p.yes + p.unsure + p.no;
      if (total === 0) return 8;
      return Math.max(15, Math.round((p.yes / total) * 100));
    });
    const colors = perEx.map((p) => blendCategoryColor(p.yes, p.unsure, p.no, 0.82));
    new Chart(canvas.getContext("2d"), {
      type: "polarArea",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: "#FFFFFF", borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { display: false },
            grid: { color: "rgba(15, 23, 42, 0.06)" },
            angleLines: { color: "rgba(15, 23, 42, 0.06)" },
            pointLabels: { display: false },
          },
        },
      },
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
      // Aggregate counts after deduping per (exercise, session)
      const perEx = perExerciseCounts(row.exercises, row.responses);
      const yes = perEx.reduce((s, p) => s + p.yes, 0);
      const unsure = perEx.reduce((s, p) => s + p.unsure, 0);
      const no = perEx.reduce((s, p) => s + p.no, 0);
      const total = yes + unsure + no;
      const pct = total > 0 ? Math.round((yes / total) * 100) : null;

      const card = document.createElement("article");
      card.className = "history-card";
      const canvasId = `polar-mini-${row.id}`;
      card.innerHTML = `
        <a href="/lesson?id=${encodeURIComponent(row.id)}" class="history-card-link" title="Ava tunni statistika">
          <div class="history-card-main">
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
              <div class="history-stat maybe"><span class="num">${unsure}</span><span class="label">TI aitas</span></div>
              <div class="history-stat no"><span class="num">${no}</span><span class="label">Jäi kinni</span></div>
            </div>
          </div>
          <div class="history-card-polar">
            <canvas id="${canvasId}"></canvas>
            ${total === 0 ? '<div class="history-polar-empty">Pole vastuseid</div>' : ""}
          </div>
        </a>
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
      // Defer chart draw so DOM is connected
      requestAnimationFrame(() => drawMiniPolar(document.getElementById(canvasId), perEx));
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

    // 3) responses for those lessons (include exercise_id + session_id so we can
    //    dedupe per (exercise, session) and compute per-exercise breakdowns).
    const { data: responses } = await c
      .from("responses")
      .select("id, lesson_id, exercise_id, session_id, answer")
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
