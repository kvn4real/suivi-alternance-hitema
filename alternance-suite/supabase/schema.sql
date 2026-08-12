-- ============================================================================
-- ALTERNANCE SUITE - SCHEMA SUPABASE COMPLET
-- A copier-coller intégralement dans Supabase > SQL Editor > New query > Run
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLE PROFILES (liée à auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  prenom text,
  nom text,
  role text not null default 'candidate' check (role in ('candidate','companion')),
  candidate_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un compagnon doit avoir un candidate_id, un candidat ne doit pas en avoir
alter table public.profiles
  add constraint profiles_role_candidate_id_check
  check (
    (role = 'candidate' and candidate_id is null)
    or (role = 'companion' and candidate_id is not null)
  );

create index if not exists idx_profiles_candidate_id on public.profiles(candidate_id);

-- ============================================================================
-- 2. TABLE CANDIDATE_PROFILES (profil détaillé du candidat)
-- ============================================================================
create table if not exists public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.profiles(id) on delete cascade,
  prenom text,
  nom text,
  email text,
  telephone text,
  ville text,
  formation text,
  diplome text,
  niveau_etudes text,
  competences text,
  experiences text,
  objectifs text,
  disponibilite text,
  lettre_originale text,
  cv_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 3. TABLE CAMPAGNES
-- ============================================================================
create table if not exists public.campagnes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  nom text not null,
  date_debut date,
  date_fin date,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_campagnes_candidate on public.campagnes(candidate_id);

-- ============================================================================
-- 4. TABLE ENTREPRISES
-- ============================================================================
create table if not exists public.entreprises (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  nom text not null,
  email text,
  telephone text,
  site_web text,
  localisation text,
  secteur text,
  poste text,
  description text,
  url_offre text,
  statut text not null default 'À contacter' check (statut in (
    'À contacter','Contactée','Candidature envoyée','Relance','Entretien','Acceptée','Refusée'
  )),
  notes text,
  date_ajout timestamptz not null default now(),
  date_contact date,
  date_candidature date,
  date_relance date,
  campagne_id uuid references public.campagnes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entreprises_candidate on public.entreprises(candidate_id);
create index if not exists idx_entreprises_statut on public.entreprises(statut);
create index if not exists idx_entreprises_campagne on public.entreprises(campagne_id);
create index if not exists idx_entreprises_relance on public.entreprises(date_relance);

-- ============================================================================
-- 5. TABLE LETTRES
-- ============================================================================
create table if not exists public.lettres (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  titre text,
  contenu text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lettres_candidate on public.lettres(candidate_id);
create index if not exists idx_lettres_entreprise on public.lettres(entreprise_id);

-- ============================================================================
-- 6. TABLE NOTES (candidat + accompagnateur)
-- ============================================================================
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  entreprise_id uuid references public.entreprises(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  type text not null default 'note' check (type in ('note','recommandation','relance_proposee')),
  contenu text not null,
  relance_proposee date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_candidate on public.notes(candidate_id);
create index if not exists idx_notes_entreprise on public.notes(entreprise_id);

-- ============================================================================
-- 7. TABLE ACTIVITY_LOGS
-- ============================================================================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid references public.profiles(id),
  entreprise_id uuid references public.entreprises(id) on delete set null,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_candidate on public.activity_logs(candidate_id);
create index if not exists idx_activity_created on public.activity_logs(created_at desc);

-- ============================================================================
-- 8. TABLE INVITATIONS (invitation d'un accompagnateur par email)
-- ============================================================================
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at timestamptz not null default now()
);

create index if not exists idx_invitations_candidate on public.invitations(candidate_id);

-- ============================================================================
-- 9. FONCTIONS UTILITAIRES (SECURITY DEFINER pour éviter la récursion RLS)
-- ============================================================================
create or replace function public.my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_candidate_scope()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  -- Renvoie l'id "candidat" auquel appartiennent les données que je dois voir :
  -- - si je suis candidat : mon propre id
  -- - si je suis accompagnateur : le candidate_id qui m'est associé
  select case
    when role = 'candidate' then id
    else candidate_id
  end
  from public.profiles where id = auth.uid();
$$;

create or replace function public.is_candidate()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role = 'candidate' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.log_activity(
  p_candidate_id uuid,
  p_entreprise_id uuid,
  p_action text,
  p_description text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity_logs (candidate_id, user_id, entreprise_id, action, description)
  values (p_candidate_id, auth.uid(), p_entreprise_id, p_action, p_description);
$$;

-- Mise à jour automatique de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_candidate_profiles_updated on public.candidate_profiles;
create trigger trg_candidate_profiles_updated before update on public.candidate_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_entreprises_updated on public.entreprises;
create trigger trg_entreprises_updated before update on public.entreprises
  for each row execute function public.set_updated_at();

drop trigger if exists trg_lettres_updated on public.lettres;
create trigger trg_lettres_updated before update on public.lettres
  for each row execute function public.set_updated_at();

drop trigger if exists trg_notes_updated on public.notes;
create trigger trg_notes_updated before update on public.notes
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 10. ACTIVATION RLS
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.campagnes enable row level security;
alter table public.entreprises enable row level security;
alter table public.lettres enable row level security;
alter table public.notes enable row level security;
alter table public.activity_logs enable row level security;
alter table public.invitations enable row level security;

-- ============================================================================
-- 11. POLICIES - PROFILES
-- ============================================================================
create policy "profiles_select_self_or_linked"
  on public.profiles for select
  using (
    id = auth.uid()
    or candidate_id = auth.uid()               -- candidat voit ses accompagnateurs
    or id = public.my_candidate_scope()         -- accompagnateur voit le candidat lié
  );

create policy "profiles_insert_self"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_self_only"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- Aucune policy DELETE : la suppression du profil passe par la suppression du compte auth (admin).

-- ============================================================================
-- 12. POLICIES - CANDIDATE_PROFILES
-- ============================================================================
create policy "candidate_profiles_select"
  on public.candidate_profiles for select
  using (candidate_id = public.my_candidate_scope());

create policy "candidate_profiles_insert_self"
  on public.candidate_profiles for insert
  with check (candidate_id = auth.uid() and public.is_candidate());

create policy "candidate_profiles_update_self"
  on public.candidate_profiles for update
  using (candidate_id = auth.uid() and public.is_candidate())
  with check (candidate_id = auth.uid());

-- ============================================================================
-- 13. POLICIES - CAMPAGNES
-- ============================================================================
create policy "campagnes_select"
  on public.campagnes for select
  using (candidate_id = public.my_candidate_scope());

create policy "campagnes_insert_candidate_only"
  on public.campagnes for insert
  with check (candidate_id = auth.uid() and public.is_candidate());

create policy "campagnes_update_candidate_only"
  on public.campagnes for update
  using (candidate_id = auth.uid() and public.is_candidate());

create policy "campagnes_delete_candidate_only"
  on public.campagnes for delete
  using (candidate_id = auth.uid() and public.is_candidate());

-- ============================================================================
-- 14. POLICIES - ENTREPRISES
-- ============================================================================
create policy "entreprises_select"
  on public.entreprises for select
  using (candidate_id = public.my_candidate_scope());

create policy "entreprises_insert_candidate_only"
  on public.entreprises for insert
  with check (candidate_id = auth.uid() and public.is_candidate());

create policy "entreprises_update_candidate_only"
  on public.entreprises for update
  using (candidate_id = auth.uid() and public.is_candidate());

create policy "entreprises_delete_candidate_only"
  on public.entreprises for delete
  using (candidate_id = auth.uid() and public.is_candidate());

-- ============================================================================
-- 15. POLICIES - LETTRES
-- ============================================================================
create policy "lettres_select"
  on public.lettres for select
  using (candidate_id = public.my_candidate_scope());

create policy "lettres_insert_candidate_only"
  on public.lettres for insert
  with check (candidate_id = auth.uid() and public.is_candidate());

create policy "lettres_update_candidate_only"
  on public.lettres for update
  using (candidate_id = auth.uid() and public.is_candidate());

create policy "lettres_delete_candidate_only"
  on public.lettres for delete
  using (candidate_id = auth.uid() and public.is_candidate());

-- ============================================================================
-- 16. POLICIES - NOTES (candidat ET accompagnateur peuvent ajouter)
-- ============================================================================
create policy "notes_select"
  on public.notes for select
  using (candidate_id = public.my_candidate_scope());

create policy "notes_insert_both_roles"
  on public.notes for insert
  with check (candidate_id = public.my_candidate_scope() and author_id = auth.uid());

create policy "notes_update_own_only"
  on public.notes for update
  using (author_id = auth.uid());

create policy "notes_delete_own_only"
  on public.notes for delete
  using (author_id = auth.uid());

-- ============================================================================
-- 17. POLICIES - ACTIVITY_LOGS
-- ============================================================================
create policy "activity_logs_select"
  on public.activity_logs for select
  using (candidate_id = public.my_candidate_scope());

create policy "activity_logs_insert_both_roles"
  on public.activity_logs for insert
  with check (candidate_id = public.my_candidate_scope() and user_id = auth.uid());

-- Pas d'update/delete : c'est un journal immuable.

-- ============================================================================
-- 18. POLICIES - INVITATIONS (candidat uniquement)
-- ============================================================================
create policy "invitations_select_candidate_only"
  on public.invitations for select
  using (candidate_id = auth.uid());

create policy "invitations_insert_candidate_only"
  on public.invitations for insert
  with check (candidate_id = auth.uid() and public.is_candidate());

create policy "invitations_update_candidate_only"
  on public.invitations for update
  using (candidate_id = auth.uid());

create policy "invitations_delete_candidate_only"
  on public.invitations for delete
  using (candidate_id = auth.uid());

-- ============================================================================
-- 19. STORAGE (CV privés)
-- ============================================================================
insert into storage.buckets (id, name, public)
  values ('cv', 'cv', false)
  on conflict (id) do nothing;

create policy "cv_select_own_or_companion"
  on storage.objects for select
  using (
    bucket_id = 'cv'
    and (storage.foldername(name))[1] = public.my_candidate_scope()::text
  );

create policy "cv_insert_candidate_only"
  on storage.objects for insert
  with check (
    bucket_id = 'cv'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_candidate()
  );

create policy "cv_update_candidate_only"
  on storage.objects for update
  using (
    bucket_id = 'cv'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_candidate()
  );

create policy "cv_delete_candidate_only"
  on storage.objects for delete
  using (
    bucket_id = 'cv'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_candidate()
  );

-- ============================================================================
-- FIN DU SCHEMA
-- ============================================================================
