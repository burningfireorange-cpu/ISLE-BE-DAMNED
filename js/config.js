/* =====================================================================
   gauge – CENTRAL SETTINGS
   Everything that moves, fades or can be switched on/off lives here.
   Times in milliseconds. Curves are CSS easing strings.
   Change a value, save, reload the page – that's it.
   ===================================================================== */
window.GAUGE_CONFIG = {

  /* ---------- Global switches ---------- */
  animationen: true,               // false = everything switches instantly (no motion, no fades)
  reduzierteBewegungBeachten: true,// true = if the system asks for "reduce motion", only simple fades are used
  reduziertDauer: 220,             // fade duration used in reduced-motion mode

  /* ---------- Navigation ---------- */
  navigation: 'leiste',            // 'leiste' = the glass bar (bottom centre; on product pages right, vertical)
                                   // 'baum'   = the earlier navigation tree (switched off, kept for comparison)
  bereiche: {                      // names of the areas in the glass bar (name plates) – order = order in the bar
    products: 'Products',
    bespoke: 'Bespoke',            // enquiries for custom pieces outside the shop – the name is a placeholder
    gallery: 'Gallery',
    about: 'About Us'
  },

  /* ---------- Content switches ---------- */
  dummiesZeigen: true,             // show the clearly marked Dummy_xx test products (data/dummies.js)
  echteDateienVerwenden: true,     // true = a placeholder is replaced automatically as soon as its real file exists

  /* ---------- Mouse pointer ---------- */
  zeiger: {
    an: true,                      // own pointer: small filled circle, inverts itself on dark ground (never on touch devices)
    groesse: 10,                   // px diameter
    hoverGroesse: 16,              // px – over tiles and gallery photos a little larger
    verschmelzen: 200,             // ms – over a field of the glass bar the hover field grows out of the circle into the field's shape (and back); the circle stays visible on top
    wechsel: 140                   // ms – size change
  },

  /* ---------- Shape ---------- */
  eckradius: 3,                    // px – the single corner radius (bending radius of the steel) for ALL surfaces
  fugeHoehe: 0.163,                // wall/floor joint drawn inside grey placeholders (share of the height from the bottom)

  /* ---------- Curves ---------- */
  kurve: 'cubic-bezier(.4, 0, .2, 1)',        // default curve (calm ease in/out)
  kurveRaus: 'cubic-bezier(.4, 0, 1, 1)',     // for things leaving
  kurveRein: 'cubic-bezier(0, 0, .2, 1)',     // for things arriving

  /* ---------- Rising of tiles and gallery photos ---------- */
  welle: {
    dauer: 500,                    // ms – one element rises and fades in
    hub: 16,                       // px – it rises this far (from below)
    gesamt: 1100,                  // ms – the whole wave takes about this long (the offset between elements follows from it)
    versatzMin: 35,                // ms – offset between two elements, at least …
    versatzMax: 90,                // … and at most
    warten: 1500                   // ms – an element whose image is not there yet holds up the wave at most this long
  },

  /* ---------- Start screen ---------- */
  start: {
    logoEinblenden: 1200,          // big "gauge" fades in
    logoVerzoegerung: 150,
    auswahlEinblenden: 700,        // the glass bar (tree mode: the fields below the logo) fades in ...
    auswahlVerzoegerung: 700,      // ... after this delay
    logoAusblenden: 350,           // after a click on an area: the logo fades out
    zusammenpacken: 380,           // (tree mode) the fields fold together
    zurWurzel: 480,                // (tree mode) the packed field travels to the tree root
    baumNach: 120,                 // (tree mode) pause before the tree grows
    /* Loading (glass bar mode, first visit of the start screen): only the empty outline of the bar stands there and
       fills from left to right while the tile images and the gallery photos of the first screen load.
       Then the fill fades out and the symbols rise one by one. Videos load only afterwards, in the background. */
    laden: {
      an: true,
      umrissVerzoegerung: 300,     // the outline appears this long after the logo starts
      minimum: 1200,               // the fill never takes less than this (ms) – also when everything is cached
      maximum: 5000,               // at most this long after the page was opened, then it goes on anyway (the rest loads later)
      ausblenden: 320              // the full fill fades out
    }
  },

  /* ---------- Glass bar ---------- */
  leiste: {
    radius: 999,                   // px – rounding of the bar's ends (999 = fully round pill; e.g. 14 = only softly rounded)
    feld: 44,                      // px – the round fields (all symbols the same size)
    feldHandy: 40,
    icon: 21,                      // px – symbol size inside a field
    strich: 1.25,                  // line width of the symbols
    blur: 18,                      // px – how strongly the background behind the glass is blurred
    glasDeckkraft: 0.52,           // 0–1 – how milky the glass is (lower = more transparent)
    abstandRand: 60,               // px from the bottom AND the right screen edge (desktop) – both the same; the free area
                                   //   for the picture centre on the product page includes this distance (measured from the bar)
    abstandRandHandy: 16,          // px (phone)
    inhaltRand: 20,                // px – gutter of the content (tiles, texts) at the screen edges
    wechsel: 340,                  // ms – bottom <-> right (product pages): the bar contracts to a point at its old place
                                   //   and fades, at the same time it grows out of a point at the new place – 300–400, interruptible
    umformen: 300,                 // ms – same place, other content: the bar grows / shrinks softly
    klappfeld: 240,                // ms – the small glass bar with the options of a code segment slides out / in
    codeVollstaendig: 260,         // ms – a NUMBER was chosen: the complete code stays this long, then the product opens
    hoverZoom: 1.08,               // symbol slightly larger on hover
    namensschild: true,            // name plates on hover (always towards the screen centre)
    /* touch devices (phone, no hover): */
    aktivName: true,               // the active area grows softly and shows symbol + name, the others stay symbols only
    namenWechsel: 300,             // ms – growing / shrinking of the active field
    langDruck: 450,                // ms – pressing a symbol this long shows its name plate (and does not trigger it)
    schildNachLangDruck: 900       // ms – the plate stays this long after letting go
  },

  /* ---------- Navigation tree (only with navigation: 'baum') ---------- */
  baum: {
    wachsen: 320,                  // nodes/branches grow (test range 200–400)
    klappen: 260,                  // nodes/branches fold away
    staffelung: 35,                // delay between neighbouring branches when several grow at once (0 = all at once)
    verschieben: 300,              // a branch sliding into the trunk when clicked
    schmalAufklappen: 220,         // collapsed tree (thin line) opens on hover
    schmalZuVerzoegerung: 350,     // ... and closes again after the pointer left
    hoverVorschau: true,           // hovering a branch previews the effect in the content
    vorschauVerzoegerung: 60,      // small delay so quick mouse passes don't flicker
    verbindungslinie: true         // the active branch continues as a fine line into the content
  },

  /* ---------- Layout ---------- */
  layout: {
    baumBreite: 210,               // (tree mode) px reserved for the tree on desktop
    baumSchmal: 26,                // (tree mode) px when the tree is collapsed (Gallery, Customize)
    inhaltMax: 1240,               // px max width of the content
    luft: 32,                      // px outer gutter on desktop
    inhaltVerschieben: 420         // content moves/resizes softly
  },

  /* ---------- Page changes ---------- */
  seite: {
    wechsel: 320,                  // crossfade between pages
    kachelZumViewer: 560,          // tile zooms seamlessly into the viewer (shared element)
    kachelZurueckziehen: 480,      // phone upright, back to the wall after a move: the portrait picture draws back inside
                                   //   the tile onto the tile crop, the sides of the tile come in (Cam1 upright has a
                                   //   longer focal length – the tile reaches beyond the portrait picture)
    filter: 260                    // (tree mode) products: filter change
  },

  /* ---------- Products ---------- */
  produkte: {
    raster: [                      // tiles per row – first matching rule wins (min window width in px)
      { ab: 1900, spalten: 5 },
      { ab: 1320, spalten: 4 },
      { ab: 900,  spalten: 3 },
      { ab: 0,    spalten: 2 }
    ],
    kachelMinBreite: 220,          // px – test version: more columns so that all real products fit the first row, but
                                   //   never narrower tiles than this
    abstand: 16,                   // px gap between tiles
    abstandHandy: 10,
    umsortieren: 420,              // tiles glide to their new place when the filter changes
    einAusblenden: 260,            // tiles that appear / disappear
    hoverZoom: 1.03,               // ~3 % zoom on hover
    hoverDauer: 600,
    abendUeberblenden: 700,        // lighting products: hover fades into the evening image
    vorschauAbblenden: 0.28        // (tree mode) opacity of products that don't match a hovered filter
  },                               // order: always newest first (highest number) – no sorting switch

  /* ---------- Product viewer ---------- */
  viewer: {
    ueberblenden: 260,             // view change without video (missing file, reduced motion): simple crossfade
    standbildRaus: 100,            // view change: current still fades softly into the first video frame …
    standbildRein: 100,            // … and at the end the last video frame fades into the still of the target camera
                                   //   (the moves have fewer samples than the stills – the short fades hide the difference)
    lampe: 1000,                   // lamp switch: fade into the evening image and back
    lampeVorFahrt: 400,            // view change with the lamp on: first this fade back to day, then the move
    heimAusblenden: 200,           // back in the tile and on view 1: the viewer fades into the (identical) tile image
    lampeNachFahrtWiederAn: true,  // after a view change with the lamp on: fade back into the evening image
    gleichzeitig: 2,               // files loading at the same time
    wartenJeDateiMs: 15000,        // give up waiting for one file after this time and continue with the next
    ringVoll: 160,                 // a view clicked before its move has loaded: the ring in the view symbol fills; once full, it stays this long, then the move starts
    handyBreite: 760,              // below this window width small videos from video/klein/ are used
    /* picture of the product page (glass bar): it covers the window as long as it is wide enough. The furniture
       (field bildinfo of produkte.json) is never cropped; in very wide windows (21:9, 32:9) the picture keeps the full
       height and its sides fade softly into the background colour */
    moebelRand: 20,                // px – the furniture keeps at least this distance from the left screen edge and from the bar
    auslaufen: 0.1,                // share of the picture width (sides) / height (top, bottom) over which a visible picture edge fades out
    auslaufenWechsel: 420,         // ms – the fade at the edges grows / shrinks softly (window resized, way back into the tile)
    hochformat: true               // phone held upright: use the portrait pictures (bilder_hoch …) once they exist for a product
  },

  /* ---------- Gallery ---------- */
  galerie: {
    spalten: [                     // first matching rule wins (min window width in px → columns)
      { ab: 1440, spalten: 5 },
      { ab: 1080, spalten: 4 },
      { ab: 700,  spalten: 3 },
      { ab: 0,    spalten: 2 }
    ],
    abstand: 12,                   // px gap between photos
    abstandHandy: 8,
    fugenAbstand: 28,              // px – column edges closer than this count as "on the same height" (avoided)
    platzhalterAnzahl: 24,         // test placeholders when no real photos exist
    vorladenBildschirme: 1.2,      // load images this many screen heights ahead (up and down)
    entfernenBildschirme: 4,       // remove images that are further away than this
    einblenden: 380,               // a photo fades in after loading
    lightboxAuf: 320,
    lightboxWechsel: 240
  },

  /* ---------- Mobile ---------- */
  handy: {
    breite: 760,                   // below this width: bar at the bottom (tree mode: bottom path line)
    feldHoch: 280,                 // (tree mode) branch sheet slides up
    wischenMin: 70                 // px horizontal swipe to the right = back
  },

  /* ---------- Preloading ---------- */
  vorladen: {
    startbilder: true,             // during the start screen: tile images + gallery photos of the first screen, then the big stills
    ersteFahrten: true,            // afterwards in the background: the camera moves of each product
    beimHover: true                // hovering a tile pulls that product's data forward
  }
};
