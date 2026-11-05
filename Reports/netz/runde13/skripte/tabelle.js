// Zusammenfassung einer views.js-Ausgabe: je Fall Median/Max von Markierung, Fahrtstart, fertig
const fs = require('fs');
for (const datei of process.argv.slice(2)) {
  const zeilen = fs.readFileSync(datei, 'utf8').split(/\r?\n/).filter(l => l.startsWith('{')).map(l => JSON.parse(l));
  const faelle = {};
  zeilen.forEach(z => Object.keys(z).filter(k => typeof z[k] === 'object').forEach(k => {
    const f = k.startsWith('v') ? 'einzeln' : k;
    (faelle[f] = faelle[f] || []).push(z[k]);
  }));
  const med = a => { a = a.filter(x => typeof x === 'number').sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : '-'; };
  const max = a => { a = a.filter(x => typeof x === 'number'); return a.length ? Math.max(...a) : '-'; };
  console.log('== ' + datei.split(/[\\/]/).pop() + ' (' + zeilen.length + ' Produkte)');
  for (const [f, l] of Object.entries(faelle)) {
    const sprung = l.filter(e => e.zurueck || e.andereMarkiert).length, nicht = l.filter(e => e.fertig === 'NICHT').length, grau = l.filter(e => !e.ok).length;
    console.log(`  ${f.padEnd(9)} n=${String(l.length).padStart(2)}  Markierung med ${med(l.map(e => e.mark))} / max ${max(l.map(e => e.mark))} ms` +
      `  Fahrtstart med ${med(l.map(e => e.fahrt))} / max ${max(l.map(e => e.fahrt))} ms  fertig med ${med(l.map(e => e.fertig))} / max ${max(l.map(e => e.fertig))} ms` +
      `  Markierung sprang: ${sprung}  nicht erreicht: ${nicht}  grau: ${grau}`);
  }
}
