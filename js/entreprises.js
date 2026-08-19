// js/entreprises.js

let ALL_ENTREPRISES = [];
let CURRENT_FILTER = "Toutes";
let CURRENT_SEARCH = "";
let CURRENT_VIEW = localStorage.getItem("entreprises-view") || "table";
let CURRENT_PROFILE = null;
let CURRENT_CANDIDATE_ID = null;
let CURRENT_SESSION = null;
let PARSED_CSV_ROWS = [];

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile, session } = auth;
  CURRENT_PROFILE = profile;
  CURRENT_SESSION = session;
  CURRENT_CANDIDATE_ID = profile.role === "candidate" ? profile.id : profile.candidate_id;

  renderShell({ profile, activePage: "entreprises.html", title: "Entreprises" });

  renderToolbar();
  renderFilterChips();
  document.getElementById("entreprises-tbody").innerHTML = `
    <tr><td colspan="6"><div class="skeleton-line" style="height:16px;"></div></td></tr>
    <tr><td colspan="6"><div class="skeleton-line" style="height:16px;width:85%;"></div></td></tr>
    <tr><td colspan="6"><div class="skeleton-line" style="height:16px;width:70%;"></div></td></tr>
  `;
  await loadCampagnesOptions();
  await loadEntreprises();

  document.getElementById("search-input").addEventListener("input", (e) => {
    CURRENT_SEARCH = e.target.value.toLowerCase();
    renderView();
  });

  document.querySelectorAll(".view-toggle-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === CURRENT_VIEW);
    btn.addEventListener("click", () => {
      CURRENT_VIEW = btn.dataset.view;
      localStorage.setItem("entreprises-view", CURRENT_VIEW);
      document.querySelectorAll(".view-toggle-btn").forEach(b => b.classList.toggle("active", b === btn));
      if (CURRENT_VIEW === "kanban") {
        CURRENT_FILTER = "Toutes";
        renderFilterChips();
      }
      applyView();
      renderView();
    });
  });
  applyView();

  document.getElementById("entreprise-form").addEventListener("submit", (e) => e.preventDefault());
  document.getElementById("btn-save-entreprise").addEventListener("click", saveEntreprise);
})();

function applyView() {
  document.getElementById("view-table").classList.toggle("hidden", CURRENT_VIEW !== "table");
  document.getElementById("view-kanban").classList.toggle("hidden", CURRENT_VIEW !== "kanban");
  // En vue Kanban, les colonnes remplacent déjà les filtres de statut.
  document.getElementById("filter-chips").classList.toggle("hidden", CURRENT_VIEW === "kanban");
}

