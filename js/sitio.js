// Comportamiento común a todas las páginas: menú, buscador, «Pregúntanos» y la lista de la cotización.
import { buscar, esDudosa, mensajePregunta, resaltar, normalizar, fichas, cargarIndice as descargarIndice } from './buscador.mjs';
import { enlaceWhatsApp } from './nucleo.mjs';
import { leerCotizacion, guardarCotizacion, alternarEnCotizacion, agregarVarios } from './cotizacion.mjs';

const RAIZ = document.documentElement.dataset.raiz || './';
const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── menú con paneles ──
const grupos = [...document.querySelectorAll('.menu__grupo')];
// Espera de abrir o cerrar al pasar el ratón, por grupo. Un clic o Escape la cancelan: si no, un clic seguido de
// Escape en menos de 120 ms dejaba que la espera volviera a abrir el panel.
const esperas = new WeakMap();
const cancelarEspera = (g) => clearTimeout(esperas.get(g));
function cerrarMenus(excepto) {
  for (const g of grupos) {
    const b = g.querySelector('.menu__boton');
    if (b === excepto) continue;
    cancelarEspera(g);
    const panel = g.querySelector('.mega');
    // si en su lugar se abre otro panel, este se va sin salida para que los dos no se crucen
    panel.classList.toggle('mega--sin-salida', Boolean(excepto));
    b.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    g.dataset.abierto = '';
  }
}
for (const g of grupos) {
  const b = g.querySelector('.menu__boton');
  const panel = g.querySelector('.mega');
  b.addEventListener('click', () => {
    cancelarEspera(g);
    const abierto = b.getAttribute('aria-expanded') === 'true';
    // Abierto por pasar el ratón: el clic lo deja fijo (lo que la persona quería era abrirlo), no lo cierra.
    if (abierto && g.dataset.abierto === 'hover') {
      g.dataset.abierto = 'clic';
      return;
    }
    const habiaOtro = grupos.some((x) => x !== g && x.querySelector('.menu__boton').getAttribute('aria-expanded') === 'true');
    cerrarMenus(b);
    b.setAttribute('aria-expanded', String(!abierto));
    panel.classList.toggle('mega--directo', habiaOtro); // de un panel a otro, sin repetir la entrada
    panel.classList.remove('mega--sin-salida');
    panel.hidden = abierto;
    g.dataset.abierto = abierto ? '' : 'clic';
  });
  // con mouse, se abre al pasar por encima (con una pequeña espera para no abrirlo al cruzar)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    g.addEventListener('mouseenter', () => {
      cancelarEspera(g);
      esperas.set(g, setTimeout(() => {
        if (b.getAttribute('aria-expanded') === 'true') return;
        panel.classList.toggle('mega--directo', grupos.some((x) => x !== g && x.querySelector('.menu__boton').getAttribute('aria-expanded') === 'true'));
        cerrarMenus(b);
        b.setAttribute('aria-expanded', 'true');
        panel.hidden = false;
        g.dataset.abierto = 'hover';
      }, 120));
    });
    g.addEventListener('mouseleave', () => {
      cancelarEspera(g);
      esperas.set(g, setTimeout(() => {
        if (g.dataset.abierto === 'clic') return; // fijado con clic: se cierra con Escape, con clic fuera o al salir con Tab
        b.setAttribute('aria-expanded', 'false');
        panel.classList.remove('mega--sin-salida');
        panel.hidden = true;
        g.dataset.abierto = '';
      }, 180));
    });
  }
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu__grupo')) cerrarMenus();
});
for (const g of grupos) {
  g.addEventListener('focusout', (e) => {
    if (!g.contains(e.relatedTarget)) {
      g.querySelector('.menu__boton').setAttribute('aria-expanded', 'false');
      g.querySelector('.mega').classList.remove('mega--sin-salida');
      g.querySelector('.mega').hidden = true;
    }
  });
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && g.querySelector('.menu__boton').getAttribute('aria-expanded') === 'true') {
      e.stopPropagation();
      cancelarEspera(g);
      cerrarMenus();
      g.querySelector('.menu__boton').focus();
    }
  });
}

