// alphalex (demo privada de alphateklab, 19-oct-2026): la norma, si sigue viva y cómo se ha aplicado. Los datos los arma
// ~/proyectos/cuire/alphalex/demo/armar-demo.mjs y llegan cifrados (../demo-acceso). Vistas, cada una con la forma de
// su dato: la norma se lee (texto por artículo, en serif) y se verifica (su historia y sus citas al lado); la decisión
// es un registro; la parte, su lista de casos; las penas, una tabla de cuantiles; los tribunales, cómo deciden; la
// Gaceta, lo publicado, con un radar de palabras guardado en el navegador.
import { abrirDatos } from '../demo-acceso/acceso.js';
import { conCsv, botonSeguir, activarSeguir, seguidos } from '../demo-acceso/utiles.js';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#contenido');
let lector = null;
const abrir = () => (lector ||= abrirDatos({ donde: main, nombre: 'alphalex' }));
const memo = new Map();
const json = (ruta) => {
  if (!memo.has(ruta)) memo.set(ruta, abrir().then((leer) => leer(ruta)).catch((e) => { memo.delete(ruta); throw e; }));
  return memo.get(ruta);
};
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ent = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 0 });
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fecha = (f) => (f && /^\d{4}-\d{2}-\d{2}/.test(f) ? `${Number(f.slice(8, 10))} de ${MES[Number(f.slice(5, 7)) - 1]} de ${f.slice(0, 4)}` : f || '');
const fCorta = (f) => (f && /^\d{4}-\d{2}-\d{2}/.test(f) ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : f || '—');
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[.,"'`´()/\\-]/g, ' ').replace(/[^A-Z0-9Ñ&+ ]/g, ' ').replace(/\s+/g, ' ').trim();
const meses = (m) => (m === null || m === undefined ? '—' : m >= 12 ? `${ent.format(Math.floor(m / 12))} a${m % 12 ? ` ${m % 12} m` : ''}` : `${m} m`);
const VERBO = { modifica: 'La modificó', adiciona: 'Le añadió', reglamenta: 'La reglamentó', deroga: 'La derogó', reforma: 'La reformó', subroga: 'La subrogó', aprueba: 'La aprobó', 'deja sin efecto': 'La dejó sin efecto', sustituye: 'La sustituyó' };
const VERBO_HIZO = { modifica: 'Modifica', adiciona: 'Añade a', reglamenta: 'Reglamenta', deroga: 'Deroga', reforma: 'Reforma', subroga: 'Subroga', aprueba: 'Aprueba', 'deja sin efecto': 'Deja sin efecto', sustituye: 'Sustituye' };
const FUERTE = new Set(['deroga', 'subroga', 'deja sin efecto', 'sustituye']);
const shardN = (id) => Number(id) % 200, shardD = (id) => Number(id) % 300;
/** «["DER. ADMINISTRATIVO","DER. FINANCIERO"]» → «Derecho administrativo, derecho financiero». */
const materia = (r) => {
  let l = []; try { l = Array.isArray(r) ? r : JSON.parse(r || '[]'); } catch { l = String(r || '').split(/[;,]/); }
  return l.map((x) => String(x).replace(/^DER\.\s*/i, 'derecho ').toLowerCase().trim()).filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase());
};
/** Lo que una misma norma posterior le hizo, en una sola línea (la Ley 12 de 2010 salía seis veces). */
const agrupar = (l) => {
  const m = new Map();
  for (const x of l) {
    const k = x.por?.id ?? x.por?.n;
    const g = m.get(k) || { por: x.por, fecha: x.fecha, verbos: [], arts: new Set() };
    if (!g.verbos.includes(x.verbo)) g.verbos.push(x.verbo);
    for (const a of String(x.art || '').split(/[,;\s]+/).filter(Boolean)) g.arts.add(a);
    m.set(k, g);
  }
  return [...m.values()].map((g) => ({ ...g, art: [...g.arts].slice(0, 30).join(', ') + (g.arts.size > 30 ? '…' : '') }));
};

