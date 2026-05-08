# EduNavi — Live Amplified Teacher

Static site. No build step. Three HTML pages + Supabase Realtime + Jitsi Meet + Chart.js.

## Files

```
index.html      — teacher dashboard (start lesson, QR, video, exercise input, live graph)
student.html    — student page (mobile, video, exercise, response buttons)
shared.js       — Supabase client + realtime helpers
teacher.js      — teacher-page logic
student.js      — student-page logic
style.css       — shared styling
config.js       — Supabase URL/key (you fill this in — see setup below)
config.example.js — template, safe to commit
```

## One-time setup (~3 minutes)

The site needs a free Supabase project to relay messages between teacher and students in real time.

1. Go to **https://supabase.com** → "Start your project" → sign in with GitHub or Google.
2. Click **New project**. Pick any name (e.g. `edunavi`), any password (you won't need it), region closest to Tallinn (Frankfurt). Click **Create**.
3. Wait ~1–2 minutes for it to provision.
4. In the left sidebar go to **Project Settings → API**.
5. Copy two values:
   - **Project URL**  (looks like `https://abcdefg.supabase.co`)
   - **anon public key** (a long JWT-looking string)
6. Open `config.js` in this folder and paste the two values into `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

That's it. You don't need to create any tables — Realtime broadcast channels work without a schema.

## Run locally

You can just open `index.html` in a browser, but Jitsi camera permission and some browsers prefer an HTTP origin over `file://`. Easiest local server:

**Python (already on most machines):**

```
python -m http.server 5500
```

Then visit `http://localhost:5500/` — that's the teacher page.

For the student page on your phone (same wifi as your laptop): open `http://YOUR-LAPTOP-IP:5500/student.html?room=XXXX`. Or scan the QR.

## Deploy to Vercel (recommended for the real demo)

1. Push this folder to a GitHub repo.
2. Go to **https://vercel.com** → **Add New… → Project** → import the repo.
3. Framework preset: **Other**. Root directory: this folder. Build command: leave empty. Output directory: leave as default (the repo root).
4. Click **Deploy**. ~30 seconds later you have a public URL like `https://edunavi.vercel.app`.

Drop your real `config.js` (with Supabase credentials) into the repo before deploying. The anon key is safe to expose to browsers — that's its whole purpose.

## Demo flow

1. Open the deployed teacher URL on the laptop driving the projector.
2. Click **Alusta tundi**.
3. Allow camera + microphone in the Jitsi iframe.
4. Show the QR code to the audience.
5. Type a math exercise → **Postita ülesanne**.
6. Watch the bar chart fill in real time as students respond.
7. Narrate: *"This is what one teacher seeing a thousand students looks like."*

## Troubleshooting

- **Banner says "Supabase not configured"** → you haven't filled in `config.js` yet, or the values still have the placeholder text.
- **Graph never updates** → check the browser console (F12). If you see a 401/403 from Supabase, the anon key is wrong. If you see "CHANNEL_ERROR", the project URL is wrong.
- **Jitsi shows a "join meeting" prompt** → click it. Allow camera + mic. We disable the prejoin page via URL params, but on first visit some browsers still require explicit consent.
- **Students don't show in the counter** → presence sync takes ~1 second after a student joins. If after 5 seconds the counter is still 0, the student's network may be blocking Supabase WebSockets — try a different network.
- **Audio feedback during the demo** → only the teacher should have an unmuted mic. Students start muted automatically. If a student unmutes, they'll hear themselves echo through the teacher's speakers; ask them to mute.

## Out of scope (intentionally)

- No login. No accounts. No persistence between sessions.
- No eKool integration — that's the v2 narrative.
- No "next best action" AI recommendation yet — first prove the loop works.
