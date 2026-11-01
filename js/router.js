/* gauge – hash routing.
   bars:  #/products/object_01/customize/order/payment · #/gallery · #/about · #/bespoke
   tree:  #/products/tables/object_01/customize/order
   The browser history is kept as the chain of ancestors of the current node, so that
   "browser back" always means "one node back" – also after a direct link (the chain is built on load). */
(function () {
  'use strict';
  var G = window.G;

  var aktuell = null;          // rendered path ('' = start screen)
  var kette = false;           // true while history entries mirror the ancestor chain
  var ausstehend = null, ausstehendInfo = null, ausstehendUhr = null;
  var beiAnzeige = null;

  function segs(p) { return p ? p.split('/') : []; }
  function tiefe(p) { return segs(p).length; }
  function praefix(p, n) { return segs(p).slice(0, n).join('/'); }
  function gemeinsam(a, b) {
    var x = segs(a), y = segs(b), i = 0;
    while (i < x.length && i < y.length && x[i] === y[i]) i++;
    return i;
  }
  function istKategorie(k) { return G.KATEGORIEN.some(function (c) { return c.id === k; }); }

  /** Turn any hash into the nearest valid path. */
  function normalisieren(p) {
    var s = segs(String(p || '').toLowerCase().replace(/^#?\/?/, '').replace(/\/+$/, ''));
    var out = [];
    if (s[0] === 'products' && G.LEISTE) {
      // bars: #/products/object_01/customize/order/payment  (old links with a category are accepted)
      out.push('products');
      var i = G.produkt(s[1]) ? 1 : (istKategorie(s[1]) && G.produkt(s[2])) ? 2 : 0;
      if (i) {
        out.push(G.produkt(s[i]).id);
        if (s[i + 1] === 'customize') {
          out.push('customize');
          if (s[i + 2] === 'order') {
            out.push('order');
            if (s[i + 3] === 'payment') out.push('payment');
          }
        }
      } else if (s[1] && s[1] !== 'all' && istKategorie(s[1])) {
        G.zustand.art = s[1];                      // #/products/tables → type filter "Tables"
      }
    } else if (s[0] === 'products') {
      out.push('products');
      if (s[1] && istKategorie(s[1])) {
        out.push(s[1]);
        var pr = s[2] ? G.produkt(s[2]) : null;
        if (pr) {
          if (s[1] !== 'all' && pr.kategorie !== s[1]) out[1] = pr.kategorie;
          out.push(pr.id);
          if (s[3] === 'customize') {
            out.push('customize');
            if (s[4] === 'order') out.push('order');
          }
        }
      } else if (s[1] && G.produkt(s[1])) {           // short link #/products/object_01
        var p2 = G.produkt(s[1]);
        out.push(p2.kategorie, p2.id);
      }
    } else if (s[0] === 'gallery' || s[0] === 'about' || (s[0] === 'bespoke' && G.LEISTE)) {
      out.push(s[0]);
    }
    return out.join('/');
  }

  /** Path → description of what to show. */
  function lesen(p) {
    var s = segs(p);
    var r = { pfad: p, seite: 'start', kategorie: null, produkt: null };
    if (s[0] === 'products' && G.LEISTE) {
      r.seite = 'products';
      if (s[1]) { r.produkt = G.produkt(s[1]); r.seite = 'produkt'; }
      if (s[2] === 'customize') r.seite = 'customize';
      if (s[3] === 'order') r.seite = 'order';
      if (s[4] === 'payment') r.seite = 'payment';
    } else if (s[0] === 'products') {
      r.seite = 'products';
      r.kategorie = s[1] || null;
      if (s[2]) { r.produkt = G.produkt(s[2]); r.seite = 'produkt'; }
      if (s[3] === 'customize') r.seite = 'customize';
      if (s[4] === 'order') r.seite = 'order';
    } else if (s[0]) {
      r.seite = s[0];
    }
    return r;
  }

  function hashRoh() { return location.hash.replace(/^#\/?/, ''); }
  function zustand(p) { return { gauge: 1, pfad: p }; }

  function push(p) {
    try { history.pushState(zustand(p), '', '#/' + p); }
    catch (e) { kette = false; location.hash = '#/' + p; }
  }
  function ersetzen(p) {
    try { history.replaceState(zustand(p), '', '#/' + p); }
    catch (e) { location.replace('#/' + p); }
  }

  function anzeigen(p, info) {
    aktuell = p;
    beiAnzeige(p, lesen(p), info || {});
  }

  /** Push all intermediate nodes from the current path down to the target. */
  function absteigen(von, ziel) {
    var c = gemeinsam(von, ziel);
    if (c === tiefe(von)) {
      for (var n = c + 1; n <= tiefe(ziel); n++) push(praefix(ziel, n));
    } else {
      push(ziel);
    }
  }

  /** Navigate to a node. Going up or sideways first walks the real history back, so "back" stays "one node back". */
  function geh(ziel, info) {
    ziel = normalisieren(ziel);
    if (ausstehend !== null) { ausstehend = ziel; ausstehendInfo = info || null; return; }
    if (ziel === aktuell) return;
    var c = gemeinsam(aktuell, ziel);
    var D = tiefe(aktuell);
    if (kette && c < D && history.state && history.state.gauge) {
      ausstehend = ziel;
      ausstehendInfo = info || null;
      clearTimeout(ausstehendUhr);
      ausstehendUhr = setTimeout(function () {   // safety: if the browser never answers, go there directly
        if (ausstehend === null) return;
        var z = ausstehend, i = ausstehendInfo;
        ausstehend = null;
        kette = false;
        push(z);
        anzeigen(z, i);
      }, 700);
      history.go(c - D);
      return;
    }
    absteigen(aktuell, ziel);
    anzeigen(ziel, info);
  }

  function aufNavigation() {
    var roh = hashRoh();
    var p = normalisieren(roh);
    if (ausstehend !== null) {
      var z = ausstehend, info = ausstehendInfo;
      ausstehend = null;
      clearTimeout(ausstehendUhr);
      if (gemeinsam(p, z) === tiefe(p)) {
        aktuell = p;
        absteigen(p, z);
        anzeigen(z, info);
        return;
      }
    }
    if (p === aktuell) return;
    var st = history.state;
    if (!st || !st.gauge) kette = false;      // typed by hand – history no longer mirrors the chain
    if (!st || !st.gauge || roh !== p) ersetzen(p);
    anzeigen(p, { verlauf: true });
  }

  G.router = {
    lesen: lesen,
    normalisieren: normalisieren,
    tiefe: tiefe,
    praefix: praefix,
    aktuell: function () { return aktuell; },
    geh: geh,
    /** One node back (browser back while the chain is intact). */
    zurueck: function () {
      if (!aktuell) return;
      if (kette && history.state && history.state.gauge) history.back();
      else geh(praefix(aktuell, tiefe(aktuell) - 1));
    },
    start: function (fn) {
      beiAnzeige = fn;
      window.addEventListener('popstate', aufNavigation);
      window.addEventListener('hashchange', aufNavigation);
      var roh = hashRoh();
      var p = normalisieren(roh);
      var st = history.state;
      if (st && st.gauge && st.pfad === p) {
        kette = true;                        // reload: the chain already exists
      } else if (!p) {
        ersetzen('');
        kette = true;
      } else {
        // Direct link: the chain of ancestors (so that "back" = one node back) is written at the first user interaction.
        // Browsers (Chrome) skip history entries that a page adds without any interaction – they would be useless.
        ersetzen(p);
        kette = false;
        var kettenAnlegen = function () {
          window.removeEventListener('pointerdown', kettenAnlegen, true);
          window.removeEventListener('keydown', kettenAnlegen, true);
          if (kette || !aktuell || ausstehend !== null) return;
          try {
            history.replaceState(zustand(''), '', '#/');
            for (var n = 1; n <= tiefe(aktuell); n++) history.pushState(zustand(praefix(aktuell, n)), '', '#/' + praefix(aktuell, n));
            kette = true;
          } catch (e) { kette = false; }
        };
        window.addEventListener('pointerdown', kettenAnlegen, true);
        window.addEventListener('keydown', kettenAnlegen, true);
      }
      anzeigen(p, { erstesMal: true });
    }
  };
})();
