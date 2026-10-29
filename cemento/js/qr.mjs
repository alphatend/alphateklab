// Códigos QR sin librerías, para las etiquetas de equipos y colectores. Corre igual en el navegador y en Node.
// Modo byte con el texto en UTF-8, sin ECI (así lo esperan los lectores de los teléfonos), versiones 1 a 40, corrección
// L, M, Q o H tal como se pide, la versión más chica en que cabe y la máscara de menos penalidad (las cuatro reglas de
// ISO/IEC 18004). El SVG es negro sobre blanco siempre, también con la app en oscuro: es para imprimir.

const UTF8 = new TextEncoder();
const FORMATO = { L: 1, M: 0, Q: 3, H: 2 }; // los dos bits del nivel en la información de formato
// por versión, de la 1 a la 40: códigos de corrección por bloque y número de bloques
const EC = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const BLOQUES = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};
// (x, y) = (columna, fila)
const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// GF(256) con el polinomio 0x11D, para Reed-Solomon
const EXP = new Uint8Array(510), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++, x = (x << 1) ^ (x & 0x80 ? 0x11d : 0)) EXP[i] = EXP[i + 255] = x, LOG[x] = i;
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** El generador de grado n, sin el coeficiente principal (que es 1). */
function generador(n) {
  const g = new Uint8Array(n);
  g[n - 1] = 1;
  for (let i = 0, raiz = 1; i < n; i++, raiz = mul(raiz, 2)) {
    for (let j = 0; j < n; j++) g[j] = mul(g[j], raiz) ^ (j + 1 < n ? g[j + 1] : 0);
  }
  return g;
}

/** Los códigos de corrección de un bloque: el resto de dividir los datos por el generador. */
function correccion(datos, g) {
  const r = new Uint8Array(g.length);
  for (const b of datos) {
    const f = b ^ r[0];
    r.copyWithin(0, 1);
    r[r.length - 1] = 0;
    for (let i = 0; i < r.length; i++) r[i] ^= mul(g[i], f);
  }
  return r;
}

/** Módulos que quedan para datos y corrección: todo menos patrones, formato y versión. */
function modulosLibres(v) {
  let n = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const a = Math.floor(v / 7) + 2; // alineaciones por lado
    n -= (25 * a - 10) * a - 55;
    if (v >= 7) n -= 36;
  }
  return n;
}
const bytesDatos = (v, ecc) => (modulosLibres(v) >> 3) - EC[ecc][v - 1] * BLOQUES[ecc][v - 1];

/** Centros de las alineaciones en cada eje. */
function alineaciones(v) {
  if (v === 1) return [];
  const a = Math.floor(v / 7) + 2, paso = Math.floor((v * 8 + a * 3 + 5) / (a * 4 - 4)) * 2;
  const p = [6];
  for (let x = v * 4 + 10; p.length < a; x -= paso) p.splice(1, 0, x);
  return p;
}

/** Datos en bloques, cada bloque con su corrección, y todo intercalado como va en el símbolo. */
function intercalar(datos, v, ecc) {
  const nb = BLOQUES[ecc][v - 1], ne = EC[ecc][v - 1], total = modulosLibres(v) >> 3;
  const cortos = nb - (total % nb), corto = Math.floor(total / nb) - ne; // los largos llevan un byte más de datos
  const g = generador(ne), bloques = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const d = datos.subarray(k, (k += corto + (i < cortos ? 0 : 1)));
    bloques.push([d, correccion(d, g)]);
  }
  const r = new Uint8Array(total);
  let p = 0;
  for (let i = 0; i <= corto; i++) for (const [d] of bloques) if (i < d.length) r[p++] = d[i];
  for (let i = 0; i < ne; i++) for (const [, e] of bloques) r[p++] = e[i];
  return r;
}

/** Penalidad de la matriz: corridas de 5 o más, cuadros de 2×2, lo que parece un patrón de búsqueda y el
 *  desbalance de oscuros. Lo de fuera del símbolo cuenta como claro. */
function penalidad(m, t) {
  let p = 0, oscuros = 0;
  for (const c of m) oscuros += c;
  for (let eje = 0; eje < 2; eje++) {
    for (let a = 0; a < t; a++) {
      const base = eje ? a : a * t, paso = eje ? t : 1;
      const en = (b) => (b < 0 || b >= t ? 0 : m[base + b * paso]);
      let corrida = 0;
      for (let b = 0; b < t; b++) {
        corrida = b && en(b) === en(b - 1) ? corrida + 1 : 1;
        if (corrida >= 5 && (b === t - 1 || en(b + 1) !== en(b))) p += corrida - 2;
        if (en(b) && !en(b + 1) && en(b + 2) && en(b + 3) && en(b + 4) && !en(b + 5) && en(b + 6) &&
          (!(en(b - 1) | en(b - 2) | en(b - 3) | en(b - 4)) || !(en(b + 7) | en(b + 8) | en(b + 9) | en(b + 10)))) p += 40;
      }
    }
  }
  for (let y = 0; y < t - 1; y++) {
    for (let x = 0, i = y * t; x < t - 1; x++, i++) if (m[i] === m[i + 1] && m[i] === m[i + t] && m[i] === m[i + t + 1]) p += 3;
  }
  return p + Math.floor(Math.abs(oscuros * 20 - t * t * 10) / (t * t)) * 10;
}

