// Utilidades sin estado: escapar texto, fechas (de Panamá, día primero) y los íconos.

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Hoy en Panamá (UTC−5), AAAA-MM-DD. */
export function hoyPanama(ahora = Date.now()) {
  return new Date(ahora - 5 * 3600e3).toISOString().slice(0, 10);
}
export function sumarDias(dia, n) {
  return new Date(Date.parse(dia + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
}
export function diasEntre(desde, hasta) {
  return Math.round((Date.parse(hasta + "T00:00:00Z") - Date.parse(desde + "T00:00:00Z")) / 86400e3);
}
/** «jue 29-oct» */
export function fechaCorta(dia) {
  if (!dia) return "";
  const d = new Date(dia.slice(0, 10) + "T12:00:00Z");
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}-${MESES[d.getUTCMonth()]}`;
}
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** «Jueves 29 de octubre» */
export function fechaDia(dia) {
  const d = new Date(dia.slice(0, 10) + "T12:00:00Z");
  const t = `${DIAS_LARGOS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES_LARGOS[d.getUTCMonth()]}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/** «29-oct-2026» */
export function fechaLarga(dia) {
  if (!dia) return "";
  const d = new Date(dia.slice(0, 10) + "T12:00:00Z");
  return `${d.getUTCDate()}-${MESES[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}
/** De un instante ISO: el día de Panamá. */
export const diaDe = (iso) => (iso ? hoyPanama(Date.parse(iso)) : null);
/** «29-oct, 3:15 p. m.» (hora de Panamá) */
export function fechaHora(iso) {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) - 5 * 3600e3);
  const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()}-${MESES[d.getUTCMonth()]}, ${h % 12 || 12}:${m} ${h < 12 ? "a. m." : "p. m."}`;
}
/** Cuánto falta o cuánto se pasó una fecha límite, en palabras. */
export function vencimiento(vence, hoy) {
  const n = diasEntre(hoy, vence);
  if (n === 0) return { texto: "vence hoy", clase: "hoy" };
  if (n === 1) return { texto: "vence mañana", clase: "pronto" };
  if (n > 1) return { texto: `en ${n} días`, clase: "luego" };
  if (n === -1) return { texto: "venció ayer", clase: "atrasada" };
  return { texto: `venció hace ${-n} días`, clase: "atrasada" };
}
export function haceCuanto(iso, hoy) {
  const n = diasEntre(diaDe(iso), hoy);
  return n <= 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`;
}
export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
export const numero = (v, dec = 1) => (v == null || !Number.isFinite(v) ? "—" : Number(v).toLocaleString("es-PA", { maximumFractionDigits: dec }));

// íconos de 24×24, trazo de 2 (se pintan con currentColor)
const P = {
  inicio: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  inspecciones: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3"/><path d="M9 11l2 2 4-4"/><path d="M9 17h6"/>',
  hallazgos: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/>',
  equipos: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  reportes: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 13h7M9 17h7M9 9h3"/>',
  tromp: '<path d="M3 20h18"/><path d="M4 18c4 0 5-1 7-6s3-8 9-8"/><path d="M4 16h16" stroke-dasharray="2 3"/>',
  mas: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  camara: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  galeria: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  microfono: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  mas1: '<path d="M12 5v14M5 12h14"/>',
  repetir: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 014-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 01-4 4H4"/>',
  bien: '<path d="M5 12l5 5 9-10"/>',
  mal: '<path d="M6 6l12 12M18 6L6 18"/>',
  na: '<path d="M5 12h14"/>',
  flecha: '<path d="M15 5l-7 7 7 7"/>',
  derecha: '<path d="M9 5l7 7-7 7"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-3.9-1z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1-1.2 1.8.8c-.3 1.2-1.3 1.9-2.5 1.6C11 14.6 9.4 13 8.8 10.2c-.3-1.2.4-2.2 1.6-2.5l.8 1.8z"/>',
  imprimir: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6"/>',
  nube: '<path d="M7 18a5 5 0 01-.6-10A6 6 0 0118 9a4.5 4.5 0 01-1 9z"/>',
  sinNube: '<path d="M7 18a5 5 0 01-.6-10A6 6 0 0118 9a4.5 4.5 0 01-1 9z"/><path d="M3 3l18 18"/>',
  arriba: '<path d="M6 15l6-6 6 6"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>',
  basura: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
};
export const icono = (nombre, clase = "ico") =>
  `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nombre] ?? ""}</svg>`;
