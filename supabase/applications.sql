-- Hackathon applications: hackers apply, organisers approve or reject.
-- Run this once in Supabase (SQL Editor > New query > paste > Run) AFTER schema.sql.
-- Safe to run again.

-- ---------- status ----------
-- Existing profiles stay approved. New hacker sign-ups start as pending.
alter table profiles add column if not exists status text not null default 'approved';
alter table profiles drop constraint if exists profiles_status_check;
alter table profiles add constraint profiles_status_check check (status in ('pending','approved','rejected'));

-- Contact details and motivation from the sign-up form. Only the applicant and organisers can read it.
create table if not exists applications (
  id uuid primary key references profiles(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  phone text not null default '' check (length(phone) <= 30),
  organisation text not null check (length(organisation) between 1 and 200),
  skills text not null default '' check (length(skills) <= 500),
  motivation text not null check (length(motivation) between 1 and 1000),
  note text not null default '' check (length(note) <= 500),  -- organiser's reason, shown to the applicant
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
alter table applications enable row level security;

-- ---------- helpers ----------
-- Only approved people count as participants. Every policy in schema.sql builds on these two,
-- so pending and rejected applicants cannot post, chat in team channels or submit.
create or replace function my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and status = 'approved' $$;

create or replace function my_team() returns text
language sql stable security definer set search_path = public as
$$ select team from profiles where id = auth.uid() and status = 'approved' $$;

-- Replaces the version in schema.sql: hackers now send an application and wait for approval.
drop function if exists join_hackathon(text, text, text, text, text);
create or replace function join_hackathon(
  p_name text, p_team text, p_role text, p_code text default '', p_team_code text default '',
  p_email text default '', p_phone text default '', p_organisation text default '', p_skills text default '', p_motivation text default ''
)
returns profiles
language plpgsql security definer set search_path = public as
$$
declare result profiles; v_team text := trim(p_team); existing text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(trim(p_name)) = 0 or length(v_team) = 0 then raise exception 'Name and team are required'; end if;
  if p_role <> 'Hackers' then
    if not exists (select 1 from role_codes where role = p_role and code = p_code) then
      raise exception 'Wrong access code for %', p_role;
    end if;
  else
    if trim(p_email) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;
    if length(trim(p_organisation)) = 0 then raise exception 'School or organisation is required'; end if;
    if length(trim(p_motivation)) = 0 then raise exception 'Tell us why you want to take part'; end if;
    select name into existing from teams where lower(name) = lower(v_team);
    if existing is null then
      if length(coalesce(p_team_code, '')) < 4 then raise exception 'Choose a team code of at least 4 characters'; end if;
      insert into teams (name, code) values (v_team, p_team_code);
    else
      if not exists (select 1 from teams where name = existing and code = p_team_code) then
        raise exception 'Wrong team code for %', existing;
      end if;
      v_team := existing;
    end if;
  end if;
  insert into profiles (id, name, team, role, status)
  values (auth.uid(), trim(p_name), v_team, p_role, case when p_role = 'Hackers' then 'pending' else 'approved' end)
  on conflict (id) do update set name = excluded.name, team = excluded.team, role = excluded.role,
    -- a hacker cannot reset their own decision by joining again; a valid staff code always lets you in
    status = case when excluded.role = 'Hackers' then profiles.status else 'approved' end
  returning * into result;
  if p_role = 'Hackers' then
    insert into applications (id, email, phone, organisation, skills, motivation)
    values (auth.uid(), trim(p_email), trim(p_phone), trim(p_organisation), trim(p_skills), trim(p_motivation))
    on conflict (id) do update set email = excluded.email, phone = excluded.phone, organisation = excluded.organisation,
      skills = excluded.skills, motivation = excluded.motivation;
  end if;
  return result;
end $$;

-- Organisers approve or reject a hacker. Can be changed later (e.g. un-reject).
create or replace function review_application(p_id uuid, p_status text, p_note text default '')
returns profiles
language plpgsql security definer set search_path = public as
$$
declare result profiles;
begin
  if my_role() is distinct from 'Organiser' then raise exception 'Only organisers can review applications'; end if;
  if p_status not in ('pending','approved','rejected') then raise exception 'Invalid status'; end if;
  update profiles set status = p_status where id = p_id and role = 'Hackers' returning * into result;
  if result.id is null then raise exception 'Application not found'; end if;
  update applications set note = left(coalesce(p_note, ''), 500), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  return result;
end $$;

-- ---------- row level security ----------
-- Applicants can always see their own profile (to read their status). Participants see approved
-- people; organisers see everyone.
drop policy if exists "profiles readable" on profiles;
create policy "profiles readable" on profiles for select to authenticated using (
  id = auth.uid() or (my_role() is not null and (status = 'approved' or my_role() = 'Organiser'))
);

drop policy if exists "messages read" on messages;
create policy "messages read" on messages for select to authenticated using (
  my_role() is not null and (
    channel = 'general'
    or (channel = 'team:' || my_team())
    or channel = 'mentors'
    or (channel = 'judges' and my_role() in ('Judge','Organiser'))
  )
);

drop policy if exists "announcements read" on announcements;
create policy "announcements read" on announcements for select to authenticated using (my_role() is not null);

drop policy if exists "settings read" on settings;
create policy "settings read" on settings for select to authenticated using (my_role() is not null);

drop policy if exists "applications read" on applications;
create policy "applications read" on applications for select to authenticated using (
  id = auth.uid() or my_role() = 'Organiser'
);

-- ---------- realtime ----------
do $$ begin
  alter publication supabase_realtime add table applications;
exception when duplicate_object then null;
end $$;
