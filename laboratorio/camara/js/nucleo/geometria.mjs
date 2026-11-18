// Geometría plana para el contador. Sin DOM: se prueba con node --test.
// Convención: coordenadas de pantalla (x a la derecha, y hacia ABAJO). Una caja es {x, y, w, h} con (x, y) en la
// esquina de arriba a la izquierda. Un punto es {x, y}.

/** Producto cruz de (b − a) × (p − a). Con y hacia abajo, es positivo cuando p queda a la DERECHA de a→b. */
export function cruz(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/** Distancia con signo de p a la recta a–b, en las mismas unidades que los puntos. Positiva a la derecha de a→b. */
export function distanciaFirmada(p, a, b) {
  const largo = Math.hypot(b.x - a.x, b.y - a.y);
  return largo === 0 ? 0 : cruz(a, b, p) / largo;
}

/** Normal unitaria que apunta al lado positivo (derecha) de a→b. */
export function normalDerecha(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo = Math.hypot(dx, dy) || 1;
  return { x: -dy / largo, y: dx / largo };
}

/** Alarga el segmento a–b `margen` unidades por cada extremo. */
export function alargarSegmento(a, b, margen) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo = Math.hypot(dx, dy);
  if (largo === 0 || margen === 0) return [{ ...a }, { ...b }];
  const ux = dx / largo;
  const uy = dy / largo;
  return [
    { x: a.x - ux * margen, y: a.y - uy * margen },
    { x: b.x + ux * margen, y: b.y + uy * margen },
  ];
}

function signo(v, eps) {
  return v > eps ? 1 : v < -eps ? -1 : 0;
}

function enRango(p, a, b, eps) {
  return (
    Math.min(a.x, b.x) - eps <= p.x &&
    p.x <= Math.max(a.x, b.x) + eps &&
    Math.min(a.y, b.y) - eps <= p.y &&
    p.y <= Math.max(a.y, b.y) + eps
  );
}

/** ¿Se tocan los segmentos p1–p2 y q1–q2? Cuenta los extremos que caen justo sobre el otro segmento. */
export function segmentosSeCortan(p1, p2, q1, q2, eps = 1e-9) {
  const d1 = signo(cruz(q1, q2, p1), eps);
  const d2 = signo(cruz(q1, q2, p2), eps);
  const d3 = signo(cruz(p1, p2, q1), eps);
  const d4 = signo(cruz(p1, p2, q2), eps);
  if (d1 !== d2 && d3 !== d4) return true;
  if (d1 === 0 && enRango(p1, q1, q2, eps)) return true;
  if (d2 === 0 && enRango(p2, q1, q2, eps)) return true;
  if (d3 === 0 && enRango(q1, p1, p2, eps)) return true;
  if (d4 === 0 && enRango(q2, p1, p2, eps)) return true;
  return false;
}

/**
 * Cruce de un recorrido (desde → hasta) sobre la línea de conteo a–b, con sentido.
 * Devuelve +1 si pasa del lado izquierdo de a→b al derecho, −1 si pasa del derecho al izquierdo y 0 si no cruza
 * el segmento (incluye rodearlo por un extremo o quedarse sobre la línea).
 */
export function cruceDeSegmento(desde, hasta, a, b) {
  const antes = Math.sign(cruz(a, b, desde));
  const despues = Math.sign(cruz(a, b, hasta));
  if (antes === 0 || despues === 0 || antes === despues) return 0;
  if (!segmentosSeCortan(desde, hasta, a, b)) return 0;
  return despues > 0 ? 1 : -1;
}

/** Punto dentro de un polígono simple (regla par-impar). Los puntos del borde pueden dar cualquiera de los dos. */
export function puntoEnPoligono(p, poligono) {
  if (!Array.isArray(poligono) || poligono.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    const corta = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (corta) dentro = !dentro;
  }
  return dentro;
}

/** Área (sin signo) de un polígono por la fórmula del cordón. */
export function areaPoligono(poligono) {
  if (!Array.isArray(poligono) || poligono.length < 3) return 0;
  let suma = 0;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    suma += (poligono[j].x + poligono[i].x) * (poligono[j].y - poligono[i].y);
  }
  return Math.abs(suma) / 2;
}

/** Intersección sobre unión de dos cajas {x, y, w, h}. */
export function iou(c1, c2) {
  const x1 = Math.max(c1.x, c2.x);
  const y1 = Math.max(c1.y, c2.y);
  const x2 = Math.min(c1.x + c1.w, c2.x + c2.w);
  const y2 = Math.min(c1.y + c1.h, c2.y + c2.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = c1.w * c1.h + c2.w * c2.h - inter;
  return union > 0 ? inter / union : 0;
}

export function centro(c) {
  return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
}

/** El punto con que se sigue a una persona: el centro del borde de abajo de su caja (donde están los pies). */
export function puntoDeApoyo(c) {
  return { x: c.x + c.w / 2, y: c.y + c.h };
}

export function aPixeles(p, ancho, alto) {
  return { x: p.x * ancho, y: p.y * alto };
}

export function aNormalizado(p, ancho, alto) {
  return { x: ancho ? p.x / ancho : 0, y: alto ? p.y / alto : 0 };
}

export function limitar(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
