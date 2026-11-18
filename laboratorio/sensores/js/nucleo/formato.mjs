// Formato de cifras, horas y fechas en español de Panamá (punto decimal, como en es-PA).
// El tiempo de la simulación (t, en segundos desde el día 0) se convierte a fecha con una «fecha base»:
// el día 1 de la simulación es la fecha en que el visitante abrió la demo por primera vez.

import { sensor } from './sensores.mjs';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const formateadores = new Map();

export function fmtNumero(v, decimales = 1) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  const clave = decimales;
  if (!formateadores.has(clave)) {
    formateadores.set(clave, new Intl.NumberFormat('es-PA', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }));
  }
  const texto = formateadores.get(clave).format(v);
  // signo menos tipográfico; y nada de «−0.0»
  if (/^-0(\.0+)?$/.test(texto)) return texto.slice(1);
  return texto.replace('-', '−');
}

// «3.4 °C», «62 %», «1.2 mm/s», «abierta». Entre la cifra y la unidad va un espacio que no se parte.
export function fmtValor(idSensor, v) {
  const s = sensor(idSensor);
  if (!s) return String(v);
  if (s.tipo === 'estado') return v ? s.activo : s.inactivo;
  if (s.tipo === 'corriente') return `${fmtNumero(v, 2)}\u00a0kW`;
  return `${fmtNumero(v, s.decimales)}\u00a0${s.unidad}`;
}

// Un límite de regla: «5 °C», «−15 °C», «4.5 mm/s» (sin «.0» cuando es entero).
export function fmtLimite(idSensor, v) {
  const s = sensor(idSensor);
  if (!s || s.tipo !== 'numero') return fmtValor(idSensor, v);
  const dec = Number.isInteger(v) ? 0 : s.decimales;
  return `${fmtNumero(v, dec)}\u00a0${s.unidad}`;
}

const dos = (n) => String(n).padStart(2, '0');

export function fmtHora(t) {
  const s = ((Math.floor(t) % 86400) + 86400) % 86400;
  return `${dos(Math.floor(s / 3600))}:${dos(Math.floor((s % 3600) / 60))}`;
}

export function diaDe(t) {
  return Math.floor(t / 86400);
}

function fechaUTC(t, baseISO) {
  const [a, m, d] = baseISO.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + diaDe(t) - 1));
}

// «sáb 3 oct»
export function fmtFecha(t, baseISO) {
  const f = fechaUTC(t, baseISO);
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} ${MESES[f.getUTCMonth()]}`;
}

// «2026-10-03»
export function fmtFechaISO(t, baseISO) {
  const f = fechaUTC(t, baseISO);
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
}

// «14:02», «ayer 23:10» o «jue 1 oct 08:15», según el día de referencia.
export function fmtMomento(t, referencia, baseISO) {
  const d = diaDe(referencia) - diaDe(t);
  if (d === 0) return fmtHora(t);
  if (d === 1) return `ayer ${fmtHora(t)}`;
  return `${fmtFecha(t, baseISO)} ${fmtHora(t)}`;
}

// «las 14:02», «ayer a las 23:10», «el jue 1 oct a las 08:15» (para frases)
export function fmtDesde(t, referencia, baseISO) {
  const d = diaDe(referencia) - diaDe(t);
  if (d === 0) return `las ${fmtHora(t)}`;
  if (d === 1) return `ayer a las ${fmtHora(t)}`;
  return `el ${fmtFecha(t, baseISO)} a las ${fmtHora(t)}`;
}

// «45 s», «4 min», «1 h 38 min», «2 h»
export function fmtDuracion(segundos) {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s}\u00a0s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min}\u00a0min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h}\u00a0h ${resto}\u00a0min` : `${h}\u00a0h`;
}
