// El tablero (la pantalla principal). Eduardo, 30-oct-2026: «solo necesita 3 partes: lo que está pendiente, lo que
// está en proceso, lo que terminó […] al final todo son tareas». Un solo kanban con hallazgos, inspecciones y tareas
// juntos, en tres columnas. Arriba, «debajo de Hola Eduardo solo […] la cantidad de tareas pendientes asignadas que
// tienes. Y justo debajo […] el calendario»: la semana; después lo que no espera (un equipo parado, la entrega de turno).
//
// Arrastrar: con el mouse, al mover más de 6 px; en el teléfono, dejando el dedo quieto un momento (así deslizar sigue
// siendo deslizar). Lo que se mueve es una copia fija que solo cambia de transform en cada cuadro; cerca del borde,
// el tablero y la página se deslizan solos. El cambio entra a la cola (funciona sin señal) y se puede deshacer.
// Una inspección no se arrastra: se abre y se llena (o se ve, si ya está hecha).
import { esc, icono, fechaDia, fechaCorta, fechaHora, plural, numeroHallazgo, diasEntre, haceCuanto, normal, sumarDias } from "./util.mjs";
import { barraFiltros, montarFiltros, familia, enFiltro, nombreCompleto } from "./componentes.mjs";
import { esMia, puedeTocar, paraQuien, montarChecks, filaTarea, TEXTO_ESTADO_TAREA } from "./vistas-tareas.mjs";
import { entregaPorRecibir } from "./vistas-turno.mjs";
import { enCurso, montarEnCurso } from "./vistas-paros.mjs";
import { calendarioInicio } from "./vistas-calendario.mjs";
import * as api from "./api.mjs";
import {
  puede, aviso, dialogo, elegir, vacio, equipo, equiposDe, plantilla, persona, nombreCorto, queInspeccion, avatar,
  marcaPrioridad, marcaVence, marcaSinEnviar, TEXTO_ESTADO, ICONO_ESTADO, textoTurno,
} from "./ui.mjs";

const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 };
const COLUMNAS = [
  { id: "pendiente", titulo: "Pendiente", punto: "naranja", nada: "Nada pendiente.", icono: "circulo" },
  { id: "en_proceso", titulo: "En proceso", punto: "azul", nada: "Nada en proceso.", icono: "repetir" },
  { id: "terminado", titulo: "Terminado", punto: "verde", nada: "Nada terminado esta semana.", icono: "hecho" },
];
// cada tipo, a qué columna va su estado y qué estado le toca al moverlo a una columna
const TIPOS = {
  h: { ruta: "hallazgo", columna: { abierto: "pendiente", en_proceso: "en_proceso", paro: "en_proceso", cerrado: "terminado" },
    estado: { pendiente: "abierto", en_proceso: "en_proceso", terminado: "cerrado" } },
  t: { ruta: "tarea", columna: { pendiente: "pendiente", en_curso: "en_proceso", hecha: "terminado" },
    estado: { pendiente: "pendiente", en_proceso: "en_curso", terminado: "hecha" } },
  i: { ruta: "inspeccion" },
};
const tipoDe = (t) => (t.dataset.h ? "h" : t.dataset.t ? "t" : "i");
const idDe = (t) => t.dataset.h ?? t.dataset.t ?? t.dataset.i;
// una inspección pendiente que ya se empezó a llenar en este aparato está «en proceso»
const empezada = (i) => i.estado === "pendiente" && Object.values(api.borrador.leer(i.id)?.respuestas ?? {}).some((r) => r?.resultado || (r?.valor ?? "") !== "" || r?.texto);
let scrollTablero = null; // dónde quedó el kanban (se redibuja cuando llegan datos: que no vuelva a la primera columna)
let diaInicio = null; // el día que se tocó en el calendario del inicio

// ------------------------------------------------------------------------------- el inicio

/**
 * El inicio (Eduardo, 30-oct-2026): «Hola», cuántas tareas pendientes tiene uno, y «justo debajo el calendario» (la
 * semana y lo del día que se toque). Arriba a la derecha, los avisos y la configuración. Nada de kanban aquí: ese va
 * en Tareas.
 */
