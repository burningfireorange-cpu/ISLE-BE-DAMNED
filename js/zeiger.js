/* gauge – own mouse pointer.
   A small filled CIRCLE (config.zeiger.groesse, ~10 px); its centre is the click point.
   It inverts itself (mix-blend-mode: difference): black on light ground, white on dark ground.
   Over the fields of the glass bars the round hover field reacts: the light field grows out of the pointer and flows
   into the shape of the field (between neighbouring fields it flows on), on leaving it contracts back into the pointer
   (config.zeiger.verschmelzen). The field lies in the glass, below the symbols; the circle itself always stays visible
   on top of everything (it never disappears into the field).
   Over tiles and gallery photos (and other clickable things): a little larger. Text fields: the normal text cursor.
   Touch devices: no own pointer (only used with a fine pointer that can hover). */
(function () {
  'use strict';
  var G = window.G, C = G.C, Z = C.zeiger;
  if (!Z || !Z.an || !window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var KLICKBAR = 'a[href], button:not(:disabled), [role="button"], label[for], select, summary, ' +
                 'input[type="range"], input[type="checkbox"], input[type="radio"], .g-foto, .kachel';
  var TEXT = 'input:not([type]), input[type="text"], input[type="email"], input[type="search"], input[type="tel"], ' +
             'input[type="url"], input[type="number"], input[type="password"], textarea, [contenteditable=""], [contenteditable="true"]';
  var FELD = '.g-feld, .g-seg, .g-opt';                    // fields of the glass bars
  var GLAS = '.glas, .glas-oben, .g-optionen';
  var html = document.documentElement;
  var el = null, da = false, x = -100, y = -100;
  var blase = null, blaseFeld = null;                        // the hover field the pointer has merged into

  function zeigen(an) {
    if (an === da) return;
    da = an;
    el.classList.toggle('da', an);
    if (!an) loesen();
  }

  /* ---- merging with the hover field of a glass bar ---- */
  function blaseIn(glas) {
    var b = glas.querySelector(':scope > .g-blase');
    if (!b) {
      b = G.el('span', 'g-blase');
      var hg = glas.querySelector(':scope > .g-hg');
      glas.insertBefore(b, hg ? hg.nextSibling : glas.firstChild);   // above the frosted glass, below the symbols
    }
    return b;
  }
  function setzen(b, l, t, w, h, sofort) {
    if (sofort) b.style.transition = 'none';
    b.style.transform = 'translate(' + l + 'px,' + t + 'px)';
    b.style.width = w + 'px';
    b.style.height = h + 'px';
    b.style.borderRadius = Math.min(w, h) / 2 + 'px';
    if (sofort) { void b.offsetWidth; b.style.transition = ''; }
  }
  /** Glass rect: layout box of the glass in the window (its own slide transform does not move its children's origin). */
  function glasRect(glas) { return glas.getBoundingClientRect(); }
  function verschmelzen(feld) {
    var glas = feld.parentElement.closest(GLAS);
    if (!glas) return;
    var b = blaseIn(glas), gr = glasRect(glas), fr = feld.getBoundingClientRect();
    var voll = G.modus === 'voll';
    if (blase && blase !== b) zusammenziehen(blase);
    if (blase !== b || !b.classList.contains('an')) {
      // grows out of the pointer (reduced motion: only fades in at the field)
      var d = Z.groesse;
      if (voll) setzen(b, x - gr.left - d / 2, y - gr.top - d / 2, d, d, true);
      else setzen(b, fr.left - gr.left, fr.top - gr.top, fr.width, fr.height, true);
    }
    blase = b; blaseFeld = feld;
    if (voll) setzen(b, fr.left - gr.left, fr.top - gr.top, fr.width, fr.height, false);
    else if (b.classList.contains('an')) setzen(b, fr.left - gr.left, fr.top - gr.top, fr.width, fr.height, true);   // next field: jump, no flow
    b.classList.add('an');
  }
  function zusammenziehen(b) {
    var glas = b.parentElement;
    b.classList.remove('an');
    if (glas && G.modus === 'voll') {
      var gr = glasRect(glas), d = Z.groesse;
      setzen(b, x - gr.left - d / 2, y - gr.top - d / 2, d, d, false);
    }
  }
  function loesen() {
    if (blase) zusammenziehen(blase);
    blase = null; blaseFeld = null;
  }
  /** Which glass field (if any) the pointer is over – active (black) fields keep the plain pointer. */
  function feldVon(t) {
    var f = t && t.closest ? t.closest(FELD) : null;
    if (!f || f.classList.contains('aktiv') || (f.classList.contains('g-lampe') && f.classList.contains('an'))) return null;
    if (f.closest('.g-klon')) return null;
    return f;
  }

  function pruefen(t) {
    var text = !!(t && t.closest && t.closest(TEXT));
    var feld = text ? null : feldVon(t);
    var k = !text && !feld && t && t.closest ? t.closest(KLICKBAR) : null;
    el.classList.toggle('text', text);
    el.classList.toggle('klickbar', !!k && k.getAttribute('aria-current') !== 'page');
    if (feld) { if (feld !== blaseFeld || !blase.classList.contains('an')) verschmelzen(feld); }
    else if (blase) loesen();
  }

  function bewegen(e) {
    if (e.pointerType && e.pointerType !== 'mouse') { zeigen(false); return; }   // pen/touch: the system's own feedback
    x = e.clientX; y = e.clientY;
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    zeigen(true);
    pruefen(e.target);
  }
  /** After a click the bar may change shape under a still pointer – look again once it has settled. */
  function nachsehen() {
    if (!da) return;
    var t = document.elementFromPoint(x, y);
    if (blaseFeld && !blaseFeld.isConnected) { blase = null; blaseFeld = null; }
    if (t) {
      if (blaseFeld && feldVon(t) === blaseFeld) verschmelzen(blaseFeld);   // same field, maybe moved
      else pruefen(t);
    }
  }

  function init() {
    var s = html.style;
    s.setProperty('--zeiger', Z.groesse + 'px');
    s.setProperty('--zeiger-hover', Z.hoverGroesse + 'px');
    s.setProperty('--t-zeiger', G.blende(Z.wechsel) + 'ms');
    s.setProperty('--t-verschmelzen', G.blende(Z.verschmelzen) + 'ms');
    s.setProperty('--t-verschmelzen-weg', (G.modus === 'voll' ? G.blende(Z.verschmelzen) : 0) + 'ms');
    el = G.el('div', 'zeiger');
    el.setAttribute('aria-hidden', 'true');
    el.appendChild(G.el('span', 'zeiger-p'));
    document.body.appendChild(el);
    html.classList.add('eigener-zeiger');
    document.addEventListener('pointermove', bewegen, { passive: true });
    document.addEventListener('pointerover', bewegen, { passive: true });
    document.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') el.classList.add('druck'); }, true);
    document.addEventListener('pointerup', function () { el.classList.remove('druck'); }, true);
    document.addEventListener('click', function () { setTimeout(nachsehen, 60); setTimeout(nachsehen, Math.max(C.leiste.wechsel, C.leiste.umformen) + 80); }, true);
    window.addEventListener('hashchange', function () { setTimeout(nachsehen, Math.max(C.leiste.wechsel, C.leiste.umformen) + 80); });
    html.addEventListener('mouseleave', function () { zeigen(false); });
    window.addEventListener('blur', function () { zeigen(false); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
