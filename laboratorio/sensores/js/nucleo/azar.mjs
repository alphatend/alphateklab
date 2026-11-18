// Números pseudoaleatorios con semilla: la misma semilla da siempre la misma secuencia.
// Cada sensor tiene su propio flujo (derivado de la semilla y de su nombre), así una falla en un
// equipo no cambia el ruido ni las aperturas de los demás.

export function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a de 32 bits sobre el nombre, mezclado con la semilla.
export function semillaDerivada(semilla, nombre) {
  let h = 0x811c9dc5 ^ (semilla >>> 0);
  for (let i = 0; i < nombre.length; i++) {
    h ^= nombre.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function crearAzar(semilla) {
  const u = mulberry32(semilla);
  let normalGuardada = null;
  return {
    u,
    entre(a, b) {
      return a + (b - a) * u();
    },
    // Box-Muller; guarda el segundo valor para la siguiente llamada.
    normal(media = 0, desvio = 1) {
      if (normalGuardada !== null) {
        const z = normalGuardada;
        normalGuardada = null;
        return media + desvio * z;
      }
      let u1 = u();
      if (u1 < 1e-12) u1 = 1e-12;
      const u2 = u();
      const r = Math.sqrt(-2 * Math.log(u1));
      normalGuardada = r * Math.sin(2 * Math.PI * u2);
      return media + desvio * r * Math.cos(2 * Math.PI * u2);
    },
  };
}
