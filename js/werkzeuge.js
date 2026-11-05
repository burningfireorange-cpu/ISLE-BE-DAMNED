/* gauge – the tools of a page, behind the fine divider in the glass bar (phone: in the small glass field above it).
   Each entry: key(route) → a string (same string = same content, it is only updated),
               bauen(route) → { el, aktualisieren(route) }.
   Products   the product code OBJ_TYPE_SIZE_NUMBER – every segment opens a small glass bar with its options
   Product    View 1 · 2 · 3 … · bulb (lighting only) | ← · → Customize
   Customize  ← · → To Order
   To Order   ← · → Payment
   Payment    ←
   The arrow to the left always goes exactly one step back (like browser back). */
(function () {
  'use strict';
  var G = window.G, C = G.C;
  var feld = function (o) { return G.leiste.feld(o); };

  G.WERKZEUGE = {};

  /* ---------------- Products: the code filter OBJ_TYPE_SIZE_NUMBER ----------------
     Placeholders (TYPE, SIZE, NUMBER) light grey, chosen values black and bolder – e.g. OBJ_LT_SIZE_NUMBER.
     Each segment opens a small glass bar above it; after the choice it slides back. "All" = placeholder again.
     NUMBER lists the numbers that exist for the chosen TYPE and SIZE; a number completes the code and opens the product.
     (No sorting: always newest first.) */
  var GROESSEN = [
    { id: 'all', kurz: 'All', name: 'All sizes' },
    { id: 'S', kurz: 'S', name: 'Small' },
    { id: 'M', kurz: 'M', name: 'Medium' },
    { id: 'L', kurz: 'L', name: 'Large' }
  ];
  function geaendert() { G.leiste.weich(function () { G.app.sortierungGeaendert(); }); }

  /** A segment of the code with its option bar. optionen: [{ id, kurz, name }] or a function returning them
      (built anew each time the bar opens). waehlen(id) → true if the filter changed, 'fertig' if it handled everything. */
  function segment(o) {
    var huelle = G.el('span', 'c-seg-huelle');
    var knopf = G.el('button', 'g-seg c-' + o.id);
    knopf.type = 'button';
    knopf.setAttribute('aria-haspopup', 'true');
    knopf.setAttribute('aria-expanded', 'false');
    var text = G.el('span', 'c-text');
    knopf.appendChild(text);
    huelle.appendChild(knopf);

    var bar = G.leiste.glas('g-optionen');
    bar.setAttribute('role', 'menu');
    var reihe = G.el('div', 'g-reihe');
    var opts = {};
    function optionenBauen() {
      reihe.textContent = '';
      opts = {};
      var liste = typeof o.optionen === 'function' ? o.optionen() : o.optionen;
      if (!liste.length) { reihe.appendChild(G.el('span', 'g-opt g-opt-leer', o.leer || '—')); return; }
      liste.forEach(function (op) {
        var b = G.el('button', 'g-opt');
        b.type = 'button';
        b.setAttribute('role', 'menuitemradio');
        b.appendChild(G.el('span', 'g-opt-text', op.kurz));
        if (op.name && op.name !== op.kurz && C.leiste.namensschild) b.appendChild(G.el('span', 'schild', op.name));
        b.setAttribute('aria-label', op.name || op.kurz);
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var neu = o.waehlen(op.id);
          bar.zu();
          if (neu === 'fertig') return;
          if (neu) geaendert(); else aktualisieren();
          knopf.focus({ preventScroll: true });
        });
        opts[op.id] = b;
        reihe.appendChild(b);
      });
    }
    optionenBauen();
    bar.appendChild(reihe);
    huelle.appendChild(bar);
    bar.zu = function () { bar.classList.remove('offen'); knopf.setAttribute('aria-expanded', 'false'); knopf.classList.remove('offen'); };
    bar.auf = function () {
      G.leiste.feldZu();
      if (typeof o.optionen === 'function') { optionenBauen(); markieren(); }
      // centred above the segment, but always inside the window (layout values – the slide transform must not count)
      var h = huelle.getBoundingClientRect(), w = bar.offsetWidth, m = 8;
      var links = h.left + h.width / 2 - w / 2, dx = 0;
      if (links < m) dx = m - links; else if (links + w > window.innerWidth - m) dx = window.innerWidth - m - links - w;
      bar.style.setProperty('--dx', Math.round(dx) + 'px');
      bar.classList.add('offen');
      knopf.classList.add('offen');
      knopf.setAttribute('aria-expanded', 'true');
    };
    knopf.addEventListener('click', function (e) {
      e.stopPropagation();
      if (bar.classList.contains('offen')) bar.zu(); else bar.auf();
    });
    var zuletzt = null;
    function markieren() {
      Object.keys(opts).forEach(function (id) {
        var an = !!zuletzt && id === zuletzt.id;
        opts[id].classList.toggle('aktiv', an);
        opts[id].setAttribute('aria-checked', String(an));
      });
    }
    /** wert: show this instead of the state (the code being completed just before the product opens). */
    function aktualisieren(wert) {
      var z = zuletzt = wert || o.zustand();     // { wert, leer, id, label }
      text.textContent = z.wert;
      knopf.classList.toggle('leer', z.leer);
      knopf.setAttribute('aria-label', o.label + ': ' + z.label);
      markieren();
    }
    return { el: huelle, aktualisieren: aktualisieren };
  }

  G.WERKZEUGE.products = {
    key: function () { return 'products'; },
    bauen: function () {
      var el = G.el('div', 'w-gruppe w-code');
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', 'Product code filter');
      function strich() { return G.el('span', 'c-strich', '_'); }
      el.appendChild(G.el('span', 'c-fest', 'OBJ'));

      var typ = segment({
        id: 'typ', label: 'Type',
        optionen: G.KATEGORIEN.map(function (k) { return { id: k.id, kurz: k.kurz, name: k.name }; }),
        waehlen: function (id) { var neu = G.zustand.art !== id; G.zustand.art = id; return neu; },
        zustand: function () {
          var k = G.KATEGORIEN.filter(function (x) { return x.id === G.zustand.art; })[0] || G.KATEGORIEN[0];
          return k.id === 'all' ? { wert: 'TYPE', leer: true, id: 'all', label: 'all' } : { wert: k.kurz, leer: false, id: k.id, label: k.name };
        }
      });
      var groesse = segment({
        id: 'groesse', label: 'Size',
        optionen: GROESSEN,
        waehlen: function (id) { var neu = G.zustand.groesse !== id; G.zustand.groesse = id; return neu; },
        zustand: function () {
          var g = GROESSEN.filter(function (x) { return x.id === G.zustand.groesse; })[0] || GROESSEN[0];
          return g.id === 'all' ? { wert: 'SIZE', leer: true, id: 'all', label: 'all' } : { wert: g.kurz, leer: false, id: g.id, label: g.name };
        }
      });
      // NUMBER completes the code: the numbers that exist for the chosen TYPE and SIZE; a click opens that product
      var nummer = segment({
        id: 'nummer', label: 'Number', leer: 'No products',
        optionen: function () {
          return G.nachNummer(G.produkte.filter(G.passtFilter)).map(function (p) { return { id: p.id, kurz: G.zwei(p.nummer), name: p.code }; });
        },
        waehlen: function (id) {
          var p = G.produkt(id);
          if (!p) return false;
          // the code is complete for a moment (e.g. OBJ_LT_M_03), then the product page opens
          var k = G.KATEGORIEN.filter(function (x) { return x.id === p.kategorie; })[0];
          typ.aktualisieren({ wert: k ? k.kurz : G.typKurz(p.kategorie), leer: false, id: p.kategorie, label: p.kategorie });
          groesse.aktualisieren({ wert: p.klasse, leer: false, id: p.klasse, label: p.klasse });
          nummer.aktualisieren({ wert: G.zwei(p.nummer), leer: false, id: p.id, label: p.code });
          setTimeout(function () { G.app.produktOeffnen(p, G.seiteProdukte.kachelFuer(p.id)); }, G.blende(C.leiste.codeVollstaendig));
          return 'fertig';
        },
        zustand: function () { return { wert: 'NUMBER', leer: true, id: null, label: 'choose to open a product' }; }
      });
      el.appendChild(strich());
      el.appendChild(typ.el);
      el.appendChild(strich());
      el.appendChild(groesse.el);
      el.appendChild(strich());
      el.appendChild(nummer.el);

      function aktualisieren() { typ.aktualisieren(); groesse.aktualisieren(); nummer.aktualisieren(); }
      aktualisieren();
      return { el: el, aktualisieren: aktualisieren };
    }
  };

  /** → (optional) and ← – always the end of the tools; behind a fine divider if other tools stand before them. */
  function wege(el, weiter) {
    if (el.childNodes.length) el.appendChild(G.el('span', 'w-trenner'));
    // ← first, then → (left arrow on the left, right arrow on the right – they never point at each other)
    el.appendChild(feld({ klasse: 'g-zurueck', icon: 'zurueck', strich: 1.4, schild: 'Back', label: 'Back (one step)',
      klick: function () { G.router.zurueck(); } }));
    if (weiter) {
      el.appendChild(feld({ klasse: 'g-weiter', icon: 'weiter', strich: 1.4, schild: weiter.name, label: 'Next: ' + weiter.name,
        klick: function () { G.router.geh(weiter.pfad); } }));
    }
  }

  /** A fine ring around a view field that fills clockwise (0..1) – shown while the move to this view loads. */
  var SVG = 'http://www.w3.org/2000/svg';
  function ring(b, anteil) {
    if (!b.ring) {
      var s = document.createElementNS(SVG, 'svg');
      s.setAttribute('class', 'g-ring');
      s.setAttribute('viewBox', '0 0 40 40');
      s.setAttribute('aria-hidden', 'true');
      ['g-ring-spur', 'g-ring-wert'].forEach(function (k) {
        var c = document.createElementNS(SVG, 'circle');
        c.setAttribute('class', k);
        c.setAttribute('cx', '20'); c.setAttribute('cy', '20'); c.setAttribute('r', '18');
        c.setAttribute('pathLength', '100');
        s.appendChild(c);
      });
      b.appendChild(s);
      b.ring = s.lastChild;
    }
    b.ring.style.strokeDashoffset = String(100 - Math.max(0, Math.min(1, anteil)) * 100);
  }

  /* ---------------- Product: View 1 · 2 · 3 … · bulb · → Customize · ← ---------------- */
  G.WERKZEUGE.produkt = {
    key: function (r) { return 'produkt:' + r.produkt.id; },
    bauen: function (r) {
      var p = r.produkt;
      // always the viewer on the stage right now (turning the phone swaps it for one with the other picture format)
      function vw() { var v = G.seiteProdukt.viewerObj(); return v && v.p === p ? v : G.viewerFuer(p); }
      var el = G.el('div', 'w-gruppe w-produkt');
      var views = [];
      for (var i = 1; i <= p.views; i++) (function (i) {
        var b = feld({ klasse: 'g-view', text: String(i), schild: 'View ' + i, label: 'View ' + i, klick: function () { vw().waehlen(i); } });
        views.push(b);
        el.appendChild(b);
      })(i);
      var lampe = null;
      if (p.leuchtmittel) {
        lampe = feld({ klasse: 'g-lampe', icon: 'lampe', schild: 'Evening', label: 'Lamp: day / evening', klick: function () { vw().lampeSchalten(); } });
        el.appendChild(lampe);
      }
      wege(el, { name: 'Customize', pfad: 'products/' + p.id + '/customize' });
      function aktualisieren() {
        var info = vw().info();
        // the tapped view is marked at once – never waiting for the net; while its move still loads, a ring fills in it
        var jetzt = info.ziel || info.aktuell;
        views.forEach(function (b, k) {
          var an = jetzt === k + 1;
          var laedt = !!info.laden && info.laden.ziel === k + 1;
          b.classList.toggle('aktiv', an);
          b.classList.toggle('vorgemerkt', !an && !laedt && info.wartend === k + 1);
          b.classList.toggle('laedt', laedt);
          if (laedt || b.ring) ring(b, laedt ? info.laden.anteil : 1);
          b.setAttribute('aria-pressed', String(an));
          b.setAttribute('aria-busy', String(laedt));
        });
        if (lampe) {
          lampe.classList.toggle('an', !!info.lampe);
          lampe.setAttribute('aria-pressed', String(!!info.lampe));
          lampe.querySelector('.schild').textContent = info.lampe ? 'Day' : 'Evening';
        }
      }
      aktualisieren();
      return { el: el, aktualisieren: aktualisieren };
    }
  };

  /* ---------------- Customize · To Order · Payment: only the way on and back ---------------- */
  function nurWeg(klasse, weiter) {
    return function (r) {
      var el = G.el('div', 'w-gruppe ' + klasse);
      wege(el, weiter ? weiter(r.produkt) : null);
      return { el: el, aktualisieren: function () {} };
    };
  }
  G.WERKZEUGE.customize = {
    key: function (r) { return 'customize:' + r.produkt.id; },
    bauen: nurWeg('w-customize', function (p) { return { name: 'To Order', pfad: 'products/' + p.id + '/customize/order' }; })
  };
  G.WERKZEUGE.order = {
    key: function (r) { return 'order:' + r.produkt.id; },
    bauen: nurWeg('w-order', function (p) { return { name: 'Payment', pfad: 'products/' + p.id + '/customize/order/payment' }; })
  };
  G.WERKZEUGE.payment = {
    key: function (r) { return 'payment:' + r.produkt.id; },
    bauen: nurWeg('w-payment', null)
  };
})();
