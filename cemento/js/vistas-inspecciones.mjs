// Inspecciones: la lista, asignar una (o una ronda de varios colectores) y llenarla (o verla, si ya está hecha).
import { esc, icono, fechaCorta, fechaHora, sumarDias, plural, numero, diasEntre, normal, leerNumero } from "./util.mjs";
import * as api from "./api.mjs";
import {
  aviso, dialogo, confirmar, filaInspeccion, vacio, equipo, plantilla, persona, nombre, nombreCorto, nombreEquipo, queInspeccion,
  equiposDe, esAdmin, puede, etiquetaPersona, marcaVence, marcaPrioridad, galeria, botonesMedio, marcaSinEnviar, segmentoTipoDano, textoTurno,
} from "./ui.mjs";
import { prepararArchivo, dictar, hayDictado } from "./medios.mjs";
import { barraFiltros, montarFiltros, familia, enFiltro, nombreCompleto, campoEquipo, escanear, equipoDelQr, pedirFirma, equipoDe } from "./componentes.mjs";
import { opcionesQuien, paraQuien } from "./vistas-tareas.mjs";

const reducir = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------------------------- lista

export function vistaInspecciones({ d, yo, hoy, query }) {
  const admin = puede(yo, "asignar");
  const f = query.get("f") ?? (admin ? "todas" : "mias");
  const buscar = query.get("b") ?? "";
  const fam = familia(d, query.get("eq"));
  const turno = yo.turno ? `turno:${yo.turno}` : "-";
  let xs = d.inspecciones.filter((i) => enFiltro(fam, equiposDe(i)));
  if (f === "mias") xs = xs.filter((i) => i.asignada_a === yo.id || (i.asignada_a === turno || i.asignada_a === "todos") || i.hecha_por === yo.id);
  if (f === "atrasadas") xs = xs.filter((i) => i.estado === "pendiente" && i.vence < hoy);
  if (f === "hechas") xs = xs.filter((i) => i.estado === "hecha");
  if (f === "revisar") xs = xs.filter((i) => i.estado === "hecha" && !i.revisada_en);
  if (buscar) {
    const b = normal(buscar);
    xs = xs.filter((i) => normal(`${queInspeccion(d, i)} ${plantilla(d, i.plantilla_id)?.nombre} ${paraQuien(d, i.asignada_a)} ${equiposDe(i).map((e) => nombreCompleto(d, e)).join(" ")}`).includes(b));
  }
  const pend = xs.filter((i) => i.estado === "pendiente").sort((a, b) => a.vence.localeCompare(b.vence));
  const grupos = [
    ["Atrasadas", pend.filter((i) => i.vence < hoy)],
    ["Hoy", pend.filter((i) => i.vence === hoy)],
    ["Próximas", pend.filter((i) => i.vence > hoy)],
    ["Hechas", xs.filter((i) => i.estado === "hecha" && (f === "hechas" || f === "revisar" || buscar || diasEntre((i.hecha_en ?? "").slice(0, 10) || hoy, hoy) <= 45))
      .sort((a, b) => (b.hecha_en ?? "").localeCompare(a.hecha_en ?? ""))],
  ].filter(([, g]) => g.length);
  const cuenta = (filtro) => {
    if (filtro === "mias") return d.inspecciones.filter((i) => i.estado === "pendiente" && (i.asignada_a === yo.id || (i.asignada_a === turno || i.asignada_a === "todos"))).length;
    if (filtro === "atrasadas") return d.inspecciones.filter((i) => i.estado === "pendiente" && i.vence < hoy).length;
    if (filtro === "revisar") return d.inspecciones.filter((i) => i.estado === "hecha" && !i.revisada_en).length;
    return null;
  };
  const filtro = (id, texto) => {
    const n = cuenta(id);
    return `<a href="#/inspecciones?${new URLSearchParams({ ...Object.fromEntries(query), f: id })}" ${f === id ? 'aria-current="true"' : ""}>${texto}${n ? ` <b>${n}</b>` : ""}</a>`;
  };
  return {
    titulo: "Inspecciones",
    atras: matchMedia("(max-width: 899px)").matches ? "#/tareas" : null,
    html: `<div class="cabeza"><div><h1>Inspecciones</h1>
        <p class="bajada">${admin ? "Las que asignaste, de todos." : "Las que te asignaron. Tócala para llenarla."}</p></div>
        ${admin ? `<div class="acciones"><a class="boton primario" href="#/asignar">${icono("mas1")}Asignar</a></div>` : ""}</div>
      ${barraFiltros(d, query, { placeholder: "Buscar por equipo, tag o persona" })}
      <nav class="filtros" aria-label="Filtrar">${filtro("mias", "Mías")}${filtro("todas", "Todas")}${filtro("atrasadas", "Atrasadas")}${puede(yo, "revisar") ? filtro("revisar", "Por revisar") : ""}${filtro("hechas", "Hechas")}</nav>
      <div data-resultados>${grupos.length
        ? grupos.map(([t, g]) => `<section class="seccion"><h2>${t} <small>${g.length}</small></h2><ul class="lista">${g.map((i) => filaInspeccion(d, i, hoy, { mostrarQuien: f !== "mias" })).join("")}</ul></section>`).join("")
        : vacio(buscar || fam ? "Nada con ese filtro." : f === "atrasadas" ? "Nada atrasado." : f === "mias" ? "No tienes inspecciones asignadas." : "No hay inspecciones.", admin && !buscar ? `<a class="boton chico" href="#/asignar">${icono("mas1")}Asignar una</a>` : "")}</div>`,
    montar(m) {
      montarFiltros(m, d, { ruta: "inspecciones", alCambiar: (q) => {
        const v = vistaInspecciones({ d: api.obtener(), yo, hoy, query: q });
        const tmp = document.createElement("div");
        tmp.innerHTML = v.html;
        m.querySelector("[data-resultados]").replaceWith(tmp.querySelector("[data-resultados]"));
        m.querySelector("nav.filtros").replaceWith(tmp.querySelector("nav.filtros"));
      } });
    },
  };
}

// ------------------------------------------------------------------------------- asignar

const REPETIR = [[0, "Una sola vez"], [1, "Cada día"], [7, "Cada semana"], [15, "Cada 15 días"], [30, "Cada mes"], [60, "Cada 2 meses"]];

