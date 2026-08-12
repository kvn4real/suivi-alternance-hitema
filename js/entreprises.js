// js/entreprises.js

let ALL_ENTREPRISES = [];
let CURRENT_FILTER = "Toutes";
let CURRENT_SEARCH = "";
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
  await loadCampagnesOptions();
  await loadEntreprises();

  document.getElementById("search-input").addEventListener("input", (e) => {
    CURRENT_SEARCH = e.target.value.toLowerCase();
    renderTable();
  });

  document.getElementById("entreprise-form").addEventListener("submit", (e) => e.preventDefault());
  document.getElementById("btn-save-entreprise").addEventListener("click", saveEntreprise);
})();

function renderToolbar() {
  const toolbar = document.getElementById("toolbar-actions");
  if (CURRENT_PROFILE.role === "candidate") {
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-add-entreprise">+ Ajouter une entreprise</button>
      <button class="btn" id="btn-open-import">📥 Importer des entreprises</button>
    `;
    document.getElementById("btn-add-entreprise").addEventListener("click", () => openEntrepriseForm(null));
    document.getElementById("btn-open-import").addEventListener("click", openImportModal);
  } else {
    toolbar.innerHTML = `<p style="color:var(--text-muted);font-size:14px;">Consultation des entreprises suivies.</p>`;
  }
}

async function loadCampagnesOptions() {
  const select = document.getElementById("ent-campagne_id");
  if (!select) return;
  const { data } = await supabaseClient
    .from("campagnes")
    .select("id, nom")
    .eq("candidate_id", CURRENT_CANDIDATE_ID)
    .order("date_debut", { ascending: false });
  (data || []).forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nom;
    select.appendChild(opt);
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
      renderTable();
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
  renderTable();
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
    empty.innerHTML = `<div class="empty-state"><div class="icon">🏢</div>Aucune entreprise trouvée.</div>`;
    return;
  }
  empty.innerHTML = "";

  tbody.innerHTML = rows.map(e => `
    <tr data-id="${e.id}">
      <td><b>${escapeHtml(e.nom)}</b></td>
      <td>${escapeHtml(e.secteur || "—")}</td>
      <td>${escapeHtml(e.localisation || "—")}</td>
      <td>${escapeHtml(e.poste || "—")}</td>
      <td>${badgeHtml(e.statut)}</td>
      <td>${fmtDate(e.date_ajout)}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", () => openDetail(tr.dataset.id));
  });
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
      ${e.site_web ? `<a class="btn btn-sm" href="${escapeHtml(e.site_web)}" target="_blank" rel="noopener">🌐 Site</a>` : ""}
      ${e.url_offre ? `<a class="btn btn-sm" href="${escapeHtml(e.url_offre)}" target="_blank" rel="noopener">📄 Offre</a>` : ""}
      ${e.email ? `<a class="btn btn-sm" href="mailto:${escapeHtml(e.email)}">✉️ Contacter</a>` : ""}
      ${isCandidate ? `<button class="btn btn-sm btn-primary" id="btn-generate-letter">✨ Générer ma lettre</button>` : ""}
      ${isCandidate ? `<button class="btn btn-sm" id="btn-edit-entreprise">✏️ Modifier</button>` : ""}
      ${isCandidate ? `<button class="btn btn-sm btn-danger" id="btn-delete-entreprise">🗑️ Supprimer</button>` : ""}
    </div>

    <div style="margin-top:20px;">
      <h4 style="margin-bottom:10px;">📝 Notes</h4>
      <div id="notes-list"></div>
      <form id="note-form" style="margin-top:10px;display:flex;gap:8px;">
        <input type="text" id="note-input" placeholder="Ajouter une note..." style="flex:1;padding:9px 12px;border-radius:10px;border:1px solid var(--border);" />
        <button class="btn btn-sm btn-primary" type="submit">Ajouter</button>
      </form>
    </div>

    <div style="margin-top:20px;">
      <h4 style="margin-bottom:10px;">✉️ Historique des lettres</h4>
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
  if (error) { alert("Erreur : " + error.message); return; }
  const ent = ALL_ENTREPRISES.find(x => x.id === id);
  await logActivity(CURRENT_CANDIDATE_ID, id, "Statut modifié", `${ent?.nom || ""} → ${statut}`);
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
        <span class="note-author ${isCompanion ? "companion" : ""}">💬 Note de ${escapeHtml(authorName)}</span>
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
  if (error) { alert("Erreur : " + error.message); return; }

  const ent = ALL_ENTREPRISES.find(x => x.id === entrepriseId);
  await logActivity(CURRENT_CANDIDATE_ID, entrepriseId, "Note ajoutée", `Note ajoutée sur ${ent?.nom || ""}`);

  input.value = "";
  await loadNotes(entrepriseId);
}

// ============================================================
// LETTRES
// ============================================================
async function loadLettresForEntreprise(entrepriseId) {
  const { data } = await supabaseClient
    .from("lettres")
    .select("id,titre,created_at")
    .eq("entreprise_id", entrepriseId)
    .order("created_at", { ascending: false });

  const list = document.getElementById("letters-list");
  if (!data || !data.length) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">Aucune lettre générée pour cette entreprise.</p>`;
    return;
  }
  list.innerHTML = data.map((l, i) => `
    <div class="detail-row">
      <span class="k">Lettre #${data.length - i} — ${escapeHtml(l.titre || "")}</span>
      <span class="v"><a href="lettres.html?id=${l.id}" class="btn btn-sm btn-ghost">${fmtDate(l.created_at)} · Voir →</a></span>
    </div>
  `).join("");
}

async function generateLetter(entrepriseId, nom) {
  const btn = document.getElementById("btn-generate-letter");
  btn.disabled = true;
  btn.textContent = "Génération en cours...";

  try {
    const res = await fetch(`${FUNCTIONS_URL}/generate-letter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CURRENT_SESSION.access_token}`,
      },
      body: JSON.stringify({ entreprise_id: entrepriseId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Erreur lors de la génération.");
      return;
    }
    await loadLettresForEntreprise(entrepriseId);
    window.location.href = `lettres.html?id=${data.lettre.id}`;
  } catch (e) {
    alert("Erreur réseau lors de l'appel à l'IA.");
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = "✨ Générer ma lettre";
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
  if (!(await confirmDialog("Êtes-vous sûr de vouloir supprimer cette entreprise ?"))) return;
  const ent = ALL_ENTREPRISES.find(x => x.id === id);
  const { error } = await supabaseClient.from("entreprises").delete().eq("id", id);
  if (error) { alert("Erreur : " + error.message); return; }
  await logActivity(CURRENT_CANDIDATE_ID, null, "Entreprise supprimée", ent?.nom || "");
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
  }));

  const { error } = await supabaseClient.from("entreprises").insert(payload);
  btn.disabled = false;
  btn.textContent = "Importer";

  if (error) {
    document.getElementById("import-error").textContent = "Erreur : " + error.message;
    return;
  }

  await logActivity(CURRENT_CANDIDATE_ID, null, "Import CSV", `${payload.length} entreprises importées`);
  closeModal("modal-import");
  await loadEntreprises();
}
