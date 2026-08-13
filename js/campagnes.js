// js/campagnes.js

let CAMP_PROFILE = null;
let CAMP_CANDIDATE_ID = null;
let ALL_CAMPAGNES = [];

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  CAMP_PROFILE = auth.profile;
  CAMP_CANDIDATE_ID = CAMP_PROFILE.role === "candidate" ? CAMP_PROFILE.id : CAMP_PROFILE.candidate_id;

  renderShell({ profile: CAMP_PROFILE, activePage: "campagnes.html", title: "Campagnes" });
  document.getElementById("campagnes-grid").innerHTML = skeletonCards(3);

  if (CAMP_PROFILE.role === "candidate") {
    document.getElementById("toolbar-actions").innerHTML = `<button class="btn btn-primary" id="btn-new-campagne">+ Nouvelle campagne</button>`;
    document.getElementById("btn-new-campagne").addEventListener("click", () => {
      document.getElementById("camp-nom").value = "";
      document.getElementById("camp-date_debut").value = "";
      document.getElementById("camp-date_fin").value = "";
      document.getElementById("camp-description").value = "";
      document.getElementById("camp-error").textContent = "";
      openModal("modal-campagne");
    });
    document.getElementById("btn-save-campagne").addEventListener("click", saveCampagne);
  }

  document.getElementById("btn-close-campagne-detail").addEventListener("click", () => {
    document.getElementById("campagne-detail-panel").classList.add("hidden");
    document.getElementById("campagnes-grid").classList.remove("hidden");
  });

  await loadCampagnes();
})();

async function loadCampagnes() {
  const { data: campagnes } = await supabaseClient
    .from("campagnes")
    .select("*")
    .eq("candidate_id", CAMP_CANDIDATE_ID)
    .order("date_debut", { ascending: false, nullsFirst: false });

  ALL_CAMPAGNES = campagnes || [];

  const { data: entreprises } = await supabaseClient
    .from("entreprises")
    .select("id, campagne_id, statut")
    .eq("candidate_id", CAMP_CANDIDATE_ID);

  const grid = document.getElementById("campagnes-grid");

  if (!ALL_CAMPAGNES.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">${ICONS.folder}</div>Aucune campagne créée pour le moment.</div>`;
    return;
  }

  grid.innerHTML = ALL_CAMPAGNES.map(c => {
    const ents = (entreprises || []).filter(e => e.campagne_id === c.id);
    const acceptees = ents.filter(e => e.statut === "Acceptée").length;
    return `
      <div class="panel" style="cursor:pointer;margin-bottom:0;" data-id="${c.id}">
        <h3>${escapeHtml(c.nom)}</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-top:4px;">${fmtDate(c.date_debut)}</p>
        <p style="margin-top:12px;font-size:22px;font-weight:800;">${ents.length} <span style="font-size:13px;font-weight:600;color:var(--text-muted);">entreprises</span></p>
        ${acceptees ? `<p style="color:var(--primary-dark);font-size:13px;font-weight:700;margin-top:4px;display:inline-flex;align-items:center;"><span class="icon">${ICONS.check}</span>${acceptees} acceptée(s)</p>` : ""}
      </div>
    `;
  }).join("");

  grid.querySelectorAll("[data-id]").forEach(card => {
    card.addEventListener("click", () => openCampagneDetail(card.dataset.id));
  });
}

async function openCampagneDetail(campagneId) {
  const camp = ALL_CAMPAGNES.find(c => c.id === campagneId);
  if (!camp) return;

  document.getElementById("campagnes-grid").classList.add("hidden");
  document.getElementById("campagne-detail-panel").classList.remove("hidden");
  document.getElementById("campagne-detail-title").textContent = `${camp.nom} — ${fmtDate(camp.date_debut)}`;

  const { data: entreprises } = await supabaseClient
    .from("entreprises")
    .select("*")
    .eq("candidate_id", CAMP_CANDIDATE_ID)
    .eq("campagne_id", campagneId)
    .order("nom");

  const wrap = document.getElementById("campagne-entreprises");
  if (!entreprises || !entreprises.length) {
    wrap.innerHTML = `<div class="empty-state">Aucune entreprise liée à cette campagne. Assigne une campagne à une entreprise depuis la page Entreprises (champ à ajouter lors de l'import CSV ou modification).</div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nom</th><th>Secteur</th><th>Poste</th><th>Statut</th></tr></thead>
        <tbody>
          ${entreprises.map(e => `
            <tr onclick="window.location.href='entreprises.html'">
              <td><b>${escapeHtml(e.nom)}</b></td>
              <td>${escapeHtml(e.secteur || "—")}</td>
              <td>${escapeHtml(e.poste || "—")}</td>
              <td>${badgeHtml(e.statut)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function saveCampagne() {
  const nom = document.getElementById("camp-nom").value.trim();
  const errEl = document.getElementById("camp-error");
  if (!nom) { errEl.textContent = "Le nom est obligatoire."; return; }

  const { error } = await supabaseClient.from("campagnes").insert({
    candidate_id: CAMP_CANDIDATE_ID,
    nom,
    date_debut: document.getElementById("camp-date_debut").value || null,
    date_fin: document.getElementById("camp-date_fin").value || null,
    description: document.getElementById("camp-description").value.trim() || null,
  });

  if (error) { errEl.textContent = "Erreur : " + error.message; return; }

  await logActivity(CAMP_CANDIDATE_ID, null, "Campagne créée", nom);
  closeModal("modal-campagne");
  await loadCampagnes();
}
