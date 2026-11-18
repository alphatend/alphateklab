// Escalas, ventanas y agregados para los gráficos y la tabla equivalente. Sin DOM.

export const VENTANAS = [2, 6, 24]; // horas

// Ancho de cada barra de consumo según la ventana: 12 a 24 barras siempre.
export function anchoBin(horas) {
  if (horas <= 2) return 600; // 10 min
  if (horas <= 6) return 900; // 15 min
  return 3600; // 1 h
}

// Cada cuánto va una fila de la tabla equivalente.
export function pasoTabla(horas) {
  if (horas <= 2) return 600;
  if (horas <= 6) return 900;
  return 3600;
}

// Ticks «bonitos» (1, 2, 2.5, 5 × 10^k) que cubren [min, max].
export function ticksBonitos(min, max, cuantos = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const crudo = (max - min) / Math.max(1, cuantos - 1);
  const pot = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= crudo) || 10 * pot;
  const inicio = Math.floor(min / paso + 1e-9) * paso;
  const fin = Math.ceil(max / paso - 1e-9) * paso;
  const ticks = [];
  for (let v = inicio; v <= fin + paso * 1e-6; v += paso) ticks.push(Math.round(v / paso) * paso);
  return ticks.map((v) => (Object.is(v, -0) ? 0 : Number(v.toFixed(10))));
}

// Dominio del eje Y: los datos de la ventana, los límites de la banda y un rango mínimo (para que el ruido
// de 0.1 °C no parezca una montaña). Devuelve { lo, hi, ticks } con los extremos en ticks redondos.
export function dominioY(valores, { banda = null, rangoMin = 1, piso = null, techo = null, cuantos = 4 } = {}) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of valores) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (banda) {
    if (typeof banda.min === 'number') {
      lo = Math.min(lo, banda.min);
      hi = Math.max(hi, banda.min);
    }
    if (typeof banda.max === 'number') {
      lo = Math.min(lo, banda.max);
      hi = Math.max(hi, banda.max);
    }
  }
  if (!Number.isFinite(lo)) {
    lo = 0;
    hi = 1;
  }
  if (hi - lo < rangoMin) {
    const centro = (hi + lo) / 2;
    lo = centro - rangoMin / 2;
    hi = centro + rangoMin / 2;
  }
  if (piso !== null) lo = Math.max(lo, piso);
  if (techo !== null) hi = Math.min(hi, techo);
  const ticks = ticksBonitos(lo, hi, cuantos);
  let tlo = ticks[0];
  let thi = ticks[ticks.length - 1];
  if (piso !== null && tlo < piso) tlo = piso;
  if (techo !== null && thi > techo) thi = techo;
  return { lo: tlo, hi: thi, ticks: ticks.filter((v) => v >= tlo && v <= thi) };
}

// Primer índice con muestra.t >= t (búsqueda binaria; las muestras están ordenadas).
export function indiceDesde(muestras, t) {
  let a = 0;
  let b = muestras.length;
  while (a < b) {
    const m = (a + b) >> 1;
    if (muestras[m].t < t) a = m + 1;
    else b = m;
  }
  return a;
}

// Índice de la muestra más cercana a t (o -1 si no hay muestras).
export function indiceCercano(muestras, t) {
  if (!muestras.length) return -1;
  const i = indiceDesde(muestras, t);
  if (i <= 0) return 0;
  if (i >= muestras.length) return muestras.length - 1;
  return t - muestras[i - 1].t <= muestras[i].t - t ? i - 1 : i;
}

export function enVentana(muestras, desde, hasta) {
  const i0 = indiceDesde(muestras, desde);
  const i1 = indiceDesde(muestras, hasta + 1);
  return muestras.slice(i0, i1);
}

