// La portada de Med (med/) en un navegador de verdad: nada se sale por la derecha del teléfono a la computadora
// (tampoco en la portada de alphateklab ni en Food), sin errores en la consola ni recursos rotos, el menú del teléfono, los paquetes de mensajes, la calculadora, lo que
// viaja al formulario de la prueba y el mensaje que arma, las animaciones (y quietas con «reducir movimiento»), el
// modo oscuro y el sistema de títulos.
// Uso: node pruebas/navegador/citas.mjs <url>   (local: node herramientas/servir.mjs y http://localhost:4900/alphateklab/)
//      MOTOR=webkit para el motor de Safari.
import assert from 'node:assert/strict';
import pw from '../../herramientas/navegador.mjs';
import { PRECIOS, dolares, sumar } from '../../datos/producto.mjs';
import { FUNCIONES } from '../../datos/paginas.mjs';
import { GUIAS } from '../../datos/guias-citas.mjs';
const SUBPAGINAS = [...FUNCIONES, ...GUIAS].map((f) => f.ruta);
const INICIO = 'med/'; // la portada de Med; la raíz es la portada de alphateklab
const OTRAS = ['', 'food/']; // la portada de alphateklab y Food (herramientas/generar-portada.mjs --raiz)

const BASE = (process.argv[2] || 'http://localhost:4900/alphateklab/').replace(/\/?$/, '/');
const motor = pw[process.env.MOTOR || 'chromium'];
const b = await motor.launch();
let fallos = 0;
async function paso(nombre, fn) {
  try {
    await fn();
    console.log(`ok   ${nombre}`);
  } catch (e) {
    fallos++;
    console.log(`MAL  ${nombre}\n     ${String(e.message).split('\n').slice(0, 4).join('\n     ')}`);
  }
}
// Quieta por defecto (sin desplazamiento suave ni animaciones atadas al scroll, que mueven lo que se va a tocar);
// la prueba de las animaciones pide movimiento.
const abrir = async (opciones = {}, ruta = INICIO) => {
  const c = await b.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce', ...opciones });
  const p = await c.newPage();
  await p.goto(BASE + ruta, { waitUntil: 'load' });
  return { c, p };
};
// baja por toda la página para que carguen las imágenes perezosas
const recorrer = (p) => p.evaluate(async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
    scrollTo({ top: y, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 50));
  }
  scrollTo({ top: 0, behavior: 'instant' });
});

