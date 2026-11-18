// Seguimiento simple entre cuadros: a cada persona detectada le toca un número estable mientras siga a la vista.
// Asocia por superposición (IoU) contra la posición predicha con la velocidad de cada pista y, si no se superponen
// (cuadros lejanos o gente rápida), por cercanía del centro, con un radio que crece con el tiempo transcurrido.
// Si las detecciones traen firma de apariencia (colores de la ropa), dos cajas de colores muy distintos no se
// emparejan y, entre candidatas, gana la de colores más parecidos. Emparejamiento voraz: primero los pares más
// parecidos. No reconoce a nadie: si una persona sale de cuadro y vuelve, es una pista nueva con otro número.

import { iou, centro, puntoDeApoyo } from './geometria.mjs';
import { parecido, mezclarFirmas } from './apariencia.mjs';

export const OPCIONES_SEGUIMIENTO = Object.freeze({
  iouMinimo: 0.2, // superposición mínima para emparejar por IoU
  distanciaMaxima: 0.8, // si no hay IoU: distancia entre centros / diagonal de la caja predicha…
  distanciaPorSegundo: 1.2, // …y nunca más que (0,15 + esto × segundos transcurridos) diagonales
  aparienciaMinima: 0.75, // parecido de colores por debajo del cual dos cajas no son la misma persona
  pesoApariencia: 2, // cuánto pesa la diferencia de colores en el costo de un par
  proporcionTamano: 2.2, // si no hay IoU: la caja no puede crecer ni encogerse más que esto
  vistosParaConfirmar: 2, // cuadros con detección antes de que la pista cuente (filtra detecciones sueltas)
  ausenciaMaximaMs: 900, // una pista confirmada sobrevive este tiempo sin detección
  suavizado: 0.6, // peso de la detección nueva en la caja suavizada (0..1)
  prediccionMaximaMs: 400, // no se extrapola la velocidad más allá de esto
});

function cajaPredicha(pista, t, op) {
  const dt = Math.min(Math.max(0, t - pista.ultimoT), op.prediccionMaximaMs);
  return { x: pista.caja.x + pista.vx * dt, y: pista.caja.y + pista.vy * dt, w: pista.caja.w, h: pista.caja.h };
}

function costoDePar(pred, det, dtMs, firmaPista, op) {
  let extra = 0;
  if (firmaPista && det.firma) {
    const p = parecido(firmaPista, det.firma);
    if (p !== null) {
      if (p < op.aparienciaMinima) return Infinity;
      extra = op.pesoApariencia * (1 - p);
    }
  }
  const solape = iou(pred, det);
  if (solape >= op.iouMinimo) return 1 - solape + extra; // 0..0.8 (+ colores)
  const cp = centro(pred);
  const cd = centro(det);
  const diagonal = Math.hypot(pred.w, pred.h) || 1;
  const distancia = Math.hypot(cp.x - cd.x, cp.y - cd.y) / diagonal;
  const radio = Math.min(op.distanciaMaxima, 0.15 + (op.distanciaPorSegundo * dtMs) / 1000);
  const razon = Math.max(det.h / pred.h, pred.h / det.h);
  if (distancia <= radio && razon <= op.proporcionTamano) return 1 + distancia + extra; // peor que un par por IoU
  return Infinity;
}

export function crearSeguidor(opciones = {}) {
  const op = { ...OPCIONES_SEGUIMIENTO, ...opciones };
  let pistas = [];
  let siguienteId = 1;
  let siguienteNumero = 1;

  function actualizar(detecciones, t) {
    const dets = detecciones.filter((d) => d && d.w > 0 && d.h > 0);
    const pares = [];
    pistas.forEach((pista, i) => {
      const pred = cajaPredicha(pista, t, op);
      const dt = Math.max(0, t - pista.ultimoT);
      dets.forEach((det, j) => {
        const costo = costoDePar(pred, det, dt, pista.firma, op);
        if (costo !== Infinity) pares.push({ i, j, costo });
      });
    });
    pares.sort((p, q) => p.costo - q.costo || p.i - q.i || p.j - q.j);

    const pistaUsada = new Set();
    const detUsada = new Set();
    for (const par of pares) {
      if (pistaUsada.has(par.i) || detUsada.has(par.j)) continue;
      pistaUsada.add(par.i);
      detUsada.add(par.j);
      const pista = pistas[par.i];
      const det = dets[par.j];
      const dt = Math.max(1, t - pista.ultimoT);
      const a = op.suavizado;
      const nueva = {
        x: a * det.x + (1 - a) * pista.caja.x,
        y: a * det.y + (1 - a) * pista.caja.y,
        w: a * det.w + (1 - a) * pista.caja.w,
        h: a * det.h + (1 - a) * pista.caja.h,
      };
      const cAntes = centro(pista.caja);
      const cDespues = centro(nueva);
      pista.vx = 0.5 * pista.vx + 0.5 * ((cDespues.x - cAntes.x) / dt);
      pista.vy = 0.5 * pista.vy + 0.5 * ((cDespues.y - cAntes.y) / dt);
      pista.caja = nueva;
      pista.firma = mezclarFirmas(pista.firma, det.firma || null);
      pista.puntaje = det.puntaje ?? pista.puntaje;
      pista.vistos += 1;
      pista.perdidos = 0;
      pista.ultimoT = t;
      pista.vistaAhora = true;
      pista.recienConfirmada = false;
      if (!pista.confirmada && pista.vistos >= op.vistosParaConfirmar) {
        pista.confirmada = true;
        pista.recienConfirmada = true;
        pista.numero = siguienteNumero++;
      }
    }

    const sobreviven = [];
    pistas.forEach((pista, i) => {
      if (pistaUsada.has(i)) {
        sobreviven.push(pista);
        return;
      }
      pista.perdidos += 1;
      pista.vistaAhora = false;
      pista.recienConfirmada = false;
      const vence = pista.confirmada ? t - pista.ultimoT > op.ausenciaMaximaMs : true;
      if (!vence) sobreviven.push(pista);
    });

    dets.forEach((det, j) => {
      if (detUsada.has(j)) return;
      const pista = {
        id: siguienteId++,
        numero: null,
        caja: { x: det.x, y: det.y, w: det.w, h: det.h },
        firma: det.firma ? Float32Array.from(det.firma) : null,
        vx: 0,
        vy: 0,
        puntaje: det.puntaje ?? null,
        vistos: 1,
        perdidos: 0,
        creadaT: t,
        ultimoT: t,
        confirmada: false,
        recienConfirmada: false,
        vistaAhora: true,
      };
      if (op.vistosParaConfirmar <= 1) {
        pista.confirmada = true;
        pista.recienConfirmada = true;
        pista.numero = siguienteNumero++;
      }
      sobreviven.push(pista);
    });

    const eliminadas = pistas.filter((p) => !sobreviven.includes(p)).map((p) => p.id);
    pistas = sobreviven;
    return { pistas: pistas.map(vistaDePista), eliminadas };
  }

  function reiniciar() {
    pistas = [];
  }

  return {
    actualizar,
    reiniciar,
    get pistas() {
      return pistas.map(vistaDePista);
    },
  };
}

function vistaDePista(p) {
  return {
    id: p.id,
    numero: p.numero,
    caja: { ...p.caja },
    punto: puntoDeApoyo(p.caja),
    confirmada: p.confirmada,
    recienConfirmada: p.recienConfirmada,
    vistaAhora: p.vistaAhora,
    vistos: p.vistos,
    perdidos: p.perdidos,
    puntaje: p.puntaje,
  };
}
