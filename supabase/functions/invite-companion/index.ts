// supabase/functions/invite-companion/index.ts
// Edge Function : invite un accompagnateur par email.
// Utilise la service_role key (secret serveur uniquement) pour créer/inviter
// l'utilisateur via l'API Admin de Supabase Auth, puis crée son profil
// "companion" lié au candidat appelant.
//
// Déploiement : supabase functions deploy invite-companion
// Nécessite que "Enable email confirmations" et le SMTP soient configurés
// dans Supabase > Authentication > Email (voir README).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:5500";

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
    if (!authHeader) return json({ error: "Non authentifié." }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Session invalide." }, 401);
    const candidateId = userData.user.id;

    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return json({ error: "Email manquant." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: candidateProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", candidateId)
      .single();

    if (!candidateProfile || candidateProfile.role !== "candidate") {
      return json({ error: "Seul le candidat peut inviter un accompagnateur." }, 403);
    }

    // Invite (crée le compte auth si besoin et envoie l'email d'invitation)
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SITE_URL}/login.html`,
    });

    if (inviteErr) {
      return json({ error: "Erreur lors de l'invitation.", details: inviteErr.message }, 500);
    }

    const companionId = invited.user.id;

    // Crée / met à jour le profil "companion" lié à ce candidat
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: companionId,
      email,
      role: "companion",
      candidate_id: candidateId,
    });

    if (profileErr) {
      return json({ error: "Erreur de création du profil.", details: profileErr.message }, 500);
    }

    await admin.from("invitations").insert({
      candidate_id: candidateId,
      email,
      status: "pending",
    });

    await admin.from("activity_logs").insert({
      candidate_id: candidateId,
      user_id: candidateId,
      action: "Accompagnateur invité",
      description: `Invitation envoyée à ${email}`,
    });

    return json({ success: true }, 200);
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
