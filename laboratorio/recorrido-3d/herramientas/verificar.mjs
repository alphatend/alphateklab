// Verificación en el navegador (Playwright, Chromium sin pantalla con WebGL por software).
// Recorre la demo con clics y teclas reales a 390×844 (táctil) y 1280×800 (mouse), en claro y oscuro, y guarda
// capturas. Falla (sale con 1) si alguna comprobación no pasa o si la consola tiene errores.
//
// Uso: node herramientas/verificar.mjs [--salida <carpeta>]      (PUERTO_DEMO=4770 para usar otro puerto)
// Levanta su propio servidor (python3 -m http.server <puerto> sobre ~/alphateklab/repos) si no hay uno, y lo cierra.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../../herramientas/navegador.mjs';

const DEMO = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPOS = join(DEMO, '..', '..', '..');
const PUERTO = Number(process.env.PUERTO_DEMO ?? 4750);
const URL = `http://localhost:${PUERTO}/alphateklab/laboratorio/recorrido-3d/?prueba=1`;
const iSalida = process.argv.indexOf('--salida');
const SALIDA = iSalida > 0 ? process.argv[iSalida + 1] : join(tmpdir(), 'recorrido-3d-capturas');
mkdirSync(SALIDA, { recursive: true });

const resultados = [];
function comprobar(corrida, nombre, ok, detalle = '') {
  resultados.push({ corrida, nombre, ok: Boolean(ok), detalle });
  console.log(`${ok ? 'ok  ' : 'FALLA'} [${corrida}] ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

async function hayServidor() {
  try { return (await fetch(`http://localhost:${PUERTO}/`)).ok; } catch { return false; }
}

const GL = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
// Puntero grueso sin hover (teléfono) o fino con hover (mouse): Chrome sin pantalla no lo cambia solo.
const TACTIL = '--blink-settings=primaryPointerType=2,availablePointerTypes=2,primaryHoverType=1,availableHoverTypes=1';
const MOUSE = '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
// Espera a que la página deje de desplazarse (el scroll suave de «Ir» o «Ver en 3D»).
async function esperarQuieto(pag) {
  let antes = -1;
  for (let i = 0; i < 40; i++) {
    const y = await pag.evaluate(() => scrollY);
    if (y === antes) return;
    antes = y;
    await esperar(120);
  }
}

async function nuevaPagina(nav, { ancho, alto, tema, movil, reducir = false }) {
  const ctx = await nav.newContext({
    viewport: { width: ancho, height: alto },
    colorScheme: tema === 'oscuro' ? 'dark' : 'light',
    reducedMotion: reducir ? 'reduce' : 'no-preference',
    hasTouch: movil,
    isMobile: movil,
    deviceScaleFactor: 1,
    acceptDownloads: true,
  });
  const pag = await ctx.newPage();
  const errores = [];
  const externos = new Set();
  const bytes = { total: 0, porOrigen: {} };
  pag.on('requestfinished', async (r) => {
    try {
      const t = (await r.sizes()).responseBodySize;
      const o = new globalThis.URL(r.url()).origin;
      bytes.total += t;
      bytes.porOrigen[o] = (bytes.porOrigen[o] ?? 0) + t;
    } catch { /* la página ya cerró */ }
  });
  pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
  pag.on('pageerror', (e) => errores.push(`pageerror: ${String(e).slice(0, 300)}`));
  pag.on('request', (r) => { const u = new globalThis.URL(r.url()); if (u.hostname !== 'localhost') externos.add(u.origin); });
  return { ctx, pag, errores, externos, bytes };
}

const sinScrollLateral = (pag) => pag.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
// ¿El elemento queda debajo de la cabecera fija (y no tapado por ella)?
const debajoDeLaCabecera = (pag, sel) => pag.evaluate((sel) => {
  const cab = document.querySelector('.cabecera').getBoundingClientRect().bottom;
  const r = document.querySelector(sel).getBoundingClientRect();
  return { ok: r.top >= cab - 0.5, top: Math.round(r.top), cabecera: Math.round(cab) };
}, sel);
// ¿El elemento cae entero dentro de la escena (no recortado por ella)?
const dentroDeLaEscena = (pag, sel) => pag.evaluate((sel) => {
  const e = document.getElementById('escena').getBoundingClientRect(), b = document.querySelector(sel).getBoundingClientRect();
  return { ok: b.top >= e.top - 0.5 && b.bottom <= e.bottom + 0.5 && b.height > 0, boton: [Math.round(b.top), Math.round(b.bottom)], escena: [Math.round(e.top), Math.round(e.bottom)] };
}, sel);
const est = (pag) => pag.evaluate(() => window.recorrido3d.visor().estado());

// Objetivos táctiles: botones, controles de formulario, opciones y enlaces visibles de 44 × 44 px o más (también los
// de la cabecera y el pie, que antes no se miraban y medían 40 y 19 px).
async function revisarTamanos(pag, id, donde) {
  const chicos = await pag.evaluate(() => [...document.querySelectorAll('main button, main .boton, main select, main input:not([type=radio]):not([type=file]):not(.sr), main .herramientas__opcion, main summary, main .migas a, main .relacionados a, header a, footer a')]
    .filter((b) => b.offsetParent !== null && !b.closest('[hidden]'))
    .map((b) => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.id || b.name || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((b) => b.w < 44 || b.h < 44));
  comprobar(id, `objetivos táctiles de 44 × 44 px o más (${donde})`, chicos.length === 0, chicos.map((b) => `${b.t} ${b.w}×${b.h}`).join(', '));
}

async function entrar(pag) {
  await pag.click('#entrar');
  await pag.waitForFunction(() => document.getElementById('visor').dataset.estado === 'listo', null, { timeout: 90000 });
  await pag.waitForFunction(() => !window.recorrido3d.visor().animando, null, { timeout: 10000 });
}

async function caminar(pag, tecla, ms) {
  await pag.focus('#escena');
  await pag.keyboard.down(tecla);
  await esperar(ms);
  await pag.keyboard.up(tecla);
  await esperar(120);
}

async function corridaPrincipal(nav, cfg) {
  const id = `${cfg.ancho}-${cfg.tema}`;
  const { ctx, pag, errores, externos, bytes } = await nuevaPagina(nav, cfg);
  const foto = (n) => pag.screenshot({ path: join(SALIDA, `${id}-${n}.png`) });
  try {
    await pag.goto(URL, { waitUntil: 'networkidle' });
    await foto('01-inicio');
    if (cfg.paginaEntera) await pag.screenshot({ path: join(SALIDA, `${id}-00-pagina-entera.png`), fullPage: true });
    comprobar(id, 'sin scroll horizontal al cargar', await sinScrollLateral(pag));
    const portada = await pag.evaluate(() => { const i = document.querySelector('.visor__portada img'); return i.complete && i.naturalWidth > 0 ? i.currentSrc.split('/').pop() : null; });
    comprobar(id, 'la imagen fija del modelo se ve antes de cargar el 3D', portada, portada ?? 'no cargó');
    comprobar(id, 'los botones «Ir» de la tabla aparecen con JavaScript', await pag.locator('[data-ir]:visible').count() === 10);
    // Objetivos táctiles: cada botón visible mide 44 × 44 px o más (el «Ir» de la tabla llegó a medir 28 px y partía «I / r»).
    await revisarTamanos(pag, id, 'al cargar');
    const irEnUnaLinea = await pag.evaluate(() => { const b = document.querySelector('[data-ir]'); const r = document.createRange(); r.selectNodeContents(b.firstChild); return r.getClientRects().length === 1; });
    comprobar(id, 'el texto «Ir» de la tabla queda en una línea', irEnUnaLinea);
    if (!cfg.movil) {
      const r = await pag.evaluate(() => { const b = document.getElementById('entrar').getBoundingClientRect(); return [Math.round(b.bottom), innerHeight]; });
      comprobar(id, '«Entrar al recorrido» se ve entero sin bajar', r[0] <= r[1], `abajo en ${r[0]} de ${r[1]} px`);
    }
    // Rótulos del plano: en el teléfono los compactos (antes medían de 6 a 9 px), en escritorio los de siempre.
    const rotulos = await pag.evaluate(() => {
      const svg = document.querySelector('.plano-svg--pagina');
      const esc = svg.getScreenCTM().a;
      const vis = [...svg.querySelectorAll('text, tspan')].filter((t) => { for (let e = t; e && e !== svg; e = e.parentElement) if (getComputedStyle(e).display === 'none') return false; return true; });
      return Math.min(...vis.map((t) => parseFloat(getComputedStyle(t).fontSize) * esc));
    });
    comprobar(id, 'los rótulos del plano miden 10 px o más', rotulos >= 10, `el más chico, ${rotulos.toFixed(1)} px`);
    const tnum = await pag.evaluate(() => getComputedStyle(document.querySelector('.tabla-ambientes tbody th')).fontVariantNumeric);
    comprobar(id, 'los nombres de la tabla no llevan cifras tabulares («Sala-comedor» sin el guion abierto)', tnum === 'normal', tnum);
    // El fondo sigue al tema: se mide la luminancia del color pintado (los tokens viven en atk.css y pueden cambiar).
    const fondoBody = await pag.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const lum = (() => { const [r, g, b] = fondoBody.match(/\d+/g).map(Number).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; })();
    comprobar(id, `fondo del tema ${cfg.tema}`, cfg.tema === 'oscuro' ? lum < 0.05 : lum > 0.8, `${fondoBody}, luminancia ${lum.toFixed(3)}`);

    await esperar(300);
    const kbAntes = bytes.total / 1024;
    // Entrar
    const t0 = Date.now();
    await entrar(pag);
    await esperar(500);
    if (!cfg.movil && cfg.tema === 'claro') {
      const kb = (o) => ((bytes.porOrigen[o] ?? 0) / 1024).toFixed(0);
      comprobar(id, 'peso transferido (comprimido)', true, `al cargar ${kbAntes.toFixed(0)} KB; con el 3D abierto ${(bytes.total / 1024).toFixed(0)} KB (cdn.jsdelivr.net ${kb('https://cdn.jsdelivr.net')} KB)`);
    }
    let e = await est(pag);
    comprobar(id, 'entrar: primera persona en la sala-comedor', e.vista === 'primera' && e.ambiente === 'sala-comedor', `${e.vista}, ${e.ambiente}, ${Date.now() - t0} ms`);
    comprobar(id, 'la ficha del ambiente dice nombre y m²', (await pag.textContent('#hud-ambiente')).includes('Sala-comedor') && (await pag.textContent('#hud-ambiente')).includes('27.56 m²'));
    await revisarTamanos(pag, id, 'con el 3D abierto');
    await pag.evaluate(() => window.scrollTo(0, 0));
    await foto('02-primera-persona');

    // Sin bucle cuando nada cambia
    const c0 = await pag.evaluate(() => window.recorrido3d.visor().cuadros);
    await esperar(1000);
    const c1 = await pag.evaluate(() => window.recorrido3d.visor().cuadros);
    comprobar(id, 'quieto no dibuja cuadros (sin bucle)', c1 - c0 <= 1, `${c1 - c0} cuadros en 1 s quieto`);

    // Caminar 3 s con el teclado
    const antes = await est(pag);
    await caminar(pag, 'KeyW', 3000);
    e = await est(pag);
    const c2 = await pag.evaluate(() => window.recorrido3d.visor().cuadros);
    comprobar(id, 'caminando sí dibuja', c2 - c1 > 20, `${c2 - c1} cuadros en 3 s`);
    const recorrido = Math.hypot(e.x - antes.x, e.y - antes.y);
    comprobar(id, 'caminar 3 s con W mueve al visitante', recorrido > 1, `${recorrido.toFixed(2)} m, ahora en ${e.ambiente}`);
    comprobar(id, 'después de caminar sigue dentro del apartamento', e.ambiente !== null);

    // Chocar con una pared exterior con ventana (no se atraviesa)
    await pag.evaluate(() => window.recorrido3d.visor().colocar({ x: 2, y: 1.7, rumbo: 0 }));
    await caminar(pag, 'KeyW', 3000);
    e = await est(pag);
    comprobar(id, 'contra la ventana de la recámara: no la atraviesa', e.y >= 0.35 - 1e-6 && e.ambiente === 'recamara-principal', `y = ${e.y.toFixed(3)} (mínimo 0.35)`);
    await foto('03-contra-la-ventana');
    // Contra una pared interior sin puerta
    await pag.evaluate(() => window.recorrido3d.visor().colocar({ x: 2.5, y: 0.8, rumbo: 90 }));
    await caminar(pag, 'ArrowUp', 2500);
    e = await est(pag);
    comprobar(id, 'contra la pared del baño: no la atraviesa', e.x <= 3.8 - 0.06 - 0.25 + 1e-6 && e.ambiente === 'recamara-principal', `x = ${e.x.toFixed(3)} (máximo 3.49)`);

    // Pasar por una puerta
    await pag.evaluate(() => window.recorrido3d.visor().colocar({ x: 6.4, y: 3.95, rumbo: 0 }));
    await caminar(pag, 'KeyW', 2500);
    e = await est(pag);
    comprobar(id, 'por la puerta del pasillo se entra a la recámara 2', e.ambiente === 'recamara-2', `${e.ambiente} en (${e.x.toFixed(2)}, ${e.y.toFixed(2)})`);
    comprobar(id, 'la ficha cambia al entrar al ambiente', (await pag.textContent('#hud-ambiente')).includes('Recámara 2') && (await pag.textContent('#hud-ambiente')).includes('9.52 m²'));

    // Girar con las flechas
    const yaw0 = (await est(pag)).yaw;
    await caminar(pag, 'ArrowRight', 600);
    comprobar(id, 'la flecha derecha gira la vista', (await est(pag)).yaw < yaw0 - 0.3);

    // Medir de pared a pared con la mira y el teclado: la recámara 2 mide 2.80 m a eje, 2.68 m entre caras.
    await pag.evaluate(() => window.recorrido3d.visor().colocar({ x: 6.8, y: 1.7, rumbo: 90 }));
    await pag.focus('#escena');
    await pag.keyboard.press('KeyM');
    comprobar(id, 'M enciende el modo medir', (await pag.getAttribute('#b-medir', 'aria-pressed')) === 'true');
    await pag.keyboard.press('Enter');
    await pag.evaluate(() => window.recorrido3d.visor().colocar({ x: 6.8, y: 1.7, rumbo: 270 }));
    await pag.focus('#escena');
    await pag.keyboard.press('Enter');
    await esperar(150);
    const textoMedida = (await pag.textContent('#lista-medidas li'))?.trim();
    comprobar(id, 'medir entre las dos paredes de la recámara 2 da 2.68 m', textoMedida === '2.68 m', textoMedida);
    // Medir con clics (o toques) sobre la escena (la caja se mide justo antes: los clics en la barra desplazan la página)
    const cajaEscena = async () => { await pag.locator('#escena').scrollIntoViewIfNeeded(); return pag.locator('#escena').boundingBox(); };
    let caja = await cajaEscena();
    await pag.evaluate(() => window.recorrido3d.visor().colocar({ x: 6.8, y: 2.6, rumbo: 0, pitch: -0.5 }));
    if (cfg.movil) {
      await pag.touchscreen.tap(caja.x + caja.width * 0.3, caja.y + caja.height * 0.7);
      await pag.touchscreen.tap(caja.x + caja.width * 0.7, caja.y + caja.height * 0.75);
    } else {
      await pag.mouse.click(caja.x + caja.width * 0.3, caja.y + caja.height * 0.7);
      await pag.mouse.click(caja.x + caja.width * 0.7, caja.y + caja.height * 0.75);
    }
    await esperar(200);
    const medidas = await pag.evaluate(() => window.recorrido3d.visor().medidas());
    comprobar(id, `medir ${cfg.movil ? 'tocando' : 'con clics'} dos puntos del piso`, medidas.length === 2 && medidas[1].distancia > 0.3, medidas.map((m) => m.distancia.toFixed(2)).join(', '));
    comprobar(id, 'la etiqueta de la medida aparece sobre la escena', await pag.locator('.medida-etiqueta:visible').count() >= 1);
    await foto('04-medidas');
    await pag.click('#b-borrar-medidas');
    comprobar(id, '«Borrar medidas» las quita', (await pag.evaluate(() => window.recorrido3d.visor().medidas().length)) === 0 && await pag.locator('#medidas').isHidden());
    comprobar(id, 'al esconderse «Borrar medidas», el foco pasa a «Medir»', await pag.evaluate(() => document.activeElement?.id) === 'b-medir');
    // Doble clic (o doble toque) en el mismo punto: no guarda una medida de 0.00 m.
    caja = await cajaEscena();
    if (cfg.movil) { await pag.touchscreen.tap(caja.x + caja.width * 0.5, caja.y + caja.height * 0.75); await pag.touchscreen.tap(caja.x + caja.width * 0.5, caja.y + caja.height * 0.75); }
    else await pag.mouse.dblclick(caja.x + caja.width * 0.5, caja.y + caja.height * 0.75);
    await esperar(200);
    comprobar(id, 'dos toques en el mismo punto no son una medida de 0.00 m', (await pag.evaluate(() => window.recorrido3d.visor().medidas().length)) === 0 && (await pag.textContent('#consejo')).includes('mismo punto'), await pag.textContent('#consejo'));
    await pag.click('#b-medir');

    // Joystick (solo táctil): pulgar izquierdo hacia arriba
    if (cfg.movil) {
      await pag.evaluate(() => window.recorrido3d.visor().colocar({ x: 2.5, y: 6.5, rumbo: 90 }));
      comprobar(id, 'el joystick se ve en primera persona con pantalla táctil', await pag.locator('#joystick').isVisible());
      caja = await cajaEscena();
      const cdp = await ctx.newCDPSession(pag);
      const x = caja.x + 70, y = caja.y + caja.height - 90;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 10 }] }); await esperar(30); }
      await esperar(1500);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      e = await est(pag);
      comprobar(id, 'el joystick hace caminar hacia adelante', e.x > 3.3, `x = ${e.x.toFixed(2)} (salió de 2.5 mirando a la derecha)`);
      // Mirar arrastrando con el pulgar derecho
      const yawA = (await est(pag)).yaw;
      const xd = caja.x + caja.width * 0.75, yd = caja.y + caja.height * 0.5;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: xd, y: yd }] });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: xd - i * 15, y: yd }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await esperar(100);
      comprobar(id, 'arrastrar con el pulgar derecho gira la vista', Math.abs((await est(pag)).yaw - yawA) > 0.15);
    } else {
      comprobar(id, 'el joystick no aparece con mouse', await pag.locator('#joystick').isHidden());
      // Mirar arrastrando con el mouse
      caja = await cajaEscena();
      const yawA = (await est(pag)).yaw;
      await pag.mouse.move(caja.x + caja.width * 0.5, caja.y + caja.height * 0.5);
      await pag.mouse.down();
      await pag.mouse.move(caja.x + caja.width * 0.5 - 120, caja.y + caja.height * 0.5, { steps: 6 });
      await pag.mouse.up();
      comprobar(id, 'arrastrar con el mouse gira la vista', Math.abs((await est(pag)).yaw - yawA) > 0.2);
    }

    // Vista desde arriba (casa de muñecas)
    await pag.click('#b-vista');
    await pag.waitForFunction(() => !window.recorrido3d.visor().animando, null, { timeout: 5000 });
    e = await est(pag);
    comprobar(id, '«Ver desde arriba» cambia a la casa de muñecas', e.vista === 'arriba' && (await pag.textContent('#b-vista')) === 'Caminar por dentro');
    await pag.evaluate(() => window.scrollTo(0, 0));
    await foto('05-desde-arriba');
    // Tocar el piso desde arriba baja a ese punto
    const caja2 = await cajaEscena();
    if (cfg.movil) await pag.touchscreen.tap(caja2.x + caja2.width * 0.5, caja2.y + caja2.height * 0.55);
    else await pag.mouse.click(caja2.x + caja2.width * 0.5, caja2.y + caja2.height * 0.55);
    await pag.waitForFunction(() => !window.recorrido3d.visor().animando && window.recorrido3d.visor().vista === 'primera', null, { timeout: 5000 }).catch(() => {});
    e = await est(pag);
    comprobar(id, 'tocar el piso desde arriba baja a primera persona en ese punto', e.vista === 'primera' && e.ambiente !== null, `${e.vista}, ${e.ambiente}`);

    // Minimapa: tocar la cocina lleva a la cocina. Con el dedo, el primer toque lo agranda (un baño medía 13 × 18 px).
    if (cfg.movil) {
      const m0 = await pag.locator('#minimapa svg').boundingBox();
      await pag.touchscreen.tap(m0.x + m0.width / 2, m0.y + m0.height / 2);
      await esperar(200);
      const grande = await pag.evaluate(() => document.getElementById('minimapa').classList.contains('visor__minimapa--grande'));
      const chicos = await pag.$$eval('#minimapa .pl-piso', (l) => l.map((x) => { const r = x.getBoundingClientRect(); return [x.dataset.ambiente, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 44));
      comprobar(id, 'con el dedo, el minimapa se agranda y cada ambiente mide 44 px o más', grande && chicos.length === 0, chicos.map((c) => c.join(' ')).join(', '));
      await pag.screenshot({ path: join(SALIDA, `${id}-05b-minimapa-grande.png`) });
      const c = await pag.locator('#minimapa [data-ambiente="cocina"]').boundingBox();
      await pag.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 2);
    } else await pag.locator('#minimapa [data-ambiente="cocina"]').click();
    await esperar(600);
    e = await est(pag);
    comprobar(id, 'tocar la cocina en el minimapa lleva a la cocina', e.ambiente === 'cocina' && !(await pag.evaluate(() => document.getElementById('minimapa').classList.contains('visor__minimapa--grande'))), e.ambiente);

    // Botón «Ir» de la tabla: lleva, deja la ficha y el minimapa a la vista (debajo de la cabecera) y el foco en la escena
    await pag.locator('[data-ir="bano-2"]').click();
    await esperar(300);
    await esperarQuieto(pag);
    await pag.waitForFunction(() => !window.recorrido3d.visor().animando, null, { timeout: 5000 });
    e = await est(pag);
    comprobar(id, '«Ir» de la tabla lleva al baño 2', e.ambiente === 'bano-2', e.ambiente);
    const fichaVisible = await debajoDeLaCabecera(pag, '#hud-ambiente');
    comprobar(id, 'después de «Ir», la cabecera no tapa la ficha del ambiente', fichaVisible.ok, JSON.stringify(fichaVisible));
    comprobar(id, 'después de «Ir», el foco queda en la escena (W camina sin hacer clic)', await pag.evaluate(() => document.activeElement?.id) === 'escena');
    await pag.locator('[data-ir="recamara-principal"]').click();
    await esperar(900);
    const ficha = await pag.evaluate(() => { const n = document.querySelector('.visor__ambiente-nombre'); return { sw: n.scrollWidth, cw: n.clientWidth, t: n.textContent }; });
    comprobar(id, 'la ficha dice «Recámara principal» entero (sin «…»)', ficha.sw <= ficha.cw && ficha.t === 'Recámara principal', JSON.stringify(ficha));

    // Pantalla completa (o maximizada) y de vuelta
    await pag.click('#b-completa');
    await esperar(400);
    const llena = await pag.evaluate(() => Boolean(document.fullscreenElement) || document.getElementById('visor').classList.contains('visor--maximizado'));
    const textoLleno = await pag.textContent('#b-completa');
    await pag.click('#b-completa');
    await esperar(300);
    comprobar(id, 'pantalla completa entra y sale', llena && textoLleno === 'Salir de pantalla completa' && (await pag.textContent('#b-completa')) === 'Pantalla completa');
    comprobar(id, 'sin scroll horizontal con el 3D abierto', await sinScrollLateral(pag));

    // Fuera de pantalla se pausa: con el visor lejos, ni caminando se dibuja
    await pag.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await esperar(400);
    const f0 = await pag.evaluate(() => { window.recorrido3d.visor().ponerIntencion({ avance: 1, lateral: 0, giro: 0, correr: false }); return window.recorrido3d.visor().cuadros; });
    await esperar(700);
    const f1 = await pag.evaluate(() => { const v = window.recorrido3d.visor(); v.ponerIntencion({ avance: 0, lateral: 0, giro: 0, correr: false }); return v.cuadros; });
    comprobar(id, 'con el visor fuera de pantalla no se dibuja', f1 - f0 <= 1, `${f1 - f0} cuadros`);
    await pag.evaluate(() => window.scrollTo(0, 0));

    // ── Editor ──
    await pag.click('#pestana-editor');
    await pag.waitForSelector('#editor-lienzo svg');
    comprobar(id, 'la pestaña del editor se abre', await pag.locator('#panel-editor').isVisible() && await pag.locator('#panel-recorrido').isHidden());
    await revisarTamanos(pag, id, 'editor');
    await pag.click('#restablecer');
    const nItems = () => pag.locator('#editor-lista > li').count();
    comprobar(id, 'el editor arranca con el plano de ejemplo (4 ambientes)', await nItems() === 4);
    await pag.locator('#editor-lienzo').scrollIntoViewIfNeeded();
    await foto('06-editor');
    const enPantalla = (x, y) => pag.evaluate(([x, y]) => {
      const svg = document.querySelector('#editor-lienzo svg');
      const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
      const p = pt.matrixTransform(svg.getScreenCTM());
      return { x: p.x, y: p.y };
    }, [x, y]);
    // Dibujar un rectángulo arrastrando: (4, 5.5) → (7, 8.5)
    await pag.selectOption('#tipo-nuevo', 'recamara');
    const a = await enPantalla(4.05, 5.55), b = await enPantalla(6.95, 8.45);
    if (cfg.movil) {
      // Con el dedo: eventos táctiles reales (touch-action: none en la cuadrícula)
      const cdpE = await ctx.newCDPSession(pag);
      await cdpE.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
      for (let i = 1; i <= 8; i++) await cdpE.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8 }] });
      await cdpE.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await esperar(150);
    } else {
      await pag.mouse.move(a.x, a.y);
      await pag.mouse.down();
      await pag.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
      await pag.mouse.move(b.x, b.y, { steps: 4 });
      await pag.mouse.up();
    }
    comprobar(id, `${cfg.movil ? 'arrastrar con el dedo' : 'arrastrar con el mouse'} en la cuadrícula agrega un ambiente`, await nItems() === 5 && (await pag.textContent('#editor-mensaje')).includes('Agregaste «Recámara 2» de 3.00 × 3.00 m'), await pag.textContent('#editor-mensaje'));
    // Puerta entre la sala y la nueva recámara
    await pag.locator('label:has(input[value="puerta"])').click();
    const pp = await enPantalla(5.5, 5.52);
    if (cfg.movil) await pag.touchscreen.tap(pp.x, pp.y); else await pag.mouse.click(pp.x, pp.y);
    comprobar(id, 'tocar un borde pone una puerta entre dos ambientes', (await pag.textContent('#editor-mensaje')).includes('Pusiste una puerta entre'), await pag.textContent('#editor-mensaje'));
    // Ventana en una pared interior: error que dice qué hacer
    await pag.locator('label:has(input[value="ventana"])').click();
    const pv = await enPantalla(7.02, 6.5);
    await pag.mouse.click(pv.x, pv.y);
    comprobar(id, 'una ventana en pared interior se rechaza con un mensaje claro', (await pag.textContent('#editor-mensaje')).includes('Entre dos ambientes interiores va una puerta'), await pag.textContent('#editor-mensaje'));
    const pv2 = await enPantalla(5.5, 8.48);
    await pag.mouse.click(pv2.x, pv2.y);
    comprobar(id, 'ventana en la pared de afuera', (await pag.textContent('#editor-mensaje')).includes('Pusiste una ventana'));
    // Ventana de la sala hacia el balcón: también (antes se rechazaba aunque el 3D trata esa pared como exterior)
    const pb = await enPantalla(3.5, 5.52);
    if (cfg.movil) await pag.touchscreen.tap(pb.x, pb.y); else await pag.mouse.click(pb.x, pb.y);
    comprobar(id, 'una ventana de la sala hacia el balcón se acepta', (await pag.textContent('#editor-mensaje')).includes('Pusiste una ventana entre «Sala y cocina» y «Balcón»'), await pag.textContent('#editor-mensaje'));
    await pag.click('#deshacer');
    // Formulario sin mouse
    await pag.locator('summary:has-text("Agregar un ambiente con medidas")').click();
    await pag.fill('#fa-nombre', 'Clóset');
    await pag.fill('#fa-x', ''); await pag.fill('#fa-y', '2'); await pag.fill('#fa-ancho', '2'); await pag.fill('#fa-largo', '2');
    await pag.locator('#form-ambiente button[type="submit"]').click();
    comprobar(id, 'un campo vacío no vale 0: el formulario pide el número', (await pag.textContent('#form-ambiente .editor__mensaje')).includes('Escribe «Desde la izquierda» en metros') && await nItems() === 5, await pag.textContent('#form-ambiente .editor__mensaje'));
    await pag.fill('#fa-x', '5');
    await pag.locator('#form-ambiente button[type="submit"]').click();
    comprobar(id, 'el formulario rechaza un ambiente encimado', (await pag.textContent('#form-ambiente .editor__mensaje')).includes('Se encima con «Sala y cocina»'));
    // «1,5» con coma decimal (un type="number" la perdía y llegaba 15)
    await pag.fill('#fa-x', '10.5'); await pag.fill('#fa-y', '1'); await pag.fill('#fa-ancho', '1,5');
    await pag.locator('#form-ambiente button[type="submit"]').click();
    comprobar(id, 'el formulario agrega un ambiente con medidas (y acepta la coma decimal)', await nItems() === 6 && (await pag.textContent('#form-ambiente .editor__mensaje')).includes('(1.50 × 2.00 m)'), await pag.textContent('#form-ambiente .editor__mensaje'));
    await pag.locator('summary:has-text("Agregar una puerta o ventana con medidas")').click();
    await pag.selectOption('#fp-ambiente', { label: 'Clóset' });
    await pag.selectOption('#fp-lado', 'izquierda');
    await pag.fill('#fp-pos', '1');
    await pag.locator('#form-abertura button[type="submit"]').click();
    comprobar(id, 'el formulario pone una puerta sin mouse', (await pag.textContent('#form-abertura .editor__mensaje')).includes('Pusiste una puerta en «Clóset»'), await pag.textContent('#form-abertura .editor__mensaje'));
    // Renombrar
    const nombreNuevo = pag.locator('#editor-lista input[type="text"]').nth(4);
    await nombreNuevo.fill('Estudio');
    await nombreNuevo.press('Tab');
    comprobar(id, 'renombrar un ambiente cambia el dibujo', (await pag.locator('#editor-lienzo svg').innerHTML()).includes('Estudio'));
    await pag.locator('#editor-lienzo').screenshot({ path: join(SALIDA, `${id}-07-editor-dibujado.png`) });

    // Exportar
    const [descarga] = await Promise.all([pag.waitForEvent('download'), pag.click('#exportar')]);
    const ruta = join(SALIDA, `${id}-exportado.json`);
    await descarga.saveAs(ruta);
    const exportado = JSON.parse(readFileSync(ruta, 'utf8'));
    comprobar(id, 'exportar JSON descarga un plano válido con 6 ambientes', exportado.formato === 'atk-plano' && exportado.ambientes.length === 6 && exportado.cuadricula?.ambientes.length === 6, descarga.suggestedFilename());

    // Ver en 3D el plano dibujado
    await pag.click('#ver-3d');
    await pag.waitForFunction(() => window.recorrido3d.visor()?.modelo?.ambientes.length === 6, null, { timeout: 15000 });
    await pag.waitForFunction(() => !window.recorrido3d.visor().animando, null, { timeout: 10000 });
    comprobar(id, '«Ver en 3D» recorre el plano dibujado', await pag.locator('#aviso-propio').isVisible() && await pag.locator('#panel-recorrido').isVisible());
    await esperarQuieto(pag);
    const avisoVisible = await debajoDeLaCabecera(pag, '#aviso-propio');
    comprobar(id, 'después de «Ver en 3D», la cabecera no tapa el aviso «Estás recorriendo…»', avisoVisible.ok, JSON.stringify(avisoVisible));
    const antesPropio = await est(pag);
    await caminar(pag, 'KeyW', 1500);
    const despuesPropio = await est(pag);
    comprobar(id, 'en el plano propio también se camina', Math.hypot(despuesPropio.x - antesPropio.x, despuesPropio.y - antesPropio.y) > 0.5);
    await pag.evaluate(() => window.scrollTo(0, 0));
    await foto('08-plano-propio-3d');
    await pag.click('#b-vista');
    await pag.waitForFunction(() => !window.recorrido3d.visor().animando, null, { timeout: 5000 });
    await foto('09-plano-propio-arriba');
    // Cambiar el dibujo después de abrirlo en 3D: el aviso lo dice y «Ver los cambios en 3D» lo pone al día.
    await pag.click('#seguir-editando');
    await pag.locator('#editor-lista [data-quitar]').last().click();
    await pag.click('#pestana-recorrido');
    const viejo = await pag.textContent('#aviso-propio-texto');
    comprobar(id, 'si el plano cambió después de «Ver en 3D», el aviso lo dice', viejo.includes('después lo cambiaste') && await pag.locator('#actualizar-propio').isVisible(), viejo);
    await pag.click('#actualizar-propio');
    await pag.waitForFunction(() => window.recorrido3d.visor()?.modelo?.ambientes.length === 5, null, { timeout: 10000 }).catch(() => {});
    comprobar(id, '«Ver los cambios en 3D» recorre el plano como está ahora', (await pag.evaluate(() => window.recorrido3d.visor().modelo.ambientes.length)) === 5 && (await pag.textContent('#aviso-propio-texto')).includes('5 ambientes') && await pag.locator('#actualizar-propio').isHidden(), await pag.textContent('#aviso-propio-texto'));
    await pag.click('#volver-ejemplo');
    await pag.waitForFunction(() => window.recorrido3d.visor().modelo.ambientes.length === 10, null, { timeout: 10000 });
    comprobar(id, '«Volver al apartamento de 95 m²» vuelve a cargarlo', await pag.locator('#aviso-propio').isHidden() && (await pag.textContent('#volver-ejemplo')) === 'Volver al apartamento de 95 m²');

    // Restablecer, deshacer, importar
    await pag.click('#pestana-editor');
    await pag.click('#restablecer');
    const tras = await nItems();
    await pag.click('#deshacer');
    comprobar(id, 'restablecer vuelve al ejemplo y deshacer lo revierte', tras === 4 && await nItems() === 5);
    // «Quitar» deja el foco en un nombre: un solo «Deshacer» tiene que devolver lo quitado (antes hacían falta dos).
    await pag.click('#restablecer');
    await pag.locator('#editor-lista li').nth(3).locator('[data-quitar]').click();
    await pag.click('#deshacer');
    comprobar(id, '«Quitar» y un «Deshacer» devuelve el ambiente', await nItems() === 4 && (await pag.locator('#editor-lista input[type="text"]').nth(3).inputValue()) === 'Balcón');

    await pag.click('#vaciar');
    comprobar(id, '«Empezar en blanco» deja la cuadrícula vacía con su aviso', await nItems() === 0 && await pag.locator('#editor-vacio').isVisible() && await pag.locator('#ver-3d').isDisabled());
    await pag.setInputFiles('#importar', ruta);
    await pag.waitForFunction(() => document.getElementById('editor-mensaje').textContent.includes('Importaste'), null, { timeout: 4000 }).catch(() => {});
    comprobar(id, 'importar el JSON exportado lo recupera', await nItems() === 6 && (await pag.textContent('#editor-mensaje')).includes('Importaste'), await pag.textContent('#editor-mensaje'));
    // Un archivo con dos ambientes del mismo id: se importa con ids distintos y «Quitar» se lleva uno solo.
    writeFileSync(join(SALIDA, `${id}-ids-repetidos.json`), JSON.stringify({ cuadricula: { version: 1, nombre: 'Uno', ancho: 12, largo: 10, ambientes: [{ id: 'x', nombre: 'A', tipo: 'sala', x: 0, y: 0, ancho: 3, largo: 3 }, { id: 'x', nombre: 'B', tipo: 'recamara', x: 3, y: 0, ancho: 3, largo: 3 }], aberturas: [] } }));
    await pag.setInputFiles('#importar', join(SALIDA, `${id}-ids-repetidos.json`));
    await pag.waitForFunction(() => document.getElementById('editor-mensaje').textContent.includes('«Uno»'), null, { timeout: 4000 }).catch(() => {});
    await pag.locator('#editor-lista li').nth(1).locator('[data-quitar]').click();
    comprobar(id, 'ids repetidos en un JSON: «Quitar» B deja a A', (await pag.$$eval('#editor-lista input[type="text"]', (l) => l.map((x) => x.value))).join() === 'A');
    await pag.click('#deshacer');
    await pag.click('#deshacer');
    writeFileSync(join(SALIDA, `${id}-malo.json`), '{"hola": 1}');
    await pag.setInputFiles('#importar', join(SALIDA, `${id}-malo.json`));
    await pag.waitForFunction(() => document.getElementById('editor-mensaje').textContent.includes('No se importó'), null, { timeout: 4000 }).catch(() => {});
    comprobar(id, 'importar un archivo que no es un plano da un error claro', (await pag.textContent('#editor-mensaje')).includes('No se importó'), await pag.textContent('#editor-mensaje'));

    // Persistencia en localStorage y sincronización entre pestañas
    const otra = await ctx.newPage();
    otra.on('pageerror', (er) => errores.push(`pageerror (2.ª pestaña): ${String(er).slice(0, 200)}`));
    await otra.goto(URL + '#dibuja', { waitUntil: 'networkidle' });
    await otra.waitForSelector('#editor-lista > li');
    comprobar(id, 'el dibujo sigue ahí al abrir la página de nuevo (localStorage)', await otra.locator('#editor-lista > li').count() === 6);
    // En una página recién abierta no hay nada que deshacer, y enfocar un nombre sin escribir no lo cambia.
    const enfocar = otra.locator('#editor-lista input[type="text"]').first();
    await enfocar.focus();
    await enfocar.press('Tab');
    comprobar(id, 'enfocar un nombre sin escribir no deja un «Deshacer» que no deshace nada', await otra.locator('#deshacer').isDisabled());
    await pag.locator('#editor-lista [data-quitar]').first().click();
    await otra.waitForFunction(() => document.querySelectorAll('#editor-lista > li').length === 5, null, { timeout: 4000 }).catch(() => {});
    comprobar(id, 'un cambio en una pestaña aparece en la otra (BroadcastChannel)', await otra.locator('#editor-lista > li').count() === 5);
    await otra.close();
    await pag.click('#restablecer');

    comprobar(id, 'sin scroll horizontal al final', await sinScrollLateral(pag));
    comprobar(id, 'consola sin errores', errores.length === 0, errores.join(' | '));
    const ext = [...externos].filter((o) => o !== 'https://cdn.jsdelivr.net');
    comprobar(id, 'lo único que se pide fuera de este sitio es three.js en cdn.jsdelivr.net', ext.length === 0, [...externos].join(', '));
  } catch (err) {
    comprobar(id, 'la corrida terminó sin excepciones', false, String(err).slice(0, 400));
    await foto('zz-error').catch(() => {});
  } finally {
    await ctx.close();
  }
}

