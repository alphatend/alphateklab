// Worker de detección: corre el modelo fuera del hilo principal para que la página siga respondiendo mientras
// analiza. Recibe cuadros como ImageBitmap y devuelve cajas de personas en píxeles de ese cuadro, cada una con su
// firma de colores (js/nucleo/apariencia.mjs) para el seguimiento.
//
import { firmaDeCaja } from './nucleo/apariencia.mjs';

// MediaPipe carga su cargador WASM con importScripts(), que no existe en un worker de módulo. Si encuentra
// self.import, lo usa en su lugar: aquí se baja el cargador y se evalúa en el ámbito global para que defina
// ModuleFactory. (Comprobado con @mediapipe/tasks-vision 1.0.1.)
self.import = async (url) => {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error('No se pudo bajar ' + url + ' (' + respuesta.status + ')');
  (0, eval)(await respuesta.text());
};

// MediaPipe manda cada 60 s estadísticas de uso a Google (POST a odml.pa.googleapis.com/v1/log: tipo de tarea,
// modo y tiempos de proceso; no imágenes). La demo promete que no sube nada, así que ese envío se bloquea aquí:
// al fallar, MediaPipe apaga su registro y no vuelve a intentarlo. Se comprueba en pruebas/navegador.mjs.
export const HOST_BLOQUEADO = 'odml.pa.googleapis.com';
const fetchOriginal = self.fetch.bind(self);
self.fetch = (recurso, opciones) => {
  const url = typeof recurso === 'string' ? recurso : recurso && recurso.url ? recurso.url : String(recurso);
  if (url.includes(HOST_BLOQUEADO)) return Promise.reject(new TypeError('Envío de estadísticas bloqueado por la demo'));
  return fetchOriginal(recurso, opciones);
};

// MediaPipe escribe sus mensajes informativos de C++ («INFO: Created TensorFlow Lite XNNPACK delegate…»,
// «W1003 … OpenGL error checking is disabled») por console.error/warn. No son errores: se bajan a console.debug.
for (const nivel of ['error', 'warn']) {
  const original = console[nivel].bind(console);
  console[nivel] = (...args) => {
    const texto = typeof args[0] === 'string' ? args[0] : '';
    if (/^(INFO:|[IW]\d{4} )/.test(texto)) console.debug(...args);
    else original(...args);
  };
}

const VERSION = '1.0.1';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;

let detector = null;
let marca = 0; // marca de tiempo estrictamente creciente que pide detectForVideo

function siguienteMarca() {
  marca = Math.max(marca + 1, Math.floor(performance.now()));
  return marca;
}

function aCajas(resultado) {
  return resultado.detections.map((d) => ({
    x: d.boundingBox.originX,
    y: d.boundingBox.originY,
    w: d.boundingBox.width,
    h: d.boundingBox.height,
    puntaje: d.categories && d.categories[0] ? d.categories[0].score : null,
  }));
}

// Lienzo propio del worker para leer los píxeles del cuadro (la firma de colores de cada caja).
let lienzo = null;
let ctx = null;
function conFirmas(imagen, cajas) {
  if (!cajas.length || typeof OffscreenCanvas !== 'function') return cajas;
  try {
    if (!lienzo || lienzo.width !== imagen.width || lienzo.height !== imagen.height) {
      lienzo = new OffscreenCanvas(imagen.width, imagen.height);
      ctx = lienzo.getContext('2d', { willReadFrequently: true });
    }
    ctx.drawImage(imagen, 0, 0);
    const pixeles = ctx.getImageData(0, 0, imagen.width, imagen.height);
    return cajas.map((c) => ({ ...c, firma: firmaDeCaja(pixeles, c) }));
  } catch {
    return cajas; // sin firma, el seguimiento funciona solo con posiciones
  }
}

function medir(det, imagen, veces) {
  det.detectForVideo(imagen, siguienteMarca()); // calentar (compila sombreadores en GPU)
  const tiempos = [];
  for (let i = 0; i < veces; i++) {
    const a = performance.now();
    det.detectForVideo(imagen, siguienteMarca());
    tiempos.push(performance.now() - a);
  }
  tiempos.sort((p, q) => p - q);
  return tiempos[Math.floor(tiempos.length / 2)];
}

async function iniciar({ modelo, umbral, maxPersonas, imagen }) {
  const { FilesetResolver, ObjectDetector } = await import(`${BASE}/vision_bundle.mjs`);
  self.postMessage({ tipo: 'paso', paso: 'preparar' });
  const vision = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
  const crear = (delegate) =>
    ObjectDetector.createFromOptions(vision, {
      baseOptions: { modelAssetBuffer: modelo, delegate },
      runningMode: 'VIDEO',
      scoreThreshold: umbral,
      maxResults: maxPersonas,
      categoryAllowlist: ['person'],
    });

  // Se prueba la tarjeta gráfica y el procesador con el primer cuadro y se queda el más rápido.
  self.postMessage({ tipo: 'paso', paso: 'calibrar' });
  let gpu = null;
  let msGpu = Infinity;
  try {
    gpu = await crear('GPU');
    msGpu = medir(gpu, imagen, 3);
  } catch {
    gpu = null;
  }
  let elegido = gpu;
  let delegado = 'GPU';
  let ms = msGpu;
  if (!gpu || msGpu > 40) {
    const cpu = await crear('CPU');
    const msCpu = medir(cpu, imagen, 3);
    if (msCpu < msGpu) {
      if (gpu) gpu.close();
      elegido = cpu;
      delegado = 'CPU';
      ms = msCpu;
    } else {
      cpu.close();
    }
  }
  imagen.close();
  detector = elegido;
  return { delegado, ms: Math.round(ms) };
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.tipo === 'iniciar') {
      const r = await iniciar(m);
      self.postMessage({ tipo: 'listo', ...r });
    } else if (m.tipo === 'detectar') {
      if (!detector) throw new Error('El detector no está listo');
      const a = performance.now();
      const resultado = detector.detectForVideo(m.imagen, siguienteMarca());
      const ms = performance.now() - a;
      const cajas = conFirmas(m.imagen, aCajas(resultado));
      m.imagen.close();
      const transferir = cajas.filter((c) => c.firma).map((c) => c.firma.buffer);
      self.postMessage({ tipo: 'resultado', id: m.id, cajas, ms }, transferir);
    } else if (m.tipo === 'cerrar') {
      if (detector) detector.close();
      detector = null;
      self.close();
    }
  } catch (err) {
    if (m && m.imagen && typeof m.imagen.close === 'function') m.imagen.close();
    self.postMessage({ tipo: 'error', id: m && m.id, error: String((err && err.message) || err) });
  }
};