// menú del teléfono
const hamburguesa = document.querySelector('[data-hamburguesa]');
const menuMovil = document.getElementById('menu-movil');
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && hamburguesa?.getAttribute('aria-expanded') === 'true') {
    hamburguesa.click();
    hamburguesa.focus();
  }
});
hamburguesa?.addEventListener('click', () => {
  const abrir = hamburguesa.getAttribute('aria-expanded') !== 'true';
  hamburguesa.setAttribute('aria-expanded', String(abrir));
  hamburguesa.setAttribute('aria-label', abrir ? 'Cerrar el menú' : 'Abrir el menú');
  menuMovil.hidden = !abrir;
  document.body.classList.toggle('menu-abierto', abrir);
  // con el menú abierto, la página de atrás no recibe el foco del teclado ni los toques
  for (const el of document.querySelectorAll('main, footer')) el.inert = abrir;
});
// un enlace del menú (también los que van a una sección de la misma página) lo cierra
menuMovil?.addEventListener('click', (e) => {
  if (e.target.closest('a') && hamburguesa.getAttribute('aria-expanded') === 'true') hamburguesa.click();
});
// Con el menú abierto lo único que se ve es la cabecera: Tab da la vuelta dentro de ella. Antes, después del último
// enlace el foco se iba a la barra del navegador (la revisión lo vio salir 2 de 30 veces).
const cabeceraEl = document.querySelector('[data-cabecera]');
cabeceraEl?.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || hamburguesa?.getAttribute('aria-expanded') !== 'true') return;
  // solo lo que se ve: el menú grande está oculto en el teléfono y lo de un grupo cerrado no se dibuja
  const visibles = [...cabeceraEl.querySelectorAll('a[href], button:not([disabled]), summary, input:not([disabled])')].filter((el) => el.getClientRects().length > 0);
  const primero = visibles[0];
  const ultimo = visibles.at(-1);
  if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault();
    primero.focus();
  } else if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault();
    ultimo.focus();
  }
});

// ── buscador ──
let indice = null;
async function cargarIndice() {
  indice ??= await descargarIndice(`${RAIZ}assets/indice.json?v=${document.documentElement.dataset.indice || ''}`);
  return indice;
}

const ETIQUETA = { servicio: 'Servicio', solucion: 'Para tu negocio', demo: 'Demo', guia: 'Guía' };
const SUGERENCIAS = ['pedir desde la mesa', 'recordar citas', 'página web', 'inventario', 'chatbot de WhatsApp', 'factura electrónica', 'cobrar con Yappy', 'tienda en línea', 'app para mi negocio', 'software a medida'];
const url = (u) => (/^https?:/.test(u) ? u : RAIZ + u);
const contacto = () => document.documentElement.dataset.whatsapp || null;

// Pinta un texto con lo que coincide con la búsqueda dentro de <mark>, sin pasar por innerHTML.
function pintarResaltado(el, texto, consulta) {
  el.replaceChildren(...resaltar(texto, consulta).map(({ t, m }) => (m ? Object.assign(document.createElement('mark'), { textContent: t }) : document.createTextNode(t))));
}

function itemResultado(r, i, consulta = '') {
  const li = document.createElement('li');
  li.setAttribute('role', 'option');
  li.setAttribute('aria-selected', 'false');
  li.id = `res-${r.id}-${i}`;
  li.className = 'resultado';
  // a la ficha de un servicio va la frase buscada, para que «Preguntar por este servicio» la lleve a «Pregúntanos»
  const u = url(r.url);
  li.dataset.url = r.tipo === 'servicio' && consulta ? `${u}${u.includes('?') ? '&' : '?'}q=${encodeURIComponent(consulta)}` : u;
  li.innerHTML = `<div class="resultado__fila"><svg class="ico" aria-hidden="true"><use href="#i-${r.icono}"></use></svg><span class="resultado__texto"><strong></strong><small></small></span><span class="resultado__tipo"></span><kbd class="resultado__enter" aria-hidden="true">↵</kbd></div>`;
  pintarResaltado(li.querySelector('strong'), r.titulo, consulta);
  pintarResaltado(li.querySelector('small'), r.resumen, consulta);
  li.querySelector('.resultado__tipo').textContent = r.tipo === 'servicio' ? (r.precio ? r.precio : r.etiqueta) : ETIQUETA[r.tipo];
  return li;
}

// En toda lista va la salida para preguntar: lo que hay puede no ser lo que se busca. Con una frase dudosa (ver
// esDudosa) va primero y dice que eso no está descrito así.
function itemPreguntar(consulta, i, { dudosa = false, arriba = false } = {}) {
  const li = document.createElement('li');
  li.setAttribute('role', 'option');
  li.setAttribute('aria-selected', 'false');
  li.id = `res-preguntar-${i}`;
  li.className = `resultado resultado--preguntar${dudosa ? ' resultado--dudosa' : ''}`;
  li.dataset.url = `${RAIZ}#pregunta`;
  li.innerHTML = `<div class="resultado__fila"><svg class="ico" aria-hidden="true"><use href="#i-chat-circle-dots"></use></svg><span class="resultado__texto"><strong></strong><small></small></span><kbd class="resultado__enter" aria-hidden="true">↵</kbd></div>`;
  // arriba de los resultados («¿No es esto?» antes de verlos no se entiende) o al final de la lista
  li.querySelector('strong').textContent = dudosa ? `No lo tenemos descrito así: pregúntanos por «${consulta}»` : arriba ? `Pregúntanos por «${consulta}»` : `¿No es esto? Pregúntanos por «${consulta}»`;
  li.querySelector('small').textContent = dudosa ? 'Lo hacemos a la medida. Debajo, lo más parecido que ya tenemos.' : arriba ? 'Si no está abajo, te decimos si lo podemos hacer.' : 'Te respondemos si lo podemos hacer.';
  return li;
}

