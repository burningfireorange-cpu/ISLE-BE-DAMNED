/* gauge – start screen.
   "gauge" fades in big in the middle. Nothing happens until a click (meanwhile: preloading).
   Glass bar mode: the bar itself sits at the bottom centre (Products · Bespoke · Gallery · About Us, js/leiste.js);
   a click on an area fades the logo out, Home appears at the left of the bar. Home brings the logo back.
   Tree mode: three fields below the logo; they pack together, the packed field travels to the tree root and
   becomes the small "g", and the tree grows out of it. */
(function () {
  'use strict';
  var G = window.G, C = G.C, S = C.start;

  var el, logo, auswahl, blech, felder = [], laeuft = false, animationen = [];
  var OPTIONEN = G.BEREICHE;     // Products · Gallery · About Us · Bespoke (tree mode: the first three)

  function anim(e, frames, opts) {
    if (!e.animate || !opts.duration) {
      var last = frames[frames.length - 1];
      Object.keys(last).forEach(function (k) { if (k !== 'offset') e.style[k] = last[k]; });
      return Promise.resolve();
    }
    var a = e.animate(frames, opts);
    animationen.push(a);
    return new Promise(function (ok) { a.onfinish = ok; a.oncancel = ok; });
  }
  function alleStoppen() {
    animationen.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    animationen = [];
  }
  function zuruecksetzen() {
    alleStoppen();
    [logo, auswahl, blech].concat(felder).forEach(function (e) { e.style.opacity = ''; e.style.transform = ''; e.style.visibility = ''; });
    felder.forEach(function (f) { var i = f.querySelector('.icon'); if (i) i.style.opacity = ''; });
  }

  function schriftBereit() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([document.fonts.load('40px "gauge-logo"', 'gauge'), G.warte(1500)]).catch(function () {});
  }

  function mitte(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  /* Loading phase (glass bar mode, first visit): the outline of the bar fills from left to right while the tile
     images and the gallery photos of the first screen load. Never faster than laden.minimum (calm, also from cache),
     never longer than laden.maximum after the page was opened – then it goes on, the rest loads later.
     Afterwards the symbols rise and the big stills and camera moves load in the background. */
  function ladephase() {
    var LD = S.laden;
    var ziele = G.app.startBilder();
    var gesamt = ziele.length, fertig = 0;
    ziele.forEach(function (p) { Promise.resolve(p).then(function () { fertig++; }, function () { fertig++; }); });
    var beginn = performance.now() + G.blende(LD.umrissVerzoegerung) + G.blende(S.auswahlEinblenden) * 0.4;
    var stand = 0, vorher = null;
    function schritt(jetzt) {
      if (!G.leiste.laedt()) { G.app.startVorladen(); return; }      // the start screen was left meanwhile
      var dt = vorher === null ? 16 : Math.min(64, jetzt - vorher);
      vorher = jetzt;
      var ziel = gesamt ? fertig / gesamt : 1;
      if (jetzt >= LD.maximum) ziel = 1;
      var grenze = jetzt < beginn ? 0 : Math.min(1, (jetzt - beginn) / LD.minimum);
      var soll = Math.min(ziel, grenze);
      stand += (soll - stand) * (1 - Math.exp(-dt / 110));
      if (soll >= 1 && stand > 0.995) stand = 1;
      G.leiste.ladestand(stand);
      if (stand >= 1) {
        G.leiste.ladenEnde().then(function () { G.app.startVorladen(); });
        return;
      }
      requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
  }

  function verlassen(ziel) {
    if (laeuft) return;
    laeuft = true;
    el.classList.remove('aktiv');
    var lo = getComputedStyle(logo).opacity;
    alleStoppen();
    logo.style.opacity = lo;
    auswahl.style.opacity = '1';
    auswahl.style.transform = '';
    var voll = G.modus === 'voll';
    var gEl = G.nav.wurzel();
    if (!voll || !gEl) {
      var t = G.blende(S.logoAusblenden);
      anim(logo, [{ opacity: 1 }, { opacity: 0 }], { duration: t, fill: 'forwards' });
      anim(auswahl, [{ opacity: 1 }, { opacity: 0 }], { duration: t, fill: 'forwards' }).then(function () {
        G.router.geh(ziel, { vonStart: true });
        verstecken();
      });
      return;
    }
    // 1. the logo simply fades out
    anim(logo, [{ opacity: lo }, { opacity: 0 }], { duration: S.logoAusblenden, easing: C.kurveRaus, fill: 'forwards' });
    // 2. the fields pack together onto the middle one
    var rechtecke = felder.map(function (f) { return f.getBoundingClientRect(); });
    var mi = Math.floor(felder.length / 2);
    var m = mitte(rechtecke[mi]);
    var packen = felder.map(function (f, i) {
      var c = mitte(rechtecke[i]);
      var dx = m.x - c.x;
      var icon = f.querySelector('.icon');
      if (icon) anim(icon, [{ opacity: 1 }, { opacity: 0 }], { duration: S.zusammenpacken * 0.6, fill: 'forwards' });
      return anim(f, [
        { transform: 'none', opacity: 1 },
        { transform: 'translateX(' + dx + 'px) scale(.82)', opacity: i === mi ? 1 : 0 }
      ], { duration: S.zusammenpacken, easing: C.kurve, fill: 'forwards' });
    });
    Promise.all(packen).then(function () {
      // 3. the packed field travels to the root of the tree and becomes the small "g"
      var g = G.nav.wurzel();
      var gr = g.getBoundingClientRect();
      var f = felder[mi];
      var fr = rechtecke[mi];
      var c = mitte(fr), zc = mitte(gr);
      var sk = Math.max(gr.height, 14) / fr.height;
      var reise = anim(f, [
        { transform: 'translateX(0) scale(.82)', opacity: 1 },
        { transform: 'translate(' + (zc.x - c.x) + 'px,' + (zc.y - c.y) + 'px) scale(' + (sk * 0.8) + ')', opacity: 1, offset: 0.75 },
        { transform: 'translate(' + (zc.x - c.x) + 'px,' + (zc.y - c.y) + 'px) scale(' + (sk * 0.7) + ')', opacity: 0 }
      ], { duration: S.zurWurzel, easing: C.kurve, fill: 'forwards' });
      setTimeout(function () { G.router.geh(ziel, { vonStart: true, baumVerzoegerung: S.baumNach }); }, S.zurWurzel * 0.62);
      reise.then(verstecken);
    });
  }

  function verstecken() {
    el.classList.add('weg');
    el.classList.remove('aktiv');
    laeuft = false;
  }

  G.start = {
    init: function () {
      el = G.el('div', 'start weg');
      var m = G.el('div', 'start-mitte');
      logo = G.el('h1', 'start-logo', 'gauge');
      auswahl = G.el('div', 'start-auswahl');
      auswahl.setAttribute('role', 'navigation');
      auswahl.setAttribute('aria-label', 'Start');
      blech = G.el('div', 'start-blech');   // hub bar mode: the surface of the bar below the logo
      auswahl.appendChild(blech);
      (G.LEISTE ? [] : OPTIONEN).forEach(function (o) {   // glass bar mode: the bar itself is the selection
        var b = G.el('button', 'start-feld');
        b.type = 'button';
        b.setAttribute('aria-label', o.name);
        b.appendChild(G.icon(o.id, 30, 1.25));
        b.appendChild(G.el('span', 'schild', o.name));
        b.addEventListener('click', function () { verlassen(o.id); });
        auswahl.appendChild(b);
        felder.push(b);
      });
      m.appendChild(logo);
      m.appendChild(auswahl);
      el.appendChild(m);
      document.body.appendChild(el);
    },
    /** art: 'erst' (first visit) or 'zurueck' (back via the "g"). */
    zeigen: function (art) {
      zuruecksetzen();
      laeuft = false;
      el.classList.remove('weg');
      el.classList.add('aktiv');
      logo.style.opacity = '0';
      auswahl.style.opacity = '0';
      var voll = G.modus === 'voll';
      if (art === 'erst') {
        var mitLaden = G.LEISTE && G.leiste.laedt();
        if (mitLaden) ladephase();
        schriftBereit().then(function () {
          if (!el.classList.contains('aktiv')) return;
          anim(logo, [{ opacity: 0 }, { opacity: 1 }], { duration: G.blende(S.logoEinblenden), delay: G.blende(S.logoVerzoegerung), easing: C.kurveRein, fill: 'both' });
          anim(auswahl, voll ? [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }] : [{ opacity: 0 }, { opacity: 1 }],
            { duration: G.blende(S.auswahlEinblenden), delay: G.blende(S.auswahlVerzoegerung), easing: C.kurveRein, fill: 'both' });
          if (!mitLaden) G.app.startVorladen();
        });
        return;
      }
      // back: the fields unfold out of the "g"
      anim(logo, [{ opacity: 0 }, { opacity: 1 }], { duration: G.blende(S.logoEinblenden * 0.6), delay: G.blende(120), easing: C.kurveRein, fill: 'both' });
      auswahl.style.opacity = '1';
      var g = G.nav.wurzel();
      var gr = g ? g.getBoundingClientRect() : null;
      felder.forEach(function (f, i) {
        if (!voll || !gr || !gr.width) {
          anim(f, [{ opacity: 0 }, { opacity: 1 }], { duration: G.blende(S.auswahlEinblenden), easing: C.kurveRein, fill: 'both' });
          return;
        }
        var r = f.getBoundingClientRect(), c = mitte(r), zc = mitte(gr);
        var sk = Math.max(gr.height, 14) / r.height * 0.7;
        anim(f, [
          { transform: 'translate(' + (zc.x - c.x) + 'px,' + (zc.y - c.y) + 'px) scale(' + sk + ')', opacity: 0 },
          { transform: 'translate(' + (zc.x - c.x) * 0.4 + 'px,' + (zc.y - c.y) * 0.4 + 'px) scale(.8)', opacity: 1, offset: 0.55 },
          { transform: 'none', opacity: 1 }
        ], { duration: S.zurWurzel + S.zusammenpacken, delay: i * 40, easing: C.kurve, fill: 'both' });
      });
    },
    verbergen: function (sofort) {
      if (laeuft) return;
      if (sofort || el.classList.contains('weg')) { zuruecksetzen(); verstecken(); return; }
      el.classList.remove('aktiv');
      var t = G.blende(S.logoAusblenden);
      anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: t }).then(function () { zuruecksetzen(); verstecken(); });
    },
    laeuft: function () { return laeuft; }
  };
})();