export function vistaAsignar({ d, yo, hoy, query, ir }) {
  if (!puede(yo, "asignar")) return { titulo: "Asignar", atras: "#/tablero", html: vacio("Asignar inspecciones no está entre tus permisos: lo da el administrador.") };
  // Lo que se asigna es lo que se escribe como tareas (Eduardo, 30-oct-2026: «quita "qué revisar", al final lo coloca
  // como tarea»). Solo si se llega desde un enlace con una plantilla (la ronda de colectores) van además sus revisiones.
  let plFija = plantilla(d, query.get("plantilla")) ?? null;
  const elegidosInicial = [...new Set((query.get("equipos") ?? "").split(",").filter(Boolean))];
  // la ronda de colectores: los que vengan en el enlace o, si no, todos los activos
  const ronda = plFija?.tipo_equipo
    ? (elegidosInicial.length ? elegidosInicial : d.equipos.filter((e) => e.tipo === plFija.tipo_equipo && e.activo && !e.padre_id).map((e) => e.id)) : null;
  let eqId = query.get("equipo") && query.get("equipo") !== "colectores" ? query.get("equipo") : plFija?.equipo_id ?? ronda?.[0] ?? elegidosInicial[0] ?? "";
  const vence = query.get("vence") ?? hoy;
  const tareas = []; // { id, titulo, equipo_id }
  const conPlantilla = () => (plFija ? `<p class="ayuda" data-con-plantilla style="margin:0 2px 6px">Lleva las ${plural(plFija.items.filter((x) => x.tipo !== "texto").length, "revisión", "revisiones")} de «${esc(plFija.nombre)}»${ronda ? ` en ${plural(ronda.length, "colector", "colectores")}` : ""}; lo que agregues aquí va además.</p>` : "");
  const subequipos = () => (eqId ? d.equipos.filter((e) => e.padre_id === eqId && e.activo) : []);
  const htmlTareas = () => tareas.length ? `<ul class="lista-tareas" style="margin-top:8px">${tareas.map((t, k) => `<li><span class="check-tarea" aria-hidden="true"></span>
      <span class="que"><b>${esc(t.titulo)}</b>${t.equipo_id ? `<small><span>${esc(nombreCompleto(d, t.equipo_id))}</span></small>` : ""}</span>
      <span class="lado"><button type="button" class="boton-icono" data-quitar-tarea="${k}" aria-label="Quitar la tarea">${icono("mal")}</button></span></li>`).join("")}</ul>` : "";
  return {
    titulo: "Asignar inspección",
    atras: "#/inspecciones",
    viva: false,
    html: `<div class="cabeza"><div><h1>Asignar inspección</h1>
        <p class="bajada">Le aparece en su tablero y le llega un aviso. Si se repite, al terminarla queda programada la siguiente (con las tareas que no se hicieron).</p></div></div>
      <form class="panel" id="form-asignar" novalidate style="max-width:760px">
        ${ronda ? `<div class="campo"><span class="rotulo">Equipos</span><p style="margin:0">${esc(plFija.nombre)}: ${esc(ronda.map((id) => equipoDe(d, id)?.tag || equipoDe(d, id)?.nombre || id).join(", "))}</p></div>`
          : `<div class="campo" data-zona-equipo><span class="rotulo">Equipo</span>${campoEquipo(d, { id: "a-equipo", valor: eqId, titulo: "Qué equipo", placeholder: "Elegir el equipo" })}</div>`}
        <div class="rejilla-campos dos alineados">
          <div class="campo"><label for="a-quien">A quién</label><select id="a-quien">${opcionesQuien(d, yo, query.get("quien") ?? "", { elegir: true })}</select></div>
          <div class="campo"><label for="a-vence">Para cuándo</label><input id="a-vence" type="date" value="${esc(vence)}" min="${sumarDias(hoy, -30)}"></div>
        </div>
        <p class="ayuda" style="margin:-8px 2px 0">A un turno: le toca a quien esté de turno. A todos: la hace el primero que pueda, y queda a su nombre.</p>
        <div class="rejilla-campos dos alineados">
          <div class="campo"><label for="a-repetir">Se repite</label>
            <select id="a-repetir">${REPETIR.map(([n, t]) => `<option value="${n}">${t}</option>`).join("")}</select>
            <span class="ayuda" id="a-sugerida"></span></div>
        </div>
        <div class="campo"><span class="rotulo">Qué tiene que hacer</span>${conPlantilla()}
          <div style="display:flex;gap:8px;flex-wrap:wrap"><input type="text" id="a-tarea" placeholder="Por ejemplo: medir la holgura en el punto 3" style="flex:1 1 260px" enterkeyhint="done">
            <select id="a-tarea-sub" style="flex:0 1 220px" ${subequipos().length ? "" : "hidden"}><option value="">Todo el equipo</option>${subequipos().map((e) => `<option value="${esc(e.id)}">${esc(e.tag ? `${e.tag} · ${e.nombre}` : e.nombre)}</option>`).join("")}</select>
            <button type="button" class="boton chico" data-agregar-tarea>${icono("mas1")}Agregar</button></div>
          <div data-tareas>${htmlTareas()}</div></div>
        <div class="campo"><label for="a-nota">Nota para quien la hace <small>(opcional)</small></label>
          <textarea id="a-nota" placeholder="Por ejemplo: aprovechar el paro del viernes"></textarea></div>
        <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>
        <div><button class="boton primario" type="submit">${icono("bien")}Asignar</button></div>
      </form>`,
    montar(m) {
      const f = m.querySelector("#form-asignar");
      const selRep = f.querySelector("#a-repetir");
      const sugerir = () => {
        const p = plFija;
        const n = p?.frecuencia_dias ?? 0;
        selRep.value = String(REPETIR.find(([k]) => k === n) ? n : 0);
        f.querySelector("#a-sugerida").textContent = p?.frecuencia_dias ? `La plantilla sugiere cada ${p.frecuencia_dias === 1 ? "día" : `${p.frecuencia_dias} días`}.` : "";
      };
      const pintarSub = () => {
        const sel = f.querySelector("#a-tarea-sub");
        const subs = subequipos();
        sel.hidden = !subs.length;
        sel.innerHTML = `<option value="">Todo el equipo</option>${subs.map((e) => `<option value="${esc(e.id)}">${esc(e.tag ? `${e.tag} · ${e.nombre}` : e.nombre)}</option>`).join("")}`;
      };
      f.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.hasAttribute("data-agregar-tarea")) agregarTarea();
        if (b.dataset.quitarTarea != null) { tareas.splice(Number(b.dataset.quitarTarea), 1); f.querySelector("[data-tareas]").innerHTML = htmlTareas(); }
      });
      const agregarTarea = () => {
        const i = f.querySelector("#a-tarea");
        const titulo = i.value.trim();
        if (!titulo) return i.focus();
        tareas.push({ id: crypto.randomUUID(), titulo, equipo_id: f.querySelector("#a-tarea-sub").value || null });
        i.value = "";
        f.querySelector("[data-tareas]").innerHTML = htmlTareas();
        i.focus();
      };
      f.querySelector("#a-tarea").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); agregarTarea(); } });
      f.addEventListener("change", (e) => {
        if (e.target.id === "a-equipo") {
          eqId = e.target.value;
          // la plantilla del enlace era de otro equipo: ya no va
          if (plFija && plFija.equipo_id !== eqId) { plFija = null; f.querySelector("[data-con-plantilla]")?.remove(); sugerir(); }
          pintarSub();
        }
      });
      sugerir();
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = f.querySelector(".error-form");
        const fallo = (t) => { err.hidden = false; err.textContent = t; };
        if (!eqId) return fallo(ronda ? "No hay colectores activos para la ronda." : "Elige el equipo.");
        // lo escrito sin tocar «Agregar» también cuenta
        const pendiente = f.querySelector("#a-tarea").value.trim();
        if (!plFija && !tareas.length && !pendiente) return fallo("Escribe por lo menos una cosa que tiene que hacer.");
        if (!f["a-quien"].value) return fallo("Elige a quién se le asigna.");
        if (pendiente) { tareas.push({ id: crypto.randomUUID(), titulo: pendiente, equipo_id: f.querySelector("#a-tarea-sub").value || null }); f.querySelector("#a-tarea").value = ""; }
        const equipos = ronda ?? undefined;
        const boton = f.querySelector("button[type=submit]");
        boton.disabled = true;
        const datos = { id: crypto.randomUUID(), plantilla_id: plFija?.id ?? "", equipo_id: eqId, asignada_a: f["a-quien"].value, vence: f["a-vence"].value, repetir_dias: Number(selRep.value) || null,
          nota: f["a-nota"].value, equipos, tareas };
        try {
          await api.escribir("inspecciones", datos);
          const dd = api.obtener();
          const insp = dd.inspecciones.find((i) => i.id === datos.id) ?? { ...datos, equipo_id: plantilla(dd, datos.plantilla_id)?.equipo_id ?? equipos?.[0] };
          const r = await dialogo({
            titulo: "Asignada",
            html: `<p>${esc([queInspeccion(dd, insp), plantilla(dd, datos.plantilla_id)?.nombre].filter(Boolean).join(" · "))} para ${esc(paraQuien(dd, datos.asignada_a))}, para el ${esc(fechaCorta(datos.vence))}${tareas.length ? `, con ${plural(tareas.length, "tarea", "tareas")}` : ""}.
              ${datos.asignada_a === yo.id ? "" : "Le aparece en su tablero y le llega un aviso."}</p>`,
            botones: [{ texto: "Asignar otra", valor: "otra" }, { texto: "Avisar por WhatsApp", valor: "wa", icono: "whatsapp" }, { texto: "Listo", valor: "listo", clase: "primario" }],
          });
          if (r === "wa") abrirWhatsApp(mensajeAsignacion(dd, insp));
          if (r === "otra") ir(`#/asignar?vence=${datos.vence}`);
          else ir("#/tareas");
        } catch (x) {
          fallo(x.sinRed ? "Para asignar hace falta señal. Prueba cuando tengas conexión." : x.message);
          boton.disabled = false;
        }
      });
    },
  };
}

