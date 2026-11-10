/* Grammatik-Training: pick one topic and drill generated items for as long as you like. */
'use strict';

const PRON = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'];
const PRON_HINT = { sie: 'sie (Plural)' };
const GENDER = { m: 'maskulin (der)', f: 'feminin (die)', n: 'neutral (das)' };
const ART = {
  def: { nom: { m: 'der', f: 'die', n: 'das' }, akk: { m: 'den', f: 'die', n: 'das' }, dat: { m: 'dem', f: 'der', n: 'dem' } },
  ind: { nom: { m: 'ein', f: 'eine', n: 'ein' }, akk: { m: 'einen', f: 'eine', n: 'ein' }, dat: { m: 'einem', f: 'einer', n: 'einem' } },
  pos: { nom: { m: 'mein', f: 'meine', n: 'mein' }, akk: { m: 'meinen', f: 'meine', n: 'mein' }, dat: { m: 'meinem', f: 'meiner', n: 'meinem' } }
};
const ADJ_END = {
  def: { nom: { m: 'e', f: 'e', n: 'e' }, akk: { m: 'en', f: 'e', n: 'e' }, dat: { m: 'en', f: 'en', n: 'en' } },
  ind: { nom: { m: 'er', f: 'e', n: 'es' }, akk: { m: 'en', f: 'e', n: 'es' }, dat: { m: 'en', f: 'en', n: 'en' } }
};
ADJ_END.pos = ADJ_END.ind;
const CASE_NAME = { nom: 'Nominativ', akk: 'Akkusativ', dat: 'Dativ' };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const rnd = a => a[Math.floor(Math.random() * a.length)];
const G = () => DATA.grammar;
const nounsBy = f => G().nouns.filter(f);
const art = (t, c, n) => ART[t][c][n.g];

