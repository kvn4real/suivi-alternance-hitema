// js/activite.js

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;
  const candidateId = profile.role === "candidate" ? profile.id : profile.candidate_id;

  renderShell({ profile, activePage: "activite.html", title: "Activité" });
  document.getElementById("activity-list").innerHTML = `<div class="panel" style="box-shadow:none;border:none;padding:0;">${skeletonRows(5, 20)}</div>`;

  const { data } = await supabaseClient
    .from("activity_logs")
    .select("*, author:profiles!activity_logs_user_id_fkey(prenom,nom,role)")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(100);

  const list = document.getElementById("activity-list");
  if (!data || !data.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon">${ICONS.chart}</div>Aucune activité enregistrée pour le moment.</div>`;
    return;
  }

  // Regroupement par jour
  const groups = {};
  data.forEach(item => {
    const day = new Date(item.created_at).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
    groups[day] = groups[day] || [];
    groups[day].push(item);
  });

  list.innerHTML = Object.entries(groups).map(([day, items]) => `
    <h4 style="margin:18px 0 8px;text-transform:capitalize;">${escapeHtml(day)}</h4>
    ${items.map(item => {
      const isCompanion = item.author?.role === "companion";
      const authorName = isCompanion ? "Accompagnateur" : ([item.author?.prenom, item.author?.nom].filter(Boolean).join(" ") || "Kevin");
      const time = new Date(item.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      return `
        <div class="activity-item">
          <div class="activity-time">${time}</div>
          <div class="activity-text"><b>${escapeHtml(authorName)}</b> — ${escapeHtml(item.action)}${item.description ? " · " + escapeHtml(item.description) : ""}</div>
        </div>
      `;
    }).join("")}
  `).join("");
})();
