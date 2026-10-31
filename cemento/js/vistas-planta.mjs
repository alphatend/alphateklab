// La planta en el teléfono (un centro: equipos, colectores, paros, laboratorio), el escáner de QR y lo que pasa al
// escanear: el QR de cada equipo lleva a …/#/qr/<id>, que muestra lo pendiente de ese equipo y, si hay una inspección
// mía abierta que lo incluye, la marca «en sitio» (queda la hora en el reporte: prueba de que se pasó por el equipo).
// También las etiquetas QR para imprimir y pegar.
import { esc, icono, fechaHora, plural, haceCuanto } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, vacio, filaInspeccion, filaHallazgo, equiposDe, esAdmin, puede, esDeProceso, DE_MANTENIMIENTO } from "./ui.mjs";
import { escanear, equipoDelQr, nombreCompleto, familia, elegirEquipo } from "./componentes.mjs";
import { enCurso, tarjetaEnCurso, montarEnCurso } from "./vistas-paros.mjs";
import { esMia, filaTarea, montarChecks } from "./vistas-tareas.mjs";
import { svgQr } from "./qr.mjs";

export function vistaPlanta({ d, yo, hoy }) {
  const procesos = d.equipos.filter((e) => e.activo && !e.padre_id && e.tipo !== "colector");
  const cols = d.equipos.filter((e) => e.activo && e.tipo === "colector" && !e.padre_id);
  const curso = enCurso(d);
  const ent = (d.entregas ?? []).find((e) => !e.recibida_por && e.de !== yo.id);
  const mant = d.hallazgos.filter((h) => h.estado !== "cerrado" && DE_MANTENIMIENTO.has(h.tipo)).length;
  const hallAbiertos = d.hallazgos.filter((h) => h.estado !== "cerrado").length, inspPend = d.inspecciones.filter((i) => i.estado === "pendiente").length;
  // sin «Más» (30-oct-2026): aquí va todo lo de la planta; el laboratorio y la curva de Tromp, para ingeniería de procesos
  return {
    titulo: "Planta",
    html: `<div class="cabeza"><div><h1>Planta</h1><p class="bajada">${esc(d.ajustes?.planta || "")}</p></div>
        <div class="acciones"><a class="boton primario" href="#/escanear">${icono("escanear")}Escanear un QR</a></div></div>
      ${curso.map((p) => tarjetaEnCurso(d, p)).join("")}
      <div class="mosaico">
        <a href="#/equipos"><span class="icono-fila">${icono("equipos")}</span><b>Equipos</b><small>${plural(procesos.length, "equipo", "equipos")}</small></a>
        <a href="#/colectores"><span class="icono-fila gris">${icono("colector")}</span><b>Colectores</b><small>${plural(cols.length, "colector", "colectores")}</small></a>
        <a href="#/paros"><span class="icono-fila rojo">${icono("paros")}</span><b>Paros</b><small>${curso.length ? `${curso.length} en curso` : "Ninguno en curso"}</small></a>
        <a href="#/mantenimiento"><span class="icono-fila naranja">${icono("herramienta")}</span><b>Mantenimiento</b><small>${mant ? plural(mant, "pendiente", "pendientes") : "Nada pendiente"}</small></a>
        <a href="#/turno"><span class="icono-fila">${icono("turno")}</span><b>Entrega de turno</b><small>${ent ? "Hay una por recibir" : "Lo que deja el que sale"}</small></a>
        <a href="#/indicadores"><span class="icono-fila verde">${icono("indicadores")}</span><b>Indicadores</b><small>Cumplimiento y disponibilidad</small></a>
        <a href="#/reportes"><span class="icono-fila verde">${icono("reportes")}</span><b>Reportes</b><small>PDF, Excel y correo</small></a>
        ${esDeProceso(yo) ? `<a href="#/laboratorio"><span class="icono-fila morado">${icono("laboratorio")}</span><b>Laboratorio</b><small>${plural((d.laboratorio ?? []).length, "muestra", "muestras")}</small></a>
        <a href="#/tromp"><span class="icono-fila indigo">${icono("tromp")}</span><b>Curva de Tromp</b><small>Separador</small></a>` : ""}
      </div>
      <section class="seccion"><h2>Historial</h2><ul class="lista">
        <li><a class="fila con-icono" href="#/hallazgos"><span class="icono-fila naranja">${icono("hallazgos")}</span><span class="titulo">Hallazgos</span><span class="detalle">${plural(hallAbiertos, "abierto", "abiertos")} · todos, con su número</span><span class="lado">${icono("derecha", "ico chevron")}</span></a></li>
        <li><a class="fila con-icono" href="#/inspecciones"><span class="icono-fila">${icono("inspecciones")}</span><span class="titulo">Inspecciones</span><span class="detalle">${plural(inspPend, "pendiente", "pendientes")} · todas, también las hechas</span><span class="lado">${icono("derecha", "ico chevron")}</span></a></li>
      </ul></section>
`,
    montar: (m) => montarEnCurso(m),
  };
}

