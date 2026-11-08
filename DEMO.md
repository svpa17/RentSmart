# RĂSCRUCE AI: scenariul prezentării (4 minute)

> **Mesajul:** apartamentul care pare mai ieftin are costuri ascunse și cade la prima furtună.
> Formularea corectă: **„Dintre anunțurile tale salvate, B este mai sigur.”** Nu spunem niciodată „cea mai bună ofertă de pe piață”.

## Pregătire

### Cu o zi înainte
- [ ] `npm install` și `npm run build`.
- [ ] Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `dist/extension`. Fixează iconița RĂSCRUCE în bară.
- [ ] Dacă backend-ul e publicat: `.env.local` cu `VITE_API_BASE_URL`, apoi `npm run build` din nou și reîncarcă extensia. Verifică `GET /api/health`.
- [ ] Înregistrează **video-ul de rezervă** al întregului scenariu de mai jos.

### Cu 30 de minute înainte
- [ ] `npm run rehearsal`: trebuie să afișeze **9/9 pași reușiți** (fără internet, mod demonstrativ).
- [ ] `npm run demo-site` (rămâne pornit): anunțurile sunt pe `http://localhost:5174`.
- [ ] Dashboard → **Setări → Încarcă scenariul demonstrativ** (Passport fictiv, curs demo, A și B, 12 luni din ianuarie, fără furtuni).
- [ ] Taburi deschise: `localhost:5174/anunt-a.html` și dashboard-ul extensiei (secțiunea Anunțuri salvate).
- [ ] Zoom 110–125% pentru proiector. Video-ul de rezervă pregătit.

## Scenariul (cronometrat)

| Timp | Ce arăți | Ce spui |
|---|---|---|
| **0:00–0:20** | Pagina `anunt-a.html`: 350 EUR, garsonieră Mănăștur. | „Ana caută prima chirie. Anunțul A pare cel mai ieftin: 350 de euro. Dar cât o costă de fapt?” |
| **0:20–1:00** | Click pe iconița RĂSCRUCE → **Analizează pagina curentă**. Arată eticheta „DATE DEMONSTRATIVE”, statusurile Găsit / De întrebat și fragmentul-dovadă de sub chirie. | „RĂSCRUCE citește anunțul chiar acolo unde Ana decide. Tot ce e «Găsit» are dovada din anunț. Întreținerea, comisionul și reparațiile lipsesc: nu le ghicim, le marcăm «De întrebat».” |
| **1:00–1:20** | Tab **Întrebări (4)** → mesajul pentru proprietar → **Copiază mesajul**. | „Primește întrebările gata scrise pentru proprietar.” |
| **1:20–1:50** | Tab **Cost real**: 2.500 RON vara, 2.950 iarna, **5.875 RON la mutare**; întreținerea marcată „estimare”, comisionul „Comision agenție · estimat la 50% din chirie”. | „Chiria de 1.750 de lei devine 2.950 iarna. Și la mutare îi trebuie 5.875 de lei, fără prima chirie. Fiecare sumă are sursa ei.” |
| **1:50–2:10** | Dashboard → **Comparație**. | „Am salvat și anunțul B, la 1.950 de lei. Dintre anunțurile ei salvate, B are cel mai mic cost lunar estimat.” |
| **2:10–3:10** | **Crossroads** (12 luni): ambele drumuri sigure. Scrie în furtuni: **„Îmi pierd jobul 2 luni, din aprilie.”** → Interpretează → Adaugă furtuna. A intră în zona roșie: „Luna 5 (mai): banii disponibili devin negativi”, −825 RON. B rămâne sigur. | „Acum viața: Ana își pierde jobul două luni. Pe drumul A rămâne fără bani în mai. Pe drumul B e în siguranță.” |
| **3:10–3:35** | Cardul **Path to Yes**: patru variante calculate. Click pe „Strânge încă 1.825 RON” → linia punctată „Planul”. | „Nu îi spunem doar «nu». Îi arătăm ce ar face A sigur: amânarea cu o lună, 1.825 de lei în plus sau B. Toate calculate de motor, nu de AI.” |
| **3:35–3:50** | *(Doar dacă AI-ul e publicat și funcționează)* un anunț real OLX → Analizează. | „Și funcționează pe anunțuri reale.” |
| **3:50–4:00** | Închidere. | „Datele ei financiare nu părăsesc browserul. AI-ul doar citește anunțul; cifrele vin dintr-un motor determinist. RĂSCRUCE: know before you commit.” |

## Dacă ceva nu merge

| Problemă | Ce faci |
|---|---|
| Internetul sau AI-ul nu merge | Continuă: modul demonstrativ nu are nevoie de rețea (verificat de `npm run rehearsal`). Sari peste pasul OLX. |
| Panoul nu poate citi pagina | **Lipește textul anunțului** (copiază descrierea din `anunt-a.html`). Rezultatul e același. |
| Cifrele nu corespund (s-a modificat ceva) | Setări → **Încarcă scenariul demonstrativ** (resetează Passport-ul, anunțurile și furtunile). |
| Furtuna nu se interpretează | Folosește butonul **⚡ Pierderea venitului** (implicit: din luna 4 · apr, 2 luni, 100%). Rezultatul e identic. |
| Extensia nu pornește | Pornește **video-ul de rezervă**. |

## Întrebări probabile

- **„AI-ul calculează costurile?”** Nu. AI-ul doar transformă textul anunțului în câmpuri, fiecare cu fragmentul exact din anunț; codul verifică dovada. Toate calculele sunt într-un motor JavaScript determinist, testat (121 de teste).
- **„Ce date pleacă din browser?”** Doar textul anunțului (cu telefoanele și e-mailurile ascunse), lista câmpurilor lipsă și, opțional, textul unei furtuni fără sume. Venitul și economiile nu pleacă niciodată. Acordul se cere la prima analiză.
- **„De unde vin estimările?”** Din intervale de referință cu surse (presă, 2026), folosind capătul prudent; sunt marcate „estimare”. În demo folosim intervale fictive.
- **„Ce curs EUR folosiți?”** Doar cursul introdus de utilizator. Fără curs, anunțul în EUR rămâne „incomplet”.
- **„E A o ofertă proastă?”** Nu spunem asta. Spunem doar că, dintre anunțurile salvate de Ana și pentru situația ei, B e mai sigur.

## Cifrele scenariului (pentru verificare rapidă)

| | A · Mănăștur | B · Gheorgheni |
|---|---|---|
| Cost lunar vara / iarna | 2.500 / 2.950 RON | 2.350 / 2.450 RON |
| Plată la mutare (fără prima chirie) | 5.875 RON | 3.450 RON |
| Medie lunară | 2.688 RON | 2.392 RON |
| Cu pierderea venitului 2 luni din aprilie | **−825 RON în mai** | sigur (minim 2.400) |
| Path to Yes pentru A | amânare 1 lună · +1.825 RON · B · −365 RON/lună | — |
