/* gauge – the navigation tree ("logic tree"), the only control element.
   Desktop: vertical tree in the left margin (rows are keyed, so they grow, fold and slide instead of being redrawn).
   Mobile:  horizontal path line at the bottom + a small sheet with the branches.
   Also draws the fine line from the active node into the content. */
(function () {
  'use strict';
  var G = window.G, C = G.C;

  /* Shared state (filters, sorting, parameters) lives in kern.js. */
  var NAMEN = { products: 'Products', gallery: 'Gallery', about: 'About', customize: 'Customize', order: 'Order' };
  function katName(id) { for (var i = 0; i < G.KATEGORIEN.length; i++) if (G.KATEGORIEN[i].id === id) return G.KATEGORIEN[i].name; return id; }

  /* ---------------- Model: route → rows ---------------- */
  function modell(r) {
    var zeilen = [{ key: '', typ: 'wurzel', label: 'g', ziel: '' }];
    if (r.seite === 'start') return zeilen;
    var s = r.pfad.split('/');
    s.forEach(function (seg, i) {
      var key = s.slice(0, i + 1).join('/');
      var d = { key: key, typ: 'pfad', ziel: key, extras: [] };
      if (i === 0) d.label = NAMEN[seg];
      else if (i === 1) d.label = katName(seg);
      else if (i === 2) d.label = r.produkt.code;
      else d.label = NAMEN[seg];
      if (i === 2) { d.extras.push('views'); if (r.produkt.leuchtmittel) d.extras.push('lampe'); }
      zeilen.push(d);
    });
    var p = r.pfad, aeste = [];
    if (r.seite === 'products' && !r.kategorie) {
      G.KATEGORIEN.forEach(function (k) {
        aeste.push({ key: p + '/' + k.id, ziel: p + '/' + k.id, label: k.name, vorschau: { filter: k.id } });
      });
    } else if (r.seite === 'products') {
      G.sortieren(G.produkte.filter(function (x) { return r.kategorie === 'all' || x.kategorie === r.kategorie; }))
        .forEach(function (x) {
          aeste.push({ key: p + '/' + x.id, ziel: p + '/' + x.id, label: x.code, vorschau: { produkt: x.id }, dummy: x.dummy });
        });
    } else if (r.seite === 'produkt') {
      aeste.push({ key: p + '/customize', ziel: p + '/customize', label: 'Customize' });
    } else if (r.seite === 'customize') {
      G.PARAMETER.forEach(function (pa) {
        aeste.push({ key: p + '#' + pa.id, art: 'param', param: pa, label: pa.name });
      });
      aeste.push({ key: p + '/order', ziel: p + '/order', label: 'Order' });
    }
    aeste.forEach(function (a) { a.typ = 'ast'; });
    return zeilen.concat(aeste);
  }

  /* ---------------- Desktop tree ---------------- */
  var nav, liste, karte = {}, route = null, aktuelleZeile = null;
  var vorschauUhr = null, schmalUhr = null;

  function einfuegenNach(z, vor) {
    if (!vor) liste.insertBefore(z, liste.firstChild);
    else liste.insertBefore(z, vor.nextSibling);
  }

  function klick(d) {
    clearTimeout(vorschauUhr);
    G.app.vorschau(null);
    if (d.art === 'param') {
      G.zustand.offenerParameter = G.zustand.offenerParameter === d.param.id ? null : d.param.id;
      paramZustand();
      return;
    }
    if (d.ziel === undefined) return;
    if (route && d.ziel === route.pfad) return;
    G.router.geh(d.ziel);
  }

  function zeileBauen(d) {
    var z = G.el('div', 'zeile');
    z.dataset.key = d.key;
    var innen = G.el('div', 'zeile-innen');
    innen.appendChild(G.el('span', 'stamm'));
    innen.appendChild(G.el('span', 'zweig'));
    var kopf = G.el('div', 'zeile-kopf');
    var knopf = G.el('button', 'knopf');
    knopf.type = 'button';
    if (d.typ === 'wurzel') {
      knopf.appendChild(G.el('span', 'wurzel-g', 'g'));
      knopf.setAttribute('aria-label', 'gauge – back to the start');
      knopf.title = 'gauge';
    } else {
      knopf.appendChild(G.el('span', 'knoten'));
      knopf.appendChild(G.el('span', 'wort', d.label));
    }
    kopf.appendChild(knopf);
    kopf.appendChild(G.el('span', 'extras'));
    innen.appendChild(kopf);
    innen.appendChild(G.el('div', 'extras-unten'));
    z.appendChild(innen);
    knopf.addEventListener('click', function () { klick(z._d); });
    z.addEventListener('mouseenter', function () {
      var dd = z._d;
      if (!dd.vorschau || !C.baum.hoverVorschau || z.classList.contains('weg')) return;
      clearTimeout(vorschauUhr);
      vorschauUhr = setTimeout(function () { G.app.vorschau(dd.vorschau); }, C.baum.vorschauVerzoegerung);
    });
    z.addEventListener('mouseleave', function () {
      if (!z._d.vorschau) return;
      clearTimeout(vorschauUhr);
      G.app.vorschau(null);
    });
    return z;
  }

  /* --- extras: views row, lamp switch, parameter sliders (no sorting: always newest first) --- */
  function viewsReihe(mitLampe) {
    var info = G.app.viewerInfo();
    var reihe = G.el('div', 'views');
    if (!info) return reihe;
    for (var i = 1; i <= info.anzahl; i++) (function (i) {
      var b = G.el('button', 'view', String(i));
      b.type = 'button';
      b.title = 'View ' + i;
      b.setAttribute('aria-label', 'View ' + i);
      var an = (info.ziel || info.aktuell) === i;
      b.classList.toggle('aktiv', an);
      b.classList.toggle('vorgemerkt', !an && info.wartend === i);
      b.setAttribute('aria-pressed', an ? 'true' : 'false');
      b.addEventListener('click', function (e) { e.stopPropagation(); G.app.viewWaehlen(i); });
      reihe.appendChild(b);
    })(i);
    if (mitLampe) {
      var l = G.el('button', 'lampe');
      l.type = 'button';
      l.appendChild(G.icon('lampe', 15, 1.5));
      l.title = info.lampe ? 'Light off' : 'Light on';
      l.setAttribute('aria-label', 'Lamp');
      l.setAttribute('aria-pressed', info.lampe ? 'true' : 'false');
      l.classList.toggle('an', !!info.lampe);
      l.addEventListener('click', function (e) { e.stopPropagation(); G.app.lampeSchalten(); });
      reihe.appendChild(l);
    }
    return reihe;
  }

  function regler(pa, pid) {
    var huelle = G.el('div', 'regler-huelle');
    var innen = G.el('div', 'regler');
    var werte = G.parameterVon(pid);
    var inp = document.createElement('input');
    inp.type = 'range';
    inp.min = pa.min; inp.max = pa.max; inp.step = pa.schritt; inp.value = werte[pa.id];
    inp.setAttribute('aria-label', pa.name);
    var wert = G.el('span', 'regler-wert');
    function zeigen() { wert.textContent = inp.value + (pa.einheit ? ' ' + pa.einheit : ''); }
    zeigen();
    inp.addEventListener('input', function () {
      werte[pa.id] = Number(inp.value);
      zeigen();
      G.app.parameterGeaendert();
    });
    innen.appendChild(inp);
    innen.appendChild(wert);
    innen.appendChild(G.el('span', 'regler-hinweis', 'placeholder'));
    huelle.appendChild(innen);
    return huelle;
  }

  function extrasFuellen(z, d) {
    var ex = z.querySelector('.extras'), un = z.querySelector('.extras-unten');
    var sig = (d.extras || []).join(',') + '|' + (d.art || '') + '|' + (d.typ === 'pfad' ? 'p' : '');
    var neuBauen = z._sig !== sig || d.art !== 'param';
    if (!neuBauen) return;
    z._sig = sig;
    ex.textContent = '';
    un.textContent = '';
    if (d.typ === 'pfad' && d.extras.indexOf('views') >= 0) un.appendChild(viewsReihe(d.extras.indexOf('lampe') >= 0));
    if (d.art === 'param') un.appendChild(regler(d.param, route.produkt.id));
  }

  function paramZustand() {
    Object.keys(karte).forEach(function (k) {
      var z = karte[k];
      if (z._d && z._d.art === 'param') z.classList.toggle('offen', G.zustand.offenerParameter === z._d.param.id);
    });
    handyFeldFuellen();
  }

  function zeileAktualisieren(z, d) {
    z.classList.remove('wurzel', 'pfad', 'ast');
    z.classList.add(d.typ);
    z.classList.toggle('param', d.art === 'param');
    z.classList.toggle('dummy', !!d.dummy);
    var wort = z.querySelector('.wort');
    if (wort && wort.textContent !== d.label) wort.textContent = d.label;
    var knopf = z.querySelector('.knopf');
    if (d.typ !== 'wurzel') knopf.setAttribute('aria-label', d.label);
    extrasFuellen(z, d);
  }

  function renderDesktop(zeilen, sofort) {
    var gewollt = {}, vor = null, neuZaehler = 0;
    var staffel = G.bewegung(C.baum.staffelung);
    zeilen.forEach(function (d) {
      gewollt[d.key] = true;
      var z = karte[d.key];
      var neu = !z;
      if (neu) { z = zeileBauen(d); karte[d.key] = z; }
      z._d = d;
      zeileAktualisieren(z, d);
      if (neu) einfuegenNach(z, vor);
      else if (vor && !(vor.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING)) einfuegenNach(z, vor);
      if (z.classList.contains('weg')) {
        clearTimeout(z._uhr);
        z.classList.remove('weg', 'nachlauf');
        z.classList.add('da');
      }
      if (neu) {
        if (sofort) {
          z.classList.add('ohne', 'da');
        } else {
          z.style.transitionDelay = (neuZaehler * staffel) + 'ms';
          neuZaehler++;
          void z.offsetHeight;
          z.classList.add('da');
          (function (zz) { setTimeout(function () { zz.style.transitionDelay = ''; }, neuZaehler * staffel + C.baum.wachsen + 50); })(z);
        }
      }
      vor = z;
    });
    var letzte = vor;
    Object.keys(karte).forEach(function (k) {
      var z = karte[k];
      z.classList.toggle('letzte', z === letzte);
      if (gewollt[k]) return;
      if (!z.classList.contains('weg')) {
        z.classList.remove('da');
        z.classList.add('weg');
        z.style.transitionDelay = '';
        z._uhr = setTimeout(function () {
          if (!z.classList.contains('weg')) return;
          if (z.parentNode) z.parentNode.removeChild(z);
          if (karte[k] === z) delete karte[k];
        }, G.bewegung(C.baum.klappen) + G.blende(0) + 120);
      }
      // rows folding away below the last row must not continue the trunk
      z.classList.toggle('nachlauf', !!(letzte.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    if (sofort) requestAnimationFrame(function () { requestAnimationFrame(function () {
      Object.keys(karte).forEach(function (k) { karte[k].classList.remove('ohne'); });
    }); });
    aktuelleZeile = null;
    zeilen.forEach(function (d) { if (d.typ !== 'ast') aktuelleZeile = karte[d.key]; });
    Object.keys(karte).forEach(function (k) { karte[k].classList.toggle('aktuell', karte[k] === aktuelleZeile); });
    paramZustand();
  }

  /* --- collapsed tree (thin line with dots) on pages that need the space --- */
  function schmalSetzen(an) {
    nav.classList.toggle('schmal', an);
    if (!an) nav.classList.remove('offen');
  }
  function schmalOeffnen() { clearTimeout(schmalUhr); nav.classList.add('offen'); }
  function schmalSchliessen(sofort) {
    clearTimeout(schmalUhr);
    schmalUhr = setTimeout(function () { nav.classList.remove('offen'); }, sofort ? 0 : C.baum.schmalZuVerzoegerung);
  }

  /* ---------------- Mobile: bottom path line + branch sheet ---------------- */
  var leiste, spur, feld, feldInnen, handySchluessel = {}, handyZeilen = [];

  function handyBauen() {
    leiste = G.el('nav', 'pfadleiste');
    leiste.setAttribute('aria-label', 'Navigation');
    spur = G.el('div', 'pl-spur');
    leiste.appendChild(spur);
    feld = G.el('div', 'astfeld');
    feld.setAttribute('aria-hidden', 'true');
    feldInnen = G.el('div', 'af-innen');
    feld.appendChild(feldInnen);
    document.body.appendChild(feld);
    document.body.appendChild(leiste);
    document.addEventListener('pointerdown', function (e) {
      if (!feld.classList.contains('offen')) return;
      if (feld.contains(e.target) || leiste.contains(e.target)) return;
      feldZu();
    });
  }
  function feldAuf() { feld.classList.add('offen'); feld.setAttribute('aria-hidden', 'false'); leiste.classList.add('feld-offen'); }
  function feldZu() { feld.classList.remove('offen'); feld.setAttribute('aria-hidden', 'true'); leiste.classList.remove('feld-offen'); }

  function renderHandy(zeilen) {
    handyZeilen = zeilen;
    var neueSchluessel = {};
    spur.textContent = '';
    var pfad = zeilen.filter(function (d) { return d.typ !== 'ast'; });
    var aeste = zeilen.filter(function (d) { return d.typ === 'ast'; });
    pfad.forEach(function (d, i) {
      neueSchluessel[d.key] = true;
      var neu = !handySchluessel[d.key];
      if (i > 0) {
        var linie = G.el('span', 'pl-linie' + (neu ? ' neu' : ''));
        spur.appendChild(linie);
      }
      var b = G.el('button', 'pl-knoten' + (neu ? ' neu' : ''));
      b.type = 'button';
      if (d.typ === 'wurzel') { b.classList.add('wurzel'); b.appendChild(G.el('span', 'wurzel-g', 'g')); b.setAttribute('aria-label', 'gauge – back to the start'); }
      else { b.appendChild(G.el('span', 'knoten')); b.appendChild(G.el('span', 'wort', d.label)); }
      var letzter = i === pfad.length - 1;
      var hatFeld = aeste.length > 0 || (d.extras && d.extras.length) || pfad.some(function (x) { return x.extras && x.extras.length; });
      if (letzter && d.typ !== 'wurzel') {
        b.classList.add('aktuell');
        if (hatFeld) { b.classList.add('hat-aeste'); b.appendChild(G.el('span', 'pl-pfeil')); b.setAttribute('aria-expanded', 'false'); }
      }
      b.addEventListener('click', function () {
        if (letzter && d.typ !== 'wurzel') { if (hatFeld) { if (feld.classList.contains('offen')) feldZu(); else feldAuf(); b.setAttribute('aria-expanded', feld.classList.contains('offen') ? 'true' : 'false'); } return; }
        feldZu();
        G.router.geh(d.ziel);
      });
      spur.appendChild(b);
    });
    handySchluessel = neueSchluessel;
    requestAnimationFrame(function () { spur.scrollTo ? spur.scrollTo({ left: spur.scrollWidth, behavior: G.modus === 'voll' ? 'smooth' : 'auto' }) : (spur.scrollLeft = spur.scrollWidth); });
    handyFeldFuellen();
  }

  function handyFeldFuellen() {
    if (!feldInnen) return;
    feldInnen.textContent = '';
    var zeilen = handyZeilen;
    var pfad = zeilen.filter(function (d) { return d.typ === 'pfad'; });
    var aeste = zeilen.filter(function (d) { return d.typ === 'ast'; });
    // tools of the nodes on the way (views, lamp)
    pfad.forEach(function (d) {
      if (d.extras.indexOf('views') >= 0) {
        var r2 = G.el('div', 'af-werkzeug');
        r2.appendChild(G.el('span', 'af-titel', 'View'));
        r2.appendChild(viewsReihe(d.extras.indexOf('lampe') >= 0));
        feldInnen.appendChild(r2);
      }
    });
    aeste.forEach(function (d) {
      var zeile = G.el('div', 'af-ast' + (d.dummy ? ' dummy' : ''));
      var b = G.el('button', 'af-knopf');
      b.type = 'button';
      b.appendChild(G.el('span', 'knoten'));
      b.appendChild(G.el('span', 'wort', d.label));
      zeile.appendChild(b);
      if (d.art === 'param') {
        var offen = G.zustand.offenerParameter === d.param.id;
        zeile.classList.toggle('offen', offen);
        zeile.appendChild(regler(d.param, route.produkt.id));
        b.addEventListener('click', function () {
          G.zustand.offenerParameter = offen ? null : d.param.id;
          paramZustand();
        });
      } else {
        b.addEventListener('click', function () { feldZu(); G.router.geh(d.ziel); });
      }
      feldInnen.appendChild(zeile);
    });
  }

  /* ---------------- Line into the content + wall joint ---------------- */
  var svg, linie, dock, wachsStart = 0;

  function verbinderBauen() {
    var ns = 'http://www.w3.org/2000/svg';
    svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'verbinder');
    svg.setAttribute('aria-hidden', 'true');
    linie = document.createElementNS(ns, 'path');
    dock = document.createElementNS(ns, 'rect');
    dock.setAttribute('width', '5'); dock.setAttribute('height', '5');
    dock.setAttribute('rx', String(Math.min(C.eckradius, 2.5)));
    svg.appendChild(linie);
    svg.appendChild(dock);
    document.body.appendChild(svg);
  }

  function weich(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function stammX() {
    var r = liste.getBoundingClientRect();
    return r.left + 4.5;
  }

  function schleife() {
    requestAnimationFrame(schleife);
    var body = document.body;
    var handy = G.istHandy();
    var aus = handy || body.classList.contains('ist-start') || !aktuelleZeile || !C.baum.verbindungslinie;
    if (G.app.proFrame) G.app.proFrame(handy || body.classList.contains('ist-start') ? null : stammX());
    var ziel = aus ? null : G.app.andockZiel();
    if (!ziel) { svg.style.opacity = '0'; return; }
    var kopf = aktuelleZeile.querySelector('.zeile-kopf');
    var knoten = aktuelleZeile.querySelector('.knoten');
    if (!kopf || !knoten) { svg.style.opacity = '0'; return; }
    var schmal = nav.classList.contains('schmal') && !nav.classList.contains('offen');
    var kr = knoten.getBoundingClientRect();
    var ende = schmal ? kr.right : kopf.querySelector('.knopf').getBoundingClientRect().right;
    var ex = kopf.querySelector('.extras');
    if (!schmal && ex && ex.firstChild) ende = Math.max(ende, ex.getBoundingClientRect().right);
    var sx = ende + 8, ny = kr.top + kr.height / 2;
    var tr = ziel.getBoundingClientRect();
    var vh = window.innerHeight;
    if (tr.bottom < 12 || tr.top > vh - 12 || tr.left - sx < 24) { svg.style.opacity = '0'; return; }
    var tx = tr.left - (Number(ziel.dataset.andockAbstand) || 0);
    var ty = G.klemmen(ny, Math.max(tr.top + 8, 12), Math.min(tr.bottom - 8, vh - 12));
    var r = C.eckradius;
    var d, laenge;
    if (Math.abs(ty - ny) < 1) {
      ty = ny;
      d = 'M' + sx + ' ' + ny + 'H' + tx;
      laenge = tx - sx;
    } else {
      var mx = Math.max(sx + 10, tx - 18);
      var dir = ty > ny ? 1 : -1;
      d = 'M' + sx + ' ' + ny + 'H' + (mx - r) + 'Q' + mx + ' ' + ny + ' ' + mx + ' ' + (ny + dir * r) +
          'V' + (ty - dir * r) + 'Q' + mx + ' ' + ty + ' ' + (mx + r) + ' ' + ty + 'H' + tx;
      laenge = (mx - sx) + Math.abs(ty - ny) + (tx - mx);
    }
    linie.setAttribute('d', d);
    dock.setAttribute('x', String(tx - 2.5));
    dock.setAttribute('y', String(ty - 2.5));
    var dauer = G.bewegung(C.baum.wachsen * 1.6);
    var p = dauer ? G.klemmen((performance.now() - wachsStart - G.bewegung(C.baum.wachsen) * 0.5) / dauer, 0, 1) : 1;
    if (p < 1) {
      linie.style.strokeDasharray = laenge + ' ' + laenge;
      linie.style.strokeDashoffset = String(laenge * (1 - weich(p)));
      dock.style.opacity = '0';
    } else {
      linie.style.strokeDasharray = '';
      linie.style.strokeDashoffset = '';
      dock.style.opacity = '1';
    }
    svg.style.opacity = '1';
  }

  /* ---------------- Public ---------------- */
  G.baum = {
    init: function () {
      nav = G.el('nav', 'baum');
      nav.setAttribute('aria-label', 'Navigation');
      liste = G.el('div', 'baum-liste');
      nav.appendChild(liste);
      document.body.appendChild(nav);
      nav.addEventListener('mouseenter', function () { if (nav.classList.contains('schmal')) schmalOeffnen(); });
      nav.addEventListener('mouseleave', function () { if (nav.classList.contains('schmal')) schmalSchliessen(); });
      nav.addEventListener('focusin', function () { if (nav.classList.contains('schmal')) schmalOeffnen(); });
      nav.addEventListener('focusout', function (e) { if (nav.classList.contains('schmal') && !nav.contains(e.relatedTarget)) schmalSchliessen(); });
      // touch: first tap on the collapsed tree only opens it
      nav.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' || !nav.classList.contains('schmal') || nav.classList.contains('offen')) return;
        schmalOeffnen();
        nav._schlucken = true;
      });
      nav.addEventListener('click', function (e) {
        if (nav._schlucken) { nav._schlucken = false; e.stopPropagation(); e.preventDefault(); }
      }, true);
      document.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' && nav.classList.contains('offen') && !nav.contains(e.target)) schmalSchliessen(true);
      });
      handyBauen();
      verbinderBauen();
      requestAnimationFrame(schleife);
    },
    render: function (r, opts) {
      opts = opts || {};
      var vorher = route;
      route = r;
      if (!vorher || vorher.pfad !== r.pfad) G.zustand.offenerParameter = null;
      var zeilen = modell(r);
      var sofort = !!opts.sofort || G.modus === 'aus';
      renderDesktop(zeilen, sofort);
      renderHandy(zeilen);
      feldZu();
      schmalSetzen(r.seite === 'gallery' || r.seite === 'customize');
      wachsStart = sofort ? -1e9 : performance.now();
    },
    /** Re-draw the small tools (views row, lamp, sort) without touching the tree structure. */
    extrasAktualisieren: function () {
      Object.keys(karte).forEach(function (k) {
        var z = karte[k];
        if (z._d && z._d.art !== 'param') { z._sig = null; extrasFuellen(z, z._d); }
      });
      handyFeldFuellen();
    },
    neuZeichnen: function () { if (route) { renderDesktop(modell(route), false); renderHandy(modell(route)); } },
    /** The visible "g" (desktop tree or mobile path line) – target of the start animation. */
    wurzel: function () {
      if (G.istHandy()) return spur.querySelector('.wurzel-g');
      var z = karte[''];
      return z ? z.querySelector('.wurzel-g') : null;
    },
    feldZu: function () { feldZu(); }
  };
})();