/* ---------- generators: each returns {html, answer(s), alt[], why, chips?} ---------- */
const TOPICS = [
  {
    id: 'artikel', title: 'Artikel: Akkusativ & Dativ', sub: 'den, dem, der … nach Verben',
    rule: `<p>Das direkte Objekt (wen/was?) steht im <b>Akkusativ</b>. Nach Verben wie <i>helfen, danken, gefallen, gehören</i> und beim Empfänger (wem?) steht der <b>Dativ</b>.</p>${artTable()}`,
    gen() {
      const akk = [['Ich sehe ___ {N}.', 0], ['Kannst du ___ {N} holen?', 0], ['Wir brauchen ___ {N}.', 0], ['Ich finde ___ {N} sehr schön.', 0]];
      const dat = [['Ich helfe ___ {N}.', 1], ['Ich gebe ___ {N} das Buch.', 1], ['Wir danken ___ {N}.', 1], ['Das Auto gehört ___ {N}.', 1]];
      const isDat = Math.random() < 0.5;
      const [t] = rnd(isDat ? dat : akk);
      const n = rnd(nounsBy(x => isDat ? x.p : !x.p || Math.random() < 0.3));
      const c = isDat ? 'dat' : 'akk', ty = Math.random() < 0.6 ? 'def' : 'ind';
      const a = art(ty, c, n);
      return { html: t.replace('{N}', `<b>${n.n}</b>`) + ` <span class="muted small">(${art('def', 'nom', n)} ${n.n}${ty === 'ind' ? ', unbestimmt: ein/eine' : ''})</span>`, a, why: `${isDat ? 'Wem? → Dativ' : 'Wen/was? → Akkusativ'} · ${GENDER[n.g]} → <b>${a}</b>` };
    }
  },
  {
    id: 'praep', title: 'Präpositionen + Artikel', sub: 'mit, für, ohne, aus, seit …',
    rule: `<div class="gtable"><div><b>Akkusativ</b><br>durch · für · gegen · ohne · um</div><div><b>Dativ</b><br>aus · bei · mit · nach · seit · von · zu</div></div>${artTable()}`,
    gen() {
      const akk = ['für', 'ohne', 'gegen', 'durch'], dat = ['mit', 'aus', 'nach', 'seit'];
      const isDat = Math.random() < 0.5;
      const p = isDat ? rnd(['mit', 'mit', 'aus']) : rnd(akk);
      const portable = ['Schlüssel', 'Pass', 'Handy', 'Jacke', 'Tasche', 'Geschenk', 'Buch', 'Mantel', 'Formular', 'Kuchen'];
      const n = rnd(nounsBy(x => ['mit', 'für', 'ohne', 'gegen'].includes(p) ? (x.p || (p !== 'gegen' && portable.includes(x.n))) : p === 'aus' ? ['Haus', 'Zimmer', 'Küche', 'Stadt', 'Wohnung', 'Restaurant', 'Zug', 'Auto', 'Garten', 'Büro'].includes(x.n) : p === 'durch' ? ['Stadt', 'Garten', 'Haus', 'Wohnung', 'Zimmer', 'Küche'].includes(x.n) : true));
      const c = isDat ? 'dat' : 'akk', ty = rnd(['def', 'def', 'ind', 'pos']);
      const a = art(ty, c, n);
      const frame = { mit: 'Ich komme mit ___ {N}.', aus: 'Er kommt gerade aus ___ {N}.', für: 'Das ist für ___ {N}.', ohne: 'Ich gehe nicht ohne ___ {N}.', gegen: 'Er ist gegen ___ {N}.', durch: 'Wir gehen durch ___ {N}.' }[p];
      const hint = ty === 'def' ? 'der/die/das' : ty === 'ind' ? 'ein/eine' : 'mein/meine';
      return { html: frame.replace('{N}', `<b>${n.n}</b>`) + ` <span class="muted small">(${hint} · ${art('def', 'nom', n)} ${n.n})</span>`, a, why: `<b>${p}</b> → ${CASE_NAME[c]} · ${GENDER[n.g]} → <b>${a}</b>` };
    }
  },
  {
    id: 'wechsel', title: 'Wechselpräpositionen', sub: 'Wo? → Dativ · Wohin? → Akkusativ',
    rule: `<p><b>an, auf, hinter, in, neben, über, unter, vor, zwischen</b></p><div class="gtable"><div><b>Wo?</b> (Position)<br>liegen, stehen, hängen → <b>Dativ</b><br><i>Das Buch liegt auf dem Tisch.</i></div><div><b>Wohin?</b> (Bewegung)<br>legen, stellen, hängen → <b>Akkusativ</b><br><i>Ich lege das Buch auf den Tisch.</i></div></div>`,
    gen() {
      const p = rnd(['auf', 'unter', 'neben', 'hinter', 'vor']);
      const n = rnd(nounsBy(x => x.f));
      const wo = Math.random() < 0.5;
      const c = wo ? 'dat' : 'akk', a = art('def', c, n);
      const t = wo ? rnd(['Die Tasche liegt {P} ___ {N}.', 'Der Koffer steht {P} ___ {N}.', 'Die Katze schläft {P} ___ {N}.'])
        : rnd(['Ich lege die Tasche {P} ___ {N}.', 'Er stellt den Koffer {P} ___ {N}.', 'Die Katze springt {P} ___ {N}.']);
      return { html: t.replace('{P}', p).replace('{N}', `<b>${n.n}</b>`) + ` <span class="muted small">(${art('def', 'nom', n)} ${n.n})</span>`, a, why: `${wo ? 'Wo? → Dativ' : 'Wohin? → Akkusativ'} · ${GENDER[n.g]} → <b>${a}</b>` };
    }
  },
  {
    id: 'adjektiv', title: 'Adjektivendungen', sub: 'der neue Tisch, einen neuen Tisch …',
    rule: adjTable(),
    gen() {
      const c = rnd(['nom', 'akk', 'akk', 'dat', 'dat']), ty = rnd(['def', 'ind', 'pos']);
      const n = rnd(G().nouns), adj = rnd(G().adjectives);
      const a = art(ty, c, n), end = ADJ_END[ty][c][n.g];
      const t = { nom: rnd(['{A} ___ {N} ist hier.', 'Wo ist {a} ___ {N}?']), akk: rnd(['Ich kaufe {a} ___ {N}.', 'Hast du {a} ___ {N} gesehen?', 'Wir suchen {a} ___ {N}.']), dat: rnd(['Ich bin mit {a} ___ {N} zufrieden.', 'Was machst du mit {a} ___ {N}?']) }[c];
      const html = t.replace('{A}', cap(a)).replace('{a}', a).replace('___', `${adj}<input class="gap" style="width:4em" autocomplete="off" autocapitalize="off" spellcheck="false">`).replace('{N}', `<b>${n.n}</b>`) + ` <span class="muted small">(${art('def', 'nom', n)} ${n.n})</span>`;
      return { html, inline: true, a: end, why: `${CASE_NAME[c]} · ${GENDER[n.g]} · nach <i>${a}</i> → <b>${adj}${end}</b>` };
    }
  },
  {
    id: 'praesens', title: 'Konjugation: Präsens', sub: 'du fährst, er liest, ihr wisst …',
    rule: `<div class="gtable"><div>ich <b>-e</b><br>du <b>-st</b><br>er/sie/es <b>-t</b></div><div>wir <b>-en</b><br>ihr <b>-t</b><br>sie/Sie <b>-en</b></div></div><p class="small">Achtung: Viele starke Verben ändern den Vokal bei <b>du</b> und <b>er</b>: fahren → du fährst, lesen → er liest, nehmen → du nimmst. Modalverben: ich/er <b>kann, muss, will</b> (ohne Endung).</p>`,
    gen() {
      const v = rnd(G().verbs.filter(x => x.p)), i = Math.floor(Math.random() * 6);
      const hard = Math.random() < 0.6 ? [1, 2][Math.floor(Math.random() * 2)] : i;
      return { html: `${cap(PRON_HINT[PRON[hard]] || PRON[hard])} ___ <span class="muted small">(${v.i})</span>`, a: v.p[hard], why: `${PRON[hard]} + ${v.i} → <b>${v.p[hard]}</b>` };
    }
  },
  {
    id: 'perfekt', title: 'Perfekt', sub: 'habe gemacht, bin gefahren …',
    rule: `<p><b>haben/sein</b> (konjugiert, Position 2) + <b>Partizip II</b> (am Ende).</p><p><b>sein</b> bei Bewegung (fahren, gehen, fliegen) und Veränderung (aufstehen, werden), plus <i>sein, bleiben</i>. Fast alle anderen: <b>haben</b>.</p><p class="small">Trennbare Verben: auf<b>ge</b>standen, ein<b>ge</b>kauft. Verben mit be-, ver-, er- und -ieren: ohne ge- (besucht, verstanden).</p>`,
    gen() {
      const v = rnd(G().verbs.filter(x => x.pp)), i = Math.floor(Math.random() * 6);
      const aux = (v.a === 's' ? ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'] : ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'])[i];
      const ans = `${aux} ${v.pp}`;
      return { html: `${cap(PRON_HINT[PRON[i]] || PRON[i])} ___ gestern ___. <span class="muted small">(${v.i})</span>`, a: ans, why: `${v.i}: ${v.a === 's' ? '<b>sein</b>' : '<b>haben</b>'} + ${v.pp} → <b>${PRON[i]} ${aux} … ${v.pp}</b>` };
    }
  },
  {
    id: 'konj2', title: 'Konjunktiv II', sub: 'hätte, wäre, würde, könnte …',
    rule: `<p>Für Wünsche, höfliche Bitten und Ratschläge.</p><div class="gtable"><div>haben → <b>hätte</b><br>sein → <b>wäre</b><br>werden → <b>würde</b></div><div>können → <b>könnte</b><br>müssen → <b>müsste</b><br>sollen → <b>sollte</b></div></div><p class="small">Endungen: ich hätte, du hättest, er hätte, wir hätten, ihr hättet, sie hätten.</p>`,
    gen() {
      const k = rnd(G().konj2), i = Math.floor(Math.random() * 6);
      let t = k.t.replace('{P}', cap(PRON[i])).replace('{p}', PRON[i]);
      if (t.startsWith('___')) t = t.replace('___ ', '___ ');
      return { html: `${t} <span class="muted small">(${k.i}${PRON[i] === 'sie' ? ', sie = Plural' : ''})</span>`, a: k.p[i], why: `${k.i} → Konjunktiv II: <b>${k.p[i]}</b>`, capFirst: t.startsWith('___') };
    }
  },
  {
    id: 'wortstellung', title: 'Wortstellung: Verb am Ende', sub: 'weil, dass, ob, wenn …',
    rule: `<p>Nach <b>weil, dass, ob, wenn, obwohl, bis</b> und Fragewörtern (wo, wann, warum) im Nebensatz steht das konjugierte Verb <b>am Ende</b>.</p><p><i>Ich bleibe zu Hause, weil ich krank <b>bin</b>.</i><br><i>…, weil ich gestern lange gearbeitet <b>habe</b>.</i></p>`,
    gen() {
      const o = rnd(G().order);
      return { order: o, a: o.s.join(' '), why: `${o.c} → Verb am Ende: <b>${o.c} ${o.s.join(' ')}</b>` };
    }
  }
];

