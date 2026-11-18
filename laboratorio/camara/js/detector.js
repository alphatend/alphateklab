// Detector de personas: MediaPipe Tasks Vision con el modelo EfficientDet-Lite0 (float16), todo en el navegador.
// Lo que baja de internet: la biblioteca (jsDelivr) y el modelo (Google Cloud Storage). Lo que sube: nada.
//
// Por qué este y no TensorFlow.js + coco-ssd (medido el 3-oct-2026 sobre el video de muestra, Chromium sin GPU):
// detecta a las mismas personas con umbral 0,3, tarda ~120 ms por cuadro en CPU contra ~430 ms, y baja ~10 MB
// contra ~19 MB. Corre en un worker para no trabar la página; si el navegador no puede, corre en el hilo principal.

import { firmaDeCaja } from './nucleo/apariencia.mjs';

const VERSION = '1.0.1';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
export const URL_MODELO =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
export const BYTES_MODELO = 7_254_339; // comprobado con curl -I el 3-oct-2026
export const BYTES_BIBLIOTECA = 3_250_000; // vision_bundle + cargador + WASM comprimidos, aproximado
// Dos umbrales: el detector devuelve todo lo que tenga puntaje ≥ 0,15 para pixelar también a quien el modelo ve con
// poca seguridad (mejor tapar de más), y solo las cajas ≥ 0,3 entran al seguimiento y al conteo (ese es el umbral
// con que se midió la precisión en pruebas/muestra.test.mjs).
export const UMBRAL = 0.15;
export const UMBRAL_CONTEO = 0.3;
export const MAX_PERSONAS = 40;

export class ErrorDeCarga extends Error {
  constructor(mensaje, causa) {
    super(mensaje);
    this.name = 'ErrorDeCarga';
    this.causa = causa;
  }
}

/** Baja el modelo informando el avance. Devuelve un Uint8Array. */
export async function bajarModelo({ alAvance, senal } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(URL_MODELO, { signal: senal, mode: 'cors' });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new ErrorDeCarga('red', e);
  }
  if (!respuesta.ok) throw new ErrorDeCarga('respuesta ' + respuesta.status);
  const total = Number(respuesta.headers.get('content-length')) || BYTES_MODELO;
  if (!respuesta.body || !respuesta.body.getReader) {
    const datos = new Uint8Array(await respuesta.arrayBuffer());
    if (alAvance) alAvance(datos.length, total);
    return datos;
  }
  const lector = respuesta.body.getReader();
  const trozos = [];
  let recibidos = 0;
  for (;;) {
    let paso;
    try {
      paso = await lector.read();
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new ErrorDeCarga('red', e);
    }
    if (paso.done) break;
    trozos.push(paso.value);
    recibidos += paso.value.length;
    if (alAvance) alAvance(recibidos, total);
  }
  const datos = new Uint8Array(recibidos);
  let pos = 0;
  for (const t of trozos) {
    datos.set(t, pos);
    pos += t.length;
  }
  return datos;
}

function crearConWorker({ modelo, imagen, alPaso }) {
  return new Promise((resolver, rechazar) => {
    let worker;
    try {
      worker = new Worker(new URL('./trabajador-detector.js', import.meta.url), { type: 'module' });
    } catch (e) {
      rechazar(e);
      return;
    }
    const pendientes = new Map();
    let siguienteId = 1;
    let listo = false;
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.tipo === 'paso') {
        if (alPaso) alPaso(m.paso);
      } else if (m.tipo === 'listo') {
        listo = true;
        resolver({
          delegado: m.delegado,
          msCalibracion: m.ms,
          enWorker: true,
          detectar(bitmap) {
            return new Promise((ok, mal) => {
              const id = siguienteId++;
              pendientes.set(id, { ok, mal });
              worker.postMessage({ tipo: 'detectar', id, imagen: bitmap }, [bitmap]);
            });
          },
          cerrar() {
            for (const p of pendientes.values()) p.mal(new Error('cerrado'));
            pendientes.clear();
            worker.postMessage({ tipo: 'cerrar' });
            setTimeout(() => worker.terminate(), 200);
          },
        });
      } else if (m.tipo === 'resultado') {
        const p = pendientes.get(m.id);
        pendientes.delete(m.id);
        if (p) p.ok({ cajas: m.cajas, ms: m.ms });
      } else if (m.tipo === 'error') {
        if (!listo) {
          worker.terminate();
          rechazar(new Error(m.error));
          return;
        }
        const p = pendientes.get(m.id);
        pendientes.delete(m.id);
        if (p) p.mal(new Error(m.error));
      }
    };
    worker.onerror = (e) => {
      e.preventDefault();
      if (!listo) {
        worker.terminate();
        rechazar(new Error(e.message || 'worker'));
      }
    };
    // El modelo se copia (no se transfiere) para poder reintentar en el hilo principal si el worker falla.
    worker.postMessage({ tipo: 'iniciar', modelo, umbral: UMBRAL, maxPersonas: MAX_PERSONAS, imagen }, [imagen]);
  });
}

