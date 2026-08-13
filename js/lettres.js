// js/lettres.js

let CUR_PROFILE = null;
let CUR_CANDIDATE_ID = null;
let CUR_SESSION = null;

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  CUR_PROFILE = auth.profile;
  CUR_SESSION = auth.session;
  CUR_CANDIDATE_ID = CUR_PROFILE.role === "candidate" ? CUR_PROFILE.id : CUR_PROFILE.candidate_id;

  renderShell({ profile: CUR_PROFILE, activePage: "lettres.html", title: "Lettres" });

  const params = new URLSearchParams(window.location.search);
  const letterId = params.get("id");

  if (letterId) {
    await showEditor(letterId);
  } else {
    await showList();
  }
})();

async function showList() {
  document.getElementById("letters-list-panel").classList.remove("hidden");
  document.getElementById("letter-editor-panel").classList.add("hidden");

  const { data, error } = await supabaseClient
    .from("lettres")
    .select("id, titre, created_at, updated_at, entreprises(nom)")
    .eq("candidate_id", CUR_CANDIDATE_ID)
    .order("created_at", { ascending: false });

  const wrap = document.getElementById("letters-table");
  if (error || !data || !data.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="icon">${ICONS.mail}</div>Aucune lettre générée pour le moment.</div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Entreprise</th><th>Titre</th><th>Créée le</th><th>Modifiée le</th></tr></thead>
        <tbody>
          ${data.map(l => `
            <tr data-id="${l.id}">
              <td><b>${escapeHtml(l.entreprises?.nom || "—")}</b></td>
              <td>${escapeHtml(l.titre || "—")}</td>
              <td>${fmtDate(l.created_at)}</td>
              <td>${fmtDate(l.updated_at)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  wrap.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", () => { window.location.href = `lettres.html?id=${tr.dataset.id}`; });
  });
}

async function showEditor(letterId) {
  document.getElementById("letters-list-panel").classList.add("hidden");
  document.getElementById("letter-editor-panel").classList.remove("hidden");

  const { data: lettre, error } = await supabaseClient
    .from("lettres")
    .select("*, entreprises(id, nom)")
    .eq("id", letterId)
    .single();

  if (error || !lettre) {
    document.getElementById("letter-editor-panel").innerHTML = `<div class="empty-state">Lettre introuvable.</div>`;
    return;
  }

  document.getElementById("editor-entreprise-name").textContent = `Lettre — ${lettre.entreprises?.nom || ""}`;
  document.getElementById("editor-date").textContent = `Créée le ${fmtDateTime(lettre.created_at)} · Modifiée le ${fmtDateTime(lettre.updated_at)}`;

  const textarea = document.getElementById("letter-content");
  textarea.value = lettre.contenu;
  textarea.readOnly = true;

  const isCandidate = CUR_PROFILE.role === "candidate";

  document.getElementById("editor-actions").innerHTML = `
    <button class="btn btn-sm" id="btn-copy"><span class="icon">${ICONS.copy}</span>Copier</button>
    <button class="btn btn-sm" id="btn-pdf"><span class="icon">${ICONS.file}</span>Télécharger PDF</button>
    ${isCandidate ? `<button class="btn btn-sm" id="btn-edit-toggle"><span class="icon">${ICONS.edit}</span>Modifier</button>` : ""}
    ${isCandidate ? `<button class="btn btn-sm btn-primary hidden" id="btn-save"><span class="icon">${ICONS.save}</span>Enregistrer</button>` : ""}
    ${isCandidate ? `<button class="btn btn-sm" id="btn-regenerate"><span class="icon">${ICONS.refresh}</span>Régénérer</button>` : ""}
    ${isCandidate ? `<button class="btn btn-sm btn-danger" id="btn-delete-letter"><span class="icon">${ICONS.trash}</span>Supprimer</button>` : ""}
  `;

  document.getElementById("btn-copy").addEventListener("click", async () => {
    await navigator.clipboard.writeText(textarea.value);
    flashButton("btn-copy", `<span class="icon">${ICONS.check}</span>Copié !`);
  });

  document.getElementById("btn-pdf").addEventListener("click", () => downloadPdf(textarea.value, lettre.entreprises?.nom));

  if (isCandidate) {
    document.getElementById("btn-edit-toggle").addEventListener("click", () => {
      textarea.readOnly = !textarea.readOnly;
      textarea.focus();
      document.getElementById("btn-save").classList.toggle("hidden", textarea.readOnly);
    });

    document.getElementById("btn-save").addEventListener("click", async () => {
      const { error: updErr } = await supabaseClient
        .from("lettres")
        .update({ contenu: textarea.value })
        .eq("id", letterId);
      if (updErr) { alert("Erreur : " + updErr.message); return; }
      textarea.readOnly = true;
      document.getElementById("btn-save").classList.add("hidden");
      flashButton("btn-save", `<span class="icon">${ICONS.check}</span>Enregistré`);
      await logActivity(CUR_CANDIDATE_ID, lettre.entreprises?.id, "Lettre modifiée", `Lettre modifiée pour ${lettre.entreprises?.nom || ""}`);
    });

    document.getElementById("btn-regenerate").addEventListener("click", async () => {
      const btn = document.getElementById("btn-regenerate");
      btn.disabled = true;
      btn.textContent = "Régénération...";
      try {
        const res = await fetch(`${FUNCTIONS_URL}/generate-letter`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${CUR_SESSION.access_token}` },
          body: JSON.stringify({ entreprise_id: lettre.entreprises.id }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || "Erreur lors de la régénération."); return; }
        window.location.href = `lettres.html?id=${data.lettre.id}`;
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="icon">${ICONS.refresh}</span>Régénérer`;
      }
    });

    document.getElementById("btn-delete-letter").addEventListener("click", async () => {
      if (!(await confirmDialog("Supprimer définitivement cette lettre ?"))) return;
      const { error: delErr } = await supabaseClient.from("lettres").delete().eq("id", letterId);
      if (delErr) { alert("Erreur : " + delErr.message); return; }
      window.location.href = "lettres.html";
    });
  }
}

function flashButton(id, html) {
  const btn = document.getElementById(id);
  const original = btn.innerHTML;
  btn.innerHTML = html;
  setTimeout(() => { btn.innerHTML = original; }, 1500);
}

function downloadPdf(content, entrepriseName) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const maxWidth = 595 - margin * 2;
  const lines = doc.splitTextToSize(content, maxWidth);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  let y = margin;
  const lineHeight = 15;
  lines.forEach(line => {
    if (y > 841 - margin) { doc.addPage(); y = margin; }
    doc.text(line, margin, y);
    y += lineHeight;
  });

  doc.save(`lettre-motivation-${(entrepriseName || "entreprise").replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
