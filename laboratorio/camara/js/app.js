// Contador de personas con cámara · lo que une la página con el núcleo.
// El núcleo (js/nucleo/) hace las cuentas y tiene sus pruebas; aquí solo hay DOM, video, permisos y el bucle.

import { crearEscena } from './nucleo/escena.mjs';
import {
  CLAVE_ALMACEN,
  leerEstado,
  escribirEstado,
  estadoPorDefecto,
  sanearConfig,
  lineaValida,
  zonaValida,
  fechaLocal,
  conteoVacio,
  LIMITES,
  MAX_BITACORA,
  cerrarAvisosAbiertos,
} from './nucleo/estado.mjs';
import { crearRelojDeVideo } from './nucleo/reloj.mjs';
import { csvDeIntervalos } from './nucleo/csv.mjs';
import { numero, megas, horasDeAviso, duracion, textoSentido, textoReglaFila, personas, textoDeAviso, textoAforo, textoResumen } from './nucleo/formato.mjs';
import { crearVista, pintarEscalaCalor } from './vista.js';
import { crearGraficoMinutos, pintarTablaMinutos } from './grafico.js';
import { crearManijas } from './manijas.js';
import { bajarModelo, crearDetector, ErrorDeCarga, BYTES_MODELO, UMBRAL_CONTEO } from './detector.js';

const $ = (id) => document.getElementById(id);
const demo = $('demo');
const escenario = $('escenario');
const lienzo = $('lienzo');
const video = $('video');

const NOMBRE = { muestra: 'el video de muestra', camara: 'la cámara', archivo: 'tu video' };
const TITULO_AJUSTES = { muestra: 'Ajustes del video de muestra', camara: 'Ajustes de la cámara', archivo: 'Ajustes de tu video' };
const CON = { muestra: 'con el video de muestra', camara: 'con la cámara', archivo: 'con tu video' };
const MAX_LADO_ANALISIS = 960; // el cuadro analizado mide como mucho esto por su lado mayor
const ANALISIS_POR_SEGUNDO_DE_VIDEO = 12; // si el equipo no alcanza, el video va más lento (ver pruebas/muestra.test.mjs)

// ── estado guardado ─────────────────────────────────────────────────────────
function leerAlmacen() {
  try {
    return localStorage.getItem(CLAVE_ALMACEN);
  } catch {
    return null;
  }
}
let estado = leerEstado(leerAlmacen(), fechaLocal(Date.now()));
let temporizadorGuardar = null;
// Hay algo de esta pestaña que todavía no se guardó. Una pestaña que no cambió nada no escribe: si no, al cerrarse
// pisaría con su copia vieja lo que guardó otra pestaña.
let sucio = false;

function guardarAhora() {
  clearTimeout(temporizadorGuardar);
  temporizadorGuardar = null;
  if (!sucio) return;
  sincronizarConteo();
  try {
    localStorage.setItem(CLAVE_ALMACEN, escribirEstado(estado));
  } catch {
    // sin almacenamiento (modo privado, cuota llena): la demo sigue, solo no recuerda
  }
  sucio = false;
}
function guardar() {
  sucio = true;
  if (!temporizadorGuardar) temporizadorGuardar = setTimeout(guardarAhora, 1500);
}

// ── estado de la página ─────────────────────────────────────────────────────
let fuente = 'muestra';
let escena = null;
let bitacora = [];
let fase = 'apagada'; // apagada | cargando | error | encendida
let generacion = 0;
let corriendo = false;
let pausado = false;
let pausaPorOculta = false;
let detector = null;
let modeloBytes = null;
let abortador = null;
let stream = null;
let urlArchivo = null;
let archivoElegido = null;
let camaras = [];
let indiceCamara = 0;
let ancho = 960;
let alto = 540;
let modo = 'ver';
let borrador = null; // esquinas de la zona mientras se dibuja
let trazado = null; // línea nueva mientras se arrastra
let toque = null;
let hayCuadro = false;
let ultimasPrivadas = [];
let destellos = new Map();
let esperaCuadro = null;
let ultimoTiempoVideo = -1;
// Con un video, la escena mide en tiempo de video (ver js/nucleo/reloj.mjs); con la cámara, en tiempo de reloj.
const relojVideo = crearRelojDeVideo();
const medidas = { emaIntervalo: null, ultimoFin: null, ultimoTexto: 0, ultimoGrafico: 0, ultimoCalor: 0, ultimaEtiqueta: 0 };

let lienzoMostrado = document.createElement('canvas');
let lienzoProceso = document.createElement('canvas');

const vista = crearVista(lienzo);
const grafico = crearGraficoMinutos($('grafico'));
const manijas = crearManijas($('manijas'), {
  aPantalla: (p) => vista.pn(p),
  aNormal: (x, y) => vista.aNormal(x, y, { recortar: true }),
  alMover: moverManija,
  alSoltar: () => guardar(),
  alActivar: activarManija,
});
pintarEscalaCalor($('escala-calor'));

const config = () => estado.fuentes[fuente].config;

function crearEscenaDe(f, w, h) {
  return crearEscena({ ancho: w, alto: h, config: estado.fuentes[f].config, conteo: estado.fuentes[f].conteo });
}
/**
 * Pone la escena de la fuente `f` y su bitácora. Una escena nueva empieza con el aviso de fila cerrado (y con el de
 * aforo según el conteo): los avisos que la bitácora traía abiertos y que esta escena ya no va a cerrar se cierran a
 * la hora en que se guardó ese conteo por última vez.
 */
function ponerEscena(f, w, h) {
  escena = crearEscenaDe(f, w, h);
  const conteo = estado.fuentes[f].conteo;
  bitacora = cerrarAvisosAbiertos(conteo.bitacora || [], { fila: true, aforo: !escena.cifras().lleno }, conteo.hasta ?? Date.now());
}
function sincronizarConteo() {
  if (!escena) return;
  estado.fuentes[fuente].conteo = { ...escena.exportarConteo(), bitacora: bitacora.slice(-MAX_BITACORA), hasta: Date.now() };
}

// ── anuncios y avisos en pantalla ───────────────────────────────────────────
function anunciar(texto) {
  const r = $('anuncios');
  r.textContent = '';
  setTimeout(() => (r.textContent = texto), 60);
}
let temporizadorAviso = null;
function avisoLienzo(texto) {
  const p = $('aviso-lienzo');
  p.textContent = texto;
  p.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (p.hidden = true), 5000);
}

function ponerFase(nueva) {
  fase = nueva;
  demo.dataset.estado = nueva;
  $('form-arranque').hidden = nueva !== 'apagada';
  $('carga').hidden = nueva !== 'cargando';
  $('falla').hidden = nueva !== 'error';
  $('arranque').hidden = nueva === 'encendida';
  $('mando').hidden = nueva !== 'encendida';
  $('modos').disabled = nueva !== 'encendida';
  if (nueva !== 'encendida') {
    ponerModo('ver');
    manijas.ocultar();
  }
  actualizarHerramientas();
}

// ── elegir la fuente ────────────────────────────────────────────────────────
function elegirFuente(f) {
  if (f === fuente && escena) return;
  sincronizarConteo();
  fuente = f;
  ponerEscena(f, 960, 540);
  $('bloque-archivo').hidden = f !== 'archivo';
  refrescarTodo();
}
$('encender-previa').addEventListener('click', () => encender());

for (const r of document.querySelectorAll('input[name="fuente"]')) {
  r.addEventListener('change', () => {
    if (r.checked) elegirFuente(r.value);
  });
}
function marcarFuente(f) {
  const r = document.querySelector(`input[name="fuente"][value="${f}"]`);
  if (r) r.checked = true;
  elegirFuente(f);
}