// En una pantalla táctil, con el teclado abierto, solo se ve la parte de arriba del diálogo: ahí va la salida para
// preguntar, con 4 resultados como mucho (la revisión del 3-oct la vio debajo del teclado, en y=624 a 717).
const tactil = () => matchMedia('(pointer: coarse)').matches;
function filasResultados(res, q, { dudosa = false } = {}) {
  if (!res.length) return [];
  if (dudosa) return [itemPreguntar(q, 0, { dudosa: true }), ...res.slice(0, 3).map((r, i) => itemResultado(r, i + 1, q))];
  if (tactil()) return [itemPreguntar(q, 0, { arriba: true }), ...res.slice(0, 4).map((r, i) => itemResultado(r, i + 1, q))];
  return [...res.map((r, i) => itemResultado(r, i, q)), itemPreguntar(q, res.length)];
}

// Sin resultados con la frase entera: lo más parecido por cada palabra suelta, para que la persona vea qué hay cerca.
// Lo más parecido que hacemos cuando no hay resultados fuertes: primero lo que la frase entera alcanza con el mínimo
// bajo (entre 3 y el mínimo de frase), y si no hay nada, palabra por palabra.
function parecidos(consulta) {
  if (!indice) return [];
  // sin las palabras de dos sentidos («contador», «caja»): si no queda nada, no hay nada parecido que ofrecer
  const sinAmbiguas = consulta.split(/\s+/).filter((w) => !indice.ambiguas?.has(normalizar(w))).join(' ');
  if (!fichas(sinAmbiguas, indice.vacias).length) return [];
  const debiles = buscar(indice, sinAmbiguas, { limite: 3, minimo: 3 }).filter((r) => r.tipo === 'servicio');
  if (debiles.length) return debiles;
  const vistos = new Set();
  const salida = [];
  for (const palabra of sinAmbiguas.split(/\s+/).filter((x) => x.length > 3)) {
    for (const r of buscar(indice, palabra, { limite: 2 })) {
      if (r.tipo !== 'servicio' || vistos.has(r.id)) continue;
      vistos.add(r.id);
      salida.push(r);
    }
  }
  return salida.slice(0, 3);
}

function bloqueVacio(consulta) {
  const div = document.createElement('div');
  div.className = 'sin-resultados';
  const enlaceWa = enlaceWhatsApp(mensajePregunta(consulta), contacto());
  div.innerHTML = `<p class="sin-resultados__titulo">No encontramos «<span></span>» en la lista.</p><p>Puede que igual lo hagamos: la lista es lo que ya tenemos descrito, no todo lo que podemos hacer. Eso sí, hacemos solo software: no vendemos ni instalamos equipos. Pregúntanos tal como lo escribiste.</p><p class="sin-resultados__acciones"><a class="boton boton--senal" target="_blank" rel="noopener"><svg class="ico" aria-hidden="true"><use href="#i-whatsapp-logo"></use></svg>Preguntar por WhatsApp</a><a class="boton boton--linea">Escribir más detalles</a></p>`;
  div.querySelector('span').textContent = consulta;
  const [wa, mas] = div.querySelectorAll('a');
  wa.href = enlaceWa;
  mas.href = `${RAIZ}#pregunta`;
  const cerca = parecidos(consulta);
  if (cerca.length) {
    const p = Object.assign(document.createElement('p'), { className: 'sin-resultados__cerca' });
    p.append('Lo más parecido que hacemos: ');
    cerca.forEach((r, i) => {
      if (i) p.append(', ');
      p.append(Object.assign(document.createElement('a'), { href: url(r.url), textContent: r.titulo }));
    });
    p.append('.');
    div.append(p);
  }
  return div;
}

// Se llegó a la ficha desde el buscador (?q=): «Preguntar por este servicio» lleva esa frase a «Pregúntanos».
{
  const q = new URLSearchParams(location.search).get('q');
  if (q) {
    for (const a of document.querySelectorAll('a[data-lleva-q]')) {
      const destino = new URL(a.href, location.href);
      destino.searchParams.set('q', q);
      a.href = destino.href;
    }
  }
}

