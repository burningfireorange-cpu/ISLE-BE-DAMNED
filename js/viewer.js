/* gauge – product viewer (logic taken from Website_Test/Object_01/index.html).
   Views = the cameras whose stills exist (data/produkte.js). Moves between views are videos
   (video/Move_CamX_CamY.webm|mp4 – the right direction for each change; narrow windows / phones: video/klein/).
   A view change:  current still ─0.1 s soft→ first video frame · the move plays · last video frame ─0.1 s soft→ target still.
   (The moves have fewer samples than the stills, so first and last video frame look a touch different – the short fades hide that.)
   Without a video (or with reduced motion) a view change is a simple crossfade.
   Lamp (only products with evening images): soft crossfade day ↔ evening. With the lamp on, a view change stays in the
   evening: the evening move (video/Move_CamX_CamY_abend) plays and ends on the evening still of the target. Where an
   evening move is missing: first softly back to day, then the normal move (and the evening image again afterwards).
   Loading with priority: still of the current view, then the moves starting at the current view (with their target stills),
   then all other moves. After every view change the moves of the new view move to the front.
   Slow net (online): a tapped view is marked at once. If its move has not loaded yet, the current still stays and a ring
   fills in the view symbol; the move loads alone on the line (G.lader.sofort) and starts once it can play through. The
   target still is not waited for: the last video frame stands in for it until it has loaded.
   Another view tapped meanwhile is marked at once. While a move PLAYS, it plays to its end; then a move goes straight on
   to the view tapped last (no queue – of several taps only the last counts). While a move only loads (nothing moves
   yet) or the lamp fades before it, the new choice takes over at once, from the still that stays. */
