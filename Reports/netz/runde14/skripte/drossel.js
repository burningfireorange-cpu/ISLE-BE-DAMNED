// Statischer Server (nur lesen) mit gedrosseltem Netz: EINE gemeinsame Bandbreite für alle Verbindungen (wie ein
// echter Anschluss) + Verzögerung vor dem ersten Byte je Anfrage. Range-Anfragen für Videos.
// node drossel.js <ROOT> <PORT> <kbit/s> <latenz ms>   (kbit 0 = ungedrosselt)
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || 'C:\\websites\\gauge'), PORT = +(process.argv[3] || 8761);
let KBIT = +(process.argv[4] || 0), LAT = +(process.argv[5] || 0);
const UEBER = process.argv[6] ? path.resolve(process.argv[6]) : null;   // Code-Stand zum Vergleich (index.html, css, js, data) über ROOT legen
const TYP = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.otf': 'font/otf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain' };
const stroeme = [];
const TAKT = 20;
let letzterTakt = Date.now();
setInterval(() => {
  // (Runde 14: Budget aus der wirklich vergangenen Zeit – unter Windows feuert der Takt nur alle ~31 ms, vorher kamen so
  //  nur ~60 % der eingestellten Bandbreite an)
  const jetzt = Date.now(), dt = Math.min(200, jetzt - letzterTakt); letzterTakt = jetzt;
  if (!stroeme.length) return;
  let budget = KBIT > 0 ? KBIT * 1000 / 8 * dt / 1000 : Infinity;
  // gerecht verteilen (wie TCP-Verbindungen auf einer Leitung)
  // (a connection whose reader has paused – the browser stops reading a buffered video – takes no bandwidth, like TCP)
  let aktiv = stroeme.filter(s => s.pos < s.buf.length && !s.voll);
  while (budget > 1 && aktiv.length) {
    const teil = budget === Infinity ? Infinity : Math.max(1, Math.floor(budget / aktiv.length));
    for (const s of aktiv) {
      const n = Math.min(teil, s.buf.length - s.pos);
      if (!s.res.write(s.buf.subarray(s.pos, s.pos + n))) { s.voll = true; s.res.once('drain', () => { s.voll = false; }); }
      s.pos += n;
      if (budget !== Infinity) budget -= n;
    }
    aktiv = aktiv.filter(s => s.pos < s.buf.length && !s.voll);
    if (budget === Infinity) break;
  }
  for (let i = stroeme.length - 1; i >= 0; i--) {
    const s = stroeme[i];
    if (s.pos >= s.buf.length) { s.res.end(); stroeme.splice(i, 1); }
  }
}, TAKT);
const fehler = [];
http.createServer((req, res) => {
  if (req.url.startsWith('/__netz')) {     // Drosselung zur Laufzeit umstellen: /__netz?kbit=…&lat=…
    const q = new URL(req.url, 'http://x').searchParams;
    if (q.has('kbit')) KBIT = +q.get('kbit'); if (q.has('lat')) LAT = +q.get('lat');
    res.end(JSON.stringify({ KBIT, LAT, fehler })); return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (UEBER) { const u = path.join(UEBER, p); if (u.startsWith(UEBER) && fs.existsSync(u)) f = u; }
  setTimeout(() => fs.stat(f, (e, st) => {
    // wie GitHub Pages: Groß-/Kleinschreibung zählt – Datei muss exakt so heißen
    let exakt = !e && st.isFile();
    if (exakt) { const dir = path.dirname(f); try { exakt = fs.readdirSync(dir).includes(path.basename(f)); } catch (x) { exakt = false; } }
    if (!exakt) { fehler.push(p); res.writeHead(404); res.end(); return; }
    const typ = TYP[path.extname(f).toLowerCase()] || 'application/octet-stream';
    const r = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    let a = 0, b = st.size - 1, kopf;
    if (r) {
      a = r[1] ? +r[1] : 0; b = r[2] ? Math.min(+r[2], st.size - 1) : st.size - 1;
      kopf = [206, { 'Content-Type': typ, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1, 'Cache-Control': 'max-age=600' }];
    } else kopf = [200, { 'Content-Type': typ, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'max-age=600' }];
    res.writeHead(kopf[0], kopf[1]);
    if (req.method === 'HEAD') { res.end(); return; }
    const fd = fs.openSync(f, 'r'), buf = Buffer.alloc(b - a + 1);
    fs.readSync(fd, buf, 0, buf.length, a); fs.closeSync(fd);
    const s = { res, buf, pos: 0 };
    stroeme.push(s);
    res.on('close', () => { const i = stroeme.indexOf(s); if (i >= 0) stroeme.splice(i, 1); });
  }), LAT);
}).listen(PORT, () => console.log('drossel ' + PORT + ' ' + KBIT + ' kbit/s ' + LAT + ' ms'));
