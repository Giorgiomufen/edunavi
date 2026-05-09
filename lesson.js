/* lesson.js — post-lesson statistics view at /lesson?id=<lessonId>.
 * Shows the radial "rõngas" chart over each exercise of a saved lesson,
 * pulling exercises + responses from Supabase.
 */
(function () {
  const $ = (id) => document.getElementById(id);

  function client() {
    if (!window.EduNavi || !window.EduNavi.isConfigured) return null;
    if (!window.supabase) return null;
    if (!window._edunaviSb) {
      const cfg = window.EDUNAVI_CONFIG;
      window._edunaviSb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
    return window._edunaviSb;
  }

  function getLessonId() {
    const u = new URL(window.location.href);
    return u.searchParams.get("id") || u.searchParams.get("lessonId");
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("et-EE", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
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

  function buildHeadline(perExercise) {
    if (perExercise.length === 0) {
      return { headline: "Tunnis ei postitatud ühtegi etappi.", detail: "" };
    }
    const struggleSorted = [...perExercise].sort((a, b) => (b.no + b.unsure) - (a.no + a.unsure));
    const worst = struggleSorted[0];
    const totalResponses = perExercise.reduce((s, p) => s + p.yes + p.unsure + p.no, 0);
    if (totalResponses === 0) {
      return {
        headline: "Õpilased ei vastanud ühelegi etapile.",
        detail: "Tagasisidet ei tulnud — vaata, kas õpilased said lingile ligi ja kas etapid olid arusaadavad.",
      };
    }
    const struggleRatio = (worst.no + worst.unsure) / Math.max(1, worst.yes + worst.unsure + worst.no);
    if (struggleRatio >= 0.5) {
      return {
        headline: `Suurim raskuskoht: "${worst.text}".`,
        detail: `${Math.round(struggleRatio * 100)}% sellele etapile vastanutest jäi kinni või vajas TI abi. Soovitatav on järgmise tunni alguses see uuesti läbi võtta.`,
      };
    }
    return {
      headline: `Klass tuli enamiku etappidega toime.`,
      detail: `Kõige rohkem kahtlust oli etapis "${worst.text}". Võid liikuda järgmise teema juurde, jälgides üksikute õpilaste edenemist.`,
    };
  }

  async function load() {
    const lessonId = getLessonId();
    if (!lessonId) {
      $("lesson-loading").style.display = "none";
      $("lesson-empty").style.display = "block";
      return;
    }
    const c = client();
    if (!c) {
      $("lesson-loading").style.display = "none";
      $("lesson-empty").style.display = "block";
      return;
    }

    // Lesson row
    const { data: lesson, error: lessonErr } = await c
      .from("lessons")
      .select("id, room_code, topic, school, class_name, target_classes, created_at, ended_at")
      .eq("id", lessonId)
      .maybeSingle();
    if (lessonErr || !lesson) {
      console.warn("lesson load failed", lessonErr);
      $("lesson-loading").style.display = "none";
      $("lesson-empty").style.display = "block";
      return;
    }

    // Exercises in this lesson
    const { data: exercises } = await c
      .from("exercises")
      .select("id, text, posted_at")
      .eq("lesson_id", lessonId)
      .order("posted_at", { ascending: true });

    // All responses
    const { data: responses } = await c
      .from("responses")
      .select("exercise_id, answer, session_id")
      .eq("lesson_id", lessonId);

    // Aggregate per-exercise — uses session_id to dedupe (last answer per session wins)
    const dedup = new Map();   // key: exId+sid → answer
    (responses || []).forEach((r) => {
      const key = `${r.exercise_id}::${r.session_id || "anon-" + Math.random()}`;
      dedup.set(key, { exId: r.exercise_id, ans: r.answer });
    });
    const counts = {};
    dedup.forEach(({ exId, ans }) => {
      if (!counts[exId]) counts[exId] = { yes: 0, unsure: 0, no: 0 };
      if (counts[exId][ans] !== undefined) counts[exId][ans]++;
    });

    const perExercise = (exercises || []).map((ex, i) => ({
      id: ex.id,
      text: ex.text,
      posted_at: ex.posted_at,
      ...counts[ex.id] || { yes: 0, unsure: 0, no: 0 },
      idx: i,
    }));

    // Header meta
    $("lesson-room").textContent = `Tuba ${lesson.room_code}`;
    $("lesson-when").textContent = fmtDateTime(lesson.created_at);
    $("lesson-topic").textContent = lesson.topic ? `Teema: ${lesson.topic}` : "";

    // Headline + detail
    const head = buildHeadline(perExercise);
    $("lesson-headline").textContent = head.headline;
    $("lesson-detail").textContent = head.detail;

    // Polar / rõngas chart
    drawPolar(perExercise);

    // Steps list
    drawStepsList(perExercise);

    $("lesson-loading").style.display = "none";
    $("lesson-body").style.display = "flex";
  }

  function drawPolar(perExercise) {
    const ctx = $("lesson-polar").getContext("2d");
    if (perExercise.length === 0) return;
    const labels = perExercise.map((p, i) => `Etapp ${i + 1}`);
    const data = perExercise.map((p) => {
      const total = p.yes + p.unsure + p.no;
      if (total === 0) return 8; // small visible base
      // wedge size grows with attention needed (% who responded with anything)
      // OR with success — going with success here for the "good = bigger" story
      return Math.max(15, Math.round((p.yes / total) * 100));
    });
    const colors = perExercise.map((p) => blendCategoryColor(p.yes, p.unsure, p.no, 0.82));

    new Chart(ctx, {
      type: "polarArea",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: "#FFFFFF", borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => {
                const p = perExercise[item.dataIndex];
                const t = p.yes + p.unsure + p.no;
                if (t === 0) return "Pole vastuseid";
                return `Sai aru ${p.yes} · TI aitas ${p.unsure} · jäi kinni ${p.no} (${t} vastust)`;
              },
            },
          },
        },
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { display: false },
            grid: { color: "rgba(15, 23, 42, 0.08)" },
            angleLines: { color: "rgba(15, 23, 42, 0.08)" },
            pointLabels: { color: "var(--color-text-secondary)", font: { size: 11 } },
          },
        },
      },
    });
  }

  function drawStepsList(perExercise) {
    const wrap = $("lesson-steps-list");
    wrap.innerHTML = "";
    perExercise.forEach((p, i) => {
      const total = p.yes + p.unsure + p.no;
      const yesPct = total === 0 ? 0 : Math.round((p.yes / total) * 100);
      const row = document.createElement("article");
      row.className = "lesson-step-row";
      row.innerHTML = `
        <div class="lesson-step-num">${String(i + 1).padStart(2, "0")}</div>
        <div class="lesson-step-body">
          <div class="lesson-step-text">${(p.text || "").replace(/[<>&]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[c]))}</div>
          <div class="lesson-step-bar">
            ${total === 0 ? '<div class="bar-empty">Pole vastuseid</div>' : `
              <span class="seg seg-yes" style="width:${(p.yes / total) * 100}%"></span>
              <span class="seg seg-mid" style="width:${(p.unsure / total) * 100}%"></span>
              <span class="seg seg-no" style="width:${(p.no / total) * 100}%"></span>
            `}
          </div>
          <div class="lesson-step-meta mono">
            ${total === 0 ? "Vastuseid: 0" : `${yesPct}% sai aru · ${p.unsure} TI abi · ${p.no} kinni · ${total} vastust`}
          </div>
        </div>
      `;
      wrap.appendChild(row);
    });
  }

  document.addEventListener("DOMContentLoaded", load);
})();
