// alphateklab.com es solo la agencia (Jonathan, 17-nov-2026): «Solo quiero que exista alphateklab.com, donde ofrecemos
// nuestros servicios. Nada de cuentas.alphateklab.com, nada de lo médico aparte». Tampoco la tarjeta de lealtad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// Las demos privadas y la investigación de la finca 3574 tienen su propio contenido; no son páginas de la agencia.
const APARTE = new Set(['alphadata', 'alphalex', 'alphalogistics', 'cemento', 'inv3574', 'demo-acceso', 'node_modules', '.git', 'pruebas', 'herramientas', 'datos']);
function* paginas(dir = RAIZ) {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) { if (!APARTE.has(relative(RAIZ, r).split('/')[0])) yield* paginas(r); }
    else if (/\.(html|js|txt|xml|json)$/.test(n)) yield relative(RAIZ, r);
  }
}
const PAGINAS = [...paginas()];
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8');

test('ninguna página enlaza a un subdominio de alphateklab.com', () => {
  for (const r of PAGINAS) assert.doesNotMatch(leer(r), /https?:\/\/(?!www\.)[a-z0-9-]+\.alphateklab\.com/i, r);
});

test('no quedan las páginas de Med ni las de clínicas ni la de lealtad', () => {
  for (const r of ['med', 'citasmed', 'expediente-clinico', 'expediente-clinico-electronico-panama', 'entrar', 'registro', 'terminos',
    'negocio-clinicas.html', 'servicio-agente-de-citas.html', 'servicio-videoconsulta.html', 'servicio-expediente-del-paciente.html',
    'servicio-turnos-en-sala-de-espera.html', 'servicio-encuesta-despues-de-la-cita.html', 'servicio-programa-de-lealtad.html'])
    assert.ok(!existsSync(join(RAIZ, r)), r);
});

test('las páginas de la agencia no hablan de clínicas, pacientes ni lealtad', () => {
  // El sprite de íconos trae el estetoscopio aunque nadie lo use: se mira el texto, sin <symbol>.
  for (const r of PAGINAS.filter((x) => x.endsWith('.html'))) {
    const texto = leer(r).replace(/<symbol\b[\s\S]*?<\/symbol>/g, '');
    assert.doesNotMatch(texto, /cl[ií]nica|pacientes?\b|consultorio|m[eé]dic[oa]s?\b|lealtad|fidelidad|clientes frecuentes|data-rubro="clinica"/i, r);
  }
});

test('el formulario «Pedir mi propuesta» manda el mensaje y pide cómo responder', () => {
  for (const r of ['index.html', 'paquetes.html', 'telefono.html']) {
    const form = leer(r).match(/<form class="pregunta__form"[\s\S]*?<\/form>/)?.[0];
    assert.ok(form, r);
    assert.match(form, /data-ajax="https:\/\/formsubmit\.co\/ajax\/[0-9a-f]{32}"/, `${r}: a FormSubmit`);
    assert.match(form, /name="mensaje"/, `${r}: el mensaje`);
    assert.match(form, /name="contacto"[^>]*required/, `${r}: el correo o WhatsApp`);
  }
  assert.doesNotMatch(leer('assets/v2.js'), /nos llega a info@alphateklab\.com y te respondemos/, 'sin el aviso del prototipo que no mandaba nada');
});
