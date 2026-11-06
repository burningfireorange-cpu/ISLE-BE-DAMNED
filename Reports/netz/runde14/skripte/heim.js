// Zurück zur Übersicht: Zeitverlauf (Schrumpfen, Fahrt, Kachel, Leisten). env: BASE, GR, DESK, IDS, VIEW, LAMPE
const { starten, warte } = require('./cdp');
const BASE = process.env.BASE || 'http://127.0.0.1:8761/';
const DESK = !!process.env.DESK;
const [W, H] = (process.env.GR || (DESK ? '1536x730' : '390x664')).split('x').map(Number);
const IDS = (process.env.IDS || 'object_05').split(',');
const VIEW = +(process.env.VIEW || 3);

const PROBE = `(() => {
  const t = performance.now();
  const f = document.querySelector('.flug-echt, .flug-handy');
  const fr = f ? f.getBoundingClientRect() : null;
  const x = window.__v;
  const vid = x ? [...x.el.querySelectorAll('video')].find(v => v.dataset.spielt) : null;
  const ort = x ? (x.el.parentNode && x.el.parentNode.classList.contains('kachel') ? 'kachel' : x.el.closest('.flug') ? 'flug' : x.el.closest('.p-buehne') ? 'buehne' : 'weg') : '-';
  const op = el => el ? +getComputedStyle(el).opacity : null;
  const kon = document.querySelector('.glas .g-kontext'), ob = document.querySelector('.glas-oben');
  const code = !!document.querySelector('.w-code');
  const codeOrt = code ? (document.querySelector('.w-code').closest('.glas-oben') ? 'oben' : 'leiste') : null;
  const vis = el => { if (!el) return 0; let o = 1, e = el; while (e && e !== document.body) { o *= +getComputedStyle(e).opacity; e = e.parentElement; } return Math.round(o * 100) / 100; };
  const codeSicht = code ? vis(document.querySelector('.w-code')) * (document.querySelector('.w-code').closest('.glas-oben') ? (+getComputedStyle(document.querySelector('.glas-oben > .g-hg')).opacity) : 1) : 0;
  const views = document.querySelector('.w-produkt');
  const rechts = document.querySelector('.glas').classList.contains('rechts');
  const kach = x ? document.querySelector('.kachel > .viewer') : null;
  return { t: Math.round(t), flug: fr ? [Math.round(fr.left), Math.round(fr.top), Math.round(fr.width), Math.round(fr.height)] : null,
    vid: vid ? { t: Math.round(vid.currentTime * 100) / 100, paused: vid.paused, src: (vid.dataset.url || '').split('/').pop().split('?')[0] } : null,
    ort, aktuell: x ? x.aktuell : null, belegt: x ? x.belegt : null, code: codeSicht, codeOrt, views: !!(views && views.isConnected && vis(views) > 0.01), rechts,
    heimRaus: !!(kach && kach.classList.contains('heim-raus')), lampe: x ? x.lampe : null };
})()`;

(async () => {
  const b = await starten(+(process.env.CDPPORT || (9500 + Math.floor(Math.random() * 90))));
  try {
    if (DESK) await b.desktop(W, H); else await b.handy(W, H, 3);
    await b.send('Page.navigate', { url: BASE + 'index.html?n=' + Date.now() + '#/products' });
    for (let i = 0; i < 120; i++) { await warte(250); if (await b.ev(`!!(window.G && G.seiteProdukte && document.querySelector('.k-tag.echt'))`).catch(() => false)) break; }
    await warte(1500);
    for (const id of IDS) {
      await b.ev(`location.hash = '#/products'`); await warte(1500);
      await b.ev(`G.seiteProdukte.kachelFuer('${id}').scrollIntoView({ block: 'center' })`); await warte(300);
      await b.ev(`G.app.produktOeffnen(G.produkt('${id}'), G.seiteProdukte.kachelFuer('${id}'))`);
      await warte(2500);
      await b.ev(`window.__v = G.seiteProdukt.viewerObj()`);
      if (process.env.LAMPE) { await b.ev(`G.app.lampeSchalten()`); await warte(1600); }
      if (VIEW !== 1) {
        await b.ev(`G.app.viewWaehlen(${VIEW})`);
        for (let i = 0; i < 100; i++) { await warte(100); if (await b.ev(`!window.__v.belegt && window.__v.aktuell === ${VIEW}`)) break; }
        await warte(500);
      }
      // zurück und Zeitverlauf
      const proben = [];
      const t0 = await b.ev(`(G.router.geh('products'), performance.now())`);
      for (let i = 0; i < 160; i++) { proben.push(await b.ev(PROBE)); await warte(15); if (proben[proben.length - 1].ort === 'buehne' && i > 20) break; }
      const r = proben.map(p => Object.assign(p, { t: p.t - Math.round(t0) }));
      const ersteFlug = r.find(p => p.flug), inK = r.find(p => p.ort === 'kachel'), vidEnde = r.filter(p => p.vid).pop();
      const codeAn = r.find(p => p.code > 0.05), codeVoll = r.find(p => p.code > 0.95);
      const fahrtInKachel = r.some(p => p.ort === 'kachel' && p.vid && !p.vid.paused);
      const fahrtImFlug = r.some(p => p.ort === 'flug' && p.vid && !p.vid.paused);
      const flugStart = r.filter(p => p.flug);
      const schrumpft = flugStart.length > 1 ? flugStart.findIndex(p => p.flug[2] < flugStart[0].flug[2] - 2) : -1;
      console.log(JSON.stringify({ id, gr: W + 'x' + H, view: VIEW, lampe: !!process.env.LAMPE,
        flugAb: ersteFlug ? ersteFlug.t : null, schrumpftAb: schrumpft >= 0 ? flugStart[schrumpft].t : null,
        inKachel: inK ? inK.t : null, fahrtImFlug, fahrtInKachel, fahrtEnde: vidEnde ? vidEnde.t : null,
        codeAb: codeAn ? codeAn.t : null, codeVoll: codeVoll ? codeVoll.t : null,
        viewsBis: (r.filter(p => p.views).pop() || {}).t, aufBuehne: (r.find(p => p.ort === 'buehne') || {}).t, lampeAm: r[r.length - 1].lampe }));
      if (process.env.VOLL) r.forEach(p => console.log('  ' + JSON.stringify(p)));
    }
  } catch (e) { console.log('FEHLER ' + e.stack); }
  finally { console.log('JS-Fehler: ' + JSON.stringify(b.fehler)); b.ende(); process.exit(0); }
})();
