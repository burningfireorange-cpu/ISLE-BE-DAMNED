// Handy-Zoom hin und zurück, Bild für Bild (requestAnimationFrame im Browser):
//   fenster = sichtbarer Ausschnitt (Rahmen transformiert, minus clip-path inset), bild = Rechteck des Bilds darin.
//   rand    = größter Abstand, um den das Fenster über das Bild hinausragt (> 0.75 px = Seite/Grau würde sichtbar)
//   leer    = Bilder, in denen das tragende Bild nicht geladen war
//   sprung  = Abweichung Fenster ↔ Kachel am Anfang / ↔ Viewer am Ende, größter Sprung von Bild zu Bild (relativ zum Mittel)
// env: BASE, GR, IDS, VIEWS (z. B. "1,3"), LAMPE (Licht an vor dem Zurück), KBIT/LAT
const { starten, warte } = require('./cdp');
const BASE = process.env.BASE || 'http://127.0.0.1:8761/';
const [W, H] = (process.env.GR || '390x664').split('x').map(Number);
const IDS = (process.env.IDS || 'object_05,object_04,object_03,object_02,object_01').split(',');
const VIEWS = (process.env.VIEWS || '1,3').split(',').map(Number);

const SAMPLER = `(() => {
  window.__z = []; const lauf = window.__zLauf = (window.__zLauf || 0) + 1;   // (eine ältere Schleife endet sofort)
  const R = r => [Math.round(r.left * 10) / 10, Math.round(r.top * 10) / 10, Math.round(r.right * 10) / 10, Math.round(r.bottom * 10) / 10];
  const geladen = el => {
    if (!el) return false;
    if (el.tagName === 'IMG') return el.complete && el.naturalWidth > 0;
    if (el.classList.contains('viewer')) {            // der echte Viewer: oberste sichtbare Ebene geladen?
      const x = window.__vObj; if (!x) return true;
      const s = x.stills[x.aktuell], a = x.abende[x.aktuell];
      const oben = (a && a.classList.contains('sichtbar')) ? a : s;
      const vid = [...x.el.querySelectorAll('video')].find(v => v.dataset.spielt && +getComputedStyle(v).opacity > 0.5);
      return !!vid || oben.classList.contains('echt') || oben.classList.contains('mit-vorschau');
    }
    return true;
  };
  const tick = () => {
    if (window.__zLauf !== lauf) return;
    const k = document.querySelector('.flug-handy');
    if (k) {
      const kr = k.getBoundingClientRect(), s = kr.width / k.offsetWidth;
      const m = (getComputedStyle(k).clipPath || '').match(/inset\\(([^)]*)\\)/);
      let c = [0, 0, 0, 0];
      if (m) { const z = m[1].split('round')[0].trim().split(/\\s+/).map(parseFloat); c = [z[0], z[1] ?? z[0], z[2] ?? z[0], z[3] ?? z[1] ?? z[0]]; }
      const fenster = [kr.left + s * c[3], kr.top + s * c[0], kr.right - s * c[1], kr.bottom - s * c[2]];
      const inh = k.querySelector('.flug-inhalt');
      const traeger = inh && (inh.querySelector(':scope > .viewer') || inh.querySelector(':scope > .flug-hochbild'));
      const br = traeger ? traeger.getBoundingClientRect() : kr;
      const rand = Math.max(br.left - fenster[0], br.top - fenster[1], fenster[2] - br.right, fenster[3] - br.bottom);
      window.__z.push({ t: performance.now(), f: fenster.map(v => Math.round(v * 10) / 10), b: R(br), rand: Math.round(rand * 100) / 100,
        geladen: geladen(traeger), traeger: traeger ? traeger.className.split(' ')[0] : '-', op: +getComputedStyle(k).opacity });
    } else if (window.__z.length && !window.__z[window.__z.length - 1].weg) window.__z.push({ t: performance.now(), weg: true });
    if (!window.__zStop) requestAnimationFrame(tick);
  };
  window.__zStop = false; requestAnimationFrame(tick);
})()`;

function auswerten(z, anfang, ende) {
  const p = z.filter(x => !x.weg);
  if (!p.length) return { proben: 0 };
  const d = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  const breite = p.map(x => x.f[2] - x.f[0]);
  let sprungMax = 0;
  // Sprung = Geschwindigkeit (px/ms) eines Bilds deutlich über der der beiden Nachbarn (verlorene Bilder zählen nicht, dt ist drin)
  const v = i => d(p[i].f, p[i - 1].f) / Math.max(1, p[i].t - p[i - 1].t);
  for (let i = 2; i < p.length - 1; i++) {
    const a = d(p[i].f, p[i - 1].f);
    if (a > 8 && v(i) > 3 * Math.max(v(i - 1), v(i + 1), 0.05)) sprungMax = Math.max(sprungMax, Math.round(a));
  }
  return { proben: p.length, randMax: Math.max(...p.map(x => x.rand)), leer: p.filter(x => !x.geladen && x.op > 0.02 && d(x.f, p[0].f) > 0.5).length,
    anfang: Math.round(d(p[0].f, anfang) * 10) / 10, ende: Math.round(d(p[p.length - 1].f, ende) * 10) / 10,
    sprungMax, breiteVon: Math.round(breite[0]), breiteBis: Math.round(breite[breite.length - 1]), traeger: [...new Set(p.map(x => x.traeger))].join('/') };
}

