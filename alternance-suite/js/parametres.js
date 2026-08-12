// js/parametres.js

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  const { profile, session } = auth;

  renderShell({ profile, activePage: "parametres.html", title: "Paramètres" });

  if (profile.role === "candidate") {
    document.getElementById("panel-linked-candidate").classList.add("hidden");
    await loadCompanions(profile.id);

    document.getElementById("invite-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("invite-email").value.trim();
      const errEl = document.getElementById("invite-error");
      const successEl = document.getElementById("invite-success");
      errEl.textContent = "";
      successEl.textContent = "";

      try {
        const res = await fetch(`${FUNCTIONS_URL}/invite-companion`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || "Erreur lors de l'invitation."; return; }
        successEl.textContent = `Invitation envoyée à ${email}.`;
        document.getElementById("invite-email").value = "";
        await loadCompanions(profile.id);
      } catch (err) {
        errEl.textContent = "Erreur réseau lors de l'envoi de l'invitation.";
      }
    });
  } else {
    // Vue accompagnateur : pas de section invitation, on affiche le lien vers le candidat suivi.
    document.getElementById("panel-accompagnateur").classList.add("hidden");
    const { data: candidate } = await supabaseClient
      .from("profiles")
      .select("prenom, nom, email")
      .eq("id", profile.candidate_id)
      .single();

    document.getElementById("panel-linked-candidate").innerHTML = `
      <h3 style="margin-bottom:8px;">👤 Candidat suivi</h3>
      <p style="color:var(--text-muted);font-size:14px;">
        Tu suis la recherche d'alternance de <b>${escapeHtml([candidate?.prenom, candidate?.nom].filter(Boolean).join(" ") || candidate?.email || "")}</b>.
      </p>
    `;
  }

  document.getElementById("btn-change-password").addEventListener("click", async () => {
    const pwd = document.getElementById("new-password").value;
    const confirm = document.getElementById("new-password-confirm").value;
    const errEl = document.getElementById("password-error");
    const successEl = document.getElementById("password-success");
    errEl.textContent = "";
    successEl.textContent = "";

    if (pwd.length < 8) { errEl.textContent = "Le mot de passe doit contenir au moins 8 caractères."; return; }
    if (pwd !== confirm) { errEl.textContent = "Les mots de passe ne correspondent pas."; return; }

    const { error } = await supabaseClient.auth.updateUser({ password: pwd });
    if (error) { errEl.textContent = error.message; return; }
    successEl.textContent = "Mot de passe mis à jour.";
    document.getElementById("new-password").value = "";
    document.getElementById("new-password-confirm").value = "";
  });
})();

async function loadCompanions(candidateId) {
  const { data } = await supabaseClient
    .from("profiles")
    .select("id, prenom, nom, email")
    .eq("candidate_id", candidateId)
    .eq("role", "companion");

  const el = document.getElementById("companion-list");
  if (!data || !data.length) {
    el.innerHTML = `<p style="color:var(--text-muted);font-size:14px;">Aucun accompagnateur pour le moment.</p>`;
    return;
  }
  el.innerHTML = data.map(c => `
    <div class="detail-row">
      <span class="k">${escapeHtml([c.prenom, c.nom].filter(Boolean).join(" ") || c.email)}</span>
      <span class="v" style="color:var(--text-muted);">${escapeHtml(c.email)}</span>
    </div>
  `).join("");
}
