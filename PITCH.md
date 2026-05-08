# EduNavi — pitch (Estonian)

> Draft for tomorrow. Edit it, don't read it. The notes are scaffolding, not a script.

## 60-second main pitch

**Hook — 10s.** Eesti hariduses ei ole probleem andmete puudus. Probleem on, et õpetaja ei näe õigel ajal, kus õpilased kinni jäävad. Eriti matemaatikas — ühe lahenduskäigu ajal sajad lüngad. Õpetaja ei suuda neid ükshaaval märgata.

**Demo — 30s.** *(skaneeri QR ekraanil)* Te olete just minu õpilased. *(postita ülesanne: "Lahenda 7x − 5 = 16")* Vaadake. *(viita graafikule)* Reaalajas. See õpetaja vaade — see on EduNavi. Üks õpetaja näeb sada õpilast korraga.

**Vision — 15s.** Tallinn juba katsetab võimendatud õpetaja mudelit — üks tugev aineõpetaja jõuab läbi videosillaga mitme kooli õpilasteni. Aga see mudel töötab ainult siis, kui õpetaja näeb klassipilti. EduNavi annab talle silmad. Järgmine samm: AI jagab ülesande etappideks, õpilane märgib ühe klõpsuga, kus jäi kinni — ja õpetaja näeb täpset raskuskohti.

**Close — 5s.** Me ei asenda õpetajat AI-ga. Me anname ühele heale õpetajale tuhande õpilase silmad.

## 30-second short version (if cut)

Eestis ei puudu hariduses andmed — puudub aeg, et õpetaja näeks reaalajas, kus õpilased kinni jäävad. *(skaneeri QR)* Te olete õpilased. *(postita ülesanne, oota vastuseid)* See graafik on klassi mõistmine reaalajas. Üks õpetaja, sada õpilast, üks pilk. AI jagab homme ülesande etappideks. EduNavi.

## Demo-script (what you actually do on stage)

1. **Open** `https://edunavi.vercel.app/` on the projector laptop.
2. **Click** *Alusta tundi* before stepping up — so the QR is on screen when you start. (Don't fumble live.)
3. **First sentence**: *Te olete minu õpilased. Skaneerige QR.*
4. **Wait 5 seconds** — the counter ticks up. This silence is the demo.
5. **Type the question**: `Lahenda 7x − 5 = 16` and post.
6. **Narrate while it fills**: *Sain aru, pole kindel, ei saanud aru. Mina näen reaalajas, kelle juures peatuda.*
7. **Land the line**: *Üks õpetaja näeb sada õpilast korraga.*

## Likely judge questions + your answers

**Q: Kuidas see erineb Kahoot'ist või Mentimeetri pollidest?**
A: Kahoot kontrollib õigeid vastuseid. EduNavi ei kontrolli vastust — ta näitab, kus õpilane kinni jäi *lahenduskäigus*. AI jagab matemaatikaülesande etappideks ja õpilane märgib ühe etapi. See on pedagoogiline otsustugi, mitte viktoriin.

**Q: Aga kui õpilased ei viitsi vajutada?**
A: Tagasiside võtab ühe sekundi. Doc-i põhjal vaikimisi eeldatakse edasiliikumist — õpilane märgib ainult kohti, kus *tekkis probleem*, mitte kõiki "sain aru" kohti. See on konkreetselt selleks, et keskmised õppijad — kes ise abi ei küsi — ikkagi jätaksid jälje.

**Q: Kuidas te eristate tugevaid ja nõrku õpilasi?**
A: Esimeses prototüübis — anonüümselt, klassi tasemel. Doc ütleb sõna otseses mõttes: *"Õpetaja jaoks ei ole oluline, kes kinni jäi — vaid kus ja kui paljud."* Individuaalse profiili saab kohapealne abiõpetaja, kes oma klassi tunneb.

**Q: Kas see töötab ainult videotunnis?**
A: Ei. Õpilane saab tagasisidet anda ka kodutööd lahendades — tegelikud lüngad ilmnevad just iseseisval lahendamisel. Sama QR-link töötab nii tunnis kui kodus.

**Q: Mis on järgmine samm?**
A: AI etapistus — õpetaja kleepib ülesande, AI pakub 3–7 lahenduslogikuks etappi, õpetaja kinnitab. Õpilane näeb etappe ja märgib täpse koha. See teeb klassipildist kuumakaardi.

**Q: Kas Tallinna haridusamet on kontekstis?**
A: Jah. Idee tuli "Võimendatud õpetaja" piloodist — koolidel oli infrastruktuur, aga puudus pedagoogiline otsustugi. EduNavi täidab selle tühiku.

**Q: Andmekaitse?**
A: MVP-s ei salvesta me õpilase isikut. Sessioon, ülesanne, etapp, tagasiside, ajatempel. Punkt.

## What NOT to say on stage

- ❌ "Me kasutame Supabase'i / Jitsit / Vercel'i." Tehnoloogia on infrastruktuur, mitte pitch.
- ❌ "On veel palju vaja teha." Iga prototüüp on poolik. Ära viita oma puudustele.
- ❌ "AI lahendab kõik." Doc ütleb sõnaselgelt: AI ei asenda õpetaja otsust.
- ❌ Üksikasjalikud arendusplaanid. President ei taha roadmap'i, ta tahab näha probleemi ja lahendust.

## One thing to remember

The demo's wow moment is silent. When the QR appears and the counter starts ticking, **don't fill the silence**. Let them scan. Let them feel it. Then talk.
