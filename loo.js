/* loo.js — Teacher prep flow.
 *   1. Pick classes + paste exercises.
 *   2. AI proposes steps per exercise; teacher reviews + edits.
 *   3. Confirm → persist lesson + problems + steps; render per-problem QR codes.
 *
 * No realtime channel needed — students arrive via per-exercise QR and write
 * directly to Supabase responses. Teacher views stats later at /lesson?id=...
 */
(function () {
  const $ = (id) => document.getElementById(id);

  const state = {
    school: null,
    topic: null,
    targetClasses: [],
    problems: [],   // [{ id (client uuid), text, steps: ["..."] }]
    lessonId: null,
    roomCode: null,
  };

  // ---------- Rule-based "AI" step proposal (same logic as teacher.js) ----------
  function proposeStepsFor(text) {
    const t = (text || "").toLowerCase().replace(/\s+/g, " ").trim();
    const lin = t.match(/(\d+)\s*x\s*([+\-−])\s*(\d+)\s*=\s*(-?\d+)/);
    if (lin) {
      const a = lin[1], op = lin[2], b = lin[3];
      const inverse = (op === "+" ? "Lahuta" : "Lisa");
      return [
        `${inverse} ${b} mõlemale poolele võrrandist`,
        `Jaga mõlemad pooled ${a}-ga`,
        `Saadud x väärtus — kontrolli see algvõrrandis`,
      ];
    }
    if (/x\s*\^?\s*2|x²/.test(t) && t.includes("=")) {
      return [
        "Vii kõik liikmed ühele poolele, et oleks 0",
        "Tegurda või kasuta diskriminandi valemit b² − 4ac",
        "Leia x väärtused valemiga (−b ± √D) / 2a",
        "Kontrolli mõlemad lahendid algvõrrandis",
      ];
    }
    if (/f\s*\(\s*x\s*\)/.test(t) || /funktsioon/.test(t) || /tuletis/.test(t)) {
      return [
        "Funktsiooni nullkohtade leidmine",
        "Tuletise leidmine",
        "Märgitabeli koostamine",
        "Kasvamis- ja kahanemisvahemike määramine",
        "Ekstreemumite leidmine",
      ];
    }
    if (/\d+\/\d+|murru|murd/.test(t)) {
      return [
        "Leia ühine nimetaja",
        "Teisenda kõik murrud ühise nimetajaga",
        "Liida või lahuta lugejad, nimetaja jääb sama",
        "Lihtsusta vastust kui võimalik",
      ];
    }
    if (t.split("=").length > 2 || /süsteem/.test(t)) {
      return [
        "Avalda üks muutuja teise kaudu ühest võrrandist",
        "Asenda see avaldis teise võrrandisse",
        "Lahenda saadud üks-muutujaline võrrand",
        "Leia ka teine muutuja, kontrolli mõlemas algvõrrandis",
      ];
    }
    return [
      "Eralda olulised andmed ülesandest",
      "Vali sobiv meetod või valem",
      "Tee arvutused samm-sammult",
      "Kontrolli vastust algse ülesandega",
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

  // Build the class checkbox grid: 8.A — 12.C
  function buildClassesGrid() {
    const grid = $("classes-grid");
    if (!grid || grid.dataset.built) return;
    const grades = [8, 9, 10, 11, 12];
    const letters = ["A", "B", "C"];
    const html = grades.map((g) => `
      <div class="classes-row">
        ${letters.map((L) => {
          const v = `${g}.${L}`;
          return `<label class="class-check">
            <input type="checkbox" value="${v}" />
            <span>${v}</span>
          </label>`;
        }).join("")}
      </div>
    `).join("");
    grid.innerHTML = html;
    grid.dataset.built = "1";
  }

  function getCheckedClasses() {
    const checked = [...document.querySelectorAll('#classes-grid input[type="checkbox"]:checked')]
      .map((c) => c.value);
    const custom = parseClassList($("classes-other") ? $("classes-other").value : "");
    // de-dupe
    return [...new Set([...checked, ...custom])];
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
    else if (name === "phase-review") ind.textContent = "2 / 3 · etappide kinnitamine";
    else if (name === "phase-done") ind.textContent = "3 / 3 · valmis";
  }

  // ---------- Phase 1 → 2: generate ----------
  function onGenerate() {
    const schoolSel = $("school").value;
    const schoolOther = $("school-other").value.trim();
    state.school = schoolSel === "__other__"
      ? (schoolOther || null)
      : (schoolSel || null);
    state.topic = $("topic").value.trim() || null;
    state.targetClasses = getCheckedClasses();
    const problems = parseDocument($("document").value);
    if (problems.length === 0) {
      showError("Lisa vähemalt üks ülesanne.");
      return;
    }
    state.problems = problems.map((text) => ({
      id: uuid(),
      text,
      steps: proposeStepsFor(text),
      displayMode: "full",   // FR-13/14 — Täisrežiim vaikimisi
    }));
    renderProblemsList();
    showPhase("phase-review");
  }

  function renderProblemsList() {
    const list = $("problems-list");
    list.innerHTML = "";
    state.problems.forEach((problem, pi) => {
      const card = document.createElement("article");
      card.className = "loo-problem-card";
      card.dataset.problemId = problem.id;
      card.innerHTML = `
        <div class="loo-problem-head">
          <span class="loo-problem-num">${String(pi + 1).padStart(2, "0")}</span>
          <textarea class="loo-problem-text" rows="2">${escapeHtml(problem.text)}</textarea>
          <button class="loo-problem-preview" type="button" title="Kuva, mida õpilane näeb">👁</button>
          <button class="loo-problem-remove" type="button" title="Eemalda see ülesanne">×</button>
        </div>
        <div class="loo-mode-row">
          <label class="loo-mode-label">Õpilane näeb:</label>
          <select class="loo-mode-select">
            <option value="full"${problem.displayMode === "full" ? " selected" : ""}>Täisrežiim — kõik etapid nähtavad</option>
            <option value="theme"${problem.displayMode === "theme" ? " selected" : ""}>Teema-režiim — ainult teemade nimed</option>
            <option value="blind"${problem.displayMode === "blind" ? " selected" : ""}>Pime tagasiside — ei näe etappe ette</option>
          </select>
        </div>
        <div class="loo-steps">
          <span class="eyebrow" style="margin-bottom:8px;">Etapid</span>
          <ol class="loo-step-list"></ol>
          <div class="loo-step-actions">
            <button class="loo-step-add" type="button">+ Lisa etapp</button>
            <button class="loo-step-regen" type="button">↻ Genereeri uuesti</button>
          </div>
        </div>
      `;
      const stepList = card.querySelector(".loo-step-list");
      problem.steps.forEach((s, si) => stepList.appendChild(stepRow(problem, si, s)));
      // Wire problem-level controls
      card.querySelector(".loo-problem-text").addEventListener("input", (e) => {
        problem.text = e.target.value;
      });
      card.querySelector(".loo-problem-remove").addEventListener("click", () => {
        state.problems = state.problems.filter((p) => p.id !== problem.id);
        renderProblemsList();
      });
      card.querySelector(".loo-problem-preview").addEventListener("click", () => {
        showPreview(problem);
      });
      card.querySelector(".loo-mode-select").addEventListener("change", (e) => {
        problem.displayMode = e.target.value;
      });
      card.querySelector(".loo-step-add").addEventListener("click", () => {
        problem.steps.push("");
        renderProblemsList();
      });
      card.querySelector(".loo-step-regen").addEventListener("click", () => {
        problem.steps = proposeStepsFor(problem.text);
        renderProblemsList();
      });
      list.appendChild(card);
    });
  }
  function stepRow(problem, idx, value) {
    const li = document.createElement("li");
    li.className = "loo-step-row";
    const isFirst = idx === 0;
    const isLast = idx === problem.steps.length - 1;
    li.innerHTML = `
      <input type="text" value="${escapeHtml(value)}" />
      <button class="loo-step-up" type="button" title="Liiguta ülespoole" ${isFirst ? "disabled" : ""}>↑</button>
      <button class="loo-step-down" type="button" title="Liiguta allapoole" ${isLast ? "disabled" : ""}>↓</button>
      <button class="loo-step-remove" type="button" title="Eemalda etapp">×</button>
    `;
    const input = li.querySelector("input");
    input.addEventListener("input", (e) => {
      problem.steps[idx] = e.target.value;
    });
    li.querySelector(".loo-step-up").addEventListener("click", () => {
      if (idx === 0) return;
      const arr = problem.steps;
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      renderProblemsList();
    });
    li.querySelector(".loo-step-down").addEventListener("click", () => {
      const arr = problem.steps;
      if (idx >= arr.length - 1) return;
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      renderProblemsList();
    });
    li.querySelector(".loo-step-remove").addEventListener("click", () => {
      problem.steps.splice(idx, 1);
      renderProblemsList();
    });
    return li;
  }

  // ---------- Phase 2 → 3: confirm + persist ----------
  async function onConfirm() {
    // Strip empty steps + drop empty problems
    state.problems.forEach((p) => {
      p.steps = p.steps.map((s) => s.trim()).filter(Boolean);
    });
    state.problems = state.problems.filter((p) => p.text.trim().length > 0);
    if (state.problems.length === 0) {
      showError("Pole ühtegi sisukat ülesannet.");
      return;
    }

    state.roomCode = generateRoomCode();

    // Persist lesson row
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

    // Persist each problem (top-level exercise) + its steps (child exercises)
    for (const problem of state.problems) {
      const problemRowId = await EduNaviDB.createExercise({
        lessonId,
        text: problem.text,
        parentExerciseId: null,
        displayMode: problem.displayMode || "full",
      });
      problem.dbId = problemRowId || problem.id;
      for (let i = 0; i < problem.steps.length; i++) {
        await EduNaviDB.createExercise({
          lessonId,
          text: `${i + 1}. ${problem.steps[i]}`,
          parentExerciseId: problem.dbId,
        });
      }
    }

    renderQrGrid();
    const link = $("open-dashboard-link");
    if (link) link.setAttribute("href", `/lesson?id=${encodeURIComponent(lessonId)}`);
    showPhase("phase-done");
  }

  function renderQrGrid() {
    const grid = $("qr-grid");
    grid.innerHTML = "";
    const baseUrl = window.location.origin;
    state.problems.forEach((problem, pi) => {
      const url = `${baseUrl}/student?ex=${encodeURIComponent(problem.dbId)}`;
      const card = document.createElement("article");
      card.className = "loo-qr-card";
      card.innerHTML = `
        <div class="loo-qr-num">${String(pi + 1).padStart(2, "0")}</div>
        <div class="loo-qr-text">${escapeHtml(problem.text)}</div>
        <div class="loo-qr-canvas"></div>
        <div class="loo-qr-link mono">${url.replace(window.location.origin, "")}</div>
        <div class="loo-qr-steps">
          <span class="eyebrow" style="font-size:10px;">${problem.steps.length} etappi</span>
          <ol>${problem.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
        </div>
      `;
      grid.appendChild(card);
      // Render the QR into its slot
      const canvasHost = card.querySelector(".loo-qr-canvas");
      try {
        new QRCode(canvasHost, {
          text: url,
          width: 180,
          height: 180,
          colorDark: "#0F172A",
          colorLight: "#FFFFFF",
          correctLevel: QRCode.CorrectLevel.M,
        });
      } catch (e) {
        canvasHost.textContent = "QR error";
      }
    });
  }

  // ---- FR-15: õpilasevaate eelvaade ----
  function showPreview(problem) {
    const body = $("preview-body");
    const cleanSteps = problem.steps.map((s) => s.trim()).filter(Boolean);
    body.innerHTML = `
      <div class="preview-problem">
        <span class="eyebrow">Ülesanne</span>
        <p class="preview-problem-text">${escapeHtml(problem.text)}</p>
      </div>
      ${cleanSteps.length > 0 ? `
        <ol class="preview-steps">
          ${cleanSteps.map((s, i) => `
            <li class="preview-step">
              <span class="preview-step-num">${i + 1}.</span>
              <div class="preview-step-body">
                <div class="preview-step-text">${escapeHtml(s)}</div>
                <div class="preview-step-buttons">
                  <button type="button" disabled>Ei saanud aru üldse</button>
                  <button type="button" disabled>Sain aru, aga TI aitas</button>
                </div>
              </div>
            </li>
          `).join("")}
        </ol>
      ` : `<p style="color:var(--muted); font-size:13px;">Sellel ülesandel pole etappe.</p>`}
    `;
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
    buildClassesGrid();
    $("document").addEventListener("input", updateExerciseCount);
    $("generate-btn").addEventListener("click", onGenerate);
    if ($("school")) $("school").addEventListener("change", (e) => {
      $("school-other").style.display = e.target.value === "__other__" ? "block" : "none";
      if (e.target.value === "__other__") $("school-other").focus();
    });
    if ($("preview-close")) $("preview-close").addEventListener("click", hidePreview);
    if ($("preview-modal")) $("preview-modal").addEventListener("click", (e) => {
      if (e.target.id === "preview-modal") hidePreview();
    });
    $("back-to-input").addEventListener("click", () => showPhase("phase-input"));
    $("confirm-btn").addEventListener("click", onConfirm);
    $("new-lesson-btn").addEventListener("click", () => {
      state.problems = [];
      state.lessonId = null;
      state.roomCode = null;
      $("document").value = "";
      updateExerciseCount();
      showPhase("phase-input");
    });
    showPhase("phase-input");
  });
})();