// Energía (kWh) por circuito en barras alineadas a múltiplos de `ancho`. Cada muestra trae la energía
// del minuto que termina en su t, así que cuenta para la barra que contiene (t - 1).
export function binsEnergia(muestras, desde, hasta, ancho) {
  const primero = Math.floor(desde / ancho) * ancho;
  const bins = [];
  for (let inicio = primero; inicio < hasta; inicio += ancho) {
    bins.push({ inicio, fin: inicio + ancho, aire: 0, cocina: 0, refri: 0, total: 0, minutos: 0, enCurso: inicio + ancho > hasta });
  }
  if (!bins.length) return bins;
  const i0 = indiceDesde(muestras, primero + 1);
  for (let i = i0; i < muestras.length; i++) {
    const m = muestras[i];
    if (m.t > hasta) break;
    const k = Math.floor((m.t - 1 - primero) / ancho);
    const b = bins[k];
    if (!b) continue;
    b.aire += m.eAire;
    b.cocina += m.eCocina;
    b.refri += m.eRefri;
    b.minutos += 1;
  }
  for (const b of bins) b.total = b.aire + b.cocina + b.refri;
  return bins;
}

// Cuánto tiempo (s) estuvo activo un sensor de estado dentro de [desde, hasta).
export function segundosActivo(intervalos, desde, hasta, ahora = hasta) {
  let s = 0;
  for (const iv of intervalos) {
    const fin = iv.fin === null ? ahora : iv.fin;
    const a = Math.max(desde, iv.inicio);
    const b = Math.min(hasta, fin);
    if (b > a) s += b - a;
  }
  return s;
}

// Intervalos que tocan la ventana, recortados a ella.
export function intervalosEnVentana(intervalos, desde, hasta) {
  const salida = [];
  for (const iv of intervalos) {
    const fin = iv.fin === null ? hasta : iv.fin;
    if (fin <= desde || iv.inicio >= hasta) continue;
    salida.push({ inicio: Math.max(desde, iv.inicio), fin: Math.min(hasta, fin), abierto: iv.fin === null, inicioReal: iv.inicio, finReal: iv.fin });
  }
  return salida;
}

// Estado de un sensor de estado en el momento t: el intervalo que lo contiene o null.
export function intervaloEn(intervalos, t) {
  // Los intervalos de un sensor no se solapan y van en orden: el primero (desde el final) que empezó
  // antes de t es el único que puede contenerlo.
  for (let i = intervalos.length - 1; i >= 0; i--) {
    const iv = intervalos[i];
    if (iv.inicio > t) continue;
    return iv.fin === null || t < iv.fin ? iv : null;
  }
  return null;
}

// Marcas del eje de tiempo: múltiplos de un paso que dejen al menos `minPx` entre marcas.
export function ticksTiempo(desde, hasta, anchoPx, minPx = 64) {
  const pasos = [600, 900, 1800, 3600, 7200, 10800, 21600];
  const duracion = hasta - desde;
  const paso = pasos.find((p) => (anchoPx * p) / duracion >= minPx) || 21600;
  const ticks = [];
  for (let t = Math.ceil(desde / paso) * paso; t <= hasta; t += paso) ticks.push(t);
  return { paso, ticks };
}

const maximo = (lista, clave) => lista.reduce((m, x) => (x[clave] > m ? x[clave] : m), -Infinity);
const minimo = (lista, clave) => lista.reduce((m, x) => (x[clave] < m ? x[clave] : m), Infinity);

// Filas de la tabla equivalente: un renglón por intervalo con lo que importa de cada sensor.
export function filasTabla(muestras, intervalos, desde, hasta, paso) {
  const filas = [];
  const primero = Math.floor(desde / paso) * paso;
  for (let inicio = primero; inicio < hasta; inicio += paso) {
    const fin = Math.min(inicio + paso, hasta);
    const trozo = enVentana(muestras, inicio + 1, fin);
    if (!trozo.length) continue;
    const ultimo = trozo[trozo.length - 1];
    filas.push({
      inicio,
      fin,
      neveraMax: maximo(trozo, 'nevera'),
      cuartoMax: maximo(trozo, 'cuarto'),
      congeladorMax: maximo(trozo, 'congelador'),
      vibracionMax: maximo(trozo, 'vibracion'),
      puertaNeveraS: segundosActivo(intervalos.puertaNevera, inicio, fin),
      puertaCuartoS: segundosActivo(intervalos.puertaCuarto, inicio, fin),
      bombaS: segundosActivo(intervalos.bomba, inicio, fin),
      kwh: trozo.reduce((s, m) => s + m.eAire + m.eCocina + m.eRefri, 0),
      tanque: ultimo.tanque,
      tanqueMin: minimo(trozo, 'tanque'),
      humedadMax: maximo(trozo, 'humedad'),
    });
  }
  return filas;
}
