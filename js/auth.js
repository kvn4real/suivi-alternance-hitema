// js/auth.js
// Utilisé sur login.html. Gère connexion, inscription, mot de passe oublié,
// et la définition d'un nouveau mot de passe suite à une invitation.

/**
 * Garde d'accès : à appeler en haut de chaque page protégée (pages/*.html).
 * Redirige vers login.html si pas de session, et renvoie {session, profile}.
 */
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "/login.html";
    return null;
  }

  let { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  // Premier login après inscription : le profil n'existe pas encore -> on le crée.
  if (!profile) {
    const { data: created, error: createErr } = await supabaseClient
      .from("profiles")
      .insert({
        id: session.user.id,
        email: session.user.email,
        role: "candidate",
      })
      .select()
      .single();
    if (createErr) {
      console.error(createErr);
      showToast("Impossible de charger votre profil. Reconnectez-vous.", "error");
      await supabaseClient.auth.signOut();
      window.location.href = "/login.html";
      return null;
    }
    profile = created;
  }

  return { session, profile };
}

function initAuthPage() {
  const tabLogin = document.getElementById("tab-login");
  const tabSignup = document.getElementById("tab-signup");
  const formLogin = document.getElementById("form-login");
  const formSignup = document.getElementById("form-signup");
  const formReset = document.getElementById("form-reset");
  const linkForgot = document.getElementById("link-forgot");
  const linkBack = document.getElementById("link-back-to-login");

  function showForm(name) {
    formLogin.classList.toggle("hidden", name !== "login");
    formSignup.classList.toggle("hidden", name !== "signup");
    formReset.classList.toggle("hidden", name !== "reset");
    document.getElementById("auth-tabs").classList.toggle("hidden", name === "reset");
    tabLogin.classList.toggle("active", name === "login");
    tabSignup.classList.toggle("active", name === "signup");
  }

  tabLogin.addEventListener("click", () => showForm("login"));
  tabSignup.addEventListener("click", () => showForm("signup"));
  linkForgot.addEventListener("click", (e) => { e.preventDefault(); showForm("reset"); });
  linkBack.addEventListener("click", (e) => { e.preventDefault(); showForm("login"); });

  // Si on arrive depuis un lien d'invitation ou de réinitialisation Supabase,
  // detectSessionInUrl crée une session temporaire : on propose de définir
  // un nouveau mot de passe.
  supabaseClient.auth.onAuthStateChange(async (event) => {
    if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
      const hash = window.location.hash || "";
      if (hash.includes("type=recovery") || hash.includes("type=invite")) {
        document.getElementById("form-newpassword").classList.remove("hidden");
        formLogin.classList.add("hidden");
        formSignup.classList.add("hidden");
        formReset.classList.add("hidden");
        document.getElementById("auth-tabs").classList.add("hidden");
      }
    }
  });

  // ---- Connexion ----
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errEl = document.getElementById("login-error");
    errEl.textContent = "";

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errEl.textContent = "Email ou mot de passe incorrect.";
      return;
    }
    window.location.href = "/pages/dashboard.html";
  });

  // ---- Inscription ----
  formSignup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirm = document.getElementById("signup-password-confirm").value;
    const errEl = document.getElementById("signup-error");
    errEl.textContent = "";

    if (password !== confirm) {
      errEl.textContent = "Les mots de passe ne correspondent pas.";
      return;
    }
    if (password.length < 8) {
      errEl.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      errEl.textContent = error.message;
      return;
    }

    if (data.session) {
      // Confirmation email désactivée : session immédiate
      window.location.href = "/pages/dashboard.html";
    } else {
      document.getElementById("signup-success").textContent =
        "Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.";
      formSignup.reset();
    }
  });

  // ---- Mot de passe oublié ----
  formReset.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("reset-email").value.trim();
    const msgEl = document.getElementById("reset-message");

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login.html`,
    });

    msgEl.textContent = error
      ? "Erreur lors de l'envoi de l'email."
      : "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.";
  });

  // ---- Nouveau mot de passe (après invitation ou reset) ----
  document.getElementById("form-newpassword").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("newpassword-password").value;
    const confirm = document.getElementById("newpassword-confirm").value;
    const errEl = document.getElementById("newpassword-error");
    errEl.textContent = "";

    if (password !== confirm) {
      errEl.textContent = "Les mots de passe ne correspondent pas.";
      return;
    }
    if (password.length < 8) {
      errEl.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      errEl.textContent = error.message;
      return;
    }
    window.location.href = "/pages/dashboard.html";
  });

  // Si déjà connecté (et pas en flux invite/recovery), redirige direct.
  (async () => {
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery") || hash.includes("type=invite")) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) window.location.href = "/pages/dashboard.html";
  })();
}