$('archivo').addEventListener('change', () => {
  const archivo = $('archivo').files && $('archivo').files[0];
  $('error-archivo').hidden = true;
  if (!archivo) {
    archivoElegido = null;
    return;
  }
  if (archivo.type && !archivo.type.startsWith('video/')) {
    archivoElegido = null;
    errorArchivo('Ese archivo no es un video. Elige un MP4, WebM o MOV.');
    return;
  }
  archivoElegido = archivo;
  adoptarFirmaDelArchivo();
});
/** Un video distinto es otra puerta: su conteo empieza de cero. */
function adoptarFirmaDelArchivo() {
  if (!archivoElegido) return;
  const firma = `${archivoElegido.name}|${archivoElegido.size}`;
  if (estado.fuentes.archivo.firma === firma) return;
  estado.fuentes.archivo.firma = firma;
  estado.fuentes.archivo.conteo = conteoVacio(fechaLocal(Date.now()));
  if (fuente === 'archivo') {
    ponerEscena('archivo', 960, 540);
    refrescarTodo();
  }
  guardar();
}
function errorArchivo(texto) {
  const p = $('error-archivo');
  p.textContent = texto;
  p.hidden = false;
}

$('form-arranque').addEventListener('submit', (e) => {
  e.preventDefault();
  encender();
});

// ── encender ────────────────────────────────────────────────────────────────
class ErrorFuente extends Error {
  constructor(tipo, causa) {
    super(tipo);
    this.tipo = tipo;
    this.causa = causa;
  }
}

function paso(nombre, estadoPaso, dato) {
  const li = document.querySelector(`#carga-pasos li[data-paso="${nombre}"]`);
  if (!li) return;
  li.dataset.estado = estadoPaso;
  if (dato !== undefined) {
    const d = li.querySelector('.carga__dato');
    if (d) d.textContent = dato;
  }
}

async function encender() {
  if (fase === 'cargando') return;
  const f = fuente;
  if (f === 'archivo' && !archivoElegido) {
    errorArchivo('Primero elige un video de tu teléfono o computadora.');
    $('archivo').focus();
    return;
  }
  // otra pestaña pudo haber elegido otro video mientras tanto
  if (f === 'archivo') adoptarFirmaDelArchivo();
  const gen = ++generacion;
  abortador = new AbortController();
  $('carga-fuente-nombre').textContent = { muestra: 'Video de muestra', camara: 'Permiso de la cámara', archivo: 'Tu video' }[f];
  for (const n of ['fuente', 'modelo', 'preparar', 'calibrar']) paso(n, '', 'en espera');
  $('progreso-modelo').value = 0;
  ponerFase('cargando');
  $('cancelar').focus();
  anunciar('Encendiendo la demo.');
  try {
    paso('fuente', 'activo', f === 'camara' ? 'esperando tu respuesta' : 'abriendo');
    await abrirFuente(f, gen);
    if (gen !== generacion) return;
    paso('fuente', 'hecho', `${video.videoWidth} × ${video.videoHeight}`);

    if (!detector) {
      if (!modeloBytes) {
        paso('modelo', 'activo', `0 de ${megas(BYTES_MODELO)}`);
        modeloBytes = await bajarModelo({
          senal: abortador.signal,
          alAvance: (r, t) => {
            if (gen !== generacion) return;
            $('progreso-modelo').value = Math.round((100 * r) / t);
            paso('modelo', 'activo', `${megas(r)} de ${megas(t)}`);
          },
        });
      }
      if (gen !== generacion) return;
      $('progreso-modelo').value = 100;
      paso('modelo', 'hecho', megas(modeloBytes.length));
      paso('preparar', 'activo', 'bajando');
      const primero = await capturarCuadro();
      const det = await crearDetector({
        modelo: modeloBytes,
        imagen: primero,
        alPaso: (p) => {
          if (gen !== generacion) return;
          if (p === 'preparar') paso('preparar', 'activo', 'preparando');
          if (p === 'calibrar') {
            paso('preparar', 'hecho', 'lista');
            paso('calibrar', 'activo', 'probando');
          }
        },
      });
      if (detector) det.cerrar();
      else detector = det;
      if (gen !== generacion) return;
    }
    paso('modelo', 'hecho', modeloBytes ? megas(modeloBytes.length) : 'lista');
    paso('preparar', 'hecho', 'lista');
    paso('calibrar', 'hecho', detector.delegado === 'GPU' ? 'tarjeta gráfica' : 'procesador');
    arrancar(gen);
  } catch (e) {
    if (gen !== generacion) return;
    if (e && e.name === 'AbortError') return;
    console.warn('No se pudo encender la demo:', e);
    detenerFuente();
    mostrarFalla(e, f);
  }
}

$('cancelar').addEventListener('click', () => {
  generacion++;
  if (abortador) abortador.abort();
  detenerFuente();
  ponerFase('apagada');
  anunciar('Encendido cancelado.');
  $('encender').focus();
});

function esperarEvento(objetivo, ok, mal, ms) {
  return new Promise((resolver, rechazar) => {
    const limpiar = () => {
      objetivo.removeEventListener(ok, alOk);
      objetivo.removeEventListener(mal, alMal);
      clearTimeout(t);
    };
    const alOk = () => {
      limpiar();
      resolver();
    };
    const alMal = (e) => {
      limpiar();
      rechazar(e);
    };
    const t = setTimeout(() => {
      limpiar();
      rechazar(new Error('tiempo'));
    }, ms);
    objetivo.addEventListener(ok, alOk);
    objetivo.addEventListener(mal, alMal);
  });
}

function urlMuestra() {
  const mp4 = video.canPlayType('video/mp4; codecs="avc1.640028"');
  return mp4 ? 'media/muestra-zona-peatonal.mp4' : 'media/muestra-zona-peatonal.webm';
}

async function abrirFuente(f, gen) {
  detenerFuente();
  video.muted = true;
  video.playsInline = true;
  if (f === 'camara') {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new ErrorFuente('sin-api');
    try {
      stream = await abrirCamara();
    } catch (e) {
      throw new ErrorFuente(e && e.name ? e.name : 'camara', e);
    }
    if (gen !== generacion) {
      detenerFuente();
      return;
    }
    video.srcObject = stream;
  } else {
    video.srcObject = null;
    if (f === 'muestra') {
      video.src = urlMuestra();
    } else {
      urlArchivo = URL.createObjectURL(archivoElegido);
      video.src = urlArchivo;
    }
    video.preload = 'auto';
    video.load();
  }
  if (video.readyState < 2) {
    try {
      await esperarEvento(video, 'loadeddata', 'error', 20000);
    } catch (e) {
      throw new ErrorFuente(f === 'archivo' ? 'formato' : f === 'muestra' ? 'muestra' : 'camara', e);
    }
  }
  if (f === 'camara') {
    try {
      await video.play();
    } catch {
      // un stream de cámara sin reproducir igual entrega cuadros al dibujarlo; se reintenta al arrancar
    }
  }
  // Un video de archivo se queda quieto en su primer cuadro mientras baja el modelo: si no, pasaría gente sin
  // analizar (y un video corto podría terminar antes de empezar). Arranca en arrancar().
  if (!video.videoWidth || !video.videoHeight) throw new ErrorFuente(f === 'archivo' ? 'formato' : 'camara');
  const escala = Math.min(1, MAX_LADO_ANALISIS / Math.max(video.videoWidth, video.videoHeight));
  ancho = Math.round(video.videoWidth * escala);
  alto = Math.round(video.videoHeight * escala);
  for (const c of [lienzoMostrado, lienzoProceso]) {
    c.width = ancho;
    c.height = alto;
  }
  const proporcion = ancho / alto;
  escenario.style.setProperty('--proporcion', String(Math.max(1, proporcion)));
  if (f === 'camara') await listarCamaras();
}

