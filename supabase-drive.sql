-- Dépôt de documents pour les élèves · à exécuter une fois dans Supabase > SQL Editor
-- Prérequis : supabase-quiz.sql déjà exécuté (fonction quiz_is_editor) et bucket « pj » existant.

create table if not exists public.drive_files (
  id bigint generated always as identity primary key,
  module text not null,
  seance text not null default 'Général',
  name text not null,
  type text,
  size bigint,
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists drive_files_module on public.drive_files (module, created_at);

alter table public.drive_files enable row level security;
drop policy if exists df_select on public.drive_files;
drop policy if exists df_insert on public.drive_files;
drop policy if exists df_delete on public.drive_files;
create policy df_select on public.drive_files for select to authenticated using (true);
create policy df_insert on public.drive_files for insert to authenticated with check (public.quiz_is_editor());
create policy df_delete on public.drive_files for delete to authenticated using (public.quiz_is_editor());
grant select, insert, delete on public.drive_files to authenticated;

-- Fichiers rangés dans pj/drive/… : seul l'enseignant dépose ou supprime
drop policy if exists drive_obj_insert on storage.objects;
drop policy if exists drive_obj_delete on storage.objects;
drop policy if exists drive_obj_select on storage.objects;
create policy drive_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'pj' and name like 'drive/%' and public.quiz_is_editor());
create policy drive_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pj' and name like 'drive/%' and public.quiz_is_editor());
create policy drive_obj_select on storage.objects for select
  using (bucket_id = 'pj' and name like 'drive/%');