export function vistaTablero(ctx) {
  const { d, yo, hoy } = ctx;
  const general = puede(yo, "asignar") || !puede(yo, "editar");
  const quien = general ? "todos" : "mios";
  const pendientes = misPendientes(d, yo);
  const visto = api.LS.leer("bp-avisos-visto") ?? "";
  const nuevos = (d.avisos ?? []).filter((a) => a.fecha > visto).length;
  if (!diaInicio || diaInicio < sumarDias(hoy, -60)) diaInicio = hoy;
  return {
    titulo: "Tablero",
    tituloCorto: d.ajustes?.app_nombre || "Tablero",
    html: `<div class="cabeza cabeza-inicio"><div>
        <div class="fecha-hoy">${esc(fechaDia(hoy))}${yo.turno ? ` · ${esc(textoTurno(yo.turno))}` : ""}</div>
        <h1>Hola, ${esc(yo.nombre.split(" ")[0])}</h1>
        <p class="pendientes-hoy"><a href="#/tareas?q=mios">${pendientes ? `Tienes <b>${pendientes}</b> ${pendientes === 1 ? "tarea pendiente" : "tareas pendientes"}` : "No tienes tareas pendientes"}</a></p></div>
        <div class="iconos-inicio"><a class="boton-icono vidrio" href="#/avisos" aria-label="${nuevos ? `Avisos: ${nuevos} nuevos` : "Avisos"}">${icono("campana")}${nuevos ? `<span class="globo">${nuevos > 99 ? "99+" : nuevos}</span>` : ""}</a>
          <a class="boton-icono vidrio" href="#/ajustes" aria-label="Configuración">${icono("ajustes")}</a></div></div>
      <div data-calendario-inicio>${calendarioInicio(d, yo, hoy, quien, diaInicio)}</div>
      <div data-tiras>${tiras(d, yo, diaInicio === hoy)}</div>`,
    montar(m) {
      const zona = m.querySelector("[data-calendario-inicio]");
      zona.addEventListener("click", (e) => {
        const b = e.target.closest("[data-dia]"), s = e.target.closest("[data-semana]");
        if (!b && !s) return;
        diaInicio = b ? b.dataset.dia : sumarDias(diaInicio, Number(s.dataset.semana));
        zona.innerHTML = calendarioInicio(api.obtener(), yo, hoy, quien, diaInicio);
        m.querySelector("[data-tiras]").innerHTML = tiras(api.obtener(), yo, diaInicio === hoy);
        zona.querySelector(`[data-dia="${diaInicio}"]`)?.focus({ preventScroll: true });
      });
      return montarEnCurso(m);
    },
  };
}

/** Lo asignado a uno (o a su turno) que no está terminado: hallazgos a su cargo, inspecciones y tareas. */
function misPendientes(d, yo) {
  const turno = yo.turno ? `turno:${yo.turno}` : "-";
  // lo de «Todos» cuenta para quien puede hacerlo (no para quien solo ve)
  const todos = puede(yo, "editar") ? "todos" : "-";
  return d.hallazgos.filter((h) => h.estado !== "cerrado" && h.responsable_id === yo.id).length
    + d.inspecciones.filter((i) => i.estado === "pendiente" && (i.asignada_a === yo.id || i.asignada_a === turno || i.asignada_a === todos)).length
    + (d.tareas ?? []).filter((t) => t.estado !== "hecha" && esMia(t, yo) && (t.asignada_a !== "todos" || todos === "todos")).length;
}

/**
 * Debajo del calendario, solo lo que no espera: la entrega de turno por recibir y los equipos parados ahora. Con hoy
 * elegido, los parados ya salen en lo del día (no se repiten).
 */
function tiras(d, yo, conHoy = false) {
  const xs = [];
  const ent = entregaPorRecibir(d, yo);
  if (ent) xs.push(`<a class="tira azul" href="#/entrega/${encodeURIComponent(ent.id)}"><span class="icono-tira">${icono("turno", "ico", { lleno: true })}</span>
    <span><b>${esc(ent.turno ? textoTurno(ent.turno) : nombreCorto(d, ent.de))} te entregó</b><small>${esc((ent.novedades || ent.pendientes || "").slice(0, 90))}</small></span>${icono("derecha", "ico chevron")}</a>`);
  for (const p of conHoy ? [] : enCurso(d).slice(0, 2)) {
    xs.push(`<a class="tira roja" href="#/paro/${encodeURIComponent(p.id)}"><span class="icono-tira">${icono("paros", "ico", { lleno: true })}</span>
      <span><b>${esc(nombreCompleto(d, p.equipo_id))} parado</b><small>desde ${esc(fechaHora(p.inicio))}${p.causa ? ` · ${esc(p.causa)}` : ""}</small></span>${icono("derecha", "ico chevron")}</a>`);
  }
  return xs.length ? `<div class="tiras">${xs.join("")}</div>` : "";
}

// ------------------------------------------------------------------------------- Tareas: lista o kanban

