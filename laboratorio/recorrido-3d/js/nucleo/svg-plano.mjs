// El plano dibujado en SVG a partir del modelo (construirModelo): pisos por ambiente, muros cortados a 1.20 m,
// ventanas, puertas con su giro, nombres con m² y cotas generales. Lo usan la página (HTML generado), el minimapa
// y el editor. Devuelve texto; los colores van por clases para que sigan el tema claro u oscuro.

import { area as fmtArea, metros } from './formato.mjs';
import { colocarEtiqueta, giroDePuerta, partirNombre } from './etiquetas.mjs';

export { partirNombre };
export const ALTURA_CORTE = 1.2;
const n2 = (v) => (Math.round(v * 1000) / 1000).toString();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Tamaño de letra (en metros del plano) para que el nombre quepa en el ambiente. */
export function tamanoEtiqueta(amb) {
  const ancho = amb.caja.ancho * 0.86;
  const alto = amb.caja.largo * 0.8;
  const porAncho = (lineas) => ancho / (Math.max(...lineas.map((l) => l.length)) * 0.56);
  let lineas = [amb.nombre];
  let t = Math.min(0.34, porAncho(lineas));
  if (t < 0.24) {
    lineas = partirNombre(amb.nombre, 0);
    t = Math.min(0.34, porAncho(lineas));
  }
  t = Math.min(t, alto / (lineas.length + 1.3));
  return { t: Math.max(0.14, t), lineas };
}

// Rótulos compactos (el teléfono y el minimapa grande): solo el nombre, sin el área, con la letra más grande que
// cabe sin pisar paredes ni el giro de las puertas, en una o dos líneas y girado si el ambiente es angosto.
const MARGEN_COMPACTO = 0.12; // metros entre el rótulo y el eje de la pared (medio muro y un poco de aire)
const LETRA_COMPACTA = 0.5;
const memoria = new Map();
export function etiquetaCompacta(amb, giros) {
  const clave = JSON.stringify([amb.nombre, amb.poligono, amb.etiqueta, giros]);
  if (!memoria.has(clave)) {
    if (memoria.size > 300) memoria.clear();
    const paso = Math.max(0.05, Math.min(amb.caja.ancho, amb.caja.largo) / 24);
    memoria.set(clave, colocarEtiqueta(amb.nombre, { poligono: amb.poligono, obstaculos: giros, margen: MARGEN_COMPACTO, preferido: amb.etiqueta, maxT: LETRA_COMPACTA, paso }));
  }
  return memoria.get(clave);
}

export function cajaVista(modelo, { margen = 0.5, cotas = false } = {}) {
  const k = modelo.limites;
  const extra = cotas ? 0.75 : 0;
  const x = k.x0 - margen - extra, y = k.y0 - margen - extra;
  return { x, y, ancho: k.ancho + 2 * margen + extra, largo: k.largo + 2 * margen + extra };
}

