/* gauge – core: motion mode, CSS variables from config, helpers, loading queue, placeholders.
   Plain script (no modules), so the site also works when opened by double-click (file://). */
(function () {
  'use strict';
  var C = window.GAUGE_CONFIG;
  var G = window.G = { C: C };

  /* ---------------- Motion mode ---------------- */
  var mqReduziert = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function modusBestimmen() {
    if (!C.animationen) return 'aus';
    if (C.reduzierteBewegungBeachten && mqReduziert && mqReduziert.matches) return 'reduziert';
    return 'voll';
  }

  /** Duration for fades: full value, the short reduced fade, or 0 when animations are off. */
  G.blende = function (ms) { return G.modus === 'aus' ? 0 : G.modus === 'reduziert' ? C.reduziertDauer : ms; };
  /** Duration for movement (growing, sliding, zooming): only in full mode. */
  G.bewegung = function (ms) { return G.modus === 'voll' ? ms : 0; };

  function px(v) { return v + 'px'; }
  function ms(v) { return Math.max(0, Math.round(v)) + 'ms'; }

  /** Write all config values that CSS needs as custom properties on <html>. */
  function cssVariablen() {
    var r = document.documentElement.style;
    var B = C.baum, L = C.layout, S = C.seite, P = C.produkte, V = C.viewer, Ga = C.galerie;
    var b = G.bewegung, f = G.blende;
    r.setProperty('--r', px(C.eckradius));
    r.setProperty('--fuge', String(C.fugeHoehe));
    r.setProperty('--kurve', C.kurve);
    r.setProperty('--kurve-raus', C.kurveRaus);
    r.setProperty('--kurve-rein', C.kurveRein);
    r.setProperty('--baum-b', px(L.baumBreite));
    r.setProperty('--baum-schmal', px(L.baumSchmal));
    r.setProperty('--luft', px(L.luft));
    r.setProperty('--inhalt-max', px(L.inhaltMax));
    // movement
    r.setProperty('--t-wachsen', ms(b(B.wachsen)));
    r.setProperty('--t-klappen', ms(b(B.klappen)));
    r.setProperty('--t-verschieben', ms(b(B.verschieben)));
    r.setProperty('--t-schmal', ms(b(B.schmalAufklappen)));
    r.setProperty('--t-inhalt', ms(b(L.inhaltVerschieben)));
    r.setProperty('--t-hover', ms(b(P.hoverDauer)));
    r.setProperty('--zoom', String(G.modus === 'voll' ? P.hoverZoom : 1));
    // fades
    r.setProperty('--t-blende-baum', ms(f(B.wachsen)));
    r.setProperty('--t-seite', ms(f(S.wechsel)));
    r.setProperty('--t-filter', ms(f(S.filter)));
    r.setProperty('--t-abend', ms(f(P.abendUeberblenden)));
    r.setProperty('--t-ueberblenden', ms(f(V.ueberblenden)));
    r.setProperty('--t-still-rein', ms(f(V.standbildRein)));
    r.setProperty('--t-still-raus', ms(f(V.standbildRaus)));
    r.setProperty('--t-lampe', ms(f(V.lampe)));
    r.setProperty('--t-lampe-vor', ms(f(V.lampeVorFahrt)));
    r.setProperty('--t-auslaufen', ms(f(V.auslaufenWechsel || 0)));
    r.setProperty('--t-foto', ms(f(Ga.einblenden)));
    r.setProperty('--t-lightbox', ms(f(Ga.lightboxAuf)));
    r.setProperty('--t-lb-wechsel', ms(f(Ga.lightboxWechsel)));
    r.setProperty('--t-hand', ms(f(C.handy.feldHoch)));
    r.setProperty('--abblenden', String(P.vorschauAbblenden));
    // hub bar, products grid, gallery
    var Le = C.leiste;
    r.setProperty('--leiste-radius', px(Le.radius));
    r.setProperty('--feld', px(Le.feld));
    r.setProperty('--feld-handy', px(Le.feldHandy));
    r.setProperty('--blur', px(Le.blur));
    r.setProperty('--hover-zoom', String(G.modus === 'voll' ? Le.hoverZoom : 1));
    r.setProperty('--t-klappfeld', ms(b(Le.klappfeld)));
    r.setProperty('--t-namen', ms(f(Le.namenWechsel || 300)));        // the name fades …
    r.setProperty('--t-namen-weg', ms(b(Le.namenWechsel || 300)));    // … the field grows (reduced motion: at once)
    r.setProperty('--t-blende-klapp', ms(f(Le.klappfeld)));
    r.setProperty('--leiste-rand', px(Le.abstandRand));
    r.setProperty('--leiste-rand-handy', px(Le.abstandRandHandy));
    r.setProperty('--inhalt-rand', px(Le.inhaltRand != null ? Le.inhaltRand : 20));
    if (Le.glasDeckkraft != null) r.setProperty('--glas', 'rgba(250, 249, 246, ' + Le.glasDeckkraft + ')');
    r.setProperty('--raster-abstand', px(P.abstand));
    r.setProperty('--raster-abstand-handy', px(P.abstandHandy));
    var cl = document.documentElement.classList;
    cl.toggle('bewegung-voll', G.modus === 'voll');
    cl.toggle('bewegung-reduziert', G.modus === 'reduziert');
    cl.toggle('bewegung-aus', G.modus === 'aus');
  }

  G.modus = modusBestimmen();
  G.LEISTE = C.navigation !== 'baum';
  document.documentElement.classList.add(G.LEISTE ? 'nav-leiste' : 'nav-baum');
  cssVariablen();
  if (mqReduziert) {
    var neu = function () { G.modus = modusBestimmen(); cssVariablen(); };
    if (mqReduziert.addEventListener) mqReduziert.addEventListener('change', neu);
    else if (mqReduziert.addListener) mqReduziert.addListener(neu);
  }

  /* ---------------- Helpers ---------------- */
  G.el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  G.warte = function (t) { return new Promise(function (ok) { setTimeout(ok, t); }); };
  G.frame = function () { return new Promise(function (ok) { requestAnimationFrame(function () { ok(); }); }); };
  G.klemmen = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  G.istHandy = function () { return window.innerWidth <= C.handy.breite; };
  G.geraet = function () {
    var w = window.innerWidth;
    return w <= C.handy.breite ? 'handy' : w < 1080 ? 'tablet' : 'desktop';
  };
  G.hatHover = window.matchMedia ? window.matchMedia('(hover: hover)').matches : true;
  /** Fisher–Yates shuffle (copy). */
  G.mischen = function (a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  /** Run a Web Animation if available and motion allowed; always resolves. */
  G.animiere = function (el, frames, opts) {
    if (!el.animate || !opts.duration) {
      var last = frames[frames.length - 1];
      for (var k in last) if (k !== 'offset' && k !== 'easing') el.style[k] = last[k];
      return Promise.resolve(null);
    }
    var a = el.animate(frames, opts);
    return new Promise(function (ok) {
      a.onfinish = function () { ok(a); };
      a.oncancel = function () { ok(a); };
    });
  };

  /* ---------------- Loading queue (priorities) ----------------
     One queue for all images and videos of the products. Higher priority loads first.
     Levels used:  100 needed right now · 60 current viewer · 40 hover · 20 start images · 10 first moves · 5 the rest */
  var auftraege = {};      // url → job
  var liste = [];
  var laufend = 0;
  var zaehler = 0;

  function job(url, art, el, prio) {
    var j = auftraege[url];
    if (j) { if (el && !j.el) j.el = el; hochstufen(j, prio); return j; }
    j = { url: url, art: art, el: el || null, prio: prio || 5, nr: zaehler++, zustand: 'offen', ok: false, cbs: [] };
    j.dann = function (fn) { if (j.zustand === 'fertig') fn(j.ok); else j.cbs.push(fn); return j; };
    auftraege[url] = j;
    liste.push(j);
    weiter();
    return j;
  }

  function hochstufen(j, prio) {
    if (prio && prio > j.prio) { j.prio = prio; weiter(); }
  }

  function weiter() {
    while (laufend < C.viewer.gleichzeitig) {
      var best = null;
      for (var i = 0; i < liste.length; i++) {
        var j = liste[i];
        if (j.zustand !== 'offen') continue;
        if (!best || j.prio > best.prio || (j.prio === best.prio && j.nr < best.nr)) best = j;
      }
      if (!best) break;
      starten(best);
    }
  }

  function starten(j) {
    j.zustand = 'laedt';
    laufend++;
    var erledigt = false, uhr;
    function fertig(ok) {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(uhr);
      j.zustand = 'fertig';
      j.ok = !!ok;
      laufend--;
      liste.splice(liste.indexOf(j), 1);
      var cbs = j.cbs; j.cbs = [];
      cbs.forEach(function (fn) { try { fn(j.ok); } catch (e) { console.error(e); } });
      weiter();
    }
    uhr = setTimeout(function () { fertig(j.art === 'video' && j.el && j.el.readyState >= 2); }, C.viewer.wartenJeDateiMs);
    if (j.art === 'bild') {
      var img = j.el || new Image();
      img.decoding = 'async';
      img.onload = function () { fertig(true); };
      img.onerror = function () { fertig(false); };
      img.src = j.url;
      if (img.complete && img.naturalWidth) fertig(true);
    } else {
      var v = j.el;
      v.addEventListener('canplaythrough', function () { fertig(true); }, { once: true });
      v.addEventListener('error', function () { v.dataset.fehlt = '1'; fertig(false); }, { once: true });
      v.preload = 'auto';
      if (!v.getAttribute('src')) v.src = j.url;
      v.load();
    }
  }

  G.lader = {
    bild: function (url, prio) { return job(url, 'bild', null, prio); },
    video: function (url, el, prio) { return job(url, 'video', el, prio); },
    hochstufen: hochstufen,
    /** Load right now, past the queue. */
    sofort: function (j) { j.prio = Math.max(j.prio, 100); if (j.zustand === 'offen') starten(j); }
  };

  /* ---------------- Placeholders ----------------
     A calm grey surface with a small caption. It knows the path of its future file; when that file exists,
     the real image fades in automatically (only if echteDateienVerwenden is on). */
  G.platzhalter = function (o) {
    // a real file is coming: no caption, no joint line – only a calm surface until the image has loaded
    var folgt = !!(o.pfad && C.echteDateienVerwenden);
    var ph = G.el('div', 'ph' + (o.abend ? ' ph-abend' : '') + (folgt ? ' ph-folgt' : '') + (o.klasse ? ' ' + o.klasse : ''));
    if (o.abend && !folgt) ph.appendChild(G.el('span', 'ph-licht'));
    if (o.fuge && !folgt) ph.appendChild(G.el('span', 'ph-fuge'));
    if (o.text && !folgt) ph.appendChild(G.el('span', 'ph-text', o.text));
    if (o.verhaeltnis) ph.style.aspectRatio = String(o.verhaeltnis);
    ph.dataset.pfad = o.pfad || '';
    var geladen = false, status = folgt ? null : true, cbs = [];
    function melden(s) { status = s; var l = cbs; cbs = []; l.forEach(function (f) { f(s); }); }
    /** fn(true) once the real image is loaded AND decoded (never a half built image), fn(false) if it failed. */
    ph.wennBereit = function (fn) { if (status !== null) fn(status); else cbs.push(fn); };
    ph.laden = function (prio) {
      if (!o.pfad || !C.echteDateienVerwenden) return null;
      var j = G.lader.bild(o.pfad, prio || 5);
      if (!geladen) {
        geladen = true;
        j.dann(function (ok) {
          if (!ok) { melden(false); return; }
          var img = G.el('img', 'ph-bild');
          img.alt = o.alt || o.text || '';
          img.decoding = 'async';
          img.onload = function () {
            var d = img.decode ? img.decode() : Promise.resolve();
            d.then(null, function () {}).then(function () { ph.classList.add('echt'); melden(true); });
          };
          img.onerror = function () { melden(false); };
          img.src = o.pfad;
          ph.appendChild(img);
        });
      }
      return j;
    };
    if (o.prio) ph.laden(o.prio);
    return ph;
  };
  /** Promise: the placeholder shows its real image (or there is none coming). */
  G.bildBereit = function (ph, prio) {
    if (!ph || !ph.wennBereit) return Promise.resolve(true);
    if (ph.classList.contains('ph-folgt')) ph.laden(prio || 30);
    return new Promise(function (ok) { ph.wennBereit(ok); });
  };

  /* ---------------- Rising (tiles, gallery photos) ----------------
     Elements do not appear all at once: one after the other they rise a little from below while fading in,
     like things coming up out of water side by side. An element rises only once its image is really there
     (until then a calm grey surface). If one takes too long, the wave goes on without it; it rises by itself later. */
  G.welle = (function () {
    var schlange = [], naechster = 0, uhr = null;
    function W() { return C.welle || { dauer: 500, hub: 16, gesamt: 1100, versatzMin: 35, versatzMax: 90, warten: 1500 }; }
    function aufsteigen(e) {
      var w = W();
      e.els.forEach(function (el) {
        if (!el) return;
        el.classList.remove('vor-aufstieg');
        if (G.modus === 'aus') return;
        var frames = G.modus === 'voll'
          ? [{ opacity: 0, transform: 'translateY(' + w.hub + 'px)' }, { opacity: 1, transform: 'translateY(0)' }]
          : [{ opacity: 0 }, { opacity: 1 }];
        el.animate(frames, { duration: G.blende(w.dauer), easing: C.kurveRein, fill: 'backwards' });
      });
    }
    function lauf() {
      clearTimeout(uhr); uhr = null;
      var jetzt = performance.now(), w = W();
      while (schlange.length) {
        var e = schlange[0];
        if (!e.bereit) {
          if (!e.kopf) e.kopf = jetzt;
          if (jetzt - e.kopf > w.warten) { schlange.shift(); e.spaet = true; continue; }   // rises on its own later
          uhr = setTimeout(lauf, Math.max(20, w.warten - (jetzt - e.kopf) + 5));
          return;
        }
        if (naechster > jetzt + 1) { uhr = setTimeout(lauf, naechster - jetzt); return; }
        schlange.shift();
        naechster = jetzt + e.versatz;
        aufsteigen(e);
      }
    }
    return {
      /** liste: [{ els: [elements that rise together], bereit: Promise }] – already in the order of the wave. */
      einreihen: function (liste) {
        if (!liste.length) return;
        var w = W(), n = liste.length;
        var versatz = n > 1 ? Math.max(w.versatzMin, Math.min(w.versatzMax, (w.gesamt - w.dauer) / (n - 1))) : 0;
        if (G.modus === 'aus') versatz = 0;
        liste.forEach(function (x) {
          var e = { els: x.els, bereit: false, versatz: versatz };
          x.els.forEach(function (el) { if (el) el.classList.add('vor-aufstieg'); });
          Promise.resolve(x.bereit).then(function () {
            e.bereit = true;
            if (e.spaet) { e.spaet = false; e.kopf = 0; schlange.push(e); }
            lauf();
          });
          schlange.push(e);
        });
        lauf();
      },
      /** Show at once (e.g. an element that is about to be flown) – takes it out of the wave. */
      sofort: function (el) {
        if (!el) return;
        el.classList.remove('vor-aufstieg');
        schlange.forEach(function (e) { e.els = e.els.filter(function (x) { return x !== el; }); });
      }
    };
  })();

  /* ---------------- Products ---------------- */
  /* type codes for the product code OBJ_<type>_<size>_<number> – central in data/produkte.js ("typen") */
  var TYPEN = (window.GAUGE_PRODUKTE && window.GAUGE_PRODUKTE.typen) || { tables: 'TB', seating: 'ST', storage: 'SH', lighting: 'LT' };
  G.KATEGORIEN = [
    { id: 'all', name: 'All', kurz: 'All' },
    { id: 'tables', name: 'Tables', kurz: TYPEN.tables },
    { id: 'seating', name: 'Seating', kurz: TYPEN.seating },
    { id: 'storage', name: 'Storage', kurz: TYPEN.storage },
    { id: 'lighting', name: 'Lighting', kurz: TYPEN.lighting }
  ];
  G.typKurz = function (kat) { return TYPEN[kat] || String(kat || '').slice(0, 2).toUpperCase(); };
  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  /** Display name: the product code, e.g. OBJ_LT_M_03 (folders and files keep the internal name Object_03). */
  G.produktCode = function (p) { return 'OBJ_' + G.typKurz(p.kategorie) + '_' + p.klasse + '_' + zwei(p.nummer); };
  /* the areas of the glass bar (names and order from the config); the tree only knows products, gallery, about */
  G.BEREICHE = Object.keys(C.bereiche || { products: 1, bespoke: 1, gallery: 1, about: 1 })
    .filter(function (id) { return G.LEISTE || id !== 'bespoke'; })
    .map(function (id) { return { id: id, name: (C.bereiche && C.bereiche[id]) || id }; });
  G.bereichName = function (id) { return (C.bereiche && C.bereiche[id]) || id; };
  /** Which main-bar area a route belongs to. */
  G.bereichVon = function (r) { return r.seite === 'gallery' || r.seite === 'about' || r.seite === 'bespoke' ? r.seite : 'products'; };
  G.KLASSEN = [
    { id: 'L', name: 'Large', schluessel: 'gross' },
    { id: 'M', name: 'Medium', schluessel: 'mittel' },
    { id: 'S', name: 'Small', schluessel: 'klein' }
  ];

  /** [x, y, w, h] in pixels of the full picture [W, H] → shares (null without data – then the crops are centred). */
  function anteil(format, r) {
    if (!format || format.length !== 2 || !format[0] || !r || r.length !== 4) return null;
    return { x: r[0] / format[0], y: r[1] / format[1], w: r[2] / format[0], h: r[3] / format[1] };
  }
  /** Furniture boxes (field bildinfo): [x, y, w, h, cut] in pixels → { x, y, w, h (shares), cut } or null. */
  function moebelListe(format, liste) {
    return (liste || []).map(function (r) {
      var a = r && r.length >= 4 ? anteil(format, r.slice(0, 4)) : null;
      if (a) a.cut = !!r[4];
      return a;
    });
  }
  /** Portrait version (phones held upright) – null while it does not exist for every view. */
  function hochDaten(h) {
    if (!h || !h.format || h.format.length !== 2 || !h.format[1] || !(h.bilder || []).length) return null;
    var kA = anteil(h.format, h.kachelAusschnitt);
    return {
      verhaeltnis: h.format[0] / h.format[1],
      kachelAusschnitt: kA,         // 4:3 crop INSIDE the portrait Cam1 picture (format_hoch.kachel) – same centre as the tile
      // where the tile (the 4:3 crop of the WIDE Cam1 picture) lies in the portrait Cam1 picture (bildinfo.kachel_breit):
      // Cam1 has a longer focal length upright, so the tile reaches out to the sides (shares < 0 or > 1)
      kachelBreit: anteil(h.format, h.kachelBreit) || kA,
      brennweite: h.brennweite || [],
      bilder: h.bilder, abend: h.abend || [],
      moebel: moebelListe(h.format, h.moebel), moebelAbend: moebelListe(h.format, h.moebelAbend),
      fahrten: h.fahrten || {}, fahrtenKlein: h.fahrtenKlein || {},
      fahrtenAbend: h.fahrtenAbend || {}, fahrtenAbendKlein: h.fahrtenAbendKlein || {},
      kachel: h.kachel || null, kachelAbend: h.kachelAbend || null
    };
  }
  var roh = (window.GAUGE_PRODUKTE && window.GAUGE_PRODUKTE.produkte) || [];
  var dummies = (C.dummiesZeigen && window.GAUGE_DUMMIES && window.GAUGE_DUMMIES.produkte) || [];
  G.produkte = roh.concat(dummies).map(function (p) {
    var id = String(p.name).toLowerCase();
    var bilder = (!p.dummy && p.bilder) || [];
    var o = {
      id: id,
      name: p.name,                  // internal: folders, files, URLs
      code: p.code || '',            // shown: OBJ_<type>_<size>_<number> (filled in below if the data has none)
      nummer: p.nummer || parseInt(String(p.name).replace(/\D+/g, ''), 10) || 0,
      kategorie: String(p.kategorie || 'tables').toLowerCase(),
      klasse: String(p.klasse || 'M').toUpperCase().charAt(0),
      // views = the stills that really exist (field "bilder" of produkte.json); without images: grey placeholders
      views: bilder.length || Math.max(1, p.views || 1),
      leuchtmittel: !!p.leuchtmittel,
      masse: p.masse || '',
      ordner: p.ordner || ('media/produkte/' + p.name + '/'),
      version: p.version || '',
      kameras: p.kameras || [],
      // aspect ratio of the full pictures (stills and videos, field format of produkte.json, e.g. 12:5; 4:3 without data)
      verhaeltnis: (p.format && p.format.length === 2 && p.format[1]) ? p.format[0] / p.format[1] : 4 / 3,
      // where the 16:9 screen crop and the 4:3 tile crop lie in the full picture – as shares (x, y, w, h of 0…1)
      bildschirm: anteil(p.format, p.bildschirm),
      kachelAusschnitt: anteil(p.format, p.kachelAusschnitt),
      bilder: bilder,
      abend: (!p.dummy && p.abend) || [],
      axo: (!p.dummy && p.axo) || null,
      kachel: (!p.dummy && p.kachel) || null,            // small copy of view 1 for the tiles (build script)
      kachelAbend: (!p.dummy && p.kachelAbend) || null,
      kachelVoll: !p.dummy && !!p.kachelVoll,           // the tile image is the whole wide picture (the tile shows its 4:3 crop)
      fahrten: (!p.dummy && p.fahrten) || {},
      fahrtenKlein: (!p.dummy && p.fahrtenKlein) || {},
      fahrtenAbend: (!p.dummy && p.fahrtenAbend) || {},             // lamps: evening moves (field abendfahrten)
      fahrtenAbendKlein: (!p.dummy && p.fahrtenAbendKlein) || {},
      // furniture box per still (field bildinfo) – the product page never crops it (unless it is a close-up, cut = true)
      moebel: p.dummy ? [] : moebelListe(p.format, p.moebel),
      moebelAbend: p.dummy ? [] : moebelListe(p.format, p.moebelAbend),
      hoch: p.dummy ? null : hochDaten(p.hoch),
      hatBilder: bilder.length > 0,
      dummy: !!p.dummy
    };
    if (!o.code) o.code = G.produktCode(o);
    return o;
  });
  /** What the viewer shows of a product: aspect ratio of its box and where the 4:3 tile crop lies in it (shares).
      Glass bar: the full picture (the reserve left/right lets the page move its centre); tree mode: the 16:9 crop. */
  G.anzeige = function (p, format) {
    if (format === 'hoch' && p.hoch) {
      // portrait picture: the whole picture. kachel = where the tile lies in it (kachel_breit, may reach outside),
      // deckend = the 4:3 crop inside the picture with the same centre (format_hoch.kachel)
      var kh = p.hoch.kachelAusschnitt || { x: 0, y: 750 / 4800, w: 1, h: p.hoch.verhaeltnis * 3 / 4 };
      return { verhaeltnis: p.hoch.verhaeltnis, kachel: p.hoch.kachelBreit || kh, deckend: kh };
    }
    var b = (!G.LEISTE && p.bildschirm) || { x: 0, y: 0, w: 1, h: 1 };
    var verh = p.verhaeltnis * b.w / b.h;
    var k = p.kachelAusschnitt, kb;
    if (k) kb = { x: (k.x - b.x) / b.w, y: (k.y - b.y) / b.h, w: k.w / b.w, h: k.h / b.h };
    else {
      var kw = verh >= 4 / 3 ? (4 / 3) / verh : 1, kh2 = verh >= 4 / 3 ? 1 : verh / (4 / 3);   // centred 4:3
      kb = { x: (1 - kw) / 2, y: (1 - kh2) / 2, w: kw, h: kh2 };
    }
    return { verhaeltnis: verh, kachel: kb, deckend: kb };
  };
  /** Does a share rect reach outside the picture (0…1)? */
  G.ragtHinaus = function (k) { return !!k && (k.x < -0.001 || k.y < -0.001 || k.x + k.w > 1.001 || k.y + k.h > 1.001); };
  /** Where the picture of the product page lies on the screen (glass bar), in px of the window:
      { left, top, width, height, maske: { l, r, t, b } (px of the picture over which an edge fades out), art }.
      W, H = window, fr / fu = the room the bar takes on the right / at the bottom (incl. its edge distance).
      Wide picture (art 'voll'): full height (+ fu), its centre in the middle of the FREE area – it covers the window
        as long as it is wide enough; a window wider than that (21:9, 32:9) keeps the full height and the picture ends
        softly at the sides (maske). The furniture box of every view (bildinfo, not for close-ups) stays inside the free
        area with config viewer.moebelRand – if needed the picture gets smaller (the same for all views of the product,
        so nothing jumps between views), its edges then fade out above / below as well.
      Phone upright without portrait pictures (art 'decken'): the wide picture covers the screen as before.
      Portrait picture (art 'hoch', phone upright): full width, top aligned, the bars lie over the floor; on phones
        slimmer than its aspect ratio it is enlarged towards the full height and cropped evenly at the sides (tile
        centre). The furniture box of every view (bildinfo of the _hoch stills, not for close-ups) is never covered by
        the bars (free area above them, viewer.moebelRand) and never cropped at the sides – if needed the picture gets
        smaller (the same for all views), still top aligned; edges inside the window fade out softly. */
  function rand(innen, voll) { return innen > 0.5 ? Math.min(voll, innen * 3) : 0; }
  G.buehne = function (p, format, W, H, fr, fu) {
    var V = C.viewer, h, w, left, top, F = V.auslaufen || 0;
    if (format === 'hoch' && p.hoch) {
      var aH = p.hoch.verhaeltnis, k = p.hoch.kachelAusschnitt, kc = k ? k.x + k.w / 2 : 0.5;
      var mr = V.moebelRand || 0, freiH = H - fu;
      var boxen = p.hoch.moebel.concat(p.hoch.moebelAbend).filter(function (b) { return b && !b.cut; });
      var lage = function (w) { return w > W ? Math.min(0, Math.max(W - w, W / 2 - kc * w)) : (W - w) / 2; };
      var passt = function (w) {
        var hh = w / aH, l = lage(w);
        for (var i = 0; i < boxen.length; i++) {
          var b = boxen[i];
          if ((b.y + b.h) * hh > freiH - mr + 0.5) return false;                       // under the bars
          if (w > W + 0.5 && (l + b.x * w < mr - 0.5 || l + (b.x + b.w) * w > W - mr + 0.5)) return false;   // cropped sides
        }
        return true;
      };
      var groesste = function (a, z) {      // the largest width in [a, z] that fits (a fits)
        for (var n = 0; n < 24; n++) { var mi = (a + z) / 2; if (passt(mi)) a = mi; else z = mi; }
        return a;
      };
      var wVoll = Math.max(W, H * aH);       // full width – or enlarged to the full height (phone slimmer than the picture)
      if (passt(wVoll)) w = wVoll;
      else if (passt(W)) w = groesste(W, wVoll);
      else {                                  // even full width puts furniture under the bars: smaller
        w = W;
        boxen.forEach(function (b) { if (b.y + b.h > 0) w = Math.min(w, (freiH - mr) * aH / (b.y + b.h)); });
        w = Math.max(w, 40);
      }
      h = w / aH; left = lage(w);
      return { left: left, top: 0, width: w, height: h, art: 'hoch',
        maske: { l: rand(left, F * w), r: rand(W - left - w, F * w), t: 0, b: rand(H - h, F * h) } };
    }
    var a = p.verhaeltnis, freiW = W - fr, freiH = H - fu, cx = freiW / 2, cy = freiH / 2, art = 'voll';
    h = H + fu; w = h * a;
    if (W <= C.handy.breite && H > W) { w = Math.max(W + fr, w); art = 'decken'; }
    else {
      var m = V.moebelRand || 0;
      p.moebel.concat(p.moebelAbend).forEach(function (b) {
        if (!b || b.cut) return;
        var dl = 0.5 - b.x, dr = b.x + b.w - 0.5, dt = 0.5 - b.y, db = b.y + b.h - 0.5;   // box edges from the picture centre
        if (dl > 0) w = Math.min(w, (cx - m) / dl);
        if (dr > 0) w = Math.min(w, (freiW - m - cx) / dr);
        if (dt > 0) w = Math.min(w, a * cy / dt);
        if (db > 0) w = Math.min(w, a * (freiH - cy) / db);
      });
      w = Math.max(w, 40);
    }
    h = w / a;
    left = cx - w / 2; top = cy - h / 2;
    // an edge that lies inside the window fades out softly (the further inside, the wider – up to config viewer.auslaufen)
    return { left: left, top: top, width: w, height: h, art: art,
      maske: { l: rand(left, F * w), r: rand(W - left - w, F * w), t: rand(top, F * h), b: rand(H - top - h, F * h) } };
  };
  /** CSS object-position that shows exactly the 4:3 tile crop of a whole-picture tile image (object-fit: cover). */
  G.kachelPosition = function (p) {
    var k = p.kachelAusschnitt;
    if (!p.kachelVoll || !k) return '50% 50%';
    return (k.w < 0.999 ? k.x / (1 - k.w) * 100 : 50) + '% ' + (k.h < 0.999 ? k.y / (1 - k.h) * 100 : 50) + '%';
  };
  G.produkt = function (id) {
    for (var i = 0; i < G.produkte.length; i++) if (G.produkte[i].id === id) return G.produkte[i];
    return null;
  };
  /* ---------------- Shared state: filters, customize parameters ---------------- */
  G.zustand = {
    groesse: 'all',            // all | S | M | L
    art: 'all',                // all | tables | seating | storage | lighting
    parameter: {},             // per product: { length, height, shelves }
    offenerParameter: null
  };
  /** Newest = highest number first. */
  G.nachNummer = function (liste) {
    return liste.slice().sort(function (a, b) { return b.nummer - a.nummer; });
  };
  /** Order of the tiles (no sorting switch). Test version: products with real images always first (top row),
      the grey placeholders after them; within each group newest first. */
  G.sortieren = function (liste) {
    return liste.slice().sort(function (a, b) { return (b.hatBilder - a.hatBilder) || (b.nummer - a.nummer); });
  };
  /** Does a product match the chosen TYPE and SIZE of the code filter? */
  G.passtFilter = function (p) {
    var g = G.zustand.groesse, a = G.zustand.art;
    return (g === 'all' || p.klasse === g) && (a === 'all' || p.kategorie === a);
  };
  G.zwei = zwei;
  /* Customize parameters – placeholders without function. */
  G.PARAMETER = [
    { id: 'length',  name: 'Length',  min: 600, max: 2400, schritt: 100, start: 1200, einheit: 'mm' },
    { id: 'height',  name: 'Height',  min: 300, max: 1200, schritt: 10,  start: 740,  einheit: 'mm' },
    { id: 'shelves', name: 'Shelves', min: 0,   max: 6,    schritt: 1,   start: 2,    einheit: '' }
  ];
  G.parameterVon = function (pid) {
    var w = G.zustand.parameter[pid];
    if (!w) {
      w = G.zustand.parameter[pid] = {};
      G.PARAMETER.forEach(function (p) { w[p.id] = p.start; });
    }
    return w;
  };

  /** Paths of a product's files – only files the build script really copied (data/produkte.js), otherwise null
      (= grey placeholder, nothing is requested). ?v= changes whenever the build script copies a changed file. */
  var probe = document.createElement('video');
  var AV1 = !!(probe.canPlayType && probe.canPlayType('video/webm; codecs="av01.0.08M.08"') === 'probably');
  function datei(p, rel) { return rel ? p.ordner + rel + (p.version ? '?v=' + p.version : '') : null; }
  /** The data of one picture format: the product itself ('breit') or its portrait version ('hoch'). */
  function satz(p, format) { return format === 'hoch' && p.hoch ? p.hoch : p; }
  /** Which pictures a product shows right now: 'hoch' on a phone held upright (glass bar) if it has portrait pictures,
      otherwise 'breit'. */
  G.formatFuer = function (p) {
    var hochkant = window.innerWidth <= C.handy.breite && window.innerHeight > window.innerWidth;
    return C.viewer.hochformat !== false && G.LEISTE && p && p.hoch && hochkant ? 'hoch' : 'breit';
  };
  G.pfade = {
    still: function (p, v, format) { return datei(p, satz(p, format).bilder[v - 1]); },
    abend: function (p, v, format) { return p.leuchtmittel ? datei(p, satz(p, format).abend[v - 1]) : null; },
    axo: function (p) { return datei(p, p.axo); },     // Customize (placeholder until the file exists)
    /** Tile image: the small copy of view 1 (loads fast on the start screen); without it the full still.
        format 'hoch': the small copy of the portrait picture (opening a product on the phone). */
    kachel: function (p, format) { return format === 'hoch' ? (p.hoch ? datei(p, p.hoch.kachel) : null) : (datei(p, p.kachel) || G.pfade.still(p, 1)); },
    kachelAbend: function (p, format) {
      if (!p.leuchtmittel) return null;
      return format === 'hoch' ? (p.hoch ? datei(p, p.hoch.kachelAbend) : null) : (datei(p, p.kachelAbend) || G.pfade.abend(p, 1));
    },
    /** Move from view a to view b (views → cameras); klein = video/klein/. WebM (AV1) only where it surely plays, else MP4.
        If one size is missing, the other one is used. format 'hoch': the portrait moves (Move_CamA_CamB_hoch). */
    fahrt: function (p, a, b, klein, abend, format) {
      var ka = p.kameras[a - 1], kb = p.kameras[b - 1];
      if (ka == null || kb == null) return null;
      var key = ka + '-' + kb, d = satz(p, format), hoch = d !== p;
      var gross = abend ? d.fahrtenAbend : d.fahrten, kl = abend ? d.fahrtenAbendKlein : d.fahrtenKlein;
      var wahl = [[klein, klein ? kl : gross], [!klein, klein ? gross : kl]];
      for (var i = 0; i < wahl.length; i++) {
        var formate = wahl[i][1][key] || [];
        var endung = AV1 && formate.indexOf('webm') >= 0 ? 'webm' : formate.indexOf('mp4') >= 0 ? 'mp4' : null;
        if (endung) return datei(p, (wahl[i][0] ? 'video/klein/' : 'video/') + 'Move_Cam' + ka + '_Cam' + kb + (abend ? '_abend' : '') + (hoch ? '_hoch' : '') + '.' + endung);
      }
      return null;
    }
  };
})();