/**
 * Tareas (Eduardo: «al final todo son tareas»): hallazgos, inspecciones y tareas juntos. Filtros por equipo y de quién,
 * ordenar por fecha o por criticidad, y verlo en lista o en kanban (Pendiente, En proceso, Terminado). Se agrega con
 * «Nueva tarea» (el formulario), sin alta rápida.
 */
export function vistaTareasTablero(ctx) {
  const { d, yo, hoy, query } = ctx;
  const general = puede(yo, "asignar") || !puede(yo, "editar");
  const quien = query.get("q") ?? (general ? "todos" : "mios");
  const vista = ["lista", "kanban"].includes(query.get("vista")) ? query.get("vista") : api.LS.leer("bp-tareas-vista") ?? "lista";
  const orden = ["fecha", "criticidad"].includes(query.get("orden")) ? query.get("orden") : api.LS.leer("bp-tareas-orden") ?? "fecha";
  api.LS.poner("bp-tareas-vista", vista);
  api.LS.poner("bp-tareas-orden", orden);
  const filtro = { fam: familia(d, query.get("eq")), b: normal(query.get("b") ?? "") };
  const r = columnas(ctx, quien, filtro, orden);
  const enlace = (cambios) => `#/tareas?${new URLSearchParams({ ...Object.fromEntries(query), q: quien, vista, orden, ...cambios })}`;
  const arrastrable = puede(yo, "editar");
  const abiertos = r.cols[0].items.length + r.cols[1].items.length;
  const atrasados = [...r.cols[0].items, ...r.cols[1].items].filter((x) => x.fecha && x.fecha < hoy).length;
  const contenido = () => (vista === "kanban" ? kanban() : lista());
  const kanban = () => `<div data-contenido data-kanban${arrastrable ? "" : ' class="solo-ver"'}><div class="columnas-salto" role="group" aria-label="Ir a la columna">${r.cols.map((c, k) => `<button type="button" data-ir-col="${k}" ${k === 0 ? 'aria-current="true"' : ""}>
        <i class="punto ${c.punto}"></i>${esc(c.titulo)} <b>${c.items.length}</b></button>`).join("")}</div>
      <div class="tablero" data-tablero="todo">${r.cols.map((c) => `<section class="columna" data-estado="${c.id}" aria-label="${esc(c.titulo)}">
          <header><i class="punto ${c.punto}"></i><h3>${esc(c.titulo)}</h3><span class="cuenta">${c.items.length}</span></header>
          <div class="tarjetas">${c.items.length ? c.items.map((x) => x.html).join("") : `<div class="nada">${c.nada}</div>`}</div>
          ${c.pie ?? ""}
        </section>`).join("")}</div>
      ${arrastrable ? `<p class="no-imprimir ayuda" style="margin:2px 4px">${matchMedia("(pointer: coarse)").matches ? "Deja el dedo sobre una tarjeta para moverla de columna" : "Arrastra una tarjeta para cambiarla de columna"}, o toca ${icono("arrastrar", "ico chico")}. Las inspecciones se abren y se llenan.</p>` : ""}</div>`;
  const lista = () => {
    const vivos = [...r.cols[0].items, ...r.cols[1].items].sort(orden === "criticidad" ? porCriticidad(hoy) : porFecha(hoy));
    const grupos = orden === "criticidad"
      ? [["Alta", (x) => x.prio === "alta", "roja"], ["Media", (x) => x.prio === "media"], ["Baja", (x) => x.prio === "baja"]]
      : [["Atrasadas", (x) => x.fecha && x.fecha < hoy, "roja"], ["Hoy", (x) => x.fecha === hoy], ["Próximas", (x) => x.fecha && x.fecha > hoy], ["Sin fecha", (x) => !x.fecha]];
    const verHechas = query.get("hechas") === "1";
    const hechas = r.cols[2].items;
    const secciones = grupos.map(([t, f, cl]) => [t, vivos.filter(f), cl]).filter(([, xs]) => xs.length);
    return `<div data-contenido>${secciones.length ? secciones.map(([t, xs, cl]) => `<section class="seccion"><h2${cl ? ' style="color:var(--rojo)"' : ""}>${t} <small>${xs.length}</small></h2>
        <ul class="lista-tareas">${xs.map((x) => x.fila).join("")}</ul></section>`).join("")
      : vacio(filtro.b || filtro.fam ? "Nada con ese filtro." : quien === "mios" ? "No tienes nada pendiente." : "No hay nada pendiente.")}
      ${hechas.length ? `<section class="seccion"><h2>Terminado esta semana <small>${hechas.length}</small> <a class="boton mini plano" href="${enlace({ hechas: verHechas ? "0" : "1" })}" style="margin-left:auto">${verHechas ? "Ocultar" : "Mostrar"}</a></h2>
        ${verHechas ? `<ul class="lista-tareas">${hechas.map((x) => x.fila).join("")}</ul>` : ""}</section>` : ""}</div>`;
  };
  return {
    titulo: "Tareas",
    html: `<div class="cabeza"><div><h1>Tareas</h1>
        <p class="bajada">${abiertos ? `${plural(abiertos, "pendiente", "pendientes")}${atrasados ? `, ${atrasados} ${atrasados === 1 ? "atrasada" : "atrasadas"}` : ""}.` : "Todo al día."} Hallazgos, inspecciones y tareas, juntos.</p></div>
        ${puede(yo, "editar") ? `<div class="acciones"><a class="boton primario" href="#/tarea/nueva">${icono("mas1")}Nueva tarea</a></div>` : ""}</div>
      ${barraFiltros(d, query, { placeholder: "Buscar", extra: `<nav class="filtros" style="margin:0" aria-label="De quién">
        <a href="${enlace({ q: "mios" })}" ${quien === "mios" ? 'aria-current="true"' : ""}>Lo mío</a>
        <a href="${enlace({ q: "todos" })}" ${quien === "todos" ? 'aria-current="true"' : ""}>Todo</a></nav>` })}
      <div class="tareas-controles">
        <div class="control-con-rotulo"><span>Ordenar</span><div class="segmento chico" role="group" aria-label="Ordenar por">
          <a href="${enlace({ orden: "fecha" })}" ${orden === "fecha" ? 'aria-current="true"' : ""}>Fecha</a>
          <a href="${enlace({ orden: "criticidad" })}" ${orden === "criticidad" ? 'aria-current="true"' : ""}>Criticidad</a></div></div>
        <div class="segmento chico" role="group" aria-label="Vista">
          <a href="${enlace({ vista: "lista" })}" ${vista === "lista" ? 'aria-current="true"' : ""}>${icono("lista")}Lista</a>
          <a href="${enlace({ vista: "kanban" })}" ${vista === "kanban" ? 'aria-current="true"' : ""}>${icono("tablero")}Kanban</a></div>
      </div>
      ${contenido()}`,
    montar(m) {
      const desmontes = [];
      const conectar = () => {
        const tab = m.querySelector(".tablero");
        if (!tab) return;
        if (scrollTablero == null) {
          const cols = [...tab.querySelectorAll(".columna")];
          const k = cols.findIndex((c) => c.querySelector(".tarjeta"));
          scrollTablero = k > 0 ? cols[k].offsetLeft - cols[0].offsetLeft : 0;
        }
        tab.scrollLeft = scrollTablero;
        const saltos = [...m.querySelectorAll("[data-ir-col]")];
        let cuadro = 0;
        const marcarColumna = () => {
          cuadro = 0;
          scrollTablero = tab.scrollLeft;
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
        tab.scrollTo({ left: col.offsetLeft - tab.firstElementChild.offsetLeft, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      });
      // al filtrar se cambia solo la lista o el kanban (la búsqueda conserva el foco)
      montarFiltros(m, d, { ruta: "tareas", alCambiar: (q) => {
        const nv = vistaTareasTablero({ ...ctx, d: api.obtener(), query: q });
        const tmp = document.createElement("div");
        tmp.innerHTML = nv.html;
        m.querySelector("[data-contenido]").replaceWith(tmp.querySelector("[data-contenido]"));
        conectar();
      } });
      if (vista === "kanban") desmontes.push(montarKanban(m, ctx, { fijo: !puede(yo, "editar") }));
      else montarLista(m, ctx);
      montarChecks(m, d);
      return () => desmontes.forEach((f) => f?.());
    },
    ocupada: () => !!arrastre || !!document.querySelector(".lista-tareas li.saliendo"),
  };
}

/** En la lista: el visto bueno y el recordatorio de una inspección (lo demás son enlaces y el círculo de la tarea). */
function montarLista(m, { d }) {
  m.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-visto], [data-recordar]");
    const id = b?.closest("[data-i]")?.dataset.i;
    if (!b || !id) return;
    e.preventDefault();
    b.disabled = true;
    try {
      if (b.hasAttribute("data-visto")) { await api.escribir(`inspecciones/${encodeURIComponent(id)}/revisar`, {}); aviso("Visto bueno dado.", { icono: "visto" }); }
      else { const r = await api.escribir(`inspecciones/${encodeURIComponent(id)}/recordar`, {}); const i = d.inspecciones.find((x) => x.id === id); aviso(r.entregados ? `Recordatorio enviado a ${nombreCorto(d, i.asignada_a)}.` : `Quedó en sus avisos de la app.`); b.disabled = false; }
    } catch (x) { aviso(x.sinRed ? "Para esto hace falta señal." : x.message, { error: true }); b.disabled = false; }
  });
}

