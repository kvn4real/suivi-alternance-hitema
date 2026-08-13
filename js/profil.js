// js/profil.js

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile } = auth;

  if (profile.role !== "candidate") {
    // L'accompagnateur ne peut pas modifier le profil du candidat.
    window.location.href = "dashboard.html";
    return;
  }

  renderShell({ profile, activePage: "profil.html", title: "Mon profil" });

  const { data: cp } = await supabaseClient
    .from("candidate_profiles")
    .select("*")
    .eq("candidate_id", profile.id)
    .maybeSingle();

  const fields = ["prenom", "nom", "email", "telephone", "ville", "disponibilite", "formation", "diplome", "niveau_etudes", "competences", "experiences", "objectifs", "lettre_originale"];
  fields.forEach(f => {
    const el = document.getElementById(`p-${f}`);
    if (el) el.value = cp ? (cp[f] || "") : (f === "email" ? profile.email : (f === "prenom" ? profile.prenom || "" : (f === "nom" ? profile.nom || "" : "")));
  });

  renderCvStatus(cp?.cv_url);

  document.getElementById("profil-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("profil-error");
    const successEl = document.getElementById("profil-success");
    errEl.textContent = "";
    successEl.textContent = "";

    const btn = document.getElementById("btn-save-profil");
    btn.disabled = true;

    try {
      let cvUrl = cp?.cv_url || null;
      const fileInput = document.getElementById("cv-file");
      if (fileInput.files.length) {
        const file = fileInput.files[0];
        const path = `${profile.id}/cv.${file.name.split(".").pop()}`;
        const { error: upErr } = await supabaseClient.storage.from("cv").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        cvUrl = path;
      }

      const payload = {
        candidate_id: profile.id,
        prenom: document.getElementById("p-prenom").value.trim() || null,
        nom: document.getElementById("p-nom").value.trim() || null,
        email: document.getElementById("p-email").value.trim() || null,
        telephone: document.getElementById("p-telephone").value.trim() || null,
        ville: document.getElementById("p-ville").value.trim() || null,
        disponibilite: document.getElementById("p-disponibilite").value.trim() || null,
        formation: document.getElementById("p-formation").value.trim() || null,
        diplome: document.getElementById("p-diplome").value.trim() || null,
        niveau_etudes: document.getElementById("p-niveau_etudes").value.trim() || null,
        competences: document.getElementById("p-competences").value.trim() || null,
        experiences: document.getElementById("p-experiences").value.trim() || null,
        objectifs: document.getElementById("p-objectifs").value.trim() || null,
        lettre_originale: document.getElementById("p-lettre_originale").value.trim() || null,
        cv_url: cvUrl,
      };

      const { error: upsertErr } = await supabaseClient.from("candidate_profiles").upsert(payload, { onConflict: "candidate_id" });
      if (upsertErr) throw upsertErr;

      // Met aussi à jour prénom/nom sur le profil principal (utilisé dans la sidebar)
      await supabaseClient.from("profiles").update({
        prenom: payload.prenom,
        nom: payload.nom,
      }).eq("id", profile.id);

      successEl.textContent = "Profil enregistré avec succès.";
      renderCvStatus(cvUrl);
    } catch (err) {
      errEl.textContent = "Erreur : " + err.message;
    } finally {
      btn.disabled = false;
    }
  });
})();

function renderCvStatus(cvUrl) {
  const el = document.getElementById("cv-current");
  el.innerHTML = cvUrl
    ? `<span style="color:var(--primary-dark);font-weight:600;display:inline-flex;align-items:center;"><span class="icon">${ICONS.file}</span>Un CV est déjà enregistré.</span> <button type="button" class="btn btn-sm btn-ghost" id="btn-download-cv">Télécharger</button>`
    : `<span style="color:var(--text-muted);">Aucun CV enregistré pour le moment.</span>`;

  const btn = document.getElementById("btn-download-cv");
  if (btn) {
    btn.addEventListener("click", async () => {
      const { data, error } = await supabaseClient.storage.from("cv").createSignedUrl(cvUrl, 60);
      if (error) { showToast("Erreur : " + error.message, "error"); return; }
      window.open(data.signedUrl, "_blank");
    });
  }
}