export function svgPlano(modelo, opciones = {}) {
  const { etiquetas = true, compactas = false, cotas = true, margen = 0.5, titulo = '', idTitulo = '', clase = '', atributos = '', soloContenido = false } = opciones;
  const v = cajaVista(modelo, { margen, cotas });
  const partes = [];
  partes.push(
    `<svg class="plano-svg ${clase}" viewBox="${n2(v.x)} ${n2(v.y)} ${n2(v.ancho)} ${n2(v.largo)}" xmlns="http://www.w3.org/2000/svg"${
      titulo ? ` role="img" aria-labelledby="${idTitulo}"` : ''
    }${atributos ? ' ' + atributos : ''}>`,
  );
  if (titulo) partes.push(`<title id="${idTitulo}">${esc(titulo)}</title>`);

  // Pisos
  partes.push('<g class="pl-pisos">');
  for (const amb of modelo.ambientes) {
    const pts = amb.poligono.map((p) => `${n2(p.x)},${n2(p.y)}`).join(' ');
    partes.push(`<polygon class="pl-piso pl-piso--${amb.tipo}" data-ambiente="${esc(amb.id)}" points="${pts}"/>`);
  }
  partes.push('</g>');

  // Muros cortados a 1.20 m; barandas siempre
  partes.push('<g class="pl-muros">');
  for (const pared of modelo.paredes) {
    for (const pz of pared.piezas) {
      const corta = pared.tipo === 'baranda' ? pz.y0 < 1e-6 : pz.y0 <= ALTURA_CORTE && pz.y1 > ALTURA_CORTE;
      if (!corta) continue;
      partes.push(
        `<line class="pl-muro pl-muro--${pared.tipo}" x1="${n2(pz.a.x)}" y1="${n2(pz.a.y)}" x2="${n2(pz.b.x)}" y2="${n2(pz.b.y)}" stroke-width="${n2(pared.grosor)}"/>`,
      );
    }
  }
  partes.push('</g>');

  // Aberturas
  partes.push('<g class="pl-aberturas">');
  for (const ab of modelo.aberturas) {
    const { a, b, dir, grosor } = ab;
    if (ab.tipo === 'ventana' && ab.antepecho > ALTURA_CORTE) {
      // Ventana alta (la de un baño): el corte a 1.20 m pasa por debajo, así que el muro sigue entero y la ventana
      // va en línea discontinua, como en un plano de obra.
      partes.push(`<line class="pl-ventana-alta" x1="${n2(a.x)}" y1="${n2(a.y)}" x2="${n2(b.x)}" y2="${n2(b.y)}"/>`);
    } else if (ab.tipo === 'ventana') {
      partes.push(`<line class="pl-ventana" x1="${n2(a.x)}" y1="${n2(a.y)}" x2="${n2(b.x)}" y2="${n2(b.y)}" stroke-width="${n2(grosor)}"/>`);
      partes.push(`<line class="pl-vidrio" x1="${n2(a.x)}" y1="${n2(a.y)}" x2="${n2(b.x)}" y2="${n2(b.y)}"/>`);
    } else if (ab.tipo === 'puerta' || ab.tipo === 'puerta-cerrada') {
      const nrm = ab.haciaDentro;
      const bis = ab.hoja ? ab.hoja.bisagra : a;
      const otro = ab.hoja ? ab.hoja.otro : b;
      const tip = { x: bis.x + nrm.x * ab.ancho, y: bis.y + nrm.y * ab.ancho };
      const hacia = { x: otro.x - bis.x, y: otro.y - bis.y };
      // El arco va de la punta de la hoja abierta al otro marco, del lado por el que gira.
      const giro = nrm.x * hacia.y - nrm.y * hacia.x > 0 ? 1 : 0;
      partes.push(
        `<path class="pl-puerta${ab.tipo === 'puerta-cerrada' ? ' pl-puerta--entrada' : ''}" d="M${n2(bis.x)} ${n2(bis.y)}L${n2(tip.x)} ${n2(tip.y)}A${n2(ab.ancho)} ${n2(ab.ancho)} 0 0 ${giro} ${n2(otro.x)} ${n2(otro.y)}"/>`,
      );
    } else if (ab.tipo === 'corrediza') {
      const off = grosor / 4;
      const nrm = { x: -dir.y, y: dir.x };
      const mitad = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const hoja = (p, q, s) =>
        `<line class="pl-corrediza" x1="${n2(p.x + nrm.x * s)}" y1="${n2(p.y + nrm.y * s)}" x2="${n2(q.x + nrm.x * s)}" y2="${n2(q.y + nrm.y * s)}"/>`;
      const extra = { x: dir.x * ab.ancho * 0.05, y: dir.y * ab.ancho * 0.05 };
      partes.push(hoja(a, { x: mitad.x + extra.x, y: mitad.y + extra.y }, off));
      partes.push(hoja({ x: mitad.x - extra.x, y: mitad.y - extra.y }, b, -off));
    } else if (ab.tipo === 'vano') {
      partes.push(`<line class="pl-vano" x1="${n2(a.x)}" y1="${n2(a.y)}" x2="${n2(b.x)}" y2="${n2(b.y)}"/>`);
    }
  }
  partes.push('</g>');

  if (etiquetas) {
    partes.push(`<g class="pl-etiquetas${compactas ? ' pl-etiquetas--normales' : ''}">`);
    for (const amb of modelo.ambientes) {
      const { t, lineas } = tamanoEtiqueta(amb);
      const total = lineas.length + 1;
      const y0 = amb.etiqueta.y - ((total - 1) * t * 1.15) / 2 + t * 0.35;
      partes.push(`<text class="pl-nombre" x="${n2(amb.etiqueta.x)}" y="${n2(y0)}" font-size="${n2(t)}" text-anchor="middle">`);
      lineas.forEach((l, i) => partes.push(`<tspan x="${n2(amb.etiqueta.x)}" dy="${i ? n2(t * 1.15) : 0}">${esc(l)}</tspan>`));
      partes.push(
        `<tspan class="pl-area" x="${n2(amb.etiqueta.x)}" dy="${n2(t * 1.15)}" font-size="${n2(t * 0.86)}">${esc(fmtArea(amb.area))}</tspan></text>`,
      );
    }
    partes.push('</g>');
  }

  if (compactas) {
    const giros = modelo.aberturas.map(giroDePuerta).filter(Boolean);
    partes.push('<g class="pl-etiquetas pl-etiquetas--compactas">');
    for (const amb of modelo.ambientes) {
      const e = etiquetaCompacta(amb, giros);
      if (!(e.t > 0)) continue;
      const salto = e.t * 1.15;
      const y0 = e.y - ((e.lineas.length - 1) * salto) / 2 + e.t * 0.35;
      const giro = e.girada ? ` transform="rotate(-90 ${n2(e.x)} ${n2(e.y)})"` : '';
      partes.push(`<text class="pl-nombre" x="${n2(e.x)}" y="${n2(y0)}" font-size="${n2(e.t)}" text-anchor="middle"${giro}>`);
      e.lineas.forEach((l, i) => partes.push(`<tspan x="${n2(e.x)}" dy="${i ? n2(salto) : 0}">${esc(l)}</tspan>`));
      partes.push('</text>');
    }
    partes.push('</g>');
  }

  if (cotas) {
    const interiores = modelo.ambientes.filter((a) => !a.exterior);
    const pts = (interiores.length ? interiores : modelo.ambientes).flatMap((a) => a.poligono);
    const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
    const y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
    const yc = modelo.limites.y0 - 0.55, xc = modelo.limites.x0 - 0.55;
    const tick = 0.12;
    partes.push('<g class="pl-cotas">');
    partes.push(`<line x1="${n2(x0)}" y1="${n2(yc)}" x2="${n2(x1)}" y2="${n2(yc)}"/>`);
    partes.push(`<line x1="${n2(x0)}" y1="${n2(yc - tick)}" x2="${n2(x0)}" y2="${n2(yc + tick)}"/><line x1="${n2(x1)}" y1="${n2(yc - tick)}" x2="${n2(x1)}" y2="${n2(yc + tick)}"/>`);
    partes.push(`<text x="${n2((x0 + x1) / 2)}" y="${n2(yc - 0.12)}" font-size="0.26" text-anchor="middle">${esc(metros(x1 - x0))}</text>`);
    partes.push(`<line x1="${n2(xc)}" y1="${n2(y0)}" x2="${n2(xc)}" y2="${n2(y1)}"/>`);
    partes.push(`<line x1="${n2(xc - tick)}" y1="${n2(y0)}" x2="${n2(xc + tick)}" y2="${n2(y0)}"/><line x1="${n2(xc - tick)}" y1="${n2(y1)}" x2="${n2(xc + tick)}" y2="${n2(y1)}"/>`);
    partes.push(
      `<text x="${n2(xc - 0.12)}" y="${n2((y0 + y1) / 2)}" font-size="0.26" text-anchor="middle" transform="rotate(-90 ${n2(xc - 0.12)} ${n2((y0 + y1) / 2)})">${esc(metros(y1 - y0))}</text>`,
    );
    partes.push('</g>');
  }

  partes.push('</svg>');
  // Sin la etiqueta <svg> de afuera, para meterlo dentro de otro dibujo con las mismas coordenadas (el editor).
  if (soloContenido) return partes.slice(1 + (titulo ? 1 : 0), -1).join('');
  return partes.join('');
}
