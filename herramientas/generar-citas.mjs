// Genera las páginas de Med (Citas Médicas hasta el 10-oct-2026): su portada en med/ (desde el 8-oct-2026; antes
// era la raíz), las páginas de función y las guías, la privacidad, los términos, registro/, entrar/, el 404, /citasmed/
// (lleva a med/), el sitemap, robots.txt y llms.txt. La raíz del sitio es la portada de alphateklab, con Med, Food y
// alphatend: la escribe herramientas/generar-portada.mjs --raiz. Todo el contenido sale de datos/producto.mjs y
// datos/sitio.mjs; no se editan a mano los HTML generados.
// Uso: node herramientas/generar-citas.mjs
//
// El sitio de la agencia (catálogo, soluciones, guías y demos) quedó en la rama sitio-agencia; ver CLAUDE.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../datos/producto.mjs';
import { FUNCIONES } from '../datos/paginas.mjs';
import { GUIAS } from '../datos/guias-citas.mjs';
import { FOOD } from '../datos/food.mjs';
import { ACTUALIZADO, CONTACTO as CONTACTO_DATOS, INDEXNOW, REGISTRO, URL_BASE } from '../datos/sitio.mjs';
import * as TERMINOS from '../datos/terminos.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// Para ver el formulario de la prueba en local antes de tener el contacto: WHATSAPP=507… CORREO=… node …
const CONTACTO = { whatsapp: process.env.WHATSAPP || CONTACTO_DATOS.whatsapp, correo: process.env.CORREO || CONTACTO_DATOS.correo };
const existe = (ruta) => existsSync(join(RAIZ, ruta));

// La portada de Med vive en med/. En cada página, `prefijo` lleva a la raíz del sitio (las hojas de estilo,
// las imágenes, registro/, entrar/, privacidad/, las páginas de función…) y `inicio`, a la portada de Med (sus secciones:
// #precios, #preguntas…). El logo de alphateklab lleva a la raíz, la portada de alphateklab.
const MED = 'med/';
const DESDE_MED = '../'; // la raíz, vista desde med/
const inicioDesde = (prefijo) => `${prefijo}${MED}`;
// food/ (cafeterías, bares y restaurantes) la escribe herramientas/generar-portada.mjs --raiz: si está publicada, va
// en el sitemap, en llms.txt y en la privacidad (su formulario de contacto).
const HAY_FOOD = existe('food/index.html');

// «9:00 a. m.», «98 %» y «$25» no se parten al final de una línea.
const sinCorte = (t) => String(t).replace(/(\d) (a\. m\.|p\. m\.|%|°C|mmHg|lpm)/g, '$1 $2').replace(/a\. m\./g, 'a. m.').replace(/p\. m\./g, 'p. m.');
export const esc = (s) => sinCorte(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const jsonEnScript = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const { dolares } = P;
const resaltar = (t) => esc(t).replace(/\[([^\]]+)\]/, '<span class="resalte">$1</span>');
const sinMarcas = (t) => t.replace(/[[\]]/g, '');

// ── íconos: del sprite de assets/iconos.svg (Phosphor), solo los que usa cada página ──
const SPRITE = readFileSync(join(RAIZ, 'assets/iconos.svg'), 'utf8');
const SIMBOLOS = new Map([...SPRITE.matchAll(/<symbol id="i-([\w-]+)"[\s\S]*?<\/symbol>/g)].map((m) => [m[1], m[0]]));
let usados = new Set();
function icono(nombre, clase = 'ico') {
  if (!SIMBOLOS.has(nombre)) throw new Error(`Falta el ícono «${nombre}» en assets/iconos.svg`);
  usados.add(nombre);
  return `<svg class="${clase}" aria-hidden="true" focusable="false"><use href="#i-${nombre}"></use></svg>`;
}
const sprite = () => `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${[...usados].map((n) => SIMBOLOS.get(n)).join('')}</svg>`;

// El logo de alphateklab, como estaba antes del cambio (Edwin): el claro y el de fondo oscuro; la hoja de estilos
// muestra el que va con el tema.
const logo = (prefijo, alt) => `<img class="logo logo--claro" src="${prefijo}assets/marca/logo-claro.svg" alt="${esc(alt)}" width="142" height="32" /><img class="logo logo--oscuro" src="${prefijo}assets/marca/logo-oscuro.svg" alt="${esc(alt)}" width="142" height="32" />`;

// Versión por contenido de la hoja de estilos y del script: GitHub Pages guarda 10 minutos sin preguntar.
const huella = (ruta) => createHash('sha1').update(readFileSync(join(RAIZ, ruta))).digest('hex').slice(0, 10);
const conVersion = (prefijo, ruta) => `${prefijo}${ruta}?v=${huella(ruta)}`;

// ── imágenes: cada captura en claro y en oscuro, en dos tamaños ──
// La página sale en claro (pedido de Edwin) y tiene botón de tema: la captura oscura la pone js/citas.js al elegir
// el oscuro (data-oscuro), y la clara vuelve con data-claro.
function imagen(prefijo, nombre, { alt = '', ancho, alto, chico, sizes, prioridad = false, perezosa = !prioridad }) {
  const base = `assets/producto/${nombre}`;
  for (const s of ['', '-oscuro']) for (const t of [`${s}`, `${s}-${chico}`]) if (!existe(`${base}${t}.webp`)) throw new Error(`Falta ${base}${t}.webp (herramientas/capturas-citas.mjs y imagenes-citas.mjs)`);
  const juego = (s) => `${prefijo}${base}${s}-${chico}.webp ${chico}w, ${prefijo}${base}${s}.webp ${ancho}w`;
  return `<img src="${prefijo}${base}.webp" srcset="${juego('')}" data-claro="${juego('')}" data-oscuro="${juego('-oscuro')}" sizes="${sizes}" alt="${esc(alt)}" width="${ancho}" height="${alto}"${prioridad ? ' fetchpriority="high"' : ''}${perezosa ? ' loading="lazy"' : ''} decoding="async" />`;
}
const portatil = (prefijo, nombre, alt, opciones = {}) => `<div class="portatil"><div class="portatil__pantalla">${imagen(prefijo, nombre, { alt, ancho: 1600, alto: 1000, chico: 800, sizes: '(min-width: 1040px) 600px, 92vw', ...opciones })}</div></div>`;
const telefono = (prefijo, nombre, alt, opciones = {}) => `<div class="telefono"><div class="telefono__pantalla">${imagen(prefijo, nombre, { alt, ancho: 780, alto: 1688, chico: 390, sizes: '(min-width: 1040px) 260px, 60vw', ...opciones })}</div></div>`;

// ── piezas comunes ──
const ENLACES = [
  ['expediente', 'Expediente'],
  ['agenda', 'Agenda'],
  ['precios', 'Precios'],
  ['preguntas', 'Preguntas'],
];
const hayContacto = Boolean(CONTACTO.whatsapp || CONTACTO.correo);
// Con el registro en línea, «Probar gratis» lleva a crear la cuenta; sin él, a la sección de la prueba.
// Los botones van a alphateklab.com/registro/, que pasa al registro del servicio de cuentas en cuanto responde (y
// mientras no, lo dice en vez de dar un error): así el sitio no depende de cuándo quede en línea el servidor.
const destinoPrueba = (prefijo, inicio = inicioDesde(prefijo)) => (REGISTRO ? `${prefijo === '/' ? '/' : prefijo || './'}registro/` : `${inicio}#prueba`);
const registroCon = (params, prefijo = DESDE_MED) => (REGISTRO ? `${prefijo}registro/?${new URLSearchParams(params)}` : '#prueba');
// «Iniciar sesión» (con el registro en línea): alphateklab.com/entrar/, donde se escribe el usuario y se pasa al
// sistema de la clínica, en <usuario>.alphateklab.com.
const destinoEntrar = (prefijo) => `${prefijo === '/' ? '/' : prefijo || './'}entrar/`;
const DOMINIO_CLINICAS = REGISTRO ? new URL(REGISTRO).hostname.replace(/^cuentas\./, '') : '';
const enlaceRegistro = REGISTRO ? ' data-registro' : '';
const PREGUNTAS = REGISTRO
  ? [...P.PREGUNTAS.map(([q, a]) => (q.startsWith('¿Cómo es la prueba') ? [q, 'Creas tu cuenta y tu sistema queda listo al momento; lo usas una semana con el plan que elijas. No pedimos tarjeta.'] : [q, a])), ...P.PREGUNTAS_REGISTRO]
  : P.PREGUNTAS;