// El alto que deja el teclado del teléfono (visualViewport): el diálogo del buscador no pasa de ahí (--vv-alto en CSS).
if (window.visualViewport) {
  const vv = window.visualViewport;
  const ponerAlto = () => document.documentElement.style.setProperty('--vv-alto', `${Math.round(vv.height)}px`);
  vv.addEventListener('resize', ponerAlto);
  vv.addEventListener('scroll', ponerAlto);
  ponerAlto();
}

// Conecta un campo de búsqueda con su lista de resultados (sirve para el diálogo y para el de la portada).
// Sin opción marcada, Enter lleva a la lista completa (si hubo resultados) o a preguntar (si no).
function conectarBusqueda({ campo, lista, vacio, sugerencias, estado, alElegir }) {
  let activo = -1;
  let ultimo = '';
  let hubo = 0;
  let esperaVacio;
  let esperaDudosa;
  const items = () => [...lista.querySelectorAll('[role="option"]')];
  function marcar(i) {
    const xs = items();
    activo = xs.length && i >= 0 ? i % xs.length : xs.length && i < -1 ? xs.length - 1 : -1;
    xs.forEach((x, j) => x.setAttribute('aria-selected', String(j === activo)));
    if (activo >= 0) {
      campo.setAttribute('aria-activedescendant', xs[activo].id);
      xs[activo].scrollIntoView({ block: 'nearest' });
    } else campo.removeAttribute('aria-activedescendant');
  }
  function ir(u) {
    alElegir?.();
    location.href = u;
  }
  lista.addEventListener('click', (e) => {
    const li = e.target.closest('[role="option"]');
    if (li) ir(li.dataset.url);
  });
  // El foco se queda en el campo al hacer clic en un resultado (si no, el desplegable se cierra antes del clic).
  lista.addEventListener('mousedown', (e) => e.preventDefault());
  // Con el ratón, la fila bajo el puntero es la elegida: un solo resaltado, el mismo que usan las flechas.
  lista.addEventListener('mousemove', (e) => {
    const li = e.target.closest('[role="option"]');
    if (!li) return;
    const i = items().indexOf(li);
    if (i !== activo) marcar(i);
  });
  async function actualizar() {
    const q = campo.value.trim();
    ultimo = q;
    if (!q) {
      lista.replaceChildren();
      hubo = 0;
      if (vacio) vacio.hidden = true;
      if (sugerencias) sugerencias.hidden = false;
      if (estado) estado.textContent = '';
      campo.setAttribute('aria-expanded', 'false');
      marcar(-1);
      return;
    }
    let idx;
    // si el índice tarda (datos lentos), «Cargando el buscador…» a los 150 ms en vez de nada
    const cargando = indice
      ? null
      : setTimeout(() => {
          if (campo.value.trim() !== q) return;
          if (sugerencias) sugerencias.hidden = true;
          lista.setAttribute('aria-busy', 'true');
          const li = Object.assign(document.createElement('li'), { className: 'buscador__cargando', textContent: 'Cargando el buscador…' });
          li.setAttribute('role', 'presentation');
          lista.replaceChildren(li);
        }, 150);
    try {
      idx = await cargarIndice();
    } catch {
      clearTimeout(cargando);
      lista.removeAttribute('aria-busy');
      lista.replaceChildren();
      if (sugerencias) sugerencias.hidden = true;
      if (vacio) {
        vacio.hidden = false;
        const bloque = bloqueVacio(q);
        bloque.querySelector('.sin-resultados__titulo').textContent = 'No se pudo cargar el buscador.';
        bloque.querySelector('.sin-resultados__titulo + p').textContent = 'Revisa tu conexión, usa la lista de servicios o pregúntanos tal como lo escribiste.';
        vacio.replaceChildren(bloque);
      }
      return;
    }
    clearTimeout(cargando);
    lista.removeAttribute('aria-busy');
    lista.querySelector('.buscador__cargando')?.remove();
    if (q !== ultimo) return;
    // Mientras se escribe, la última palabra cuenta como comienzo de palabra («fact» encuentra la factura electrónica).
    const res = buscar(idx, q, { limite: 8, prefijo: true });
    const dudosa = esDudosa(idx, q);
    hubo = dudosa ? 0 : res.length; // con una frase dudosa, Enter lleva a preguntar y no a la lista
    clearTimeout(esperaVacio);
    clearTimeout(esperaDudosa);
    // Mientras se escribe una frase, una tecla que deja cero resultados no vacía la lista: los de antes quedan atenuados
    // hasta que lleguen otros o pasen 300 ms sin teclear. Antes la lista se encogía y crecía con cada tecla (la revisión
    // de interacción contó de 8 a 14 saltos de alto en una frase).
    if (!res.length && lista.querySelector('[role="option"]') && q.replace(/\s/g, '').length >= 3) {
      lista.classList.add('buscador__resultados--viejos');
      esperaVacio = setTimeout(() => {
        if (campo.value.trim() !== q) return;
        lista.classList.remove('buscador__resultados--viejos');
        lista.replaceChildren();
        campo.setAttribute('aria-expanded', 'false');
        marcar(-1);
        if (sugerencias) sugerencias.hidden = true;
        if (vacio) { vacio.hidden = false; vacio.replaceChildren(bloqueVacio(q)); }
        if (estado) estado.textContent = `Sin resultados para «${q}». Puedes preguntarnos.`;
      }, 300);
      return;
    }
    lista.classList.remove('buscador__resultados--viejos');
    lista.replaceChildren(...filasResultados(res, q));
    campo.setAttribute('aria-expanded', String(res.length > 0));
    marcar(-1);
    if (res.length) {
      if (sugerencias) sugerencias.hidden = true;
      if (vacio) { vacio.hidden = true; vacio.replaceChildren(); }
      if (estado) estado.textContent = `${res.length} ${res.length === 1 ? 'resultado' : 'resultados'}. Usa las flechas para elegir.`;
      // «No lo tenemos descrito así» llega cuando se deja de escribir 300 ms, como «No encontramos»: si cambiara la
      // vista con cada tecla, el desplegable saltaría de alto mientras se escribe la frase
      if (dudosa) {
        esperaDudosa = setTimeout(() => {
          if (campo.value.trim() !== q) return;
          lista.replaceChildren(...filasResultados(res, q, { dudosa: true }));
          marcar(-1);
          if (estado) estado.textContent = 'No lo tenemos descrito así. Primero, la opción de preguntarnos; después, lo más parecido. Usa las flechas para elegir.';
        }, 300);
      }
      return;
    }
    // Sin resultados: no se dice «No encontramos» a media palabra. Con menos de 3 letras siguen las sugerencias;
    // con 3 o más, el aviso sale tras 300 ms sin teclear.
    if (vacio) { vacio.hidden = true; vacio.replaceChildren(); }
    if (q.replace(/\s/g, '').length < 3) {
      if (sugerencias) sugerencias.hidden = false;
      return;
    }
    esperaVacio = setTimeout(() => {
      if (campo.value.trim() !== q) return;
      if (sugerencias) sugerencias.hidden = true;
      if (vacio) { vacio.hidden = false; vacio.replaceChildren(bloqueVacio(q)); }
      if (estado) estado.textContent = `Sin resultados para «${q}». Puedes preguntarnos.`;
    }, 300);
  }
  // Enter (o «Buscar») sin una opción elegida: la lista completa si hubo resultados, preguntar si no.
  async function enviar() {
    const q = campo.value.trim();
    if (!q) return;
    const li = items()[activo];
    if (li) return ir(li.dataset.url);
    if (q !== ultimo) await actualizar();
    ir(hubo ? `${RAIZ}servicios.html` : `${RAIZ}#pregunta`);
  }
  campo.addEventListener('input', actualizar);
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); marcar(activo + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(activo < 0 ? -2 : activo - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      enviar();
    }
  });
  return { actualizar, enviar };
}

