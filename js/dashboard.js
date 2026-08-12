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

      <div class="panel">
        <div class="panel-header">
          <h3>⚠️ Relances à effectuer</h3>
          <a href="relances.html" class="btn btn-sm btn-ghost">Voir tout →</a>
        </div>
        ${relances.length ? relances.map(e => `
          <div class="detail-row">
            <span class="k">${escapeHtml(e.nom)}</span>
            <span class="v">${relanceLabel(e.diffDays)}</span>
          </div>
        `).join("") : `<div class="empty-state">Aucune relance urgente 🎉</div>`}
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Entreprises récentes</h3>
          <a href="entreprises.html" class="btn btn-sm btn-ghost">Voir tout →</a>
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
})();
