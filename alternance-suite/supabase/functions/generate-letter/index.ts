// supabase/functions/generate-letter/index.ts
// Edge Function : génère une lettre de motivation personnalisée via une IA.
// La clé API de l'IA (GROQ_API_KEY) est stockée dans les secrets Supabase,
// jamais dans le frontend.
//
// Déploiement : supabase functions deploy generate-letter
// Secret requis : supabase secrets set GROQ_API_KEY=xxxx

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const GROQ_MODEL = "llama-3.3-70b-versatile";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Non authentifié." }, 401);
    }

    // Client "utilisateur" : sert uniquement à vérifier qui appelle et à
    // s'assurer que les policies RLS s'appliquent lors des lectures.
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Session invalide." }, 401);
    }
    const uid = userData.user.id;

    const body = await req.json();
    const entrepriseId = body.entreprise_id as string;
    if (!entrepriseId) {
      return json({ error: "entreprise_id manquant." }, 400);
    }

    // Client "admin" (service role) pour lire/écrire sans dépendre de la
    // propagation JWT côté fonction, mais on revérifie manuellement les
    // droits (l'appelant doit être le candidat propriétaire).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, candidate_id, prenom, nom")
      .eq("id", uid)
      .single();

    if (!profile || profile.role !== "candidate") {
      return json({ error: "Seul le candidat peut générer une lettre." }, 403);
    }

    const { data: entreprise, error: entErr } = await admin
      .from("entreprises")
      .select("*")
      .eq("id", entrepriseId)
      .eq("candidate_id", uid)
      .single();

    if (entErr || !entreprise) {
      return json({ error: "Entreprise introuvable." }, 404);
    }

    const { data: candidateProfile } = await admin
      .from("candidate_profiles")
      .select("*")
      .eq("candidate_id", uid)
      .single();

    if (!candidateProfile || !candidateProfile.lettre_originale) {
      return json({
        error: "Aucune lettre de motivation originale enregistrée dans le profil. Ajoute-la dans 'Mon profil' avant de générer.",
      }, 400);
    }

    const systemPrompt = `Tu es un assistant spécialisé dans la rédaction de lettres de motivation.

Tu dois adapter la lettre originale du candidat à une entreprise et à un poste précis.

Utilise uniquement les informations fournies.

N'invente absolument aucune information concernant le candidat : pas de diplôme, expérience, entreprise, compétence, certification, projet ou responsabilité qui ne figure pas dans les informations fournies.

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

Retourne uniquement le texte final de la lettre, sans commentaire ni introduction.`;

    const userPrompt = `PROFIL CANDIDAT :
Prénom / Nom : ${candidateProfile.prenom ?? ""} ${candidateProfile.nom ?? ""}
Formation : ${candidateProfile.formation ?? "Non renseigné"}
Diplôme : ${candidateProfile.diplome ?? "Non renseigné"}
Niveau d'études : ${candidateProfile.niveau_etudes ?? "Non renseigné"}
Compétences : ${candidateProfile.competences ?? "Non renseigné"}
Expériences : ${candidateProfile.experiences ?? "Non renseigné"}
Objectifs professionnels : ${candidateProfile.objectifs ?? "Non renseigné"}
Disponibilité : ${candidateProfile.disponibilite ?? "Non renseigné"}

LETTRE DE MOTIVATION ORIGINALE (base à adapter, ne pas réinventer l'identité du candidat) :
${candidateProfile.lettre_originale}

ENTREPRISE CIBLE :
Nom : ${entreprise.nom}
Secteur : ${entreprise.secteur ?? "Non renseigné"}
Localisation : ${entreprise.localisation ?? "Non renseigné"}
Poste visé : ${entreprise.poste ?? "Non renseigné"}
Description de l'offre : ${entreprise.description ?? "Non renseigné"}

Rédige la lettre de motivation adaptée à cette entreprise et ce poste.`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return json({ error: "Erreur du service IA.", details: errText }, 502);
    }

    const groqData = await groqRes.json();
    const contenu = groqData?.choices?.[0]?.message?.content?.trim();

    if (!contenu) {
      return json({ error: "Réponse IA vide." }, 502);
    }

    const { data: lettre, error: insertErr } = await admin
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
      return json({ error: "Erreur d'enregistrement de la lettre.", details: insertErr.message }, 500);
    }

    await admin.from("activity_logs").insert({
      candidate_id: uid,
      user_id: uid,
      entreprise_id: entrepriseId,
      action: "Lettre générée",
      description: `Lettre générée pour ${entreprise.nom}`,
    });

    return json({ lettre }, 200);
  } catch (e) {
    return json({ error: "Erreur interne.", details: String(e) }, 500);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
