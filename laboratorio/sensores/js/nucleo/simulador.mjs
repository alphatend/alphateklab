// Simulador determinista del restaurante de ejemplo. No hay sensores reales: todo sale de aquí.
//
// Física sencilla, a propósito:
// - Cada equipo de frío tiene dos temperaturas: el aire de adentro (lo que mide el sensor) y la comida
//   (mucha masa, cambia despacio). El calor entra por las paredes y por la puerta abierta; la compresora
//   lo saca cuando el termostato la prende. Por eso al abrir la puerta el aire sube rápido y baja en
//   minutos, y con la puerta abierta de verdad la temperatura no deja de subir.
// - El consumo eléctrico sigue el horario del restaurante y el trabajo real de las compresoras.
// - El tanque baja con el consumo y lo llena una bomba que necesita corriente.
// - La humedad de la bodega sube de madrugada y con los aguaceros de la tarde.
//
// t es el tiempo de la simulación en segundos desde el día 0 a las 00:00.
// La misma semilla y las mismas acciones en los mismos momentos dan exactamente los mismos datos.

import { crearAzar, semillaDerivada } from './azar.mjs';
import { aireEncendido, calorTarde, cocina, entregas, horaDelDia, ocupacion } from './perfil.mjs';
import { CAPACIDAD_TANQUE_L } from './sensores.mjs';

export const SEMILLA = 20261003;
export const PASO = 10; // segundos de simulación por paso de física
export const MUESTRA = 60; // cada sensor reporta una lectura por minuto
export const DIA = 86400;
export const DURACION_CORTE = 2 * 3600;
export const HISTORIA_MAX = 8 * DIA; // lo que se guarda en memoria (y lo que puede salir en el CSV)

export const FALLAS = ['puerta', 'corte', 'fuga', 'compresora'];

// Parámetros de los equipos de frío (unidades por hora; ver la cabecera).
const EQUIPOS = {
  nevera: { Ca: 6, Cc: 30, UAw: 1.05, UAd: 15, UAm: 25, Q: 113, prende: 4.0, apaga: 2.6, kw: 0.35, kwDanada: 0.42, ventilador: 0.03, Ta: 3.2, Tc: 3.3 },
  congelador: { Ca: 3, Cc: 80, UAw: 0.7, UAd: 10, UAm: 30, Q: 160, prende: -16.5, apaga: -19.5, kw: 0.45, ventilador: 0.04, Ta: -18, Tc: -18 },
  cuarto: { Ca: 12, Cc: 90, UAw: 3, UAd: 30, UAm: 50, Q: 330, prende: 4.0, apaga: 2.0, kw: 1.3, ventilador: 0.12, Ta: 3, Tc: 3.1 },
};

// Compresora dañada: vibra desde el primer minuto, pero el frío se pierde de a poco (arranca con un tercio de
// su capacidad y llega a cero en 40 min). Por eso el aviso de vibración puede llegar antes que el de temperatura.
const DANADA_CAPACIDAD = 0.35;
const DANADA_APAGA_S = 40 * 60;

const FLUJO_BOMBA_LH = 2400;
const FUGA_LH = 3000;
const BOMBA_PRENDE = 0.4; // fracción del tanque
const BOMBA_APAGA = 0.95;