function mensajeAsignacion(d, insp) {
  const pl = plantilla(d, insp.plantilla_id);
  const url = `${location.origin}${location.pathname}#/inspeccion/${encodeURIComponent(insp.id)}`;
  const ts = (d.tareas ?? []).filter((t) => t.inspeccion_id === insp.id);
  return `Te asigné una inspección: ${[queInspeccion(d, insp), pl?.nombre].filter(Boolean).join(" · ")}, para el ${fechaCorta(insp.vence)}.${ts.length ? `\nTareas: ${ts.map((t) => t.titulo).join("; ")}.` : ""}${insp.nota ? `\nNota: ${insp.nota}` : ""}\n${url}`;
}

export function abrirWhatsApp(texto) {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
}

// ------------------------------------------------------------------------------- una inspección

export function vistaInspeccion(ctx) {
  const { d, param } = ctx;
  const insp = d.inspecciones.find((i) => i.id === param);
  if (!insp) return { titulo: "No está", atras: "#/inspecciones", html: vacio("Esa inspección no existe: puede que la hayan borrado.", `<a class="boton" href="#/inspecciones">Ver las inspecciones</a>`) };
  return insp.estado === "hecha" ? verHecha(ctx, insp) : puede(ctx.yo, "editar") ? llenar(ctx, insp) : porHacer(ctx, insp);
}

/** Una pendiente vista por alguien de solo ver: qué se va a revisar, de quién es y para cuándo. */
function porHacer({ d, yo, hoy, ir }, insp) {
  const items = plantilla(d, insp.plantilla_id)?.items ?? [];
  const ids = equiposDe(insp);
  return {
    titulo: plantilla(d, insp.plantilla_id)?.nombre ?? "Inspección",
    tituloCorto: ids.length > 1 ? "Ronda de colectores" : equipo(d, ids[0])?.nombre ?? "Inspección",
    atras: "#/tareas",
    html: `${cabeceraInspeccion(d, insp, hoy)}
      <div class="hoja-insp">
        <div><p style="margin:0 4px 12px;color:var(--tinta-3)">${icono("candado", "ico chico")} Todavía no se ha hecho. La llena ${esc(nombreCorto(d, insp.asignada_a))}; tú la ves.</p>
          <ul class="resultados">${porSubequipo(items).map(([sub, its]) => `${sub ? `<li class="titulo-equipo" style="font-size:14px">${esc(equipo(d, sub)?.tag ? `${equipo(d, sub).tag} · ` : "")}<span style="font-family:var(--letra)">${esc(equipo(d, sub)?.nombre ?? "")}</span></li>` : ""}${its.map((it) => `<li><span class="que">${esc(it.texto)}</span><span class="valor">${it.tipo === "medida" ? `<span class="ayuda">${esc(textoRango(it))}</span>` : ""}</span></li>`).join("")}`).join("")}</ul></div>
        <aside class="panel">${datosInspeccion(d, insp)}
          ${puede(yo, "asignar") ? `<div class="herramientas-item">
            <button type="button" class="boton chico" data-accion="recordar">${icono("campana")}Recordar</button>
            <button type="button" class="boton chico" data-accion="fecha">${icono("calendario")}Cambiar fecha</button>
            <button type="button" class="boton chico peligro" data-accion="borrar">${icono("basura")}Borrar</button></div>` : ""}
        </aside>
      </div>`,
    montar(m) {
      m.addEventListener("click", (e) => { const b = e.target.closest("[data-accion]"); if (b) accionesAdmin(b, d, insp, ir); });
    },
  };
}

function cabeceraInspeccion(d, insp, hoy) {
  const ids = equiposDe(insp), pl = plantilla(d, insp.plantilla_id);
  const eq = equipo(d, ids[0]);
  return `<div class="cabeza"><div>
      <div class="migas">${ids.length > 1 ? `<a href="#/colectores">Colectores</a>` : `<a href="#/equipo/${encodeURIComponent(ids[0])}">${esc(nombreEquipo(eq))}</a>`}</div>
      <h1>${esc(pl?.nombre ?? "Inspección")}</h1>
      <p class="bajada">${ids.length > 1 ? `${esc(queInspeccion(d, insp))}. ` : ""}${pl ? (pl.cuando === "parada" ? "Con el equipo parado. " : "Con el equipo en marcha. ") : ""}${ids.length > 1 ? "" : esc(eq?.area ?? "")}</p>
    </div><div class="acciones">${insp._sinEnviar ? marcaSinEnviar() : marcaVence(insp, hoy)}</div></div>`;
}

function datosInspeccion(d, insp) {
  return `<dl class="datos-insp">
      <dt>Asignada a</dt><dd>${esc(nombre(d, insp.asignada_a))}</dd>
      <dt>Por</dt><dd>${esc(nombre(d, insp.asignada_por))}</dd>
      <dt>Para el</dt><dd>${esc(fechaCorta(insp.vence))}</dd>
      ${insp.repetir_dias ? `<dt>Se repite</dt><dd>cada ${insp.repetir_dias === 1 ? "día" : `${insp.repetir_dias} días`}</dd>` : ""}
      ${insp.estado === "hecha" ? `<dt>Hecha por</dt><dd>${esc(nombre(d, insp.hecha_por))}</dd><dt>El</dt><dd>${esc(fechaHora(insp.hecha_en))}</dd>` : ""}
    </dl>${insp.nota ? `<p class="nota-asignacion" style="margin-top:14px">${esc(insp.nota)}</p>` : ""}`;
}

/** ¿El valor medido se sale del rango? null si no hay valor o no hay rango. */
export function fueraDeRango(item, valor) {
  if (valor == null || valor === "" || !Number.isFinite(Number(valor))) return null;
  const v = Number(valor);
  if (item.min == null && item.max == null) return null;
  return (item.min != null && v < item.min) || (item.max != null && v > item.max);
}
export function textoRango(item) {
  const u = item.unidad ? ` ${item.unidad}` : "";
  if (item.min != null && item.max != null) return `Rango: ${numero(item.min, 2)}–${numero(item.max, 2)}${u}`;
  if (item.max != null) return `Máximo: ${numero(item.max, 2)}${u}`;
  if (item.min != null) return `Mínimo: ${numero(item.min, 2)}${u}`;
  return "Sin rango definido todavía";
}