function renderToolbar() {
  const toolbar = document.getElementById("toolbar-actions");
  const densityBtn = `
    <button class="btn btn-ghost density-toggle" id="btn-toggle-density" title="Basculer la densité du tableau">
      <span class="icon">${ICONS.chart}</span><span id="density-label">Vue compacte</span>
    </button>
  `;
  const exportBtns = `
    <button class="btn" id="btn-export-csv"><span class="icon">${ICONS.file}</span>Exporter CSV</button>
    <button class="btn" id="btn-export-pdf"><span class="icon">${ICONS.file}</span>Exporter PDF</button>
  `;
  if (CURRENT_PROFILE.role === "candidate") {
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-add-entreprise">+ Ajouter une entreprise</button>
      <button class="btn" id="btn-open-import"><span class="icon">${ICONS.download}</span>Importer des entreprises</button>
      ${exportBtns}
      ${densityBtn}
    `;
    document.getElementById("btn-add-entreprise").addEventListener("click", () => openEntrepriseForm(null));
    document.getElementById("btn-open-import").addEventListener("click", openImportModal);
  } else {
    toolbar.innerHTML = `<p style="color:var(--text-muted);font-size:14px;">Consultation des entreprises suivies.</p>${exportBtns}${densityBtn}`;
  }

  document.getElementById("btn-export-csv").addEventListener("click", exportCsv);
  document.getElementById("btn-export-pdf").addEventListener("click", exportPdf);

  const table = document.querySelector("table.data-table");
  const isCompact = localStorage.getItem("entreprises-density") === "compact";
  table.classList.toggle("compact", isCompact);
  document.getElementById("density-label").textContent = isCompact ? "Vue confortable" : "Vue compacte";
  document.getElementById("btn-toggle-density").addEventListener("click", () => {
    const nowCompact = !table.classList.contains("compact");
    table.classList.toggle("compact", nowCompact);
    localStorage.setItem("entreprises-density", nowCompact ? "compact" : "comfortable");
    document.getElementById("density-label").textContent = nowCompact ? "Vue confortable" : "Vue compacte";
  });
}

async function loadCampagnesOptions() {
  const selectForm = document.getElementById("ent-campagne_id");
  const selectImport = document.getElementById("import-campagne_id");
  if (!selectForm && !selectImport) return;
  const { data } = await supabaseClient
    .from("campagnes")
    .select("id, nom")
    .eq("candidate_id", CURRENT_CANDIDATE_ID)
    .order("date_debut", { ascending: false });
  (data || []).forEach(c => {
    if (selectForm) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nom;
      selectForm.appendChild(opt);
    }
    if (selectImport) {
      const opt2 = document.createElement("option");
      opt2.value = c.id;
      opt2.textContent = c.nom;
      selectImport.appendChild(opt2);
    }
  });
}

function renderFilterChips() {
  const filters = ["Toutes", ...STATUT_ORDER];
  document.getElementById("filter-chips").innerHTML = filters.map(f => `
    <button type="button" class="chip ${f === CURRENT_FILTER ? "active" : ""}" data-filter="${escapeHtml(f)}">${escapeHtml(f)}</button>
  `).join("");
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      CURRENT_FILTER = chip.dataset.filter;
      renderFilterChips();
      renderView();
    });
  });
}

async function loadEntreprises() {
  const { data, error } = await supabaseClient
    .from("entreprises")
    .select("*")
    .eq("candidate_id", CURRENT_CANDIDATE_ID)
    .order("date_ajout", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  ALL_ENTREPRISES = data || [];
  renderView();
}

function renderView() {
  if (CURRENT_VIEW === "kanban") renderKanban();
  else renderTable();
}

function filteredEntreprises() {
  return ALL_ENTREPRISES.filter(e => {
    if (CURRENT_FILTER !== "Toutes" && e.statut !== CURRENT_FILTER) return false;
    if (CURRENT_SEARCH) {
      const haystack = [e.nom, e.email, e.localisation, e.secteur, e.poste].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(CURRENT_SEARCH)) return false;
    }
    return true;
  });
}

function renderTable() {
  const rows = filteredEntreprises();
  const tbody = document.getElementById("entreprises-tbody");
  const empty = document.getElementById("empty-state");

  if (!rows.length) {
    tbody.innerHTML = "";
    empty.innerHTML = `<div class="empty-state"><div class="icon">${ICONS.building}</div>Aucune entreprise trouvée.</div>`;
    return;
  }
  empty.innerHTML = "";

  tbody.innerHTML = rows.map(e => `
    <tr data-id="${e.id}">
      <td data-label="Nom"><b>${escapeHtml(e.nom)}</b></td>
      <td data-label="Secteur">${escapeHtml(e.secteur || "—")}</td>
      <td data-label="Ville">${escapeHtml(e.localisation || "—")}</td>
      <td data-label="Poste">${escapeHtml(e.poste || "—")}</td>
      <td data-label="Statut">${badgeHtml(e.statut)}</td>
      <td data-label="Date">${fmtDate(e.date_ajout)}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", () => openDetail(tr.dataset.id));
  });
}

// ============================================================
// VUE KANBAN
// ============================================================
function kanbanFilteredEntreprises() {
  // La recherche s'applique, mais pas le filtre de statut (représenté par les colonnes).
  return ALL_ENTREPRISES.filter(e => {
    if (CURRENT_SEARCH) {
      const haystack = [e.nom, e.email, e.localisation, e.secteur, e.poste].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(CURRENT_SEARCH)) return false;
    }
    return true;
  });
}

