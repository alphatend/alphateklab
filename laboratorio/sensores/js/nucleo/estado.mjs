// Lo que se guarda en localStorage entre visitas, con versión de esquema. No se guardan los datos:
// se guarda la semilla, el registro de acciones y hasta dónde llegó el reloj, y al volver se repite.
// Si lo guardado no se entiende (otra versión, datos rotos), se ignora y la demo arranca de cero.

import { FALLAS, PASO, SEMILLA } from './simulador.mjs';
import { validarRegla } from './reglas.mjs';
import { T_INICIO, T_LIMITE } from './motor.mjs';
import { VENTANAS } from './escalas.mjs';

export const CLAVE = 'atk-sensores';
export const VERSION = 1;
export const VELOCIDADES = [1, 60, 600];
export const MAX_ACCIONES = 600;

const esFechaISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const esSala = (s) => typeof s === 'string' && /^[a-z0-9]{10}$/.test(s);
// La partida: una marca aleatoria que cambia con cada «Restablecer». Va dentro del id de cada aviso que sale
// al teléfono, para que el teléfono no descarte como repetido el aviso «1» de una partida nueva.
export const esPartida = (s) => typeof s === 'string' && /^[a-z0-9]{8}$/.test(s);

function accionValida(a) {
  if (!a || typeof a !== 'object') return false;
  if (!Number.isInteger(a.t) || a.t < 0 || a.t > T_LIMITE || a.t % PASO !== 0) return false;
  if (a.tipo === 'falla') return FALLAS.includes(a.falla) && typeof a.activa === 'boolean';
  if (a.tipo === 'reglas') return reglasValidas(a.reglas);
  return false;
}

export function reglasValidas(reglas) {
  if (!Array.isArray(reglas) || reglas.length > 40) return false;
  const ids = new Set();
  for (const r of reglas) {
    if (!r || typeof r.id !== 'string' || !/^r\d{1,4}$/.test(r.id) || ids.has(r.id)) return false;
    if (typeof r.activa !== 'boolean') return false;
    if (validarRegla(r).length) return false;
    ids.add(r.id);
  }
  return true;
}

export function serializar({ semilla, acciones, t, velocidad, ventana, baseISO, sala = null, partida = null }) {
  return JSON.stringify({ v: VERSION, semilla, acciones, t, velocidad, ventana, baseISO, sala, partida });
}

// Devuelve el estado guardado o null si no sirve.
export function leer(texto) {
  let d;
  try {
    d = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object' || d.v !== VERSION) return null;
  if (!Number.isInteger(d.semilla) || d.semilla < 0) return null;
  if (!Number.isInteger(d.t) || d.t < T_INICIO || d.t > T_LIMITE) return null;
  if (!Array.isArray(d.acciones) || d.acciones.length > MAX_ACCIONES || !d.acciones.every(accionValida)) return null;
  if (d.acciones.some((a) => a.t > d.t)) return null;
  if (!esFechaISO(d.baseISO)) return null;
  return {
    semilla: d.semilla,
    acciones: d.acciones,
    t: d.t,
    velocidad: VELOCIDADES.includes(d.velocidad) ? d.velocidad : 60,
    ventana: VENTANAS.includes(d.ventana) ? d.ventana : 6,
    baseISO: d.baseISO,
    sala: esSala(d.sala) ? d.sala : null,
    partida: esPartida(d.partida) ? d.partida : null,
  };
}

export function estadoInicial(hoyISO, partida = null) {
  return { semilla: SEMILLA, acciones: [], t: T_INICIO, velocidad: 60, ventana: 6, baseISO: hoyISO, sala: null, partida };
}

export function nuevaPartida(aleatorio = Math.random) {
  const letras = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += letras[Math.floor(aleatorio() * letras.length) % letras.length];
  return s;
}

// Dos pestañas del tablero guardan en el mismo lugar. Antes de escribir (y cuando la otra pestaña guarda),
// se mira lo guardado: si es otra partida (la otra pestaña restableció) o trae más acciones que las propias
// (la otra pestaña provocó una falla o cambió una regla), esta pestaña la adopta en vez de pisarla.
// `propio` y `ajeno` son estados como los que devuelve leer().
export function debeAdoptar(propio, ajeno) {
  if (!ajeno || !propio) return false;
  // lo guardado por una versión sin partida cuenta como la misma partida
  if (esPartida(ajeno.partida) && ajeno.partida !== propio.partida) return true;
  return ajeno.acciones.length > propio.acciones.length;
}

// ¿Cabe una acción más en el registro? Si no, lo guardado dejaría de leerse al volver (ver leer()).
export function quedaEspacio(acciones) {
  return acciones.length < MAX_ACCIONES;
}

// La fecha local de hoy en ISO (para el día 1 de la simulación).
export function hoyISO(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}
