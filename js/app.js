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
  /** The frame of a flight: the viewer box rg – or, with aussen (shares of rg), a larger box around it (portrait picture:
      the tile of the wide picture reaches out beyond its sides). teil() turns shares of the viewer into shares of the frame. */
  function rahmen(rg, aussen) {
    var U = aussen || GANZ;
    return {
      r: { left: rg.left + U.x * rg.width, top: rg.top + U.y * rg.height, width: U.w * rg.width, height: U.h * rg.height },
      teil: function (k) { return { x: (k.x - U.x) / U.w, y: (k.y - U.y) / U.h, w: k.w / U.w, h: k.h / U.h }; }
    };
  }
  /** Smallest box around the picture (0…1) and the tile crop k / the part of k that lies inside the picture. */
  function huelle(k) { var x = Math.min(0, k.x), y = Math.min(0, k.y); return { x: x, y: y, w: Math.max(1, k.x + k.w) - x, h: Math.max(1, k.y + k.h) - y }; }
  function schnitt(k) { var x = Math.max(0, k.x), y = Math.max(0, k.y); return { x: x, y: y, w: Math.min(1, k.x + k.w) - x, h: Math.min(1, k.y + k.h) - y }; }
  /** Where the whole tile image (the wide picture, kachelVoll) lies, in shares of the viewer, so that its 4:3 crop sits
      exactly on the tile crop ka of the picture the viewer shows (wide: inside it; portrait: reaching out to the sides). */
  function kachelBox(p, ka) {
    var kw = p.kachelVoll ? (p.kachelAusschnitt || G.anzeige(p).kachel) : null;
    if (!kw) return null;
    var bw = ka.w / kw.w, bh = ka.h / kw.h;
    return { x: ka.x - kw.x * bw, y: ka.y - kw.y * bh, w: bw, h: bh, kw: kw };
  }
  /** Keyframes of the window between the tile (o.klein, its crop o.aus) and the viewer (o.gross).
      o.zwischen (portrait picture, tile reaching outside it): the window never shows a corner where neither picture has
      anything – first it closes in at the sides onto the part of the tile the portrait picture covers (the wide tile
      image fills the sides meanwhile), then it opens upwards and downwards to the whole portrait picture. The scale runs
      on evenly; the switch point is chosen so that the window never gets narrower on screen. */
  function fensterFrames(o) {
    var R = rahmen(o.gross, o.aussen), Rw = R.r.width, Rh = R.r.height;
    function clipVon(k) { var t = R.teil(k); return { l: t.x * Rw, t: t.y * Rh, r: Rw - (t.x + t.w) * Rw, b: Rh - (t.y + t.h) * Rh }; }
    function stil(f, c, radius) {
      return { transform: 'translate(' + f.tx + 'px,' + f.ty + 'px) scale(' + f.s + ')',
        clipPath: 'inset(' + c.t + 'px ' + c.r + 'px ' + c.b + 'px ' + c.l + 'px round ' + (radius / f.s) + 'px)' };
    }
    var rK = o.radiusKlein || 0, rG = o.radiusGross || 0;
    var fk = fensterWerte(o.klein, R.r, R.teil(o.aus || GANZ)), fg = { tx: 0, ty: 0, s: 1 };
    var K = stil(fk, fk, rK), Gr = stil(fg, clipVon(GANZ), rG);
    if (!o.zwischen) return o.auf ? [K, Gr] : [Gr, K];
    // (1.5 px inside the edges of the portrait picture: no hairline where the window edge meets the picture edge)
    var cz = clipVon(o.zwischen); cz.l += 1.5; cz.r += 1.5; cz.t += 1.5; cz.b += 1.5;
    var wk = Rw - fk.l - fk.r, wz = Rw - cz.l - cz.r, m = 0.5;
    for (var mm = 0.12; mm <= 0.85; mm += 0.01) {
      var ok = true, vorher = wk * fk.s;
      for (var i = 1; i <= 12 && ok; i++) {
        var u = i / 12, b = (wk + (wz - wk) * u) * (fk.s + (1 - fk.s) * mm * u);
        if (b < vorher - 0.25) ok = false;
        vorher = b;
      }
      if (ok) { m = mm; break; }
    }
    var fm = { tx: fk.tx * (1 - m), ty: fk.ty * (1 - m), s: fk.s + (1 - fk.s) * m };
    var M = stil(fm, cz, rK + (rG - rK) * m);
    M.offset = o.auf ? m : 1 - m;
    var frames = o.auf ? [K, M, Gr] : [Gr, M, K];
    frames.mitte = M.offset;
    return frames;
  }
  /** Picture with soft edges in a larger frame (portrait picture made smaller): the frame stays transparent, so the soft
      edges fade into the page as on the product page; the wide tile image is only there while the window needs it
      (otherwise it would shine through the soft edges). Keyframes of its opacity. */
  function seitenDeckkraft(frames, auf) {
    var m = frames.mitte;
    return auf ? [{ opacity: 1 }, { opacity: 1, offset: m }, { opacity: 0, offset: Math.min(1, m + 0.15) }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 0, offset: Math.max(0, m - 0.15) }, { opacity: 1, offset: m }, { opacity: 1 }];
  }
  function radiusVon(el) { return el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 : 0; }
  function setzeBox(el, k) {
    el.style.inset = 'auto';
    el.style.left = k.x * 100 + '%'; el.style.top = k.y * 100 + '%';
    el.style.width = k.w * 100 + '%'; el.style.height = k.h * 100 + '%';
  }
  function flug(o) {
    if (flugEl && flugEl.parentNode) flugEl.parentNode.removeChild(flugEl);
    var R = rahmen(o.gross, o.aussen), r1 = R.r, ganz = !o.aussen;
    var k = G.el('div', 'flug');
    k.style.left = r1.left + 'px';
    k.style.top = r1.top + 'px';
    k.style.width = r1.width + 'px';
    k.style.height = r1.height + 'px';
    var anims = [], maskeEls = ganz ? [k] : [];
    var opts = { duration: o.dauer, easing: C.kurve, fill: 'forwards' };
    var frames = fensterFrames(o);
    var mitMaske = !!(o.maske && (o.maske.l > 0 || o.maske.r > 0 || o.maske.t > 0 || o.maske.b > 0));
    var frei = mitMaske && !ganz, ersteBild = true;
    if (frei) k.classList.add('flug-frei');
    o.schichten.forEach(function (s) {
      var c = s.el.cloneNode(true);
      c.classList.remove('sichtbar', 'raus', 'rein', 'vor-fahrt', 'vor-aufstieg');
      c.style.transform = s.von.transform || 'none';
      c.style.opacity = s.von.opacity == null ? 1 : s.von.opacity;
      c.style.transition = 'none';
      // a whole tile image: sits exactly on the tile crop of the picture; (larger frame) the viewer's own layers on the viewer box
      if (s.box || !ganz) setzeBox(c, R.teil(s.box || GANZ));
      if (!s.box && !ganz) maskeEls.push(c);       // (larger frame: the soft edges belong to the picture, not to the frame)
      if (s.ursprung) c.style.transformOrigin = s.ursprung;
      // a small copy still decoding: the layer below shows (transparent frame: the lowest picture layer keeps its grey)
      if (s.durchsichtig && !(frei && ersteBild)) c.style.backgroundColor = 'transparent';
      if (!s.box) ersteBild = false;
      k.appendChild(c);
      var a = { transform: s.von.transform || 'none', opacity: c.style.opacity }, b = { transform: s.nach.transform || 'none', opacity: s.nach.opacity == null ? 1 : s.nach.opacity };
      if (a.transform !== b.transform || String(a.opacity) !== String(b.opacity)) anims.push({ el: c, frames: [a, b] });
      if (frei && s.box && String(a.opacity) === String(b.opacity)) anims.push({ el: c, frames: seitenDeckkraft(frames, true), eigen: true });
    });
    if (mitMaske) {      // the soft edges of the picture (ultrawide, smaller picture) grow while the window opens
      maskeEls.forEach(function (e) { e.classList.add('maske'); ['l', 'r', 't', 'b'].forEach(function (s) { e.style.setProperty('--m' + s, '0px'); }); });
    }
    document.body.appendChild(k);
    flugEl = k;
    if (mitMaske) {
      void k.offsetWidth;
      maskeEls.forEach(function (e) {
        e.style.transition = ['l', 'r', 't', 'b'].map(function (s) { return '--m' + s + ' ' + o.dauer + 'ms ' + C.kurve; }).join(', ');
        ['l', 'r', 't', 'b'].forEach(function (s) { e.style.setProperty('--m' + s, Math.round(o.maske[s]) + 'px'); });
      });
    }
    o.verstecken.forEach(function (e) { e.style.visibility = 'hidden'; });
    anims.forEach(function (x) { G.animiere(x.el, x.frames, x.eigen ? { duration: o.dauer, easing: C.kurve, fill: 'forwards', composite: 'replace' } : opts); });
    var bereit = o.bereit || Promise.resolve();
    return G.animiere(k, frames, { duration: o.dauer, easing: C.kurve, fill: 'forwards' }).then(function () {
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
  function boxWeg(el) { ['inset', 'left', 'top', 'width', 'height', 'transformOrigin'].forEach(function (k) { el.style[k] = ''; }); }
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
    var el = h.v.el;
    el.classList.remove('in-kachel', 'heim-raus');
    el.style.transition = '';
    boxWeg(el);
    h.v.kachelLegen(false);
    G.seiteProdukt.viewerHolen(h.v);            // back onto the stage (or out of the page, if another product is shown)
    if (h.k && h.k.parentNode) h.k.parentNode.removeChild(h.k);
  }
  /* Portrait picture (phone upright) whose tile reaches out beyond its sides (Cam1 has a longer focal length upright):
       view 1 shown – the viewer shrinks straight onto the tile crop; the wide tile image (day, or evening as the viewer
         shows it) flies along beside it and fills the sides, the window first closes in vertically, then opens to the
         sides (fensterFrames, the way of the opening backwards).
       a move back to view 1 still to play – the viewer shrinks onto the 4:3 crop inside the portrait picture (it fills
         the tile alone, the move plays on in it); once it stands on view 1, the picture draws back inside the tile onto
         the tile crop and the tile's own image comes in at the sides (zurueckziehen). */
  function heimfahren(v, gross, kachel) {
    heimAbbrechen();
    var el = v.el, h = heim = { v: v, kachel: kachel };
    var radiusGross = radiusVon(el);
    var mw = v.maskeWerte, weich = !!(mw && (mw.l > 0 || mw.r > 0 || mw.t > 0 || mw.b > 0));
    v.heim();
    v.maske(null);       // soft edges (ultrawide) grow back to the hard picture edge while it shrinks into the tile
    var ka = v.kachelAnteil, kb = v.kachelRagt ? kachelBox(v.p, ka) : null;
    var fahrt = v.belegt || v.aktuell !== 1;
    var zweiStufen = !!kb && !fahrt;
    h.deckend = v.kachelRagt && !zweiStufen;
    v.kachelLegen(h.deckend);
    var aussen = zweiStufen ? huelle(ka) : null, R = rahmen(gross, aussen);
    var k = h.k = G.el('div', 'flug flug-echt');
    k.style.left = R.r.left + 'px';
    k.style.top = R.r.top + 'px';
    k.style.width = R.r.width + 'px';
    k.style.height = R.r.height + 'px';
    var abendZeigt = !!(v.lampe && v.abende[1] && v.abende[1].classList.contains('sichtbar'));
    var frames = fensterFrames({ auf: false, klein: kachel.getBoundingClientRect(), gross: gross, aussen: aussen,
      aus: h.deckend ? v.kachelDeckend : ka, zwischen: zweiStufen ? schnitt(ka) : null,
      radiusKlein: radiusVon(kachel), radiusGross: radiusGross });    // ends on the 4:3 tile crop
    var opts = { duration: C.seite.kachelZumViewer * 0.85, easing: C.kurve, fill: 'forwards' };
    var seiten = [];
    if (zweiStufen) {
      ['.k-tag', abendZeigt ? '.k-abend' : null].forEach(function (sel) {
        var q = sel && kachel.querySelector(sel);
        if (!q || (sel === '.k-abend' && !q.classList.contains('echt'))) return;
        var c = q.cloneNode(true);
        c.classList.remove('sichtbar', 'raus', 'rein', 'vor-aufstieg', 'nachglimmen', 'ausglimmen');
        c.style.transition = 'none'; c.style.transform = 'none'; c.style.opacity = '1';
        setzeBox(c, R.teil(kb));
        k.appendChild(c);
        seiten.push(c);
      });
      setzeBox(el, R.teil(GANZ));
      // soft edges (picture made smaller): transparent frame, the tile image beside it only comes once the sides open
      if (weich) k.classList.add('flug-frei');
    }
    k.appendChild(el);                           // moved synchronously – a running video keeps playing
    document.body.appendChild(k);
    h.anim = k.animate(frames, opts);
    if (weich) seiten.forEach(function (c) { c.animate(seitenDeckkraft(frames, false), opts); });
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
      if (zweiStufen && abendZeigt) abendHalten(kachel);     // the tile's own evening image takes over the sides at once
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
        flug({ auf: true, klein: r0, gross: vw.el.getBoundingClientRect(), radiusKlein: radiusVon(q), radiusGross: radiusVon(vw.el), aus: ka, maske: vw.maskeWerte,
          aussen: ragt ? huelle(ka) : null, zwischen: ragt ? schnitt(ka) : null,
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
