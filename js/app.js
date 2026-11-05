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
  var GANZ = { x: 0, y: 0, w: 1, h: 1 };
  /** Numbers of a window: scale s and translation (tx, ty) that show the screen rect rk as the part aus (shares) of a
      picture laid out at rg, and the clip (insets l, t, r, b in px of rg). Without aus: the whole picture (cover crop). */
  function fensterWerte(rk, rg, aus) {
    var a = aus || GANZ;
    var rx = a.x * rg.width, ry = a.y * rg.height, rw = a.w * rg.width, rh = a.h * rg.height;
    var s = Math.max(rk.width / rw, rk.height / rh);
    var w = rk.width / s, h = rk.height / s, ix = rx + (rw - w) / 2, iy = ry + (rh - h) / 2;
    return { tx: rk.left - rg.left - s * ix, ty: rk.top - rg.top - s * iy, s: s, l: ix, t: iy, r: rg.width - ix - w, b: rg.height - iy - h };
  }
  /** Where the whole tile image (the wide picture, kachelVoll) lies, in shares of the viewer, so that its 4:3 crop sits
      exactly on the tile crop ka of the picture the viewer shows (wide: inside it; portrait: reaching out to the sides). */
  function kachelBox(p, ka) {
    var kw = p.kachelVoll ? (p.kachelAusschnitt || G.anzeige(p).kachel) : null;
    if (!kw) return null;
    var bw = ka.w / kw.w, bh = ka.h / kw.h;
    return { x: ka.x - kw.x * bw, y: ka.y - kw.y * bh, w: bw, h: bh, kw: kw };
  }
  /** Keyframes of the window between the tile (o.klein, its crop o.aus) and the viewer (o.gross). */
  function fensterFrames(o) {
    var Rw = o.gross.width, Rh = o.gross.height;
    function stil(f, c, radius) {
      return { transform: 'translate(' + f.tx + 'px,' + f.ty + 'px) scale(' + f.s + ')',
        clipPath: 'inset(' + c.t + 'px ' + c.r + 'px ' + c.b + 'px ' + c.l + 'px round ' + (radius / f.s) + 'px)' };
    }
    var fk = fensterWerte(o.klein, o.gross, o.aus || GANZ), fg = { tx: 0, ty: 0, s: 1 };
    var K = stil(fk, fk, o.radiusKlein || 0), Gr = stil(fg, { l: 0, t: 0, r: 0, b: 0 }, o.radiusGross || 0);
    return o.auf ? [K, Gr] : [Gr, K];
  }

  /* ---------- phone upright: phone tile ↔ portrait picture ----------
     The phone tile is a full-width crop of the portrait Cam1 picture (handyAusschnitt, the same crop for all products).
     So the zoom shows ONE picture all the way, nothing is swapped: a frame (k), laid out at the size of the viewer,
     holds the picture – opening: the small copy of the whole portrait picture and on it the tile image exactly on its
     crop (the same pixels, so the first frame IS the tile), for a lamp their evening versions; way back: the real
     viewer itself. The frame moves and scales (transform, uniform), and its clip (clip-path inset, in the frame's own
     coordinates) opens from the tile crop to the whole picture – the window on screen grows in a straight line from
     the tile to the viewer, the picture with it.
     Why nothing can uncover: the clip only ever cuts the picture that fills the frame – if clip and transform run
     apart for a frame (iPhone: clip-path is not animated on the GPU), it shows a little more or less of the same
     picture, never the page; left and right the picture edges ARE the window edges (full-width crop, insets 0).
     The full-size still comes only afterwards: once it is decoded in the viewer under the frame, the frame fades out.
     o: auf, T (tile rect), V (viewer rect), ka (the crop, shares of the picture), radiusKlein, radiusGross, dauer,
        skala (the tile's hover zoom), schichten: [{ el, box (shares; null = whole picture), von, nach (opacity) }],
        selbst: the real viewer (way back), bereit: Promise before the zoom may start (copies decoded) */
  var HANDY_SCHRITTE = 24;    // keyframes (the clip in the frame's coordinates is not linear in the zoom)
  function zahl(v) { return Math.round(v * 10000) / 10000; }
  function handyFrames(T, V, ka, rK, rG, auf) {
    var s0 = T.width / (ka.w * V.width), fr = [];
    var l0 = T.left - s0 * ka.x * V.width, t0 = T.top - s0 * ka.y * V.height;    // where the whole picture lies at the tile
    for (var i = 0; i <= HANDY_SCHRITTE; i++) {
      var z = i / HANDY_SCHRITTE, s = s0 + (1 - s0) * z;                         // z: 0 = tile, 1 = whole picture
      var il = l0 + (V.left - l0) * z, it = t0 + (V.top - t0) * z;               // the picture …
      var wl = T.left + (V.left - T.left) * z, wt = T.top + (V.top - T.top) * z, // … and the window on screen
        wr = T.right + (V.right - T.right) * z, wb = T.bottom + (V.bottom - T.bottom) * z;
      var c = [(wt - it) / s, (il + s * V.width - wr) / s, (it + s * V.height - wb) / s, (wl - il) / s]
        .map(function (x) { return Math.max(0, zahl(x)); });
      var r = (rK + (rG - rK) * z) / s;
      fr.push({ offset: auf ? z : 1 - z,
        transform: 'translate(' + zahl(il - V.left) + 'px,' + zahl(it - V.top) + 'px) scale(' + Math.round(s * 1e6) / 1e6 + ')',
        clipPath: 'inset(' + c[0] + 'px ' + c[1] + 'px ' + c[2] + 'px ' + c[3] + 'px round ' + zahl(r) + 'px)' });
    }
    return auf ? fr : fr.reverse();
  }
  function handyFlug(o) {
    if (!document.body.animate) return null;
    var V = o.V, ka = o.ka, skala = o.skala || 1;
    var k = G.el('div', 'flug flug-handy'), inhalt = G.el('div', 'flug-inhalt');
    k.style.left = V.left + 'px'; k.style.top = V.top + 'px';
    k.style.width = V.width + 'px'; k.style.height = V.height + 'px';
    k.appendChild(inhalt);
    var schichten = (o.schichten || []).filter(function (s) { return s.el; });
    schichten.forEach(function (s) {
      var c = s.el;
      c.style.transition = 'none';
      if (s.box) setzeBox(c, s.box);
      if (s.von != null) c.style.opacity = s.von;
      inhalt.appendChild(c);
    });
    if (o.selbst) inhalt.appendChild(o.selbst);       // (moved synchronously – a running video keeps playing)
    var frames = handyFrames(o.T, V, ka, o.radiusKlein || 0, o.radiusGross || 0, o.auf);
    // the first frame at once: the frame lies exactly over the tile (or the viewer) until the zoom starts
    k.style.transform = frames[0].transform;
    k.style.clipPath = frames[0].clipPath;
    var zoom = skala !== 1 ? [{ transform: 'scale(' + skala + ')' }, { transform: 'none' }] : null;
    if (zoom) {
      inhalt.style.transformOrigin = '50% ' + (ka.y + ka.h / 2) * 100 + '%';      // around the tile centre
      if (!o.auf) zoom.reverse();
      inhalt.style.transform = zoom[0].transform;
    }
    document.body.appendChild(k);
    var anims = [], ende;
    var fertig = new Promise(function (ok) { ende = ok; });
    function los() {
      if (!k.parentNode) { ende(); return; }
      var opts = { duration: o.dauer, easing: C.kurve, fill: 'both' };
      // all in the same task: they start on the same frame (clip and transform in ONE effect)
      var a = k.animate(frames, opts);
      a.onfinish = ende; a.oncancel = ende;
      anims.push(a);
      schichten.forEach(function (s) {
        if (s.von != null && s.nach != null && s.von !== s.nach) anims.push(s.el.animate([{ opacity: s.von }, { opacity: s.nach }], opts));
      });
      if (zoom) anims.push(inhalt.animate(zoom, opts));
    }
    // the copies under the tile image must be decoded before the window opens (else grey would show around the tile).
    // Normally they are preloaded with the tiles and this is at once; on a slow net the frame (= the tile) waits.
    if (o.bereit) Promise.race([o.bereit, G.warte(C.seite.hochWarten || 2500)]).then(los); else los();
    var blende = G.blende(C.seite.hochBlende == null ? 200 : C.seite.hochBlende);
    /** Opening, at the end: the frame fades out over the real viewer (which must be visible under it by then). */
    function ausblenden() {
      if (!k.parentNode) return Promise.resolve();
      var a = k.animate([{ opacity: 1 }, { opacity: 0 }], { duration: blende, easing: C.kurve, fill: 'forwards' });
      anims.push(a);
      return new Promise(function (ok) { a.onfinish = ok; a.oncancel = ok; });
    }
    return { k: k, anims: anims, fertig: fertig, ausblenden: ausblenden };
  }
  /** A copy of a tile image (placeholder with its loaded img) for the flight – never a grey of its own. */
  function klon(el) {
    var c = el.cloneNode(true);
    c.classList.remove('sichtbar', 'raus', 'rein', 'vor-fahrt', 'vor-aufstieg', 'nachglimmen', 'ausglimmen');
    c.style.backgroundColor = 'transparent';
    return c;
  }
  /** A decoded copy of a picture file (the whole portrait picture, small) – resolves once it can be painted. */
  function kopieBild(url, liste) {
    if (!url || !C.echteDateienVerwenden) return null;
    var c = new Image();
    c.alt = ''; c.className = 'flug-hochbild'; c.src = url;
    liste.push(c.decode ? c.decode().then(null, function () {}) : Promise.resolve());
    return c;
  }
  /** Resolves once the still of a placeholder shows: loaded, decoded and faded in inside the viewer (or right away if
      no real image is coming). (The caller limits the wait – config seite.hochWarten.) */
  function dekodiert(ph) {
    return geladen(ph).then(function () {
      if (!ph || !ph.classList.contains('ph-folgt')) return null;
      return new Promise(function (ok) {
        var img = ph.querySelector('.ph-bild'), n = 0;
        (function pruefe() {
          if (ph.classList.contains('echt') && img && parseFloat(getComputedStyle(img).opacity) >= 0.99) {
            if (img.decode) img.decode().then(ok, ok); else ok();
            return;
          }
          if (++n > 200) { ok(); return; }      // (~6 s – the caller has given up long before)
          setTimeout(pruefe, 30);
        })();
      });
    });
  }
  function radiusVon(el) { return el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 : 0; }
  function setzeBox(el, k) {
    el.style.inset = 'auto';
    el.style.left = k.x * 100 + '%'; el.style.top = k.y * 100 + '%';
    el.style.width = k.w * 100 + '%'; el.style.height = k.h * 100 + '%';
  }
  /** Takes a flight away at once (and shows what it hid again). */
  function flugWeg() {
    var k = flugEl;
    if (!k) return;
    flugEl = null;
    if (k._zeigen) k._zeigen();
    if (k.parentNode) k.parentNode.removeChild(k);
  }
  function flug(o) {
    if (flugEl && flugEl.parentNode) flugEl.parentNode.removeChild(flugEl);
    var r1 = o.gross;
    var anims = [], k;
    var opts = { duration: o.dauer, easing: C.kurve, fill: 'forwards' };
    var weiter;
    if (o.hoch) {        // phone upright: the phone tile opens into the portrait picture (handyFlug)
      var hf = handyFlug(o.hoch);
      if (!hf) return Promise.resolve();
      k = hf.k;
      k._zeigen = function () { o.verstecken.forEach(function (e) { e.style.visibility = ''; }); };
      // the zoom has reached the whole portrait picture: as soon as its full still is decoded (the small copy stays until
      // then), the real viewer comes under the flight and the flight fades out over it
      weiter = hf.fertig.then(function () {
        return Promise.race([o.hoch.fertigBereit || null, G.warte(C.seite.hochWarten || 2500)]);
      }).then(function () {
        if (flugEl !== k) return null;
        o.verstecken.forEach(function (e) { e.style.visibility = ''; });
        return hf.ausblenden();
      });
    } else {
      k = G.el('div', 'flug');
      k.style.left = r1.left + 'px';
      k.style.top = r1.top + 'px';
      k.style.width = r1.width + 'px';
      k.style.height = r1.height + 'px';
      var frames = fensterFrames(o);
      var mitMaske = !!(o.maske && (o.maske.l > 0 || o.maske.r > 0 || o.maske.t > 0 || o.maske.b > 0));
      o.schichten.forEach(function (s) {
        var c = s.el.cloneNode(true);
        c.classList.remove('sichtbar', 'raus', 'rein', 'vor-fahrt', 'vor-aufstieg');
        c.style.transform = s.von.transform || 'none';
        c.style.opacity = s.von.opacity == null ? 1 : s.von.opacity;
        c.style.transition = 'none';
        if (s.box) setzeBox(c, s.box);              // a whole tile image: sits exactly on the tile crop of the picture
        if (s.ursprung) c.style.transformOrigin = s.ursprung;
        if (s.durchsichtig) c.style.backgroundColor = 'transparent';   // a small copy still decoding: the layer below shows
        k.appendChild(c);
        var a = { transform: s.von.transform || 'none', opacity: c.style.opacity }, b = { transform: s.nach.transform || 'none', opacity: s.nach.opacity == null ? 1 : s.nach.opacity };
        if (a.transform !== b.transform || String(a.opacity) !== String(b.opacity)) anims.push({ el: c, frames: [a, b] });
      });
      if (mitMaske) {      // the soft edges of the picture (ultrawide) grow while the window opens
        k.classList.add('maske'); ['l', 'r', 't', 'b'].forEach(function (s) { k.style.setProperty('--m' + s, '0px'); });
      }
      document.body.appendChild(k);
      if (mitMaske) {
        void k.offsetWidth;
        k.style.transition = ['l', 'r', 't', 'b'].map(function (s) { return '--m' + s + ' ' + o.dauer + 'ms ' + C.kurve; }).join(', ');
        ['l', 'r', 't', 'b'].forEach(function (s) { k.style.setProperty('--m' + s, Math.round(o.maske[s]) + 'px'); });
      }
    }
    flugEl = k;
    o.verstecken.forEach(function (e) { e.style.visibility = 'hidden'; });
    anims.forEach(function (x) { G.animiere(x.el, x.frames, opts); });
    if (!weiter) weiter = G.animiere(k, frames, { duration: o.dauer, easing: C.kurve, fill: 'forwards' });
    var bereit = o.bereit || Promise.resolve();
    return weiter.then(function () {
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
  function boxWeg(el) { ['position', 'inset', 'left', 'top', 'width', 'height', 'transformOrigin'].forEach(function (k) { el.style[k] = ''; }); }
  function heimAbbrechen() {
    if (!heim) return;
    var h = heim;
    heim = null;
    clearTimeout(h.uhr);
    // interrupted while the viewer over the tile still shows the evening (move running, or still): the tile holds the
    // evening image and lets the light go out softly instead of jumping to day when the viewer leaves
    if (h.kachel && h.v.lampe) abendAus(abendHalten(h.kachel));
    if (h.anim) { try { h.anim.cancel(); } catch (e) {} }
    if (h.zug) { try { h.zug.cancel(); } catch (e) {} }
    if (h.anims) h.anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    var el = h.v.el;
    el.classList.remove('in-kachel', 'heim-raus');
    el.style.transition = '';
    boxWeg(el);
    h.v.kachelLegen();
    G.seiteProdukt.viewerHolen(h.v);            // back onto the stage (or out of the page, if another product is shown)
    if (h.k && h.k.parentNode) h.k.parentNode.removeChild(h.k);
  }
  /* Phone upright (the tile shows the phone tile, a crop of the portrait picture): the real viewer itself closes into
     the tile – the opening backwards (handyFlug, nothing swapped). From another view than 1, first the move back to
     view 1 plays in the full portrait picture (the viewer stays on the whole screen, above the wall), THEN the same
     closing. In the tile the viewer fades into the tile's identical image (evening: the tile holds its evening image,
     then the light goes out softly). */
  function heimfahren(v, gross, kachel) {
    heimAbbrechen();
    // (phone upright: the opening may still wait for the portrait still – the way back takes over at once)
    if (flugEl && flugEl.classList.contains('flug-handy')) flugWeg();
    var el = v.el, h = heim = { v: v, kachel: kachel };
    var radiusGross = radiusVon(el);
    v.heim();
    v.maske(null);       // soft edges (ultrawide) grow back to the hard picture edge while it shrinks into the tile
    var ka = v.kachelAnteil;
    var fahrt = v.belegt || v.aktuell !== 1;
    v.kachelLegen();
    var dauer = C.seite.kachelZumViewer * 0.85;
    if (v.format === 'hoch' && kachel.dataset.format === 'hoch' && document.body.animate) {
      h.handy = true;
      var zusammenziehen = function () {
        if (heim !== h) return;
        var halter = h.k;
        var hf = handyFlug({ auf: false, T: kachel.getBoundingClientRect(), V: gross, ka: ka,
          radiusKlein: radiusVon(kachel), radiusGross: radiusGross, dauer: dauer, selbst: el });
        if (halter && halter.parentNode) halter.parentNode.removeChild(halter);
        h.k = hf.k; h.anims = hf.anims;
        hf.fertig.then(function () { if (heim === h && h.k === hf.k) inKachel(); });
      };
      if (!fahrt) { zusammenziehen(); return; }
      // the move back to view 1 first: the viewer holds the whole screen meanwhile (over the wall, under the bar)
      var halter = h.k = G.el('div', 'flug flug-handy');
      halter.style.left = gross.left + 'px'; halter.style.top = gross.top + 'px';
      halter.style.width = gross.width + 'px'; halter.style.height = gross.height + 'px';
      var innen = G.el('div', 'flug-inhalt');
      halter.appendChild(innen);
      innen.appendChild(el);                       // moved synchronously – the move keeps playing
      document.body.appendChild(halter);
      v.wennRuhig(zusammenziehen);
      return;
    }
    var k = h.k = G.el('div', 'flug flug-echt');
    k.style.left = gross.left + 'px';
    k.style.top = gross.top + 'px';
    k.style.width = gross.width + 'px';
    k.style.height = gross.height + 'px';
    var frames = fensterFrames({ auf: false, klein: kachel.getBoundingClientRect(), gross: gross,
      aus: ka, radiusKlein: radiusVon(kachel), radiusGross: radiusGross });    // ends on the 4:3 tile crop
    var opts = { duration: dauer, easing: C.kurve, fill: 'forwards' };
    k.appendChild(el);                           // moved synchronously – a running video keeps playing
    document.body.appendChild(k);
    h.anim = k.animate(frames, opts);
    h.anim.onfinish = inKachel;
    /** The flight has reached the tile: the viewer goes into the tile (a move plays on there), then fades out. */
    function inKachel() {
      if (heim !== h) return;
      boxWeg(el);
      kachel.appendChild(el);                    // from now on it scrolls with the tile
      el.classList.add('in-kachel');
      h.anim = null; h.anims = null;
      if (h.k && h.k.parentNode) h.k.parentNode.removeChild(h.k);
      h.k = null;
      v.wennRuhig(weiter);
    }
    function weiter() {
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
    }
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
    // (phone upright: the viewer may still hold the whole screen for its move back – any other page takes over at once)
    if (heim && heim.handy && r.seite !== 'products') heimAbbrechen();
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
        // tile crop of the picture the viewer shows – it fills the opening window at once, sides included
        var kb = kachelBox(p, ka), kw = kb ? kb.kw : null, kbox = kb || ka, kursprung = null;
        if (kw) kursprung = (kw.x + kw.w / 2) * 100 + '% ' + (kw.y + kw.h / 2) * 100 + '%';
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
        // phone upright: the phone tile is a crop of the portrait picture – the zoom only opens that crop (handyFlug)
        var hoch = null;
        if (vw.format === 'hoch' && q.dataset.format === 'hoch') {
          var lit = kz.abend > 0.5, dekoder = [], hs = [];
          hs.push({ el: kopieBild(G.pfade.kachel(p, 'hoch'), dekoder) });               // the whole picture, small
          hs.push({ el: klon(q.querySelector('.k-tag')), box: ka });                    // the tile image on its crop
          if (ab && kz.abend > 0.01) {
            hs.push({ el: kopieBild(G.pfade.kachelAbend(p, 'hoch'), dekoder), von: kz.abend, nach: lit ? 1 : 0 });
            hs.push({ el: klon(ab), box: ka, von: kz.abend, nach: lit ? 1 : 0 });
          }
          hoch = { auf: true, T: r0, V: vw.el.getBoundingClientRect(), ka: ka, skala: kz.skala,
            radiusKlein: radiusVon(q), radiusGross: radiusVon(vw.el), dauer: C.seite.kachelZumViewer, schichten: hs,
            bereit: Promise.all(dekoder),
            // (flug: the full still decoded in the viewer, then the flight fades out over it)
            fertigBereit: Promise.all([dekodiert(gs), lit ? dekodiert(ga) : null]) };
        }
        flug({ auf: true, klein: r0, gross: vw.el.getBoundingClientRect(), radiusKlein: radiusVon(q), radiusGross: radiusVon(vw.el), aus: ka, maske: vw.maskeWerte,
          hoch: hoch, schichten: schichten, verstecken: [vw.el, q], dauer: C.seite.kachelZumViewer,
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
