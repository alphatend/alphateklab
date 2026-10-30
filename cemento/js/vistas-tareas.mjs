// Tareas (Eduardo, 29-oct-2026: «También agregar "Tareas"»): sueltas, agregadas al asignar una inspección o sacadas de
// un hallazgo. Como Recordatorios: un círculo para marcarla, agrupadas por cuándo vencen, alta rápida arriba. Todo
// funciona sin señal (entra a la cola). Se le asignan a una persona o a un turno entero.
import { esc, icono, fechaCorta, fechaHora, plural, diasEntre, normal, numeroHallazgo, sumarDias } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, confirmar, vacio, persona, nombre, nombreCorto, avatar, esAdmin, puede, etiquetaPersona, galeria, botonesMedio, marcaSinEnviar, TEXTO_PRIORIDAD } from "./ui.mjs";
import { barraFiltros, montarFiltros, familia, enFiltro, nombreCompleto, campoEquipo } from "./componentes.mjs";
import { prepararArchivo } from "./medios.mjs";

export const TEXTO_ESTADO_TAREA = { pendiente: "Por hacer", en_curso: "En curso", hecha: "Hecha" };
const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>`;

/** ¿Es mía? (a mí o a mi turno) */
export const esMia = (t, yo) => t.asignada_a === yo.id || (yo.turno && t.asignada_a === `turno:${yo.turno}`);
/** ¿La puede cambiar? Las suyas (a él, a su turno, sin asignar o que pidió) con «editar»; las de otros, con «tareas». */
export const puedeTocar = (yo, t) => puede(yo, "editar") && (!t || !t.asignada_a || esMia(t, yo) || t.creada_por === yo.id || puede(yo, "tareas"));
/** «Turno A», «Eduardo» o «Sin asignar». */
export const paraQuien = (d, v) => (!v ? "Sin asignar" : nombreCorto(d, v));

/**
 * Las opciones de «a quién»: las personas y los turnos (sin el permiso «tareas», solo uno mismo y su turno). Quien solo
 * ve no sale: no podría llenarla ni cerrarla. `elegir`: empieza en «Elegir a quién…» (al asignar, que no caiga en nadie
 * por descuido).
 */
export function opcionesQuien(d, yo, actual, { elegir = false } = {}) {
  const aOtros = puede(yo, "tareas") || elegir;
  const hacen = d.personas.filter((p) => p.activo && puede(p, "editar"));
  const turnos = [...new Set(hacen.filter((p) => p.turno).map((p) => p.turno))].sort()
    .filter((t) => aOtros || t === yo.turno || actual === `turno:${t}`);
  return `${elegir ? `<option value="" ${actual ? "" : "selected"} disabled>Elegir a quién…</option>` : ""}<optgroup label="Personas">${hacen.filter((p) => aOtros || p.id === yo.id || p.id === actual).map((p) => `<option value="${esc(p.id)}" ${p.id === actual ? "selected" : ""}>${esc(etiquetaPersona(p, yo))}</option>`).join("")}</optgroup>
    ${turnos.length ? `<optgroup label="Todo un turno">${turnos.map((t) => `<option value="turno:${esc(t)}" ${actual === `turno:${t}` ? "selected" : ""}>Turno ${esc(t)} (le toca a quien esté)</option>`).join("")}</optgroup>` : ""}`;
}

export function filaTarea(d, t, hoy, { mostrarQuien = true } = {}) {
  const tarde = t.estado !== "hecha" && t.vence && t.vence < hoy;
  const hall = t.hallazgo_id && d.hallazgos.find((h) => h.id === t.hallazgo_id);
  const detalles = [
    t.vence ? `<span class="${tarde ? "tarde" : ""}">${icono("reloj", "ico chico")} ${t.vence === hoy ? "Hoy" : t.vence === sumarDias(hoy, 1) ? "Mañana" : esc(fechaCorta(t.vence))}</span>` : "",
    t.equipo_id ? `<span>${esc(nombreCompleto(d, t.equipo_id))}</span>` : "",
    mostrarQuien && t.asignada_a ? `<span>${esc(paraQuien(d, t.asignada_a))}</span>` : "",
    t.inspeccion_id ? `<span>${icono("inspecciones", "ico chico")} de una inspección</span>` : "",
    hall ? `<span>${icono("hallazgos", "ico chico")} ${numeroHallazgo(hall)}</span>` : "",
    t.estado === "en_curso" ? `<span style="color:var(--tinte);font-weight:600">En curso</span>` : "",
    t.estado === "hecha" && t.hecha_por ? `<span>Hecha por ${esc(paraQuien(d, t.hecha_por))}</span>` : "",
  ].filter(Boolean).join("");
  return `<li class="${t.estado === "hecha" ? "hecha" : ""}" data-tarea="${esc(t.id)}">
    <button type="button" class="check-tarea${t.prioridad === "alta" && t.estado !== "hecha" ? " alta" : ""}" ${d.yo && !puedeTocar(d.yo, t) ? "disabled" : ""} role="checkbox" aria-checked="${t.estado === "hecha"}" aria-label="Marcar «${esc(t.titulo)}» como hecha">${CHECK}</button>
    <a class="que" href="#/tarea/${encodeURIComponent(t.id)}"><b>${esc(t.titulo)}</b>${detalles ? `<small>${detalles}</small>` : ""}</a>
    <span class="lado">${t._sinEnviar ? marcaSinEnviar() : ""}${t.prioridad === "alta" && t.estado !== "hecha" ? `<span class="marca alta">Alta</span>` : ""}${t.fotos?.length ? icono("camara", "ico chico") : ""}</span>
  </li>`;
}

/** Marcar o desmarcar desde la lista: anima, y cuando termina, entra a la cola (y avisa con «Deshacer»). */
export function montarChecks(m, d) {
  m.addEventListener("click", (e) => {
    const b = e.target.closest(".check-tarea");
    if (!b) return;
    const li = b.closest("[data-tarea]");
    const t = d.tareas.find((x) => x.id === li.dataset.tarea);
    if (!t) return;
    const hecha = b.getAttribute("aria-checked") !== "true";
    b.setAttribute("aria-checked", String(hecha));
    li.classList.toggle("hecha", hecha);
    navigator.vibrate?.(hecha ? [8, 30, 8] : 8);
    const mandar = (estado) => api.encolar(`tareas/${encodeURIComponent(t.id)}`, { estado, fecha: new Date().toISOString() }).catch((x) => aviso(x.message, { error: true }));
    setTimeout(() => {
      if (hecha) li.classList.add("saliendo");
      setTimeout(() => {
        mandar(hecha ? "hecha" : "pendiente");
        if (hecha) aviso("Tarea hecha.", { accion: { texto: "Deshacer", alTocar: () => mandar(t.estado === "hecha" ? "pendiente" : t.estado) } });
      }, hecha ? 280 : 0);
    }, hecha ? 520 : 0);
  });
}

export function vistaTareas({ d, yo, hoy, query }) {
  const aOtros = puede(yo, "tareas"), editar = puede(yo, "editar");
  const f = query.get("f") ?? (editar ? "mias" : "todas"); // quien solo ve no tiene tareas suyas
  const verHechas = query.get("hechas") === "1";
  const b = normal(query.get("b") ?? "");
  const fam = familia(d, query.get("eq"));
  const todas = d.tareas ?? [];
  const pasa = (t) => (f === "todas" || (f === "mias" && esMia(t, yo)) || (f === "pedidas" && t.creada_por === yo.id))
    && enFiltro(fam, t.equipo_id) && (!b || normal(`${t.titulo} ${t.detalle} ${nombreCompleto(d, t.equipo_id)} ${paraQuien(d, t.asignada_a)}`).includes(b));
  const xs = todas.filter(pasa);
  const abiertas = xs.filter((t) => t.estado !== "hecha").sort((a, c) => (a.vence ?? "9").localeCompare(c.vence ?? "9") || ({ alta: 0, media: 1, baja: 2 }[a.prioridad] - { alta: 0, media: 1, baja: 2 }[c.prioridad]));
  const hechas = xs.filter((t) => t.estado === "hecha").sort((a, c) => (c.hecha_en ?? "").localeCompare(a.hecha_en ?? ""));
  const grupos = [
    ["Atrasadas", abiertas.filter((t) => t.vence && t.vence < hoy), "roja"],
    ["Hoy", abiertas.filter((t) => t.vence === hoy)],
    ["Próximas", abiertas.filter((t) => t.vence && t.vence > hoy)],
    ["Sin fecha", abiertas.filter((t) => !t.vence)],
  ].filter(([, g]) => g.length);
  const cuenta = (id) => todas.filter((t) => t.estado !== "hecha" && (id === "mias" ? esMia(t, yo) : id === "pedidas" ? t.creada_por === yo.id : true)).length;
  const enlace = (c) => `#/tareas?${new URLSearchParams({ ...Object.fromEntries(query), ...c })}`;
  const chip = (id, texto) => `<a href="${enlace({ f: id })}" ${f === id ? 'aria-current="true"' : ""}>${texto}${cuenta(id) ? ` <b>${cuenta(id)}</b>` : ""}</a>`;
  const lista = () => `${grupos.length ? grupos.map(([t, g]) => `<section class="seccion"><h2${t === "Atrasadas" ? ' style="color:var(--rojo)"' : ""}>${t} <small>${g.length}</small></h2>
      <ul class="lista-tareas">${g.map((x) => filaTarea(d, x, hoy, { mostrarQuien: f !== "mias" })).join("")}</ul></section>`).join("")
    : vacio(b || fam ? "Ninguna tarea con ese filtro." : f === "mias" ? "No tienes tareas pendientes." : "No hay tareas pendientes.")}
    ${hechas.length ? `<section class="seccion"><h2>Hechas <small>${hechas.length}</small> <a class="boton mini plano" href="${enlace({ hechas: verHechas ? "0" : "1" })}" style="margin-left:auto">${verHechas ? "Ocultar" : "Mostrar"}</a></h2>
      ${verHechas ? `<ul class="lista-tareas">${hechas.slice(0, 60).map((x) => filaTarea(d, x, hoy)).join("")}</ul>` : ""}</section>` : ""}`;
  return {
    titulo: "Tareas",
    html: `<div class="cabeza"><div><h1>Tareas</h1>
        <p class="bajada">${abiertas.length ? `${plural(abiertas.length, "pendiente", "pendientes")}${grupos.find(([t]) => t === "Atrasadas") ? `, ${grupos.find(([t]) => t === "Atrasadas")[1].length} atrasada${grupos.find(([t]) => t === "Atrasadas")[1].length === 1 ? "" : "s"}` : ""}.` : "Todo al día."}
          Se le asignan a una persona o a todo un turno, y funcionan sin señal.</p></div>
        ${editar ? `<div class="acciones"><a class="boton primario" href="#/tarea/nueva">${icono("mas1")}Nueva tarea</a></div>` : ""}</div>
      ${editar ? `<form class="alta-rapida" data-rapida><span class="mas-redondo">${icono("mas1")}</span>
        <input type="text" name="titulo" placeholder="Agregar una tarea${aOtros ? "" : " para mí"}…" aria-label="Agregar una tarea" autocomplete="off" enterkeyhint="done"></form>` : ""}
      ${barraFiltros(d, query, { placeholder: "Buscar tareas", extra: `<nav class="filtros" style="margin:0">${chip("mias", "Mías")}${chip("pedidas", "Que pedí")}${chip("todas", "Todas")}</nav>` })}
      <div data-lista>${lista()}</div>`,
    montar(m) {
      montarChecks(m, d);
      montarFiltros(m, d, { ruta: "tareas", alCambiar: (q) => {
        const v = vistaTareas({ d: api.obtener(), yo, hoy, query: q });
        const tmp = document.createElement("div");
        tmp.innerHTML = v.html;
        m.querySelector("[data-lista]").replaceWith(tmp.querySelector("[data-lista]"));
      } });
      const rapida = m.querySelector("[data-rapida]");
      rapida?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const titulo = rapida.titulo.value.trim();
        if (!titulo) return;
        rapida.titulo.value = "";
        try {
          await api.encolar("tareas", { id: crypto.randomUUID(), titulo, asignada_a: yo.id, equipo_id: query.get("eq") || null, fecha: new Date().toISOString() });
          aviso("Tarea agregada.");
        } catch (x) { aviso(x.message, { error: true }); }
      });
    },
    ocupada: () => !!document.querySelector(".lista-tareas li.saliendo"),
  };
}