(function () {
  'use strict';
  var G = window.G, C = G.C, V = C.viewer;

  /** Show / hide a layer at once, without its fade. */
  function sofort(el, an) {
    if (!el) return;
    el.classList.add('sofort');
    el.classList.toggle('sichtbar', an);
    void el.offsetWidth;            // apply without transition, then give the transition back
    el.classList.remove('sofort');
  }

  /** The current video frame stands in for a still that has not loaded yet: drawn into the still's placeholder (under
      its image, which fades in over it once loaded – then the drawing goes). Same picture, same aspect ratio.
      true if drawn. (A canvas is only drawn into, never read – so this works from file:// too.) */
  function ersatz(ph, v) {
    if (!ph || !v || !(v.readyState >= 2) || !v.videoWidth || ph.classList.contains('echt')) return false;
    try {
      var c = ph.querySelector('.ph-ersatz') || G.el('canvas', 'ph-ersatz');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      if (!c.parentNode) ph.insertBefore(c, ph.firstChild);
      if (ph.wennBereit) ph.wennBereit(function () {
        setTimeout(function () { if (c.parentNode && ph.classList.contains('echt')) c.parentNode.removeChild(c); }, G.blende(V.ueberblenden) + 200);
      });
      return true;
    } catch (e) { return false; }
  }

  function Viewer(p, format) {
    this.p = p;
    this.n = p.views;
    // 'breit' = the wide pictures (12:5), 'hoch' = the portrait pictures (phone held upright, fields bilder_hoch …)
    this.format = format === 'hoch' && p.hoch ? 'hoch' : 'breit';
    var fmt = this.format;
    this.el = G.el('div', 'viewer');
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('aria-label', p.code);
    this.el.dataset.format = fmt;
    // aspect ratio of what it shows (full 12:5 or 1:2 picture) and where the 4:3 tile crop lies in it – inside a tile
    // (way back to the wall) the viewer is laid out so that exactly this crop fills the tile
    // (portrait: the phone tile – a full-width crop of the portrait picture)
    var an = G.anzeige(p, fmt);
    this.kachelAnteil = an.kachel;
    this.el.style.setProperty('--a', String(an.verhaeltnis));
    this.kachelLegen();
    this.stills = [];
    this.abende = [];
    this.videos = { g: {}, k: {} };   // created on demand: g = video/, k = video/klein/
    this.perUrl = {};
    this.jobs = [];
    this.aktuell = 1;
    this.ziel = null;
    this.wartend = null;
    this.lampe = false;
    this.belegt = false;   // a lamp fade before a move or a move is running

    for (var v = 1; v <= this.n; v++) {
      var s = G.platzhalter({ pfad: G.pfade.still(p, v, fmt), text: p.code + ' · View ' + v, fuge: true, klasse: 'v-still', alt: p.code + ', view ' + v });
      this.el.appendChild(s);
      this.stills[v] = s;
      if (p.leuchtmittel) {
        var a = G.platzhalter({ pfad: G.pfade.abend(p, v, fmt), text: p.code + ' · View ' + v + ' · evening', fuge: true, abend: true, klasse: 'v-abend', alt: p.code + ', view ' + v + ', evening' });
        this.el.appendChild(a);
        this.abende[v] = a;
      }
    }
    // view 1: the small tile image (the whole picture, already loaded with the tiles) lies under the still until the big
    // still has loaded – the still then fades in over it. So the opened product never shows a grey surface.
    var passt = fmt === 'hoch' ? true : p.kachelVoll;
    this.vorschau(this.stills[1], G.pfade.kachel(p, fmt), passt);
    if (this.abende[1]) this.vorschau(this.abende[1], G.pfade.kachelAbend(p, fmt), passt);
    this.hinten = G.el('div', 'v-laden');
    this.hinten.appendChild(G.el('i'));
    this.el.appendChild(this.hinten);
    this.stills[1].classList.add('sichtbar');
  }

  /** How the viewer lies inside its tile (CSS --kx … – way back to the wall): exactly on the tile crop. */
  Viewer.prototype.kachelLegen = function () {
    var k = this.kachelAnteil, st = this.el.style;
    st.setProperty('--kx', String(k.x)); st.setProperty('--ky', String(k.y));
    st.setProperty('--kw', String(k.w)); st.setProperty('--kh', String(k.h));
  };

  /** A small copy of the same picture as background of a still placeholder (shown until the still itself has loaded). */
  Viewer.prototype.vorschau = function (ph, url, passt) {
    if (!ph || !url || !passt || !C.echteDateienVerwenden) return;
    G.lader.bild(url, 35);              // (wide: already loaded with the tiles; portrait: small, early in the queue)
    ph.style.backgroundImage = 'url("' + url + '")';
    ph.style.backgroundSize = 'cover';          // like the still itself (object-fit: cover) – also the 16:9 crop of tree mode
    ph.style.backgroundPosition = 'center';
    ph.classList.add('mit-vorschau');
  };

  /** Soft edges (G.buehne: maske, px of the picture) – an edge of the picture inside the window fades into the
      background colour. null = no fade (e.g. on the way back into the tile). The widths change softly (CSS). */
  Viewer.prototype.maske = function (m) {
    var el = this.el, an = !!(m && (m.l > 0 || m.r > 0 || m.t > 0 || m.b > 0));
    ['l', 'r', 't', 'b'].forEach(function (k) { el.style.setProperty('--m' + k, (an ? Math.round(m[k]) : 0) + 'px'); });
    clearTimeout(this.maskeUhr);
    if (an) el.classList.add('maske');
    else if (el.classList.contains('maske')) this.maskeUhr = setTimeout(function () { el.classList.remove('maske'); }, G.blende(V.auslaufenWechsel || 0) + 60);
    this.maskeWerte = an ? { l: m.l, r: m.r, t: m.t, b: m.b } : null;
  };

  /** Small videos on phones and in narrow windows (decided anew for every move, so resizing switches over). */
  Viewer.prototype.klein = function () { return window.innerWidth <= V.handyBreite; };

  /** The video element of the move a → b (null if there is no such file); abend = the evening move of a lamp. */
  Viewer.prototype.video = function (a, b, klein, abend) {
    if (klein == null) klein = this.klein();
    var satz = this.videos[klein ? 'k' : 'g'], key = a + '-' + b + (abend ? '-abend' : '');
    if (key in satz) return satz[key];
    var url = C.echteDateienVerwenden ? G.pfade.fahrt(this.p, a, b, klein, abend, this.format) : null;
    if (!url) return (satz[key] = null);
    if (this.perUrl[url]) return (satz[key] = this.perUrl[url]);   // the other size stood in for a missing file
    var vid = document.createElement('video');
    vid.className = 'v-video';
    vid.muted = true; vid.defaultMuted = true;
    vid.setAttribute('muted', '');
    vid.setAttribute('playsinline', ''); vid.setAttribute('webkit-playsinline', '');
    vid.setAttribute('disablepictureinpicture', '');
    vid.setAttribute('aria-hidden', 'true');
    vid.preload = 'none';
    vid.dataset.url = url;
    this.el.insertBefore(vid, this.el.firstChild);
    this.perUrl[url] = vid;
    return (satz[key] = vid);
  };

  /** Is there an evening move a → b (lamps; field abendfahrten of produkte.json)? */
  Viewer.prototype.hatAbendFahrt = function (a, b) {
    return !!(this.p.leuchtmittel && C.echteDateienVerwenden && G.pfade.fahrt(this.p, a, b, false, true, this.format));
  };
  Viewer.prototype.videoJob = function (a, b, prio, abend) {
    var v = this.video(a, b, null, abend);
    if (!v) return null;
    var j = G.lader.video(v.dataset.url, v, prio);
    this.merken(j);
    return j;
  };
  Viewer.prototype.bildJob = function (ph, prio) {
    var j = ph ? ph.laden(prio) : null;
    if (j) this.merken(j);
    return j;
  };
  Viewer.prototype.merken = function (j) {
    if (this.jobs.indexOf(j) >= 0) return;
    this.jobs.push(j);
    var self = this;
    j.dann(function () { self.fortschritt(); });
    this.fortschritt();
  };
  Viewer.prototype.fortschritt = function () {
    if (!this.jobs.length) { this.hinten.classList.add('fertig'); return; }
    var f = this.jobs.filter(function (j) { return j.zustand === 'fertig'; }).length;
    this.hinten.firstChild.style.width = Math.round(100 * f / this.jobs.length) + '%';
    this.hinten.classList.toggle('fertig', f === this.jobs.length);
  };

  /** Preload in steps: 'start' (first still), 'fahrten' (moves from view 1), 'hover' (both, the still at once),
      'aktiv' (the product is open, see below). Evening moves only while the light is on. */
  Viewer.prototype.vorladen = function (stufe, ab) {
    if (!this.p.hatBilder || !C.echteDateienVerwenden) return;
    var self = this, n = this.n;
    if (stufe !== 'aktiv') {
      // background (start screen, hover): the still of view 1, then the moves from view 1
      var basis = { start: 20, fahrten: 10, hover: 40 }[stufe] || 5, k = 0;
      var sj = this.bildJob(this.stills[1], basis + 9);
      if (stufe === 'hover' && sj) G.lader.sofort(sj);      // hover over the tile: the big still loads right now
      if (stufe === 'start') return;
      for (var b1 = 2; b1 <= n; b1++) this.videoJob(1, b1, basis + 8 - (k++) * 0.01);
      return;
    }
    /* The product is open: at once ALL its moves in the format it shows (phone upright: the small portrait videos,
       PC: the wide ones) – first the moves from the current view (what the next tap needs), then all other moves, then
       the stills, this view's first (until a still is there, its small copy or the last frame of the move stands in). One file after the other, above everything the background loads (G.lader). Lamp on: the
       evening moves take the place of the day moves (the day ones follow last); light off: no evening moves at all.
       Called again after every view change and lamp switch – the order then starts from the new view. */
    this.offen = true;
    var von = ab || this.aktuell, lampe = this.lampe, p = 69;
    function setze(j, pr) { if (j && j.zustand !== 'fertig' && j.prio < 100 && j.prio !== pr) G.lader.stufe(j, pr); }
    function fahrt(a, b, abend) { setze(self.videoJob(a, b, p, abend), p); p -= 0.01; }
    function zuerst(a, b) { if (lampe && self.hatAbendFahrt(a, b)) fahrt(a, b, true); else fahrt(a, b, false); }
    function bild(ph, pr) { setze(self.bildJob(ph, pr), pr); }
    for (var b = 1; b <= n; b++) if (b !== von) zuerst(von, b);
    p = 65;
    for (var a = 1; a <= n; a++) for (var d = 1; d <= n; d++) if (a !== d && a !== von) zuerst(a, d);
    bild(lampe && this.abende[von] ? this.abende[von] : this.stills[von], 61.9);
    for (var c = 1; c <= n; c++) {
      if (c === von) continue;
      bild(this.stills[c], 61.5 - c * 0.01);
      if (lampe && this.abende[c]) bild(this.abende[c], 61.6 - c * 0.01);
    }
    // light off: evening moves that were queued while it was on wait behind everything of the open product
    if (!lampe) this.jobs.forEach(function (j) { if (j.art === 'video' && /_abend/.test(j.url)) setze(j, 55); });
    if (lampe) {               // (the day still and day moves as well – for after the light is switched off again)
      bild(this.stills[von], 61.1);
      p = 61;
      for (var e = 1; e <= n; e++) for (var f = 1; f <= n; f++) if (e !== f && this.hatAbendFahrt(e, f)) fahrt(e, f, false);
    }
  };
  /** The product is left (or another one opened, or the phone turned): what it still loads goes behind the next one. */
  Viewer.prototype.zurueckstufen = function (max) {
    this.offen = false;
    this.jobs.forEach(function (j) { if (j.zustand !== 'fertig' && j.prio > max) G.lader.stufe(j, max); });
  };

  Viewer.prototype.info = function () {
    return { anzahl: this.n, aktuell: this.aktuell, ziel: this.ziel, wartend: this.wartend, lampe: this.lampe,
      laden: this.laden ? { ziel: this.laden.ziel, anteil: this.laden.anteil } : null };   // the move to "ziel" is still loading
  };
  Viewer.prototype.melden = function () { if (this.onwechsel) this.onwechsel(); };

  /** Opened from a tile: show view 1 at once (the image of the tile); lamp as the tile showed it. */
  Viewer.prototype.zuruecksetzen = function (lampe) {
    lampe = !!(lampe && this.p.leuchtmittel);
    if (this.belegt) { this.lampe = lampe; this.waehlen(1); this.melden(); return; }
    var self = this;
    this.stills.forEach(function (s, v) { if (s) { s.classList.remove('raus', 'rein'); s.classList.toggle('sichtbar', v === 1); } });
    this.abende.forEach(function (a, v) { if (a) { a.classList.add('sofort'); a.classList.toggle('sichtbar', lampe && v === 1); } });
    if (lampe) this.bildJob(this.abende[1], 66);      // (its small copy stands in – the moves load first, see vorladen)
    requestAnimationFrame(function () { self.abende.forEach(function (a) { if (a) a.classList.remove('sofort'); }); });
    this.aktuell = 1;
    this.lampe = lampe;
    this.wartend = null;
    this.melden();
  };

  Viewer.prototype.waehlen = function (v) {
    if (v < 1 || v > this.n) return;
    if (this.belegt) {
      // a change is on its way (loading, lamp fade, move): no queue – it gives way to the new choice at once.
      // The new view is marked at once (info().ziel), whatever has to load first.
      if (v === this.ziel) return;
      this.ziel = v;
      this.wartend = null;
      if (this.umlenken) this.umlenken(v);
      else this.wartend = v;     // (only the last few ms of a change: right after it)
      this.melden();
      return;
    }
    if (v === this.aktuell) return;
    this.fahren(this.aktuell, v);
  };

  Viewer.prototype.lampeSchalten = function () {
    if (!this.p.leuchtmittel) return;
    this.lampe = !this.lampe;
    if (!this.belegt) {
      var a = this.abende[this.aktuell];
      if (this.lampe) this.bildJob(a, 100);
      a.classList.toggle('sichtbar', this.lampe);
    }
    if (this.offen) this.vorladen('aktiv');     // light on: the evening moves (from here first) come to the front
    this.melden();
  };
  /** Lamp off at once (the viewer is back in its tile – next time it starts by day). */
  Viewer.prototype.lampeAus = function () {
    if (!this.p.leuchtmittel) return;
    this.lampe = false;
    this.abende.forEach(function (a) { sofort(a, false); });
    this.melden();
  };

  /** Lamp on: does the move von → nach stay in the evening? Yes if there is an evening move (reduced motion: always –
      it is only a crossfade anyway). Otherwise the fallback: first softly back to day, then the normal move. */
  Viewer.prototype.bleibtAbend = function (von, nach) {
    if (!this.lampe || !this.abende[von] || !this.abende[nach]) return false;
    return G.modus !== 'voll' || this.hatAbendFahrt(von, nach);
  };

  Viewer.prototype.fahren = function (von, nach) {
    var self = this;
    this.belegt = true;
    this.ziel = nach;
    this.wartend = null;
    this.umlenken = null;
    var schritt = Promise.resolve();
    var abendVon = this.abende[von];
    var abendAn = !!(abendVon && abendVon.classList.contains('sichtbar'));
    var abendFahrt = abendAn && this.bleibtAbend(von, nach);
    if (abendAn && !abendFahrt) {
      // no evening move for this change: first fade softly back to day, then the normal move
      // (another view chosen meanwhile: the move goes there instead – or nowhere, back to the start view)
      abendVon.classList.add('vor-fahrt');
      abendVon.classList.remove('sichtbar');
      this.umlenken = function (neu) { nach = neu; };
      schritt = G.warte(G.blende(V.lampeVorFahrt) + 30).then(function () { abendVon.classList.remove('vor-fahrt'); });
    }
    this.melden();
    schritt.then(function () {
      self.umlenken = null;
      return nach === von ? false : self.bewegen(von, nach, abendFahrt);
    }).then(function (gefahren) {
      if (gefahren === false) nach = von;      // another view was chosen while the move was still loading
      self.aktuell = nach;
      self.ziel = null;
      self.belegt = false;
      self.umlenken = null;
      self.laden = null; self.ladenAbbrechen = null;
      var an = self.abende[nach];
      if (an) {
        if (self.lampe && !abendFahrt && !V.lampeNachFahrtWiederAn) self.lampe = false;
        if (self.lampe) self.bildJob(an, 100);
        // after an evening move the evening still is already there; the lamp may have been switched meanwhile
        an.classList.toggle('sichtbar', self.lampe);
      }
      if (self.offen) self.vorladen('aktiv');     // (not after the move home in the tile – the product was left)
      var w = self.wartend;
      self.wartend = null;
      if (w && w !== self.aktuell) self.fahren(self.aktuell, w);
      else {
        self.melden();
        var cbs = self.ruhig;
        self.ruhig = null;
        if (cbs) cbs.forEach(function (f) { f(); });
      }
    });
  };
  /** fn runs once no move is running any more (at once if none is). */
  Viewer.prototype.wennRuhig = function (fn) {
    if (!this.belegt) { fn(); return; }
    (this.ruhig || (this.ruhig = [])).push(fn);
  };
  /** Back to the wall: the move back to view 1 starts right away (normal speed). Lamp on: with the evening move to
      view 1, the tile shows the day image again afterwards (app.js: the viewer fades out, then lampeAus). Without an
      evening move: as before – lamp off, the move by day. */
  Viewer.prototype.heim = function () {
    var von = this.belegt && this.ziel ? this.ziel : this.aktuell;
    if (this.lampe && !(von === 1 || this.bleibtAbend(von, 1))) {
      this.lampe = false;
      if (!this.belegt && this.aktuell === 1 && this.abende[1]) this.abende[1].classList.remove('sichtbar');
    }
    this.waehlen(1);
    this.melden();
  };

  /** Move from view a to view b (abend: the evening move, from evening still to evening still). Resolves when b's still is shown. */
  Viewer.prototype.bewegen = function (von, nach, abend) {
    var self = this;
    var still = abend ? this.abende[von] : this.stills[von], img = abend ? this.abende[nach] : this.stills[nach];
    var tagVon = this.stills[von], tagNach = this.stills[nach];   // (evening: the day stills lie below and are switched at once)
    var v = G.modus === 'voll' ? this.video(von, nach, null, abend) : null;     // reduced motion: no camera move, only a fade
    return new Promise(function (fertig) {
      // the target still is needed only at the end of the move, and even then the last video frame stands in for it:
      // it comes after the moves of the product (they decide the next tap), first among the stills
      var stillJob = self.bildJob(img, 62);
      if (abend) self.bildJob(tagNach, 61.95);
      function ueberblenden() {
        // no move: the target still is what is needed now. The current still stays until it is there; another view
        // chosen meanwhile is taken at once (from here). Once the fade runs, the new choice follows right after it.
        if (stillJob) G.lader.hochstufen(stillJob, 100);
        self.umlenken = function (neu) { if (x) return; x = true; self.umlenken = null; if (neu !== von) self.wartend = neu; fertig(false); };
        var x = false;
        function los() {
          if (x) return;
          x = true;
          self.umlenken = null;
          if (abend) {
            // evening → evening: the new evening still fades in on top, then everything below is switched at once
            img.classList.remove('raus', 'rein');
            img.classList.add('wechsel', 'sichtbar');
            setTimeout(function () {
              sofort(still, false); sofort(tagVon, false); sofort(tagNach, true);
              img.classList.remove('wechsel');
              fertig();
            }, G.blende(V.ueberblenden) + 20);
            return;
          }
          img.classList.remove('raus', 'rein');
          still.classList.remove('raus', 'rein');
          img.classList.add('sichtbar');
          still.classList.remove('sichtbar');
          setTimeout(fertig, G.blende(V.ueberblenden));
        }
        // (no time limit: a still that fails or never comes ends its job in the queue – wartenJeDateiMs)
        if (!stillJob || stillJob.zustand === 'fertig') los();
        else stillJob.dann(los);
      }
      var job = v ? self.videoJob(von, nach, 100, abend) : null;
      if (!v || !job || v.dataset.fehlt || (job.zustand === 'fertig' && !job.ok)) { ueberblenden(); return; }
      // the move gets the line alone: the stills of this viewer give way (the one shown now is there or shows its small
      // copy; the target's comes right after the move, and the move's last frame stands in for it until then)
      self.stills.concat(self.abende).forEach(function (ph) { if (ph && ph.dataset.pfad) G.lader.zurueckstellen(ph.dataset.pfad, ph === img ? 62 : ph === tagNach ? 61.95 : 61.5); });
      // (still downloading: it may switch to a stream that starts before the file is complete – G.lader eilEntscheid)
      G.lader.sofort(job, { dauer: isFinite(v.duration) && v.duration > 0 ? v.duration : 2 });
      if (job.zustand === 'fertig') { fahrtStarten(); return; }

      // the move is not loaded yet: the current still stays, a small ring fills in the view symbol of the bar
      // (info().laden); the move starts once the video is there. If it fails: a simple crossfade instead.
      var aufgegeben = false, ladenAb = Date.now();
      self.laden = { ziel: nach, anteil: null };       // (null: progress not known yet – the ring only turns)
      self.ladenAbbrechen = function () {          // another view chosen meanwhile: nothing moves, the still stays
        if (aufgegeben) return;
        aufgegeben = true;
        clearInterval(messuhr);
        self.laden = null; self.ladenAbbrechen = null; self.umlenken = null;
        G.lader.stufe(job, self.offen ? 65 : 48);  // (no longer needed right now – it may go on as preloading)
        fertig(false);
      };
      // another view tapped while this move loads: it goes there instead, from the still that stays (no queue)
      self.umlenken = function (neu) {
        if (neu !== von) self.wartend = neu;
        self.ladenAbbrechen();
      };
      self.melden();
      // the real progress (bytes of the download, or how much of the stream is there), where it is known
      var messuhr = setInterval(function () {
        var a = G.lader.anteil(job);
        if (a == null) return;
        a = Math.min(0.98, a);
        if (self.laden && a > (self.laden.anteil || 0) + 0.005) { self.laden.anteil = a; self.melden(); }
      }, 100);
      job.dann(function (ok) {
        if (aufgegeben) return;
        clearInterval(messuhr);
        self.laden.anteil = 1;
        self.melden();
        // (the ring was visible: it stands full for a moment – else the move starts right away)
        var gezeigt = Date.now() - ladenAb > (V.ringVerzoegerung != null ? V.ringVerzoegerung : 150);
        setTimeout(function () {
          if (aufgegeben) return;
          aufgegeben = true;
          self.laden = null; self.ladenAbbrechen = null; self.umlenken = null;
          self.melden();
          if (!ok && !(v.readyState >= 2)) ueberblenden();
          else fahrtStarten();
        }, gezeigt ? G.blende(V.ringVoll) : 0);
      });

      function fahrtStarten() {
        var tRaus = G.blende(V.standbildRaus), tRein = G.blende(V.standbildRein);
        var beendet = false, wachhund = null, gestartet = false;

        // the target still lies ready UNDER the video while it plays (loaded and painted) – at the end only the video
        // fades out. (Fading the still in over the video at the end gave a short white flash on iPhones.)
        var unten = false;
        function unterLegen() {
          if (beendet || unten || (stillJob && !(stillJob.zustand === 'fertig'))) return;
          unten = true;
          img.classList.remove('raus', 'rein');
          img.classList.add('unter'); sofort(img, true);
          if (abend) { tagNach.classList.add('unter'); sofort(tagNach, true); }
        }
        function unterWeg(sichtbarLassen) {
          img.classList.remove('unter');
          if (abend) tagNach.classList.remove('unter');
          if (!sichtbarLassen) { sofort(img, false); if (abend) sofort(tagNach, false); }
          unten = false;
        }

        function abbrechen() {          // cannot play: fade without a move
          if (beendet) return;
          beendet = true;
          clearTimeout(wachhund);
          if (unten) unterWeg(false);
          v.pause();
          delete v.dataset.spielt;
          v.classList.remove('sichtbar');
          still.classList.remove('raus');
          if (!still.classList.contains('sichtbar')) still.classList.add('sichtbar');
          if (abend) sofort(tagVon, true);
          ueberblenden();
        }

        // 3. end: the last video frame fades out (0.1 s) and uncovers the target still that lies ready below it (both
        //    show the same view). If the still is not there yet (slow net), the last video frame stands in for it
        //    (drawn into its placeholder) – the move never waits at its end; the still fades in over it once loaded.
        function ende() {
          if (beendet) return;
          beendet = true;
          clearTimeout(wachhund);
          self.umlenken = null;          // (a view tapped now follows right after these 0.1 s – waehlen: wartend)
          var gezeigt = false;
          function zeigen() {
            if (gezeigt) return;
            gezeigt = true;
            if (!unten) {            // (not yet below the video – e.g. it only just loaded)
              unten = true;
              img.classList.remove('raus', 'rein');
              img.classList.add('unter'); sofort(img, true);
              if (abend) { tagNach.classList.add('unter'); sofort(tagNach, true); }
            }
            requestAnimationFrame(function () {
              v.classList.add('raus');
              v.classList.remove('sichtbar');
              setTimeout(function () {
                v.pause();
                try { v.currentTime = 0; } catch (e) {}
                delete v.dataset.spielt;
                v.classList.remove('raus');
                unterWeg(true);          // the still goes back to its own layer – the video is gone, nothing changes
                still.classList.remove('raus');
                fertig();
              }, tRein + 40);
            });
          }
          if (!stillJob || stillJob.zustand === 'fertig' || ersatz(img, v)) { zeigen(); return; }
          stillJob.dann(zeigen);             // (no frame to stand in – should not happen: wait for the still)
          setTimeout(zeigen, 4000);
        }

        // another view tapped while the move plays: the move is NOT stopped and not faded – it plays to its end, then a
        // move goes straight on to the view tapped LAST (no queue: of several taps only the last one counts; the bar
        // marks it at once, info().ziel). Tapping the target of this move again: nothing follows.
        self.umlenken = function (neu) {
          if (!gestartet) {
            // nothing has moved yet (the still is about to fade): go from here to the new choice
            beendet = true;
            clearTimeout(wachhund);
            try { v.pause(); } catch (e) {}
            delete v.dataset.spielt;
            sofort(v, false);
            if (neu !== von) self.wartend = neu;
            self.umlenken = null;
            fertig(false);
            return;
          }
          self.wartend = neu === nach ? null : neu;
        };
        v.dataset.spielt = '1';

        // 2. the move plays
        function abspielen() {
          if (beendet) return;
          v.onended = ende;
          var pr = v.play();
          if (pr && pr.catch) pr.catch(abbrechen);
          // once the video really plays (its frames are on screen), the target still goes below it
          var drunter = function () { setTimeout(function () { if (stillJob && stillJob.zustand !== 'fertig') stillJob.dann(unterLegen); else unterLegen(); }, 120); };
          if (pr && pr.then) pr.then(drunter, function () {}); else drunter();
          var dauer = isFinite(v.duration) && v.duration > 0 ? v.duration : 2;
          wachhund = setTimeout(ende, (dauer + 4) * 1000);   // in case "ended" never comes
        }

        // 1. start: the current still fades softly (0.1 s) into the first video frame, the video waits on that frame
        function blenden() {
          if (gestartet || beendet) return;
          gestartet = true;
          if (abend) sofort(tagVon, false);        // evening: the day still below goes at once, the evening still fades into the video
          still.classList.add('raus');
          still.classList.remove('sichtbar');
          setTimeout(abspielen, tRaus + 20);
        }
        sofort(v, true);               // lies below the still (at once – the still above hides it)
        if (v.currentTime !== 0) { try { v.currentTime = 0; } catch (e) {} }
        if (v.readyState >= 2 && !v.seeking) {
          // first frame is there (preloaded): show it under the still, then fade
          requestAnimationFrame(function () { requestAnimationFrame(blenden); });
          return;
        }
        // not loaded yet (or a browser that only delivers frames while playing): start, stop on the first real frame, then fade
        var erstes = false;
        function erstesBild() {
          if (erstes) return;
          erstes = true;
          v.pause();
          try { if (v.currentTime > 0.1) v.currentTime = 0; } catch (e) {}
          blenden();
        }
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(function () { erstesBild(); });
        v.addEventListener('playing', function warte() { v.removeEventListener('playing', warte); setTimeout(erstesBild, 40); });
        var pr0 = v.play();
        if (pr0 && pr0.catch) pr0.catch(function () { if (!erstes) abbrechen(); });
        // nothing arrives at all: give up after the loading timeout and fade instead
        setTimeout(function () { if (!erstes && !beendet) abbrechen(); }, V.wartenJeDateiMs);
      }
    });
  };

  /** Take over view and lamp of another viewer of the same product (the phone was turned: other picture format). */
  Viewer.prototype.uebernehmen = function (aktuell, lampe) {
    lampe = !!(lampe && this.p.leuchtmittel);
    this.stills.forEach(function (s, v) { if (s) { s.classList.remove('raus', 'rein', 'unter'); sofort(s, v === aktuell); } });
    this.abende.forEach(function (a, v) { if (a) sofort(a, lampe && v === aktuell); });
    this.aktuell = aktuell; this.lampe = lampe; this.wartend = null;
    this.bildJob(this.stills[aktuell], 100);
    if (lampe) this.bildJob(this.abende[aktuell], 100);
    this.melden();
  };

  /* ---- cache: one viewer per product and picture format, kept so loaded videos stay loaded ---- */
  var cache = {};
  /** format: 'breit' | 'hoch' – without it the format that fits the window right now (G.formatFuer). */
  G.viewerFuer = function (p, format) {
    var f = format || G.formatFuer(p), k = p.id + ':' + f;
    if (!cache[k]) cache[k] = new Viewer(p, f);
    return cache[k];
  };
  /** All viewers made so far. */
  G.viewerAlle = function () { return Object.keys(cache).map(function (k) { return cache[k]; }); };
})();
