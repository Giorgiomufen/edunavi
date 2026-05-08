/* tugi.js — Mobile-first view for the on-site assistant teacher.
 * Pulls the latest snapshot the head teacher generated on /class via
 * sessionStorage; falls back to running the same classification on the
 * mock data so the page is always meaningful even if opened cold.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const D = window.EDUNAVI_CLASS_DATA;

  const SCORE = { correct: 1.0, partial: 0.5, wrong: 0, blank: 0 };

  function classify(roster, exercises) {
    return roster.map((s) => {
      const total = s.results.reduce((acc, r) => acc + (SCORE[r] ?? 0), 0);
      const ratio = total / exercises.length;
      let bucket = "ready";
      if (ratio < 0.4) bucket = "need";
      else if (ratio < 0.75) bucket = "mid";
      return { ...s, ratio, bucket };
    });
  }

  function readSnapshot() {
    try {
      const v = sessionStorage.getItem("edunavi-class-snapshot");
      if (!v) return null;
      const o = JSON.parse(v);
      // Snapshots older than 60 minutes are stale.
      if (!o.ts || Date.now() - o.ts > 60 * 60 * 1000) return null;
      return o;
    } catch (e) { return null; }
  }

  function deriveFromMock() {
    if (!D) return null;
    const roster = D.ROSTERS[0];
    const classified = classify(roster, D.EXERCISES);
    return {
      meta: D.META,
      classified,
      buckets: {
        need: classified.filter((s) => s.bucket === "need").length,
        mid: classified.filter((s) => s.bucket === "mid").length,
        ready: classified.filter((s) => s.bucket === "ready").length,
      },
    };
  }

  function tugiRecommendation(snapshot) {
    const need = snapshot.classified.filter((s) => s.bucket === "need");
    const mid = snapshot.classified.filter((s) => s.bucket === "mid");
    if (need.length === 0 && mid.length === 0) {
      return {
        headline: "Kõik on rajal.",
        detail: "Klass tuleb hetkel iseseisvalt toime. Jälgi õhkkonda, küsi vajadusel iga grupi käekäiku.",
      };
    }
    if (need.length === 0) {
      return {
        headline: `Jälgi ${mid.length} õpilast.`,
        detail: "Keegi ei vaja kohest sekkumist, aga need õpilased võiksid ülesande sees ühekordse selgituse saada.",
      };
    }
    if (need.length <= 3) {
      return {
        headline: `Mine kohe ${need.length} õpilase juurde.`,
        detail: `Võta ${need.map((s) => s.name).slice(0, 3).join(", ")} eraldi laua taha ja selgita ${snapshot.meta.topic.toLowerCase()} põhitehted samm-sammult uuesti.`,
      };
    }
    return {
      headline: `${need.length} õpilast vajavad samasugust kordust.`,
      detail: "Tee neist väike grupp ja võta klassi tagumisse osa eraldi. Juhtõpetaja võtab klassi ülejäänud osaga edasi.",
    };
  }

  function renderList(ul, students, withRatio) {
    ul.innerHTML = "";
    students.forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${s.name}</span>${withRatio ? `<span class="ratio mono">${Math.round(s.ratio * 100)}%</span>` : ""}`;
      ul.appendChild(li);
    });
  }

  function render() {
    const snap = readSnapshot() || deriveFromMock();
    if (!snap) {
      $("tugi-headline").textContent = "Andmeid ei leitud.";
      return;
    }
    $("tugi-meta").textContent = `${snap.meta.schoolName || ""} · ${snap.meta.className || ""} · ${snap.meta.topic || ""}`.trim();

    const need = snap.classified.filter((s) => s.bucket === "need");
    const mid = snap.classified.filter((s) => s.bucket === "mid");

    $("tugi-need-count").textContent = need.length;
    $("tugi-mid-count").textContent = mid.length;
    renderList($("tugi-need-list"), need, true);
    renderList($("tugi-mid-list"), mid, true);

    const rec = tugiRecommendation(snap);
    $("tugi-headline").textContent = rec.headline;
    $("tugi-detail").textContent = rec.detail;
  }

  document.addEventListener("DOMContentLoaded", () => {
    render();
    // Light polling so the assistant teacher's screen stays fresh.
    setInterval(render, 5000);
  });
})();
