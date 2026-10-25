// Página privada inv3574 (25-oct-2026): lo publicado tiene que estar cifrado. Si en inv3574/datos aparece algo que no
// sea .dat, o un .dat que se lea como gzip, JSON, JPEG o PNG, la página dejó de ser privada. La prueba de que la
// contraseña abre todo vive fuera del repo (~/proyectos/cuire/inv3574/verificar.mjs), porque necesita la contraseña.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../inv3574/', import.meta.url));
const DATOS = join(DIR, 'datos');

test('inv3574: en datos/ solo hay .dat', () => {
  const otros = readdirSync(DATOS).filter((f) => !f.endsWith('.dat'));
  assert.deepEqual(otros, []);
  assert.ok(readdirSync(DATOS).includes('c.dat'));
});

test('inv3574: ningún .dat se lee en claro', () => {
  for (const f of readdirSync(DATOS)) {
    const b = readFileSync(join(DATOS, f));
    assert.ok(b.length > 28, f);
    assert.throws(() => gunzipSync(b), `${f} es gzip sin cifrar`);
    assert.throws(() => JSON.parse(b.toString('utf8')), `${f} es JSON sin cifrar`);
    const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const png = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    assert.ok(!jpeg && !png, `${f} es una imagen sin cifrar`);
  }
});

test('inv3574: la página no se indexa ni dice de qué trata', () => {
  const h = readFileSync(join(DIR, 'index.html'), 'utf8');
  assert.match(h, /<meta name="robots" content="noindex">/);
  for (const palabra of [/3574/, /Lefevre/i, /Guill/i, /Panam[aá] Viejo/i, /San Crist[oó]bal/i]) {
    assert.doesNotMatch(h.replace(/inv3574/g, ''), palabra, `index.html no debe nombrar ${palabra}`);
  }
});

test('inv3574: acceso.json trae sal, vueltas y prueba, y nada más', () => {
  const a = JSON.parse(readFileSync(join(DIR, 'acceso.json'), 'utf8'));
  assert.deepEqual(Object.keys(a).sort(), ['prueba', 'sal', 'vueltas']);
  assert.ok(a.vueltas >= 600000);
});

test('inv3574: no está en el sitemap ni en llms.txt', () => {
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  assert.doesNotMatch(readFileSync(join(raiz, 'sitemap.xml'), 'utf8'), /inv3574/);
  assert.doesNotMatch(readFileSync(join(raiz, 'llms.txt'), 'utf8'), /inv3574/);
});
