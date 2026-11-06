// minimal CDP client for Edge headless (node --experimental-websocket)
const { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCR = __dirname;

async function warte(ms) { return new Promise(r => setTimeout(r, ms)); }

async function starten(port = 9333) {
  const prof = path.join(SCR, 'edge-profil-' + port);
  const proc = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--no-first-run',
    '--disable-gpu-vsync', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'].concat((process.env.EDGE_EXTRA || '--disable-gpu --disable-accelerated-video-decode --disable-features=D3D11VideoDecoder').split(' ').filter(Boolean)).concat(['about:blank']), { stdio: 'ignore' });
  let ziel;
  for (let i = 0; i < 60; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); ziel = l.find(t => t.type === 'page'); if (ziel) break; } catch (e) {}
    await warte(250);
  }
  const ws = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const offen = {}, hoerer = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && offen[d.id]) { const o = offen[d.id]; delete offen[d.id]; d.error ? o.nein(new Error(JSON.stringify(d.error))) : o.ja(d.result); }
    else if (d.method) hoerer.forEach(h => h(d));
  };
  const send = (method, params = {}) => new Promise((ja, nein) => { const i = ++id; offen[i] = { ja, nein }; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const fehler = [];
  hoerer.push(d => {
    if (d.method === 'Runtime.exceptionThrown') fehler.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') fehler.push(d.params.args.map(a => a.value || a.description).join(' '));
  });
  await send('Runtime.enable'); await send('Page.enable');
  // IOS=1: wie Safari auf dem iPhone – ein Video lädt vor dem ersten play() höchstens die Metadaten (preload wird gedeckelt)
  if (process.env.IOS) await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'preload');
    Object.defineProperty(HTMLMediaElement.prototype, 'preload', { configurable: true, get() { return d.get.call(this); },
      set(v) { d.set.call(this, this.__gespielt || v === 'none' ? v : 'metadata'); } });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { this.__gespielt = true; d.set.call(this, 'auto'); return play.call(this); };
    const cpt = HTMLMediaElement.prototype.canPlayType;      // iPhone ohne AV1: MP4 (H.264) wie auf den meisten iPhones
    HTMLMediaElement.prototype.canPlayType = function (t) { return /webm/.test(t) ? '' : cpt.call(this, t); };
    window.__iosSim = true;
  })()` });
  const handy = async (w, h, dpr = 3) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: true, screenOrientation: h > w ? { type: 'portraitPrimary', angle: 0 } : { type: 'landscapePrimary', angle: 90 } });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] }).catch(() => {});
  };
  const desktop = async (w, h) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  };
  const laden = async (url) => {
    const fertig = new Promise(r => { const h = d => { if (d.method === 'Page.loadEventFired') { hoerer.splice(hoerer.indexOf(h), 1); r(); } }; hoerer.push(h); });
    url = url.replace('index.html', 'index.html?n=' + Date.now()); await send('Page.navigate', { url }); await fertig;
  };
  const bild = async (datei, opt = {}) => {
    const r = await send('Page.captureScreenshot', Object.assign({ format: datei.endsWith('.png') ? 'png' : 'jpeg', quality: 85 }, opt));
    fs.writeFileSync(datei, Buffer.from(r.data, 'base64'));
  };
  const ende = () => { try { ws.close(); } catch (e) {} proc.kill(); };
  return { send, ev, handy, desktop, laden, bild, ende, fehler, hoerer };
}
module.exports = { starten, warte };
