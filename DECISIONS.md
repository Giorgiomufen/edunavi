# Overnight decisions log

Choices I made while you were asleep, in order, with reasoning. Every one of these is reversible — push back on any of them in the morning.

## 1. Built the eKool-style backward-looking analysis as the primary product

**What:** New `/class` route reads simulated eKool data (20 students × 5 fraction exercises), classifies each student into one of three buckets (*Vajab tuge / Ebakindel / Valmis edasi liikuma*), and renders a teacher recommendation in plain Estonian.

**Why:** This matches `PITCH.docx` and the 4.05 strategy doc literally. The judges (in `Tagasiside.docx`) explicitly demanded "one math topic, one teacher workflow, one visible decision." The team's pitch says: *"Õpetaja avab vaate… 1 minutiga selge pilt"* — that's this view.

**Tradeoff:** Took ~1.5 hours. The live-polling product we already had stays — it becomes the "Phase 2 — reaalajas tagasiside" narrative.

## 2. Bucket thresholds (gut-feeling, easy to tweak)

```
ratio < 0.40   → Vajab tuge
ratio 0.40-0.74 → Ebakindel
ratio ≥ 0.75   → Valmis edasi liikuma
```

**Why those numbers:** the 4.05 doc doesn't specify. 0.4 = "got fewer than half right"; 0.75 = "got 4 out of 5 or above." Easy to argue, easy to change.

**To adjust:** edit `BUCKETS` in `class.js`.

## 3. Mock data structure — three rosters

`class-data.js` ships **three different classes**:
- Roster A — typical mid-class spread (most useful default for the demo)
- Roster B — class is mostly stuck (shows recommendation = repeat)
- Roster C — strong class (shows recommendation = move on)

Click "Uus näidis" in the top-right of `/class` to cycle. Lets you demo all three recommendation outcomes.

**Why:** judges always ask "what if the class is mostly bad?" or "what if it's mostly good?" Now you can show all three on stage.

## 4. Recommendation engine is rule-based, framed as "AI"

```
if (need ≥ 50%)        → "Tee kordus — N õpilast vajavad tuge"
else if (ready ≥ 70%)  → "Liigu järgmise teema juurde — N õpilast on valmis"
else                   → "Jaga klass kahte gruppi — N edasi, M kordusele"
```

**Why no real LLM:** no API key set up, would add 30+ min and a runtime dependency. The rule-based logic produces output that's indistinguishable from an LLM for our specific use case (3 buckets, 5 exercises, fraction topics).

**Honest framing for the pitch:** "Phase 1 uses rule-based classification on eKool data. Phase 2 plugs in an LLM for richer pedagogical suggestions."

## 5. "Hidden patterns" feature — implemented per the doc

The 4.05 doc explicitly mentions: *"EduNavi toob esile varjatud mustrid (nt õpilane, kes on ebakindel, kuigi vastus on õige)"*. I implemented three:

1. **Shaky-strong students** — bucketed as "Valmis edasi" but had a partial answer somewhere; the system flags which skill they're shaky on
2. **Topic gap** — single exercise where ≥40% of class struggled
3. **Skill gap** — entire skill (e.g. "ühine nimetaja") where ≥30% of all attempts struggled

These render as a separate panel under the grid.

## 6. Tugiõpetaja mobile view at `/tugi`

Phone-optimized. Shows the *Vajab tuge* names prominently as a numbered list, *Ebakindel* names smaller. Headline tells the assistant teacher what to physically do.

**Sync mechanism:** reads `sessionStorage` from `/class`. If teacher opened `/class` first in the same browser session, `/tugi` shows that snapshot. Otherwise it derives from the default mock dataset.

**Limitation:** sessionStorage doesn't sync across devices. For the real product, this would be a Supabase realtime channel. For the demo it's enough.

## 7. Live-polling product (the one we built earlier) stays untouched

`/`, `/student?room=XXXX`, `/history`, `/preview` — all unchanged. The Klass view sits alongside them. Pitch narrative becomes: *"Backward-looking analysis of past data + Forward-looking real-time signal during the lesson — both in one tool."*

## 8. Things I did NOT do (because they'd risk shipping something broken)

- **Real LLM integration** — needs API key + 30 min, easy follow-up
- **Real eKool API** — they don't expose one publicly; would be a partnership conversation
- **Sync between `/class` and `/tugi` across devices** — would need Supabase realtime channel; for the demo a single-browser walkthrough suffices
- **Authentication on `/class`** — currently anyone with the link can view; fine for the demo, would need RLS in production
- **Did not delete the live-polling product** — even if you don't pitch it, having it as Phase 2 strengthens the vision

## 9. URLs for tomorrow's pitch

| Route | Purpose | Use it for |
|---|---|---|
| `/class` | The headline product | Open this on the projector. This is the demo. |
| `/tugi` | Mobile assistant view | Show on a phone after the main demo. |
| `/` | Original landing (Kahoot-style join + Alusta tundi) | Mention as Phase 2 entry point if asked |
| `/preview` | Phase 2 mockup (AI step decomposition) | Show during Q&A if asked "where's the AI?" |
| `/history` | Past lessons (signed-in teachers) | Mention only if asked about persistence |

## 10. Demo flow I'd suggest tomorrow

1. Open `/class` on projector
2. *"This is what a teacher sees after a fraction lesson. 20 students, 5 exercises. The data already exists in eKool — they just don't have time to analyze it."*
3. Point at the recommendation: *"6 õpilast vajavad murdarvude liitmise kordust."*
4. Click *"Uus näidis"* twice — show that the recommendation adapts ("Liigu edasi" vs "Jaga gruppi")
5. Open `/tugi` on a phone, pull it up to the camera: *"This is what the on-site assistant teacher sees. Just the names. Just the action."*
6. Close: *"Üks otsus, üks minut, üks õpetaja jõuab rohkemate õppijateni."*

That's 60 seconds. The rest is whatever the President + Markus push on.

## 11. Open questions for you in the morning

- Is the bucket-threshold tuning OK? (`<40% / 40-74% / 75-100%`)
- Are the mock student names culturally OK? (I went for plausible Estonian names; some might land oddly to a native speaker)
- Should the recommendation engine speak more formally? (Currently "Tee kordus", could be "Soovitus on kordus" — I went informal/imperative because the 4.05 doc said tone should be didactic and direct)
- Should `/class` be the new landing page, with `/` becoming the live-polling page? (I left `/` alone for now to avoid disrupting the QR-code student flow)
