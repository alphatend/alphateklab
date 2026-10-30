// El tablero (la pantalla principal): un kanban de hallazgos (Abierto → En proceso → Para el paro → Cerrado), que se
// mueven arrastrando la tarjeta, y uno de inspecciones (Atrasadas, Hoy, Próximas, Por revisar).
//
// Arrastrar: con el mouse, al mover más de 6 px; en el teléfono, dejando el dedo quieto un momento (así deslizar sigue
// siendo deslizar). Lo que se mueve es una copia fija que solo cambia de transform en cada cuadro; cerca del borde,
// el tablero y la página se deslizan solos. El cambio entra a la cola (funciona sin señal) y se puede deshacer.
import { esc, icono, fechaDia, fechaCorta, fechaHora, plural, numeroHallazgo, diasEntre, haceCuanto, normal } from "./util.mjs";
import { barraFiltros, montarFiltros, familia, enFiltro, nombreCompleto } from "./componentes.mjs";
import { esMia, puedeTocar, paraQuien, montarChecks, TEXTO_ESTADO_TAREA } from "./vistas-tareas.mjs";
import { entregaPorRecibir } from "./vistas-turno.mjs";
import { enCurso, montarEnCurso, proximosProgramados } from "./vistas-paros.mjs";
import { alertasTendencia } from "./vistas-indicadores.mjs";
import * as api from "./api.mjs";
import {
  puede, aviso, dialogo, elegir, equipo, equiposDe, plantilla, persona, nombreCorto, nombreEquipo, queInspeccion, esAdmin, avatar,
  marcaPrioridad, marcaVence, marcaSinEnviar, TEXTO_ESTADO, ESTADOS, ICONO_ESTADO, PUNTO_ESTADO,
} from "./ui.mjs";

const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 };
// dónde quedó cada tablero (se redibuja cuando llegan datos: que no vuelva a la primera columna)
const scrolls = {};

function frase(d, yo, hoy, admin) {
  const turno = yo.turno ? `turno:${yo.turno}` : "-";
  const pend = d.inspecciones.filter((i) => i.estado === "pendiente" && (admin || i.asignada_a === yo.id || i.asignada_a === turno));
  const atrasadas = pend.filter((i) => i.vence < hoy).length;
  const deHoy = pend.filter((i) => i.vence === hoy).length;
  const hall = d.hallazgos.filter((h) => h.estado !== "cerrado" && (admin || h.responsable_id === yo.id));
  const altas = hall.filter((h) => h.prioridad === "alta").length;
  const porRevisar = admin && puede(yo, "revisar") ? d.inspecciones.filter((i) => i.estado === "hecha" && !i.revisada_en).length : 0;
  // las tareas de uno (o de su turno): las atrasadas y las de hoy también cuentan como pendiente
  const misTareas = (d.tareas ?? []).filter((t) => t.estado !== "hecha" && t.vence && t.vence <= hoy && esMia(t, yo));
  const tAtr = misTareas.filter((t) => t.vence < hoy).length, tHoy = misTareas.length - tAtr;
  const partes = [];
  if (atrasadas) partes.push(`<a href="#/tablero?v=inspecciones"><b>${plural(atrasadas, "inspección atrasada", "inspecciones atrasadas")}</b></a>`);
  if (deHoy) partes.push(`<b>${plural(deHoy, atrasadas ? "para hoy" : "inspección para hoy", atrasadas ? "para hoy" : "inspecciones para hoy")}</b>`);
  if (hall.length) partes.push(`<a href="#/tablero?v=hallazgos"><b>${plural(hall.length, "hallazgo abierto", "hallazgos abiertos")}</b></a>${altas ? ` (${altas} de prioridad alta)` : ""}`);
  if (tAtr) partes.push(`<a href="#/tareas"><b>${plural(tAtr, "tarea atrasada", "tareas atrasadas")}</b></a>`);
  if (tHoy) partes.push(`<b>${plural(tHoy, "tarea para hoy", "tareas para hoy")}</b>`);
  if (porRevisar) partes.push(`<a href="#/tablero?v=inspecciones"><b>${plural(porRevisar, "inspección por revisar", "inspecciones por revisar")}</b></a>`);
  const juntar = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : xs[0]);
  if (!partes.length) return admin ? "Nada atrasado, nada para hoy y ningún hallazgo abierto." : "No tienes nada pendiente para hoy ni hallazgos a tu cargo.";
  return `${admin ? "En la planta hay" : "Tienes"} ${juntar(partes)}.`;
}