let abrirBuscador = null; // la usa el buscador de la portada en el teléfono
const dialogo = document.querySelector('[data-buscador]');
const campoDialogo = document.getElementById('buscador-campo');
const sugerenciasDialogo = dialogo?.querySelector('[data-buscador-sugerencias]');
if (dialogo) {
  sugerenciasDialogo.innerHTML = `<p class="buscador__ayuda">Escribe con tus palabras. Por ejemplo:</p><ul class="chips">${SUGERENCIAS.map((s) => `<li><button type="button" class="chip">${s}</button></li>`).join('')}</ul>`;
  dialogo.querySelector('[data-buscador-form]').addEventListener('submit', (e) => e.preventDefault());
  const busqueda = conectarBusqueda({ campo: campoDialogo, lista: document.getElementById('buscador-resultados'), vacio: dialogo.querySelector('[data-buscador-vacio]'), sugerencias: sugerenciasDialogo, estado: dialogo.querySelector('[data-buscador-estado]'), alElegir: () => cerrarDialogo() });
  sugerenciasDialogo.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    campoDialogo.value = b.textContent;
    busqueda.actualizar();
    campoDialogo.focus();
  });
  dialogo.addEventListener('close', () => document.documentElement.classList.remove('sin-desplazar'));
  let abridor = null; // lo que tenía el foco antes de abrir: al cerrar, el foco vuelve ahí
  function cerrarDialogo() {
    dialogo.close();
    document.documentElement.classList.remove('sin-desplazar');
    // Sin esto, el foco puede quedarse un cuadro en el campo ya oculto y una «/» rápida caería ahí.
    if (dialogo.contains(document.activeElement)) {
      if (abridor?.isConnected && abridor !== document.body) abridor.focus();
      else document.activeElement.blur();
    }
  }
  const abrir = (texto = '') => {
    cerrarMenus();
    if (!dialogo.open) {
      abridor = document.activeElement;
      dialogo.showModal();
      document.documentElement.classList.add('sin-desplazar');
    }
    campoDialogo.value = texto;
    busqueda.actualizar();
    campoDialogo.focus();
    cargarIndice().catch(() => {});
  };
  abrirBuscador = abrir;
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-abrir-buscador]')) {
      e.preventDefault();
      if (!menuMovil.hidden) hamburguesa.click();
      abrir();
    }
    if (e.target.closest('[data-cerrar-buscador]')) cerrarDialogo();
  });
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) cerrarDialogo(); // clic en el fondo
  });
  // En un campo de búsqueda, Escape solo borra el texto; aquí cierra el buscador a la primera.
  campoDialogo.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrarDialogo();
    }
  });
  document.addEventListener('keydown', (e) => {
    const escribiendo = /input|textarea|select/i.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === '/' && !escribiendo) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      abrir();
    }
    if (e.key === 'Escape') cerrarMenus();
  });
}

