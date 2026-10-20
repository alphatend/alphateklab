// alphalogistics (demo de alphateklab, 19-oct-2026). Sin dependencias: rutas por hash y datos en datos/*.json,
// partidos para que cada vista baje solo lo suyo. Los arma ~/proyectos/cuire/alphalogistics/armar.mjs, y ahí se decide
// qué nombre se publica: las personas naturales llegan como null y aquí salen como «Sin nombre publicado».
//
// Cada vista tiene la forma de su dato (Jonathan, 19-oct: «form follows function»):
//   · Comercio: de dónde vino lo importado (el patio de contenedores) y cómo va mes a mes.
//   · Producto: un mercado. Cuánto entra, quién se lo reparte, de dónde viene y a qué precio por kilo.
//   · Empresa: su mezcla de productos y de orígenes, y con quién compite en lo que más trae.
//   · Nave: su registro, casilla por casilla. Propietario: su flota.

import { abrirDatos } from '../demo-acceso/acceso.js';
import { conCsv, botonSeguir, activarSeguir, seguidos } from '../demo-acceso/utiles.js';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#contenido');
// Los datos están cifrados (demo privada): `abrir` pide la contraseña la primera vez y devuelve el lector.
let lector = null;
const abrir = () => (lector ||= abrirDatos({ donde: main, nombre: 'alphalogistics' }));
const memo = new Map();
const json = (ruta) => {
  if (!memo.has(ruta)) memo.set(ruta, abrir().then((leer) => leer(ruta.replace(/\.json$/, ''))).catch((e) => { memo.delete(ruta); throw e; }));
  return memo.get(ruta);
};

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ent = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 0 });
const uno = new Intl.NumberFormat('es-PA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dos = new Intl.NumberFormat('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// «50 millones», no «50.0 millones»: el decimal solo cuando dice algo.
const redondo = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? ent.format(Math.round(x)) : uno.format(x));
const dinero = (n) => {
  const v = Number(n) || 0, a = Math.abs(v);
  if (a >= 1e9) return `B/. ${redondo(v / 1e9)} mil millones`;
  if (a >= 1e6) return `B/. ${redondo(v / 1e6)} millones`;
  return `B/. ${ent.format(v)}`;
};
const corto = (n) => {
  const v = Number(n) || 0, a = Math.abs(v);
  if (a >= 1e9) return `${uno.format(v / 1e9)} mil M`;
  if (a >= 1e6) return `${uno.format(v / 1e6)} M`;
  if (a >= 1e3) return `${ent.format(v / 1e3)} mil`;
  return ent.format(v);
};
const peso = (kg) => (kg >= 1e6 ? `${ent.format(kg / 1000)} t` : kg >= 1000 ? `${uno.format(kg / 1000)} t` : `${ent.format(kg)} kg`);
const pct = (x) => `${uno.format(x)} %`;
const porKilo = (cif, kg) => (kg > 0 ? `B/. ${dos.format(cif / kg)}` : '—');
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesTexto = (m) => `${MES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
const TIPO = { I: 'Importado', E: 'Exportado', R: 'Reexportado' };
const VERBO = { I: 'importó', E: 'exportó', R: 'reexportó' };
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .replace(/[.,"'`´()/\\-]/g, ' ').replace(/[^A-Z0-9Ñ&+ ]/g, ' ').replace(/\s+/g, ' ').trim();
const SIN = '<span class="oculto" title="Persona natural, o un nombre que no tiene forma de empresa: no se publica">Sin nombre publicado</span>';
const nombre = (x, ruta) => (!x.nombre ? SIN : x.id ? `<a href="#/${ruta}/${esc(x.id)}">${esc(x.nombre)}</a>` : esc(x.nombre));
const sum = (o) => Object.values(o || {}).reduce((s, v) => s + v, 0);
const COLOR = { china: 'var(--o-china)', eeuu: 'var(--o-eeuu)', asia: 'var(--o-asia)', europa: 'var(--o-europa)', latam: 'var(--o-latam)', panama: 'var(--o-panama)', otros: 'var(--o-otros)' };
const marcaO = (r) => `<i class="marca-o" style="background:${COLOR[r] || COLOR.otros}" aria-hidden="true"></i>`;
const paisEnlace = (f) => `${marcaO(f.region)}${f.slug ? `<a href="#/pais/${esc(f.slug)}">${esc(f.pais)}</a>` : esc(f.pais)}`;

let R = null;
const resumen = async () => (R ||= await json('resumen.json'));

// ── piezas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function libro(filas, cols, { vacio = 'Sin datos para mostrar.', yo = null } = {}) {
  if (!filas?.length) return `<p class="vacio">${esc(vacio)}</p>`;
  const th = cols.map((c) => `<th scope="col" class="${[c.n && 'n', c.ancho && 'solo-ancho', c.pos && 'pos'].filter(Boolean).join(' ')}">${esc(c.t)}</th>`).join('');
  const tr = filas.map((f, i) => `<tr${yo && yo(f) ? ' class="yo"' : ''}>${cols.map((c) => `<td class="${[c.n && 'n', c.ancho && 'solo-ancho', c.pos && 'pos'].filter(Boolean).join(' ')}">${c.v(f, i)}</td>`).join('')}</tr>`).join('');
  return `<div class="libro-env"><table class="libro"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}
const barra = (v, max) => `<span class="barra" style="width:${max > 0 ? Math.max(0.5, (v / max) * 100).toFixed(1) : 0}%" aria-hidden="true"></span>`;
const casilla = (r, v, { ancha = false } = {}) => (v === null || v === undefined || v === '' ? '' : `<div class="casilla${ancha ? ' casilla--ancha' : ''}"><dt>${esc(r)}</dt><dd>${v}</dd></div>`);

/** El ancho real de la gráfica: el viewBox se dibuja a ese ancho para que el texto mida siempre 11 px (con un viewBox
 *  fijo, en el teléfono quedaba en 6 px y en pantalla grande en 22). `mitad`: va en una de dos columnas. */
const anchoDe = (mitad) => {
  const w = (main.clientWidth || 640) - 2 * parseFloat(getComputedStyle(main).paddingLeft || 0);
  return Math.round(Math.max(300, Math.min(1100, mitad && w >= 960 ? (w - 48) / 2 : w)));
};

/** Barras por año con su valor encima. El año en curso, con trazo discontinuo: no está cerrado. Con muchos años solo
 *  se rotulan los múltiplos de cinco, el más alto y el último (todos están en la tabla para lectores de pantalla). */
function porAnio(serie, { parcial = null, formato = corto, unidad = '', mitad = false } = {}) {
  const anios = Object.keys(serie || {}).sort();
  if (anios.length < 2) return '';
  const max = Math.max(...anios.map((a) => serie[a] || 0), 1);
  const W = anchoDe(mitad), H = 170, abajo = 22, arriba = 20, h = H - abajo - arriba, paso = W / anios.length, b = Math.min(58, paso * 0.62);
  const muchos = anios.length > 12 || paso < 44;
  const iMax = anios.findIndex((a) => (serie[a] || 0) === max);
  const g = anios.map((a, i) => {
    const v = serie[a] || 0, hh = v > 0 ? Math.max(1.5, (v / max) * h) : 0, x = i * paso + (paso - b) / 2, y = arriba + h - hh;
    const cls = a === parcial ? 'b b--parcial' : 'b';
    const conValor = !muchos || i === iMax || i === anios.length - 1;
    const conAnio = !muchos || Number(a) % 5 === 0 || i === anios.length - 1;
    return `<rect class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${b.toFixed(1)}" height="${hh.toFixed(1)}"><title>${a}: ${esc(formato(v))}</title></rect>` +
      (conValor ? `<text class="v" x="${(x + b / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${esc(formato(v))}</text>` : '') +
      (conAnio ? `<text x="${(x + b / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle">${a}${a === parcial ? '*' : ''}</text>` : '');
  }).join('');
  const tabla = `<table class="sr"><caption>Por año${unidad ? `, ${esc(unidad)}` : ''}</caption><tbody>${anios.map((a) => `<tr><th scope="row">${a}${a === parcial ? ' (sin cerrar)' : ''}</th><td>${esc(formato(serie[a] || 0))}</td></tr>`).join('')}</tbody></table>`;
  return `<svg class="grafica" viewBox="0 0 ${W} ${H}" aria-hidden="true"><line class="eje" x1="0" x2="${W}" y1="${arriba + h}" y2="${arriba + h}"></line>${g}</svg>${tabla}`;
}

