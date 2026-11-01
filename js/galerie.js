/* gauge – gallery: masonry columns, endless in both directions, plus lightbox.
   Layout model: every photo gets a column and a y position (y may be negative = above the start).
   Two fronts grow independently: downwards and upwards. Every column is its own endless sequence (own shuffled pool,
   own start offset); a photo is never placed directly beside or below/above itself, and gaps never line up across
   all columns (no continuous horizontal seam). Only photos near the viewport exist in the DOM. */
(function () {
  'use strict';
  var G = window.G, C = G.C, K = C.galerie;

  var HOEHE = 2000000;          // virtual height of the scroll area
  var BUCKET = 800;             // px – spatial index for fast lookups

  /* ---------------- photos ---------------- */
  var fotos = [];
  function datenLaden() {
    var liste = (window.GAUGE_GALERIE && window.GAUGE_GALERIE.fotos) || [];
    if (liste.length) {
      fotos = liste.map(function (f, i) {
        return { nr: i + 1, klein: f.klein, gross: f.gross, v: (f.b && f.h) ? f.b / f.h : 1, name: f.datei || '' };
      });
    } else {
      // test placeholders in mixed formats (portrait, landscape, square)
      var formate = [3 / 4, 3 / 2, 1, 2 / 3, 4 / 3, 4 / 5, 16 / 9, 1, 3 / 4, 5 / 4, 2 / 3, 3 / 2];
      for (var i = 0; i < K.platzhalterAnzahl; i++) {
        fotos.push({ nr: i + 1, v: formate[(i * 5) % formate.length], platzhalter: true });
      }
    }
  }
  function nummer(f) { return (f.nr < 10 ? '0' : '') + f.nr; }

  /* ---------------- gallery page ---------------- */
  G.seiteGalerie = (function () {
    var s, spalte, flaeche, gebaut = false, aktiv = false, schmutzig = false;
    var n = 0, breite = 0, abstand = 12, spaltenB = 0;
    var items = [], buckets = {}, gerendert = [];
    var unten, oben, versatz = HOEHE / 2;
    var rafWartet = false;

    function spaltenFuer(w) {
      for (var i = 0; i < K.spalten.length; i++) if (w >= K.spalten[i].ab) return K.spalten[i].spalten;
      return 2;
    }
    function messen() {
      breite = flaeche.clientWidth;
      n = spaltenFuer(window.innerWidth);
      abstand = G.istHandy() ? K.abstandHandy : K.abstand;
      spaltenB = (breite - abstand * (n - 1)) / n;
    }

    /* Each column is its own endless sequence: own shuffled pool, own start offset.
       Up and down front of a column start at the same offset (the column's first gap). */
    function fronten() {
      var h = [], perm = G.mischen(Array.apply(null, Array(n)).map(function (x, i) { return i; }));
      var schritt = spaltenB * 0.9 / Math.max(1, n);   // offsets differ by at least this much → no common start line
      for (var i = 0; i < n; i++) h.push(Math.round(perm[i] * schritt + Math.random() * schritt * 0.4));
      var pools = function () { var p = []; for (var i = 0; i < n; i++) p.push([]); return p; };
      unten = { h: h.slice(), pool: pools() };
      oben = { h: h.slice(), pool: pools() };
    }

    function zuruecksetzen() {
      gerendert.forEach(function (it) { if (it.el) { if (beobachter) beobachter.unobserve(it.el); if (it.el.parentNode) it.el.parentNode.removeChild(it.el); } it.el = null; });
      items = []; buckets = {}; gerendert = [];
      fronten();
      versatz = HOEHE / 2;
      flaeche.style.height = HOEHE + 'px';
      // start "in the middle": a little of the upper part is already visible
      s.scrollTop = flaeche.offsetTop + versatz - Math.round(s.clientHeight * 0.08);
    }

    function eintragen(it) {
      items.push(it);
      var a = Math.floor(it.y / BUCKET), b = Math.floor((it.y + it.h) / BUCKET);
      for (var k = a; k <= b; k++) (buckets[k] || (buckets[k] = [])).push(it);
    }
    function imBereich(y0, y1, fn) {
      var a = Math.floor(y0 / BUCKET), b = Math.floor(y1 / BUCKET), gesehen = [];
      for (var k = a; k <= b; k++) {
        var l = buckets[k];
        if (!l) continue;
        for (var i = 0; i < l.length; i++) {
          var it = l[i];
          if (gesehen.indexOf(it) >= 0) continue;
          gesehen.push(it);
          if (it.y < y1 && it.y + it.h > y0) fn(it);
        }
      }
    }
    /** Would photo fi sit directly beside or above/below itself? (never allowed) */
    function konflikt(fi, c, y0, h) {
      var ja = false;
      imBereich(y0 - abstand - 2, y0 + h + abstand + 2, function (it) {
        if (it.fi === fi && Math.abs(it.c - c) <= 1) ja = true;
      });
      return ja;
    }
    /** Would it be close to itself – two columns away or a little further up/down? (avoided when there are enough photos) */
    function nahe(fi, c, y0, h) {
      if (fotos.length < 2 * n) return false;
      var ja = false, rand = spaltenB * 0.6;
      imBereich(y0 - rand, y0 + h + rand, function (it) {
        if (it.fi === fi && Math.abs(it.c - c) <= 2) ja = true;
      });
      return ja;
    }
    /** In how many OTHER columns is there a gap (between two photos) close to this height?
        Twice the configured distance: two gaps 28 px apart are allowed, but then a third one may not sit between
        them – otherwise a chain of "just allowed" pairs would still form a near line across all columns. */
    function fugenNah(c, mitte) {
      var fa = 2 * K.fugenAbstand, spalten = {}, zahl = 0;
      imBereich(mitte - fa - abstand, mitte + fa + abstand, function (it) {
        if (it.c === c || spalten[it.c]) return;
        var o = it.y - abstand / 2, u = it.y + it.h + abstand / 2;
        if (Math.abs(o - mitte) < fa || Math.abs(u - mitte) < fa) { spalten[it.c] = true; zahl++; }
      });
      return zahl;
    }
    /** Pick the next photo for column c. Rules: never beside/above itself, and never let gaps line up
        across the columns (no continuous horizontal seam – also where new rounds start).
        extra = additional space before the photo (last resort, normally 0). */
    function waehlen(fr, c, y, runter) {
      var pool = fr.pool[c];
      var runde = function () { Array.prototype.push.apply(pool, G.mischen(fotos.map(function (f, i) { return i; }))); };
      if (!pool.length) runde();
      var grenze = Math.max(1, Math.ceil((n - 1) * 0.6));   // this many aligned neighbours is already too many
      // how many columns line up with the gaps this photo would create (with extra space both of its edges are new)
      function ausrichtung(fi, extra) {
        if (n < 2) return 0;
        var h = spaltenB / fotos[fi].v;
        var y0 = runter ? y + extra : y - extra - abstand - h;
        var k = fugenNah(c, runter ? y0 + h + abstand / 2 : y0 - abstand / 2);
        if (extra) k = Math.max(k, fugenNah(c, runter ? y0 - abstand / 2 : y0 + h + abstand / 2));
        return k;
      }
      function passt(fi, extra) {
        var h = spaltenB / fotos[fi].v;
        return !konflikt(fi, c, runter ? y + extra : y - extra - abstand - h, h);
      }
      var beste = null;
      // first the rest of the column's current round; if nothing fits, the next round is appended and tried as well;
      // then a repetition two columns away is accepted; as a last resort one gap becomes a little wider
      var stufen = [0, 0, K.fugenAbstand + abstand, 2 * (K.fugenAbstand + abstand)];
      for (var s = 0; s < stufen.length; s++) {
        if (s === 1) runde();
        if (s === 2 && beste && beste.wert < 100) break;
        for (var i = 0; i < pool.length; i++) {
          var fi = pool[i];
          if (!passt(fi, stufen[s])) continue;
          var k = ausrichtung(fi, stufen[s]);
          var hf = spaltenB / fotos[fi].v;
          var weich = nahe(fi, c, runter ? y + stufen[s] : y - stufen[s] - abstand - hf, hf);
          if (k < grenze && !weich) { pool.splice(i, 1); return { fi: fi, extra: stufen[s] }; }
          var wert = (k >= grenze ? 100 + k : 0) + (weich ? 10 : 0);
          if (!beste || wert < beste.wert) beste = { i: i, wert: wert, extra: stufen[s] };
        }
      }
      if (beste) return { fi: pool.splice(beste.i, 1)[0], extra: beste.extra };
      return { fi: pool.shift(), extra: 0 };   // only possible with very few photos
    }    function platzierenUnten() {
      var c = 0;
      for (var i = 1; i < n; i++) if (unten.h[i] < unten.h[c]) c = i;
      var w = waehlen(unten, c, unten.h[c], true);
      var y = unten.h[c] + w.extra;
      var h = spaltenB / fotos[w.fi].v;
      eintragen({ fi: w.fi, c: c, y: y, h: h, el: null });
      unten.h[c] = y + h + abstand;
    }
    function platzierenOben() {
      var c = 0;
      for (var i = 1; i < n; i++) if (oben.h[i] > oben.h[c]) c = i;
      var w = waehlen(oben, c, oben.h[c], false);
      var h = spaltenB / fotos[w.fi].v;
      var y = oben.h[c] - w.extra - abstand - h;
      eintragen({ fi: w.fi, c: c, y: y, h: h, el: null });
      oben.h[c] = y;
    }
    function sichern(y0, y1) {
      var g = 0;
      while (Math.min.apply(null, unten.h) < y1 && g++ < 2000) platzierenUnten();
      g = 0;
      while (Math.max.apply(null, oben.h) > y0 && g++ < 2000) platzierenOben();
    }

    var tor = null;        // start screen: the photos wait for this (the tile images load first)
    function elBauen(it) {
      var f = fotos[it.fi];
      var b = G.el('button', 'g-foto' + (f.platzhalter ? ' g-platzhalter' : ''));
      b.type = 'button';
      b.dataset.fi = it.fi;
      b.setAttribute('aria-label', f.platzhalter ? 'Photo ' + nummer(f) : 'Photo ' + nummer(f) + (f.name ? ' – ' + f.name : ''));
      b.style.left = (it.c * (spaltenB + abstand)) + 'px';
      b.style.top = (versatz + it.y) + 'px';
      b.style.width = spaltenB + 'px';
      b.style.height = it.h + 'px';
      var inhalt;
      if (f.platzhalter) {
        inhalt = G.el('span', 'g-nr', 'Photo ' + nummer(f));
        it.bereit = Promise.resolve(true);
      } else {
        var img = inhalt = new Image();
        img.decoding = 'async';
        img.alt = '';
        // ready = loaded AND decoded: never a half built photo
        it.bereit = new Promise(function (ok) {
          img.onload = function () {
            var d = img.decode ? img.decode() : Promise.resolve();
            d.then(null, function () {}).then(function () { b.classList.add('geladen'); ok(true); });
          };
          img.onerror = function () { ok(false); };
        });
        if (tor && !aktiv) tor.then(function () { if (!img.getAttribute('src')) img.src = f.klein; });
        else img.src = f.klein;
      }
      // until it rises: only the calm grey surface of the photo's place
      inhalt.classList.add('vor-aufstieg');
      it.inhalt = inhalt;
      b.appendChild(inhalt);
      it.el = b;
      flaeche.appendChild(b);
      gerendert.push(it);
      // (built invisibly during the start screen: it rises only once the page is shown)
      if (!aktiv) return;
      if (beobachter) beobachter.observe(b); else aufsteigenLassen([it]);
    }

    /* rising: photos that come into view rise one after the other in random order (also when scrolling) */
    var beobachter = null, stapel = [], stapelUhr = null;
    function aufsteigenLassen(liste) {
      G.welle.einreihen(G.mischen(liste).map(function (it) { return { els: [it.inhalt], bereit: it.bereit }; }));
    }
    function beobachten() {
      if (!window.IntersectionObserver || beobachter) return;
      beobachter = new IntersectionObserver(function (eintraege) {
        eintraege.forEach(function (e) {
          if (!e.isIntersecting) return;
          beobachter.unobserve(e.target);
          var it = null;
          for (var i = 0; i < gerendert.length; i++) if (gerendert[i].el === e.target) { it = gerendert[i]; break; }
          if (it && it.inhalt && it.inhalt.classList.contains('vor-aufstieg')) stapel.push(it);
        });
        // photos arriving within a short moment form one wave (random order)
        clearTimeout(stapelUhr);
        stapelUhr = setTimeout(function () { if (stapel.length) { aufsteigenLassen(stapel); stapel = []; } }, 30);
      }, { root: null, threshold: 0.01 });
    }
    /** Opening the page again: the photos in view rise once more. */
    function welleNeu() {
      if (G.modus === 'aus' || !beobachter) return;
      var vh = window.innerHeight, liste = [];
      gerendert.forEach(function (it) {
        if (!it.el || !it.inhalt) return;
        var r = it.el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) liste.push(it);
        else { it.inhalt.classList.add('vor-aufstieg'); beobachter.observe(it.el); }
      });
      aufsteigenLassen(liste);
    }

    function aktualisieren() {
      rafWartet = false;
      if (!aktiv || !gebaut) return;
      var vh = s.clientHeight;
      var oben0 = s.scrollTop - flaeche.offsetTop - versatz;
      var vor = vh * K.vorladenBildschirme, weg = vh * K.entfernenBildschirme;
      sichern(oben0 - vor, oben0 + vh + vor);
      imBereich(oben0 - vor, oben0 + vh + vor, function (it) { if (!it.el) elBauen(it); });
      gerendert = gerendert.filter(function (it) {
        if (it.y + it.h < oben0 - weg || it.y > oben0 + vh + weg) {
          if (it.el && beobachter) beobachter.unobserve(it.el);
          if (it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el);
          it.el = null;
          return false;
        }
        return true;
      });
      // keep far away from the ends of the virtual area (re-centre silently)
      var st = s.scrollTop;
      if (st < HOEHE * 0.15 || st > HOEHE * 0.85) {
        var delta = Math.round(HOEHE / 2 - st);
        versatz += delta;
        gerendert.forEach(function (it) { it.el.style.top = (versatz + it.y) + 'px'; });
        s.scrollTop = st + delta;
      }
    }
    function planen() { if (!rafWartet) { rafWartet = true; requestAnimationFrame(aktualisieren); } }
    function bauen() {
      datenLaden();
      flaeche.style.height = HOEHE + 'px';     // first the full height: the scrollbar must already count when measuring
      messen();
      zuruecksetzen();
      gebaut = true;
    }

    var resizeUhr = null;
    function beiResize() {
      clearTimeout(resizeUhr);
      resizeUhr = setTimeout(function () {
        if (!gebaut) return;
        if (!aktiv) { schmutzig = true; return; }
        var altN = n, altB = breite;
        messen();
        if (n !== altN || Math.abs(breite - altB) > 1) { zuruecksetzen(); planen(); }
      }, 180);
    }

    return {
      init: function () {
        var b = seiteBauen();
        s = b.seite; spalte = b.spalte;
        flaeche = G.el('div', 'galerie-flaeche');
        spalte.appendChild(flaeche);
        s.addEventListener('scroll', planen, { passive: true });
        window.addEventListener('resize', beiResize);
        flaeche.addEventListener('click', function (e) {
          var t = e.target.closest ? e.target.closest('.g-foto') : null;
          if (t) G.lightbox.oeffnen(Number(t.dataset.fi), t);
        });
      },
      zeigen: function () {
        aktiv = true;
        s.classList.add('aktiv');
        beobachten();
        if (!gebaut) {
          bauen();
        } else {
          // (also laid out invisibly on the start screen – the width may have changed since)
          schmutzig = false;
          var altN = n, altB = breite;
          messen();
          if (n !== altN || Math.abs(breite - altB) > 1) zuruecksetzen();
          else welleNeu();
        }
        planen();
      },
      /** Start screen: lay out the first screen invisibly and load its photos (once "nach" has resolved – the tiles
          go first). Returns their Promises (loaded + decoded). */
      vorbereiten: function (nach) {
        tor = nach || null;
        if (!gebaut) bauen();
        var vh = s.clientHeight, oben0 = s.scrollTop - flaeche.offsetTop - versatz, liste = [];
        sichern(oben0 - vh * 0.2, oben0 + vh * 1.2);
        imBereich(oben0, oben0 + vh, function (it) { if (!it.el) elBauen(it); if (it.bereit) liste.push(it.bereit); });
        return liste;
      },
      verbergen: function () { aktiv = false; s.classList.remove('aktiv'); },
      andock: function () { return null; },
      fotos: function () { return fotos; },
      /** for testing in the console */
      _stand: function () { return { items: items.length, imDom: gerendert.length, spalten: n }; },
      _items: function () { return items.map(function (it) { return { c: it.c, y: it.y, h: it.h, fi: it.fi }; }); },
      _abstand: function () { return abstand; }
    };

    function seiteBauen() {
      var sec = G.el('section', 'seite seite-galerie');
      sec.setAttribute('aria-label', 'Gallery');
      var sp = G.el('div', 'spalte');
      sec.appendChild(sp);
      document.getElementById('seiten').appendChild(sec);
      return { seite: sec, spalte: sp };
    }
  })();

  /* ---------------- lightbox ---------------- */
  G.lightbox = (function () {
    var el, buehne, zaehler, zuKnopf, idx = 0, offen = false, vorherFokus = null, aktuellesBild = null;

    function masse(f) {
      var handy = G.istHandy();
      var maxB = window.innerWidth - (handy ? 24 : 160);
      var maxH = window.innerHeight - (handy ? 120 : 96);
      var b = Math.min(maxB, maxH * f.v);
      var h = b / f.v;
      return { b: Math.round(b), h: Math.round(h), x: Math.round((window.innerWidth - b) / 2), y: Math.round((window.innerHeight - h) / 2 - (handy ? 12 : 0)) };
    }
    function platzieren(fig) {
      var m = masse(fig._f);
      fig.style.width = m.b + 'px';
      fig.style.height = m.h + 'px';
      fig.style.left = m.x + 'px';
      fig.style.top = m.y + 'px';
      return m;
    }

    function bild(f) {
      var fig = G.el('div', 'lb-bild' + (f.platzhalter ? ' ph' : ''));
      fig._f = f;
      platzieren(fig);
      if (f.platzhalter) {
        fig.appendChild(G.el('span', 'ph-text', 'Photo ' + nummer(f)));
      } else {
        var klein = new Image();
        klein.className = 'lb-klein';
        klein.alt = '';
        klein.src = f.klein;
        fig.appendChild(klein);
        var gross = new Image();
        gross.className = 'lb-gross';
        gross.alt = f.name ? f.name : 'Photo ' + nummer(f);
        gross.decoding = 'async';
        gross.onload = function () { fig.classList.add('scharf'); };
        gross.src = f.gross;
        fig.appendChild(gross);
      }
      return fig;
    }

    function zeigen(i, richtung) {
      var fotos = G.seiteGalerie.fotos();
      if (!fotos.length) return;
      idx = (i % fotos.length + fotos.length) % fotos.length;
      var f = fotos[idx];
      var neu = bild(f);
      var alt = aktuellesBild;
      var t = G.blende(K.lightboxWechsel);
      var schub = G.modus === 'voll' ? 18 : 0;
      buehne.appendChild(neu);
      aktuellesBild = neu;
      if (alt) {
        G.animiere(alt, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-richtung * schub) + 'px)' }],
          { duration: t, easing: C.kurve, fill: 'forwards' }).then(function () { if (alt.parentNode) alt.parentNode.removeChild(alt); });
        G.animiere(neu, [{ opacity: 0, transform: 'translateX(' + (richtung * schub) + 'px)' }, { opacity: 1, transform: 'none' }],
          { duration: t, easing: C.kurve });
      }
      zaehler.textContent = nummer(f) + ' / ' + fotos.length;
      // preload the neighbours
      [idx - 1, idx + 1].forEach(function (k) {
        var g = fotos[(k + fotos.length) % fotos.length];
        if (g && g.gross) { var im = new Image(); im.src = g.gross; }
      });
    }

    function schliessen() {
      if (!offen) return;
      offen = false;
      el.classList.remove('offen');
      el.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-offen');
      setTimeout(function () { if (!offen) { buehne.textContent = ''; aktuellesBild = null; } }, G.blende(K.lightboxAuf) + 30);
      if (vorherFokus && vorherFokus.focus) try { vorherFokus.focus({ preventScroll: true }); } catch (e) {}
    }

    function knopf(cls, icon, label, fn) {
      var b = G.el('button', 'lb-knopf ' + cls);
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.appendChild(G.icon(icon, 26, 1.25));
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
      el.appendChild(b);
      return b;
    }

    return {
      init: function () {
        el = G.el('div', 'lightbox');
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', 'Photo');
        el.setAttribute('aria-hidden', 'true');
        buehne = G.el('div', 'lb-buehne');
        el.appendChild(buehne);
        knopf('lb-zurueck', 'links', 'Previous photo', function () { zeigen(idx - 1, -1); });
        knopf('lb-vor', 'rechts', 'Next photo', function () { zeigen(idx + 1, 1); });
        zuKnopf = knopf('lb-zu', 'zu', 'Close', schliessen);
        zaehler = G.el('div', 'lb-zaehler');
        el.appendChild(zaehler);
        el.addEventListener('click', function (e) { if (e.target === el || e.target === buehne) schliessen(); });
        document.body.appendChild(el);

        document.addEventListener('keydown', function (e) {
          if (!offen) return;
          if (e.key === 'ArrowRight') { e.preventDefault(); zeigen(idx + 1, 1); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); zeigen(idx - 1, -1); }
          else if (e.key === 'Escape') { e.preventDefault(); schliessen(); }
        });
        var t0 = null;
        el.addEventListener('touchstart', function (e) {
          if (e.touches.length !== 1) { t0 = null; return; }
          t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: true });
        el.addEventListener('touchend', function (e) {
          if (!t0) return;
          var t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y;
          t0 = null;
          if (Math.abs(dx) > 45 && Math.abs(dy) < Math.abs(dx) * 0.7) zeigen(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
          else if (dy > 90 && Math.abs(dx) < dy * 0.5) schliessen();
        });
        window.addEventListener('resize', function () {
          if (offen && aktuellesBild) platzieren(aktuellesBild);
        });
      },
      oeffnen: function (i, quelle) {
        vorherFokus = document.activeElement;
        buehne.textContent = '';
        aktuellesBild = null;
        offen = true;
        document.body.classList.add('lightbox-offen');
        zeigen(i, 0);
        el.setAttribute('aria-hidden', 'false');
        // grow out of the clicked photo
        if (quelle && G.modus === 'voll' && aktuellesBild) {
          var r0 = quelle.getBoundingClientRect();
          var fig = aktuellesBild;
          var m = masse(fig._f);
          var sk = r0.width / m.b;
          G.animiere(fig, [
            { transform: 'translate(' + (r0.left - m.x) + 'px,' + (r0.top - m.y) + 'px) scale(' + sk + ')' },
            { transform: 'none' }
          ], { duration: G.bewegung(K.lightboxAuf + 80), easing: C.kurve });
        }
        el.classList.add('offen');
        try { zuKnopf.focus({ preventScroll: true }); } catch (e) {}
      },
      schliessen: schliessen,
      offen: function () { return offen; }
    };
  })();
})();
