/* Deutsch in 2 Minuten: a tiny offline-first micro-learning app. No build step. */
'use strict';

const $app = document.getElementById('app');
const DAY = 864e5;
const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120]; // days per SRS box
const SKILLS = ['wb', 'lesen', 'hoeren', 'schreiben', 'sprechen', 'party'];
const STATES = { '': 'Noch nicht gewählt', BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg', HB: 'Bremen', HH: 'Hamburg', HE: 'Hessen', MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz', SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein', TH: 'Thüringen' };
const TYPE_LABEL = { vocab: 'Wortschatz', decode: 'Entschlüsseln', lid: 'Leben in Deutschland', lesen: 'Lesen', hoeren: 'Hören', schreiben: 'Schreiben', sprechen: 'Sprechen', party: 'Party-Hören', wb: 'Arbeitsheft' };

let DATA = null;
let S = load();
let session = null;

/* ---------- storage ---------- */
function load() {
  const def = { srs: {}, decks: [], streak: { last: '', n: 0 }, days: {}, seen: {}, settings: { state: 'BY', mix: 6, rate: 0.95, week: 1 } };
  try { const s = JSON.parse(localStorage.getItem('d2m') || '{}'); return { ...def, ...s, settings: { ...def.settings, ...(s.settings || {}) } }; }
  catch { return def; }
}
function save() { localStorage.setItem('d2m', JSON.stringify(S)); }
const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD local

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickRandom = a => a[Math.floor(Math.random() * a.length)];
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

/* ---------- speech ---------- */
let deVoice = null;
/* Prefer the most natural German voices the device has (iOS "Premium"/"Enhanced",
   Edge/Chrome "Natural"/"Online"/Google). */
function voiceScore(v) {
  let sc = 0;
  if (/de-DE/i.test(v.lang)) sc += 2;
  if (/(premium|enhanced|natural|neural|online)/i.test(v.name)) sc += 6;
  if (/google/i.test(v.name)) sc += 3;
  if (/(Anna|Helena|Petra|Markus|Yannick|Katja|Conrad|Amala|Florian|Seraphina)/.test(v.name)) sc += 1;
  if (/(eloquence|grandma|grandpa|shelley|sandy|rocko|reed|flo|eddy)/i.test(v.name)) sc -= 5;
  return sc;
}
let deVoices = [];
function pickVoice() {
  deVoices = speechSynthesis.getVoices().filter(v => /^de(-|_|$)/i.test(v.lang)).sort((a, b) => voiceScore(b) - voiceScore(a));
  deVoice = deVoices[0] || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text, rate) {
  if (!('speechSynthesis' in window)) return toast('Sprachausgabe nicht verfügbar');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE'; if (deVoice) u.voice = deVoice; u.rate = rate || S.settings.rate;
  speechSynthesis.speak(u);
}
const Recog = window.SpeechRecognition || window.webkitSpeechRecognition;

/* ---------- SRS ---------- */
function srsGet(k) { return S.srs[k]; }
function isDue(k, now = Date.now()) { const r = S.srs[k]; return r && r.d <= now; }
function grade(k, g) { // g: 0 again, 1 good, 2 easy
  const r = S.srs[k] || { b: 0, d: 0 };
  if (g === 0) r.b = 1; else r.b = Math.min(INTERVALS.length - 1, r.b + g);
  r.d = g === 0 ? Date.now() + 10 * 60e3 : Date.now() + INTERVALS[r.b] * DAY - 3 * 3600e3;
  r.l = Date.now();
  S.srs[k] = r; save();
}
/* choose n keys from a pool: due first (oldest due), then new ones */
function choose(pool, n, keyOf) {
  const now = Date.now();
  const due = pool.filter(x => isDue(keyOf(x), now)).sort((a, b) => S.srs[keyOf(a)].d - S.srs[keyOf(b)].d);
  const fresh = shuffle(pool.filter(x => !srsGet(keyOf(x)))).sort(weekFirst);
  return [...due, ...fresh].slice(0, n);
}

/* Balanced round of exactly n: due reviews first, but always some new words
   (about a third) so you keep progressing, and if there is room, a few
   already-known cards you haven't seen for the longest time. */
function balanced(pool, n, keyOf) {
  const now = Date.now();
  const due = pool.filter(x => isDue(keyOf(x), now)).sort((a, b) => S.srs[keyOf(a)].d - S.srs[keyOf(b)].d);
  const fresh = shuffle(pool.filter(x => !srsGet(keyOf(x)))).sort(weekFirst);
  const known = pool.filter(x => { const r = srsGet(keyOf(x)); return r && r.d > now; })
    .sort((a, b) => (S.srs[keyOf(a)].l || 0) - (S.srs[keyOf(b)].l || 0));
  const minReview = Math.min(Math.ceil(n * 0.2), due.length + known.length); // always some review
  const nNew = Math.min(fresh.length, Math.max(Math.ceil(n * 0.3), n - due.length), n - minReview);
  const out = [...due.slice(0, n - nNew), ...fresh.slice(0, nNew)];
  out.push(...known.slice(0, n - out.length));
  out.push(...fresh.slice(nNew, nNew + n - out.length)); // pool too small: more new
  return shuffle(out);
}

/* ---------- content pools ---------- */
const inWeek = x => !x.wk || x.wk <= S.settings.week;
/* prefer the current week's new items, then earlier weeks */
const weekFirst = (a, b) => ((b.wk === S.settings.week) - (a.wk === S.settings.week));
function vocabPool() {
  const builtIn = DATA.vocab.map(c => ({ ...c, k: 'v:' + c.w }));
  const mine = S.decks.filter(d => d.on !== false).flatMap(d => d.cards.map((c, i) => ({ ...c, k: `u:${d.id}:${i}`, deck: d.name })));
  return [...mine, ...builtIn].filter(inWeek);
}
const decodePool = () => DATA.decode.filter(inWeek).map(c => ({ ...c, k: 'd:' + c.w }));
const lidPool = () => DATA.lid.filter(q => !q.s || q.s === S.settings.state).map(q => ({ ...q, k: 'l:' + q.id }));
function leastSeen(kind, list) {
  const seen = S.seen[kind] || {};
  let ids = list.map((_, i) => i).filter(i => inWeek(list[i]));
  if (!ids.length) ids = list.map((_, i) => i);
  const cur = ids.filter(i => list[i].wk === S.settings.week);
  const minOf = arr => Math.min(...arr.map(i => seen[i] || 0));
  // current week's tasks first until each has been seen once
  if (cur.length && minOf(cur) === 0) ids = cur;
  const min = minOf(ids);
  const idx = pickRandom(ids.filter(i => (seen[i] || 0) === min));
  return { i: idx, item: list[idx] };
}
function markSeen(kind, i) { (S.seen[kind] ||= {})[i] = ((S.seen[kind] || {})[i] || 0) + 1; save(); }
const MIX_SKILLS = SKILLS.filter(s => s !== 'sprechen');
function nextSkill() {
  const c = S.seen._skills || {};
  const min = Math.min(...MIX_SKILLS.map(s => c[s] || 0));
  return pickRandom(MIX_SKILLS.filter(s => (c[s] || 0) === min));
}

/* ---------- build sessions ---------- */
function buildMix() {
  const n = S.settings.mix;
  const q = [];
  balanced(vocabPool(), Math.max(2, n - 3), x => x.k).forEach(c => q.push({ t: 'vocab', c }));
  choose(decodePool(), 1, x => x.k).forEach(c => q.push({ t: 'decode', c }));
  const lidLeft = Math.max(1, Math.min(2, 5 - ((S.days[today()] || {}).lid || 0)));
  choose(lidPool(), lidLeft, x => x.k).forEach(c => q.push({ t: 'lid', c }));
  const sk = nextSkill(); q.push(skillItem(sk));
  return q;
}
function skillItem(kind) {
  if (kind === 'wb') return wbItem();
  const list = DATA.tasks[kind];
  const { i, item } = leastSeen(kind, list);
  return { t: kind, c: item, i };
}
function buildSection(kind) {
  if (kind === 'wb') return [wbItem()];
  if (kind === 'vocab') return balanced(vocabPool(), 10, x => x.k).map(c => ({ t: 'vocab', c }));
  if (kind === 'decode') return balanced(decodePool(), 5, x => x.k).map(c => ({ t: 'decode', c }));
  if (kind === 'lid') return choose(lidPool(), 5, x => x.k).map(c => ({ t: 'lid', c }));
  const n = kind === 'hoeren' ? 4 : kind === 'lesen' || kind === 'party' ? 2 : 3;
  const out = []; const used = new Set();
  for (let j = 0; j < n; j++) { const it = skillItem(kind); if (used.has(it.i)) continue; used.add(it.i); markSeen(kind, it.i); out.push(it); }
  return out;
}

/* ---------- streak & stats ---------- */
function recordItem(correct, type) {
  const d = today();
  const day = S.days[d] ||= { n: 0, ok: 0 };
  day.n++; if (correct) day.ok++; if (type === 'lid') day.lid = (day.lid || 0) + 1;
  if (S.streak.last !== d) {
    const y = new Date(Date.now() - DAY).toLocaleDateString('sv');
    S.streak.n = S.streak.last === y ? S.streak.n + 1 : 1;
    S.streak.last = d;
    S.streak.best = Math.max(S.streak.best || 0, S.streak.n);
  }
  save();
}
function streakNow() { const y = new Date(Date.now() - DAY).toLocaleDateString('sv'); return (S.streak.last === today() || S.streak.last === y) ? S.streak.n : 0; }

/* ---------- views ---------- */
function home() {
  stopSpeech();
  session = null;
  const dueV = vocabPool().filter(x => isDue(x.k)).length;
  const newV = vocabPool().filter(x => !srsGet(x.k)).length;
  const lidAll = lidPool(); const lidDone = lidAll.filter(x => { const r = srsGet(x.k); return r && r.b >= 2; }).length;
  const t = S.days[today()] || { n: 0 };
  $app.innerHTML = `
    <div class="top">
      <div><h1>Deutsch in 2 Minuten</h1><p class="muted small">Statt scrollen: kurz lernen.</p></div>
      <button class="iconbtn" data-go="settings" aria-label="Einstellungen">⚙︎</button>
    </div>
    <div class="row" style="margin:14px 0 16px;flex:none">
      <span class="pill fire" style="flex:none">🔥 ${streakNow()} Tag${streakNow() === 1 ? '' : 'e'}</span>
      <span class="pill" style="flex:none">Woche ${S.settings.week}</span>
      <span class="pill" style="flex:none">Heute: ${t.n} · 🇩🇪 ${t.lid || 0}/5</span>
    </div>
    ${missionCard()}
    <button class="btn primary" data-start="mix">▶ 2-Minuten-Mix</button>
    <p class="muted small" style="text-align:center">Ein paar Wörter, eine Einbürgerungsfrage und eine kurze Übung</p>
    ${progressCard()}
    <div class="grid" style="margin-top:12px">
      ${wbTile()}
      ${tile('vocab', '10 Wörter', `${dueV} zum Wiederholen · ${newV} neu`)}
      ${tile('lid', 'Leben in Deutschland', `${lidDone}/${lidAll.length} sicher`)}
      ${tile('lesen', 'Lesen', 'Kurze Texte, B1')}
      ${tile('party', 'Party-Hören', 'Schnelle Alltagsdialoge')}
    </div>
    <details style="margin-top:12px"><summary>Mehr üben</summary>
      <div class="grid" style="margin-top:10px">
        ${tile('decode', 'Entschlüsseln', 'Wörter aus Teilen')}
        ${tile('hoeren', 'Diktat', 'Hören & tippen')}
        ${tile('schreiben', 'Schreiben', 'Ein Satz, mit Muster')}
        ${tile('sprechen', 'Sprechen', 'Für zu Hause: laut antworten')}
        <button class="tile" data-go="import"><b>＋ Quizlet-Import</b><span>${S.decks.length} eigene Stapel</span></button>
      </div></details>
    </div>`;
}
const tile = (k, title, sub) => `<button class="tile" data-start="${k}"><b>${esc(title)}</b><span>${esc(sub)}</span></button>`;

function startSession(kind) {
  const q = kind === 'mix' ? buildMix() : buildSection(kind);
  if (kind === 'mix') q.filter(x => SKILLS.includes(x.t)).forEach(x => { if (x.i !== undefined) markSeen(x.t, x.i); (S.seen._skills ||= {})[x.t] = (S.seen._skills[x.t] || 0) + 1; save(); });
  if (!q.length) { toast('Gerade nichts fällig. Komm später wieder!'); return; }
  session = { kind, q, pos: 0, ok: 0, start: Date.now(), requeued: new Set() };
  clearInterval(window._tick);
  window._tick = setInterval(() => { const el = document.querySelector('.timer'); if (el && session) el.textContent = fmtTime(Date.now() - session.start); }, 1000);
  renderItem();
}
const fmtTime = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function frame(inner, tag) {
  const { pos, q } = session;
  const mod = q[pos].c && q[pos].c.mod; if (mod && !tag.includes(mod)) tag += ' · ' + mod;
  return `
    <div class="top">
      <button class="iconbtn" data-go="home" aria-label="Schließen">✕</button>
      <span class="muted">${pos + 1} / ${q.length}</span>
      <span class="pill timer">${fmtTime(Date.now() - session.start)}</span>
    </div>
    <div class="progress"><i style="width:${(pos / q.length) * 100}%"></i></div>
    <div class="card"><div class="tag">${esc(tag)}</div>${inner}</div>`;
}

function next(correct) {
  recordItem(correct, session.q[session.pos].t);
  if (correct) session.ok++;
  session.pos++;
  if (session.pos >= session.q.length) return finish();
  renderItem();
}
function finish() {
  clearInterval(window._tick); stopSpeech();
  const secs = Math.round((Date.now() - session.start) / 1000);
  $app.innerHTML = `
    <div class="card done"><div class="body">
      <div class="big">${streakNow() > 1 ? '🔥' : '✅'}</div>
      <h1>Gut gemacht!</h1>
      <p class="muted">${session.q.length} Aufgaben in ${fmtTime(secs * 1000)} · Serie: ${streakNow()} Tag${streakNow() === 1 ? '' : 'e'}</p>
    </div>
    <div class="stack actions">
      <button class="btn primary" data-start="${session.kind}">Noch eine Runde</button>
      <button class="btn ghost" data-go="home">Fertig</button>
    </div></div>`;
}

function renderItem() {
  stopSpeech();
  const it = session.q[session.pos];
  ({ vocab: vVocab, decode: vDecode, lid: vLid, lesen: vLesen, hoeren: vHoeren, schreiben: vSchreiben, sprechen: vSprechen, party: vParty, wb: vWb })[it.t](it.c);
  window.scrollTo(0, 0);
}

/* --- Wortschatz (flashcard) --- */
function vVocab(c) {
  const tag = c.deck ? `Wortschatz · ${c.deck}` : 'Wortschatz';
  const front = `<div class="word"${c.w.length > 40 ? ' style="font-size:22px;font-weight:500"' : ''}>${esc(c.w)}</div>${c.s ? `<div class="sentence">${esc(c.s)}</div>` : ''}`;
  $app.innerHTML = frame(`
    <div class="top" style="margin-top:6px"><button class="speak" id="say" aria-label="Vorlesen">🔊</button></div>
    <div class="body flipzone" id="flip">${front}<p class="muted small" style="margin-top:22px">Tippen zum Umdrehen</p></div>`, tag);
  const speakText = c.s ? `${c.w}. ${c.s}` : c.w;
  document.getElementById('say').onclick = () => say(speakText);
  document.getElementById('flip').onclick = () => {
    document.querySelector('.card').innerHTML = `<div class="tag">${esc(tag)}</div>
      <div class="top" style="margin-top:6px"><button class="speak" id="say" aria-label="Vorlesen">🔊</button></div>
      <div class="body">${front}
        <div class="big" style="margin-top:18px">${esc(c.m)}</div>
        ${c.x ? `<div class="morph">${esc(c.x)}</div>` : ''}
        ${extras(c)}
      </div>
      <div class="rate">
        <button class="btn again" data-g="0">Nochmal</button>
        <button class="btn good" data-g="1">Gut</button>
        <button class="btn easy" data-g="2">Leicht</button>
      </div>`;
    document.getElementById('say').onclick = () => say(speakText);
    document.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
      const g = +b.dataset.g; grade(c.k, g);
      next(g > 0);
    });
  };
}

