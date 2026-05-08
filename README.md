# EduNavi — õpetaja otsustugi

Static site. No build step. Deployed on Vercel at **https://edunavi.vercel.app/**.

## What it does

EduNavi takes existing eKool-like data on a math class and tells the teacher, in <1 minute, what to do next. Three buckets, one recommendation, one decision.

- *Vajab tuge* — students with repeated errors who need targeted support
- *Ebakindel* — students with partial gaps who need a focused check
- *Valmis edasi liikuma* — students ready for the next topic

It's designed for the **võimendatud õpetaja** model: one expert teacher running multiple classes, supported by an on-site assistant teacher who needs phone-friendly, actionable info.

## Pages (clean URLs via `vercel.json`)

| Route | Audience | Purpose |
|---|---|---|
| `/class` | Headline product. Open this on the projector. | Single class analysis: 20 students × 5 fraction exercises → 3 buckets + recommendation + per-student grid + hidden patterns |
| `/classes` | Võimendatud õpetaja. | Multiple classes side-by-side, sorted by priority, with cross-class patterns |
| `/tugi` | On-site assistant teacher (phone). | The "go to these students now" view — names + action |
| `/` | Landing | Kahoot-style join code + Alusta tundi (live polling, "Phase 2 — reaalajas tagasiside") |
| `/student?room=XXXX` | Student during a live lesson | Vote on each step at own pace |
| `/history` | Signed-in teachers | Past lessons, response counts, understanding % |
| `/preview` | Pitch-time mockup | Phase 2: AI step decomposition vision |

## File map

```
class.html / class.js       — single class analysis view (the demo headline)
class-data.js               — simulated eKool dataset (3 rosters × 20 students × 5 exercises)
classes.html / classes.js   — võimendatud õpetaja multi-class dashboard
tugi.html / tugi.js         — phone-friendly assistant teacher view
index.html / teacher.js     — live polling lesson UI (Phase 2 narrative)
student.html / student.js   — student per-step voting page
history.html / history.js   — past lessons for signed-in teachers
preview.html                — Phase 2 mockup (AI step decomposition)
shared.js                   — Supabase realtime helpers
auth.js                     — Supabase auth (email/password) helpers
db.js                       — DB write helpers (lessons / exercises / responses / presence)
schema.sql                  — Postgres schema (paste into Supabase SQL editor)
config.js                   — Supabase URL + publishable key (browser-safe)
style.css                   — single stylesheet, no framework
vercel.json                 — clean URLs (no .html in browser)
og.svg                      — 1200×630 social preview image
PITCH.md                    — synced with team's PITCH.docx; Q&A + demo flow
DECISIONS.md                — overnight choices log; review in the morning
```

## Data flow

```
Mock data:    class-data.js  →  classifier (3 buckets)  →  recommendation engine  →  /class | /classes | /tugi
Live lesson:  /student votes →  Supabase realtime  →  teacher dashboard  →  on Lõpeta, snapshot →  /class?live=1
```

The two paths share the same classifier — backward-looking eKool analysis and forward-looking lesson-end summary both produce the same bucket structure.

## How to run

The Python http server works for local dev:

```
python -m http.server 5500
```

Then visit `http://localhost:5500/class`. (Local file:// has CORS issues with the Supabase client — use a server.)

## Deployment

Push to `main` on GitHub. Vercel auto-deploys in ~30s. No build step (it's all static).

## Keeping the demo working

- The Supabase keys in `config.js` are *publishable* (browser-safe). They work today.
- The schema is in `schema.sql`; if Supabase ever resets, paste it into Supabase SQL editor.
- The Jitsi rooms use `meet.jit.si/edunavi-pres2026-XXXX` — free, no API key.

## Honest scope notes

- The "AI" recommendation is **rule-based**, not an LLM. It's framed as Phase 1 in the pitch; Phase 2 plugs in an LLM.
- The eKool data is **simulated**, not real eKool API. Real integration is a partnership conversation, not a code conversation.
- The mock dataset is one school (Tallinna 21. Kool), three classes (8.A, 8.B, 8.C), one topic (murdude põhitehted). All hardcoded in `class-data.js`.

## Pitch material

`PITCH.md` is the talking script (in Estonian) plus likely Q&A. `DECISIONS.md` lists every overnight choice. Read both before you walk on stage.
