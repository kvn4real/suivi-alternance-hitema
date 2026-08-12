# Alternance Suite

Assistant personnel multi-utilisateur pour gérer une recherche d'alternance :
**Trouver → Organiser → Personnaliser → Candidater → Relancer → Suivre.**

Stack : HTML / CSS / JavaScript vanilla + Supabase (PostgreSQL, Auth, Storage, Edge Functions) + IA (Groq, llama-3.3-70b) pour la génération des lettres.

Aucun framework front lourd, aucune donnée critique en `localStorage` : tout est dans Supabase, accessible depuis n'importe quel appareil après connexion.

---

## 1. Architecture du projet

```
alternance/
├── index.html            → redirige vers login ou dashboard
├── login.html             → connexion / inscription / mot de passe oublié
├── style.css               → design system unique, responsive
├── config.js               → SUPABASE_URL + clé publique (anon)
│
├── pages/
│   ├── dashboard.html
│   ├── entreprises.html
│   ├── lettres.html
│   ├── relances.html
│   ├── campagnes.html
│   ├── profil.html
│   ├── parametres.html
│   └── activite.html
│
├── js/
│   ├── supabaseClient.js   → initialisation du client Supabase
│   ├── auth.js              → connexion/inscription/reset + requireAuth()
│   ├── app.js                → sidebar dynamique, helpers UI, activity log
│   ├── dashboard.js
│   ├── entreprises.js
│   ├── lettres.js
│   ├── relances.js
│   ├── campagnes.js
│   ├── profil.js
│   ├── parametres.js
│   └── activite.js
│
├── supabase/
│   ├── schema.sql                        → tables + RLS + policies (à exécuter une fois)
│   └── functions/
│       ├── generate-letter/index.ts       → Edge Function (appel IA sécurisé)
│       └── invite-companion/index.ts      → Edge Function (invitation accompagnateur)
│
└── README.md
```

Deux rôles gérés par la même base de code : `candidate` (toi) et `companion` (ton accompagnateur). Toutes les permissions sont appliquées **dans PostgreSQL via Row Level Security**, pas seulement en cachant des boutons côté frontend.

---

## 2. Étapes d'installation

