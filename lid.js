/* Leben in Deutschland: short lessons with visuals, linked to the question bank. */
'use strict';

/* Link each question to the lesson whose keywords match it best (longer keys weigh more). */
function linkLessons() {
  const L = DATA.lessons || [];
  DATA.lid.forEach(q => {
    const text = ' ' + (q.q + ' ' + q.o.join(' ')).toLowerCase() + ' ';
    let best = null, bestScore = 0;
    L.forEach(l => {
      let sc = 0;
      l.keys.forEach(k => { if (new RegExp('(^|[^a-zäöüß0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(text)) sc += k.length >= 6 ? 2 : 1; });
      if (sc > bestScore) { bestScore = sc; best = l.id; }
    });
    q.lesson = bestScore >= 2 ? best : null;
  });
}
const lessonById = id => (DATA.lessons || []).find(l => l.id === id);

function visualHtml(v) {
  if (!v) return '';
  if (v.type === 'timeline') return `<div class="tl">${v.items.map(i => `<div><b>${esc(i.y)}</b><span>${esc(i.t)}</span></div>`).join('')}</div>`;
  if (v.type === 'flow') return `<div class="flow">${v.items.map(x => `<span class="pill" style="color:var(--text)">${esc(x)}</span>`).join('<i>→</i>')}</div>`;
  return `<div class="boxes">${v.items.map(i => `<div><b>${esc(i.h)}</b><span>${esc(i.t)}</span></div>`).join('')}</div>`;
}
function lessonPointsHtml(l) {
  return `<ul class="pts">${l.points.map(p => `<li>${esc(p.de)}<br><span class="muted small">${esc(p.en)}</span></li>`).join('')}</ul>`;
}

function lidHome() {
  stopSpeech();
  const L = DATA.lessons || [];
  const pool = lidPool();
  const stat = id => { const qs = pool.filter(q => q.lesson === id); return { n: qs.length, sure: qs.filter(q => (srsGet(q.k) || {}).b >= 2).length }; };
  const read = S.lessonsRead || {};
  const all = { n: pool.length, sure: pool.filter(q => (srsGet(q.k) || {}).b >= 2).length };
  $app.innerHTML = `
    <div class="top"><button class="iconbtn" data-go="home" aria-label="Zurück">←</button><h1 style="flex:1">Leben in Deutschland</h1></div>
    <p class="small muted" style="margin:10px 0">Erst die kurze Lektion lesen, dann die Fragen dazu üben. Im Test: 33 Fragen (30 allgemein + 3 zu ${STATES[S.settings.state] || 'deinem Bundesland'}), 17 richtig zum Bestehen.</p>
    ${bar([[all.sure, '#5cc8ff']], all.n)}
    <p class="small muted">${all.sure} von ${all.n} Fragen sicher</p>
    <button class="btn primary" data-start="lid" style="margin:10px 0 16px">▶ Gemischte Fragen (5)</button>
    <div class="stack">${L.map((l, i) => { const s = stat(l.id); return `<button class="tile" data-lesson="${l.id}" style="width:100%;min-height:0">
      <b>${read[l.id] ? '✓ ' : ''}${i + 1}. ${esc(l.title)}</b><span>${esc(l.en)}</span>${bar([[s.sure, '#5cc8ff']], s.n)}<span>${s.sure}/${s.n} Fragen sicher</span></button>`; }).join('')}</div>`;
  document.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => lessonView(b.dataset.lesson));
}

function lessonView(id) {
  const l = lessonById(id);
  (S.lessonsRead ||= {})[id] = true; save();
  const n = lidPool().filter(q => q.lesson === id).length;
  $app.innerHTML = `
    <div class="top"><button class="iconbtn" id="lback" aria-label="Zurück">←</button><h1 style="flex:1;font-size:21px">${esc(l.title)}</h1></div>
    <p class="muted small" style="margin:8px 0 12px">${esc(l.en)}</p>
    ${visualHtml(l.visual)}
    ${lessonPointsHtml(l)}
    <button class="btn primary" id="lq" style="margin-top:12px">Fragen zu dieser Lektion üben (${Math.min(5, n)} von ${n})</button>`;
  document.getElementById('lback').onclick = lidHome;
  document.getElementById('lq').onclick = () => {
    const pool = lidPool().filter(q => q.lesson === id);
    const q = balanced(pool, 5, x => x.k).map(c => ({ t: 'lid', c }));
    if (!q.length) return toast('Keine Fragen gefunden');
    session = { kind: 'lid', q, pos: 0, ok: 0, start: Date.now(), requeued: new Set() };
    renderItem();
  };
}
