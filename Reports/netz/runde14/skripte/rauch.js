// Rauchtest: Handy-Zoom hin/zurück (geliehene Kachelbilder kommen zurück), Bewegung reduzieren, Baum-Modus, Desktop.
// env: BASE, MODUS (handy|reduziert|baum|desk)
const { starten, warte } = require('./cdp');
const BASE = process.env.BASE || 'http://127.0.0.1:8763/';
const MODUS = process.env.MODUS || 'handy';
(async () => {
  const b = await starten(9700 + Math.floor(Math.random() * 90));
  const probleme = [];
  try {
    if (MODUS === 'desk' || MODUS === 'baum') await b.desktop(1536, 730); else await b.handy(390, 664, 3);
    if (MODUS === 'baum') {      // Baum-Modus eingeschleust: config.js wird im Browser umgeschrieben (Projekt bleibt unverändert)
      await b.send('Fetch.enable', { patterns: [{ urlPattern: '*js/config.js*', requestStage: 'Response' }] });
      b.hoerer.push(async d => {
        if (d.method !== 'Fetch.requestPaused') return;
        const r = await b.send('Fetch.getResponseBody', { requestId: d.params.requestId });
        let txt = r.base64Encoded ? Buffer.from(r.body, 'base64').toString('utf8') : r.body;
        txt = txt.replace("navigation: 'leiste'", "navigation: 'baum'");
        await b.send('Fetch.fulfillRequest', { requestId: d.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }], body: Buffer.from(txt).toString('base64') });
      });
    }
    if (MODUS === 'reduziert') await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] });
    await b.send('Page.navigate', { url: BASE + 'index.html?n=' + Date.now() + '#/products' });
    for (let i = 0; i < 80; i++) { await warte(250); if (await b.ev(`!!(window.G && G.seiteProdukte && document.querySelector('.k-tag.echt'))`).catch(() => false)) break; }
    await warte(2500);
    await b.ev(`window.__spielt = 0; document.addEventListener('playing', () => window.__spielt++, true)`);
    const ids = await b.ev(`G.produkte.filter(p => !p.dummy).map(p => p.id)`);
    console.log(MODUS + ': navigation = ' + await b.ev(`GAUGE_CONFIG.navigation + ' / Baum im DOM: ' + !!document.querySelector('nav.baum') + ' / Glasleiste: ' + !!document.querySelector('.glas')`));
    for (const id of ids) {
      // Kachel echt antippen / klicken
      await b.ev(`location.hash = '#/products'`); await warte(1500);
      const r = await b.ev(`(() => { const k = G.seiteProdukte.kachelFuer('${id}'); if (!k) return null; k.scrollIntoView({ block: 'center' }); const q = k.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
      if (!r) { probleme.push(id + ': keine Kachel'); continue; }
      await warte(400);
      if (MODUS === 'desk' || MODUS === 'baum') {
        await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] }); await warte(150);
        await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', clickCount: 1 });
        await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', clickCount: 1 });
      } else {
        await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r[0], y: r[1] }] });
        await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await warte(3200);
      const auf = await b.ev(`({ hash: location.hash, flug: document.querySelectorAll('.flug').length, sicht: getComputedStyle(G.seiteProdukt.viewerEl()).visibility, fmt: G.seiteProdukt.viewerObj().format })`);
      if (!auf.hash.includes(id)) probleme.push(id + ': Produkt nicht offen ' + auf.hash);
      if (auf.flug) probleme.push(id + ': Flug bleibt stehen');
      if (auf.sicht !== 'visible') probleme.push(id + ': Viewer unsichtbar');
      // View 2 wählen (Leiste oder Baum), dann zurück zu 1
      for (const v of [2, 1]) {
        const t0 = Date.now();
        await b.ev(`(() => { const x = [...document.querySelectorAll('.g-view, .views .view')].find(e => e.getAttribute('aria-label') === 'View ${v}' && e.getBoundingClientRect().width > 0); if (x) x.click(); return !!x; })()`);
        const mark = await b.ev(`[...document.querySelectorAll('.g-view.aktiv, .views .view.aktiv')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.getAttribute('aria-label')).join(',')`);
        if (mark !== 'View ' + v) probleme.push(`${id}: nach Klick auf ${v} markiert '${mark}'`);
        let ok = false;
        for (let i = 0; i < 100; i++) { await warte(100); const z = await b.ev(`(() => { const x = G.seiteProdukt.viewerObj(); return !x.belegt && x.aktuell === ${v}; })()`); if (z) { ok = true; break; } }
        if (!ok) probleme.push(`${id}: View ${v} nicht erreicht`);
        await warte(300);
      }
      // zurück zur Produktwand (Rückflug), danach: Kachelbilder wieder in der Kachel, kein Flug übrig
      await b.ev(`history.back()`);
      await warte(3000);
      const zu = await b.ev(`(() => { const k = G.seiteProdukte.kachelFuer('${id}'); const t = k && k.querySelector(':scope > .k-tag');
        return { hash: location.hash, flug: document.querySelectorAll('.flug').length, tag: !!t, echt: !!(t && t.classList.contains('echt')),
          tagSichtbar: t ? getComputedStyle(t).opacity : null, pos: t ? t.style.position : null, viewerInKachel: !!(k && k.querySelector('.viewer')) }; })()`);
      if (zu.flug) probleme.push(id + ': nach zurück Flug übrig');
      if (!zu.tag || !zu.echt) probleme.push(id + ': Kachelbild fehlt nach zurück ' + JSON.stringify(zu));
      if (zu.pos) probleme.push(id + ': Kachelbild hat noch Flug-Stil ' + zu.pos);
      if (zu.viewerInKachel) probleme.push(id + ': Viewer bleibt in der Kachel');
    }
    const spielt = await b.ev(`window.__spielt`);
    console.log(`${MODUS}: ${ids.length} Produkte, Videos gespielt: ${spielt}` + (MODUS === 'reduziert' && spielt ? '  (PROBLEM: Fahrt trotz Bewegung reduzieren)' : ''));
    if (MODUS === 'reduziert' && spielt) probleme.push('Fahrt trotz Bewegung reduzieren');
  } catch (e) { probleme.push('FEHLER ' + e.stack); }
  finally {
    console.log(`${MODUS}: PROBLEME (${probleme.length}): ` + JSON.stringify(probleme));
    console.log(`${MODUS}: JS-Fehler: ` + JSON.stringify(b.fehler)); b.ende(); process.exit(0);
  }
})();
