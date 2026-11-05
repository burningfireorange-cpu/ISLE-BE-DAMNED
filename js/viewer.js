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
   target still is not waited for: the last video frame stands in for it until it has loaded. Another view tapped during
   any phase takes over at once – no queue (while loading: from the still that stays; while the move plays: the picture
   stops and the chosen view's still fades in over it). */
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

  /** Preload in steps: 'start' (first still), 'fahrten' (moves from view 1), 'hover', 'aktiv' (on the product page:
      the moves from the current view first, then all others – above everything that other products preload). */
  Viewer.prototype.vorladen = function (stufe, ab) {
    if (!this.p.hatBilder || !C.echteDateienVerwenden) return;
    var basis = { start: 20, fahrten: 10, hover: 40, aktiv: 60 }[stufe] || 5;
    var von = stufe === 'aktiv' ? (ab || this.aktuell) : 1;
    var k = 0;
    function prio() { return basis + 9 - (k++) * 0.01; }
    if (stufe === 'aktiv') {
      // on the product page the next tap counts most: first the moves from this view (small files – a view tapped
      // right after arriving starts at once), then this view's still (until then its small copy or the last frame of
      // the move stands in for it)
      for (var b0 = 1; b0 <= this.n; b0++) if (b0 !== von) this.videoJob(von, b0, prio());
      if (this.lampe) for (var d0 = 1; d0 <= this.n; d0++) if (d0 !== von && this.hatAbendFahrt(von, d0)) this.videoJob(von, d0, prio(), true);
    }
    var sj = this.bildJob(this.stills[von], prio());
    if (this.abende[von]) this.bildJob(this.abende[von], prio());
    if (stufe === 'hover' && sj) G.lader.sofort(sj);      // hover over the tile: the big still loads right now
    if (stufe === 'start') return;
    for (var b = 1; b <= this.n; b++) {
      if (b === von) continue;
      this.videoJob(von, b, prio());
      this.bildJob(this.stills[b], prio());
    }
    // evening moves (lamps): like the other videos, but only after the normal moves
    var self = this;
    function abendFahrten(nurVon, p0) {
      for (var a = 1; a <= self.n; a++) for (var d = 1; d <= self.n; d++) {
        if (a === d || (nurVon && a !== von) || (!nurVon && a === von) || !self.hatAbendFahrt(a, d)) continue;
        self.videoJob(a, d, p0 - (k++) * 0.01, true);
      }
    }
    if (stufe !== 'aktiv') { abendFahrten(true, basis - 1); return; }
    for (var c = 1; c <= this.n; c++) if (this.abende[c] && c !== von) this.bildJob(this.abende[c], 56);
    for (var a = 1; a <= this.n; a++) for (var d = 1; d <= this.n; d++) {
      if (a !== d && a !== von) this.videoJob(a, d, 55 - (k++) * 0.01);
    }
    // the lamp is on: the evening moves from here are what comes next (right after the normal moves from here)
    abendFahrten(true, this.lampe ? 64 : 50);
    abendFahrten(false, 45);
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
    if (lampe) this.bildJob(this.abende[1], 100);
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
    if (this.lampe) this.vorladen('aktiv');     // the evening moves from here move up in the queue
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
      else if (typeof gefahren === 'number') nach = gefahren;   // the move gave way: it ended on that view
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
      self.vorladen('aktiv');
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
      // the target still is needed only at the end of the move: it loads right after the move (the move first –
      // on a slow net it gets the whole line, see G.lader.sofort)
      var stillJob = self.bildJob(img, 95);
      if (abend) self.bildJob(tagNach, 90);
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
      self.stills.concat(self.abende).forEach(function (ph) { if (ph && ph.dataset.pfad) G.lader.zurueckstellen(ph.dataset.pfad, ph === img ? 95 : ph === tagNach ? 90 : 70); });
      G.lader.sofort(job);
      if (job.zustand === 'fertig') { fahrtStarten(); return; }

      // the move is not loaded yet: the current still stays, a small ring fills in the view symbol of the bar
      // (info().laden); the move starts once the video is there. If it fails: a simple crossfade instead.
      var aufgegeben = false;
      self.laden = { ziel: nach, anteil: 0 };
      self.ladenAbbrechen = function () {          // another view chosen meanwhile: nothing moves, the still stays
        if (aufgegeben) return;
        aufgegeben = true;
        clearInterval(messuhr);
        self.laden = null; self.ladenAbbrechen = null; self.umlenken = null;
        G.lader.stufe(job, 65);                    // (no longer needed right now – it may go on as preloading)
        fertig(false);
      };
      // another view tapped while this move loads: it goes there instead, from the still that stays (no queue)
      self.umlenken = function (neu) {
        if (neu !== von) self.wartend = neu;
        self.ladenAbbrechen();
      };
      self.melden();
      var messuhr = setInterval(function () {
        var a = 0;
        try { if (v.duration > 0 && v.buffered.length) a = v.buffered.end(v.buffered.length - 1) / v.duration; } catch (e) {}
        a = Math.min(0.98, a);
        if (self.laden && a > self.laden.anteil + 0.01) { self.laden.anteil = a; self.melden(); }
      }, 150);
      job.dann(function (ok) {
        if (aufgegeben) return;
        clearInterval(messuhr);
        self.laden.anteil = 1;
        self.melden();
        setTimeout(function () {
          if (aufgegeben) return;
          aufgegeben = true;
          self.laden = null; self.ladenAbbrechen = null; self.umlenken = null;
          self.melden();
          if (!ok && !(v.readyState >= 2)) ueberblenden();
          else fahrtStarten();
        }, G.blende(V.ringVoll));
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

        // another view tapped while the move plays: it gives way at once – the picture stops where it is, and the
        // still of the chosen view fades in over it (as soon as that still is there; until then its ring fills)
        var wz = 0;
        function wechselZu(neu) {
          var nr = ++wz;
          var tag = self.stills[neu], ab = self.lampe && (abend || V.lampeNachFahrtWiederAn) ? self.abende[neu] : null;
          var jt = self.bildJob(tag, 100), ja = ab ? self.bildJob(ab, 100) : null;
          self.umlenken = function (n2) { wechselZu(n2); };
          // (a still that is not loaded but shows the last frame of an earlier move counts as there – same picture)
          function da(j, ph) { return !j || j.zustand === 'fertig' || !!(ph && ph.querySelector('.ph-ersatz')); }
          function bereit() { return ab ? da(ja, ab) : da(jt, tag); }      // (lamp on: the evening still covers the day one)
          function los() {
            if (nr !== wz || !bereit()) return;
            self.umlenken = null;
            if (self.laden) { self.laden = null; self.melden(); }
            [tag, ab].forEach(function (x) { if (x) { x.classList.remove('raus', 'rein', 'unter'); x.classList.add('wechsel'); } });
            requestAnimationFrame(function () {
              tag.classList.add('sichtbar');
              if (ab) ab.classList.add('sichtbar');
              setTimeout(function () {
                for (var w = 1; w <= self.n; w++) {
                  if (w !== neu) { if (self.stills[w]) { self.stills[w].classList.remove('raus', 'rein', 'unter'); sofort(self.stills[w], false); }
                    if (self.abende[w]) { self.abende[w].classList.remove('raus', 'rein', 'unter'); sofort(self.abende[w], false); } }
                }
                [tag, ab].forEach(function (x) { if (x) x.classList.remove('wechsel'); });
                sofort(v, false);
                try { v.currentTime = 0; } catch (e) {}
                delete v.dataset.spielt;
                fertig(neu);
              }, G.blende(V.ueberblenden) + 20);
            });
          }
          if (bereit()) { los(); return; }
          self.laden = { ziel: neu, anteil: 0 };
          self.melden();
          [jt, ja].forEach(function (j) { if (j) j.dann(function () { if (nr === wz && self.laden) { self.laden.anteil = bereit() ? 1 : 0.5; self.melden(); } los(); }); });
        }
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
          beendet = true;
          clearTimeout(wachhund);
          v.onended = null;
          try { v.pause(); } catch (e) {}
          if (unten) unterWeg(false);
          wechselZu(neu);
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
})();