function extras(c) {
  const rows = [['Plural', c.pl], ['Rektion', c.rp], ['Kollokation', c.col]].filter(r => r[1]);
  return rows.length ? `<div class="small" style="margin-top:10px">${rows.map(([k, v]) => `<div class="statline"><span class="muted">${k}</span><span>${esc(v)}</span></div>`).join('')}</div>` : '';
}
const checklist = c => c.chk && c.chk.length ? `<div class="morph" style="margin-top:12px"><b>Check zuerst:</b>${c.chk.map((t, i) => `<label style="display:flex;gap:8px;margin-top:6px"><input type="checkbox" style="width:auto"> ${esc(t)}</label>`).join('')}</div>` : '';

/* --- multiple-choice helper --- */
function mc({ tag, head, options, answer, onDone, after }) {
  const order = shuffle(options.map((o, i) => i));
  $app.innerHTML = frame(`<div class="body">${head}
    <div id="opts">${order.map(i => `<button class="opt" data-i="${i}">${esc(options[i])}</button>`).join('')}</div>
    <div id="fb"></div></div>`, tag);
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const i = +b.dataset.i, ok = i === answer;
    document.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (+x.dataset.i === answer) x.classList.add('right'); });
    if (!ok) b.classList.add('wrong');
    document.getElementById('fb').innerHTML = `<div class="feedback">${ok ? '✅ Richtig!' : '❌ Leider falsch.'} ${after || ''}</div>
      <button class="btn primary actions" id="nx">Weiter</button>`;
    document.getElementById('nx').onclick = () => { onDone(ok); };
  });
}

