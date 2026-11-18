// Dónde y con qué tamaño escribir el nombre de un ambiente para que se lea entero: busca dentro del polígono el
// lugar donde cabe la letra más grande, en una o dos líneas, derecha o girada 90°, sin pisar el giro de las puertas
// y dejando a cada lado el margen que se pida (en 3D, lo que tapan las paredes vistas desde la cámara de arriba).
// Lo usan los rótulos del plano en el teléfono, el minimapa grande y los nombres del piso en 3D. Sin DOM.

import { caja, puntoEnPoligono, px, py } from './geometria.mjs';

/** Ancho de cada letra de Manrope negrita (la fuente de los rótulos), en múltiplos del tamaño de letra. */
const ANCHO_MANROPE = {
  a: 0.576, b: 0.616, c: 0.576, d: 0.617, e: 0.602, f: 0.378, g: 0.616, h: 0.626, i: 0.281, j: 0.289, k: 0.538,
  l: 0.281, m: 0.899, n: 0.626, o: 0.618, p: 0.616, q: 0.617, r: 0.399, s: 0.542, t: 0.433, u: 0.626, v: 0.553,
  w: 0.803, x: 0.554, y: 0.56, z: 0.534, á: 0.576, é: 0.602, í: 0.281, ó: 0.618, ú: 0.626, ü: 0.626, ñ: 0.626,
  A: 0.671, B: 0.631, C: 0.739, D: 0.701, E: 0.585, F: 0.524, G: 0.732, H: 0.722, I: 0.281, J: 0.501, K: 0.647,
  L: 0.534, M: 0.855, N: 0.718, O: 0.75, P: 0.639, Q: 0.75, R: 0.66, S: 0.658, T: 0.607, U: 0.72, V: 0.641,
  W: 0.976, X: 0.656, Y: 0.612, Z: 0.664, Á: 0.671, É: 0.585, Í: 0.281, Ó: 0.75, Ú: 0.72, Ñ: 0.718,
  0: 0.658, 1: 0.438, 2: 0.596, 3: 0.582, 4: 0.609, 5: 0.586, 6: 0.622, 7: 0.534, 8: 0.613, 9: 0.622,
  ' ': 0.2, '-': 0.42, '.': 0.304, ',': 0.304, '(': 0.453, ')': 0.453, '/': 0.433, '²': 0.412,
};

/** Ancho de un texto en Manrope negrita con letra de tamaño 1 (medido en Chromium; una letra desconocida, por exceso). */
export function anchoTexto(texto) {
  let s = 0;
  for (const ch of String(texto)) s += ANCHO_MANROPE[ch] ?? 0.75;
  return s;
}

/** Parte un nombre largo en dos líneas por el espacio más cercano a la mitad. */
export function partirNombre(nombre, maxCaracteres) {
  if (nombre.length <= maxCaracteres || !nombre.includes(' ')) return [nombre];
  const mitad = nombre.length / 2;
  let mejor = -1;
  for (let i = 0; i < nombre.length; i++) {
    if (nombre[i] === ' ' && (mejor < 0 || Math.abs(i - mitad) < Math.abs(mejor - mitad))) mejor = i;
  }
  return [nombre.slice(0, mejor), nombre.slice(mejor + 1)];
}

/**
 * Las formas de escribir un nombre: en una línea o en dos, derecho o girado 90°. «ancho» y «alto» son los del texto
 * con letra de tamaño 1, sin girar.
 * extra = { ancho, escala }: una línea más debajo del nombre (el área), con letra «escala» veces la del nombre.
 */
export function variantesEtiqueta(nombre, { medir = anchoTexto, interlinea = 1.15, extra = null, girar = true } = {}) {
  const formas = [[nombre]];
  const partido = partirNombre(nombre, 0);
  if (partido.length > 1) formas.push(partido);
  const out = [];
  for (const lineas of formas) {
    const ancho = Math.max(...lineas.map(medir), extra ? extra.ancho * extra.escala : 0);
    const alto = (lineas.length + (extra ? extra.escala : 0)) * interlinea;
    out.push({ lineas, girada: false, ancho, alto });
    if (girar) out.push({ lineas, girada: true, ancho, alto });
  }
  return out;
}

