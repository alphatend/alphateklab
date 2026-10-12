// Portada de alphateklab con todas las categorías (Med, Food y alphatend) y la página de Food (Sobremesa, Vuelve, el
// sistema a la medida y el formulario de contacto), desde datos/portada.mjs y datos/food.mjs. Med vive en med/ (la
// escribe herramientas/generar-citas.mjs). Un servicio de Food con `publicado: false` no sale en ninguna de las dos:
// así está Vuelve desde el 11-oct (Edwin: de momento no se ofrece).
//
//   node herramientas/generar-portada.mjs          → vista previa en portada-nueva/ (no se indexa ni se publica)
//   node herramientas/generar-portada.mjs --raiz   → index.html (la portada del sitio) y food/, en la raíz
//
// Después de --raiz, node herramientas/generar-citas.mjs: el sitemap y llms.txt nombran la portada y food/.
// «Contactar» lleva al formulario de Food (nombre, correo y lo que necesitan; sin WhatsApp). Los mensajes los recibe
// FormSubmit en el `destino` de datos/food.mjs: sin destino, --raiz no genera (el formulario no llegaría).
// No se edita el HTML generado: se cambian los datos o este archivo y se vuelve a generar.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOOD } from '../datos/food.mjs';
import { PORTADA, PRODUCTOS } from '../datos/portada.mjs';

const RAIZ_REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const raiz = process.argv.includes('--raiz');
const BASE = raiz ? '' : 'portada-nueva/'; // carpeta de la portada dentro del repositorio
const SITIO = 'https://alphateklab.com/';
// SALIDA=<carpeta> escribe en otra parte (la prueba lo usa para ver que lo publicado está al día).
const SALIDA = process.env.SALIDA || RAIZ_REPO;
const destino = process.env.FORM_DESTINO || FOOD.formulario.destino;
if (raiz && !destino) {
  throw new Error('Falta el destino del formulario (FOOD.formulario.destino en datos/food.mjs): sin él los mensajes no llegan y no se publica.');
}

// Los servicios de Food que salen en la web; Vuelve, solo si está publicada.
const SERVICIOS = FOOD.servicios.filter((s) => s.publicado !== false);
const CON_VUELVE = SERVICIOS.some((s) => s.id === 'vuelve');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const version = (archivo) => createHash('sha256').update(readFileSync(join(RAIZ_REPO, archivo))).digest('hex').slice(0, 10);