/* --- Entschlüsseln --- */
function vDecode(c) {
  mc({
    tag: 'Entschlüsseln · Was bedeutet das?',
    head: `<div class="word">${esc(c.w)}</div><div class="sentence">${esc(c.s)}</div>`,
    options: c.o, answer: c.a,
    after: `<div class="morph" style="margin-top:10px">${esc(c.p)}</div>`,
    onDone: ok => { grade(c.k, ok ? 1 : 0); next(ok); }
  });
}

/* --- Leben in Deutschland --- */
function vLid(c) {
  mc({
    tag: `Leben in Deutschland${c.s ? ' · ' + STATES[c.s] : ''}`,
    head: `<div class="big" style="font-size:22px">${esc(c.q)}</div>
      ${c.en ? `<details style="background:var(--card2)"><summary class="small muted">English</summary><p class="small">${esc(c.en)}</p></details>` : ''}`,
    options: c.o, answer: c.a,
    onDone: ok => { grade(c.k, ok ? 1 : 0); next(ok); }
  });
}

/* --- Lesen --- */
function vLesen(c) {
  let qi = 0, score = 0;
  const show = () => {
    const q = c.q[qi];
    mc({
      tag: `Lesen · Frage ${qi + 1}/${c.q.length}`,
      head: `<p style="font-size:17px;background:var(--card2);padding:14px;border-radius:14px">${esc(c.t)}</p>
        <p style="margin-top:14px;font-weight:600">${esc(q.q)}</p>`,
      options: q.o, answer: q.a,
      onDone: ok => { if (ok) score++; qi++; if (qi < c.q.length) show(); else next(score === c.q.length); }
    });
  };
  show();
}