// búsqueda en la portada, con resultados debajo del campo
const formHeroe = document.querySelector('[data-buscar-en-linea]');
if (formHeroe) {
  const campo = formHeroe.querySelector('input');
  if (matchMedia('(max-width: 480px)').matches) campo.placeholder = 'Ej.: menú QR, WhatsApp…';
  const caja = document.getElementById('heroe-resultados');
  const lista = Object.assign(document.createElement('ul'), { className: 'buscador__resultados', role: 'listbox', id: 'heroe-lista' });
  lista.setAttribute('role', 'listbox');
  const vacio = document.createElement('div');
  caja.append(lista, vacio);
  const estadoHeroe = Object.assign(document.createElement('p'), { className: 'sr' });
  estadoHeroe.setAttribute('role', 'status');
  formHeroe.append(estadoHeroe);
  const b = conectarBusqueda({ campo, lista, vacio, estado: estadoHeroe });
  campo.setAttribute('aria-controls', 'heroe-lista');
  // el desplegable cabe en lo que queda de pantalla bajo el campo: así la fila «Pregúntanos» (fija abajo) se ve siempre
  const mostrar = () => {
    caja.hidden = !campo.value.trim();
    if (!caja.hidden) caja.style.maxHeight = `${Math.max(180, Math.min(416, innerHeight - formHeroe.getBoundingClientRect().bottom - 24))}px`;
  };
  campo.addEventListener('input', mostrar);
  // En el teléfono, el desplegable bajo el campo quedaba debajo del teclado: se abre el diálogo de la lupa, que pone
  // el campo arriba y los resultados entre el campo y el teclado (revisión del 3-oct).
  const enTelefono = matchMedia('(max-width: 640px) and (pointer: coarse)');
  campo.addEventListener('focus', () => {
    if (enTelefono.matches && abrirBuscador) {
      campo.blur();
      abrirBuscador(campo.value);
      return;
    }
    cargarIndice().catch(() => {});
    mostrar();
  });
  document.addEventListener('click', (e) => { if (!formHeroe.contains(e.target)) caja.hidden = true; });
  formHeroe.addEventListener('focusout', (e) => { if (!formHeroe.contains(e.relatedTarget)) caja.hidden = true; });
  formHeroe.addEventListener('submit', (e) => {
    e.preventDefault();
    b.enviar();
  });
  campo.addEventListener('keydown', (e) => { if (e.key === 'Escape') caja.hidden = true; });
  for (const chip of document.querySelectorAll('[data-buscar]')) {
    chip.addEventListener('click', async () => {
      campo.value = chip.dataset.buscar;
      await b.actualizar();
      mostrar();
      campo.focus();
    });
  }
}

if ('requestIdleCallback' in window) requestIdleCallback(() => cargarIndice().catch(() => {}), { timeout: 4000 });
else setTimeout(() => cargarIndice().catch(() => {}), 2000);

// Mientras el héroe oscuro (portada y páginas de negocio) está bajo la cabecera, la cabecera es del mismo petróleo y
// se funde con él; al pasarlo vuelve a ser clara. La clase ya viene puesta en el HTML para que no parpadee al cargar.
// (cabeceraEl se declara arriba, con el menú del teléfono)
const heroePortada = document.querySelector('.heroe--producto');
if (heroePortada && cabeceraEl && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => cabeceraEl.classList.toggle('cabecera--sobre-heroe', e.isIntersecting), { rootMargin: '-80px 0px 0px 0px' }).observe(heroePortada);
}