async function accionesAdmin(b, d, insp, ir) {
  const id = encodeURIComponent(insp.id);
  if (b.dataset.accion === "recordar") {
    try {
      const r = await api.escribir(`inspecciones/${id}/recordar`, {});
      aviso(r.entregados ? `Recordatorio enviado a ${nombreCorto(d, insp.asignada_a)}.` : `Quedó en sus avisos de la app (${nombreCorto(d, insp.asignada_a)} no tiene notificaciones activadas).`);
    } catch (x) { aviso(x.sinRed ? "Para recordar hace falta señal." : x.message, { error: true }); }
  } else if (b.dataset.accion === "fecha") {
    let nueva = null;
    const ok = await dialogo({
      titulo: "Cambiar la fecha",
      html: `<div class="campo"><label for="nueva-fecha">Para cuándo</label><input id="nueva-fecha" type="date" value="${esc(insp.vence)}"></div>`,
      botones: [{ texto: "Cancelar", valor: false }, { texto: "Cambiar", valor: true, clase: "primario", alElegir: (v) => { nueva = v.querySelector("#nueva-fecha").value; return !!nueva; } }],
    });
    if (!ok) return;
    try { await api.escribir(`inspecciones/${id}/mover`, { vence: nueva }); aviso(`Ahora es para el ${fechaCorta(nueva)}.`); } catch (x) { aviso(x.sinRed ? "Hace falta señal." : x.message, { error: true }); }
  } else if (b.dataset.accion === "avisar") abrirWhatsApp(mensajeAsignacion(d, insp));
  else if (b.dataset.accion === "borrar") {
    if (!(await confirmar("¿Borrar esta inspección?", "Se quita del tablero de quien la tiene asignada.", "Borrar", "peligro"))) return;
    try {
      await api.escribir(`inspecciones/${id}/borrar`, {});
      api.borrador.borrar(insp.id);
      aviso("Inspección borrada.");
      ir("#/tareas");
    } catch (x) { aviso(x.sinRed ? "Para borrar hace falta señal." : x.message, { error: true }); }
  }
}