(async () => {
  const b = await starten(+(process.env.CDPPORT || (9500 + Math.floor(Math.random() * 90))));
  const probleme = [];
  try {
    if (process.env.KBIT) await fetch(BASE + '__netz?kbit=' + process.env.KBIT + '&lat=' + (process.env.LAT || 0));
    await b.handy(W, H, 3);
    await b.send('Page.navigate', { url: BASE + 'index.html?n=' + Date.now() + '#/products' });
    for (let i = 0; i < 160; i++) { await warte(250); if (await b.ev(`!!(window.G && G.seiteProdukte && document.querySelector('.k-tag.echt'))`).catch(() => false)) break; }
    await warte(2500);
    for (const id of IDS) for (const view of VIEWS) {
      await b.ev(`location.hash = '#/products'`); await warte(1800);
      const r = await b.ev(`(() => { const k = G.seiteProdukte.kachelFuer('${id}'); k.scrollIntoView({ block: 'center' }); return true; })()`);
      await warte(500);
      const kach = await b.ev(`(() => { const q = G.seiteProdukte.kachelFuer('${id}').getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; })()`);
      await b.ev(SAMPLER);
      const mx = (kach[0] + kach[2]) / 2, my = (kach[1] + kach[3]) / 2;
      await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mx, y: my }] });
      await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await warte(2600);
      await b.ev(`window.__zStop = true`);
      const auf = await b.ev(`window.__z`);
      const vr = await b.ev(`(() => { window.__vObj = G.seiteProdukt.viewerObj(); const q = window.__vObj.el.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; })()`);
      const eAuf = auswerten(auf, kach, vr);
      // Sprung am Ende des Öffnens: der Viewer unter dem Rahmen zeigt beim Ausblenden schon das geladene Standbild?
      const echt = await b.ev(`(() => { const x = window.__vObj, s = x.stills[x.aktuell]; return s.classList.contains('echt'); })()`);
      if (process.env.LAMPE && !(await b.ev(`window.__vObj.lampe`))) { await b.ev(`G.app.lampeSchalten()`); await warte(1800); }
      if (view !== 1) {
        await b.ev(`G.app.viewWaehlen(${view})`);
        for (let i = 0; i < 100; i++) { await warte(100); if (await b.ev(`!window.__vObj.belegt && window.__vObj.aktuell === ${view}`)) break; }
        await warte(400);
      }
      const kach2 = await b.ev(`(() => { const q = G.seiteProdukte.kachelFuer('${id}').getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; })()`);
      await b.ev(SAMPLER);
      await b.ev(`history.back()`);
      await warte(3200);
      await b.ev(`window.__zStop = true`);
      const zu = await b.ev(`window.__z`);
      const kach3 = await b.ev(`(() => { const q = G.seiteProdukte.kachelFuer('${id}').getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; })()`);
      const eZu = auswerten(zu, vr, kach3);
      const nachher = await b.ev(`(() => { const k = G.seiteProdukte.kachelFuer('${id}'); const t = k.querySelector(':scope > .k-tag'), a = k.querySelector(':scope > .k-abend');
        return { flug: document.querySelectorAll('.flug').length, viewerInKachel: !!k.querySelector('.viewer'), tag: !!(t && t.classList.contains('echt')),
          abendSicht: a ? +getComputedStyle(a).opacity : null, lampe: !!(G.produkt('${id}').leuchtmittel) }; })()`);
      const zeile = { gr: W + 'x' + H, id, view, lampe: !!process.env.LAMPE, auf: eAuf, standbildEcht: echt, zu: eZu, kachelVerschoben: Math.round(Math.max(...kach2.map((v, i) => Math.abs(v - kach3[i])))), nachher };
      console.log(JSON.stringify(zeile));
      if (process.env.VOLL) { const t0 = (auf[0] || {}).t; auf.forEach(x => console.log('  auf ' + Math.round(x.t - t0) + ' ' + JSON.stringify(x))); const t1 = (zu[0] || {}).t; zu.forEach(x => console.log('  zu ' + Math.round(x.t - t1) + ' ' + JSON.stringify(x))); }
      const chk = (e, wo) => {
        if (!e.proben) { probleme.push(`${id} v${view} ${wo}: kein Zoom-Rahmen`); return; }
        if (e.randMax > 0.75) probleme.push(`${id} v${view} ${wo}: Rand ${e.randMax}px`);
        if (e.leer) probleme.push(`${id} v${view} ${wo}: ${e.leer} Bilder ohne geladenes Bild`);
        if (e.anfang > 1.5) probleme.push(`${id} v${view} ${wo}: Anfang weicht ${e.anfang}px ab`);
        if (e.ende > 1.5) probleme.push(`${id} v${view} ${wo}: Ende weicht ${e.ende}px ab`);
        if (e.sprungMax) probleme.push(`${id} v${view} ${wo}: Sprung ${e.sprungMax}px`);
      };
      chk(eAuf, 'auf'); chk(eZu, 'zu');
      if (!echt) probleme.push(`${id}: Standbild nach dem Öffnen nicht geladen`);
      if (nachher.flug || nachher.viewerInKachel) probleme.push(`${id} v${view}: Rest nach zurück ${JSON.stringify(nachher)}`);
    }
  } catch (e) { probleme.push('FEHLER ' + e.stack); }
  finally {
    console.log(`${W}x${H}: PROBLEME (${probleme.length}): ` + JSON.stringify(probleme));
    console.log('JS-Fehler: ' + JSON.stringify(b.fehler)); b.ende(); process.exit(0);
  }
})();