// ------------------------------------------------------------------------------- una tarea (o nueva)

/** La tarea para quien no la puede cambiar: lo mismo que el formulario, en limpio. */
function soloVer(d, t, hoy) {
  const tarde = t.estado !== "hecha" && t.vence && t.vence < hoy;
  return `<div class="panel">
      ${t.detalle ? `<p class="texto-largo" style="margin:0">${esc(t.detalle)}</p>` : ""}
      <dl class="datos-insp">
        <dt>En qué va</dt><dd>${esc(TEXTO_ESTADO_TAREA[t.estado])}</dd>
        <dt>A quién</dt><dd>${esc(paraQuien(d, t.asignada_a))}</dd>
        ${t.equipo_id ? `<dt>Equipo</dt><dd>${esc(nombreCompleto(d, t.equipo_id))}</dd>` : ""}
        ${t.vence ? `<dt>Para cuándo</dt><dd style="${tarde ? "color:var(--rojo)" : ""}">${esc(fechaCorta(t.vence))}</dd>` : ""}
        <dt>Prioridad</dt><dd>${esc(TEXTO_PRIORIDAD[t.prioridad] ?? t.prioridad)}</dd>
        ${t.estado === "hecha" && t.nota_cierre ? `<dt>Cómo quedó</dt><dd>${esc(t.nota_cierre)}</dd>` : ""}</dl>
      ${galeria(t.fotos ?? [])}
      <p class="ayuda">${icono("candado", "ico chico")} La cambian quien la pidió, a quien se la asignaron o un supervisor.</p></div>`;
}