// lo atrasado primero, después lo de hoy, después por fecha; lo sin fecha al final; en cada grupo, lo urgente arriba
const grupoFecha = (x, hoy) => (!x.fecha ? 3 : x.fecha < hoy ? 0 : x.fecha === hoy ? 1 : 2);
const porFecha = (hoy) => (a, c) => grupoFecha(a, hoy) - grupoFecha(c, hoy) || (a.fecha ?? "").localeCompare(c.fecha ?? "") || ORDEN_PRIORIDAD[a.prio] - ORDEN_PRIORIDAD[c.prio] || (c.creado ?? "").localeCompare(a.creado ?? "");
const porCriticidad = (hoy) => (a, c) => ORDEN_PRIORIDAD[a.prio] - ORDEN_PRIORIDAD[c.prio] || porFecha(hoy)(a, c);

/** Todo lo que toca (hallazgos, inspecciones, tareas), repartido en Pendiente, En proceso y Terminado. */
function columnas({ d, yo, hoy }, quien, { fam, b }, orden = "fecha") {
  const turno = yo.turno ? `turno:${yo.turno}` : "-";
  const reviso = puede(yo, "revisar");
  const busca = (t) => !b || normal(t).includes(b);
  const reciente = (iso) => iso && diasEntre(iso.slice(0, 10), hoy) <= 7;
  const xs = [];
  for (const h of d.hallazgos) {
    if (!(quien === "todos" || h.responsable_id === yo.id) || !enFiltro(fam, h.equipo_id)) continue;
    if (!busca(`${numeroHallazgo(h)} ${h.descripcion} ${h.accion} ${h.ot} ${nombreCompleto(d, h.equipo_id)}`)) continue;
    const col = TIPOS.h.columna[h.estado];
    if (col === "terminado" && !reciente(h.cerrado)) continue;
    xs.push({ col, fecha: h.vence, prio: h.prioridad, hecho: h.cerrado, creado: h.creado, html: tarjetaHallazgo(d, h, hoy), fila: filaHallazgoLista(d, h, hoy) });
  }
  let masAdelante = 0;
  for (const i of d.inspecciones) {
    if (!(quien === "todos" || i.asignada_a === yo.id || (i.asignada_a === turno || i.asignada_a === "todos") || i.hecha_por === yo.id) || !enFiltro(fam, equiposDe(i))) continue;
    if (!busca(`${queInspeccion(d, i)} ${plantilla(d, i.plantilla_id)?.nombre} ${equiposDe(i).map((x) => nombreCompleto(d, x)).join(" ")}`)) continue;
    const col = i.estado === "hecha" ? "terminado" : empezada(i) ? "en_proceso" : "pendiente";
    // lo hecho: la última semana (y lo que espera el visto bueno de quien lo da); lo pendiente: hasta dentro de 7 días
    if (col === "terminado" && !reciente(i.hecha_en) && !(reviso && !i.revisada_en)) continue;
    if (col === "pendiente" && diasEntre(hoy, i.vence) > 7) { masAdelante++; continue; }
    // una inspección no tiene criticidad: atrasada cuenta como alta
    xs.push({ col, fecha: i.estado === "hecha" ? null : i.vence, prio: i.estado === "pendiente" && i.vence < hoy ? "alta" : "media", hecho: i.hecha_en, creado: i.creada,
      porRevisar: i.estado === "hecha" && !i.revisada_en, html: tarjetaInspeccion(d, i, hoy, yo), fila: filaInspeccionLista(d, i, hoy, yo) });
  }
  for (const t of d.tareas ?? []) {
    if (!(quien === "todos" || esMia(t, yo) || t.creada_por === yo.id) || !enFiltro(fam, t.equipo_id)) continue;
    if (!busca(`${t.titulo} ${t.detalle} ${nombreCompleto(d, t.equipo_id)}`)) continue;
    const col = TIPOS.t.columna[t.estado];
    if (col === "terminado" && !reciente(t.hecha_en)) continue;
    xs.push({ col, fecha: t.estado === "hecha" ? null : t.vence, prio: t.prioridad, hecho: t.hecha_en, creado: t.creada, html: tarjetaTarea(d, t, hoy), fila: filaTarea(d, t, hoy) });
  }
  const ordenar = orden === "criticidad" ? porCriticidad(hoy) : porFecha(hoy);
  const cols = COLUMNAS.map((c) => {
    const items = xs.filter((x) => x.col === c.id).sort(c.id === "terminado" ? (a, e) => (e.hecho ?? "").localeCompare(a.hecho ?? "") : ordenar);
    return { ...c, items,
      pie: c.id === "pendiente" && masAdelante ? `<p style="margin:10px 6px 2px;font-size:14px"><a href="#/calendario">${plural(masAdelante, "inspección más adelante", "inspecciones más adelante")} · ver el calendario</a></p>`
        : c.id === "terminado" ? `<p style="margin:10px 6px 2px;font-size:14px"><a href="#/reportes">Lo de antes, en Reportes</a></p>` : "" };
  });
  return { cols };
}

