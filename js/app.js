/* gauge – wiring: route → tree + page, shared-element flight (tile ↔ viewer), preloading, swipe back. */
(function () {
  'use strict';
  var G = window.G, C = G.C;
  var route = null;

  var SEITEN = {
    products: function () { return G.seiteProdukte; },
    produkt: function () { return G.seiteProdukt; },
    customize: function () { return G.seiteProdukt; },
    order: function () { return G.seiteProdukt; },
    payment: function () { return G.seiteProdukt; },
    gallery: function () { return G.seiteGalerie; },
    about: function () { return G.seiteAbout; },
    bespoke: function () { return G.seiteBespoke; }
  };
  var ALLE = function () { return [G.seiteProdukte, G.seiteProdukt, G.seiteGalerie, G.seiteAbout, G.seiteBespoke]; };

  /* ---------- shared element: tile ↔ viewer ----------
     The picture is laid out at the size of the big viewer (o.gross) and shown through a rounded clip window:
     at the tile, the window is the tile (cover crop, the tile's radius), at the end the whole picture (radius of the
     viewer – 0 in full screen). Works for any aspect ratio of tile, picture and window.
     Inside, layers (clones of the images) can change scale / opacity on the way – e.g. the tile's hover zoom
     returns to 1, or the viewer's current view crossfades into the tile image. The frame stays until "bereit"
     (the target image has loaded), so there is never a grey moment at the end.
     o: gross, klein (rects), radiusKlein, radiusGross, auf (true: tile → viewer), schichten, verstecken, dauer, bereit */
  var flugEl = null;
  /** Transform + clip that show the rect rk (radius) as a window onto a picture laid out at rg. aus = the part of the
      picture that belongs into the window (shares x, y, w, h – the 4:3 tile crop of the wide picture); without it the
      whole picture (cover crop). Opening the window from the tile crop to the whole picture = the picture opens sideways. */
  function fenster(rk, rg, radius, aus) {
    var a = aus || { x: 0, y: 0, w: 1, h: 1 };
    var rx = a.x * rg.width, ry = a.y * rg.height, rw = a.w * rg.width, rh = a.h * rg.height;
    var s = Math.max(rk.width / rw, rk.height / rh);
    var w = rk.width / s, h = rk.height / s, ix = rx + (rw - w) / 2, iy = ry + (rh - h) / 2;
    return {
      transform: 'translate(' + (rk.left - rg.left - s * ix) + 'px,' + (rk.top - rg.top - s * iy) + 'px) scale(' + s + ')',
      clipPath: 'inset(' + iy + 'px ' + (rg.width - ix - w) + 'px ' + (rg.height - iy - h) + 'px ' + ix + 'px round ' + (radius / s) + 'px)'
    };
  }
  function radiusVon(el) { return el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 : 0; }
  function flug(o) {
    if (flugEl && flugEl.parentNode) flugEl.parentNode.removeChild(flugEl);
    var r1 = o.gross;
    var k = G.el('div', 'flug');
    k.style.left = r1.left + 'px';
    k.style.top = r1.top + 'px';
    k.style.width = r1.width + 'px';
    k.style.height = r1.height + 'px';
    var anims = [];
    var opts = { duration: o.dauer, easing: C.kurve, fill: 'forwards' };
    o.schichten.forEach(function (s) {
      var c = s.el.cloneNode(true);
      c.classList.remove('sichtbar', 'raus', 'rein', 'vor-fahrt', 'vor-aufstieg');
      c.style.transform = s.von.transform || 'none';
      c.style.opacity = s.von.opacity == null ? 1 : s.von.opacity;
      c.style.transition = 'none';
      if (s.box) {      // a 4:3 tile image: sits exactly on the tile crop inside the wide picture
        c.style.inset = 'auto';
        c.style.left = s.box.x * 100 + '%'; c.style.top = s.box.y * 100 + '%';
        c.style.width = s.box.w * 100 + '%'; c.style.height = s.box.h * 100 + '%';
      }
      if (s.ursprung) c.style.transformOrigin = s.ursprung;
      if (s.durchsichtig) c.style.backgroundColor = 'transparent';   // a small copy still decoding: the layer below shows
      k.appendChild(c);
      var a = { transform: s.von.transform || 'none', opacity: c.style.opacity }, b = { transform: s.nach.transform || 'none', opacity: s.nach.opacity == null ? 1 : s.nach.opacity };
      if (a.transform !== b.transform || String(a.opacity) !== String(b.opacity)) anims.push({ el: c, frames: [a, b] });
    });
    if (o.maske) {      // the soft edges of the picture (ultrawide) grow while the window opens
      k.classList.add('maske');
      ['l', 'r', 't', 'b'].forEach(function (s) { k.style.setProperty('--m' + s, '0px'); });
    }
    document.body.appendChild(k);
    flugEl = k;
    if (o.maske) {
      void k.offsetWidth;
      k.style.transition = ['l', 'r', 't', 'b'].map(function (s) { return '--m' + s + ' ' + o.dauer + 'ms ' + C.kurve; }).join(', ');
      ['l', 'r', 't', 'b'].forEach(function (s) { k.style.setProperty('--m' + s, Math.round(o.maske[s]) + 'px'); });
    }
    o.verstecken.forEach(function (e) { e.style.visibility = 'hidden'; });
    anims.forEach(function (x) { G.animiere(x.el, x.frames, opts); });
    var bereit = o.bereit || Promise.resolve();
    var klein = fenster(o.klein, r1, o.radiusKlein || 0, o.aus);
    var gross = { transform: 'translate(0px,0px) scale(1)', clipPath: 'inset(0px 0px round ' + (o.radiusGross || 0) + 'px)' };
    return G.animiere(k, o.auf ? [klein, gross] : [gross, klein], { duration: o.dauer, easing: C.kurve, fill: 'forwards' }).then(function () {
      return Promise.race([bereit, G.warte(2500)]);
    }).then(function () {
      o.verstecken.forEach(function (e) { e.style.visibility = ''; });
      if (k.parentNode) k.parentNode.removeChild(k);
      if (flugEl === k) flugEl = null;
    });
  }
  /* ---------- viewer → tile (back to the wall) ----------
     The REAL viewer shrinks into its tile (no copy): if another view than 1 was active, the move back to view 1
     starts at once at normal speed and may go on playing inside the tile; it ends on the view-1 still, which is
     exactly the tile image – then the viewer fades out and goes back to the product page. View 1: only shrinking. */
  var heim = null;     // { v, k, kachel, anim, uhr }
  var startVorgeladen = false;
  /* Evening mode on the way home: the light never goes out at once. The tile takes over the evening image (its own
     small copy of the same picture, held at full opacity under the viewer) and then fades into its day image with the
     duration and curve of the lamp switch (viewer.lampe) – also when the way home is interrupted. */
  function abendHalten(kachel) {
    var ab = kachel && kachel.querySelector('.k-abend');
    if (!ab || !ab.classList.contains('echt')) return null;     // not loaded: the viewer fades by itself (see heimfahren)
    clearTimeout(ab._aus);
    ab.classList.remove('ausglimmen');
    ab.classList.add('nachglimmen');
    return ab;
  }
  function abendAus(ab) {
    if (!ab || !ab.classList.contains('nachglimmen')) return;
    void ab.offsetWidth;                          // the held evening image is in place before the fade starts
    ab.classList.add('ausglimmen');
    ab.classList.remove('nachglimmen');
    clearTimeout(ab._aus);
    ab._aus = setTimeout(function () { ab.classList.remove('ausglimmen'); }, G.blende(C.viewer.lampe) + 60);
  }
  function heimAbbrechen() {
    if (!heim) return;
    var h = heim;
    heim = null;
    clearTimeout(h.uhr);
    // interrupted while the viewer over the tile still shows the evening (move running, or still): the tile holds the
    // evening image and lets the light go out softly instead of jumping to day when the viewer leaves
    if (h.kachel && h.v.lampe) abendAus(abendHalten(h.kachel));
    if (h.anim) { try { h.anim.cancel(); } catch (e) {} }
    var el = h.v.el;
    el.classList.remove('in-kachel', 'heim-raus');
    el.style.transition = '';
    G.seiteProdukt.viewerHolen(h.v);            // back onto the stage (or out of the page, if another product is shown)
    if (h.k && h.k.parentNode) h.k.parentNode.removeChild(h.k);
  }
  function heimfahren(v, gross, kachel) {
    heimAbbrechen();
    var el = v.el, h = heim = { v: v, kachel: kachel };
    var radiusGross = radiusVon(el);
    v.heim();
    v.maske(null);       // soft edges (ultrawide) grow back to the hard picture edge while it shrinks into the tile
    var k = h.k = G.el('div', 'flug flug-echt');
    k.style.left = gross.left + 'px';
    k.style.top = gross.top + 'px';
    k.style.width = gross.width + 'px';
    k.style.height = gross.height + 'px';
    k.appendChild(el);                           // moved synchronously – a running video keeps playing
    document.body.appendChild(k);
    h.anim = k.animate([
      { transform: 'translate(0px,0px) scale(1)', clipPath: 'inset(0px 0px round ' + radiusGross + 'px)' },
      fenster(kachel.getBoundingClientRect(), gross, radiusVon(kachel), v.kachelAnteil)   // ends on the 4:3 tile crop
    ], { duration: C.seite.kachelZumViewer * 0.85, easing: C.kurve, fill: 'forwards' });
    h.anim.onfinish = function () {
      if (heim !== h) return;
      kachel.appendChild(el);                    // from now on it scrolls with the tile
      el.classList.add('in-kachel');
      h.anim = null;
      if (k.parentNode) k.parentNode.removeChild(k);
      h.k = null;
      v.wennRuhig(function () {
        if (heim !== h) return;
        function ausblenden() {
          var t = G.blende(C.viewer.heimAusblenden);
          el.style.transition = 'opacity ' + t + 'ms linear';
          el.classList.add('heim-raus');
          h.uhr = setTimeout(function () { if (heim === h) { v.lampeAus(); heimAbbrechen(); } }, t + 40);
        }
        var a1 = v.abende[1];
        if (!v.lampe || !a1 || !a1.classList.contains('sichtbar')) { ausblenden(); return; }
        // evening mode: the evening move ended on the evening still. The tile holds the same evening image under the
        // viewer, the viewer fades into it and at the same time the tile's light goes out softly (lamp switch, ~1 s).
        var ab = abendHalten(kachel);
        if (ab) { abendAus(ab); ausblenden(); return; }
        // (the tile's evening image is not there: the light goes out inside the viewer first, then it fades out)
        a1.classList.remove('sichtbar');
        h.uhr = setTimeout(function () { if (heim === h) ausblenden(); }, G.blende(C.viewer.lampe) + 30);
      });
    };
  }

  function sichtbar(r) { return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; }
  /** Current scale of an element's transform (e.g. the tile's hover zoom, also in the middle of its transition). */
  function skala(el) {
    var t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 1;
    var m = t.match(/matrix\(([^,]+),\s*([^,]+)/);
    return m ? Math.sqrt(parseFloat(m[1]) * parseFloat(m[1]) + parseFloat(m[2]) * parseFloat(m[2])) : 1;
  }
  function deckkraft(el) { return el ? parseFloat(getComputedStyle(el).opacity) || 0 : 0; }
  /** Resolves when a placeholder shows its real image (or right away if none is coming). */
  function geladen(ph) {
    if (!ph || !ph.classList.contains('ph-folgt') || ph.classList.contains('echt')) return Promise.resolve();
    return new Promise(function (ok) {
      var j = ph.laden(100);
      if (!j) { ok(); return; }
      j.dann(function (gut) {
        if (!gut) { ok(); return; }
        var img = ph.querySelector('.ph-bild');
        if (img && img.complete && img.naturalWidth) { setTimeout(ok, 30); return; }
        var t = setInterval(function () { if (ph.classList.contains('echt')) { clearInterval(t); setTimeout(ok, 30); } }, 30);
      });
    });
  }
  /** What a tile shows right now (read at the click, before the page changes). */
  function kachelZustand(kachel) {
    var tag = kachel.querySelector('.k-tag'), ab = kachel.querySelector('.k-abend');
    return { skala: skala(tag), abend: ab && ab.classList.contains('echt') ? deckkraft(ab) : 0 };
  }

  /* ---------- show a route ---------- */
  function anzeigen(pfad, r, info) {
    var vorher = route;
    route = r;
    var body = document.body;
    var istStart = r.seite === 'start';

    // capture the viewer before the page changes (for the way back into the tile)
    var zurueckFlug = null;
    if (vorher && (vorher.seite === 'produkt') && r.seite === 'products' && G.modus === 'voll') {
      var vEl = G.seiteProdukt.viewerEl();
      if (vEl && vEl.closest('.p-buehne')) { var vr = vEl.getBoundingClientRect(); if (sichtbar(vr)) zurueckFlug = { r: vr, produkt: vorher.produkt, v: G.seiteProdukt.viewerObj() }; }
    }

    body.classList.toggle('ist-start', istStart);
    if (G.LEISTE) {
      // coming from the start screen the tools fold out once the fields have arrived in the bar
      G.leiste.render(r, { sofort: !!info.erstesMal && !istStart, erst: !!info.erstesMal && istStart });
    } else {
      body.classList.toggle('baum-an', !istStart);
      body.classList.toggle('baum-schmal', r.seite === 'gallery' || r.seite === 'customize');
      G.baum.render(r, { sofort: !!info.erstesMal });
    }

    if (istStart) G.start.zeigen(info.erstesMal ? 'erst' : 'zurueck');
    else if (info.erstesMal) G.start.verbergen(true);
    else if (!info.vonStart && vorher && vorher.seite === 'start') G.start.verbergen();

    // opened from a tile: the viewer starts on exactly the picture the tile showed (view 1, day or evening)
    var vonKachel = info.quelle && r.seite === 'produkt' && r.produkt;
    if (vonKachel) G.viewerFuer(r.produkt).zuruecksetzen((info.kachel || {}).abend > 0.5);

    var ziel = SEITEN[r.seite] ? SEITEN[r.seite]() : null;
    info.vorher = vorher;
    ALLE().forEach(function (m) { if (m !== ziel) m.verbergen(); });
    if (ziel) ziel.zeigen(r, info);
    // the product is opened again while its viewer is still on its way home in the tile: take it back at once
    if (heim && r.produkt && heim.v.p === r.produkt) heimAbbrechen();
    G.nav.extrasAktualisieren();   // views / lamp need the page's viewer

    // tile → viewer: the tile zooms seamlessly up into the centred product image (same image, no jump)
    if (vonKachel && G.modus === 'voll') {
      var q = info.quelle, kz = info.kachel || kachelZustand(q);
      var vw = G.viewerFuer(r.produkt);
      var r0 = q.getBoundingClientRect();
      if (sichtbar(r0)) {
        // the tile shows the 4:3 crop; the window opens sideways onto the full, shifted picture. The tile image sits on its
        // crop; once the full still is there, it flies on top (sharp at full size, and it fills the sides as they open)
        var p = r.produkt, ka = vw.kachelAnteil, mitte = (ka.x + ka.w / 2) * 100 + '% ' + (ka.y + ka.h / 2) * 100 + '%';
        var zoom = { transform: 'scale(' + kz.skala + ')' };
        // the tile image is the whole wide picture (kachelVoll): it is placed so that its 4:3 crop lies exactly on the
        // tile crop of the picture the viewer shows – wide: it fills the opening window at once, sides included;
        // portrait (phone upright): it fills the tile part, above and below the small portrait copy comes in
        var kw = p.kachelVoll ? (p.kachelAusschnitt || G.anzeige(p).kachel) : null, kbox = ka, kursprung = null;
        if (kw) {
          var bw = ka.w / kw.w, bh = ka.h / kw.h;
          kbox = { x: ka.x - kw.x * bw, y: ka.y - kw.y * bh, w: bw, h: bh };
          kursprung = (kw.x + kw.w / 2) * 100 + '% ' + (kw.y + kw.h / 2) * 100 + '%';
        }
        var voll = !!kw || vw.format === 'hoch';       // the viewer itself shows a small copy until its still has loaded
        var schichten = [{ el: q.querySelector('.k-tag'), box: kbox, ursprung: kursprung, von: zoom, nach: {} }];
        var gs = vw.stills[1];
        // view 1 of the viewer: the big still if it is there, else its small copy (background, see Viewer.vorschau)
        if (gs && (gs.classList.contains('echt') || gs.classList.contains('mit-vorschau'))) schichten.push({ el: gs, ursprung: mitte, durchsichtig: true, von: zoom, nach: {} });
        var ab = q.querySelector('.k-abend'), ga = vw.abende[1];
        if (ab && kz.abend > 0.01) {
          var abNach = { opacity: kz.abend > 0.5 ? 1 : 0 };
          schichten.push({ el: ab, box: kbox, ursprung: kursprung, von: { opacity: kz.abend }, nach: abNach });
          if (ga && (ga.classList.contains('echt') || ga.classList.contains('mit-vorschau'))) schichten.push({ el: ga, durchsichtig: true, von: { opacity: kz.abend }, nach: abNach });
        }
        flug({ auf: true, klein: r0, gross: vw.el.getBoundingClientRect(), radiusKlein: radiusVon(q), radiusGross: radiusVon(vw.el), aus: ka, maske: vw.maskeWerte,
          schichten: schichten, verstecken: [vw.el, q], dauer: C.seite.kachelZumViewer,
          // (whole-picture tile image: the viewer itself shows it under the still until that has loaded – no waiting)
          bereit: voll ? null : Promise.all([geladen(vw.stills[1]), kz.abend > 0.5 ? geladen(vw.abende[1]) : null]) });
      }
    }
    // viewer → tile (going back to the wall): the real viewer shrinks into the tile, a move back to view 1 plays on
    if (zurueckFlug) {
      var kachel = G.seiteProdukte.kachelFuer(zurueckFlug.produkt.id);
      if (kachel) {
        var kr = kachel.getBoundingClientRect();
        if (!sichtbar(kr) && kachel.scrollIntoView) { kachel.scrollIntoView({ block: 'center' }); kr = kachel.getBoundingClientRect(); }
        if (sichtbar(kr)) heimfahren(zurueckFlug.v || G.viewerFuer(zurueckFlug.produkt), zurueckFlug.r, kachel);
      }
    }
    document.title = titel(r);
  }

  function titel(r) {
    if (r.seite === 'start') return 'gauge';
    var t = G.bereichName(r.seite);
    if (r.produkt) t = r.produkt.code + ({ customize: ' · Customize', order: ' · To Order', payment: ' · Payment' }[r.seite] || '');
    return t + ' – gauge';
  }

  /* ---------- the interface the tree and pages talk to ---------- */
  G.app = {
    route: function () { return route; },
    vorschau: function (v) {
      if (!route) return;
      if (route.seite === 'products') G.seiteProdukte.vorschau(v);
      if (v && v.produkt && C.vorladen.beimHover) { var p = G.produkt(v.produkt); if (p) G.viewerFuer(p).vorladen('hover'); }
    },
    sortierungGeaendert: function () { G.seiteProdukte.neu(); G.nav.neuZeichnen(); G.nav.extrasAktualisieren(); },
    /** Viewer changed (view reached, lamp switched) – refresh the tools that show its state. */
    viewerGeaendert: function () { G.nav.extrasAktualisieren(); },
    viewerInfo: function () { return G.seiteProdukt.info(); },
    viewWaehlen: function (i) { var v = G.seiteProdukt.viewer(); if (v) v.waehlen(i); },
    lampeSchalten: function () { var v = G.seiteProdukt.viewer(); if (v) v.lampeSchalten(); },
    parameterGeaendert: function () { G.seiteProdukt.parameterGeaendert(); },
    produktOeffnen: function (p, kachel) {
      if (kachel) G.welle.sofort(kachel.querySelector('.k-tag'));
      var info = kachel ? { quelle: kachel, kachel: kachelZustand(kachel) } : {};
      if (G.LEISTE) { G.router.geh('products/' + p.id, info); return; }
      var kat = route && route.kategorie ? route.kategorie : p.kategorie;
      G.router.geh('products/' + kat + '/' + p.id, info);
    },
    andockZiel: function () {
      if (!route) return null;
      var m = SEITEN[route.seite] ? SEITEN[route.seite]() : null;
      return m && m.andock ? m.andock() : null;
    },
    proFrame: function (stammX) { if (G.seiteProdukte.fuge) G.seiteProdukte.fuge(stammX); },
    /** During the start screen: tiles and start images first, then the first moves in the background. */
    /** Start screen (loading bar): what must be there before the symbols appear – all tile images and the gallery
        photos of the first screen (the gallery is laid out invisibly for that). Promises. */
    startBilder: function () {
      if (!C.vorladen.startbilder) return [];
      var kacheln = G.seiteProdukte.startBilder();
      // the tiles first (small files, they decide the first click), the gallery photos right after
      var nachKacheln = Promise.race([Promise.all(kacheln), G.warte(1500)]);
      return kacheln.concat(G.seiteGalerie.vorbereiten(nachKacheln));
    },
    /** After the loading phase (or for a deep link): the big stills, then the camera moves in the background. */
    startVorladen: function () {
      if (!C.vorladen.startbilder || startVorgeladen) return;
      startVorgeladen = true;
      var echte = G.produkte.filter(function (p) { return !p.dummy; });
      echte.forEach(function (p) { G.viewerFuer(p).vorladen('start'); });
      if (C.vorladen.ersteFahrten) echte.forEach(function (p) { G.viewerFuer(p).vorladen('fahrten'); });
    }
  };

  /* ---------- swipe right = back (phone) ---------- */
  function wischen() {
    var t0 = null, letzteNavigation = 0;
    // if the browser itself already went back (iOS edge swipe, Chrome overscroll), don't go back a second time
    window.addEventListener('popstate', function () { letzteNavigation = Date.now(); });
    document.addEventListener('touchstart', function (e) {
      t0 = null;
      if (e.touches.length !== 1 || !G.istHandy() || !route || route.seite === 'start') return;
      if (G.lightbox.offen()) return;
      var z = e.target;
      if (z.closest && (z.closest('.pfadleiste') || z.closest('.astfeld') || z.closest('.glas') || z.closest('.glas-oben') || z.closest('.g-optionen') || z.closest('input'))) return;
      if (e.touches[0].clientX < 20) return;   // the left edge belongs to the system's own back gesture
      t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!t0) return;
      var s = t0;
      var t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y, dt = Date.now() - s.t;
      t0 = null;
      if (dx > C.handy.wischenMin && Math.abs(dy) < dx * 0.6 && dt < 900) {
        setTimeout(function () { if (letzteNavigation < s.t) G.router.zurueck(); }, 200);
      }
    }, { passive: true });
  }

  /* ---------- start ---------- */
  function init() {
    G.nav = G.LEISTE ? G.leiste : G.baum;
    G.nav.init();
    G.seiteProdukte.init();
    G.seiteProdukt.init();
    G.seiteGalerie.init();
    G.seiteAbout.init();
    G.seiteBespoke.init();
    G.lightbox.init();
    G.start.init();
    wischen();
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') G.nav.feldZu(); });
    G.router.start(anzeigen);
    // a direct link skipped the start screen – preload anyway
    if (route && route.seite !== 'start') setTimeout(G.app.startVorladen, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