export function vistaTarea({ d, yo, hoy, param, query, ir }) {
  const nueva = param === "nueva";
  const t = nueva ? null : (d.tareas ?? []).find((x) => x.id === param);
  if (!nueva && !t) return { titulo: "No está", atras: "#/tareas", html: vacio("Esa tarea no existe (¿la borraron?).", `<a class="boton" href="#/tareas">Ver las tareas</a>`) };
  const hall = (t?.hallazgo_id ?? query.get("hallazgo")) && d.hallazgos.find((h) => h.id === (t?.hallazgo_id ?? query.get("hallazgo")));
  const insp = t?.inspeccion_id && d.inspecciones.find((i) => i.id === t.inspeccion_id);
  const T = t ?? { titulo: hall ? (hall.accion || `Resolver: ${hall.descripcion}`) : "", detalle: "", equipo_id: query.get("equipo") ?? hall?.equipo_id ?? null,
    asignada_a: hall?.responsable_id ?? yo.id, vence: hall?.vence ?? null, prioridad: hall?.prioridad ?? "media", estado: "pendiente", fotos: [], hallazgo_id: hall?.id ?? null };
  if (nueva && !puede(yo, "editar")) return { titulo: "Nueva tarea", atras: "#/tareas", html: vacio("Tu usuario es de solo ver: las tareas las crea quien tiene permiso de editar.") };
  const solo = !nueva && !puedeTocar(yo, t);
  const puedeBorrar = !nueva && puede(yo, "editar") && (esAdmin(yo) || t.creada_por === yo.id);
  const nuevas = [];
  let estado = T.estado, prioridad = T.prioridad;
  return {
    titulo: nueva ? "Nueva tarea" : T.titulo,
    tituloCorto: nueva ? "Nueva tarea" : "Tarea",
    atras: "#/tareas",
    viva: false,
    html: `<div class="cabeza"><div><div class="migas"><a href="#/tareas">Tareas</a>${!nueva ? `<span>· pedida por ${esc(nombre(d, t.creada_por))}, ${esc(fechaHora(t.creada))}</span>` : ""}</div>
        <h1>${nueva ? "Nueva tarea" : esc(T.titulo)}</h1></div>
        ${!nueva && t._sinEnviar ? marcaSinEnviar() : ""}</div>
      <div class="hoja-insp">
        ${solo ? soloVer(d, T, hoy) : `<form class="panel" id="form-tarea" novalidate>
          <div class="campo"><label for="t-titulo">Qué hay que hacer</label><input id="t-titulo" type="text" value="${esc(T.titulo)}" placeholder="Por ejemplo: cambiar el manómetro del acumulador 2" style="font-size:19px;font-weight:600"></div>
          <div class="campo"><label for="t-detalle">Detalle <small>(opcional)</small></label><textarea id="t-detalle" style="min-height:80px" placeholder="Cómo, con qué, dónde…">${esc(T.detalle ?? "")}</textarea></div>
          <div class="rejilla-campos dos">
            <div class="campo"><span class="rotulo">Equipo <small>(opcional)</small></span>${campoEquipo(d, { id: "t-equipo", valor: T.equipo_id ?? "", titulo: "Equipo de la tarea", placeholder: "Ninguno", todos: "Ninguno" })}</div>
            <div class="campo"><label for="t-quien">A quién</label><select id="t-quien"><option value="">Sin asignar</option>${opcionesQuien(d, yo, T.asignada_a)}</select></div>
            <div class="campo"><label for="t-vence">Para cuándo <small>(opcional)</small></label><input id="t-vence" type="date" value="${esc(T.vence ?? "")}"></div>
            <div class="campo"><span class="rotulo">Prioridad</span><div class="segmento" role="group" aria-label="Prioridad" data-prioridad>${["alta", "media", "baja"].map((p) => `<button type="button" data-valor="${p}" aria-pressed="${prioridad === p}">${TEXTO_PRIORIDAD[p]}</button>`).join("")}</div></div>
          </div>
          ${nueva ? "" : `<div class="campo"><span class="rotulo">En qué va</span><div class="segmento" role="group" aria-label="Estado" data-estado>${["pendiente", "en_curso", "hecha"].map((s) => `<button type="button" data-valor="${s === "hecha" ? "ok" : s === "en_curso" ? "en_proceso" : "pendiente"}" data-e="${s}" aria-pressed="${estado === s}">${TEXTO_ESTADO_TAREA[s]}</button>`).join("")}</div></div>
          <div class="campo" data-zona-cierre ${estado === "hecha" ? "" : "hidden"}><label for="t-cierre">Cómo quedó <small>(opcional)</small></label><textarea id="t-cierre" style="min-height:70px">${esc(T.nota_cierre ?? "")}</textarea></div>`}
          <div class="campo"><span class="rotulo">Fotos</span><div class="herramientas-item">${botonesMedio("tarea")}</div>${galeria(T.fotos ?? [])}<div data-galeria-nueva></div></div>
          <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>
          <div class="herramientas-item"><button class="boton primario" type="submit">${icono("bien")}${nueva ? "Agregar" : "Guardar"}</button>
            ${puedeBorrar ? `<button type="button" class="boton plano peligro" data-borrar>${icono("basura")}Borrar</button>` : ""}</div>
        </form>`}
        <aside class="panel">
          ${hall ? `<div><span class="rotulo">Sale del hallazgo</span><p style="margin-top:6px"><a href="#/hallazgo/${encodeURIComponent(hall.id)}"><span class="mono">${numeroHallazgo(hall)}</span> ${esc(hall.descripcion)}</a></p></div>` : ""}
          ${insp ? `<div><span class="rotulo">Va con la inspección</span><p style="margin-top:6px"><a href="#/inspeccion/${encodeURIComponent(insp.id)}">${esc(insp.estado === "hecha" ? "Ver la inspección hecha" : "Abrir la inspección")}</a> · se marca al llenarla.</p></div>` : ""}
          ${!nueva ? `<dl class="datos-insp"><dt>Pidió</dt><dd>${esc(nombre(d, t.creada_por))}</dd><dt>El</dt><dd>${esc(fechaHora(t.creada))}</dd>
            ${t.estado === "hecha" ? `<dt>Hizo</dt><dd>${esc(nombre(d, t.hecha_por))}</dd><dt>El</dt><dd>${esc(fechaHora(t.hecha_en))}</dd>` : ""}
            ${t.vence && t.estado !== "hecha" ? `<dt>Vence</dt><dd style="${t.vence < hoy ? "color:var(--rojo)" : ""}">${esc(fechaCorta(t.vence))}${t.vence < hoy ? ` (hace ${plural(diasEntre(t.vence, hoy), "día", "días")})` : ""}</dd>` : ""}</dl>` : `<p class="ayuda">Le llega un aviso a quien se la asignes. Si es para un turno, le toca a quien esté.</p>`}
        </aside>
      </div>`,
    montar(m) {
      const f = m.querySelector("#form-tarea");
      if (!f) return;
      if (nueva) setTimeout(() => f["t-titulo"].focus({ preventScroll: true }), 300);
      f.addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.closest("[data-prioridad]") && b.dataset.valor) { prioridad = b.dataset.valor; b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
        if (b.closest("[data-estado]") && b.dataset.e) {
          estado = b.dataset.e;
          b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          m.querySelector("[data-zona-cierre]").hidden = estado !== "hecha";
        }
        if (b.dataset.quitar) { nuevas.splice(nuevas.indexOf(b.dataset.quitar), 1); m.querySelector("[data-galeria-nueva]").innerHTML = galeria(nuevas, { quitar: true }); }
        if (b.hasAttribute("data-borrar")) {
          if (!(await confirmar("¿Borrar la tarea?", "Se quita para todos.", "Borrar", "peligro"))) return;
          try { await api.escribir(`tareas/${encodeURIComponent(t.id)}/borrar`, {}); aviso("Tarea borrada."); ir("#/tareas"); }
          catch (x) { aviso(x.sinRed ? "Para borrar hace falta señal." : x.message, { error: true }); }
        }
      });
      f.addEventListener("change", async (e) => {
        const el = e.target;
        if (!el.dataset.medioDe || !el.files?.length) return;
        for (const a of [...el.files]) {
          try { nuevas.push(await api.guardarMedio(await prepararArchivo(a), a.name)); } catch (x) { aviso(x.message, { error: true }); }
        }
        el.value = "";
        m.querySelector("[data-galeria-nueva]").innerHTML = galeria(nuevas, { quitar: true });
      });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = f.querySelector(".error-form");
        const titulo = f["t-titulo"].value.trim();
        if (!titulo) { err.hidden = false; err.textContent = "Escribe qué hay que hacer."; f["t-titulo"].focus(); return; }
        const id = t?.id ?? crypto.randomUUID();
        const datos = {
          titulo, detalle: f["t-detalle"].value, equipo_id: f["t-equipo"].value || null, asignada_a: f["t-quien"].value || null, vence: f["t-vence"].value || null,
          prioridad, fotos: nuevas, fecha: new Date().toISOString(),
          ...(nueva ? { id, hallazgo_id: T.hallazgo_id ?? null } : { estado, nota_cierre: f["t-cierre"]?.value ?? "" }),
        };
        const boton = f.querySelector("button[type=submit]");
        boton.disabled = true;
        try {
          await Promise.race([api.encolar(nueva ? "tareas" : `tareas/${encodeURIComponent(id)}`, datos), new Promise((ok) => setTimeout(ok, 5000))]);
          aviso(nueva ? "Tarea agregada." : "Guardado.");
          ir(nueva && T.hallazgo_id ? `#/hallazgo/${encodeURIComponent(T.hallazgo_id)}` : "#/tareas");
        } catch (x) {
          boton.disabled = false;
          err.hidden = false;
          err.textContent = `No se pudo guardar: ${x.message}`;
        }
      });
    },
  };
}