// Igual que en el worker: se bloquea el envío de estadísticas de uso de MediaPipe a Google (no lleva imágenes, pero
// la demo dice que no sube nada).
let fetchEnvuelto = false;
function bloquearEstadisticas() {
  if (fetchEnvuelto) return;
  fetchEnvuelto = true;
  const original = window.fetch.bind(window);
  window.fetch = (recurso, opciones) => {
    const url = typeof recurso === 'string' ? recurso : recurso && recurso.url ? recurso.url : String(recurso);
    if (url.includes('odml.pa.googleapis.com')) return Promise.reject(new TypeError('Envío de estadísticas bloqueado por la demo'));
    return original(recurso, opciones);
  };
}

async function crearEnHiloPrincipal({ modelo, imagen, alPaso }) {
  bloquearEstadisticas();
  let mp;
  try {
    mp = await import(`${BASE}/vision_bundle.mjs`);
  } catch (e) {
    throw new ErrorDeCarga('biblioteca', e);
  }
  if (alPaso) alPaso('preparar');
  const vision = await mp.FilesetResolver.forVisionTasks(`${BASE}/wasm`);
  const crear = (delegate) =>
    mp.ObjectDetector.createFromOptions(vision, {
      baseOptions: { modelAssetBuffer: modelo, delegate },
      runningMode: 'VIDEO',
      scoreThreshold: UMBRAL,
      maxResults: MAX_PERSONAS,
      categoryAllowlist: ['person'],
    });
  if (alPaso) alPaso('calibrar');
  let det;
  let delegado = 'CPU';
  try {
    det = await crear('CPU');
  } catch {
    det = await crear('GPU');
    delegado = 'GPU';
  }
  let marca = 0;
  const siguiente = () => (marca = Math.max(marca + 1, Math.floor(performance.now())));
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  const a = performance.now();
  det.detectForVideo(imagen, siguiente());
  const ms = performance.now() - a;
  imagen.close();
  return {
    delegado,
    msCalibracion: Math.round(ms),
    enWorker: false,
    async detectar(bitmap) {
      const t0 = performance.now();
      const r = det.detectForVideo(bitmap, siguiente());
      const dur = performance.now() - t0;
      let cajas = r.detections.map((d) => ({
        x: d.boundingBox.originX,
        y: d.boundingBox.originY,
        w: d.boundingBox.width,
        h: d.boundingBox.height,
        puntaje: d.categories && d.categories[0] ? d.categories[0].score : null,
      }));
      if (cajas.length) {
        lienzo.width = bitmap.width;
        lienzo.height = bitmap.height;
        ctx.drawImage(bitmap, 0, 0);
        const pixeles = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        cajas = cajas.map((c) => ({ ...c, firma: firmaDeCaja(pixeles, c) }));
      }
      bitmap.close();
      return { cajas, ms: dur };
    },
    cerrar() {
      det.close();
    },
  };
}

/**
 * Prepara el detector. `imagen` es un ImageBitmap del primer cuadro (se usa para elegir GPU o CPU).
 * `alPaso` recibe 'preparar' | 'calibrar'.
 */
export async function crearDetector({ modelo, imagen, alPaso }) {
  const copiaImagen = await createImageBitmap(imagen);
  try {
    const det = await crearConWorker({ modelo: modelo.slice(), imagen, alPaso });
    copiaImagen.close();
    return det;
  } catch (e) {
    console.warn('El worker de detección no arrancó; se usa el hilo principal.', e);
    try {
      return await crearEnHiloPrincipal({ modelo, imagen: copiaImagen, alPaso });
    } catch (e2) {
      if (e2 instanceof ErrorDeCarga) throw e2;
      throw new ErrorDeCarga('preparar', e2);
    }
  }
}