// Íconos del sprite de la casa (assets/iconos.svg, Phosphor), solo los que usan estas páginas.
const SPRITE = readFileSync(join(RAIZ_REPO, 'assets/iconos.svg'), 'utf8');
const SIMBOLOS = new Map([...SPRITE.matchAll(/<symbol id="i-([\w-]+)"[\s\S]*?<\/symbol>/g)].map((m) => [m[1], m[0]]));
const USADOS = [
  'moon', 'sun', 'list', 'x', 'check', 'arrow-right', 'envelope-simple', 'microphone',
  ...new Set([
    ...PRODUCTOS.map((p) => p.glifo),
    ...SERVICIOS.map((s) => s.glifo),
    ...[...FOOD.sobremesa.pasos, ...(CON_VUELVE ? FOOD.vuelve.pasos : [])].map((x) => x.icono),
  ]),
];
for (const n of USADOS) if (!SIMBOLOS.has(n)) throw new Error(`Falta el ícono «${n}» en assets/iconos.svg`);
const ICONOS = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${USADOS.map((n) => SIMBOLOS.get(n)).join('')}</svg>`;
const ico = (n, clase = 'ico') => `<svg class="${clase}" aria-hidden="true" focusable="false"><use href="#i-${n}"></use></svg>`;
/** Ícono de app: el glifo en blanco sobre un cuadro con el degradado del producto. */
const app = (id, glifo, tam = '') => `<span class="app app--${id}${tam ? ` app--${tam}` : ''}" aria-hidden="true">${ico(glifo)}</span>`;

/**
 * Cada página sabe dónde está (`ruta`, desde la raíz del repositorio) y arma sus enlaces desde ahí.
 * - `a(ruta)`: a otra página o recurso del sitio, dado desde la raíz del sitio (Med es `med/`).
 * - `portada(ruta)` y `food(ruta)`: a esas dos páginas (en la vista previa, las de portada-nueva/).
 */
function rutas(ruta) {
  const pre = '../'.repeat(ruta.split('/').length - 1);
  return {
    a: (r) => (/^https?:|^mailto:/.test(r) ? r : `${pre}${r}`),
    recurso: (archivo) => `${pre}${archivo}?v=${version(archivo)}`,
    portada: (r = '') => `${pre}${BASE}${r}`,
    food: (r = '') => `${pre}${BASE}food/${r}`,
  };
}

function boton(a, R) {
  let href;
  let afuera = false;
  if (a.href === '{contacto}') href = R.food('#contacto'); // el formulario de Food
  else if (/^https?:\/\//.test(a.href)) [href, afuera] = [a.href, true];
  else if (a.href.startsWith('food/')) href = R.food(a.href.slice('food/'.length));
  else href = R.a(a.href);
  const extra = afuera ? ' target="_blank" rel="noopener"' : '';
  const flecha = a.tipo === 'principal' ? ico('arrow-right') : '';
  return `<a class="accion accion--${a.tipo}" href="${esc(href)}"${extra}><span>${esc(a.texto)}</span>${flecha}</a>`;
}

const luces = '<div class="portada-heroe__luces" aria-hidden="true"><span></span><span></span><span></span><span></span></div>';

// ─────────────────────────────── piezas comunes ───────────────────────────────

function cabeza({ R, titulo, descripcion, canonica }) {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITIO}#organizacion`,
        name: 'alphateklab',
        url: SITIO,
        logo: `${SITIO}assets/marca/favicon-180.png`,
      },
      { '@type': 'WebSite', '@id': `${SITIO}#sitio`, url: SITIO, name: 'alphateklab', inLanguage: 'es', publisher: { '@id': `${SITIO}#organizacion` } },
    ],
  };
  return `<!doctype html>
<html lang="es" data-theme="light">
<head>
<meta charset="utf-8" />
<script>try{if(localStorage.getItem('atk-tema')==='oscuro')document.documentElement.dataset.theme='dark'}catch(e){}</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}" />
${raiz ? `<link rel="canonical" href="${canonica}" />` : '<meta name="robots" content="noindex, nofollow" />'}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="alphateklab" />
<meta property="og:title" content="${esc(titulo)}" />
<meta property="og:description" content="${esc(descripcion)}" />
<meta property="og:url" content="${canonica}" />
<meta property="og:locale" content="es_LA" />
<meta name="theme-color" content="#f6f7f9" />
<link rel="icon" href="${R.a('assets/marca/favicon.svg')}" type="image/svg+xml" />
<link rel="icon" href="${R.a('assets/marca/favicon-32.png')}" sizes="32x32" type="image/png" />
<link rel="apple-touch-icon" href="${R.a('assets/marca/favicon-180.png')}" />
<link rel="preload" href="${R.a('assets/fuentes/manrope-latin.woff2')}" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="${R.a('assets/fuentes/inter-latin.woff2')}" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="${R.recurso('assets/atk.css')}" />
<link rel="stylesheet" href="${R.recurso('assets/citas.css')}" />
<link rel="stylesheet" href="${R.recurso('assets/portada.css')}" />
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body class="portada">
<a class="saltar" href="#contenido">Saltar al contenido</a>
${ICONOS}`;
}

