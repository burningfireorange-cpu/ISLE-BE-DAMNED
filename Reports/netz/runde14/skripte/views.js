// View-Wechsel unter gedrosseltem Netz, kalter Cache. Misst je Tippen:
//   mark  = ms bis die angetippte Nummer markiert ist (und bleibt: zurueck = sie verlor die Markierung wieder)
//   ring  = ms bis der Ladering erscheint, fahrt = ms bis die Fahrt startet, fertig = ms bis die View erreicht ist
//   grau  = am Ende sichtbares Standbild weder geladen noch Ersatz/Vorschau
// Dazu: schnelles Mehrfach-Tippen, Tippen während der Fahrt, 404, falsches Bildformat, JS-Fehler.
// env: BASE, GR (WxH), DESK=1, KBIT/LAT (Drosselserver /__netz), IDS, WARTE, CDPPORT
const { starten, warte } = require('./cdp');
const BASE = process.env.BASE || 'http://127.0.0.1:8761/';
const DESK = !!process.env.DESK;
const [W, H] = (process.env.GR || (DESK ? '1536x730' : '390x664')).split('x').map(Number);
const IDS = (process.env.IDS || 'object_05,object_04,object_03,object_02,object_01').split(',');
const WARTE = +(process.env.WARTE || 1200);

const INSTR = `(() => {
  if (window.__m) return;
  window.__m = { ev: [] };
  const log = (art, x) => window.__m.ev.push(Object.assign({ t: performance.now(), art }, x || {}));
  const nr = el => (el.getAttribute('aria-label') || '').replace('View ', '');
  new MutationObserver(ms => ms.forEach(m => {
    const el = m.target;
    if (!el.classList) return;
    if (el.classList.contains('g-view')) log('cls', { v: nr(el), aktiv: el.classList.contains('aktiv'), laedt: el.classList.contains('laedt') });
    if (el.classList.contains('raus') && !(m.oldValue || '').includes('raus') && el.closest && el.closest('.p-buehne') && !el.classList.contains('v-video')) log('still-raus');
  })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  ['pointerdown', 'click'].forEach(e => document.addEventListener(e, ev => { const b = ev.target.closest && ev.target.closest('.g-view'); if (b) log(e, { v: nr(b) }); }, true));
})()`;
// sichtbarer Zustand des Viewers auf der Bühne
const ZUSTAND = `(() => {
  const x = G.seiteProdukt.viewerObj();
  const s = x.stills[x.aktuell], a = x.abende[x.aktuell];
  const oben = (a && a.classList.contains('sichtbar')) ? a : s;
  const ok = oben.classList.contains('echt') || !!oben.querySelector('.ph-ersatz') || oben.classList.contains('mit-vorschau');
  const sicht = [...x.el.children].filter(e => getComputedStyle(e).opacity > 0.01 && (e.classList.contains('ph') || e.tagName === 'VIDEO')).length;
  const mark = [...document.querySelectorAll('.g-view.aktiv')].map(nr => nr.getAttribute('aria-label').replace('View ', '')).join(',');
  return { abend: !!(a && a.classList.contains('sichtbar') && x.lampe), aktuell: x.aktuell, belegt: x.belegt, ok, ersatz: !!oben.querySelector('.ph-ersatz'), sicht, mark };
})()`;