async function abrirCamara(deviceId) {
  const video = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } };
  return navigator.mediaDevices.getUserMedia({ video, audio: false });
}

async function listarCamaras() {
  try {
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    camaras = dispositivos.filter((d) => d.kind === 'videoinput');
  } catch {
    camaras = [];
  }
  const actual = stream && stream.getVideoTracks()[0] && stream.getVideoTracks()[0].getSettings().deviceId;
  const i = camaras.findIndex((c) => c.deviceId === actual);
  indiceCamara = i >= 0 ? i : 0;
  $('otra-camara').hidden = camaras.length < 2;
}

$('otra-camara').addEventListener('click', async () => {
  if (fuente !== 'camara' || camaras.length < 2) return;
  const siguiente = camaras[(indiceCamara + 1) % camaras.length];
  try {
    const nuevo = await abrirCamara(siguiente.deviceId);
    if (stream) for (const t of stream.getTracks()) t.stop();
    stream = nuevo;
    video.srcObject = stream;
    await video.play().catch(() => {});
    indiceCamara = (indiceCamara + 1) % camaras.length;
    escena.reiniciarPistas();
    anunciar('Cambiaste de cámara.');
  } catch {
    avisoLienzo('No se pudo abrir la otra cámara. Sigue la que estaba.');
  }
});

function detenerFuente() {
  if (esperaCuadro) esperaCuadro();
  try {
    video.pause();
  } catch {}
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
    stream = null;
  }
  video.srcObject = null;
  video.removeAttribute('src');
  try {
    video.load();
  } catch {}
  if (urlArchivo) {
    URL.revokeObjectURL(urlArchivo);
    urlArchivo = null;
  }
  video.playbackRate = 1;
  $('otra-camara').hidden = true;
}

async function capturarCuadro() {
  const ctx = lienzoProceso.getContext('2d');
  ctx.drawImage(video, 0, 0, ancho, alto);
  return createImageBitmap(lienzoProceso);
}

const FALLAS = {
  NotAllowedError: [
    'No hay permiso para usar la cámara',
    'El navegador no dejó usar la cámara, o le dijiste que no. Para probarla, permite la cámara en la configuración de este sitio (el ícono junto a la dirección) y vuelve a encender la demo. También puedes usar el video de muestra o un video tuyo.',
    ['reintentar', 'muestra', 'archivo'],
  ],
  SecurityError: null, // se trata como NotAllowedError
  NotFoundError: [
    'No encontramos una cámara',
    'Este equipo no tiene cámara o el navegador no la ve. Prueba con el video de muestra o con un video grabado con tu teléfono.',
    ['muestra', 'archivo'],
  ],
  OverconstrainedError: null, // como NotFoundError
  NotReadableError: [
    'La cámara está ocupada',
    'Otra aplicación la está usando (una videollamada, por ejemplo). Ciérrala y vuelve a intentarlo.',
    ['reintentar', 'muestra'],
  ],
  'sin-api': [
    'Este navegador no da acceso a la cámara',
    'Pasa cuando la página no se abre por https o con navegadores muy viejos. Usa el video de muestra o un video tuyo.',
    ['muestra', 'archivo'],
  ],
  formato: [
    'No pudimos abrir ese video',
    'Tu navegador no reproduce ese formato. Prueba con un MP4 (H.264) o un WebM; los videos grabados con el teléfono suelen servir.',
    ['archivo', 'muestra'],
  ],
  muestra: [
    'No se pudo cargar el video de muestra',
    'Revisa la conexión y vuelve a intentarlo, o usa tu cámara.',
    ['reintentar', 'camara'],
  ],
  red: [
    'No se pudo bajar el modelo de detección',
    `La primera vez hace falta internet para bajar el modelo (${megas(BYTES_MODELO)}) desde los servidores de Google. Revisa la conexión y vuelve a intentarlo.`,
    ['reintentar'],
  ],
  biblioteca: [
    'No se pudo cargar la biblioteca de detección',
    'MediaPipe se baja de cdn.jsdelivr.net y no respondió. Revisa la conexión, o si tienes un bloqueador de contenido, permite ese sitio, y vuelve a intentarlo.',
    ['reintentar'],
  ],
  preparar: [
    'Tu navegador no pudo preparar el modelo',
    'La demo necesita WebAssembly, que traen Chrome, Edge, Firefox y Safari recientes. Si estás en uno de esos, recarga la página y vuelve a intentarlo.',
    ['reintentar'],
  ],
  analisis: [
    'El análisis se detuvo',
    'El detector dejó de responder (puede pasar si el equipo se quedó sin memoria). Vuelve a encender la demo.',
    ['reintentar'],
  ],
};
FALLAS.SecurityError = FALLAS.NotAllowedError;
FALLAS.OverconstrainedError = FALLAS.NotFoundError;
FALLAS.camara = FALLAS.NotReadableError;
FALLAS.AbortError = FALLAS.NotReadableError;

const ACCIONES = {
  reintentar: ['Volver a intentarlo', () => encender()],
  muestra: [
    'Usar el video de muestra',
    () => {
      marcarFuente('muestra');
      encender();
    },
  ],
  camara: [
    'Usar la cámara',
    () => {
      marcarFuente('camara');
      encender();
    },
  ],
  archivo: [
    'Elegir un video tuyo',
    () => {
      marcarFuente('archivo');
      ponerFase('apagada');
      $('archivo').focus();
    },
  ],
};

function mostrarFalla(e, f) {
  let clave = 'preparar';
  if (e instanceof ErrorFuente) clave = e.tipo;
  else if (e instanceof ErrorDeCarga) clave = e.message === 'red' || e.message.startsWith('respuesta') ? 'red' : e.message;
  if (!navigator.onLine && (clave === 'preparar' || clave === 'biblioteca')) clave = 'red';
  const [titulo, texto, acciones] = FALLAS[clave] || FALLAS.preparar;
  $('falla-titulo').textContent = titulo;
  $('falla-texto').textContent = texto;
  const cont = $('falla-acciones');
  cont.replaceChildren();
  acciones
    .filter((a) => a !== f || a === 'reintentar')
    .forEach((a, i) => {
      const [etiqueta, accion] = ACCIONES[a];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'boton ' + (i === 0 ? 'boton--senal' : 'boton--linea');
      b.textContent = etiqueta;
      b.addEventListener('click', accion);
      cont.appendChild(b);
    });
  const volver = document.createElement('button');
  volver.type = 'button';
  volver.className = 'boton boton--linea';
  volver.textContent = 'Elegir otra fuente';
  volver.addEventListener('click', () => {
    ponerFase('apagada');
    $('encender').focus();
  });
  cont.appendChild(volver);
  ponerFase('error');
  const primero = cont.querySelector('button');
  if (primero) primero.focus();
}

// ── el bucle de análisis ────────────────────────────────────────────────────
function arrancar(gen) {
  sincronizarConteo();
  ponerEscena(fuente, ancho, alto);
  relojVideo.reiniciar();
  vista.fijarCuadro(ancho, alto);
  hayCuadro = false;
  ultimasPrivadas = [];
  destellos = new Map();
  pausado = false;
  medidas.emaIntervalo = null;
  medidas.ultimoFin = null;
  ultimoTiempoVideo = -1;
  $('pausar').textContent = fuente === 'camara' ? 'Pausar el análisis' : 'Pausar el video';
  $('pausar').setAttribute('aria-pressed', 'false');
  $('nota-camara').hidden = fuente !== 'camara';
  corriendo = true;
  ponerFase('encendida');
  refrescarTodo();
  if (fuente !== 'camara') {
    if (video.currentTime > 0) video.currentTime = 0;
    video.play().catch((e) => {
      console.warn('El video no arrancó solo:', e);
      pausado = true;
      $('pausar').textContent = 'Seguir el video';
      $('pausar').setAttribute('aria-pressed', 'true');
    });
  } else if (video.paused) video.play().catch(() => {});
  const caja = escenario.getBoundingClientRect();
  if (caja.top < 60 || caja.bottom > window.innerHeight) {
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    demo.scrollIntoView({ block: 'start', behavior: reducir ? 'auto' : 'smooth' });
  }
  $('pausar').focus({ preventScroll: true });
  anunciar(`Demo encendida ${CON[fuente]}. Analizando.`);
  bucle(gen);
}

