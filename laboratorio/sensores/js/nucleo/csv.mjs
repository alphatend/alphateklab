// Registro de temperaturas en CSV, el que pide un inspector de salud: fecha, hora y la lectura de cada
// equipo de frío, con las puertas y qué estaba fuera de rango en ese momento.
//
// Separador coma y punto decimal (como usa Excel en Panamá). El archivo lleva BOM para que Excel lea
// bien las tildes y el «°».

import { sensor } from './sensores.mjs';
import { fmtFechaISO, fmtHora } from './formato.mjs';

export const BOM = '﻿';

// Una celda: los números van tal cual; el texto entre comillas si hace falta, y si empieza con un
// carácter que una hoja de cálculo tomaría por fórmula, se le antepone un apóstrofo.
export function celda(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function aCSV(filas, { bom = true } = {}) {
  const texto = filas.map((f) => f.map(celda).join(',')).join('\r\n') + '\r\n';
  return bom ? BOM + texto : texto;
}

const COLUMNAS = ['nevera', 'cuarto', 'congelador'];
// Equipos que se anotan en la columna «Fuera de rango», en este orden.
const SENSORES_DEL_REGISTRO = ['nevera', 'cuarto', 'congelador', 'puertaNevera', 'puertaCuarto', 'corriente'];

// La primera fila dice que los datos son simulados: un archivo suelto no puede pasar por un registro real.
export const NOTA_SIMULADO = 'Datos simulados de un restaurante ficticio (demo de alphateklab). No son lecturas reales.';
// Filas antes de las lecturas: la nota y el encabezado.
export const FILAS_CABECERA = 2;

// muestras: las del simulador; alertas: la bitácora; cada: segundos entre filas (60, 900, 3600).
export function registroTemperaturas(muestras, alertas, { desde, hasta, cada = 60, baseISO }) {
  const encabezado = [
    'Fecha',
    'Hora',
    ...COLUMNAS.map((id) => `${sensor(id).nombre} (°C)`),
    'Puerta de la nevera',
    'Puerta del cuarto frío',
    'Fuera de rango',
  ];
  const relevantes = alertas.filter((a) => SENSORES_DEL_REGISTRO.includes(a.sensor));
  const filas = [[NOTA_SIMULADO], encabezado];
  for (const m of muestras) {
    if (m.t < desde || m.t > hasta) continue;
    if (m.t % cada !== 0) continue;
    // Un equipo cuenta como fuera de rango en el tramo de un aviso: desde que salió hasta que volvió.
    const fuera = new Set(relevantes.filter((a) => a.inicio <= m.t && (a.fin === null || m.t < a.fin)).map((a) => a.sensor));
    const nombres = SENSORES_DEL_REGISTRO.filter((id) => fuera.has(id)).map((id) => sensor(id).nombre);
    filas.push([
      fmtFechaISO(m.t, baseISO),
      fmtHora(m.t),
      ...COLUMNAS.map((id) => m[id]),
      m.puertaNevera ? 'abierta' : 'cerrada',
      m.puertaCuarto ? 'abierta' : 'cerrada',
      nombres.join('; '),
    ]);
  }
  return filas;
}

export function nombreArchivo(desde, hasta, baseISO) {
  const a = fmtFechaISO(desde, baseISO);
  const b = fmtFechaISO(hasta, baseISO);
  return a === b ? `temperaturas-restaurante-de-ejemplo-${a}.csv` : `temperaturas-restaurante-de-ejemplo-${a}-a-${b}.csv`;
}
