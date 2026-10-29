// Hallazgos: lo que se encontró mal, quién lo resuelve, en qué va (Abierto, En proceso, Para el paro, Cerrado), su
// número, la orden de trabajo y la fecha compromiso. Todo lo de aquí funciona sin señal (entra a la cola).
import { esc, icono, fechaHora, fechaCorta, haceCuanto, plural, diasEntre, diaDe, normal, numeroHallazgo } from "./util.mjs";
import * as api from "./api.mjs";
import {
  aviso, filaHallazgo, vacio, equipo, plantilla, nombre, nombreEquipo, marcaPrioridad, marcaEstado, marcaSinEnviar, esAdmin,
  etiquetaPersona, galeria, botonesMedio, TEXTO_ESTADO, ESTADOS, ICONO_ESTADO,
} from "./ui.mjs";
import { prepararArchivo, dictar, hayDictado } from "./medios.mjs";

const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 };

/** Las opciones de equipo, agrupadas por área, con los colectores aparte (por tag). */
export function opcionesEquipo(d, elegido) {
  const activos = d.equipos.filter((e) => e.activo || e.id === elegido);
  const grupos = {};
  for (const e of activos) (grupos[e.tipo === "colector" ? `Colectores · ${e.area || "sin área"}` : e.area || "Sin área"] ??= []).push(e);
  return Object.entries(grupos).sort(([a], [b]) => a.startsWith("Colectores") - b.startsWith("Colectores") || a.localeCompare(b))
    .map(([g, xs]) => `<optgroup label="${esc(g)}">${xs.map((e) => `<option value="${esc(e.id)}" ${e.id === elegido ? "selected" : ""}>${esc(nombreEquipo(e))}</option>`).join("")}</optgroup>`).join("");
}

export function vistaHallazgos({ d, yo, hoy, query }) {
  const f = query.get("f") ?? "abiertos";
  const eqFiltro = query.get("equipo");
  const buscar = query.get("b") ?? "";
  let xs = d.hallazgos;
  if (eqFiltro) xs = xs.filter((h) => h.equipo_id === eqFiltro);
  if (f === "abiertos") xs = xs.filter((h) => h.estado !== "cerrado");
  if (f === "mios") xs = xs.filter((h) => h.estado !== "cerrado" && h.responsable_id === yo.id);
  if (f === "paro") xs = xs.filter((h) => h.estado === "paro");
  if (f === "cerrados") xs = xs.filter((h) => h.estado === "cerrado");
  if (buscar) {
    const b = normal(buscar);
    xs = xs.filter((h) => normal(`${numeroHallazgo(h)} ${h.descripcion} ${h.accion} ${h.ot} ${nombreEquipo(equipo(d, h.equipo_id))}`).includes(b));
  }
  xs = [...xs].sort((a, b) => (a.estado === "cerrado") - (b.estado === "cerrado") || ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || (b.creado ?? "").localeCompare(a.creado ?? ""));
  const abiertos = d.hallazgos.filter((h) => h.estado !== "cerrado");
  const viejos = abiertos.filter((h) => diasEntre(diaDe(h.creado), hoy) >= 7).length;
  const q = (id) => `#/hallazgos?f=${id}${eqFiltro ? `&equipo=${encodeURIComponent(eqFiltro)}` : ""}`;
  const filtro = (id, texto, n) => `<a href="${q(id)}" ${f === id ? 'aria-current="true"' : ""}>${texto}${n ? ` <b>${n}</b>` : ""}</a>`;
  return {
    titulo: "Hallazgos",
    atras: matchMedia("(max-width: 899px)").matches ? "#/mas" : null,
    html: `<div class="cabeza"><div><h1>Hallazgos</h1>
        <p class="bajada">${abiertos.length ? `${plural(abiertos.length, "abierto", "abiertos")}${viejos ? `, ${plural(viejos, "con más de una semana", "con más de una semana")}` : ""}.` : "No hay hallazgos abiertos."}
        ${eqFiltro ? ` Solo de ${esc(nombreEquipo(equipo(d, eqFiltro)))} · <a href="#/hallazgos?f=${f}">ver todos</a>` : ""} También están en el <a href="#/tablero?v=hallazgos">tablero</a>.</p></div>
        <div class="acciones"><a class="boton primario" href="#/nuevo-hallazgo${eqFiltro ? `?equipo=${encodeURIComponent(eqFiltro)}` : ""}">${icono("mas1")}Anotar</a></div></div>
      <div class="buscador" style="margin-bottom:12px;max-width:420px">${icono("buscar")}<input type="search" placeholder="Buscar por número, OT, equipo o texto" value="${esc(buscar)}" data-buscar aria-label="Buscar"></div>
      <nav class="filtros" aria-label="Filtrar">
        ${filtro("abiertos", "Abiertos", abiertos.length)}${filtro("mios", "A mi cargo", abiertos.filter((h) => h.responsable_id === yo.id).length)}${filtro("paro", "Para el paro", d.hallazgos.filter((h) => h.estado === "paro").length)}${filtro("cerrados", "Cerrados")}${filtro("todos", "Todos")}
      </nav>
      <div data-resultados>${xs.length ? `<ul class="lista">${xs.map((h) => filaHallazgo(d, h, hoy)).join("")}</ul>` : vacio(buscar ? "Nada con eso." : f === "mios" ? "No tienes hallazgos a tu cargo." : "Nada por aquí.")}</div>`,
    montar(m) {
      const campo = m.querySelector("[data-buscar]");
      let reloj = null;
      campo.addEventListener("input", () => {
        clearTimeout(reloj);
        reloj = setTimeout(() => {
          const q2 = new URLSearchParams({ f, ...(eqFiltro ? { equipo: eqFiltro } : {}), ...(campo.value ? { b: campo.value } : {}) });
          history.replaceState(null, "", `#/hallazgos?${q2}`);
          const v = vistaHallazgos({ d: api.obtener(), yo, hoy, query: q2 });
          const tmp = document.createElement("div");
          tmp.innerHTML = v.html;
          m.querySelector("[data-resultados]").replaceWith(tmp.querySelector("[data-resultados]"));
        }, 160);
      });
    },
  };
}

