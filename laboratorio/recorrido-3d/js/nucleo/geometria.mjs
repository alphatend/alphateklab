// Geometría en planta (metros). Un punto es { x, y } o [x, y]; «y» crece hacia abajo del plano,
// igual que en SVG. Sin DOM ni three.js: lo usan el visor, el editor, el minimapa y las pruebas.

export const EPS = 1e-9;

export const px = (p) => (Array.isArray(p) ? p[0] : p.x);
export const py = (p) => (Array.isArray(p) ? p[1] : p.y);

/** Área con signo por la fórmula del cordón (positiva si los vértices van en sentido horario en pantalla). */
export function areaConSigno(poligono) {
  let s = 0;
  const n = poligono.length;
  for (let i = 0; i < n; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % n];
    s += px(a) * py(b) - px(b) * py(a);
  }
  return s / 2;
}

/** Área de un polígono simple, en m², sin importar el sentido de los vértices. */
export function areaPoligono(poligono) {
  if (!Array.isArray(poligono) || poligono.length < 3) return 0;
  return Math.abs(areaConSigno(poligono));
}

/** Perímetro en metros. */
export function perimetro(poligono) {
  let s = 0;
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    s += Math.hypot(px(b) - px(a), py(b) - py(a));
  }
  return s;
}

/** Caja que contiene al polígono. */
export function caja(poligono) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poligono) {
    x0 = Math.min(x0, px(p)); y0 = Math.min(y0, py(p));
    x1 = Math.max(x1, px(p)); y1 = Math.max(y1, py(p));
  }
  return { x0, y0, x1, y1, ancho: x1 - x0, largo: y1 - y0 };
}

