/* lesson.js — post-lesson statistics view at /lesson?id=<lessonId>.
 *
 * MVP demo dashboard per Arendusnõuete koond:
 *   - FR-30  per-problem + per-step counts
 *   - FR-31  vastamismäär (responding sessions / target)
 *   - FR-33  prioriteetne raskuskoht esile tõstetud
 *   - FR-34  valgusfoor: roheline ≤20% kinni / kollane 21–50% / punane >50%
 *   - FR-37  one-line soovitus
 *   - NFR-09 demo-seed button to populate fake responses
 *
 * Data model: parent exercises (parent_exercise_id IS NULL) are problems;
 * children are steps. Students answer the steps.
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

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // FR-34 — traffic-light bucket from "stuck %" (no + unsure / total)
  function trafficBucket(stuckPct) {
    if (stuckPct <= 20) return "ok";       // roheline
    if (stuckPct <= 50) return "warn";     // kollane
    return "alert";                        // punane
  }

  // ---- LOAD ----
  async function load() {
    const lessonId = getLessonId();
    if (!lessonId) return showEmpty();
    const c = client();
    if (!c) return showEmpty();

    const { data: lesson, error: lessonErr } = await c
      .from("lessons")
      .select("id, room_code, topic, school, class_name, target_classes, created_at, ended_at")
      .eq("id", lessonId)
      .maybeSingle();
    if (lessonErr || !lesson) return showEmpty();

    const { data: exercises } = await c
      .from("exercises")
      .select("id, text, parent_exercise_id, posted_at")
      .eq("lesson_id", lessonId)
      .order("posted_at", { ascending: true });

    const { data: responses } = await c
      .from("responses")
      .select("exercise_id, answer, session_id, class_name")
      .eq("lesson_id", lessonId);

    const { data: comments } = await c
      .from("comments")
      .select("exercise_id, class_name, text, created_at")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: false });

    render(lesson, exercises || [], responses || [], lessonId, comments || []);
  }

  function showEmpty() {
    $("lesson-loading").style.display = "none";
    $("lesson-empty").style.display = "block";
  }

  // ---- AGGREGATE ----
  // Returns per-step counts globally + per-class (FR-32).
  function aggregate(exercises, responses) {
    // Dedupe: last answer per (exercise, session) wins
    const dedup = new Map();
    responses.forEach((r) => {
      const sid = r.session_id || `anon-${Math.random()}`;
      const key = `${r.exercise_id}::${sid}`;
      dedup.set(key, { exId: r.exercise_id, ans: r.answer, sid, klass: r.class_name || null });
    });

    const counts = {};                  // global per-exercise
    const countsByClass = {};           // counts[exId][className] = {yes,unsure,no}
    const respondingSessions = new Set();
    const classes = new Set();

    dedup.forEach(({ exId, ans, sid, klass }) => {
      if (!counts[exId]) counts[exId] = { yes: 0, unsure: 0, no: 0 };
      if (counts[exId][ans] !== undefined) counts[exId][ans]++;
      if (klass) {
        classes.add(klass);
        if (!countsByClass[exId]) countsByClass[exId] = {};
        if (!countsByClass[exId][klass]) countsByClass[exId][klass] = { yes: 0, unsure: 0, no: 0 };
        if (countsByClass[exId][klass][ans] !== undefined) countsByClass[exId][klass][ans]++;
      }
      if (sid && !sid.startsWith("anon-")) respondingSessions.add(sid);
    });

    // Split parent / step
    const problems = exercises.filter((e) => !e.parent_exercise_id);
    const stepsByParent = new Map();
    exercises.forEach((e) => {
      if (e.parent_exercise_id) {
        if (!stepsByParent.has(e.parent_exercise_id)) stepsByParent.set(e.parent_exercise_id, []);
        stepsByParent.get(e.parent_exercise_id).push(e);
      }
    });

    const classList = [...classes].sort();

    const problemViews = problems.map((p) => {
      const steps = (stepsByParent.get(p.id) || []).map((s) => {
        const c = counts[s.id] || { yes: 0, unsure: 0, no: 0 };
        const total = c.yes + c.unsure + c.no;
        const stuck = c.unsure + c.no;
        const stuckPct = total === 0 ? 0 : Math.round((stuck / total) * 100);
        // Per-class view for this step
        const perClass = classList.map((klass) => {
          const cc = (countsByClass[s.id] && countsByClass[s.id][klass]) || { yes: 0, unsure: 0, no: 0 };
          const ct = cc.yes + cc.unsure + cc.no;
          const cs = cc.unsure + cc.no;
          const csPct = ct === 0 ? 0 : Math.round((cs / ct) * 100);
          return {
            klass, total: ct, ...cc,
            stuckPct: csPct,
            bucket: ct === 0 ? "none" : trafficBucket(csPct),
          };
        });
        return {
          id: s.id, text: s.text, total, ...c,
          stuckPct, bucket: trafficBucket(stuckPct),
          perClass,
        };
      });
      return { id: p.id, text: p.text, steps };
    });

    const allSteps = problemViews.flatMap((p) =>
      p.steps.map((s) => ({ ...s, problemText: p.text }))
    );

    return {
      problemViews,
      allSteps,
      respondingCount: respondingSessions.size,
      classList,
    };
  }

  // ---- RENDER ----
  function render(lesson, exercises, responses, lessonId, comments) {
    const agg = aggregate(exercises, responses);
    const targetCount = (lesson.target_classes && lesson.target_classes.length > 0)
      ? lesson.target_classes.length * 30      // assume ~30 per class
      : 30;
    const respondingCount = agg.respondingCount;

    // Header
    $("lesson-room").textContent = `Tuba ${lesson.room_code || "—"}`;
    $("lesson-when").textContent = fmtDateTime(lesson.created_at);
    $("lesson-topic").textContent = lesson.topic ? `Teema: ${lesson.topic}` : "";

    // Soovitus (FR-37)
    renderRecommendation(agg.allSteps);

    // Vastamismäär (FR-31)
    renderResponseRate(respondingCount, targetCount);

    // Per-problem cards (FR-30 + FR-34)
    renderProblems(agg.problemViews, respondingCount);

    // Comments (FR-22) — anonymous student comments grouped by exercise
    renderComments(comments || []);

    // Seed button
    $("seed-btn").addEventListener("click", () => seedDemoResponses(lessonId, exercises, lesson));

    $("lesson-loading").style.display = "none";
    $("lesson-body").style.display = "flex";
  }

  // FR-37 (otsustustugi) + FR-35 (väike vs suur probleem).
  // Doc loetleb 5 sekkumist: edasi / uuesti selgita / lisaülesanne /
  // kohapealne tugiõpetaja / planeeri tund ümber. Vali stuck % ja
  // raskuste hulga põhjal.
  function renderRecommendation(allSteps) {
    if (allSteps.length === 0) {
      $("lesson-headline").textContent = "Tunnis pole etappe.";
      $("lesson-detail").textContent = "Lisa /loo lehel ülesandeid ja etappe.";
      return;
    }
    const withResponses = allSteps.filter((s) => s.total > 0);
    if (withResponses.length === 0) {
      $("lesson-headline").textContent = "Õpilased pole veel vastanud.";
      $("lesson-detail").textContent = "Jaga ülesannete QR-koode õpilastega või kasuta all olevat \"Lisa demo-vastused\" nuppu, et dashboard'i näha.";
      return;
    }

    const sorted = [...withResponses].sort((a, b) => b.stuckPct - a.stuckPct);
    const worst = sorted[0];
    const alertSteps = sorted.filter((s) => s.stuckPct > 50);
    const warnSteps = sorted.filter((s) => s.stuckPct > 20 && s.stuckPct <= 50);
    const stuckCount = worst.unsure + worst.no;
    const totalCount = worst.total;
    const isBigProblem = stuckCount >= Math.ceil(totalCount * 0.5);   // FR-35
    const isSmallProblem = stuckCount > 0 && stuckCount <= 4;

    // Mitu etappi on punased? → tund vajab ümberplaneerimist
    if (alertSteps.length >= 3) {
      $("lesson-headline").textContent =
        `${alertSteps.length} etappi olid raskuses (>50% kinni). Tund vajab ümberplaneerimist.`;
      $("lesson-detail").textContent =
        `Soovitus: planeeri järgmine tund ümber. Vii kõigepealt kõige raskemad etapid uuesti läbi: "${alertSteps.slice(0, 2).map((s) => s.text).join("\", \"")}". Kui võimalik, jaga klass kohapealse õpetaja ja võimendatud õpetaja vahel.`;
      return;
    }

    // Suur probleem ühel etapil → võimendatud õpetaja peab uuesti selgitama
    if (worst.stuckPct >= 50) {
      $("lesson-headline").textContent =
        `Kõige raskem etapp: "${worst.text}" — ${worst.stuckPct}% jäi kinni (${stuckCount}/${totalCount}).`;
      $("lesson-detail").textContent =
        `Soovitus: võta see etapp järgmise tunni alguses uuesti läbi, enne kui edasi liigud. Ülesandes: "${worst.problemText}". Anna seejärel sarnane lisaülesanne, et kontrollida, kas mõistmine paranes.`;
      return;
    }

    // Keskmine probleem mitmel etapil → liigu edasi, aga jälgi
    if (warnSteps.length >= 2) {
      $("lesson-headline").textContent =
        `${warnSteps.length} etappi vajavad veel kinnistust (21–50% kinni).`;
      $("lesson-detail").textContent =
        `Soovitus: liigu järgmise teema juurde, aga anna järgmises tunnis lisaharjutus järgmistel: ${warnSteps.slice(0, 3).map((s) => `"${s.text}"`).join(", ")}.`;
      return;
    }

    // Väike probleem (3–4 last) ühel etapil → kohapealne õpetaja
    if (isSmallProblem && worst.stuckPct >= 21) {
      $("lesson-headline").textContent =
        `Üksikud (${stuckCount}/${totalCount}) jäid kinni etapil "${worst.text}".`;
      $("lesson-detail").textContent =
        `Soovitus: suuna need õpilased kohapealse õpetaja juurde lisaselgituseks. Klassiga tervikuna võid edasi liikuda.`;
      return;
    }

    // Üks keskmise raskusega etapp
    if (worst.stuckPct >= 21) {
      $("lesson-headline").textContent =
        `Klass tuli enamasti toime — etapp "${worst.text}" vajab veel kinnistust (${worst.stuckPct}% kinni).`;
      $("lesson-detail").textContent =
        `Soovitus: võid edasi liikuda, aga anna selle etapi kohta järgmises tunnis veel üks sarnane harjutusülesanne.`;
      return;
    }

    // Kõik on rohelises — liigu edasi
    $("lesson-headline").textContent = `Klass sai kõigi etappidega hakkama (≤20% kinni).`;
    $("lesson-detail").textContent = `Soovitus: liigu järgmise teema juurde. Suuna järgmise tunni rõhk uue materjali peale.`;
  }

  function renderResponseRate(responding, target) {
    const pct = target === 0 ? 0 : Math.round((responding / target) * 100);
    $("response-rate-line").textContent = `${responding} / ${target} õpilast vastas (${pct}%)`;
    $("response-rate-fill").style.width = `${Math.min(pct, 100)}%`;
  }

  function renderProblems(problemViews, totalSessions) {
    const wrap = $("lesson-problems-list");
    wrap.innerHTML = "";
    if (problemViews.length === 0) {
      wrap.innerHTML = `<div class="lesson-empty-state">Ülesanded puuduvad.</div>`;
      return;
    }
    problemViews.forEach((p, pi) => {
      const card = document.createElement("article");
      card.className = "lesson-problem-card";
      card.innerHTML = `
        <header class="lesson-problem-head">
          <span class="lesson-problem-num">${String(pi + 1).padStart(2, "0")}</span>
          <h2 class="lesson-problem-text">${escapeHtml(p.text)}</h2>
        </header>
        <ol class="lesson-step-list">
          ${p.steps.length === 0
            ? `<li class="lesson-step-empty">Selle ülesande all pole etappe.</li>`
            : p.steps.map((s) => stepRowHtml(s, totalSessions)).join("")}
        </ol>
      `;
      wrap.appendChild(card);
    });
  }

  function stepRowHtml(s, totalSessions) {
    if (s.total === 0) {
      return `
        <li class="lesson-step bucket-none">
          <span class="step-light"></span>
          <span class="step-text">${escapeHtml(s.text)}</span>
          <span class="step-meta mono">pole vastuseid</span>
        </li>`;
    }
    // FR-30 — "sain hakkama" implicit: õpilased, kes etapil ei vajutanud
    // ühtegi nuppu, lugesid selle korrasolevaks (vaikne pass).
    const implicitOk = Math.max(0, (totalSessions || 0) - s.total);
    const classRows = (s.perClass || [])
      .filter((cc) => cc.total > 0)
      .map((cc) => `
        <span class="class-pill bucket-${cc.bucket}" title="${escapeHtml(cc.klass)}: ${cc.stuckPct}% kinni, ${cc.total} vastust">
          <span class="class-pill-light"></span>
          <span class="class-pill-name">${escapeHtml(cc.klass)}</span>
          <span class="class-pill-pct mono">${cc.stuckPct}%</span>
        </span>`).join("");
    const implicitNote = implicitOk > 0
      ? ` · ${implicitOk} sai hakkama vaikselt`
      : "";
    return `
      <li class="lesson-step bucket-${s.bucket}">
        <div class="step-row-head">
          <span class="step-light"></span>
          <span class="step-text">${escapeHtml(s.text)}</span>
          <span class="step-meta mono">${s.stuckPct}% kinni · ${s.total} vastust${implicitNote}</span>
        </div>
        ${classRows ? `<div class="step-class-row">${classRows}</div>` : ""}
      </li>`;
  }

  // ---- Comments (FR-22 / FR-27) ----
  function renderComments(comments) {
    const wrap = $("lesson-comments");
    if (!wrap) return;
    if (comments.length === 0) {
      wrap.innerHTML = `<div class="lesson-comments-empty">Õpilased pole kommentaare lisanud.</div>`;
      return;
    }
    wrap.innerHTML = comments.slice(0, 20).map((c) => `
      <article class="lesson-comment">
        <div class="lesson-comment-meta mono">
          ${c.class_name ? escapeHtml(c.class_name) + " · " : ""}anonüümne
        </div>
        <div class="lesson-comment-text">${escapeHtml(c.text)}</div>
      </article>
    `).join("");
  }

  // ---- DEMO SEED (NFR-09) ----
  // Generates ~30 fake sessions × random answers per leaf step. Skips parents.
  // Distributes sessions across the lesson's target_classes (FR-32 demo).
  async function seedDemoResponses(lessonId, exercises, lesson) {
    const c = client();
    if (!c) { alert("Supabase pole seadistatud."); return; }
    const btn = $("seed-btn");
    btn.disabled = true;
    btn.textContent = "Lisan...";

    const stepIds = exercises.filter((e) => e.parent_exercise_id).map((e) => e.id);
    if (stepIds.length === 0) {
      alert("Selle tunni all pole etappe (loo /loo lehel ülesandeid + etappe).");
      btn.disabled = false; btn.textContent = "Lisa demo-vastused";
      return;
    }

    const targetClasses = (lesson && Array.isArray(lesson.target_classes) && lesson.target_classes.length > 0)
      ? lesson.target_classes
      : ["8.A", "8.B", "8.C"];   // sensible default if no target_classes set

    // Skew so different classes have visibly different performance — pitch story.
    const classBias = {};
    targetClasses.forEach((klass, ki) => {
      classBias[klass] = ki * 0.22;  // 0, 0.22, 0.44...
    });

    const rows = [];
    targetClasses.forEach((klass, ki) => {
      const N = 9 + Math.floor(Math.random() * 4);   // 9-12 students per class
      for (let s = 0; s < N; s++) {
        const sid = `demo-${lessonId.slice(0, 4)}-${ki}-${s}-${Date.now().toString(36)}`;
        stepIds.forEach((exId, idx) => {
          const hardness = (idx % 4) * 0.18;
          const bias = classBias[klass];
          const r = Math.random();
          let answer;
          if (r < 0.6 - hardness - bias) answer = "yes";
          else if (r < 0.82 - hardness * 0.5 - bias * 0.5) answer = "unsure";
          else answer = "no";
          if (Math.random() < 0.1) return;  // ~10% skip
          rows.push({
            lesson_id: lessonId,
            exercise_id: exId,
            session_id: sid,
            answer,
            class_name: klass,
          });
        });
      }
    });

    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await c.from("responses").insert(chunk);
      if (error) {
        console.warn("seed insert failed", error);
        alert("Ei õnnestunud demo-vastuseid lisada: " + error.message);
        btn.disabled = false; btn.textContent = "Lisa demo-vastused";
        return;
      }
    }
    btn.textContent = `Valmis · ${rows.length} vastust lisatud`;
    setTimeout(() => window.location.reload(), 600);
  }

  document.addEventListener("DOMContentLoaded", load);
})();
