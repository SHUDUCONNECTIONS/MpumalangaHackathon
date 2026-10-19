# Mpumalanga Tourism Hackathon Hub

Mobile-first event app: team chat, announcements, code-freeze timer, challenges, programme, project submissions, judging and an organiser dashboard. React + Vite front end, Supabase backend.

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. **Authentication > Providers**: enable **Allow anonymous sign-ins**.
   **Authentication > URL Configuration**: set Site URL to your deployed address (needed for email sign-in links).
3. **SQL Editor**: paste and run all of [supabase/schema.sql](supabase/schema.sql).
   First edit the three `change-me-*` access codes at the bottom of that file.
   Then run [supabase/applications.sql](supabase/applications.sql) the same way (adds sign-up approval).
4. Copy `.env.example` to `.env` and fill in the project URL and anon key (Project Settings > API).
5. `npm install`, then `npm run dev`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build into `dist/` |
| `npm test` | Unit tests (scoring, CSV export, timestamps) |

## How roles work

- **Hackers** apply with their details, a team name and a team code. The first person to use a team name sets its code; teammates must enter the same one.
- Applications wait until an Organiser approves or rejects them (Profile > Applications). Until then the applicant sees only a status screen, and the database blocks them from chat, announcements and submissions.
- **Mentor / Judge / Organiser** need the access code from `role_codes`. The check runs in the database, not the browser.
- Only Organisers can post or delete announcements, move the timer, delete messages and submissions, and see the dashboard.
- Judges and Organisers can score submissions. Organisers see ranked results and can export CSV.
- Submissions lock when the code-freeze deadline passes (enforced in the database).

## Deploying

The `dist/` folder is a static site. Vercel and Netlify both work: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, build command `npm run build`, output directory `dist`. HTTPS is required for notifications and installing the app.

## Event content

Programme, FAQs and resource links live in [src/data.js](src/data.js) and are currently sample text.

## Known limits

- Reminder notifications fire only while the app is open. Background push needs a push service plus a scheduled server job.
- English only.
- Accounts are anonymous until a user adds an email under Settings > Save my account.