/** Las filas de la lista para hallazgos e inspecciones (las tareas usan la suya, con el círculo para marcarla). */
function filaHallazgoLista(d, h, hoy) {
  const tarde = h.vence && h.estado !== "cerrado" && h.vence < hoy;
  const det = [`<span>Hallazgo <span class="mono">${numeroHallazgo(h)}</span></span>`, `<span>${esc(nombreCompleto(d, h.equipo_id))}</span>`,
    h.responsable_id ? `<span>${esc(nombreCorto(d, h.responsable_id))}</span>` : "",
    h.vence && h.estado !== "cerrado" ? `<span class="${tarde ? "tarde" : ""}">${icono("reloj", "ico chico")} ${h.vence === hoy ? "Hoy" : esc(fechaCorta(h.vence))}</span>` : "",
    h.estado === "en_proceso" ? `<span style="color:var(--tinte);font-weight:600">En proceso</span>` : h.estado === "paro" ? `<span style="color:var(--morado);font-weight:600">Para el paro</span>` : ""].join("");
  return `<li class="${h.estado === "cerrado" ? "hecha" : ""}"><span class="icono-lista rojo" aria-hidden="true">${icono("hallazgos")}</span>
    <a class="que" href="#/hallazgo/${encodeURIComponent(h.id)}"><b>${esc(h.descripcion)}</b><small>${det}</small></a>
    <span class="lado">${h._sinEnviar ? marcaSinEnviar() : ""}${h.prioridad === "alta" && h.estado !== "cerrado" ? `<span class="marca alta">Alta</span>` : ""}</span></li>`;
}
function filaInspeccionLista(d, i, hoy, yo) {
  const pl = plantilla(d, i.plantilla_id);
  const quien = i.estado === "hecha" ? i.hecha_por : i.asignada_a;
  const det = [`<span>Inspección</span>`, quien ? `<span>${esc(nombreCorto(d, quien))}</span>` : "",
    i.estado === "pendiente" ? `<span class="${i.vence < hoy ? "tarde" : ""}">${icono("reloj", "ico chico")} ${i.vence === hoy ? "Hoy" : esc(fechaCorta(i.vence))}</span>` : "",
    empezada(i) ? `<span style="color:var(--tinte);font-weight:600">Empezada</span>` : ""].join("");
  return `<li class="${i.estado === "hecha" ? "hecha" : ""}" data-i="${esc(i.id)}"><span class="icono-lista azul" aria-hidden="true">${icono("inspecciones")}</span>
    <a class="que" href="#/inspeccion/${encodeURIComponent(i.id)}"><b>${esc(queInspeccion(d, i))} · ${esc(pl?.nombre ?? "Inspección")}</b><small>${det}</small></a>
    <span class="lado">${i._sinEnviar ? marcaSinEnviar() : ""}${puede(yo, "revisar") && i.estado === "hecha" && !i.revisada_en && !i._sinEnviar ? `<button type="button" class="boton mini verde" data-visto>${icono("visto")}Visto bueno</button>` : ""}</span></li>`;
}