function renderKanban() {
  const board = document.getElementById("view-kanban");
  const rows = kanbanFilteredEntreprises();
  const isCandidate = CURRENT_PROFILE.role === "candidate";

  board.innerHTML = STATUT_ORDER.map(statut => {
    const cards = rows.filter(e => e.statut === statut);
    return `
      <div class="kanban-column" data-statut="${escapeHtml(statut)}">
        <div class="kanban-column-header">
          <span>${escapeHtml(statut)}</span>
          <span class="kanban-column-count">${cards.length}</span>
        </div>
        <div class="kanban-cards" data-statut="${escapeHtml(statut)}">
          ${cards.length ? cards.map(e => `
            <div class="kanban-card" draggable="${isCandidate}" data-id="${e.id}">
              <div class="kc-nom">${escapeHtml(e.nom)}</div>
              ${e.poste ? `<div class="kc-poste">${escapeHtml(e.poste)}</div>` : ""}
              <div class="kc-date">${fmtDate(e.date_ajout)}</div>
            </div>
          `).join("") : `<div class="kanban-empty">Vide</div>`}
        </div>
      </div>
    `;
  }).join("");

  // Ouvrir le détail au clic sur une carte
  board.querySelectorAll(".kanban-card").forEach(card => {
    card.addEventListener("click", () => openDetail(card.dataset.id));
  });

  if (!isCandidate) return; // l'accompagnateur ne peut pas glisser les cartes

  // Drag & drop
  let draggedId = null;

  board.querySelectorAll(".kanban-card").forEach(card => {
    card.addEventListener("dragstart", (e) => {
      draggedId = card.dataset.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      draggedId = null;
    });
  });

  board.querySelectorAll(".kanban-column").forEach(col => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      if (!draggedId) return;
      const newStatut = col.dataset.statut;
      const ent = ALL_ENTREPRISES.find(x => x.id === draggedId);
      if (!ent || ent.statut === newStatut) return;
      await updateStatut(draggedId, newStatut);
    });
  });
}

// ============================================================
// EXPORT
// ============================================================
const EXPORT_COLUMNS = [
  { key: "nom", label: "Nom" },
  { key: "secteur", label: "Secteur" },
  { key: "localisation", label: "Ville" },
  { key: "poste", label: "Poste" },
  { key: "statut", label: "Statut" },
  { key: "email", label: "Email" },
  { key: "telephone", label: "Téléphone" },
  { key: "site_web", label: "Site web" },
  { key: "url_offre", label: "URL offre" },
  { key: "date_candidature", label: "Date candidature", fmt: fmtDate },
  { key: "date_relance", label: "Date relance", fmt: fmtDate },
  { key: "date_ajout", label: "Date ajout", fmt: fmtDate },
];

function csvEscape(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(str)) return `"${str.replaceAll('"', '""')}"`;
  return str;
}

function exportCsv() {
  const rows = filteredEntreprises();
  if (!rows.length) { showToast("Aucune entreprise à exporter.", "error"); return; }

  const header = EXPORT_COLUMNS.map(c => c.label).join(";");
  const lines = rows.map(e =>
    EXPORT_COLUMNS.map(c => csvEscape(c.fmt ? c.fmt(e[c.key]) : e[c.key])).join(";")
  );
  const csv = "\uFEFF" + [header, ...lines].join("\n"); // BOM pour un bon affichage des accents dans Excel

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `entreprises-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`${rows.length} entreprise(s) exportée(s) en CSV.`, "success");
}

function exportPdf() {
  const rows = filteredEntreprises();
  if (!rows.length) { showToast("Aucune entreprise à exporter.", "error"); return; }
  if (typeof window.jspdf === "undefined") { showToast("Le module PDF n'a pas pu se charger.", "error"); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(14);
  doc.text("Suivi des candidatures — Alternance Suite", 40, 36);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exporté le ${fmtDate(new Date().toISOString())} · ${rows.length} entreprise(s)`, 40, 52);

  const head = [["Nom", "Secteur", "Ville", "Poste", "Statut", "Date candidature", "Date relance"]];
  const body = rows.map(e => [
    e.nom || "—",
    e.secteur || "—",
    e.localisation || "—",
    e.poste || "—",
    e.statut || "—",
    fmtDate(e.date_candidature),
    fmtDate(e.date_relance),
  ]);

  doc.autoTable({
    head,
    body,
    startY: 66,
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [22, 168, 121], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 248] },
  });

  doc.save(`entreprises-${new Date().toISOString().slice(0, 10)}.pdf`);
  showToast(`${rows.length} entreprise(s) exportée(s) en PDF.`, "success");
}

