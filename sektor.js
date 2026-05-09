/* sektor.js — Digipeegel-style sector chart.
 * 6 classes (sectors) × 3 topics (concentric rings) × 30 students each.
 * Each cell colored by % "sain aru" for that (class, topic).
 *
 * SVG-based: viewBox -200..200, three rings between r=180→130, 130→80, 80→30.
 */
(function () {
  const $ = (id) => document.getElementById(id);

  const CLASSES = ["8.A", "8.B", "8.C", "9.A", "9.B", "9.C"];
  const TOPICS  = [
    "Murdude liitmine",
    "Murdude jagamine",
    "Murdude lihtsustamine",
  ];
  const PER_CLASS = 30;

  // Outer→inner so ring 0 is the outermost and visually most prominent
  const RINGS = [
    { r0: 130, r1: 180 },  // topic 0 — outer
    { r0:  80, r1: 130 },  // topic 1 — middle
    { r0:  30, r1:  80 },  // topic 2 — inner
  ];

  function statusColor(yesPct) {
    if (yesPct >= 0.80) return { fill: "#22C55E", label: "≥ 80% sai aru" };
    if (yesPct >= 0.50) return { fill: "#FACC15", label: "50–79%" };
    if (yesPct >= 0.30) return { fill: "#F97316", label: "30–49%" };
    return { fill: "#EF4444", label: "< 30%" };
  }

  function generateData() {
    // Realistic plausible distribution: most classes ~50–80% on most topics,
    // one class struggling, one acing, one topic harder than others.
    const profiles = [
      [0.85, 0.78, 0.82],   // 8.A — strong
      [0.72, 0.55, 0.68],   // 8.B — mixed
      [0.40, 0.30, 0.45],   // 8.C — struggling
      [0.90, 0.85, 0.88],   // 9.A — top
      [0.55, 0.45, 0.50],   // 9.B — borderline
      [0.65, 0.35, 0.60],   // 9.C — middle topic hard
    ];
    return CLASSES.map((klass, i) => ({
      class: klass,
      topics: TOPICS.map((topic, t) => {
        const target = profiles[i][t];
        // Add ±10% noise per cell so reload looks alive
        const yesPct = Math.max(0, Math.min(1, target + (Math.random() - 0.5) * 0.2));
        const yes = Math.round(yesPct * PER_CLASS);
        return { topic, yes, no: PER_CLASS - yes, total: PER_CLASS };
      }),
    }));
  }

  // Build an SVG path for an annular sector.
  function arcPath(a0, a1, rIn, rOut) {
    const p = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
    const [x1, y1] = p(a0, rOut);
    const [x2, y2] = p(a1, rOut);
    const [x3, y3] = p(a1, rIn);
    const [x4, y4] = p(a0, rIn);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)}
            A ${rOut} ${rOut} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}
            L ${x3.toFixed(2)} ${y3.toFixed(2)}
            A ${rIn} ${rIn} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}
            Z`;
  }

  function render(data) {
    const svg = $("sektor-svg");
    svg.innerHTML = "";
    const N = data.length;
    const sectorAngle = (2 * Math.PI) / N;
    // Start at -90° so first sector is at the top
    const startOffset = -Math.PI / 2;

    // 1. Draw cells (sector × ring)
    data.forEach((row, c) => {
      const a0 = startOffset + c * sectorAngle;
      const a1 = a0 + sectorAngle;
      row.topics.forEach((cell, t) => {
        const ring = RINGS[t];
        const yesPct = cell.total === 0 ? 0 : cell.yes / cell.total;
        const color = statusColor(yesPct);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", arcPath(a0, a1, ring.r0, ring.r1));
        path.setAttribute("fill", color.fill);
        path.setAttribute("stroke", "#FFFFFF");
        path.setAttribute("stroke-width", "1.6");
        path.setAttribute("fill-opacity", "0.92");
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${row.class} · ${cell.topic} · ${cell.yes}/${cell.total} sai aru (${Math.round(yesPct * 100)}%)`;
        path.appendChild(title);
        svg.appendChild(path);
      });
    });

    // 2. Draw class labels around the outer ring
    data.forEach((row, c) => {
      const aMid = startOffset + (c + 0.5) * sectorAngle;
      const labelR = 192;
      const x = Math.cos(aMid) * labelR;
      const y = Math.sin(aMid) * labelR;
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x.toFixed(1));
      text.setAttribute("y", y.toFixed(1));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("font-family", "'Barlow Condensed', sans-serif");
      text.setAttribute("font-weight", "700");
      text.setAttribute("font-size", "13");
      text.setAttribute("fill", "#0F172A");
      text.textContent = row.class;
      svg.appendChild(text);
    });

    // 3. Draw a clean white core
    const core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    core.setAttribute("cx", "0");
    core.setAttribute("cy", "0");
    core.setAttribute("r", "30");
    core.setAttribute("fill", "#FFFFFF");
    core.setAttribute("stroke", "#E2E8F0");
    core.setAttribute("stroke-width", "1.5");
    svg.appendChild(core);
  }

  function renderLegends(data) {
    const ulC = $("legend-classes");
    ulC.innerHTML = "";
    data.forEach((row) => {
      const totals = row.topics.reduce((s, t) => ({ yes: s.yes + t.yes, total: s.total + t.total }), { yes: 0, total: 0 });
      const pct = totals.total === 0 ? 0 : Math.round((totals.yes / totals.total) * 100);
      const li = document.createElement("li");
      li.innerHTML = `<span class="legend-name">${row.class}</span><span class="legend-meta mono">${pct}% · ${PER_CLASS} õpilast</span>`;
      ulC.appendChild(li);
    });
    const ulT = $("legend-topics");
    ulT.innerHTML = "";
    TOPICS.forEach((t, i) => {
      const ringSize = i === 0 ? "väline" : i === 1 ? "keskmine" : "sisemine";
      const li = document.createElement("li");
      li.innerHTML = `<span class="legend-name">Etapp ${i + 1}: ${t}</span><span class="legend-meta">${ringSize} rõngas</span>`;
      ulT.appendChild(li);
    });
    $("totals-label").textContent = `${data.length * PER_CLASS} õpilast kokku`;
  }

  function renderTable(data) {
    const t = $("sektor-table");
    t.innerHTML = "";
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    trh.innerHTML = `<th>Klass</th>` + TOPICS.map((tp, i) => `<th>Etapp ${i + 1}<br /><span class="th-sub">${tp}</span></th>`).join("") + `<th>Kokku</th>`;
    thead.appendChild(trh);
    t.appendChild(thead);
    const tbody = document.createElement("tbody");
    data.forEach((row) => {
      const totals = row.topics.reduce((s, c) => ({ yes: s.yes + c.yes, total: s.total + c.total }), { yes: 0, total: 0 });
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="name">${row.class}</td>` +
        row.topics.map((c) => {
          const pct = c.total === 0 ? 0 : Math.round((c.yes / c.total) * 100);
          const color = statusColor(c.yes / c.total).fill;
          return `<td><span class="dot" style="background:${color}"></span> ${c.yes}/${c.total} <span class="muted">(${pct}%)</span></td>`;
        }).join("") +
        `<td><strong>${Math.round((totals.yes / totals.total) * 100)}%</strong></td>`;
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
  }

  function renderAll() {
    const data = generateData();
    render(data);
    renderLegends(data);
    renderTable(data);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderAll();
    $("reload-btn").addEventListener("click", renderAll);
  });
})();