// ------------------------------------------------------------------------------- las tarjetas

const tipo = (ic, texto) => `<span class="tipo-tarjeta">${icono(ic, "ico chico")}${texto}</span>`;
const mover = `<span class="derecha"><button type="button" class="boton-icono" data-mover style="width:36px;height:36px;margin:-8px -6px -8px 0" aria-label="Mover a otra columna">${icono("arrastrar")}</button></span>`;

function tarjetaHallazgo(d, h, hoy) {
  const resp = persona(d, h.responsable_id);
  const foto = h.fotos?.[0];
  const tarde = h.vence && h.estado !== "cerrado" && h.vence < hoy;
  return `<article class="tarjeta${foto ? " con-foto" : ""}" data-h="${esc(h.id)}" tabindex="0" aria-label="${esc(`Hallazgo ${numeroHallazgo(h)}: ${h.descripcion}`)}">
    <div class="arriba">${tipo("hallazgos", `Hallazgo <span class="num">${numeroHallazgo(h)}</span>`)}${h.estado === "cerrado" ? "" : marcaPrioridad(h.prioridad)}${h.estado === "paro" ? `<span class="marca paro">${icono("paro")}Para el paro</span>` : ""}${h._sinEnviar ? marcaSinEnviar() : ""}</div>
    <div class="que">${esc(h.descripcion)}</div>
    <div class="donde"><span>${esc(nombreCompleto(d, h.equipo_id))}</span>${h.ot ? `<span class="mono">${esc(h.ot)}</span>` : ""}</div>
    <div class="abajo">${resp ? `${avatar(resp, true)}<span>${esc(nombreCorto(d, resp.id))}</span>` : "<span>Sin responsable</span>"}
      ${h.vence && h.estado !== "cerrado" ? `<span class="${tarde ? "vence-tarde" : ""}">${icono("reloj", "ico chico")} ${esc(fechaCorta(h.vence))}</span>` : ""}
      ${h.estado === "cerrado" && h.cerrado ? `<span>${esc(haceCuanto(h.cerrado, hoy))}</span>` : ""}
      ${mover}</div>
    ${foto ? `<img class="foto" src="${esc(api.urlMedio(foto))}" alt="" loading="lazy" onerror="this.remove()">` : ""}
  </article>`;
}