(async () => {
  const b = await starten(+(process.env.CDPPORT || (9500 + Math.floor(Math.random() * 90))));
  const netz = {}, fehlerNetz = [];
  b.hoerer.push(d => {
    const p = d.params || {};
    if (d.method === 'Network.requestWillBeSent') netz[p.requestId] = { url: p.request.url, a: Date.now(), prio: p.request.initialPriority };
    if (d.method === 'Network.loadingFinished' && netz[p.requestId]) { netz[p.requestId].e = Date.now(); netz[p.requestId].kb = Math.round(p.encodedDataLength / 1024); }
    if (d.method === 'Network.responseReceived') { const n = netz[p.requestId]; if (n) { n.status = p.response.status; if (p.response.status >= 400) fehlerNetz.push(p.response.status + ' ' + n.url); } }
    if (d.method === 'Network.loadingFailed') { const n = netz[p.requestId]; if (n && !p.canceled && !/ABORTED/.test(p.errorText)) fehlerNetz.push(p.errorText + ' ' + n.url); if (n) { n.e = Date.now(); n.ab = 1; } }
  });
  const ergebnis = { zeilen: [], probleme: [] };
  try {
    if (process.env.KBIT) await fetch(BASE + '__netz?kbit=' + process.env.KBIT + '&lat=' + (process.env.LAT || 0));
    await b.send('Network.enable');
    await b.send('Network.clearBrowserCache');
    await b.send('Network.setCacheDisabled', { cacheDisabled: false });
    if (DESK) await b.desktop(W, H); else await b.handy(W, H, 3);
    const tStart = Date.now();
    await b.send('Page.navigate', { url: BASE + 'index.html?n=' + Date.now() + '#/products' });
    for (let i = 0; i < 240; i++) { await warte(250); if (await b.ev(`!!(window.G && G.seiteProdukte && document.querySelector('.k-tag.echt'))`).catch(() => false)) break; }
    const tKacheln = Date.now() - tStart;
    await warte(1000);
    await b.ev(INSTR);
    const tippe = async (v) => {
      const r = await b.ev(`(() => { const x = [...document.querySelectorAll('.g-view')].find(e => e.getAttribute('aria-label') === 'View ${v}' && e.getBoundingClientRect().width > 0); if (!x) return null; const q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
      if (!r) return false;
      if (DESK) {
        await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] });
        await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', clickCount: 1 });
        await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', clickCount: 1 });
      } else {
        await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r[0], y: r[1] }] });
        await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      return true;
    };
    // wartet bis der Viewer ruhig auf v steht (höchstens ms); liefert die Auswertung ab dem letzten Klick
    const bisRuhig = async (v, ms) => {
      let z; const folge = [];
      for (let i = 0; i < ms / 100; i++) {
        await warte(100);
        z = await b.ev(ZUSTAND);
        if (folge[folge.length - 1] !== z.aktuell) folge.push(z.aktuell);
        if (!z.belegt && z.aktuell === v) break;
      }
      const ev = await b.ev(`window.__m.ev`);
      const kl = ev.filter(e => e.art === 'click');
      const t0 = kl.length ? kl[kl.length - 1].t : 0;
      const nach = ev.filter(e => e.t >= t0);
      const r = x => x ? Math.round(x.t - t0) : null;
      const markE = nach.find(e => e.art === 'cls' && e.v === String(v) && e.aktiv);
      const zurueck = markE ? nach.some(e => e.t > markE.t && e.art === 'cls' && e.v === String(v) && !e.aktiv) : null;
      const andere = nach.some(e => e.art === 'cls' && e.v !== String(v) && e.aktiv && markE && e.t > markE.t);
      const tEnde = await b.ev(`performance.now()`);
      return { mark: r(markE), zurueck, andereMarkiert: andere, ring: r(nach.find(e => e.art === 'cls' && e.v === String(v) && e.laedt)),
        fahrt: r(nach.find(e => e.art === 'still-raus')), fertig: (!z.belegt && z.aktuell === v) ? Math.round(tEnde - t0) : 'NICHT',
        ok: z.ok, ersatz: z.ersatz, markEnde: z.mark, abend: z.abend, folge: folge.join('>') };
    };
    for (const id of IDS) {
      await b.ev(`location.hash = '#/products'`); await warte(1300);
      await b.ev(`(() => { const k = G.seiteProdukte.kachelFuer('${id}'); k.scrollIntoView({ block: 'center' }); })()`);
      await warte(300);
      await b.ev(`G.app.produktOeffnen(G.produkt('${id}'), G.seiteProdukte.kachelFuer('${id}'))`);
      await warte(WARTE);
      if (process.env.LAMPE) { await b.ev(`(() => { const l = document.querySelector('.g-lampe'); if (l) l.click(); })()`); await warte(1500); }
      const n = await b.ev(`document.querySelectorAll('.g-view').length`);
      const zeile = { id, fmt: await b.ev(`G.seiteProdukt.viewerObj().format`) };
      const pruef = (art, e, v) => {
        if (e.mark == null || e.mark > 50) ergebnis.probleme.push(`${id} ${art}: Markierung nach ${e.mark} ms`);
        if (e.zurueck || e.andereMarkiert) ergebnis.probleme.push(`${id} ${art}: Markierung sprang zurück`);
        if (e.fertig === 'NICHT') ergebnis.probleme.push(`${id} ${art}: View ${v} nicht erreicht`);
        if (!e.ok) ergebnis.probleme.push(`${id} ${art}: graue Fläche am Ende`);
        if (e.markEnde !== String(v)) ergebnis.probleme.push(`${id} ${art}: am Ende markiert ${e.markEnde}`);
        if (process.env.LAMPE && !e.abend) ergebnis.probleme.push(`${id} ${art}: Lampe am Ende nicht an`);
      };
      // 1. einzelne Taps
      for (const v of (n >= 3 ? [2, 3, 1] : [2, 1])) {
        await b.ev(`window.__m.ev = []`);
        const tT = Date.now();
        await tippe(v);
        const e = await bisRuhig(v, 30000);
        if (process.env.LOG2 && e.fahrt > +(process.env.LOGAB || 6000)) { console.log('  ' + id + ' View ' + v + ': Fahrt nach ' + e.fahrt + ' ms'); Object.values(netz).filter(n => n.a < tT + e.fahrt && (!n.e || n.e > tT - 8000)).forEach(n => console.log('    ' + String(n.a - tT).padStart(7) + ' .. ' + (n.e ? String(n.e - tT).padStart(7) : '  offen') + ' ' + (n.ab ? 'ABBR ' : '') + (n.kb || 0) + ' KB ' + n.url.split('/media/produkte/').pop().split('?')[0])); }
        zeile['v' + v] = e; pruef('View ' + v, e, v);
        await warte(300);
      }
      // 2. schnelles Mehrfach-Tippen (150 ms Abstand) – keine Warteschlange, das letzte zählt
      const folge = n >= 3 ? [2, 3, 2, 3] : [2, 1, 2];
      await b.ev(`window.__m.ev = []`);
      for (const v of folge) { await tippe(v); await warte(150); }
      const ziel = folge[folge.length - 1];
      const e2 = await bisRuhig(ziel, 30000);
      // keine Warteschlange: nach dem letzten Tippen keine weitere Fahrt zu einer früheren Wahl
      e2.fahrtenNachLetztem = (await b.ev(`window.__m.ev`)).filter(x => x.art === 'still-raus').length;
      zeile.schnell = e2; pruef('Mehrfach', e2, ziel);
      await warte(300);
      // 3. während einer laufenden Fahrt eine andere View tippen
      const a = ziel === 1 ? 2 : 1, c = n >= 3 ? ([1, 2, 3].find(x => x !== a && x !== ziel)) : ziel;
      await b.ev(`window.__m.ev = []`);
      await tippe(a);
      let lief = false;
      for (let i = 0; i < 300; i++) { await warte(50); if ((await b.ev(`window.__m.ev`)).some(x => x.art === 'still-raus')) { lief = true; break; } }
      await warte(500);
      await tippe(c);
      const e3 = await bisRuhig(c, 30000);
      e3.lief = lief;
      zeile.waehrend = e3; pruef('während Fahrt', e3, c);
      // alte Regel: die laufende Fahrt zu a endet dort (a erscheint in der Folge), erst dann geht es zu c
      if (lief && a !== c && !e3.folge.split('>').map(Number).includes(a)) ergebnis.probleme.push(id + ' während Fahrt: laufende Fahrt zu ' + a + ' nicht zu Ende gespielt (' + e3.folge + ')');
      ergebnis.zeilen.push(zeile);
      console.log(JSON.stringify(zeile));
      if (process.env.ERG) require('fs').appendFileSync(process.env.ERG, JSON.stringify(zeile) + '\n');
    }
    // Format: nur das benötigte laden
    const urls = [...new Set(Object.values(netz).map(n => n.url.split('?')[0]))].filter(u => /\/media\/produkte\//.test(u));
    const falsch = urls.filter(u => {
      const hoch = /_hoch(_kachel)?\.(jpg|mp4|webm)$/.test(u);
      if (DESK || W > H) return hoch;
      return !hoch;
    });
    const vid = urls.filter(u => /\.(mp4|webm)$/.test(u));
    const kleinFalsch = vid.filter(u => (W <= 760) !== /\/video\/klein\//.test(u));
    console.log(`Kacheln nach ${tKacheln} ms. Geladen: ${urls.length} Mediendateien, davon ${vid.length} Videos.`);
    console.log('Falsches Format: ' + (falsch.length ? falsch.map(u => u.split('/media/produkte/')[1]).join(' ') : 'keine'));
    console.log('Falsche Videogröße (klein/groß): ' + (kleinFalsch.length ? kleinFalsch.map(u => u.split('/media/produkte/')[1]).join(' ') : 'keine'));
    const srv = await (await fetch(BASE + '__netz')).json().catch(() => ({ fehler: [] }));
    console.log('404 / Netzfehler: ' + JSON.stringify(fehlerNetz.concat(srv.fehler || [])));
    console.log('PROBLEME (' + ergebnis.probleme.length + '): ' + JSON.stringify(ergebnis.probleme));
    if (process.env.ERG) require('fs').appendFileSync(process.env.ERG, 'PROBLEME ' + ergebnis.probleme.length + ' ' + JSON.stringify(ergebnis.probleme) + '\nJS-Fehler ' + JSON.stringify(b.fehler) + '\n404 ' + JSON.stringify(fehlerNetz) + '\nFormat ' + JSON.stringify(falsch) + ' ' + JSON.stringify(kleinFalsch) + '\n');
  } catch (e) { console.log('FEHLER ' + e.stack); }
  finally { console.log('JS-Fehler: ' + JSON.stringify(b.fehler)); b.ende(); process.exit(0); }
})();
