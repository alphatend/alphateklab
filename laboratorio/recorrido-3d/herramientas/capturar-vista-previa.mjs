// Genera las imágenes fijas de la página a partir del render real del modelo (no son imágenes generadas):
//   img/vista-previa.webp (1600×1000), img/vista-previa-vertical.webp (800×1000), img/og-recorrido-3d.jpg (1200×630),
//   y las dos webp otra vez con el fondo del tema oscuro (*-oscura.webp).
// Necesita el servidor local: python3 -m http.server 4750 -d ~/alphateklab/repos
// Uso: node herramientas/capturar-vista-previa.mjs

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../../herramientas/navegador.mjs';

const DEMO = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.URL_DEMO ?? 'http://localhost:4750/alphateklab/laboratorio/recorrido-3d/?prueba=1';

const tomasClaras = [
  { archivo: 'img/vista-previa.webp', ancho: 1600, alto: 1000, tipo: 'image/webp', calidad: 0.8, orbita: { yaw: 0.3, pitch: 1.26, dist: 18.2 } },
  { archivo: 'img/vista-previa-vertical.webp', ancho: 800, alto: 1000, tipo: 'image/webp', calidad: 0.8, orbita: { yaw: 0.26, pitch: 1.3, dist: 23.6 } },
  // Inclinación de la órbita inicial (1.26) o más alta: los nombres del piso se colocan fuera de lo que las paredes tapan
  // desde ahí (visor.mjs); con la cámara más baja, «Baño principal» volvía a quedar medio tapado.
  { archivo: 'img/og-recorrido-3d.jpg', ancho: 1200, alto: 630, tipo: 'image/jpeg', calidad: 0.86, orbita: { yaw: 0.3, pitch: 1.26, dist: 17.6 } },
];
// Las mismas vistas con el fondo del tema oscuro (la página las elige con prefers-color-scheme).
const tomas = [
  ...tomasClaras.map((t) => ({ ...t, tema: 'light' })),
  ...tomasClaras.filter((t) => t.archivo.endsWith('.webp')).map((t) => ({ ...t, tema: 'dark', archivo: t.archivo.replace('.webp', '-oscura.webp') })),
];

const nav = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const tema of ['light', 'dark']) {
  const pag = await nav.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: tema });
  await pag.goto(URL, { waitUntil: 'networkidle' });
  await pag.click('#entrar');
  await pag.waitForFunction(() => document.getElementById('visor').dataset.estado === 'listo', null, { timeout: 60000 });
  await pag.waitForTimeout(1200);
  for (const t of tomas.filter((x) => x.tema === tema)) {
    const datos = await pag.evaluate((t) => {
      const v = window.recorrido3d.visor();
      v.ajustarOrbita(t.orbita);
      return v.capturar({ ancho: t.ancho, alto: t.alto, tipo: t.tipo, calidad: t.calidad, vistaCaptura: 'arriba' });
    }, t);
    const [cabeza, b64] = datos.split(',');
    if (!cabeza.includes(t.tipo)) throw new Error(`El navegador no exportó ${t.tipo} (dio ${cabeza}).`);
    const buf = Buffer.from(b64, 'base64');
    writeFileSync(join(DEMO, t.archivo), buf);
    console.log(`${t.archivo}: ${t.ancho}×${t.alto}, ${(buf.length / 1024).toFixed(0)} KB`);
  }
  await pag.close();
  }
} finally {
  await nav.close();
}