/* --- Hören (dictation) --- */
function words(s) { return s.toLowerCase().replace(/[.,!?;:„“"()]/g, ' ').split(/\s+/).filter(Boolean); }
function diffWords(expected, got) {
  const a = words(expected), b = words(got), A = expected.replace(/[.,!?;:„“"()]/g, ' ').split(/\s+/).filter(Boolean);
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0; const out = [];
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push(`<span class="ok">${esc(A[i])}</span>`); i++; j++; }
    else if (j < b.length && (i >= a.length || L[i][j + 1] >= L[i + 1][j])) { j++; } // extra typed word: skip
    else { out.push(`<span class="miss">${esc(A[i])}</span>`); i++; }
  }
  return { html: out.join(' '), score: a.length ? L[0][0] / a.length : 0 };
}
function vHoeren(item) {
  const text = typeof item === 'string' ? item : item.t;
  $app.innerHTML = frame(`<div class="body">
    <p>Hör zu und schreib den Satz auf.</p>
    <div class="row" style="margin:14px 0">
      <button class="btn" id="p1">🔊 Abspielen</button>
      <button class="btn ghost" id="p2">🐢 Langsam</button>
    </div>
    <textarea id="ans" placeholder="Was hast du gehört?" autocapitalize="sentences" autocomplete="off" spellcheck="false"></textarea>
    <div id="fb"></div>
    <button class="btn primary actions" id="chk">Prüfen</button></div>`, 'Hören · Diktat');
  document.getElementById('p1').onclick = () => say(text, 0.95);
  document.getElementById('p2').onclick = () => say(text, 0.7);
  setTimeout(() => say(text, 0.95), 300);
  document.getElementById('chk').onclick = function () {
    const d = diffWords(text, document.getElementById('ans').value);
    const ok = d.score >= 0.9;
    document.getElementById('fb').innerHTML = `<div class="feedback"><p class="diff">${d.html}</p>
      <p class="muted small">${Math.round(d.score * 100)}% der Wörter richtig. <span style="color:#ffb59a">Markiert</span> = fehlt oder falsch geschrieben.</p>
      <p class="small">Lösung: ${esc(text)}</p></div>`;
    this.textContent = 'Weiter'; this.onclick = () => next(ok);
  };
}

/* --- Schreiben --- */
function vSchreiben(c) {
  $app.innerHTML = frame(`<div class="body">
    <p class="big" style="font-size:20px">${esc(c.p)}</p>
    <textarea id="ans" style="margin-top:14px" placeholder="Auf Deutsch schreiben …" autocapitalize="sentences" spellcheck="false"></textarea>
    ${checklist(c)}
    <div id="fb"></div>
    <button class="btn primary actions" id="chk">Musterlösung zeigen</button></div>`, 'Schreiben');
  document.getElementById('chk').onclick = function () {
    document.getElementById('fb').innerHTML = `<div class="morph"><b>Muster:</b> ${esc(c.m)}</div>
      <p class="feedback">💡 ${esc(c.tip)}</p>
      <p class="muted small">Vergleiche: Stimmen Verbposition, Fall und Endungen?</p>
      <div class="rate" style="grid-template-columns:1fr 1fr">
        <button class="btn again" data-ok="0">Noch unsicher</button>
        <button class="btn easy" data-ok="1">Hab ich gut gemacht</button></div>`;
    this.remove();
    document.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => next(b.dataset.ok === '1'));
  };
}

/* --- Sprechen --- */
function vSprechen(c) {
  $app.innerHTML = frame(`<div class="body">
    <p class="big" style="font-size:21px">${esc(c.p)}</p>
    <button class="speak" id="say">🔊 Frage anhören</button>
    ${Recog ? `<button class="mic" id="mic" aria-label="Aufnehmen">🎤</button><p class="muted small" style="text-align:center" id="hint">Tippen und laut antworten</p>`
      : `<p class="muted small" style="margin-top:16px">Sag deine Antwort laut (ca. 20 Sekunden), dann vergleiche mit dem Muster.</p>`}
    <div id="said"></div>
    ${checklist(c)}
    <div id="fb"></div>
    <button class="btn primary actions" id="chk">Muster zeigen</button></div>`, 'Sprechen');
  document.getElementById('say').onclick = () => say(c.p);
  if (Recog) {
    let rec = null, on = false, final = '';
    const mic = document.getElementById('mic');
    mic.onclick = () => {
      if (on) { rec.stop(); return; }
      rec = new Recog(); rec.lang = 'de-DE'; rec.interimResults = true; rec.continuous = true;
      final = '';
      rec.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) final += r[0].transcript + ' '; else interim += r[0].transcript; }
        document.getElementById('said').innerHTML = `<div class="morph"><b>Du hast gesagt:</b> ${esc(final + interim)}</div>`;
      };
      rec.onend = () => { on = false; mic.classList.remove('on'); document.getElementById('hint').textContent = 'Tippen zum erneuten Aufnehmen'; };
      rec.onerror = e => { toast(e.error === 'not-allowed' ? 'Mikrofon nicht erlaubt' : 'Spracherkennung: ' + e.error); };
      rec.start(); on = true; mic.classList.add('on'); document.getElementById('hint').textContent = 'Ich höre zu … tippen zum Stoppen';
    };
  }
  document.getElementById('chk').onclick = function () {
    document.getElementById('fb').innerHTML = `<div class="morph"><b>Muster:</b> ${esc(c.m)} <button class="speak" id="saym">🔊</button></div>
      <p class="feedback">💡 ${esc(c.tip)}</p>
      <div class="rate" style="grid-template-columns:1fr 1fr">
        <button class="btn again" data-ok="0">Noch unsicher</button>
        <button class="btn easy" data-ok="1">Lief gut</button></div>`;
    document.getElementById('saym').onclick = () => say(c.m);
    this.remove();
    document.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => next(b.dataset.ok === '1'));
  };
}
/* --- Party-Hören: fast casual dialogue, transcript hidden until tapped --- */
function vParty(c) {
  const lines = c.lines;
  $app.innerHTML = frame(`<div class="body">
    <p>Hör dir das Gespräch an. Es ist schnell und umgangssprachlich, wie auf einer Feier.</p>
    <div class="row" style="margin:14px 0"><button class="btn" id="p1">🔊 Abspielen</button><button class="btn ghost" id="p2">🐢 Langsam</button></div>
    <details id="tr" style="background:var(--card2)"><summary class="small">Transkript zeigen</summary>
      ${lines.map(l => `<p class="small"><b>${esc(l.sp)}:</b> ${esc(l.t)}</p>`).join('')}</details>
    <p style="margin-top:14px;font-weight:600">${esc(c.q)}</p>
    <div id="opts">${shuffle(c.o.map((o, i) => i)).map(i => `<button class="opt" data-i="${i}">${esc(c.o[i])}</button>`).join('')}</div>
    <div id="fb"></div></div>`, 'Party-Hören');
  const play = rate => playLines(lines, rate);
  document.getElementById('p1').onclick = () => play(1.0);
  document.getElementById('p2').onclick = () => play(0.8);
  setTimeout(() => play(1.0), 300);
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const i = +b.dataset.i, ok = i === c.a;
    document.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (+x.dataset.i === c.a) x.classList.add('right'); });
    if (!ok) b.classList.add('wrong');
    document.getElementById('tr').open = true;
    document.getElementById('fb').innerHTML = `<div class="feedback">${ok ? '✅ Richtig!' : '❌ Leider falsch.'} Lies das Transkript und hör noch einmal.</div><button class="btn primary actions" id="nx">Weiter</button>`;
    document.getElementById('nx').onclick = () => next(ok);
  });
}
function playLines(lines, rate) {
  if (!('speechSynthesis' in window)) return toast('Sprachausgabe nicht verfügbar');
  speechSynthesis.cancel();
  pickVoice();
  const speakers = [...new Set(lines.map(l => l.sp))];
  // the two best-sounding voices with different names, so speakers differ
  const cast = [];
  deVoices.forEach(v => { const base = v.name.split(/[\s(]/)[0]; if (cast.length < 2 && !cast.some(c => c.name.split(/[\s(]/)[0] === base)) cast.push(v); });
  lines.forEach(l => {
    const u = new SpeechSynthesisUtterance(l.t); u.lang = 'de-DE'; u.rate = rate;
    const idx = speakers.indexOf(l.sp);
    if (cast.length > 1) u.voice = cast[idx % cast.length]; else { if (deVoice) u.voice = deVoice; u.pitch = idx % 2 ? 0.92 : 1.06; }
    speechSynthesis.speak(u);
  });
}

/* --- Arbeitsheft (digital workbook): one step per session --- */
const WB_STEPS = ['read', 'comp', 'cloze', 'gram', 'write'];
const WB_NAMES = { read: 'Lesen', comp: 'Textverständnis', cloze: 'Lückentext', gram: 'Grammatik', write: 'Schreiben' };
function wbPos() { const w = S.wb || { u: 0, s: 0 }; const n = (DATA.workbook || []).length; return n ? { u: Math.min(w.u, n - 1), s: w.u >= n ? 0 : w.s, finished: w.u >= n } : null; }
function wbItem() { const p = wbPos(); return p ? { t: 'wb', c: { u: p.u, s: p.s } } : skillItem('lesen'); }
function wbTile() {
  const p = wbPos(); if (!p) return '';
  const u = DATA.workbook[p.u];
  return `<button class="tile" data-start="wb" style="grid-column:1/-1;min-height:0"><b>📖 Arbeitsheft</b>
    <span>${p.finished ? 'Alle Einheiten fertig. Wiederholen?' : `Einheit ${p.u + 1}: ${esc(u.title)} · Schritt ${p.s + 1}/5 (${WB_NAMES[WB_STEPS[p.s]]})`}</span>
    <span>${esc(u.grammar)}</span></button>`;
}
function wbAdvance(c) {
  const w = S.wb || { u: 0, s: 0 };
  if (w.u === c.u && w.s === c.s) { w.s++; if (w.s >= WB_STEPS.length) { w.s = 0; w.u++; } }
  if (w.u >= DATA.workbook.length) { w.u = 0; w.s = 0; }
  S.wb = w; save();
}
function glossed(u) {
  let html = esc(u.passage);
  u.gloss.forEach((g, i) => { const w = esc(g.w); const at = html.indexOf(w); if (at >= 0) html = html.slice(0, at) + `<button class="gl" data-g="${i}">${w}</button>` + html.slice(at + w.length); });
  return html.split(/\n\n+/).map(p => `<p>${p}</p>`).join('');
}
function wbGlossHandlers(u) {
  document.querySelectorAll('.gl').forEach(b => b.onclick = () => toast(`${u.gloss[+b.dataset.g].w}: ${u.gloss[+b.dataset.g].m}`));
}
function vWb(c) {
  const u = DATA.workbook[c.u], step = WB_STEPS[c.s];
  const tag = `Arbeitsheft · Einheit ${c.u + 1} · ${c.s + 1}/5 ${WB_NAMES[step]}`;
  const done = ok => { wbAdvance(c); next(ok); };
  const passage = `<div class="passage">${glossed(u)}</div>`;
  const words = `<details style="background:var(--card2)"><summary class="small">Wörter (${u.gloss.length})</summary>${u.gloss.map(g => `<p class="small"><b>${esc(g.w)}</b> = ${esc(g.m)}</p>`).join('')}</details>`;
  if (step === 'read') {
    $app.innerHTML = frame(`<div class="body"><h2 style="margin-top:4px">${esc(u.title)}</h2>
      <p class="small muted">Lies den Text. Tippe auf <span class="gl" style="pointer-events:none">markierte Wörter</span> für die Bedeutung.</p>
      ${passage}${words}
      <button class="btn primary actions" id="ok">Gelesen ✓</button></div>`, tag);
    wbGlossHandlers(u);
    document.getElementById('ok').onclick = () => done(true);
  } else if (step === 'comp') {
    let qi = 0, score = 0;
    const show = () => {
      const q = u.comp[qi];
      mc({ tag: `${tag} ${qi + 1}/${u.comp.length}`,
        head: `<details style="background:var(--card2)"><summary class="small">Text nochmal lesen</summary>${passage}</details><p style="margin-top:14px;font-weight:600">${esc(q.q)}</p>`,
        options: q.o, answer: q.a,
        onDone: ok => { if (ok) score++; qi++; if (qi < u.comp.length) show(); else done(score === u.comp.length); } });
      wbGlossHandlers(u);
    };
    show();
  } else if (step === 'cloze') {
    const z = u.cloze;
    const text = esc(z.t).replace(/\{(\d+)\}/g, (_, n) => `<input class="gap" data-n="${n - 1}" autocomplete="off" autocapitalize="off" spellcheck="false">`);
    $app.innerHTML = frame(`<div class="body"><p class="small muted">Ergänze die Lücken${z.bank ? ' mit den Wörtern unten (antippen)' : ''}.</p>
      <p style="line-height:2.3">${text}</p>
      ${z.bank ? `<div id="bank">${shuffle(z.ans.map((a, i) => i)).map(i => `<button class="chip" data-i="${i}">${esc(z.ans[i])}</button>`).join('')}</div>` : ''}
      <div id="fb"></div><button class="btn primary actions" id="chk">Prüfen</button></div>`, tag);
    let focus = null;
    document.querySelectorAll('.gap').forEach(g => g.onfocus = () => focus = g);
    document.querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
      const target = (focus && !focus.value) ? focus : [...document.querySelectorAll('.gap')].find(g => !g.value);
      if (!target) return; target.value = ch.textContent; ch.disabled = true; focus = null;
    });
    document.getElementById('chk').onclick = function () {
      let right = 0;
      document.querySelectorAll('.gap').forEach(g => {
        const want = z.ans[+g.dataset.n], ok = norm(g.value) === norm(want);
        if (ok) right++; g.classList.add(ok ? 'right' : 'wrong'); g.disabled = true;
        if (!ok) g.insertAdjacentHTML('afterend', ` <span class="small" style="color:var(--good)">${esc(want)}</span>`);
      });
      document.getElementById('fb').innerHTML = `<p class="feedback">${right}/${z.ans.length} richtig.</p>`;
      this.textContent = 'Weiter'; this.onclick = () => done(right === z.ans.length);
    };
  } else if (step === 'gram') {
    const g = u.gram;
    $app.innerHTML = frame(`<div class="body"><p style="font-weight:600">${esc(u.grammar)}</p>
      <details open style="background:var(--card2)"><summary class="small">Regel</summary><p class="small">${esc(g.rule)}</p></details>
      <ol style="padding-left:20px;line-height:2.2">${g.items.map((it, i) => `<li>${esc(it.t).replace('___', `<input class="gap" data-i="${i}" autocomplete="off" autocapitalize="off" spellcheck="false">`)}</li>`).join('')}</ol>
      <div id="fb"></div><button class="btn primary actions" id="chk">Prüfen</button></div>`, tag);
    document.getElementById('chk').onclick = function () {
      let right = 0;
      document.querySelectorAll('.gap').forEach(el => {
        const it = g.items[+el.dataset.i], ok = [it.a, ...[].concat(it.alt || [])].some(a => norm(a) === norm(el.value));
        if (ok) right++; el.classList.add(ok ? 'right' : 'wrong'); el.disabled = true;
        if (!ok) el.insertAdjacentHTML('afterend', ` <span class="small" style="color:var(--good)">${esc(it.a)}</span>`);
      });
      document.getElementById('fb').innerHTML = `<p class="feedback">${right}/${g.items.length} richtig.</p>`;
      this.textContent = 'Weiter'; this.onclick = () => done(right === g.items.length);
    };
  } else {
    const w = u.write;
    $app.innerHTML = frame(`<div class="body"><p class="big" style="font-size:19px">${esc(w.p)}</p>
      <textarea id="ans" style="margin-top:12px" placeholder="Auf Deutsch schreiben …" autocapitalize="sentences" spellcheck="false"></textarea>
      ${checklist(w)}<div id="fb"></div>
      <button class="btn primary actions" id="chk">Musterlösung zeigen</button></div>`, tag);
    document.getElementById('chk').onclick = function () {
      document.getElementById('fb').innerHTML = `<div class="morph"><b>Muster:</b> ${esc(w.m)}</div>
        <div class="rate" style="grid-template-columns:1fr 1fr"><button class="btn again" data-ok="0">Noch unsicher</button><button class="btn easy" data-ok="1">Hab ich gut gemacht</button></div>`;
      this.remove();
      document.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => done(b.dataset.ok === '1'));
    };
  }
}
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?,]$/, '');