// ── el producto en movimiento (portada): los dos videos van juntos, se pausan con un botón y fuera de la vista,
// y con «reducir movimiento» no arrancan (queda la imagen fija) ──
const figuraVideo = document.querySelector('[data-producto-video]');
if (figuraVideo) {
  const videos = [...figuraVideo.querySelectorAll('[data-video-producto]')];
  const boton = figuraVideo.querySelector('[data-pausa-video]');
  let pausadoPorPersona = reducir;
  const visibles = () => videos.filter((v) => v.offsetParent !== null);
  const pausar = () => videos.forEach((v) => v.pause());
  // Si el teléfono no deja arrancar solo (iPhone con ahorro de batería: NotAllowedError), el botón queda en
  // «reproducir» y un toque lo arranca. Una interrupción por pausa (AbortError, al bajar rápido) no cuenta.
  const arrancar = (vs) =>
    vs.forEach((v) =>
      v.play().catch((e) => {
        if (e?.name !== 'NotAllowedError') return;
        pausadoPorPersona = true;
        pausar();
        pintarBoton();
      }),
    );
  const reproducir = () => {
    if (pausadoPorPersona) return;
    const vs = visibles();
    vs.forEach((v) => { v.currentTime = 0; });
    arrancar(vs);
  };
  // El teléfono marca el tiempo (se ve siempre) y el salón lo sigue solo si también se ve. Antes era al revés, y en el
  // celular, donde el salón está oculto y quieto en 0, cada timeupdate devolvía el video del teléfono al segundo 0:
  // la portada se veía fija.
  const telefono = videos.find((v) => v.closest('.dispositivo--telefono'));
  const salon = videos.find((v) => v !== telefono);
  telefono?.addEventListener('timeupdate', () => {
    if (salon?.offsetParent && telefono.offsetParent && Math.abs(salon.currentTime - telefono.currentTime) > 0.25) salon.currentTime = telefono.currentTime;
  });
  // nombre fijo («Pausar la demo») y el estado en aria-pressed: cambiar el texto y además marcar «presionado» hacía
  // que un lector de pantalla dijera «Reproducir, presionado»
  const pintarBoton = () => boton.setAttribute('aria-pressed', String(pausadoPorPersona));
  boton.addEventListener('click', () => {
    pausadoPorPersona = !pausadoPorPersona;
    if (pausadoPorPersona) pausar();
    else arrancar(visibles());
    pintarBoton();
  });
  pintarBoton();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? reproducir() : pausar()), { threshold: 0.25 }).observe(figuraVideo);
  } else reproducir();
}

// ── «Pregúntanos» rápido (banda al final de las páginas) ──
for (const form of document.querySelectorAll('[data-pregunta-rapida]')) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = form.querySelector('textarea').value.trim();
    if (!texto) {
      form.querySelector('textarea').focus();
      return;
    }
    window.open(enlaceWhatsApp(mensajePregunta(texto), contacto()), '_blank', 'noopener');
  });
}

