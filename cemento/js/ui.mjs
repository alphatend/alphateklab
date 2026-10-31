// Piezas de la interfaz que usan todas las vistas: avisos, hojas de diálogo y de acciones, etiquetas de estado,
// nombres (de personas y equipos) y las filas de las listas.
import { esc, icono, fechaCorta, vencimiento, haceCuanto, plural, numeroHallazgo } from "./util.mjs";
import { urlMedio } from "./api.mjs";

const reducir = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------------------------- avisos y diálogos

let relojAviso = null;
export function aviso(texto, { error = false, ms = 3200, icono: ic = null, accion = null } = {}) {
  document.querySelector(".aviso")?.remove();
  const el = document.createElement("div");
  el.className = `aviso vidrio${error ? " error" : ""}`;
  el.setAttribute("role", error ? "alert" : "status");
  el.innerHTML = `${icono(ic ?? (error ? "hallazgos" : "bien"))}<span>${esc(texto)}</span>`;
  if (accion) {
    const b = document.createElement("button");
    b.className = "boton primario mini";
    b.textContent = accion.texto;
    b.onclick = () => { quitar(); accion.alTocar(); };
    el.append(b);
  }
  document.body.append(el);
  const quitar = () => {
    if (!el.isConnected) return;
    if (reducir()) return el.remove();
    el.classList.add("saliendo");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };
  clearTimeout(relojAviso);
  relojAviso = setTimeout(quitar, error ? Math.max(ms, 6000) : accion ? Math.max(ms, 6000) : ms);
  return el;
}

const abiertas = new Set(); // las hojas abiertas (se cierran solas al cambiar de pantalla)
/** Cierra todas las hojas abiertas (al navegar, como iOS al volver atrás). */
export const cerrarHojas = () => [...abiertas].forEach((cerrar) => cerrar(null));

/** Hoja de diálogo. botones: [{texto, valor, clase, icono, alElegir}]. Devuelve el valor del botón (o null si se cierra). */
export function dialogo({ titulo, html = "", botones = [{ texto: "Listo", valor: true, clase: "primario" }], alMontar, ancho = false }) {
  return new Promise((ok) => {
    const anterior = document.activeElement;
    const velo = document.createElement("div");
    velo.className = "velo";
    velo.innerHTML = `<div class="dialogo vidrio${ancho ? " ancho" : ""}" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">${esc(titulo)}</h2>${html}
      ${botones.length ? `<div class="botones">${botones.map((b, i) => `<button type="button" class="boton ${b.clase ?? ""}" data-i="${i}">${b.icono ? icono(b.icono) : ""}${esc(b.texto)}</button>`).join("")}</div>` : ""}
    </div>`;
    let cerrado = false;
    const cerrar = (v) => {
      if (cerrado) return;
      cerrado = true;
      abiertas.delete(cerrar);
      removeEventListener("keydown", tecla);
      anterior?.focus?.({ preventScroll: true });
      ok(v);
      if (reducir()) return velo.remove();
      velo.classList.add("cerrando");
      setTimeout(() => velo.remove(), 200);
    };
    // Escape cierra solo la hoja de encima (con una abierta sobre otra, la de abajo se queda)
    const tecla = (e) => e.key === "Escape" && velo === [...document.querySelectorAll(".velo:not(.cerrando)")].at(-1) && cerrar(null);
    velo.addEventListener("click", async (e) => {
      if (e.target === velo) return cerrar(null);
      const b = e.target.closest("[data-i]");
      if (b) {
        const def = botones[Number(b.dataset.i)];
        if (def.alElegir) {
          b.disabled = true;
          const r = await def.alElegir(velo);
          b.disabled = false;
          if (r === false) return;
        }
        cerrar(def.valor);
      }
    });
    abiertas.add(cerrar);
    const mostrar = () => {
      if (cerrado) return;
      addEventListener("keydown", tecla);
      document.body.append(velo);
      alMontar?.(velo, cerrar);
      const primero = velo.querySelector("input:not([type=hidden]), select, textarea") ?? velo.querySelector(".boton.primario") ?? velo.querySelector("button");
      // en el teléfono no se abre el teclado solo
      if (!(primero?.matches("input, textarea") && matchMedia("(pointer: coarse)").matches)) primero?.focus({ preventScroll: true });
    };
    // si otra hoja se está yendo, esta sale cuando termine (que no se vean dos encimadas)
    if (document.querySelector(".velo.cerrando")) setTimeout(mostrar, 200);
    else mostrar();
  });
}