function cabecera(prefijo, inicio) {
  const lista = ENLACES.map(([id, t]) => `<li><a href="${inicio}#${id}">${t}</a></li>`).join('');
  return `<header class="cab" data-cab>
  <div class="envoltura cab__fila">
    <a class="cab__marca" href="${prefijo || './'}">${logo(prefijo, 'alphateklab, inicio')}</a>
    <nav class="cab__menu" aria-label="Principal"><ul>${lista}</ul></nav>
    <div class="cab__acciones">
      <button class="cab__tema" type="button" aria-pressed="false" aria-label="Usar el tema oscuro" data-tema>${icono('moon', 'ico ico--luna')}${icono('sun', 'ico ico--sol')}</button>
      ${REGISTRO ? `<a class="boton boton--linea cab__entrar" href="${destinoEntrar(prefijo)}" data-entrar-cab><span class="cab__entrar-largo">Iniciar sesión</span><span class="cab__entrar-corto">Entrar</span></a>` : ''}
      <a class="boton boton--senal cab__cta" href="${destinoPrueba(prefijo, inicio)}">Probar gratis</a>
      <button class="cab__abrir" type="button" aria-expanded="false" aria-controls="menu-movil" aria-label="Abrir el menú" data-abrir-menu>${icono('list', 'ico ico--abrir')}${icono('x', 'ico ico--cerrar')}</button>
    </div>
  </div>
  <nav class="cab__movil" id="menu-movil" aria-label="Menú" hidden>
    <ul class="envoltura">${lista}${REGISTRO ? `<li><a href="${destinoEntrar(prefijo)}">Iniciar sesión</a></li>` : ''}<li><a class="boton boton--senal" href="${destinoPrueba(prefijo, inicio)}">Probar ${P.PRUEBA_DIAS} días gratis</a></li></ul>
  </nav>
</header>`;
}

function pie(prefijo, inicio) {
  const contacto = [
    CONTACTO.whatsapp ? `<li><a href="https://wa.me/${CONTACTO.whatsapp}">WhatsApp</a></li>` : '',
    CONTACTO.correo ? `<li><a href="mailto:${esc(CONTACTO.correo)}">${esc(CONTACTO.correo)}</a></li>` : '',
  ].join('');
  return `<footer class="pie">
  <div class="envoltura pie__fila">
    <a class="pie__marca" href="${prefijo || './'}">${logo(prefijo, 'alphateklab')}</a>
    <nav aria-label="Al pie"><ul class="pie__enlaces">${[...FUNCIONES, ...GUIAS].map((f) => `<li><a href="${prefijo || './'}${f.ruta}">${esc(f.pie || f.miga)}</a></li>`).join('')}<li><a href="${inicio}#precios">Precios</a></li><li><a href="${inicio}#preguntas">Preguntas</a></li><li><a href="${prefijo || './'}terminos/">Términos</a></li><li><a href="${prefijo || './'}privacidad/">Privacidad</a></li>${contacto}</ul></nav>
  </div>
  <p class="envoltura pie__nota">Las pantallas muestran un consultorio de ejemplo con pacientes ficticios. Precios en dólares, al mes. Actualizado el ${esc(ACTUALIZADO.texto)}.</p>
</footer>`;
}

function documento({ titulo, descripcion, prefijo, inicio = inicioDesde(prefijo), cuerpo, canonica, robots = '', datos = null, imagenOg = 'assets/og-citas.jpg' }) {
  usados = new Set();
  const cab = cabecera(prefijo, inicio);
  const pieHtml = pie(prefijo, inicio);
  const html = typeof cuerpo === 'function' ? cuerpo() : cuerpo;
  return `<!doctype html>
<html lang="es-PA" data-theme="light">
<head>
<meta charset="utf-8" />
<script>try{if(localStorage.getItem('atk-tema')==='oscuro')document.documentElement.dataset.theme='dark'}catch(e){}</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}" />
<link rel="canonical" href="${esc(canonica)}" />${robots ? `\n<meta name="robots" content="${robots}" />` : ''}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="alphateklab" />
<meta property="og:title" content="${esc(titulo)}" />
<meta property="og:description" content="${esc(descripcion)}" />
<meta property="og:url" content="${esc(canonica)}" />
<meta property="og:locale" content="es_PA" />
<meta property="og:image" content="${URL_BASE}${imagenOg}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#f6f7f9" />
<link rel="icon" href="${prefijo}assets/marca/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="${prefijo}assets/marca/favicon-32.png" sizes="32x32" type="image/png" />
<link rel="apple-touch-icon" href="${prefijo}assets/marca/favicon-180.png" />
<link rel="preload" href="${prefijo}assets/fuentes/manrope-latin.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="${prefijo}assets/fuentes/inter-latin.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="${conVersion(prefijo, 'assets/atk.css')}" />
<link rel="stylesheet" href="${conVersion(prefijo, 'assets/citas.css')}" />${datos ? `\n<script type="application/ld+json">${jsonEnScript(datos)}</script>` : ''}
</head>
<body class="citas">
<a class="saltar" href="#contenido">Saltar al contenido</a>
${sprite()}
${cab}
${html}
${pieHtml}
<script type="module" src="${conVersion(prefijo, 'js/citas.js')}"></script>
</body>
</html>
`;
}

// ── la portada ──
function heroe() {
  const h = P.HEROE;
  return `<section class="heroe" aria-labelledby="heroe-titulo">
  <div class="heroe__fondo" aria-hidden="true"></div>
  <div class="envoltura heroe__fila">
    <div class="heroe__texto">
      <p class="antetitulo">${icono('stethoscope')}${esc(h.antetitulo)}</p>
      <h1 id="heroe-titulo" class="heroe__titulo">${resaltar(h.titulo)}</h1>
      <p class="heroe__bajada">${esc(h.bajada)}</p>
      <div class="heroe__acciones">
        <a class="boton boton--senal boton--grande" href="${destinoPrueba(DESDE_MED, '')}">Probar ${P.PRUEBA_DIAS} días gratis${icono('arrow-right')}</a>
        <a class="boton boton--linea boton--grande" href="#precios">Ver precios</a>
      </div>
      <ul class="heroe__puntos" role="list">${h.puntos.map((p) => `<li>${icono('check')}${esc(p)}</li>`).join('')}</ul>
    </div>
    <figure class="heroe__visual">
      <div class="heroe__dispositivos">
        ${portatil(DESDE_MED, 'citas-nota', 'La nota del médico en el expediente de un paciente de ejemplo, con un botón «Dictar» en cada sección.', { prioridad: true })}
        <div class="heroe__dictado">${dictado({ mini: true })}</div>
        <ul class="avisos" role="list" aria-hidden="true">${h.avisos.map((a, i) => `<li class="aviso aviso--${i + 1}"><span class="aviso__icono">${icono(a.icono)}</span><span><strong>${esc(a.titulo)}</strong><small>${esc(a.texto)}</small></span></li>`).join('')}</ul>
      </div>
      <figcaption>Pantalla real del sistema, con un consultorio de ejemplo y pacientes ficticios.</figcaption>
    </figure>
  </div>
</section>`;
}

// Lo que más importa de cada parte, en grande: el dictado del expediente y los recordatorios automáticos.
const destacado = (p) => `<div class="destacado destacado--${p.id}"><span class="destacado__icono">${icono(p.destacado.icono)}</span><p><strong>${esc(p.destacado.titulo)}</strong><span>${esc(p.destacado.texto)}</span></p></div>`;

// El precio de antes, tachado, al lado del de ahora (PRECIOS.antes). El lector de pantalla dice «Antes $49.99, ahora».
const tachado = (id) => `<s class="precio-antes"><span class="sr">Antes</span> ${dolares(P.PRECIOS.antes[id])}</s><span class="sr">, ahora</span>`;

function precioDeParte(id) {
  return `${tachado(id)} <strong class="num">${dolares(P.PRECIOS[id])}</strong>`;
}

