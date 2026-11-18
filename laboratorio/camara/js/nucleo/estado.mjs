// Lo que la demo guarda en localStorage: la configuración de cada fuente (línea, zona, umbrales), las preferencias
// de vista y el conteo del día. Con versión de esquema: si lo guardado es de otra versión o está roto, se vuelve a los
// datos de ejemplo sin romper la página.
//
// Todas las posiciones van normalizadas (0..1 sobre el ancho y el alto del video), así sirven para cualquier
// resolución.

import { areaPoligono, limitar } from './geometria.mjs';

export const VERSION_ESQUEMA = 1;
export const CLAVE_ALMACEN = 'atk-camara';
export const FUENTES = ['muestra', 'camara', 'archivo'];

const LINEA_MINIMA = 0.03; // largo mínimo de la línea, en fracción del ancho/alto
const AREA_MINIMA = 0.002; // área mínima de la zona de fila, en fracción del cuadro
const MAX_VERTICES = 12;

// Datos de ejemplo. La línea va de abajo (a) hacia arriba (b): con sentido +1, «entrada» es cruzar de izquierda a
// derecha. La zona y los umbrales del video de muestra están elegidos con sus detecciones reales para que cada vuelta
// del video abra y cierre una vez el aviso de aforo y el de fila (ver pruebas/muestra.test.mjs).
const POR_DEFECTO = {
  muestra: {
    linea: { a: { x: 0.5, y: 0.97 }, b: { x: 0.5, y: 0.55 } },
    sentido: 1,
    // la vereda frente a la tienda de la derecha, donde la gente se detiene
    zona: [
      { x: 0.62, y: 0.45 },
      { x: 0.99, y: 0.45 },
      { x: 0.99, y: 0.72 },
      { x: 0.62, y: 0.72 },
    ],
    aforoMax: 4,
    filaMax: 2,
    filaSegundos: 2,
  },
  camara: {
    linea: { a: { x: 0.5, y: 0.95 }, b: { x: 0.5, y: 0.08 } },
    sentido: 1,
    zona: [
      { x: 0.04, y: 0.08 },
      { x: 0.4, y: 0.08 },
      { x: 0.4, y: 0.95 },
      { x: 0.04, y: 0.95 },
    ],
    aforoMax: 1,
    filaMax: 0,
    filaSegundos: 3,
  },
  archivo: {
    linea: { a: { x: 0.5, y: 0.95 }, b: { x: 0.5, y: 0.08 } },
    sentido: 1,
    zona: [
      { x: 0.6, y: 0.4 },
      { x: 0.96, y: 0.4 },
      { x: 0.96, y: 0.96 },
      { x: 0.6, y: 0.96 },
    ],
    aforoMax: 20,
    filaMax: 3,
    filaSegundos: 10,
  },
};

export const LIMITES = Object.freeze({
  aforoMax: [1, 9999],
  filaMax: [0, 99],
  filaSegundos: [1, 600],
});

// pixelado: 'personas' (cada persona detectada), 'todo' (el cuadro entero) o 'nada'
export const PIXELADOS = ['personas', 'todo', 'nada'];
export const PREFERENCIAS_POR_DEFECTO = Object.freeze({ pixelado: 'personas', verCalor: true, verCajas: true });

const copia = (o) => JSON.parse(JSON.stringify(o));

export function configPorDefecto(fuente) {
  return copia(POR_DEFECTO[FUENTES.includes(fuente) ? fuente : 'archivo']);
}

function puntoValido(p) {
  return (
    p &&
    typeof p === 'object' &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= 0 &&
    p.x <= 1 &&
    p.y >= 0 &&
    p.y <= 1
  );
}

export function lineaValida(l) {
  if (!l || !puntoValido(l.a) || !puntoValido(l.b)) return false;
  return Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y) >= LINEA_MINIMA;
}

export function zonaValida(z) {
  if (!Array.isArray(z) || z.length < 3 || z.length > MAX_VERTICES) return false;
  if (!z.every(puntoValido)) return false;
  return areaPoligono(z) >= AREA_MINIMA;
}

function entero(v, [min, max], porDefecto) {
  const n = Number(v);
  if (!Number.isFinite(n)) return porDefecto;
  return limitar(Math.round(n), min, max);
}

/** Devuelve una configuración válida: lo que venga mal se reemplaza por el valor de ejemplo de esa fuente. */
export function sanearConfig(obj, fuente) {
  const base = configPorDefecto(fuente);
  if (!obj || typeof obj !== 'object') return base;
  const limpio = (p) => ({ x: p.x, y: p.y });
  return {
    linea: lineaValida(obj.linea) ? { a: limpio(obj.linea.a), b: limpio(obj.linea.b) } : base.linea,
    sentido: obj.sentido === -1 ? -1 : obj.sentido === 1 ? 1 : base.sentido,
    // null = el usuario borró la zona a propósito; se respeta.
    zona: obj.zona === null ? null : zonaValida(obj.zona) ? obj.zona.map(limpio) : base.zona,
    aforoMax: entero(obj.aforoMax, LIMITES.aforoMax, base.aforoMax),
    filaMax: entero(obj.filaMax, LIMITES.filaMax, base.filaMax),
    filaSegundos: entero(obj.filaSegundos, LIMITES.filaSegundos, base.filaSegundos),
  };
}

