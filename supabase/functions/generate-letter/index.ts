// supabase/functions/generate-letter/index.ts
//
// Edge Function : génère une lettre de motivation personnalisée via Groq.
//
// Secrets Supabase nécessaires :
// - GROQ_API_KEY
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const GROQ_MODEL = "llama-3.3-70b-versatile";

// ============================================================
// CORS
// ============================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

// ============================================================
// EDGE FUNCTION
// ============================================================

Deno.serve(async (req) => {

  // ----------------------------------------------------------
  // IMPORTANT :
  // Le navigateur envoie une requête OPTIONS avant le POST.
  // Il faut répondre correctement au preflight CORS.
  // ----------------------------------------------------------

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // On accepte uniquement POST
  if (req.method !== "POST") {
    return json(
      {
        error: "Méthode non autorisée.",
      },
      405
    );
  }

  try {

    // ========================================================
    // 1. Vérification de l'authentification
    // ========================================================

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json(
        {
          error: "Non authentifié.",
        },
        401
      );
    }

    // Client utilisateur
    const userClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Vérification du JWT
    const {
      data: userData,
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !userData?.user) {
      return json(
        {
          error: "Session invalide.",
        },
        401
      );
    }

    const uid = userData.user.id;

    // ========================================================
    // 2. Lecture du body
    // ========================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return json(
        {
          error: "Corps de requête invalide.",
        },
        400
      );
    }

    const entrepriseId = body?.entreprise_id;

    if (!entrepriseId) {
      return json(
        {
          error: "entreprise_id manquant.",
        },
        400
      );
    }

    // ========================================================
    // 3. Client ADMIN
    // ========================================================

    const admin = createClient(
      SUPABASE_URL,
      SERVICE_ROLE_KEY
    );

    // ========================================================
    // 4. Vérification du profil
    // ========================================================

    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select(
        "id, role, candidate_id, prenom, nom"
      )
      .eq("id", uid)
      .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "candidate"
    ) {
      return json(
        {
          error:
            "Seul le candidat peut générer une lettre.",
        },
        403
      );
    }

    // ========================================================
    // 5. Récupération de l'entreprise
    // ========================================================

    const {
      data: entreprise,
      error: entErr,
    } = await admin
      .from("entreprises")
      .select("*")
      .eq("id", entrepriseId)
      .eq("candidate_id", uid)
      .single();

    if (entErr || !entreprise) {
      return json(
        {
          error: "Entreprise introuvable.",
        },
        404
      );
    }

    // ========================================================
    // 6. Récupération du profil candidat
    // ========================================================

    const {
      data: candidateProfile,
      error: candidateProfileError,
    } = await admin
      .from("candidate_profiles")
      .select("*")
      .eq("candidate_id", uid)
      .single();

    if (
      candidateProfileError ||
      !candidateProfile
    ) {
      return json(
        {
          error:
            "Profil candidat introuvable.",
        },
        400
      );
    }

    if (!candidateProfile.lettre_originale) {
      return json(
        {
          error:
            "Aucune lettre de motivation originale enregistrée dans le profil. Ajoute-la dans 'Mon profil' avant de générer.",
        },
        400
      );
    }

    // ========================================================
    // 7. Vérification de la clé Groq
    // ========================================================

    if (!GROQ_API_KEY) {
      console.error(
        "GROQ_API_KEY manquante dans les secrets Supabase."
      );

      return json(
        {
          error:
            "La clé API du service IA n'est pas configurée.",
        },
        500
      );
    }

    // ========================================================
    // 8. PROMPT SYSTÈME
    // ========================================================

    const systemPrompt = `
Tu es un assistant spécialisé dans la rédaction de lettres de motivation.

Tu dois adapter la lettre originale du candidat à une entreprise et à un poste précis.

Utilise uniquement les informations fournies.

N'invente absolument aucune information concernant le candidat :
- aucun diplôme ;
- aucune expérience ;
- aucune entreprise ;
- aucune compétence ;
- aucune certification ;
- aucun projet ;
- aucune responsabilité.

Tu dois conserver :
- son parcours ;
- ses diplômes ;
- ses expériences ;
- ses compétences ;
- son objectif professionnel.

Tu dois personnaliser :
- le nom de l'entreprise ;
- le poste ;
- les missions ;
- les éléments pertinents de l'offre ;
- les motivations liées à l'entreprise.

Le résultat doit être naturel, professionnel et crédible.

Ne dis jamais que la lettre a été générée par une IA.

Retourne uniquement le texte final de la lettre.
Sans commentaire.
Sans introduction.
`;

    // ========================================================
    // 9. PROMPT UTILISATEUR
    // ========================================================

    const userPrompt = `
PROFIL CANDIDAT :

Prénom / Nom :
${candidateProfile.prenom ?? ""} ${candidateProfile.nom ?? ""}

Formation :
${candidateProfile.formation ?? "Non renseigné"}

Diplôme :
${candidateProfile.diplome ?? "Non renseigné"}

Niveau d'études :
${candidateProfile.niveau_etudes ?? "Non renseigné"}

Compétences :
${candidateProfile.competences ?? "Non renseigné"}

Expériences :
${candidateProfile.experiences ?? "Non renseigné"}

Objectifs professionnels :
${candidateProfile.objectifs ?? "Non renseigné"}

Disponibilité :
${candidateProfile.disponibilite ?? "Non renseigné"}


LETTRE DE MOTIVATION ORIGINALE :

${candidateProfile.lettre_originale}


ENTREPRISE CIBLE :

Nom :
${entreprise.nom}

Secteur :
${entreprise.secteur ?? "Non renseigné"}

Localisation :
${entreprise.localisation ?? "Non renseigné"}

Poste visé :
${entreprise.poste ?? "Non renseigné"}

Description de l'offre :
${entreprise.description ?? "Non renseigné"}


Rédige maintenant la lettre de motivation adaptée à cette entreprise et à ce poste.
`;

    // ========================================================
    // 10. APPEL GROQ
    // ========================================================

    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },

        body: JSON.stringify({
          model: GROQ_MODEL,

          temperature: 0.6,

          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
      }
    );

    // ========================================================
    // 11. Gestion erreur Groq
    // ========================================================

    if (!groqRes.ok) {

      const errText = await groqRes.text();

      console.error(
        "Erreur Groq :",
        groqRes.status,
        errText
      );

      return json(
        {
          error: "Erreur du service IA.",
          details: errText,
        },
        502
      );
    }

    // ========================================================
    // 12. Lecture réponse Groq
    // ========================================================

    const groqData = await groqRes.json();

    const contenu =
      groqData?.choices?.[0]?.message?.content?.trim();

    if (!contenu) {
      return json(
        {
          error: "Réponse IA vide.",
        },
        502
      );
    }

    // ========================================================
    // 13. Enregistrement de la lettre
    // ========================================================

    const {
      data: lettre,
      error: insertErr,
    } = await admin
      .from("lettres")
      .insert({
        candidate_id: uid,
        entreprise_id: entrepriseId,
        titre: `Lettre pour ${entreprise.nom}`,
        contenu,
        created_by: uid,
      })
      .select()
      .single();

    if (insertErr) {

      console.error(
        "Erreur insertion lettre :",
        insertErr
      );

      return json(
        {
          error:
            "Erreur d'enregistrement de la lettre.",
          details: insertErr.message,
        },
        500
      );
    }

    // ========================================================
    // 14. Journalisation
    // ========================================================

    await admin
      .from("activity_logs")
      .insert({
        candidate_id: uid,
        user_id: uid,
        entreprise_id: entrepriseId,
        action: "Lettre générée",
        description:
          `Lettre générée pour ${entreprise.nom}`,
      });

    // ========================================================
    // 15. Réponse finale
    // ========================================================

    return json(
      {
        lettre,
      },
      200
    );

  } catch (e) {

    console.error(
      "Erreur generate-letter :",
      e
    );

    return json(
      {
        error: "Erreur interne.",
        details: String(e),
      },
      500
    );
  }
});

// ============================================================
// HELPER JSON + CORS
// ============================================================

function json(
  obj: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(obj),
    {
      status,

      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    }
  );
}