const partes = () => `<section class="seccion envoltura" id="productos" aria-labelledby="productos-titulo">
  <div class="seccion__cabeza seccion__cabeza--centro">
    <p class="antetitulo">${icono('sparkle')}Dos partes: contratas lo que usas</p>
    <h2 id="productos-titulo" class="seccion__titulo">Expediente y agenda, juntos o por separado</h2>
    <p class="seccion__bajada">El expediente es para el médico; la agenda, para la recepción. Úsalos juntos o cada uno por su lado.</p>
  </div>
  <div class="partes">
    ${P.PARTES.map(
      (p) => `<article class="parte parte--${p.id} revelar">
      <div class="parte__cabeza"><span class="parte__icono">${icono(p.icono)}</span><p class="parte__para">${esc(p.para)}</p></div>
      <h3 class="parte__nombre">${esc(p.nombre)}</h3>
      <p class="parte__resumen">${esc(p.resumen)}</p>
      <p class="parte__precio">${precioDeParte(p.id)} <span class="parte__unidad">${esc(p.unidad)}</span></p>
      ${destacado(p)}
      <ul class="lista-check" role="list">${p.incluye.map((x) => `<li>${icono('check')}${esc(x)}</li>`).join('')}</ul>
      <a class="parte__enlace" href="#${p.id}">Ver cómo funciona${icono('arrow-right')}</a>
    </article>`,
    ).join('\n    ')}
  </div>
  <p class="partes__juntas">${icono('sparkle')}<span><strong>Las dos juntas:</strong> la recepción agenda y el médico abre el expediente desde la cita.</span></p>
</section>`;

function chat() {
  const c = P.CHAT;
  return `<div class="chat" data-chat role="img" aria-label="${esc(`Ejemplo: le llega el recordatorio por WhatsApp a una paciente y responde «${c.respuesta}»; la cita queda confirmada.`)}">
  <div class="chat__cabeza"><span class="chat__avatar">DR</span><span><strong>${esc(c.consultorio)}</strong><small>${icono('whatsapp-logo')}WhatsApp</small></span></div>
  <div class="chat__cuerpo">
    <p class="chat__dia">Hoy</p>
    <p class="chat__burbuja chat__burbuja--entra" data-paso>${esc(c.mensaje)}<span class="chat__hora">9:00 a. m.</span></p>
    <p class="chat__burbuja chat__burbuja--sale" data-paso>${esc(c.respuesta)}<span class="chat__hora">9:04 a. m. ✓✓</span></p>
    <p class="chat__estado" data-paso>${icono('check-circle')}${esc(c.estado)}</p>
  </div>
</div>`;
}

function dictado({ mini = false } = {}) {
  const secciones = mini ? P.DICTADO.slice(0, 2) : P.DICTADO;
  return `<div class="dictado${mini ? ' dictado--mini' : ''}" data-dictado role="img" aria-label="Ejemplo: el médico habla y la nota se va escribiendo por secciones, sin teclear.">
  <div class="dictado__cabeza"><strong>Nota del médico</strong><span class="dictado__mic">${icono('microphone')}<span>Dictando…</span></span></div>
  ${secciones.map((d) => `<div class="dictado__seccion"><p class="dictado__titulo">${esc(d.seccion)}</p><p class="dictado__texto" data-texto="${esc(d.texto)}">${esc(d.texto)}</p></div>`).join('\n  ')}
</div>`;
}

function hoja() {
  const h = P.HOJA;
  return `<div class="hoja-visual">
  <div class="folder" aria-hidden="true"></div>
  <article class="hoja" aria-label="Ejemplo de la hoja impresa">
    <header class="hoja__cabeza"><span class="hoja__logo" aria-hidden="true">DR</span><span><strong>${esc(h.consultorio)}</strong><small>Expediente clínico</small></span></header>
    <dl class="hoja__datos">
      <div><dt>Paciente</dt><dd>${esc(h.paciente)}</dd></div>
      <div><dt>Cédula</dt><dd>${esc(h.documento)}</dd></div>
      <div><dt>Edad</dt><dd>${esc(h.edad)}</dd></div>
      <div><dt>Consulta</dt><dd>${esc(h.fecha)}</dd></div>
      <div><dt>Médico</dt><dd>${esc(h.medico)}</dd></div>
    </dl>
    <p class="hoja__antecedentes"><strong>Antecedentes</strong> ${esc(h.antecedentes)}</p>
    <p class="hoja__signos"><strong>Signos</strong> ${esc(h.signos)}</p>
    ${h.notas.map(([t, x]) => `<div class="hoja__nota"><p class="hoja__titulo">${esc(t)}</p><p>${esc(x)}</p></div>`).join('')}
    <footer class="hoja__firma"><span>Firma y sello del médico</span></footer>
  </article>
</div>`;
}

function visual(v, prefijo = '') {
  if (v.tipo === 'portatil') return portatil(prefijo, v.imagen, v.alt);
  if (v.tipo === 'telefono') return `<div class="telefono-solo">${telefono(prefijo, v.imagen, v.alt)}</div>`;
  if (v.tipo === 'chat') return chat();
  if (v.tipo === 'dictado') return dictado();
  if (v.tipo === 'hoja') return hoja();
  throw new Error(`Visual desconocido: ${v.tipo}`);
}

function seccionParte(id) {
  const s = P.FILAS[id];
  const parte = P.PARTES.find((p) => p.id === id);
  const funcion = FUNCIONES.find((f) => f.id === id);
  const precio = `${dolares(P.PRECIOS[id])} ${parte.unidad}`;
  return `<section class="seccion producto producto--${id}" id="${id}" aria-labelledby="${id}-titulo">
  <div class="envoltura">
    <div class="seccion__cabeza">
      <p class="antetitulo">${icono(parte.icono)}${esc(parte.nombre)} · ${esc(precio)}</p>
      <h2 id="${id}-titulo" class="seccion__titulo">${esc(s.titulo)}</h2>
      <p class="seccion__bajada">${esc(s.bajada)}</p>
    </div>
    ${filasHtml(s.filas, DESDE_MED)}
    ${funcion ? `<p class="producto__mas"><a href="${DESDE_MED}${funcion.ruta}">Todo sobre el ${esc(funcion.miga.toLowerCase())}${icono('arrow-right')}</a></p>` : ''}
  </div>
</section>`;
}

