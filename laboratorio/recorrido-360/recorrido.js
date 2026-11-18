import { ESCENAS, PRIMERA, configuracionPannellum } from './escenas.mjs';

const contenedor = document.getElementById('panorama');
const botonEntrar = document.getElementById('entrar');
const estado = document.getElementById('estado');
const lista = document.getElementById('ambientes');
let visor = null;

// Créditos y lista de ambientes: salen de los mismos datos que el visor.
document.getElementById('creditos').replaceChildren(
  ...Object.values(ESCENAS).map((e) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = e.fuente;
    a.textContent = e.nombre;
    li.append(a, ` · foto de ${e.autor}, Poly Haven, CC0`);
    return li;
  }),
);

function marcarActual(id) {
  for (const b of lista.querySelectorAll('button')) b.setAttribute('aria-current', String(b.dataset.escena === id));
}

lista.replaceChildren(
  ...Object.entries(ESCENAS).map(([id, e]) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ambiente';
    b.dataset.escena = id;
    b.textContent = e.nombre;
    b.setAttribute('aria-current', String(id === PRIMERA));
    b.addEventListener('click', () => {
      if (!visor) entrar(id);
      else visor.loadScene(id);
    });
    li.append(b);
    return li;
  }),
);

const TEXTOS = {
  loadButtonLabel: 'Entrar al recorrido',
  loadingLabel: 'Cargando la foto…',
  bylineLabel: 'por %s',
  noPanoramaError: 'No se encontró la foto de este ambiente.',
  fileAccessError: 'No se pudo abrir la foto %s.',
  malformedURLError: 'La dirección de la foto está mal escrita.',
  iOS8WebGLError: 'Este navegador no puede mostrar fotos 360. Prueba con otro navegador o actualiza el teléfono.',
  genericWebGLError: 'Tu navegador no puede mostrar fotos 360 (necesita WebGL). Prueba con Chrome, Safari o Firefox actualizados.',
  textureSizeError: 'La foto es más grande de lo que tu equipo puede mostrar.',
  unknownError: 'No se pudo mostrar el recorrido. Recarga la página para intentarlo de nuevo.',
};

function entrar(escena = PRIMERA) {
  if (visor) return;
  if (typeof window.pannellum === 'undefined') {
    estado.textContent = 'El visor no terminó de descargarse. Revisa tu conexión y vuelve a tocar «Entrar al recorrido».';
    return;
  }
  botonEntrar.disabled = true;
  estado.textContent = 'Cargando la foto de la sala…';
  const config = configuracionPannellum();
  config.default.firstScene = escena;
  Object.assign(config.default, {
    autoLoad: true,
    showControls: true,
    compass: false,
    mouseZoom: true,
    keyboardZoom: true,
    strings: TEXTOS,
    hfov: 100,
    minHfov: 50,
    maxHfov: 120,
  });
  contenedor.querySelector('.visor__previa')?.remove();
  botonEntrar.remove();
  visor = window.pannellum.viewer(contenedor, config);
  visor.on('load', () => {
    const id = visor.getScene();
    estado.textContent = `Estás en: ${ESCENAS[id].nombre}.`;
    marcarActual(id);
  });
  visor.on('scenechange', (id) => marcarActual(id));
  visor.on('error', (msg) => {
    estado.textContent = `No se pudo mostrar el recorrido: ${msg}`;
  });
}

botonEntrar.addEventListener('click', () => entrar());
