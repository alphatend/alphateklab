// La curva de Tromp (de partición) del separador, a partir de los tamizados de la alimentación, los finos y los
// gruesos (rechazo). Todo en % pasante acumulado por tamaño, de menor a mayor.
//
// 1. Rendimiento de finos y: la alimentación es la mezcla A = y·F + (1 − y)·R. Se ajusta por mínimos cuadrados con
//    todos los tamaños: y = Σ(A − R)(F − R) / Σ(F − R)².
// 2. Por clase de tamaño (entre dos tamices), la fracción de la alimentación que va a gruesos:
//    T = (1 − y)·r / (y·f + (1 − y)·r), con la alimentación rearmada (así no pasa de 100 %).
// 3. Bypass: el T más bajo (lo fino que se va a gruesos sin separarse). Curva corregida: T' = (T − a) / (1 − a).
// 4. d50 (corte), d25 y d75: donde T' cruza 0.5, 0.25 y 0.75, interpolando en log(tamaño).
//    Imperfección = (d75 − d25) / (2·d50); nitidez = d25 / d75.

export function calcularTromp({ tamanos, alimentacion, finos, gruesos }) {
  const n = tamanos.length;
  if ([alimentacion, finos, gruesos].some((s) => !Array.isArray(s) || s.length !== n)) {
    throw new Error("Cada tamizado tiene que tener el mismo número de valores que los tamaños.");
  }
  if (n < 2) throw new Error("Hacen falta por lo menos dos tamaños.");
  for (let i = 1; i < n; i++) {
    if (!(tamanos[i] > tamanos[i - 1])) throw new Error("Los tamaños tienen que ir en orden, de menor a mayor.");
  }
  const A = alimentacion.map(Number), F = finos.map(Number), R = gruesos.map(Number);
  if ([...A, ...F, ...R, ...tamanos].some((v) => !Number.isFinite(v))) throw new Error("Hay valores vacíos o que no son números.");

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (A[i] - R[i]) * (F[i] - R[i]);
    den += (F[i] - R[i]) ** 2;
  }
  if (den < 1e-9) throw new Error("No se puede: los finos y los gruesos tienen la misma granulometría.");
  const y = num / den;
  if (!(y > 0.01 && y < 0.99)) {
    throw new Error(`No se puede: el balance da un rendimiento de finos de ${(y * 100).toFixed(0)} %. Revisa los tamizados (¿finos y gruesos al revés?).`);
  }

  // clases: [0, d1], (d1, d2], …, (dn, ∞)
  const masa = (S, j) => (j === 0 ? S[0] : j < n ? S[j] - S[j - 1] : 100 - S[n - 1]);
  const clases = [];
  for (let j = 0; j <= n; j++) {
    const f = Math.max(0, masa(F, j)), r = Math.max(0, masa(R, j));
    const rearmada = y * f + (1 - y) * r;
    const tamano = j === 0 ? tamanos[0] / Math.SQRT2 : j < n ? Math.sqrt(tamanos[j - 1] * tamanos[j]) : tamanos[n - 1] * Math.SQRT2;
    clases.push({
      desde: j === 0 ? 0 : tamanos[j - 1],
      hasta: j < n ? tamanos[j] : null,
      tamano,
      alimentacion: masa(A, j),
      tromp: rearmada > 1e-9 ? ((1 - y) * r) / rearmada : null,
    });
  }
  const validas = clases.filter((c) => c.tromp !== null);
  if (validas.length < 2) throw new Error("No se puede: casi todas las clases están vacías.");
  const bypass = Math.min(...validas.map((c) => c.tromp));
  for (const c of clases) c.corregida = c.tromp === null ? null : bypass < 1 ? (c.tromp - bypass) / (1 - bypass) : 0;

  // dónde la curva corregida cruza un valor, de abajo hacia arriba (interpolación en log del tamaño)
  const cruce = (v, campo) => {
    const p = clases.filter((c) => c[campo] !== null);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      if (a[campo] <= v && b[campo] >= v && b[campo] > a[campo]) {
        const t = (v - a[campo]) / (b[campo] - a[campo]);
        return Math.exp(Math.log(a.tamano) + t * (Math.log(b.tamano) - Math.log(a.tamano)));
      }
    }
    return null;
  };
  const d50 = cruce(0.5, "corregida"), d25 = cruce(0.25, "corregida"), d75 = cruce(0.75, "corregida");
  return {
    rendimientoFinos: y,
    factorCirculacion: 1 / y, // alimentación / finos
    cargaCirculante: (1 - y) / y, // gruesos / finos
    bypass,
    d50,
    d50SinCorregir: cruce(0.5, "tromp"),
    d25,
    d75,
    imperfeccion: d50 && d25 && d75 ? (d75 - d25) / (2 * d50) : null,
    nitidez: d25 && d75 ? d25 / d75 : null,
    clases,
  };
}

/** Un ejemplo para probar la calculadora (tamizado típico de un separador de cemento, inventado). */
export const EJEMPLO = {
  tamanos: [3, 8, 16, 24, 32, 45, 63, 90],
  alimentacion: [9.5, 22.8, 39.6, 51.8, 61.0, 72.1, 82.4, 91.0],
  finos: [21.0, 47.5, 76.2, 90.4, 96.6, 99.4, 100, 100],
  gruesos: [4.1, 11.3, 22.5, 33.8, 44.4, 59.3, 74.1, 86.8],
};