/* Words Braun already studied in Quizlet start as known reviews, spread over two weeks. */
function seedLearned() {
  let n = 0;
  DATA.vocab.forEach(c => { if (c.deck === 'Gelernt' && !S.srs['v:' + c.w]) { S.srs['v:' + c.w] = { b: 2, d: Date.now() + Math.random() * 14 * DAY }; n++; } });
  if (n) save();
}

/* --- Fortschritt --- */
function progressData() {
  const words = vocabPool();
  const sure = words.filter(x => (srsGet(x.k) || {}).b >= 3).length;
  const learning = words.filter(x => { const r = srsGet(x.k); return r && r.b < 3; }).length;
  const lid = lidPool(); const lidSure = lid.filter(x => (srsGet(x.k) || {}).b >= 2).length;
  const wb = S.wb || { u: 0, s: 0 }; const wbTotal = (DATA.workbook || []).length * WB_STEPS.length;
  return { words: words.length, sure, learning, lid: lid.length, lidSure, wbDone: Math.min(wbTotal, wb.u * WB_STEPS.length + wb.s), wbTotal };
}
const bar = (parts, total) => `<div class="pbar">${parts.map(([v, c]) => `<i style="width:${total ? (v / total) * 100 : 0}%;background:${c}"></i>`).join('')}</div>`;
function progressCard() {
  const p = progressData();
  return `<button class="tile" data-go="progress" style="width:100%;min-height:0;margin-top:14px">
    <b>📈 Dein Fortschritt</b>
    <span style="margin-top:8px">Wörter sicher: ${p.sure} von ${p.words}</span>${bar([[p.sure, 'var(--good)'], [p.learning, 'var(--accent)']], p.words)}
    <span>Arbeitsheft: ${p.wbDone} von ${p.wbTotal} Schritten</span>${bar([[p.wbDone, 'var(--warn)']], p.wbTotal)}
    <span>Einbürgerungstest: ${p.lidSure} von ${p.lid} Fragen sicher</span>${bar([[p.lidSure, '#5cc8ff']], p.lid)}
  </button>`;
}
function progressView() {
  const p = progressData();
  const days = Object.keys(S.days).sort();
  const total = Object.values(S.days).reduce((a, d) => a + d.n, 0);
  const decks = {};
  vocabPool().forEach(x => { const d = x.deck || 'Basis'; const o = decks[d] ||= { n: 0, sure: 0, seen: 0 }; o.n++; const r = srsGet(x.k); if (r) o.seen++; if (r && r.b >= 3) o.sure++; });
  const last7 = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * DAY).toLocaleDateString('sv'));
  const max = Math.max(1, ...last7.map(d => (S.days[d] || {}).n || 0));
  $app.innerHTML = `
    <div class="top"><button class="iconbtn" data-go="home" aria-label="Zurück">←</button><h1 style="flex:1">Fortschritt</h1></div>
    <div class="row" style="margin:14px 0;flex:none">
      <span class="pill fire" style="flex:none">🔥 ${streakNow()} Tag${streakNow() === 1 ? "" : "e"}</span>
      <span class="pill" style="flex:none">Rekord: ${S.streak.best || streakNow()}</span>
      <span class="pill" style="flex:none">Seit ${days[0] ? new Date(days[0]).toLocaleDateString('de-DE') : 'heute'}</span>
    </div>
    <h2>Diese Woche</h2>
    <div class="week">${last7.map(d => { const n = (S.days[d] || {}).n || 0; return `<div><i style="height:${(n / max) * 70 + 2}px"></i><span>${new Date(d).toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)}</span></div>`; }).join('')}</div>
    <p class="small muted">${days.length} Lerntage · ${total} Aufgaben insgesamt</p>
    <h2>Wörter</h2>
    <p class="small"><span style="color:var(--good)">■</span> sicher (eine Woche+ gemerkt) · <span style="color:var(--accent)">■</span> im Lernen · grau: noch neu</p>
    ${bar([[p.sure, 'var(--good)'], [p.learning, 'var(--accent)']], p.words)}
    ${Object.entries(decks).sort((a, b) => b[1].n - a[1].n).map(([d, o]) => `<div class="statline"><span>${esc(d)}</span><span>${o.sure} sicher · ${o.seen - o.sure} im Lernen · ${o.n - o.seen} neu</span></div>`).join('')}
    <h2>Arbeitsheft</h2>
    ${bar([[p.wbDone, 'var(--warn)']], p.wbTotal)}
    <p class="small muted">Einheit ${Math.min((S.wb || { u: 0 }).u + 1, (DATA.workbook || []).length)} von ${(DATA.workbook || []).length}</p>
    <h2>Einbürgerungstest</h2>
    ${bar([[p.lidSure, '#5cc8ff']], p.lid)}
    <p class="small muted">${p.lidSure} von ${p.lid} Fragen zweimal richtig. Im Test: 33 Fragen, 17 richtig zum Bestehen.</p>
    <p class="small muted" style="margin-top:18px">Wie Wiederholung funktioniert: Jede Karte, die du kannst, kommt nach 1, 3, 7, 14, 30, 60 Tagen wieder. Jede 10er-Runde mischt fällige Wiederholungen mit neuen Wörtern. Wenn nichts fällig ist, kommen Wörter, die du am längsten nicht gesehen hast.</p>`;
}

