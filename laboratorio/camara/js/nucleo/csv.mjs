// Exportación a CSV (RFC 4180): campos con coma, comillas o salto de línea van entre comillas y las comillas se
// duplican. Separador coma y punto decimal, como usa Excel con la configuración regional de Panamá.
// Lleva BOM para que Excel abra bien las tildes.

export const BOM = '﻿';

export function campoCSV(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  // Las fórmulas que empiezan con = + - @ se neutralizan para que Excel no las ejecute.
  const seguro = /^[=+\-@]/.test(texto) && !/^-?\d+(\.\d+)?$/.test(texto) ? "'" + texto : texto;
  return /[",\r\n]/.test(seguro) ? '"' + seguro.replace(/"/g, '""') + '"' : seguro;
}

export function aCSV(encabezados, filas) {
  const lineas = [encabezados.map(campoCSV).join(',')];
  for (const fila of filas) lineas.push(fila.map(campoCSV).join(','));
  return BOM + lineas.join('\r\n') + '\r\n';
}

function dos(n) {
  return String(n).padStart(2, '0');
}

/** «2026-10-03 14:05» en la hora local del equipo. */
export function fechaHoraLocal(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** CSV del conteo por minuto. `intervalos` viene de crearIntervalos().todos(). */
export function csvDeIntervalos(intervalos, { fuente = '' } = {}) {
  const filas = intervalos.map((c) => [fechaHoraLocal(c.inicio), c.entradas, c.salidas, fuente]);
  return aCSV(['minuto (hora local)', 'entradas', 'salidas', 'fuente'], filas);
}
