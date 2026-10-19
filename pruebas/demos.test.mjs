// Las demos privadas (alphalogistics, alphadata, alphalex; 19-oct-2026): lo publicado tiene que estar cifrado. Si en
// una carpeta datos/ aparece un .json, o la contraseña escrita en algún archivo, la demo dejó de ser privada.
// La prueba de que lo cifrado no nombra personas vive fuera del repo (~/proyectos/cuire/demos/pruebas-privacidad.mjs),
// porque necesita la llave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DEMOS = ['alphalogistics', 'alphadata', 'alphalex'].filter((d) => existsSync(join(RAIZ, d)));
const archivos = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? archivos(join(d, f)) : [join(d, f)]));

test('las demos existen', () => assert.ok(DEMOS.length >= 1));

for (const d of DEMOS) {
  test(`${d}: en datos/ no hay nada en claro`, () => {
    const enClaro = archivos(join(RAIZ, d, 'datos')).filter((f) => !f.endsWith('.dat'));
    assert.deepEqual(enClaro, []);
  });
  test(`${d}: los .dat no son JSON ni gzip a la vista`, () => {
    for (const f of archivos(join(RAIZ, d, 'datos')).slice(0, 40)) {
      const b = readFileSync(f);
      assert.ok(b.length > 28, f);
      assert.ok(!(b[0] === 0x1f && b[1] === 0x8b), `${f} es gzip sin cifrar`);
      assert.ok(!['{', '['].includes(String.fromCharCode(b[0])), `${f} parece JSON`);
    }
  });
  test(`${d}: la página no se indexa y carga el acceso`, () => {
    const h = readFileSync(join(RAIZ, d, 'index.html'), 'utf8');
    assert.match(h, /<meta name="robots" content="noindex"/);
    assert.match(h, /demo-acceso\/acceso\.css/);
    assert.match(readFileSync(join(RAIZ, d, 'app.js'), 'utf8'), /from '\.\.\/demo-acceso\/acceso\.js'/);
  });
}

test('acceso.json: sal, 600.000 vueltas y la prueba cifrada', () => {
  const a = JSON.parse(readFileSync(join(RAIZ, 'demo-acceso', 'acceso.json'), 'utf8'));
  assert.ok(Buffer.from(a.sal, 'base64').length >= 16);
  assert.ok(a.vueltas >= 600000);
  assert.ok(Buffer.from(a.prueba, 'base64').length === 12 + 11 + 16);
});

test('la contraseña no está escrita en las demos ni en el acceso', () => {
  // La prueba no la conoce: busca una asignación de «clave»/«password» con texto literal en lo que publican las demos.
  // (El resto del sitio usa «CLAVE» para identificadores de almacenamiento que no son contraseñas.)
  const sospechosos = [...DEMOS, 'demo-acceso'].flatMap((d) => archivos(join(RAIZ, d))).filter((f) => /\.(js|mjs|html|json|css|md)$/.test(f))
    .filter((f) => /(contrase[ñn]a|password|clave)\s*[:=]\s*["'][^"']{4,}["']/i.test(readFileSync(f, 'utf8')));
  assert.deepEqual(sospechosos, []);
});