function llenar({ d, yo, hoy, dibujar, ir }, insp) {
  const pl = plantilla(d, insp.plantilla_id);
  const items = pl?.items ?? [];
  const ids = equiposDe(insp);
  const ronda = ids.length > 1;
  const admin = d.personas.find((p) => p.rol === "admin" && p.activo);
  const guardado = api.borrador.leer(insp.id);
  // lo que se va llenando: «equipo|item» → respuesta (un borrador de la versión anterior, sin equipo, no sirve)
  const R = guardado?.respuestas && Object.keys(guardado.respuestas).every((k) => k.includes("|")) ? guardado.respuestas : {};
  const clave = (eqId, itId) => `${eqId}|${itId}`;
  for (const e of ids) for (const it of items) R[clave(e, it.id)] ??= { resultado: null, valor: "", texto: "", fotos: [], hallazgo: null, manual: false };
  let paso = Math.min(guardado?.paso ?? 0, ids.length - 1);
  // las tareas que el asignador le agregó; «en sitio» (QR escaneado, también desde la pantalla del QR)
  const tareas = (d.tareas ?? []).filter((t) => t.inspeccion_id === insp.id && t.estado !== "hecha").sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const T = guardado?.tareas ?? {};
  for (const t of tareas) T[t.id] ??= { hecha: false, nota: "" };
  const verificaciones = () => api.borrador.leer(insp.id)?.verificaciones ?? [];
  const guardar = () => api.borrador.guardar(insp.id, { respuestas: R, paso, tareas: T, verificaciones: verificaciones() });
  const pedirFirmaAqui = pl?.pedir_firma === 1 || (pl?.pedir_firma !== 0 && d.ajustes?.pedir_firma !== false);
  const esMia = insp.asignada_a === yo.id || insp.asignada_a === "todos" || (!!yo.turno && insp.asignada_a === `turno:${yo.turno}`);

  const htmlHallazgo = (eqId, it, r) => {
    if (r.resultado !== "mal") return "";
    const h = (r.hallazgo ??= { id: crypto.randomUUID(), descripcion: "", prioridad: "media", accion: "", responsable_id: esAdmin(yo) ? yo.id : admin?.id ?? yo.id });
    const k = esc(clave(eqId, it.id)).replace(/\|/g, "-");
    return `<div class="subhallazgo">
      <p>${icono("hallazgos")}Se anota como hallazgo${ronda ? ` de ${esc(equipo(d, eqId)?.tag || "este equipo")}` : ""}</p>
      <div class="campo"><label for="hd-${k}">Qué se encontró</label>
        <textarea id="hd-${k}" data-h="descripcion" placeholder="${esc(sugerenciaHallazgo(it, r))}">${esc(h.descripcion)}</textarea>
        ${hayDictado ? `<div><button type="button" class="boton chico" data-dictar="hd-${k}">${icono("microfono")}Dictar</button></div>` : ""}</div>
      <div class="campo"><span class="rotulo" id="hp-${k}">Prioridad</span>
        <div class="segmento" role="group" aria-labelledby="hp-${k}">${["alta", "media", "baja"].map((p) => `<button type="button" data-prioridad="${p}" data-valor="${p}" aria-pressed="${h.prioridad === p}">${p === "alta" ? "Alta" : p === "media" ? "Media" : "Baja"}</button>`).join("")}</div></div>
      ${segmentoTipoDano(h.tipo, `ht-${k}`)}
      <div class="rejilla-campos dos">
        <div class="campo"><label for="ha-${k}">Qué hay que hacer <small>(opcional)</small></label>
          <input id="ha-${k}" type="text" data-h="accion" value="${esc(h.accion)}" placeholder="Por ejemplo: gestionar el reemplazo"></div>
        <div class="campo"><label for="hr-${k}">A cargo de</label>
          <select id="hr-${k}" data-h="responsable_id">${d.personas.filter((p) => p.activo).map((p) => `<option value="${esc(p.id)}" ${p.id === h.responsable_id ? "selected" : ""}>${esc(etiquetaPersona(p, yo))}</option>`).join("")}</select></div>
      </div>
    </div>`;
  };

  const htmlItem = (eqId, it) => {
    const k = clave(eqId, it.id);
    const r = R[k];
    const id = esc(k).replace(/\|/g, "-");
    let control = "";
    if (it.tipo === "ok" || it.tipo === "medida") {
      const seg = `<div class="segmento" role="group" aria-label="Resultado">
        <button type="button" data-resultado="ok" data-valor="ok" aria-pressed="${r.resultado === "ok"}">${icono("bien")}Bien</button>
        <button type="button" data-resultado="mal" data-valor="mal" aria-pressed="${r.resultado === "mal"}">${icono("mal")}${it.tipo === "medida" ? "Problema" : "Mal"}</button>
        <button type="button" data-resultado="na" data-valor="na" aria-pressed="${r.resultado === "na"}">${icono("na")}No aplica</button></div>`;
      if (it.tipo === "medida") {
        const fuera = fueraDeRango(it, r.valor);
        control = `<div class="medida">
            <div class="con-unidad"><label class="oculto" for="v-${id}">Valor medido</label>
              <input id="v-${id}" type="text" inputmode="decimal" autocomplete="off" data-medida value="${esc(r.valor)}" placeholder="0">
              ${it.unidad ? `<span class="unidad">${esc(it.unidad)}</span>` : ""}</div>
            <span class="rango${fuera ? " fuera" : ""}" data-rango>${fuera ? "Fuera de rango · " : ""}${esc(textoRango(it))}${it.tipico && (it.min != null || it.max != null) ? " (típico)" : ""}</span>
          </div>${seg}`;
      } else control = seg;
    }
    return `<li class="item" data-item="${esc(k)}" id="item-${id}">
      <div class="item-cabeza"><h3>${esc(it.texto)}</h3></div>
      ${it.ayuda ? `<p class="ayuda">${esc(it.ayuda)}</p>` : ""}
      ${control}
      <div class="campo"><label class="oculto" for="t-${id}">Nota</label>
        <textarea id="t-${id}" data-texto placeholder="${it.tipo === "texto" ? "Escribe o dicta…" : "Nota (opcional)"}" ${it.tipo === "texto" ? "" : 'style="min-height:58px"'}>${esc(r.texto)}</textarea></div>
      <div class="herramientas-item">
        ${botonesMedio(k)}
        ${hayDictado ? `<button type="button" class="boton chico" data-dictar="t-${id}">${icono("microfono")}Dictar</button>` : ""}
        ${it.foto === "siempre" ? `<span class="tipico">Lleva foto</span>` : it.foto === "pedir" && !r.fotos.length ? `<span class="ayuda">Una foto ayuda</span>` : ""}
      </div>
      <div data-galeria>${galeria(r.fotos, { quitar: true })}</div>
      <div data-zona-hallazgo>${htmlHallazgo(eqId, it, r)}</div>
    </li>`;
  };

  const cuentan = items.filter((it) => it.tipo !== "texto");
  const estadoEquipo = (eqId) => {
    const hechos = cuentan.filter((it) => R[clave(eqId, it.id)].resultado).length;
    const mal = cuentan.some((it) => R[clave(eqId, it.id)].resultado === "mal");
    return hechos === cuentan.length ? (mal ? "mal" : "listo") : hechos ? "medio" : "";
  };
  const avance = () => {
    // sin plantilla, lo que se revisa son las tareas
    if (!cuentan.length) return { hechos: tareas.filter((t) => T[t.id]?.hecha).length, total: tareas.length, mal: 0, tareas: true };
    let hechos = 0, mal = 0;
    for (const e of ids) for (const it of cuentan) {
      const r = R[clave(e, it.id)];
      if (r.resultado) hechos++;
      if (r.resultado === "mal") mal++;
    }
    return { hechos, total: cuentan.length * ids.length, mal };
  };
  const pasos = () => ids.map((e, k) => `<button type="button" data-paso="${k}" ${k === paso ? 'aria-current="true"' : ""}>
      <i class="estado-paso ${estadoEquipo(e)}"></i>${esc(equipo(d, e)?.tag || equipo(d, e)?.nombre || `#${k + 1}`)}</button>`).join("");
  const enSitio = () => verificaciones().map((v) => `<span class="en-sitio" style="margin:0 6px 6px 0">${icono("sitio", "ico", { lleno: true })}${esc(equipo(d, v.equipo_id)?.tag || equipo(d, v.equipo_id)?.nombre || "")} · ${esc(fechaHora(v.en).split(", ")[1])}</span>`).join("");
  const cuerpoPaso = () => {
    const e = ids[paso], eq = equipo(d, e);
    return `${ronda ? `<div class="colector-actual"><h2>${esc(eq?.tag || "")}</h2><span>${esc(eq?.nombre ?? "")}${eq?.sirve_a ? ` · ${esc(eq.sirve_a)}` : ""}</span>
        <span style="margin-left:auto">${paso + 1} de ${ids.length}</span></div>` : ""}
      ${paso === 0 && tareas.length ? `<div class="tareas-insp"><div class="seccion-sub" style="margin:8px 10px 4px">${icono("tareas")}${items.length ? "Tareas que te dejaron" : "Qué tiene que hacer"} <small style="font-weight:500;color:var(--tinta-3)">${tareas.length}</small></div>
        <ul class="lista-tareas">${tareas.map((t) => `<li data-tarea-insp="${esc(t.id)}"><button type="button" class="check-tarea" role="checkbox" aria-checked="${!!T[t.id]?.hecha}" aria-label="Hecha: ${esc(t.titulo)}">${CHECK}</button>
          <span class="que"><b>${esc(t.titulo)}</b><small>${t.equipo_id && t.equipo_id !== e ? `<span>${esc(nombreCompleto(d, t.equipo_id))}</span>` : ""}${t.detalle ? `<span>${esc(t.detalle)}</span>` : ""}</small>
            <input type="text" data-nota-tarea placeholder="Cómo quedó (opcional)" value="${esc(T[t.id]?.nota ?? "")}" ${T[t.id]?.hecha ? "" : "hidden"} style="margin-top:8px;min-height:40px"></span><span></span></li>`).join("")}</ul></div>` : ""}
      ${items.length ? `<ol class="items">${porSubequipo(items).map(([sub, its]) => `${sub ? `<li class="seccion-sub">${icono("subequipo")}${equipo(d, sub)?.tag ? `<span class="tag">${esc(equipo(d, sub).tag)}</span>` : ""}${esc(equipo(d, sub)?.nombre ?? "Subequipo")}</li>` : ""}${its.map((it) => htmlItem(e, it)).join("")}`).join("")}</ol>` : tareas.length ? "" : vacio(pl ? "Esta plantilla no tiene revisiones. Edítala en Equipos." : "No tiene revisiones ni tareas.")}
      ${ronda ? `<div class="herramientas-item" style="margin-top:14px;justify-content:space-between">
        <button type="button" class="boton" data-paso="${paso - 1}" ${paso === 0 ? "disabled" : ""}>${icono("flecha")}Anterior</button>
        ${paso < ids.length - 1 ? `<button type="button" class="boton primario" data-paso="${paso + 1}">Siguiente: ${esc(equipo(d, ids[paso + 1])?.tag || "")}${icono("derecha")}</button>` : ""}</div>` : ""}`;
  };

  return {
    titulo: pl?.nombre ?? "Inspección",
    tituloCorto: ronda ? "Ronda de colectores" : equipo(d, ids[0])?.nombre ?? "Inspección",
    atras: "#/tareas",
    viva: false,
    html: `${cabeceraInspeccion(d, insp, hoy)}
      <div class="hoja-insp">
        <div>
          ${!esMia ? `<p class="nota-asignacion" style="margin-bottom:12px">Está asignada a ${esc(nombreCorto(d, insp.asignada_a))}. Si la llenas tú, queda a tu nombre.</p>` : ""}
          ${guardado && Object.keys(R).length ? `<p class="nota-asignacion azul" style="margin-bottom:12px">Seguiste donde la dejaste (${esc(fechaHora(guardado.guardado))}).</p>` : ""}
          ${ronda ? `<nav class="ronda-pasos" aria-label="Colectores de la ronda" data-pasos>${pasos()}</nav>` : ""}
          <div data-cuerpo>${cuerpoPaso()}</div>
          <div class="pie-fijo">
            <div class="avance" aria-live="polite"><span data-avance></span><div class="barra-avance"><i data-barra></i></div></div>
            <button type="button" class="boton primario" data-accion="terminar">${icono("bien")}Terminar</button>
          </div>
        </div>
        <aside class="panel">${datosInspeccion(d, insp)}
          <div data-en-sitio>${enSitio()}</div>
          <button type="button" class="boton chico" data-qr>${icono("escanear")}Escanear el QR del equipo</button>
          ${puede(yo, "asignar") ? `<div class="herramientas-item">
            <button type="button" class="boton chico" data-accion="recordar">${icono("campana")}Recordar</button>
            <button type="button" class="boton chico" data-accion="fecha">${icono("calendario")}Cambiar fecha</button>
            <button type="button" class="boton chico" data-accion="avisar">${icono("whatsapp")}WhatsApp</button>
            <button type="button" class="boton chico peligro" data-accion="borrar">${icono("basura")}Borrar</button></div>` : ""}
        </aside>
      </div>`,
    montar(m) {
      const pintarAvance = () => {
        const a = avance();
        m.querySelector("[data-avance]").innerHTML = `<b>${a.hechos} de ${a.total}</b><span class="largo"> ${a.tareas ? "tareas hechas" : "revisadas"}</span>${a.mal ? ` · ${plural(a.mal, "hallazgo", "hallazgos")}` : ""}`;
        m.querySelector("[data-barra]").style.transform = `scaleX(${a.total ? a.hechos / a.total : 1})`;
        const ps = m.querySelector("[data-pasos]");
        if (ps) ids.forEach((e, k) => { const i = ps.children[k]?.querySelector(".estado-paso"); if (i) i.className = `estado-paso ${estadoEquipo(e)}`; });
      };
      const irAPaso = (k, alFinal) => {
        paso = Math.max(0, Math.min(ids.length - 1, k));
        guardar();
        const cambiar = () => {
          m.querySelector("[data-cuerpo]").innerHTML = cuerpoPaso();
          const ps = m.querySelector("[data-pasos]");
          ps.innerHTML = pasos();
          ps.children[paso]?.scrollIntoView({ inline: "center", block: "nearest", behavior: reducir() ? "auto" : "smooth" });
          pintarAvance();
          alFinal?.();
        };
        if (document.startViewTransition && !reducir()) document.startViewTransition(cambiar).finished.catch(() => {});
        else cambiar();
        m.querySelector(".hoja-insp").scrollIntoView({ block: "start", behavior: "auto" });
      };
      const zonaItem = (li) => {
        const [eqId, itId] = li.dataset.item.split("|");
        return { eqId, it: items.find((x) => x.id === itId), r: R[li.dataset.item] };
      };
      const repintarItem = (li, foco) => {
        const { eqId, it } = zonaItem(li);
        const k = li.dataset.item;
        li.outerHTML = htmlItem(eqId, it);
        if (foco) m.querySelector(`[data-item="${CSS.escape(k)}"] ${foco}`)?.focus();
        pintarAvance();
      };
      pintarAvance();

      let parar = null;
      // tocar el texto de una tarea también la marca (como en Recordatorios), salvo el campo de la nota
      m.addEventListener("click", (e) => {
        const que = e.target.closest?.("[data-tarea-insp] .que");
        if (que && !e.target.closest("input, textarea, a")) que.closest("[data-tarea-insp]").querySelector(".check-tarea")?.click();
      });
      m.addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.paso != null) return irAPaso(Number(b.dataset.paso));
        const filaTarea = b.closest("[data-tarea-insp]");
        if (filaTarea && b.classList.contains("check-tarea")) {
          const x = T[filaTarea.dataset.tareaInsp];
          x.hecha = !x.hecha;
          b.setAttribute("aria-checked", String(x.hecha));
          filaTarea.querySelector("[data-nota-tarea]").hidden = !x.hecha;
          navigator.vibrate?.(x.hecha ? [8, 30, 8] : 8);
          guardar();
          pintarAvance();
          return;
        }
        if (b.hasAttribute("data-qr")) {
          const t = await escanear({ ayuda: "Apunta al QR pegado en el equipo: queda registrado que pasaste por ahí." });
          if (!t) return;
          const id = equipoDelQr(d, t);
          const vale = id && (ids.includes(id) || ids.includes(equipo(d, id)?.padre_id));
          if (!vale) return aviso(id ? `Ese QR es de ${nombreCompleto(d, id)}, que no está en esta inspección.` : "Ese QR no es de un equipo de la bitácora.", { error: true });
          const b2 = api.borrador.leer(insp.id) ?? {};
          api.borrador.guardar(insp.id, { ...b2, respuestas: R, paso, tareas: T, verificaciones: [...(b2.verificaciones ?? []).filter((v) => v.equipo_id !== id), { equipo_id: id, en: new Date().toISOString() }] });
          m.querySelector("[data-en-sitio]").innerHTML = enSitio();
          navigator.vibrate?.(12);
          aviso(`En sitio: ${nombreCompleto(d, id)}.`, { icono: "sitio" });
          return;
        }
        const li = b.closest("[data-item]");
        if (b.dataset.resultado) {
          const { r } = zonaItem(li);
          r.resultado = r.resultado === b.dataset.resultado ? null : b.dataset.resultado;
          r.manual = true;
          if (r.resultado !== "mal") r.hallazgo = r.hallazgo && (r.hallazgo.descripcion || r.hallazgo.accion) ? r.hallazgo : null;
          guardar();
          repintarItem(li, `[data-resultado="${b.dataset.resultado}"]`);
        } else if (b.dataset.prioridad) {
          zonaItem(li).r.hallazgo.prioridad = b.dataset.prioridad;
          guardar();
          b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        } else if (b.dataset.tipoDano) {
          const h = zonaItem(li).r.hallazgo;
          h.tipo = h.tipo === b.dataset.tipoDano ? null : b.dataset.tipoDano;
          guardar();
          b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.tipoDano === h.tipo)));
        } else if (b.dataset.quitar) {
          const { r } = zonaItem(li);
          r.fotos = r.fotos.filter((x) => x !== b.dataset.quitar);
          guardar();
          li.querySelector("[data-galeria]").innerHTML = galeria(r.fotos, { quitar: true });
        } else if (b.dataset.dictar) {
          if (parar) { parar(); parar = null; return; }
          const campo = m.querySelector(`#${CSS.escape(b.dataset.dictar)}`);
          parar = dictar(campo, {
            alEmpezar: () => { b.innerHTML = `${icono("microfono")}Escuchando… toca para parar`; },
            alTerminar: () => { b.innerHTML = `${icono("microfono")}Dictar`; parar = null; },
            alError: (t) => aviso(t, { error: true }),
          });
        } else if (b.dataset.accion === "terminar") terminar(b);
        else if (b.dataset.accion) accionesAdmin(b, d, insp, ir);
      });

      m.addEventListener("input", (e) => {
        const t = e.target;
        if (t.hasAttribute("data-nota-tarea")) { T[t.closest("[data-tarea-insp]").dataset.tareaInsp].nota = t.value; guardar(); return; }
        const li = t.closest("[data-item]");
        if (!li) return;
        const { eqId, it, r } = zonaItem(li);
        if (t.hasAttribute("data-texto")) { r.texto = t.value; guardar(); return; }
        if (t.dataset.h) { r.hallazgo[t.dataset.h] = t.value; guardar(); return; }
        if (t.hasAttribute("data-medida")) {
          t.value = t.value.replace(/[^\d.,\-\s]/g, "");
          const v = leerNumero(t.value, it);
          r.valor = v == null ? "" : String(v);
          const fuera = fueraDeRango(it, r.valor);
          const antes = r.resultado;
          if (!r.manual || antes == null) r.resultado = r.valor === "" ? null : fuera ? "mal" : "ok";
          if (fuera && r.resultado === "ok" && !r.manual) r.resultado = "mal";
          guardar();
          const rango = li.querySelector("[data-rango]");
          rango.className = `rango${fuera ? " fuera" : ""}`;
          // si escribió con coma o espacios, se dice cómo se entendió (4,650 → 4 650; 3,2 → 3.2)
          const leido = v != null && t.value.trim() !== r.valor ? `Se guarda ${numero(v, 3)}${it.unidad ? ` ${it.unidad}` : ""} · ` : t.value.trim() && v == null ? "No es un número · " : "";
          rango.textContent = `${leido}${fuera ? "Fuera de rango · " : ""}${textoRango(it)}${it.tipico && (it.min != null || it.max != null) ? " (típico)" : ""}`;
          if (r.resultado !== antes) {
            li.querySelectorAll("[data-resultado]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.resultado === r.resultado)));
            if (r.resultado !== "mal" && r.hallazgo && !r.hallazgo.descripcion) r.hallazgo = null;
            li.querySelector("[data-zona-hallazgo]").innerHTML = htmlHallazgo(eqId, it, r);
            li.classList.remove("falta");
            pintarAvance();
          }
        }
      });

      m.addEventListener("change", async (e) => {
        const t = e.target;
        const li = t.closest("[data-item]");
        if (t.dataset.h === "responsable_id") { zonaItem(li).r.hallazgo.responsable_id = t.value; guardar(); }
        if (t.dataset.medioDe && t.files?.length) {
          const k = t.dataset.medioDe;
          const archivos = [...t.files];
          t.value = "";
          for (const a of archivos) {
            try {
              const listo = await prepararArchivo(a);
              const id = await api.guardarMedio(listo, a.name);
              R[k].fotos.push(id);
              guardar();
              const actual = m.querySelector(`[data-item="${CSS.escape(k)}"] [data-galeria]`);
              if (actual) actual.innerHTML = galeria(R[k].fotos, { quitar: true });
            } catch (x) {
              aviso(x.message, { error: true });
            }
          }
        }
      });

      async function terminar(boton) {
        const faltan = [];
        for (const [k, eqId] of ids.entries()) {
          for (const it of items) {
            const r = R[clave(eqId, it.id)];
            let falta = false;
            if (it.tipo !== "texto" && !r.resultado) falta = true;
            if (it.tipo === "medida" && r.resultado && r.resultado !== "na" && r.valor === "") falta = true;
            if (it.foto === "siempre" && r.resultado !== "na" && !r.fotos.length) falta = true;
            if (falta) faltan.push({ paso: k, clave: clave(eqId, it.id) });
          }
        }
        if (faltan.length) {
          const marcar = () => {
            for (const f of faltan) m.querySelector(`[data-item="${CSS.escape(f.clave)}"]`)?.classList.add("falta");
            m.querySelector(`[data-item="${CSS.escape(faltan[0].clave)}"]`)?.scrollIntoView({ behavior: reducir() ? "auto" : "smooth", block: "center" });
          };
          const otros = ronda ? new Set(faltan.map((f) => f.paso)).size : 0;
          aviso(`Falta${faltan.length === 1 ? "" : "n"} ${plural(faltan.length, "revisión", "revisiones")}${otros > 1 ? ` en ${otros} colectores` : ""}: están marcadas en rojo.`, { error: true });
          if (faltan[0].paso !== paso) irAPaso(faltan[0].paso, marcar);
          else marcar();
          return;
        }
        const hallazgos = [];
        for (const eqId of ids) for (const it of items) {
          const r = R[clave(eqId, it.id)];
          if (r.resultado !== "mal") continue;
          const tag = equipo(d, eqId)?.tag;
          hallazgos.push({ ...r.hallazgo, equipo_id: it.subequipo_id && equipo(d, it.subequipo_id)?.padre_id === eqId ? it.subequipo_id : eqId, item: it.texto, descripcion: (r.hallazgo?.descripcion || `${ronda && tag ? `${tag}: ` : ""}${sugerenciaHallazgo(it, r)}`).trim(), fotos: r.fotos });
        }
        const resumenTxt = `${plural(avance().total, "revisión", "revisiones")}${ronda ? ` en ${plural(ids.length, "colector", "colectores")}` : ""}${hallazgos.length ? `, con ${plural(hallazgos.length, "hallazgo", "hallazgos")}` : ", todo bien"}${tareas.length ? `; ${Object.values(T).filter((x) => x.hecha).length} de ${plural(tareas.length, "tarea hecha", "tareas hechas")}` : ""}. Después no se puede cambiar.`;
        let firma = null;
        if (pedirFirmaAqui) {
          // la firma es la confirmación: un paso menos
          const png = await pedirFirma({ nombre: yo.nombre, texto: `${resumenTxt} Firma para terminar.` });
          if (!png) return;
          try { firma = await api.guardarMedio(png, "firma.png"); } catch (x) { aviso(`No se pudo guardar la firma: ${x.message}`, { error: true }); return; }
        } else {
          const ok = await dialogo({
            titulo: "¿Terminar la inspección?",
            html: `<p>${resumenTxt}</p>`,
            botones: [{ texto: "Seguir revisando", valor: false }, { texto: "Terminar", valor: true, clase: "primario" }],
          });
          if (!ok) return;
        }
        boton.disabled = true;
        const respuestas = [];
        for (const eqId of ids) for (const it of items) {
          const r = R[clave(eqId, it.id)];
          respuestas.push({ equipo_id: eqId, item_id: it.id, resultado: it.tipo === "texto" ? (r.texto ? "ok" : null) : r.resultado, valor: r.valor === "" ? null : Number(r.valor), texto: r.texto, fotos: r.fotos });
        }
        try {
          // se guarda en el aparato y se intenta mandar; se espera hasta 8 s para poder decir si ya llegó
          const envio = api.encolar(`inspecciones/${encodeURIComponent(insp.id)}/hecha`, {
            hecha_en: new Date().toISOString(), respuestas, hallazgos, firma, firma_nombre: firma ? yo.nombre : null, verificaciones: verificaciones(),
            tareas: tareas.map((t) => ({ id: t.id, hecha: !!T[t.id]?.hecha, nota: T[t.id]?.nota ?? "" })),
          });
          await Promise.race([envio, new Promise((ok2) => setTimeout(ok2, 8000))]);
        } catch (x) {
          boton.disabled = false;
          aviso(`No se pudo guardar: ${x.message}`, { error: true });
          return;
        }
        api.borrador.borrar(insp.id);
        const enviado = !api.cola.pendientes.some((p) => p.ruta?.includes(insp.id));
        const resumen = resumenWhatsApp(d, insp, items, respuestas, hallazgos, yo);
        const r = await dialogo({
          titulo: "Inspección terminada",
          html: `<p>${enviado ? "Ya llegó al servidor." : navigator.onLine === false ? "No hay señal: quedó guardada en este aparato y se envía sola cuando vuelva la conexión." : "Quedó guardada en este aparato y se termina de enviar sola."}${hallazgos.length === 1 ? " Se anotó 1 hallazgo." : hallazgos.length ? ` Se anotaron ${hallazgos.length} hallazgos.` : ""}</p>`,
          botones: [{ texto: "Avisar por WhatsApp", valor: "wa", icono: "whatsapp" }, { texto: "Ver el resumen", valor: "ver", clase: "primario" }],
        });
        if (r === "wa") abrirWhatsApp(resumen);
        dibujar({ forzar: true });
      }
      return () => parar?.();
    },
  };
}

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>`;
/** Las revisiones agrupadas por subequipo, en el orden en que aparecen (las del equipo entero primero). */
function porSubequipo(items) {
  const grupos = new Map([[null, []]]);
  for (const it of items) (grupos.get(it.subequipo_id ?? null) ?? grupos.set(it.subequipo_id, []).get(it.subequipo_id)).push(it);
  return [...grupos.entries()].filter(([, xs]) => xs.length);
}

function sugerenciaHallazgo(it, r) {
  if (it.tipo === "medida" && r.valor !== "" && r.valor != null) {
    const u = it.unidad ? ` ${it.unidad}` : "";
    const lim = it.max != null && Number(r.valor) > it.max ? ` (máximo ${numero(it.max, 2)}${u})` : it.min != null && Number(r.valor) < it.min ? ` (mínimo ${numero(it.min, 2)}${u})` : "";
    return `${it.texto}: ${numero(Number(r.valor), 2)}${u}${lim}`;
  }
  return r.texto ? `${it.texto}: ${r.texto}` : it.texto;
}

function resumenWhatsApp(d, insp, items, respuestas, hallazgos, yo) {
  const pl = plantilla(d, insp.plantilla_id);
  const lineas = [`Inspección hecha: ${[queInspeccion(d, insp), pl?.nombre].filter(Boolean).join(" · ")} (${yo.nombre}${yo.turno ? `, ${textoTurno(yo.turno)}` : ""})`];
  if (!hallazgos.length) lineas.push("Todo bien.");
  for (const h of hallazgos) lineas.push(`⚠ ${h.descripcion} — prioridad ${h.prioridad}${h.accion ? `. Acción: ${h.accion}` : ""}`);
  const ids = equiposDe(insp);
  const medidas = respuestas.filter((r) => r.valor != null).map((r) => {
    const it = items.find((x) => x.id === r.item_id);
    if (it?.tipo !== "medida") return null;
    const tag = ids.length > 1 ? `${equipo(d, r.equipo_id)?.tag ?? ""} ` : "";
    return `${tag}${it.texto}: ${numero(r.valor, 2)} ${it.unidad ?? ""}`.trim();
  }).filter(Boolean);
  if (medidas.length) lineas.push("", ...medidas.slice(0, 30));
  lineas.push("", `${location.origin}${location.pathname}#/inspeccion/${encodeURIComponent(insp.id)}`);
  return lineas.join("\n");
}

