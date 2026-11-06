// Kleines PC-Fenster: senkrechte Leiste nie abgeschnitten (Stufe 1 kleiner, Stufe 2 unten). Größe wird zur Laufzeit geändert.
const { starten, warte } = require('./cdp');
const BASE = process.env.BASE || 'http://127.0.0.1:8761/';
const GROESSEN = (process.env.GROESSEN || '1536x730,1366x625,1280x600,1280x560,1280x520,1280x480,1280x440,1280x400,1100x360,800x500,800x400,770x340,1920x1080').split(',').map(s => s.split('x').map(Number));
const IDS = (process.env.IDS || 'object_01,object_03').split(',');
const M = `(() => {
  const n = document.querySelector('.glas'), r = n.getBoundingClientRect();
  const f = [...n.querySelectorAll('.g-feld')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect());
  const kl = Math.min(...f.map(x => x.width)), sym = n.querySelector('.g-view .g-text, .g-sym svg');
  const svg = n.querySelector('.g-bereich svg').getBoundingClientRect();
  const bu = document.querySelector('.p-buehne').getBoundingClientRect();
  // Ein Feld ist erreichbar, wenn es ganz im Fenster liegt und der Punkt in seiner Mitte das Feld selbst trifft
  const erreichbar = [...n.querySelectorAll('.g-feld')].filter(b => b.offsetParent).every(b => { const q = b.getBoundingClientRect(); if (q.top < 0 || q.bottom > innerHeight || q.left < 0 || q.right > innerWidth) return false; const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return e && (e === b || b.contains(e)); });
  return { modus: n.classList.contains('rechts') ? 'rechts' : 'unten', eng: n.classList.contains('eng'), feld: Math.round(kl), icon: Math.round(svg.width),
    oben: Math.round(r.top), unten: Math.round(innerHeight - r.bottom), links: Math.round(r.left), rechtsRand: Math.round(innerWidth - r.right), b: Math.round(r.width), h: Math.round(r.height),
    erreichbar, freiR: getComputedStyle(document.documentElement).getPropertyValue('--frei-r').trim(), freiU: getComputedStyle(document.documentElement).getPropertyValue('--frei-u').trim(),
    bild: [Math.round(bu.left), Math.round(bu.top), Math.round(bu.width), Math.round(bu.height)] };
})()`;
(async () => {
  const b = await starten(+(process.env.CDPPORT || (9500 + Math.floor(Math.random() * 90))));
  const probleme = [];
  try {
    await b.desktop(1536, 730);
    await b.send('Page.navigate', { url: BASE + 'index.html?n=' + Date.now() + '#/products/' + IDS[0] });
    await warte(4000);
    for (const id of IDS) {
      await b.ev(`location.hash = '#/products/${id}'`); await warte(1500);
      for (const [w, h] of GROESSEN) {
        await b.desktop(w, h); await warte(450);
        const m = await b.ev(M);
        const ok = m.erreichbar && m.oben >= 0 && m.unten >= 0 && m.links >= 0 && m.rechtsRand >= 0;
        if (!ok) probleme.push(id + ' ' + w + 'x' + h);
        console.log(id.padEnd(10) + (w + 'x' + h).padEnd(10) + JSON.stringify(m) + (ok ? '' : '  <-- PROBLEM'));
      }
    }
    // zurück auf Products und wieder hinein bei kleiner Größe (render, nicht resize)
    await b.desktop(1280, 400); await b.ev(`location.hash = '#/products'`); await warte(1200);
    await b.ev(`location.hash = '#/products/object_01'`); await warte(1200);
    console.log('render 1280x400 ' + JSON.stringify(await b.ev(M)));
    await b.desktop(1280, 520); await b.ev(`location.hash = '#/products'`); await warte(1200);
    await b.ev(`location.hash = '#/products/object_01'`); await warte(1200);
    console.log('render 1280x520 ' + JSON.stringify(await b.ev(M)));
    if (process.env.BILD) { await b.desktop(1280, 440); await warte(600); await b.bild(process.env.BILD + '_1280x440.jpg'); await b.desktop(1280, 560); await warte(600); await b.bild(process.env.BILD + '_1280x560.jpg'); await b.desktop(1280, 400); await warte(600); await b.bild(process.env.BILD + '_1280x400.jpg'); }
  } catch (e) { console.log('FEHLER ' + e.stack); }
  finally { console.log('PROBLEME: ' + JSON.stringify(probleme)); console.log('JS-Fehler: ' + JSON.stringify(b.fehler)); b.ende(); process.exit(0); }
})();