function artTable() {
  return `<table class="gt"><tr><th></th><th>m</th><th>f</th><th>n</th></tr>
    <tr><td>Nom.</td><td>der / ein</td><td>die / eine</td><td>das / ein</td></tr>
    <tr><td>Akk.</td><td><b>den / einen</b></td><td>die / eine</td><td>das / ein</td></tr>
    <tr><td>Dat.</td><td><b>dem / einem</b></td><td><b>der / einer</b></td><td><b>dem / einem</b></td></tr></table>`;
}
function adjTable() {
  return `<p class="small">Nach <b>der/die/das</b>:</p><table class="gt"><tr><th></th><th>m</th><th>f</th><th>n</th></tr>
    <tr><td>Nom.</td><td>der neu<b>e</b></td><td>die neu<b>e</b></td><td>das neu<b>e</b></td></tr>
    <tr><td>Akk.</td><td>den neu<b>en</b></td><td>die neu<b>e</b></td><td>das neu<b>e</b></td></tr>
    <tr><td>Dat.</td><td>dem neu<b>en</b></td><td>der neu<b>en</b></td><td>dem neu<b>en</b></td></tr></table>
    <p class="small" style="margin-top:8px">Nach <b>ein/eine/mein/kein</b>:</p><table class="gt"><tr><th></th><th>m</th><th>f</th><th>n</th></tr>
    <tr><td>Nom.</td><td>ein neu<b>er</b></td><td>eine neu<b>e</b></td><td>ein neu<b>es</b></td></tr>
    <tr><td>Akk.</td><td>einen neu<b>en</b></td><td>eine neu<b>e</b></td><td>ein neu<b>es</b></td></tr>
    <tr><td>Dat.</td><td>einem neu<b>en</b></td><td>einer neu<b>en</b></td><td>einem neu<b>en</b></td></tr></table>
    <p class="small">Merksatz: Wenn der Artikel das Geschlecht nicht zeigt (ein, mein), zeigt es das Adjektiv: ein neu<b>er</b> Tisch, ein neu<b>es</b> Auto.</p>`;
}