export function vistaTablero(ctx) {
  const { d, yo, hoy, query } = ctx;
  // quien asigna, o quien solo ve (no tiene nada «suyo»), mira la planta entera
  const general = puede(yo, "asignar") || !puede(yo, "editar");
  const v = ["hallazgos", "inspecciones", "tareas"].includes(query.get("v")) ? query.get("v") : api.LS.leer("bp-tablero") ?? (general ? "hallazgos" : "inspecciones");
  const quien = query.get("q") ?? (general ? "todos" : "mios");
  api.LS.poner("bp-tablero", v);
  const filtro = { fam: familia(d, query.get("eq")), b: normal(query.get("b") ?? "") };
  const cols = (v === "hallazgos" ? columnasHallazgos : v === "tareas" ? columnasTareas : columnasInspecciones)(ctx, quien, filtro);
  const enlace = (cambios) => `#/tablero?${new URLSearchParams({ ...Object.fromEntries(query), v, q: quien, ...cambios })}`;
  const arrastrable = v !== "inspecciones" && puede(yo, "editar");
  const tablero = () => `<div data-kanban${arrastrable || v === "inspecciones" ? "" : ' class="solo-ver"'}><div class="columnas-salto" role="group" aria-label="Ir a la columna">${cols.map((c, k) => `<button type="button" data-ir-col="${k}" ${k === 0 ? 'aria-current="true"' : ""}>
        <i class="punto ${c.punto}"></i>${esc(c.titulo)} <b>${c.tarjetas.length}</b></button>`).join("")}</div>
      <div class="tablero" data-tablero="${v}">${cols.map((c) => `<section class="columna" data-estado="${c.id}" aria-label="${esc(c.titulo)}">
          <header><i class="punto ${c.punto}"></i><h3>${esc(c.titulo)}</h3><span class="cuenta">${c.cuenta ?? c.tarjetas.length}</span></header>
          <div class="tarjetas">${c.tarjetas.length ? c.tarjetas.join("") : `<div class="nada">${c.nada}</div>`}</div>
          ${c.pie ?? ""}
        </section>`).join("")}</div>
      ${arrastrable ? `<p class="no-imprimir ayuda" style="margin:2px 4px">${matchMedia("(pointer: coarse)").matches ? "Deja el dedo sobre una tarjeta para moverla de columna" : "Arrastra una tarjeta para cambiarla de columna"}, o toca ${icono("arrastrar", "ico chico")}.</p>` : ""}</div>`;
  return {
    titulo: "Tablero",
    tituloCorto: d.ajustes?.app_nombre || "Tablero",
    html: `<div class="cabeza"><div>
        <div class="fecha-hoy">${esc(fechaDia(hoy))}</div>
        <h1>${esc(yo.turno && !general ? `Turno ${yo.turno}` : `Hola, ${yo.nombre.split(" ")[0]}`)}</h1>
        <p class="resumen-dia">${frase(d, yo, hoy, general)}</p>
      </div></div>
      ${tiras(d, yo, hoy, general)}
      <div class="tablero-barra">
        <div class="segmento vista" role="group" aria-label="Qué tablero">
          <a href="${enlace({ v: "hallazgos" })}" ${v === "hallazgos" ? 'aria-current="true"' : ""}>${icono("hallazgos")}Hallazgos</a>
          <a href="${enlace({ v: "inspecciones" })}" ${v === "inspecciones" ? 'aria-current="true"' : ""}>${icono("inspecciones")}Inspecciones</a>
          <a href="${enlace({ v: "tareas" })}" ${v === "tareas" ? 'aria-current="true"' : ""}>${icono("tareas")}Tareas</a>
        </div>
        <nav class="filtros" style="margin:0" aria-label="De quién">
          <a href="${enlace({ q: "mios" })}" ${quien === "mios" ? 'aria-current="true"' : ""}>${v === "hallazgos" ? "A mi cargo" : "Mías"}</a>
          <a href="${enlace({ q: "todos" })}" ${quien === "todos" ? 'aria-current="true"' : ""}>${v === "hallazgos" ? "Todos" : "Todas"}</a>
        </nav>
      </div>
      ${barraFiltros(d, query, { placeholder: v === "tareas" ? "Buscar tareas" : v === "hallazgos" ? "Buscar hallazgos" : "Buscar inspecciones" })}
      ${tablero()}`,
    montar(m) {
      const desmontes = [montarEnCurso(m)];
      const conectar = () => {
        const tab = m.querySelector(".tablero");
        if (scrolls[v] == null) {
          // la primera vez, en la primera columna que tiene algo (en el teléfono no abrir en «Atrasadas 0»)
          const cols = [...tab.querySelectorAll(".columna")];
          const k = cols.findIndex((c) => c.querySelector(".tarjeta"));
          scrolls[v] = k > 0 ? cols[k].offsetLeft - cols[0].offsetLeft : 0;
        }
        tab.scrollLeft = scrolls[v];
        const saltos = [...m.querySelectorAll("[data-ir-col]")];
        let cuadro = 0;
        const marcarColumna = () => {
          cuadro = 0;
          scrolls[v] = tab.scrollLeft;
          const ancho = tab.querySelector(".columna")?.getBoundingClientRect().width ?? 1;
          const k = Math.round(tab.scrollLeft / (ancho + 14));
          saltos.forEach((b, i) => (i === k ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current")));
        };
        tab.addEventListener("scroll", () => { cuadro ||= requestAnimationFrame(marcarColumna); }, { passive: true });
        marcarColumna();
      };
      conectar();
      m.addEventListener("click", (e) => {
        const salto = e.target.closest("[data-ir-col]");
        if (!salto) return;
        const tab = m.querySelector(".tablero");
        const col = tab.children[Number(salto.dataset.irCol)];
        // las columnas comparten el mismo offsetParent: la diferencia es su lugar dentro del tablero
        tab.scrollTo({ left: col.offsetLeft - tab.firstElementChild.offsetLeft, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      });
      // al filtrar se cambia solo el tablero (la búsqueda conserva el foco)
      montarFiltros(m, d, { ruta: "tablero", alCambiar: (q) => {
        const nv = vistaTablero({ ...ctx, d: api.obtener(), query: q });
        const tmp = document.createElement("div");
        tmp.innerHTML = nv.html;
        m.querySelector("[data-kanban]").replaceWith(tmp.querySelector("[data-kanban]"));
        conectar();
      } });
      if (v === "inspecciones") montarInspecciones(m, ctx);
      else desmontes.push(montarKanban(m, ctx, { ...KANBAN[v], fijo: !puede(yo, "editar") }));
      montarChecks(m, d);
      return () => desmontes.forEach((f) => f?.());
    },
    ocupada: () => !!arrastre,
  };
}

/** Lo urgente, arriba: entrega por recibir, equipos parados, compromisos vencidos, tareas atrasadas, alertas. */
function tiras(d, yo, hoy, admin) {
  const xs = [];
  const ent = entregaPorRecibir(d, yo);
  if (ent) xs.push(`<a class="tira azul" href="#/entrega/${encodeURIComponent(ent.id)}"><span class="icono-tira">${icono("turno", "ico", { lleno: true })}</span>
    <span><b>El turno ${esc(ent.turno)} te entregó</b><small>${esc((ent.novedades || ent.pendientes || "").slice(0, 90))}</small></span>${icono("derecha", "ico chevron")}</a>`);
  for (const p of enCurso(d).slice(0, 2)) {
    xs.push(`<a class="tira roja" href="#/paro/${encodeURIComponent(p.id)}"><span class="icono-tira">${icono("paros", "ico", { lleno: true })}</span>
      <span><b>${esc(nombreCompleto(d, p.equipo_id))} parado</b><small>desde ${esc(fechaHora(p.inicio))}${p.causa ? ` · ${esc(p.causa)}` : ""}</small></span>${icono("derecha", "ico chevron")}</a>`);
  }
  const vencidos = d.hallazgos.filter((h) => h.estado !== "cerrado" && h.vence && h.vence < hoy && (admin || h.responsable_id === yo.id));
  if (vencidos.length) xs.push(`<a class="tira naranja" href="#/hallazgos?f=abiertos"><span class="icono-tira">${icono("reloj")}</span>
    <span><b>${plural(vencidos.length, "compromiso vencido", "compromisos vencidos")}</b><small>${esc(vencidos.slice(0, 2).map((h) => `${numeroHallazgo(h)} ${h.descripcion}`).join(" · "))}</small></span>${icono("derecha", "ico chevron")}</a>`);
  const tareasAtr = (d.tareas ?? []).filter((t) => t.estado !== "hecha" && t.vence && t.vence < hoy && esMia(t, yo));
  if (tareasAtr.length) xs.push(`<a class="tira morada" href="#/tareas"><span class="icono-tira">${icono("tareas", "ico", { lleno: true })}</span>
    <span><b>${plural(tareasAtr.length, "tarea atrasada", "tareas atrasadas")}</b><small>${esc(tareasAtr.slice(0, 2).map((t) => t.titulo).join(" · "))}</small></span>${icono("derecha", "ico chevron")}</a>`);
  if (admin) {
    const al = alertasTendencia(d);
    if (al.length) xs.push(`<a class="tira naranja" href="#/indicadores"><span class="icono-tira">${icono("subeT")}</span>
      <span><b>${plural(al.length, "medida viene", "medidas vienen")} hacia afuera del rango</b><small>${esc(al.slice(0, 2).map((a) => `${a.e.tag || a.e.nombre}: ${a.it.texto}`).join(" · "))}</small></span>${icono("derecha", "ico chevron")}</a>`);
  }
  return xs.length ? `<div class="tiras">${xs.join("")}</div>` : "";
}

// ------------------------------------------------------------------------------- hallazgos

function tarjetaHallazgo(d, h, hoy) {
  const eq = equipo(d, h.equipo_id);
  const resp = persona(d, h.responsable_id);
  const foto = h.fotos?.[0];
  const tarde = h.vence && h.estado !== "cerrado" && h.vence < hoy;
  return `<article class="tarjeta${foto ? " con-foto" : ""}" data-h="${esc(h.id)}" tabindex="0" aria-label="${esc(`${numeroHallazgo(h)}: ${h.descripcion}`)}">
    <div class="arriba"><span class="num">${numeroHallazgo(h)}</span>${h.estado === "cerrado" ? "" : marcaPrioridad(h.prioridad)}${h._sinEnviar ? marcaSinEnviar() : ""}</div>
    <div class="que">${esc(h.descripcion)}</div>
    <div class="donde"><span>${esc(nombreCompleto(d, h.equipo_id))}</span>${h.ot ? `<span class="mono">${esc(h.ot)}</span>` : ""}</div>
    <div class="abajo">${resp ? `${avatar(resp, true)}<span>${esc(nombreCorto(d, resp.id))}</span>` : "<span>Sin responsable</span>"}
      ${h.vence && h.estado !== "cerrado" ? `<span class="${tarde ? "vence-tarde" : ""}">${icono("reloj", "ico chico")} ${esc(fechaCorta(h.vence))}</span>` : ""}
      ${h.estado === "cerrado" && h.cerrado ? `<span>${esc(haceCuanto(h.cerrado, hoy))}</span>` : ""}
      <span class="derecha"><button type="button" class="boton-icono" data-mover style="width:36px;height:36px;margin:-8px -6px -8px 0" aria-label="Mover a otra columna">${icono("arrastrar")}</button></span></div>
    ${foto ? `<img class="foto" src="${esc(api.urlMedio(foto))}" alt="" loading="lazy" onerror="this.remove()">` : ""}
  </article>`;
}

function columnasHallazgos({ d, yo, hoy }, quien, { fam, b }) {
  const xs = d.hallazgos.filter((h) => (quien === "todos" || h.responsable_id === yo.id) && enFiltro(fam, h.equipo_id)
    && (!b || normal(`${numeroHallazgo(h)} ${h.descripcion} ${h.accion} ${h.ot} ${nombreCompleto(d, h.equipo_id)}`).includes(b)));
  const orden = (a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || (a.vence ?? "9").localeCompare(b.vence ?? "9") || (b.creado ?? "").localeCompare(a.creado ?? "");
  const NADA = { abierto: "Nada abierto.", en_proceso: "Nada en proceso.", paro: "Nada esperando el paro.", cerrado: "Nada cerrado en las últimas dos semanas." };
  return ESTADOS.map((e) => {
    let grupo = xs.filter((h) => h.estado === e);
    const total = grupo.length;
    if (e === "cerrado") grupo = grupo.filter((h) => !h.cerrado || diasEntre(h.cerrado.slice(0, 10), hoy) <= 14).sort((a, b) => (b.cerrado ?? "").localeCompare(a.cerrado ?? ""));
    else grupo.sort(orden);
    return {
      id: e, titulo: TEXTO_ESTADO[e], punto: PUNTO_ESTADO[e], nada: NADA[e], cuenta: total,
      tarjetas: grupo.map((h) => tarjetaHallazgo(d, h, hoy)),
      pie: e === "cerrado" && total > grupo.length ? `<p style="margin:10px 6px 2px;font-size:14px"><a href="#/hallazgos?f=cerrados">Ver los ${total} cerrados</a></p>` : "",
    };
  });
}

let arrastre = null;

/** Mover un hallazgo de columna (al cerrar, pide cómo se resolvió). Devuelve si se movió. */
async function moverHallazgo(d, id, estado) {
  const h = d.hallazgos.find((x) => x.id === id);
  if (!h || h.estado === estado) return false;
  let texto = "";
  if (estado === "cerrado") {
    const r = await dialogo({
      titulo: "Cerrar el hallazgo",
      html: `<p>${esc(h.descripcion)}</p><div class="campo"><label for="como">Cómo se resolvió <small>(opcional)</small></label>
        <textarea id="como" placeholder="Por ejemplo: se cambiaron los rascadores 3 y 5"></textarea></div>`,
      botones: [{ texto: "Cancelar", valor: null }, { texto: "Cerrar hallazgo", valor: true, clase: "primario", alElegir: (velo) => { texto = velo.querySelector("#como").value.trim(); } }],
    });
    if (!r) return false;
  }
  // «Para el paro»: a cuál (si hay programados)
  let paro_id;
  if (estado === "paro") {
    const fam = familia(d, d.equipos.find((e) => e.id === h.equipo_id)?.padre_id ?? h.equipo_id);
    const ps = proximosProgramados(d).sort((a, b) => fam.has(b.equipo_id) - fam.has(a.equipo_id));
    if (ps.length) {
      const r = await elegir("¿Para cuál paro?", [...ps.map((p) => ({ valor: p.id, texto: `${nombreCompleto(d, p.equipo_id)} · ${fechaHora(p.inicio)}`, icono: "calendario" })), { valor: "", texto: "El próximo que se programe", icono: "reloj" }]);
      if (r === null) return false;
      paro_id = r || null;
    }
  }
  const antes = h.estado;
  try {
    await api.encolar(`hallazgos/${encodeURIComponent(id)}`, { estado, texto, ...(paro_id !== undefined ? { paro_id } : {}), seguimiento_id: crypto.randomUUID(), fecha: new Date().toISOString() });
  } catch (x) {
    aviso(x.message, { error: true });
    return false;
  }
  aviso(`${numeroHallazgo(h)} → ${TEXTO_ESTADO[estado]}`, {
    icono: ICONO_ESTADO[estado],
    accion: { texto: "Deshacer", alTocar: () => api.encolar(`hallazgos/${encodeURIComponent(id)}`, { estado: antes, seguimiento_id: crypto.randomUUID(), fecha: new Date().toISOString() }).catch((x) => aviso(x.message, { error: true })) },
  });
  return true;
}

/** Mover una tarea de columna. */
async function moverTarea(d, id, estado) {
  const t = (d.tareas ?? []).find((x) => x.id === id);
  if (!t || t.estado === estado) return false;
  if (!puedeTocar(d.yo, t)) { aviso("Esa tarea la cambian quien la pidió, a quien se la asignaron o un supervisor."); return false; }
  const antes = t.estado;
  try { await api.encolar(`tareas/${encodeURIComponent(id)}`, { estado, fecha: new Date().toISOString() }); }
  catch (x) { aviso(x.message, { error: true }); return false; }
  aviso(`${TEXTO_ESTADO_TAREA[estado]}: ${t.titulo}`, { accion: { texto: "Deshacer", alTocar: () => api.encolar(`tareas/${encodeURIComponent(id)}`, { estado: antes, fecha: new Date().toISOString() }) } });
  return true;
}
const KANBAN = {
  hallazgos: { attr: "h", ruta: "hallazgo", estados: ESTADOS, textos: TEXTO_ESTADO, iconos: ICONO_ESTADO, mover: moverHallazgo, actual: (d, id) => d.hallazgos.find((x) => x.id === id)?.estado },
  tareas: { attr: "t", ruta: "tarea", estados: ["pendiente", "en_curso", "hecha"], textos: TEXTO_ESTADO_TAREA, iconos: { pendiente: "circulo", en_curso: "repetir", hecha: "hecho" },
    mover: moverTarea, actual: (d, id) => (d.tareas ?? []).find((x) => x.id === id)?.estado },
};

function montarKanban(m, { d, ir }, k) {
  const tablero = m.querySelector(".tablero");
  let recien = false; // un arrastre termina con un clic que no tiene que abrir la tarjeta

  const mover = (id, estado) => k.mover(d, id, estado);


  m.addEventListener("click", async (e) => {
    const t = e.target.closest(".tarjeta");
    if (!t) return;
    if (recien) { recien = false; return; }
    if (e.target.closest("[data-mover]")) {
      const id = t.dataset[k.attr];
      const r = await elegir("Mover a", k.estados.map((s) => ({ valor: s, texto: k.textos[s], icono: k.iconos[s] })), { actual: k.actual(d, id) });
      if (r) mover(id, r);
      return;
    }
    ir(`#/${k.ruta}/${encodeURIComponent(t.dataset[k.attr])}`);
  });
  m.addEventListener("keydown", (e) => {
    const t = e.target.closest?.(".tarjeta");
    if (t && (e.key === "Enter" || e.key === " ") && e.target === t) { e.preventDefault(); ir(`#/${k.ruta}/${encodeURIComponent(t.dataset[k.attr])}`); }
  });
  m.addEventListener("contextmenu", (e) => { if (e.target.closest(".tarjeta") && matchMedia("(pointer: coarse)").matches) e.preventDefault(); });

  // ---- arrastrar
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const columnaEn = (x, y) => document.elementFromPoint(x, y)?.closest?.(".columna");

  function empezar(tarjeta, x, y) {
    const r = tarjeta.getBoundingClientRect();
    const f = tarjeta.cloneNode(true);
    f.classList.remove("preparando");
    f.classList.add("fantasma");
    f.style.width = `${r.width}px`;
    f.style.height = `${r.height}px`;
    f.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
    document.body.append(f);
    arrastre = { tarjeta, id: tarjeta.dataset[k.attr], origen: tarjeta.closest(".columna").dataset.estado, fantasma: f, dx: x - r.left, dy: y - r.top, x, y, destino: null, raf: 0 };
    tarjeta.classList.remove("preparando");
    tarjeta.classList.add("levantada");
    document.documentElement.classList.add("arrastrando");
    tablero.style.scrollSnapType = "none"; // si no, cada paso del deslizamiento automático vuelve a la columna
    navigator.vibrate?.(8);
    arrastre.raf = requestAnimationFrame(cuadro);
  }

  function cuadro() {
    const a = arrastre;
    if (!a) return;
    a.fantasma.style.transform = `translate3d(${a.x - a.dx}px, ${a.y - a.dy}px, 0) rotate(${reducir ? 0 : 1.5}deg) scale(${reducir ? 1 : 1.03})`;
    const col = columnaEn(a.x, a.y);
    if (col !== a.destino) {
      a.destino?.classList.remove("destino");
      if (col && col.dataset.estado !== a.origen) col.classList.add("destino");
      a.destino = col ?? null;
    }
    // cerca del borde se desliza solo: el tablero (teléfono) y la página
    if (tablero.scrollWidth > tablero.clientWidth + 2) {
      const r = tablero.getBoundingClientRect();
      if (a.x < r.left + 36) tablero.scrollLeft -= 14;
      else if (a.x > r.right - 36) tablero.scrollLeft += 14;
    }
    if (a.y < 90) scrollBy(0, -12);
    else if (a.y > innerHeight - 110) scrollBy(0, 12);
    a.raf = requestAnimationFrame(cuadro);
  }

  async function soltar() {
    const a = arrastre;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    a.destino?.classList.remove("destino");
    document.documentElement.classList.remove("arrastrando");
    recien = true;
    setTimeout(() => (recien = false), 400);
    const destino = a.destino && a.destino.dataset.estado !== a.origen ? a.destino : null;
    // la tarjeta va a su columna nueva ya (y la copia vuela a su lugar); si se cancela, vuelve
    const lugar = destino ? destino.querySelector(".tarjetas") : null;
    if (lugar) {
      lugar.querySelector(".nada")?.remove();
      lugar.prepend(a.tarjeta);
    }
    const r = a.tarjeta.getBoundingClientRect();
    if (!reducir) {
      a.fantasma.style.transition = "transform 240ms cubic-bezier(0.22, 1.12, 0.36, 1)";
      a.fantasma.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
      await new Promise((ok) => setTimeout(ok, 240));
    }
    a.fantasma.remove();
    a.tarjeta.classList.remove("levantada");
    tablero.style.scrollSnapType = "";
    arrastre = null;
    if (destino && !(await mover(a.id, destino.dataset.estado))) ir(location.hash); // cancelado: se redibuja como estaba
  }

  function cancelar() {
    if (!arrastre) return;
    arrastre.destino = null;
    soltar();
  }

  // mouse y lápiz: al mover más de 6 px
  let inicio = null;
  m.addEventListener("pointerdown", (e) => {
    if (k.fijo || e.pointerType === "touch" || e.button !== 0) return;
    const t = e.target.closest(".tarjeta");
    if (!t || t.hasAttribute("data-fija") || e.target.closest("button, a")) return;
    inicio = { t, x: e.clientX, y: e.clientY };
  });
  const alMover = (e) => {
    if (e.pointerType === "touch") return;
    if (arrastre) { arrastre.x = e.clientX; arrastre.y = e.clientY; return; }
    if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 6) {
      empezar(inicio.t, e.clientX, e.clientY);
      inicio = null;
    }
  };
  const alSoltar = (e) => {
    if (e.pointerType === "touch") return;
    inicio = null;
    if (arrastre) soltar();
  };
  addEventListener("pointermove", alMover);
  addEventListener("pointerup", alSoltar);
  const tecla = (e) => e.key === "Escape" && cancelar();
  addEventListener("keydown", tecla);

  // dedo: dejarlo quieto 320 ms; si se mueve antes, es deslizar (y no se toca)
  m.addEventListener("touchstart", (e) => {
    const t = e.target.closest(".tarjeta");
    if (k.fijo || !t || t.hasAttribute("data-fija") || e.touches.length > 1 || e.target.closest("button, a")) return;
    const p = e.touches[0];
    let x = p.clientX, y = p.clientY;
    const x0 = x, y0 = y;
    const preparar = setTimeout(() => t.classList.add("preparando"), 140);
    const reloj = setTimeout(() => empezar(t, x, y), 320);
    const mov = (ev) => {
      const q = ev.touches[0];
      x = q.clientX; y = q.clientY;
      if (arrastre) { ev.preventDefault(); arrastre.x = x; arrastre.y = y; return; }
      if (Math.hypot(x - x0, y - y0) > 8) fin(false);
    };
    const fin = (soltarSiHay = true) => {
      clearTimeout(reloj);
      clearTimeout(preparar);
      t.classList.remove("preparando");
      t.removeEventListener("touchmove", mov);
      t.removeEventListener("touchend", fin);
      t.removeEventListener("touchcancel", fin);
      if (soltarSiHay && arrastre) soltar();
    };
    t.addEventListener("touchmove", mov, { passive: false });
    t.addEventListener("touchend", fin);
    t.addEventListener("touchcancel", fin);
  }, { passive: true });

  return () => {
    removeEventListener("pointermove", alMover);
    removeEventListener("pointerup", alSoltar);
    removeEventListener("keydown", tecla);
    if (arrastre) { arrastre.fantasma.remove(); cancelAnimationFrame(arrastre.raf); arrastre = null; document.documentElement.classList.remove("arrastrando"); }
  };
}

// ------------------------------------------------------------------------------- inspecciones

function tarjetaTarea(d, t, hoy) {
  const tarde = t.estado !== "hecha" && t.vence && t.vence < hoy;
  const quien = t.asignada_a && !t.asignada_a.startsWith("turno:") ? persona(d, t.asignada_a) : null;
  const fija = d.yo && !puedeTocar(d.yo, t); // la de otro: se ve, no se mueve
  return `<article class="tarjeta" data-t="${esc(t.id)}" ${fija ? "data-fija" : ""} tabindex="0" aria-label="${esc(t.titulo)}">
    <div class="arriba">${t.estado !== "hecha" && t.prioridad === "alta" ? marcaPrioridad("alta") : ""}${t._sinEnviar ? marcaSinEnviar() : ""}${t.inspeccion_id ? `<span class="num">${icono("inspecciones", "ico chico")}</span>` : ""}</div>
    <div class="que">${esc(t.titulo)}</div>
    ${t.equipo_id ? `<div class="donde"><span>${esc(nombreCompleto(d, t.equipo_id))}</span></div>` : ""}
    <div class="abajo">${quien ? `${avatar(quien, true)}<span>${esc(paraQuien(d, t.asignada_a))}</span>` : `<span>${esc(paraQuien(d, t.asignada_a))}</span>`}
      ${t.vence ? `<span class="${tarde ? "vence-tarde" : ""}">${icono("reloj", "ico chico")} ${esc(fechaCorta(t.vence))}</span>` : ""}
      ${fija ? "" : `<span class="derecha"><button type="button" class="boton-icono" data-mover style="width:36px;height:36px;margin:-8px -6px -8px 0" aria-label="Mover a otra columna">${icono("arrastrar")}</button></span>`}</div>
  </article>`;
}

function columnasTareas({ d, yo, hoy }, quien, { fam, b }) {
  const xs = (d.tareas ?? []).filter((t) => (quien === "todos" || esMia(t, yo) || t.creada_por === yo.id) && enFiltro(fam, t.equipo_id)
    && (!b || normal(`${t.titulo} ${t.detalle} ${nombreCompleto(d, t.equipo_id)}`).includes(b)));
  const orden = (a, c) => (a.vence ?? "9").localeCompare(c.vence ?? "9") || ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[c.prioridad];
  const hechas = xs.filter((t) => t.estado === "hecha" && diasEntre((t.hecha_en ?? "").slice(0, 10) || hoy, hoy) <= 7).sort((a, c) => (c.hecha_en ?? "").localeCompare(a.hecha_en ?? ""));
  return [
    { id: "pendiente", titulo: "Por hacer", punto: "gris", nada: "Nada por hacer.", tarjetas: xs.filter((t) => t.estado === "pendiente").sort(orden).map((t) => tarjetaTarea(d, t, hoy)) },
    { id: "en_curso", titulo: "En curso", punto: "azul", nada: "Nada en curso.", tarjetas: xs.filter((t) => t.estado === "en_curso").sort(orden).map((t) => tarjetaTarea(d, t, hoy)) },
    { id: "hecha", titulo: "Hechas esta semana", punto: "verde", nada: "Nada todavía.", tarjetas: hechas.map((t) => tarjetaTarea(d, t, hoy)),
      pie: `<p style="margin:10px 6px 2px;font-size:14px"><a href="#/tareas?hechas=1">Ver todas en Tareas</a></p>` },
  ];
}

function tarjetaInspeccion(d, i, hoy, yo) {
  const pl = plantilla(d, i.plantilla_id);
  const quien = persona(d, i.estado === "hecha" ? i.hecha_por : i.asignada_a);
  const hall = i.estado === "hecha" ? d.hallazgos.filter((h) => h.inspeccion_id === i.id).length : 0;
  const ids = i.equipos?.length ? i.equipos : [i.equipo_id];
  const area = equipo(d, ids[0])?.area;
  return `<article class="tarjeta" data-i="${esc(i.id)}" tabindex="0" aria-label="${esc(`${queInspeccion(d, i)} · ${pl?.nombre ?? ""}`)}">
    <div class="arriba">${i._sinEnviar ? marcaSinEnviar() : marcaVence(i, hoy)}${i.repetir_dias ? `<span class="num">${icono("repetir", "ico chico")}</span>` : ""}</div>
    <div class="que">${esc(queInspeccion(d, i))} · ${esc(pl?.nombre ?? "Inspección")}</div>
    <div class="donde">${area ? `<span>${esc(area)}</span>` : ""}${i.estado === "pendiente" ? `<span>${esc(fechaCorta(i.vence))}</span>` : ""}
      ${i.estado === "hecha" ? `<span>${hall ? plural(hall, "hallazgo", "hallazgos") : "Todo bien"}</span>` : ""}</div>
    <div class="abajo">${quien ? `${avatar(quien, true)}<span>${esc(nombreCorto(d, quien.id))}</span>` : ""}
      <span class="derecha">
        ${puede(yo, "asignar") && i.estado === "pendiente" ? `<button type="button" class="boton mini" data-recordar>${icono("campana")}Recordar</button>` : ""}
        ${puede(yo, "revisar") && i.estado === "hecha" && !i.revisada_en && !i._sinEnviar ? `<button type="button" class="boton mini verde" data-visto>${icono("visto")}Visto bueno</button>` : ""}
      </span></div>
  </article>`;
}

function columnasInspecciones({ d, yo, hoy }, quien, { fam, b }) {
  const admin = puede(yo, "revisar");
  const turno = yo.turno ? `turno:${yo.turno}` : "-";
  const mias = (i) => (quien === "todos" || i.asignada_a === yo.id || i.asignada_a === turno || i.hecha_por === yo.id) && enFiltro(fam, equiposDe(i))
    && (!b || normal(`${queInspeccion(d, i)} ${plantilla(d, i.plantilla_id)?.nombre} ${equiposDe(i).map((x) => nombreCompleto(d, x)).join(" ")}`).includes(b));
  const pend = d.inspecciones.filter((i) => i.estado === "pendiente" && mias(i)).sort((a, b) => a.vence.localeCompare(b.vence));
  const semana = pend.filter((i) => i.vence > hoy && diasEntre(hoy, i.vence) <= 7);
  const despues = pend.filter((i) => i.vence > hoy).length - semana.length;
  const hechas = d.inspecciones.filter((i) => i.estado === "hecha" && mias(i) && (admin ? !i.revisada_en : diasEntre((i.hecha_en ?? "").slice(0, 10) || hoy, hoy) <= 7))
    .sort((a, b) => (b.hecha_en ?? "").localeCompare(a.hecha_en ?? ""));
  const t = (xs) => xs.map((i) => tarjetaInspeccion(d, i, hoy, yo));
  return [
    { id: "atrasadas", titulo: "Atrasadas", punto: "rojo", nada: "Nada atrasado.", tarjetas: t(pend.filter((i) => i.vence < hoy)) },
    { id: "hoy", titulo: "Hoy", punto: "naranja", nada: "Nada para hoy.", tarjetas: t(pend.filter((i) => i.vence === hoy)) },
    { id: "proximas", titulo: "Próximos 7 días", punto: "azul", nada: "Nada en la semana.", tarjetas: t(semana),
      pie: despues ? `<p style="margin:10px 6px 2px;font-size:14px"><a href="#/calendario">${plural(despues, "más adelante", "más adelante")} · ver el calendario</a></p>` : "" },
    { id: "hechas", titulo: admin ? "Por revisar" : "Hechas esta semana", punto: "verde", nada: admin ? "Todo revisado." : "Nada todavía.", tarjetas: t(hechas) },
  ];
}

function montarInspecciones(m, { d, ir }) {
  m.addEventListener("click", async (e) => {
    const t = e.target.closest(".tarjeta");
    if (!t) return;
    const id = t.dataset.i;
    const b = e.target.closest("button");
    if (b?.hasAttribute("data-recordar")) {
      b.disabled = true;
      try {
        const r = await api.escribir(`inspecciones/${encodeURIComponent(id)}/recordar`, {});
        const i = d.inspecciones.find((x) => x.id === id);
        aviso(r.entregados ? `Recordatorio enviado a ${nombreCorto(d, i.asignada_a)}.` : `Quedó en sus avisos de la app: ${nombreCorto(d, i.asignada_a)} no tiene notificaciones activadas.`);
      } catch (x) {
        aviso(x.sinRed ? "Para recordar hace falta señal." : x.message, { error: true });
      }
      b.disabled = false;
      return;
    }
    if (b?.hasAttribute("data-visto")) {
      b.disabled = true;
      try {
        await api.escribir(`inspecciones/${encodeURIComponent(id)}/revisar`, {});
        aviso("Visto bueno dado.", { icono: "visto" });
      } catch (x) {
        aviso(x.sinRed ? "Para el visto bueno hace falta señal." : x.message, { error: true });
        b.disabled = false;
      }
      return;
    }
    ir(`#/inspeccion/${encodeURIComponent(id)}`);
  });
  m.addEventListener("keydown", (e) => {
    const t = e.target.closest?.(".tarjeta");
    if (t && (e.key === "Enter" || e.key === " ") && e.target === t) { e.preventDefault(); ir(`#/inspeccion/${encodeURIComponent(t.dataset.i)}`); }
  });
}
