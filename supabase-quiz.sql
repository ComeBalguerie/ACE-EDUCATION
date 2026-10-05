-- Quiz de fin de séance · à exécuter une fois dans Supabase > SQL Editor
-- Prérequis : la table public.editors (déjà utilisée par le site) contient votre user_id.

create table if not exists public.quiz_students (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cls text not null check (length(cls) between 2 and 24),
  pseudo text not null check (pseudo ~ '^[A-Za-z0-9_-]{3,16}  created_at timestamptz not null default now()
);
alter table public.quiz_students add column if not exists nom text;
create unique index if not exists quiz_students_cls_pseudo on public.quiz_students (cls, lower(pseudo));

create table if not exists public.quiz_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.quiz_students(user_id) on delete cascade,
  module text not null,
  sid text not null,
  note numeric(4,2) not null check (note between 0 and 20),
  pts integer not null default 0,
  training boolean not null default false,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_module on public.quiz_attempts (module, sid);
create index if not exists quiz_attempts_user on public.quiz_attempts (user_id, module, sid);

create table if not exists public.quiz_config (
  module text primary key,
  open jsonb not null default '{}',
  qedit jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create or replace function public.quiz_is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.editors where user_id = auth.uid())
$$;

-- Vérifie si un compte élève existe (limité aux adresses synthétiques des élèves)
create or replace function public.quiz_account_exists(p_email text) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select p_email like '%@eleves.cours-ace.fr'
     and exists (select 1 from auth.users where lower(email) = lower(p_email))
$$;
grant execute on function public.quiz_account_exists(text) to anon, authenticated;

-- La première tentative de chaque séance est la note CC ; les suivantes sont de l'entraînement.
-- Date et statut fixés par le serveur (traçabilité Qualiopi).
create or replace function public.quiz_before_attempt() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || '/' || new.module || '/' || new.sid));
  new.training := exists (select 1 from public.quiz_attempts
    where user_id = new.user_id and module = new.module and sid = new.sid);
  return new;
end $$;
drop trigger if exists quiz_before_attempt on public.quiz_attempts;
create trigger quiz_before_attempt before insert on public.quiz_attempts
  for each row execute function public.quiz_before_attempt();

alter table public.quiz_students enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_config enable row level security;

drop policy if exists qs_select on public.quiz_students;
drop policy if exists qs_insert on public.quiz_students;
drop policy if exists qs_delete on public.quiz_students;
create policy qs_select on public.quiz_students for select using (user_id = auth.uid() or public.quiz_is_editor());
create policy qs_insert on public.quiz_students for insert with check (user_id = auth.uid());
create policy qs_delete on public.quiz_students for delete using (public.quiz_is_editor());

drop policy if exists qa_select on public.quiz_attempts;
drop policy if exists qa_insert on public.quiz_attempts;
drop policy if exists qa_delete on public.quiz_attempts;
create policy qa_select on public.quiz_attempts for select using (user_id = auth.uid() or public.quiz_is_editor());
create policy qa_insert on public.quiz_attempts for insert with check (user_id = auth.uid());
create policy qa_delete on public.quiz_attempts for delete using (public.quiz_is_editor());
-- Pas de politique UPDATE : une note enregistrée ne peut pas être modifiée.

drop policy if exists qc_select on public.quiz_config;
drop policy if exists qc_insert on public.quiz_config;
drop policy if exists qc_update on public.quiz_config;
create policy qc_select on public.quiz_config for select using (true);
create policy qc_insert on public.quiz_config for insert with check (public.quiz_is_editor());
create policy qc_update on public.quiz_config for update using (public.quiz_is_editor()) with check (public.quiz_is_editor());

grant select, insert, delete on public.quiz_students, public.quiz_attempts to authenticated;
grant select on public.quiz_config to anon, authenticated;
grant insert, update on public.quiz_config to authenticated;
),
  nom text,
  created_at timestamptz not null default now()
);
create unique index if not exists quiz_students_cls_pseudo on public.quiz_students (cls, lower(pseudo));

create table if not exists public.quiz_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.quiz_students(user_id) on delete cascade,
  module text not null,
  sid text not null,
  note numeric(4,2) not null check (note between 0 and 20),
  pts integer not null default 0,
  training boolean not null default false,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_module on public.quiz_attempts (module, sid);
create index if not exists quiz_attempts_user on public.quiz_attempts (user_id, module, sid);

create table if not exists public.quiz_config (
  module text primary key,
  open jsonb not null default '{}',
  qedit jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create or replace function public.quiz_is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.editors where user_id = auth.uid())
$$;

-- Vérifie si un compte élève existe (limité aux adresses synthétiques des élèves)
create or replace function public.quiz_account_exists(p_email text) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select p_email like '%@eleves.cours-ace.fr'
     and exists (select 1 from auth.users where lower(email) = lower(p_email))
$$;
grant execute on function public.quiz_account_exists(text) to anon, authenticated;

-- La première tentative de chaque séance est la note CC ; les suivantes sont de l'entraînement.
-- Date et statut fixés par le serveur (traçabilité Qualiopi).
create or replace function public.quiz_before_attempt() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || '/' || new.module || '/' || new.sid));
  new.training := exists (select 1 from public.quiz_attempts
    where user_id = new.user_id and module = new.module and sid = new.sid);
  return new;
end $$;
drop trigger if exists quiz_before_attempt on public.quiz_attempts;
create trigger quiz_before_attempt before insert on public.quiz_attempts
  for each row execute function public.quiz_before_attempt();

alter table public.quiz_students enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_config enable row level security;

drop policy if exists qs_select on public.quiz_students;
drop policy if exists qs_insert on public.quiz_students;
drop policy if exists qs_delete on public.quiz_students;
create policy qs_select on public.quiz_students for select using (user_id = auth.uid() or public.quiz_is_editor());
create policy qs_insert on public.quiz_students for insert with check (user_id = auth.uid());
create policy qs_delete on public.quiz_students for delete using (public.quiz_is_editor());

drop policy if exists qa_select on public.quiz_attempts;
drop policy if exists qa_insert on public.quiz_attempts;
drop policy if exists qa_delete on public.quiz_attempts;
create policy qa_select on public.quiz_attempts for select using (user_id = auth.uid() or public.quiz_is_editor());
create policy qa_insert on public.quiz_attempts for insert with check (user_id = auth.uid());
create policy qa_delete on public.quiz_attempts for delete using (public.quiz_is_editor());
-- Pas de politique UPDATE : une note enregistrée ne peut pas être modifiée.

drop policy if exists qc_select on public.quiz_config;
drop policy if exists qc_insert on public.quiz_config;
drop policy if exists qc_update on public.quiz_config;
create policy qc_select on public.quiz_config for select using (true);
create policy qc_insert on public.quiz_config for insert with check (public.quiz_is_editor());
create policy qc_update on public.quiz_config for update using (public.quiz_is_editor()) with check (public.quiz_is_editor());

grant select, insert, delete on public.quiz_students, public.quiz_attempts to authenticated;
grant select on public.quiz_config to anon, authenticated;
grant insert, update on public.quiz_config to authenticated;
