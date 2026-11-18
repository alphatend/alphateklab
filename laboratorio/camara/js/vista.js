// Pinta el escenario en el lienzo: el cuadro ya analizado, el pixelado de personas, el mapa de calor, la zona de
// fila, la línea con su flecha y las cajas con su número. Encima del video los colores son fijos (no siguen el tema):
// tienen que leerse sobre cualquier imagen, así que cada trazo lleva un borde oscuro.

import { colorDeCalor } from './nucleo/calor.mjs';
import { normalDerecha } from './nucleo/geometria.mjs';

const C = {
  fondo: '#202729', // grafito de la marca (--sobre-senal)
  senal: '#f2b544', // ámbar de la marca (--senal)
  tinta: '#202729',
  borde: 'rgba(32, 39, 41, 0.86)',
  blanco: '#f7f5ef', // claro de la marca
  zona: 'rgba(108, 196, 185, 0.2)', // verde petróleo claro (--acento en oscuro)
  zonaBorde: '#6cc4b9',
  zonaAviso: 'rgba(240, 163, 90, 0.28)', // --aviso en oscuro
  zonaAvisoBorde: '#f0a35a',
  entrada: '#5fcf8a', // --ok en oscuro
  salida: '#c9cec9', // --tinta-2 en oscuro
};
const FUENTE = '"Inter", "Helvetica Neue", Arial, sans-serif';
const BLOQUES_POR_PERSONA = 7; // el pixelado divide el ancho de cada persona en 7 bloques

