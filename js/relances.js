// js/relances.js

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;
  const candidateId = profile.role === "candidate" ? profile.id : profile.candidate_id;

  renderShell({ profile, activePage: "relances.html", title: "Relances" });
  document.getElementById("relances-list").innerHTML = skeletonRows(3, 20);
  document.getElementById("relances-all").innerHTML = skeletonRows(4, 20);

  const { data } = await supabaseClient
    .from("entreprises")
    .select("*")
    .eq("candidate_id", candidateId)
    .not("date_relance", "is", null)
    .order("date_relance", { ascending: true });

  const list = data || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const withDiff = list.map(e => ({
    ...e,
    diff: Math.round((new Date(e.date_relance) - today) / 86400000),
  }));

  const urgent = withDiff.filter(e => e.diff <= 3);
  const all = withDiff;

  function label(diff) {
    if (diff < 0) return `<span class="icon" style="margin-right:4px;">${ICONS.clock}</span>En retard de ${Math.abs(diff)} jour(s)`;
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Demain";
    return `Dans ${diff} jours`;
  }

  document.getElementById("relances-list").innerHTML = urgent.length
    ? urgent.map(e => `
      <div class="detail-row">
        <span class="k">${escapeHtml(e.nom)} ${badgeHtml(e.statut)}</span>
        <span class="v" style="color:${e.diff < 0 ? "var(--danger)" : "var(--warning)"};font-weight:700;display:inline-flex;align-items:center;">${label(e.diff)}</span>
      </div>
    `).join("")
    : `<div class="empty-state">Aucune relance urgente pour le moment.</div>`;

  document.getElementById("relances-all").innerHTML = all.length
    ? all.map(e => `
      <div class="detail-row">
        <span class="k">${escapeHtml(e.nom)}</span>
        <span class="v">${fmtDate(e.date_relance)}</span>
      </div>
    `).join("")
    : `<div class="empty-state">Aucune relance planifiée pour l'instant.</div>`;
})();// js/relances.js

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;
  const candidateId = profile.role === "candidate" ? profile.id : profile.candidate_id;

  renderShell({ profile, activePage: "relances.html", title: "Relances" });
  document.getElementById("relances-list").innerHTML = skeletonRows(3, 20);
  document.getElementById("relances-all").innerHTML = skeletonRows(4, 20);

  const { data } = await supabaseClient
    .from("entreprises")
    .select("*")
    .eq("candidate_id", candidateId)
    .not("date_relance", "is", null)
    .order("date_relance", { ascending: true });

  const list = data || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const withDiff = list.map(e => ({
    ...e,
    diff: Math.round((new Date(e.date_relance) - today) / 86400000),
  }));

  const urgent = withDiff.filter(e => e.diff <= 3);
  const all = withDiff;

  function label(diff) {
    if (diff < 0) return `<span class="icon" style="margin-right:4px;">${ICONS.clock}</span>En retard de ${Math.abs(diff)} jour(s)`;
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Demain";
    return `Dans ${diff} jours`;
  }

  document.getElementById("relances-list").innerHTML = urgent.length
    ? urgent.map(e => `
      <div class="detail-row">
        <span class="k">${escapeHtml(e.nom)} ${badgeHtml(e.statut)}</span>
        <span class="v" style="color:${e.diff < 0 ? "var(--danger)" : "var(--warning)"};font-weight:700;display:inline-flex;align-items:center;">${label(e.diff)}</span>
      </div>
    `).join("")
    : `<div class="empty-state">Aucune relance urgente pour le moment.</div>`;

  document.getElementById("relances-all").innerHTML = all.length
    ? all.map(e => `
      <div class="detail-row">
        <span class="k">${escapeHtml(e.nom)}</span>
        <span class="v">${fmtDate(e.date_relance)}</span>
      </div>
    `).join("")
    : `<div class="empty-state">Aucune relance planifiée pour l'instant.</div>`;
})();
