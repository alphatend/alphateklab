// Entrada de la página: pestañas, precarga del visor cuando la demo entra en pantalla, botones «Ir» de la tabla
// y el editor (que se descarga la primera vez que se abre su pestaña).

import { construirModelo } from './nucleo/plano.mjs';
import { crearRecorrido, precargar } from './recorrido.mjs';

const $ = (id) => document.getElementById(id);
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// La cabecera es fija (sticky): lo que se trae a la vista (scrollIntoView, el foco con Tab, «Saltar al contenido»)
// tiene que quedar debajo de ella, no tapado. Su alto cambia con el tamaño de letra, así que se mide y el CSS lo usa en
// scroll-padding-top.
const cabecera = document.querySelector('.cabecera');
if (cabecera && 'ResizeObserver' in window) {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--alto-cabecera', `${Math.ceil(cabecera.getBoundingClientRect().height)}px`);
  }).observe(cabecera);
}
/** Trae el panel del recorrido a la vista, debajo de la cabecera (con el aviso del plano propio, si lo hay). */
const mostrarRecorrido = () => $('panel-recorrido').scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });

const anuncio = $('anuncio');
function anunciar(texto) {
  anuncio.textContent = '';
  setTimeout(() => { anuncio.textContent = texto; }, 60);
}

let modeloEjemplo = null;
try {
  modeloEjemplo = construirModelo(JSON.parse($('datos-plano').textContent));
} catch {
  const est = $('estado-visor');
  est.hidden = false;
  $('visor').dataset.estado = 'error';
  $('estado-texto').textContent = 'No se pudo leer el plano de ejemplo de esta página. Recárgala; si sigue igual, el plano y la tabla de abajo siguen disponibles.';
  $('entrada').hidden = true;
}

const recorrido = modeloEjemplo
  ? crearRecorrido({
    modeloEjemplo,
    anunciar,
    alVolverAlEditor: () => activarPestana('editor', { foco: true }),
    // «Ver los cambios en 3D» (cuando el plano dibujado cambió después de abrirlo): se vuelve a armar con el editor.
    alPedirActualizar: async () => {
      const ed = await cargarEditor();
      const r = ed?.modeloParaVer() ?? { error: 'No se pudo cargar el editor. Recarga la página.' };
      if (!r.error) await recorrido.cargarPlano(r.modelo, { propio: true, nombre: r.nombre, aviso: r.aviso, firma: r.firma });
      return r;
    },
  })
  : null;

// ── entrar ──
$('entrar').addEventListener('click', () => {
  recorrido?.entrar();
  // en el teléfono y en pantallas bajas, la escena y su barra quedan a la vista al entrar
  $('visor').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});

// Precarga de three.js cuando la demo entra en pantalla (no con «ahorro de datos»).
const ahorro = Boolean(navigator.connection?.saveData);
if (recorrido && !ahorro && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entradas) => {
    if (!entradas.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const ir = () => precargar().catch(() => { /* se reintenta al tocar «Entrar» */ });
    if ('requestIdleCallback' in window) requestIdleCallback(ir, { timeout: 2500 });
    else setTimeout(ir, 1200);
  }, { rootMargin: '200px' });
  io.observe($('escena'));
}

// ── pestañas ──
const pestanas = {
  recorrido: { tab: $('pestana-recorrido'), panel: $('panel-recorrido') },
  editor: { tab: $('pestana-editor'), panel: $('panel-editor') },
};
const orden = ['recorrido', 'editor'];
let activa = 'recorrido';

function activarPestana(clave, { foco = false } = {}) {
  activa = clave;
  for (const [k, { tab, panel }] of Object.entries(pestanas)) {
    const si = k === clave;
    tab.setAttribute('aria-selected', String(si));
    tab.tabIndex = si ? 0 : -1;
    panel.hidden = !si;
  }
  if (foco) pestanas[clave].tab.focus();
  recorrido?.pausar(clave !== 'recorrido');
  if (clave === 'editor') cargarEditor();
}

for (const clave of orden) {
  pestanas[clave].tab.addEventListener('click', () => activarPestana(clave));
  pestanas[clave].tab.addEventListener('keydown', (e) => {
    const i = orden.indexOf(clave);
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % orden.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + orden.length) % orden.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = orden.length - 1;
    if (j == null) return;
    e.preventDefault();
    activarPestana(orden[j], { foco: true });
  });
}

// ── editor (se descarga al abrir su pestaña) ──
let editor = null;
let cargandoEditor = null;
async function cargarEditor() {
  if (editor) return editor;
  cargandoEditor ??= import('./editor.mjs').then((m) =>
    m.crearEditor({
      anunciar,
      alVerEn3D: async ({ modelo, nombre, aviso, firma }) => {
        activarPestana('recorrido');
        mostrarRecorrido();
        await recorrido?.cargarPlano(modelo, { propio: true, nombre, aviso, firma });
      },
      // Cada cambio del dibujo: si el 3D muestra una versión anterior, su aviso lo dice.
      alCambiar: (firma) => recorrido?.planCambiado(firma),
    }),
  );
  try {
    editor = await cargandoEditor;
  } catch {
    cargandoEditor = null;
    $('editor-mensaje').textContent = 'No se pudo cargar el editor. Recarga la página para intentarlo de nuevo.';
    $('editor-mensaje').className = 'editor__mensaje es-error';
  }
  return editor;
}

// ── botones «Ir» de la tabla de ambientes ──
for (const b of document.querySelectorAll('[data-ir]')) {
  if (!recorrido) break;
  b.hidden = false;
  b.addEventListener('click', async () => {
    activarPestana('recorrido');
    mostrarRecorrido();
    await recorrido.irAAmbienteDelEjemplo(b.dataset.ir);
  });
}

if (location.hash === '#dibuja') activarPestana('editor');

// Gancho de pruebas automáticas (Playwright): solo con ?prueba=1 en la dirección.
if (new URLSearchParams(location.search).has('prueba')) {
  window.recorrido3d = { recorrido, visor: () => recorrido?._visor(), modeloEjemplo, editor: () => editor, activarPestana, get activa() { return activa; } };
}
