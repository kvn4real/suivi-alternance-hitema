// js/app.js
// Chargé sur toutes les pages protégées (pages/*.html) après supabaseClient.js.
// Fournit : rendu de la sidebar selon le rôle, déconnexion, helpers communs.

const NAV_CANDIDATE = [
  { href: "dashboard.html", icon: "🏠", label: "Dashboard" },
  { href: "entreprises.html", icon: "🏢", label: "Entreprises" },
  { href: "lettres.html", icon: "✉️", label: "Lettres" },
  { href: "relances.html", icon: "📅", label: "Relances" },
  { href: "campagnes.html", icon: "📁", label: "Campagnes" },
  { href: "activite.html", icon: "📊", label: "Activité" },
  { href: "profil.html", icon: "👤", label: "Mon profil" },
  { href: "parametres.html", icon: "⚙️", label: "Paramètres" },
];

const NAV_COMPANION = [
  { href: "dashboard.html", icon: "🏠", label: "Dashboard" },
  { href: "entreprises.html", icon: "🏢", label: "Entreprises" },
  { href: "lettres.html", icon: "✉️", label: "Lettres" },
  { href: "relances.html", icon: "📅", label: "Relances" },
  { href: "activite.html", icon: "📊", label: "Activité" },
  { href: "parametres.html", icon: "⚙️", label: "Paramètres" },
];

const STATUT_BADGES = {
  "À contacter": { emoji: "🟡", class: "badge-a-contacter" },
  "Contactée": { emoji: "🔵", class: "badge-contactee" },
  "Candidature envoyée": { emoji: "🟣", class: "badge-candidature-envoyee" },
  "Relance": { emoji: "🟠", class: "badge-relance" },
  "Entretien": { emoji: "🟢", class: "badge-entretien" },
  "Acceptée": { emoji: "✅", class: "badge-acceptee" },
  "Refusée": { emoji: "🔴", class: "badge-refusee" },
};

const STATUT_ORDER = ["À contacter", "Contactée", "Candidature envoyée", "Relance", "Entretien", "Acceptée", "Refusée"];

function badgeHtml(statut) {
  const b = STATUT_BADGES[statut] || { emoji: "⚪", class: "" };
  return `<span class="badge ${b.class}">${b.emoji} ${statut}</span>`;
}

function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date)) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(d) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Initialise le shell de l'app (sidebar + topbar) sur une page protégée.
 * activePage = nom du fichier courant (ex: "dashboard.html")
 */
function renderShell({ profile, activePage, title }) {
  const nav = profile.role === "candidate" ? NAV_CANDIDATE : NAV_COMPANION;

  document.getElementById("sidebar-nav").innerHTML = nav.map(item => `
    <a href="${item.href}" class="${item.href === activePage ? "active" : ""}">
      <span>${item.icon}</span><span>${item.label}</span>
    </a>
  `).join("") + `
    <a href="#" id="logout-link" style="margin-top:auto;color:var(--danger);">
      <span>🚪</span><span>Déconnexion</span>
    </a>
  `;

  document.getElementById("sidebar-brand-name").textContent =
    profile.role === "candidate" ? "Alternance Suite" : "Suivi Alternance";

  document.getElementById("topbar-title").textContent = title;

  const roleLabel = profile.role === "candidate" ? "Candidat" : "Accompagnateur";
  const nameLabel = [profile.prenom, profile.nom].filter(Boolean).join(" ") || profile.email;
  document.getElementById("topbar-user").textContent = `${nameLabel} · ${roleLabel}`;

  document.getElementById("logout-link").addEventListener("click", async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "/login.html";
  });

  // Menu mobile
  const hamburger = document.getElementById("hamburger");
  const sidebar = document.querySelector(".sidebar");
  const scrim = document.getElementById("sidebar-scrim");
  if (hamburger) {
    hamburger.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      scrim.classList.toggle("open");
    });
    scrim.addEventListener("click", () => {
      sidebar.classList.remove("open");
      scrim.classList.remove("open");
    });
  }
}

async function logActivity(candidateId, entrepriseId, action, description) {
  await supabaseClient.rpc("log_activity", {
    p_candidate_id: candidateId,
    p_entreprise_id: entrepriseId || null,
    p_action: action,
    p_description: description,
  });
}

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

async function confirmDialog(message) {
  return window.confirm(message);
}