function esperarSiguienteCuadro() {
  return new Promise((resolver) => {
    let hecho = false;
    const fin = () => {
      if (hecho) return;
      hecho = true;
      esperaCuadro = null;
      resolver();
    };
    esperaCuadro = fin;
    if (typeof video.requestVideoFrameCallback === 'function' && !video.paused) {
      const h = video.requestVideoFrameCallback(fin);
      esperaCuadro = () => {
        try {
          video.cancelVideoFrameCallback(h);
        } catch {}
        fin();
      };
    } else {
      // sin requestVideoFrameCallback, o en pausa: se revisa en el próximo cuadro de pantalla
      requestAnimationFrame(fin);
    }
  });
}

async function bucle(gen) {
  while (corriendo && gen === generacion) {
    await esperarSiguienteCuadro();
    if (!corriendo || gen !== generacion) break;
    if (pausado || video.readyState < 2 || !video.videoWidth) {
      if (pausado) await new Promise((r) => setTimeout(r, 100));
      continue;
    }
    if (fuente !== 'camara' && video.ended) {
      // por si el evento «ended» se perdió: el video se repite
      escena.reiniciarPistas();
      ultimoTiempoVideo = -1;
      video.currentTime = 0;
      video.play().catch(() => {});
      continue;
    }
    if (fuente !== 'camara') {
      if (video.currentTime === ultimoTiempoVideo) continue;
      if (video.currentTime + 0.25 < ultimoTiempoVideo) escena.reiniciarPistas();
      ultimoTiempoVideo = video.currentTime;
    }
    // Se copia el cuadro al lienzo de proceso; ese mismo lienzo es el que se muestra cuando vuelve el resultado.
    // El tiempo de escena es el de ese cuadro: el del video (aunque vaya a 0,25×) o, con la cámara, el del reloj.
    const tEscena = fuente === 'camara' ? Date.now() : relojVideo.leer(video.currentTime);
    lienzoProceso.getContext('2d').drawImage(video, 0, 0, ancho, alto);
    let bitmap;
    try {
      bitmap = await createImageBitmap(lienzoProceso);
    } catch {
      continue;
    }
    let res;
    try {
      res = await detector.detectar(bitmap);
    } catch (e) {
      if (gen !== generacion) break;
      console.warn('Falló el análisis:', e);
      corriendo = false;
      detenerFuente();
      mostrarFalla(new ErrorDeCarga('analisis', e), fuente);
      break;
    }
    if (gen !== generacion) break;
    // El cuadro que se muestra es exactamente el que se analizó, y se pixela con sus propias cajas.
    [lienzoMostrado, lienzoProceso] = [lienzoProceso, lienzoMostrado];
    hayCuadro = true;
    const ahora = performance.now();
    if (medidas.ultimoFin !== null) {
      const intervalo = ahora - medidas.ultimoFin;
      medidas.emaIntervalo = medidas.emaIntervalo === null ? intervalo : 0.85 * medidas.emaIntervalo + 0.15 * intervalo;
    }
    medidas.ultimoFin = ahora;
    procesar(res.cajas, ahora, tEscena);
  }
}

function procesar(cajas, ahora, tEscena) {
  const t = Date.now();
  const hoy = fechaLocal(t);
  if (escena.fecha && escena.fecha !== hoy) {
    escena.reiniciarConteo(hoy);
    bitacora = [];
    pintarBitacora();
    pintarMinutos();
    anunciar('Empezó un día nuevo: el conteo volvió a cero.');
  }
  const r = escena.procesar(
    cajas.filter((c) => c.puntaje === null || c.puntaje >= UMBRAL_CONTEO),
    tEscena,
    t,
  );
  // se pixela todo lo que el modelo vio, aunque sea con poca seguridad, y cada pista viva
  ultimasPrivadas = cajas.concat(r.pistas.map((p) => p.caja));
  for (const ev of r.eventos) destellos.set(ev.id, { tipo: ev.tipo, t: ahora });
  for (const [id, d] of destellos) if (ahora - d.t > 1500) destellos.delete(id);
  registrarCambios(r.cambios, r.cifras, t);
  pintarCifras(r.cifras);
  if (ahora - medidas.ultimoCalor > 500) {
    medidas.ultimoCalor = ahora;
    vista.actualizarCalor(escena.calor);
    pintarLeyendaCalor();
  }
  if (ahora - medidas.ultimoGrafico > 1000 || r.eventos.length) {
    medidas.ultimoGrafico = ahora;
    pintarMinutos();
  }
  if (ahora - medidas.ultimoTexto > 1000) {
    medidas.ultimoTexto = ahora;
    pintarRendimiento();
    ajustarVelocidad();
  }
  if (ahora - medidas.ultimaEtiqueta > 2000) {
    medidas.ultimaEtiqueta = ahora;
    lienzo.setAttribute(
      'aria-label',
      `Video analizado ${CON[fuente]}: ${personas(r.cifras.visibles)} a la vista. Hoy van ${r.cifras.entradas} entradas y ${r.cifras.salidas} salidas.`,
    );
  }
  pintarEscena();
  guardar();
}

function fpsActual() {
  return medidas.emaIntervalo ? 1000 / medidas.emaIntervalo : null;
}

function ajustarVelocidad() {
  if (fuente === 'camara') return;
  const fps = fpsActual();
  if (!fps) return;
  // Con menos de 12 análisis por segundo de video, el seguimiento pierde gente: se desacelera el video.
  // fps son análisis por segundo de reloj; por segundo de video son fps / velocidad. Se busca velocidad ≤ fps / 12.
  let velocidad = Math.floor((fps / ANALISIS_POR_SEGUNDO_DE_VIDEO) * 4) / 4;
  velocidad = Math.min(1, Math.max(0.25, velocidad));
  if (Math.abs(velocidad - video.playbackRate) >= 0.25) video.playbackRate = velocidad;
}

function pintarRendimiento() {
  const fps = fpsActual();
  if (!fps) return;
  const quien = detector.delegado === 'GPU' ? 'la tarjeta gráfica' : 'el procesador';
  let texto = `Analiza ${numero(fps, 0)} cuadros por segundo con ${quien}`;
  if (fuente !== 'camara' && video.playbackRate < 1) {
    const porSegundoDeVideo = fps / video.playbackRate;
    texto +=
      porSegundoDeVideo >= ANALISIS_POR_SEGUNDO_DE_VIDEO
        ? `. El video va a ${numero(video.playbackRate, 2)}× para darle tiempo a tu teléfono o computadora`
        : `. El video va a ${numero(video.playbackRate, 2)}×, lo más lento; aun así tu teléfono o computadora puede perder a quien pase rápido`;
  }
  if (pausado) texto = 'En pausa';
  $('rendimiento').textContent = texto;
}

function pintarLeyendaCalor() {
  const max = escena.calor.maximo;
  $('calor-max').textContent =
    max <= 0 ? '(todavía vacío)' : max < 1 ? '(el punto más visitado suma menos de 1 s)' : `(el punto más visitado suma ${duracion(max)})`;
  $('leyenda-calor').hidden = !estado.preferencias.verCalor;
}

