// Rellena en index.html los bloques <!-- gen:… --> a partir de plano.json y del catálogo, para que el plano, la
// tabla de ambientes y los servicios estén en el HTML sin esperar al JavaScript y nunca contradigan a los datos.
// Uso: node herramientas/generar.mjs            (escribe index.html)
//      node herramientas/generar.mjs --comprobar (sale con 1 si index.html no está al día; lo usan las pruebas)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { construirModelo, esRectangulo } from '../js/nucleo/plano.mjs';
import { svgPlano } from '../js/nucleo/svg-plano.mjs';
import { area, medidas } from '../js/nucleo/formato.mjs';

const DEMO = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ_SITIO = join(DEMO, '..', '..');
export const RELACIONADOS = ['B01', 'B03', 'B02', 'B05', 'B04', 'B06'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Cada servicio tiene su ficha en servicios/<slug>/ cuando el sitio ya la generó; si no, el ancla de la portada.
const enlaceServicio = (slug) => (existsSync(join(RAIZ_SITIO, 'servicios', slug, 'index.html')) ? `../../servicios/${slug}/` : `../../#${slug}`);

export async function bloques() {
  const plano = JSON.parse(readFileSync(join(DEMO, 'plano.json'), 'utf8'));
  const m = construirModelo(plano);
  const { SERVICIOS } = await import(pathToFileURL(join(RAIZ_SITIO, 'datos', 'catalogo.mjs')).href);

  const interiores = m.ambientes.filter((a) => !a.exterior);
  const exteriores = m.ambientes.filter((a) => a.exterior);
  const sumaInt = interiores.reduce((s, a) => s + a.area, 0);
  const sumaExt = exteriores.reduce((s, a) => s + a.area, 0);

  const svg = svgPlano(m, {
    titulo: `Plano del apartamento de ejemplo: ${m.ambientes.map((a) => `${a.nombre} ${area(a.area)}`).join(', ')}.`,
    idTitulo: 'titulo-plano-svg',
    clase: 'plano-svg--pagina',
    compactas: true, // rótulos del teléfono: el CSS muestra unos u otros según el ancho
  });

  const filas = m.ambientes
    .map((a) => {
      const med = esRectangulo(a) ? medidas(a.caja.ancho, a.caja.largo) : `${medidas(a.caja.ancho, a.caja.largo)}, en L`;
      return `<tr><th scope="row">${esc(a.nombre)}</th><td>${esc(med)}</td><td class="tabla-ambientes__num">${esc(area(a.area))}</td><td class="tabla-ambientes__ir"><button class="boton boton--linea boton--chico" type="button" data-ir="${esc(a.id)}" hidden>Ir<span class="sr"> a ${esc(a.nombre)} en 3D</span></button></td></tr>`;
    })
    .join('\n          ');
  const tabla = `<tbody>
          ${filas}
        </tbody>
        <tfoot>
          <tr><th scope="row">Interior</th><td></td><td class="tabla-ambientes__num">${esc(area(sumaInt))}</td><td></td></tr>
          <tr><th scope="row">Balcón</th><td></td><td class="tabla-ambientes__num">${esc(area(sumaExt))}</td><td></td></tr>
          <tr class="tabla-ambientes__total"><th scope="row">Total</th><td></td><td class="tabla-ambientes__num">${esc(area(m.areaTotal))}</td><td></td></tr>
        </tfoot>`;

  const cuenta = (tipo) => m.ambientes.filter((a) => a.tipo === tipo).length;
  const palabras = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco'];
  const resumen = `<p>Un apartamento de ejemplo de <span class="num">${esc(area(m.areaTotal))}</span> (${esc(area(sumaInt))} adentro y ${esc(area(sumaExt))} de balcón) con sala-comedor, cocina, ${palabras[cuenta('recamara')]} recámaras, ${palabras[cuenta('bano')]} baños, lavandería y balcón. Es un <strong>modelo de ejemplo dibujado a partir de un plano, no un escaneo</strong>: la propiedad no existe.</p>`;

  const servicios = RELACIONADOS.map((id) => SERVICIOS.find((s) => s.id === id)).filter(Boolean);
  const lista = `<ul class="relacionados">
          ${servicios
            // Sin el código interno del servicio (B01) ni «A cotizar»: el precio va solo cuando lo hay.
            .map((s) => `<li><a href="${esc(enlaceServicio(s.slug))}">${esc(s.nombre)}</a>${s.precio ? `<span class="relacionados__precio num">${esc(s.precio.texto)}${s.precio.nota ? `, ${esc(s.precio.nota)}` : ''}</span>` : ''}</li>`)
            .join('\n          ')}
        </ul>`;

  const datos = `<script type="application/json" id="datos-plano">${JSON.stringify(plano).replace(/</g, '\\u003c')}</script>`;

  return { plano: svg, tabla, resumen, servicios: lista, datos, _faltan: RELACIONADOS.filter((id) => !servicios.some((s) => s.id === id)) };
}

export function rellenar(html, b) {
  let salida = html;
  for (const [clave, contenido] of Object.entries(b)) {
    if (clave.startsWith('_')) continue;
    const re = new RegExp(`(<!-- gen:${clave} -->)[\\s\\S]*?(<!-- /gen:${clave} -->)`);
    if (!re.test(salida)) throw new Error(`index.html no tiene el bloque gen:${clave}`);
    salida = salida.replace(re, (_, a, z) => `${a}\n${contenido}\n${z}`);
  }
  return salida;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ruta = join(DEMO, 'index.html');
  const actual = readFileSync(ruta, 'utf8');
  const b = await bloques();
  if (b._faltan.length) console.warn(`Aviso: el catálogo no tiene ${b._faltan.join(', ')}; no se listan.`);
  const nuevo = rellenar(actual, b);
  if (process.argv.includes('--comprobar')) {
    if (nuevo !== actual) {
      console.error('index.html no está al día con plano.json o el catálogo: corre «node herramientas/generar.mjs».');
      process.exit(1);
    }
    console.log('index.html al día.');
  } else {
    writeFileSync(ruta, nuevo);
    console.log('index.html generado.');
  }
}