/** El mejor año cerrado, dicho en una frase; si el año en curso ya lo pasó, se dice. */
function moraleja(serie, parcial, verbo = 'entró') {
  const cerrados = Object.entries(serie || {}).filter(([a]) => a !== parcial && serie[a] > 0);
  if (cerrados.length < 2) return '';
  const [ma, mv] = cerrados.reduce((x, y) => (y[1] > x[1] ? y : x));
  const enCurso = parcial ? serie[parcial] || 0 : 0;
  if (parcial && enCurso > mv) return `<p class="dicho">${esc(parcial)} ya pasó a ${esc(ma)}, su mejor año cerrado, y aún no termina.</p>`;
  return `<p class="dicho">${esc(ma)} fue el año más alto: ${verbo} <b>${esc(dinero(mv))}</b>.${parcial && enCurso ? ` En ${esc(parcial)} van ${esc(dinero(enCurso))} hasta ${esc(mesTexto(R.parcial.hasta))}.` : ''}</p>`;
}

/** La serie mensual, con el máximo rotulado y la escala a la izquierda. El mes en curso va aparte, punteado: está a
 *  medias y, dibujado como los demás, parecía un desplome. */
function porMes(todos, todosMeses) {
  if (!todos || todos.filter((v) => v > 0).length < 3) return '<p class="vacio">Muy pocos meses con movimiento para dibujar la serie.</p>';
  const corta = R?.mesIncompleto && todosMeses.at(-1) === R.mesIncompleto;
  const valores = corta ? todos.slice(0, -1) : todos, meses = corta ? todosMeses.slice(0, -1) : todosMeses;
  const enCurso = corta ? todos.at(-1) : null;
  const W = anchoDe(false), H = 170, izq = 46, abajo = 20, arriba = 12, h = H - abajo - arriba, ancho = W - izq;
  const max = Math.max(...valores, 1);
  const x = (i) => izq + (i / (valores.length - 1)) * ancho, y = (v) => arriba + h - (v / max) * h;
  const d = valores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${d}L${x(valores.length - 1).toFixed(1)},${arriba + h}L${izq},${arriba + h}Z`;
  const anios = meses.map((m, i) => (m.endsWith('-01') ? `<line class="guia" x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${arriba}" y2="${arriba + h}"></line><text x="${(x(i) + 3).toFixed(1)}" y="${H - 5}">${m.slice(0, 4)}</text>` : '')).join('');
  const im = valores.indexOf(max);
  return `<svg class="grafica" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <text x="${izq - 6}" y="${arriba + 4}" text-anchor="end">${esc(corto(max))}</text><text x="${izq - 6}" y="${arriba + h}" text-anchor="end">0</text>
    <line class="eje" x1="${izq}" x2="${W}" y1="${arriba + h}" y2="${arriba + h}"></line>${anios}
    <path class="a" d="${area}"></path><path class="l" d="${d}"></path>
    <circle cx="${x(im).toFixed(1)}" cy="${y(max).toFixed(1)}" r="3.5" fill="var(--marino)"></circle></svg>
    <p class="dicho">El mes más alto fue ${esc(mesTexto(meses[im]))}, con <b>${esc(dinero(max))}</b>. La escala va de 0 a ese mes.${corta ? ` ${esc(mesTexto(R.mesIncompleto).replace(/^./, (c) => c.toUpperCase()))} no entra en la gráfica: va a medias${enCurso > 0 ? ` (${esc(dinero(enCurso))} hasta ahora)` : ''}.` : ''}</p>`;
}

/** Una tira apilada: la parte de cada uno de los cinco primeros y el resto. */
function reparto(filas, total) {
  if (!total || !filas.length) return '';
  const cinco = filas.slice(0, 5);
  const resto = Math.max(0, total - cinco.reduce((s, f) => s + f.cif, 0));
  return `<div class="reparto" role="img" aria-label="Los cinco primeros se quedan con el ${esc(pct((1 - resto / total) * 100))} del valor">${cinco.map((f) => `<i style="width:${((f.cif / total) * 100).toFixed(2)}%" title="${esc(f.nombre || 'Sin nombre publicado')}: ${esc(pct((f.cif / total) * 100))}"></i>`).join('')}<i class="resto" style="width:${((resto / total) * 100).toFixed(2)}%"></i></div>`;
}

function interruptor(id, opciones, activa) {
  return `<div class="vista" role="group" aria-label="Ver" data-interruptor="${esc(id)}">${opciones.map(([k, t]) => `<button type="button" data-k="${esc(k)}" aria-pressed="${k === activa}">${esc(t)}</button>`).join('')}</div>`;
}
function alCambiar(id, pintar) {
  setTimeout(() => {
    const g = $(`[data-interruptor="${id}"]`);
    g?.addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $(`#${id}`).innerHTML = pintar(b.dataset.k);
      conCsv(main, 'alphalogistics');
    });
  });
}