let R = null;
const resumen = async () => (R ||= await json('resumen'));
function libro(filas, cols, vacio = 'Sin datos.') {
  if (!filas?.length) return `<p class="nota" style="margin-top:.7rem">${esc(vacio)}</p>`;
  return `<div class="libro-env"><table class="libro"><thead><tr>${cols.map((c) => `<th scope="col" class="${[c.n && 'n', c.ancho && 'solo-ancho'].filter(Boolean).join(' ')}">${esc(c.t)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f, i) => `<tr>${cols.map((c) => `<td class="${[c.n && 'n', c.ancho && 'solo-ancho'].filter(Boolean).join(' ')}">${c.v(f, i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const enlaceNorma = (x) => (x?.id ? `<a href="#/n/${esc(x.id)}">${esc(x.n)}</a>` : esc(x?.n || ''));
const decTitulo = (d) => `${esc(d.t || 'Decisión')}${d.num ? ` ${esc(d.num)}` : ''}`;
const partesTxt = (l) => (l?.length ? l.map((p) => `${esc(p.rol)}: ${p.id ? `<a href="#/p/${esc(p.id)}">${esc(p.n)}</a>` : esc(p.n)}`).join(' · ') : '');
const cuenta = (pares, total) => {
  const max = Math.max(...pares.map((p) => p[1]), 1);
  return `<ul class="cuenta">${pares.map(([k, v]) => `<li><span>${k}</span><b>${esc(ent.format(v))}</b><i style="width:${((v / max) * 100).toFixed(1)}%" aria-hidden="true"></i></li>`).join('')}</ul>${total ? `<p class="nota" style="margin-top:.4rem">${esc(total)}</p>` : ''}`;
};

// ── portada ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function portada() {
  const r = await resumen();
  document.title = 'alphalex · las normas de Panamá y cómo se han aplicado';
  return `
  <h1 class="titulo">Las normas de Panamá, si siguen vivas y cómo se han aplicado</h1>
  <p class="entrada"><b>${esc(ent.format(r.normas))}</b> normas de Legispan, <b>${esc(ent.format(r.conVigencia))}</b> de ellas tocadas por una norma
    posterior, y <b>${esc(ent.format(r.decisiones))}</b> decisiones de la Corte, la Procuraduría, los tribunales y otros órganos, con
    <b>${esc(ent.format(r.citas))}</b> citas a normas leídas de su texto. Busca una norma por su número y año («ley 22 de 2006»), por un tema,
    o una empresa o institución para ver en qué decisiones aparece.</p>
  <div class="dos">
    <section class="bloque" aria-labelledby="t-citadas">
      <h2 id="t-citadas">Las más citadas</h2>
      <p class="nota" style="margin-top:.25rem">Veces que las citan decisiones, otras normas y actas de la Asamblea.</p>
      ${libro(r.masCitadas, [
        { t: 'Norma', v: (x) => `${enlaceNorma(x)}<small>${esc(x.t)}</small>` },
        { t: 'Citas', n: 1, v: (x) => esc(ent.format(x.c)) },
      ])}
    </section>
    <section class="bloque" aria-labelledby="t-cambios">
      <h2 id="t-cambios">Lo último que cambió</h2>
      <p class="nota" style="margin-top:.25rem">Normas recientes que modifican, derogan o reglamentan otras.</p>
      <ul class="historia">${r.recientes.map((x) => `<li><span class="f">${esc(fCorta(x.f))}</span><span>${enlaceNorma(x.por)} <span class="v${FUERTE.has(x.verbo) ? '' : ' v--suave'}">${esc((VERBO_HIZO[x.verbo] || x.verbo).toLowerCase())}</span> ${enlaceNorma(x.a)}</span></li>`).join('')}</ul>
    </section>
  </div>
  <div class="dos">
    <section class="bloque" aria-labelledby="t-org">
      <h2 id="t-org">Las decisiones, por órgano</h2>
      ${cuenta(r.organos.map((o) => [`<a href="#/tribunales#${esc(normal(o.o).toLowerCase().replace(/ +/g, '-'))}">${esc(o.o)}</a>`, o.n]))}
    </section>
    <section class="bloque" aria-labelledby="t-pen">
      <h2 id="t-pen">Penas por delito</h2>
      <p class="nota" style="margin-top:.25rem">Mediana de la pena de prisión impuesta, de la Base de Fallos del Ministerio Público.</p>
      ${libro(r.penas.slice(0, 8), [{ t: 'Delito', v: (x) => esc(x.delito) }, { t: 'Casos', n: 1, v: (x) => esc(ent.format(x.n)) }, { t: 'Mediana', n: 1, v: (x) => esc(meses(x.med)) }])}
      <p style="margin-top:.6rem"><a href="#/penal">Las ${esc(ent.format(r.penas.length))} figuras, con su rango y el acuerdo de pena</a></p>
    </section>
  </div>`;
}

// ── la norma ─────────────────────────────────────────────────────────────────────────────────────────────────────────
async function norma(id) {
  const sh = await json(`normas/${shardN(id)}`);
  const n = sh[id];
  if (!n) return noEsta('Esa norma no está en la demo.');
  document.title = `${n.nombre} · alphalex`;
  const derogada = /derogada/.test(n.estado || '');
  // «Ley 22 de 27 de junio de 2006, Gaceta Oficial n.º 25576 de 28 de junio de 2006.»: con la fecha, el año no se repite.
  const base = n.num && n.f && !n.codigo ? `${n.tipo.toLowerCase().replace(/^./, (x) => x.toUpperCase())} ${n.num} de ${fecha(n.f)}` : n.nombre;
  const cita = `${base}${n.gaceta ? `, Gaceta Oficial n.º ${n.gaceta}${n.gf ? ` de ${fecha(n.gf)}` : ''}` : ''}.`;
  const c = n.citas;
  const texto = n.texto ? await json(`textos/${id}`).catch(() => null) : null;
  setTimeout(() => {
    $('#copiar-cita')?.addEventListener('click', async (ev) => {
      try { await navigator.clipboard.writeText(cita); ev.target.textContent = 'Cita copiada'; } catch { ev.target.textContent = cita; }
      setTimeout(() => { ev.target.textContent = 'Copiar la cita'; }, 2500);
    });
  });
  const articulosCitados = c?.art?.length ? `<section class="seccion" aria-labelledby="t-art"><h2 id="t-art">Los artículos más citados</h2>
      ${cuenta(c.art.slice(0, 12).map((x) => [texto ? `<a href="#/n/${esc(id)}/a/${esc(x.a)}">Artículo ${esc(x.a)}</a>` : `Artículo ${esc(x.a)}`, x.n]))}</section>` : '';
  return `
  <p class="ruta"><a href="#/">Normas</a> · ${esc(n.tipo ? n.tipo.toLowerCase().replace(/^./, (x) => x.toUpperCase()) : 'Norma')}</p>
  <h1 class="titulo">${esc(n.nombre)}</h1>
  ${n.titulo ? `<p class="subtitulo">${esc(n.titulo)}</p>` : ''}
  <p class="estado${n.estado ? '' : ' estado--neutro'}">${n.estado ? esc(n.estado.replace(/^./, (x) => x.toUpperCase())) : n.recibio.length ? 'Tocada por normas posteriores' : 'Ninguna norma posterior dice tocarla'}</p>
  <div class="acciones">
    <button type="button" id="copiar-cita">Copiar la cita</button>
    ${n.url ? `<a class="boton" href="${esc(n.url)}" rel="noopener">El original en Legispan</a>` : ''}
    <button type="button" onclick="window.print()">Imprimir</button>
    ${botonSeguir('alphalex', { id, nombre: n.nombre, ruta: `#/n/${id}`, cambios: n.recibio.length })}
  </div>
  <div class="ficha">
    <div>
      <section class="seccion" aria-labelledby="t-hist">
        <h2 id="t-hist">¿Sigue viva?</h2>
        <p class="nota">Lo que dicen de ella las normas posteriores, de la más nueva a la más vieja. Es una lectura de sus títulos y cláusulas, no una certificación.</p>
        ${n.recibio.length ? `<ul class="historia">${agrupar(n.recibio).map((x) => `<li><span class="f">${esc(fCorta(x.fecha))}</span><span>${enlaceNorma(x.por)}: ${x.verbos.map((v) => `<span class="v${FUERTE.has(v) ? '' : ' v--suave'}">${esc((VERBO[v] || v).toLowerCase())}</span>`).join(', ')}</span>${x.art ? `<span class="art">Artículos: ${esc(x.art)}</span>` : ''}</li>`).join('')}</ul>`
          : '<p class="dicho">Ninguna norma posterior de la base dice modificarla, derogarla ni reglamentarla.</p>'}
      </section>
      ${n.hizo.length ? `<section class="seccion" aria-labelledby="t-hizo"><h2 id="t-hizo">Lo que esta norma cambió</h2>
        <ul class="historia">${n.hizo.map((x) => `<li><span class="f"></span><span><span class="v${FUERTE.has(x.verbo) ? '' : ' v--suave'}">${esc(VERBO_HIZO[x.verbo] || x.verbo)}</span> ${enlaceNorma(x.a)}</span>${x.art ? `<span class="art">Artículos: ${esc(x.art)}</span>` : ''}</li>`).join('')}</ul></section>` : ''}
      ${articulosCitados}
      ${texto ? `<section class="seccion" aria-labelledby="t-texto"><h2 id="t-texto">Texto</h2>
        <p class="nota">El original de Legispan, sin las reformas incorporadas${derogada ? '. Ojo: una norma posterior dice derogarla' : ''}. ${esc(ent.format(texto.articulos.length))} artículos.</p>
        <form class="radar" onsubmit="event.preventDefault(); const v = this.querySelector('input').value.trim(); if (v) location.hash = '#/n/${esc(id)}/a/' + encodeURIComponent(v);"><label for="ir-art" class="sr">Ir al artículo</label><input id="ir-art" inputmode="numeric" placeholder="Ir al artículo…" style="width:10rem" /><button type="submit">Ir</button></form>
        <div class="texto" style="margin-top:1rem">
          ${texto.antes ? `<p class="antes">${esc(texto.antes.slice(0, 3000))}</p>` : ''}
          ${texto.articulos.map((a) => `<div class="art" id="art-${esc(a.num || 'texto')}"><div class="art__cab"><a href="#/n/${esc(id)}/a/${esc(a.num || '')}">${a.num ? `Artículo ${esc(a.num)}` : 'Texto'}</a>${a.c ? `<span class="c">citado ${esc(ent.format(a.c))} ${a.c === 1 ? 'vez' : 'veces'}</span>` : ''}</div><p>${esc(a.txt.replace(/^art[ií]culo\s+[\w°º.-]+\s*[.:-]?\s*/i, ''))}</p></div>`).join('')}
        </div></section>` : `<section class="seccion"><h2>Texto</h2><p class="nota">El texto de esta norma no viene en la demo (trae el de las ${esc(ent.format((await resumen()).conTexto))} más citadas).${n.url ? ` Está en <a href="${esc(n.url)}" rel="noopener">Legispan</a>.` : ''}</p></section>`}
    </div>
    <aside class="lado" aria-label="Datos y aplicación">
      <section class="seccion">
        <h2>Datos</h2>
        <dl class="datos">
          ${n.num ? `<dt>Número</dt><dd>${esc(n.num)}</dd>` : ''}${n.f ? `<dt>Fecha</dt><dd>${esc(fecha(n.f))}</dd>` : ''}
          ${n.gaceta ? `<dt>Gaceta</dt><dd>n.º ${esc(n.gaceta)}${n.gf ? `, ${esc(fecha(n.gf))}` : ''}</dd>` : ''}
          ${n.autoridad ? `<dt>Autoridad</dt><dd>${esc(n.autoridad)}</dd>` : ''}${materia(n.ramas) ? `<dt>Materia</dt><dd>${esc(materia(n.ramas))}</dd>` : ''}
          ${n.nArt ? `<dt>Artículos</dt><dd>${esc(ent.format(n.nArt))}</dd>` : ''}
        </dl>
      </section>
      <section class="seccion">
        <h2>Cómo se ha aplicado</h2>
        ${c ? `${cuenta(Object.entries(c.origen).map(([k, v]) => [{ decision: 'Decisiones', norma: 'Normas', acta: 'Actas de la Asamblea' }[k] || k, v]), `${ent.format(c.nDec)} decisiones distintas la citan.`)}
          ${Object.keys(c.organo).length ? `<h3 style="font-size:.92rem;margin-top:1rem">Por órgano</h3>${cuenta(Object.entries(c.organo).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [esc(k), v]))}` : ''}
          ${c.decs?.length ? `<h3 style="font-size:.92rem;margin-top:1rem">Las últimas que la citan</h3><ul class="historia">${c.decs.slice(0, 10).map((d) => `<li><span class="f">${esc(fCorta(d.f))}</span><span><a href="#/d/${esc(d.id)}">${decTitulo(d)}</a><span class="art" style="display:block">${esc(d.o)}${d.r ? ` · ${esc(d.r)}` : ''}</span></span></li>`).join('')}</ul>` : ''}`
          : '<p class="nota" style="margin-top:.5rem">Ninguna decisión, norma ni acta de la base la cita.</p>'}
      </section>
    </aside>
  </div>`;
}

async function articulo(id, num) {
  const html = await norma(id);
  setTimeout(() => {
    const el = document.getElementById(`art-${num}`);
    if (el) { el.scrollIntoView({ block: 'start' }); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); el.style.background = 'var(--vino-suave)'; }
  });
  return html;
}

// ── la decisión y la parte ───────────────────────────────────────────────────────────────────────────────────────────
async function decision(id) {
  const sh = await json(`decisiones/${shardD(id)}`);
  const d = sh[id];
  if (!d) return noEsta('Esa decisión no está en la demo.');
  document.title = `${d.t || 'Decisión'} ${d.num || ''} · alphalex`;
  const partes = d.partes?.lista || [];
  const idx = await json('indice-partes');
  const idDe = new Map(idx.map((x) => [x[4], x[0]]));
  const conId = partes.map((p) => (p.n ? { ...p, id: idDe.get(normal(p.n)) } : p));
  const ocultas = conId.filter((p) => !p.n).length;
  return `
  <p class="ruta"><a href="#/tribunales">Tribunales</a> · ${esc(d.o)}</p>
  <h1 class="titulo" style="font-size:clamp(1.5rem,3.2vw,2.1rem)">${decTitulo(d)}</h1>
  <p class="subtitulo">${esc(d.o)}${d.partes?.sala ? `, Sala ${esc(d.partes.sala)}` : ''}${d.f ? `, ${esc(fecha(d.f))}` : ''}</p>
  <div class="dos">
    <section class="bloque"><h2>Registro</h2><dl class="datos">
      ${d.t ? `<dt>Tipo</dt><dd>${esc(d.t)}</dd>` : ''}${d.num ? `<dt>Número</dt><dd>${esc(d.num)}</dd>` : ''}${d.f ? `<dt>Fecha</dt><dd>${esc(fecha(d.f))}</dd>` : ''}
      ${d.ar ? `<dt>Área</dt><dd>${esc(d.ar)}</dd>` : ''}${d.m ? `<dt>Materia</dt><dd>${esc(d.m)}</dd>` : ''}
      ${d.r ? `<dt>Resultado</dt><dd>${esc(d.r)} <span class="nota">(leído del texto: manda el original)</span></dd>` : ''}
      ${conId.filter((p) => p.n).map((p) => `<dt>${esc(p.rol)}</dt><dd>${p.id ? `<a href="#/p/${esc(p.id)}">${esc(p.n)}</a>` : esc(p.n)}</dd>`).join('')}
    </dl>${ocultas ? `<p class="nota" style="margin-top:.6rem">${esc(ocultas)} ${ocultas === 1 ? 'parte es una persona natural y no se nombra' : 'partes son personas naturales y no se nombran'}.</p>` : ''}
    ${d.u ? `<p style="margin-top:.8rem"><a href="${esc(d.u)}" rel="noopener">El original</a></p>` : ''}</section>
    <section class="bloque"><h2>Normas que cita</h2>
      ${d.normas?.length ? `<ul class="historia">${d.normas.map((x) => `<li><span class="f"></span><span>${enlaceNorma(x)}${x.art ? ` <span class="nota">art. ${esc(x.art)}</span>` : ''}</span></li>`).join('')}</ul>` : '<p class="nota" style="margin-top:.6rem">No se leyó ninguna cita a una norma de la base.</p>'}
    </section>
  </div>`;
}

async function parte(id) {
  const idx = await json('indice-partes');
  const f = idx.find((x) => x[0] === id);
  if (!f) return noEsta('Esa parte no está en la demo.');
  const sh = await json(`partes/${f[3]}`);
  const p = sh[id];
  document.title = `${p.n} · alphalex`;
  const porOrg = {}; for (const d of p.decs) porOrg[d.o] = (porOrg[d.o] || 0) + 1;
  const porRol = {}; for (const d of p.decs) porRol[d.rol] = (porRol[d.rol] || 0) + 1;
  return `
  <p class="ruta"><a href="#/">alphalex</a> · Parte en decisiones</p>
  <h1 class="titulo" style="font-size:clamp(1.5rem,3.2vw,2.2rem)">${esc(p.n)}</h1>
  <p class="entrada">Aparece en <b>${esc(ent.format(p.total))}</b> ${p.total === 1 ? 'decisión' : 'decisiones'} de la base. Se une por el nombre, como lo escribe cada órgano: una variante distinta del nombre queda aparte.</p>
  <div class="dos">
    <section class="bloque"><h2>Por órgano</h2>${cuenta(Object.entries(porOrg).sort((a, b) => b[1] - a[1]).map(([k, v]) => [esc(k), v]))}</section>
    <section class="bloque"><h2>Con qué papel</h2>${cuenta(Object.entries(porRol).sort((a, b) => b[1] - a[1]).map(([k, v]) => [esc(k), v]))}</section>
  </div>
  <section class="bloque"><h2>Las decisiones</h2>
    ${libro(p.decs, [
      { t: 'Fecha', v: (d) => esc(fCorta(d.f)) },
      { t: 'Decisión', v: (d) => `<a href="#/d/${esc(d.id)}">${decTitulo(d)}</a><small>${esc(d.o)}</small>` },
      { t: 'Papel', ancho: 1, v: (d) => esc(d.rol) },
      { t: 'Resultado', ancho: 1, v: (d) => esc(d.r || '—') },
    ])}
    ${p.total > p.decs.length ? `<p class="nota" style="margin-top:.5rem">Van las ${esc(p.decs.length)} más recientes de ${esc(ent.format(p.total))}.</p>` : ''}
  </section>`;
}

// ── penas, tribunales, Gaceta ────────────────────────────────────────────────────────────────────────────────────────
async function penal() {
  const r = await resumen();
  document.title = 'Penas por delito · alphalex';
  return `
  <h1 class="titulo">Penas por delito</h1>
  <p class="entrada">Las penas de prisión de los fallos que publica el Ministerio Público en su Base de Fallos (sobre todo corrupción y blanqueo
    de capitales, publicados de julio de 2024 a octubre de 2025). Por cada figura: cuántos casos, la pena del caso del medio y la mitad central,
    y cuántos terminaron con acuerdo de pena. La pena se lee del texto: manda el original.</p>
  <section class="bloque"><h2>${esc(ent.format(r.penas.length))} figuras con 5 casos o más</h2>
    ${libro(r.penas, [
      { t: 'Delito', v: (x) => esc(x.delito) },
      { t: 'Casos', n: 1, v: (x) => esc(ent.format(x.n)) },
      { t: 'Mediana', n: 1, v: (x) => esc(meses(x.med)) },
      { t: 'Mitad central', n: 1, ancho: 1, v: (x) => (x.p25 !== null ? `${esc(meses(x.p25))} a ${esc(meses(x.p75))}` : '—') },
      { t: 'Con acuerdo de pena', n: 1, v: (x) => `${esc(x.acuerdo)} %` },
      { t: 'Condena', n: 1, ancho: 1, v: (x) => `${esc(x.condena)} %` },
    ])}
    <p class="nota" style="margin-top:.6rem">«a» son años y «m» meses. Un caso con varios delitos cuenta en cada uno.</p>
  </section>`;
}

async function tribunales() {
  const r = await resumen();
  document.title = 'Tribunales · alphalex';
  const anc = (o) => normal(o).toLowerCase().replace(/ +/g, '-');
  return `
  <h1 class="titulo">Cómo decide cada órgano</h1>
  <p class="entrada">${esc(ent.format(r.decisiones))} decisiones de ${esc(r.organos.length)} órganos. El resultado se lee del texto de cada una y su vocabulario cambia
    de un órgano a otro: no se suman entre órganos.</p>
  ${r.organos.map((o) => {
    const a = Object.keys(o.anios), max = Math.max(...Object.values(o.anios), 1);
    return `<section class="bloque" id="${esc(anc(o.o))}"><h2>${esc(o.o)}</h2>
      <p class="dicho"><b>${esc(ent.format(o.n))}</b> decisiones${a.length ? `, de ${esc(a[0])} a ${esc(a.at(-1))}` : ''}.</p>
      ${a.length > 1 ? `<div class="anios" role="img" aria-label="Decisiones por año">${a.map((k) => `<i style="height:${Math.max(2, (o.anios[k] / max) * 100).toFixed(0)}%" title="${k}: ${esc(ent.format(o.anios[k]))}"></i>`).join('')}</div><div class="anios-eje"><span>${esc(a[0])}</span><span>${esc(a.at(-1))}</span></div>` : ''}
      <div class="dos">
        <div><h3 style="font-size:.95rem;margin-top:1rem">Resultados</h3>${o.res.length ? cuenta(o.res.map((x) => [esc(x.k), x.n]), `${ent.format(o.n - o.res.reduce((s, x) => s + x.n, 0))} sin resultado leído o con otro.`) : '<p class="nota">Sin resultado leído.</p>'}</div>
        <div><h3 style="font-size:.95rem;margin-top:1rem">Áreas</h3>${o.areas.length ? cuenta(o.areas.map((x) => [esc(x.k), x.n])) : '<p class="nota">Sin área.</p>'}</div>
      </div>
      ${/Contrataciones/.test(o.o) && r.contraTACP.length ? `<h3 style="font-size:.95rem;margin-top:1rem">Las entidades con más recursos en su contra</h3>${cuenta(r.contraTACP.map((x) => [esc(x.n), x.k]))}` : ''}
    </section>`;
  }).join('')}`;
}

const RADAR = 'atk-alphalex-radar';
const palabras = () => { try { return JSON.parse(localStorage.getItem(RADAR) || '[]'); } catch { return []; } };
const guardarPalabras = (l) => { try { localStorage.setItem(RADAR, JSON.stringify(l.slice(0, 30))); } catch { /* sin almacenamiento */ } };
async function gaceta() {
  const g = await json('gaceta');
  document.title = 'Gaceta · alphalex';
  const ps = palabras().map(normal).filter(Boolean);
  const idx = await json('indice-normas');
  const tit = new Map(idx.map((x) => [x[0], x]));
  const marca = (t) => { let h = esc(t); for (const p of palabras()) if (p) h = h.replace(new RegExp(`(${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>'); return h; };
  const ediciones = g.filter((e) => e.normas.length);
  const conPalabra = (e) => ps.length && e.normas.some((n) => ps.some((p) => (tit.get(n.id)?.[6] || '').includes(p)));
  setTimeout(() => {
    $('#radar-f')?.addEventListener('submit', (ev) => { ev.preventDefault(); const v = $('#radar-p').value.trim(); if (v) { guardarPalabras([v, ...palabras().filter((x) => x !== v)]); pintar(); } });
    main.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', () => { guardarPalabras(palabras().filter((x) => x !== b.dataset.quitar)); pintar(); }));
  });
  return `
  <h1 class="titulo">Gaceta Oficial</h1>
  <p class="entrada">Las últimas ediciones con las normas que publicó cada una. Pon palabras en el radar y la página marca las ediciones y las normas
    que las traen; el radar se guarda en este navegador y no sale de él.</p>
  <section class="bloque"><h2>Tu radar</h2>
    <form class="radar" id="radar-f"><label for="radar-p" class="sr">Palabra para el radar</label><input id="radar-p" placeholder="«contratación», «CSS», «zona libre»…" /><button type="submit">Agregar</button></form>
    <div class="radar">${palabras().map((p) => `<span class="palabra">${esc(p)}<button type="button" data-quitar="${esc(p)}" aria-label="Quitar ${esc(p)}">×</button></span>`).join('') || '<span class="nota">Todavía no hay palabras.</span>'}</div>
  </section>
  <section class="bloque"><h2>Ediciones${ps.length ? `: ${esc(ediciones.filter(conPalabra).length)} traen una palabra del radar` : ''}</h2>
    <ul class="historia">${ediciones.slice(0, 120).map((e) => `<li${conPalabra(e) ? ' style="background:var(--vino-suave)"' : ''}><span class="f">${esc(fCorta(e.f))}</span><span>${e.u ? `<a href="${esc(e.u)}" rel="noopener">Gaceta n.º ${esc(e.num)}</a>` : `Gaceta n.º ${esc(e.num)}`} · ${esc(ent.format(e.n || e.normas.length))} normas
      <span class="art" style="display:block">${e.normas.slice(0, 8).map((n) => `<a href="#/n/${esc(n.id)}">${marca(n.n)}</a>${tit.get(n.id)?.[2] && !/^Acto individual/.test(tit.get(n.id)[2]) ? `: ${marca(tit.get(n.id)[2].slice(0, 90))}` : ''}`).join('<br>')}${e.normas.length > 8 ? `<br>y ${esc(e.normas.length - 8)} más` : ''}</span></span></li>`).join('')}</ul>
  </section>`;
}

function noEsta(t) {
  document.title = 'No está · alphalex';
  return `<h1 class="titulo">No está</h1><p class="entrada">${esc(t)}</p><p style="margin-top:1rem"><a href="#/">Volver a las normas</a></p>`;
}

const RUTAS = [
  [/^#?\/?$/, portada, '#/'],
  [/^#\/n\/(\d+)$/, norma, '#/'],
  [/^#\/n\/(\d+)\/a\/([\w°º.-]+)$/, articulo, '#/'],
  [/^#\/d\/(\d+)$/, decision, '#/tribunales'],
  [/^#\/p\/([a-z0-9-]+)$/, parte, '#/'],
  [/^#\/penal$/, penal, '#/penal'],
  [/^#\/tribunales(?:#.*)?$/, tribunales, '#/tribunales'],
  [/^#\/gaceta$/, gaceta, '#/gaceta'],
  [/^#\/sigo$/, siguiendo, '#/sigo'],
];
// Las normas que sigues: si una norma posterior la tocó desde que la seguiste, se dice.
async function siguiendo() {
  document.title = 'Siguiendo · alphalex';
  const l = seguidos('alphalex');
  if (!l.length) return `<h1 class="titulo">Siguiendo</h1><p class="entrada">Todavía no sigues ninguna norma. En su ficha, «Seguir» la deja aquí, y esta página te dice si una norma posterior la tocó después. La lista se guarda en este navegador.</p>`;
  const filas = await Promise.all(l.map(async (x) => { const sh = await json(`normas/${shardN(x.id)}`).catch(() => ({})); const n = sh[x.id]; return { ...x, ahora: n?.recibio?.length ?? x.cambios, estado: n?.estado || '' }; }));
  return `<h1 class="titulo">Siguiendo</h1><p class="entrada">${esc(ent.format(l.length))} ${l.length === 1 ? 'norma' : 'normas'}, guardadas en este navegador.</p>
  <section class="bloque">${libro(filas, [
    { t: 'Norma', v: (x) => `<a href="${esc(x.ruta)}">${esc(x.nombre)}</a><small>desde el ${esc(x.desde || '')}</small>` },
    { t: 'Estado', v: (x) => esc(x.estado || '—') },
    { t: 'Desde que la sigues', v: (x) => (x.ahora > (x.cambios || 0) ? `<b style="color:var(--vino)">${esc(x.ahora - x.cambios)} ${x.ahora - x.cambios === 1 ? 'cambio nuevo' : 'cambios nuevos'}</b>` : 'Sin cambios') },
  ])}</section>`;
}
let primera = true;
async function pintar() {
  const h = location.hash || '#/';
  const ruta = RUTAS.find(([re]) => re.test(h));
  cerrar();
  try {
    main.innerHTML = ruta ? await ruta[1](...h.match(ruta[0]).slice(1)) : noEsta('Esa dirección no existe en la demo.');
    conCsv(main, 'alphalex');
    activarSeguir(main, 'alphalex');
  } catch (e) {
    main.innerHTML = `<h1 class="titulo">No se pudo cargar</h1><p class="entrada">${esc(e.message)}. Revisa la conexión y vuelve a intentarlo.</p>`;
  }
  document.querySelectorAll('.indice-sitio a').forEach((a) => a.toggleAttribute('aria-current', !!ruta && a.getAttribute('href') === ruta[2]));
  if (!primera && !/\/a\//.test(h)) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  primera = false;
}

const caja = $('#resultados'), q = $('#q');
function cerrar() { caja.hidden = true; caja.innerHTML = ''; }
// «ley 22 de 2006» → busca por tipo, número y año; lo demás, por palabras del título.
async function buscar(texto) {
  const t = normal(texto);
  if (t.length < 2) return cerrar();
  const pal = t.split(' ').filter((w) => !['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'N', 'NO'].includes(w));
  const [N, P] = await Promise.all([json('indice-normas'), json('indice-partes')]);
  if (normal(q.value) !== t) return;
  const ln = N.filter((x) => pal.every((p) => x[6].includes(p))).slice(0, 8);
  const lp = P.filter((x) => pal.every((p) => x[4].includes(p))).slice(0, 6);
  caja.innerHTML = [
    ln.length ? `<h2>Normas</h2>${ln.map((x) => `<a href="#/n/${esc(x[0])}"><span>${esc(x[1])}<small style="display:block">${esc(x[2].slice(0, 110))}</small></span><span class="c">${x[3] ? `${esc(ent.format(x[3]))} citas` : ''}</span></a>`).join('')}` : '',
    lp.length ? `<h2>Empresas e instituciones en decisiones</h2>${lp.map((x) => `<a href="#/p/${esc(x[0])}"><span>${esc(x[1])}</span><span class="c">${esc(ent.format(x[2]))} ${x[2] === 1 ? 'decisión' : 'decisiones'}</span></a>`).join('')}` : '',
  ].join('') || `<p>Nada con «${esc(texto)}». Prueba con el número y el año («ley 22 de 2006») o con una palabra del título.</p>`;
  caja.hidden = false;
}
let espera;
q.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => buscar(q.value).catch(() => { caja.innerHTML = '<p>No se pudo leer el índice.</p>'; caja.hidden = false; }), 140); });
q.addEventListener('keydown', (ev) => {
  const enl = [...caja.querySelectorAll('a')];
  if (!enl.length || !['ArrowDown', 'ArrowUp'].includes(ev.key)) return;
  ev.preventDefault();
  const i = enl.findIndex((a) => a.classList.contains('activo'));
  const j = ev.key === 'ArrowDown' ? Math.min(enl.length - 1, i + 1) : Math.max(0, i - 1);
  enl.forEach((a, k) => a.classList.toggle('activo', k === j));
});
$('#buscar').addEventListener('submit', (ev) => { ev.preventDefault(); const a = caja.querySelector('a.activo') || caja.querySelector('a'); if (a) { location.hash = a.getAttribute('href'); q.value = ''; q.blur(); } });
caja.addEventListener('click', (ev) => { if (ev.target.closest('a')) q.value = ''; });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrar(); });
document.addEventListener('click', (ev) => { if (!ev.target.closest('.buscador')) cerrar(); });

document.body.dataset.cerrado = '';
abrir().then(() => {
  delete document.body.dataset.cerrado;
  window.addEventListener('hashchange', pintar);
  pintar();
});
