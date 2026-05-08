# EduNavi — pitch (Estonian)

> Synced with `PITCH.docx` from the team docs folder. Edit it in your voice; don't read it. The Q&A and the demo flow are the load-bearing parts.

## 60-second main pitch

**Setup — 10s.** Kujuta ette õpetajat. Matemaatikatund. 24 õpilast. Tund saab läbi… ja nüüd algab päris töö. Ta avab eKooli. Vaatab tulemusi. Proovib aru saada — *kes sai aru, kes ei saanud, kas ma liigun edasi või pean tagasi minema?* Tal on selleks umbes 10 minutit. Ja see otsus määrab, kas mõni õpilane jääb maha — või saab õigel ajal abi.

**Why now — 10s.** PISA tulemused näitavad selget langust. Õpetajate koormus kasvab, matemaatikaõpetajaid on puudu. Eestis on käivitunud *võimendatud õpetaja* mudel — üks õpetaja õpetab mitut klassi korraga. Aga me ei ole sellele õpetajale andnud tööriista, millega teha kiireid otsuseid.

**Demo moment — 25s.** *(open `/class` on the projector)* See on EduNavi. Üks vaade. *(point at the headline)* Soovitus: "6 õpilast vajavad murdarvude liitmise kordust." *(point at the three buckets)* Kolm gruppi: vajab tuge, ebakindel, valmis edasi liikuma. *(scroll to the per-student grid)* Igal õpilasel on oma muster. *(click "Uus näidis")* Kui klass on tugev, soovitus muutub: "Liigu järgmise teema juurde." *(click again)* Kui klass on hädas, soovitus on "Tee kordus." Üks minut. Üks otsus. Üks õpetaja jõuab rohkemate õppijateni.

**Close — 5s.** EduNavi ei asenda õpetajat. Ta võimendab teda.

## 30-second short version

Eesti õpetaja kulutab iga tunni järel 10 minutit, et eKoolist välja lugeda, kes vajab tuge. EduNavi teeb sama otsuse minutiga. *(open `/class`)* Kolm gruppi, üks soovitus, üks järgmine samm. Võimendatud õpetaja mudelis tähendab see, et üks hea õpetaja jõuab kümnete klassideni — ilma kvaliteeti kaotamata.

## On-stage demo flow (what you actually do)

1. **Open `/class` before stepping up** — `https://edunavi.vercel.app/class`. The page should already be on the projector when you walk on. No fumbling.
2. **First sentence into the demo:** *"See on Tallinna 21. Kool, 8.A klass. 20 õpilast. Murdude põhitehted."*
3. **Read the recommendation aloud.** Don't paraphrase — read what the screen says.
4. **Click "Uus näidis"** in the top-right twice to cycle through the three roster scenarios. The recommendation adapts each time. This is the proof that it's not a static slide.
5. **Pull up `/tugi` on your phone** if you want a second beat: *"See on tugiõpetaja vaade. Mobiilis. Ainult need õpilased, kelle juurde minna."*
6. **Close with the line:** *"Üks õpetaja, sada õpilast, üks otsus, üks minut."*

## Likely judge questions + your answers

**Q: Kuidas see erineb eKoolist?**
A: eKool kogub andmeid. EduNavi tõlgendab neid. eKool ütleb: "Kerli sai 3 punkti." EduNavi ütleb: "Klass on jagatud kolme gruppi, 6 vajavad tuge tehtemustri tõttu, järgmine samm on kordus murdude liitmise kohta." Erinevus on andmetelt → otsuseni.

**Q: Kus on AI?**
A: Praegu kasutame reegliotsuseid, mis tuvastavad mustreid. *(click `/preview` link)* Phase 2 on AI etapistus — õpetaja annab ülesande, AI jagab selle õpilastele arusaadavateks etappideks ja näitab täpset raskuskoha. See on järgmine kiht.

**Q: Kuidas õpetaja jõuab eKoolist andmed siia?**
A: MVP-s simuleerime — sellepärast, et eKooli avatud API-t pole. Esimese koolipiloodi raames teeme partnerluse Tallinna Haridusametiga, kes on käivitanud võimendatud õpetaja mudeli. Andmed liiguvad faili eksportimise või otsese integratsiooniga.

**Q: Aga andmekaitse?**
A: MVP-s ei salvesta me õpilase isikut. Sessioon, ülesanne, soovitus, ajatempel. Õpetaja näeb ainult koondvaadet — kohapealne abiõpetaja näeb oma klassi nimesid. See on minimaalne andmekogum, mis on vajalik otsustuseks.

**Q: Kas see töötab ainult matemaatikas?**
A: Praegu jah — fookus on murdarvud, kuna matemaatikalünged kuhjuvad kõige kiiremini ja matemaatikaõpetajaid on kõige rohkem puudu. Sama struktuur (mustrid → grupp → soovitus) töötab ka teiste ainetega, kus on selge oskuste hierarhia.

**Q: Kuidas õpetaja teab, et soovitus on õige?**
A: Õpetaja kinnitab. EduNavi ei tee otsust õpetaja eest — ta teeb soovituse, õpetaja vaatab andmeid, kinnitab või muudab. Lõplik pedagoogiline otsus jääb õpetajale. See on osa konstitutsioonist.

**Q: Mis on järgmine samm?**
A: Üks koolipilood Tallinnas, järgmine kvartal. Mõõdame: ajakulu vähenemine, otsustuskindluse muutus, abivajajate märkamise täpsus. Kui need näitajad lähevad õigesse suunda, laiendame kahele koolile. Kui ei, parandame andmemudelit ja proovime uuesti.

## What NOT to say

- ❌ "Me kasutame Supabase'i / Vercel'i / Chart.js'i." Tehnoloogia on infrastruktuur, mitte pitch.
- ❌ "On veel palju vaja teha." Iga prototüüp on poolik. Ära viita oma puudustele — too välja, mis töötab.
- ❌ "AI lahendab kõik." Doc ütleb sõnaselgelt: AI ei asenda õpetaja otsust.
- ❌ Üksikasjalikud tehnilised plaanid. President ja Markus tahavad näha probleemi → lahendust → mõõdetavat tulemust.

## URLs to memorize

- `edunavi.vercel.app/class` — **the demo**. Open this on the projector.
- `edunavi.vercel.app/tugi` — tugiõpetaja vaade, näita telefonis.
- `edunavi.vercel.app/preview` — Phase 2 AI etapistus, mockup. Klõpsa Q&A ajal.
- `edunavi.vercel.app/` — Phase 2 reaalajas tagasiside (live polling), maini ainult kui küsitakse.

## The core thesis (one line)

Eestis ei ole probleem õpilaste andmete puudus, vaid õpetaja võime teha õigel ajal õigeid otsuseid. EduNavi annab võimendatud õpetajale tööriista, et teha üks otsus minutiga.

## What lands with this room specifically

- **The President** wants to see a working Estonian product solving an Estonian problem. Lead with Tallinn, lead with the võimendatud õpetaja pilot, lead with PISA. Don't go global.
- **Markus** wants to see real execution and pragmatism. Don't oversell — say "Phase 1 is rule-based, Phase 2 is LLM" honestly.
- **Both** will probably ask "what's the business model?" Honest answer: "Institutional license to ministries / haridusametid in v2. Today the focus is proving the data layer works in Tallinn schools."
