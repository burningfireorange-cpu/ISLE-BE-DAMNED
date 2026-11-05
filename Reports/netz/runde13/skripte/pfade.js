// Alle Pfade, die die Seite bilden kann (G.pfade, Galerie), aus der echten Seite holen und online per HEAD prüfen.
const { starten, warte } = require('./cdp');
const BASE = process.env.BASE || 'https://burningfireorange-cpu.github.io/ISLE-BE-DAMNED/';
(async () => {
  const b = await starten(9431);
  try {
    await b.desktop(1536, 730);
    await b.send('Page.navigate', { url: BASE + 'index.html#/products' });
    for (let i = 0; i < 60; i++) { await warte(250); if (await b.ev(`!!(window.G && G.pfade && G.produkte)`).catch(() => false)) break; }
    const urls = await b.ev(`(() => {
      const u = new Set(), add = x => { if (x) u.add(x); };
      G.produkte.filter(p => !p.dummy).forEach(p => {
        ['breit', 'hoch'].forEach(f => {
          add(G.pfade.kachel(p, f)); add(G.pfade.kachelAbend(p, f));
          for (let v = 1; v <= p.views; v++) {
            add(G.pfade.still(p, v, f)); add(G.pfade.abend(p, v, f));
            for (let w = 1; w <= p.views; w++) if (v !== w) [true, false].forEach(k => [true, false].forEach(a => add(G.pfade.fahrt(p, v, w, k, a, f))));
          }
        });
        add(G.pfade.handyKachel(p)); add(G.pfade.handyKachelAbend(p)); add(G.pfade.axo(p));
      });
      // Galerie und alle img/src/link im Dokument
      (window.GAUGE_GALERIE && (GAUGE_GALERIE.fotos || GAUGE_GALERIE.bilder || []) || []).forEach(f => { Object.values(f).forEach(x => { if (typeof x === 'string' && /\\.(jpg|jpeg|png|webp|avif)$/i.test(x)) add(x); }); });
      document.querySelectorAll('script[src],link[href]').forEach(e => add(e.getAttribute('src') || e.getAttribute('href')));
      return [...u].map(x => new URL(x, location.href).href);
    })()`);
    console.log('Pfade: ' + urls.length);
    let schlecht = [];
    for (let i = 0; i < urls.length; i += 16) {
      const teil = urls.slice(i, i + 16);
      const r = await Promise.all(teil.map(u => fetch(u, { method: 'HEAD' }).then(x => x.status).catch(e => 'ERR ' + e.message)));
      r.forEach((s, k) => { if (s !== 200) schlecht.push(s + ' ' + teil[k]); });
    }
    console.log('nicht 200: ' + schlecht.length); schlecht.forEach(x => console.log('  ' + x));
    console.log('Beispiele: ' + urls.filter(u => /media/.test(u)).slice(0, 3).join('  '));
  } catch (e) { console.log('FEHLER ' + e.stack); }
  finally { b.ende(); process.exit(0); }
})();