try {
  await paso('nada se sale por la derecha, de 320 a 1440 px (portadas, Food, páginas de función y guías)', async () => {
    const malos = [];
    for (const ruta of [...OTRAS, INICIO, ...SUBPAGINAS]) {
      for (const ancho of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440]) {
        const { c, p } = await abrir({ viewport: { width: ancho, height: 800 } }, ruta);
        const sobra = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (sobra > 0) malos.push(`${ruta || 'la raíz'} a ${ancho} px: ${sobra} px de más`);
        await c.close();
      }
    }
    assert.deepEqual(malos, []);
  });

  await paso('sin errores en la consola ni recursos rotos (portadas, Food, páginas de función, guías, privacidad, /citasmed/, entrar/)', async () => {
    const errores = [];
    for (const ruta of [...OTRAS, INICIO, ...SUBPAGINAS, 'privacidad/', 'citasmed/', 'entrar/']) {
      const c = await b.newContext({ viewport: { width: 1280, height: 860 } });
      const p = await c.newPage();
      p.on('console', (m) => m.type() === 'error' && errores.push(`${ruta}: ${m.text()}`));
      p.on('pageerror', (e) => errores.push(`${ruta}: ${e.message}`));
      p.on('response', (r) => r.status() >= 400 && errores.push(`${ruta}: ${r.status()} ${r.url()}`));
      await p.goto(BASE + ruta, { waitUntil: 'networkidle' });
      if (ruta === 'citasmed/') {
        await p.waitForURL((u) => !u.pathname.includes('citasmed'), { timeout: 5000 });
      } else await recorrer(p);
      await p.waitForTimeout(300);
      const rotas = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
      for (const r of rotas) errores.push(`${ruta}: imagen rota ${r}`);
      await c.close();
    }
    assert.deepEqual(errores, []);
  });

  await paso('el menú del teléfono abre, lleva a la sección y se cierra', async () => {
    const { c, p } = await abrir({ viewport: { width: 390, height: 800 } });
    const boton = p.locator('[data-abrir-menu]');
    assert.ok(await boton.isVisible());
    await boton.click();
    assert.equal(await boton.getAttribute('aria-expanded'), 'true');
    await p.locator('#menu-movil a[href$="#precios"]').click();
    assert.ok(await p.locator('#menu-movil').isHidden());
    await p.waitForFunction(() => location.hash === '#precios');
    await p.waitForTimeout(300);
    const arriba = await p.evaluate(() => document.getElementById('precios').getBoundingClientRect().top);
    assert.ok(arriba < 200, `la sección de precios quedó en ${Math.round(arriba)} px`);
    await c.close();
  });

  await paso('la agenda tiene su precio y el paquete de mensajes se suma aparte (sin paquete por defecto)', async () => {
    const { c, p } = await abrir();
    assert.equal(await p.locator('.plan--agenda .plan__precio strong').innerText(), dolares(PRECIOS.agenda));
    const total = async () => (await p.locator('.plan--agenda .plan__suma:visible').allInnerTexts()).join(' | ');
    // Sin paquetes a la venta (PAQUETES_A_LA_VENTA, 13-oct): una sola línea, con un toque, y ningún paquete que elegir.
    if (PRECIOS.mensajes.length < 2) {
      assert.equal(await p.locator('.plan--agenda input[name="plan-mensajes"]').count(), 0, 'no se ofrecen paquetes');
      assert.match(await total(), new RegExp(`con un toque[\\s\\S]*Total: \\${dolares(PRECIOS.agenda)} al mes$`));
      assert.doesNotMatch(await p.locator('main').innerText(), /salen solos|mensajes automáticos|confirmaciones automáticas|recordatorios automáticos/i, 'nada promete mensajes que salen solos');
      await c.close();
      return;
    }
    assert.ok(await p.locator('.plan--agenda input[value="0"]').isChecked(), 'sin paquete, por defecto');
    assert.match(await total(), new RegExp(`con un toque[\\s\\S]*Total: \\${dolares(PRECIOS.agenda)} al mes$`));
    for (const m of PRECIOS.mensajes.slice(1)) {
      await p.locator(`.plan--agenda label:has(input[value="${m.mensajes}"])`).click();
      assert.ok(await p.locator(`.plan--agenda input[value="${m.mensajes}"]`).isChecked());
      assert.match(await total(), new RegExp(`${m.mensajes} mensajes[\\s\\S]*Total: \\${dolares(sumar(PRECIOS.agenda, m.precio))} al mes$`));
    }
    assert.equal(await p.locator('.plan--agenda .plan__precio strong').innerText(), dolares(PRECIOS.agenda), 'el precio de la agenda no cambia');
    await c.close();
  });

  await paso('la calculadora suma lo que eliges', async () => {
    const { c, p } = await abrir();
    const total = () => p.locator('[data-total]').innerText();
    const [p0, p1] = PRECIOS.mensajes;
    const exp = (n) => Array(n).fill(PRECIOS.expediente);
    assert.ok(await p.locator('[data-calculadora]').isVisible());
    assert.equal(await p.inputValue('[name="calc-mensajes"]'), '0', 'sin paquete, por defecto');
    assert.equal(await total(), dolares(sumar(PRECIOS.agenda, p0.precio, ...exp(2))));
    // Sin paquetes a la venta (PAQUETES_A_LA_VENTA, 13-oct) la calculadora no ofrece mensajes: la agenda va sola.
    const paquete = p1 || p0;
    if (p1) {
      await p.selectOption('[name="calc-mensajes"]', String(p1.mensajes));
      assert.equal(await total(), dolares(sumar(PRECIOS.agenda, p1.precio, ...exp(2))));
      assert.equal(await p.locator('[data-sub="agenda"]').innerText(), dolares(sumar(PRECIOS.agenda, p1.precio)));
      // la tarjeta de la agenda sigue a la calculadora
      assert.ok(await p.locator(`.plan--agenda input[value="${p1.mensajes}"]`).isChecked());
    } else {
      assert.equal(await p.locator('[name="calc-mensajes"]').isVisible(), false, 'sin paquetes, no hay mensajes que elegir');
    }
    await p.click('[data-sumar="1"]');
    await p.click('[data-sumar="1"]');
    assert.equal(await total(), dolares(sumar(PRECIOS.agenda, paquete.precio, ...exp(4))));
    await p.uncheck('[name="calc-agenda"]');
    assert.equal(await total(), dolares(sumar(...exp(4))));
    await p.fill('[name="calc-profesionales"]', '0');
    await p.locator('[name="calc-profesionales"]').blur();
    assert.equal(await p.inputValue('[name="calc-profesionales"]'), '1', 'no baja de un profesional');
    await c.close();
  });

  await paso('el formulario de la prueba recibe el plan y arma el mensaje (si hay contacto)', async () => {
    const { c, p } = await abrir();
    if (!(await p.locator('[data-prueba]').count())) {
      console.log('     (sin contacto en datos/sitio.mjs: la portada no lleva formulario)');
      await c.close();
      return;
    }
    await p.evaluate(() => { window.__abierto = null; window.open = (u) => { window.__abierto = u; return {}; }; });
    await p.selectOption('[name="calc-mensajes"]', String(PRECIOS.mensajes[1].mensajes));
    await p.click('[data-elegir="calculadora"]');
    assert.equal(await p.inputValue('[data-prueba] [name="medicos"]'), '2');
    assert.ok(await p.locator('[data-prueba] [name="interes"][value="los dos"]').isChecked());
    await p.fill('[data-prueba] [name="nombre"]', 'Dra. Prueba');
    await p.fill('[data-prueba] [name="clinica"]', 'Clínica de Prueba');
    const boton = p.locator('[data-prueba] button[value="whatsapp"]');
    if (await boton.count()) {
      await boton.click();
      const url = await p.evaluate(() => window.__abierto);
      assert.match(url, /^https:\/\/wa\.me\/\d+\?text=/);
      const texto = decodeURIComponent(url.split('text=')[1]);
      assert.ok(texto.includes('Clínica de Prueba') && texto.includes('Quiero probar: los dos') && texto.includes(dolares(PRECIOS.mensajes[1].precio)), texto);
    }
    await c.close();
  });

  await paso('«Probar este plan» lleva al registro con lo elegido (si el registro está en línea)', async () => {
    const { c, p } = await abrir();
    if (!(await p.locator('[data-elegir="calculadora"][data-registro]').count())) {
      console.log('     (sin registro en línea: va al formulario de la prueba)');
      await c.close();
      return;
    }
    let pedida = null;
    await p.route(/\/registro\/?(\?|$)/, (r) => { pedida = r.request().url(); r.fulfill({ status: 200, contentType: 'text/html', body: 'registro' }); });
    const ultimo = PRECIOS.mensajes.at(-1);
    if (PRECIOS.mensajes.length > 1) await p.selectOption('[name="calc-mensajes"]', String(ultimo.mensajes));
    await p.click('[data-sumar="1"]');
    await p.click('[data-elegir="calculadora"]');
    await p.waitForURL(/\/registro\/?\?/);
    const q = new URL(pedida).searchParams;
    assert.deepEqual([q.get('expediente'), q.get('profesionales'), q.get('agenda'), q.get('mensajes')], ['1', '3', '1', String(ultimo.mensajes)]);
    await c.close();
  });

  await paso('«Iniciar sesión» arriba lleva a entrar/, y con el usuario se pasa al sistema de la clínica', async () => {
    const { c, p } = await abrir();
    const enlace = p.locator('[data-entrar-cab]');
    if (!(await enlace.count())) { await c.close(); return; } // sin el registro en línea no hay «Iniciar sesión»
    assert.equal((await enlace.innerText()).trim(), 'Iniciar sesión');
    // El servicio de cuentas (simulado): de qué clínica es cada usuario. «edwincutire» es de una cuenta del registro
    // viejo, donde el usuario no es la dirección.
    let caido = false;
    await c.route(/^https:\/\/cuentas\.alphateklab\.com\/api\/clinica/, (r) => {
      if (caido) return r.abort();
      const u = new URL(r.request().url()).searchParams.get('usuario');
      const slug = { 'luisprueba.secretaria': 'luisprueba', edwincutire: 'clinica-alpha', 'edwin@ejemplo.com': 'clinica-alpha' }[u];
      return r.fulfill({ status: slug ? 200 : 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(slug ? { ok: true, slug } : { ok: false }) });
    });
    // El sistema de cada clínica está en otro dominio: aquí se ataja y se mira a dónde iba.
    await c.route(/^https:\/\/(?!cuentas\.)[a-z0-9-]+\.alphateklab\.com\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>sistema de la clínica</p>' }));
    await enlace.click();
    await p.waitForURL(/\/entrar\/$/);
    // Con el correo de quien registró la clínica, también (Edwin, 8-oct); con uno que no está, lo dice.
    await p.fill('[name=usuario]', 'ana@ejemplo');
    await p.click('[data-entrar] [type=submit]');
    assert.match(await p.textContent('[data-error]'), /Revisa el correo/);
    await p.fill('[name=usuario]', 'ana@ejemplo.com');
    await p.click('[data-entrar] [type=submit]');
    await p.locator('[data-error]', { hasText: 'No encontramos una clínica registrada con ese correo' }).waitFor();
    await p.fill('[name=usuario]', ' Edwin@Ejemplo.com ');
    await p.click('[data-entrar] [type=submit]');
    await p.waitForURL(/^https:\/\/clinica-alpha\.alphateklab\.com\/entrar\.html\?usuario=edwin%40ejemplo\.com$/);
    await p.goto(BASE + 'entrar/');
    await p.fill('[name=usuario]', 'nadie');
    await p.click('[data-entrar] [type=submit]');
    await p.locator('[data-error]', { hasText: 'No encontramos ese usuario' }).waitFor();
    await p.fill('[name=usuario]', ' LuisPrueba.Secretaria ');
    await p.click('[data-entrar] [type=submit]');
    await p.waitForURL(/^https:\/\/luisprueba\.alphateklab\.com\/entrar\.html\?usuario=luisprueba\.secretaria$/);
    // Al volver, recuerda el usuario. El del registro viejo va a su clínica, aunque no sea la dirección.
    await p.goto(BASE + 'entrar/');
    assert.equal(await p.inputValue('[name=usuario]'), 'luisprueba.secretaria');
    await p.fill('[name=usuario]', 'edwincutire');
    await p.click('[data-entrar] [type=submit]');
    await p.waitForURL(/^https:\/\/clinica-alpha\.alphateklab\.com\/entrar\.html\?usuario=edwincutire$/);
    // Si el servicio de cuentas no contesta, se va por la dirección (pegarla también sirve).
    caido = true;
    await p.goto(BASE + 'entrar/');
    await p.fill('[name=usuario]', 'https://clinica-alpha.alphateklab.com/citas.html');
    await p.click('[data-entrar] [type=submit]');
    await p.waitForURL(/^https:\/\/clinica-alpha\.alphateklab\.com\/entrar\.html\?usuario=clinica-alpha$/);
    await c.close();
    // En el teléfono dice «Entrar» y cabe.
    const tel = await abrir({ viewport: { width: 320, height: 700 } });
    assert.equal((await tel.p.locator('[data-entrar-cab]').innerText()).trim(), 'Entrar');
    assert.ok(await tel.p.locator('[data-entrar-cab]').isVisible());
    await tel.c.close();
  });

  await paso('la conversación y el dictado se animan al verse, y quedan quietos con «reducir movimiento»', async () => {
    const { c, p } = await abrir({ reducedMotion: 'no-preference' });
    await p.locator('[data-chat]').scrollIntoViewIfNeeded();
    await p.waitForFunction(() => document.querySelector('[data-chat] .esperando, [data-chat] .chat__escribiendo'), null, { timeout: 4000 });
    // los dos dictados (el del héroe y el de su sección) se escriben solos al verse
    for (const i of [0, 1]) {
      await p.locator('[data-dictado]').nth(i).scrollIntoViewIfNeeded();
      await p.waitForFunction((i) => document.querySelectorAll('[data-dictado]')[i].querySelector('.escribiendo'), i, { timeout: 4000 });
    }
    await c.close();
    const q = await abrir({ reducedMotion: 'reduce' });
    await q.p.locator('[data-chat]').scrollIntoViewIfNeeded();
    await q.p.waitForTimeout(1500);
    assert.equal(await q.p.locator('[data-chat] [data-paso]:visible').count(), 3, 'la conversación entera');
    const textos = await q.p.locator('[data-dictado] [data-texto]').evaluateAll((els) => els.every((e) => e.textContent === e.dataset.texto));
    assert.ok(textos, 'el dictado completo');
    await q.c.close();
  });

  await paso('sale en claro aunque el equipo esté en oscuro; el botón pasa al oscuro con sus capturas y se recuerda', async () => {
    const { c, p } = await abrir({ colorScheme: 'dark' });
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'light');
    await recorrer(p);
    const claras = await p.evaluate(() => [...document.querySelectorAll('img[data-oscuro]')].map((i) => i.currentSrc));
    assert.ok(claras.length >= 4 && claras.every((s) => s && !s.includes('-oscuro')), claras.join('\n'));
    await p.click('[data-tema]');
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark');
    assert.equal(await p.getAttribute('[data-tema]', 'aria-pressed'), 'true');
    await recorrer(p);
    await p.waitForTimeout(300);
    const oscuras = await p.evaluate(() => [...document.querySelectorAll('img[data-oscuro]')].map((i) => i.currentSrc));
    assert.ok(oscuras.every((s) => s.includes('-oscuro')), oscuras.join('\n'));
    const fondo = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(fondo, 'rgb(15, 18, 24)', 'el fondo oscuro');
    await p.reload();
    assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark', 'se recuerda al volver');
    await c.close();
  });

  await paso('los títulos: Manrope 700 y el H1 más grande que cualquier H2', async () => {
    for (const ancho of [1440, 390]) {
      const { c, p } = await abrir({ viewport: { width: ancho, height: 900 } });
      const r = await p.evaluate(() => {
        const est = (e) => { const s = getComputedStyle(e); return { px: parseFloat(s.fontSize), w: s.fontWeight, f: s.fontFamily.split(',')[0].replace(/"/g, '').trim(), t: e.textContent.trim().slice(0, 30) }; };
        return { h1: [...document.querySelectorAll('h1')].map(est), h2: [...document.querySelectorAll('main h2')].map(est), h3: [...document.querySelectorAll('main h3')].map(est) };
      });
      for (const x of [...r.h1, ...r.h2, ...r.h3]) assert.ok(x.w === '700' && x.f === 'Manrope', `${ancho}: «${x.t}» ${x.f} ${x.w}`);
      const maxH2 = Math.max(...r.h2.map((x) => x.px));
      assert.ok(r.h1[0].px > maxH2, `${ancho}: H1 ${r.h1[0].px} px y H2 ${maxH2} px`);
      await c.close();
    }
  });
} finally {
  await b.close();
}
console.log(fallos ? `${fallos} pasos fallaron` : 'todo bien');
process.exit(fallos ? 1 : 0);
