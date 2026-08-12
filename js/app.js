// js/app.js
// Chargé sur toutes les pages protégées (pages/*.html) après supabaseClient.js.
// Fournit : rendu de la sidebar selon le rôle, déconnexion, helpers communs.

const ICONS = {
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V9.5"/></svg>',
  building: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="1.5"/><path d="M16 21V5a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 0 8 5v16"/><line x1="12" y1="10" x2="12" y2="10.01"/></svg>',
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="16" y1="2.5" x2="16" y2="6.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  folder: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
  chart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="8"/><line x1="18" y1="20" x2="18" y2="11"/><line x1="3" y1="20" x2="21" y2="20"/></svg>',
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20.5c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5"/></svg>',
  settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
  logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><polyline points="15 17 20 12 15 7"/><line x1="20" y1="12" x2="9" y2="12"/></svg>',
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  arrowLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  save: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  alert: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

const NAV_CANDIDATE = [
  { href: "dashboard.html", icon: ICONS.home, label: "Dashboard" },
  { href: "entreprises.html", icon: ICONS.building, label: "Entreprises" },
  { href: "lettres.html", icon: ICONS.mail, label: "Lettres" },
  { href: "relances.html", icon: ICONS.calendar, label: "Relances" },
  { href: "campagnes.html", icon: ICONS.folder, label: "Campagnes" },
  { href: "activite.html", icon: ICONS.chart, label: "Activité" },
  { href: "profil.html", icon: ICONS.user, label: "Mon profil" },
  { href: "parametres.html", icon: ICONS.settings, label: "Paramètres" },
];

const NAV_COMPANION = [
  { href: "dashboard.html", icon: ICONS.home, label: "Dashboard" },
  { href: "entreprises.html", icon: ICONS.building, label: "Entreprises" },
  { href: "lettres.html", icon: ICONS.mail, label: "Lettres" },
  { href: "relances.html", icon: ICONS.calendar, label: "Relances" },
  { href: "activite.html", icon: ICONS.chart, label: "Activité" },
  { href: "parametres.html", icon: ICONS.settings, label: "Paramètres" },
];

const STATUT_BADGES = {
  "À contacter": { class: "badge-a-contacter" },
  "Contactée": { class: "badge-contactee" },
  "Candidature envoyée": { class: "badge-candidature-envoyee" },
  "Relance": { class: "badge-relance" },
  "Entretien": { class: "badge-entretien" },
  "Acceptée": { class: "badge-acceptee" },
  "Refusée": { class: "badge-refusee" },
};

const STATUT_ORDER = ["À contacter", "Contactée", "Candidature envoyée", "Relance", "Entretien", "Acceptée", "Refusée"];

function badgeHtml(statut) {
  const b = STATUT_BADGES[statut] || { class: "" };
  return `<span class="badge ${b.class}">${statut}</span>`;
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
      <span class="icon">${item.icon}</span><span>${item.label}</span>
    </a>
  `).join("") + `
    <a href="#" id="logout-link" style="margin-top:auto;color:var(--danger);">
      <span class="icon">${ICONS.logout}</span><span>Déconnexion</span>
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