// ── lista de la cotización (los botones «Agregar» de todas las páginas) ──
function pintarCotizacion() {
  const { elegidos } = leerCotizacion();
  for (const b of document.querySelectorAll('[data-cotizar]')) {
    const en = elegidos.includes(b.dataset.cotizar);
    b.setAttribute('aria-pressed', String(en));
    // el de la ficha lleva los dos textos en la misma celda (no cambia de ancho) y su nombre es fijo: solo cambia
    // aria-pressed; los chicos cambian el texto, con su aria-label fijo
    if (b.hasAttribute('data-fijo')) continue;
    if (b.classList.contains('boton-chico')) b.textContent = en ? 'Agregado' : 'Agregar';
    else b.textContent = en ? 'En mi lista' : 'Agregar a mi lista';
  }
  const cuenta = document.querySelector('[data-cuenta-cotizacion]');
  if (cuenta) {
    const antes = cuenta.textContent;
    cuenta.hidden = elegidos.length === 0;
    cuenta.textContent = elegidos.length;
    // el contador da un saltito cuando cambia: confirma que se agregó sin tener que buscarlo
    if (antes && antes !== String(elegidos.length) && elegidos.length && !reducir) cuenta.animate([{ transform: 'scale(.55)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'cubic-bezier(.16,1,.3,1)' });
    cuenta.setAttribute('aria-label', `${elegidos.length} ${elegidos.length === 1 ? 'servicio' : 'servicios'} en tu lista`);
  }
}
document.addEventListener('click', (e) => {
  const varios = e.target.closest('[data-cotizar-varios]');
  if (varios) {
    const n = agregarVarios(varios.dataset.cotizarVarios.split(' '));
    pintarCotizacion();
    varios.textContent = n ? `Agregado${n > 1 ? `s (${n})` : ''}. Ver mi lista` : 'Ya estaban en tu lista. Ver mi lista';
    varios.onclick = () => (location.href = `${RAIZ}#pregunta`);
    return;
  }
  const b = e.target.closest('[data-cotizar]');
  if (!b) return;
  alternarEnCotizacion(b.dataset.cotizar);
  pintarCotizacion();
  // junto al botón grande de la ficha, una línea que dice dónde quedó y cuántos van
  {
    const { elegidos } = leerCotizacion();
    // la ficha trae su renglón ya reservado bajo los botones (al agregar, nada se corre); en las demás, junto al botón
    let nota = b.closest('.ficha-heroe__texto')?.querySelector('.ficha-heroe__nota') || b.parentElement.querySelector('.nota-lista');
    if (!nota) {
      nota = Object.assign(document.createElement('span'), { className: 'nota-lista' });
      nota.setAttribute('role', 'status');
      b.after(nota);
    }
    nota.replaceChildren(elegidos.includes(b.dataset.cotizar) ? `En tu lista (${elegidos.length}) · ` : 'Quitado de tu lista · ', Object.assign(document.createElement('a'), { href: `${RAIZ}#pregunta`, textContent: 'Ver lista' }));
  }
});
window.addEventListener('storage', pintarCotizacion);
pintarCotizacion();

export { guardarCotizacion, reducir };

// ── héroe de la portada: avisos de ejemplo de los sistemas que hacemos; el nuevo entra arriba cada 5 s ──
// Hora fija por aviso (no envejece al bajar), pausa al tocar, al pasar el puntero o con el botón, y se detiene sola
// tras una vuelta completa. Con «reducir movimiento» no rota.
const avisosHeroe = document.querySelector('[data-avisos]');
if (avisosHeroe) {
  const lista = avisosHeroe.querySelector('.avisos-heroe__lista');
  const todos = [...lista.children];
  const botonPausa = avisosHeroe.querySelector('[data-pausa-avisos]');
  // tres: en el teléfono, con cuatro el buscador quedaba fuera de la primera pantalla; en la computadora, con cuatro la
  // caja bajaba más que la columna de texto
  const VISIBLES = 3;
  todos.forEach((li, i) => { li.hidden = i >= VISIBLES; });
  let siguiente = VISIBLES;
  let minutos = 10 * 60 + 42; // la hora del de arriba
  const PASOS = [4, 6, 3, 7, 5];
  const hora = (m) => {
    const h = Math.floor(m / 60) % 24;
    return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  };
  let pausadoPorPersona = reducir;
  let encima = false;
  let reloj = null;
  const visibles = () => [...lista.children].filter((li) => !li.hidden);
  function paso() {
    if (encima) return;
    const antes = new Map(visibles().map((li) => [li, li.getBoundingClientRect().top]));
    const nuevo = todos[siguiente % todos.length];
    siguiente++;
    visibles().at(-1).hidden = true;
    nuevo.hidden = false;
    lista.prepend(nuevo);
    minutos += PASOS[siguiente % PASOS.length];
    nuevo.querySelector('.aviso-heroe__hora').textContent = hora(minutos);
    for (const li of visibles()) {
      if (li === nuevo) continue;
      const dy = antes.get(li) - li.getBoundingClientRect().top;
      if (dy) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
    nuevo.animate([{ opacity: 0, transform: 'translateY(-14px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' });
    // una vuelta completa y se queda quieto (el botón la retoma)
    if (siguiente >= VISIBLES + todos.length) {
      pausadoPorPersona = true;
      andar();
      pintarPausa();
    }
  }
  function andar() {
    clearInterval(reloj);
    reloj = pausadoPorPersona ? null : setInterval(paso, 5000);
  }
  const pintarPausa = () => botonPausa?.setAttribute('aria-pressed', String(pausadoPorPersona));
  botonPausa?.addEventListener('click', () => {
    pausadoPorPersona = !pausadoPorPersona;
    if (!pausadoPorPersona && siguiente >= VISIBLES + todos.length) siguiente = VISIBLES; // otra vuelta
    andar();
    pintarPausa();
  });
  // mientras el puntero, el dedo o el foco están en la lista, no cambia (se puede leer y tocar un aviso)
  lista.addEventListener('pointerenter', () => { encima = true; });
  lista.addEventListener('pointerleave', () => { encima = false; });
  lista.addEventListener('touchstart', () => { encima = true; }, { passive: true });
  lista.addEventListener('focusin', () => { encima = true; });
  lista.addEventListener('focusout', (e) => { if (!lista.contains(e.relatedTarget)) encima = false; });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => (e.isIntersecting ? andar() : clearInterval(reloj))).observe(avisosHeroe);
  else andar();
  pintarPausa();
}
