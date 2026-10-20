// alphadata (demo privada de alphateklab, 19-oct-2026): el expediente de debida diligencia de una sociedad. Los datos los
// arma ~/proyectos/cuire/alphadata/demo/armar-demo.mjs desde alphadata.db, SOLO de sociedades e instituciones, y
// llegan cifrados (../demo-acceso). Forma de la ficha: primero las señales, después la evidencia sección por sección,
// con un índice al lado que dice cuánto hay en cada una. Ningún puntaje: cuentas, fechas y la fuente de cada cosa.
import { abrirDatos } from '../demo-acceso/acceso.js';
import { conCsv, botonSeguir, activarSeguir, seguidos } from '../demo-acceso/utiles.js';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#contenido');
let lector = null;
const abrir = () => (lector ||= abrirDatos({ donde: main, nombre: 'alphadata' }));
const memo = new Map();
const json = (ruta) => {
  if (!memo.has(ruta)) memo.set(ruta, abrir().then((leer) => leer(ruta)).catch((e) => { memo.delete(ruta); throw e; }));
  return memo.get(ruta);
};

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ent = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 0 });
const uno = new Intl.NumberFormat('es-PA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const redondo = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? ent.format(Math.round(x)) : uno.format(x));
const dinero = (n) => {
  const v = Number(n) || 0, a = Math.abs(v);
  if (a >= 1e9) return `B/. ${redondo(v / 1e9)} mil millones`;
  if (a >= 1e6) return `B/. ${redondo(v / 1e6)} millones`;
  return `B/. ${ent.format(v)}`;
};
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fecha = (f) => (f && /^\d{4}-\d{2}-\d{2}/.test(f) ? `${Number(f.slice(8, 10))} ${MES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}` : f || '');
const periodo = (d, h) => (!d ? '' : d.slice(0, 7) === (h || '').slice(0, 7) ? fecha(d) : `${fecha(d)} a ${fecha(h)}`);
const veces = (n) => `${ent.format(n)} ${n === 1 ? 'vez' : 'veces'}`;
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .replace(/[.,"'`´()/\\-]/g, ' ').replace(/[^A-Z0-9Ñ&+ ]/g, ' ').replace(/\s+/g, ' ').trim();
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

let R = null;
const resumen = async () => (R ||= await json('resumen'));

function libro(filas, cols, vacio = 'Sin datos.') {
  if (!filas?.length) return `<p class="nota" style="margin-top:.8rem">${esc(vacio)}</p>`;
  return `<div class="libro-env"><table class="libro"><thead><tr>${cols.map((c) => `<th scope="col" class="${[c.n && 'n', c.ancho && 'solo-ancho'].filter(Boolean).join(' ')}">${esc(c.t)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f, i) => `<tr>${cols.map((c) => `<td class="${[c.n && 'n', c.ancho && 'solo-ancho'].filter(Boolean).join(' ')}">${c.v(f, i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// ── portada ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function portada() {
  const r = await resumen();
  document.title = 'alphadata · lo que dicen de una empresa las fuentes públicas';
  const fuentes = new Set(r.tipos.map((t) => t.nombre)).size;
  const secc = Object.fromEntries(r.secciones.map((s) => [s.k, s.nombre]));
  const porSec = r.secciones.map((s) => ({ ...s, tipos: r.tipos.filter((t) => t.sec === s.k).sort((a, b) => b.ents - a.ents) })).filter((s) => s.tipos.length);
  return `
  <h1 class="titulo">Lo que dicen de una empresa las fuentes públicas</h1>
  <p class="entrada">${esc(ent.format(r.sociedades))} sociedades de Panamá, cada una con lo que dicen de ella ${esc(ent.format(fuentes))} tipos de
    registro público: contratos y pagos del Estado, Aduanas, morosidad con la CSS y la DGI, sanciones de superintendencias,
    listas internacionales, ACODECO, el MITRADEL, la Procuraduría, la Bolsa, marcas, la Gaceta y los Panama Papers.
    Busca una por su nombre o su RUC, o <a href="#/lote">coteja una lista entera</a>.</p>

  <section class="bloque" aria-labelledby="t-senales">
    <h2 id="t-senales">Señales entre los proveedores del Estado</h2>
    <p class="dicho">De las <b>${esc(ent.format(r.conEstado))}</b> sociedades de la demo que le han vendido al Estado, estas tienen alguna señal en
      las fuentes. Una señal no prueba nada sola: es lo que hay que leer antes de decidir.</p>
    ${libro(r.senalesEstado, [
      { t: 'Señal', v: (s) => `<a class="s" href="#/senal/${esc(slugTipo(s.tipo))}">${esc(s.nombre)}</a>` },
      { t: 'Proveedores', n: 1, v: (s) => esc(ent.format(s.n)) },
      { t: 'Los de más monto con el Estado', ancho: 1, v: (s) => s.top.slice(0, 3).map((x) => `<a href="#/s/${esc(x.id)}">${esc(x.nombre)}</a>`).join(', ') },
    ])}
  </section>

  <div class="dos">
    <section class="bloque" aria-labelledby="t-grandes">
      <h2 id="t-grandes">Las que más le han vendido al Estado</h2>
      ${libro(r.grandes, [
        { t: 'Sociedad', v: (x) => `<a href="#/s/${esc(x.id)}">${esc(x.nombre)}</a>${x.senales ? `<small class="s">${esc(x.senales)} ${x.senales === 1 ? 'señal' : 'señales'}</small>` : ''}` },
        { t: 'Con el Estado', n: 1, v: (x) => esc(dinero(x.monto)) },
      ])}
    </section>
    <section class="bloque" aria-labelledby="t-que">
      <h2 id="t-que">Qué se revisa de cada una</h2>
      <p class="nota" style="margin-top:.3rem">Cuántas sociedades de la demo aparecen en cada registro.</p>
      ${porSec.map((s) => `<h3 style="font-size:.95rem;margin-top:1rem">${esc(secc[s.k])}</h3>${libro(s.tipos, [
        { t: 'Registro', v: (t) => (t.senal ? `<span class="s">${esc(t.nombre)}</span>` : esc(t.nombre)) },
        { t: 'Sociedades', n: 1, v: (t) => esc(ent.format(t.ents)) },
      ])}`).join('')}
    </section>
  </div>`;
}

// ── la ficha ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function itemsDe(t) {
  return `<ul class="items">${t.items.map((it) => `<li>
    <span class="f">${esc(fecha(it.fecha))}</span>
    <span>${esc(it.t)}${it.cp?.id ? ` · <a href="#/s/${esc(it.cp.id)}">${esc(it.cp.n)}</a>` : ''}</span>
    <span class="m">${it.monto ? esc(dinero(it.monto)) : ''}</span>
    ${it.d ? `<span class="d">${esc(it.d)}</span>` : ''}
    <span class="o">${esc(it.f || '')}${it.u ? ` · <a href="${esc(it.u)}" rel="noopener">original en ${esc(host(it.u))}</a>` : ''}</span>
  </li>`).join('')}</ul>${t.n > t.items.length ? `<p class="nota">Y ${esc(ent.format(t.n - t.items.length))} más; aquí van las últimas ${esc(t.items.length)}.</p>` : ''}`;
}
function serie(porAnio) {
  if (!porAnio) return '';
  const a = Object.keys(porAnio).sort(), max = Math.max(...a.map((k) => porAnio[k]), 1);
  return `<div class="serie" role="img" aria-label="Monto por año: ${a.map((k) => `${k}, ${dinero(porAnio[k])}`).join('; ')}">${a.map((k) => `<i style="height:${Math.max(2, (porAnio[k] / max) * 100).toFixed(0)}%" title="${k}: ${esc(dinero(porAnio[k]))}"><span>${k.slice(2)}</span></i>`).join('')}</div>`;
}
function tipoHtml(t) {
  const cuanto = [t.n > 1 || !t.monto ? veces(t.n) : '', t.monto ? dinero(t.monto) : ''].filter(Boolean).join(' · ');
  return `<details class="tipo"><summary><b>${esc(t.nombre)}</b><span class="cuanto">${esc(cuanto)}</span><span class="cuando">${esc(periodo(t.desde, t.hasta))}</span></summary>
    <div class="cuerpo">
      ${t.contrapartes?.length ? `<p class="contrapartes">${t.monto ? 'Con quién, por monto' : 'Con quién'}: ${t.contrapartes.map((c) => `${esc(c.n)} (${c.monto ? esc(dinero(c.monto)) : esc(veces(c.veces))})`).join(', ')}.</p>` : ''}
      ${serie(t.porAnio)}
      ${itemsDe(t)}
    </div></details>`;
}

async function sociedad(id) {
  const idx = await json('indice');
  const fila = idx.find((x) => x[0] === id);
  if (!fila) return noEsta('Esa sociedad no está en la demo.');
  const [r, sh] = await Promise.all([resumen(), json(`fichas/${fila[3]}`)]);
  const f = sh[id];
  if (!f) return noEsta('Esa sociedad no está en la demo.');
  document.title = `${f.nombre} · alphadata`;
  const nombreSec = Object.fromEntries(r.secciones.map((s) => [s.k, s.nombre]));
  const senales = f.secciones.senales || [];
  const resto = r.secciones.filter((s) => s.k !== 'senales');
  const cuenta = (k) => (f.secciones[k] || []).reduce((s, t) => s + t.n, 0);
  const listasRevisadas = r.tipos.filter((t) => t.senal).map((t) => t.nombre.toLowerCase());
  return `
  <p class="ruta"><a href="#/">alphadata</a> · Sociedad</p>
  <h1 class="titulo">${esc(f.nombre)}</h1>
  <p class="acciones-ficha">${botonSeguir('alphadata', { id, nombre: f.nombre, ruta: `#/s/${id}` })} <button type="button" class="seguir" onclick="document.querySelectorAll('details').forEach((d) => d.open = true); window.print()">Imprimir el expediente</button></p>
  <p class="datos">${f.ruc ? `<span>RUC <b>${esc(f.ruc)}</b></span>` : ''}<span>Aparece en <b>${esc(ent.format(f.fuentes.length))}</b> ${f.fuentes.length === 1 ? 'fuente' : 'fuentes'}</span>${f.montoEstado ? `<span>Con el Estado <b>${esc(dinero(f.montoEstado))}</b></span>` : ''}</p>
  <div class="expediente">
    <nav class="indice" aria-label="Secciones del expediente"><ol>
      <li><a href="#senales" class="${senales.length ? 'hay-senal' : ''}">Señales <span>${esc(ent.format(senales.length))}</span></a></li>
      ${resto.map((s) => `<li><a href="#${s.k}" class="${cuenta(s.k) ? '' : 'vacia'}">${esc(s.nombre)} <span>${cuenta(s.k) ? esc(ent.format(cuenta(s.k))) : '—'}</span></a></li>`).join('')}
    </ol></nav>
    <div>
      <section class="seccion" id="senales" aria-labelledby="t-s">
        <h2 id="t-s">Señales</h2>
        ${senales.length ? `<ul class="senales">${senales.map((t) => {
          const u = t.items[0];
          return `<li><span><b>${esc(t.nombre)}</b>${t.n > 1 ? ` · ${esc(veces(t.n))}` : ''}</span><span class="cuando">${esc(periodo(t.desde, t.hasta))}</span>
            <span class="detalle">${esc(u?.t || '')}${u?.d ? `. ${esc(u.d)}` : ''}${u?.u ? ` · <a href="${esc(u.u)}" rel="noopener">original</a>` : ''}${u?.f ? ` <span class="nota">(${esc(u.f)})</span>` : ''}</span></li>`;
        }).join('')}</ul>${senales.some((t) => t.n > 1) ? `<p class="detalle-titulo">Cada vez, con su fuente</p>${senales.filter((t) => t.n > 1).map(tipoHtml).join('')}` : ''}`
        : `<p class="limpio"><b>Sin señales en lo revisado.</b> Se revisan: ${esc(listasRevisadas.join(', '))}.</p>`}
      </section>
      ${resto.map((s) => {
        const tipos = f.secciones[s.k] || [];
        return `<section class="seccion" id="${s.k}" aria-labelledby="t-${s.k}"><h2 id="t-${s.k}">${esc(nombreSec[s.k])}</h2>
          ${tipos.length ? tipos.map(tipoHtml).join('') : '<p class="nota">Nada en las fuentes revisadas.</p>'}</section>`;
      }).join('')}
      <p class="nota">Fuentes de esta ficha: ${esc(f.fuentes.join(', '))}.</p>
    </div>
  </div>`;
}

function noEsta(t) {
  document.title = 'No está · alphadata';
  return `<h1 class="titulo">No está</h1><p class="entrada">${esc(t)}</p><p style="margin-top:1rem"><a href="#/">Volver al inicio</a></p>`;
}

const slugTipo = (t) => normal(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── una señal: todas las sociedades de la demo que la tienen ─────────────────────────────────────────────────────────
async function senal(sl) {
  const todas = await json('senales');
  const [tipo, x] = Object.entries(todas).find(([t]) => slugTipo(t) === sl) || [];
  if (!x) return noEsta('Esa señal no está en la demo.');
  document.title = `${x.nombre} · alphadata`;
  const conEstado = x.lista.filter((f) => f[2] > 0).length;
  return `<p class="ruta"><a href="#/">alphadata</a> · Señal</p>
  <h1 class="titulo">${esc(x.nombre)}</h1>
  <p class="entrada"><b>${esc(ent.format(x.lista.length))}</b> sociedades de la demo, <b>${esc(ent.format(conEstado))}</b> de ellas proveedoras del Estado. Ordenadas por lo que le han vendido al Estado.</p>
  <section class="bloque">${libro(x.lista, [
    { t: 'Sociedad', v: (f) => `<a href="#/s/${esc(f[0])}">${esc(f[1])}</a>` },
    { t: 'Lo último', ancho: 1, v: (f) => esc(fecha(f[3]) || '—') },
    { t: 'Con el Estado', n: 1, v: (f) => (f[2] ? esc(dinero(f[2])) : '—') },
  ])}</section>`;
}

// ── cotejo en lote: una lista de nombres o RUC contra la demo ────────────────────────────────────────────────────────
let ultimoLote = '';
async function lote() {
  document.title = 'Cotejo en lote · alphadata';
  setTimeout(() => {
    const f = $('#lote-f'); if (!f) return;
    f.addEventListener('submit', async (ev) => { ev.preventDefault(); ultimoLote = $('#lote-t').value; $('#lote-r').innerHTML = await cotejar(ultimoLote); conCsv(main, 'cotejo'); });
    if (ultimoLote) f.requestSubmit();
  });
  return `<p class="ruta"><a href="#/">alphadata</a> · Cotejo en lote</p>
  <h1 class="titulo">Cotejar una lista</h1>
  <p class="entrada">Pega una sociedad por línea, con su nombre o su RUC: proveedores, clientes, una lista de oferentes. Por cada una, si está en la demo
    y qué señales tiene. Lo pegado no sale de este navegador.</p>
  <form id="lote-f" style="margin-top:1rem;display:grid;gap:.6rem;max-width:44rem">
    <label for="lote-t" class="sr">Lista de sociedades</label>
    <textarea id="lote-t" rows="8" style="font:inherit;padding:.7rem;border:1px solid var(--campo);border-radius:4px;background:var(--superficie);color:var(--tinta)" placeholder="EMPRESAS MELO, S.A.\n490-599-105160\nREPRICO">${esc(ultimoLote)}</textarea>
    <button type="submit" class="seguir" style="justify-self:start">Cotejar</button>
  </form>
  <div id="lote-r"></div>`;
}
async function cotejar(texto) {
  const idx = await json('indice');
  const porRuc = new Map(idx.filter((x) => x[2]).map((x) => [x[2].replace(/\s+/g, ''), x]));
  const lineas = texto.split(/\n+/).map((x) => x.trim()).filter(Boolean).slice(0, 500);
  const filas = lineas.map((l) => {
    const ruc = l.replace(/\s+/g, '').replace(/D\.?V\.?\d+$/i, '');
    let x = porRuc.get(ruc);
    // Por nombre: el exacto, o el comienzo solo si son dos palabras o más y hay UNA sola coincidencia («CONSTRUCTORA» o
    // «GRUPO» casaban con la primera sociedad que empezara así; revisión del 19-oct).
    if (!x) {
      const t = normal(l).replace(/ S ?A$| INC$| CORP$| S DE R ?L$/, '');
      x = idx.find((y) => y[6] === normal(l) || y[6] === t);
      if (!x && t.split(' ').length >= 2) { const c = idx.filter((y) => y[6].startsWith(t)); if (c.length === 1) x = c[0]; }
    }
    return { l, x };
  });
  const enc = filas.filter((f) => f.x).length, conS = filas.filter((f) => f.x?.[5] > 0).length;
  return `<section class="bloque"><h2>Resultado</h2>
    <p class="dicho"><b>${esc(ent.format(enc))}</b> de ${esc(ent.format(filas.length))} encontradas en la demo; <b>${esc(ent.format(conS))}</b> con alguna señal.</p>
    ${libro(filas, [
      { t: 'Lo pegado', v: (f) => esc(f.l) },
      { t: 'En la demo', v: (f) => (f.x ? `<a href="#/s/${esc(f.x[0])}">${esc(f.x[1])}</a>` : '<span class="nota">No está</span>') },
      { t: 'Señales', n: 1, v: (f) => (f.x ? (f.x[5] ? `<span class="s">${esc(f.x[5])}</span>` : '0') : '—') },
      { t: 'Con el Estado', n: 1, ancho: 1, v: (f) => (f.x?.[4] ? esc(dinero(f.x[4])) : '—') },
    ])}
    <p class="nota" style="margin-top:.6rem">Se busca por RUC exacto, y si no, por el nombre. «No está» quiere decir que no está entre las ${esc(ent.format(idx.length))} sociedades de la demo, no que no exista.</p></section>`;
}
async function siguiendo() {
  document.title = 'Siguiendo · alphadata';
  const l = seguidos('alphadata');
  if (!l.length) return `<h1 class="titulo">Siguiendo</h1><p class="entrada">Todavía no sigues ninguna sociedad. En su expediente, «Seguir» la deja aquí; la lista se guarda en este navegador.</p>`;
  const idx = await json('indice');
  const por = new Map(idx.map((x) => [x[0], x]));
  return `<h1 class="titulo">Siguiendo</h1><section class="bloque">${libro(l, [
    { t: 'Sociedad', v: (x) => `<a href="${esc(x.ruta)}">${esc(x.nombre)}</a><small>desde el ${esc(x.desde || '')}</small>` },
    { t: 'Señales', n: 1, v: (x) => (por.get(x.id)?.[5] ? `<span class="s">${esc(por.get(x.id)[5])}</span>` : '0') },
    { t: 'Con el Estado', n: 1, v: (x) => esc(dinero(por.get(x.id)?.[4] || 0)) },
  ])}</section>`;
}

const RUTAS = [[/^#?\/?$/, portada], [/^#\/s\/([a-z0-9-]+)$/, sociedad], [/^#\/senal\/([a-z0-9-]+)$/, senal], [/^#\/lote$/, lote], [/^#\/sigo$/, siguiendo]];
let primera = true;
async function pintar() {
  const h = location.hash || '#/';
  if (/^#[a-z]+$/.test(h)) return; // el índice del expediente: anclas dentro de la página
  const ruta = RUTAS.find(([re]) => re.test(h));
  cerrar();
  try {
    main.innerHTML = ruta ? await ruta[1](...h.match(ruta[0]).slice(1)) : noEsta('Esa dirección no existe en la demo.');
    conCsv(main, 'alphadata');
    activarSeguir(main, 'alphadata');
  } catch (e) {
    main.innerHTML = `<h1 class="titulo">No se pudo cargar</h1><p class="entrada">${esc(e.message)}. Revisa la conexión y vuelve a intentarlo.</p>`;
  }
  if (!primera) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  primera = false;
}
// Las anclas del índice no cambian de página: se baja a la sección.
main.addEventListener('click', (ev) => {
  const a = ev.target.closest('.indice a'); if (!a) return;
  ev.preventDefault();
  document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});

const caja = $('#resultados'), q = $('#q');
function cerrar() { caja.hidden = true; caja.innerHTML = ''; }
async function buscar(texto) {
  const t = normal(texto);
  if (t.length < 2) return cerrar();
  const pal = t.split(' ');
  const idx = await json('indice');
  if (normal(q.value) !== t) return;
  const l = idx.filter((x) => pal.every((p) => x[6].includes(p)));
  caja.innerHTML = l.length ? `${l.slice(0, 12).map((x) => `<a href="#/s/${esc(x[0])}"><span>${esc(x[1])}${x[5] ? ` <span class="s">· ${esc(x[5])} ${x[5] === 1 ? 'señal' : 'señales'}</span>` : ''}</span><small>${x[4] ? esc(dinero(x[4])) : esc(x[2])}</small></a>`).join('')}${l.length > 12 ? `<p class="nota">Y ${esc(ent.format(l.length - 12))} más: escribe más del nombre.</p>` : ''}`
    : `<p>Ninguna sociedad de la demo con «${esc(texto)}». La demo tiene ${esc(ent.format(idx.length))}: las que más aparecen en las fuentes.</p>`;
  caja.hidden = false;
}
let espera;
q.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => buscar(q.value).catch(() => { caja.innerHTML = '<p>No se pudo leer el índice.</p>'; caja.hidden = false; }), 120); });
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