export const confirmar = (titulo, html, si = "Sí", clase = "primario") =>
  dialogo({ titulo, html: `<p>${html}</p>`, botones: [{ texto: "Cancelar", valor: false }, { texto: si, valor: true, clase }] });

/** Hoja de acciones (como la de iOS): una lista de opciones. Devuelve el valor elegido o null. */
export function elegir(titulo, opciones, { actual } = {}) {
  return dialogo({
    titulo,
    botones: [{ texto: "Cancelar", valor: null }],
    html: `<div class="acciones-hoja">${opciones.map((o, i) => `<button type="button" data-op="${i}" ${o.valor === actual ? 'aria-current="true"' : ""}>
      ${o.icono ? icono(o.icono) : ""}<span>${esc(o.texto)}</span></button>`).join("")}</div>`,
    alMontar: (velo, cerrar) => velo.querySelectorAll("[data-op]").forEach((b) => b.addEventListener("click", () => cerrar(opciones[Number(b.dataset.op)].valor))),
  });
}

// ------------------------------------------------------------------------------- etiquetas

export const TEXTO_PRIORIDAD = { alta: "Alta", media: "Media", baja: "Baja" };
export const TEXTO_ESTADO = { abierto: "Abierto", en_proceso: "En proceso", paro: "Para el paro", cerrado: "Cerrado" };
export const ESTADOS = ["abierto", "en_proceso", "paro", "cerrado"];
export const ICONO_ESTADO = { abierto: "hallazgos", en_proceso: "repetir", paro: "paro", cerrado: "bien" };
export const PUNTO_ESTADO = { abierto: "rojo", en_proceso: "azul", paro: "morado", cerrado: "verde" };

/** El tipo de daño de un hallazgo (Eduardo, 30-oct-2026): los de mantenimiento van a su reporte. */
export const TIPOS_DANO = { mecanico: "Mecánico", electrico: "Eléctrico", logica: "Lógica", otro: "Otro" };
export const DE_MANTENIMIENTO = new Set(["mecanico", "electrico", "logica"]);
/** Los botones para elegir el tipo de daño (data-tipo-dano). */
export const segmentoTipoDano = (actual, id = "tipo") => `<div class="campo"><span class="rotulo" id="r-${id}">Tipo de daño <small>(mecánico, eléctrico o de lógica van al reporte de mantenimiento)</small></span>
  <div class="segmento" role="group" aria-labelledby="r-${id}">${Object.entries(TIPOS_DANO).map(([k, t]) => `<button type="button" data-tipo-dano="${k}" aria-pressed="${(actual ?? "") === k}">${t}</button>`).join("")}</div></div>`;
export const marcaPrioridad = (p) => `<span class="marca ${p}">${icono(p === "baja" ? "na" : "hallazgos")}${TEXTO_PRIORIDAD[p] ?? p}</span>`;
export const marcaEstado = (e) => `<span class="marca ${e}">${icono(ICONO_ESTADO[e] ?? "na")}${TEXTO_ESTADO[e] ?? e}</span>`;
export const marcaSinEnviar = () => `<span class="marca sinenviar">${icono("nube")}Sin enviar</span>`;
export const marcaTag = (tag) => (tag ? `<span class="marca tag">${esc(tag)}</span>` : "");

export function marcaVence(insp, hoy) {
  if (insp.estado === "hecha") {
    return insp.revisada_en ? `<span class="marca revisada">${icono("visto")}Visto bueno</span>` : `<span class="marca hecha">${icono("bien")}Hecha</span>`;
  }
  const v = vencimiento(insp.vence, hoy);
  const ic = v.clase === "atrasada" ? "hallazgos" : "inspecciones";
  return `<span class="marca ${v.clase}">${icono(ic)}${esc(v.texto)}</span>`;
}