/** La matriz del QR: { version, ecc, mascara, tamano, modulos }; modulos es tamano×tamano por filas, 1 = oscuro. */
export function matrizQr(texto, { ecc = "M" } = {}) {
  if (!/^[LMQH]$/i.test(ecc)) throw new Error(`Nivel de corrección «${ecc}» no válido: tiene que ser L, M, Q o H.`);
  ecc = ecc.toUpperCase();
  const bytes = UTF8.encode(texto == null ? "" : String(texto));
  if (!bytes.length) throw new Error("No hay texto para el código QR.");
  let v = 1;
  while (v <= 40 && 4 + (v < 10 ? 8 : 16) + 8 * bytes.length > bytesDatos(v, ecc) * 8) v++;
  if (v > 40) {
    throw new Error(`El texto no cabe en un código QR: son ${bytes.length} bytes y con corrección ${ecc} caben ${(bytesDatos(40, ecc) * 8 - 20) >> 3}.`);
  }

  // modo byte (0100), cuántos bytes, los bytes, hasta 4 ceros de cierre, a byte entero y relleno EC 11 EC 11…
  const datos = new Uint8Array(bytesDatos(v, ecc));
  let n = 0;
  const poner = (valor, bits) => {
    for (let i = bits - 1; i >= 0; i--, n++) datos[n >> 3] |= ((valor >>> i) & 1) << (7 - (n & 7));
  };
  poner(4, 4);
  poner(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) poner(b, 8);
  n = Math.min(n + 4, datos.length * 8);
  for (let i = (n + 7) >> 3, r = 0xec; i < datos.length; i++, r ^= 0xec ^ 0x11) datos[i] = r;
  const cw = intercalar(datos, v, ecc);

  const t = v * 4 + 17, m = new Uint8Array(t * t), fija = new Uint8Array(t * t); // fija: patrones, formato, versión
  const fijar = (x, y, oscuro) => {
    m[y * t + x] = oscuro ? 1 : 0;
    fija[y * t + x] = 1;
  };
  for (let i = 0; i < t; i++) fijar(6, i, i % 2 === 0), fijar(i, 6, i % 2 === 0);
  for (const [cx, cy] of [[3, 3], [t - 4, 3], [3, t - 4]]) { // búsqueda con su separador
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < t && y >= 0 && y < t) fijar(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const al = alineaciones(v), u = al.length - 1;
  al.forEach((cy, i) => al.forEach((cx, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === u) || (i === u && j === 0)) return; // donde están los de búsqueda
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fijar(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const formato = (k) => {
    const d = (FORMATO[ecc] << 3) | k;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = (i) => (b >>> i) & 1;
    for (let i = 0; i < 6; i++) fijar(8, i, bit(i));
    fijar(8, 7, bit(6));
    fijar(8, 8, bit(7));
    fijar(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fijar(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fijar(t - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fijar(8, t - 15 + i, bit(i));
    fijar(8, t - 8, 1); // el módulo oscuro de siempre
  };
  formato(0); // por ahora, para apartar los módulos
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) fijar(t - 11 + (i % 3), Math.floor(i / 3), (b >>> i) & 1), fijar(Math.floor(i / 3), t - 11 + (i % 3), (b >>> i) & 1);
  }

  // los datos en zigzag, de a dos columnas, de derecha a izquierda, saltando la columna 6 (sincronía)
  for (let der = t - 1, i = 0; der >= 1; der -= 2) {
    if (der === 6) der = 5;
    const sube = ((der + 1) & 2) === 0;
    for (let k = 0; k < t; k++) {
      for (let j = 0; j < 2; j++) {
        const p = (sube ? t - 1 - k : k) * t + der - j;
        if (!fija[p] && i < cw.length * 8) {
          m[p] = (cw[i >> 3] >>> (7 - (i & 7))) & 1;
          i++;
        }
      }
    }
  }

  const enmascarar = (k) => {
    for (let y = 0, p = 0; y < t; y++) for (let x = 0; x < t; x++, p++) if (!fija[p] && MASCARAS[k](x, y)) m[p] ^= 1;
  };
  let mascara = 0, menor = Infinity;
  for (let k = 0; k < 8; k++) {
    enmascarar(k);
    formato(k);
    const p = penalidad(m, t);
    if (p < menor) mascara = k, menor = p;
    enmascarar(k); // XOR: deshace
  }
  enmascarar(mascara);
  formato(mascara);
  return { version: v, ecc, mascara, tamano: t, modulos: m };
}

/** El QR como SVG, en módulos (el tamaño lo pone el CSS): fondo blanco y un solo trazado negro. `margen`: la zona en
 *  blanco alrededor, en módulos (4 es lo que pide la norma). */
export function svgQr(texto, { margen = 4, ecc = "M" } = {}) {
  const q = Number(margen);
  if (!(q >= 0)) throw new Error("El margen del QR tiene que ser de 0 módulos o más.");
  const { tamano: t, modulos: m } = matrizQr(texto, { ecc });
  const lado = t + 2 * q;
  let d = "";
  for (let y = 0; y < t; y++) {
    for (let x = 0; x < t; x++) {
      if (!m[y * t + x]) continue;
      let n = 1;
      while (x + n < t && m[y * t + x + n]) n++;
      d += `M${x + q} ${y + q}h${n}v1h-${n}z`;
      x += n;
    }
  }
  // colores en style: el CSS de la app (tema oscuro, alto contraste) no los puede cambiar
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" style="forced-color-adjust:none">` +
    `<rect width="${lado}" height="${lado}" style="fill:#fff"/><path style="fill:#000" d="${d}"/></svg>`;
}
