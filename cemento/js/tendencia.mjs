// Las alertas de tendencia: una medida que todavía está en rango pero viene hacia afuera (Eduardo, 29-oct-2026: «que
// avise si una medida va subiendo aunque todavía esté en rango»). La misma regla está en api/lib/tendencia.js (el
// servidor, para el aviso de la mañana); pruebas/tendencia.test.mjs prueba las dos con los mismos casos.
//
// Con al menos 3 lecturas y un rango, hay alerta si la última sigue en rango y
// - las 3 últimas van en la misma dirección y la última quedó en el 25 % del borde hacia el que va, o
// - la recta de las últimas (hasta 6) cruza el borde en las próximas 3 lecturas.
// Si ya está fuera de rango no es alerta: eso ya es un hallazgo.

/** Valores del más viejo al más nuevo. Devuelve "sube", "baja" o null. */
export function haciaFuera(valores, min = null, max = null) {
  const vs = valores.filter((v) => Number.isFinite(v)).slice(-6);
  if (vs.length < 3 || (min == null && max == null)) return null;
  const ult = vs.at(-1);
  if ((max != null && ult > max) || (min != null && ult < min)) return null;
  const [a, b, c] = vs.slice(-3);
  const sube = a < b && b < c, baja = a > b && b > c;
  const n = vs.length, xm = (n - 1) / 2, ym = vs.reduce((s, v) => s + v, 0) / n;
  const m = vs.reduce((s, v, i) => s + (i - xm) * (v - ym), 0) / vs.reduce((s, _, i) => s + (i - xm) ** 2, 0);
  const proyectado = ult + 3 * m;
  // sin uno de los dos bordes, el «25 % del borde» se mide contra el valor mismo
  const ancho = min != null && max != null ? max - min : Math.abs(max ?? min) || 1;
  if (max != null && m > 0 && ((sube && ult >= max - 0.25 * ancho) || proyectado > max)) return "sube";
  if (min != null && m < 0 && ((baja && ult <= min + 0.25 * ancho) || proyectado < min)) return "baja";
  return null;
}