// ------------------------------------------------------------------------------- consultas comunes

export const persona = (d, id) => d.personas.find((p) => p.id === id);
/** El nombre completo; lo asignado a todo un turno, «Turno A (todo el turno)». */
export const nombre = (d, id) => (id === "todos" ? "Todos" : String(id ?? "").startsWith("turno:") ? `${textoTurno(id.slice(6))} (todo el turno)` : persona(d, id)?.nombre ?? "—");
/**
 * El nombre de pila («Pedro»); si otra persona activa empieza igual (los de ejemplo: «Jefe de turno A», «…B»), el
 * nombre completo. Lo de todo un turno, «Turno A». (Antes decía «Turno C» por la persona: con dos en el turno no se
 * sabía quién.)
 */
export const nombreCorto = (d, id) => {
  if (id === "todos") return "Todos";
  if (String(id ?? "").startsWith("turno:")) return textoTurno(id.slice(6));
  const p = persona(d, id);
  if (!p) return "—";
  const pila = p.nombre.split(" ")[0];
  return d.personas.some((x) => x.id !== p.id && x.activo && x.nombre.split(" ")[0] === pila) ? p.nombre : pila;
};
/** Para elegir a alguien: «Turno A · Jefe de turno A» o el nombre. */
export const etiquetaPersona = (p, yo) => `${p.turno ? `${textoTurno(p.turno)} · ` : ""}${p.nombre}${p.id === yo?.id ? " (yo)" : ""}`;
export const equipo = (d, id) => d.equipos.find((e) => e.id === id);
export const plantilla = (d, id) => d.plantillas.find((p) => p.id === id);
export const inicial = (n) => (n || "?").trim().charAt(0).toUpperCase();
const tono = (id) => [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 6;
export const avatar = (p, chica = false) =>
  `<span class="letra-inicial${chica ? " chica" : ""}" data-tono="${tono(p?.id ?? "")}" aria-hidden="true">${esc(inicial(p?.turno || p?.nombre))}</span>`;
/** «COL-03 · Filtro principal del Loesche» o el nombre solo. */
export const nombreEquipo = (e) => (e ? (e.tag ? `${e.tag} · ${e.nombre}` : e.nombre) : "Equipo");
export const equiposDe = (i) => (i.equipos?.length ? i.equipos : [i.equipo_id]);
/** Lo que se inspecciona: el equipo, o «Ronda · 8 colectores». */
export function queInspeccion(d, i) {
  const ids = equiposDe(i);
  if (ids.length > 1) {
    const tipo = equipo(d, ids[0])?.tipo === "colector" ? ["colector", "colectores"] : ["equipo", "equipos"];
    return plural(ids.length, tipo[0], tipo[1]);
  }
  return nombreEquipo(equipo(d, ids[0]));
}
export const esAdmin = (yo) => yo?.rol === "admin";
/**
 * Los turnos (Eduardo, 30-oct-2026: «solo existen 3»). Por dentro siguen siendo A, B y C (lo guardado no cambia); se
 * muestran por número y su horario. Un turno D de antes se ve como «Turno D».
 */
export const TURNOS = [
  { id: "A", nombre: "Turno 1", horas: "12 a. m. – 7 a. m.", desde: 0, hasta: 7 },
  { id: "B", nombre: "Turno 2", horas: "7 a. m. – 5 p. m.", desde: 7, hasta: 17 },
  { id: "C", nombre: "Turno 3", horas: "5 p. m. – 12 a. m.", desde: 17, hasta: 24 },
];
export const textoTurno = (t) => TURNOS.find((x) => x.id === String(t ?? "").toUpperCase())?.nombre ?? `Turno ${t}`;
/** En qué turno cae una hora (en Panamá). */
export const turnoDeHora = (iso) => { const h = new Date(Date.parse(iso) - 5 * 3600e3).getUTCHours(); return TURNOS.find((x) => h >= x.desde && h < x.hasta)?.id ?? null; };
/**
 * Laboratorio y curva de Tromp los llena ingeniería de procesos (Eduardo, 30-oct-2026: «él lo llena, los demás solo lo
 * ven»): el administrador y quien tenga de cargo procesos, gerencia o coordinación. La curva de Tromp solo la ven ellos.
 */
export const esDeProceso = (p) => p?.rol === "admin" || /proceso|gerent|gerenc|coordin/i.test(p?.puesto ?? "");
/** ¿Esta persona puede…? (editar, asignar, tareas, equipos, revisar). El administrador, todo. */
export const puede = (yo, permiso) => yo?.rol === "admin" || (yo?.permisos ?? ["editar"]).includes(permiso);
export const PERFILES = {
  lectura: { nombre: "Solo ver", desc: "Ve inspecciones, hallazgos, tareas y reportes. No cambia nada.", permisos: [] },
  inspector: { nombre: "Inspector", desc: "Llena inspecciones, anota hallazgos, sus tareas, entregas de turno, paros y laboratorio.", permisos: ["editar"] },
  supervisor: { nombre: "Supervisor", desc: "Además asigna inspecciones, le pasa tareas a otros y da el visto bueno.", permisos: ["editar", "asignar", "tareas", "revisar"] },
  admin: { nombre: "Administrador", desc: "Todo, también usuarios, equipos y ajustes.", permisos: ["editar", "asignar", "tareas", "equipos", "revisar"] },
};
export const PERMISOS = {
  editar: ["Llenar y anotar", "Inspecciones, hallazgos, sus tareas, entregas de turno, paros y laboratorio"],
  asignar: ["Asignar inspecciones", "Y programar paros"],
  tareas: ["Pasarles tareas a otros", "A una persona o a un turno"],
  equipos: ["Editar equipos y plantillas", "Equipos, subequipos, colectores y lo que se revisa"],
  revisar: ["Dar el visto bueno", "A las inspecciones hechas"],
};
/** El perfil que corresponde a unos permisos («Personalizado» si no calza con ninguno). */
export function perfilDe(p) {
  if (p?.rol === "admin") return "admin";
  const xs = [...(p?.permisos ?? ["editar"])].sort().join(",");
  return Object.entries(PERFILES).find(([k, v]) => k !== "admin" && [...v.permisos].sort().join(",") === xs)?.[0] ?? "personalizado";
}
export const nombrePerfil = (p) => PERFILES[perfilDe(p)]?.nombre ?? "Personalizado";

// ------------------------------------------------------------------------------- filas

export function filaInspeccion(d, i, hoy, { mostrarQuien = true } = {}) {
  const pl = plantilla(d, i.plantilla_id);
  const repetir = i.repetir_dias ? `<span>${icono("repetir", "ico chico")} cada ${i.repetir_dias === 1 ? "día" : `${i.repetir_dias} días`}</span>` : "";
  const cuando = i.estado === "hecha" ? `Hecha ${haceCuanto(i.hecha_en, hoy)} por ${esc(nombreCorto(d, i.hecha_por))}` : `Vence ${esc(fechaCorta(i.vence))}`;
  return `<li><a class="fila" href="#/inspeccion/${encodeURIComponent(i.id)}">
    <span class="titulo">${esc(queInspeccion(d, i))} <small>· ${esc(pl?.nombre ?? "Inspección")}</small></span>
    <span class="detalle">${mostrarQuien && i.estado !== "hecha" ? `<span>${esc(nombreCorto(d, i.asignada_a))}</span>` : ""}<span>${cuando}</span>${repetir}</span>
    <span class="lado">${i._sinEnviar ? marcaSinEnviar() : marcaVence(i, hoy)}</span>
  </a></li>`;
}

export function filaHallazgo(d, h, hoy) {
  const eq = equipo(d, h.equipo_id);
  const foto = h.fotos?.[0];
  return `<li><a class="fila" href="#/hallazgo/${encodeURIComponent(h.id)}">
    <span class="titulo">${esc(h.descripcion)}</span>
    <span class="detalle"><span class="mono">${numeroHallazgo(h)}</span><span>${esc(nombreEquipo(eq))}</span><span>${h.responsable_id ? `A cargo: ${esc(nombreCorto(d, h.responsable_id))}` : "Sin responsable"}</span><span>${esc(haceCuanto(h.creado, hoy))}</span></span>
    <span class="lado">${foto ? `<img class="miniatura" src="${esc(urlMedio(foto))}" alt="" loading="lazy" onerror="this.remove()">` : ""}
      ${h._sinEnviar ? marcaSinEnviar() : h.estado === "abierto" ? marcaPrioridad(h.prioridad) : marcaEstado(h.estado)}</span>
  </a></li>`;
}

export function vacio(texto, accion = "") {
  return `<div class="vacio"><p>${texto}</p>${accion}</div>`;
}

export function galeria(ids = [], { quitar = false } = {}) {
  if (!ids.length) return "";
  return `<div class="medios">${ids
    .map((id) => {
      const url = esc(urlMedio(id));
      const ver = id.startsWith("v-")
        ? `<video src="${url}" controls playsinline preload="metadata"></video>`
        : `<a href="${url}" target="_blank" rel="noopener" aria-label="Ver la foto en grande"><img src="${url}" alt="Foto" loading="lazy" onerror="this.closest('.medio').classList.add('sin-imagen')"></a>`;
      return `<div class="medio" data-medio="${esc(id)}">${ver}
        ${quitar ? `<button type="button" class="quitar" data-quitar="${esc(id)}" aria-label="Quitar">${icono("mal")}</button>` : ""}
      </div>`;
    })
    .join("")}</div>`;
}

/** Botones de foto: «Foto» abre la cámara; «Galería» deja elegir fotos o videos guardados. */
export function botonesMedio(clave) {
  // el control es el input (queda enfocable aunque no se vea); la etiqueta es lo que se toca
  return `<label class="boton chico">${icono("camara")}Foto
      <input type="file" accept="image/*" capture="environment" data-medio-de="${esc(clave)}" class="oculto"></label>
    <label class="boton chico">${icono("galeria")}Galería
      <input type="file" accept="image/*,video/*" multiple data-medio-de="${esc(clave)}" class="oculto"></label>`;
}

/** Una línea chica con los últimos valores de una medida y su rango (verde), los fuera de rango en rojo. */
export function chispa(valores, { min = null, max = null, ancho = 150, alto = 40 } = {}) {
  const vs = valores.filter((v) => Number.isFinite(v));
  if (!vs.length) return "";
  const todos = [...vs, ...(min != null ? [min] : []), ...(max != null ? [max] : [])];
  let lo = Math.min(...todos), hi = Math.max(...todos);
  if (hi === lo) { hi += 1; lo -= 1; }
  const m = 4;
  const x = (k) => (vs.length === 1 ? ancho / 2 : m + (k / (vs.length - 1)) * (ancho - 2 * m));
  const y = (v) => m + (1 - (v - lo) / (hi - lo)) * (alto - 2 * m);
  const fuera = (v) => (min != null && v < min) || (max != null && v > max);
  const banda = min != null || max != null
    ? `<rect class="rango-g" x="0" width="${ancho}" y="${y(max ?? hi).toFixed(1)}" height="${Math.max(1, y(min ?? lo) - y(max ?? hi)).toFixed(1)}" rx="3"/>` : "";
  const camino = vs.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return `<svg class="chispa" viewBox="0 0 ${ancho} ${alto}" aria-hidden="true">${banda}
    ${vs.length > 1 ? `<path class="linea-g" d="${camino}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
    ${vs.map((v, k) => (fuera(v) || k === vs.length - 1 ? `<circle class="${fuera(v) ? "fuera-g" : "punto-g"}" cx="${x(k).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"/>` : "")).join("")}</svg>`;
}