// Texto de un lado y su pantalla (o animación) del otro, alternando.
const filasHtml = (filas, prefijo = '') =>
  filas
    .map(
      (f, i) => `<div class="fila${i % 2 ? ' fila--invertida' : ''}"${f.id ? ` id="${f.id}"` : ''}>
      <div class="fila__texto revelar">
        <h3 class="fila__titulo">${esc(f.titulo)}</h3>
        <p>${esc(f.texto)}</p>
        ${f.puntos ? `<ul class="lista-check" role="list">${f.puntos.map((x) => `<li>${icono('check')}${esc(x)}</li>`).join('')}</ul>` : ''}
        ${f.pasos ? `<ol class="pasitos">${f.pasos.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        ${f.nota ? `<p class="fila__nota">${esc(f.nota)}</p>` : ''}
      </div>
      <div class="fila__visual revelar">${visual(f.visual, prefijo)}</div>
    </div>`,
    )
    .join('\n    ');

// Una rejilla de puntos con ícono, título y texto (los accesos de la portada, lo que guarda el expediente…).
const garantias = (puntos) => `<ul class="garantias${puntos.length === 6 ? ' garantias--seis' : ''}" role="list">${puntos.map((p) => `<li class="revelar"><span class="garantias__icono">${icono(p.icono)}</span><div><h3>${esc(p.titulo)}</h3><p>${esc(p.texto)}</p></div></li>`).join('')}</ul>`;

const accesos = () => {
  const a = P.ACCESOS;
  return `<section class="seccion envoltura" id="accesos" aria-labelledby="accesos-titulo">
  <div class="fila fila--accesos">
    <div class="fila__texto">
      <p class="antetitulo">${icono('lock-key')}Privacidad</p>
      <h2 id="accesos-titulo" class="seccion__titulo">${esc(a.titulo)}</h2>
      <p class="seccion__bajada">${esc(a.bajada)}</p>
    </div>
    <div class="fila__visual revelar">${portatil(DESDE_MED, a.imagen, a.alt)}</div>
  </div>
  ${garantias(a.puntos)}
</section>`;
};

function precios() {
  const paquetes = P.PRECIOS.mensajes;
  const conAgenda = (t) => P.sumar(P.PRECIOS.agenda, t.precio);
  const agenda = P.PARTES.find((p) => p.id === 'agenda');
  const exp = P.PARTES.find((p) => p.id === 'expediente');
  return `<section class="seccion precios" id="precios" aria-labelledby="precios-titulo">
  <div class="envoltura">
    <div class="seccion__cabeza seccion__cabeza--centro">
      <p class="antetitulo">${icono('currency-circle-dollar')}Precios</p>
      <h2 id="precios-titulo" class="seccion__titulo">Precios claros, mes a mes</h2>
      <p class="seccion__bajada">Contrata solo lo que usas. Los primeros ${P.PRUEBA_DIAS} días son gratis y no hay plan anual.</p>
    </div>
    <style>@supports selector(:has(*)) { .plan--agenda .plan__suma:first-of-type { display: none; } ${paquetes.map((t) => `.plan--agenda:has(input[value="${t.mensajes}"]:checked) .plan__suma[data-mensajes="${t.mensajes}"] { display: block; }`).join(' ')} }</style>
    <div class="planes">
      <article class="plan plan--expediente revelar" data-plan="expediente">
        <div class="plan__cabeza"><span class="plan__icono">${icono(exp.icono)}</span><h3>${esc(exp.nombre)}</h3></div>
        <p class="plan__para">Por cada médico que hace expedientes. La recepción, enfermería y administración no pagan.</p>
        <p class="plan__precio">${tachado('expediente')}<span class="plan__cifra plan__cifra--fija"><strong class="num">${dolares(P.PRECIOS.expediente)}</strong></span><span class="plan__unidad">${esc(exp.unidad)}</span></p>
        ${destacado(exp)}
        <ul class="lista-check" role="list">${exp.incluye.map((x) => `<li>${icono('check')}${esc(x)}</li>`).join('')}</ul>
        <a class="boton boton--linea plan__boton" href="${registroCon({ expediente: 1, profesionales: 1, agenda: 0 })}" data-elegir="expediente"${enlaceRegistro}>Probar el expediente</a>
      </article>
      <article class="plan plan--agenda revelar" data-plan="agenda">
        <div class="plan__cabeza"><span class="plan__icono">${icono(agenda.icono)}</span><h3>${esc(agenda.nombre)}</h3></div>
        <p class="plan__para">Para toda la clínica, con todos sus médicos.</p>
        <p class="plan__precio">${tachado('agenda')}<span class="plan__cifra plan__cifra--fija"><strong class="num">${dolares(P.PRECIOS.agenda)}</strong></span><span class="plan__unidad">${esc(agenda.unidad)}</span></p>
        ${destacado(agenda)}
        <ul class="lista-check" role="list">${agenda.incluye.map((x) => `<li>${icono('check')}${esc(x)}</li>`).join('')}</ul>
        ${paquetes.length < 2 ? `<p class="plan__suma plan__suma--sola">La recepción manda cada recordatorio con un toque desde el WhatsApp de la clínica. <strong>Total: <span class="num">${dolares(conAgenda(paquetes[0]))}</span> al mes</strong></p>` : `<fieldset class="plan__mensajes">
          <legend>Mensajes automáticos de WhatsApp, aparte</legend>
          <div class="segmentos segmentos--paquetes">${paquetes.map((t, i) => `<label><input type="radio" name="plan-mensajes" value="${t.mensajes}"${i === 0 ? ' checked' : ''} /><span>${t.mensajes ? `${t.mensajes}<small class="num">+${dolares(t.precio)}</small>` : `Sin paquete<small class="num">${dolares(0)}</small>`}</span></label>`).join('')}</div>
          ${paquetes.map((t) => `<p class="plan__suma" data-mensajes="${t.mensajes}">${t.mensajes ? `Hasta ${t.mensajes} mensajes al mes salen solos.` : 'La recepción manda cada recordatorio con un toque desde el WhatsApp de la clínica.'} <strong>Total: <span class="num">${dolares(conAgenda(t))}</span> al mes</strong></p>`).join('\n          ')}
        </fieldset>`}
        <a class="boton boton--linea plan__boton" href="${registroCon({ expediente: 0, agenda: 1, mensajes: paquetes[0].mensajes })}" data-elegir="agenda"${enlaceRegistro}>Probar la agenda</a>
      </article>
    </div>
    <div class="calculadora revelar" data-calculadora hidden>
      <h3 class="calculadora__titulo">${icono('currency-circle-dollar')}¿Cuánto pagaría tu clínica?</h3>
      <div class="calculadora__fila">
        <label class="interruptor"><input type="checkbox" name="calc-expediente" checked /><span>${esc(exp.nombre)}</span></label>
        <div class="contador calculadora__dato"><button type="button" data-sumar="-1" aria-label="Un profesional menos">−</button><label><span class="sr">Profesionales</span><input type="number" name="calc-profesionales" min="1" max="50" value="2" inputmode="numeric" /></label><span class="contador__unidad">profesionales</span><button type="button" data-sumar="1" aria-label="Un profesional más">+</button></div>
        <output class="calculadora__sub num" data-sub="expediente"></output>
      </div>
      <div class="calculadora__fila">
        <label class="interruptor"><input type="checkbox" name="calc-agenda" checked /><span>${esc(agenda.nombre)}</span></label>
        <label class="calculadora__dato"${paquetes.length < 2 ? ' hidden' : ''}><span class="sr">${paquetes.length < 2 ? 'Recordatorios de WhatsApp' : 'Mensajes automáticos de WhatsApp al mes'}</span><select name="calc-mensajes">${paquetes.map((t) => `<option value="${t.mensajes}">${t.mensajes ? `+ ${t.mensajes} mensajes (${dolares(t.precio)})` : 'Sin paquete de mensajes'}</option>`).join('')}</select></label>
        <output class="calculadora__sub num" data-sub="agenda"></output>
      </div>
      <div class="calculadora__total"><span>Total al mes</span><output class="num" data-total aria-live="polite"></output></div>
      <a class="boton boton--senal calculadora__boton" href="${registroCon({ expediente: 1, profesionales: 2, agenda: 1, mensajes: paquetes[0].mensajes })}" data-elegir="calculadora"${enlaceRegistro}>Probar este plan ${P.PRUEBA_DIAS} días gratis${icono('arrow-right')}</a>
    </div>
    <script type="application/json" id="datos-precios">${jsonEnScript(P.PRECIOS)}</script>
  </div>
</section>`;
}

const pasos = () => `<section class="seccion envoltura" id="empezar" aria-labelledby="empezar-titulo">
  <div class="seccion__cabeza seccion__cabeza--centro">
    <p class="antetitulo">${icono('hand-tap')}Cómo empiezas</p>
    <h2 id="empezar-titulo" class="seccion__titulo">Listo para usar en tu consultorio</h2>
  </div>
  <ol class="pasos">${(REGISTRO ? P.PASOS_REGISTRO : P.PASOS).map((p) => `<li class="paso revelar"><h3>${esc(p.titulo)}</h3><p>${esc(p.texto)}</p></li>`).join('')}</ol>
</section>`;

const preguntas = (lista = PREGUNTAS) => `<section class="seccion envoltura" id="preguntas" aria-labelledby="preguntas-titulo">
  <div class="seccion__cabeza seccion__cabeza--centro">
    <p class="antetitulo">${icono('question')}Preguntas frecuentes</p>
    <h2 id="preguntas-titulo" class="seccion__titulo">Lo que nos preguntan los médicos</h2>
  </div>
  <div class="preguntas">${lista.map(([q, a]) => `<details class="pregunta"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
</section>`;

function pruebaConRegistro(prefijo = DESDE_MED, inicio = '') {
  const t = P.PRUEBA_REGISTRO;
  return `<section class="prueba" id="prueba" aria-labelledby="prueba-titulo">
  <div class="envoltura prueba__fila prueba__fila--sola">
    <div class="prueba__texto">
      <p class="antetitulo antetitulo--oscuro">${icono('sparkle')}${P.PRUEBA_DIAS} días gratis</p>
      <h2 id="prueba-titulo" class="seccion__titulo">${esc(t.titulo)}</h2>
      <p class="seccion__bajada">${esc(t.bajada)}</p>
      <ul class="lista-check lista-check--clara" role="list">${t.puntos.map((x) => `<li>${icono('check')}${esc(x)}</li>`).join('')}</ul>
      <p><a class="boton boton--senal boton--grande" href="${destinoPrueba(prefijo, inicio)}">${esc(t.boton)}${icono('arrow-right')}</a></p>
    </div>
  </div>
</section>`;
}

function prueba() {
  if (REGISTRO) return pruebaConRegistro();
  const directo = [
    CONTACTO.whatsapp ? `<a class="prueba__directo" href="https://wa.me/${CONTACTO.whatsapp}">${icono('whatsapp-logo')}WhatsApp: +${CONTACTO.whatsapp.replace(/^507(\d{4})(\d{4})$/, '507 $1-$2')}</a>` : '',
    CONTACTO.correo ? `<a class="prueba__directo" href="mailto:${esc(CONTACTO.correo)}">${icono('envelope-simple')}${esc(CONTACTO.correo)}</a>` : '',
  ].join('');
  const botones = [
    CONTACTO.whatsapp ? `<button class="boton boton--senal" type="submit" value="whatsapp">${icono('whatsapp-logo')}Pedir por WhatsApp</button>` : '',
    CONTACTO.correo ? `<button class="boton ${CONTACTO.whatsapp ? 'boton--linea' : 'boton--senal'}" type="submit" value="correo">${icono('envelope-simple')}Pedir por correo</button>` : '',
  ].join('');
  return `<section class="prueba" id="prueba" aria-labelledby="prueba-titulo">
  <div class="envoltura prueba__fila">
    <div class="prueba__texto">
      <p class="antetitulo antetitulo--oscuro">${icono('sparkle')}${P.PRUEBA_DIAS} días gratis</p>
      <h2 id="prueba-titulo" class="seccion__titulo">${esc(P.PRUEBA.titulo)}</h2>
      <p class="seccion__bajada">${esc(P.PRUEBA.bajada)}</p>
      <ul class="lista-check lista-check--clara" role="list">${P.PRUEBA.puntos.map((x) => `<li>${icono('check')}${esc(x)}</li>`).join('')}</ul>
      ${directo ? `<p class="prueba__contacto">${directo}</p>` : `<p class="prueba__sin-contacto">${icono('envelope-simple')}${esc(P.PRUEBA.sinContacto)}</p>`}
    </div>
    ${
      hayContacto
        ? `<form class="prueba__form" data-prueba data-dias="${P.PRUEBA_DIAS}" data-whatsapp="${esc(CONTACTO.whatsapp || '')}" data-correo="${esc(CONTACTO.correo || '')}">
      <h3 class="prueba__form-titulo">Pide tu prueba</h3>
      <label class="campo"><span>Tu nombre</span><input name="nombre" autocomplete="name" required maxlength="80" /></label>
      <label class="campo"><span>Clínica o consultorio</span><input name="clinica" autocomplete="organization" required maxlength="100" /></label>
      <label class="campo campo--corto"><span>¿Cuántos médicos?</span><input name="medicos" type="number" min="1" max="50" value="1" inputmode="numeric" /></label>
      <fieldset class="campo">
        <legend>¿Qué quieres probar?</legend>
        <div class="opciones">
          <label><input type="radio" name="interes" value="los dos" checked /><span>Los dos</span></label>
          <label><input type="radio" name="interes" value="el expediente" /><span>El expediente</span></label>
          <label><input type="radio" name="interes" value="la agenda" /><span>La agenda</span></label>
        </div>
      </fieldset>
      <label class="campo"><span>Algo más <small>(opcional)</small></span><textarea name="nota" rows="2" maxlength="400"></textarea></label>
      <input type="hidden" name="plan" value="" />
      <div class="prueba__botones">${botones}</div>
      <p class="prueba__aviso">El mensaje se arma aquí y sale solo cuando tú lo mandas.</p>
    </form>`
        : ''
    }
  </div>
</section>`;
}

// El sitio (WebSite) es alphateklab entero: Google toma su nombre de la raíz, la portada de alphateklab, que lo declara
// igual. Ya no lleva «Citas Médicas de alphateklab» de nombre alterno (8-oct: el sitio tiene más productos).
const SITIO_LD = { '@type': 'WebSite', '@id': `${URL_BASE}#sitio`, url: URL_BASE, name: 'alphateklab', inLanguage: 'es', publisher: { '@id': `${URL_BASE}#organizacion` } };
const PRODUCTO_ID = `${URL_BASE}${MED}#producto`;

function datosEstructurados() {
  // Sin areaServed: alphateklab apunta también al mercado de afuera (Edwin, 10-oct), igual que en la portada.
  const org = { '@type': 'Organization', '@id': `${URL_BASE}#organizacion`, name: 'alphateklab', url: URL_BASE, logo: `${URL_BASE}assets/marca/favicon-180.png` };
  const mensual = (precio, unidad) => ({ '@type': 'UnitPriceSpecification', price: precio, priceCurrency: 'USD', unitText: unidad, billingDuration: 'P1M' });
  const app = {
    '@type': 'SoftwareApplication',
    '@id': PRODUCTO_ID,
    name: P.MARCA,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'es-PA',
    url: `${URL_BASE}${MED}`,
    description: sinMarcas(P.HEROE.bajada),
    provider: { '@id': `${URL_BASE}#organizacion` },
    offers: [
      { '@type': 'Offer', name: P.PARTES.find((p) => p.id === 'expediente').nombre, price: P.PRECIOS.expediente, priceCurrency: 'USD', priceSpecification: mensual(P.PRECIOS.expediente, 'profesional') },
      { '@type': 'Offer', name: P.PARTES.find((p) => p.id === 'agenda').nombre, price: P.PRECIOS.agenda, priceCurrency: 'USD', priceSpecification: mensual(P.PRECIOS.agenda, 'clínica') },
      ...P.PRECIOS.mensajes.filter((t) => t.mensajes > 0).map((t) => ({ '@type': 'Offer', name: `${t.mensajes} mensajes automáticos de WhatsApp al mes, aparte de la agenda`, price: t.precio, priceCurrency: 'USD', priceSpecification: mensual(t.precio, 'clínica') })),
    ],
  };
  const faq = { '@type': 'FAQPage', mainEntity: PREGUNTAS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return { '@context': 'https://schema.org', '@graph': [org, SITIO_LD, app, faq] };
}

// En Google se ven ~60 caracteres del título y ~155 de la descripción: lo que se busca va primero.
// «citas médicas» se queda en el título: es lo que se busca (el producto se llamó así hasta el 10-oct).
const TITULO_INICIO = `${P.PRODUCTO}: expediente clínico con IA y agenda de citas médicas en Panamá`;
const DESCRIPCION_INICIO = `El médico dicta la nota de cada consulta y el sistema la escribe con IA. Agenda de citas con recordatorios por WhatsApp. Desde ${dolares(P.DESDE)} al mes, ${P.PRUEBA_DIAS} días gratis.`;

function paginaInicio() {
  return documento({
    titulo: TITULO_INICIO,
    descripcion: DESCRIPCION_INICIO,
    prefijo: DESDE_MED,
    inicio: '',
    canonica: `${URL_BASE}${MED}`,
    datos: datosEstructurados(),
    cuerpo: () => `<main id="contenido">
${heroe()}
${partes()}
${seccionParte('expediente')}
${seccionParte('agenda')}
${accesos()}
${precios()}
${pasos()}
${preguntas()}
${prueba()}
</main>`,
  });
}

// alphateklab.com/<ruta>: una parte del producto con detalle (datos/paginas.mjs), para quien llega buscándola.
function paginaFuncion(f) {
  const prefijo = '../';
  const url = `${URL_BASE}${f.ruta}`;
  const datos = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': url, url, name: f.titulo, description: f.descripcion, inLanguage: 'es-PA', about: { '@id': PRODUCTO_ID }, isPartOf: { '@id': `${URL_BASE}#sitio` }, breadcrumb: { '@id': `${url}#migas` } },
      { '@type': 'BreadcrumbList', '@id': `${url}#migas`, itemListElement: [{ '@type': 'ListItem', position: 1, name: P.PRODUCTO, item: `${URL_BASE}${MED}` }, { '@type': 'ListItem', position: 2, name: f.miga, item: url }] },
      { '@type': 'FAQPage', mainEntity: f.preguntas.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };
  const seccionPuntos = (id, b) => `<section class="seccion envoltura" id="${id}" aria-labelledby="${id}-titulo">
  <div class="seccion__cabeza">
    <p class="antetitulo">${icono('sparkle')}${esc(b.antetitulo)}</p>
    <h2 id="${id}-titulo" class="seccion__titulo">${esc(b.titulo)}</h2>
    <p class="seccion__bajada">${esc(b.bajada)}</p>
  </div>
  ${garantias(b.puntos)}${b.nota ? `\n  <p class="seccion__nota"><a href="${prefijo}privacidad/#dictado">${esc(b.nota)}${icono('arrow-right')}</a></p>` : ''}
</section>`;
  return documento({
    titulo: f.titulo,
    descripcion: f.descripcion,
    prefijo,
    canonica: url,
    datos,
    cuerpo: () => `<main id="contenido">
<section class="heroe heroe--funcion" aria-labelledby="heroe-titulo">
  <div class="heroe__fondo" aria-hidden="true"></div>
  <div class="envoltura heroe__fila">
    <div class="heroe__texto">
      <nav class="migas" aria-label="Estás en"><ol><li><a href="${inicioDesde(prefijo)}">${esc(P.PRODUCTO)}</a></li><li aria-current="page">${esc(f.miga)}</li></ol></nav>
      <p class="antetitulo">${icono('stethoscope')}${esc(f.antetitulo)}</p>
      <h1 id="heroe-titulo" class="heroe__titulo">${esc(f.h1)}</h1>
      <p class="heroe__bajada">${esc(f.bajada)}</p>
      <div class="heroe__acciones">
        <a class="boton boton--senal boton--grande" href="${registroCon(f.registro, prefijo)}">${esc(f.boton)}${icono('arrow-right')}</a>
        <a class="boton boton--linea boton--grande" href="${inicioDesde(prefijo)}#precios">Ver precios</a>
      </div>
      <ul class="heroe__puntos" role="list">${f.puntos.map((x) => `<li>${icono('check')}${esc(x)}</li>`).join('')}</ul>
    </div>
    <figure class="heroe__visual">
      <div class="heroe__dispositivos">${portatil(prefijo, f.visual.imagen, f.visual.alt, { prioridad: true })}</div>
      <figcaption>Pantalla real del sistema, con un consultorio de ejemplo y pacientes ficticios.</figcaption>
    </figure>
  </div>
</section>
${seccionPuntos('guarda', f.guarda)}
<section class="seccion producto" aria-label="Cómo se usa">
  <div class="envoltura">
    ${filasHtml(f.filas, prefijo)}
  </div>
</section>
${seccionPuntos('audio', f.audio)}
<section class="seccion envoltura" id="accesos" aria-labelledby="accesos-titulo">
  <div class="seccion__cabeza">
    <p class="antetitulo">${icono('lock-key')}Privacidad</p>
    <h2 id="accesos-titulo" class="seccion__titulo">${esc(f.accesos.titulo)}</h2>
    <p class="seccion__bajada">${esc(f.accesos.bajada)}</p>
  </div>
  ${garantias(f.accesos.puntos)}${f.guia ? `\n  <p class="seccion__nota"><a href="${prefijo}${f.guia.ruta}">${esc(f.guia.texto)}${icono('arrow-right')}</a></p>` : ''}
</section>
<section class="seccion envoltura" id="precio" aria-labelledby="precio-titulo">
  <div class="plan plan--suelto revelar">
    <p class="antetitulo">${icono('currency-circle-dollar')}Precio</p>
    <h2 id="precio-titulo" class="seccion__titulo">${esc(f.precio.titulo)}</h2>
    ${f.precio.textos.map((x) => `<p>${esc(x)}</p>`).join('\n    ')}
    <p class="plan__acciones"><a class="boton boton--senal" href="${registroCon(f.registro, prefijo)}">${esc(f.boton)} ${P.PRUEBA_DIAS} días gratis</a> <a class="boton boton--linea" href="${inicioDesde(prefijo)}#precios">Ver todos los precios</a></p>
  </div>
</section>
${preguntas(f.preguntas)}
${pruebaConRegistro(prefijo)}
</main>`,
  });
}

// Un texto de las guías: escapado y con los enlaces [texto](dirección).
const enLinea = (t) => esc(t).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, x, u) => `<a href="${u}">${x}</a>`);
const bloque = (b) => {
  if (typeof b === 'string') return `<p>${enLinea(b)}</p>`;
  if (b.lista) return `<ul class="guia__lista">${b.lista.map((x) => `<li>${enLinea(x)}</li>`).join('')}</ul>`;
  if (b.cita) return `<figure class="guia__cita"><blockquote><p>«${esc(b.cita)}»</p></blockquote><figcaption>${esc(b.fuente)}</figcaption></figure>`;
  throw new Error(`Bloque de guía desconocido: ${JSON.stringify(b).slice(0, 80)}`);
};

// alphateklab.com/<ruta>: una guía (datos/guias-citas.mjs), con su índice, sus fuentes y la llamada al producto.
function paginaGuia(g) {
  const prefijo = '../';
  const url = `${URL_BASE}${g.ruta}`;
  const datos = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', '@id': `${url}#guia`, headline: g.h1, description: g.descripcion, inLanguage: 'es-PA', datePublished: g.publicada, dateModified: g.revisada.iso, mainEntityOfPage: url, author: { '@id': `${URL_BASE}#organizacion` }, publisher: { '@id': `${URL_BASE}#organizacion` }, isPartOf: { '@id': `${URL_BASE}#sitio` }, about: { '@id': PRODUCTO_ID }, citation: g.fuentes.map(([, u]) => u) },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: P.PRODUCTO, item: `${URL_BASE}${MED}` }, { '@type': 'ListItem', position: 2, name: g.miga, item: url }] },
    ],
  };
  return documento({
    titulo: g.titulo,
    descripcion: g.descripcion,
    prefijo,
    canonica: url,
    datos,
    cuerpo: () => `<main id="contenido" class="envoltura texto-largo guia">
  <nav class="migas" aria-label="Estás en"><ol><li><a href="${inicioDesde(prefijo)}">${esc(P.PRODUCTO)}</a></li><li aria-current="page">${esc(g.miga)}</li></ol></nav>
  <p class="antetitulo">${icono('book-open-text')}Guía</p>
  <h1 class="texto-largo__titulo">${esc(g.h1)}</h1>
  <p class="guia__bajada">${esc(g.bajada)}</p>
  <p class="texto-largo__fecha">Revisada el <time datetime="${g.revisada.iso}">${esc(g.revisada.texto)}</time>. Las fuentes van al final.</p>
  <nav class="guia__indice" aria-labelledby="indice-titulo"><h2 id="indice-titulo">En esta guía</h2><ol>${g.secciones.map((x) => `<li><a href="#${x.id}">${esc(x.titulo)}</a></li>`).join('')}<li><a href="#fuentes">Fuentes</a></li></ol></nav>
  ${g.secciones.map((x) => `<section class="guia__seccion" id="${x.id}" aria-labelledby="${x.id}-titulo"><h2 id="${x.id}-titulo">${esc(x.titulo)}</h2>${x.bloques.map(bloque).join('')}</section>`).join('\n  ')}
  <section class="guia__seccion" id="fuentes" aria-labelledby="fuentes-titulo"><h2 id="fuentes-titulo">Fuentes</h2><ol class="guia__fuentes">${g.fuentes.map(([t, u]) => `<li><a href="${u}">${esc(t)}</a></li>`).join('')}</ol><p>Leídas en la Gaceta Oficial o en copias oficiales el ${esc(g.revisada.texto)}. Esta guía resume normas publicadas y no es asesoría legal.</p></section>
  <aside class="guia__producto"><p class="antetitulo">${icono('stethoscope')}${esc(P.PRODUCTO)}</p><p><strong>El expediente clínico que dictas en vez de escribir.</strong> Cada nota con el nombre de quien la escribió y la hora, accesos por persona y el consentimiento del paciente guardado. ${esc(dolares(P.PRECIOS.expediente))} al mes por profesional, ${P.PRUEBA_DIAS} días gratis.</p><p class="plan__acciones"><a class="boton boton--senal" href="${prefijo}${FUNCIONES[0].ruta}">Ver el expediente${icono('arrow-right')}</a> <a class="boton boton--linea" href="${destinoPrueba(prefijo)}">Probar ${P.PRUEBA_DIAS} días gratis</a></p></aside>
</main>`,
  });
}

function paginaPrivacidad() {
  const prefijo = '../';
  return documento({
    titulo: `Privacidad · ${P.MARCA}`,
    descripcion: `Qué datos trata alphateklab.com, qué pasa con los datos de los pacientes en ${P.PRODUCTO} y con el audio del dictado con IA.`,
    prefijo,
    canonica: `${URL_BASE}privacidad/`,
    cuerpo: () => `<main id="contenido" class="envoltura texto-largo">
  <p class="antetitulo">${icono('shield-check')}Privacidad</p>
  <h1 class="texto-largo__titulo">Privacidad</h1>
  <p class="texto-largo__fecha">Vigente desde el ${esc(ACTUALIZADO.texto)}. Se rige por la Ley 81 de 2019 de protección de datos personales de Panamá y su reglamento, el Decreto Ejecutivo 285 de 2021.</p>
  <h2>Este sitio</h2>
  <p>No usa cookies, ni analítica, ni píxeles de redes sociales${HAY_FOOD ? '' : ', ni formularios que envíen datos a un servidor'}.</p>${
    HAY_FOOD
      ? `\n  <p id="contacto">El formulario de contacto de Food (<a href="${prefijo}food/#contacto">alphateklab.com/food/</a>) manda tu nombre, tu correo y tu mensaje a FormSubmit (formsubmit.co), un servicio que nos los reenvía por correo. Los usamos solo para responderte.</p>`
      : ''
  }
  <p>El formulario para pedir la prueba arma el mensaje en tu navegador. Solo sale de tu equipo si tú lo mandas por WhatsApp o por correo, y desde ahí rigen las políticas de esos servicios. Las fuentes y las imágenes se sirven desde este mismo sitio.</p>
  <h2>El sistema ${esc(P.PRODUCTO)}</h2>
  <p>Los datos de los pacientes que un consultorio guarda en el sistema son de ese consultorio. Antes de guardarlos, el paciente acepta su uso según la Ley 81 de 2019, en la recepción o desde su teléfono, y queda la fecha y la forma en que lo aceptó.</p>
  <h2 id="dictado">El dictado con IA</h2>
  <p>Cuando un médico dicta en el expediente, el audio de ese fragmento pasa por nuestro servidor, sin guardarse, hasta AssemblyAI, un servicio de transcripción de voz médica con servidores en Estados Unidos. AssemblyAI devuelve el texto y, apenas llega, le pedimos que borre la transcripción y el audio. Lo que queda es el texto que el médico revisa y guarda en el expediente de su consultorio.</p>
  <p>Con AssemblyAI tenemos firmado un acuerdo para el tratamiento de datos de salud (Business Associate Agreement), y el audio no se usa para entrenar sus modelos. Solo pueden dictar las personas a las que el consultorio les dio el acceso «Notas».</p>
  <p>Las pantallas de este sitio muestran un consultorio de ejemplo con pacientes ficticios.</p>
  <p><a href="${prefijo}">Volver al inicio</a></p>
</main>`,
  });
}

// alphateklab.com/registro/: lleva al registro del servicio de cuentas con el plan elegido (los parámetros de la
// dirección), en cuanto ese servicio responde. Si todavía no está en línea, lo dice y vuelve a probar sola.
function paginaPuenteRegistro() {
  const prefijo = '../';
  return documento({
    titulo: `Crear mi cuenta · ${P.MARCA}`,
    descripcion: `Crea tu cuenta de ${P.PRODUCTO}: ${P.PRUEBA_DIAS} días gratis, sin tarjeta.`,
    prefijo,
    canonica: `${URL_BASE}registro/`,
    robots: 'noindex',
    cuerpo: () => `<main id="contenido" class="envoltura texto-largo texto-largo--centro">
  <p class="antetitulo">${icono('sparkle')}${P.PRUEBA_DIAS} días gratis</p>
  <h1 class="texto-largo__titulo" data-puente-titulo>Abriendo el registro…</h1>
  <p data-puente-texto>Un momento: te llevamos a crear tu cuenta.</p>
  <p><a class="boton boton--senal" href="${esc(REGISTRO)}" data-puente-enlace>Crear mi cuenta</a></p>
  <script>
  (function () {
    var destino = ${JSON.stringify(REGISTRO)} + location.search;
    var enlace = document.querySelector('[data-puente-enlace]');
    enlace.href = destino;
    var intentos = 0;
    function probar() {
      fetch(${JSON.stringify(new URL('/salud', REGISTRO).href)}, { mode: 'no-cors', cache: 'no-store' })
        .then(function () { location.replace(destino); })
        .catch(function () {
          intentos++;
          document.querySelector('[data-puente-titulo]').textContent = 'El registro abre en unas horas';
          document.querySelector('[data-puente-texto]').textContent = 'Estamos terminando de ponerlo en línea. Esta página vuelve a intentarlo sola; si prefieres, regresa más tarde.';
          enlace.hidden = true;
          if (intentos < 40) setTimeout(probar, 30000);
        });
    }
    probar();
  })();
  </script>
</main>`,
  });
}

// alphateklab.com/entrar/: «Iniciar sesión». Cada clínica tiene su sistema en <usuario>.alphateklab.com: aquí se
// escribe el usuario y se pasa a la entrada de ese sistema, con el usuario ya escrito. El de quien registró la clínica
// es la dirección; los de su equipo la llevan delante (luisprueba.secretaria). Si pega la dirección, también sirve.
// Con el correo no se sabe cuál es la clínica (el sitio no consulta a nadie): se le pide el usuario.
function paginaEntrar() {
  const prefijo = '../';
  return documento({
    titulo: `Iniciar sesión · ${P.MARCA}`,
    descripcion: `Entra a tu sistema de ${P.PRODUCTO} con tu usuario o tu correo.`,
    prefijo,
    canonica: `${URL_BASE}entrar/`,
    robots: 'noindex',
    cuerpo: () => `<main id="contenido" class="envoltura texto-largo texto-largo--centro entrar">
  <p class="antetitulo">${icono('lock-key')}Iniciar sesión</p>
  <h1 class="texto-largo__titulo">Entra a tu sistema</h1>
  <p>Escribe tu usuario o el correo con el que te registraste. El usuario también es la primera parte de la dirección de tu sistema: <strong>tuusuario.${esc(DOMINIO_CLINICAS)}</strong></p>
  <form class="entrar__form" data-entrar novalidate>
    <label class="campo"><span>Usuario o correo</span><input name="usuario" type="text" maxlength="120" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="tuusuario o tu@correo.com" /></label>
    <p class="entrar__destino" data-destino aria-live="polite"></p>
    <p class="entrar__error" data-error role="alert" hidden></p>
    <button class="boton boton--senal boton--grande" type="submit">Continuar</button>
  </form>
  <p class="entrar__nota">¿Todavía no tienes cuenta? <a href="${destinoPrueba(prefijo)}">Pruébalo ${P.PRUEBA_DIAS} días gratis</a>.</p>
  <script>
  (function () {
    var DOMINIO = ${JSON.stringify(DOMINIO_CLINICAS)};
    var CUENTAS = ${JSON.stringify(new URL(REGISTRO).origin)};
    var form = document.querySelector('[data-entrar]');
    var campo = form.elements.usuario;
    var boton = form.querySelector('[type=submit]');
    var destino = document.querySelector('[data-destino]');
    var error = document.querySelector('[data-error]');
    function avisar(texto) { error.textContent = texto; error.hidden = false; destino.textContent = ''; campo.focus(); }
    // «luisprueba», «luisprueba.secretaria», la dirección pegada o el correo de quien registró la clínica (Edwin,
    // 8-oct: «que me permita ambos»). La clínica, si el servicio de cuentas no contesta: lo de antes del primer punto
    // (con el correo no se puede adivinar: hace falta que conteste).
    function leer(texto) {
      var t = String(texto || '').trim().toLowerCase().replace(/\\s+/g, '');
      if (!t) return { error: 'Escribe tu usuario o tu correo.' };
      if (t.indexOf('@') >= 0) {
        if (!/^[^@]+@[^@]+\\.[^@]+$/.test(t)) return { error: 'Revisa el correo: parece incompleto.' };
        return { usuario: t, correo: true };
      }
      t = t.replace(/^[a-z]+:\\/\\//, '').split('/')[0];
      var sufijo = '.' + DOMINIO;
      var usuario = t.slice(-sufijo.length) === sufijo ? t.slice(0, -sufijo.length) : t;
      var clinica = usuario.split('.')[0];
      if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(clinica) || clinica.indexOf('--') >= 0 || clinica === 'cuentas' || clinica === 'www') {
        return { error: 'Revisa el usuario: lleva letras, números y guiones, como el que elegiste al registrarte.' };
      }
      return { usuario: usuario, clinica: clinica };
    }
    function ir(r, clinica) {
      destino.textContent = 'Entrando a ' + clinica + '.' + DOMINIO + '…';
      try { localStorage.setItem('atk-ultimo-usuario', r.usuario); } catch (e) {}
      location.assign('https://' + clinica + '.' + DOMINIO + '/entrar.html?usuario=' + encodeURIComponent(r.usuario));
    }
    // El último usuario con el que se entró desde este equipo.
    try { var ultimo = localStorage.getItem('atk-ultimo-usuario'); if (ultimo && !campo.value) campo.value = ultimo; } catch (e) {}
    campo.addEventListener('input', function () { error.hidden = true; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var r = leer(campo.value);
      if (r.error) { avisar(r.error); return; }
      error.hidden = true;
      boton.disabled = true;
      // El servicio de cuentas dice de qué clínica es (en las cuentas viejas el usuario no es la dirección). Si no
      // contesta a tiempo, se va por la dirección.
      var hecho = false;
      function terminar(clinica) {
        if (hecho) return;
        hecho = true;
        clearTimeout(reloj);
        if (clinica) { ir(r, clinica); return; }
        boton.disabled = false;
        avisar(r.correo ? 'No encontramos una clínica registrada con ese correo. Revisa cómo lo escribiste, o entra con tu usuario.'
          : 'No encontramos ese usuario. Revisa cómo lo escribiste: es el que elegiste al registrarte.');
      }
      var reloj = setTimeout(function () { terminar(r.clinica); }, 6000);
      fetch(CUENTAS + '/api/clinica?usuario=' + encodeURIComponent(r.usuario), { cache: 'no-store' })
        .then(function (resp) {
          if (resp.status === 404) { terminar(null); return null; }
          return resp.ok ? resp.json() : { slug: r.clinica };
        })
        .then(function (j) { if (j) terminar(j.slug || r.clinica); })
        .catch(function () { terminar(r.clinica); });
    });
  })();
  </script>
</main>`,
  });
}

function paginaTerminos() {
  const prefijo = '../';
  return documento({
    titulo: `Términos del servicio · ${P.MARCA}`,
    descripcion: `Las condiciones de ${P.PRODUCTO}: la prueba, los pagos, la cancelación y los datos de tus pacientes.`,
    prefijo,
    canonica: `${URL_BASE}terminos/`,
    cuerpo: () => `<main id="contenido" class="envoltura texto-largo">
  <p class="antetitulo">${icono('clipboard-text')}Términos</p>
  <h1 class="texto-largo__titulo">Términos del servicio</h1>
  <p class="texto-largo__fecha">Vigentes desde el ${esc(TERMINOS.VIGENTE)}.</p>
  ${TERMINOS.SECCIONES.map(([t, ps]) => `<h2>${esc(t)}</h2>\n  ${ps.map((x) => `<p>${esc(x)}</p>`).join('\n  ')}`).join('\n  ')}
  <p><a href="${prefijo}">Volver al inicio</a></p>
</main>`,
  });
}

function pagina404() {
  const prefijo = '/';
  return documento({
    titulo: 'Esta página no existe · alphateklab',
    descripcion: 'La página que buscas no existe.',
    prefijo,
    canonica: `${URL_BASE}404.html`,
    robots: 'noindex',
    cuerpo: () => `<main id="contenido" class="envoltura texto-largo texto-largo--centro">
  <p class="antetitulo">${icono('question')}Error 404</p>
  <h1 class="texto-largo__titulo">Esta página no existe</h1>
  <p>La dirección cambió o no existe. Empieza por la portada de alphateklab, o ve directo a ${esc(P.PRODUCTO)}: el expediente clínico que el médico dicta con IA y la agenda con recordatorios por WhatsApp.</p>
  <p><a class="boton boton--senal" href="${prefijo}">Ir a la portada</a> <a class="boton boton--linea" href="${inicioDesde(prefijo)}">Ver ${esc(P.PRODUCTO)}</a></p>
</main>`,
  });
}

// /citasmed/: la dirección que se pensó primero para el producto; lleva a su portada, en med/.
const paginaCitasmed = () => `<!doctype html>
<html lang="es-PA">
<head>
<meta charset="utf-8" />
<title>${esc(P.PRODUCTO)} · alphateklab</title>
<link rel="canonical" href="${URL_BASE}${MED}" />
<meta name="robots" content="noindex" />
<meta http-equiv="refresh" content="0; url=../${MED}" />
</head>
<body>
<p><a href="../${MED}">${esc(P.PRODUCTO)}</a></p>
</body>
</html>
`;

// Lo que va al sitemap y a IndexNow: lo que se quiere ver en los buscadores (registro, entrar y el 404 llevan noindex).
// La raíz es la portada de alphateklab (generar-portada.mjs --raiz).
const INDEXABLES = ['', MED, ...FUNCIONES.map((f) => f.ruta), ...GUIAS.map((g) => g.ruta), ...(HAY_FOOD ? ['food/'] : []), 'terminos/', 'privacidad/'];

const sitemap = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${INDEXABLES.map((u) => `  <url><loc>${URL_BASE}${u}</loc><lastmod>${ACTUALIZADO.iso}</lastmod></url>`).join('\n')}
</urlset>
`;

// /llms.txt: el resumen del producto para los asistentes (ChatGPT, Perplexity…), que es por donde más llega la gente a
// alphatend. Sale de los mismos datos que la portada. Las preguntas de los paquetes de mensajes quedan fuera mientras
// los socios deciden qué se promete de ellos (ver datos/paginas.mjs).
function llms() {
  const exp = P.PARTES.find((p) => p.id === 'expediente');
  const agenda = P.PARTES.find((p) => p.id === 'agenda');
  const paquetes = P.PRECIOS.mensajes.filter((m) => m.mensajes).map((m) => `${m.mensajes} por ${dolares(m.precio)}`).join(', ').replace(/, ([^,]+)$/, ' o $1');
  return `# ${P.MARCA}

> Sistema web para clínicas y consultorios en Panamá: el expediente clínico, que el médico dicta con IA en vez de escribirlo a mano o teclearlo, y la agenda de citas con recordatorios por WhatsApp. Se usa en el navegador de la computadora, la tableta o el celular, sin instalar nada. Cada clínica tiene su propio sistema en <clínica>.alphateklab.com.

## Páginas

- [alphateklab](${URL_BASE}): la portada, con todos los productos de alphateklab: ${P.PRODUCTO}, Food y alphatend.
- [${P.PRODUCTO}](${URL_BASE}${MED}): el producto completo, con pantallas reales, precios, calculadora y preguntas frecuentes.
${FUNCIONES.map((f) => `- [${f.titulo.replace(/ · .*$/, '')}](${URL_BASE}${f.ruta}): ${f.descripcion}`).join('\n')}
${GUIAS.map((g) => `- [${g.h1}](${URL_BASE}${g.ruta}): guía con la norma y el artículo de cada punto. ${g.descripcion}`).join('\n')}
- [Términos del servicio](${URL_BASE}terminos/): la prueba, los pagos, la cancelación y los datos de los pacientes.
- [Privacidad](${URL_BASE}privacidad/): qué datos trata el sitio, qué pasa con los de los pacientes y con el audio del dictado.

## Precios

En dólares, al mes y netos (sin sumar ITBMS):

- ${exp.nombre}: ${dolares(P.PRECIOS.expediente)} ${exp.unidad}. Profesional es cada médico que hace expedientes; la recepción, enfermería y administración tienen su usuario sin costo. El dictado con IA va incluido.
- ${agenda.nombre}: ${dolares(P.PRECIOS.agenda)} ${agenda.unidad}. ${paquetes ? `Los mensajes de WhatsApp van aparte, por paquete: ${paquetes} al mes.` : 'Los recordatorios por WhatsApp los manda la recepción con un toque, sin costo aparte.'}
- Prueba gratis de ${P.PRUEBA_DIAS} días, sin tarjeta. Después, mes a mes, sin plan anual. Se paga con tarjeta de crédito o débito.

## Preguntas frecuentes

${PREGUNTAS.filter(([q]) => !/mensajes/i.test(q)).map(([q, a]) => `- ${q} ${a}`).join('\n')}

## Probarlo

Una clínica crea su cuenta sola en ${URL_BASE}registro/ y su sistema queda listo al momento.
${HAY_FOOD ? `
## También de alphateklab

- [Food, para cafeterías, bares y restaurantes](${URL_BASE}food/): ${FOOD.descripcion}
` : ''}`;
}

// SALIDA=<carpeta> escribe en otra parte (la prueba lo usa para ver que lo publicado está al día).
const SALIDA = process.env.SALIDA || RAIZ;
const escribir = (ruta, contenido) => {
  mkdirSync(dirname(join(SALIDA, ruta)), { recursive: true });
  writeFileSync(join(SALIDA, ruta), contenido);
};

escribir(`${MED}index.html`, paginaInicio());
escribir('privacidad/index.html', paginaPrivacidad());
for (const f of FUNCIONES) escribir(`${f.ruta}index.html`, paginaFuncion(f));
for (const g of GUIAS) escribir(`${g.ruta}index.html`, paginaGuia(g));
escribir('404.html', pagina404());
escribir('terminos/index.html', paginaTerminos());
if (REGISTRO) escribir('registro/index.html', paginaPuenteRegistro());
if (REGISTRO) escribir('entrar/index.html', paginaEntrar());
escribir('citasmed/index.html', paginaCitasmed());
escribir('sitemap.xml', sitemap());
escribir('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${URL_BASE}sitemap.xml\n`);
escribir(`${INDEXNOW}.txt`, INDEXNOW);
escribir('llms.txt', llms());
console.log(`Generado: portada de ${P.PRODUCTO} (${MED}), páginas de función, guías, términos, privacidad, 404, /citasmed/, sitemap, robots.txt y llms.txt.${REGISTRO ? ` «Probar gratis» lleva al registro (${REGISTRO}).` : hayContacto ? '' : ' Sin registro ni contacto en datos/sitio.mjs: la portada sale sin el formulario de la prueba.'}`);
