/* gauge – content pages: Products (one grid of tiles), product page (incl. Customize and Order), About. */
(function () {
  'use strict';
  var G = window.G, C = G.C;

  function seiteBauen(klasse, label) {
    var s = G.el('section', 'seite ' + klasse);
    s.setAttribute('aria-label', label);
    var sp = G.el('div', 'spalte');
    s.appendChild(sp);
    document.getElementById('seiten').appendChild(s);
    return { seite: s, spalte: sp };
  }

  /* =================================================================
     PRODUCTS – one grid of separate tiles (4:3, all the same size, same radius, gaps between).
     Newest first by default. Filters (size, type) and sorting apply instantly:
     the tiles glide to their new places, leaving tiles fade out, new ones fade in.
     ================================================================= */
  G.seiteProdukte = (function () {
    var s, spalte, raster, leer, zellen = {}, aktiv = false, letzteVorschau = null, filterBaum = null, spaltenZahl = 0;

    /* in tree mode the type comes from the route, in bar mode from the shared state */
    function art() { return G.LEISTE ? G.zustand.art : (filterBaum || 'all'); }
    function passt(p) {
      var g = G.LEISTE ? G.zustand.groesse : 'all';
      var a = art();
      return (g === 'all' || p.klasse === g) && (a === 'all' || p.kategorie === a);
    }
    function zielPfad(p) { return G.LEISTE ? 'products/' + p.id : 'products/' + (filterBaum || p.kategorie) + '/' + p.id; }

    function zelleBauen(p) {
      var z = G.el('div', 'zelle' + (p.dummy ? ' dummy' : ''));
      var a = G.el('a', 'kachel' + (p.leuchtmittel ? ' licht' : '') + (p.dummy ? ' dummy' : ''));
      a.href = '#/' + zielPfad(p);
      a.dataset.id = p.id;
      a.setAttribute('aria-label', p.code);
      // the wide tile image is the whole wide picture: the tile shows exactly its 4:3 crop
      a.style.setProperty('--kpos', G.kachelPosition(p));
      var k = { z: z, a: a, p: p, sichtbar: true, anim: [], bilder: {}, format: null };
      kachelFormat(k, kachelFormatFuer(p), C.vorladen.startbilder ? 20 : 0);
      var oeffnen = function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        G.app.produktOeffnen(p, a);
      };
      a.addEventListener('click', oeffnen);
      // hover (phone: the first touch): the big still of view 1 loads at once, past the queue – a click finds it ready
      var vorab = function () { if (C.vorladen.beimHover && !p.dummy) G.viewerFuer(p).vorladen('hover'); };
      a.addEventListener('mouseenter', vorab);
      a.addEventListener('touchstart', vorab, { passive: true });
      var n = G.el('a', 'name', p.code);
      n.href = a.href;
      n.tabIndex = -1;
      n.addEventListener('click', oeffnen);
      z.appendChild(a);
      z.appendChild(n);
      k.name = n;
      return k;
    }

    /* ---- tile images: 'breit' = the wide tile (4:3 crop of the wide Cam1 picture, desktop and phone held sideways),
       'hoch' = the phone tile (phone upright: a full-width crop of the portrait Cam1 picture, the same crop for all
       products – it opens into the portrait picture by only widening that crop). Turning the phone swaps them. ---- */
    function kachelFormatFuer(p) { return !p.dummy && G.formatFuer(p) === 'hoch' ? 'hoch' : 'breit'; }
    function bilderBauen(p, format) {
      var hoch = format === 'hoch';
      // plain grey placeholder tile – no joint line (side by side it would read as one continuous line)
      var tag = G.platzhalter({ pfad: hoch ? G.pfade.handyKachel(p) : G.pfade.kachel(p), text: p.code + ' · View 1' + (p.dummy ? ' · dummy' : ''), klasse: 'k-tag', alt: p.code });
      var abend = null;
      if (p.leuchtmittel) abend = G.platzhalter({ pfad: hoch ? G.pfade.handyKachelAbend(p) : G.pfade.kachelAbend(p), text: p.code + ' · View 1 · evening', abend: true, klasse: 'k-abend', alt: p.code + ', evening' });
      if (hoch) [tag, abend].forEach(function (ph) { if (ph) ph.style.setProperty('--kpos', '50% 50%'); });   // the file is the crop
      return { tag: tag, abend: abend };
    }
    /** Show the tile images of one format (built on first use; prio: load them now). true if it changed. */
    function kachelFormat(k, format, prio) {
      if (k.format === format) return false;
      var alt = k.format && k.bilder[k.format], neu = k.bilder[format] || (k.bilder[format] = bilderBauen(k.p, format));
      if (alt) [alt.tag, alt.abend].forEach(function (ph) { if (ph && ph.parentNode === k.a) k.a.removeChild(ph); });
      var vor = k.a.firstChild;
      k.a.insertBefore(neu.tag, vor);
      if (neu.abend) k.a.insertBefore(neu.abend, vor);
      k.format = format;
      k.a.dataset.format = format;
      if (prio) {
        neu.tag.laden(prio); if (neu.abend) neu.abend.laden(prio);
        // phone tile: the small copy of the whole portrait picture too – the zoom opens the tile on it (also after the
        // phone was turned upright later, when the start screen had loaded the wide tiles only)
        if (format === 'hoch') [G.pfade.kachel(k.p, 'hoch'), G.pfade.kachelAbend(k.p, 'hoch')].forEach(function (u) { if (u) G.lader.bild(u, prio); });
      }
      return true;
    }
    /** Phone turned (or window changed shape): the tiles of the other format; the page rises them again if it shows. */
    function formatPruefen() {
      document.documentElement.classList.toggle('handy-kacheln', G.handyKacheln());
      var anders = false;
      Object.keys(zellen).forEach(function (id) {
        var k = zellen[id];
        if (kachelFormat(k, kachelFormatFuer(k.p), C.vorladen.startbilder || k.sichtbar ? 30 : 0)) anders = true;
      });
      if (anders && aktiv) welle();
    }

    function spaltenSetzen() {
      var w = window.innerWidth, n = 2;
      for (var i = 0; i < C.produkte.raster.length; i++) if (w >= C.produkte.raster[i].ab) { n = C.produkte.raster[i].spalten; break; }
      // test version: all products with real images in the first row, as long as the tiles stay wide enough
      var echte = G.produkte.filter(function (p) { return p.hatBilder; }).length;
      var passen = Math.floor((w - 40) / (C.produkte.kachelMinBreite || 220));
      n = Math.max(n, Math.min(echte, passen));
      if (n === spaltenZahl) return false;
      spaltenZahl = n;
      raster.style.gridTemplateColumns = 'repeat(' + n + ', minmax(0, 1fr))';
      return true;
    }

    function stoppen(k) {
      k.anim.forEach(function (x) { try { x.cancel(); } catch (e) {} });
      k.anim = [];
    }
    function geht(k) {      // a leaving tile: out of the flow, stays where it was while it fades
      k.z.classList.remove('geht');
      k.z.style.left = k.z.style.top = k.z.style.width = '';
    }

    /** Apply filters + sorting. animiert: tiles glide (FLIP), leaving ones fade out, new ones fade in. */
    function ordnen(animiert) {
      var ids = Object.keys(zellen);
      var liste = G.sortieren(G.produkte.filter(passt));
      var neu = {};
      liste.forEach(function (p, i) { neu[p.id] = i; });
      var t = animiert && aktiv ? G.bewegung(C.produkte.umsortieren) : 0;
      var tb = animiert && aktiv ? G.blende(C.produkte.einAusblenden) : 0;
      var basis = raster.getBoundingClientRect();
      // 1. where is everything right now (also in the middle of a running animation)
      var vorher = {};
      ids.forEach(function (id) {
        var k = zellen[id];
        if (k.sichtbar || k.z.classList.contains('geht')) {
          var r = k.z.getBoundingClientRect();
          vorher[id] = { x: r.left - basis.left, y: r.top - basis.top, w: r.width, h: r.height, o: parseFloat(getComputedStyle(k.z).opacity) };
        }
      });
      // 2. the new order
      ids.forEach(function (id) {
        var k = zellen[id];
        stoppen(k);
        geht(k);
        var drin = id in neu;
        k.z.style.order = drin ? neu[id] : 9999;
        k.z.style.display = drin ? '' : 'none';
        k.war = k.sichtbar;
        k.sichtbar = drin;
        var kt = k.a.querySelector('.k-tag');          // (null while a phone flight has lent it – app.js leihen)
        if (drin && kt) kt.laden(30);
      });
      leer.style.display = liste.length ? 'none' : '';
      if (!t && !tb) return;
      var nb = raster.getBoundingClientRect();
      var dy = nb.top - basis.top;    // (the grid itself does not move – but stay safe)
      // 3. animate from the old to the new places
      ids.forEach(function (id) {
        var k = zellen[id], v = vorher[id];
        if (k.sichtbar && v && k.war) {
          var r = k.z.getBoundingClientRect();
          var x = v.x - (r.left - nb.left), y = v.y - (r.top - nb.top) - dy;
          if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) {
            k.anim.push(k.z.animate([{ transform: 'translate(' + x + 'px,' + y + 'px)' }, { transform: 'none' }], { duration: t || 1, easing: C.kurve }));
          }
          if (v.o < 0.99) k.anim.push(k.z.animate([{ opacity: v.o }, { opacity: 1 }], { duration: tb || 1, easing: C.kurveRein }));
        } else if (k.sichtbar) {                                            // arrives
          var von = v ? v.o : 0;
          k.anim.push(k.z.animate(t ? [{ opacity: von, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }] : [{ opacity: von }, { opacity: 1 }],
            { duration: tb || 1, delay: t ? t * 0.35 : 0, easing: C.kurveRein, fill: 'backwards' }));
        } else if (v && v.o > 0.01) {                                       // leaves: stays at its old place while fading
          k.z.classList.add('geht');
          k.z.style.display = '';
          k.z.style.left = v.x + 'px';
          k.z.style.top = v.y + 'px';
          k.z.style.width = v.w + 'px';
          var a = k.z.animate(t ? [{ opacity: v.o, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }] : [{ opacity: v.o }, { opacity: 0 }],
            { duration: tb || 1, easing: C.kurveRaus, fill: 'forwards' });
          k.anim.push(a);
          a.onfinish = function () { if (!k.sichtbar) { geht(k); k.z.style.display = 'none'; stoppen(k); } };
        }
      });
    }

    /* ---- rising: on opening the page, the visible tiles rise one after the other in reading order;
       tiles further down rise when they scroll into view ---- */
    var beobachter = null, gesehen = {};
    function welleEintrag(k) {
      var tag = k.a.querySelector('.k-tag');
      return { els: [tag, k.name], bereit: G.bildBereit(tag, 30) };
    }
    function leseReihenfolge(liste) {
      return liste.map(function (k) { return { k: k, r: k.a.getBoundingClientRect() }; })
        .sort(function (a, b) { return Math.abs(a.r.top - b.r.top) > 4 ? a.r.top - b.r.top : a.r.left - b.r.left; })
        .map(function (x) { return x.k; });
    }
    function welle() {
      if (G.modus === 'aus') return;
      var vh = window.innerHeight, jetzt = [], spaeter = [];
      gesehen = {};
      Object.keys(zellen).forEach(function (id) {
        var k = zellen[id];
        if (!k.sichtbar) return;
        var r = k.a.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) jetzt.push(k); else spaeter.push(k);
      });
      G.welle.einreihen(leseReihenfolge(jetzt).map(function (k) { gesehen[k.p.id] = true; return welleEintrag(k); }));
      if (!window.IntersectionObserver) return;
      if (!beobachter) {
        var stapel = [];
        beobachter = new IntersectionObserver(function (eintraege) {
          eintraege.forEach(function (e) {
            if (!e.isIntersecting) return;
            beobachter.unobserve(e.target);
            var k = zellen[e.target.dataset.id];
            if (k && !gesehen[k.p.id]) { gesehen[k.p.id] = true; stapel.push(k); }
          });
          if (stapel.length) { G.welle.einreihen(leseReihenfolge(stapel).map(welleEintrag)); stapel = []; }
        });
      }
      spaeter.forEach(function (k) {
        var kt = k.a.querySelector('.k-tag');
        if (kt) kt.classList.add('vor-aufstieg');
        k.name.classList.add('vor-aufstieg');
        beobachter.observe(k.a);
      });
    }

    function vorschauAnwenden(v) {   // (tree mode) hovering a branch previews its effect
      letzteVorschau = v;
      Object.keys(zellen).forEach(function (id) {
        var k = zellen[id];
        var gedimmt = false, leise = false, hervor = false;
        if (v && v.filter) gedimmt = !(v.filter === 'all' || k.p.kategorie === v.filter);
        if (v && v.produkt) { hervor = v.produkt === id; leise = !hervor; }
        k.z.classList.toggle('gedimmt', gedimmt);
        k.z.classList.toggle('leise', leise);
        k.a.classList.toggle('hervor', hervor);
      });
    }

    return {
      init: function () {
        var b = seiteBauen('seite-produkte', 'Products');
        s = b.seite; spalte = b.spalte;
        raster = G.el('div', 'raster');
        G.produkte.forEach(function (p) {
          var k = zelleBauen(p);
          zellen[p.id] = k;
          raster.appendChild(k.z);
        });
        leer = G.el('p', 'raster-leer', 'No products in this selection yet.');
        spalte.appendChild(raster);
        spalte.appendChild(leer);
        spaltenSetzen();
        formatPruefen();
        ordnen(false);
        window.addEventListener('resize', function () { spaltenSetzen(); formatPruefen(); });
      },
      zeigen: function (r, info) {
        aktiv = true;
        s.classList.add('aktiv');
        if (!G.LEISTE && (r.kategorie || null) !== filterBaum) { filterBaum = r.kategorie || null; ordnen(true); }
        else ordnen(false);
        // opening the page rises the tiles – not when coming back from a product (its viewer flies into the tile)
        var vorher = info && info.vorher;
        if (!vorher || !{ produkt: 1, customize: 1, order: 1, payment: 1 }[vorher.seite]) welle();
      },
      verbergen: function () { aktiv = false; s.classList.remove('aktiv'); vorschauAnwenden(null); },
      vorschau: function (v) { vorschauAnwenden(v); },
      /** Filters or sorting changed. */
      neu: function () { ordnen(true); },
      kachelFuer: function (id) { return zellen[id] && zellen[id].sichtbar ? zellen[id].a : null; },
      /** Start screen: the images of all tiles that have a real file coming (Promises: loaded + decoded). */
      startBilder: function () {
        var liste = [];
        Object.keys(zellen).forEach(function (id) {
          Array.prototype.forEach.call(zellen[id].a.querySelectorAll('.ph-folgt'), function (ph) {
            var j = ph.laden(40);
            if (j) G.lader.sofort(j);           // small files: all at once, past the queue
            liste.push(G.bildBereit(ph, 40));
          });
        });
        // phone upright with portrait pictures: their small copies too (a tile then opens upwards into the portrait picture)
        G.produkte.forEach(function (p) {
          var u = !p.dummy && G.formatFuer(p) === 'hoch' ? G.pfade.kachel(p, 'hoch') : null;
          if (!u) return;
          var j = G.lader.bild(u, 40);
          G.lader.sofort(j);
          liste.push(new Promise(function (ok) { j.dann(function () { ok(); }); }));
        });
        return liste;
      },
      seite: function () { return s; },
      /** (tree mode) the grid row closest to the visible top – the tree's active branch docks here. */
      andock: function () {
        var vh = window.innerHeight, beste = null, bt = 0, bl = 0;
        Object.keys(zellen).forEach(function (id) {
          var k = zellen[id];
          if (!k.sichtbar) return;
          var r = k.a.getBoundingClientRect();
          if (r.bottom <= 40 || r.top >= vh - 40) return;
          if (!beste || r.top < bt - 1 || (Math.abs(r.top - bt) <= 1 && r.left < bl)) { beste = k.a; bt = r.top; bl = r.left; }
        });
        return beste;
      }
    };
  })();

  /* =================================================================
     PRODUCT PAGE – one page with four modes, all inside the FREE area (left screen edge up to the bars):
       produkt    ONLY the image/video. Glass bar: the full picture (12:5, from format) covers the whole screen, also behind the bar,
                  its centre in the middle of the free area; furniture never cut, ultrawide fades out (G.buehne, legen()).
                  Tree mode: the 16:9 crop, centred.
       customize  axonometry large on the left, next to it a separate narrow field for sliders/options (empty for now)
       order      "To Order": overview – tile image, name, placeholders for dimensions/options and price
       payment    placeholder with a disabled "Pay" button
     ================================================================= */
  G.seiteProdukt = (function () {
    var s, frei, buehne, axoHuelle, ordBild, ordName, ordWerte, payName, viewer = null, produkt = null, aktiv = false;

    function el(tag, cls, text, eltern) { var e = G.el(tag, cls, text); if (eltern) eltern.appendChild(e); return e; }

    /** Glass bar: lay the picture onto the screen (G.buehne – covers, ultrawide with soft sides, furniture never cropped). */
    function cssPx(name) { return parseFloat(document.documentElement.style.getPropertyValue(name)) || 0; }
    /** The phone was turned (or the window changed shape): the other picture format – a viewer with those pictures
        takes over view and lamp. During a move: afterwards. */
    function formatPruefen() {
      var f = G.formatFuer(produkt);
      if (f === viewer.format || viewer.el.parentNode !== buehne) return;
      if (viewer.belegt) { var v0 = viewer; v0.wennRuhig(function () { if (viewer === v0) legen(); }); return; }
      var alt = viewer, neu = G.viewerFuer(produkt, f);
      alt.onwechsel = null;
      buehne.removeChild(alt.el);
      neu.uebernehmen(alt.aktuell, alt.lampe);
      viewer = neu;
      viewer.onwechsel = function () { G.app.viewerGeaendert(); };
      buehne.appendChild(viewer.el);
      if (aktiv) viewer.vorladen('aktiv');
      G.app.viewerGeaendert();
    }
    function legen() {
      if (!G.LEISTE || !produkt || !viewer) return;
      formatPruefen();
      var W = window.innerWidth, H = window.innerHeight;
      var m = G.buehne(produkt, viewer.format, W, H, cssPx('--frei-r'), cssPx('--frei-u'));
      var st = buehne.style;
      st.left = m.left + 'px'; st.top = m.top + 'px'; st.width = m.width + 'px'; st.height = m.height + 'px';
      st.transform = 'none';
      buehne.dataset.art = m.art;
      if (viewer.el.parentNode === buehne) viewer.maske(m.maske);
      return m;
    }

    /* placeholders: in bar mode the order shows "to be chosen", in tree mode the tree's parameter values */
    function werteFuellen() {
      if (!produkt) return;
      ordWerte.textContent = '';
      var zeile = function (dt, dd, cls) { el('dt', cls, dt, ordWerte); el('dd', cls, dd, ordWerte); };
      if (G.LEISTE) {
        zeile('Dimensions', '— (placeholder)');
        zeile('Options', '— (placeholder)');
      } else {
        G.PARAMETER.forEach(function (pa) {
          var w = G.parameterVon(produkt.id)[pa.id];
          zeile(pa.name, w + (pa.einheit ? ' ' + pa.einheit : ''));
        });
      }
      zeile('Price', '€ —  (placeholder)', 'preis');
    }

    function produktSetzen(p) {
      // (a viewer on its way home into its tile stays there – it comes back by itself, see viewerHolen)
      if (viewer) { viewer.onwechsel = null; if (viewer.el.parentNode === buehne) buehne.removeChild(viewer.el); }
      produkt = p;
      viewer = G.viewerFuer(p);
      viewer.onwechsel = function () { G.app.viewerGeaendert(); };
      buehne.appendChild(viewer.el);
      s.style.setProperty('--a', String(G.anzeige(p).verhaeltnis));   // the stage covers the screen in the pictures' aspect ratio
      legen();
      // axonometry (customize) and tile image (order) – placeholders that know their future file
      axoHuelle.textContent = '';
      axoHuelle.appendChild(G.platzhalter({ pfad: G.pfade.axo(p), text: p.code + ' · axonometry' + (p.dummy ? ' · dummy' : ''), klasse: 'p-axo-bild', alt: p.code + ', axonometry' }));
      ordBild.textContent = '';
      var kb = G.platzhalter({ pfad: G.pfade.kachel(p), text: p.code + ' · View 1', fuge: true, klasse: 'p-ord-ph', alt: p.code });
      ordBild.appendChild(kb);
      ordBild.style.setProperty('--kpos', G.kachelPosition(p));
      kb.laden(30);
      ordName.textContent = p.code + (p.dummy ? ' (dummy)' : '');
      payName.textContent = p.code;
    }

    return {
      init: function () {
        s = G.el('section', 'seite seite-produkt');
        s.setAttribute('aria-label', 'Product');
        document.getElementById('seiten').appendChild(s);
        frei = el('div', 'p-frei', null, s);

        // produkt: only the image
        var ansicht = el('div', 'p-modus p-ansicht', null, frei);
        buehne = el('div', 'p-buehne', null, ansicht);

        // customize: axonometry + separate narrow field (empty frame for now)
        var cust = el('div', 'p-modus p-customize', null, frei);
        axoHuelle = el('div', 'p-axo', null, cust);
        var optionen = el('div', 'p-optionen', null, cust);
        optionen.setAttribute('aria-label', 'Options');
        el('p', 'p-optionen-titel', 'Options', optionen);
        el('p', 'p-hinweis', 'Placeholder – sliders and options for dimensions, finish and shelves will sit here.', optionen);

        // to order: overview
        var ord = el('div', 'p-modus p-order', null, frei);
        var karte = el('div', 'p-karte', null, ord);
        ordBild = el('div', 'p-ord-bild', null, karte);
        ordName = el('h1', 'p-titel', null, karte);
        ordWerte = el('dl', 'werte', null, karte);
        el('p', 'p-hinweis', 'Everything here is a placeholder – nothing can be ordered yet.', karte);

        // payment: placeholder
        var pay = el('div', 'p-modus p-payment', null, frei);
        var pk = el('div', 'p-karte p-karte-schmal', null, pay);
        el('h1', 'p-titel', 'Payment', pk);
        payName = el('p', 'p-hinweis', null, pk);
        el('p', 'p-hinweis', 'Payment methods follow here (placeholder).', pk);
        var kauf = el('button', 'kaufen', 'Pay', pk);
        kauf.type = 'button';
        kauf.disabled = true;
        kauf.title = 'Not available yet';

        document.addEventListener('keydown', function (e) {
          if (!aktiv || !viewer || s.dataset.modus !== 'produkt' || e.metaKey || e.ctrlKey || e.altKey) return;
          if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
          var n = parseInt(e.key, 10);
          if (n >= 1 && n <= viewer.n) viewer.waehlen(n);
          if ((e.key === 'l' || e.key === 'L') && produkt.leuchtmittel) viewer.lampeSchalten();
        });
      },
      zeigen: function (r) {
        aktiv = true;
        var andersGedreht = viewer && viewer.format !== G.formatFuer(r.produkt) && viewer.el.parentNode === buehne;
        if (r.produkt !== produkt || andersGedreht) produktSetzen(r.produkt);
        else legen();
        s.dataset.modus = r.seite;
        werteFuellen();
        viewer.vorladen('aktiv');
        if (r.seite === 'customize') { var ph = axoHuelle.firstChild; if (ph && ph.laden) ph.laden(60); }
        s.classList.add('aktiv');
      },
      verbergen: function () { aktiv = false; s.classList.remove('aktiv'); },
      info: function () { return viewer && aktiv ? viewer.info() : null; },
      viewer: function () { return aktiv ? viewer : null; },
      /** The viewer on the stage (also when the page is hidden) – e.g. for the way back into the tile. */
      viewerObj: function () { return viewer; },
      viewerEl: function () { return viewer ? viewer.el : null; },
      /** A viewer comes back from its tile: onto the stage if its product is shown, otherwise out of the page. */
      viewerHolen: function (v) {
        if (v === viewer) { if (v.el.parentNode !== buehne) buehne.appendChild(v.el); legen(); }
        else if (v.el.parentNode) v.el.parentNode.removeChild(v.el);
      },
      /** Window or bar changed: lay the picture anew. Returns the layout (or undefined). */
      legen: legen,
      parameterGeaendert: werteFuellen,
      /** (tree mode) where the active branch docks */
      andock: function () {
        if (!viewer) return null;
        var m = s.dataset.modus;
        if (m === 'order' || m === 'payment') return s.querySelector('.p-' + m + ' .p-karte');
        if (m === 'customize') return axoHuelle;
        return viewer.el;
      }
    };
  })();

  /* =================================================================
     ABOUT US – centred on the screen, three sections stacked: Concept · Studio · Contact
     ================================================================= */
  G.seiteAbout = (function () {
    var s, text, kontakt;
    return {
      init: function () {
        var b = seiteBauen('seite-about', G.bereichName('about'));
        s = b.seite;
        text = G.el('div', 'about-text');
        text.dataset.andockAbstand = '14';   // (tree mode) the line stops a little before the text
        text.innerHTML =
          '<h1 class="nur-vorlesen"></h1>' +
          '<section class="about-teil" aria-labelledby="about-konzept">' +
            '<h2 class="about-titel" id="about-konzept">Concept</h2>' +
            '<p>Every gauge object is made of stainless steel, nothing else. Each piece is cut and folded from sheet metal and held together with screws, never welded. ' +
            'That means it can be taken apart, moved and put back together at any time.</p>' +
            '<p>Every product can be adjusted: size, proportions and details. You set them yourself in our shop.</p>' +
          '</section>' +
          '<section class="about-teil" aria-labelledby="about-studio">' +
            '<h2 class="about-titel" id="about-studio">Studio</h2>' +
            '<p>gauge is a collective of architects, designers and steelworkers who came together to make products.</p>' +
          '</section>' +
          '<section class="about-teil about-kontakt" id="contact" aria-labelledby="about-kontakt">' +
            '<h2 class="about-titel" id="about-kontakt">Contact</h2>' +
            '<p>Taipei: placeholder address, <a href="tel:+886000000000">+886 0 0000 0000</a>, <a href="mailto:taipei@gauge.example">taipei@gauge.example</a></p>' +
            '<p>Berlin: placeholder address, <a href="tel:+4900000000000">+49 00 0000 0000</a>, <a href="mailto:berlin@gauge.example">berlin@gauge.example</a></p>' +
          '</section>';
        text.querySelector('h1').textContent = G.bereichName('about');
        kontakt = text.querySelector('#contact');
        b.spalte.appendChild(text);
      },
      zeigen: function (r, info) {
        s.classList.add('aktiv');
        // "Contact us" (Bespoke): bring the Contact section into view
        if (info && info.kontakt) {
          var weich = G.modus === 'voll';
          requestAnimationFrame(function () { kontakt.scrollIntoView({ block: 'nearest', behavior: weich ? 'smooth' : 'auto' }); });
        }
      },
      verbergen: function () { s.classList.remove('aktiv'); },
      andock: function () { return text; }
    };
  })();

  /* =================================================================
     BESPOKE – custom pieces outside the shop; centred on the screen as one calm block
     ================================================================= */
  G.seiteBespoke = (function () {
    var s;
    return {
      init: function () {
        var b = seiteBauen('seite-bespoke', G.bereichName('bespoke'));
        s = b.seite;
        var text = G.el('div', 'about-text');
        text.innerHTML =
          '<h1 class="about-titel"></h1>' +
          '<p>We build custom steel pieces of any kind, from a single lamp to a full kitchen or a staircase.</p>' +
          '<p>Private client, architect or design studio, one piece or a whole project: tell us what you have in mind, and we will make it in steel.</p>' +
          '<p class="about-weiter"><a href="#/about">Contact us</a></p>';
        text.querySelector('.about-titel').textContent = G.bereichName('bespoke');
        // "Contact us" leads to the Contact section on About Us
        text.querySelector('.about-weiter a').addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          G.router.geh('about', { kontakt: true });
        });
        b.spalte.appendChild(text);
      },
      zeigen: function () { s.classList.add('aktiv'); },
      verbergen: function () { s.classList.remove('aktiv'); },
      andock: function () { return null; }
    };
  })();
})();
