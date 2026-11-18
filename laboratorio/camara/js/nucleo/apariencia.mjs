// Firma de apariencia de una persona: un histograma de colores de su ropa (el centro de la caja, sin los bordes,
// que casi siempre son fondo). Sirve para que el seguimiento no le pase el número de una persona a otra que camina
// cerca pero viste distinto. No identifica a nadie: son 64 números que solo comparan colores entre cuadros
// seguidos, viven en memoria y no se guardan.

export const BINS_POR_CANAL = 4;
export const LARGO_FIRMA = BINS_POR_CANAL ** 3; // 64

/**
 * @param imagen {data, width, height} con RGBA (como ImageData)
 * @param caja {x, y, w, h} en píxeles de esa imagen
 * @returns Float32Array de 64 valores que suman 1, o null si la caja no tiene píxeles
 */
export function firmaDeCaja(imagen, caja, muestrasMax = 900) {
  const { data, width, height } = imagen;
  const x0 = Math.max(0, Math.floor(caja.x + caja.w * 0.2));
  const x1 = Math.min(width, Math.ceil(caja.x + caja.w * 0.8));
  const y0 = Math.max(0, Math.floor(caja.y + caja.h * 0.12));
  const y1 = Math.min(height, Math.ceil(caja.y + caja.h * 0.88));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return null;
  // muestreo en rejilla para que una persona grande no cueste más que una chica
  const paso = Math.max(1, Math.floor(Math.sqrt((w * h) / muestrasMax)));
  const hist = new Float32Array(LARGO_FIRMA);
  let n = 0;
  const k = 256 / BINS_POR_CANAL;
  for (let y = y0; y < y1; y += paso) {
    let i = (y * width + x0) * 4;
    for (let x = x0; x < x1; x += paso, i += 4 * paso) {
      const r = (data[i] / k) | 0;
      const g = (data[i + 1] / k) | 0;
      const b = (data[i + 2] / k) | 0;
      hist[(r * BINS_POR_CANAL + g) * BINS_POR_CANAL + b] += 1;
      n += 1;
    }
  }
  if (!n) return null;
  for (let j = 0; j < LARGO_FIRMA; j++) hist[j] /= n;
  return hist;
}

/** Coeficiente de Bhattacharyya: 1 = mismos colores, 0 = nada en común. */
export function parecido(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.sqrt(a[i] * b[i]);
  return Math.min(1, s);
}

/** Mezcla la firma guardada con la nueva (la ropa cambia poco; la luz y la pose, algo). */
export function mezclarFirmas(vieja, nueva, peso = 0.3) {
  if (!vieja) return nueva ? Float32Array.from(nueva) : null;
  if (!nueva) return vieja;
  const r = new Float32Array(vieja.length);
  for (let i = 0; i < vieja.length; i++) r[i] = (1 - peso) * vieja[i] + peso * nueva[i];
  return r;
}