// ------------------------------------------------------------------------------- escanear

export function vistaEscanear({ d, ir }) {
  return {
    titulo: "Escanear",
    html: `<div class="cabeza"><div><h1>Escanear</h1><p class="bajada">El QR pegado en cada equipo abre lo suyo: lo pendiente, sus hallazgos y, si estás llenando su inspección, la marca «en sitio».</p></div></div>
      <div class="vacio" style="display:grid;gap:12px;justify-items:start"><p>La cámara se abre al tocar.</p>
        <button type="button" class="boton primario" data-abrir>${icono("escaner")}Abrir la cámara</button>
        <button type="button" class="boton plano" data-buscar>${icono("buscar")}O buscar el equipo a mano</button></div>`,
    montar(m) {
      const abrir = async () => {
        const t = await escanear();
        if (!t) return;
        const id = equipoDelQr(d, t);
        if (id) ir(`#/qr/${encodeURIComponent(id)}`);
        else aviso("Ese QR no es de un equipo de la bitácora.", { error: true });
      };
      m.querySelector("[data-abrir]").addEventListener("click", abrir);
      m.querySelector("[data-buscar]").addEventListener("click", async () => {
        const id = await elegirEquipo(d, { titulo: "¿En qué equipo estás?" });
        if (id) ir(`#/equipo/${encodeURIComponent(id)}`);
      });
      // desde la pestaña, la cámara se abre sola (un toque ya fue el gesto)
      if (matchMedia("(pointer: coarse)").matches) setTimeout(abrir, 250);
    },
  };
}

/** Marca «en sitio» las inspecciones mías abiertas que incluyen este equipo (en su borrador; sale al terminarla). */
function marcarEnSitio(d, yo, eqId, hoy) {
  const turno = yo.turno ? `turno:${yo.turno}` : "-";
  const fam = familia(d, eqId);
  const padre = d.equipos.find((e) => e.id === eqId)?.padre_id;
  const xs = d.inspecciones.filter((i) => i.estado === "pendiente" && (i.asignada_a === yo.id || (i.asignada_a === turno || i.asignada_a === "todos")) && i.vence <= hoy
    && equiposDe(i).some((x) => fam.has(x) || x === padre));
  const en = new Date().toISOString();
  for (const i of xs) {
    const b = api.borrador.leer(i.id) ?? { respuestas: {} };
    const vs = (b.verificaciones ?? []).filter((v) => v.equipo_id !== eqId);
    api.borrador.guardar(i.id, { ...b, verificaciones: [...vs, { equipo_id: eqId, en }] });
  }
  return xs;
}