function redondear(v, decimales) {
  const f = 10 ** decimales;
  const r = Math.round(v * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

// Ruido lento (proceso AR(1) de varianza 1) para que las cargas no se vean de regla.
function crearRuidoLento(azar, memoria = 0.97) {
  let x = 0;
  const k = Math.sqrt(1 - memoria * memoria);
  return () => {
    x = memoria * x + k * azar.normal();
    return x;
  };
}

export function crearSimulador({ semilla = SEMILLA } = {}) {
  const flujo = (nombre) => crearAzar(semillaDerivada(semilla, nombre));

  const azarPuerta = { nevera: flujo('puerta-nevera'), cuarto: flujo('puerta-cuarto'), congelador: flujo('puerta-congelador') };
  const ruido = {
    nevera: flujo('ruido-nevera'),
    cuarto: flujo('ruido-cuarto'),
    congelador: flujo('ruido-congelador'),
    vibracion: flujo('ruido-vibracion'),
    tanque: flujo('ruido-tanque'),
    humedad: flujo('ruido-humedad'),
  };
  const azarLluvia = flujo('lluvia');
  const cargaAire = crearRuidoLento(flujo('carga-aire'));
  const cargaCocina = crearRuidoLento(flujo('carga-cocina'));
  const usoAgua = crearRuidoLento(flujo('uso-agua'), 0.99);

  let t = 0;
  const frio = {};
  for (const [id, p] of Object.entries(EQUIPOS)) frio[id] = { Ta: p.Ta, Tc: p.Tc, compresora: false };
  const puertas = {
    nevera: { abierta: false, resta: 0, forzada: false },
    cuarto: { abierta: false, resta: 0, forzada: false },
    congelador: { abierta: false, resta: 0, forzada: false },
  };
  const tanque = { litros: CAPACIDAD_TANQUE_L * 0.7, bomba: false };
  let humedad = 64;
  const lluvias = new Map(); // día → { inicio, fin, intensidad } o null
  const fallas = { puerta: false, corteHasta: null, fuga: false, compresora: false, compresoraDesde: null };
  const energiaMinuto = { aire: 0, cocina: 0, refri: 0 };
  let potencia = { aire: 0, cocina: 0, refri: 0 };

  // Intervalos de los sensores de estado: { inicio, fin } con fin null mientras sigue.
  const intervalos = { puertaNevera: [], puertaCuarto: [], bomba: [] };
  const muestras = [];
  // Tramos de los cortes de corriente con su hora exacta (para que el aviso diga la misma hora que la falla).
  const cortes = [];

  function abrirIntervalo(id, inicio) {
    intervalos[id].push({ inicio, fin: null });
  }
  function cerrarIntervalo(id, fin) {
    const lista = intervalos[id];
    const ultimo = lista[lista.length - 1];
    if (ultimo && ultimo.fin === null) ultimo.fin = fin;
  }

  function lluviaDelDia(dia) {
    if (!lluvias.has(dia)) {
      // Los días se visitan en orden, así que el flujo de azar se consume siempre igual.
      const llueve = azarLluvia.u() < 0.65;
      const inicio = azarLluvia.entre(13, 17);
      const dura = azarLluvia.entre(1, 2.5);
      const intensidad = azarLluvia.entre(9, 16);
      lluvias.set(dia, llueve ? { inicio, fin: inicio + dura, intensidad } : null);
    }
    return lluvias.get(dia);
  }

  function hayCorriente() {
    return !(fallas.corteHasta !== null && t < fallas.corteHasta);
  }

  // Devuelve la fracción del paso que la puerta estuvo abierta.
  function moverPuerta(id, tasaPorHora, duraMin, duraMax, intervaloId) {
    const p = puertas[id];
    const azar = azarPuerta[id];
    // El sorteo se hace siempre, abierta o no, para que la secuencia no dependa de las fallas.
    const sorteo = azar.u();
    const dura = azar.entre(duraMin, duraMax);
    if (p.forzada) return 1;
    let fraccion = 0;
    if (p.abierta) {
      fraccion = Math.min(p.resta, PASO) / PASO;
      p.resta -= PASO;
      if (p.resta <= 0) {
        p.abierta = false;
        if (intervaloId) cerrarIntervalo(intervaloId, t + PASO + p.resta);
        p.resta = 0;
      }
    } else if (sorteo < (tasaPorHora * PASO) / 3600) {
      p.abierta = true;
      p.resta = dura;
      if (intervaloId) abrirIntervalo(intervaloId, t);
      fraccion = Math.min(dura, PASO) / PASO;
      p.resta -= PASO;
      if (p.resta <= 0) {
        p.abierta = false;
        if (intervaloId) cerrarIntervalo(intervaloId, t + dura);
        p.resta = 0;
      }
    }
    return fraccion;
  }

  function moverFrio(id, Tamb, fraccionPuerta, corriente) {
    const p = EQUIPOS[id];
    const e = frio[id];
    const danada = id === 'nevera' && fallas.compresora;
    if (!corriente) e.compresora = false;
    else if (danada) e.compresora = true; // trabaja sin parar y enfría cada vez menos
    else if (e.Ta > p.prende) e.compresora = true;
    else if (e.Ta < p.apaga) e.compresora = false;
    const capacidad = danada ? DANADA_CAPACIDAD * Math.max(0, 1 - (t - fallas.compresoraDesde) / DANADA_APAGA_S) : 1;
    const Q = e.compresora ? p.Q * capacidad : 0;
    const dt = PASO / 3600;
    const dTa = (p.UAw * (Tamb - e.Ta) + p.UAd * fraccionPuerta * (Tamb - e.Ta) + p.UAm * (e.Tc - e.Ta) - Q) / p.Ca;
    const dTc = (p.UAm * (e.Ta - e.Tc)) / p.Cc;
    e.Ta += dTa * dt;
    e.Tc += dTc * dt;
    if (!corriente) return 0;
    return p.ventilador + (e.compresora ? (danada ? p.kwDanada : p.kw) : 0);
  }

  function paso() {
    const h = horaDelDia(t);
    if (fallas.corteHasta !== null && t >= fallas.corteHasta) {
      const c = cortes[cortes.length - 1];
      if (c && c.fin === null) c.fin = fallas.corteHasta;
      fallas.corteHasta = null;
    }
    const corriente = hayCorriente();
    const dtH = PASO / 3600;

    // Puertas
    const nCocina = cocina(h);
    const fNevera = moverPuerta('nevera', nCocina > 0 ? 2 + 22 * nCocina : 0, 8, 30, 'puertaNevera');
    const enEntregas = entregas(h);
    const fCuarto = moverPuerta(
      'cuarto',
      4 * enEntregas + (nCocina > 0 ? 1 + 5 * nCocina : 0),
      enEntregas > 0.5 ? 60 : 15,
      enEntregas > 0.5 ? 230 : 75,
      'puertaCuarto',
    );
    const fCongelador = moverPuerta('congelador', nCocina > 0 ? 0.5 + 4 * nCocina : 0, 8, 25, null);

    // Frío
    const calor = calorTarde(h);
    const tCocina = 26.5 + 1.5 * calor + 4 * nCocina;
    const tPatio = 27 + 2.5 * calor;
    let refri = 0;
    refri += moverFrio('nevera', tCocina, fNevera, corriente);
    refri += moverFrio('congelador', tCocina, fCongelador, corriente);
    refri += moverFrio('cuarto', tPatio, fCuarto, corriente);

    // Electricidad
    const ruidoAire = cargaAire();
    const ruidoCocina = cargaCocina();
    const aire = corriente && aireEncendido(h) ? Math.max(0, (2.6 + 3 * ocupacion(h) + calor) * (1 + 0.06 * ruidoAire)) : 0;
    const luces = h >= 10 && h < 23 ? 0.6 : 0;
    const cocinaKw = corriente ? Math.max(0.05, (0.3 + luces + 3.4 * nCocina) * (1 + 0.08 * ruidoCocina)) : 0;
    potencia = { aire, cocina: cocinaKw, refri };
    energiaMinuto.aire += aire * dtH;
    energiaMinuto.cocina += cocinaKw * dtH;
    energiaMinuto.refri += refri * dtH;

    // Agua
    const fraccion = tanque.litros / CAPACIDAD_TANQUE_L;
    if (!corriente) tanque.bomba = false;
    else if (fraccion < BOMBA_PRENDE) tanque.bomba = true;
    else if (fraccion > BOMBA_APAGA) tanque.bomba = false;
    const usoLh = Math.max(0, (12 + 140 * nCocina + 180 * ocupacion(h)) * (1 + 0.15 * usoAgua()));
    const salidaLh = usoLh + (fallas.fuga ? FUGA_LH : 0);
    const entradaLh = tanque.bomba ? FLUJO_BOMBA_LH : 0;
    tanque.litros = Math.min(CAPACIDAD_TANQUE_L, Math.max(0, tanque.litros + (entradaLh - salidaLh) * dtH));

    // Humedad
    const dia = Math.floor(t / DIA);
    const lluvia = lluviaDelDia(dia);
    const base = 61 + 6 * Math.cos((2 * Math.PI * (h - 5)) / 24);
    const extra = lluvia && h >= lluvia.inicio && h < lluvia.fin ? lluvia.intensidad : 0;
    humedad += ((base + extra - humedad) * dtH) / 0.4;

    // Bomba como sensor de estado (se registra al cambiar)
    const ultimaBomba = intervalos.bomba[intervalos.bomba.length - 1];
    const bombaRegistrada = !!(ultimaBomba && ultimaBomba.fin === null);
    if (tanque.bomba && !bombaRegistrada) abrirIntervalo('bomba', t);
    if (!tanque.bomba && bombaRegistrada) cerrarIntervalo('bomba', t);

    t += PASO;
    return t % MUESTRA === 0 ? tomarMuestra() : null;
  }

  function tomarMuestra() {
    const e = frio.nevera;
    const vibracionBase = fallas.compresora ? 6.2 : e.compresora ? 1.1 : 0.15;
    const vibracionRuido = fallas.compresora ? 0.5 : e.compresora ? 0.12 : 0.03;
    const m = {
      t,
      nevera: redondear(frio.nevera.Ta + ruido.nevera.normal(0, 0.05), 1),
      cuarto: redondear(frio.cuarto.Ta + ruido.cuarto.normal(0, 0.05), 1),
      congelador: redondear(frio.congelador.Ta + ruido.congelador.normal(0, 0.06), 1),
      vibracion: redondear(Math.max(0, vibracionBase + ruido.vibracion.normal(0, vibracionRuido)), 1),
      tanque: redondear(Math.min(100, Math.max(0, (100 * tanque.litros) / CAPACIDAD_TANQUE_L + ruido.tanque.normal(0, 0.3))), 0),
      humedad: redondear(Math.min(100, Math.max(0, humedad + ruido.humedad.normal(0, 0.5))), 0),
      puertaNevera: puertas.nevera.abierta || puertas.nevera.forzada ? 1 : 0,
      puertaCuarto: puertas.cuarto.abierta ? 1 : 0,
      bomba: tanque.bomba ? 1 : 0,
      aire: redondear(potencia.aire, 2),
      cocina: redondear(potencia.cocina, 2),
      refri: redondear(potencia.refri, 2),
      eAire: redondear(energiaMinuto.aire, 4),
      eCocina: redondear(energiaMinuto.cocina, 4),
      eRefri: redondear(energiaMinuto.refri, 4),
    };
    energiaMinuto.aire = 0;
    energiaMinuto.cocina = 0;
    energiaMinuto.refri = 0;
    muestras.push(m);
    podar();
    return m;
  }

  function podar() {
    const limite = t - HISTORIA_MAX;
    if (muestras.length > HISTORIA_MAX / MUESTRA + 1440) {
      let i = 0;
      while (i < muestras.length && muestras[i].t < limite) i++;
      muestras.splice(0, i);
      for (const lista of Object.values(intervalos)) {
        let j = 0;
        while (j < lista.length && lista[j].fin !== null && lista[j].fin < limite) j++;
        lista.splice(0, j);
      }
    }
  }

  function ponerFalla(nombre, activa) {
    if (nombre === 'puerta') {
      const p = puertas.nevera;
      if (activa && !fallas.puerta) {
        fallas.puerta = true;
        p.forzada = true;
        if (!p.abierta) abrirIntervalo('puertaNevera', t);
        p.abierta = true;
        p.resta = 0;
      } else if (!activa && fallas.puerta) {
        fallas.puerta = false;
        p.forzada = false;
        p.abierta = false;
        p.resta = 0;
        cerrarIntervalo('puertaNevera', t);
      }
    } else if (nombre === 'corte') {
      const c = cortes[cortes.length - 1];
      if (c && c.fin === null) c.fin = t;
      fallas.corteHasta = activa ? t + DURACION_CORTE : null;
      if (activa) cortes.push({ inicio: t, fin: null });
    } else if (nombre === 'fuga') {
      fallas.fuga = !!activa;
    } else if (nombre === 'compresora') {
      if (activa && !fallas.compresora) fallas.compresoraDesde = t;
      fallas.compresora = !!activa;
    } else {
      throw new Error(`Falla desconocida: ${nombre}`);
    }
  }

  return {
    get t() {
      return t;
    },
    paso,
    muestras,
    intervalos,
    cortes,
    ponerFalla,
    fallas() {
      return {
        puerta: fallas.puerta,
        corte: fallas.corteHasta !== null && t < fallas.corteHasta ? fallas.corteHasta : null,
        fuga: fallas.fuga,
        compresora: fallas.compresora,
      };
    },
    ultima() {
      return muestras[muestras.length - 1] || null;
    },
    // Solo para pruebas y ajustes: el estado físico interno.
    interno() {
      return { frio: structuredClone(frio), tanque: { ...tanque }, humedad, potencia: { ...potencia } };
    },
  };
}

export function potenciaTotal(m) {
  return m.aire + m.cocina + m.refri;
}