// ============================================================
// DÉTAIL / MODAL
// ============================================================
async function openDetail(id) {
  const e = ALL_ENTREPRISES.find(x => x.id === id);
  if (!e) return;

  document.getElementById("detail-nom").textContent = e.nom;

  const isCandidate = CURRENT_PROFILE.role === "candidate";

  document.getElementById("detail-body").innerHTML = `
    <div class="detail-row"><span class="k">Poste</span><span class="v">${escapeHtml(e.poste || "—")}</span></div>
    <div class="detail-row"><span class="k">Secteur</span><span class="v">${escapeHtml(e.secteur || "—")}</span></div>
    <div class="detail-row"><span class="k">Localisation</span><span class="v">${escapeHtml(e.localisation || "—")}</span></div>
    <div class="detail-row"><span class="k">Email</span><span class="v">${escapeHtml(e.email || "—")}</span></div>
    <div class="detail-row"><span class="k">Téléphone</span><span class="v">${escapeHtml(e.telephone || "—")}</span></div>
    <div class="detail-row"><span class="k">Statut</span><span class="v">${badgeHtml(e.statut)}</span></div>
    <div class="detail-row"><span class="k">Date de candidature</span><span class="v">${fmtDate(e.date_candidature)}</span></div>
    <div class="detail-row"><span class="k">Date de relance</span><span class="v">${fmtDate(e.date_relance)}</span></div>
    ${e.description ? `<div style="margin-top:12px;"><b>Description</b><p style="margin-top:4px;white-space:pre-wrap;">${escapeHtml(e.description)}</p></div>` : ""}
    ${e.notes ? `<div style="margin-top:12px;"><b>Notes internes</b><p style="margin-top:4px;white-space:pre-wrap;">${escapeHtml(e.notes)}</p></div>` : ""}

    ${isCandidate ? `
      <div style="margin-top:16px;">
        <label style="font-size:13px;font-weight:600;color:var(--text-muted);">Changer le statut</label>
        <select id="quick-statut" style="width:100%;margin-top:6px;padding:10px;border-radius:10px;border:1px solid var(--border);">
          ${STATUT_ORDER.map(s => `<option ${s === e.statut ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
    ` : ""}

    <div class="action-row">
      ${e.site_web ? `<a class="btn btn-sm" href="${escapeHtml(e.site_web)}" target="_blank" rel="noopener"><span class="icon">${ICONS.globe}</span>Site</a>` : ""}
      ${e.url_offre ? `<a class="btn btn-sm" href="${escapeHtml(e.url_offre)}" target="_blank" rel="noopener"><span class="icon">${ICONS.file}</span>Offre</a>` : ""}
      ${e.email ? `<a class="btn btn-sm" href="mailto:${escapeHtml(e.email)}"><span class="icon">${ICONS.mail}</span>Contacter</a>` : ""}
      ${isCandidate ? `<button class="btn btn-sm btn-primary" id="btn-generate-letter"><span class="icon">${ICONS.sparkle}</span>Générer ma lettre</button>` : ""}
      ${isCandidate ? `<button class="btn btn-sm" id="btn-edit-entreprise"><span class="icon">${ICONS.edit}</span>Modifier</button>` : ""}
      ${isCandidate ? `<button class="btn btn-sm btn-danger" id="btn-delete-entreprise"><span class="icon">${ICONS.trash}</span>Supprimer</button>` : ""}
    </div>

    <div style="margin-top:20px;">
      <h4 style="margin-bottom:10px;display:flex;align-items:center;"><span class="icon">${ICONS.edit}</span>Notes</h4>
      <div id="notes-list"></div>
      <form id="note-form" style="margin-top:10px;display:flex;gap:8px;">
        <input type="text" id="note-input" placeholder="Ajouter une note..." style="flex:1;padding:9px 12px;border-radius:10px;border:1px solid var(--border);" />
        <button class="btn btn-sm btn-primary" type="submit">Ajouter</button>
      </form>
    </div>

    <div style="margin-top:20px;">
      <h4 style="margin-bottom:10px;display:flex;align-items:center;"><span class="icon">${ICONS.mail}</span>Historique des lettres</h4>
      <div id="letters-list"></div>
    </div>
  `;

  if (isCandidate) {
    document.getElementById("quick-statut").addEventListener("change", (ev) => updateStatut(e.id, ev.target.value));
    document.getElementById("btn-generate-letter").addEventListener("click", () => generateLetter(e.id, e.nom));
    document.getElementById("btn-edit-entreprise").addEventListener("click", () => { closeModal("modal-detail"); openEntrepriseForm(e); });
    document.getElementById("btn-delete-entreprise").addEventListener("click", () => deleteEntreprise(e.id));
  }

  document.getElementById("note-form").addEventListener("submit", (ev) => addNote(ev, e.id));

  await loadNotes(e.id);
  await loadLettresForEntreprise(e.id);

  openModal("modal-detail");
}

async function updateStatut(id, statut) {
  const patch = { statut };
  if (statut === "Candidature envoyée") patch.date_candidature = new Date().toISOString().slice(0, 10);
  const { error } = await supabaseClient.from("entreprises").update(patch).eq("id", id);
  if (error) { showToast("Erreur : " + error.message, "error"); return; }
  const ent = ALL_ENTREPRISES.find(x => x.id === id);
  await logActivity(CURRENT_CANDIDATE_ID, id, "Statut modifié", `${ent?.nom || ""} → ${statut}`);
  showToast("Statut mis à jour.", "success");
  await loadEntreprises();
}

// ============================================================
// NOTES
// ============================================================
async function loadNotes(entrepriseId) {
  const { data } = await supabaseClient
    .from("notes")
    .select("*, author:profiles!notes_author_id_fkey(prenom,nom,role)")
    .eq("entreprise_id", entrepriseId)
    .order("created_at", { ascending: false });

  const list = document.getElementById("notes-list");
  if (!data || !data.length) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">Aucune note pour le moment.</p>`;
    return;
  }
  list.innerHTML = data.map(n => {
    const isCompanion = n.author?.role === "companion";
    const authorName = isCompanion ? "l'accompagnateur" : (n.author ? [n.author.prenom, n.author.nom].filter(Boolean).join(" ") || "Kevin" : "Kevin");
    return `
      <div class="note-item">
        <span class="note-author ${isCompanion ? "companion" : ""}" style="display:inline-flex;align-items:center;"><span class="icon">${ICONS.message}</span>Note de ${escapeHtml(authorName)}</span>
        <span class="note-date">${fmtDateTime(n.created_at)}</span>
        <div class="note-content">${escapeHtml(n.contenu)}</div>
      </div>
    `;
  }).join("");
}