/* --- Mission des Tages --- */
function todaysMission() {
  const pool = (DATA.missions || []).filter(m => !m.wk || m.wk <= S.settings.week);
  if (!pool.length) return null;
  const cur = pool.filter(m => m.wk === S.settings.week);
  const list = cur.length ? cur : pool;
  const seed = [...today()].reduce((a, ch) => a * 31 + ch.charCodeAt(0) | 0, 7);
  return list[Math.abs(seed) % list.length];
}
function missionCard() {
  const m = todaysMission(); if (!m) return '';
  const done = (S.missions || {})[today()];
  return `<div class="tile" style="min-height:0;margin-bottom:12px;${done ? 'opacity:.6' : ''}">
    <span style="text-transform:uppercase;letter-spacing:.06em;font-size:12px">🎯 Mission des Tages</span>
    <b style="margin:6px 0;font-weight:500">${esc(m.t)}</b>
    <details><summary class="small muted">English</summary><p class="small">${esc(m.en)}</p></details>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="mission" style="width:auto" ${done ? 'checked' : ''}> Erledigt</label></div>`;
}
document.addEventListener('change', e => { if (e.target.id === 'mission') { (S.missions ||= {})[today()] = e.target.checked; save(); home(); } });

function stopSpeech() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

/* ---------- import ---------- */
function parseQuizlet(text, termSep, cardSep) {
  const ts = termSep === 'tab' ? '\t' : termSep === 'comma' ? ',' : termSep;
  const cs = cardSep === 'newline' ? /\r?\n/ : cardSep === 'semicolon' ? ';' : cardSep;
  return text.split(cs).map(l => l.trim()).filter(Boolean).map(line => {
    const at = line.indexOf(ts); if (at < 0) return null;
    const front = line.slice(0, at).trim(), back = line.slice(at + ts.length).trim();
    const fm = front.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    const slash = back.indexOf(' / ');
    return { w: fm ? fm[1] : front, s: fm ? fm[2] : '', m: slash >= 0 ? back.slice(0, slash) : back, x: slash >= 0 ? back.slice(slash + 3) : '' };
  }).filter(Boolean);
}
function importView() {
  $app.innerHTML = `
    <div class="top"><button class="iconbtn" data-go="home" aria-label="Zurück">←</button><h1 style="flex:1">Quizlet-Import</h1></div>
    <div class="stack" style="margin-top:14px">
      <p class="small muted">In Quizlet: Set öffnen → ⋯ → <b>Exportieren</b> → Text kopieren und hier einfügen. Vorne „Wort – Beispielsatz“, hinten „Bedeutung / Wortbildung“ wird automatisch erkannt.</p>
      <input id="name" placeholder="Name des Stapels, z. B. Verb Roots">
      <textarea id="txt" style="min-height:180px" placeholder="die Ermäßigung – Studenten bekommen eine Ermäßigung.&#9;discount, reduction / er- + mäßig (moderate) + -ung → making it moderate"></textarea>
      <div class="row">
        <label class="small">Zwischen Begriff &amp; Definition<select id="ts"><option value="tab">Tab (Standard)</option><option value="comma">Komma</option></select></label>
        <label class="small">Zwischen Karten<select id="cs"><option value="newline">Neue Zeile (Standard)</option><option value="semicolon">Semikolon</option></select></label>
      </div>
      <div id="pv"></div>
      <button class="btn primary" id="imp">Importieren</button>
    </div>
    <h2>Deine Stapel</h2>
    <div id="decks">${S.decks.length ? S.decks.map(d => `
      <div class="statline"><span>${esc(d.name)} <span class="muted">(${d.cards.length})</span></span>
      <span><label class="small"><input type="checkbox" data-on="${d.id}" ${d.on !== false ? 'checked' : ''} style="width:auto"> aktiv</label>
      <button class="speak small" data-del="${d.id}">🗑</button></span></div>`).join('') : '<p class="muted small">Noch keine eigenen Stapel.</p>'}</div>`;
  const preview = () => {
    const cards = parseQuizlet(document.getElementById('txt').value, document.getElementById('ts').value, document.getElementById('cs').value);
    document.getElementById('pv').innerHTML = cards.length ? `<p class="small muted">${cards.length} Karten erkannt. Erste: <b>${esc(cards[0].w)}</b>${cards[0].s ? ' · ' + esc(cards[0].s) : ''} → ${esc(cards[0].m)}${cards[0].x ? ' · <i>' + esc(cards[0].x) + '</i>' : ''}</p>` : '';
    return cards;
  };
  ['txt', 'ts', 'cs'].forEach(id => document.getElementById(id).oninput = preview);
  document.getElementById('imp').onclick = () => {
    const cards = preview(); if (!cards.length) return toast('Keine Karten erkannt');
    S.decks.push({ id: Date.now().toString(36), name: document.getElementById('name').value.trim() || 'Mein Stapel', cards, on: true });
    save(); toast(`${cards.length} Karten importiert`); importView();
  };
  document.querySelectorAll('[data-on]').forEach(b => b.onchange = () => { S.decks.find(d => d.id === b.dataset.on).on = b.checked; save(); });
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Stapel löschen?')) { S.decks = S.decks.filter(d => d.id !== b.dataset.del); save(); importView(); } });
}