// ── avisos y bitácora ───────────────────────────────────────────────────────
function registrarCambios(cambios, c, t) {
  if (cambios.aforo === 'lleno') {
    bitacora.push({ tipo: 'aforo', inicio: t, fin: null, detalle: `Aforo completo: ${textoAforo(c.dentro, c.aforoMax)}`, maximo: c.dentro, inicial: c.dentro });
    anunciar(`Aviso: aforo completo, ${textoAforo(c.dentro, c.aforoMax)}.`);
  }
  if (cambios.aforo === 'libre') {
    const abierto = [...bitacora].reverse().find((a) => a.tipo === 'aforo' && a.fin === null);
    if (abierto) abierto.fin = t;
  }
  if (cambios.fila === 'abre') {
    bitacora.push({ tipo: 'fila', inicio: t, fin: null, detalle: `Abrir otra caja: ${personas(c.enFila)} en la fila`, maximo: c.enFila, inicial: c.enFila });
    anunciar(`Aviso: abrir otra caja, ${personas(c.enFila)} en la fila.`);
  }
  if (cambios.fila === 'cierra') {
    const abierto = [...bitacora].reverse().find((a) => a.tipo === 'fila' && a.fin === null);
    if (abierto) abierto.fin = t;
  }
  for (const a of bitacora) {
    if (a.fin !== null) continue;
    if (a.tipo === 'aforo') a.maximo = Math.max(a.maximo, c.dentro);
    if (a.tipo === 'fila' && c.enFila !== null) a.maximo = Math.max(a.maximo, c.enFila);
  }
  if (bitacora.length > MAX_BITACORA) bitacora = bitacora.slice(-MAX_BITACORA);
  if (cambios.aforo || cambios.fila) pintarBitacora();
}

function pintarBitacora() {
  const lista = $('bitacora');
  lista.replaceChildren();
  for (const a of [...bitacora].reverse()) {
    const li = document.createElement('li');
    const h = document.createElement('span');
    h.className = 'bitacora__hora';
    h.textContent = horasDeAviso(a.inicio, a.fin);
    const d = document.createElement('span');
    d.textContent = textoDeAviso(a);
    li.append(h, d);
    lista.appendChild(li);
  }
  $('bitacora-vacia').hidden = bitacora.length > 0;
}

const ICONO_AVISO =
  '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 2.5 18.5 17.5h-17L10 2.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 8v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14.8" r="1.1" fill="currentColor"/></svg>';

let avisoAforoEl = null;
let avisoFilaEl = null;
function pintarAvisos(c) {
  const cont = $('avisos');
  if (c.lleno && !avisoAforoEl) {
    avisoAforoEl = document.createElement('div');
    avisoAforoEl.className = 'alerta alerta--aforo';
    avisoAforoEl.innerHTML = `${ICONO_AVISO}<p><strong>Aforo completo</strong><span class="alerta__texto"></span></p>`;
    cont.prepend(avisoAforoEl);
  } else if (!c.lleno && avisoAforoEl) {
    avisoAforoEl.remove();
    avisoAforoEl = null;
  }
  if (avisoAforoEl) {
    avisoAforoEl.querySelector('.alerta__texto').textContent = `${textoAforo(c.dentro, c.aforoMax)}. Que no entre nadie más hasta que salga alguien.`;
  }
  if (c.filaActiva && !avisoFilaEl) {
    avisoFilaEl = document.createElement('div');
    avisoFilaEl.className = 'alerta alerta--fila';
    avisoFilaEl.innerHTML = `${ICONO_AVISO}<p><strong>Abrir otra caja</strong><span class="alerta__texto"></span></p>`;
    cont.appendChild(avisoFilaEl);
  } else if (!c.filaActiva && avisoFilaEl) {
    avisoFilaEl.remove();
    avisoFilaEl = null;
  }
  if (avisoFilaEl) {
    const desde = c.filaLleva !== null && c.filaLleva !== undefined ? ` desde hace ${duracion(c.filaLleva)}` : '';
    avisoFilaEl.querySelector('.alerta__texto').textContent = `${personas(c.enFila)} en la fila${desde}.`;
  }
}

// ── cifras ──────────────────────────────────────────────────────────────────
const textoAnterior = new Map();
function texto(id, valor) {
  if (textoAnterior.get(id) === valor) return;
  textoAnterior.set(id, valor);
  $(id).textContent = valor;
}

function pintarCifras(c) {
  texto('c-entradas', numero(c.entradas));
  texto('c-salidas', numero(c.salidas));
  texto('c-dentro', numero(c.dentro));
  // La cuenta completa a la vista: si «Dentro ahora» no es entradas menos salidas, se dice de dónde sale la diferencia
  // (quien sale sin que la cámara lo viera entrar ya estaba dentro al empezar; o un +1/−1 puesto a mano).
  const dif = c.dentro - (c.entradas - c.salidas);
  const plural = (n, uno, varios) => `${numero(n)} ${n === 1 ? uno : varios}`;
  texto('c-cuenta', `${plural(c.entradas, 'entrada', 'entradas')} menos ${plural(c.salidas, 'salida', 'salidas')}${
    dif > 0 ? `, más ${plural(dif, 'que salió sin que la cámara la viera entrar (ya estaba dentro) o que sumaste a mano', 'que salieron sin que la cámara las viera entrar (ya estaban dentro) o que sumaste a mano')}`
    : dif < 0 ? `, menos ${plural(-dif, 'persona que restaste a mano', 'personas que restaste a mano')}` : ''}.`);
  texto('c-aforo-de', `de ${numero(c.aforoMax)}`);
  texto('c-maximo', numero(c.maximo));
  $('medidor-barra').style.transform = `scaleX(${Math.min(1, Math.max(0, c.proporcion)).toFixed(3)})`;
  $('cifra-aforo').dataset.nivel = c.lleno ? 'lleno' : c.proporcion >= 0.8 ? 'alto' : 'normal';
  $('menos').disabled = c.dentro === 0;
  const cfg = config();
  if (!cfg.zona) {
    texto('c-fila', '—');
    texto('c-fila-nota', 'sin zona');
  } else {
    texto('c-fila', c.enFila === null ? '0' : numero(c.enFila));
    let nota = `avisa con ${cfg.filaMax + 1} o más`;
    if (c.filaActiva) nota = 'aviso abierto';
    else if (c.filaFaltan !== null && c.filaFaltan !== undefined) nota = `aviso en ${Math.ceil(c.filaFaltan)} s`;
    texto('c-fila-nota', nota);
  }
  pintarAvisos(c);
  const resumen = textoResumen(c, bitacora.length, CON[fuente]);
  texto('resumen', resumen);
  $('resumen').hidden = !resumen;
}

function pintarMinutos() {
  const datos = escena.intervalos.ultimos(15, Date.now());
  grafico.pintar(datos);
  pintarTablaMinutos($('tabla-minutos'), datos);
  $('csv').disabled = escena.intervalos.todos().length === 0;
}

$('menos').addEventListener('click', () => ajustarDentro(-1));
$('mas').addEventListener('click', () => ajustarDentro(+1));
function ajustarDentro(delta) {
  const r = escena.ajustarDentro(delta);
  registrarCambios(r.cambios, r.cifras, Date.now());
  pintarCifras(r.cifras);
  guardar();
}

// ── la escena en el lienzo ──────────────────────────────────────────────────
function pintarEscena() {
  if (fase !== 'encendida') return;
  const cfg = config();
  const mostrada = trazado ? { ...cfg, linea: { a: trazado.a, b: trazado.b } } : cfg;
  const c = escena.cifras();
  vista.pintar({
    cuadro: hayCuadro ? lienzoMostrado : null,
    pistas: escena.pistas,
    privadas: ultimasPrivadas,
    config: mostrada,
    preferencias: estado.preferencias,
    destellos,
    fila: { activa: c.filaActiva, cuenta: cfg.zona ? c.enFila : null },
    borrador,
    modo,
    ahora: performance.now(),
  });
  pintarManijas();
}

