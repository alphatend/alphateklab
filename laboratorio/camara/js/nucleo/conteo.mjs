// Línea de conteo con sentido e histéresis.
//
// Cada pista tiene un «lado confirmado» (−1 o +1). Alrededor de la línea hay una banda muerta de ancho 2 × `banda`:
// mientras el punto de la persona está dentro de la banda, su lado no cambia. Solo cuando aparece del otro lado,
// fuera de la banda, se registra UN cruce. Así, quien se queda parado sobre la línea (y su caja tiembla de un lado al
// otro) no suma nada, y quien cruza suma una vez. Además, el recorrido entre el último punto confirmado y el nuevo
// tiene que pasar por el segmento dibujado (alargado `margen` por cada punta): rodear la línea por fuera no cuenta.
//
// sentido = +1: «entrada» es pasar del lado izquierdo de a→b al derecho (la flecha dibujada apunta a la derecha).
// sentido = −1: al revés.

import { distanciaFirmada, alargarSegmento, cruceDeSegmento } from './geometria.mjs';

export function crearContador({ a, b, sentido = 1, banda = 12, margen = 0 }) {
  let linea = { a, b, sentido: sentido >= 0 ? 1 : -1, banda, margen };
  let tramo = alargarSegmento(a, b, margen);
  const estados = new Map(); // id → { lado, punto }
  let entradas = 0;
  let salidas = 0;

  function ladoDe(p) {
    const d = distanciaFirmada(p, linea.a, linea.b);
    if (d > linea.banda) return 1;
    if (d < -linea.banda) return -1;
    return 0;
  }

  /** Observa la posición de una pista confirmada. Devuelve 'entrada', 'salida' o null. */
  function observar(id, p) {
    const lado = ladoDe(p);
    if (lado === 0) return null; // dentro de la banda: no decide nada
    const previo = estados.get(id);
    if (!previo) {
      estados.set(id, { lado, punto: { x: p.x, y: p.y } });
      return null;
    }
    if (previo.lado === lado) {
      previo.punto = { x: p.x, y: p.y };
      return null;
    }
    // Cambió de lado: ¿el recorrido atravesó el segmento?
    const cruce = cruceDeSegmento(previo.punto, p, tramo[0], tramo[1]);
    previo.lado = lado;
    previo.punto = { x: p.x, y: p.y };
    if (cruce === 0) return null;
    if (cruce === linea.sentido) {
      entradas += 1;
      return 'entrada';
    }
    salidas += 1;
    return 'salida';
  }

  function olvidar(id) {
    estados.delete(id);
  }

  /** Olvida el lado de todas las pistas (por ejemplo, cuando el video vuelve a empezar) sin tocar los totales. */
  function olvidarTodas() {
    estados.clear();
  }

  /** Cambia la línea. Los lados guardados de cada persona ya no valen y se olvidan; los totales se conservan. */
  function moverLinea(nueva) {
    linea = { ...linea, ...nueva, sentido: (nueva.sentido ?? linea.sentido) >= 0 ? 1 : -1 };
    tramo = alargarSegmento(linea.a, linea.b, linea.margen);
    estados.clear();
  }

  function reiniciar({ entradas: e = 0, salidas: s = 0 } = {}) {
    entradas = e;
    salidas = s;
    estados.clear();
  }

  return {
    observar,
    olvidar,
    olvidarTodas,
    moverLinea,
    reiniciar,
    ladoDe,
    get entradas() {
      return entradas;
    },
    get salidas() {
      return salidas;
    },
    get linea() {
      return { ...linea };
    },
  };
}

/**
 * Aforo: personas dentro = entradas − salidas + ajuste manual, nunca menos de cero.
 * `lleno` se vuelve verdadero al llegar al máximo (no al pasarlo).
 */
export function calcularAforo({ entradas = 0, salidas = 0, ajuste = 0, maximo = 0 }) {
  const dentro = Math.max(0, entradas - salidas + ajuste);
  const max = Math.max(1, Math.round(maximo) || 1);
  return { dentro, maximo: max, lleno: dentro >= max, proporcion: Math.min(1, dentro / max) };
}