/* ---------- settings ---------- */
function settingsView() {
  const days = Object.keys(S.days).length, total = Object.values(S.days).reduce((a, d) => a + d.n, 0);
  $app.innerHTML = `
    <div class="top"><button class="iconbtn" data-go="home" aria-label="Zurück">←</button><h1 style="flex:1">Einstellungen</h1></div>
    <div class="stack" style="margin-top:14px">
      <label>Bundesland (für die 10 Landesfragen im Einbürgerungstest)
        <select id="st">${Object.entries(STATES).map(([k, v]) => `<option value="${k}" ${k === S.settings.state ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Lernwoche (1–12, steuert die Themen im Mix)
        <select id="wk">${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option ${n === S.settings.week ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Aufgaben pro Mix
        <select id="mix">${[5, 6, 8, 10].map(n => `<option ${n === S.settings.mix ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Sprechtempo der Vorlesestimme
        <select id="rate">${[[0.8, 'Langsam'], [0.95, 'Normal'], [1.1, 'Schnell']].map(([v, l]) => `<option value="${v}" ${v === S.settings.rate ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn ghost" id="test">🔊 Stimme testen</button>
    </div>
    <h2>Statistik</h2>
    <div class="statline"><span>Lerntage</span><b>${days}</b></div>
    <div class="statline"><span>Aufgaben insgesamt</span><b>${total}</b></div>
    <div class="statline"><span>Karten in Wiederholung</span><b>${Object.keys(S.srs).length}</b></div>
    <h2>Sicherung</h2>
    <p class="small muted">Dein Fortschritt wird nur auf diesem Gerät gespeichert. Exportiere ab und zu eine Sicherung.</p>
    <div class="row"><button class="btn" id="exp">Exportieren</button><button class="btn" id="impb">Wiederherstellen</button></div>
    <input type="file" id="file" accept="application/json" hidden>
    <p class="small muted" style="margin-top:24px">Fragen „Leben in Deutschland“: offizieller Fragenkatalog des BAMF (ohne Bildfragen). Prüfungsformat angelehnt an Goethe-Zertifikat B1.</p>`;
  document.getElementById('st').onchange = e => { S.settings.state = e.target.value; save(); };
  document.getElementById('wk').onchange = e => { S.settings.week = +e.target.value; save(); };
  document.getElementById('mix').onchange = e => { S.settings.mix = +e.target.value; save(); };
  document.getElementById('rate').onchange = e => { S.settings.rate = +e.target.value; save(); };
  document.getElementById('test').onclick = () => say('Hallo! Schön, dass du heute Deutsch lernst.');
  document.getElementById('exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
    a.download = `deutsch-2min-${today()}.json`; a.click();
  };
  document.getElementById('impb').onclick = () => document.getElementById('file').click();
  document.getElementById('file').onchange = async e => {
    try { const s = JSON.parse(await e.target.files[0].text()); if (!s.srs) throw 0; localStorage.setItem('d2m', JSON.stringify(s)); S = load(); toast('Wiederhergestellt'); settingsView(); }
    catch { toast('Datei nicht lesbar'); }
  };
}

/* ---------- routing ---------- */
document.addEventListener('click', e => {
  const s = e.target.closest('[data-start]'); if (s) return startSession(s.dataset.start);
  const g = e.target.closest('[data-go]'); if (!g) return;
  clearInterval(window._tick);
  ({ home, settings: settingsView, import: importView, progress: progressView })[g.dataset.go]();
});

async function boot() {
  $app.innerHTML = '<p class="muted">Lädt …</p>';
  const get = f => fetch(`data/${f}.json`).then(r => r.json());
  const [vocab, decode, lid, tasks, missions, workbook] = await Promise.all(['vocab', 'decode', 'lid', 'tasks', 'missions', 'workbook'].map(get));
  DATA = { vocab, decode, lid, tasks, missions, workbook };
  seedLearned();
  home();
  if (new URLSearchParams(location.search).get('start') === 'mix') startSession('mix');
}
boot();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