// El navegador cierra el contexto WebGL (teléfono con poca memoria) y se pulsa «Volver a intentarlo»: los controles
// tienen que seguir funcionando una sola vez cada uno (antes se duplicaban y «Medir», M y V no hacían nada).
async function corridaContexto(nav) {
  const id = '1280-contexto-perdido';
  const { ctx, pag, errores } = await nuevaPagina(nav, { ancho: 1280, alto: 800, tema: 'claro', movil: false });
  try {
    await pag.goto(URL, { waitUntil: 'networkidle' });
    await entrar(pag);
    const cdp = await ctx.newCDPSession(pag);
    const escuchas = async (sel) => {
      const { result } = await cdp.send('Runtime.evaluate', { expression: `document.querySelector('${sel}')` });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
      return listeners.filter((l) => l.type === 'keydown' || l.type === 'click').length;
    };
    const antes = [await escuchas('#escena'), await escuchas('#b-medir')];
    await pag.evaluate(() => document.querySelector('.visor__lienzo').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await pag.waitForFunction(() => document.getElementById('visor').dataset.estado === 'error', null, { timeout: 5000 });
    const limpio = await pag.evaluate(() => ['hud-ambiente', 'minimapa', 'consejo'].every((x) => getComputedStyle(document.getElementById(x)).display === 'none'));
    comprobar(id, 'con el contexto perdido, el aviso y nada del recorrido detrás (ficha, minimapa, consejo)', limpio && await pag.locator('#reintentar').isVisible());
    await pag.screenshot({ path: join(SALIDA, `${id}.png`) });
    await pag.click('#reintentar');
    await pag.waitForFunction(() => document.getElementById('visor').dataset.estado === 'listo' && !window.recorrido3d.visor()?.animando, null, { timeout: 60000 });
    const despues = [await escuchas('#escena'), await escuchas('#b-medir')];
    comprobar(id, 'tras «Volver a intentarlo», cada control tiene una sola escucha', despues.join() === antes.join(), `antes ${antes}, después ${despues}`);
    await pag.focus('#escena');
    await pag.keyboard.press('KeyM');
    const conM = await pag.evaluate(() => window.recorrido3d.visor().midiendo);
    await pag.click('#b-medir');
    const conClic = await pag.evaluate(() => window.recorrido3d.visor().midiendo);
    comprobar(id, 'tras reintentar, M enciende «Medir» y el botón lo apaga', conM === true && conClic === false && (await pag.getAttribute('#b-medir', 'aria-pressed')) === 'false');
    await pag.focus('#escena');
    await pag.keyboard.press('KeyV');
    await pag.waitForFunction(() => !window.recorrido3d.visor().animando, null, { timeout: 5000 });
    comprobar(id, 'tras reintentar, V cambia la vista', (await est(pag)).vista === 'arriba');
    comprobar(id, 'consola sin errores', errores.length === 0, errores.join(' | '));
  } finally {
    await ctx.close();
  }
}

async function corridaReducida(nav) {
  const id = '1280-reducir-movimiento';
  const { ctx, pag, errores } = await nuevaPagina(nav, { ancho: 1280, alto: 800, tema: 'claro', movil: false, reducir: true });
  try {
    await pag.goto(URL, { waitUntil: 'networkidle' });
    await pag.click('#entrar');
    await pag.waitForFunction(() => document.getElementById('visor').dataset.estado === 'listo', null, { timeout: 90000 });
    const animando = await pag.evaluate(() => window.recorrido3d.visor().animando);
    comprobar(id, 'con «reducir movimiento» entra sin el vuelo de cámara', !animando && (await est(pag)).vista === 'primera');
    await pag.click('#b-vista');
    comprobar(id, 'y cambia de vista sin animar', !(await pag.evaluate(() => window.recorrido3d.visor().animando)) && (await est(pag)).vista === 'arriba');
    comprobar(id, 'consola sin errores', errores.length === 0, errores.join(' | '));
  } finally {
    await ctx.close();
  }
}

async function corridaSinRed(nav) {
  const id = '1280-sin-cdn';
  const { ctx, pag, errores } = await nuevaPagina(nav, { ancho: 1280, alto: 800, tema: 'claro', movil: false });
  try {
    await pag.route('https://cdn.jsdelivr.net/**', (r) => r.abort('internetdisconnected'));
    await pag.goto(URL, { waitUntil: 'networkidle' });
    await pag.click('#entrar');
    await pag.waitForFunction(() => document.getElementById('visor').dataset.estado === 'error', null, { timeout: 30000 });
    const texto = await pag.textContent('#estado-texto');
    comprobar(id, 'sin acceso a la CDN: dice qué pasó y qué hacer', texto.includes('No se pudo descargar el visor 3D') && await pag.locator('#reintentar').isVisible(), texto);
    await pag.screenshot({ path: join(SALIDA, `${id}-error.png`) });
    // Con letra al 200 % en 320 px, el aviso y su botón también se ven enteros (antes quedaban recortados).
    await pag.setViewportSize({ width: 320, height: 700 });
    await pag.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await esperar(300);
    const reintentar = await dentroDeLaEscena(pag, '#reintentar');
    comprobar(id, '320 px con letra al 200 %: «Volver a intentarlo» cae dentro de la escena', reintentar.ok, JSON.stringify(reintentar));
    await pag.locator('#visor').screenshot({ path: join(SALIDA, `${id}-320-letra-200.png`) });
    await pag.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await pag.setViewportSize({ width: 1280, height: 800 });
    await pag.unroute('https://cdn.jsdelivr.net/**');
    await pag.click('#reintentar');
    await pag.waitForFunction(() => document.getElementById('visor').dataset.estado === 'listo', null, { timeout: 90000 }).catch(() => {});
    comprobar(id, '«Volver a intentarlo» carga el 3D cuando vuelve la red', (await pag.getAttribute('#visor', 'data-estado')) === 'listo');
    const propios = errores.filter((x) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch dynamically imported module|net::/.test(x));
    comprobar(id, 'solo los errores de red esperados en la consola', propios.length === 0, propios.join(' | '));
  } finally {
    await ctx.close();
  }
}

async function corridaBordes(nav) {
  // Sin JavaScript: el contenido principal se ve igual (título, imagen fija, plano, tabla).
  const id = 'bordes';
  const c1 = await nav.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const p1 = await c1.newPage();
  await p1.goto(URL, { waitUntil: 'load' });
  const ok = await p1.locator('h1').isVisible() && await p1.evaluate(() => document.querySelector('.visor__portada img').complete)
    && await p1.locator('.plano-svg--pagina').isVisible() && (await p1.locator('.tabla-ambientes tbody tr').count()) === 10
    && await p1.locator('.pestanas').isHidden() && await p1.locator('#entrar').isHidden() && await p1.locator('#ayuda-recorrido').isHidden();
  comprobar(id, 'sin JavaScript se ven el título, la imagen fija, el plano y la tabla (y no botones ni instrucciones muertos)', ok);
  await p1.screenshot({ path: join(SALIDA, 'sin-javascript-390.png'), fullPage: true });
  await c1.close();
  // 320 px con la letra al 200 %: nada obliga a desplazarse de lado
  const c2 = await nav.newContext({ viewport: { width: 320, height: 700 } });
  const p2 = await c2.newPage();
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await esperar(300);
  const ancho = await p2.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  comprobar(id, '320 px con letra al 200 %: sin scroll horizontal', ancho[0] <= ancho[1], `${ancho[0]} de ${ancho[1]} px`);
  const entrarVisible = await dentroDeLaEscena(p2, '#entrar');
  comprobar(id, '320 px con letra al 200 %: «Entrar al recorrido» cae dentro de la escena', entrarVisible.ok, JSON.stringify(entrarVisible));
  await p2.locator('#visor').screenshot({ path: join(SALIDA, '320-letra-200-visor.png') });
  await p2.click('#pestana-editor');
  await p2.waitForSelector('#editor-lienzo svg');
  const ancho2 = await p2.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  comprobar(id, '320 px con letra al 200 %: el editor tampoco', ancho2[0] <= ancho2[1], `${ancho2[0]} de ${ancho2[1]} px`);
  await p2.screenshot({ path: join(SALIDA, '320-letra-200.png') });
  await c2.close();
  // Navegar hacia atrás con Shift+Tab desde el pie: ningún foco queda tapado por la cabecera fija (WCAG 2.4.11).
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const c3 = await nav.newContext({ viewport: { width: w, height: h } });
    const p3 = await c3.newPage();
    await p3.goto(URL, { waitUntil: 'networkidle' });
    await p3.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p3.focus('.pie a[href*=privacidad]');
    const tapados = [];
    for (let i = 0; i < 45; i++) {
      await p3.keyboard.press('Shift+Tab');
      await esperar(30);
      const f = await p3.evaluate(() => {
        const a = document.activeElement; const r = a.getBoundingClientRect();
        const cab = document.querySelector('.cabecera').getBoundingClientRect().bottom;
        // Al pasar del primer elemento, el foco sale de la página (activeElement = body): eso no es un foco tapado.
        const enPagina = a !== document.body && a !== document.documentElement;
        return { t: (a.textContent || a.id).trim().slice(0, 30), top: Math.round(r.top), tapado: enPagina && !a.closest('header') && !a.classList.contains('saltar') && r.top < cab - 0.5 };
      });
      if (f.tapado) tapados.push(f);
    }
    comprobar(id, `${w} px: con Shift+Tab ningún foco queda debajo de la cabecera`, tapados.length === 0, tapados.slice(0, 3).map((f) => `${f.t} (${f.top})`).join(', '));
    await p3.goto(URL, { waitUntil: 'networkidle' });
    await p3.keyboard.press('Tab');
    await p3.keyboard.press('Enter');
    await esperar(300);
    const migas = await debajoDeLaCabecera(p3, '.migas');
    comprobar(id, `${w} px: «Saltar al contenido» deja las migas a la vista`, migas.ok, JSON.stringify(migas));
    await c3.close();
  }
}

