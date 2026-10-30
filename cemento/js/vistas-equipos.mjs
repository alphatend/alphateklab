// Equipos (los de proceso, por área: la «parte seccionada»), la ficha de un equipo o colector (cómo vienen sus
// medidas, lo pendiente, sus hallazgos y su reporte) y el editor de plantillas (de un equipo o la común de colectores).
import { esc, icono, plural, numero, fechaCorta, fechaHora, diaDe, normal, haceCuanto, leerNumero } from "./util.mjs";
import * as api from "./api.mjs";
import {
  puede, aviso, dialogo, confirmar, vacio, equipo, plantilla, filaInspeccion, filaHallazgo, nombreEquipo, marcaTag, equiposDe, esAdmin, chispa,
} from "./ui.mjs";
import { fueraDeRango, textoRango } from "./vistas-inspecciones.mjs";
import { familia, nombreCompleto, leerLista, campoEquipo, barraFiltros, montarFiltros, enFiltro } from "./componentes.mjs";
import { enCurso, tarjetaEnCurso, montarEnCurso, disponibilidad, duracion } from "./vistas-paros.mjs";
import { filaTarea, montarChecks } from "./vistas-tareas.mjs";

// ------------------------------------------------------------------------------- medidas en el tiempo

/** Las medidas de un equipo en todas sus inspecciones hechas (también en las rondas de varios equipos). */
export function series(d, eqId) {
  const hechas = d.inspecciones.filter((i) => i.estado === "hecha" && equiposDe(i).includes(eqId)).sort((a, b) => (a.hecha_en ?? "").localeCompare(b.hecha_en ?? ""));
  const porItem = new Map();
  for (const i of hechas) {
    const items = i.items ?? plantilla(d, i.plantilla_id)?.items ?? [];
    for (const r of i.respuestas ?? []) {
      if ((r.equipo_id ?? i.equipo_id) !== eqId || r.valor == null) continue;
      const it = items.find((x) => x.id === r.item_id);
      if (it?.tipo !== "medida") continue;
      const k = `${i.plantilla_id}|${it.id}`;
      const s = porItem.get(k) ?? porItem.set(k, { it, puntos: [] }).get(k);
      s.it = it; // el rango de la última vez
      s.puntos.push({ valor: r.valor, fecha: i.hecha_en, insp: i.id });
    }
  }
  return [...porItem.values()];
}

function tendencia({ it, puntos }) {
  const vals = puntos.map((x) => x.valor);
  const ult = puntos.at(-1);
  const fuera = fueraDeRango(it, ult.valor);
  const rango = puntos.length > 1 ? `${plural(puntos.length, "medida", "medidas")}, de ${numero(Math.min(...vals), 2)} a ${numero(Math.max(...vals), 2)}` : "una sola medida: con la próxima se ve hacia dónde va";
  return `<div class="tendencia">
    <div><div style="font-weight:600">${esc(it.texto)}</div><div style="font-size:14px;color:var(--tinta-3)">${esc(textoRango(it))} · ${rango}</div></div>
    ${puntos.length > 1 ? chispa(vals.slice(-20), { min: it.min, max: it.max }) : "<span></span>"}
    <div style="text-align:right"><div style="font:700 20px var(--titulo);${fuera ? "color:var(--rojo)" : ""}">${numero(ult.valor, 2)}</div><div style="font-size:13px;color:var(--tinta-3)">${esc(it.unidad ?? "")} · ${esc(fechaCorta(diaDe(ult.fecha)))}</div></div>
  </div>`;
}

// ------------------------------------------------------------------------------- equipos (de proceso)

