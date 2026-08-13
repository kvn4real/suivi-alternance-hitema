// js/dashboard.js

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;
  const candidateId = profile.role === "candidate" ? profile.id : profile.candidate_id;

  renderShell({ profile, activePage: "dashboard.html", title: "Dashboard" });

  const { data: entreprises } = await supabaseClient
    .from("entreprises")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("updated_at", { ascending: false });

  const list = entreprises || [];
  const counts = {
    total: list.length,
    "Contactée": 0, "Candidature envoyée": 0, "Relance": 0,
    "Entretien": 0, "Acceptée": 0, "Refusée": 0,
  };
  list.forEach(e => { if (counts[e.statut] !== undefined) counts[e.statut]++; });

  const today = new Date(); today.setHours(0,0,0,0);
  const relances = list
    .filter(e => e.date_relance)
    .map(e => ({ ...e, diffDays: Math.round((new Date(e.date_relance) - today) / 86400000) }))
    .filter(e => e.diffDays <= 3)
    .sort((a, b) => a.diffDays - b.diffDays)
    .slice(0, 6);

  function relanceLabel(diff) {
    if (diff < 0) return `En retard (${fmtDate(new Date(today.getTime() + diff*86400000))})`;
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Demain";
    return `Dans ${diff} jours`;
  }

  const recentes = list.slice(0, 6);

  const content = document.getElementById("content");

  const chartsHtml = `
    <div class="stats-grid" style="grid-template-columns:1fr 1fr;">
      <div class="panel" style="margin-bottom:0;">
        <h3 style="margin-bottom:14px;">Répartition par statut</h3>
        <canvas id="chart-statuts" height="220"></canvas>
      </div>
      <div class="panel" style="margin-bottom:0;">
        <h3 style="margin-bottom:14px;">Candidatures ajoutées (6 derniers mois)</h3>
        <canvas id="chart-evolution" height="220"></canvas>
      </div>
    </div>
  `;

  if (profile.role === "candidate") {
    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Entreprises</div><div class="value">${counts.total}</div></div>
        <div class="stat-card"><div class="label">Contactées</div><div class="value">${counts["Contactée"]}</div></div>
        <div class="stat-card"><div class="label">Candidatures</div><div class="value">${counts["Candidature envoyée"]}</div></div>
        <div class="stat-card"><div class="label">Relances</div><div class="value">${counts["Relance"]}</div></div>
        <div class="stat-card"><div class="label">Entretiens</div><div class="value">${counts["Entretien"]}</div></div>
        <div class="stat-card"><div class="label">Acceptées</div><div class="value">${counts["Acceptée"]}</div></div>
      </div>

      ${list.length ? chartsHtml : ""}

      <div class="panel">
        <div class="panel-header">
          <h3 style="display:flex;align-items:center;"><span class="icon">${ICONS.alert}</span>Relances à effectuer</h3>
          <a href="relances.html" class="btn btn-sm btn-ghost">Voir tout <span class="icon" style="margin-right:0;margin-left:6px;">${ICONS.arrowRight}</span></a>
        </div>
        ${relances.length ? relances.map(e => `
          <div class="detail-row">
            <span class="k">${escapeHtml(e.nom)}</span>
            <span class="v">${relanceLabel(e.diffDays)}</span>
          </div>
        `).join("") : `<div class="empty-state">Aucune relance urgente.</div>`}
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Entreprises récentes</h3>
          <a href="entreprises.html" class="btn btn-sm btn-ghost">Voir tout <span class="icon" style="margin-right:0;margin-left:6px;">${ICONS.arrowRight}</span></a>
        </div>
        ${recentes.length ? recentes.map(e => `
          <div class="detail-row">
            <span class="k">${escapeHtml(e.nom)} — ${escapeHtml(e.poste || "")}</span>
            <span class="v">${badgeHtml(e.statut)}</span>
          </div>
        `).join("") : `<div class="empty-state">Ajoute ta première entreprise pour démarrer.</div>`}
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="panel" style="text-align:center;">
        <h2 style="margin-bottom:2px;">Suivi de la recherche d'alternance</h2>
        <p style="color:var(--text-muted);">${escapeHtml([profile.prenom].filter(Boolean).join(" ") || "Accompagnateur")}, voici l'avancement du candidat que tu suis.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="label">Entreprises</div><div class="value">${counts.total}</div></div>
        <div class="stat-card"><div class="label">Contactées</div><div class="value">${counts["Contactée"]}</div></div>
        <div class="stat-card"><div class="label">Candidatures</div><div class="value">${counts["Candidature envoyée"]}</div></div>
        <div class="stat-card"><div class="label">Relances</div><div class="value">${counts["Relance"]}</div></div>
        <div class="stat-card"><div class="label">Entretiens</div><div class="value">${counts["Entretien"]}</div></div>
        <div class="stat-card"><div class="label">Acceptées</div><div class="value">${counts["Acceptée"]}</div></div>
      </div>

      ${list.length ? chartsHtml : ""}

      <div class="panel">
        <h3>Dernières candidatures</h3>
        ${recentes.length ? recentes.map(e => `
          <div class="detail-row">
            <span class="k">${escapeHtml(e.nom)}</span>
            <span class="v">${badgeHtml(e.statut)} <span style="color:var(--text-muted);">${fmtDate(e.updated_at)}</span></span>
          </div>
        `).join("") : `<div class="empty-state">Pas encore de données.</div>`}
      </div>
    `;
  }

  if (list.length) renderDashboardCharts(list, counts);
})();

function renderDashboardCharts(list, counts) {
  if (typeof Chart === "undefined") return;

  const style = getComputedStyle(document.documentElement);
  const textMuted = style.getPropertyValue("--text-muted").trim() || "#8b93a3";
  const border = style.getPropertyValue("--border").trim() || "#262b36";
  const gridColor = border;
  const fontColor = textMuted;

  // --- Répartition par statut (doughnut) ---
  const statutCanvas = document.getElementById("chart-statuts");
  if (statutCanvas) {
    const statutColors = {
      "Contactée": "#60a5fa",
      "Candidature envoyée": "#a78bfa",
      "Relance": "#fb923c",
      "Entretien": "#4ade80",
      "Acceptée": "#2dd4a7",
      "Refusée": "#f0605a",
    };
    const labels = Object.keys(statutColors).filter(s => counts[s] > 0);
    new Chart(statutCanvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: labels.map(l => counts[l]),
          backgroundColor: labels.map(l => statutColors[l]),
          borderColor: "transparent",
        }],
      },
      options: {
        plugins: { legend: { position: "bottom", labels: { color: fontColor, boxWidth: 12, padding: 12, font: { size: 11 } } } },
        cutout: "62%",
      },
    });
  }

  // --- Évolution des candidatures ajoutées sur 6 mois (bar) ---
  const evoCanvas = document.getElementById("chart-evolution");
  if (evoCanvas) {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("fr-FR", { month: "short" }) });
    }
    const counts2 = months.map(m => 0);
    list.forEach(e => {
      if (!e.date_ajout) return;
      const d = new Date(e.date_ajout);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const idx = months.findIndex(m => m.key === key);
      if (idx >= 0) counts2[idx]++;
    });
    new Chart(evoCanvas, {
      type: "bar",
      data: {
        labels: months.map(m => m.label),
        datasets: [{
          data: counts2,
          backgroundColor: "#16a879",
          borderRadius: 6,
          maxBarThickness: 36,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: fontColor } },
          y: { beginAtZero: true, ticks: { color: fontColor, precision: 0 }, grid: { color: gridColor } },
        },
      },
    });
  }
}