async function addNote(ev, entrepriseId) {
  ev.preventDefault();
  const input = document.getElementById("note-input");
  const contenu = input.value.trim();
  if (!contenu) return;

  const { error } = await supabaseClient.from("notes").insert({
    candidate_id: CURRENT_CANDIDATE_ID,
    entreprise_id: entrepriseId,
    author_id: CURRENT_PROFILE.id,
    contenu,
    type: "note",
  });
  if (error) { showToast("Erreur : " + error.message, "error"); return; }

  const ent = ALL_ENTREPRISES.find(x => x.id === entrepriseId);
  await logActivity(CURRENT_CANDIDATE_ID, entrepriseId, "Note ajoutée", `Note ajoutée sur ${ent?.nom || ""}`);

  input.value = "";
  await loadNotes(entrepriseId);
}

// ============================================================
// LETTRES
// ============================================================
async function generateLetter(entrepriseId, nom) {
  const btn = document.getElementById("btn-generate-letter");

  btn.disabled = true;
  btn.textContent = "Génération en cours...";

  try {
    // Récupérer une session fraîche
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();

    if (sessionError || !session) {
      showToast("Votre session a expiré. Veuillez vous reconnecter.", "error");
      return;
    }

    const res = await fetch(
      `${FUNCTIONS_URL}/generate-letter`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "Authorization": `Bearer ${session.access_token}`,

          "apikey": SUPABASE_ANON_KEY,
        },

        body: JSON.stringify({
          entreprise_id: entrepriseId,
        }),
      }
    );

    // Lire la réponse même en cas d'erreur
    const data = await res.json();

    if (!res.ok) {
      console.error(
        "Erreur generate-letter :",
        res.status,
        data
      );

      showToast(
        data.error || "Erreur lors de la génération.",
        "error"
      );

      return;
    }

    await loadLettresForEntreprise(entrepriseId);

    window.location.href =
      `lettres.html?id=${data.lettre.id}`;

  } catch (error) {
    console.error(
      "Erreur réseau generate-letter :",
      error
    );

    showToast(
      "Impossible de contacter le service de génération.",
      "error"
    );

  } finally {
    btn.disabled = false;

    btn.innerHTML =
      `<span class="icon">${ICONS.sparkle}</span>Générer ma lettre`;
  }
}