/* ---------- views ---------- */
function grammarHome() {
  stopSpeech();
  const st = S.gram || {};
  $app.innerHTML = `
    <div class="top"><button class="iconbtn" data-go="home" aria-label="Zurück">←</button><h1 style="flex:1">Grammatik-Training</h1></div>
    <p class="small muted" style="margin:10px 0 14px">Wähle ein Thema und übe so lange du willst. Jede Aufgabe wird neu erzeugt.</p>
    <div class="stack">${TOPICS.map(t => { const s = st[t.id]; return `<button class="tile" data-drill="${t.id}" style="width:100%;min-height:0">
      <b>${t.title}</b><span>${t.sub}${s ? ` · ${s.ok}/${s.n} richtig` : ''}</span></button>`; }).join('')}</div>`;
  document.querySelectorAll('[data-drill]').forEach(b => b.onclick = () => drill(b.dataset.drill));
}

let drillState = null;
function drill(id) {
  const t = TOPICS.find(x => x.id === id);
  drillState = { t, n: 0, ok: 0, start: Date.now() };
  drillNext(true);
}
function drillNext(showRule) {
  const { t } = drillState;
  const it = t.gen();
  drillState.it = it;
  let body;
  if (it.order) {
    body = `<p class="sentence" style="font-size:19px">${esc(it.order.m)} <b>${esc(it.order.c)}</b> <span id="built" class="built"></span></p>
      <p class="small muted">${esc(it.order.en)}. Tippe die Wörter in der richtigen Reihenfolge.</p>
      <div id="bank">${shuffle(it.order.s.map((w, i) => i)).map(i => `<button class="chip" data-w="${esc(it.order.s[i])}">${esc(it.order.s[i])}</button>`).join('')}</div>
      <button class="btn ghost small" id="undo" style="margin-top:10px;padding:8px">↺ Zurücksetzen</button>`;
  } else if (it.inline) {
    body = `<p class="sentence" style="font-size:20px;line-height:2.2">${it.html}</p>`;
  } else {
    body = `<p class="sentence" style="font-size:20px;line-height:2.2">${it.html.replace(/___/g, '<input class="gap" autocomplete="off" autocapitalize="off" spellcheck="false">')}</p>`;
  }
  $app.innerHTML = `
    <div class="top">
      <button class="iconbtn" id="gback" aria-label="Fertig">✕</button>
      <span class="muted small">${esc(t.title)}</span>
      <span class="pill">${drillState.ok}/${drillState.n}</span>
    </div>
    <details class="rule" ${showRule ? 'open' : ''}><summary>Regel</summary>${t.rule}</details>
    <div class="card" style="min-height:0;margin-top:12px"><div class="body" style="justify-content:flex-start">${body}
      <div id="fb"></div>
      <button class="btn primary actions" id="chk">Prüfen</button></div></div>`;
  document.getElementById('gback').onclick = drillDone;
  const gaps = [...document.querySelectorAll('.gap')]; if (gaps[0]) gaps[0].focus({ preventScroll: true });
  gaps.forEach((g, i) => g.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (gaps[i + 1] && !gaps[i + 1].value) gaps[i + 1].focus(); else document.getElementById('chk').click(); } });
  if (it.order) {
    const built = [];
    const draw = () => { document.getElementById('built').textContent = built.join(' '); };
    document.querySelectorAll('.chip').forEach(ch => ch.onclick = () => { built.push(ch.dataset.w); ch.disabled = true; draw(); });
    document.getElementById('undo').onclick = () => { built.length = 0; document.querySelectorAll('.chip').forEach(c => c.disabled = false); draw(); };
    drillState.getAnswer = () => built.join(' ');
  } else drillState.getAnswer = () => [...document.querySelectorAll('.gap')].map(g => g.value.trim()).join(' ');
  document.getElementById('chk').onclick = drillCheck;
}
function drillCheck() {
  const { it, t } = drillState;
  const got = drillState.getAnswer();
  const ok = norm(got) === norm(it.a) || (it.alt || []).some(a => norm(a) === norm(got));
  drillState.n++; if (ok) drillState.ok++;
  const s = (S.gram ||= {})[t.id] ||= { n: 0, ok: 0 }; s.n++; if (ok) s.ok++;
  recordItem(ok, 'gram');
  document.querySelectorAll('.gap').forEach(gap => { gap.classList.add(ok ? 'right' : 'wrong'); gap.disabled = true; });
  document.querySelector('.pill').textContent = `${drillState.ok}/${drillState.n}`;
  document.getElementById('fb').innerHTML = `<p class="feedback">${ok ? '✅ Richtig!' : `❌ Richtig wäre: <b>${esc(it.a)}</b>`}</p><p class="small">${it.why}</p>`;
  const b = document.getElementById('chk'); b.textContent = 'Weiter →'; b.onclick = () => drillNext(false);
  b.focus({ preventScroll: true });
}
function drillDone() {
  const d = drillState; const mins = Math.max(1, Math.round((Date.now() - d.start) / 60000));
  if (d.n) toast(`${d.ok} von ${d.n} richtig in ${mins} Min.`);
  grammarHome();
}