// ------------------------------------------------------------------------------- uno

export function vistaHallazgo({ d, yo, hoy, param, dibujar }) {
  const h = d.hallazgos.find((x) => x.id === param);
  if (!h) return { titulo: "No está", atras: "#/hallazgos", html: vacio("Ese hallazgo no existe.", `<a class="boton" href="#/hallazgos">Ver los hallazgos</a>`) };
  const eq = equipo(d, h.equipo_id);
  const insp = h.inspeccion_id ? d.inspecciones.find((i) => i.id === h.inspeccion_id) : null;
  const seg = d.seguimientos.filter((s) => s.hallazgo_id === h.id);
  const historia = [
    { fecha: h.creado, persona_id: h.creado_por, texto: `Lo anotó${insp ? ` en la inspección «${plantilla(d, insp.plantilla_id)?.nombre ?? ""}»` : ""}.`, fotos: [] },
    ...seg.map((s) => ({ ...s, cambio: !!s.estado, texto: [s.estado ? `Pasó a «${TEXTO_ESTADO[s.estado]}».` : "", s.texto].filter(Boolean).join(" ") })),
  ];
  const puedeTexto = esAdmin(yo) || h.creado_por === yo.id;
  const tarde = h.vence && h.estado !== "cerrado" && h.vence < hoy;
  const nuevas = []; // fotos del comentario que se está escribiendo
  return {
    titulo: `Hallazgo ${numeroHallazgo(h)}`,
    tituloCorto: numeroHallazgo(h),
    atras: "#/tablero?v=hallazgos",
    viva: false,
    html: `<div class="cabeza"><div class="hallazgo-cabeza">
        <div class="migas"><span class="mono">${numeroHallazgo(h)}</span><a href="#/equipo/${encodeURIComponent(h.equipo_id)}">${esc(nombreEquipo(eq))}</a>${h.item ? `<span>· ${esc(h.item)}</span>` : ""}</div>
        <h1>${esc(h.descripcion)}</h1>
        <div class="marcas">${h._sinEnviar ? marcaSinEnviar() : ""}${marcaPrioridad(h.prioridad)} ${marcaEstado(h.estado)}
          ${h.ot ? `<span class="marca tag">${esc(h.ot)}</span>` : ""}
          ${h.vence && h.estado !== "cerrado" ? `<span class="marca ${tarde ? "atrasada" : "paro"}">${icono("reloj")}Compromiso ${esc(fechaCorta(h.vence))}</span>` : ""}
          <span class="marca">${esc(haceCuanto(h.creado, hoy))}</span></div>
      </div></div>
      ${galeria(h.fotos ?? [])}
      <div class="hoja-insp" style="margin-top:18px">
        <div>
          <form class="panel" id="form-h" novalidate>
            <div class="campo"><span class="rotulo" id="r-estado">En qué va</span>
              <div class="segmento" role="group" aria-labelledby="r-estado">${ESTADOS.map((e) => `<button type="button" data-estado="${e}" data-valor="${e}" aria-pressed="${h.estado === e}">${TEXTO_ESTADO[e]}</button>`).join("")}</div></div>
            ${puedeTexto ? `<div class="campo"><label for="h-desc">Qué se encontró</label><textarea id="h-desc" style="min-height:70px">${esc(h.descripcion)}</textarea></div>` : ""}
            <div class="rejilla-campos dos">
              <div class="campo"><label for="h-resp">A cargo de</label>
                <select id="h-resp"><option value="">Nadie todavía</option>${d.personas.filter((p) => p.activo || p.id === h.responsable_id).map((p) => `<option value="${esc(p.id)}" ${p.id === h.responsable_id ? "selected" : ""}>${esc(etiquetaPersona(p, yo))}</option>`).join("")}</select></div>
              <div class="campo"><span class="rotulo" id="r-prio">Prioridad</span>
                <div class="segmento" role="group" aria-labelledby="r-prio">${["alta", "media", "baja"].map((p) => `<button type="button" data-prioridad="${p}" data-valor="${p}" aria-pressed="${h.prioridad === p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join("")}</div></div>
              <div class="campo"><label for="h-ot">N.º de OT o aviso <small>(opcional)</small></label>
                <input id="h-ot" type="text" value="${esc(h.ot ?? "")}" placeholder="Por ejemplo: OT 45821" autocapitalize="characters"></div>
              <div class="campo"><label for="h-vence">Fecha compromiso <small>(opcional)</small></label>
                <input id="h-vence" type="date" value="${esc(h.vence ?? "")}"></div>
            </div>
            <div class="campo"><label for="h-accion">Qué hay que hacer</label>
              <textarea id="h-accion" style="min-height:70px" placeholder="Por ejemplo: gestionar el reemplazo con mantenimiento">${esc(h.accion ?? "")}</textarea></div>
            <div class="campo"><label for="h-texto">Comentario o avance</label>
              <textarea id="h-texto" placeholder="Qué se hizo, qué falta…"></textarea>
              <div class="herramientas-item">${botonesMedio("comentario")}${hayDictado ? `<button type="button" class="boton chico" data-dictar>${icono("microfono")}Dictar</button>` : ""}</div>
              <div data-galeria-nueva></div></div>
            <div><button class="boton primario" type="submit">${icono("bien")}Guardar</button></div>
          </form>
        </div>
        <aside class="panel">
          <h2>Historial</h2>
          <ol class="historial">${historia.map((x) => `<li class="${x.cambio ? "cambio" : ""}"><div class="quien-fecha">${esc(nombre(d, x.persona_id))} · ${esc(fechaHora(x.fecha))}${x._sinEnviar ? " · sin enviar" : ""}</div>
            <div class="que-paso">${esc(x.texto)}</div>${galeria(x.fotos ?? [])}</li>`).join("")}</ol>
          ${insp ? `<a class="boton chico" href="#/inspeccion/${encodeURIComponent(insp.id)}">Ver la inspección</a>` : ""}
        </aside>
      </div>`,
    montar(m) {
      const f = m.querySelector("#form-h");
      let estado = h.estado, prioridad = h.prioridad, parar = null;
      f.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.estado) { estado = b.dataset.estado; b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
        if (b.dataset.prioridad) { prioridad = b.dataset.prioridad; b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
        if (b.dataset.quitar) { nuevas.splice(nuevas.indexOf(b.dataset.quitar), 1); m.querySelector("[data-galeria-nueva]").innerHTML = galeria(nuevas, { quitar: true }); }
        if (b.hasAttribute("data-dictar")) {
          if (parar) { parar(); parar = null; return; }
          parar = dictar(f["h-texto"], {
            alEmpezar: () => { b.innerHTML = `${icono("microfono")}Escuchando… toca para parar`; },
            alTerminar: () => { b.innerHTML = `${icono("microfono")}Dictar`; parar = null; },
            alError: (t) => aviso(t, { error: true }),
          });
        }
      });
      f.addEventListener("change", async (e) => {
        const t = e.target;
        if (!t.dataset.medioDe || !t.files?.length) return;
        for (const a of [...t.files]) {
          try { nuevas.push(await api.guardarMedio(await prepararArchivo(a), a.name)); } catch (x) { aviso(x.message, { error: true }); }
        }
        t.value = "";
        m.querySelector("[data-galeria-nueva]").innerHTML = galeria(nuevas, { quitar: true });
      });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const cambio = {
          estado, prioridad, accion: f["h-accion"].value, responsable_id: f["h-resp"].value, ot: f["h-ot"].value.trim(), vence: f["h-vence"].value || null,
          ...(puedeTexto && f["h-desc"].value.trim() && f["h-desc"].value.trim() !== h.descripcion ? { descripcion: f["h-desc"].value.trim() } : {}),
          texto: f["h-texto"].value.trim(), fotos: [...nuevas], seguimiento_id: crypto.randomUUID(), fecha: new Date().toISOString(),
        };
        const nada = estado === h.estado && prioridad === h.prioridad && cambio.accion === (h.accion ?? "") && cambio.responsable_id === (h.responsable_id ?? "")
          && cambio.ot === (h.ot ?? "") && (cambio.vence ?? null) === (h.vence ?? null) && !cambio.descripcion && !cambio.texto && !nuevas.length;
        if (nada) { aviso("No hay cambios que guardar."); return; }
        const b = f.querySelector("button[type=submit]");
        b.disabled = true;
        try {
          await Promise.race([api.encolar(`hallazgos/${encodeURIComponent(h.id)}`, cambio), new Promise((ok) => setTimeout(ok, 6000))]);
          aviso(api.cola.pendientes.some((p) => p.ruta === `hallazgos/${h.id}`) ? "Guardado en este aparato: se envía cuando haya señal." : estado === "cerrado" && h.estado !== "cerrado" ? "Hallazgo cerrado." : "Guardado.", { icono: ICONO_ESTADO[estado] });
          dibujar({ forzar: true });
        } catch (x) {
          b.disabled = false;
          aviso(`No se pudo guardar: ${x.message}`, { error: true });
        }
      });
      return () => parar?.();
    },
  };
}

// ------------------------------------------------------------------------------- nuevo

export function vistaNuevoHallazgo({ d, yo, query, ir }) {
  const admin = d.personas.find((p) => p.rol === "admin" && p.activo);
  const fotos = [];
  return {
    titulo: "Anotar un hallazgo",
    atras: "#/tablero?v=hallazgos",
    viva: false,
    html: `<div class="cabeza"><div><h1>Anotar un hallazgo</h1>
        <p class="bajada">Algo que viste fuera de una inspección. Funciona sin señal: se envía cuando vuelva.</p></div></div>
      <form class="panel" id="form-nh" novalidate style="max-width:680px">
        <div class="campo"><label for="nh-equipo">Equipo</label>
          <select id="nh-equipo">${opcionesEquipo(d, query.get("equipo"))}</select></div>
        <div class="campo"><label for="nh-desc">Qué se encontró</label>
          <textarea id="nh-desc" required placeholder="Por ejemplo: la vejiga del acumulador 2 no tiene presión"></textarea>
          <div class="herramientas-item">${botonesMedio("nuevo")}${hayDictado ? `<button type="button" class="boton chico" data-dictar>${icono("microfono")}Dictar</button>` : ""}</div>
          <div data-galeria-nueva></div></div>
        <div class="campo"><span class="rotulo" id="nh-r-prio">Prioridad</span>
          <div class="segmento" role="group" aria-labelledby="nh-r-prio">${["alta", "media", "baja"].map((p) => `<button type="button" data-prioridad="${p}" data-valor="${p}" aria-pressed="${p === "media"}">${p[0].toUpperCase() + p.slice(1)}</button>`).join("")}</div></div>
        <div class="rejilla-campos dos">
          <div class="campo"><label for="nh-accion">Qué hay que hacer <small>(opcional)</small></label>
            <input id="nh-accion" type="text"></div>
          <div class="campo"><label for="nh-resp">A cargo de</label>
            <select id="nh-resp">${d.personas.filter((p) => p.activo).map((p) => `<option value="${esc(p.id)}" ${p.id === (esAdmin(yo) ? yo.id : admin?.id) ? "selected" : ""}>${esc(etiquetaPersona(p, yo))}</option>`).join("")}</select></div>
          <div class="campo"><label for="nh-ot">N.º de OT o aviso <small>(opcional)</small></label>
            <input id="nh-ot" type="text" autocapitalize="characters"></div>
          <div class="campo"><label for="nh-vence">Fecha compromiso <small>(opcional)</small></label>
            <input id="nh-vence" type="date"></div>
        </div>
        <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>
        <div><button class="boton primario" type="submit">${icono("bien")}Anotar</button></div>
      </form>`,
    montar(m) {
      const f = m.querySelector("#form-nh");
      let prioridad = "media", parar = null;
      f.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.prioridad) { prioridad = b.dataset.prioridad; b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
        if (b.dataset.quitar) { fotos.splice(fotos.indexOf(b.dataset.quitar), 1); m.querySelector("[data-galeria-nueva]").innerHTML = galeria(fotos, { quitar: true }); }
        if (b.hasAttribute("data-dictar")) {
          if (parar) { parar(); parar = null; return; }
          parar = dictar(f["nh-desc"], {
            alEmpezar: () => { b.innerHTML = `${icono("microfono")}Escuchando… toca para parar`; },
            alTerminar: () => { b.innerHTML = `${icono("microfono")}Dictar`; parar = null; },
            alError: (t) => aviso(t, { error: true }),
          });
        }
      });
      f.addEventListener("change", async (e) => {
        const t = e.target;
        if (!t.dataset.medioDe || !t.files?.length) return;
        for (const a of [...t.files]) {
          try { fotos.push(await api.guardarMedio(await prepararArchivo(a), a.name)); } catch (x) { aviso(x.message, { error: true }); }
        }
        t.value = "";
        m.querySelector("[data-galeria-nueva]").innerHTML = galeria(fotos, { quitar: true });
      });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = f.querySelector(".error-form");
        const descripcion = f["nh-desc"].value.trim();
        if (!descripcion) { err.hidden = false; err.textContent = "Escribe qué se encontró."; f["nh-desc"].focus(); return; }
        const b = f.querySelector("button[type=submit]");
        b.disabled = true;
        const id = crypto.randomUUID();
        try {
          await Promise.race([
            api.encolar("hallazgos", { id, equipo_id: f["nh-equipo"].value, descripcion, prioridad, accion: f["nh-accion"].value, responsable_id: f["nh-resp"].value,
              ot: f["nh-ot"].value.trim(), vence: f["nh-vence"].value || null, fotos, creado: new Date().toISOString() }),
            new Promise((ok) => setTimeout(ok, 6000)),
          ]);
          aviso(api.cola.pendientes.some((p) => p.datos?.id === id) ? "Anotado en este aparato: se envía cuando haya señal." : "Hallazgo anotado.");
          ir(`#/hallazgo/${encodeURIComponent(id)}`);
        } catch (x) {
          b.disabled = false;
          err.hidden = false;
          err.textContent = `No se pudo guardar: ${x.message}`;
        }
      });
      return () => parar?.();
    },
  };
}
