// Conteo por intervalos fijos (1 minuto por defecto), alineados al reloj: el minuto 14:05 va de 14:05:00 a 14:05:59.
// Guarda solo las últimas `horasGuardadas` horas para que lo guardado no crezca sin fin.

export function crearIntervalos({ msIntervalo = 60_000, horasGuardadas = 24 } = {}) {
  const tamano = msIntervalo;
  const limite = Math.max(1, Math.round((horasGuardadas * 3_600_000) / tamano));
  let celdas = new Map(); // inicio (ms) → { entradas, salidas }

  const inicioDe = (t) => Math.floor(t / tamano) * tamano;

  function podar(ahora) {
    if (celdas.size <= limite) return;
    const corte = inicioDe(ahora) - (limite - 1) * tamano;
    for (const k of celdas.keys()) if (k < corte) celdas.delete(k);
  }

  function registrar(tipo, t) {
    if (tipo !== 'entrada' && tipo !== 'salida') return;
    const k = inicioDe(t);
    const c = celdas.get(k) || { entradas: 0, salidas: 0 };
    if (tipo === 'entrada') c.entradas += 1;
    else c.salidas += 1;
    celdas.set(k, c);
    podar(t);
  }

  /** Los últimos `n` intervalos hasta el que contiene `ahora`, en orden y con ceros donde no pasó nadie. */
  function ultimos(n, ahora) {
    const fin = inicioDe(ahora);
    const salida = [];
    for (let i = n - 1; i >= 0; i--) {
      const inicio = fin - i * tamano;
      const c = celdas.get(inicio);
      salida.push({ inicio, entradas: c ? c.entradas : 0, salidas: c ? c.salidas : 0, enCurso: i === 0 });
    }
    return salida;
  }

  /** Todos los intervalos con algo, en orden. */
  function todos() {
    return [...celdas.entries()].sort((p, q) => p[0] - q[0]).map(([inicio, c]) => ({ inicio, ...c }));
  }

  function reiniciar() {
    celdas = new Map();
  }

  function serializar() {
    return Object.fromEntries(todos().map((c) => [String(c.inicio), [c.entradas, c.salidas]]));
  }

  function cargar(obj) {
    reiniciar();
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const inicio = Number(k);
      if (!Number.isFinite(inicio) || inicio % tamano !== 0 || !Array.isArray(v)) continue;
      const entradas = Math.max(0, Math.floor(Number(v[0]) || 0));
      const salidas = Math.max(0, Math.floor(Number(v[1]) || 0));
      if (entradas || salidas) celdas.set(inicio, { entradas, salidas });
    }
  }

  return { registrar, ultimos, todos, reiniciar, serializar, cargar, msIntervalo: tamano };
}