export function sanearPreferencias(obj) {
  const base = { ...PREFERENCIAS_POR_DEFECTO };
  if (!obj || typeof obj !== 'object') return base;
  for (const k of ['verCalor', 'verCajas']) if (typeof obj[k] === 'boolean') base[k] = obj[k];
  if (PIXELADOS.includes(obj.pixelado)) base.pixelado = obj.pixelado;
  return base;
}

function dos(n) {
  return String(n).padStart(2, '0');
}

/** «2026-10-03» en la hora local del equipo. */
export function fechaLocal(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export const MAX_BITACORA = 50;

export function conteoVacio(fecha) {
  return { fecha, entradas: 0, salidas: 0, ajuste: 0, maximo: 0, intervalos: {}, calor: null, avisosFila: 0, bitacora: [], hasta: null };
}

/** Avisos del día: { tipo: 'aforo' | 'fila', inicio, fin (null si sigue abierto), detalle, maximo, inicial }. */
function sanearBitacora(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((a) => a && (a.tipo === 'aforo' || a.tipo === 'fila') && Number.isFinite(a.inicio))
    .slice(-MAX_BITACORA)
    .map((a) => ({
      tipo: a.tipo,
      inicio: a.inicio,
      fin: Number.isFinite(a.fin) ? a.fin : null,
      detalle: typeof a.detalle === 'string' ? a.detalle.slice(0, 200) : '',
      maximo: Math.max(0, Math.floor(Number(a.maximo) || 0)),
      inicial: Math.max(0, Math.floor(Number(a.inicial) || 0)), // cuenta al abrirse el aviso
    }));
}

/** El conteo guardado vale solo el mismo día; si es de otro día (o está roto) se empieza de cero. */
export function conteoDeHoy(conteo, fechaHoy) {
  if (!conteo || typeof conteo !== 'object' || conteo.fecha !== fechaHoy) return conteoVacio(fechaHoy);
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
  return {
    fecha: fechaHoy,
    entradas: n(conteo.entradas),
    salidas: n(conteo.salidas),
    ajuste: Math.floor(Number(conteo.ajuste) || 0),
    maximo: n(conteo.maximo),
    intervalos: conteo.intervalos && typeof conteo.intervalos === 'object' ? conteo.intervalos : {},
    calor: conteo.calor && typeof conteo.calor === 'object' ? conteo.calor : null,
    avisosFila: n(conteo.avisosFila),
    bitacora: sanearBitacora(conteo.bitacora),
    // hora (reloj) de la última vez que se guardó este conteo: ahí se cierran los avisos que quedaron abiertos
    hasta: Number.isFinite(conteo.hasta) ? conteo.hasta : null,
  };
}

/**
 * Cierra los avisos abiertos (fin null) de los tipos indicados, a la hora `t` (nunca antes de su inicio).
 * Se usa cuando la escena que podía cerrarlos ya no existe: al apagar la demo, al recargar la página o al crear una
 * escena nueva, que empieza con el aviso de fila cerrado y nunca mandaría su «cierra».
 * Devuelve una lista nueva; no toca la de entrada.
 */
export function cerrarAvisosAbiertos(bitacora, { fila = false, aforo = false } = {}, t) {
  return (bitacora || []).map((a) => {
    if (a.fin !== null || !((a.tipo === 'fila' && fila) || (a.tipo === 'aforo' && aforo))) return a;
    const fin = Number.isFinite(t) ? Math.max(a.inicio, t) : a.inicio;
    return { ...a, fin };
  });
}

export function estadoPorDefecto(fechaHoy) {
  const fuentes = {};
  for (const f of FUENTES) fuentes[f] = { config: configPorDefecto(f), conteo: conteoVacio(fechaHoy), firma: null };
  return { v: VERSION_ESQUEMA, preferencias: { ...PREFERENCIAS_POR_DEFECTO }, fuentes };
}

/** Lee el texto guardado. Nunca lanza: si no sirve, devuelve los datos de ejemplo. */
export function leerEstado(texto, fechaHoy) {
  const base = estadoPorDefecto(fechaHoy);
  if (typeof texto !== 'string' || !texto) return base;
  let obj;
  try {
    obj = JSON.parse(texto);
  } catch {
    return base;
  }
  if (!obj || obj.v !== VERSION_ESQUEMA) return base;
  base.preferencias = sanearPreferencias(obj.preferencias);
  for (const f of FUENTES) {
    const guardada = obj.fuentes && obj.fuentes[f];
    if (!guardada) continue;
    base.fuentes[f] = {
      config: sanearConfig(guardada.config, f),
      conteo: conteoDeHoy(guardada.conteo, fechaHoy),
      firma: typeof guardada.firma === 'string' ? guardada.firma.slice(0, 300) : null,
    };
  }
  return base;
}

export function escribirEstado(estado) {
  return JSON.stringify({ ...estado, v: VERSION_ESQUEMA });
}
