// Mapa de calor acumulado: una cuadrícula que suma, por celda, los segundos que alguien pasó ahí.
// Cada observación reparte su tiempo con un núcleo 3×3 (1-2-1) para que el mapa no salga a cuadritos sueltos.
// La escala se normaliza contra la celda con más tiempo: 1 = «más tiempo», 0 = «menos tiempo».

const NUCLEO = [
  [1, 2, 1],
  [2, 4, 2],
  [1, 2, 1],
];
const SUMA_NUCLEO = 16;

export function crearMapaDeCalor(columnas = 48, filas = 27) {
  const cols = Math.max(1, Math.round(columnas));
  const fils = Math.max(1, Math.round(filas));
  const valores = new Float32Array(cols * fils);
  let maximo = 0;
  let total = 0;

  /** Suma `segundos` alrededor del punto normalizado (x, y en 0..1). Devuelve false si el punto cae fuera. */
  function sumar(x, y, segundos) {
    if (!(segundos > 0) || !(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return false;
    const cx = Math.min(cols - 1, Math.floor(x * cols));
    const cy = Math.min(fils - 1, Math.floor(y * fils));
    // Lo que el núcleo deja fuera del borde se pierde: así una celda de orilla no recibe más de lo que le toca.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= cols || gy >= fils) continue;
        const i = gy * cols + gx;
        const suma = (segundos * NUCLEO[dy + 1][dx + 1]) / SUMA_NUCLEO;
        valores[i] += suma;
        total += suma;
        if (valores[i] > maximo) maximo = valores[i];
      }
    }
    return true;
  }

  function valor(col, fila) {
    return valores[fila * cols + col];
  }

  /** Valor de la celda en 0..1 respecto de la celda con más tiempo. */
  function normalizado(col, fila) {
    return maximo > 0 ? valores[fila * cols + col] / maximo : 0;
  }

  function reiniciar() {
    valores.fill(0);
    maximo = 0;
    total = 0;
  }

  /** Para guardar: segundos por celda con un decimal. */
  function serializar() {
    return { columnas: cols, filas: fils, valores: Array.from(valores, (v) => Math.round(v * 10) / 10) };
  }

  /** Carga lo guardado si la cuadrícula coincide; si no, lo ignora y devuelve false. */
  function cargar(datos) {
    if (!datos || datos.columnas !== cols || datos.filas !== fils || !Array.isArray(datos.valores)) return false;
    if (datos.valores.length !== cols * fils) return false;
    reiniciar();
    datos.valores.forEach((v, i) => {
      const n = Number(v);
      valores[i] = Number.isFinite(n) && n > 0 ? n : 0;
      total += valores[i];
      if (valores[i] > maximo) maximo = valores[i];
    });
    return true;
  }

  return {
    sumar,
    valor,
    normalizado,
    reiniciar,
    serializar,
    cargar,
    columnas: cols,
    filas: fils,
    get maximo() {
      return maximo;
    },
    get total() {
      return total;
    },
  };
}

/**
 * Color de una celda para v en 0..1. Una sola familia (el ámbar de la marca, que se oscurece hacia naranja quemado)
 * y la opacidad crece con el valor: lo que casi no se visitó queda transparente y no tapa el video.
 * Devuelve [r, g, b, a] con a en 0..255.
 */
export function colorDeCalor(v) {
  const t = Math.min(1, Math.max(0, v));
  if (t < 0.04) return [0, 0, 0, 0];
  // de #f7d48a (ámbar claro) a #c2410c (naranja quemado)
  const r = Math.round(247 + (194 - 247) * t);
  const g = Math.round(212 + (65 - 212) * t);
  const b = Math.round(138 + (12 - 138) * t);
  const a = Math.round(255 * (0.18 + 0.6 * t));
  return [r, g, b, a];
}