/** Distancia del punto al borde del polígono yendo derecho a la izquierda, a la derecha, arriba y abajo. */
export function espacioLibre(p, poligono) {
  const x = px(p), y = py(p);
  const e = { izq: Infinity, der: Infinity, arr: Infinity, aba: Infinity };
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i], b = poligono[(i + 1) % poligono.length];
    const ax = px(a), ay = py(a), bx = px(b), by = py(b);
    if ((ay > y) !== (by > y)) {
      const cx = ax + ((y - ay) * (bx - ax)) / (by - ay);
      if (cx >= x) e.der = Math.min(e.der, cx - x);
      if (cx <= x) e.izq = Math.min(e.izq, x - cx);
    }
    if ((ax > x) !== (bx > x)) {
      const cy = ay + ((x - ax) * (by - ay)) / (bx - ax);
      if (cy >= y) e.aba = Math.min(e.aba, cy - y);
      if (cy <= y) e.arr = Math.min(e.arr, y - cy);
    }
  }
  return e;
}

/** Caja que ocupa un rótulo con letra t centrado en (x, y). */
function cajaRotulo(v, x, y, t) {
  const [w, h] = v.girada ? [v.alto * t, v.ancho * t] : [v.ancho * t, v.alto * t];
  return { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
}

/**
 * ¿La caja pisa el obstáculo? Un obstáculo es una caja { x0, y0, x1, y1 } o el giro de una puerta { cx, cy, r, ux, uy,
 * nx, ny }: el cuarto de círculo con centro en la bisagra, del lado del hueco (u) y del lado hacia donde abre (n).
 */
function pisa(k, o) {
  if (!('r' in o)) return k.x0 < o.x1 && o.x0 < k.x1 && k.y0 < o.y1 && o.y0 < k.y1;
  // La caja recortada al cuadrante del giro (exacto si la puerta va en una pared horizontal o vertical).
  const fx = o.cx + o.r * (o.ux + o.nx), fy = o.cy + o.r * (o.uy + o.ny);
  const x0 = Math.max(k.x0, Math.min(o.cx, fx)), x1 = Math.min(k.x1, Math.max(o.cx, fx));
  const y0 = Math.max(k.y0, Math.min(o.cy, fy)), y1 = Math.min(k.y1, Math.max(o.cy, fy));
  if (x0 >= x1 || y0 >= y1) return false;
  const qx = Math.max(x0, Math.min(o.cx, x1)), qy = Math.max(y0, Math.min(o.cy, y1));
  return Math.hypot(qx - o.cx, qy - o.cy) < o.r;
}

/** ¿La caja queda dentro del polígono? Exacto para polígonos de lados horizontales y verticales (los del plano). */
export function cajaDentro(k, poligono) {
  if (!puntoEnPoligono({ x: (k.x0 + k.x1) / 2, y: (k.y0 + k.y1) / 2 }, poligono)) return false;
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i], b = poligono[(i + 1) % poligono.length];
    const s = { x0: Math.min(px(a), px(b)), x1: Math.max(px(a), px(b)), y0: Math.min(py(a), py(b)), y1: Math.max(py(a), py(b)) };
    // Un vértice adentro de la caja (una «L» que se mete) o un lado que la atraviesa la corta.
    if (px(a) > k.x0 && px(a) < k.x1 && py(a) > k.y0 && py(a) < k.y1) return false;
    if (s.y1 - s.y0 < 1e-9) { if (s.y0 > k.y0 && s.y0 < k.y1 && s.x0 < k.x1 && s.x1 > k.x0) return false; }
    else if (s.x1 - s.x0 < 1e-9) { if (s.x0 > k.x0 && s.x0 < k.x1 && s.y0 < k.y1 && s.y1 > k.y0) return false; }
    else if (pisa(k, s)) return false; // un lado inclinado se aproxima por su caja
  }
  return true;
}

/**
 * El mejor lugar y tamaño para el nombre de un ambiente.
 *   poligono: el del ambiente; obstaculos: lo que no se puede pisar (el giro de las puertas);
 *   margen: número o { izq, der, arr, aba } (metros libres entre el rótulo y cada lado);
 *   preferido: punto alrededor del cual se busca (a igual tamaño, gana el más cercano);
 *   maxT: letra más grande permitida; el resto de las opciones son las de variantesEtiqueta.
 * Devuelve { x, y, t, lineas, girada }; t = 0 si no cabe en ningún lado.
 */