async function corridaSinWebGL() {
  const id = '1280-sin-webgl';
  const nav = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
  try {
    const { ctx, pag } = await nuevaPagina(nav, { ancho: 1280, alto: 800, tema: 'claro', movil: false });
    await pag.goto(URL, { waitUntil: 'networkidle' });
    await pag.click('#entrar');
    await pag.waitForFunction(() => document.getElementById('visor').dataset.estado === 'error', null, { timeout: 60000 });
    const texto = await pag.textContent('#estado-texto');
    comprobar(id, 'sin WebGL: lo dice y manda al plano de abajo', texto.includes('WebGL'), texto);
    await pag.screenshot({ path: join(SALIDA, `${id}.png`) });
    await ctx.close();
  } finally {
    await nav.close();
  }
}

let servidor = null;
try {
  if (!(await hayServidor())) {
    servidor = spawn('python3', ['-m', 'http.server', String(PUERTO), '-d', REPOS], { stdio: 'ignore' });
    for (let i = 0; i < 50 && !(await hayServidor()); i++) await esperar(100);
  }
  for (const movil of [true, false]) {
    const nav = await chromium.launch({ args: [...GL, movil ? TACTIL : MOUSE] });
    try {
      for (const tema of ['claro', 'oscuro']) {
        await corridaPrincipal(nav, movil ? { ancho: 390, alto: 844, tema, movil, paginaEntera: true } : { ancho: 1280, alto: 800, tema, movil, paginaEntera: true });
      }
      if (!movil) {
        await corridaContexto(nav);
        await corridaReducida(nav);
        await corridaSinRed(nav);
        await corridaBordes(nav);
      }
    } finally {
      await nav.close();
    }
  }
  await corridaSinWebGL();
} finally {
  if (servidor) servidor.kill();
}

const fallas = resultados.filter((r) => !r.ok);
writeFileSync(join(SALIDA, 'resultados.json'), JSON.stringify(resultados, null, 1));
console.log(`\n${resultados.length - fallas.length} de ${resultados.length} comprobaciones pasan. Capturas en ${SALIDA}`);
process.exit(fallas.length ? 1 : 0);
