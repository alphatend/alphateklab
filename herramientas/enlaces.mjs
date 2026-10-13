// Recorre los tres sitios de alphateklab desde la portada y avisa de enlaces y recursos rotos.
// Uso: node herramientas/enlaces.mjs http://localhost:4900   (en local, sirviendo ~/alphateklab/repos)
//      node herramientas/enlaces.mjs https://alphatend.github.io   (lo publicado)
// Sigue solo páginas de /alphateklab, /alphateklab-mesa y /alphateklab-reservas; los enlaces externos se
// comprueban con una petición HEAD (o GET si el servidor no acepta HEAD) sin seguirlos.

const BASE = (process.argv[2] || 'http://localhost:4900').replace(/\/$/, '');
const RAICES = ['/alphateklab/', '/alphateklab-mesa/', '/alphateklab-reservas/'];
const PROPIOS = /^\/alphateklab(-mesa|-reservas)?\//;

const visitadas = new Set();
const comprobados = new Map();
const rotos = [];
const cola = RAICES.map((r) => BASE + r);

const quitarFragmento = (u) => u.split('#')[0];

async function estado(url) {
  if (comprobados.has(url)) return comprobados.get(url);
  let s;
  try {
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { redirect: 'follow' });
    s = r.status;
  } catch (e) {
    s = `error de red: ${e.cause?.code || e.message}`;
  }
  comprobados.set(url, s);
  return s;
}

function extraer(html, base) {
  const out = [];
  const re = /\b(href|src)=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) {
    const v = m[2].trim();
    if (/^(mailto:|tel:|javascript:|data:|#)/.test(v) || v.includes('${')) continue;
    try {
      out.push(new URL(v, base).href);
    } catch {
      /* URL mal formada: la reporta quien la use */
    }
  }
  return out;
}

while (cola.length) {
  const url = cola.shift();
  const limpia = quitarFragmento(url);
  if (visitadas.has(limpia)) continue;
  visitadas.add(limpia);
  let r;
  try {
    r = await fetch(limpia);
  } catch (e) {
    rotos.push([limpia, `error de red: ${e.message}`, '(raíz)']);
    continue;
  }
  if (!r.ok) {
    rotos.push([limpia, r.status, '(página)']);
    continue;
  }
  if (!(r.headers.get('content-type') || '').includes('text/html')) continue;
  const html = await r.text();
  for (const destino of extraer(html, limpia)) {
    // en local, lo que apunta a la dirección publicada se comprueba contra el servidor local
    const d = quitarFragmento(destino).replace(/^https:\/\/alphatend\.github\.io(?=\/alphateklab)/, BASE);
    const u = new URL(d);
    if (u.origin === new URL(BASE).origin && PROPIOS.test(u.pathname)) {
      if (/\.html?$|\/$/.test(u.pathname)) {
        if (!visitadas.has(d)) cola.push(d);
      } else {
        const s = await estado(d);
        if (s !== 200) rotos.push([d, s, limpia]);
      }
    } else if (/^https?:/.test(d) && !/fonts\.gstatic|polyhaven\.com|ntfy\.sh/.test(d)) {
      const s = await estado(d);
      if (typeof s !== 'number' || s >= 400) rotos.push([d, s, limpia]);
    }
  }
}

console.log(`Páginas recorridas: ${visitadas.size}. Recursos y enlaces comprobados: ${comprobados.size}.`);
if (rotos.length) {
  const porUrl = new Map();
  for (const [u, s, desde] of rotos) {
    const x = porUrl.get(u) || { s, desde: new Set() };
    x.desde.add(desde);
    porUrl.set(u, x);
  }
  console.log(`Rotos: ${porUrl.size} direcciones distintas`);
  for (const [u, { s, desde }] of porUrl) console.log(`  ${s}  ${u}\n        desde ${[...desde].slice(0, 3).join(', ')}${desde.size > 3 ? ` y ${desde.size - 3} más` : ''}`);
  process.exit(1);
}
console.log('Ningún enlace roto.');