function cabecera({ R, menu, accion, movil = '' }) {
  const items = menu.map(([texto, href]) => `<li><a href="${esc(href)}">${esc(texto)}</a></li>`).join('');
  return `<header class="cab" data-cab>
  <div class="envoltura cab__fila">
    <a class="cab__marca" href="${R.portada()}"><img class="logo logo--claro" src="${R.a('assets/marca/logo-claro.svg')}" alt="alphateklab, inicio" width="142" height="32" /><img class="logo logo--oscuro" src="${R.a('assets/marca/logo-oscuro.svg')}" alt="alphateklab, inicio" width="142" height="32" /></a>
    <nav class="cab__menu" aria-label="Principal"><ul>${items}</ul></nav>
    <div class="cab__acciones">
      <button class="cab__tema" type="button" aria-pressed="false" aria-label="Usar el tema oscuro" data-tema>${ico('moon', 'ico ico--luna')}${ico('sun', 'ico ico--sol')}</button>
      ${accion}
      <button class="cab__abrir" type="button" aria-expanded="false" aria-controls="menu-movil" aria-label="Abrir el menú" data-abrir-menu>${ico('list', 'ico ico--abrir')}${ico('x', 'ico ico--cerrar')}</button>
    </div>
  </div>
  <nav class="cab__movil" id="menu-movil" aria-label="Menú" hidden>
    <ul class="envoltura">${items}${movil}</ul>
  </nav>
</header>`;
}

