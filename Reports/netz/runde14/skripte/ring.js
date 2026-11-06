// Ladering: angetippte, noch nicht geladene Fahrt. Tastet alle ~40 ms ab: Deckkraft, Drehwinkel, Bogen (0..100), bis die Fahrt startet.
// env: BASE, GR, DESK, IDS, KBIT/LAT, IOS, WARTE (ms nach dem Öffnen), VIEW
const { starten, warte } = require('./cdp');
const BASE = process.env.BASE || 'http://127.0.0.1:8761/';
const DESK = !!process.env.DESK;
const [W, H] = (process.env.GR || (DESK ? '1536x730' : '390x664')).split('x').map(Number);
const IDS = (process.env.IDS || 'object_05').split(',');
const VIEW = +(process.env.VIEW || 3);
const PROBE = `(() => {
  const b = [...document.querySelectorAll('.g-view')].find(e => e.getAttribute('aria-label') === 'View ${VIEW}' && e.getBoundingClientRect().width > 0);
  const s = b && b.querySelector('.g-ring');
  const x = G.seiteProdukt.viewerObj();
  const vid = [...x.el.querySelectorAll('video')].find(v => v.dataset.spielt && !v.paused && v.currentTime > 0.02);
  let winkel = null, bogen = null, op = 0;
  if (s) { const cs = getComputedStyle(s); op = +cs.opacity; const m = cs.transform.match(/matrix\\(([^,]+),\\s*([^,]+)/); if (m) winkel = Math.round(Math.atan2(+m[2], +m[1]) * 180 / Math.PI);
    bogen = Math.round(100 - parseFloat(getComputedStyle(s.lastChild).strokeDashoffset)); }
  return { t: Math.round(performance.now()), laedt: !!(b && b.classList.contains('laedt')), op: Math.round(op * 100) / 100, winkel, bogen, anteil: x.laden ? x.laden.anteil : null, faehrt: !!vid };
})()`;
(async () => {
  const b = await starten(+(process.env.CDPPORT || (9500 + Math.floor(Math.random() * 90))));
  try {
    if (process.env.KBIT) await fetch(BASE + '__netz?kbit=' + process.env.KBIT + '&lat=' + (process.env.LAT || 0));
    await b.send('Network.enable'); await b.send('Network.clearBrowserCache');
    if (DESK) await b.desktop(W, H); else await b.handy(W, H, 3);
    await b.send('Page.navigate', { url: BASE + 'index.html?n=' + Date.now() + '#/products' });
    for (let i = 0; i < 240; i++) { await warte(250); if (await b.ev(`!!(window.G && G.seiteProdukte && document.querySelector('.k-tag.echt'))`).catch(() => false)) break; }
    await warte(1500);
    for (const id of IDS) {
      await b.ev(`G.seiteProdukte.kachelFuer('${id}').scrollIntoView({ block: 'center' })`); await warte(200);
      await b.ev(`G.app.produktOeffnen(G.produkt('${id}'), G.seiteProdukte.kachelFuer('${id}'))`);
      await warte(+(process.env.WARTE || 300));
      const t0 = await b.ev(`(G.app.viewWaehlen(${VIEW}), performance.now())`);
      const r = [];
      for (let i = 0; i < 600; i++) { const p = await b.ev(PROBE); p.t -= Math.round(t0); r.push(p); if (p.faehrt) break; await warte(25); }
      const sicht = r.find(p => p.op > 0.05), start = r.find(p => p.faehrt);
      const winkel = r.filter(p => p.op > 0.05 && p.winkel != null).map(p => p.winkel);
      const dreht = new Set(winkel).size > 3;
      const boegen = r.filter(p => p.laedt).map(p => p.bogen);
      console.log(JSON.stringify({ id, kbit: process.env.KBIT || 0, ios: !!process.env.IOS, ringSichtbarAb: sicht ? sicht.t : null, fahrtAb: start ? start.t : null,
        dreht, winkelProben: winkel.length, bogenVon: boegen[0], bogenBis: Math.max(...boegen.filter(x => x != null), 0), monoton: boegen.every((x, i) => i === 0 || x >= boegen[i - 1] - 1) }));
      if (process.env.VOLL) r.filter((p, i) => i % 4 === 0 || p.faehrt).forEach(p => console.log('  ' + JSON.stringify(p)));
      await b.ev(`location.hash = '#/products'`); await warte(3500);
    }
  } catch (e) { console.log('FEHLER ' + e.stack); }
  finally { console.log('JS-Fehler: ' + JSON.stringify(b.fehler)); b.ende(); process.exit(0); }
})();