// ------------------------------------------------------------------------------- una inspección hecha

function verHecha({ d, yo, hoy }, insp) {
  const items = insp.items ?? plantilla(d, insp.plantilla_id)?.items ?? [];
  const ids = equiposDe(insp);
  const ronda = ids.length > 1;
  const resp = new Map((insp.respuestas ?? []).map((r) => [`${r.equipo_id ?? ids[0]}|${r.item_id}`, r]));
  const hallazgos = d.hallazgos.filter((h) => h.inspeccion_id === insp.id);
  const fila = (eqId, it) => {
    const r = resp.get(`${eqId}|${it.id}`) ?? {};
    const fuera = it.tipo === "medida" && fueraDeRango(it, r.valor);
    const res = it.tipo === "texto" ? "" : r.resultado === "ok" ? `<span class="marca ok">${icono("bien")}Bien</span>`
      : r.resultado === "mal" ? `<span class="marca alta">${icono("mal")}${it.tipo === "medida" ? "Problema" : "Mal"}</span>`
      : r.resultado === "na" ? `<span class="marca">${icono("na")}No aplica</span>` : `<span class="marca">Sin dato</span>`;
    const valor = it.tipo === "medida" && r.valor != null ? `<span class="${fuera ? "fuera" : ""}">${numero(r.valor, 2)} ${esc(it.unidad ?? "")}</span>` : "";
    if (it.tipo === "texto" && !r.texto) return "";
    return `<li><span class="que">${esc(it.texto)}</span><span class="valor">${valor} ${res}</span>
      ${r.texto ? `<p class="nota">${esc(r.texto)}</p>` : ""}${galeria(r.fotos ?? [])}</li>`;
  };
  const tareasDe = (d.tareas ?? []).filter((t) => t.inspeccion_id === insp.id || (t.estado === "hecha" && t.hecha_en === insp.hecha_en && t.hecha_por === insp.hecha_por));
  const resumen = `${plural(items.filter((i) => i.tipo !== "texto").length * ids.length, "revisión", "revisiones")}${ronda ? ` en ${plural(ids.length, "colector", "colectores")}` : ""}, ${hallazgos.length ? plural(hallazgos.length, "hallazgo", "hallazgos") : "sin hallazgos"}`;
  const admin = puede(yo, "revisar");
  return {
    titulo: plantilla(d, insp.plantilla_id)?.nombre ?? "Inspección",
    tituloCorto: ronda ? "Ronda de colectores" : equipo(d, ids[0])?.nombre ?? "Inspección",
    atras: "#/tareas",
    html: `${cabeceraInspeccion(d, insp, hoy)}
      <div class="hoja-insp">
        <div>
          ${insp.revisada_en ? `<div class="visto-bueno" style="margin-bottom:14px">${icono("visto")}<div><b>Visto bueno de ${esc(nombre(d, insp.revisada_por))}</b>
            <span>${esc(fechaHora(insp.revisada_en))}${insp.revision_nota ? ` · ${esc(insp.revision_nota)}` : ""}</span></div></div>` : ""}
          <p style="margin:0 4px 12px;color:var(--tinta-3)">${resumen}.</p>
          ${(insp.verificaciones ?? []).length ? `<div style="margin:0 0 12px">${insp.verificaciones.map((v) => `<span class="en-sitio" style="margin:0 6px 6px 0">${icono("sitio", "ico", { lleno: true })}En sitio: ${esc(equipo(d, v.equipo_id)?.tag || equipo(d, v.equipo_id)?.nombre || "")} · ${esc(fechaHora(v.en))}</span>`).join("")}</div>` : ""}
          ${tareasDe.length ? `<section class="seccion" style="margin-top:0"><h2>Tareas <small>${tareasDe.filter((t) => t.estado === "hecha").length} de ${tareasDe.length} hechas</small></h2>
            <ul class="lista-tareas">${tareasDe.map((t) => `<li class="${t.estado === "hecha" ? "hecha" : ""}"><span class="check-tarea" role="img" aria-label="${t.estado === "hecha" ? "Hecha" : "Sin hacer"}" aria-checked="${t.estado === "hecha"}">${CHECK}</span>
              <a class="que" href="#/tarea/${encodeURIComponent(t.id)}"><b>${esc(t.titulo)}</b>${t.nota_cierre ? `<small><span>${esc(t.nota_cierre)}</span></small>` : t.estado !== "hecha" ? `<small><span>Pasó a la siguiente inspección</span></small>` : ""}</a><span></span></li>`).join("")}</ul></section>` : ""}
          <ul class="resultados">${ids.map((e) => `${ronda ? `<li class="titulo-equipo">${esc(equipo(d, e)?.tag ?? "")} <span style="font-family:var(--letra);font-weight:500;color:var(--tinta-3)">${esc(equipo(d, e)?.nombre ?? "")}</span></li>` : ""}${porSubequipo(items).map(([sub, its]) => `${sub ? `<li class="titulo-equipo" style="font-size:14px">${esc(equipo(d, sub)?.tag ? `${equipo(d, sub).tag} · ` : "")}<span style="font-family:var(--letra)">${esc(equipo(d, sub)?.nombre ?? "")}</span></li>` : ""}${its.map((it) => fila(e, it)).join("")}`).join("")}`).join("")}</ul>
          ${hallazgos.length ? `<section class="seccion"><h2>Hallazgos</h2><ul class="lista">${hallazgos.map((h) => `<li><a class="fila" href="#/hallazgo/${encodeURIComponent(h.id)}">
            <span class="titulo">${esc(h.descripcion)}</span><span class="detalle">${ronda ? `<span class="mono">${esc(equipo(d, h.equipo_id)?.tag ?? "")}</span>` : ""}${h.responsable_id ? `<span>A cargo: ${esc(nombreCorto(d, h.responsable_id))}</span>` : ""}</span>
            <span class="lado">${marcaPrioridad(h.prioridad)}</span></a></li>`).join("")}</ul></section>` : ""}
        </div>
        <aside class="panel">${datosInspeccion(d, insp)}
          ${insp.firma ? `<div><span class="rotulo">Firma</span><div class="firma-img" style="margin-top:6px"><img src="${esc(api.urlMedio(insp.firma))}" alt="Firma de ${esc(insp.firma_nombre ?? "")}"></div>
            <div class="ayuda">${esc(insp.firma_nombre ?? nombre(d, insp.hecha_por))}</div></div>` : ""}
          ${admin && !insp._sinEnviar ? (insp.revisada_en
            ? `<button type="button" class="boton chico" data-accion="quitar-visto">Quitar el visto bueno</button>`
            : `<button type="button" class="boton verde" data-accion="visto">${icono("visto")}Dar el visto bueno</button>`) : ""}
          <a class="boton" href="#/reporte/${encodeURIComponent(insp.id)}">${icono("imprimir")}Reporte para imprimir</a>
        </aside>
      </div>`,
    montar(m) {
      m.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-accion]");
        if (!b) return;
        const id = encodeURIComponent(insp.id);
        if (b.dataset.accion === "visto") {
          let nota = "";
          const ok = await dialogo({
            titulo: "Visto bueno",
            html: `<p>${esc(nombreCorto(d, insp.hecha_por))} recibe un aviso.</p><div class="campo"><label for="nota-visto">Comentario <small>(opcional)</small></label>
              <textarea id="nota-visto" style="min-height:70px" placeholder="Por ejemplo: bien la foto de la fuga"></textarea></div>`,
            botones: [{ texto: "Cancelar", valor: false }, { texto: "Dar el visto bueno", valor: true, clase: "verde", alElegir: (v) => { nota = v.querySelector("#nota-visto").value; } }],
          });
          if (!ok) return;
          try { await api.escribir(`inspecciones/${id}/revisar`, { nota }); aviso("Visto bueno dado.", { icono: "visto" }); } catch (x) { aviso(x.sinRed ? "Hace falta señal." : x.message, { error: true }); }
        } else if (b.dataset.accion === "quitar-visto") {
          try { await api.escribir(`inspecciones/${id}/revisar`, { quitar: true }); } catch (x) { aviso(x.sinRed ? "Hace falta señal." : x.message, { error: true }); }
        }
      });
    },
  };
}