function pie(R) {
  const destino = { med: R.a('med/'), food: R.food(), alphatend: 'https://alphatend.com/' };
  const productos = PRODUCTOS.map((p) => `<li><a href="${destino[p.id] ?? R.portada(`#${p.id}`)}">${esc(p.nombre)}</a></li>`).join('');
  return `<footer class="portada-pie">
  <div class="envoltura portada-pie__fila">
    <img class="logo logo--claro" src="${R.a('assets/marca/logo-claro.svg')}" alt="alphateklab" width="142" height="32" loading="lazy" /><img class="logo logo--oscuro" src="${R.a('assets/marca/logo-oscuro.svg')}" alt="alphateklab" width="142" height="32" loading="lazy" />
    <nav aria-label="Productos, al pie"><ul>${productos}</ul></nav>
    <nav aria-label="Legal"><ul><li><a href="${R.a('privacidad/')}">Privacidad</a></li><li><a href="${R.a('terminos/')}">Términos</a></li></ul></nav>
    <p class="portada-pie__nota">© 2026 alphateklab · Panamá</p>
  </div>
</footer>
<script type="module" src="${R.recurso('js/portada.js')}"></script>
</body>
</html>
`;
}

// ─────────────────────────────── miniaturas de las tarjetas del héroe ───────────────────────────────

const MINIS = {
  // El dictado: la onda de la voz y las líneas que se van escribiendo.
  med: `<span class="mini mini--med" aria-hidden="true"><span class="mini__fila">${ico('microphone')}<span class="mini__onda">${'<i></i>'.repeat(14)}</span></span><span class="mini__linea"></span><span class="mini__linea mini__linea--corta"></span></span>`,
  // La mesa que pide y, con Vuelve, la tarjeta de sellos; sin ella, las líneas del pedido.
  food: `<span class="mini mini--food" aria-hidden="true"><span class="mini__fila"><span class="mini__pastilla">Mesa 8</span><span class="mini__pastilla mini__pastilla--nuevo">Nuevo</span></span>${
    CON_VUELVE
      ? `<span class="mini__sellos">${Array.from({ length: 8 }, (_, i) => `<i class="${i < 5 ? 'lleno' : ''}"></i>`).join('')}</span>`
      : '<span class="mini__linea"></span><span class="mini__linea mini__linea--corta"></span>'
  }</span>`,
  // Las compras abiertas por rubro, en barras (sin cifras: cambian cada día).
  alphatend: `<span class="mini mini--alphatend" aria-hidden="true"><span class="mini__barra" style="--l:100%"></span><span class="mini__barra" style="--l:62%"></span><span class="mini__barra" style="--l:44%"></span><span class="mini__barra" style="--l:24%"></span></span>`,
};

// ─────────────────────────────── ejemplos en HTML ───────────────────────────────

function marco(contenido) {
  return `<div class="marco"><div class="marco__barra" aria-hidden="true"><i></i><i></i><i></i></div>${contenido}</div>`;
}

function ejemplo(p, R) {
  const e = p.ejemplo;
  if (e.tipo === 'captura') {
    const oscuro = e.oscuro ? ` data-claro="${R.a(e.claro)}" data-oscuro="${R.a(e.oscuro)}"` : '';
    const grande = e.grande ? ` srcset="${R.a(e.claro)} 800w, ${R.a(e.grande)} 1280w" sizes="(min-width: 920px) 600px, 92vw"` : '';
    return `<figure class="vitrina vitrina--${p.id}">
        ${marco(`<img class="producto__captura" src="${R.a(e.claro)}"${grande}${oscuro} width="${e.ancho}" height="${e.alto}" alt="${esc(e.alt)}" loading="lazy" decoding="async" />`)}
        <figcaption>${esc(e.pie)}</figcaption>
      </figure>`;
  }
  return `<figure class="vitrina vitrina--${p.id}">
        ${ejemploFood()}
        <figcaption>${esc(e.pie)}</figcaption>
      </figure>`;
}

const celular = () => `<div class="ej-cel" aria-hidden="true">
            <p class="ej-cel__mesa"><span>Mesa 8</span></p>
            <p class="ej-cel__titulo">Tu pedido</p>
            <ul class="ej-cel__lista">
              <li><span>2 × Hamburguesa clásica</span><span>$24.00</span></li>
              <li><span>4 × Cerveza de barril</span><span>$20.00</span></li>
            </ul>
            <p class="ej-boton ej-boton--ancho">Enviar a la barra</p>
            <p class="ej-cel__nota">Aquí no se paga: la cuenta la pides al personal.</p>
          </div>`;
const barra = () => `<div class="ej-barra" aria-hidden="true">
            <p class="ej-barra__cabeza"><span>Barra</span><span class="ej-insignia">Nuevo</span></p>
            <p class="ej-barra__mesa">Mesa 8 <span>hace 1 min</span></p>
            <ul class="ej-barra__lista">
              <li><b>2 ×</b> Hamburguesa clásica <span>Con papas</span></li>
              <li><b>4 ×</b> Cerveza de barril</li>
            </ul>
            <p class="ej-barra__acciones"><span class="ej-boton">Lo vimos</span><span class="ej-boton ej-boton--linea">Entregado</span></p>
          </div>`;
const tarjetaVuelve = (chica = false) => `<div class="ej-vuelve${chica ? ' ej-vuelve--chica' : ''}" aria-hidden="true">
            <p class="ej-vuelve__cabeza"><span>Café de ejemplo</span><span class="ej-vuelve__marca">Vuelve</span></p>
            <p class="ej-vuelve__cuenta">7 <span>de 10 sellos</span></p>
            <p class="ej-vuelve__sellos">${Array.from({ length: 10 }, (_, i) => `<i class="${i < 7 ? 'lleno' : ''}"></i>`).join('')}</p>
            ${chica ? '' : '<p class="ej-vuelve__premio">Al completar: un café gratis</p>'}
          </div>`;

/** Food en la portada: la mesa que pide, la barra que recibe y, con Vuelve, la tarjeta de sellos, en mosaico. */
function ejemploFood() {
  if (!CON_VUELVE) {
    return `<div class="ej ej--food ej--solo-pedidos" role="img" aria-label="Ejemplo: desde el celular de la mesa 8 envían 2 hamburguesas y 4 cervezas, y la barra recibe el pedido">
          ${celular()}
          ${barra()}
        </div>`;
  }
  return `<div class="ej ej--food" role="img" aria-label="Ejemplo: desde el celular de la mesa 8 envían 2 hamburguesas y 4 cervezas, la barra recibe el pedido y al lado está la tarjeta de lealtad de un café, con 7 de 10 sellos">
          ${celular()}
          ${barra()}
          ${tarjetaVuelve(true)}
        </div>`;
}

/** Vuelve en la página de Food: la tarjeta como se ve en el Wallet, con el sello que se acaba de sumar. */
function ejemploVuelve() {
  return `<div class="ej ej--vuelve" role="img" aria-label="Ejemplo: tarjeta Vuelve de un café en el Wallet, con 7 de 10 sellos; el personal acaba de sumar uno">
          ${tarjetaVuelve()}
          <p class="ej-aviso" aria-hidden="true">${ico('check')}Sello agregado · 7 de 10</p>
        </div>`;
}

/** El caso real: el sistema funcionando, en una tableta y un celular sobre un panel de color (sin el nombre del local). */
function casoReal(R) {
  const c = FOOD.caso;
  return `<figure class="caso">
        <span class="caso__etiqueta">${esc(c.etiqueta)}</span>
        <div class="caso__tableta"><img src="${R.a(c.barra.s)}" srcset="${R.a(c.barra.s)} 800w, ${R.a(c.barra.l)} 1280w" sizes="(min-width: 920px) 760px, 88vw" width="800" height="500" alt="${esc(c.barra.alt)}" loading="lazy" decoding="async" /></div>
        <div class="caso__tel"><img src="${R.a(c.mesa.s)}" srcset="${R.a(c.mesa.s)} 390w, ${R.a(c.mesa.l)} 780w" sizes="(min-width: 920px) 230px, 34vw" width="390" height="844" alt="${esc(c.mesa.alt)}" loading="lazy" decoding="async" /></div>
        <figcaption>${esc(c.pie)}</figcaption>
      </figure>`;
}

/**
 * Formulario de contacto, con los campos de Med (.campo). Con JavaScript (js/portada.js) se manda a FormSubmit sin salir
 * de la página; sin él, el envío normal: FormSubmit pide un captcha y vuelve a #enviado, que se muestra con :target.
 * El campo del correo se llama `email` para que FormSubmit lo ponga de «Responder a». Sin destino (solo en la vista
 * previa) el script avisa que el formulario todavía no envía.
 */
function formularioContacto(R) {
  const F = FOOD.formulario;
  const a = destino ? encodeURIComponent(destino) : '';
  return `<form class="sm-form" method="post" action="${a ? `https://formsubmit.co/${a}` : '#'}" data-formulario data-ajax="${a ? `https://formsubmit.co/ajax/${a}` : ''}" data-gracias="${esc(F.gracias)}" data-error="${esc(F.error)}">
          <input type="hidden" name="_subject" value="${esc(F.asunto)}" />
          <input type="hidden" name="_template" value="table" />
          ${raiz ? `<input type="hidden" name="_next" value="${SITIO}food/#enviado" />` : ''}
          <p class="sm-form__recibido" id="enviado">${ico('check')}${esc(F.gracias)}</p>
          <p style="display:none"><label>No llenes este campo <input type="text" name="_honey" tabindex="-1" autocomplete="off" /></label></p>
          <label class="campo"><span>Nombre</span><input name="nombre" autocomplete="name" required maxlength="80" /></label>
          <label class="campo"><span>Correo</span><input name="email" type="email" autocomplete="email" required maxlength="120" /></label>
          <label class="campo"><span>¿Qué necesitas?</span><textarea name="mensaje" rows="5" required maxlength="2000" placeholder="${esc(F.ejemplo)}"></textarea></label>
          <button class="accion accion--principal" type="submit"><span>Enviar</span>${ico('arrow-right')}</button>
          <p class="sm-form__estado" role="status" data-estado></p>
          <p class="sm-form__nota">Usamos tus datos solo para responderte. <a href="${R.a('privacidad/')}">Política de privacidad</a></p>
        </form>`;
}

// ─────────────────────────────── portada ───────────────────────────────

function paginaPortada() {
  const ruta = `${BASE}index.html`;
  const R = rutas(ruta);
  const vidrios = PRODUCTOS.map(
    (p) =>
      `<li><a class="vidrio vidrio--${p.id}" href="#${p.id}"><span class="vidrio__brillo" aria-hidden="true"></span><span class="vidrio__cabeza">${app(p.id, p.glifo)}<span><span class="vidrio__nombre">${esc(p.nombre)}</span><span class="vidrio__sector">${esc(p.sector)}</span></span></span><span class="vidrio__resumen">${esc(p.resumen)}</span>${MINIS[p.mini]}<span class="vidrio__ir">Conocer ${ico('arrow-right')}</span></a></li>`,
  ).join('\n        ');
  const secciones = PRODUCTOS.map((p, i) => {
    const puntos = p.puntos.map((t) => `<li>${ico('check')}<span>${esc(t)}</span></li>`).join('\n          ');
    const firma = p.firma ? ` <span class="producto__firma">${esc(p.firma)}</span>` : '';
    return `<section class="producto producto--${p.id}${i % 2 ? ' producto--al-reves' : ''}" id="${p.id}" aria-labelledby="t-${p.id}">
    <div class="envoltura producto__fila">
      <div class="producto__texto">
        <div class="producto__cabeza">${app(p.id, p.glifo, 'grande')}<p class="producto__sector">${esc(p.sector)}</p></div>
        <h2 class="producto__nombre" id="t-${p.id}">${esc(p.nombre)}${firma}</h2>
        <p class="producto__frase">${esc(p.frase)}</p>
        <ul class="producto__puntos">
          ${puntos}
        </ul>
        ${p.nota ? `<p class="producto__nota">${esc(p.nota)}</p>` : ''}
        <p class="producto__acciones">${p.acciones.map((a) => boton(a, R)).join(' ')}</p>
      </div>
      ${ejemplo(p, R)}
    </div>
  </section>`;
  }).join('\n  ');
  const menu = PRODUCTOS.map((p) => [p.nombre, `#${p.id}`]);
  const html = `${cabeza({ R, titulo: PORTADA.titulo, descripcion: PORTADA.descripcion, canonica: SITIO })}
${cabecera({ R, menu, accion: '' /* la portada es de todos los productos: cada uno entra desde su página (Edwin, 10-oct) */ })}
<main id="contenido">
  <section class="portada-heroe" aria-labelledby="titulo">
    ${luces}
    <div class="envoltura">
      <h1 class="portada-heroe__titulo" id="titulo">${esc(PORTADA.heroe.titulo[0])} <span class="portada-heroe__resalte">${esc(PORTADA.heroe.titulo[1])}</span></h1>
      <p class="portada-heroe__bajada">${esc(PORTADA.heroe.bajada)}</p>
      <ul class="portada-heroe__vidrios" aria-label="Productos">
        ${vidrios}
      </ul>
    </div>
  </section>
  ${secciones}
</main>
${pie(R)}`;
  return [ruta, html];
}

// ─────────────────────────────── Food ───────────────────────────────

/**
 * Arriba, como en med/: «Iniciar sesión» (con borde) y «Probar gratis» (lleno). Cada uno abre la lista de servicios
 * para elegir (Edwin, 10-oct): así se sabe a cuál se entra. Solo van los publicados que tienen a dónde llevar (`entrar`
 * y `probar` en FOOD.servicios); sin ninguno, el botón no va, y si el único destino está en esta misma página (el
 * formulario, #contacto), es un enlace directo. La lista es un <details>: sin JavaScript también abre; js/portada.js
 * cierra uno al abrir el otro, al tocar fuera y con Escape.
 */
const ACCESOS = {
  entrar: { boton: 'boton boton--linea cab__entrar', texto: '<span class="cab__entrar-largo">Iniciar sesión</span><span class="cab__entrar-corto">Entrar</span>', titulo: '¿A qué servicio entras?' },
  probar: { boton: 'boton boton--senal', texto: 'Probar gratis', titulo: '¿Qué quieres probar?' },
};
const conAcceso = (campo) => SERVICIOS.filter((s) => s[campo]);
/** El único destino, si está en esta misma página; si no, null. */
const directo = (campo) => {
  const S = conAcceso(campo);
  return S.length === 1 && S[0][campo].startsWith('#') ? S[0][campo] : null;
};

function accesosFood() {
  return Object.entries(ACCESOS)
    .map(([campo, a]) => {
      const S = conAcceso(campo);
      if (!S.length) return '';
      // Como «Probar gratis» de med/ (cab__cta): bajo 420 px pasa al menú.
      if (directo(campo)) return `<a class="${a.boton} cab__cta" href="${esc(directo(campo))}">${a.texto}</a>`;
      const lista = S.map((s) => `<a class="elegir__opcion" href="${esc(s[campo])}">${app(s.id, s.glifo, 'chica')}<span><strong>${esc(s.nombre)}</strong><small>${esc(s.resumen)}</small></span></a>`).join('');
      return `<details class="elegir elegir--${campo}" data-elegir>
        <summary class="${a.boton}">${a.texto}</summary>
        <div class="elegir__menu"><p class="elegir__titulo">${esc(a.titulo)}</p>${lista}</div>
      </details>`;
    })
    .filter(Boolean)
    .join('\n      ');
}

/** En el menú del teléfono, los mismos destinos con su nombre (ahí «Probar gratis» de arriba no cabe). */
function accesosFoodMovil() {
  const probar = directo('probar')
    ? [`<li><a class="boton boton--senal" href="${esc(directo('probar'))}">Probar gratis</a></li>`]
    : conAcceso('probar').map((s) => `<li><a href="${esc(s.probar)}">Probar ${esc(s.nombre)} gratis</a></li>`);
  return [...conAcceso('entrar').map((s) => `<li><a href="${esc(s.entrar)}">Iniciar sesión en ${esc(s.nombre)}</a></li>`), ...probar].join('');
}

function paginaFood() {
  const ruta = `${BASE}food/index.html`;
  const R = rutas(ruta);
  const F = FOOD;
  const enlaceContacto = (clase, texto) => `<a class="accion ${clase}" href="#contacto"><span>${esc(texto)}</span>${ico('arrow-right')}</a>`;
  const pasos = (lista) =>
    `<ol class="sm-pasos">${lista.map((x) => `<li><span class="sm-pasos__icono">${ico(x.icono)}</span><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></li>`).join('')}</ol>`;
  const funciones = F.sobremesa.funciones.map(([fuerte, resto]) => `<li>${ico('check')}<span><strong>${esc(fuerte)}:</strong> ${esc(resto)}</span></li>`).join('\n            ');
  const servicio = (id) => SERVICIOS.find((s) => s.id === id);
  const cabezaServicio = (id) => {
    const s = servicio(id);
    return `<div class="producto__cabeza">${app(s.id, s.glifo, 'grande')}<p class="producto__sector">${esc(s.nombre)}</p></div>`;
  };
  const vidrios = SERVICIOS
    .map(
      (s) =>
        `<li><a class="vidrio vidrio--${s.id}" href="#${s.id}"><span class="vidrio__brillo" aria-hidden="true"></span><span class="vidrio__cabeza">${app(s.id, s.glifo)}<span class="vidrio__nombre">${esc(s.nombre)}</span></span><span class="vidrio__resumen">${esc(s.resumen)}</span><span class="vidrio__ir">Ver más ${ico('arrow-right')}</span></a></li>`,
    )
    .join('\n        ');
  const menu = [
    ['Sobremesa', '#sobremesa'],
    ...(CON_VUELVE ? [['Vuelve', '#vuelve']] : []),
    ['A la medida', '#medida'],
    ['Preguntas', '#preguntas'],
  ];
  const preguntas = [...F.preguntas, ...(CON_VUELVE ? F.vuelve.preguntas : [])];
  const seccionVuelve = CON_VUELVE
    ? `
  <section class="sm-seccion sm-seccion--vuelve" id="vuelve" aria-labelledby="t-vuelve">
    <div class="envoltura">
      ${cabezaServicio('vuelve')}
      <h2 class="sm-seccion__titulo" id="t-vuelve">${esc(F.vuelve.titulo)}</h2>
      <p class="sm-seccion__bajada">${esc(F.vuelve.bajada)}</p>
      <div class="sm-seccion__fila">
        <div>${pasos(F.vuelve.pasos)}</div>
        <figure class="vitrina vitrina--vuelve">
          ${ejemploVuelve()}
          <figcaption>Tarjeta de ejemplo, con un café ficticio.</figcaption>
        </figure>
      </div>
    </div>
  </section>
`
    : '';
  const html = `${cabeza({ R, titulo: F.titulo, descripcion: F.descripcion, canonica: `${SITIO}food/` })}
${cabecera({ R, menu, accion: accesosFood(), movil: accesosFoodMovil() })}
<main id="contenido">
  <section class="portada-heroe portada-heroe--producto" aria-labelledby="titulo">
    ${luces}
    <div class="envoltura">
      <p class="portada-heroe__marca">${app('food', 'fork-knife', 'chica')}Food <span>by alphateklab</span></p>
      <h1 class="portada-heroe__titulo" id="titulo">${esc(F.heroe.titulo[0])} <span class="portada-heroe__resalte">${esc(F.heroe.titulo[1])}</span></h1>
      <p class="portada-heroe__bajada">${esc(F.heroe.bajada)}</p>
      <p class="portada-heroe__acciones">${enlaceContacto('accion--principal', 'Contactar')} <a class="accion accion--vidrio" href="#sobremesa"><span>Cómo funciona</span></a></p>
      <ul class="portada-heroe__vidrios${SERVICIOS.length === 3 ? ' portada-heroe__vidrios--tres' : ''}" aria-label="Servicios de Food">
        ${vidrios}
      </ul>
    </div>
  </section>

  <section class="sm-seccion sm-seccion--sobremesa" id="sobremesa" aria-labelledby="t-sobremesa">
    <div class="envoltura">
      ${cabezaServicio('sobremesa')}
      <h2 class="sm-seccion__titulo" id="t-sobremesa">${esc(F.sobremesa.titulo)}</h2>
      <p class="sm-seccion__bajada">${esc(F.sobremesa.bajada)}</p>
      ${pasos(F.sobremesa.pasos)}
      ${casoReal(R)}
      <ul class="sm-funciones sm-funciones--rejilla">
          ${funciones}
      </ul>
    </div>
  </section>
${seccionVuelve}
  <section class="sm-seccion" id="medida" aria-labelledby="t-medida">
    <div class="envoltura">
      <div class="sm-medida">
        ${luces}
        <div>
          <div class="producto__cabeza">${app('medida', 'file-text', 'grande')}<p class="sm-seccion__antetitulo">${esc(F.medida.antetitulo)}</p></div>
          <h2 class="sm-seccion__titulo" id="t-medida">${esc(F.medida.titulo)}</h2>
          <p class="sm-seccion__bajada">${esc(F.medida.bajada)}</p>
        </div>
        ${enlaceContacto('accion--principal', 'Contactar')}
      </div>
    </div>
  </section>

  <section class="sm-seccion sm-seccion--contacto" id="contacto" aria-labelledby="t-contacto">
    <div class="envoltura">
      <div class="sm-contacto">
        <div class="sm-contacto__texto">
          <div class="producto__cabeza">${app('food', 'envelope-simple', 'grande')}<p class="sm-seccion__antetitulo">Contacto</p></div>
          <h2 class="sm-seccion__titulo" id="t-contacto">${esc(F.formulario.titulo)}</h2>
          <p class="sm-seccion__bajada">${esc(F.formulario.bajada)}</p>
        </div>
        ${formularioContacto(R)}
      </div>
    </div>
  </section>

  <section class="sm-seccion" id="preguntas" aria-labelledby="t-preguntas">
    <div class="envoltura">
      <h2 class="sm-seccion__titulo" id="t-preguntas">Preguntas</h2>
      <div class="sm-preguntas">
        ${preguntas.map(([q, r]) => `<details><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('\n        ')}
      </div>
    </div>
  </section>
</main>
${pie(R)}`;
  return [ruta, html];
}

for (const [ruta, html] of [paginaPortada(), paginaFood()]) {
  const salida = join(SALIDA, ruta);
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, html);
  console.log(`Escrita: ${ruta}`);
}
if (!destino) console.log('Aviso: el formulario de Food no tiene destino y no envía (solo vista previa; FORM_DESTINO=… para probarlo).');
