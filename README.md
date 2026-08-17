# Remember

> **Demo build.** The styling is deliberately unpolished — this app is the "before" state
> for a talk on design tooling. See [DEMO-NOTES.md](DEMO-NOTES.md) for the list of
> intentional flaws and what must keep working. The previous polished stylesheet is at
> [backup/styles.polished.css](backup/styles.polished.css).

A small single-page app for remembering things. Each note has an alarm time; if the
note isn't marked done by then, it flips to **alarmed** and shows on a red background.

No npm dependencies — it uses Node's built-in `node:sqlite`, `node:http` and `node:crypto`.

## Run it

```sh
npm start          # or: node server.js
```

Then open <http://localhost:3000>. The database file `remember.db` is created on first run.

Environment overrides: `PORT` (default `3000`), `DB_FILE` (default `remember.db`).

## Running it on another machine

Clone and run — there is nothing to install, because there are no dependencies.

The one requirement is **Node 24**, which is what this is built and tested against.
`node:sqlite` is what makes the zero-dependency setup possible, and older releases either
lack it or keep it behind `--experimental-sqlite`. If `npm start` fails with
`Cannot find module 'node:sqlite'`, the Node version is too old.

**The database is deliberately not committed**, and you don't need it. The schema is
created on first run, and the demo notes are seeded on first use of the test login,
timed relative to *that moment* — so you always get two overdue notes and three upcoming
ones. A committed database would carry frozen timestamps that drift into the past, and
every note would eventually render red, which is exactly the distinction the demo relies
on. Deleting `remember.db` to get a clean demo is a feature.

## Dev mode and the test login

```sh
npm run dev        # or: node server.js --dev
```

This adds a **"Skip login — use the demo account"** button under the login form, which
signs you straight in as `demo@example.com` with no password. On first use it seeds five
sample notes, two of which are already overdue, so the red alarmed state and the
"Due soon" ordering are visible immediately. `npm run dev` also passes `--watch`, so the
server restarts when you save a file.

The bypass is off unless you ask for it, and the protection is layered:

- Without `--dev` (or `ALLOW_TEST_LOGIN=1`), `POST /api/test-login` returns 404 — the
  handler exits before touching the database.
- The button only renders when `GET /api/config` reports `testLogin: true`, so a normal
  start doesn't show it.
- The demo account's password is 32 random bytes, generated at creation and discarded,
  so the account can't be reached through the normal login form.
- Starting without `--dev` deletes any sessions previously issued to the demo user, so a
  cookie minted in dev mode stops working after a production restart.

The demo account is a real account like any other. If you'd rather it never exist, delete
its row and the `ensureDemoUser`/`revokeDemoSessions` helpers in [db.js](db.js).

## The three views

1. **Login** — email + password, with a toggle to create an account.
2. **All notes** — everything you've saved, newest first. Add a note (text + alarm time),
   tick it done, or delete it.
3. **Due soon** — outstanding notes sorted by alarm time, soonest first, with a relative
   countdown. Anything past its alarm time is red. The tab shows a badge with the
   alarmed count.

A note is *alarmed* when it isn't done and its alarm time has passed. The view re-renders
every 30 seconds, so a note turns red while you're watching it.

## Files

| File | What it does |
| --- | --- |
| [server.js](server.js) | HTTP server: JSON API under `/api/`, static files from `public/` |
| [db.js](db.js) | SQLite schema, password hashing, and all queries |
| [public/index.html](public/index.html) | Markup for all three views |
| [public/app.js](public/app.js) | State, rendering, API calls |
| [public/styles.css](public/styles.css) | Styling, light and dark |

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/config` | Reports whether the test login is enabled |
| POST | `/api/test-login` | Dev only — sign in as the demo user; 404 otherwise |
| POST | `/api/register` | Create account, returns a session cookie |
| POST | `/api/login` | Sign in |
| POST | `/api/logout` | End the session |
| GET | `/api/me` | Current user, or 401 |
| GET | `/api/notes` | All notes for the signed-in user |
| POST | `/api/notes` | Create `{ text, alarm_at }` |
| PATCH | `/api/notes/:id` | Set `{ done }` |
| DELETE | `/api/notes/:id` | Delete |

Passwords are hashed with scrypt and a per-user random salt. Sessions are 32 random bytes
in an `HttpOnly`, `SameSite=Strict` cookie, valid for 30 days, and every note query is
scoped to the session's user id.

## Before putting this on the internet

It's built to run on localhost. For a real deployment you'd want to serve it over HTTPS
and add the `Secure` flag to the session cookie in `sessionCookie()` in
[server.js](server.js), plus rate-limit the login endpoint.