// ============================================================
// CRUD ENTREPRISE
// ============================================================
function openEntrepriseForm(entreprise) {
  document.getElementById("form-title").textContent = entreprise ? "Modifier l'entreprise" : "Ajouter une entreprise";
  document.getElementById("form-error").textContent = "";
  const fields = ["nom", "poste", "email", "telephone", "site_web", "localisation", "secteur", "statut", "date_candidature", "date_relance", "campagne_id", "url_offre", "description", "notes"];
  fields.forEach(f => {
    document.getElementById(`ent-${f}`).value = entreprise ? (entreprise[f] || "") : "";
  });
  document.getElementById("ent-id").value = entreprise ? entreprise.id : "";
  openModal("modal-form");
}

async function saveEntreprise() {
  const id = document.getElementById("ent-id").value;
  const nom = document.getElementById("ent-nom").value.trim();
  const errEl = document.getElementById("form-error");
  errEl.textContent = "";

  if (!nom) {
    errEl.textContent = "Le nom de l'entreprise est obligatoire.";
    return;
  }

  const payload = {
    nom,
    poste: document.getElementById("ent-poste").value.trim() || null,
    email: document.getElementById("ent-email").value.trim() || null,
    telephone: document.getElementById("ent-telephone").value.trim() || null,
    site_web: document.getElementById("ent-site_web").value.trim() || null,
    localisation: document.getElementById("ent-localisation").value.trim() || null,
    secteur: document.getElementById("ent-secteur").value.trim() || null,
    statut: document.getElementById("ent-statut").value,
    date_candidature: document.getElementById("ent-date_candidature").value || null,
    date_relance: document.getElementById("ent-date_relance").value || null,
    campagne_id: document.getElementById("ent-campagne_id").value || null,
    url_offre: document.getElementById("ent-url_offre").value.trim() || null,
    description: document.getElementById("ent-description").value.trim() || null,
    notes: document.getElementById("ent-notes").value.trim() || null,
  };

  let error, entrepriseId = id;
  if (id) {
    ({ error } = await supabaseClient.from("entreprises").update(payload).eq("id", id));
  } else {
    payload.candidate_id = CURRENT_CANDIDATE_ID;
    const { data, error: insErr } = await supabaseClient.from("entreprises").insert(payload).select().single();
    error = insErr;
    if (data) entrepriseId = data.id;
  }

  if (error) {
    errEl.textContent = "Erreur : " + error.message;
    return;
  }

  await logActivity(CURRENT_CANDIDATE_ID, entrepriseId, id ? "Entreprise modifiée" : "Entreprise ajoutée", nom);
  closeModal("modal-form");
  await loadEntreprises();
}