// ── comercio (portada) ─────────────────────────────────────────────────────────────────────────────────────────────
async function comercio() {
  const r = await resumen();
  const a = r.anioRef, imp = r.totales.porTipo.I;
  document.title = 'alphalogistics · quién importa qué en Panamá';
  const p = r.patio;
  const cont = p.regiones.flatMap((g) => Array.from({ length: g.n }, () => g.k));
  const maxP = r.topProductos[0]?.cif || 1, maxE = r.topEmpresas[0]?.cif || 1;
  const ocultoPct = imp[a] ? (r.totales.ocultosRefCif / imp[a]) * 100 : 0;
  const anios = r.anios;
  return `
  <h1 class="titulo">Quién importa qué en Panamá</h1>
  <p class="entrada">En ${esc(a)} se declararon en aduana importaciones por <b>${esc(dinero(imp[a]))}</b>, valor CIF. Aquí está
    cada línea declarada desde enero de ${esc(anios[0])}: ${esc(ent.format(r.totales.lineas))}, por empresa, por producto y por
    país de origen, cruzadas con el registro de naves de la AMP y con lo que cada empresa le vende al Estado.</p>

  <section class="seccion" aria-labelledby="t-patio">
    <div class="seccion__cab"><h2 id="t-patio">De dónde vino lo importado en ${esc(a)}</h2></div>
    <div class="patio">
      <div class="patio__grilla" style="--cols:${Math.min(40, Math.ceil(Math.sqrt(cont.length * 3.2)))};--cols-m:20" role="img" aria-label="${esc(cont.length)} rectángulos, uno por cada ${esc(dinero(p.unidad))} importados; el color es la región de origen">
        ${cont.map((k) => `<span class="patio__c" data-o="${k}"></span>`).join('')}
      </div>
      <p class="patio__escala">Cada rectángulo es un contenedor de <b>${esc(dinero(p.unidad))}</b> de importaciones de ${esc(a)} (valor CIF). Son ${esc(ent.format(cont.length))}.</p>
      <ul class="patio__ley">
        ${p.regiones.filter((g) => g.cif > 0).map((g) => `<li><i style="background:${COLOR[g.k]}"></i><span>${esc(g.nombre)}</span><b>${esc(pct((g.cif / p.total) * 100))}</b></li>`).join('')}
      </ul>
      <p class="seccion__nota">«Panamá y Zona Libre»: Aduanas pone a Panamá o a la Zona Libre de Colón como país de origen en una parte de las importaciones. Aquí van aparte, sin repartirlas entre los países de afuera.</p>
    </div>
  </section>

  <section class="seccion" aria-labelledby="t-mes">
    <div class="seccion__cab"><h2 id="t-mes">Importaciones, mes a mes</h2><p class="seccion__nota">Valor CIF de todo lo importado.</p></div>
    ${porMes(r.importMeses, r.meses)}
  </section>

  <div class="dos">
    <section class="seccion" aria-labelledby="t-prod">
      <div class="seccion__cab"><h2 id="t-prod">Lo que más entró en ${esc(a)}</h2><a class="nota" href="#/productos">Todos los productos</a></div>
      ${libro(r.topProductos, [
        { t: '', pos: 1, v: (f, i) => i + 1 },
        { t: 'Producto', v: (f) => `<a href="#/p/${esc(f.sp)}">${esc(f.nombre)}</a>${barra(f.cif, maxP)}` },
        { t: `${a}, CIF`, n: 1, v: (f) => esc(dinero(f.cif)) },
        { t: `Frente a ${Number(a) - 1}`, n: 1, ancho: 1, v: (f) => (f.crec === null ? '—' : `${f.crec > 0 ? '+' : ''}${esc(uno.format(f.crec))} %`) },
      ])}
    </section>
    <section class="seccion" aria-labelledby="t-emp">
      <div class="seccion__cab"><h2 id="t-emp">Los importadores más grandes de ${esc(a)}</h2></div>
      ${libro(r.topEmpresas, [
        { t: '', pos: 1, v: (f, i) => i + 1 },
        { t: 'Empresa', v: (f) => `${nombre(f, 'e')}<small>${esc(f.producto || '')}${f.pais ? `, sobre todo de ${esc(f.pais)}` : ''}</small>${barra(f.cif, maxE)}` },
        { t: `${a}, CIF`, n: 1, v: (f) => esc(dinero(f.cif)) },
      ])}
      <p class="nota" style="margin-top:.6rem">${esc(dinero(r.totales.ocultosRefCif))} (${esc(pct(ocultoPct))}) lo importaron personas naturales o nombres sin forma de empresa: cuentan en los totales, sin nombre.</p>
    </section>
  </div>

  <div class="dos">
    <section class="seccion" aria-labelledby="t-pais">
      <div class="seccion__cab"><h2 id="t-pais">Los países de origen en ${esc(a)}</h2><a class="nota" href="#/paises">Todos los países</a></div>
      ${libro(r.topPaises, [
        { t: 'País', v: (f) => paisEnlace(f) },
        { t: 'Valor CIF', n: 1, v: (f) => esc(dinero(f.cif)) },
        { t: 'Del total', n: 1, v: (f) => esc(pct((f.cif / imp[a]) * 100)) },
      ])}
    </section>
    <section class="seccion" aria-labelledby="t-tipos">
      <div class="seccion__cab"><h2 id="t-tipos">Importado, exportado y reexportado</h2></div>
      <p class="seccion__nota">Valor CIF por año. La reexportación es lo que entra a Panamá para salir hacia otro país.</p>
      ${libro(anios, [
        { t: 'Año', v: (y) => `${esc(y)}${r.parcial?.anio === y ? '*' : ''}` },
        { t: 'Importado', n: 1, v: (y) => esc(dinero(r.totales.porTipo.I[y])) },
        { t: 'Exportado', n: 1, v: (y) => esc(dinero(r.totales.porTipo.E[y])) },
        { t: 'Reexportado', n: 1, v: (y) => esc(dinero(r.totales.porTipo.R[y])) },
      ])}
      ${r.parcial ? `<p class="nota" style="margin-top:.5rem">* ${esc(r.parcial.anio)}, hasta ${esc(mesTexto(r.parcial.hasta))}.</p>` : ''}
    </section>
  </div>`;
}

// ── productos ──────────────────────────────────────────────────────────────────────────────────────────────────────
async function productos() {
  const r = await resumen();
  document.title = 'Productos · alphalogistics';
  const caps = [...r.capitulos].sort((x, y) => x.cap.localeCompare(y.cap));
  return `
  <h1 class="titulo">Productos</h1>
  <p class="entrada">Los ${esc(caps.length)} capítulos del arancel de Panamá, con lo importado en ${esc(r.anioRef)}. Dentro de cada uno, el
    producto es la subpartida: los seis primeros dígitos del código arancelario.</p>
  <ul class="capitulos">
    ${caps.map((c) => `<li><span class="cod">${esc(c.cap)}</span><a href="#/c/${esc(c.cap)}">${esc(c.nombre)}</a><small>${esc(corto(c.cif))}</small></li>`).join('')}
  </ul>`;
}

async function capitulo(cap) {
  const [r, c] = await Promise.all([resumen(), json(`productos/${cap}.json`).catch(() => null)]);
  if (!c) return noEsta('Ese capítulo no está en la demo.');
  const info = r.capitulos.find((x) => x.cap === cap);
  const a = r.anioRef;
  const lista = Object.entries(c).map(([sp, p]) => ({ sp, ...p, ref: p.anios?.I?.[a] || 0 })).sort((x, y) => y.ref - x.ref || y.total - x.total);
  document.title = `${info?.nombre || `Capítulo ${cap}`} · alphalogistics`;
  const max = lista[0]?.ref || 1;
  return `
  <p class="ruta"><a href="#/productos">Productos</a> · Capítulo ${esc(cap)}</p>
  <h1 class="titulo titulo--largo">${esc(info?.nombre || `Capítulo ${cap}`)}</h1>
  <p class="entrada">${esc(lista.length)} productos. En ${esc(a)} entraron <b>${esc(dinero(info?.cif || 0))}</b> de este capítulo.</p>
  <section class="seccion">
    ${libro(lista, [
      { t: 'Subpartida', ancho: 1, v: (p) => `<span class="tab">${esc(p.sp.slice(0, 4))}.${esc(p.sp.slice(4))}</span>` },
      { t: 'Producto', v: (p) => `<a href="#/p/${esc(p.sp)}">${esc(p.nombre)}</a>${barra(p.ref, max)}` },
      { t: `${a}, CIF`, n: 1, v: (p) => esc(dinero(p.ref)) },
      { t: 'Importadores', n: 1, ancho: 1, v: (p) => esc(ent.format(p.n || 0)) },
    ])}
  </section>`;
}

