/* Leben in Deutschland: short lessons with visuals, each with its own question set.
   Every answer is saved (SRS in localStorage), so a lesson continues where you stopped. */
'use strict';

const LID_ROUND = 5;
const MORE_ID = 'mehr';

/* Link each question to one lesson: the lesson whose keywords match best (longer keys weigh more).
   State questions go to the Bundesland lesson; anything left goes to "Weitere Fragen",
   so every question belongs to exactly one section. */
function linkLessons() {
  const L = DATA.lessons || [];
  DATA.lid.forEach(q => {
    if (q.s) { q.lesson = 'laender_bayern'; return; }
    const text = ' ' + (q.q + ' ' + q.o.join(' ')).toLowerCase() + ' ';
    let best = null, bestScore = 0;
    L.forEach(l => {
      let sc = 0;
      (l.keys || []).forEach(k => { if (new RegExp('(^|[^a-zäöüß0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(text)) sc += k.length >= 6 ? 2 : 1; });
      if (sc > bestScore) { bestScore = sc; best = l.id; }
    });
    q.lesson = best || MORE_ID;
  });
  if (DATA.lid.some(q => q.lesson === MORE_ID) && !L.some(l => l.id === MORE_ID))
    L.push({ id: MORE_ID, title: 'Weitere Fragen', en: 'Questions that don’t fit one lesson', points: [], keys: [] });
}
const lessonById = id => (DATA.lessons || []).find(l => l.id === id);
const lessonHasText = l => l && l.points && l.points.length;

/* The questions of one lesson, in catalog order, numbered 1..n. */
function lessonQs(id) {
  const qs = lidPool().filter(q => q.lesson === id);
  return qs.map((q, i) => ({ ...q, n: i + 1, of: qs.length }));
}
function lessonStat(id) {
  const qs = lessonQs(id), now = Date.now();
  const done = qs.filter(q => srsGet(q.k)).length;
  return {
    n: qs.length, done, open: qs.length - done,
    sure: qs.filter(q => (srsGet(q.k) || {}).b >= 2).length,
    due: qs.filter(q => isDue(q.k, now)).length,
    next: (qs.find(q => !srsGet(q.k)) || {}).n
  };
}

/* Next round for a lesson: up to 2 due reviews (missed or scheduled), then the next
   unanswered questions in order. When every question is answered, review the ones
   seen longest ago. */
function lessonRound(id, n = LID_ROUND) {
  const qs = lessonQs(id), now = Date.now();
  const due = qs.filter(q => isDue(q.k, now)).sort((a, b) => S.srs[a.k].d - S.srs[b.k].d);
  const fresh = qs.filter(q => !srsGet(q.k));
  const out = due.slice(0, Math.min(2, n));
  out.push(...fresh.slice(0, n - out.length));
  out.push(...due.slice(out.filter(q => due.includes(q)).length).slice(0, n - out.length));
  if (!out.length) return balanced(qs, n, x => x.k);
  return out;
}

/* Where to continue: the last lesson you practised if it still has new questions,
   else the next lesson (in order) that does. */
function resumeLesson() {
  const L = DATA.lessons || [];
  if (!L.length) return null;
  const start = Math.max(0, L.findIndex(l => l.id === S.lidLast));
  for (let i = 0; i < L.length; i++) {
    const l = L[(start + i) % L.length];
    if (lessonStat(l.id).open) return l;
  }
  return L.find(l => lessonStat(l.id).due) || null;
}

/* Questions for the daily mix and other quick rounds: due reviews first, then the
   next new questions from where you are in the lessons. */
function lidPick(n) {
  const now = Date.now();
  const due = lidPool().filter(q => isDue(q.k, now)).sort((a, b) => S.srs[a.k].d - S.srs[b.k].d);
  const out = due.slice(0, n);
  const r = resumeLesson();
  if (out.length < n && r) out.push(...lessonQs(r.id).filter(q => !srsGet(q.k)).slice(0, n - out.length));
  if (out.length < n) out.push(...choose(lidPool(), n, x => x.k).filter(q => !out.some(o => o.k === q.k)).slice(0, n - out.length));
  return out;
}

function startLesson(id) {
  const q = lessonRound(id).map(c => ({ t: 'lid', c }));
  if (!q.length) return toast('Keine Fragen gefunden');
  S.lidLast = id; save();
  startQueue('lid', q, { lesson: id });
}

function visualHtml(v) {
  if (!v) return '';
  if (v.type === 'timeline') return `<div class="tl">${v.items.map(i => `<div><b>${esc(i.y)}</b><span>${esc(i.t)}</span></div>`).join('')}</div>`;
  if (v.type === 'flow') return `<div class="flow">${v.items.map(x => `<span class="pill" style="color:var(--text)">${esc(x)}</span>`).join('<i>→</i>')}</div>`;
  return `<div class="boxes">${v.items.map(i => `<div><b>${esc(i.h)}</b><span>${esc(i.t)}</span></div>`).join('')}</div>`;
}
function lessonPointsHtml(l) {
  return `<ul class="pts">${l.points.map(p => `<li>${esc(p.de)}<br><span class="muted small">${esc(p.en)}</span></li>`).join('')}</ul>`;
}
function lessonBtnLabel(s) {
  if (!s.done) return `▶ Starten: Fragen 1–${Math.min(LID_ROUND, s.n)} von ${s.n}`;
  if (s.open) return `▶ Weiter ab Frage ${s.next} von ${s.n}`;
  return `↻ Wiederholen (${s.due ? s.due + ' fällig' : 'alle beantwortet'})`;
}
const lessonNum = id => (DATA.lessons || []).findIndex(l => l.id === id) + 1;

function lidHome() {
  stopSpeech();
  session = null;
  const L = DATA.lessons || [];
  const pool = lidPool();
  const read = S.lessonsRead || {};
  const all = { n: pool.length, done: pool.filter(q => srsGet(q.k)).length, sure: pool.filter(q => (srsGet(q.k) || {}).b >= 2).length };
  const r = resumeLesson(), rs = r && lessonStat(r.id);
  $app.innerHTML = `
    <div class="top"><button class="iconbtn" data-go="home" aria-label="Zurück">←</button><h1 style="flex:1">Leben in Deutschland</h1></div>
    <p class="small muted" style="margin:10px 0">Erst die kurze Lektion lesen, dann die Fragen dazu üben, immer ${LID_ROUND} auf einmal. Dein Fortschritt wird gespeichert. Im Test: 33 Fragen (30 allgemein + 3 zu ${STATES[S.settings.state] || 'deinem Bundesland'}), 17 richtig zum Bestehen.</p>
    ${bar([[all.sure, '#5cc8ff'], [all.done - all.sure, '#2d6a8a']], all.n)}
    <p class="small muted">${all.done} von ${all.n} Fragen beantwortet · ${all.sure} sicher</p>
    ${r ? `<button class="btn primary" id="lresume" style="margin:10px 0 6px">▶ Weiter: ${lessonNum(r.id)}. ${esc(r.title)} · ${rs.done ? `ab Frage ${rs.next || 1}` : 'Start'} von ${rs.n}</button>` : ''}
    <button class="btn ghost" data-start="lid" style="margin:4px 0 16px">Gemischte Fragen (${LID_ROUND})</button>
    <div class="stack">${L.map((l, i) => { const s = lessonStat(l.id); return `<button class="tile" data-lesson="${l.id}" style="width:100%;min-height:0">
      <b>${read[l.id] || (!lessonHasText(l) && s.done) ? '✓ ' : ''}${i + 1}. ${esc(l.title)}</b><span>${esc(l.en)}</span>${bar([[s.sure, '#5cc8ff'], [s.done - s.sure, '#2d6a8a']], s.n)}<span>${s.done}/${s.n} beantwortet · ${s.sure} sicher${s.due ? ` · ${s.due} fällig` : ''}</span></button>`; }).join('')}</div>`;
  if (r) document.getElementById('lresume').onclick = () => lessonHasText(r) && !read[r.id] ? lessonView(r.id) : startLesson(r.id);
  document.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => lessonView(b.dataset.lesson));
}

function lessonView(id) {
  const l = lessonById(id);
  if (lessonHasText(l)) { (S.lessonsRead ||= {})[id] = true; save(); }
  const s = lessonStat(id);
  $app.innerHTML = `
    <div class="top"><button class="iconbtn" id="lback" aria-label="Zurück">←</button><h1 style="flex:1;font-size:21px">${esc(l.title)}</h1></div>
    <p class="muted small" style="margin:8px 0 12px">${esc(l.en)}</p>
    ${visualHtml(l.visual)}
    ${lessonHasText(l) ? lessonPointsHtml(l) : '<p class="small muted">Gemischte Fragen, die zu keiner Lektion passen.</p>'}
    ${bar([[s.sure, '#5cc8ff'], [s.done - s.sure, '#2d6a8a']], s.n)}
    <p class="small muted">${s.done} von ${s.n} Fragen beantwortet · ${s.sure} sicher${s.due ? ` · ${s.due} zum Wiederholen` : ''}</p>
    <button class="btn primary" id="lq" style="margin-top:12px">${lessonBtnLabel(s)}</button>`;
  document.getElementById('lback').onclick = lidHome;
  document.getElementById('lq').onclick = () => startLesson(id);
}

/* End-of-round screen for a lesson round. */
function lessonFinishHtml(id) {
  const l = lessonById(id), s = lessonStat(id);
  return `<p class="muted" style="margin-top:6px">${esc(l.title)}: ${s.done} von ${s.n} beantwortet · ${s.sure} sicher</p>
    ${bar([[s.sure, '#5cc8ff'], [s.done - s.sure, '#2d6a8a']], s.n)}`;
}
function lessonFinishActions(id) {
  const s = lessonStat(id);
  const r = s.open || s.due ? null : resumeLesson();
  return `${s.open || s.due ? `<button class="btn primary" id="lnext">${s.open ? `Nächste ${Math.min(LID_ROUND, s.open)} Fragen (ab ${s.next})` : 'Fehler wiederholen'}</button>`
    : r ? `<button class="btn primary" id="lnext" data-l="${r.id}">Lektion fertig! Weiter: ${esc(r.title)}</button>` : ''}
    <button class="btn ghost" id="lover">Zur Übersicht</button>`;
}
function wireLessonFinish(id) {
  const nb = document.getElementById('lnext');
  if (nb) nb.onclick = () => nb.dataset.l ? lessonView(nb.dataset.l) : startLesson(id);
  document.getElementById('lover').onclick = lidHome;
}