function pintarManijas() {
  if (fase !== 'encendida' || modo === 'ver') {
    manijas.ocultar();
    return;
  }
  const cfg = config();
  if (modo === 'linea') {
    const l = trazado ? { a: trazado.a, b: trazado.b } : cfg.linea;
    manijas.mostrar([
      { clave: 'a', punto: l.a, etiqueta: 'Punta 1 de la línea de conteo. Muévela con las flechas.' },
      { clave: 'b', punto: l.b, etiqueta: 'Punta 2 de la línea de conteo. Muévela con las flechas.' },
    ]);
    return;
  }
  if (borrador) {
    const lista = borrador.map((p, i) => ({
      clave: 'n' + i,
      punto: p,
      clase: 'manija--zona' + (i === 0 ? ' manija--primera' : ''),
      rotulo: i === 0 && borrador.length >= 3 ? 'Cerrar' : '',
      etiqueta:
        i === 0 && borrador.length >= 3
          ? 'Primera esquina: tócala o pulsa Enter para cerrar la zona. Se mueve con las flechas.'
          : `Esquina ${i + 1} de la zona nueva. Muévela con las flechas.`,
    }));
    manijas.mostrar(lista);
    return;
  }
  if (cfg.zona) {
    manijas.mostrar(
      cfg.zona.map((p, i) => ({
        clave: 'z' + i,
        punto: p,
        clase: 'manija--zona',
        etiqueta: `Esquina ${i + 1} de ${cfg.zona.length} de la zona de fila. Muévela con las flechas.`,
      })),
    );
  } else manijas.ocultar();
}

function moverManija(m, p) {
  const cfg = config();
  if (m.clave === 'a' || m.clave === 'b') {
    const linea = { ...cfg.linea, [m.clave]: p };
    if (!lineaValida(linea)) return; // no se deja colapsar la línea en un punto
    aplicarConfig({ ...cfg, linea }, { guardarYa: false });
  } else if (m.clave.startsWith('z')) {
    const i = Number(m.clave.slice(1));
    const zona = cfg.zona.map((q, j) => (j === i ? p : q));
    if (!zonaValida(zona)) return;
    aplicarConfig({ ...cfg, zona }, { guardarYa: false });
  } else if (m.clave.startsWith('n') && borrador) {
    const i = Number(m.clave.slice(1));
    borrador[i] = p;
    pintarEscena();
  }
}

function activarManija(m) {
  if (m.clave === 'n0' && borrador && borrador.length >= 3) cerrarZona();
}

function aplicarConfig(nueva, { guardarYa = true } = {}) {
  estado.fuentes[fuente].config = sanearConfig(nueva, fuente);
  const r = escena.configurar(estado.fuentes[fuente].config);
  registrarCambios(r.cambios, r.cifras, Date.now());
  pintarCifras(r.cifras);
  pintarTextosAjustes();
  pintarEscena();
  if (guardarYa) guardar();
  else guardar();
}

