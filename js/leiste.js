/* gauge – the glass bar (navigation: 'leiste').
   ONE long, narrow bar with fully rounded ends, frosted glass (the content scrolls visibly behind it).
     Start screen:  Products · Bespoke · Gallery · About Us                     (bottom centre, no Home)
     everywhere else additionally Home at the far left (back to the start screen)
     behind a fine divider the tools of the page (js/werkzeuge.js): the product code filter, views, lamp, arrows.
   Place: bottom centre, horizontal – on the product pages (product, Customize, To Order, Payment) right, vertical,
   in the middle of the screen height. Phone: always bottom centre; the page tools sit in a small glass field above.
   Changing between the places: the bar contracts to a point at its old place and fades out, at the same time it grows
   out of a point at the new place (config.leiste.wechsel, interruptible; only transform + opacity, no blur meanwhile). Same place, other content: the glass grows / shrinks softly.
   Active point: black filled circle, white symbol. Name plates on hover, always towards the screen centre. */
(function () {
  'use strict';
  var G = window.G, C = G.C, L = C.leiste;
  var PRODUKTSEITEN = { produkt: 1, customize: 1, order: 1, payment: 1 };

  var nav, hg, reihe, haupt, trenner, kontext, oben, obenReihe, homeFeld, felder = {};
  var route = null, modus = null, handy = false;
  var gezeigt = { key: null, obj: null };
  var geist = null, geistAnims = [], flipAnims = [], klone = [], flugUhr = null;

  /* ---------------- building blocks (also used by werkzeuge.js) ----------------
     feld({ klasse, icon, text, schild, label, klick })  – a round field with a fine line symbol (or a short text) */
  function feld(o) {
    var b = G.el('button', 'g-feld' + (o.klasse ? ' ' + o.klasse : ''));
    b.type = 'button';
    var sym = G.el('span', 'g-sym');
    if (o.icon) sym.appendChild(G.icon(o.icon, o.iconGroesse || L.icon, o.strich || L.strich));
    if (o.text != null) sym.appendChild(G.el('span', 'g-text', o.text));
    b.appendChild(sym);
    // touch devices (no hover): the active area shows its name next to the symbol (CSS, only in a horizontal bar)
    if (o.name) b.appendChild(G.el('span', 'g-name', o.name));
    if (o.schild && L.namensschild) b.appendChild(G.el('span', 'schild', o.schild));
    b.setAttribute('aria-label', o.label || o.schild || o.text || '');
    langDruecken(b);
    if (o.klick) b.addEventListener('click', function (e) { e.stopPropagation(); o.klick(e); });
    return b;
  }
  /** Touch: pressing a symbol long shows its name plate – without triggering it (the click that follows is swallowed). */
  function langDruecken(b) {
    var uhr = null, start = null, lang = false, weg = null;
    function zu() { b.classList.remove('schild-an'); }
    b.addEventListener('touchstart', function (e) {
      lang = false; clearTimeout(uhr); clearTimeout(weg);
      if (e.touches.length !== 1 || !b.querySelector('.schild')) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      uhr = setTimeout(function () {
        lang = true;
        Array.prototype.forEach.call(document.querySelectorAll('.g-feld.schild-an'), function (x) { x.classList.remove('schild-an'); });
        b.classList.add('schild-an');
      }, L.langDruck || 450);
    }, { passive: true });
    b.addEventListener('touchmove', function (e) {
      if (!start || lang) return;
      var t = e.touches[0];
      if (Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) { clearTimeout(uhr); start = null; }
    }, { passive: true });
    b.addEventListener('touchend', function (e) {
      clearTimeout(uhr); start = null;
      if (!lang) return;
      if (e.cancelable) e.preventDefault();        // no click after a long press
      weg = setTimeout(zu, L.schildNachLangDruck || 900);
    });
    b.addEventListener('touchcancel', function () { clearTimeout(uhr); start = null; if (lang) weg = setTimeout(zu, L.schildNachLangDruck || 900); });
    b.addEventListener('contextmenu', function (e) { if (lang || uhr) e.preventDefault(); });
    // (in case a click still arrives after the long press: swallow it)
    b.addEventListener('click', function (e) { if (lang) { lang = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  }
  /** A piece of glass: the blurred, frosted surface sits in its own layer (so nested glass keeps seeing the page). */
  function glas(klasse) {
    var g = G.el('div', klasse);
    g.appendChild(G.el('div', 'g-hg'));
    return g;
  }

  /* ---------------- where is the bar ---------------- */
  function modusFuer(r) {
    if (handy || !r) return 'unten';
    if (!PRODUKTSEITEN[r.seite]) return 'unten';
    // stage 2: the vertical bar does not fit the window even at its smallest – it goes to the bottom, horizontal
    return feldFuer(true) == null ? 'unten' : 'rechts';
  }

  /* ---------------- fitting into small windows (desktop) ----------------
     Stage 1: the fields – and with them the symbols, gaps and dividers – get smaller, down to leiste.feldMin (still easy
     to hit), until the bar fits: the vertical bar between the top and bottom screen edge (leiste.randSenkrecht each),
     the horizontal one between the side edges (leiste.inhaltRand). Stage 2 (vertical only): see modusFuer. Never cut off;
     on every resize anew. The phone keeps its own sizes (CSS). */
  function laenge(senkrecht, f) {
    var st = nav.style, war = { rechts: nav.classList.contains('rechts'), eng: nav.classList.contains('eng'), feld: st.getPropertyValue('--feld') };
    nav.classList.toggle('rechts', senkrecht);
    nav.classList.toggle('eng', f < L.feld);
    st.setProperty('--feld', f + 'px');
    var l = senkrecht ? nav.offsetHeight : nav.offsetWidth;      // (layout size – a running transform does not count)
    nav.classList.toggle('rechts', war.rechts);
    nav.classList.toggle('eng', war.eng);
    if (war.feld) st.setProperty('--feld', war.feld); else st.removeProperty('--feld');
    return l;
  }
  function platz(senkrecht) {
    return senkrecht ? window.innerHeight - 2 * (L.randSenkrecht != null ? L.randSenkrecht : 24)
      : window.innerWidth - 2 * (L.inhaltRand != null ? L.inhaltRand : 20);
  }
  /** The largest field size (px, ≤ leiste.feld) at which the bar fits – null if not even leiste.feldMin does. */
  function feldFuer(senkrecht) {
    var F = L.feld, Fm = Math.min(F, L.feldMin || 34), P = platz(senkrecht);
    var lF = laenge(senkrecht, F);
    if (lF <= P) return F;
    var lm = laenge(senkrecht, Fm);
    if (lm > P) return null;
    var f = Math.floor(Fm + (F - Fm) * (P - lm) / Math.max(1, lF - lm));      // (the length grows ~linearly with the field)
    while (f > Fm && laenge(senkrecht, f) > P) f--;
    return Math.max(Fm, f);
  }
  function einpassen() {
    var f = handy ? null : feldFuer(modus === 'rechts');
    if (!handy && f == null) f = Math.min(L.feld, L.feldMin || 34);       // (horizontal and still too long: the smallest)
    if (f == null || f >= L.feld) { nav.style.removeProperty('--feld'); nav.classList.remove('eng'); }
    else { nav.style.setProperty('--feld', f + 'px'); nav.classList.add('eng'); }
  }
  /** The tools sit in the bar (desktop) or in their own small glass field above it (phone). */
  function platzieren() {
    var inhalt = gezeigt.obj ? gezeigt.obj.el : null;
    var ziel = handy ? obenReihe : kontext;
    if (inhalt && inhalt.parentNode !== ziel) ziel.appendChild(inhalt);
    var da = !!inhalt;
    nav.classList.toggle('mit-kontext', da && !handy);
    oben.classList.toggle('da', da && handy);
  }
  /** The free room the content keeps (CSS variables): right of the content / below it. */
  function messen() {
    var s = document.documentElement.style;
    var rand = handy ? L.abstandRandHandy : L.abstandRand;
    // layout values (offset*), not getBoundingClientRect: a running fade-in transform must not count
    var oberkante = nav.offsetTop;
    if (oben.classList.contains('da')) oberkante = Math.min(oberkante, oben.offsetTop);
    s.setProperty('--frei-r', (modus === 'rechts' ? Math.round(window.innerWidth - nav.offsetLeft + rand) : 0) + 'px');
    s.setProperty('--frei-u', (modus === 'unten' ? Math.round(window.innerHeight - oberkante + rand) : 0) + 'px');
    s.setProperty('--leiste-abstand', rand + 'px');   // (--frei-u = from the screen bottom up to the bar's top edge + this)
    s.setProperty('--leiste-b', nav.offsetWidth + 'px');
    s.setProperty('--leiste-h', nav.offsetHeight + 'px');
    if (G.seiteProdukt && G.seiteProdukt.legen) G.seiteProdukt.legen();   // the product picture follows the free area
  }

  /* ---------------- moving the glass ---------------- */
  function rechteck(el) { var r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; }
  function stil(r) { return { left: r.l + 'px', top: r.t + 'px', width: r.w + 'px', height: r.h + 'px' }; }
  function gleich(a, b) { return Math.abs(a.l - b.l) < 0.5 && Math.abs(a.t - b.t) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5; }

  /** Stop a running change; returns where the glass is right now (null if nothing was running). */
  function flugStoppen() {
    var r = null;
    if (geist) {
      r = rechteck(geist);
      geistAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      if (geist.parentNode) geist.parentNode.removeChild(geist);
      geist = null;
    }
    geistAnims = [];
    flipAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    flipAnims = [];
    klone.forEach(function (k) { if (k.parentNode) k.parentNode.removeChild(k); });
    klone = [];
    clearTimeout(flugUhr);
    if (nav) {
      nav.classList.remove('im-wechsel');
      Array.prototype.forEach.call(nav.querySelectorAll(':scope > .g-ruhig-unter'), function (u) { nav.removeChild(u); });
    }
    return r;
  }
  function landen() {
    if (geist && geist.parentNode) geist.parentNode.removeChild(geist);
    geist = null;
    geistAnims = [];
    nav.classList.remove('im-flug', 'im-umformen');
  }
  /** A copy of the old content that fades out where it was (the new content is already in place). */
  function klonAusblenden(k, dauer) {
    if (!k) return;
    document.body.appendChild(k);
    klone.push(k);
    var a = G.animiere(k, [{ opacity: 1 }, { opacity: 0 }], { duration: dauer, easing: C.kurveRaus, fill: 'forwards' });
    a.then(function () { if (k.parentNode) k.parentNode.removeChild(k); klone = klone.filter(function (x) { return x !== k; }); });
  }

  /** Before the content changes: where the glass and the fields are, plus a copy of the old bar. */
  function schnappschuss() {
    var lauf = flugStoppen();
    var f = {};
    [homeFeld].concat(Object.keys(felder).map(function (id) { return felder[id]; })).forEach(function (b) {
      if (b.offsetParent !== null) f[b.dataset.bereich] = b.getBoundingClientRect();
    });
    var klon = null;
    if (!nav.classList.contains('im-flug')) {
      klon = nav.cloneNode(true);
      klon.classList.add('g-klon');
      klon.classList.remove('im-umformen');
      var hgk = klon.querySelector('.g-hg');
      if (hgk) hgk.parentNode.removeChild(hgk);
      Object.assign(klon.style, stil(rechteck(nav)));
    }
    var obenKlon = null;
    if (oben.classList.contains('da')) {
      obenKlon = oben.cloneNode(true);
      obenKlon.classList.add('g-klon');
      Object.assign(obenKlon.style, stil(rechteck(oben)));
    }
    return { rect: lauf || rechteck(nav), modus: modus, felder: f, klon: klon, obenKlon: obenKlon, key: gezeigt.key, unterwegs: !!lauf };
  }

  function geistBauen(von) {
    geist = G.el('div', 'g-hg g-geist');
    Object.assign(geist.style, stil(von));
    document.body.appendChild(geist);
    return geist;
  }

  /** After a change of place: the calm surface gives way softly to the real frosted glass. */
  function glasEinblenden() {
    if (!nav.classList.contains('im-wechsel')) return;
    var unter = G.el('div', 'g-hg g-ruhig-unter');
    nav.insertBefore(unter, hg);
    nav.classList.remove('im-wechsel');
    var t = G.blende(160);
    flipAnims.push(hg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: t, easing: C.kurve }));
    var a = unter.animate([{ opacity: 1 }, { opacity: 0 }], { duration: t, easing: C.kurve, fill: 'forwards' });
    flipAnims.push(a);
    a.onfinish = function () { if (unter.parentNode) unter.parentNode.removeChild(unter); };
  }

  function animieren(vorher, opts) {
    var nach = rechteck(nav);
    var wechsel = vorher.modus !== modus;
    var neuerInhalt = vorher.key !== gezeigt.key;
    if (G.modus !== 'voll') {                       // reduced motion / off: the bar simply fades in at its place
      landen();
      if (wechsel || neuerInhalt || !gleich(vorher.rect, nach)) {
        G.animiere(reihe, [{ opacity: 0 }, { opacity: 1 }], { duration: G.blende(L.umformen), easing: C.kurve });
        G.animiere(oben, [{ opacity: 0 }, { opacity: 1 }], { duration: G.blende(L.umformen), easing: C.kurve });
      }
      return;
    }

    if (wechsel) {
      // the old bar contracts to a point where it was and fades out; at the same time the new one grows out of a point
      // at its new place. Only transform + opacity; while moving, the glass is a calm surface without blur
      // (backdrop-filter is expensive to animate) – the real frosted glass fades in once it stands.
      var dauer = L.wechsel;
      landen();
      nav.classList.add('im-wechsel');
      if (vorher.klon) {
        var alt = vorher.klon;
        alt.classList.remove('g-klon', 'im-wechsel', 'im-flug', 'im-umformen');
        alt.classList.add('g-alt');
        Object.assign(alt.style, stil(vorher.rect));
        if (!alt.querySelector('.g-hg')) alt.insertBefore(G.el('div', 'g-hg'), alt.firstChild);
        document.body.appendChild(alt);
        klone.push(alt);
        var aA = alt.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.04)', opacity: 0 }],
          { duration: dauer * 0.75, easing: C.kurveRaus, fill: 'forwards' });
        geistAnims.push(aA);
        aA.onfinish = function () { if (alt.parentNode) alt.parentNode.removeChild(alt); klone = klone.filter(function (x) { return x !== alt; }); };
      }
      var basis = modus === 'rechts' ? 'translateY(-50%)' : 'translateX(-50%)';
      var aN = nav.animate([{ transform: basis + ' scale(.04)', opacity: 0 }, { transform: basis + ' scale(1)', opacity: 1 }],
        { duration: dauer, easing: C.kurve });
      geistAnims.push(aN);
      flugUhr = setTimeout(glasEinblenden, dauer);
      return;
    }

    // same place: the glass grows / shrinks, fields that stay glide, new ones fade in, old ones fade out
    var t = L.umformen;
    var formWechsel = !gleich(vorher.rect, nach);
    if (formWechsel) {
      nav.classList.add('im-umformen');
      geistBauen(vorher.rect);
      geistAnims.push(geist.animate([stil(vorher.rect), stil(nach)], { duration: t, easing: C.kurve, fill: 'forwards' }));
      flugUhr = setTimeout(landen, t);
    } else landen();
    [homeFeld].concat(Object.keys(felder).map(function (id) { return felder[id]; })).forEach(function (b) {
      if (b.offsetParent === null) return;
      var alt = vorher.felder[b.dataset.bereich], neu = b.getBoundingClientRect();
      if (alt) {
        var dx = alt.left - neu.left, dy = alt.top - neu.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) flipAnims.push(b.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: t, easing: C.kurve }));
      } else {
        flipAnims.push(b.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: t * 0.7, delay: t * 0.3, easing: C.kurveRein, fill: 'backwards' }));
      }
    });
    // what disappears fades out where it was: the old tools, and Home when going back to the start screen
    var homeWeg = !!vorher.felder.home && homeFeld.offsetParent === null;
    var k = vorher.klon;
    if (k && ((neuerInhalt && vorher.key && !handy) || homeWeg)) {
      var weg = function (sel) { Array.prototype.forEach.call(k.querySelectorAll(sel), function (e) { e.style.visibility = 'hidden'; }); };
      weg('.g-bereich');
      if (!homeWeg) weg('.g-home');
      if (!neuerInhalt || handy) weg('.g-trenner, .g-kontext');
      klonAusblenden(k, t * 0.4);
    }
    if (neuerInhalt) {
      if (handy && vorher.obenKlon) klonAusblenden(vorher.obenKlon, t * 0.4);
      if (gehalten) return;          // (the new tools fade in later, see freigeben)
      if (handy && oben.classList.contains('da')) {
        if (!vorher.obenKlon) flipAnims.push(oben.animate([{ transform: 'translate(-50%, 10px)' }, { transform: 'translate(-50%, 0)' }], { duration: t, easing: C.kurve }));
        flipAnims.push(oben.firstChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: t * 0.6, easing: C.kurveRein, fill: 'backwards' }));
      }
      var neu = handy ? obenReihe : kontext;
      flipAnims.push(neu.animate([{ opacity: 0 }, { opacity: 1 }], { duration: t * 0.65, delay: t * 0.35, easing: C.kurveRein, fill: 'backwards' }));
      if (!handy && gezeigt.key) flipAnims.push(trenner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: t * 0.65, delay: t * 0.35, fill: 'backwards' }));
    }
  }

  /* ---------------- the tools of the page ---------------- */
  function werkzeugeSetzen(r) {
    var bauer = G.WERKZEUGE && G.WERKZEUGE[r.seite];
    var key = bauer ? bauer.key(r) : '';
    if (key === gezeigt.key) {
      if (gezeigt.obj && gezeigt.obj.aktualisieren) gezeigt.obj.aktualisieren(r);
      return;
    }
    if (gezeigt.obj && gezeigt.obj.el.parentNode) gezeigt.obj.el.parentNode.removeChild(gezeigt.obj.el);
    gezeigt = key ? { key: key, obj: bauer.bauen(r) } : { key: '', obj: null };
  }

  function bereitsAktiv(id) { return route && route.pfad === id; }

  /* ---------------- tools held back (way back from a product into its tile) ----------------
     The bar takes its new place at once (as always), but the tools of the new page (Products: the code filter) stay
     invisible until the picture has arrived in its tile and the overview stands (app.js → werkzeugeFreigeben); then they
     fade in. Same on PC (behind the divider) and phone (the small glass field above the bar, its glass included). */
  var gehalten = false, halteUhr = null;
  function halten(an) {
    clearTimeout(halteUhr);
    gehalten = !!an;
    nav.classList.toggle('werkzeug-halt', gehalten);
    oben.classList.toggle('werkzeug-halt', gehalten);
    // (in case the arrival is never reported: at the latest after the flight's time)
    if (gehalten) halteUhr = setTimeout(freigeben, C.seite.kachelZumViewer + 900);
  }
  function freigeben() {
    if (!gehalten) return;
    halten(false);
    var t = G.blende(L.umformen * 0.65);
    if (!t) return;
    var ein = { duration: t, easing: C.kurveRein, fill: 'backwards' };
    if (handy) {
      if (!oben.classList.contains('da')) return;
      if (G.modus === 'voll') flipAnims.push(oben.animate([{ transform: 'translate(-50%, 10px)' }, { transform: 'translate(-50%, 0)' }], { duration: L.umformen, easing: C.kurve }));
      flipAnims.push(oben.firstChild.animate([{ opacity: 0 }, { opacity: 1 }], ein));
      flipAnims.push(obenReihe.animate([{ opacity: 0 }, { opacity: 1 }], ein));
    } else if (nav.classList.contains('mit-kontext')) {
      flipAnims.push(kontext.animate([{ opacity: 0 }, { opacity: 1 }], ein));
      flipAnims.push(trenner.animate([{ opacity: 0 }, { opacity: 1 }], ein));
    }
  }

  /* ---------------- loading (first visit of the start screen) ----------------
     Only the empty glass outline stands at the bar's place (no symbols, not clickable); a fill grows from left to
     right like a loading bar. When it is full, the fill fades out softly and the symbols rise one by one. */
  var fuellung = null, ladeAnim = null;
  function ladenBeginnen() {
    ladenAufraeumen();
    nav.classList.add('laedt');
    fuellung = G.el('div', 'g-fuellung');
    nav.insertBefore(fuellung, reihe);
    ladestand(0);
  }
  function ladestand(p) {
    if (!fuellung) return;
    p = Math.max(0, Math.min(1, p));
    fuellung.style.clipPath = 'inset(0 ' + ((1 - p) * 100).toFixed(2) + '% 0 0 round ' + L.radius + 'px)';
  }
  function ladenAufraeumen() {
    if (ladeAnim) { try { ladeAnim.cancel(); } catch (e) {} ladeAnim = null; }
    if (fuellung && fuellung.parentNode) fuellung.parentNode.removeChild(fuellung);
    fuellung = null;
    nav.classList.remove('laedt');
  }
  function ladenEnde() {
    if (!nav.classList.contains('laedt')) return Promise.resolve();
    var S = C.start.laden, f = fuellung;
    ladestand(1);
    var t = G.blende(S.ausblenden);
    return new Promise(function (ok) {
      var weiter = function () {
        // the symbols rise one after the other (like the tiles), the glass itself stays
        var liste = Array.prototype.filter.call(haupt.querySelectorAll('.g-feld'), function (b) { return getComputedStyle(b).display !== 'none'; });
        liste.forEach(function (b) { b.classList.add('vor-aufstieg'); });
        nav.classList.remove('laedt');
        G.welle.einreihen(liste.map(function (b) { return { els: [b], bereit: true }; }));
        ok();
      };
      if (!f || !t) { ladenAufraeumen(); weiter(); return; }
      ladeAnim = f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: t, easing: C.kurveRaus, fill: 'forwards' });
      ladeAnim.onfinish = function () { if (f.parentNode) f.parentNode.removeChild(f); if (fuellung === f) fuellung = null; ladeAnim = null; };
      setTimeout(weiter, t * 0.5);
    });
  }

  /* ---------------- public ---------------- */
  G.leiste = {
    feld: feld,
    glas: glas,
    init: function () {
      handy = G.istHandy();
      nav = glas('glas');
      nav.setAttribute('aria-label', 'Navigation');
      nav.setAttribute('role', 'navigation');
      hg = nav.firstChild;
      reihe = G.el('div', 'g-reihe');
      haupt = G.el('div', 'g-haupt');
      homeFeld = feld({ klasse: 'g-home', icon: 'home', schild: 'Home', label: 'Home – back to the start screen', klick: function () { G.router.geh(''); } });
      homeFeld.dataset.bereich = 'home';
      haupt.appendChild(homeFeld);
      G.BEREICHE.forEach(function (b) {
        var f = feld({ klasse: 'g-bereich', icon: b.id, schild: b.name, name: L.aktivName !== false ? b.name : null, label: b.name, klick: function () {
          if (bereitsAktiv(b.id)) return;
          G.router.geh(b.id);
        } });
        f.dataset.bereich = b.id;
        felder[b.id] = f;
        haupt.appendChild(f);
      });
      trenner = G.el('span', 'g-trenner');
      kontext = G.el('div', 'g-kontext');
      reihe.appendChild(haupt);
      reihe.appendChild(trenner);
      reihe.appendChild(kontext);
      nav.appendChild(reihe);
      document.body.appendChild(nav);

      // phone: the page tools in a small glass field above the bar
      oben = glas('glas-oben');
      obenReihe = G.el('div', 'g-reihe');
      oben.appendChild(obenReihe);
      document.body.appendChild(oben);

      if (window.ResizeObserver) { var ro = new ResizeObserver(function () { messen(); }); ro.observe(nav); ro.observe(oben); }
      window.addEventListener('resize', function () {
        var h = G.istHandy();
        if (h !== handy) {
          handy = h;
          flugStoppen(); landen();
          nav.classList.toggle('handy', handy);
          platzieren();
        }
        var m = modusFuer(route);
        if (m !== modus) { flugStoppen(); landen(); modus = m; nav.classList.toggle('rechts', m === 'rechts'); }
        einpassen();
        messen();
      });
      nav.classList.toggle('handy', handy);
      // a click elsewhere closes open option bars
      document.addEventListener('pointerdown', function (e) {
        if (nav.contains(e.target) || oben.contains(e.target)) return;
        G.leiste.feldZu();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') G.leiste.feldZu(); });
    },
    /** opts: sofort (no animation), erst (first visit of the start screen: the bar fades in after the logo) */
    render: function (r, opts) {
      opts = opts || {};
      if (!opts.erst && nav.classList.contains('laedt')) { ladenAufraeumen(); reihe.style.opacity = ''; }   // left the start screen while loading
      var vorher = modus === null || opts.sofort ? null : schnappschuss();
      if (!vorher) flugStoppen();
      route = r;
      var start = r.seite === 'start';
      var bereich = start ? null : G.bereichVon(r);
      nav.classList.toggle('ohne-home', start);
      Object.keys(felder).forEach(function (id) {
        felder[id].classList.toggle('aktiv', id === bereich);
        if (id === bereich) felder[id].setAttribute('aria-current', 'page'); else felder[id].removeAttribute('aria-current');
      });
      G.leiste.feldZu();
      werkzeugeSetzen(r);
      platzieren();
      halten(!!opts.halten && !!gezeigt.obj);
      modus = modusFuer(r);
      nav.classList.toggle('rechts', modus === 'rechts');
      einpassen();
      messen();
      if (opts.erst) {
        landen();
        var S = C.start, mitLaden = !!(S.laden && S.laden.an && G.modus !== 'aus');
        var ein = { duration: G.blende(S.auswahlEinblenden), delay: G.blende(mitLaden ? S.laden.umrissVerzoegerung : S.auswahlVerzoegerung), easing: C.kurveRein, fill: 'backwards' };
        G.animiere(hg, [{ opacity: 0 }, { opacity: 1 }], ein);
        // loading: first only the empty outline of the bar, it fills like a loading bar (js/start.js drives it)
        if (mitLaden) ladenBeginnen();
        else G.animiere(reihe, G.modus === 'voll' ? [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }] : [{ opacity: 0 }, { opacity: 1 }], ein);
        return;
      }
      if (vorher) animieren(vorher, opts); else landen();
    },
    extrasAktualisieren: function () {
      if (gezeigt.obj && gezeigt.obj.aktualisieren) gezeigt.obj.aktualisieren(route);
    },
    neuZeichnen: function () { G.leiste.extrasAktualisieren(); },
    /** The picture has arrived in its tile: the held-back tools of the page fade in (see halten). */
    werkzeugeFreigeben: function () { if (nav) freigeben(); },
    /** Close open option bars (code filter). */
    feldZu: function () {
      Array.prototype.forEach.call(document.querySelectorAll('.g-optionen.offen'), function (k) { if (k.zu) k.zu(); });
    },
    /** Change the content of the bar softly (e.g. the code filter gets longer/shorter): the glass grows / shrinks. */
    weich: function (fn) {
      if (G.modus !== 'voll' || !route) { fn(); return; }
      var vorher = schnappschuss();
      fn();
      messen();
      animieren(vorher);
    },
    messen: function () { if (nav) messen(); },
    /** Loading on the start screen: is the outline waiting? / how full (0..1) / done → symbols rise. */
    laedt: function () { return !!nav && nav.classList.contains('laedt'); },
    ladestand: ladestand,
    ladenEnde: ladenEnde,
    modus: function () { return modus; },
    wurzel: function () { return null; },
    el: function () { return nav; },
    huelle: function () { return nav; }
  };
})();