function tarjetaTarea(d, t, hoy) {
  const tarde = t.estado !== "hecha" && t.vence && t.vence < hoy;
  const quien = t.asignada_a && !t.asignada_a.startsWith("turno:") ? persona(d, t.asignada_a) : null;
  const fija = d.yo && !puedeTocar(d.yo, t); // la de otro: se ve, no se mueve
  return `<article class="tarjeta" data-t="${esc(t.id)}" ${fija ? "data-fija" : ""} tabindex="0" aria-label="${esc(`Tarea: ${t.titulo}`)}">
    <div class="arriba">${tipo("tareas", "Tarea")}${t.estado !== "hecha" && t.prioridad === "alta" ? marcaPrioridad("alta") : ""}${t._sinEnviar ? marcaSinEnviar() : ""}</div>
    <div class="que">${esc(t.titulo)}</div>
    ${t.equipo_id ? `<div class="donde"><span>${esc(nombreCompleto(d, t.equipo_id))}</span>${t.inspeccion_id ? `<span>${icono("inspecciones", "ico chico")} de una inspección</span>` : ""}</div>` : ""}
    <div class="abajo">${quien ? `${avatar(quien, true)}<span>${esc(paraQuien(d, t.asignada_a))}</span>` : `<span>${esc(paraQuien(d, t.asignada_a))}</span>`}
      ${t.vence && t.estado !== "hecha" ? `<span class="${tarde ? "vence-tarde" : ""}">${icono("reloj", "ico chico")} ${esc(fechaCorta(t.vence))}</span>` : ""}
      ${t.estado === "hecha" && t.hecha_en ? `<span>${esc(haceCuanto(t.hecha_en, hoy))}</span>` : ""}
      ${fija ? "" : mover}</div>
  </article>`;
}

function tarjetaInspeccion(d, i, hoy, yo) {
  const pl = plantilla(d, i.plantilla_id);
  const quien = persona(d, i.estado === "hecha" ? i.hecha_por : i.asignada_a);
  const hall = i.estado === "hecha" ? d.hallazgos.filter((h) => h.inspeccion_id === i.id).length : 0;
  const ids = i.equipos?.length ? i.equipos : [i.equipo_id];
  const area = equipo(d, ids[0])?.area;
  return `<article class="tarjeta" data-i="${esc(i.id)}" data-fija tabindex="0" aria-label="${esc(`Inspección: ${queInspeccion(d, i)} · ${pl?.nombre ?? ""}`)}">
    <div class="arriba">${tipo("inspecciones", "Inspección")}${i._sinEnviar ? marcaSinEnviar() : empezada(i) ? `<span class="marca en_proceso">${icono("repetir")}Empezada</span>` : marcaVence(i, hoy)}${i.repetir_dias ? `<span class="num">${icono("repetir", "ico chico")}</span>` : ""}</div>
    <div class="que">${esc(queInspeccion(d, i))} · ${esc(pl?.nombre ?? "Inspección")}</div>
    <div class="donde">${area ? `<span>${esc(area)}</span>` : ""}${i.estado === "pendiente" ? `<span>${esc(fechaCorta(i.vence))}</span>` : ""}
      ${i.estado === "hecha" ? `<span>${hall ? plural(hall, "hallazgo", "hallazgos") : "Todo bien"}</span>` : ""}</div>
    <div class="abajo">${quien ? `${avatar(quien, true)}<span>${esc(nombreCorto(d, quien.id))}</span>` : i.asignada_a?.startsWith("turno:") || i.asignada_a === "todos" ? `<span>${esc(nombreCorto(d, i.asignada_a))}</span>` : ""}
      <span class="derecha">
        ${puede(yo, "asignar") && i.estado === "pendiente" ? `<button type="button" class="boton mini" data-recordar>${icono("campana")}Recordar</button>` : ""}
        ${puede(yo, "revisar") && i.estado === "hecha" && !i.revisada_en && !i._sinEnviar ? `<button type="button" class="boton mini verde" data-visto>${icono("visto")}Visto bueno</button>` : ""}
      </span></div>
  </article>`;
}

