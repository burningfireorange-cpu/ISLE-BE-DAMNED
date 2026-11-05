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

  /* ---------- phone upright: tile ↔ portrait picture ----------
     Cam1 has a longer focal length upright, so the tile (a crop of the WIDE picture) reaches out beyond the sides of
     the portrait picture (kachel_breit). Opening, in two steps that follow each other:
       1. zoom – the WIDE tile image zooms from the tile until its tile crop lies exactly where it lies in the portrait
          picture (kachel_breit); the window grows from the tile to the whole viewer at the same time. Nothing else
          changes during the zoom.
       2. blend – only then (and once the portrait still has loaded and is decoded) the whole flight fades out over the
          real viewer (config seite.hochBlende). Both lie on top of each other pixel for pixel.
     Way back: the same backwards – first the real viewer fades into the tile composition, then it zooms out.
     The wide tile image covers only a band of the portrait picture (12:5 in 1:2) – what lies around it, all the way:
       · above and below the band, as wide as the wide tile image: its upper and lower edge (wall / floor, HOCH_KANTE)
         mirrored outwards – seamless at the edge, and so tall that it reaches far beyond the window (HOCH_RESERVE);
       · on that, within the portrait picture: the small copy of the portrait picture on its final place (it matches the
         tile image in the band pixel for pixel, so above and below the band the real wall and floor continue it).
     So inside the window there is picture everywhere – and with a big reserve, so a frame that comes late on the
     iPhone (window and layers running apart) only shifts the picture a little, it never uncovers anything.
     Only transforms and opacity are animated, the window's corner radius on its own element (fensterRadius).
     o: auf, T (tile rect), V (viewer rect), ka (tile crop in shares of the viewer), kb (whole tile image, kachelBox),
        skala (tile hover zoom), radiusKlein, radiusGross, dauer,
        unter: [{ el, kachel, voll }] wide tile images (cloned; opacity at the tile / at the full picture),
        hoch: [{ url, kachel, voll }] small copies of the portrait picture (day / evening),
        selbst: the real viewer (way back: lies on top and fades out first) */
  var HOCH_SCHRITTE = 40;     // keyframes (the counter-scale is not linear – enough steps keep it sub-pixel exact)
  var HOCH_KANTE = 0.06;      // share of the wide tile image at its upper / lower edge that is mirrored outwards
  var HOCH_RESERVE = 0.3;     // the picture reaches beyond the window by this share of the window height (+ 24 px)
  var HOCH_UEBERLAPP = 3;     // image rows by which a mirrored edge reaches in under the band
  function hochFlug(o) {
    if (!document.body.animate) return null;
    var T = o.T, V = o.V, ka = o.ka, kb = o.kb, N = HOCH_SCHRITTE, i;
    var f0 = fensterWerte(T, V, ka);
    var mx = ka.x + ka.w / 2, my = ka.y + ka.h / 2, skala = o.skala || 1;
    var rK = o.radiusKlein || 0, rG = o.radiusGross || 0;
    var stand = [];
    for (i = 0; i <= N; i++) {
      var z = i / N, s = f0.s + (1 - f0.s) * z;                       // z: 0 = tile, 1 = full picture
      var P = { l: V.left + f0.tx * (1 - z), t: V.top + f0.ty * (1 - z), w: s * V.width, h: s * V.height };
      var Wn = { l: T.left + (V.left - T.left) * z, t: T.top + (V.top - T.top) * z,
        w: T.width + (V.width - T.width) * z, h: T.height + (V.height - T.height) * z };
      // the tile's hover zoom (if any) goes back to 1 around the tile centre on the way
      var cx = P.l + mx * P.w, cy = P.t + my * P.h, f1 = skala + (1 - skala) * z;
      var um = function (R) { return { l: cx + f1 * (R.l - cx), t: cy + f1 * (R.t - cy), w: f1 * R.w, h: f1 * R.h }; };
      var A = um({ l: P.l + kb.x * P.w, t: P.t + kb.y * P.h, w: kb.w * P.w, h: kb.h * P.h });   // tile image on its crop
      var res = 24 + HOCH_RESERVE * Wn.h;
      var fo = Math.max(1, (A.t - Wn.t + res) / (HOCH_KANTE * A.h)), fu = Math.max(1, (Wn.t + Wn.h + res - A.t - A.h) / (HOCH_KANTE * A.h));
      stand.push({ z: z, P: um(P), Wn: Wn, A: A, fo: fo, fu: fu });
    }
    /** The mirrored edges (R.h < 0). Their axis lies HOCH_UEBERLAPP image rows inside the band: the outermost row of a
        strongly magnified image is rasterised half transparent over several px – that stays hidden under the band. */
    function spiegel(st, seite, zeilen) {
      var A = st.A, F = seite === 'oben' ? st.fo : st.fu, ov = HOCH_UEBERLAPP * Math.max(1, F) * A.h / zeilen;
      return seite === 'oben' ? { l: A.l, t: A.t + ov, w: A.w, h: -F * A.h }
        : { l: A.l, t: A.t + A.h - ov + F * A.h, w: A.w, h: -F * A.h };
    }
    function reihe(fn) {
      var fr = stand.map(function (st) { var x = fn(st); x.offset = o.auf ? st.z : 1 - st.z; return x; });
      return o.auf ? fr : fr.reverse();
    }
    function zahl(v) { return Math.round(v * 10000) / 10000; }
    /** transform of a layer laid out at B (px inside the window box) so that it lies at R on screen (R.h < 0: mirrored) */
    function lage(R, B, st) {
      var Sx = st.Wn.w / V.width, Sy = st.Wn.h / V.height;
      return 'translate(' + zahl((R.l - st.Wn.l) / Sx - B.l) + 'px,' + zahl((R.t - st.Wn.t) / Sy - B.t) + 'px) scale(' +
        zahl(R.w / (B.w * Sx)) + ',' + zahl(R.h / (B.h * Sy)) + ')';
    }
    // k: the window (translate + scale, keeps the layers in its own coordinates); f: inside it, the clip with the
    // corner radius (its radius changes on its own element, so k's animation is a pure transform)
    var k = G.el('div', 'flug flug-hoch'), f = G.el('div', 'flug-fenster');
    k.style.left = V.left + 'px'; k.style.top = V.top + 'px';
    k.style.width = V.width + 'px'; k.style.height = V.height + 'px';
    k.appendChild(f);
    var schichten = [];
    var BU = { l: kb.x * V.width, t: kb.y * V.height, w: kb.w * V.width, h: kb.h * V.height }, B0 = { l: 0, t: 0, w: V.width, h: V.height };
    function legen(c, B) {
      c.style.transition = 'none';
      c.style.position = 'absolute';
      c.style.inset = 'auto';
      c.style.left = B.l + 'px'; c.style.top = B.t + 'px'; c.style.width = B.w + 'px'; c.style.height = B.h + 'px';
      c.style.transformOrigin = '0 0';
      f.appendChild(c);
    }
    function klon(el) {
      var c = el.cloneNode(true);
      c.classList.remove('sichtbar', 'raus', 'rein', 'vor-fahrt', 'vor-aufstieg', 'nachglimmen', 'ausglimmen');
      c.style.backgroundColor = 'transparent';      // (never a grey of its own – a layer below shows instead)
      return c;
    }
    function deck(u, st) { return u.kachel + (u.voll - u.kachel) * st.z; }
    // 1. the mirrored edges of the wide tile image (day, evening)
    (o.unter || []).forEach(function (u) {
      if (!u.el) return;
      var im = u.el.querySelector('img'), zeilen = (im && im.naturalHeight) || 600;
      ['oben', 'unten'].forEach(function (seite) {
        var c = klon(u.el);
        legen(c, BU);
        schichten.push({ el: c, frames: reihe(function (st) { return { transform: lage(spiegel(st, seite, zeilen), BU, st), opacity: deck(u, st) }; }) });
      });
    });
    // 2. the small copy of the portrait picture on its place (day, evening)
    (o.hoch || []).forEach(function (h) {
      if (!h.url) return;
      var c = new Image();
      c.alt = ''; c.decoding = 'sync'; c.src = h.url;
      c.className = 'flug-hochbild';
      legen(c, B0);
      schichten.push({ el: c, frames: reihe(function (st) { return { transform: lage(st.P, B0, st), opacity: deck(h, st) }; }) });
    });
    // 3. the wide tile image exactly on its crop (day, evening)
    (o.unter || []).forEach(function (u) {
      if (!u.el) return;
      var c = klon(u.el);
      legen(c, BU);
      schichten.push({ el: c, frames: reihe(function (st) { return { transform: lage(st.A, BU, st), opacity: deck(u, st) }; }) });
    });
    // 4. way back: the real viewer on top (a running video keeps playing) – it fades out before the zoom starts
    if (o.selbst) legen(o.selbst, B0);
    var fenster = reihe(function (st) {
      return { transform: 'translate(' + zahl(st.Wn.l - V.left) + 'px,' + zahl(st.Wn.t - V.top) + 'px) scale(' +
        zahl(st.Wn.w / V.width) + ',' + zahl(st.Wn.h / V.height) + ')' };
    });
    var fensterRadius = reihe(function (st) {
      var Sx = st.Wn.w / V.width, Sy = st.Wn.h / V.height, r = rK + (rG - rK) * st.z;
      return { borderRadius: zahl(r / Sx) + 'px / ' + zahl(r / Sy) + 'px' };
    });
    document.body.appendChild(k);
    var blende = G.blende(C.seite.hochBlende == null ? 200 : C.seite.hochBlende);
    var vorher = o.auf ? 0 : blende;      // way back: the zoom waits for the viewer's fade
    var opts = { duration: o.dauer, delay: vorher, easing: C.kurve, fill: 'both' };
    // all in the same task: they start on the same frame
    var anims = [k.animate(fenster, opts), f.animate(fensterRadius, opts)]
      .concat(schichten.map(function (s) { return s.el.animate(s.frames, opts); }));
    if (o.selbst) anims.push(o.selbst.animate([{ opacity: 1 }, { opacity: 0 }], { duration: blende, easing: C.kurve, fill: 'forwards' }));
    var fertig = new Promise(function (ok) { anims[0].onfinish = ok; anims[0].oncancel = ok; });
    /** Opening, step 2: the flight fades out over the real viewer (which must be visible under it by then). */
    function ausblenden() {
      if (!k.parentNode) return Promise.resolve();
      var a = k.animate([{ opacity: 1 }, { opacity: 0 }], { duration: blende, easing: C.kurve, fill: 'forwards' });
      anims.push(a);
      return new Promise(function (ok) { a.onfinish = ok; a.oncancel = ok; });
    }
    return { k: k, anims: anims, fertig: fertig, ausblenden: ausblenden };
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
    if (o.hoch) {        // phone upright, tile reaching out beyond the portrait picture (hochFlug)
      var hf = hochFlug(o.hoch);
      if (!hf) return Promise.resolve();
      k = hf.k;
      k._zeigen = function () { o.verstecken.forEach(function (e) { e.style.visibility = ''; }); };
      // the zoom has reached the portrait picture: as soon as its still is decoded (the tile image stays until then),
      // the real viewer comes under the flight and the flight fades out over it
      weiter = hf.fertig.then(function () {
        return Promise.race([o.hoch.bereit || null, G.warte(C.seite.hochWarten || 2500)]);
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
    h.v.kachelLegen(false);
    G.seiteProdukt.viewerHolen(h.v);            // back onto the stage (or out of the page, if another product is shown)
    if (h.k && h.k.parentNode) h.k.parentNode.removeChild(h.k);
  }
  /* Portrait picture (phone upright) whose tile reaches out beyond its sides (Cam1 has a longer focal length upright):
       view 1 shown – ONE movement (hochFlug, the opening backwards): the viewer shrinks into the tile and fades into the
         wide tile image (day, or evening as the viewer shows it), which lies under it all the way, enlarged at first and
         shrinking onto the tile; at the end the tile holds its own image (evening: the light then goes out softly).
       a move back to view 1 still to play – the viewer shrinks onto the 4:3 crop inside the portrait picture (it fills
         the tile alone, the move plays on in it); once it stands on view 1, the picture draws back inside the tile onto
         the tile crop and the tile's own image comes in at the sides (zurueckziehen). */
  function heimfahren(v, gross, kachel) {
    heimAbbrechen();
    // (phone upright: the opening may still wait for the portrait still – the way back takes over at once; it starts
    // from the same picture)
    if (flugEl && flugEl.classList.contains('flug-hoch')) flugWeg();
    var el = v.el, h = heim = { v: v, kachel: kachel };
    var radiusGross = radiusVon(el);
    v.heim();
    v.maske(null);       // soft edges (ultrawide) grow back to the hard picture edge while it shrinks into the tile
    var ka = v.kachelAnteil, kb = v.kachelRagt ? kachelBox(v.p, ka) : null;
    var fahrt = v.belegt || v.aktuell !== 1;
    var abendZeigt = !!(v.lampe && v.abende[1] && v.abende[1].classList.contains('sichtbar'));
    if (kb && !fahrt && document.body.animate) {
      h.deckend = false;
      v.kachelLegen(false);
      var unter = [{ el: kachel.querySelector('.k-tag'), kachel: 1, voll: 1 }];
      var hochKopien = [{ url: G.pfade.kachel(v.p, 'hoch'), kachel: 1, voll: 1 }];
      var ka2 = abendZeigt && kachel.querySelector('.k-abend');
      if (ka2 && ka2.classList.contains('echt')) {
        unter.push({ el: ka2, kachel: 1, voll: 1 });
        hochKopien.push({ url: G.pfade.kachelAbend(v.p, 'hoch'), kachel: 1, voll: 1 });
      }
      // first the real viewer fades into the tile composition, then it zooms out into the tile
      var hf = hochFlug({ auf: false, T: kachel.getBoundingClientRect(), V: gross, ka: ka, kb: kb,
        radiusKlein: radiusVon(kachel), radiusGross: radiusGross, dauer: C.seite.kachelZumViewer * 0.85,
        unter: unter, hoch: C.echteDateienVerwenden ? hochKopien : [], selbst: el });
      h.k = hf.k; h.anims = hf.anims;
      hf.fertig.then(function () {
        if (heim !== h) return;
        if (abendZeigt) abendAus(abendHalten(kachel));   // the tile holds the evening image, then the light goes out
        v.lampeAus();
        heimAbbrechen();
      });
      return;
    }
    h.deckend = v.kachelRagt;
    v.kachelLegen(h.deckend);
    var k = h.k = G.el('div', 'flug flug-echt');
    k.style.left = gross.left + 'px';
    k.style.top = gross.top + 'px';
    k.style.width = gross.width + 'px';
    k.style.height = gross.height + 'px';
    var frames = fensterFrames({ auf: false, klein: kachel.getBoundingClientRect(), gross: gross,
      aus: h.deckend ? v.kachelDeckend : ka, radiusKlein: radiusVon(kachel), radiusGross: radiusGross });    // ends on the 4:3 tile crop
    var opts = { duration: C.seite.kachelZumViewer * 0.85, easing: C.kurve, fill: 'forwards' };
    k.appendChild(el);                           // moved synchronously – a running video keeps playing
    document.body.appendChild(k);
    h.anim = k.animate(frames, opts);
    /** The picture inside the tile draws back from the 4:3 crop of the portrait picture onto the tile crop (FLIP). */
    function zurueckziehen(dann) {
      if (abendZeigt || (v.lampe && v.abende[1] && v.abende[1].classList.contains('sichtbar'))) abendHalten(kachel);   // sides in the evening
      var r0 = el.getBoundingClientRect();
      v.kachelLegen(false);
      h.deckend = false;
      var r1 = el.getBoundingClientRect();
      if (!r1.width || !G.bewegung(1)) { dann(); return; }
      el.style.transformOrigin = '0 0';
      h.zug = el.animate([
        { transform: 'translate(' + (r0.left - r1.left) + 'px,' + (r0.top - r1.top) + 'px) scale(' + (r0.width / r1.width) + ')' },
        { transform: 'none' }
      ], { duration: C.seite.kachelZurueckziehen || 480, easing: C.kurve });
      h.zug.onfinish = function () { h.zug = null; el.style.transformOrigin = ''; if (heim === h) dann(); };
    }
    h.anim.onfinish = function () {
      if (heim !== h) return;
      boxWeg(el);
      kachel.appendChild(el);                    // from now on it scrolls with the tile
      el.classList.add('in-kachel');
      h.anim = null;
      if (k.parentNode) k.parentNode.removeChild(k);
      h.k = null;
      v.wennRuhig(function () {
        if (heim !== h) return;
        if (h.deckend) zurueckziehen(weiter); else weiter();
      });
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
        // portrait (phone upright): the tile crop (kachel_breit) reaches out beyond the portrait picture – the wide tile
        // image fills those sides while the window closes in on them, above and below the portrait picture comes in
        var kb = kachelBox(p, ka), kw = kb ? kb.kw : null, kbox = kb || ka, kursprung = null;
        if (kw) kursprung = (kw.x + kw.w / 2) * 100 + '% ' + (kw.y + kw.h / 2) * 100 + '%';
        var ragt = !!kb && vw.kachelRagt;
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
        // phone upright, tile reaching out beyond the portrait picture: one movement – the wide tile image zooms in
        // and fades into the portrait picture, always lying under it (hochFlug)
        var hoch = null;
        if (ragt && vw.format === 'hoch') {
          var lit = kz.abend > 0.5;
          var unter = [{ el: q.querySelector('.k-tag'), kachel: 1, voll: 1 }];
          var hochKopien = [{ url: G.pfade.kachel(p, 'hoch'), kachel: 1, voll: 1 }];
          if (ab && kz.abend > 0.01) {
            unter.push({ el: ab, kachel: kz.abend, voll: lit ? 1 : 0 });
            hochKopien.push({ url: G.pfade.kachelAbend(p, 'hoch'), kachel: kz.abend, voll: lit ? 1 : 0 });
          }
          hoch = { auf: true, T: r0, V: vw.el.getBoundingClientRect(), ka: ka, kb: kb, skala: kz.skala,
            radiusKlein: radiusVon(q), radiusGross: radiusVon(vw.el), dauer: C.seite.kachelZumViewer, unter: unter,
            hoch: C.echteDateienVerwenden ? hochKopien : [],
            bereit: Promise.all([dekodiert(gs), lit ? dekodiert(ga) : null]) };
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
