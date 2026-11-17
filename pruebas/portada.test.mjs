// La portada de alphateklab (la raíz del sitio) y la página de Food. Desde el 17-nov-2026 la raíz es la portada nueva,
// estática (la propuesta de rediseño; ver herramientas/generar-portada.mjs): food/ sigue al día con datos/food.mjs y se
// contacta por su formulario, que llega a FormSubmit (sin WhatsApp). Corre con: node --test pruebas/portada.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOOD } from '../datos/food.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8');
const GENERADAS = ['food/index.html']; // las escribe generar-portada.mjs --raiz
const PAGINAS = ['index.html', ...GENERADAS];

test('lo publicado está al día: generar otra vez da lo mismo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'portada-'));
  try {
    const env = { ...process.env, SALIDA: dir };
    delete env.FORM_DESTINO;
    execFileSync(process.execPath, [join(RAIZ, 'herramientas/generar-portada.mjs'), '--raiz'], { env, stdio: 'pipe' });
    for (const r of GENERADAS) assert.equal(readFileSync(join(dir, r), 'utf8'), leer(r), `${r}: corre node herramientas/generar-portada.mjs --raiz`);
    assert.ok(!existsSync(join(dir, 'index.html')), '--raiz ya no escribe index.html: la portada nueva es estática');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('la portada nueva (17-nov) es la de verdad: canónica en la raíz, sin vista previa, sin noindex y sin marcas de propuesta', () => {
  const html = leer('index.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/alphateklab\.com\/" \/>/, 'canónica en la raíz');
  assert.doesNotMatch(html, /portada-nueva|noindex/, 'ni la vista previa, ni fuera de los buscadores');
  assert.doesNotMatch(html, /propuesta interna|datos de ejemplo|por confirmar/i, 'sin la franja ni las rayas de la propuesta');
  for (const r of ['servicios.html', 'paquetes.html', 'demos.html']) assert.ok(html.includes(`href="${r}"`), `lleva a ${r}`);
});

test('Food se contacta por su formulario, que llega a FormSubmit; sin WhatsApp', () => {
  const html = leer('food/index.html');
  const form = html.match(/<form class="sm-form"[^>]*>/)?.[0];
  assert.ok(form, 'el formulario');
  assert.ok(FOOD.formulario.destino, 'el destino, en datos/food.mjs');
  const d = encodeURIComponent(FOOD.formulario.destino);
  assert.ok(form.includes(`action="https://formsubmit.co/${d}"`) && form.includes(`data-ajax="https://formsubmit.co/ajax/${d}"`), form);
  for (const campo of ['nombre', 'email', 'mensaje', '_honey', '_subject', '_next']) assert.match(html, new RegExp(`name="${campo}"`), campo);
  assert.ok(html.includes('value="https://alphateklab.com/food/#enviado"') && html.includes('id="enviado"'), 'sin JavaScript, FormSubmit vuelve a #enviado');
  // Sin WhatsApp para contactar a Food. La portada nueva sí nombra el chatbot de WhatsApp como servicio.
  for (const r of GENERADAS) assert.doesNotMatch(leer(r), /wa\.me|whatsapp-logo/i, `${r}: sin WhatsApp`);
  assert.doesNotMatch(leer('index.html'), /wa\.me/i, 'index.html: sin enlaces a WhatsApp');
  assert.match(leer('privacidad/index.html'), /formsubmit\.co/, 'la privacidad dice a dónde va el formulario');
});

test('Vuelve, la tarjeta de lealtad, no sale en la web mientras no se ofrezca (Edwin, 11-oct); sus datos se guardan', () => {
  const vuelve = FOOD.servicios.find((s) => s.id === 'vuelve');
  assert.ok(vuelve && FOOD.vuelve.pasos.length, 'los datos de Vuelve siguen en datos/food.mjs');
  assert.equal(vuelve.publicado, false, 'Vuelve está oculta: `publicado: false` en su servicio');
  for (const r of PAGINAS) assert.doesNotMatch(leer(r), /vuelve|lealtad|wallet|racha/i, `${r}: nada de Vuelve`);
  // llms.txt también lleva la portada de Med, donde «no se te vuelve a cobrar»: aquí, el nombre y su sitio.
  const llms = leer('llms.txt');
  assert.doesNotMatch(llms, /\bVuelve\b/, 'llms.txt: sin el nombre');
  assert.doesNotMatch(llms, /vuelve\.alphateklab|lealtad|wallet/i, 'llms.txt: ni su sitio, ni la lealtad, ni el Wallet');
});

test('Food arriba: «Probar gratis» lleva directo a su formulario y no hay «Iniciar sesión» sin servicios', () => {
  const cab = leer('food/index.html').match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.match(cab, /<a class="boton boton--senal cab__cta" href="#contacto">Probar gratis<\/a>/, 'Probar gratis → #contacto, como en med/');
  assert.match(cab, /<nav class="cab__movil"[\s\S]*?href="#contacto">Probar gratis<\/a>/, 'también en el menú del teléfono');
  assert.doesNotMatch(cab, /Iniciar sesión|data-elegir/, 'Sobremesa no tiene panel en línea: ni «Iniciar sesión» ni listas vacías');
});

test('un solo H1 por página y cada imagen con texto alternativo y medidas', () => {
  for (const r of PAGINAS) {
    const html = leer(r);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, r);
    for (const [img] of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(img, /\salt="/, `${r}: ${img.slice(0, 80)}`);
      assert.match(img, /\swidth="\d+"/, `${r}: sin ancho`);
      assert.match(img, /\sheight="\d+"/, `${r}: sin alto`);
    }
  }
});