// ------------------------------------------------------------------------------- mover

let arrastre = null;

/** Mover un hallazgo de estado (al cerrar, pide cómo se resolvió). Devuelve si se movió. */
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
  const antes = h.estado;
  try {
    await api.encolar(`hallazgos/${encodeURIComponent(id)}`, { estado, texto, seguimiento_id: crypto.randomUUID(), fecha: new Date().toISOString() });
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

/** Mover una tarea de estado. */
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

function montarKanban(m, { d, ir }, k) {
  const tablero = m.querySelector(".tablero");
  let recien = false; // un arrastre termina con un clic que no tiene que abrir la tarjeta

  /** Pasar una tarjeta a una columna: a cada tipo, su estado. */
  const mover = (tarjeta, col) => {
    const tp = tipoDe(tarjeta), id = idDe(tarjeta);
    if (tp === "h") return moverHallazgo(d, id, TIPOS.h.estado[col]);
    if (tp === "t") return moverTarea(d, id, TIPOS.t.estado[col]);
    return false;
  };

  m.addEventListener("click", async (e) => {
    const t = e.target.closest(".tarjeta");
    if (!t) return;
    if (recien) { recien = false; return; }
    const id = idDe(t), tp = tipoDe(t);
    const b = e.target.closest("button");
    if (b?.hasAttribute("data-mover")) {
      const actual = t.closest(".columna")?.dataset.estado;
      const r = await elegir("Mover a", COLUMNAS.map((c) => ({ valor: c.id, texto: c.titulo, icono: c.icono })), { actual });
      if (r && r !== actual) mover(t, r);
      return;
    }
    if (b?.hasAttribute("data-recordar")) {
      b.disabled = true;
      try {
        const r = await api.escribir(`inspecciones/${encodeURIComponent(id)}/recordar`, {});
        const i = d.inspecciones.find((x) => x.id === id);
        aviso(r.entregados ? `Recordatorio enviado a ${nombreCorto(d, i.asignada_a)}.` : `Quedó en sus avisos de la app: ${nombreCorto(d, i.asignada_a)} no tiene notificaciones activadas.`);
      } catch (x) { aviso(x.sinRed ? "Para recordar hace falta señal." : x.message, { error: true }); }
      b.disabled = false;
      return;
    }
    if (b?.hasAttribute("data-visto")) {
      b.disabled = true;
      try { await api.escribir(`inspecciones/${encodeURIComponent(id)}/revisar`, {}); aviso("Visto bueno dado.", { icono: "visto" }); }
      catch (x) { aviso(x.sinRed ? "Para el visto bueno hace falta señal." : x.message, { error: true }); b.disabled = false; }
      return;
    }
    ir(`#/${TIPOS[tp].ruta}/${encodeURIComponent(id)}`);
  });
  m.addEventListener("keydown", (e) => {
    const t = e.target.closest?.(".tarjeta");
    if (t && (e.key === "Enter" || e.key === " ") && e.target === t) { e.preventDefault(); ir(`#/${TIPOS[tipoDe(t)].ruta}/${encodeURIComponent(idDe(t))}`); }
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
    arrastre = { tarjeta, origen: tarjeta.closest(".columna").dataset.estado, fantasma: f, dx: x - r.left, dy: y - r.top, x, y, destino: null, raf: 0 };
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
    if (destino && !(await mover(a.tarjeta, destino.dataset.estado))) ir(location.hash); // cancelado: se redibuja como estaba
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
