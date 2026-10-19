-- Run this whole file once in Supabase: SQL Editor > New query > paste > Run.
-- Also enable: Authentication > Providers > "Allow anonymous sign-ins".

-- ---------- tables ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  team text not null,
  role text not null check (role in ('Hackers','Mentor','Judge','Organiser')),
  created_at timestamptz default now()
);

-- Secret join codes for privileged roles. Nobody can read this table from the app.
create table if not exists role_codes (
  role text primary key check (role in ('Mentor','Judge','Organiser')),
  code text not null
);
alter table role_codes enable row level security;  -- no policies = no access

-- Team join codes: the first member to use a team name sets its code; others must match it.
create table if not exists teams (
  name text primary key,
  code text not null
);
alter table teams enable row level security;  -- no policies = no access

create table if not exists messages (
  id bigint generated always as identity primary key,
  channel text not null,
  user_id uuid not null default auth.uid(),
  from_name text not null default '',
  text text not null check (length(text) between 1 and 2000),
  created_at timestamptz default now()
);

create table if not exists announcements (
  id bigint generated always as identity primary key,
  tag text not null default 'General' check (tag in ('General','Important','Schedule')),
  title text not null,
  body text not null,
  urgent boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);

create table if not exists submissions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  team text not null default '',
  by_name text not null default '',
  title text not null,
  category text not null,
  descr text not null,
  demo text default '' check (demo ~* '^(https?://|$)'),
  repo text default '' check (repo ~* '^(https?://|$)'),
  file_url text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (team)            -- one live submission per team; resubmitting updates it
);

create table if not exists scores (
  id bigint generated always as identity primary key,
  submission_id bigint not null references submissions(id) on delete cascade,
  judge_id uuid not null default auth.uid(),
  impact int not null check (impact between 1 and 10),
  innovation int not null check (innovation between 1 and 10),
  technical int not null check (technical between 1 and 10),
  pitch int not null check (pitch between 1 and 10),
  comment text default '',
  created_at timestamptz default now(),
  unique (submission_id, judge_id)
);

-- ---------- helpers ----------
create or replace function my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function my_team() returns text
language sql stable security definer set search_path = public as
$$ select team from profiles where id = auth.uid() $$;

-- Create/replace the caller's profile. Privileged roles need the matching code.
create or replace function join_hackathon(p_name text, p_team text, p_role text, p_code text default '', p_team_code text default '')
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
  insert into profiles (id, name, team, role)
  values (auth.uid(), trim(p_name), v_team, p_role)
  on conflict (id) do update set name = excluded.name, team = excluded.team, role = excluded.role
  returning * into result;
  return result;
end $$;

-- Stamp sender info server-side so it cannot be spoofed.
create or replace function stamp_message() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  new.user_id := auth.uid();
  -- basic rate limit: 8 messages per 10 seconds per user
  if (select count(*) from messages where user_id = auth.uid() and created_at > now() - interval '10 seconds') >= 8 then
    raise exception 'You are sending messages too fast. Slow down.';
  end if;
  select name into new.from_name from profiles where id = auth.uid();
  return new;
end $$;
drop trigger if exists stamp_message on messages;
create trigger stamp_message before insert on messages for each row execute function stamp_message();

create or replace function stamp_submission() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  new.user_id := auth.uid();
  select name, team into new.by_name, new.team from profiles where id = auth.uid();
  return new;
end $$;
drop trigger if exists stamp_submission on submissions;
create trigger stamp_submission before insert on submissions for each row execute function stamp_submission();

-- ---------- row level security ----------
alter table profiles enable row level security;
alter table messages enable row level security;
alter table announcements enable row level security;
alter table settings enable row level security;
alter table submissions enable row level security;
alter table scores enable row level security;

create policy "profiles readable" on profiles for select to authenticated using (true);

-- Chat: everyone sees general; teams see their own channel; mentor/judge channels are for staff.
create policy "messages read" on messages for select to authenticated using (
  channel = 'general'
  or (channel = 'team:' || my_team())
  or channel = 'mentors'
  or (channel = 'judges' and my_role() in ('Judge','Organiser'))
);
create policy "messages write" on messages for insert to authenticated with check (
  my_role() is not null and (
    channel = 'general'
    or channel = 'team:' || my_team()
    or channel = 'mentors'
    or (channel = 'judges' and my_role() in ('Judge','Organiser'))
  )
);

create policy "messages organiser delete" on messages for delete to authenticated using (my_role() = 'Organiser');

create policy "announcements read" on announcements for select to authenticated using (true);
create policy "announcements organiser insert" on announcements for insert to authenticated with check (my_role() = 'Organiser');
create policy "announcements organiser delete" on announcements for delete to authenticated using (my_role() = 'Organiser');

create policy "settings read" on settings for select to authenticated using (true);
create policy "settings organiser insert" on settings for insert to authenticated with check (my_role() = 'Organiser');
create policy "settings organiser update" on settings for update to authenticated using (my_role() = 'Organiser');

create policy "submissions read" on submissions for select to authenticated using (
  team = my_team() or my_role() in ('Judge','Organiser')
);
-- Submissions lock when the organisers' code-freeze deadline passes (organisers are exempt).
create or replace function before_freeze() returns boolean
language sql stable security definer set search_path = public as
$$
  select my_role() = 'Organiser'
      or coalesce((select extract(epoch from now()) * 1000 < (value->>'ts')::bigint from settings where key = 'deadline'), true)
$$;

create policy "submissions insert" on submissions for insert to authenticated
  with check (my_role() is not null and before_freeze());
create policy "submissions update" on submissions for update to authenticated
  using (team = my_team() and before_freeze()) with check (team = my_team());
create policy "submissions organiser delete" on submissions for delete to authenticated using (my_role() = 'Organiser');

create policy "scores read" on scores for select to authenticated using (my_role() in ('Judge','Organiser'));
create policy "scores insert" on scores for insert to authenticated with check (my_role() in ('Judge','Organiser') and judge_id = auth.uid());
create policy "scores update" on scores for update to authenticated using (judge_id = auth.uid()) with check (judge_id = auth.uid());

-- ---------- file uploads ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('submissions', 'submissions', true, 10485760) on conflict (id) do nothing;
update storage.buckets set allowed_mime_types = array['application/pdf','application/zip','image/png','image/jpeg','video/mp4','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'] where id = 'submissions';
create policy "submission files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "submission files read" on storage.objects for select using (bucket_id = 'submissions');

-- Lets a participant erase their own personal data (privacy / POPIA).
-- Team submissions are kept for judging, but the link to the person is removed.
create or replace function delete_my_data() returns void
language plpgsql security definer set search_path = public, auth as
$$
begin
  if auth.uid() is null then return; end if;
  delete from messages where user_id = auth.uid();
  delete from scores where judge_id = auth.uid();
  update submissions set by_name = 'Removed' where user_id = auth.uid();
  delete from profiles where id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

-- ---------- realtime ----------
alter publication supabase_realtime add table messages, announcements, settings, submissions, scores, profiles;

-- ---------- seed ----------
-- CHANGE THESE CODES before the event, and only hand them to the right people.
insert into role_codes (role, code) values
  ('Organiser', 'change-me-organiser'),
  ('Judge', 'change-me-judge'),
  ('Mentor', 'change-me-mentor')
on conflict (role) do nothing;