/** Punto dentro de polígono (rayo horizontal). Los puntos justo sobre el borde pueden dar cualquiera de los dos. */
export function puntoEnPoligono(punto, poligono) {
  const x = px(punto), y = py(punto);
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = px(poligono[i]), yi = py(poligono[i]);
    const xj = px(poligono[j]), yj = py(poligono[j]);
    const cruza = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Punto del segmento ab más cercano a p, y el parámetro t ∈ [0, 1]. */
export function puntoMasCercano(p, a, b) {
  const ax = px(a), ay = py(a);
  const dx = px(b) - ax, dy = py(b) - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 < EPS ? 0 : ((px(p) - ax) * dx + (py(p) - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + dx * t, y: ay + dy * t, t };
}

export function distanciaPuntoSegmento(p, a, b) {
  const c = puntoMasCercano(p, a, b);
  return Math.hypot(px(p) - c.x, py(p) - c.y);
}

/** Distancia del borde más cercano del polígono al punto. */
export function distanciaAlBorde(p, poligono) {
  let d = Infinity;
  for (let i = 0; i < poligono.length; i++) {
    d = Math.min(d, distanciaPuntoSegmento(p, poligono[i], poligono[(i + 1) % poligono.length]));
  }
  return d;
}

/** Centroide de área (para polígonos simples). */
export function centroide(poligono) {
  const a = areaConSigno(poligono);
  if (Math.abs(a) < EPS) {
    const n = poligono.length || 1;
    return { x: poligono.reduce((s, p) => s + px(p), 0) / n, y: poligono.reduce((s, p) => s + py(p), 0) / n };
  }
  let cx = 0, cy = 0;
  for (let i = 0; i < poligono.length; i++) {
    const p = poligono[i];
    const q = poligono[(i + 1) % poligono.length];
    const f = px(p) * py(q) - px(q) * py(p);
    cx += (px(p) + px(q)) * f;
    cy += (py(p) + py(q)) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/**
 * Dónde poner el nombre de un ambiente: el punto interior más alejado de las paredes, buscado en una rejilla.
 * En una «L» el centroide puede caer fuera; este punto nunca.
 */
export function puntoEtiqueta(poligono, paso = 0.1) {
  const c = centroide(poligono);
  const k = caja(poligono);
  let mejor = null;
  let mejorD = -Infinity;
  const considerar = (x, y) => {
    const p = { x, y };
    if (!puntoEnPoligono(p, poligono)) return;
    // Pequeña preferencia por el centroide para que en un rectángulo el nombre quede centrado.
    const d = distanciaAlBorde(p, poligono) - 0.02 * Math.hypot(x - c.x, y - c.y);
    if (d > mejorD + 1e-12) { mejorD = d; mejor = p; }
  };
  considerar(c.x, c.y);
  for (let x = k.x0 + paso / 2; x < k.x1; x += paso) {
    for (let y = k.y0 + paso / 2; y < k.y1; y += paso) considerar(x, y);
  }
  return mejor ?? c;
}

/**
 * Empuja un círculo (jugador) fuera de los segmentos que toca.
 * Cada segmento es { a, b, medio } con «medio» = medio grosor de la pared.
 */
export function resolverColision(p, segmentos, radio, iteraciones = 4) {
  let x = px(p), y = py(p);
  for (let k = 0; k < iteraciones; k++) {
    let movido = false;
    for (const s of segmentos) {
      const minimo = radio + (s.medio ?? 0);
      const c = puntoMasCercano({ x, y }, s.a, s.b);
      const dx = x - c.x, dy = y - c.y;
      const d = Math.hypot(dx, dy);
      if (d >= minimo - 1e-9) continue;
      if (d > EPS) {
        x = c.x + (dx / d) * minimo;
        y = c.y + (dy / d) * minimo;
      } else {
        // Justo sobre la línea: salir por la normal del segmento.
        const sx = px(s.b) - px(s.a), sy = py(s.b) - py(s.a);
        const l = Math.hypot(sx, sy) || 1;
        x = c.x + (-sy / l) * minimo;
        y = c.y + (sx / l) * minimo;
      }
      movido = true;
    }
    if (!movido) break;
  }
  return { x, y };
}

/**
 * ¿El tramo de p a q cruza el segmento ab? (para no atravesar paredes delgadas con un paso grande).
 * Devuelve true si se cruzan en su interior.
 */
export function segmentosSeCruzan(p, q, a, b) {
  const d = (ux, uy, vx, vy) => ux * vy - uy * vx;
  const rx = px(q) - px(p), ry = py(q) - py(p);
  const sx = px(b) - px(a), sy = py(b) - py(a);
  const den = d(rx, ry, sx, sy);
  if (Math.abs(den) < EPS) return false;
  const qpx = px(a) - px(p), qpy = py(a) - py(p);
  const t = d(qpx, qpy, sx, sy) / den;
  const u = d(qpx, qpy, rx, ry) / den;
  return t > 0 && t < 1 && u >= 0 && u <= 1;
}

/**
 * Mueve un círculo de radio «radio» desde p según delta, deslizándose por las paredes.
 * Parte el movimiento en pasos de como mucho radio/2 para que ni un salto grande atraviese una pared delgada.
 */
export function moverConColision(p, delta, segmentos, radio) {
  const dx = px(delta), dy = py(delta);
  const largo = Math.hypot(dx, dy);
  const pasos = Math.max(1, Math.ceil(largo / (radio / 2)));
  let actual = { x: px(p), y: py(p) };
  for (let i = 0; i < pasos; i++) {
    const siguiente = { x: actual.x + dx / pasos, y: actual.y + dy / pasos };
    // Si el centro saltaría al otro lado de una pared, el paso se descarta y queda el empuje.
    const cruza = segmentos.some((s) => segmentosSeCruzan(actual, siguiente, s.a, s.b));
    actual = resolverColision(cruza ? actual : siguiente, segmentos, radio);
  }
  return actual;
}

export const distancia = (a, b) => Math.hypot(px(b) - px(a), py(b) - py(a));
export const distancia3 = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

/** Menos de 2 cm entre los dos puntos no es una medida: es un doble clic o dos Intro sin moverse. */
export const MEDIDA_MINIMA = 0.02;
export const medidaValida = (a, b, minimo = MEDIDA_MINIMA) => distancia3(a, b) >= minimo;