async function deleteEntreprise(id) {
  if (!(await confirmDialog("Êtes-vous sûr de vouloir supprimer cette entreprise ? Cette action est irréversible.", { title: "Supprimer l'entreprise" }))) return;
  const ent = ALL_ENTREPRISES.find(x => x.id === id);
  const { error } = await supabaseClient.from("entreprises").delete().eq("id", id);
  if (error) { showToast("Erreur : " + error.message, "error"); return; }
  await logActivity(CURRENT_CANDIDATE_ID, null, "Entreprise supprimée", ent?.nom || "");
  showToast("Entreprise supprimée.", "success");
  closeModal("modal-detail");
  await loadEntreprises();
}

// ============================================================
// IMPORT CSV
// ============================================================
function openImportModal() {
  PARSED_CSV_ROWS = [];
  document.getElementById("csv-file").value = "";
  document.getElementById("csv-preview").innerHTML = "";
  document.getElementById("import-error").textContent = "";
  document.getElementById("btn-confirm-import").disabled = true;
  const campSelect = document.getElementById("import-campagne_id");
  if (campSelect) campSelect.value = "";
  openModal("modal-import");

  document.getElementById("csv-file").onchange = handleCsvFile;
  document.getElementById("btn-confirm-import").onclick = confirmImport;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] || "").trim(); });
    if (row.nom) rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === "," && !inQuotes) { result.push(cur); cur = ""; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}

function handleCsvFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const rows = parseCsv(ev.target.result);
    PARSED_CSV_ROWS = rows;
    const errEl = document.getElementById("import-error");
    if (!rows.length) {
      errEl.textContent = "Aucune entreprise valide détectée (colonne 'nom' requise).";
      document.getElementById("btn-confirm-import").disabled = true;
      document.getElementById("csv-preview").innerHTML = "";
      return;
    }
    errEl.textContent = "";
    document.getElementById("btn-confirm-import").disabled = false;
    document.getElementById("csv-preview").innerHTML = `
      <p style="font-weight:700;margin-bottom:8px;">${rows.length} entreprises détectées</p>
      <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;">
        ${rows.slice(0, 20).map(r => `<div style="padding:8px 12px;border-bottom:1px solid var(--border);font-size:13px;">${escapeHtml(r.nom)} ${r.poste ? "— " + escapeHtml(r.poste) : ""}</div>`).join("")}
        ${rows.length > 20 ? `<div style="padding:8px 12px;color:var(--text-muted);font-size:13px;">+ ${rows.length - 20} autres...</div>` : ""}
      </div>
    `;
  };
  reader.readAsText(file, "UTF-8");
}

async function confirmImport() {
  if (!PARSED_CSV_ROWS.length) return;
  const btn = document.getElementById("btn-confirm-import");
  btn.disabled = true;
  btn.textContent = "Import en cours...";

  const campagneId = document.getElementById("import-campagne_id")?.value || null;

  const payload = PARSED_CSV_ROWS.map(r => ({
    candidate_id: CURRENT_CANDIDATE_ID,
    nom: r.nom,
    email: r.email || null,
    site_web: r.site_web || null,
    localisation: r.localisation || null,
    secteur: r.secteur || null,
    poste: r.poste || null,
    url_offre: r.url_offre || null,
    description: r.description || null,
    telephone: r.telephone || null,
    campagne_id: campagneId,
  }));

  const { error } = await supabaseClient.from("entreprises").insert(payload);
  btn.disabled = false;
  btn.textContent = "Importer";

  if (error) {
    document.getElementById("import-error").textContent = "Erreur : " + error.message;
    return;
  }

  await logActivity(CURRENT_CANDIDATE_ID, null, "Import CSV", `${payload.length} entreprises importées`);
  showToast(`${payload.length} entreprise(s) importée(s).`, "success");
  closeModal("modal-import");
  await loadEntreprises();
}