// dibujar la línea y la zona con el puntero
lienzo.addEventListener('pointerdown', (e) => {
  if (fase !== 'encendida' || (e.button !== undefined && e.button !== 0)) return;
  if (modo === 'linea') {
    const p = vista.aNormal(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault();
    lienzo.setPointerCapture(e.pointerId);
    trazado = { id: e.pointerId, a: p, b: p };
    pintarEscena();
  } else if (modo === 'zona' && borrador) {
    const p = vista.aNormal(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault();
    toque = { id: e.pointerId, x: e.clientX, y: e.clientY, p };
  } else if (modo === 'zona' && config().zona) {
    // Ya hay zona: un toque suelto no pone esquinas. Se dice, en vez de no hacer nada.
    avisoLienzo('Ya hay una zona: arrastra sus esquinas para cambiarla. Para marcar otra, toca «Dibujar otra zona».');
  }
});
lienzo.addEventListener('pointermove', (e) => {
  if (trazado && e.pointerId === trazado.id) {
    trazado.b = vista.aNormal(e.clientX, e.clientY, { recortar: true });
    pintarEscena();
  }
});
function terminarTrazo(e) {
  if (trazado && e.pointerId === trazado.id) {
    const linea = { a: trazado.a, b: trazado.b };
    trazado = null;
    if (lineaValida(linea)) {
      aplicarConfig({ ...config(), linea });
      anunciar(`Línea nueva. Entrada: ${textoSentido(linea, config().sentido, ancho / alto)}.`);
    } else {
      pintarEscena();
      avisoLienzo('La línea quedó muy corta. Arrástrala de un lado de la puerta al otro.');
    }
  }
  if (toque && e.pointerId === toque.id) {
    const lejos = Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 12;
    const p = toque.p;
    toque = null;
    if (!lejos && e.type === 'pointerup') agregarEsquina(p);
  }
}
lienzo.addEventListener('pointerup', terminarTrazo);
lienzo.addEventListener('pointercancel', terminarTrazo);

function agregarEsquina(p) {
  if (!borrador) return;
  if (borrador.length >= 3) {
    const primera = vista.pn(borrador[0]);
    const nueva = vista.pn(p);
    if (Math.hypot(primera.x - nueva.x, primera.y - nueva.y) < 22) {
      cerrarZona();
      return;
    }
  }
  borrador.push(p);
  if (borrador.length >= 12) {
    cerrarZona();
    return;
  }
  actualizarHerramientas();
  pintarEscena();
}

function cerrarZona() {
  if (!borrador || borrador.length < 3) return;
  if (!zonaValida(borrador)) {
    avisoLienzo('La zona quedó muy chica o aplastada. Marca al menos 3 esquinas separadas.');
    return;
  }
  const zona = borrador;
  borrador = null;
  aplicarConfig({ ...config(), zona });
  actualizarHerramientas();
  anunciar(`Zona de fila lista, con ${zona.length} esquinas.`);
}

$('zona-cerrar').addEventListener('click', cerrarZona);
// Sin mouse ni dedo: cada esquina nueva aparece en el video ya enfocada y se mueve con las flechas. Las cuatro
// primeras forman un rectángulo en el centro (cerrarlo ya da una zona válida); las siguientes van entre la última y
// la primera.
const ESQUINAS_SIN_PUNTERO = [
  { x: 0.3, y: 0.3 },
  { x: 0.7, y: 0.3 },
  { x: 0.7, y: 0.7 },
  { x: 0.3, y: 0.7 },
];
$('zona-esquina').addEventListener('click', () => {
  if (!borrador || borrador.length >= 12) return;
  const n = borrador.length;
  const p =
    n < ESQUINAS_SIN_PUNTERO.length
      ? { ...ESQUINAS_SIN_PUNTERO[n] }
      : { x: (borrador[n - 1].x + borrador[0].x) / 2, y: (borrador[n - 1].y + borrador[0].y) / 2 };
  borrador.push(p);
  actualizarHerramientas();
  pintarEscena();
  manijas.enfocar('n' + n);
  anunciar(`Esquina ${n + 1} puesta en el video. Muévela con las flechas.${n + 1 >= 3 ? ' Ya puedes cerrar la zona.' : ''}`);
});
$('zona-deshacer').addEventListener('click', () => {
  if (borrador && borrador.length) borrador.pop();
  actualizarHerramientas();
  pintarEscena();
});
$('zona-nueva').addEventListener('click', () => {
  borrador = [];
  actualizarHerramientas();
  pintarEscena();
});
$('zona-borrar').addEventListener('click', () => {
  borrador = null;
  aplicarConfig({ ...config(), zona: null });
  actualizarHerramientas();
  anunciar('Quitaste la zona de fila: no habrá aviso de fila.');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && borrador && modo === 'zona') {
    borrador = config().zona ? null : [];
    actualizarHerramientas();
    pintarEscena();
  }
  if (e.key === 'Enter' && borrador && borrador.length >= 3 && modo === 'zona' && e.target === document.body) cerrarZona();
});

for (const r of document.querySelectorAll('input[name="modo"]')) {
  r.addEventListener('change', () => {
    if (r.checked) ponerModo(r.value);
  });
}
function ponerModo(m) {
  const cambia = m !== modo;
  modo = m;
  escenario.dataset.modo = m;
  if (cambia && m !== 'ver' && fase === 'encendida') {
    // para dibujar, el video tiene que verse entero, con la ayuda y los botones que van justo debajo
    $('dibujo').hidden = false;
    const visor = escenario.parentElement;
    const caja = visor.getBoundingClientRect();
    if (caja.top < 64 || caja.bottom > window.innerHeight) {
      const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const cabe = caja.height <= window.innerHeight - 72;
      (cabe ? visor : escenario).scrollIntoView({ block: cabe ? 'end' : 'start', behavior: reducir ? 'auto' : 'smooth' });
    }
  }
  const r = document.querySelector(`input[name="modo"][value="${m}"]`);
  if (r && !r.checked) r.checked = true;
  borrador = m === 'zona' && !config().zona ? [] : null;
  trazado = null;
  actualizarHerramientas();
  pintarEscena();
}

function actualizarHerramientas() {
  const ayuda = $('ayuda-modo');
  const acciones = $('acciones-zona');
  $('dibujo').hidden = fase !== 'encendida' || modo === 'ver';
  if (fase !== 'encendida' || modo === 'ver') {
    ayuda.textContent = '';
    acciones.hidden = true;
    return;
  }
  acciones.hidden = modo !== 'zona';
  if (modo === 'linea') {
    ayuda.textContent =
      'Arrastra sobre el video, de un lado de la puerta al otro, para trazar una línea nueva, o arrastra sus puntas. Con el teclado: Tab hasta una punta y flechas (Mayús + flecha va más lejos).';
  } else if (borrador) {
    const faltan = Math.max(0, 3 - borrador.length);
    ayuda.textContent =
      borrador.length === 0
        ? 'Toca el video para poner cada esquina de la zona, alrededor de donde la gente hace fila. Sin mouse: «Agregar una esquina» y muévela con las flechas.'
        : faltan > 0
          ? `Llevas ${borrador.length} ${borrador.length === 1 ? 'esquina' : 'esquinas'}; faltan al menos ${faltan}.`
          : `Llevas ${borrador.length} esquinas. Ciérrala tocando la primera esquina o con «Cerrar la zona».`;
  } else if (config().zona) {
    ayuda.textContent = 'Arrastra las esquinas de la zona o muévelas con las flechas. Para empezar de cero, «Dibujar otra zona».';
  } else {
    ayuda.textContent = 'No hay zona de fila, así que no hay aviso de fila. Toca «Dibujar otra zona» para marcar una.';
  }
  $('zona-cerrar').disabled = !borrador || borrador.length < 3;
  $('zona-deshacer').disabled = !borrador || borrador.length === 0;
  $('zona-nueva').hidden = Boolean(borrador);
  $('zona-borrar').hidden = Boolean(borrador) || !config().zona;
  $('zona-cerrar').hidden = !borrador;
  $('zona-deshacer').hidden = !borrador;
  $('zona-esquina').hidden = !borrador;
  $('zona-esquina').disabled = !borrador || borrador.length >= 12;
  // si el botón que tenía el foco se acaba de ocultar (por ejemplo «Dibujar otra zona»), el foco pasa al siguiente
  // de la barra en vez de perderse en la página
  const barra = ['zona-esquina', 'zona-cerrar', 'zona-deshacer', 'zona-nueva', 'zona-borrar'].map($);
  const activo = document.activeElement;
  if (barra.includes(activo) && (activo.hidden || activo.disabled)) barra.find((b) => !b.hidden && !b.disabled)?.focus();
}

// ── mando ───────────────────────────────────────────────────────────────────
$('pausar').addEventListener('click', () => {
  pausado = !pausado;
  $('pausar').setAttribute('aria-pressed', String(pausado));
  if (fuente === 'camara') $('pausar').textContent = pausado ? 'Seguir analizando' : 'Pausar el análisis';
  else $('pausar').textContent = pausado ? 'Seguir el video' : 'Pausar el video';
  if (fuente !== 'camara') {
    if (pausado) video.pause();
    else video.play().catch(() => {});
  }
  if (pausado) $('rendimiento').textContent = 'En pausa';
  // Con la cámara, mientras estuvo en pausa la gente siguió caminando: al volver, las pistas viejas ya no sirven.
  // Con un video, la escena quedó congelada y se sigue donde estaba.
  else if (fuente === 'camara') escena.reiniciarPistas();
  anunciar(pausado ? 'En pausa.' : 'Analizando otra vez.');
});

$('apagar').addEventListener('click', () => apagar());
function apagar() {
  generacion++;
  corriendo = false;
  detenerFuente();
  sincronizarConteo();
  // El aviso de fila lo cierra la escena cuando la fila se va; apagada, ya no lo haría. Se crea otra escena (del
  // tamaño del video, para no perder el mapa de calor), que empieza sin aviso de fila, y lo abierto se cierra ahora.
  ponerEscena(fuente, ancho, alto);
  sucio = true;
  guardarAhora();
  ponerFase('apagada');
  refrescarTodo();
  $('encender').focus();
  anunciar('Demo apagada. Puedes elegir otro video.');
}

video.addEventListener('ended', () => {
  if (!corriendo || fuente === 'camara') return;
  escena.reiniciarPistas();
  ultimoTiempoVideo = -1;
  video.currentTime = 0;
  video.play().catch(() => {});
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    guardarAhora();
    if (corriendo && fuente !== 'camara' && !pausado && !video.paused) {
      video.pause();
      pausaPorOculta = true;
    }
  } else if (pausaPorOculta) {
    pausaPorOculta = false;
    escena.reiniciarPistas();
    video.play().catch(() => {});
  }
});
window.addEventListener('pagehide', () => guardarAhora());

if (typeof ResizeObserver === 'function') new ResizeObserver(() => pintarEscena()).observe(escenario);

// ── ajustes ─────────────────────────────────────────────────────────────────
const CAMPOS = [
  ['aforo-max', 'aforoMax', LIMITES.aforoMax],
  ['fila-max', 'filaMax', LIMITES.filaMax],
  ['fila-segundos', 'filaSegundos', LIMITES.filaSegundos],
];
for (const [id, clave, [min, max]] of CAMPOS) {
  const input = $(id);
  const error = $('error-' + id);
  const validar = (aplicar) => {
    const v = input.value.trim();
    const n = Number(v);
    const valido = v !== '' && Number.isInteger(n) && n >= min && n <= max;
    input.setAttribute('aria-invalid', String(!valido));
    error.hidden = valido;
    if (!valido) {
      error.textContent = `Escribe un número entero entre ${min} y ${numero(max)}.`;
      return;
    }
    if (aplicar && config()[clave] !== n) aplicarConfig({ ...config(), [clave]: n });
  };
  // Mientras se escribe solo se valida: al teclear «12», el aforo no pasa por 1 (y no salta un «Aforo completo»
  // falso). Se aplica al confirmar: Enter, salir del campo o las flechitas del campo.
  input.addEventListener('input', () => validar(false));
  input.addEventListener('change', () => validar(true));
  input.addEventListener('blur', () => {
    if (input.getAttribute('aria-invalid') === 'true') return;
    input.value = String(config()[clave]);
  });
}

$('ajustes').addEventListener('submit', (e) => e.preventDefault());

