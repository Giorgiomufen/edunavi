/* classes.js — Võimendatud õpetaja vaade.
 * Reuses the same classifier as /class but runs it across multiple classes
 * at once, then surfaces "which class needs you right now."
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

  function summarize(roster, exercises, label) {
    const classified = classify(roster, exercises);
    const need = classified.filter((s) => s.bucket === "need").length;
    const mid = classified.filter((s) => s.bucket === "mid").length;
    const ready = classified.filter((s) => s.bucket === "ready").length;
    const total = classified.length;
    const yesPct = classified.reduce((s, r) => s + r.ratio, 0) / total;

    // Per exercise — find worst
    const exStats = exercises.map((ex, i) => {
      const struggle = classified.filter((s) =>
        s.results[i] === "wrong" || s.results[i] === "partial" || s.results[i] === "blank"
      ).length;
      return { ...ex, struggle };
    });
    const worst = exStats.slice().sort((a, b) => b.struggle - a.struggle)[0];

    let priority;
    if (need / total >= 0.5) priority = "critical";
    else if (ready / total >= 0.7) priority = "ok";
    else priority = "watch";

    let action;
    if (priority === "critical") action = `Tee kordus — ${worst.skill}`;
    else if (priority === "ok") action = `Liigu järgmise teema juurde`;
    else action = `Jaga kahte gruppi`;

    return { label, total, need, mid, ready, yesPct, worst, priority, action, classified };
  }

  function multiHeadline(summaries) {
    const critical = summaries.filter((s) => s.priority === "critical");
    const watch = summaries.filter((s) => s.priority === "watch");
    if (critical.length === 0 && watch.length === 0) {
      return {
        headline: "Kõik klassid on rajal.",
        detail: "Iga klass on edasiliikumiseks valmis. Võid liikuda järgmise teema juurde kõikides klassides.",
      };
    }
    if (critical.length > 0) {
      const c = critical[0];
      return {
        headline: `Sekku kõigepealt klassis ${c.label}.`,
        detail: `${c.need} õpilast on kinni, kõige rohkem ${c.worst.skill} osas. Tugiõpetaja juhis on saadetud. Teised klassid (${watch.length} jälgida, ${summaries.length - critical.length - watch.length} OK) saavad oodata.`,
      };
    }
    return {
      headline: `${watch.length} klassi vajavad jälgimist.`,
      detail: "Ühtegi klassi pole kriitilises olukorras, aga need klassid võiksid saada lisaharjutust või väikese kordamise.",
    };
  }

  function multiPatterns(summaries) {
    const out = [];
    // Cross-class: same exercise causing trouble in most classes
    const exerciseTrouble = {};
    summaries.forEach((s) => {
      if (s.worst) exerciseTrouble[s.worst.text] = (exerciseTrouble[s.worst.text] || 0) + 1;
    });
    Object.entries(exerciseTrouble).forEach(([text, count]) => {
      if (count >= 2) {
        out.push({
          kind: "cross-class",
          text: `Ülesanne "${text}" on probleemiks ${count} klassis korraga — kaaluda ühist õppematerjali täiendamist.`,
        });
      }
    });
    // Total students by bucket across all classes
    const totals = summaries.reduce(
      (acc, s) => ({ need: acc.need + s.need, mid: acc.mid + s.mid, ready: acc.ready + s.ready }),
      { need: 0, mid: 0, ready: 0 }
    );
    const sum = totals.need + totals.mid + totals.ready;
    if (sum > 0) {
      out.push({
        kind: "global",
        text: `Kokku ${sum} õpilast: ${totals.need} vajab tuge (${Math.round(totals.need / sum * 100)}%), ${totals.mid} ebakindel, ${totals.ready} valmis edasi.`,
      });
    }
    return out;
  }

  function renderCard(s) {
    const card = document.createElement("article");
    card.className = `class-card priority-${s.priority}`;
    card.innerHTML = `
      <div class="class-card-head">
        <div>
          <div class="class-card-priority">${priorityLabel(s.priority)}</div>
          <div class="class-card-name">${s.label}</div>
        </div>
        <div class="class-card-action">${s.action}</div>
      </div>
      <div class="class-card-stats">
        <div class="cstat cstat-need"><span class="num">${s.need}</span><span class="label">Vajab tuge</span></div>
        <div class="cstat cstat-mid"><span class="num">${s.mid}</span><span class="label">Ebakindel</span></div>
        <div class="cstat cstat-ready"><span class="num">${s.ready}</span><span class="label">Valmis</span></div>
      </div>
      <div class="class-card-bar">
        <div class="seg seg-need"   style="width: ${100 * s.need / s.total}%"></div>
        <div class="seg seg-mid"    style="width: ${100 * s.mid / s.total}%"></div>
        <div class="seg seg-ready"  style="width: ${100 * s.ready / s.total}%"></div>
      </div>
      <div class="class-card-foot">
        <span class="mono">${s.total} õpilast · ${Math.round(s.yesPct * 100)}% mõistnud</span>
        <a href="/class" class="link-button" style="font-size:10px;">Vaata detaile →</a>
      </div>
    `;
    return card;
  }

  function priorityLabel(p) {
    if (p === "critical") return "Kriitiline · sekku kohe";
    if (p === "watch") return "Jälgi · väike kordus";
    return "Liigu edasi · OK";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const labels = ["8.A", "8.B", "8.C"];
    const summaries = D.ROSTERS.map((roster, i) => summarize(roster, D.EXERCISES, labels[i] || `Klass ${i + 1}`));
    summaries.sort((a, b) => {
      const order = { critical: 0, watch: 1, ok: 2 };
      return order[a.priority] - order[b.priority];
    });

    $("classes-count").textContent = `${summaries.length} klassi`;

    const head = multiHeadline(summaries);
    $("multi-headline").textContent = head.headline;
    $("multi-detail").textContent = head.detail;

    const grid = $("classes-grid");
    summaries.forEach((s) => grid.appendChild(renderCard(s)));

    const list = $("multi-patterns");
    list.innerHTML = "";
    multiPatterns(summaries).forEach((p) => {
      const li = document.createElement("li");
      li.className = `pattern pattern-${p.kind}`;
      li.textContent = p.text;
      list.appendChild(li);
    });
  });
})();