export const areasDe = (d) => [...new Set(d.equipos.map((e) => e.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export function vistaEquipos({ d, yo, hoy, query }) {
  const admin = puede(yo, "equipos");
  const buscar = query.get("b") ?? "";
  const archivados = query.get("archivados") === "1";
  const xs = d.equipos.filter((e) => e.tipo !== "colector" && !e.padre_id && (archivados ? !e.activo : e.activo)
    && (!buscar || normal(`${e.tag} ${e.nombre} ${e.area} ${e.nota} ${d.equipos.filter((x) => x.padre_id === e.id).map((x) => `${x.tag} ${x.nombre}`).join(" ")}`).includes(normal(buscar))));
  const porArea = {};
  for (const e of xs) (porArea[e.area || "Sin área"] ??= []).push(e);
  const tarjeta = (e) => {
    const fam = familia(d, e.id);
    const pend = d.inspecciones.filter((i) => i.estado === "pendiente" && equiposDe(i).includes(e.id));
    const atr = pend.filter((i) => i.vence < hoy).length;
    const abiertos = d.hallazgos.filter((h) => fam.has(h.equipo_id) && h.estado !== "cerrado");
    const subs = d.equipos.filter((x) => x.padre_id === e.id && x.activo).length;
    const parado = enCurso(d).some((p) => fam.has(p.equipo_id));
    const altas = abiertos.filter((h) => h.prioridad === "alta").length;
    const ult = d.inspecciones.filter((i) => i.estado === "hecha" && equiposDe(i).includes(e.id)).sort((a, b) => (b.hecha_en ?? "").localeCompare(a.hecha_en ?? ""))[0];
    return `<a class="equipo" href="#/equipo/${encodeURIComponent(e.id)}">
      <div class="arriba">${marcaTag(e.tag)}${parado ? `<span class="marca parado">${icono("paros")}Parado</span>` : ""}<span class="area">${esc(subs ? plural(subs, "subequipo", "subequipos") : e.nota || "")}</span></div>
      <h3>${esc(e.nombre)}</h3>
      <div class="estado-equipo">
        <span>${pend.length ? plural(pend.length, "inspección pendiente", "inspecciones pendientes") : "Nada pendiente"}${atr ? ` · <span class="malo">${atr} atrasada${atr === 1 ? "" : "s"}</span>` : ""}</span>
        <span>${abiertos.length ? `${plural(abiertos.length, "hallazgo abierto", "hallazgos abiertos")}${altas ? ` · <span class="malo">${altas} alta${altas === 1 ? "" : "s"}</span>` : ""}` : "Sin hallazgos abiertos"}</span>
        ${ult ? `<span>Última: ${esc(haceCuanto(ult.hecha_en, hoy))}</span>` : ""}
      </div></a>`;
  };
  return {
    titulo: "Equipos",
    html: `<div class="cabeza"><div><h1>Equipos</h1>
        <p class="bajada">Por área. En cada uno, qué se revisa (sus plantillas), cómo vienen las medidas y su reporte. Los colectores de polvo están en <a href="#/colectores">Colectores</a>.</p></div>
        <div class="acciones">${admin ? `<button type="button" class="boton primario" data-accion="nuevo">${icono("mas1")}Agregar equipo</button>` : ""}
          <a class="boton" href="#/etiquetas?de=todos">${icono("escanear")}Etiquetas QR</a></div></div>
      <div class="tablero-barra">
        <div class="buscador" style="flex:1 1 260px;max-width:420px">${icono("buscar")}<input type="search" placeholder="Buscar por nombre, tag o área" value="${esc(buscar)}" data-buscar aria-label="Buscar"></div>
        <nav class="filtros" style="margin:0"><a href="#/equipos" ${archivados ? "" : 'aria-current="true"'}>En uso</a><a href="#/equipos?archivados=1" ${archivados ? 'aria-current="true"' : ""}>Archivados</a></nav>
      </div>
      ${Object.keys(porArea).length ? `<div class="areas">${Object.entries(porArea).sort(([a], [b]) => a.localeCompare(b)).map(([area, es]) => `<section>
          <div class="area-titulo"><h2>${esc(area)}</h2><small>${plural(es.length, "equipo", "equipos")}</small></div>
          <div class="equipos-rejilla">${es.map(tarjeta).join("")}</div></section>`).join("")}</div>`
        : vacio(buscar ? "Ningún equipo con eso." : archivados ? "No hay equipos archivados." : "Todavía no hay equipos.")}`,
    montar(m) {
      m.querySelector('[data-accion="nuevo"]')?.addEventListener("click", () => editarEquipo(d, { tipo: "proceso" }));
      const campo = m.querySelector("[data-buscar]");
      let reloj = null;
      campo.addEventListener("input", () => {
        clearTimeout(reloj);
        reloj = setTimeout(() => {
          const q = new URLSearchParams({ ...(archivados ? { archivados: "1" } : {}), ...(campo.value ? { b: campo.value } : {}) });
          history.replaceState(null, "", `#/equipos?${q}`);
          const v = vistaEquipos({ d: api.obtener(), yo, hoy, query: q });
          const tmp = document.createElement("div");
          tmp.innerHTML = v.html;
          const nuevo = tmp.querySelector(".areas, .vacio");
          m.querySelector(".areas, .vacio")?.replaceWith(nuevo);
        }, 160);
      });
    },
  };
}

/** Agregar o editar un equipo (o un colector). */
export async function editarEquipo(d, eq) {
  const colector = eq.tipo === "colector";
  const r = await dialogo({
    titulo: eq.id ? `Editar ${eq.padre_id ? "subequipo" : colector ? "colector" : "equipo"}` : `Agregar ${eq.padre_id ? `subequipo de ${equipo(d, eq.padre_id)?.nombre ?? ""}` : colector ? "colector" : "equipo"}`,
    html: `<datalist id="areas-lista">${areasDe(d).map((a) => `<option value="${esc(a)}">`).join("")}</datalist>
      <div class="rejilla-campos dos">
        <div class="campo"><label for="e-tag">Tag ${colector ? "" : "<small>(opcional)</small>"}</label><input id="e-tag" type="text" value="${esc(eq.tag ?? "")}" autocapitalize="characters" spellcheck="false" placeholder="${colector ? "Por ejemplo: 431-FM-01" : "Por ejemplo: 541-RM-01"}"></div>
        <div class="campo"><label for="e-nombre">Nombre</label><input id="e-nombre" type="text" value="${esc(eq.nombre ?? "")}" placeholder="${colector ? "Filtro de mangas del separador" : "Horomill"}"></div>
        ${eq.padre_id ? "" : `<div class="campo"><label for="e-area">Área</label><input id="e-area" type="text" list="areas-lista" value="${esc(eq.area ?? "")}" placeholder="Molienda de cemento"></div>`}
        ${colector ? `<div class="campo"><label for="e-sirve">A qué le sirve <small>(opcional)</small></label><input id="e-sirve" type="text" value="${esc(eq.sirve_a ?? "")}" placeholder="Separador del Horomill"></div>` : ""}
      </div>
      <div class="campo"><label for="e-nota">Nota <small>(opcional)</small></label><input id="e-nota" type="text" value="${esc(eq.nota ?? "")}" placeholder="${colector ? "Número de mangas, fabricante…" : "Fabricante, modelo…"}"></div>
      <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>`,
    botones: [
      ...(eq.id ? [{ texto: eq.activo === false ? "Volver a usar" : "Archivar", valor: "archivar", clase: "plano peligro" }] : []),
      { texto: "Cancelar", valor: null },
      { texto: "Guardar", valor: "guardar", clase: "primario", alElegir: async (velo) => {
        const v = (id) => velo.querySelector(id)?.value ?? "";
        const err = velo.querySelector(".error-form");
        if (!v("#e-nombre").trim() && !v("#e-tag").trim()) { err.hidden = false; err.textContent = "Ponle un nombre o un tag."; return false; }
        try {
          await api.escribir("equipos", { id: eq.id, tipo: eq.tipo ?? "proceso", padre_id: eq.padre_id ?? null, tag: v("#e-tag"), nombre: v("#e-nombre"), area: v("#e-area"), sirve_a: v("#e-sirve"), nota: v("#e-nota"), activo: eq.activo !== false, orden: eq.orden });
          aviso(eq.id ? "Guardado." : `${colector ? "Colector" : "Equipo"} agregado.`);
        } catch (x) {
          err.hidden = false;
          err.textContent = x.sinRed ? "Para esto hace falta señal." : x.message;
          return false;
        }
      } },
    ],
  });
  if (r === "archivar") {
    if (eq.activo === false) {
      try { await api.escribir("equipos", { ...eq, activo: true }); aviso("De vuelta en uso."); } catch (x) { aviso(x.message, { error: true }); }
      return;
    }
    if (!(await confirmar(`¿Archivar ${eq.tag || eq.nombre}?`, "Deja de salir en las listas y para asignar. Si no tiene historia se borra; si la tiene, se guarda.", "Archivar", "peligro"))) return;
    try {
      const x = await api.escribir(`equipos/${encodeURIComponent(eq.id)}/borrar`, {});
      aviso(x.archivado ? "Archivado: su historia se conserva." : "Borrado.");
      location.hash = colector ? "#/colectores" : "#/equipos";
    } catch (x) { aviso(x.sinRed ? "Para esto hace falta señal." : x.message, { error: true }); }
  }
}

// ------------------------------------------------------------------------------- un equipo (o colector)

export function vistaEquipo({ d, yo, hoy, param }) {
  const eq = equipo(d, param);
  if (!eq) return { titulo: "No está", atras: "#/equipos", html: vacio("Ese equipo no existe.") };
  const admin = puede(yo, "equipos");
  const colector = eq.tipo === "colector";
  const padre = eq.padre_id ? equipo(d, eq.padre_id) : null;
  const fam = familia(d, eq.id);
  const hijos = d.equipos.filter((e) => e.padre_id === eq.id && e.activo);
  const ps = padre ? [] : colector ? d.plantillas.filter((p) => p.tipo_equipo === "colector") : d.plantillas.filter((p) => p.equipo_id === eq.id);
  // un subequipo se revisa en las plantillas del padre que tienen revisiones suyas
  const seRevisaEn = padre ? d.plantillas.filter((p) => p.items.some((it) => it.subequipo_id === eq.id)) : [];
  const suyas = d.inspecciones.filter((i) => equiposDe(i).some((x) => fam.has(x) || x === eq.padre_id && padre));
  const pendientes = suyas.filter((i) => i.estado === "pendiente").sort((a, b) => a.vence.localeCompare(b.vence));
  const hechas = suyas.filter((i) => i.estado === "hecha").sort((a, b) => (b.hecha_en ?? "").localeCompare(a.hecha_en ?? ""));
  const hall = d.hallazgos.filter((h) => fam.has(h.equipo_id));
  const abiertos = hall.filter((h) => h.estado !== "cerrado");
  const tareas = (d.tareas ?? []).filter((t) => t.estado !== "hecha" && fam.has(t.equipo_id));
  const ss = series(d, eq.id);
  const atras = padre ? `#/equipo/${encodeURIComponent(padre.id)}` : colector ? "#/colectores" : "#/equipos";
  const curso = enCurso(d).filter((p) => fam.has(p.equipo_id));
  const disp = !colector && !padre ? disponibilidad(d, eq.id, Date.now() - 30 * 86400e3, Date.now()) : null;
  const paros = (d.paros ?? []).filter((p) => fam.has(p.equipo_id) && Date.parse(p.inicio) > Date.now() - 90 * 86400e3).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const lab = d.ajustes?.lab?.[eq.id] ? (d.laboratorio ?? []).filter((x) => x.equipo_id === eq.id).sort((a, b) => a.en.localeCompare(b.en)) : null;
  return {
    titulo: nombreCompleto(d, eq.id),
    tituloCorto: eq.tag || eq.nombre,
    atras,
    html: `<div class="cabeza"><div><div class="migas"><a href="${colector ? "#/colectores" : "#/equipos"}">${colector ? "Colectores" : "Equipos"}</a>
          ${padre ? `<span>·</span><a href="#/equipo/${encodeURIComponent(padre.id)}">${esc(padre.tag || padre.nombre)}</a>` : `<span>· ${esc(eq.area || "Sin área")}</span>`}</div>
        <h1>${eq.tag ? `<span class="mono">${esc(eq.tag)}</span> ` : ""}${esc(eq.nombre)}</h1>
        <p class="bajada">${[padre ? `Subequipo de ${esc(padre.nombre)}.` : "", eq.sirve_a ? `Sirve a: ${esc(eq.sirve_a)}.` : "", esc(eq.nota ?? ""), eq.activo ? "" : "<b>Archivado.</b>"].filter(Boolean).join(" ")}</p></div>
        <div class="acciones">${puede(yo, "asignar") && eq.activo && !padre ? `<a class="boton primario" href="#/asignar?${colector ? `equipo=colectores&equipos=${encodeURIComponent(eq.id)}` : `equipo=${encodeURIComponent(eq.id)}`}">${icono("mas1")}Asignar</a>` : ""}
          ${puede(yo, "editar") ? `<a class="boton" href="#/nuevo-hallazgo?equipo=${encodeURIComponent(eq.id)}">${icono("hallazgos")}Hallazgo</a>
          <a class="boton" href="#/tarea/nueva?equipo=${encodeURIComponent(eq.id)}">${icono("tareas")}Tarea</a>` : ""}
          <a class="boton" href="#/reportes?alcance=${encodeURIComponent(`equipo:${eq.id}`)}&plantilla=equipo">${icono("reportes")}Reporte</a>
          <a class="boton plano" href="#/etiquetas?de=${encodeURIComponent(`equipo:${eq.id}`)}">${icono("escanear")}QR</a>
          ${admin ? `<button class="boton plano" data-accion="editar">${icono("lapiz")}Editar</button>` : ""}</div></div>
      ${curso.map((p) => tarjetaEnCurso(d, p)).join("")}
      <dl class="ficha-cifras">
        <div><dt>Pendientes</dt><dd>${pendientes.length}${pendientes.some((i) => i.vence < hoy) ? ` <small style="color:var(--rojo)">${pendientes.filter((i) => i.vence < hoy).length} atrasadas</small>` : ""}</dd></div>
        <div><dt>Hallazgos abiertos</dt><dd>${abiertos.length}${abiertos.some((h) => h.prioridad === "alta") ? ` <small style="color:var(--rojo)">${abiertos.filter((h) => h.prioridad === "alta").length} altas</small>` : ""}</dd></div>
        ${disp ? `<div><dt>Disponibilidad 30 días</dt><dd style="${disp.disp < 0.9 ? "color:var(--rojo)" : disp.disp < 0.97 ? "color:var(--naranja)" : ""}">${numero(disp.disp * 100, 1)}<small>%</small></dd></div>` : `<div><dt>Tareas abiertas</dt><dd>${tareas.length}</dd></div>`}
        <div><dt>La última inspección</dt><dd style="font-size:19px">${hechas[0] ? esc(haceCuanto(hechas[0].hecha_en, hoy)) : "—"}</dd></div>
      </dl>
      ${!padre && !colector ? `<section class="seccion"><h2>Subequipos <small>${hijos.length || ""}</small></h2>
        ${hijos.length ? `<ul class="lista">${hijos.map((h) => {
          const n = d.hallazgos.filter((x) => x.equipo_id === h.id && x.estado !== "cerrado").length;
          return `<li><a class="fila con-icono" href="#/equipo/${encodeURIComponent(h.id)}"><span class="icono-fila gris">${icono("subequipo")}</span>
            <span class="titulo">${h.tag ? `<span class="mono">${esc(h.tag)}</span> · ` : ""}${esc(h.nombre)}</span>
            <span class="detalle">${n ? `<span style="color:var(--rojo)">${plural(n, "hallazgo abierto", "hallazgos abiertos")}</span>` : "<span>Sin hallazgos abiertos</span>"}</span>
            <span class="lado horizontal">${icono("derecha", "ico chevron")}</span></a></li>`;
        }).join("")}</ul>` : vacio("Las partes donde se encuentran las fallas: elevador, bandas, separador, ventilador… Así cada hallazgo queda en su parte.")}
        ${admin ? `<div class="herramientas-item" style="margin-top:10px"><button type="button" class="boton chico" data-accion="sub-uno">${icono("mas1")}Agregar subequipo</button>
          <button type="button" class="boton chico plano" data-accion="sub-lista">${icono("lista")}Pegar una lista</button></div>` : ""}</section>` : ""}
      ${tareas.length ? `<section class="seccion"><h2>Tareas abiertas <small>${tareas.length}</small></h2><ul class="lista-tareas">${tareas.map((t) => filaTarea(d, t, hoy)).join("")}</ul></section>` : ""}
      ${pendientes.length ? `<section class="seccion"><h2>Inspecciones pendientes <small>${pendientes.length}</small></h2><ul class="lista">${pendientes.map((i) => filaInspeccion(d, i, hoy)).join("")}</ul></section>` : ""}
      ${abiertos.length ? `<section class="seccion"><h2>Hallazgos abiertos <small>${abiertos.length}</small></h2><ul class="lista">${abiertos.map((h) => filaHallazgo(d, h, hoy)).join("")}</ul></section>` : ""}
      ${ss.length ? `<section class="seccion"><h2>Cómo vienen las medidas</h2><div class="lista">${ss.map(tendencia).join("")}</div></section>` : ""}
      ${lab ? `<section class="seccion"><h2>Laboratorio <small><a href="#/laboratorio?m=${encodeURIComponent(eq.id)}">ver todo</a></small></h2>
        <div class="kpis-app">${(d.ajustes.lab[eq.id] ?? []).map((p) => { const vs = lab.filter((x) => x.valores?.[p.id] != null); const v = vs.at(-1)?.valores[p.id];
          const fuera = v != null && ((p.min != null && v < p.min) || (p.max != null && v > p.max));
          return `<div class="kpi ${v == null ? "" : fuera ? "malo" : "bueno"}"><span class="rotulo-kpi">${esc(p.nombre)}</span><span class="valor-kpi">${v == null ? "—" : numero(v, 2)}<small>${esc(p.unidad ?? "")}</small></span>
            <span class="pie-kpi">${vs.length ? esc(haceCuanto(vs.at(-1).en, hoy)) : "sin muestras"}</span></div>`; }).join("")}</div></section>` : ""}
      ${paros.length ? `<section class="seccion"><h2>Paros <small>últimos 90 días</small></h2><ul class="lista">${paros.slice(0, 8).map((p) => `<li><a class="fila" href="#/paro/${encodeURIComponent(p.id)}">
          <span class="titulo">${p.tipo === "programado" ? "Programado" : esc(p.causa || "No programado")} <small>· ${esc(nombreCompleto(d, p.equipo_id))}</small></span>
          <span class="detalle"><span>${esc(fechaHora(p.inicio))}</span><span>${p.fin ? duracion((Date.parse(p.fin) - Date.parse(p.inicio)) / 3600e3) : "en curso"}</span></span>
          <span class="lado">${icono("derecha", "ico chevron")}</span></a></li>`).join("")}</ul></section>` : ""}
      ${padre ? `<section class="seccion"><h2>Se revisa en</h2>${seRevisaEn.length ? `<ul class="lista">${seRevisaEn.map((p) => `<li><a class="fila" href="#/plantilla/${encodeURIComponent(p.id)}"><span class="titulo">${esc(p.nombre)} <small>· ${esc(padre.nombre)}</small></span>
          <span class="detalle"><span>${plural(p.items.filter((it) => it.subequipo_id === eq.id).length, "revisión de este subequipo", "revisiones de este subequipo")}</span></span><span class="lado">${icono("derecha", "ico chevron")}</span></a></li>`).join("")}</ul>`
          : vacio(`Ninguna revisión de las plantillas de ${esc(padre.nombre)} es de este subequipo todavía. Al editar una plantilla, a cada revisión se le elige su subequipo.`)}</section>` : `
      <section class="seccion"><h2>${colector ? "Qué se revisa (común a los colectores)" : "Plantillas"} <small>${ps.length || ""}</small></h2>
        ${ps.length ? `<ul class="lista">${ps.map((p) => `<li><a class="fila" href="#/plantilla/${encodeURIComponent(p.id)}">
          <span class="titulo">${esc(p.nombre)} <small>· ${p.cuando === "parada" ? "en parada" : "en marcha"}</small></span>
          <span class="detalle"><span>${plural(p.items.filter((x) => x.tipo !== "texto").length, "revisión", "revisiones")}</span><span>${p.frecuencia_dias ? `cada ${p.frecuencia_dias === 1 ? "día" : `${p.frecuencia_dias} días`}` : "sin frecuencia"}</span>
            ${p.items.some((x) => x.tipico) ? `<span class="tipico">rangos típicos por confirmar</span>` : ""}</span>
          <span class="lado">${icono("derecha", "ico chevron")}</span></a></li>`).join("")}</ul>` : vacio("Todavía no tiene plantillas.")}
        ${admin ? `<p style="margin:10px 4px"><a class="boton chico" href="#/plantilla/nueva?${colector ? "tipo=colector" : `equipo=${encodeURIComponent(eq.id)}`}">${icono("mas1")}Nueva plantilla</a></p>` : ""}
      </section>`}
      ${hechas.length ? `<section class="seccion"><h2>Inspecciones hechas <small>${hechas.length}</small></h2><ul class="lista">${hechas.slice(0, 12).map((i) => filaInspeccion(d, i, hoy)).join("")}</ul>
        ${hechas.length > 12 ? `<p class="pie-seccion">Todas están en el <a href="#/reportes?alcance=${encodeURIComponent(`equipo:${eq.id}`)}&plantilla=equipo&p=todo">reporte del equipo</a>.</p>` : ""}</section>` : ""}
      ${hall.length > abiertos.length ? `<p class="pie-seccion" style="margin-top:18px"><a href="#/hallazgos?f=todos&eq=${encodeURIComponent(eq.id)}">Todos sus hallazgos (${hall.length})</a></p>` : ""}`,
    montar(m) {
      montarChecks(m, d);
      const fin = montarEnCurso(m);
      m.addEventListener("click", (e) => {
        const b = e.target.closest("[data-accion]");
        if (!b) return;
        if (b.dataset.accion === "editar") editarEquipo(d, eq);
        if (b.dataset.accion === "sub-uno") editarEquipo(d, { tipo: "proceso", padre_id: eq.id, area: eq.area });
        if (b.dataset.accion === "sub-lista") subequiposPegados(d, eq);
      });
      return fin;
    },
  };
}

/** Las líneas pegadas: «tag; nombre», o solo el nombre (una línea suelta que parece un tag, como «EL1», va de tag). */
const subequiposDe = (texto) => leerLista(texto).map((x) => (x.nombre ? { tag: x.tag, nombre: x.nombre }
  : /^[A-Za-z0-9._-]{1,12}$/.test(x.tag) && /\d/.test(x.tag) ? { tag: x.tag, nombre: "" } : { tag: "", nombre: x.tag }));

/** Varios subequipos de una vez, pegando una lista (tag; nombre). */
async function subequiposPegados(d, padre) {
  await dialogo({
    titulo: `Subequipos de ${padre.nombre}`,
    ancho: true,
    html: `<div class="campo"><label for="s-lista">Uno por línea: <b>tag</b>; nombre</label>
        <textarea id="s-lista" style="min-height:150px;font-family:var(--mono);font-size:15px" spellcheck="false" placeholder="EL1; Elevador de cangilones&#10;BC1; Banda transportadora BC1&#10;SEP1; Separador"></textarea>
        <span class="ayuda">Se puede copiar de Excel (tag y nombre). Sin tag, va solo el nombre. Si el tag ya existe, se actualiza.</span>
        <div class="ayuda" data-vista-previa></div></div>
      <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>`,
    alMontar(v) {
      // lo que se va a agregar, mientras se escribe (como en los colectores)
      const t = v.querySelector("#s-lista"), previa = v.querySelector("[data-vista-previa]");
      t.addEventListener("input", () => {
        const xs = subequiposDe(t.value);
        previa.innerHTML = xs.length ? `<b>${plural(xs.length, "subequipo", "subequipos")}:</b> ${xs.slice(0, 8).map((x) => esc(x.tag && x.nombre ? `${x.tag} · ${x.nombre}` : x.tag || x.nombre)).join(" · ")}${xs.length > 8 ? "…" : ""}` : "";
      });
    },
    botones: [{ texto: "Cancelar", valor: null }, { texto: "Agregar", valor: true, clase: "primario", alElegir: async (v) => {
      const xs = subequiposDe(v.querySelector("#s-lista").value);
      const err = v.querySelector(".error-form");
      if (!xs.length) { err.hidden = false; err.textContent = "Escribe por lo menos un subequipo."; return false; }
      try {
        const r = await api.escribir("equipos/varios", { padre_id: padre.id, tipo: padre.tipo, area: padre.area, equipos: xs });
        aviso(`${plural(r.creados, "subequipo agregado", "subequipos agregados")}${r.actualizados ? ` y ${plural(r.actualizados, "actualizado", "actualizados")}` : ""}.`);
      } catch (x) { err.hidden = false; err.textContent = x.sinRed ? "Para esto hace falta señal." : x.message; return false; }
    } }],
  });
}

// ------------------------------------------------------------------------------- editar una plantilla

const TIPOS = [["ok", "Bien / mal"], ["medida", "Medida (número)"], ["texto", "Texto libre"]];
const FOTO = [["", "Sin foto"], ["pedir", "Sugerir foto"], ["siempre", "Foto obligatoria"]];

export function vistaPlantilla({ d, yo, param, query, ir }) {
  const nueva = param === "nueva";
  const original = nueva ? null : plantilla(d, param);
  if (!nueva && !original) return { titulo: "No está", atras: "#/equipos", html: vacio("Esa plantilla no existe.") };
  const deColectores = (original?.tipo_equipo ?? query.get("tipo")) === "colector";
  const eqId = deColectores ? null : original?.equipo_id ?? query.get("equipo") ?? d.equipos[0]?.id;
  const eq = eqId ? equipo(d, eqId) : null;
  const volver = deColectores ? "#/colectores" : `#/equipo/${encodeURIComponent(eqId)}`;
  const admin = puede(yo, "equipos");
  const dis = admin ? "" : "disabled";
  const subs = eqId ? d.equipos.filter((x) => x.padre_id === eqId && x.activo) : [];
  const P = structuredClone(original ?? { equipo_id: eqId, tipo_equipo: deColectores ? "colector" : null, nombre: "", cuando: "marcha", frecuencia_dias: 7, items: [{ id: `item-${Date.now()}`, tipo: "ok", texto: "", ayuda: "", foto: "" }] });
  const htmlItem = (it, k) => `<li class="editor-item" data-k="${k}">
      <div class="rejilla-campos dos">
        <div class="campo"><label for="i-t-${k}">Qué se revisa</label><input id="i-t-${k}" type="text" data-c="texto" value="${esc(it.texto)}" ${dis}></div>
        <div class="campo"><label for="i-tipo-${k}">Cómo se contesta</label><select id="i-tipo-${k}" data-c="tipo" ${dis}>${TIPOS.map(([v, t]) => `<option value="${v}" ${it.tipo === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      </div>
      ${it.tipo === "medida" ? `<div class="rejilla-campos tres">
        <div class="campo"><label for="i-u-${k}">Unidad</label><input id="i-u-${k}" type="text" data-c="unidad" value="${esc(it.unidad ?? "")}" ${dis}></div>
        <div class="campo"><label for="i-min-${k}">Mínimo</label><input id="i-min-${k}" type="text" inputmode="decimal" data-c="min" value="${esc(it.min ?? "")}" ${dis}></div>
        <div class="campo"><label for="i-max-${k}">Máximo</label><input id="i-max-${k}" type="text" inputmode="decimal" data-c="max" value="${esc(it.max ?? "")}" ${dis}></div>
      </div>${it.tipico ? `<p class="tipico">Rango típico de libro: confírmalo o cámbialo por el de la planta.</p>` : it.min == null && it.max == null ? `<p class="ayuda">Sin rango: no se marca solo cuando se sale. Ponle uno cuando lo tengas.</p>` : ""}` : ""}
      <div class="rejilla-campos dos">
        ${subs.length ? `<div class="campo"><label for="i-s-${k}">De qué parte</label><select id="i-s-${k}" data-c="subequipo_id" ${dis}><option value="">Todo el equipo</option>
          ${subs.map((x) => `<option value="${esc(x.id)}" ${x.id === it.subequipo_id ? "selected" : ""}>${esc(x.tag ? `${x.tag} · ${x.nombre}` : x.nombre)}</option>`).join("")}</select></div>` : ""}
        <div class="campo"><label for="i-a-${k}">Ayuda para quien revisa</label><input id="i-a-${k}" type="text" data-c="ayuda" value="${esc(it.ayuda ?? "")}" ${dis}></div>
        ${it.tipo !== "texto" ? `<div class="campo"><label for="i-f-${k}">Foto</label><select id="i-f-${k}" data-c="foto" ${dis}>${FOTO.map(([v, t]) => `<option value="${v}" ${(it.foto ?? "") === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>` : ""}
      </div>
      ${admin ? `<div class="mover">
        <button type="button" class="boton chico plano" data-mover="-1" ${k === 0 ? "disabled" : ""} aria-label="Subir">${icono("arriba")}</button>
        <button type="button" class="boton chico plano" data-mover="1" ${k === P.items.length - 1 ? "disabled" : ""} aria-label="Bajar">${icono("abajo")}</button>
        <button type="button" class="boton chico peligro" data-quitar-item aria-label="Quitar esta revisión">${icono("basura")}</button></div>` : ""}
    </li>`;
  return {
    titulo: nueva ? "Nueva plantilla" : P.nombre,
    tituloCorto: deColectores ? "Colectores" : eq?.nombre ?? "Plantilla",
    atras: volver,
    viva: false,
    html: `<div class="cabeza"><div><div class="migas"><a href="${volver}">${deColectores ? "Colectores (común a todos)" : esc(nombreEquipo(eq))}</a></div>
        <h1>${nueva ? "Nueva plantilla" : esc(P.nombre)}</h1>
        <p class="bajada">${admin ? `Los cambios valen para las inspecciones que se hagan desde ahora; las hechas guardan cómo eran.${deColectores ? " Esta plantilla sirve para cualquier colector: al asignar la ronda se eligen cuáles." : ""}` : "Solo el administrador cambia las plantillas."}</p></div></div>
      <form id="form-pl" novalidate>
        <div class="panel" style="margin-bottom:16px"><div class="rejilla-campos dos">
          <div class="campo"><label for="p-nombre">Nombre</label><input id="p-nombre" type="text" value="${esc(P.nombre)}" placeholder="Por ejemplo: Ronda en marcha" ${dis}></div>
          <div class="campo"><label for="p-cuando">Cuándo se hace</label><select id="p-cuando" ${dis}>
            <option value="marcha" ${P.cuando !== "parada" ? "selected" : ""}>Con el equipo en marcha</option>
            <option value="parada" ${P.cuando === "parada" ? "selected" : ""}>Con el equipo parado</option></select></div>
          <div class="campo"><label for="p-frec">Cada cuántos días (sugerido)</label><input id="p-frec" type="number" min="1" max="365" value="${esc(P.frecuencia_dias ?? "")}" ${dis}>
            <span class="ayuda">Es lo que se propone al asignarla. Ajústalo con lo que vayas viendo.</span></div>
          <div class="campo"><label for="p-firma">Firma al terminar</label><select id="p-firma" ${dis}>
            <option value="" ${P.pedir_firma == null ? "selected" : ""}>Lo que diga Ajustes (${d.ajustes?.pedir_firma === false ? "no" : "sí"})</option>
            <option value="1" ${P.pedir_firma === 1 ? "selected" : ""}>Siempre</option><option value="0" ${P.pedir_firma === 0 ? "selected" : ""}>No pedirla</option></select></div>
        </div></div>
        <h2 style="margin:0 4px 10px">Revisiones</h2>
        <ol class="editor-items">${P.items.map(htmlItem).join("")}</ol>
        ${admin ? `<div class="atajos" style="margin-top:14px"><button type="button" class="boton" data-accion="agregar">${icono("mas1")}Agregar revisión</button></div>
        <div class="pie-fijo"><div class="avance" data-cambios>Sin cambios</div>
          ${!nueva ? `<button type="button" class="boton plano peligro" data-accion="borrar">Borrar</button>` : ""}
          <button type="submit" class="boton primario">${icono("bien")}Guardar</button></div>` : ""}
      </form>`,
    montar(m) {
      const f = m.querySelector("#form-pl");
      const lista = m.querySelector(".editor-items");
      let sucio = false;
      const marcar = () => { sucio = true; const c = m.querySelector("[data-cambios]"); if (c) c.innerHTML = "<b>Cambios sin guardar</b>"; };
      const repintar = () => { lista.innerHTML = P.items.map(htmlItem).join(""); };
      f.addEventListener("input", (e) => {
        const t = e.target;
        const li = t.closest("[data-k]");
        if (li && t.dataset.c) {
          const it = P.items[Number(li.dataset.k)];
          it[t.dataset.c] = t.dataset.c === "subequipo_id" ? t.value || undefined : t.value;
          if (t.dataset.c === "min" || t.dataset.c === "max") it.tipico = false;
        }
        marcar();
      });
      f.addEventListener("change", (e) => {
        if (e.target.dataset.c === "tipo") repintar();
        if (e.target.dataset.c === "subequipo_id") { P.items[Number(e.target.closest("[data-k]").dataset.k)].subequipo_id = e.target.value || undefined; marcar(); }
      });
      f.addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        const li = b.closest("[data-k]");
        const k = li ? Number(li.dataset.k) : -1;
        if (b.dataset.mover) {
          const j = k + Number(b.dataset.mover);
          [P.items[k], P.items[j]] = [P.items[j], P.items[k]];
          repintar(); marcar();
          lista.querySelector(`[data-k="${j}"] [data-mover="${b.dataset.mover}"]`)?.focus();
        } else if (b.hasAttribute("data-quitar-item")) {
          if (P.items.length === 1) { aviso("Una plantilla necesita por lo menos una revisión.", { error: true }); return; }
          P.items.splice(k, 1); repintar(); marcar();
        } else if (b.dataset.accion === "agregar") {
          P.items.push({ id: `item-${Date.now()}`, tipo: "ok", texto: "", ayuda: "", foto: "" });
          repintar(); marcar();
          lista.querySelector(`[data-k="${P.items.length - 1}"] input`)?.focus();
        } else if (b.dataset.accion === "borrar") {
          if (!(await confirmar("¿Borrar la plantilla?", "Las inspecciones ya hechas con ella se conservan.", "Borrar", "peligro"))) return;
          try {
            await api.escribir(`plantillas/${encodeURIComponent(original.id)}/borrar`, {});
            aviso("Plantilla borrada.");
            sucio = false;
            ir(volver);
          } catch (x) {
            aviso(x.sinRed ? "Para borrar hace falta señal." : x.message, { error: true });
          }
        }
      });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        P.nombre = f["p-nombre"].value.trim();
        P.cuando = f["p-cuando"].value;
        P.frecuencia_dias = Number(f["p-frec"].value) || null;
        P.pedir_firma = f["p-firma"].value === "" ? null : f["p-firma"].value === "1";
        if (!P.nombre) { aviso("Ponle un nombre a la plantilla.", { error: true }); f["p-nombre"].focus(); return; }
        // una fila que quedó en blanco (se agregó y no se usó) no se guarda ni estorba
        const vacia = (it) => !String(it.texto ?? "").trim() && !String(it.ayuda ?? "").trim() && !String(it.unidad ?? "").trim() && [it.min, it.max].every((v) => v === "" || v == null);
        const items = P.items.filter((it) => !vacia(it)).map((it) => ({ ...it, min: String(it.min ?? "").trim() === "" ? null : leerNumero(it.min) ?? NaN, max: String(it.max ?? "").trim() === "" ? null : leerNumero(it.max) ?? NaN }));
        if (!items.length) { aviso("Agrega por lo menos una revisión.", { error: true }); return; }
        const sinNombre = P.items.findIndex((it) => !vacia(it) && !String(it.texto).trim());
        if (sinNombre >= 0) { aviso("Hay una revisión sin nombre: escríbelo o quítala.", { error: true }); m.querySelector(`#i-t-${sinNombre}`)?.focus(); return; }
        if (items.some((it) => it.tipo === "medida" && [it.min, it.max].some((v) => Number.isNaN(v)))) { aviso("Un mínimo o máximo no es un número.", { error: true }); return; }
        const alReves = items.find((it) => it.tipo === "medida" && it.min != null && it.max != null && it.min > it.max);
        if (alReves) { aviso(`En «${alReves.texto}» el mínimo es mayor que el máximo.`, { error: true }); return; }
        const b = f.querySelector("button[type=submit]");
        b.disabled = true;
        try {
          const r = await api.escribir("plantillas", { ...P, items, id: original?.id });
          sucio = false;
          aviso("Plantilla guardada.");
          ir(`#/plantilla/${encodeURIComponent(r.id)}`);
        } catch (x) {
          b.disabled = false;
          aviso(x.sinRed ? "Para guardar la plantilla hace falta señal. Tus cambios siguen aquí." : x.message, { error: true });
        }
      });
      const salir = (e) => { if (sucio) { e.preventDefault(); e.returnValue = ""; } };
      addEventListener("beforeunload", salir);
      return () => removeEventListener("beforeunload", salir);
    },
    ocupada: () => false,
  };
}