$('invertir').addEventListener('click', () => {
  const cfg = config();
  aplicarConfig({ ...cfg, sentido: cfg.sentido === 1 ? -1 : 1 });
  anunciar(`Ahora la entrada es cruzar ${textoSentido(config().linea, config().sentido, ancho / alto)}.`);
});

const PREFS = [
  ['ver-calor', 'verCalor'],
  ['ver-cajas', 'verCajas'],
];
for (const r of document.querySelectorAll('input[name="pixelado"]')) {
  r.addEventListener('change', () => {
    if (!r.checked) return;
    estado.preferencias.pixelado = r.value;
    pintarEscena();
    guardar();
  });
}
for (const [id, clave] of PREFS) {
  $(id).addEventListener('change', () => {
    estado.preferencias[clave] = $(id).checked;
    $('leyenda-calor').hidden = !estado.preferencias.verCalor;
    pintarEscena();
    guardar();
  });
}

$('csv').addEventListener('click', () => {
  const datos = escena.intervalos.todos();
  if (!datos.length) return;
  const contenido = csvDeIntervalos(datos, { fuente: NOMBRE[fuente] });
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `conteo-${fuente}-${escena.fecha || fechaLocal(Date.now())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

let deshacerAccion = null;
let temporizadorDeshacer = null;
function ofrecerDeshacer(textoAviso, accion) {
  deshacerAccion = accion;
  $('deshacer-texto').textContent = textoAviso;
  $('deshacer-bloque').hidden = false;
  clearTimeout(temporizadorDeshacer);
  temporizadorDeshacer = setTimeout(() => {
    $('deshacer-bloque').hidden = true;
    deshacerAccion = null;
  }, 12000);
}
$('deshacer').addEventListener('click', () => {
  if (deshacerAccion) deshacerAccion();
  deshacerAccion = null;
  $('deshacer-bloque').hidden = true;
});

function reconstruirEscena() {
  ponerEscena(fuente, fase === 'encendida' ? ancho : 960, fase === 'encendida' ? alto : 540);
  if (fase === 'encendida') vista.actualizarCalor(escena.calor);
  refrescarTodo();
  guardar();
}

$('reiniciar').addEventListener('click', () => {
  sincronizarConteo();
  const antes = JSON.parse(JSON.stringify(estado.fuentes[fuente].conteo));
  const f = fuente;
  estado.fuentes[f].conteo = conteoVacio(fechaLocal(Date.now()));
  reconstruirEscena();
  ofrecerDeshacer(`Pusiste en cero el conteo de hoy ${CON[f]}.`, () => {
    if (fuente !== f) return;
    estado.fuentes[f].conteo = antes;
    reconstruirEscena();
  });
});

$('restablecer').addEventListener('click', () => {
  sincronizarConteo();
  const antes = JSON.parse(JSON.stringify(estado));
  const firma = estado.fuentes.archivo.firma;
  estado = estadoPorDefecto(fechaLocal(Date.now()));
  estado.fuentes.archivo.firma = firma;
  borrador = modo === 'zona' && !config().zona ? [] : null;
  reconstruirEscena();
  pintarPreferencias();
  ofrecerDeshacer('Volviste a los datos de ejemplo: línea, zona, umbrales y conteos.', () => {
    estado = antes;
    reconstruirEscena();
    pintarPreferencias();
  });
});

function pintarPreferencias() {
  const r = document.querySelector(`input[name="pixelado"][value="${estado.preferencias.pixelado}"]`);
  if (r) r.checked = true;
  $('ver-calor').checked = estado.preferencias.verCalor;
  $('ver-cajas').checked = estado.preferencias.verCajas;
  $('leyenda-calor').hidden = !estado.preferencias.verCalor;
}

function pintarTextosAjustes() {
  const cfg = config();
  for (const [id, clave] of CAMPOS) {
    const input = $(id);
    if (document.activeElement !== input) {
      input.value = String(cfg[clave]);
      input.setAttribute('aria-invalid', 'false');
      $('error-' + id).hidden = true;
    }
  }
  $('regla-fila').textContent = cfg.zona ? textoReglaFila(cfg.filaMax, cfg.filaSegundos) : 'Sin zona de fila dibujada: no hay aviso de fila.';
  $('sentido-texto').textContent = `cruzar la línea ${textoSentido(cfg.linea, cfg.sentido, ancho / alto)}`;
  $('ajustes-titulo').textContent = TITULO_AJUSTES[fuente];
  $('nota-camara').hidden = fuente !== 'camara';
}

function refrescarTodo() {
  $('cifras-fuente').textContent = CON[fuente];
  $('encender-previa').textContent = `Encender ${CON[fuente]}`;
  pintarCifras(escena.cifras());
  pintarMinutos();
  pintarBitacora();
  pintarTextosAjustes();
  pintarPreferencias();
  if (fase === 'encendida') {
    vista.actualizarCalor(escena.calor);
    pintarLeyendaCalor();
  }
  actualizarHerramientas();
  pintarEscena();
}

// ── arranque de la página ───────────────────────────────────────────────────
{
  const marcada = document.querySelector('input[name="fuente"]:checked');
  fuente = marcada ? marcada.value : 'muestra';
  ponerEscena(fuente, 960, 540);
  $('bloque-archivo').hidden = fuente !== 'archivo';
  ponerFase('apagada');
  refrescarTodo();
}

// ── otras pestañas ──────────────────────────────────────────────────────────
// Si otra pestaña guarda, esta adopta lo guardado: así, cuando esta guarde, no pisa el conteo ni los ajustes de la
// otra con su copia vieja. Lo único que no adopta es la fuente que esta misma pestaña está analizando.
window.addEventListener('storage', (e) => {
  if (e.key !== CLAVE_ALMACEN || typeof e.newValue !== 'string') return;
  const nuevo = leerEstado(e.newValue, fechaLocal(Date.now()));
  const ocupada = fase === 'encendida' || fase === 'cargando' ? fuente : null;
  if (ocupada) {
    sincronizarConteo();
    nuevo.fuentes[ocupada] = estado.fuentes[ocupada];
  }
  estado = nuevo;
  if (ocupada) {
    pintarPreferencias();
    pintarEscena();
    return;
  }
  ponerEscena(fuente, 960, 540);
  refrescarTodo();
});

// ── cambio de día con la demo apagada ───────────────────────────────────────
// Encendida, procesar() pone en cero la fuente que se analiza. Este reloj se ocupa del resto: el panel no sigue
// mostrando las cifras de ayer, ni las demás fuentes arrastran su conteo al día nuevo.
let diaVisto = fechaLocal(Date.now());
setInterval(() => {
  const hoy = fechaLocal(Date.now());
  if (hoy === diaVisto) return;
  diaVisto = hoy;
  const ocupada = fase === 'encendida' ? fuente : null;
  if (ocupada) sincronizarConteo();
  const nuevo = leerEstado(escribirEstado(estado), hoy);
  if (ocupada) nuevo.fuentes[ocupada] = estado.fuentes[ocupada];
  estado = nuevo;
  if (!ocupada) {
    ponerEscena(fuente, 960, 540);
    refrescarTodo();
    anunciar('Empezó un día nuevo: el conteo volvió a cero.');
  }
  guardar();
}, 20_000);

// Para las pruebas de navegador: un vistazo de solo lectura al estado (no cambia nada).
window.__camara = {
  get fase() {
    return fase;
  },
  get cifras() {
    return escena.cifras();
  },
  get pistas() {
    return escena.pistas;
  },
  get fps() {
    return fpsActual();
  },
  get delegado() {
    return detector && detector.delegado;
  },
  get enWorker() {
    return detector && detector.enWorker;
  },
  get config() {
    return config();
  },
  get calorTotal() {
    return escena.calor.total;
  },
  get velocidad() {
    return video.playbackRate;
  },
};
