/* class.js — Klassi otsustugi.
 * Reads simulated eKool data, classifies students into 3 buckets, generates
 * a teacher recommendation, surfaces hidden patterns. The whole loop runs in
 * <100ms — the doc's "1 minute" target is generous; the actual gate is the
 * teacher reading the screen.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const D = window.EDUNAVI_CLASS_DATA;

  const SCORE = { correct: 1.0, partial: 0.5, wrong: 0, blank: 0 };
  const BUCKETS = {
    need:  { id: "need",  label: "Vajab tuge",            cssClass: "bucket-need",  threshold: 0.4 },
    mid:   { id: "mid",   label: "Ebakindel",              cssClass: "bucket-mid",   threshold: 0.75 },
    ready: { id: "ready", label: "Valmis edasi liikuma",  cssClass: "bucket-ready", threshold: 1.01 },
  };

  function classifyOne(student, exercises) {
    const total = student.results.reduce((s, r) => s + (SCORE[r] ?? 0), 0);
    const ratio = total / exercises.length;
    let bucket;
    if (ratio < BUCKETS.need.threshold) bucket = "need";
    else if (ratio < BUCKETS.mid.threshold) bucket = "mid";
    else bucket = "ready";
    return { ...student, total, ratio, bucket };
  }

  function aggregateExerciseFailures(students, exercises) {
    // Per exercise, count how many students failed/partial.
    return exercises.map((ex, idx) => {
      let wrong = 0, partial = 0, correct = 0, blank = 0;
      students.forEach((s) => {
        const r = s.results[idx];
        if (r === "wrong") wrong++;
        else if (r === "partial") partial++;
        else if (r === "correct") correct++;
        else blank++;
      });
      return { ...ex, wrong, partial, correct, blank, struggle: wrong + partial + blank };
    });
  }

  function findHiddenPatterns(classified, exerciseStats, exercises) {
    const out = [];
    // 1. Students who got everything right but had ≥1 partial — uncertainty in disguise.
    classified.forEach((s) => {
      if (s.bucket === "ready" && s.results.includes("partial")) {
        const partialIdxs = s.results
          .map((r, i) => (r === "partial" ? i : -1))
          .filter((i) => i >= 0);
        const skills = [...new Set(partialIdxs.map((i) => exercises[i].skill))];
        out.push({
          kind: "shaky-strong",
          text: `${s.name} sai enamiku tehtud, aga kahtleb teemas: ${skills.join(", ")}.`,
        });
      }
    });
    // 2. Class-wide topic gaps — a single exercise where ≥40% struggled.
    exerciseStats.forEach((ex) => {
      const ratio = ex.struggle / classified.length;
      if (ratio >= 0.4) {
        out.push({
          kind: "topic-gap",
          text: `${Math.round(ratio * 100)}% klassist eksis ülesandes "${ex.text}" — vajab kordamist.`,
        });
      }
    });
    // 3. Skill-level gaps across exercises.
    const skillStruggle = {};
    exerciseStats.forEach((ex) => {
      skillStruggle[ex.skill] = (skillStruggle[ex.skill] || 0) + ex.struggle;
    });
    const totalCells = classified.length * exercises.length;
    Object.entries(skillStruggle).forEach(([skill, count]) => {
      const pct = count / totalCells;
      if (pct >= 0.3) {
        out.push({
          kind: "skill-gap",
          text: `Oskus "${skill}" on klassi peamine raskuskoht (${Math.round(pct * 100)}% kõikidest tehetest).`,
        });
      }
    });
    return out;
  }

  function buildRecommendation(buckets, exerciseStats, total) {
    const need = buckets.need.length;
    const mid = buckets.mid.length;
    const ready = buckets.ready.length;
    const struggling = need + mid;
    const worstExercise = [...exerciseStats].sort((a, b) => b.struggle - a.struggle)[0];

    let headline, detail, actions = [];

    if (need / total >= 0.5) {
      // Most of the class is stuck → repeat the topic.
      headline = `Tee kordus — ${need} õpilast vajavad tuge.`;
      detail = `Kõige raskem ülesanne oli "${worstExercise.text}" — sellega eksis ${worstExercise.struggle} õpilast. Soovitatav on järgmise teema asemel see uuesti läbi võtta.`;
      actions = [
        { label: `Kordus: ${worstExercise.skill}`, kind: "primary" },
        { label: "Anna lisaharjutus", kind: "ghost" },
      ];
    } else if (ready / total >= 0.7) {
      // Class is solid → move on.
      headline = `Liigu järgmise teema juurde — ${ready} õpilast on valmis.`;
      detail = `${ready} õpilast lahendasid kindlalt, ${mid + need} vajavad jälgimist. Soovitatav on alustada järgmise teemaga ja anda ${mid + need}-le lisaharjutus paralleelselt.`;
      actions = [
        { label: "Alusta järgmist teemat", kind: "primary" },
        { label: `Lisaharjutus ${mid + need}-le`, kind: "ghost" },
      ];
    } else {
      // Mixed → split into two groups.
      headline = `Jaga klass kahte gruppi — ${ready} edasi, ${struggling} kordusele.`;
      detail = `Kõige rohkem raskusi oli ülesandes "${worstExercise.text}". ${ready} õpilast võivad järgmise teemaga edasi minna; ${struggling} õpilast vajavad fookustatud kordust ${worstExercise.skill} teemal.`;
      actions = [
        { label: `${struggling}-le: kordus ${worstExercise.skill}`, kind: "primary" },
        { label: `${ready}-le: edasi`, kind: "ghost" },
      ];
    }
    return { headline, detail, actions };
  }

  function readLiveRoster() {
    try {
      const v = sessionStorage.getItem("edunavi-live-roster");
      if (!v) return null;
      const o = JSON.parse(v);
      if (!o || !o.roster || !o.exercises) return null;
      return o;
    } catch (e) { return null; }
  }

  function isLiveMode() {
    return new URLSearchParams(window.location.search).get("live") === "1";
  }

  function render() {
    let roster, exercises, meta;
    const live = isLiveMode() ? readLiveRoster() : null;
    if (live) {
      roster = live.roster;
      exercises = live.exercises;
      meta = live.meta;
    } else {
      const idx = state.rosterIndex % D.ROSTERS.length;
      roster = D.ROSTERS[idx];
      exercises = D.EXERCISES;
      meta = D.META;
    }
    const classified = roster.map((s) => classifyOne(s, exercises));

    // Group into buckets
    const buckets = { need: [], mid: [], ready: [] };
    classified.forEach((s) => buckets[s.bucket].push(s));

    // Counts + meta
    $("count-need").textContent = buckets.need.length;
    $("count-mid").textContent = buckets.mid.length;
    $("count-ready").textContent = buckets.ready.length;
    $("meta-class").textContent = `${meta.schoolName || ""} · ${meta.className || ""}`.replace(/^ · | · $/g, "");
    $("meta-topic").textContent = meta.topic ? `Teema: ${meta.topic}` : "";
    $("meta-students").textContent = `${classified.length} õpilast${live ? " · reaalajas tunnist" : ""}`;

    // Live badge: show only in live mode, with data age
    const liveBadge = $("live-badge");
    if (live && liveBadge) {
      liveBadge.style.display = "inline-flex";
      const snap = readLiveRoster();
      if (snap && snap.ts) {
        const ageMin = Math.round((Date.now() - snap.ts) / 60000);
        $("live-age").textContent = ageMin <= 0 ? "äsja" : `${ageMin} min tagasi`;
      }
    } else if (liveBadge) {
      liveBadge.style.display = "none";
    }

    // Bucket lists
    fillList($("list-need"), buckets.need);
    fillList($("list-mid"), buckets.mid);
    fillList($("list-ready"), buckets.ready);

    // Recommendation
    const rec = buildRecommendation(buckets, aggregateExerciseFailures(classified, exercises), classified.length);
    $("rec-headline").textContent = rec.headline;
    $("rec-detail").textContent = rec.detail;
    const actions = $("rec-actions");
    actions.innerHTML = "";
    rec.actions.forEach((a) => {
      const b = document.createElement("button");
      b.textContent = a.label;
      if (a.kind === "primary") b.className = "primary";
      actions.appendChild(b);
    });

    // Per-student × per-exercise grid
    renderGrid(classified, exercises);

    // Hidden patterns
    const exStats = aggregateExerciseFailures(classified, exercises);
    const patterns = findHiddenPatterns(classified, exStats, exercises);
    const ps = $("patterns-section");
    const list = $("patterns-list");
    list.innerHTML = "";
    if (patterns.length === 0) {
      ps.style.display = "none";
    } else {
      ps.style.display = "block";
      patterns.forEach((p) => {
        const li = document.createElement("li");
        li.className = `pattern pattern-${p.kind}`;
        li.textContent = p.text;
        list.appendChild(li);
      });
    }

    // Persist for the tugiõpetaja view
    try {
      sessionStorage.setItem("edunavi-class-snapshot", JSON.stringify({
        meta: D.META,
        classified,
        buckets: { need: buckets.need.length, mid: buckets.mid.length, ready: buckets.ready.length },
        recommendation: rec,
        ts: Date.now(),
      }));
    } catch (e) {}
  }

  function fillList(ul, students) {
    ul.innerHTML = "";
    students.forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${s.name}</span><span class="ratio mono">${Math.round(s.ratio * 100)}%</span>`;
      ul.appendChild(li);
    });
  }

  function renderGrid(classified, exercises) {
    const t = $("grid-table");
    t.innerHTML = "";
    // Header row
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    trh.appendChild(thHeader("Õpilane"));
    exercises.forEach((ex, i) => trh.appendChild(thHeader(`Ü${i + 1}`, ex.text)));
    trh.appendChild(thHeader("Kokku"));
    thead.appendChild(trh);
    t.appendChild(thead);

    const tbody = document.createElement("tbody");
    classified
      .slice()
      .sort((a, b) => a.ratio - b.ratio) // worst first — eye lands on who needs help
      .forEach((s) => {
        const tr = document.createElement("tr");
        tr.classList.add(`row-${s.bucket}`);
        const name = document.createElement("td");
        name.className = "name";
        name.textContent = s.name;
        tr.appendChild(name);
        s.results.forEach((r) => {
          const td = document.createElement("td");
          td.className = `cell cell-${r}`;
          tr.appendChild(td);
        });
        const total = document.createElement("td");
        total.className = "total mono";
        total.textContent = `${Math.round(s.ratio * 100)}%`;
        tr.appendChild(total);
        tbody.appendChild(tr);
      });
    t.appendChild(tbody);
  }

  function thHeader(text, title) {
    const th = document.createElement("th");
    th.textContent = text;
    if (title) th.title = title;
    return th;
  }

  const state = { rosterIndex: 0 };

  document.addEventListener("DOMContentLoaded", () => {
    if (!D) return;
    $("reload-btn").addEventListener("click", () => {
      // If we landed in live-data mode, "Uus näidis" returns to the mock library.
      if (isLiveMode()) {
        const u = new URL(window.location.href);
        u.searchParams.delete("live");
        history.replaceState({}, "", u.toString());
      }
      state.rosterIndex = (state.rosterIndex + 1) % D.ROSTERS.length;
      render();
    });
    render();
  });
})();