export function colocarEtiqueta(nombre, { poligono, obstaculos = [], margen = 0, preferido = null, maxT = 0.5, paso = 0.1, ...opciones }) {
  const m = typeof margen === 'number' ? { izq: margen, der: margen, arr: margen, aba: margen } : margen;
  const k = caja(poligono);
  const pref = preferido ?? { x: (k.x0 + k.x1) / 2, y: (k.y0 + k.y1) / 2 };
  const variantes = variantesEtiqueta(nombre, opciones);
  const cabe = (v, x, y, t) => {
    const r = cajaRotulo(v, x, y, t);
    return cajaDentro({ x0: r.x0 - m.izq, x1: r.x1 + m.der, y0: r.y0 - m.arr, y1: r.y1 + m.aba }, poligono) && !obstaculos.some((o) => pisa(r, o));
  };
  // Candidatos: el punto preferido y una rejilla sobre la caja del ambiente, del más cercano al más lejano.
  const centros = [pref];
  for (let x = k.x0 + paso / 2; x < k.x1; x += paso) for (let y = k.y0 + paso / 2; y < k.y1; y += paso) centros.push({ x, y });
  const d = (c) => Math.hypot(c.x - pref.x, c.y - pref.y);
  centros.sort((a, b) => d(a) - d(b));
  const libres = centros.filter((c) => puntoEnPoligono(c, poligono)).map((c) => {
    // Cota por el espacio libre a los lados del centro: más allá, la caja no cabe.
    const e = espacioLibre(c, poligono);
    return { ...c, hx: Math.min(e.izq - m.izq, e.der - m.der), hy: Math.min(e.arr - m.arr, e.aba - m.aba) };
  }).filter((c) => c.hx > 0 && c.hy > 0);
  // La letra más grande de cada forma de escribirlo; a igual tamaño (2 %), el centro más cercano al preferido.
  const mejores = variantes.map((v) => {
    const [w, h] = v.girada ? [v.alto, v.ancho] : [v.ancho, v.alto];
    let mejor = { x: pref.x, y: pref.y, t: 0, lineas: v.lineas, girada: v.girada };
    for (const c of libres) {
      const cota = Math.min(maxT, (2 * c.hx) / w, (2 * c.hy) / h);
      if (cota <= mejor.t * 1.02) continue;
      let lo = 0, hi = cota;
      if (cabe(v, c.x, c.y, hi)) lo = hi;
      else for (let i = 0; i < 14; i++) { const t = (lo + hi) / 2; if (cabe(v, c.x, c.y, t)) lo = t; else hi = t; }
      if (lo > mejor.t * 1.02) mejor = { x: c.x, y: c.y, t: lo, lineas: v.lineas, girada: v.girada };
    }
    return mejor;
  });
  // Entre las formas que llegan casi a la letra más grande (6 %), la derecha y en menos líneas: se lee mejor.
  const tope = Math.max(...mejores.map((x) => x.t));
  const orden = (x) => (x.girada ? 2 : 0) + x.lineas.length;
  return mejores.filter((x) => x.t >= tope * 0.94).sort((a, b) => orden(a) - orden(b))[0];
}

/** Lo que barre la hoja de una puerta al abrir (para no escribir encima): el cuarto de círculo de la bisagra. */
export function giroDePuerta(ab) {
  if (!ab.hoja) return null;
  const { bisagra: c, otro, b: punta } = ab.hoja;
  const r = Math.hypot(punta.x - c.x, punta.y - c.y);
  const lu = Math.hypot(otro.x - c.x, otro.y - c.y) || 1;
  return { cx: c.x, cy: c.y, r, ux: (otro.x - c.x) / lu, uy: (otro.y - c.y) / lu, nx: (punta.x - c.x) / r, ny: (punta.y - c.y) / r };
}

/**
 * Cuánto piso tapan las paredes de un ambiente vistas desde una cámara alta (la vista desde arriba): una pared de alto
 * «altoPared» entre el piso y la cámara esconde una franja de altoPared × (distancia horizontal hacia la cámara) /
 * (alto de la cámara). camara = { x, y, alto } (x, y en planta). Devuelve el margen de cada lado { izq, der, arr, aba }:
 * la franja tapada más «base» (medio grosor de pared y un poco de aire).
 */
export function margenesPorOclusion(centro, camara, { altoPared, base = 0 }) {
  const f = altoPared / Math.max(camara.alto, 1e-6);
  const vx = (camara.x - centro.x) * f, vy = (camara.y - centro.y) * f;
  return { izq: base + Math.max(0, -vx), der: base + Math.max(0, vx), arr: base + Math.max(0, -vy), aba: base + Math.max(0, vy) };
}
