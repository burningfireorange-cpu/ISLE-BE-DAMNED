// Vorladen beim Öffnen eines Produkts: Zeit bis die Fahrten ab View 1 und bis ALLE Fahrten bereit sind (kalter Cache).
// env: BASE, GR, DESK, IDS, KBIT/LAT, IOS, LAMPE (Licht gleich nach dem Öffnen an), MAX (ms), ERG
const { starten, warte } = require('./cdp');
const BASE = process.env.BASE || 'http://127.0.0.1:8761/';
const DESK = !!process.env.DESK;
const [W, H] = (process.env.GR || (DESK ? '1536x730' : '390x664')).split('x').map(Number);
const IDS = (process.env.IDS || 'object_05,object_01').split(',');
const MAX = +(process.env.MAX || 90000);
const STAND = `(() => {
  const x = G.seiteProdukt.viewerObj(), p = x.p, n = x.n, klein = x.klein();
  const bereit = v => !!v && (/^blob:/.test(v.currentSrc || v.src || '') || v.readyState >= 4 || (v.duration > 0 && v.buffered.length && v.buffered.end(v.buffered.length - 1) >= v.duration - 0.05));
  const zaehle = (abend) => { let a1 = 0, n1 = 0, alle = 0, na = 0;
    for (let a = 1; a <= n; a++) for (let b = 1; b <= n; b++) { if (a === b) continue;
      if (abend && !x.hatAbendFahrt(a, b)) continue;
      const url = G.pfade.fahrt(p, a, b, klein, abend, x.format); if (!url) continue;
      const v = x.perUrl[url]; const ok = bereit(v);
      na++; if (ok) alle++; if (a === 1) { n1++; if (ok) a1++; } }
    return { a1, n1, alle, na }; };
  return { tag: zaehle(false), abend: x.p.leuchtmittel ? zaehle(true) : null, format: x.format, klein };
})()`;
(async () => {
  const b = await starten(+(process.env.CDPPORT || (9500 + Math.floor(Math.random() * 90))));
  const netz = [];
  b.hoerer.push(d => { const p = d.params || {};
    if (d.method === 'Network.requestWillBeSent' && /\/media\/produkte\//.test(p.request.url)) netz.push({ id: p.requestId, url: p.request.url, t: Date.now() });
    if (d.method === 'Network.loadingFinished') { const n = netz.find(x => x.id === p.requestId); if (n) { n.kb = Math.round(p.encodedDataLength / 1024); n.e = Date.now(); } }
    if (d.method === 'Network.loadingFailed') { const n = netz.find(x => x.id === p.requestId); if (n) { n.e = Date.now(); n.ab = p.errorText; } } });
  try {
    if (process.env.KBIT) await fetch(BASE + '__netz?kbit=' + process.env.KBIT + '&lat=' + (process.env.LAT || 0));
    await b.send('Network.enable'); await b.send('Network.clearBrowserCache');
    if (DESK) await b.desktop(W, H); else await b.handy(W, H, 3);
    for (const id of IDS) {
      await b.send('Network.clearBrowserCache');
      await b.send('Page.navigate', { url: BASE + 'index.html?n=' + Date.now() + '#/products' });
      for (let i = 0; i < 240; i++) { await warte(250); if (await b.ev(`!!(window.G && G.seiteProdukte && document.querySelector('.k-tag.echt'))`).catch(() => false)) break; }
      await warte(+(process.env.VORHER || 2000));
      await b.ev(`G.seiteProdukte.kachelFuer('${id}').scrollIntoView({ block: 'center' })`); await warte(200);
      const t0 = Date.now();
      await b.ev(`G.app.produktOeffnen(G.produkt('${id}'), G.seiteProdukte.kachelFuer('${id}'))`);
      let tA1 = null, tAlle = null, tAbend = null, s;
      if (process.env.LAMPE) { await warte(1500); await b.ev(`G.app.lampeSchalten()`); }
      for (;;) {
        await warte(100);
        s = await b.ev(STAND);
        const dt = Date.now() - t0;
        if (tA1 == null && s.tag.a1 === s.tag.n1) tA1 = dt;
        if (tAlle == null && s.tag.alle === s.tag.na) tAlle = dt;
        if (s.abend && tAbend == null && s.abend.alle === s.abend.na && s.abend.na) tAbend = dt;
        if ((tAlle != null && (!process.env.LAMPE || tAbend != null)) || dt > MAX) break;
      }
      const vids = netz.filter(n => n.t >= t0 && /\.(mp4|webm)/.test(n.url));
      const abendGeladen = vids.filter(n => /_abend/.test(n.url)).length;
      const z = { id, gr: W + 'x' + H, ios: !!process.env.IOS, kbit: process.env.KBIT || 0, ab1: tA1, alle: tAlle, abend: tAbend, stand: s.tag, standAbend: s.abend, format: s.format, klein: s.klein,
        videoAnfragen: vids.length, abendAnfragen: abendGeladen, kb: vids.reduce((a, n) => a + (n.kb || 0), 0) };
      console.log(JSON.stringify(z));
      if (process.env.LOG) netz.filter(n => !n.e || n.e >= t0 - 500).forEach(n => console.log('   ' + String(n.t - t0).padStart(7) + ' .. ' + (n.e ? String(n.e - t0).padStart(7) : '  offen') + ' ' + (n.ab ? 'ABBR ' : '') + String(n.kb || 0).padStart(5) + ' KB ' + n.url.split('/media/produkte/').pop().split('?')[0]));
      if (process.env.ERG) require('fs').appendFileSync(process.env.ERG, JSON.stringify(z) + '\n');
    }
  } catch (e) { console.log('FEHLER ' + e.stack); }
  finally { console.log('JS-Fehler: ' + JSON.stringify(b.fehler)); b.ende(); process.exit(0); }
})();