export function vistaQr({ d, yo, hoy, param }) {
  const e = d.equipos.find((x) => x.id === param);
  if (!e) return { titulo: "QR", atras: "#/escanear", html: vacio("Ese QR no corresponde a ningún equipo de la bitácora.", `<a class="boton" href="#/escanear">Escanear otro</a>`) };
  const marcadas = marcarEnSitio(d, yo, e.id, hoy);
  const fam = familia(d, e.id);
  const pend = d.inspecciones.filter((i) => i.estado === "pendiente" && equiposDe(i).some((x) => fam.has(x))).sort((a, b) => a.vence.localeCompare(b.vence));
  const hall = d.hallazgos.filter((h) => h.estado !== "cerrado" && fam.has(h.equipo_id));
  const tareas = (d.tareas ?? []).filter((t) => t.estado !== "hecha" && fam.has(t.equipo_id));
  const ultima = d.inspecciones.filter((i) => i.estado === "hecha" && equiposDe(i).some((x) => fam.has(x))).sort((a, b) => (b.hecha_en ?? "").localeCompare(a.hecha_en ?? ""))[0];
  return {
    titulo: nombreCompleto(d, e.id),
    tituloCorto: e.tag || e.nombre,
    atras: "#/planta",
    html: `<div class="cabeza"><div><div class="migas"><span class="en-sitio">${icono("sitio", "ico", { lleno: true })}En sitio · ${esc(fechaHora(new Date().toISOString()).split(", ")[1])}</span></div>
        <h1>${e.tag ? `<span class="mono">${esc(e.tag)}</span> ` : ""}${esc(e.nombre)}</h1>
        <p class="bajada">${esc([e.area, ultima ? `última inspección ${haceCuanto(ultima.hecha_en, hoy)}` : "sin inspecciones todavía"].filter(Boolean).join(" · "))}</p></div>
        <div class="acciones">${puede(yo, "editar") ? `<a class="boton" href="#/nuevo-hallazgo?equipo=${encodeURIComponent(e.id)}">${icono("hallazgos")}Hallazgo</a>
          <a class="boton" href="#/tarea/nueva?equipo=${encodeURIComponent(e.id)}">${icono("tareas")}Tarea</a>` : ""}
          <a class="boton plano" href="#/equipo/${encodeURIComponent(e.id)}">Ficha</a></div></div>
      ${marcadas.length ? `<p class="nota-asignacion azul" style="margin-bottom:14px">${icono("sitio", "ico chico")} Quedó registrado que pasaste por aquí en ${marcadas.length === 1 ? "tu inspección abierta" : `tus ${marcadas.length} inspecciones abiertas`}: sale en el reporte.</p>` : ""}
      ${pend.length ? `<section class="seccion" style="margin-top:0"><h2>Inspecciones pendientes <small>${pend.length}</small></h2><ul class="lista">${pend.map((i) => filaInspeccion(d, i, hoy)).join("")}</ul></section>` : ""}
      ${tareas.length ? `<section class="seccion"><h2>Tareas <small>${tareas.length}</small></h2><ul class="lista-tareas">${tareas.map((t) => filaTarea(d, t, hoy)).join("")}</ul></section>` : ""}
      ${hall.length ? `<section class="seccion"><h2>Hallazgos abiertos <small>${hall.length}</small></h2><ul class="lista">${hall.map((h) => filaHallazgo(d, h, hoy)).join("")}</ul></section>` : ""}
      ${!pend.length && !hall.length && !tareas.length ? vacio("Nada pendiente en este equipo.") : ""}`,
    montar: (m) => montarChecks(m, d),
  };
}

// ------------------------------------------------------------------------------- etiquetas para imprimir

export function vistaEtiquetas({ d, yo, query }) {
  const que = query.get("de") ?? "colectores";
  const base = `${location.origin}${location.pathname}`;
  const areas = [...new Set(d.equipos.filter((e) => e.activo && e.area).map((e) => e.area))].sort((a, b) => a.localeCompare(b));
  const xs = d.equipos.filter((e) => e.activo && (que === "colectores" ? e.tipo === "colector" : que === "todos" ? true : que.startsWith("area:") ? e.area === que.slice(5)
    : que.startsWith("equipo:") ? familia(d, que.slice(7)).has(e.id) : false))
    .sort((a, b) => (a.area ?? "").localeCompare(b.area ?? "") || (a.tag || a.nombre).localeCompare(b.tag || b.nombre, "es", { numeric: true }));
  let etiquetas = "";
  try {
    etiquetas = xs.map((e) => `<div class="etiqueta-qr">${svgQr(`${base}#/qr/${encodeURIComponent(e.id)}`)}<b>${esc(e.tag || "—")}</b>
      <span>${esc(nombreCompleto(d, e.id).replace(/^.*? · /, ""))}</span><small>${esc(d.ajustes?.app_nombre || "Bitácora de proceso")}</small></div>`).join("");
  } catch (x) { etiquetas = `<div class="error-carga">${esc(x.message)}</div>`; }
  return {
    titulo: "Etiquetas QR",
    atras: "#/equipos",
    html: `<div class="cabeza no-imprimir"><div><h1>Etiquetas QR</h1>
        <p class="bajada">Para imprimir y pegar en cada equipo. Al escanearla con la app se abre lo suyo y queda registrado que pasaste por ahí.${xs.some((e) => !e.tag) ? " A los que no tienen tag conviene ponérselo." : ""}</p></div>
        <div class="acciones"><button class="boton primario" data-imprimir>${icono("imprimir")}Imprimir ${plural(xs.length, "etiqueta", "etiquetas")}</button></div></div>
      <nav class="filtros no-imprimir">
        <a href="#/etiquetas?de=colectores" ${que === "colectores" ? 'aria-current="true"' : ""}>Colectores</a>
        ${areas.map((a) => `<a href="#/etiquetas?de=${encodeURIComponent(`area:${a}`)}" ${que === `area:${a}` ? 'aria-current="true"' : ""}>${esc(a)}</a>`).join("")}
        <a href="#/etiquetas?de=todos" ${que === "todos" ? 'aria-current="true"' : ""}>Todos</a></nav>
      ${xs.length ? `<div class="etiquetas">${etiquetas}</div>` : vacio("No hay equipos con ese filtro.")}`,
    montar(m) { m.querySelector("[data-imprimir]")?.addEventListener("click", () => print()); },
  };
}
