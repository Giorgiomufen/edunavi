/* loo.js — Teacher prep flow.
 *   1. Pick classes + paste exercises.
 *   2. AI consolidates teemad (math concepts) ACROSS all exercises into ONE
 *      flat list. Teacher reviews + edits.
 *   3. Confirm → persist lesson + flat teema list; render ONE QR code that
 *      students scan to give per-teema feedback.
 *
 * No realtime channel — students arrive via QR and write directly to
 * Supabase. Teacher views aggregated stats at /lesson?id=...
 */
(function () {
  const $ = (id) => document.getElementById(id);

  const state = {
    school: null,
    topic: null,
    targetClasses: [],
    problems: [],     // pasted text only, raw input — kept for context display
    teemad: [],       // consolidated flat list: [{ id, text }]
    displayMode: "full",
    lessonId: null,
    roomCode: null,
  };

  // Rule-based "AI" — pakub MATEMAATIKATEEMAD (õppeaine sisulised mõisted),
  // mitte protseduurilisi samme. Doc FR-07 + FR-08: õpilasele arusaadav,
  // mitte liiga üldine. Näited: taandamine, koondamine, tegurdamine,
  // ümardamine, võrrandi koostamine.
  function proposeStepsFor(text) {
    const t = (text || "").toLowerCase().replace(/\s+/g, " ").trim();

    // Funktsiooni uurimine (check before ruutvõrrand — "f(x) = x²..." would
    // match both, but if "funktsioon" / "uurimine" / "tuletis" is mentioned,
    // it's a function analysis problem)
    if (/funktsioon|uurimine|tuletis/.test(t) || /f\s*\(\s*x\s*\).*uurimine/.test(t)) {
      return [
        "Funktsiooni nullkohad",
        "Tuletise leidmine",
        "Märgitabel",
        "Kasvamise ja kahanemise vahemikud",
        "Ekstreemumid",
      ];
    }
    // Ruutvõrrand
    if (/x\s*\^?\s*2|x²|ruutvõrr|ruutvorr/.test(t) && t.includes("=")) {
      return [
        "Võrrandi normaalkuju",
        "Diskriminant",
        "Tegurdamine",
        "Lahendite leidmine",
        "Lahendite kontroll",
      ];
    }
    // Lineaarvõrrand
    if (/(\d+)\s*x\s*([+\-−])\s*(\d+)\s*=\s*(-?\d+)/.test(t) || /lineaar/.test(t)) {
      return [
        "Võrrandi teisendamine",
        "Liikmete koondamine",
        "Muutuja avaldamine",
        "Lahendi kontroll",
      ];
    }
    // Funktsioon ilma uurimata (lihtsalt f(x) = ...)
    if (/f\s*\(\s*x\s*\)/.test(t)) {
      return [
        "Funktsiooni väärtused",
        "Asendamine",
        "Arvutamine",
        "Vastuse kontroll",
      ];
    }
    // Murrud
    if (/\d+\/\d+|murru|murd/.test(t)) {
      return [
        "Ühine nimetaja",
        "Murdude teisendamine",
        "Liitmine ja lahutamine",
        "Taandamine",
      ];
    }
    // Võrrandisüsteem
    if (t.split("=").length > 2 || /süsteem|susteem/.test(t)) {
      return [
        "Avaldamine",
        "Asendamine",
        "Muutujate leidmine",
        "Lahendi kontroll",
      ];
    }
    // Tekstülesanne / üldine
    if (/tekst|sõnaline|sonaline/.test(t)) {
      return [
        "Andmete eraldamine",
        "Võrrandi koostamine",
        "Lahendamine",
        "Vastuse kontroll",
      ];
    }
    // Avaldis
    if (/avaldis|liht|koonda/.test(t)) {
      return [
        "Sulgude avamine",
        "Sarnaste liikmete koondamine",
        "Tegurdamine",
        "Taandamine",
      ];
    }
    // Üldine vaikimisi
    return [
      "Andmete eraldamine",
      "Meetodi valik",
      "Arvutused",
      "Vastuse kontroll",
    ];
  }

  // ---------- Helpers ----------
  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function parseClassList(s) {
    return (s || "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  }

  // Per-school class catalog. Real values for the elite schools we list;
  // generic 8.A–12.C fallback for "Muu kool".
  const SCHOOL_CLASSES = {
    "Tallinna Reaalkool": [
      "10.A", "10.B", "10.C", "10.D",
      "11.A", "11.B", "11.C", "11.D",
      "12.A", "12.B", "12.C", "12.D",
    ],
    "Tallinna 21. Kool": [
      "10.HUM", "10.LOM", "10.MAT", "10.REA",
      "11.HUM", "11.LOM", "11.MAT", "11.REA",
      "12.HUM", "12.LOM", "12.MAT", "12.REA",
    ],
    "Hugo Treffneri Gümnaasium": [
      "10.A", "10.B", "10.C", "10.D", "10.E",
      "11.A", "11.B", "11.C", "11.D", "11.E",
      "12.A", "12.B", "12.C", "12.D", "12.E",
    ],
    __default__: [
      "8.A", "8.B", "8.C",
      "9.A", "9.B", "9.C",
      "10.A", "10.B", "10.C",
      "11.A", "11.B", "11.C",
      "12.A", "12.B", "12.C",
    ],
  };

  function buildClassesGrid(schoolKey) {
    const grid = $("classes-grid");
    if (!grid) return;
    if (!schoolKey) {
      grid.innerHTML = `<div class="classes-empty">Vali kool, et näha klasse.</div>`;
      return;
    }
    const list = SCHOOL_CLASSES[schoolKey] || SCHOOL_CLASSES.__default__;
    grid.innerHTML = list.map((v) => `
      <label class="class-check">
        <input type="checkbox" value="${v}" />
        <span>${v}</span>
      </label>
    `).join("");
  }

  function getCheckedClasses() {
    return [...document.querySelectorAll('#classes-grid input[type="checkbox"]:checked')]
      .map((c) => c.value);
  }
  function parseDocument(s) {
    return (s || "")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  function generateRoomCode() {
    const a = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    let s = "";
    for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }
  function showError(msg) {
    const el = $("loo-error");
    el.textContent = msg;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 6000);
  }
  function showPhase(name) {
    ["phase-input", "phase-review", "phase-done"].forEach((id) => {
      const el = $(id);
      if (el) el.style.display = id === name ? "block" : "none";
    });
    const ind = $("loo-step-indicator");
    if (name === "phase-input") ind.textContent = "1 / 3 · andmed";
    else if (name === "phase-review") ind.textContent = "2 / 3 · teemade kinnitamine";
    else if (name === "phase-done") ind.textContent = "3 / 3 · valmis";
  }

  // ---------- Consolidate teemad across all problems ----------
  // Dedupes by case-insensitive match. Preserves first-seen order.
  function consolidateTeemad(problems) {
    const seen = new Map();   // norm → original
    problems.forEach((text) => {
      const teemad = proposeStepsFor(text);
      teemad.forEach((t) => {
        const norm = t.toLowerCase().trim();
        if (!seen.has(norm)) seen.set(norm, t);
      });
    });
    return [...seen.values()].map((text) => ({ id: uuid(), text }));
  }

  // ---------- Phase 1 → 2: generate ----------
  function onGenerate() {
    state.school = $("school").value || null;
    state.topic = null;
    state.targetClasses = getCheckedClasses();
    const problems = parseDocument($("document").value);
    if (!state.school) {
      showError("Vali kool.");
      return;
    }
    if (state.targetClasses.length === 0) {
      showError("Vali vähemalt üks klass.");
      return;
    }
    if (problems.length === 0) {
      showError("Lisa vähemalt üks ülesanne.");
      return;
    }
    state.problems = problems;
    state.teemad = consolidateTeemad(problems);
    state.displayMode = "full";
    renderReview();
    showPhase("phase-review");
  }

  function renderReview() {
    // Show pasted problems read-only (context) + flat teema list (editable).
    const ctx = $("review-context");
    if (ctx) {
      ctx.innerHTML = `
        <span class="eyebrow">Ülesanded (${state.problems.length})</span>
        <ul class="review-problems">
          ${state.problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
        </ul>
      `;
    }
    const modeSel = $("review-mode");
    if (modeSel) modeSel.value = state.displayMode;
    renderTeemaList();
  }

  function renderTeemaList() {
    const list = $("teemad-list");
    if (!list) return;
    list.innerHTML = "";
    state.teemad.forEach((teema, ti) => {
      const li = document.createElement("li");
      li.className = "loo-teema-row";
      const isFirst = ti === 0;
      const isLast = ti === state.teemad.length - 1;
      li.innerHTML = `
        <span class="loo-teema-num mono">${String(ti + 1).padStart(2, "0")}</span>
        <input type="text" class="loo-teema-input" value="${escapeHtml(teema.text)}" />
        <button type="button" class="loo-step-up" title="Üles" ${isFirst ? "disabled" : ""}>↑</button>
        <button type="button" class="loo-step-down" title="Alla" ${isLast ? "disabled" : ""}>↓</button>
        <button type="button" class="loo-step-remove" title="Eemalda">×</button>
      `;
      li.querySelector(".loo-teema-input").addEventListener("input", (e) => {
        teema.text = e.target.value;
      });
      li.querySelector(".loo-step-up").addEventListener("click", () => {
        if (ti === 0) return;
        const arr = state.teemad;
        [arr[ti - 1], arr[ti]] = [arr[ti], arr[ti - 1]];
        renderTeemaList();
      });
      li.querySelector(".loo-step-down").addEventListener("click", () => {
        const arr = state.teemad;
        if (ti >= arr.length - 1) return;
        [arr[ti + 1], arr[ti]] = [arr[ti], arr[ti + 1]];
        renderTeemaList();
      });
      li.querySelector(".loo-step-remove").addEventListener("click", () => {
        state.teemad.splice(ti, 1);
        renderTeemaList();
      });
      list.appendChild(li);
    });
  }

  function addTeema() {
    state.teemad.push({ id: uuid(), text: "" });
    renderTeemaList();
  }

  function regenerateTeemad() {
    state.teemad = consolidateTeemad(state.problems);
    renderTeemaList();
  }

  // ---------- Phase 2 → 3: confirm + persist ----------
  async function onConfirm() {
    state.teemad = state.teemad
      .map((t) => ({ ...t, text: t.text.trim() }))
      .filter((t) => t.text.length > 0);
    if (state.teemad.length === 0) {
      showError("Pole ühtegi teemat. Lisa vähemalt üks.");
      return;
    }

    state.roomCode = generateRoomCode();

    const user = await EduNaviAuth.getUser();
    const lessonId = await EduNaviDB.createLesson({
      roomCode: state.roomCode,
      school: state.school,
      className: state.targetClasses[0] || null,
      topic: state.topic,
      teacherId: user ? user.id : null,
      targetClasses: state.targetClasses,
    });
    if (!lessonId) {
      showError("Tunni salvestamine ebaõnnestus. Kas Supabase on seadistatud?");
      return;
    }
    state.lessonId = lessonId;

    // Persist teemad as flat top-level exercises (no parent_exercise_id).
    // display_mode goes on every row so /student can read any of them.
    for (const teema of state.teemad) {
      const id = await EduNaviDB.createExercise({
        lessonId,
        text: teema.text,
        parentExerciseId: null,
        displayMode: state.displayMode || "full",
      });
      teema.dbId = id || teema.id;
    }

    renderQr(lessonId);
    const link = $("open-dashboard-link");
    if (link) link.setAttribute("href", `/lesson?id=${encodeURIComponent(lessonId)}`);
    showPhase("phase-done");
  }

  function renderQr(lessonId) {
    const grid = $("qr-grid");
    grid.innerHTML = "";
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/student?lesson=${encodeURIComponent(lessonId)}`;
    const card = document.createElement("article");
    card.className = "loo-qr-card loo-qr-card-single";
    card.innerHTML = `
      <div class="loo-qr-text">Skanni QR-kood, et anda tagasisidet teemade kohta.</div>
      <div class="loo-qr-canvas"></div>
      <div class="loo-qr-link mono">${url.replace(window.location.origin, "")}</div>
      <div class="loo-qr-steps">
        <span class="eyebrow" style="font-size:10px;">${state.teemad.length} teemat</span>
        <ol>${state.teemad.map((t) => `<li>${escapeHtml(t.text)}</li>`).join("")}</ol>
      </div>
    `;
    grid.appendChild(card);
    const canvasHost = card.querySelector(".loo-qr-canvas");
    try {
      new QRCode(canvasHost, {
        text: url,
        width: 240,
        height: 240,
        colorDark: "#0F172A",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (e) {
      canvasHost.textContent = "QR error";
    }
  }

  // ---- FR-15: õpilasevaate eelvaade — kogu konsolideeritud nimekiri ----
  function showPreview() {
    const body = $("preview-body");
    const teemad = state.teemad.map((t) => t.text.trim()).filter(Boolean);
    const mode = state.displayMode;
    let inner;
    if (mode === "blind") {
      inner = `
        <p style="color:var(--muted); font-size:13px; margin-bottom:14px;">
          Pime tagasiside — õpilane ei näe teemasid ette. Üks valik kogu tunni kohta.
        </p>
        <div class="preview-step-buttons">
          <button type="button" disabled>Ei saanud aru üldse</button>
          <button type="button" disabled>Sain aru, aga TI aitas</button>
        </div>`;
    } else if (mode === "theme") {
      inner = `
        <p style="color:var(--muted); font-size:13px; margin-bottom:14px;">
          Teema-režiim — õpilane vajutab teemat, kus ta jäi kinni.
        </p>
        <ol class="preview-steps">
          ${teemad.map((t) => `<li class="preview-step"><div class="preview-step-body"><div class="preview-step-text">${escapeHtml(t)}</div></div></li>`).join("")}
        </ol>`;
    } else {
      inner = `
        <p style="color:var(--muted); font-size:13px; margin-bottom:14px;">
          Täisrežiim — õpilane näeb iga teema juures kahte nuppu.
        </p>
        <ol class="preview-steps">
          ${teemad.map((t, i) => `
            <li class="preview-step">
              <span class="preview-step-num">${i + 1}.</span>
              <div class="preview-step-body">
                <div class="preview-step-text">${escapeHtml(t)}</div>
                <div class="preview-step-buttons">
                  <button type="button" disabled>Ei saanud aru üldse</button>
                  <button type="button" disabled>Sain aru, aga TI aitas</button>
                </div>
              </div>
            </li>`).join("")}
        </ol>`;
    }
    body.innerHTML = inner;
    $("preview-modal").classList.add("show");
  }
  function hidePreview() {
    $("preview-modal").classList.remove("show");
  }

  // ---------- Phase 1 textarea live count ----------
  function updateExerciseCount() {
    const n = parseDocument($("document").value).length;
    $("loo-exercise-count").textContent = `${n} ülesanne${n === 1 ? "" : "t"}`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildClassesGrid(null);
    $("document").addEventListener("input", updateExerciseCount);
    $("generate-btn").addEventListener("click", onGenerate);
    if ($("school")) $("school").addEventListener("change", (e) => {
      buildClassesGrid(e.target.value || null);
    });
    if ($("preview-close")) $("preview-close").addEventListener("click", hidePreview);
    if ($("preview-modal")) $("preview-modal").addEventListener("click", (e) => {
      if (e.target.id === "preview-modal") hidePreview();
    });
    $("back-to-input").addEventListener("click", () => showPhase("phase-input"));
    $("confirm-btn").addEventListener("click", onConfirm);
    if ($("review-mode")) $("review-mode").addEventListener("change", (e) => {
      state.displayMode = e.target.value;
    });
    if ($("review-add-teema")) $("review-add-teema").addEventListener("click", addTeema);
    if ($("review-regen")) $("review-regen").addEventListener("click", regenerateTeemad);
    if ($("review-preview")) $("review-preview").addEventListener("click", showPreview);
    $("new-lesson-btn").addEventListener("click", () => {
      state.problems = [];
      state.teemad = [];
      state.lessonId = null;
      state.roomCode = null;
      state.school = null;
      state.targetClasses = [];
      state.displayMode = "full";
      if ($("school")) $("school").value = "";
      if ($("review-mode")) $("review-mode").value = "full";
      buildClassesGrid(null);
      $("document").value = "";
      updateExerciseCount();
      showPhase("phase-input");
    });
    showPhase("phase-input");
  });
})();
