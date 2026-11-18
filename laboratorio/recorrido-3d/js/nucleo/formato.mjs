// Cifras como se escriben en Panamá (es-PA: punto decimal y coma de miles).

const cache = new Map();
function formateador(decimales) {
  if (!cache.has(decimales)) {
    cache.set(
      decimales,
      new Intl.NumberFormat('es-PA', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }),
    );
  }
  return cache.get(decimales);
}

/** Redondeo a «d» decimales sin el error de 1.005 → 1.00. */
export function redondear(n, d = 2) {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export const numero = (n, d = 2) => formateador(d).format(redondear(n, d));
export const metros = (n) => `${numero(n, 2)} m`;
export const area = (n) => `${numero(n, 2)} m²`;
/** «3.80 × 3.40 m» */
export const medidas = (ancho, largo) => `${numero(ancho, 2)} × ${numero(largo, 2)} m`;

/** «1 ambiente», «2 ambientes»: el número con la palabra que concuerda. */
export const cuenta = (n, singular, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;

/** «A», «B» y «C»: nombres entre comillas, unidos como se escribe en español («e» antes de «i», como en «e Isla»). */
export function listaNombres(nombres) {
  const q = nombres.map((n) => `«${n}»`);
  if (q.length <= 1) return q.join('');
  const y = /^(i|hi)(?![aeiouáéíóú])/i.test(nombres.at(-1)) ? 'e' : 'y';
  return `${q.slice(0, -1).join(', ')} ${y} ${q.at(-1)}`;
}

/**
 * Lee una medida escrita a mano: «2.5», «2,5» (coma decimal) o « 3 ». Devuelve NaN si está vacía o no es un número,
 * para que el formulario pida corregirla en lugar de tomarla como 0.
 */
export function leerNumero(texto) {
  const s = String(texto ?? '').trim();
  if (!s) return NaN;
  const normal = /^[+-]?\d*,\d+$/.test(s) ? s.replace(',', '.') : s;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normal)) return NaN;
  return Number(normal);
}