export function crearVista(lienzo) {
  const ctx = lienzo.getContext('2d');
  const mosaico = document.createElement('canvas');
  const mctx = mosaico.getContext('2d', { willReadFrequently: false });
  const calorLienzo = document.createElement('canvas');
  const cctx = calorLienzo.getContext('2d');
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let ancho = 16; // tamaño del cuadro analizado
  let alto = 9;
  let rect = { x: 0, y: 0, w: 0, h: 0 }; // dónde cae el video dentro del lienzo (contain), en px CSS
  let calorListo = false;

  function medir() {
    const caja = lienzo.getBoundingClientRect();
    const nuevoDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (caja.width !== cssW || caja.height !== cssH || nuevoDpr !== dpr) {
      cssW = caja.width;
      cssH = caja.height;
      dpr = nuevoDpr;
      lienzo.width = Math.max(1, Math.round(cssW * dpr));
      lienzo.height = Math.max(1, Math.round(cssH * dpr));
    }
    const escala = Math.min(cssW / ancho, cssH / alto) || 0;
    const w = ancho * escala;
    const h = alto * escala;
    rect = { x: (cssW - w) / 2, y: (cssH - h) / 2, w, h };
    return rect;
  }

  function fijarCuadro(w, h) {
    ancho = w;
    alto = h;
    medir();
  }

  /** De píxeles del cuadro analizado a px CSS del lienzo. */
  const px = (x, y) => ({ x: rect.x + (x / ancho) * rect.w, y: rect.y + (y / alto) * rect.h });
  /** De normalizado (0..1) a px CSS del lienzo. */
  const pn = (p) => ({ x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h });

  /** De un evento de puntero a coordenadas normalizadas del video (o null si cae en la franja negra). */
  function aNormal(clienteX, clienteY, { recortar = false } = {}) {
    const caja = lienzo.getBoundingClientRect();
    let x = (clienteX - caja.left - rect.x) / rect.w;
    let y = (clienteY - caja.top - rect.y) / rect.h;
    if (recortar) {
      x = Math.min(1, Math.max(0, x));
      y = Math.min(1, Math.max(0, y));
    }
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null;
    return { x, y };
  }

  function actualizarCalor(mapa) {
    if (calorLienzo.width !== mapa.columnas || calorLienzo.height !== mapa.filas) {
      calorLienzo.width = mapa.columnas;
      calorLienzo.height = mapa.filas;
    }
    const img = cctx.createImageData(mapa.columnas, mapa.filas);
    for (let f = 0; f < mapa.filas; f++) {
      for (let c = 0; c < mapa.columnas; c++) {
        const [r, g, b, a] = colorDeCalor(mapa.normalizado(c, f));
        const i = (f * mapa.columnas + c) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = a;
      }
    }
    cctx.putImageData(img, 0, 0);
    calorListo = mapa.maximo > 0;
  }

  function pixelar(cuadro, caja) {
    const margen = 0.08;
    const x0 = Math.max(0, caja.x - caja.w * margen);
    const y0 = Math.max(0, caja.y - caja.h * margen);
    const x1 = Math.min(ancho, caja.x + caja.w * (1 + margen));
    const y1 = Math.min(alto, caja.y + caja.h * (1 + margen));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 2 || h < 2) return;
    const bloque = Math.max(4, caja.w / BLOQUES_POR_PERSONA);
    const bw = Math.max(2, Math.round(w / bloque));
    const bh = Math.max(2, Math.round(h / bloque));
    if (mosaico.width < bw) mosaico.width = bw;
    if (mosaico.height < bh) mosaico.height = bh;
    mctx.imageSmoothingEnabled = true;
    mctx.clearRect(0, 0, bw, bh);
    mctx.drawImage(cuadro, x0, y0, w, h, 0, 0, bw, bh);
    const a = px(x0, y0);
    const b = px(x1, y1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mosaico, 0, 0, bw, bh, a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.imageSmoothingEnabled = true;
  }

  /** El cuadro entero en bloques de 1/48 del ancho: se ve la escena y por dónde pasa la gente, no quién es. */
  function pixelarTodo(cuadro) {
    const bw = 48;
    const bh = Math.max(2, Math.round((48 * alto) / ancho));
    if (mosaico.width < bw) mosaico.width = bw;
    if (mosaico.height < bh) mosaico.height = bh;
    mctx.imageSmoothingEnabled = true;
    mctx.drawImage(cuadro, 0, 0, ancho, alto, 0, 0, bw, bh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mosaico, 0, 0, bw, bh, rect.x, rect.y, rect.w, rect.h);
    ctx.imageSmoothingEnabled = true;
  }

  function trazo(dibujar, ancho1, color1, ancho2, color2) {
    ctx.lineWidth = ancho1;
    ctx.strokeStyle = color1;
    dibujar();
    ctx.stroke();
    ctx.lineWidth = ancho2;
    ctx.strokeStyle = color2;
    dibujar();
    ctx.stroke();
  }

  let pendientes = null; // rótulos que se pintan al final, encima de todo
  function rotulo(texto, x, y, opciones = {}) {
    if (pendientes) pendientes.push(() => rotuloAhora(texto, x, y, opciones));
    else rotuloAhora(texto, x, y, opciones);
  }
  function rotuloAhora(texto, x, y, { fondo = C.borde, color = C.blanco, tamano = 12, alinear = 'left' } = {}) {
    ctx.font = `600 ${tamano}px ${FUENTE}`;
    const m = ctx.measureText(texto);
    const w = m.width + 10;
    const h = tamano + 8;
    let xi = alinear === 'center' ? x - w / 2 : alinear === 'right' ? x - w : x;
    xi = Math.max(2, Math.min(cssW - w - 2, xi));
    const yi = Math.max(2, Math.min(cssH - h - 2, y));
    ctx.fillStyle = fondo;
    ctx.fillRect(xi, yi, w, h);
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(texto, xi + 5, yi + h / 2 + 0.5);
  }

  function pintarZona(zona, { activa, cuenta, borrador, conManijas = false }) {
    if (zona && zona.length >= 3) {
      const pts = zona.map(pn);
      const camino = () => {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
      };
      camino();
      ctx.fillStyle = activa ? C.zonaAviso : C.zona;
      ctx.fill();
      ctx.lineJoin = 'round';
      trazo(camino, 5, C.borde, 2, activa ? C.zonaAvisoBorde : C.zonaBorde);
      const arriba = pts.reduce((m, p) => (p.y < m.y ? p : m), pts[0]);
      const texto = cuenta === null || cuenta === undefined ? 'Zona de fila' : `Zona de fila: ${cuenta}`;
      // Encima de la esquina más alta; si ahí cae en la franja de arriba del video (los primeros 24 px, donde se
      // amontonan los números de las personas que tocan el borde), va por dentro, debajo de esa esquina. Con las
      // manijas a la vista se corre a la derecha para que la de esa esquina no lo tape.
      const y = arriba.y - 26 >= 24 ? arriba.y - 26 : arriba.y + 8;
      const x = arriba.x + (conManijas ? 24 : 0);
      rotulo(texto, x, y, { fondo: activa ? C.zonaAvisoBorde : C.borde, color: activa ? C.tinta : C.blanco });
    }
    if (borrador && borrador.length) {
      const pts = borrador.map(pn);
      const camino = () => {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      };
      ctx.lineJoin = 'round';
      trazo(camino, 5, C.borde, 2, C.zonaBorde);
    }
  }

  function pintarLinea(linea, sentido, { manijas }) {
    const a = pn(linea.a);
    const b = pn(linea.b);
    const camino = () => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    };
    ctx.lineCap = 'round';
    trazo(camino, 8, C.borde, 3.5, C.senal);
    if (!manijas) {
      for (const p of [a, b]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = C.senal;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.borde;
        ctx.stroke();
      }
    }
    // Flecha de «entrada» desde el centro de la línea hacia el lado que cuenta como entrada.
    const n = normalDerecha(a, b);
    const s = sentido >= 0 ? 1 : -1;
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const largo = Math.min(46, Math.max(26, rect.w * 0.05));
    const punta = { x: m.x + n.x * s * largo, y: m.y + n.y * s * largo };
    const ala = 9;
    const flecha = () => {
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(punta.x, punta.y);
      const ang = Math.atan2(punta.y - m.y, punta.x - m.x);
      ctx.moveTo(punta.x - ala * Math.cos(ang - 0.55), punta.y - ala * Math.sin(ang - 0.55));
      ctx.lineTo(punta.x, punta.y);
      ctx.lineTo(punta.x - ala * Math.cos(ang + 0.55), punta.y - ala * Math.sin(ang + 0.55));
    };
    ctx.lineJoin = 'round';
    trazo(flecha, 7, C.borde, 3, C.senal);
    const fuera = { x: m.x + n.x * s * (largo + 14), y: m.y + n.y * s * (largo + 14) };
    const alinear = n.x * s > 0.3 ? 'left' : n.x * s < -0.3 ? 'right' : 'center';
    rotulo('Entrada', fuera.x, fuera.y - 10, { fondo: C.senal, color: C.tinta, alinear });
  }

  function pintarPistas(pistas, destellos, ahora) {
    ctx.lineJoin = 'miter';
    for (const p of pistas) {
      if (!p.confirmada || !p.vistaAhora) continue;
      const a = px(p.caja.x, p.caja.y);
      const b = px(p.caja.x + p.caja.w, p.caja.y + p.caja.h);
      const destello = destellos.get(p.id);
      const vivo = destello && ahora - destello.t < 1200;
      const color = vivo ? (destello.tipo === 'entrada' ? C.entrada : C.salida) : C.blanco;
      const caja = () => {
        ctx.beginPath();
        ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
      };
      trazo(caja, 4, C.borde, vivo ? 3 : 1.5, color);
      const etiqueta = vivo ? `${p.numero} ${destello.tipo === 'entrada' ? 'entró' : 'salió'}` : String(p.numero);
      rotulo(etiqueta, a.x, a.y - 20, { fondo: vivo ? color : C.borde, color: vivo ? C.tinta : C.blanco });
      // punto de apoyo: el que cruza la línea y el que cuenta en la zona
      const pie = px(p.punto.x, p.punto.y);
      ctx.beginPath();
      ctx.arc(pie.x, pie.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = C.senal;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.borde;
      ctx.stroke();
    }
  }

  /**
   * Pinta todo. `cuadro` es el lienzo con el cuadro analizado (o null si todavía no hay ninguno).
   */
  function pintar({ cuadro, pistas = [], privadas = [], config, preferencias, destellos = new Map(), fila = {}, borrador = null, modo = 'ver', ahora = 0 }) {
    medir();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.fondo;
    ctx.fillRect(0, 0, cssW, cssH);
    if (cuadro) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(cuadro, 0, 0, ancho, alto, rect.x, rect.y, rect.w, rect.h);
      if (preferencias.pixelado === 'todo') {
        pixelarTodo(cuadro);
      } else if (preferencias.pixelado !== 'nada') {
        // Se pixela cada caja que el detector encontró en ESTE cuadro y cada pista viva (confirmada o no, aunque el
        // detector la haya perdido un instante), para no destapar a nadie por un cuadro sin detección.
        for (const caja of privadas) pixelar(cuadro, caja);
      }
    }
    if (preferencias.verCalor && calorListo) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(calorLienzo, rect.x, rect.y, rect.w, rect.h);
    }
    pendientes = [];
    if (config) {
      pintarZona(config.zona, { activa: fila.activa, cuenta: fila.cuenta, borrador: modo === 'zona' ? borrador : null, conManijas: modo === 'zona' });
      pintarLinea(config.linea, config.sentido, { manijas: modo === 'linea' });
    }
    if (preferencias.verCajas) pintarPistas(pistas, destellos, ahora);
    const cola = pendientes;
    pendientes = null;
    for (const r of cola) r();
  }

  return {
    pintar,
    fijarCuadro,
    medir,
    aNormal,
    pn,
    actualizarCalor,
    get rect() {
      return rect;
    },
  };
}

/** Pinta la escala del mapa de calor (de «menos tiempo» a «más tiempo») con los mismos colores del mapa. */
export function pintarEscalaCalor(lienzo) {
  const w = 120;
  const h = 10;
  lienzo.width = w;
  lienzo.height = h;
  const c = lienzo.getContext('2d');
  const img = c.createImageData(w, h);
  for (let x = 0; x < w; x++) {
    const [r, g, b, a] = colorDeCalor(0.05 + (0.95 * x) / (w - 1));
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.max(a, 90);
    }
  }
  c.putImageData(img, 0, 0);
}
