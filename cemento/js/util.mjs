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
/** «lun 26-oct al jue 29-oct» */
export const rangoCorto = (desde, hasta) => (desde === hasta ? fechaCorta(desde) : `${fechaCorta(desde)} al ${fechaCorta(hasta)}`);
/** Primer día del mes y nombre del mes: «octubre de 2026». */
export const nombreMes = (dia) => { const m = MESES_LARGOS[Number(dia.slice(5, 7)) - 1]; return `${m[0].toUpperCase()}${m.slice(1)} de ${dia.slice(0, 4)}`; };
export const DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
/** Día de la semana empezando en lunes (0 = lunes). */
export const diaSemana = (dia) => (new Date(dia + "T12:00:00Z").getUTCDay() + 6) % 7;
/** Sin tildes y en minúsculas, para buscar. */
export const normal = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** H-0007 */
export const numeroHallazgo = (h) => (h?.numero ? `H-${String(h.numero).padStart(4, "0")}` : "H-····");
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
  tablero: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17.5h2"/>',
  colector: '<path d="M6 3h12v6l-3 4v7H9v-7L6 9z"/><path d="M9 6h6"/><path d="M12 13v7" stroke-dasharray="1.5 2.5"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  campana: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 004 0"/>',
  salir: '<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>',
  excel: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9.5 11l4 6M13.5 11l-4 6"/>',
  correo: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  lapiz: '<path d="M4 20h4L19 9a2.1 2.1 0 00-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0012 3.5z" fill="currentColor"/>',
  visto: '<path d="M3 12.5l5 5L21 5"/><path d="M8 12.5l5 5" opacity=".45"/>',
  enviar: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  llave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
  personas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.8 3.3-5.5 6.5-5.5s5.7 1.7 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c2 .7 3.2 2.4 3.6 5.2"/>',
  empresa: '<path d="M3 21h18"/><path d="M5 21V8l7-4v17"/><path d="M12 21V10l7 3v8"/><path d="M8 11v.5M8 15v.5M15.5 15v.5"/>',
  arrastrar: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  enlace: '<path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  paro: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9v6M14.5 9v6"/>',
};
export const icono = (nombre, clase = "ico") =>
  `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nombre] ?? ""}</svg>`;