async function producto(sp) {
  const cap = sp.slice(0, 2);
  const [r, c] = await Promise.all([resumen(), json(`productos/${cap}.json`).catch(() => null)]);
  const p = c?.[sp];
  if (!p) return noEsta('Ese producto no está en la demo.');
  const a = r.anioRef, imp = p.anios?.I || {}, valor = imp[a] || 0, kg = p.kg?.[a] || 0;
  const capNom = r.capitulos.find((x) => x.cap === cap)?.nombre || `Capítulo ${cap}`;
  document.title = `${p.nombre} · alphalogistics`;
  const origen = p.paises?.[0];
  const totalTodo = sum(imp);
  const tablaQuien = (k) => {
    const lista = p.importadores?.[k] || [], total = k === 'todo' ? totalTodo : valor;
    return `${reparto(lista, total)}${libro(lista, [
      { t: '', pos: 1, v: (f, i) => i + 1 },
      { t: 'Importador', v: (f) => nombre(f, 'e') },
      { t: 'Valor CIF', n: 1, v: (f) => esc(dinero(f.cif)) },
      { t: 'Del mercado', n: 1, v: (f) => (total ? esc(pct((f.cif / total) * 100)) : '—') },
      { t: 'Peso', n: 1, ancho: 1, v: (f) => esc(peso(f.kg)) },
      { t: 'CIF por kilo', n: 1, ancho: 1, v: (f) => porKilo(f.cif, f.kg) },
    ], { vacio: `Nadie lo importó en ${a}.` })}`;
  };
  alCambiar('quien', tablaQuien);
  const precio = p.precioKg || {};
  const otros = [['E', 'exportó'], ['R', 'reexportó']].filter(([t]) => sum(p.anios?.[t]) > 0).map(([t, v]) => `se ${v.replace('ó', 'aron')} ${dinero(sum(p.anios[t]))}`);
  return `
  <p class="ruta"><a href="#/productos">Productos</a> · <a href="#/c/${esc(cap)}">${esc(capNom)}</a></p>
  <h1 class="titulo titulo--largo">${esc(p.nombre)}</h1>
  <p class="entrada">${valor > 0 ? `En ${esc(a)} entraron <b>${esc(dinero(valor))}</b>${kg > 0 ? ` (${esc(peso(kg))}), a un promedio de <b>${esc(porKilo(valor, kg))}</b> por kilo` : ''}.
    ${(p.n || 0) === 1 ? 'Lo trajo un solo importador.' : `Lo trajeron ${esc(ent.format(p.n || 0))} importadores${p.cuotaTop5 !== null && (p.n || 0) > 5 ? `; los cinco más grandes se quedaron con el <b>${esc(pct(p.cuotaTop5))}</b>` : ''}.`}` : `En ${esc(a)} no se importó. Desde ${esc(r.anios[0])} entraron ${esc(dinero(totalTodo))}.`}</p>
  <dl class="casillas">
    ${casilla('Subpartida', `<span class="tab">${esc(sp.slice(0, 4))}.${esc(sp.slice(4))}</span>`)}
    ${casilla(`Importado en ${a}`, esc(dinero(valor)))}
    ${casilla(`Peso neto en ${a}`, kg ? esc(peso(kg)) : '—')}
    ${casilla(`CIF por kilo en ${a}`, porKilo(valor, kg))}
    ${casilla(`Importadores en ${a}`, esc(ent.format(p.n || 0)))}
    ${casilla('Origen principal', origen ? `${marcaO(origen.region)}${esc(origen.pais)}<small>desde ${esc(r.anios[0])}</small>` : '—')}
  </dl>

  <section class="seccion" aria-labelledby="t-quien">
    <div class="seccion__cab"><h2 id="t-quien">Quién se reparte el mercado</h2>${interruptor('quien', [[a, a], ['todo', `Desde ${r.anios[0]}`]], a)}</div>
    <p class="seccion__nota">La tira es la parte de los cinco primeros; lo claro, el resto de los importadores.</p>
    <div id="quien">${tablaQuien(a)}</div>
  </section>

  <div class="dos">
    <section class="seccion" aria-labelledby="t-anio">
      <h2 id="t-anio">Cuánto entró cada año</h2>
      ${porAnio(imp, { parcial: r.parcial?.anio, unidad: 'valor CIF', mitad: true })}${moraleja(imp, r.parcial?.anio)}
    </section>
    <section class="seccion" aria-labelledby="t-precio">
      <h2 id="t-precio">A cuánto el kilo</h2>
      ${Object.keys(precio).length >= 2 ? porAnio(precio, { parcial: r.parcial?.anio, formato: (v) => dos.format(v), unidad: 'balboas de CIF por kilo', mitad: true }) : '<p class="vacio">Sin peso declarado suficiente para calcularlo.</p>'}
      <p class="seccion__nota">Valor CIF entre el peso neto declarado, en balboas. Mezcla calidades y presentaciones: sirve para ver hacia dónde va, no para cotizar.</p>
    </section>
  </div>

  <section class="seccion" aria-labelledby="t-mes">
    <h2 id="t-mes">Mes a mes</h2>
    ${porMes(p.meses, r.meses)}
  </section>

  <div class="dos">
    <section class="seccion" aria-labelledby="t-origen">
      <h2 id="t-origen">De dónde viene</h2>
      <p class="seccion__nota">Desde ${esc(r.anios[0])}.</p>
      ${libro(p.paises, [
        { t: 'País', v: (f) => paisEnlace(f) },
        { t: 'Valor CIF', n: 1, v: (f) => esc(dinero(f.cif)) },
        { t: 'Del total', n: 1, v: (f) => (totalTodo ? esc(pct((f.cif / totalTodo) * 100)) : '—') },
      ])}
    </section>
    <section class="seccion" aria-labelledby="t-decl">
      <h2 id="t-decl">Cómo lo describen en la declaración</h2>
      <p class="seccion__nota">Las descripciones que más se repiten, cada una usada por tres importadores o más.</p>
      ${p.ejemplos?.length ? `<ul class="hechos">${p.ejemplos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="vacio">Ninguna descripción se repite lo suficiente.</p>'}
      ${otros.length ? `<p class="nota" style="margin-top:.8rem">Además, desde ${esc(r.anios[0])} ${esc(otros.join(' y '))}.</p>` : ''}
    </section>
  </div>`;
}

// ── empresa ────────────────────────────────────────────────────────────────────────────────────────────────────────
async function filaDe(indice, id) {
  const i = await json(indice);
  return i.find((x) => x[0] === id);
}

async function empresa(id) {
  const f = await filaDe('indice-empresas.json', id);
  if (!f) return noEsta('Esa empresa no tiene ficha en la demo.');
  const [r, s] = await Promise.all([resumen(), json(`empresas/${f[3]}.json`)]);
  const e = s[id];
  if (!e) return noEsta('Esa empresa no tiene ficha en la demo.');
  const a = r.anioRef, ant = String(Number(a) - 1);
  document.title = `${e.nombre} · alphalogistics`;
  const tipos = ['I', 'E', 'R'].filter((t) => sum(e.anios?.[t]) > 0);
  const t0 = tipos[0] || 'I';
  const imp = e.anios?.I || {};
  const vRef = imp[a] || 0, vAnt = imp[ant] || 0;
  const cambio = vAnt > 0 && vRef > 0 ? ((vRef - vAnt) / vAnt) * 100 : null;
  const prin = e.productos?.I?.[0], pais = e.paises?.[0], puerto = e.puertos?.[0];
  const queTrae = (t) => {
    const lista = e.productos?.[t] || [], max = lista[0]?.cif || 1;
    return libro(lista, [
      { t: 'Producto', v: (x) => `<a href="#/p/${esc(x.sp)}">${esc(x.nombre)}</a>${barra(x.cif, max)}` },
      { t: `Desde ${r.anios[0]}`, n: 1, v: (x) => esc(dinero(x.cif)) },
      ...(t === 'I' ? [{ t: 'Su parte del mercado', n: 1, v: (x) => (x.cuota === null ? '—' : esc(pct(x.cuota))) }] : []),
      { t: 'Peso', n: 1, ancho: 1, v: (x) => esc(peso(x.kg)) },
    ]);
  };
  const serieTipo = (t) => `${porAnio(e.anios?.[t] || {}, { parcial: r.parcial?.anio, unidad: 'valor CIF' })}${moraleja(e.anios?.[t] || {}, r.parcial?.anio, VERBO[t])}<h3 class="sr">Mes a mes</h3>${porMes(e.meses?.[t], r.meses)}`;
  alCambiar('trae', queTrae);
  alCambiar('serie', serieTipo);
  const frase = vRef > 0
    ? `${esc(e.nombre)} importó <b>${esc(dinero(vRef))}</b> en ${esc(a)}${cambio !== null ? `, ${esc(uno.format(Math.abs(cambio)))} % ${cambio >= 0 ? 'más' : 'menos'} que en ${esc(ant)}` : ''}.${prin ? ` Lo que más trae es ${esc(prin.nombre.toLowerCase())}${pais ? `, y sobre todo de ${esc(pais.pais)}` : ''}.` : ''}`
    : `${esc(e.nombre)} no importó en ${esc(a)}. Desde ${esc(r.anios[0])} ${tipos.map((t) => `${VERBO[t]} ${dinero(sum(e.anios[t]))}`).join(' y ')}.`;
  return `
  <p class="ruta"><a href="#/">Comercio</a> · Empresa</p>
  <h1 class="titulo titulo--largo">${esc(e.nombre)}</h1>
  <p style="margin-top:.8rem">${botonSeguir('alphalogistics', { id, nombre: e.nombre, ruta: `#/e/${id}` })}</p>
  <p class="entrada">${frase}${e.estado ? ` También le vende al Estado: ganó ${esc(ent.format(e.estado.n))} ${e.estado.n === 1 ? 'proceso' : 'procesos'} de compra pública por ${esc(dinero(e.estado.monto))}.` : ''}</p>
  <dl class="casillas">
    ${casilla('RUC', e.ruc ? `<span class="tab">${esc(e.ruc)}</span>` : null)}
    ${tipos.map((t) => casilla(`${TIPO[t]} en ${a}`, esc(dinero(e.anios[t][a] || 0)))).join('')}
    ${tipos.map((t) => casilla(`${TIPO[t]} desde ${r.anios[0]}`, esc(dinero(sum(e.anios[t]))))).join('')}
    ${casilla('Origen principal', pais ? `${marcaO(pais.region)}${esc(pais.pais)}` : null)}
    ${casilla('Entra sobre todo por', puerto ? esc(puerto.puerto) : null)}
    ${casilla('Con el Estado', e.estado ? `<a href="https://alphatend.com/proveedor/${esc(e.estado.slug)}/">${esc(dinero(e.estado.monto))}</a><small>${esc(e.estado.desde?.slice(0, 4))} a ${esc(e.estado.hasta?.slice(0, 4))}, en alphatend</small>` : null)}
    ${casilla('Naves a su nombre', e.naves?.length ? `<a href="#/d/${esc(e.dueno)}">${esc(ent.format(e.naves.length))}</a>` : null)}
    ${casilla('Licencia de la AMP', e.licencias?.length ? esc(e.licencias.map((l) => l.servicio).join(', ')) : null, { ancha: (e.licencias?.length || 0) > 1 })}
    ${casilla('Zona Libre de Colón', e.zlc ? 'Usuaria' : null)}
  </dl>

  <section class="seccion" aria-labelledby="t-trae">
    <div class="seccion__cab"><h2 id="t-trae">Qué ${tipos.length > 1 ? 'mueve' : esc(VERBO[t0].replace('ó', 'a'))}</h2>${tipos.length > 1 ? interruptor('trae', tipos.map((t) => [t, TIPO[t]]), t0) : ''}</div>
    <div id="trae">${queTrae(t0)}</div>
  </section>

  ${e.competencia?.length ? `
  <section class="seccion" aria-labelledby="t-comp">
    <h2 id="t-comp">Con quién compite</h2>
    <p class="seccion__nota">En sus tres productos principales, quién más los importa desde ${esc(r.anios[0])}.</p>
    <div class="dos">${e.competencia.map((c) => {
      const yo = e.productos.I.find((x) => x.sp === c.sp);
      return `<div style="margin-top:1rem"><h3 style="font-size:1rem"><a href="#/p/${esc(c.sp)}">${esc(c.nombre)}</a></h3>
        <p class="nota">${esc(e.nombre)}: ${esc(dinero(yo?.cif || 0))}${yo?.cuota !== null && yo?.cuota !== undefined ? `, el ${esc(pct(yo.cuota))} del mercado` : ''}.</p>
        ${libro(c.rivales, [{ t: 'Importador', v: (x) => nombre(x, 'e') }, { t: 'Valor CIF', n: 1, v: (x) => esc(dinero(x.cif)) }])}</div>`;
    }).join('')}</div>
  </section>` : ''}

  <section class="seccion" aria-labelledby="t-serie">
    <div class="seccion__cab"><h2 id="t-serie">Año por año</h2>${tipos.length > 1 ? interruptor('serie', tipos.map((t) => [t, TIPO[t]]), t0) : ''}</div>
    <div id="serie">${serieTipo(t0)}</div>
  </section>

  <div class="dos">
    <section class="seccion" aria-labelledby="t-de">
      <h2 id="t-de">De dónde importa</h2>
      ${libro(e.paises, [{ t: 'País', v: (x) => paisEnlace(x) }, { t: `Desde ${r.anios[0]}`, n: 1, v: (x) => esc(dinero(x.cif)) }], { vacio: 'No importa.' })}
    </section>
    <section class="seccion" aria-labelledby="t-por">
      <h2 id="t-por">Por dónde entra</h2>
      ${libro(e.puertos, [{ t: 'Punto de entrada', v: (x) => esc(x.puerto) }, { t: `Desde ${r.anios[0]}`, n: 1, v: (x) => esc(dinero(x.cif)) }], { vacio: 'No importa.' })}
    </section>
  </div>

  ${e.estado ? `
  <section class="seccion" aria-labelledby="t-estado">
    <h2 id="t-estado">Lo que le vende al Estado</h2>
    <p class="dicho">Ganó <b>${esc(ent.format(e.estado.n))}</b> ${e.estado.n === 1 ? 'proceso' : 'procesos'} de compra pública por <b>${esc(dinero(e.estado.monto))}</b>
      entre ${esc(e.estado.desde)} y ${esc(e.estado.hasta)}${e.estado.entidades?.length ? `. Sus compradores principales: ${esc(e.estado.entidades.join(', '))}` : ''}.</p>
    <p style="margin-top:.5rem"><a href="https://alphatend.com/proveedor/${esc(e.estado.slug)}/">Su ficha en alphatend, con cada adjudicación</a></p>
  </section>` : ''}

  ${e.acp?.length ? `
  <section class="seccion" aria-labelledby="t-acp">
    <h2 id="t-acp">Lo que le adjudicó el Canal</h2>
    <p class="seccion__nota">De los edictos de adjudicación de la ACP de las últimas semanas.</p>
    ${libro(e.acp, [{ t: 'Fecha', v: (x) => `<span class="tab">${esc(x.fecha)}</span>` }, { t: 'Qué', v: (x) => esc(x.descripcion) }, { t: 'Monto', n: 1, v: (x) => esc(dinero(x.monto)) }])}
  </section>` : ''}

  ${e.naves?.length ? `
  <section class="seccion" aria-labelledby="t-naves">
    <h2 id="t-naves">Naves a su nombre</h2>
    ${libro(e.naves.slice(0, 12), [{ t: 'Nave', v: (n) => `<a href="#/n/${esc(n.ficha)}">${esc(n.nombre || 'Sin nombre en el registro')}</a>` }, { t: 'Arqueo bruto', n: 1, v: (n) => esc(ent.format(n.tonelaje || 0)) }])}
    ${e.naves.length > 12 ? `<p style="margin-top:.5rem"><a href="#/d/${esc(e.dueno)}">Las ${esc(ent.format(e.naves.length))} naves</a></p>` : ''}
  </section>` : ''}`;
}

// ── naves ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function naves() {
  const r = await resumen();
  const v = r.naves;
  document.title = 'Naves · alphalogistics';
  const maxF = v.topDuenos[0]?.naves || 1;
  return `
  <h1 class="titulo">Naves inscritas en Panamá</h1>
  <p class="entrada">El Registro de la Propiedad de Naves de la Autoridad Marítima tiene <b>${esc(ent.format(v.total))}</b> naves, de
    <b>${esc(ent.format(v.duenos))}</b> propietarios con nombre de empresa, y <b>${esc(ent.format(v.gravamenes))}</b> gravámenes anotados. Busca una
    nave por su nombre, el anterior o sus letras de radio, o un propietario por el suyo.</p>
  <section class="seccion" aria-labelledby="t-ins">
    <h2 id="t-ins">Inscritas cada año</h2>
    ${porAnio(v.porAnio, { formato: (x) => ent.format(x), unidad: 'naves' })}
    <p class="seccion__nota">De 2000 a 2024. Las de 2025 y 2026 todavía no están completas en esta copia del registro.</p>
    ${v.sinArqueo ? `<p class="seccion__nota">${esc(ent.format(v.sinArqueo))} naves figuran con un arqueo bruto de más de 300.000, más de lo que mide el buque más grande del mundo: casi seguro una coma decimal corrida al capturarlas. A esas no se les muestra el arqueo.</p>` : ''}
  </section>
  <div class="dos">
    <section class="seccion" aria-labelledby="t-flotas">
      <h2 id="t-flotas">Las flotas más grandes</h2>
      ${libro(v.topDuenos, [
        { t: 'Propietario', v: (d) => `${nombre(d, 'd')}${barra(d.naves, maxF)}` },
        { t: 'Naves', n: 1, v: (d) => esc(ent.format(d.naves)) },
        { t: 'Arqueo bruto', n: 1, ancho: 1, v: (d) => esc(ent.format(d.tonelaje)) },
      ])}
    </section>
    <section class="seccion" aria-labelledby="t-grandes">
      <h2 id="t-grandes">Las de mayor arqueo</h2>
      ${libro(v.grandes, [
        { t: 'Nave', v: (n) => `<a href="#/n/${esc(n.ficha)}">${esc(n.nombre || 'Sin nombre en el registro')}</a><small>Inscrita en ${esc(n.fecha?.slice(0, 4) || '—')}</small>` },
        { t: 'Arqueo bruto', n: 1, v: (n) => esc(ent.format(n.tonelaje)) },
      ])}
    </section>
  </div>
  <div class="dos">
    <section class="seccion" aria-labelledby="t-recientes">
      <h2 id="t-recientes">Las últimas inscritas</h2>
      ${libro(v.recientes, [
        { t: 'Nave', v: (n) => `<a href="#/n/${esc(n.ficha)}">${esc(n.nombre || 'Sin nombre en el registro')}</a>` },
        { t: 'Inscrita', v: (n) => `<span class="tab">${esc(n.fecha)}</span>` },
        { t: 'Arqueo bruto', n: 1, v: (n) => esc(ent.format(n.tonelaje || 0)) },
      ])}
    </section>
    <section class="seccion" aria-labelledby="t-lic">
      <h2 id="t-lic">Empresas marítimas con licencia</h2>
      <p class="seccion__nota">${esc(ent.format(v.licencias))} licencias de operación vigentes de la AMP, por servicio.</p>
      ${libro(v.servicios.slice(0, 15), [{ t: 'Servicio', v: (x) => esc(x.servicio) }, { t: 'Licencias', n: 1, v: (x) => esc(ent.format(x.n)) }])}
      ${v.servicios.length > 15 ? `<p class="nota" style="margin-top:.5rem">Y ${esc(ent.format(v.servicios.length - 15))} servicios más, con ${esc(ent.format(v.servicios.slice(15).reduce((s2, x) => s2 + x.n, 0)))} licencias entre todos.</p>` : ''}
    </section>
  </div>`;
}

async function nave(ficha) {
  const s = await json(`naves/${Number(ficha) % 100}.json`).catch(() => ({}));
  const n = s[ficha];
  if (!n) return noEsta('Esa nave no está en la demo.');
  document.title = `${n.nombre} · alphalogistics`;
  const metros = (x) => (x ? `${dos.format(x)} m` : null);
  return `
  <p class="ruta"><a href="#/naves">Naves</a> · Registro de la Propiedad de Naves</p>
  <h1 class="titulo">${esc(n.nombre || 'Nave sin nombre en el registro')}</h1>
  <p class="entrada">${n.fecha ? `Inscrita el ${esc(n.fecha)}` : 'Inscrita'} en el Registro de la Propiedad de Naves de Panamá${n.tb ? `, con <b>${esc(ent.format(n.tb))}</b> de arqueo bruto` : ''}.${n.anterior ? ` Antes se llamaba ${esc(n.anterior)}.` : ''}</p>
  <dl class="casillas">
    ${casilla('Ficha', `<span class="tab">${esc(ficha)}</span>`)}
    ${casilla('Inscripción', esc(n.status))}
    ${casilla('Fecha de inscripción', n.fecha ? `<span class="tab">${esc(n.fecha)}</span>` : null)}
    ${casilla('Patente', esc(n.patente))}
    ${casilla('Arqueo bruto', n.tb ? esc(ent.format(n.tb)) : null)}
    ${casilla('Arqueo neto', n.tn ? esc(ent.format(n.tn)) : null)}
    ${casilla('Eslora', metros(n.eslora))}
    ${casilla('Manga', metros(n.manga))}
    ${casilla('Puntal', metros(n.puntal))}
    ${casilla('Letras de radio', esc(n.radio))}
    ${casilla('Nombre anterior', esc(n.anterior))}
    ${casilla('Escritura', n.escritura ? `N.º ${esc(n.escritura.numero)}${n.escritura.fecha ? ` del ${esc(n.escritura.fecha)}` : ''}<small>Notaría ${esc(n.escritura.notaria)}${n.escritura.provincia ? `, ${esc(n.escritura.provincia.toLowerCase().replace(/^./, (c) => c.toUpperCase()))}` : ''}</small>` : null, { ancha: true })}
  </dl>
  <section class="seccion" aria-labelledby="t-prop">
    <h2 id="t-prop">Propietarios inscritos</h2>
    ${libro(n.duenos, [{ t: 'Propietario', v: (d) => nombre(d, 'd') }], { vacio: 'El registro no trae propietario para esta nave.' })}
  </section>
  <section class="seccion" aria-labelledby="t-grav">
    <h2 id="t-grav">Gravámenes</h2>
    ${libro(n.gravamenes, [{ t: 'Tipo', v: (g) => esc(g.tipo || '—') }, { t: 'Clase', v: (g) => esc(g.clase || '—') }, { t: 'Estado', v: (g) => esc(g.status || '—') }], { vacio: 'Sin gravámenes anotados.' })}
  </section>`;
}

async function dueno(id) {
  const f = await filaDe('indice-duenos.json', id);
  if (!f) return noEsta('Ese propietario no está en la demo.');
  const s = await json(`duenos/${f[4]}.json`);
  const d = s[id];
  if (!d) return noEsta('Ese propietario no está en la demo.');
  document.title = `${d.nombre} · alphalogistics`;
  const ton = d.naves.reduce((x, n) => x + (n.tonelaje || 0), 0);
  const max = d.naves[0]?.tonelaje || 1;
  return `
  <p class="ruta"><a href="#/naves">Naves</a> · Propietario</p>
  <h1 class="titulo titulo--largo">${esc(d.nombre)}</h1>
  <p class="entrada">Tiene <b>${esc(ent.format(d.naves.length))}</b> ${d.naves.length === 1 ? 'nave inscrita' : 'naves inscritas'} en Panamá, con
    <b>${esc(ent.format(ton))}</b> de arqueo bruto en total.${d.empresa ? ` También importa o exporta: <a href="#/e/${esc(d.empresa)}">ver su comercio</a>.` : ''}</p>
  <section class="seccion" aria-labelledby="t-flota">
    <h2 id="t-flota">Su flota</h2>
    ${libro(d.naves, [
      { t: 'Nave', v: (n) => `<a href="#/n/${esc(n.ficha)}">${esc(n.nombre || 'Sin nombre en el registro')}</a>${barra(n.tonelaje, max)}` },
      { t: 'Inscrita', ancho: 1, v: (n) => `<span class="tab">${esc(n.fecha || '—')}</span>` },
      { t: 'Arqueo bruto', n: 1, v: (n) => esc(ent.format(n.tonelaje || 0)) },
    ])}
  </section>`;
}

async function fuentes() {
  const r = await resumen();
  document.title = 'De dónde sale · alphalogistics';
  const d = r.descartadas;
  return `
  <h1 class="titulo">De dónde sale cada dato</h1>
  <p class="entrada">Todo es información que el Estado panameño publica. La demo la ordena por empresa y por producto, y la cruza.
    Datos al ${esc(r.generado)}; las declaraciones llegan hasta ${esc(mesTexto(r.hasta))}.</p>
  <dl class="casillas">${r.fuentes.map((f) => casilla(f.nombre, `<span style="font-weight:400">${esc(f.que)}</span> <a href="${esc(f.url)}">${esc(new URL(f.url).hostname)}</a>`, { ancha: true })).join('')}</dl>
  <section class="seccion" aria-labelledby="t-como">
    <h2 id="t-como">Cómo leerlo</h2>
    <ul class="hechos" style="margin-top:.6rem">
      <li>Los valores son CIF (mercancía, seguro y flete), en balboas, como los declara Aduanas.</li>
      <li>Una empresa se reconoce por el nombre con que declara. Si ese nombre está en el registro de proveedores del Estado, lleva su RUC y lo que ha ganado en PanamaCompra.</li>
      <li>Las personas naturales no se nombran. Un nombre se publica si tiene forma de empresa o de institución, o si el registro de proveedores dice que es una sociedad. Lo demás sale como «Sin nombre publicado», y sus montos cuentan en los totales.</li>
      ${d?.n ? `<li>Se descartaron ${esc(ent.format(d.n))} líneas declaradas a más de B/. 1 millón por kilo, ${esc(dinero(d.cif))} en total. La mayor: ${esc(dinero(d.mayor.cif))} por ${esc(peso(d.mayor.kg))} de «${esc(d.mayor.d)}», en ${esc(mesTexto(d.mayor.mes))}, que sola multiplicaba por cien las reexportaciones de ese año.</li>` : ''}
      <li>El precio por kilo es el valor CIF entre el peso neto declarado. Junta calidades y presentaciones distintas.</li>
    </ul>
  </section>`;
}

// ── países ───────────────────────────────────────────────────────────────────────────────────────────────────────────
async function pais(sl) {
  const [r, x] = await Promise.all([resumen(), json(`paises/${sl}.json`).catch(() => null)]);
  if (!x) return noEsta('Ese país no está en la demo.');
  const a = r.anioRef, v = x.anios?.[a] || 0, tot = r.totales.porTipo.I[a] || 1;
  document.title = `${x.pais} · alphalogistics`;
  const p1 = x.productos[0], i1 = x.importadores.find((i) => i.nombre);
  const maxP = x.productos[0]?.cif || 1, maxI = x.importadores[0]?.cif || 1;
  return `
  <p class="ruta"><a href="#/paises">Países de origen</a></p>
  <h1 class="titulo">${marcaO(x.region)}${esc(x.pais)}</h1>
  <p class="entrada">En ${esc(a)} Panamá importó <b>${esc(dinero(v))}</b> con ${esc(x.pais)} como país de origen, el <b>${esc(pct((v / tot) * 100))}</b> de todo lo
    importado.${p1 ? ` Lo que más se trae es ${esc(p1.nombre.toLowerCase())}` : ''}${i1 ? `, y el mayor importador desde ${esc(r.anios[0])} es ${esc(i1.nombre.replace(/\.$/, ''))}` : ''}.</p>
  <section class="seccion"><h2>Importado cada año</h2>${porAnio(x.anios, { parcial: r.parcial?.anio, unidad: 'valor CIF' })}${moraleja(x.anios, r.parcial?.anio)}</section>
  <div class="dos">
    <section class="seccion"><h2>Lo que se trae</h2><p class="seccion__nota">Desde ${esc(r.anios[0])}.</p>
      ${libro(x.productos, [{ t: 'Producto', v: (f) => `<a href="#/p/${esc(f.sp)}">${esc(f.nombre)}</a>${barra(f.cif, maxP)}` }, { t: 'Valor CIF', n: 1, v: (f) => esc(dinero(f.cif)) }, { t: 'Peso', n: 1, ancho: 1, v: (f) => esc(peso(f.kg)) }])}</section>
    <section class="seccion"><h2>Quién lo trae</h2><p class="seccion__nota">Desde ${esc(r.anios[0])}.</p>
      ${libro(x.importadores, [{ t: 'Importador', v: (f) => `${nombre(f, 'e')}${barra(f.cif, maxI)}` }, { t: 'Valor CIF', n: 1, v: (f) => esc(dinero(f.cif)) }])}</section>
  </div>`;
}
async function paisesLista() {
  const r = await resumen();
  document.title = 'Países de origen · alphalogistics';
  const a = r.anioRef, max = r.paises[0]?.[3] || 1;
  return `
  <h1 class="titulo">Países de origen</h1>
  <p class="entrada">De dónde vienen las importaciones de Panamá, ordenados por lo importado en ${esc(a)}. ${esc(ent.format(r.paises.length))} países con más de B/. 100 mil desde ${esc(r.anios[0])}.</p>
  <section class="seccion">${libro(r.paises, [
    { t: 'País', v: (f) => `${marcaO(f[2])}<a href="#/pais/${esc(f[0])}">${esc(f[1])}</a>${barra(f[3], max)}` },
    { t: `${a}, CIF`, n: 1, v: (f) => esc(dinero(f[3])) },
    { t: `Desde ${r.anios[0]}`, n: 1, ancho: 1, v: (f) => esc(dinero(f[4])) },
  ])}</section>`;
}
async function siguiendo() {
  document.title = 'Siguiendo · alphalogistics';
  const l = seguidos('alphalogistics');
  if (!l.length) return `<h1 class="titulo">Siguiendo</h1><p class="entrada">Todavía no sigues ninguna empresa. En la ficha de una empresa, «Seguir» la deja aquí; la lista se guarda en este navegador.</p>`;
  const idx = await json('indice-empresas.json');
  const por = new Map(idx.map((x) => [x[0], x]));
  return `<h1 class="titulo">Siguiendo</h1><p class="entrada">${esc(ent.format(l.length))} ${l.length === 1 ? 'empresa' : 'empresas'}, guardadas en este navegador.</p>
  <section class="seccion">${libro(l, [
    { t: 'Empresa', v: (x) => `<a href="${esc(x.ruta)}">${esc(x.nombre)}</a><small>desde el ${esc(x.desde || '')}</small>` },
    { t: `Desde ${(R || {}).anios?.[0] || 2020}, CIF`, n: 1, v: (x) => esc(dinero(por.get(x.id)?.[2] || 0)) },
  ])}</section>`;
}

function noEsta(texto) {
  document.title = 'No está · alphalogistics';
  return `<h1 class="titulo">No está</h1><p class="entrada">${esc(texto)}</p><p style="margin-top:1rem"><a href="#/">Volver a Comercio</a></p>`;
}

// ── rutas ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const RUTAS = [
  [/^#?\/?$/, comercio, '#/'],
  [/^#\/productos$/, productos, '#/productos'],
  [/^#\/c\/(\d{2})$/, capitulo, '#/productos'],
  [/^#\/p\/(\d{6})$/, producto, '#/productos'],
  [/^#\/e\/([a-z0-9-]+)$/, empresa, '#/'],
  [/^#\/naves$/, naves, '#/naves'],
  [/^#\/n\/(\d+)$/, nave, '#/naves'],
  [/^#\/d\/([a-z0-9-]+)$/, dueno, '#/naves'],
  [/^#\/fuentes$/, fuentes, null],
  [/^#\/pais\/([a-z0-9-]+)$/, pais, '#/'],
  [/^#\/paises$/, paisesLista, '#/'],
  [/^#\/sigo$/, siguiendo, '#/sigo'],
];
let primera = true;
async function pintar() {
  const h = location.hash || '#/';
  const ruta = RUTAS.find(([re]) => re.test(h));
  cerrar();
  try {
    main.innerHTML = ruta ? await ruta[1](...h.match(ruta[0]).slice(1)) : noEsta('Esa dirección no existe en la demo.');
    conCsv(main, 'alphalogistics');
    activarSeguir(main, 'alphalogistics');
  } catch (e) {
    main.innerHTML = `<h1 class="titulo">No se pudo cargar</h1><p class="entrada">${esc(e.message)}. Revisa la conexión y vuelve a intentarlo.</p><p style="margin-top:1rem"><a href="${esc(h)}" onclick="location.reload();return false">Reintentar</a></p>`;
  }
  document.querySelectorAll('.indice a').forEach((a) => a.toggleAttribute('aria-current', !!ruta && a.getAttribute('href') === ruta[2]));
  if (!primera) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  primera = false;
}

// ── buscador ───────────────────────────────────────────────────────────────────────────────────────────────────────
const caja = $('#resultados'), q = $('#q');
function cerrar() { caja.hidden = true; caja.innerHTML = ''; }
let grandes = null;
async function buscar(texto) {
  const t = normal(texto);
  if (t.length < 2) return cerrar();
  const pal = t.split(' ');
  const va = (s) => pal.every((p) => s.includes(p));
  const [P, E] = await Promise.all([json('indice-productos.json'), json('indice-empresas.json')]);
  if (t.length >= 3 && !grandes) grandes = await Promise.all([json('indice-duenos.json'), json('indice-naves.json')]);
  if (normal(q.value) !== t) return;
  const [D, N] = grandes || [[], []];
  const lp = P.filter((x) => va(x[4])), le = E.filter((x) => va(x[4])), ld = D.filter((x) => va(x[5])), ln = N.filter((x) => va(x[3]));
  const grupo = (titulo, lista, n, fila) => (lista.length ? `<h2>${esc(titulo)} · ${esc(ent.format(lista.length))}</h2>${lista.slice(0, n).map(fila).join('')}` : '');
  const html = [
    grupo('Productos', lp, 6, (x) => `<a href="#/p/${esc(x[0])}"><span>${esc(x[1])}</span><small>${esc(corto(x[3]))}</small></a>`),
    grupo('Empresas', le, 7, (x) => `<a href="#/e/${esc(x[0])}"><span>${esc(x[1])}</span><small>${esc(corto(x[2]))}</small></a>`),
    grupo('Propietarios de naves', ld, 4, (x) => `<a href="#/d/${esc(x[0])}"><span>${esc(x[1])}</span><small>${esc(ent.format(x[2]))} ${x[2] === 1 ? 'nave' : 'naves'}</small></a>`),
    grupo('Naves', ln, 5, (x) => `<a href="#/n/${esc(x[0])}"><span>${esc(x[1])}</span><small>${x[2] ? `${esc(ent.format(x[2]))} de arqueo` : ''}</small></a>`),
  ].join('');
  caja.innerHTML = html || `<p>Nada con «${esc(texto)}». Prueba con una sola palabra, en singular, o con el nombre sin «S.A.».</p>`;
  if (!grandes && t.length < 3) caja.insertAdjacentHTML('beforeend', '<p class="cuenta">Escribe una letra más para buscar también naves y propietarios.</p>');
  caja.hidden = false;
}
let espera;
q.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => buscar(q.value).catch(() => { caja.innerHTML = '<p>No se pudo leer el índice. Revisa la conexión.</p>'; caja.hidden = false; }), 120); });
q.addEventListener('keydown', (ev) => {
  const enl = [...caja.querySelectorAll('a')];
  if (!enl.length || !['ArrowDown', 'ArrowUp'].includes(ev.key)) return;
  ev.preventDefault();
  const i = enl.findIndex((a) => a.classList.contains('activo'));
  const j = ev.key === 'ArrowDown' ? Math.min(enl.length - 1, i + 1) : Math.max(0, i - 1);
  enl.forEach((a, k) => a.classList.toggle('activo', k === j));
  enl[j].scrollIntoView({ block: 'nearest' });
});
$('#buscar').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const a = caja.querySelector('a.activo') || caja.querySelector('a');
  if (a) { location.hash = a.getAttribute('href'); q.value = ''; q.blur(); }
});
caja.addEventListener('click', (ev) => { if (ev.target.closest('a')) { q.value = ''; } });
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') cerrar();
  if (ev.key === '/' && document.activeElement !== q && !/input|textarea/i.test(document.activeElement?.tagName || '')) { ev.preventDefault(); q.focus(); }
});
document.addEventListener('click', (ev) => { if (!ev.target.closest('.buscador')) cerrar(); });

document.body.dataset.cerrado = '';
abrir().then(() => {
  delete document.body.dataset.cerrado;
  window.addEventListener('hashchange', pintar);
  pintar();
});
