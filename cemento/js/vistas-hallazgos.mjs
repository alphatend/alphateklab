// Hallazgos: lo que se encontró mal, quién lo resuelve y en qué va.
import { esc, icono, fechaHora, haceCuanto, plural, diasEntre, diaDe } from "./util.mjs";
import * as api from "./api.mjs";
import {
  aviso, filaHallazgo, vacio, equipo, plantilla, nombre, nombreCorto, marcaPrioridad, marcaEstado, marcaSinEnviar,
  galeria, botonesMedio, TEXTO_ESTADO,
} from "./ui.mjs";
import { prepararArchivo, dictar, hayDictado } from "./medios.mjs";

const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 };

export function vistaHallazgos({ d, yo, hoy, query }) {
  const f = query.get("f") ?? "abiertos";
  const eqFiltro = query.get("equipo");
  let xs = d.hallazgos;
  if (eqFiltro) xs = xs.filter((h) => h.equipo_id === eqFiltro);
  if (f === "abiertos") xs = xs.filter((h) => h.estado !== "cerrado");
  if (f === "mios") xs = xs.filter((h) => h.estado !== "cerrado" && h.responsable_id === yo.id);
  if (f === "cerrados") xs = xs.filter((h) => h.estado === "cerrado");
  xs = [...xs].sort((a, b) => (a.estado === "cerrado") - (b.estado === "cerrado") || ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || (b.creado ?? "").localeCompare(a.creado ?? ""));
  const abiertos = d.hallazgos.filter((h) => h.estado !== "cerrado");
  const viejos = abiertos.filter((h) => diasEntre(diaDe(h.creado), hoy) >= 7).length;
  const q = (id) => `#/hallazgos?f=${id}${eqFiltro ? `&equipo=${encodeURIComponent(eqFiltro)}` : ""}`;
  const filtro = (id, texto, n) => `<a href="${q(id)}" ${f === id ? 'aria-current="true"' : ""}>${texto}${n ? ` <b>${n}</b>` : ""}</a>`;
  return {
    titulo: "Hallazgos",
    html: `<div class="cabeza"><div><h1>Hallazgos</h1>
        <p class="bajada">${abiertos.length ? `${plural(abiertos.length, "abierto", "abiertos")}${viejos ? `, ${plural(viejos, "con más de una semana", "con más de una semana")}` : ""}.` : "No hay hallazgos abiertos."}
        ${eqFiltro ? ` Solo de ${esc(equipo(d, eqFiltro)?.nombre ?? "")} · <a href="#/hallazgos?f=${f}">ver todos</a>` : ""}</p></div>
        <div class="acciones"><a class="boton primario" href="#/nuevo-hallazgo${eqFiltro ? `?equipo=${encodeURIComponent(eqFiltro)}` : ""}">${icono("mas1")}Anotar</a></div></div>
      <nav class="filtros" aria-label="Filtrar">
        ${filtro("abiertos", "Abiertos", abiertos.length)}${filtro("mios", "A mi cargo", abiertos.filter((h) => h.responsable_id === yo.id).length)}${filtro("cerrados", "Cerrados")}${filtro("todos", "Todos")}
      </nav>
      ${xs.length ? `<ul class="lista">${xs.map((h) => filaHallazgo(d, h, hoy)).join("")}</ul>` : vacio(f === "mios" ? "No tienes hallazgos a tu cargo." : "Nada por aquí.")}`,
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
    ...seg.map((s) => ({ ...s, texto: [s.estado ? `Pasó a «${TEXTO_ESTADO[s.estado]}».` : "", s.texto].filter(Boolean).join(" ") })),
  ];
  const nuevas = []; // fotos del comentario que se está escribiendo
  return {
    titulo: "Hallazgo",
    tituloCorto: eq?.nombre ?? "Hallazgo",
    atras: "#/hallazgos",
    viva: false,
    html: `<div class="cabeza"><div class="hallazgo-cabeza">
        <div class="migas"><a href="#/equipo/${encodeURIComponent(h.equipo_id)}">${esc(eq?.nombre ?? "")}</a>${h.item ? ` · ${esc(h.item)}` : ""}</div>
        <h1>${esc(h.descripcion)}</h1>
        <div class="marcas">${h._sinEnviar ? marcaSinEnviar() : ""}${marcaPrioridad(h.prioridad)} ${marcaEstado(h.estado)}
          <span class="marca">${esc(haceCuanto(h.creado, hoy))}</span></div>
      </div></div>
      ${galeria(h.fotos ?? [])}
      <div class="hoja-insp" style="margin-top:18px">
        <div>
          <form class="panel" id="form-h" novalidate>
            <div class="campo"><span class="rotulo" id="r-estado">En qué va</span>
              <div class="segmento" role="group" aria-labelledby="r-estado">${["abierto", "en_proceso", "cerrado"].map((e) => `<button type="button" data-estado="${e}" data-valor="${e}" aria-pressed="${h.estado === e}">${TEXTO_ESTADO[e]}</button>`).join("")}</div></div>
            <div class="rejilla-campos dos">
              <div class="campo"><label for="h-resp">A cargo de</label>
                <select id="h-resp"><option value="">Nadie todavía</option>${d.personas.map((p) => `<option value="${esc(p.id)}" ${p.id === h.responsable_id ? "selected" : ""}>${esc(p.rol === "jefe" ? `${p.turno} (${p.nombre})` : p.nombre)}</option>`).join("")}</select></div>
              <div class="campo"><span class="rotulo" id="r-prio">Prioridad</span>
                <div class="segmento" role="group" aria-labelledby="r-prio">${["alta", "media", "baja"].map((p) => `<button type="button" data-prioridad="${p}" data-valor="${p}" aria-pressed="${h.prioridad === p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join("")}</div></div>
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
          <h2 style="font-size:19px">Historial</h2>
          <ol class="historial">${historia.map((x) => `<li><div class="quien-fecha">${esc(nombre(d, x.persona_id))} · ${esc(fechaHora(x.fecha))}${x._sinEnviar ? " · sin enviar" : ""}</div>
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
        const cambio = { estado, prioridad, accion: f["h-accion"].value, responsable_id: f["h-resp"].value, texto: f["h-texto"].value.trim(), fotos: [...nuevas], seguimiento_id: crypto.randomUUID(), fecha: new Date().toISOString() };
        const nada = estado === h.estado && prioridad === h.prioridad && cambio.accion === (h.accion ?? "") && cambio.responsable_id === (h.responsable_id ?? "") && !cambio.texto && !nuevas.length;
        if (nada) { aviso("No hay cambios que guardar."); return; }
        const b = f.querySelector("button[type=submit]");
        b.disabled = true;
        try {
          await Promise.race([api.encolar(`hallazgos/${encodeURIComponent(h.id)}`, cambio), new Promise((ok) => setTimeout(ok, 6000))]);
          aviso(api.cola.pendientes.length ? "Guardado en este aparato: se envía cuando haya señal." : estado === "cerrado" && h.estado !== "cerrado" ? "Hallazgo cerrado." : "Guardado.");
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
  const ingeniero = d.personas.find((p) => p.rol === "ingeniero");
  const fotos = [];
  return {
    titulo: "Anotar un hallazgo",
    atras: "#/hallazgos",
    viva: false,
    html: `<div class="cabeza"><div><h1>Anotar un hallazgo</h1>
        <p class="bajada">Algo que viste fuera de una inspección. Funciona sin señal: se envía cuando vuelva.</p></div></div>
      <form class="panel" id="form-nh" novalidate style="max-width:640px">
        <div class="campo"><label for="nh-equipo">Equipo</label>
          <select id="nh-equipo">${d.equipos.map((e) => `<option value="${esc(e.id)}" ${e.id === query.get("equipo") ? "selected" : ""}>${esc(e.nombre)}</option>`).join("")}</select></div>
        <div class="campo"><label for="nh-desc">Qué se encontró</label>
          <textarea id="nh-desc" required placeholder="Por ejemplo: la vejiga del acumulador 2 no tiene presión"></textarea>
          <div class="herramientas-item">${botonesMedio("nuevo")}${hayDictado ? `<button type="button" class="boton chico" data-dictar>${icono("microfono")}Dictar</button>` : ""}</div>
          <div data-galeria-nueva></div></div>
        <div class="campo"><span class="rotulo" id="nh-r-prio">Prioridad</span>
          <div class="segmento" role="group" aria-labelledby="nh-r-prio">${["alta", "media", "baja"].map((p) => `<button type="button" data-prioridad="${p}" data-valor="${p}" aria-pressed="${p === "media"}">${p[0].toUpperCase() + p.slice(1)}</button>`).join("")}</div></div>
        <div class="rejilla-campos dos">
          <div class="campo"><label for="nh-accion">Qué hay que hacer <span style="font-weight:400;color:var(--tinta-3)">(opcional)</span></label>
            <input id="nh-accion" type="text"></div>
          <div class="campo"><label for="nh-resp">A cargo de</label>
            <select id="nh-resp">${d.personas.map((p) => `<option value="${esc(p.id)}" ${p.id === (yo.rol === "ingeniero" ? yo.id : ingeniero?.id) ? "selected" : ""}>${esc(p.rol === "jefe" ? p.turno : p.nombre)}</option>`).join("")}</select></div>
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
            api.encolar("hallazgos", { id, equipo_id: f["nh-equipo"].value, descripcion, prioridad, accion: f["nh-accion"].value, responsable_id: f["nh-resp"].value, fotos, creado: new Date().toISOString() }),
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
