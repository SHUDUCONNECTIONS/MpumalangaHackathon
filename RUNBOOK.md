# Event-day runbook

Fill in the names and numbers before the event, and print this page.

## Roles
| Job | Person | Phone |
| --- | --- | --- |
| Lead organiser (app admin) | | |
| Backup organiser | | |
| Technical contact (Supabase / hosting logins) | | |

## Before the event
- [ ] Access codes changed from the `change-me-*` defaults and shared only with the right people.
- [ ] Code-freeze time set on the timer screen (organiser login, Home > timer).
- [ ] Real programme, FAQs and resources in `src/data.js`, then redeployed.
- [ ] Tested on at least one iPhone and one low-end Android, on mobile data.
- [ ] Printed copy of the schedule at the registration desk.

## If something goes wrong
| Problem | Do this |
| --- | --- |
| A team code was forgotten | Supabase > Table editor > `teams` > read or edit the code, tell the team lead in person. |
| An access code leaked | Edit the row in `role_codes`. Existing signed-in users keep access, so remove any unwanted profile in `profiles`. |
| Someone is spamming chat | Organiser login: tap the ✕ on their messages. Remove their row from `profiles` to cut access. |
| Deadline was set wrong | Organiser login: Timer > Exact time > Set, or Clear. |
| A team cannot submit | Check the timer has not passed. Organisers can still submit. Fallback: collect a repo link by hand and enter it as that team. |
| App will not load / Supabase is down | Check status.supabase.com. Announce by voice and on the printed schedule. Keep a copy of the results CSV after judging. |
| Judging results needed | Judging > Results > Export CSV. |

## After the event
- Export results and participants CSV from the dashboard and keep them safe.
- Delete personal data once it is no longer needed: Supabase > Table editor, clear `messages`, `profiles`, and `auth.users`, or ask each participant to use Settings > Delete my data.
- Pause or delete the Supabase project.