### Étape 1 — Créer un compte Supabase
Va sur [supabase.com](https://supabase.com), crée un compte, puis un nouveau projet (choisis une région proche, ex. `eu-west`). Note ton mot de passe de base de données.

### Étape 2 — Créer le projet
Une fois le projet initialisé (1-2 min), tu arrives sur le dashboard du projet.

### Étape 3 — Ouvrir le SQL Editor
Dans le menu de gauche : **SQL Editor → New query**.

### Étape 4 — Copier `schema.sql`
Ouvre `supabase/schema.sql` de ce projet, copie tout le contenu.

### Étape 5 — Exécuter le SQL
Colle-le dans le SQL Editor et clique sur **Run**. Cela crée : les 8 tables, les fonctions utilitaires, les triggers, le bucket de stockage `cv`, et **toutes les policies RLS**.

### Étape 6 — Configurer Supabase Auth
Va dans **Authentication → Providers** : vérifie que "Email" est activé.
Dans **Authentication → URL Configuration**, renseigne :
- Site URL : l'URL de ton site déployé (ou `http://localhost:5500` en local)
- Redirect URLs : ajoute la même URL + `/login.html`

Pour que les emails d'invitation/réinitialisation partent réellement, configure un SMTP dans **Authentication → Email Templates / SMTP Settings** (ex. avec Resend, Brevo/Sendinblue, ou Gmail SMTP en test). Sans SMTP configuré, Supabase utilise un envoi limité (quelques emails/heure) suffisant pour tester.

### Étape 7 — Récupérer les clés publiques
Va dans **Project Settings → API**. Note :
- `Project URL` → `SUPABASE_URL`
- `anon public` key → `SUPABASE_ANON_KEY`

⚠️ Ne copie jamais la clé `service_role` dans le frontend.

### Étape 8 — Configurer `config.js`
Ouvre `config.js` à la racine du projet et remplace :
```javascript
const SUPABASE_URL = "https://TON_PROJET.supabase.co";
const SUPABASE_ANON_KEY = "TA_CLE_PUBLIQUE_ANON";
```

### Étape 9 — Installer la CLI Supabase et déployer les Edge Functions
```bash
npm install -g supabase
supabase login
supabase link --project-ref TON_PROJECT_REF
supabase functions deploy generate-letter
supabase functions deploy invite-companion
```
`TON_PROJECT_REF` se trouve dans Project Settings → General.

### Étape 10 — Configurer les secrets des Edge Functions
Jamais dans le frontend, uniquement côté serveur :
```bash
supabase secrets set GROQ_API_KEY=ta_cle_groq
supabase secrets set SITE_URL=https://ton-site.vercel.app
```
Crée une clé Groq gratuite sur [console.groq.com](https://console.groq.com) (modèle utilisé : `llama-3.3-70b-versatile`). Tu peux remplacer Groq par une autre API compatible OpenAI (Anthropic, OpenAI...) en adaptant `supabase/functions/generate-letter/index.ts`.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont déjà disponibles automatiquement dans l'environnement des Edge Functions Supabase — inutile de les configurer manuellement.

### Étape 11 — Tester le compte candidat
Ouvre `login.html` (via un serveur local, ex. extension "Live Server" de VS Code, ou `npx serve .`). Crée ton compte via l'onglet **Inscription** : tu deviens automatiquement `role = candidate`.

### Étape 12 — Créer le compte accompagnateur
Connecté en tant que candidat, va dans **Paramètres → Accompagnateur**, renseigne l'email de la personne et clique sur **Envoyer l'invitation**. Elle reçoit un email, clique sur le lien, définit son mot de passe : son compte est automatiquement créé avec `role = companion` et lié à ton `candidate_id`.

### Étape 13 — Tester les permissions
Voir la section Tests ci-dessous.

### Étape 14 — Déployer le site
Le frontend est 100% statique, compatible **Vercel** et **Netlify** :

**Vercel** :
```bash
npm install -g vercel
vercel
```
**Netlify** : glisse-dépose simplement le dossier dans [app.netlify.com/drop](https://app.netlify.com/drop), ou connecte le repo GitHub.

Pense à mettre à jour `Site URL` / `Redirect URLs` dans Supabase Auth ainsi que le secret `SITE_URL` de l'Edge Function avec l'URL finale de déploiement.

---

## 3. Rôles et permissions

| Action | Candidat | Accompagnateur |
|---|---|---|
| Voir les entreprises | ✅ | ✅ |
| Ajouter / modifier / supprimer une entreprise | ✅ | ❌ |
| Importer un CSV | ✅ | ❌ |
| Générer une lettre IA | ✅ | ❌ |
| Modifier / supprimer une lettre | ✅ | ❌ |
| Voir les lettres | ✅ | ✅ |
| Modifier le profil / la lettre originale | ✅ | ❌ |
| Changer les statuts | ✅ | ❌ |
| Ajouter des notes | ✅ | ✅ (sur ses propres notes uniquement pour modifier/supprimer) |
| Voir les statistiques / l'activité | ✅ | ✅ |
| Inviter un accompagnateur | ✅ | ❌ |
| Gérer les utilisateurs / rôles | ✅ (implicite) | ❌ |

Toutes ces règles sont appliquées via **Row Level Security PostgreSQL** (`supabase/schema.sql`), donc même en modifiant le frontend un accompagnateur ne peut pas contourner ces limites : les requêtes échoueraient côté base de données.

---

## 4. Tests à effectuer

### Test candidat
- [ ] Créer un compte
- [ ] Connexion
- [ ] Créer une entreprise
- [ ] Modifier une entreprise
- [ ] Supprimer une entreprise
- [ ] Générer une lettre (nécessite d'avoir rempli "Mon profil" avec une lettre originale)
- [ ] Modifier une lettre
- [ ] Changer le statut d'une candidature
- [ ] Créer une campagne
- [ ] Importer un CSV

### Test accompagnateur
- [ ] Connexion via le lien d'invitation
- [ ] Voir les entreprises du candidat
- [ ] Voir les lettres
- [ ] Ajouter une note
- [ ] Voir les statistiques
- [ ] Voir l'activité

### Test sécurité (à vérifier via la console réseau ou en tentant l'action)
- [ ] ❌ L'accompagnateur ne peut pas supprimer une entreprise (les boutons sont masqués, et la policy RLS `entreprises_delete_candidate_only` bloque la requête même si elle est forcée)
- [ ] ❌ Il ne peut pas modifier le profil du candidat (`candidate_profiles_update_self`)
- [ ] ❌ Il ne peut pas supprimer une lettre (`lettres_delete_candidate_only`)
- [ ] ❌ Il ne peut pas accéder aux données d'un autre candidat (toutes les policies filtrent par `my_candidate_scope()`)
- [ ] ❌ Il ne peut pas changer son propre rôle (`profiles_update_self_only` vérifie que le rôle reste identique)

---

## 5. Limites du plan gratuit Supabase (à date de rédaction)

Le plan **Free** de Supabase est à 0 $ et inclut notamment : 500 Mo de base de données, 5 Go d'egress, 1 Go de stockage, 50 000 utilisateurs actifs mensuels et 500 000 invocations d'Edge Functions par mois. Ce n'est pas illimité, mais très largement suffisant pour un usage personnel (quelques centaines d'entreprises, quelques dizaines de lettres par mois).

---

## 6. Import CSV — format attendu

```csv
nom,email,site_web,localisation,secteur,poste,url_offre,description,telephone
Entreprise A (exemple fictif),recrutement@exemple-fictif.fr,https://exemple-fictif.fr,Paris,Informatique,Support informatique,https://exemple-fictif.fr/offre,,
```
Seule la colonne `nom` est obligatoire. Utilise toujours des données clairement fictives pour tes tests (ne jamais présenter de fausses coordonnées comme réelles).

---

## 7. Sécurité de la clé IA

L'appel à l'IA passe uniquement par l'Edge Function `generate-letter`, exécutée côté serveur Supabase. La clé `GROQ_API_KEY` n'existe que dans les secrets de la fonction — elle n'apparaît jamais dans le code frontend ni dans le bundle livré au navigateur.

```
Site (frontend, clé anon uniquement)
   ↓ (JWT utilisateur)
Edge Function generate-letter (clé Groq en secret serveur)
   ↓
API Groq
```
