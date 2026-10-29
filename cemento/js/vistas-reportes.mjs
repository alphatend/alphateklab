// Reportes. Se elige el período, el alcance (toda la planta, un área, un equipo o los colectores) y la plantilla:
// - Formal: membrete con el logo de la empresa, resumen, tablas y firmas.
// - Por equipo: una hoja por equipo, o por área («subdivisión»), con sus medidas, hallazgos y pendientes.
// - Ejecutivo: una página con los indicadores (cumplimiento, a tiempo, cierre, por persona, por equipo).
// Sale impreso o en PDF (diálogo de impresión, en carta), en Excel (todas las tablas, para filtrar y graficar),
// copiado como correo (con asunto, saludo y firma) o para WhatsApp. Todo se arma en el aparato: funciona sin señal.
import { esc, icono, fechaCorta, fechaLarga, fechaHora, sumarDias, diaDe, numero, plural, numeroHallazgo, diasEntre } from "./util.mjs";
import * as api from "./api.mjs";
import {
  aviso, vacio, equipo, plantilla, nombre, nombreCorto, nombreEquipo, queInspeccion, equiposDe, persona, TEXTO_PRIORIDAD, TEXTO_ESTADO,
} from "./ui.mjs";
import { fueraDeRango, textoRango } from "./vistas-inspecciones.mjs";
import { libroXlsx, TIPO_XLSX } from "./xlsx.mjs";
import { nombreCompleto } from "./componentes.mjs";
import { disponibilidad, duracion } from "./vistas-paros.mjs";
import { paraQuien, TEXTO_ESTADO_TAREA } from "./vistas-tareas.mjs";

/** Lunes de la semana de un día (AAAA-MM-DD). */
function lunes(dia) {
  const w = new Date(dia + "T12:00:00Z").getUTCDay();
  return sumarDias(dia, -((w + 6) % 7));
}

const PERIODOS = [["semana", "Esta semana"], ["pasada", "Semana pasada"], ["mes", "Este mes"], ["mesPasado", "Mes pasado"], ["todo", "Todo"], ["rango", "Otro período"]];

export function periodo(query, hoy, d) {
  const p = query.get("p") ?? "semana";
  if (p === "pasada") { const l = lunes(sumarDias(hoy, -7)); return { p, desde: l, hasta: sumarDias(l, 6), texto: "Semana pasada" }; }
  if (p === "mes") return { p, desde: hoy.slice(0, 8) + "01", hasta: hoy, texto: "Este mes" };
  if (p === "mesPasado") { const fin = sumarDias(hoy.slice(0, 8) + "01", -1); return { p, desde: fin.slice(0, 8) + "01", hasta: fin, texto: "Mes pasado" }; }
  if (p === "todo") {
    const fechas = [...(d?.inspecciones ?? []).map((i) => diaDe(i.hecha_en) ?? i.vence), ...(d?.hallazgos ?? []).map((h) => diaDe(h.creado))].filter(Boolean).sort();
    return { p, desde: fechas[0] ?? hoy, hasta: hoy, texto: "Desde el inicio" };
  }
  if (p === "rango") {
    const desde = query.get("desde") ?? sumarDias(hoy, -6), hasta = query.get("hasta") ?? hoy;
    return { p, desde: desde <= hasta ? desde : hasta, hasta: desde <= hasta ? hasta : desde, texto: "Del período" };
  }
  return { p: "semana", desde: lunes(hoy), hasta: hoy, texto: "Esta semana" };
}

/** Qué equipos entran: toda la planta, un área, un equipo o los colectores. */
export function alcanceDe(d, valor = "planta") {
  const [tipo, ...resto] = valor.split(":");
  const arg = resto.join(":");
  const conHijos = (ids) => new Set([...ids, ...d.equipos.filter((e) => ids.has(e.padre_id)).map((e) => e.id)]);
  if (tipo === "area") return { valor, texto: arg, ids: conHijos(new Set(d.equipos.filter((e) => e.area === arg).map((e) => e.id))) };
  if (tipo === "equipo") return { valor, texto: nombreCompleto(d, arg), ids: conHijos(new Set([arg])), uno: equipo(d, arg) };
  if (tipo === "colectores") return { valor, texto: "Colectores de polvo", ids: conHijos(new Set(d.equipos.filter((e) => e.tipo === "colector").map((e) => e.id))) };
  return { valor: "planta", texto: d.ajustes?.planta || "Toda la planta", ids: new Set(d.equipos.map((e) => e.id)), planta: true };
}

export function calcularReporte(d, desde, hasta, hoy, alcance = alcanceDe(d)) {
  const enRango = (dia) => dia && dia >= desde && dia <= hasta;
  const toca = (i) => equiposDe(i).some((e) => alcance.ids.has(e));
  const ins = d.inspecciones.filter(toca);
  const programadas = ins.filter((i) => enRango(i.vence));
  const hechas = ins.filter((i) => i.estado === "hecha" && enRango(diaDe(i.hecha_en))).sort((a, b) => (a.hecha_en ?? "").localeCompare(b.hecha_en ?? ""));
  const aTiempo = hechas.filter((i) => diaDe(i.hecha_en) <= i.vence);
  const corte = hasta < hoy ? hasta : hoy;
  const atrasadas = ins.filter((i) => i.estado === "pendiente" && i.vence < corte && i.vence <= hasta);
  const hall = d.hallazgos.filter((h) => alcance.ids.has(h.equipo_id));
  const nuevos = hall.filter((h) => enRango(diaDe(h.creado)));
  const cerrados = hall.filter((h) => h.estado === "cerrado" && enRango(diaDe(h.cerrado)));
  const abiertos = hall.filter((h) => h.estado !== "cerrado");
  const progHechas = programadas.filter((i) => i.estado === "hecha").length;
  const cierres = cerrados.map((h) => diasEntre(diaDe(h.creado), diaDe(h.cerrado)));
  const cierreMedio = cierres.length ? cierres.reduce((a, b) => a + b, 0) / cierres.length : null;
  // por equipo de arriba (lo de sus subequipos suma al padre)
  const fam = (e) => new Set([e.id, ...d.equipos.filter((x) => x.padre_id === e.id).map((x) => x.id)]);
  const equipos = d.equipos.filter((e) => !e.padre_id && alcance.ids.has(e.id) && (e.activo || ins.some((i) => equiposDe(i).includes(e.id)) || hall.some((h) => fam(e).has(h.equipo_id))));
  const ms0 = Date.parse(desde + "T05:00:00Z"), ms1 = Math.min(Date.parse(hasta + "T05:00:00Z") + 86400e3, Date.now());
  const porEquipo = equipos.map((e) => {
    const f = fam(e);
    return {
      e,
      hechas: hechas.filter((i) => equiposDe(i).includes(e.id)).length,
      atrasadas: atrasadas.filter((i) => equiposDe(i).includes(e.id)).length,
      nuevos: nuevos.filter((h) => f.has(h.equipo_id)).length,
      abiertos: abiertos.filter((h) => f.has(h.equipo_id)).length,
      disp: e.tipo === "colector" ? null : disponibilidad(d, e.id, ms0, ms1),
    };
  });
  const paros = (d.paros ?? []).filter((p) => p.tipo === "no_programado" && alcance.ids.has(p.equipo_id) && Date.parse(p.inicio) < ms1 && Date.parse(p.fin ?? new Date().toISOString()) > ms0)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const tareasHechas = (d.tareas ?? []).filter((t) => t.estado === "hecha" && enRango(diaDe(t.hecha_en)) && (!t.equipo_id || alcance.ids.has(t.equipo_id)) && (alcance.planta || t.equipo_id));
  const tareasAtrasadas = (d.tareas ?? []).filter((t) => t.estado !== "hecha" && t.vence && t.vence < corte && (!t.equipo_id || alcance.ids.has(t.equipo_id)) && (alcance.planta || t.equipo_id));
  const conDisp = porEquipo.filter((x) => x.disp);
  const dispProm = conDisp.length ? conDisp.reduce((s, x) => s + x.disp.disp, 0) / conDisp.length : null;
  const porPersona = d.personas.map((p) => {
    const asig = programadas.filter((i) => i.asignada_a === p.id || (p.turno && i.asignada_a === `turno:${p.turno}` && (i.estado !== "hecha" || i.hecha_por === p.id)));
    const h = asig.filter((i) => i.estado === "hecha").length;
    return { p, asignadas: asig.length, hechas: h, pct: asig.length ? h / asig.length : null };
  }).filter((x) => x.asignadas);
  return {
    programadas, hechas, aTiempo, atrasadas, nuevos, cerrados, abiertos, progHechas, porEquipo, porPersona, cierreMedio, paros, tareasHechas, tareasAtrasadas, dispProm,
    cumplimiento: programadas.length ? progHechas / programadas.length : null,
    aTiempoPct: hechas.length ? aTiempo.length / hechas.length : null,
  };
}

/** Como Object.groupBy (que no está en iOS 16). */
const agrupar = (xs, f) => xs.reduce((a, x) => ((a[f(x)] ??= []).push(x), a), {});
const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)} %`);
const ORDEN = { alta: 0, media: 1, baja: 2 };

/** Las medidas y revisiones de las inspecciones hechas, una fila por respuesta (para las hojas por equipo y el Excel). */
function filasRespuestas(d, hechas, ids) {
  const xs = [];
  for (const i of hechas) {
    const items = i.items ?? plantilla(d, i.plantilla_id)?.items ?? [];
    for (const r of i.respuestas ?? []) {
      const eqId = r.equipo_id ?? i.equipo_id;
      if (ids && !ids.has(eqId)) continue;
      const it = items.find((x) => x.id === r.item_id);
      if (!it) continue;
      xs.push({ i, r, it, eqId, fuera: it.tipo === "medida" ? fueraDeRango(it, r.valor) : null });
    }
  }
  return xs;
}

// ------------------------------------------------------------------------------- el documento

function membrete(d, yo, hoy, titulo) {
  const a = d.ajustes ?? {};
  return `<div class="membrete">${a.logo ? `<img src="${esc(a.logo)}" alt="">` : ""}
    <div class="quien-emite"><b>${esc(a.empresa || a.app_nombre || "Bitácora de proceso")}</b><span>${esc([a.planta, "Ingeniería de procesos"].filter(Boolean).join(" · "))}</span></div>
    <div class="folio">${esc(titulo)}<br>${esc(fechaLarga(hoy))}<br>Preparó: ${esc(yo.nombre)}</div></div>`;
}
const pie = (d, yo) => `<div class="pie-doc"><span>${esc(d.ajustes?.pie_reporte || `${d.ajustes?.app_nombre || "Bitácora de proceso"} · ${d.ajustes?.empresa || ""}`)}</span><span>Generado el ${esc(fechaHora(new Date().toISOString()))}</span></div>`;
const firmas = (yo) => `<div class="firmas"><div>Preparó: ${esc(yo.nombre)}${yo.puesto ? `<br>${esc(yo.puesto)}` : ""}</div><div>Revisó</div></div>`;
const kpis = (xs) => `<div class="kpis">${xs.map(([v, t]) => `<div><b>${v}</b><span>${esc(t)}</span></div>`).join("")}</div>`;
const fotos = (ids, con) => (con && ids?.length ? `<div class="fotos-reporte">${ids.filter((f) => !f.startsWith("v-")).slice(0, 3).map((f) => `<img src="${esc(api.urlMedio(f))}" alt="" onerror="this.remove()">`).join("")}</div>` : "");

function parrafoResumen(r, per) {
  return `Del ${fechaLarga(per.desde)} al ${fechaLarga(per.hasta)} ${r.hechas.length === 1 ? "se hizo 1 inspección" : `se hicieron ${r.hechas.length} inspecciones`}` +
    (r.programadas.length ? `; de las ${r.programadas.length} programadas para el período se completaron ${r.progHechas} (${pct(r.cumplimiento)})` : "") +
    (r.atrasadas.length ? ` y ${r.atrasadas.length === 1 ? "queda 1 atrasada" : `quedan ${r.atrasadas.length} atrasadas`}` : "") +
    `. ${r.nuevos.length === 1 ? "Se anotó 1 hallazgo" : `Se anotaron ${r.nuevos.length} hallazgos`} y ${r.cerrados.length === 1 ? "se cerró 1" : `se cerraron ${r.cerrados.length}`}; ` +
    (r.abiertos.length ? `${r.abiertos.length === 1 ? "queda 1 abierto" : `quedan ${r.abiertos.length} abiertos`}${r.abiertos.some((h) => h.prioridad === "alta") ? `, ${r.abiertos.filter((h) => h.prioridad === "alta").length} de prioridad alta` : ""}.` : "no queda ninguno abierto.");
}

function tablaHallazgos(d, xs, conFotos) {
  if (!xs.length) return `<p class="vacio-doc">Ninguno.</p>`;
  return `<table class="tabla"><thead><tr><th>N.º</th><th>Prioridad</th><th>Equipo</th><th>Qué se encontró</th><th>Qué hay que hacer</th><th>A cargo</th><th>Estado</th></tr></thead><tbody>
    ${xs.map((h) => `<tr><td class="n">${numeroHallazgo(h)}</td><td class="prio-${h.prioridad}">${TEXTO_PRIORIDAD[h.prioridad]}</td><td>${esc(nombreEquipo(equipo(d, h.equipo_id)))}</td>
      <td>${esc(h.descripcion)}${fotos(h.fotos, conFotos)}</td><td>${esc(h.accion ?? "")}${h.ot ? `<br><b>${esc(h.ot)}</b>` : ""}${h.vence && h.estado !== "cerrado" ? `<br>Compromiso: ${esc(fechaCorta(h.vence))}` : ""}</td>
      <td>${esc(nombreCorto(d, h.responsable_id))}</td><td>${TEXTO_ESTADO[h.estado]}</td></tr>`).join("")}</tbody></table>`;
}

function tablaHechas(d, xs) {
  if (!xs.length) return `<p class="vacio-doc">Ninguna en el período.</p>`;
  return `<table class="tabla"><thead><tr><th>Fecha</th><th>Equipo</th><th>Inspección</th><th>Hizo</th><th class="n">Hallazgos</th><th>Visto bueno</th></tr></thead><tbody>
    ${xs.map((i) => `<tr><td>${esc(fechaCorta(diaDe(i.hecha_en)))}</td><td>${esc(queInspeccion(d, i))}</td><td>${esc(plantilla(d, i.plantilla_id)?.nombre ?? "")}</td>
      <td>${esc(nombreCorto(d, i.hecha_por))}</td><td class="n">${d.hallazgos.filter((h) => h.inspeccion_id === i.id).length}</td><td>${i.revisada_en ? esc(nombreCorto(d, i.revisada_por)) : "—"}</td></tr>`).join("")}</tbody></table>`;
}

function tablaParos(d, r) {
  if (!r.paros.length) return `<p class="vacio-doc">Ningún paro no programado en el período.</p>`;
  return `<table class="tabla"><thead><tr><th>Inicio</th><th>Equipo</th><th>Causa</th><th>Qué pasó</th><th class="n">Duración</th></tr></thead><tbody>
    ${r.paros.map((p) => `<tr><td>${esc(fechaHora(p.inicio))}</td><td>${esc(nombreCompleto(d, p.equipo_id))}</td><td>${esc(p.causa ?? "")}</td><td>${esc(p.descripcion ?? "")}</td>
      <td class="n">${p.fin ? duracion((Date.parse(p.fin) - Date.parse(p.inicio)) / 3600e3) : "en curso"}</td></tr>`).join("")}</tbody></table>`;
}
function tablaDisponibilidad(r) {
  const xs = r.porEquipo.filter((x) => x.disp);
  if (!xs.length) return "";
  return `<table class="tabla"><thead><tr><th>Equipo</th><th class="n">Paros</th><th class="n">Horas paradas</th><th class="n">Disponibilidad</th></tr></thead><tbody>
    ${xs.map((x) => `<tr><td>${esc(nombreEquipo(x.e))}</td><td class="n">${x.disp.eventos}</td><td class="n">${numero(x.disp.paradas, 1)}</td>
      <td class="n ${x.disp.disp < 0.95 ? "fuera" : ""}">${numero(x.disp.disp * 100, 1)} %</td></tr>`).join("")}</tbody></table>`;
}
function tablaTareas(d, xs, titulo) {
  if (!xs.length) return "";
  return `<h2>${titulo}</h2><table class="tabla"><thead><tr><th>Tarea</th><th>Equipo</th><th>A cargo</th><th>${titulo.startsWith("Tareas hechas") ? "Hecha" : "Vencía"}</th></tr></thead><tbody>
    ${xs.map((t) => `<tr><td>${esc(t.titulo)}${t.nota_cierre ? `<br><small>${esc(t.nota_cierre)}</small>` : ""}</td><td>${t.equipo_id ? esc(nombreCompleto(d, t.equipo_id)) : ""}</td>
      <td>${esc(t.estado === "hecha" ? nombreCorto(d, t.hecha_por) : paraQuien(d, t.asignada_a))}</td><td>${esc(t.estado === "hecha" ? fechaCorta(diaDe(t.hecha_en)) : fechaCorta(t.vence))}</td></tr>`).join("")}</tbody></table>`;
}

function tablaAtrasadas(d, xs) {
  return `<table class="tabla"><thead><tr><th>Equipo</th><th>Inspección</th><th>A cargo</th><th>Vencía</th></tr></thead><tbody>
    ${xs.map((i) => `<tr><td>${esc(queInspeccion(d, i))}</td><td>${esc(plantilla(d, i.plantilla_id)?.nombre ?? "")}</td><td>${esc(nombreCorto(d, i.asignada_a))}</td><td>${esc(fechaCorta(i.vence))}</td></tr>`).join("")}</tbody></table>`;
}

function docFormal(d, yo, hoy, per, al, r, o) {
  const nuevos = [...r.nuevos].sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad]);
  return `<article class="documento">${membrete(d, yo, hoy, "Reporte de inspecciones")}
    <h1>Reporte de inspecciones</h1><p class="sub-doc">${esc(al.texto)} · ${esc(per.texto)}: ${esc(fechaLarga(per.desde))} al ${esc(fechaLarga(per.hasta))}</p>
    <p>${esc(parrafoResumen(r, per))}</p>
    ${kpis([[pct(r.cumplimiento), "cumplimiento de lo programado"], [r.hechas.length, "inspecciones hechas"], [r.nuevos.length, "hallazgos nuevos"], [r.abiertos.length, "hallazgos abiertos hoy"]])}
    ${al.uno ? "" : `<h2>Por equipo</h2><table class="tabla"><thead><tr><th>Equipo</th><th>Área</th><th class="n">Hechas</th><th class="n">Atrasadas</th><th class="n">Hallazgos nuevos</th><th class="n">Abiertos</th></tr></thead>
      <tbody>${r.porEquipo.filter((x) => x.hechas || x.atrasadas || x.nuevos || x.abiertos || !al.planta).map((x) => `<tr><td>${esc(nombreEquipo(x.e))}</td><td>${esc(x.e.area ?? "")}</td><td class="n">${x.hechas}</td>
        <td class="n ${x.atrasadas ? "fuera" : ""}">${x.atrasadas}</td><td class="n">${x.nuevos}</td><td class="n">${x.abiertos}</td></tr>`).join("")}</tbody></table>`}
    <h2>Hallazgos del período</h2>${tablaHallazgos(d, nuevos, o.fotos)}
    ${r.abiertos.filter((h) => !r.nuevos.includes(h)).length ? `<h2>Siguen abiertos de antes</h2>${tablaHallazgos(d, r.abiertos.filter((h) => !r.nuevos.includes(h)).sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad]), false)}` : ""}
    ${r.atrasadas.length ? `<h2>Inspecciones atrasadas</h2>${tablaAtrasadas(d, r.atrasadas)}` : ""}
    <h2>Inspecciones hechas</h2>${tablaHechas(d, r.hechas)}
    ${r.porEquipo.some((x) => x.disp) ? `<h2>Disponibilidad y paros</h2>${tablaDisponibilidad(r)}${r.paros.length ? `<p style="margin:10px 0 4px"><b>Paros no programados</b></p>${tablaParos(d, r)}` : ""}` : ""}
    ${tablaTareas(d, r.tareasAtrasadas, "Tareas atrasadas")}${tablaTareas(d, r.tareasHechas, "Tareas hechas en el período")}
    ${firmas(yo)}${pie(d, yo)}</article>`;
}

function hojaEquipo(d, e, hechas, per, r, o) {
  const ids = new Set([e.id]);
  const mias = hechas.filter((i) => equiposDe(i).includes(e.id));
  const filas = filasRespuestas(d, mias, ids);
  const medidas = filas.filter((x) => x.it.tipo === "medida" && x.r.valor != null);
  const malas = filas.filter((x) => x.it.tipo !== "medida" && x.r.resultado === "mal");
  const notas = filas.filter((x) => x.r.texto && x.it.tipo === "texto");
  const fam = new Set([e.id, ...d.equipos.filter((x) => x.padre_id === e.id).map((x) => x.id)]);
  const hall = [...r.nuevos, ...r.abiertos.filter((h) => !r.nuevos.includes(h))].filter((h) => fam.has(h.equipo_id));
  const paros = r.paros.filter((p) => fam.has(p.equipo_id));
  const disp = r.porEquipo.find((x) => x.e.id === e.id)?.disp;
  const pend = r.atrasadas.filter((i) => equiposDe(i).includes(e.id));
  return `<h2>${e.tag ? `<span class="tag-doc">${esc(e.tag)}</span>` : ""}${esc(e.nombre)}</h2>
    <p class="sub-doc">${esc([e.area, e.sirve_a ? `sirve a ${e.sirve_a}` : "", plural(mias.length, "inspección en el período", "inspecciones en el período"),
      disp ? `disponibilidad ${numero(disp.disp * 100, 1)} %` : ""].filter(Boolean).join(" · "))}</p>
    ${mias.length ? `<table class="tabla"><thead><tr><th>Fecha</th><th>Inspección</th><th>Hizo</th><th>En sitio (QR)</th><th>Firma</th></tr></thead><tbody>
      ${mias.map((i) => { const v = (i.verificaciones ?? []).find((x) => fam.has(x.equipo_id)); return `<tr><td>${esc(fechaCorta(diaDe(i.hecha_en)))}</td><td>${esc(plantilla(d, i.plantilla_id)?.nombre ?? "")}</td>
        <td>${esc(nombreCorto(d, i.hecha_por))}</td><td>${v ? `✓ ${esc(fechaHora(v.en).split(", ")[1])}` : "—"}</td>
        <td>${i.firma ? `<img src="${esc(api.urlMedio(i.firma))}" alt="Firma" style="height:26px">` : "—"}</td></tr>`; }).join("")}</tbody></table>` : ""}
    ${medidas.length ? `<table class="tabla"><thead><tr><th>Fecha</th><th>Medida</th><th class="n">Valor</th><th>Rango</th></tr></thead><tbody>
      ${medidas.map((x) => `<tr><td>${esc(fechaCorta(diaDe(x.i.hecha_en)))}</td><td>${esc(x.it.texto)}</td><td class="n ${x.fuera ? "fuera" : ""}">${numero(x.r.valor, 2)} ${esc(x.it.unidad ?? "")}</td>
        <td>${esc(textoRango(x.it).replace(/^Rango: /, ""))}</td></tr>`).join("")}</tbody></table>` : ""}
    ${malas.length ? `<p style="margin-top:8px"><b>Revisiones con problema:</b> ${malas.map((x) => `${esc(x.it.texto)} (${esc(fechaCorta(diaDe(x.i.hecha_en)))}${x.r.texto ? `: ${esc(x.r.texto)}` : ""})`).join("; ")}.</p>${malas.map((x) => fotos(x.r.fotos, o.fotos)).join("")}` : ""}
    ${notas.length ? `<p style="margin-top:8px"><b>Observaciones:</b> ${notas.map((x) => `${esc(x.r.texto)} (${esc(fechaCorta(diaDe(x.i.hecha_en)))})`).join(" · ")}</p>` : ""}
    ${hall.length ? `<p style="margin:10px 0 4px"><b>Hallazgos</b></p>${tablaHallazgos(d, hall.sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad]), o.fotos)}` : ""}
    ${paros.length ? `<p style="margin:10px 0 4px"><b>Paros no programados</b></p>${tablaParos(d, { paros })}` : ""}
    ${pend.length ? `<p style="margin-top:8px;color:#c2000f"><b>Atrasadas:</b> ${pend.map((i) => `${esc(plantilla(d, i.plantilla_id)?.nombre ?? "")}, vencía el ${esc(fechaCorta(i.vence))} (${esc(nombreCorto(d, i.asignada_a))})`).join("; ")}.</p>` : ""}
    ${!mias.length && !hall.length && !pend.length ? `<p class="vacio-doc">Sin inspecciones ni hallazgos en el período.</p>` : ""}`;
}

function docPorEquipo(d, yo, hoy, per, al, r, o) {
  const equipos = r.porEquipo.map((x) => x.e).filter((e) => e.activo || r.porEquipo.find((x) => x.e === e).hechas);
  const portada = `<article class="documento">${membrete(d, yo, hoy, "Reporte por equipo")}
    <h1>Reporte por ${o.agrupar === "area" ? "área" : "equipo"}</h1><p class="sub-doc">${esc(al.texto)} · ${esc(per.texto)}: ${esc(fechaLarga(per.desde))} al ${esc(fechaLarga(per.hasta))}</p>
    <p>${esc(parrafoResumen(r, per))}</p>
    ${kpis([[pct(r.cumplimiento), "cumplimiento"], [r.hechas.length, "inspecciones hechas"], [r.nuevos.length, "hallazgos nuevos"], [r.abiertos.length, "abiertos hoy"]])}
    <h2>Contenido</h2><table class="tabla"><thead><tr><th>${o.agrupar === "area" ? "Área" : "Equipo"}</th><th class="n">Hechas</th><th class="n">Atrasadas</th><th class="n">Hallazgos nuevos</th><th class="n">Abiertos</th></tr></thead><tbody>
      ${(o.agrupar === "area" ? Object.entries(agrupar(r.porEquipo, (x) => x.e.area || "Sin área")).map(([a, xs]) => ({ t: a, ...["hechas", "atrasadas", "nuevos", "abiertos"].reduce((s, k) => ({ ...s, [k]: xs.reduce((n, x) => n + x[k], 0) }), {}) }))
        : r.porEquipo.map((x) => ({ t: nombreEquipo(x.e), ...x }))).map((x) => `<tr><td>${esc(x.t)}</td><td class="n">${x.hechas}</td><td class="n ${x.atrasadas ? "fuera" : ""}">${x.atrasadas}</td><td class="n">${x.nuevos}</td><td class="n">${x.abiertos}</td></tr>`).join("")}</tbody></table>
    ${firmas(yo)}${pie(d, yo)}</article>`;
  const hojas = o.agrupar === "area"
    ? Object.entries(agrupar(equipos, (e) => e.area || "Sin área")).sort(([a], [b]) => a.localeCompare(b)).map(([area, es]) => `<article class="documento">${membrete(d, yo, hoy, area)}
        <h1>${esc(area)}</h1><p class="sub-doc">${esc(per.texto)}: ${esc(fechaLarga(per.desde))} al ${esc(fechaLarga(per.hasta))} · ${plural(es.length, "equipo", "equipos")}</p>
        ${es.map((e) => hojaEquipo(d, e, r.hechas, per, r, o)).join("")}${pie(d, yo)}</article>`)
    : equipos.map((e) => `<article class="documento">${membrete(d, yo, hoy, e.tag || e.nombre)}
        <h1>${esc(e.nombre)}</h1><p class="sub-doc">${esc(per.texto)}: ${esc(fechaLarga(per.desde))} al ${esc(fechaLarga(per.hasta))}</p>
        ${hojaEquipo(d, e, r.hechas, per, r, o).replace(/^<h2>[\s\S]*?<\/h2>\s*/, "")}${pie(d, yo)}</article>`);
  return al.uno ? hojas.join("") : portada + hojas.join("");
}

function barras(xs) {
  const max = Math.max(1, ...xs.map((x) => x.v));
  return `<div class="barras">${xs.map((x) => `<div><span>${esc(x.t)}</span><i style="width:${Math.max(2, (100 * x.v) / max)}%;${x.color ? `background:${x.color}` : ""}"></i><b class="n">${x.etiqueta ?? x.v}</b></div>`).join("")}</div>`;
}

function docEjecutivo(d, yo, hoy, per, al, r) {
  const altas = r.abiertos.filter((h) => h.prioridad === "alta").sort((a, b) => (a.creado ?? "").localeCompare(b.creado ?? ""));
  const porEquipo = r.porEquipo.filter((x) => x.nuevos).sort((a, b) => b.nuevos - a.nuevos).slice(0, 8);
  return `<article class="documento ejecutivo">${membrete(d, yo, hoy, "Resumen ejecutivo")}
    <h1>Resumen ejecutivo</h1><p class="sub-doc">${esc(al.texto)} · ${esc(fechaLarga(per.desde))} al ${esc(fechaLarga(per.hasta))}</p>
    ${kpis([[pct(r.cumplimiento), "cumplimiento de lo programado"], [pct(r.aTiempoPct), "hechas a tiempo"], [r.abiertos.length, "hallazgos abiertos"],
      [r.dispProm == null ? (r.cierreMedio == null ? "—" : `${numero(r.cierreMedio, 1)} d`) : `${numero(r.dispProm * 100, 1)} %`, r.dispProm == null ? "cierre promedio de hallazgos" : "disponibilidad promedio"]])}
    <p>${esc(parrafoResumen(r, per))}</p>
    ${r.porPersona.length ? `<h2>Cumplimiento por persona</h2>${barras(r.porPersona.map((x) => ({ t: x.p.turno ? `Turno ${x.p.turno}` : x.p.nombre, v: x.pct ?? 0, etiqueta: `${x.hechas}/${x.asignadas}`, color: x.pct < 0.8 ? "#ff9500" : null })))}` : ""}
    ${porEquipo.length ? `<h2>Hallazgos nuevos por equipo</h2>${barras(porEquipo.map((x) => ({ t: x.e.tag || x.e.nombre, v: x.nuevos })))}` : ""}
    <h2>Prioridad alta abiertos</h2>
    ${altas.length ? `<table class="tabla"><thead><tr><th>N.º</th><th>Equipo</th><th>Qué</th><th>A cargo</th><th class="n">Días abierto</th></tr></thead><tbody>
      ${altas.slice(0, 10).map((h) => `<tr><td>${numeroHallazgo(h)}</td><td>${esc(nombreEquipo(equipo(d, h.equipo_id)))}</td><td>${esc(h.descripcion)}${h.estado === "paro" ? " <b>(para el paro)</b>" : ""}</td>
        <td>${esc(nombreCorto(d, h.responsable_id))}</td><td class="n ${diasEntre(diaDe(h.creado), hoy) > 3 ? "fuera" : ""}">${diasEntre(diaDe(h.creado), hoy)}</td></tr>`).join("")}</tbody></table>` : `<p class="vacio-doc">Ninguno.</p>`}
    ${firmas(yo)}${pie(d, yo)}</article>`;
}

// ------------------------------------------------------------------------------- textos para mandar

function textoCorreo(d, yo, per, al, r) {
  const nuevos = [...r.nuevos].sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad]);
  const asunto = `Reporte de inspecciones · ${al.texto} · ${fechaCorta(per.desde)} al ${fechaCorta(per.hasta)}`;
  const firma = [yo.nombre, yo.puesto, d.ajustes?.empresa].filter(Boolean).join("\n");
  const cuerpo = [
    "Buenos días:",
    "",
    `Les comparto el resumen de las inspecciones de ${al.planta ? "la planta" : al.texto} del ${fechaLarga(per.desde)} al ${fechaLarga(per.hasta)}.`,
    "",
    parrafoResumen(r, per),
    ...(nuevos.length ? ["", "Hallazgos del período:", ...nuevos.map((h) => `- ${numeroHallazgo(h)} [${TEXTO_PRIORIDAD[h.prioridad]}] ${nombreEquipo(equipo(d, h.equipo_id))}: ${h.descripcion}${h.accion ? `. Acción: ${h.accion}` : ""}${h.ot ? ` (${h.ot})` : ""}. Estado: ${TEXTO_ESTADO[h.estado].toLowerCase()}.`)] : []),
    ...(r.atrasadas.length ? ["", "Inspecciones atrasadas:", ...r.atrasadas.map((i) => `- ${queInspeccion(d, i)} · ${plantilla(d, i.plantilla_id)?.nombre}: ${nombreCorto(d, i.asignada_a)}, vencía el ${fechaCorta(i.vence)}.`)] : []),
    "",
    "Quedo atento a cualquier comentario.",
    "",
    "Saludos,",
    firma,
  ].join("\n");
  return { asunto, cuerpo };
}

function textoWhatsApp(d, yo, per, al, r) {
  const nuevos = [...r.nuevos].sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad]);
  return [
    `*Reporte de inspecciones* — ${al.texto}, ${fechaCorta(per.desde)} al ${fechaCorta(per.hasta)}`,
    parrafoResumen(r, per),
    ...(nuevos.length ? ["", "*Hallazgos:*", ...nuevos.map((h) => `• ${numeroHallazgo(h)} [${TEXTO_PRIORIDAD[h.prioridad]}] ${nombreEquipo(equipo(d, h.equipo_id))}: ${h.descripcion}${h.accion ? ` → ${h.accion}` : ""} (${TEXTO_ESTADO[h.estado]})`)] : []),
    ...(r.atrasadas.length ? ["", "*Atrasadas:*", ...r.atrasadas.map((i) => `• ${queInspeccion(d, i)} · ${plantilla(d, i.plantilla_id)?.nombre} — ${nombreCorto(d, i.asignada_a)}, vencía el ${fechaCorta(i.vence)}`)] : []),
    "", `Preparó: ${yo.nombre}`,
  ].join("\n");
}

async function copiar(texto, que = "Copiado") {
  try {
    await navigator.clipboard.writeText(texto);
    aviso(`${que}: pégalo donde quieras.`);
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: texto });
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand?.("copy");
    ta.remove();
    aviso(ok ? `${que}.` : "No se pudo copiar solo en este aparato.", { error: !ok });
  }
}

// ------------------------------------------------------------------------------- Excel

/** El libro de Excel con todo lo del alcance y el período: para filtrar, sumar y graficar. */
export function excelDe(d, per, al, hoy) {
  const r = calcularReporte(d, per.desde, per.hasta, hoy, al);
  const eqTag = (id) => equipo(d, id)?.tag ?? "";
  const eqNom = (id) => nombreCompleto(d, id);
  const eqArea = (id) => equipo(d, id)?.area ?? "";
  const filas = filasRespuestas(d, r.hechas, al.ids);
  const enRango = (dia) => dia && dia >= per.desde && dia <= per.hasta;
  const hall = d.hallazgos.filter((h) => al.ids.has(h.equipo_id) && (enRango(diaDe(h.creado)) || h.estado !== "cerrado" || enRango(diaDe(h.cerrado))));
  const ins = [...r.hechas, ...d.inspecciones.filter((i) => i.estado === "pendiente" && equiposDe(i).some((e) => al.ids.has(e)) && i.vence <= per.hasta)];
  return libroXlsx([
    { nombre: "Resumen", columnas: [{ titulo: "Dato", ancho: 38 }, { titulo: "Valor", ancho: 40 }], filas: [
      ["Empresa", d.ajustes?.empresa ?? ""], ["Planta", d.ajustes?.planta ?? ""], ["Alcance", al.texto], ["Desde", fechaLarga(per.desde)], ["Hasta", fechaLarga(per.hasta)],
      ["Inspecciones programadas", r.programadas.length], ["Hechas de las programadas", r.progHechas], ["Cumplimiento", pct(r.cumplimiento)], ["Hechas a tiempo", pct(r.aTiempoPct)],
      ["Inspecciones hechas en el período", r.hechas.length], ["Atrasadas", r.atrasadas.length], ["Hallazgos nuevos", r.nuevos.length], ["Hallazgos cerrados", r.cerrados.length],
      ["Hallazgos abiertos hoy", r.abiertos.length], ["Cierre promedio (días)", r.cierreMedio == null ? "" : numero(r.cierreMedio, 1)], ["Preparó", nombre(d, d.yo?.id)], ["Generado", fechaHora(new Date().toISOString())],
    ] },
    { nombre: "Inspecciones", columnas: [
      { titulo: "Vence", tipo: "fecha" }, { titulo: "Estado" }, { titulo: "Equipo(s)", ancho: 30 }, { titulo: "Tags", ancho: 22 }, { titulo: "Área", ancho: 22 }, { titulo: "Inspección", ancho: 28 },
      { titulo: "Asignada a", ancho: 22 }, { titulo: "Hecha el", tipo: "fechahora" }, { titulo: "Hecha por", ancho: 22 }, { titulo: "A tiempo" }, { titulo: "Hallazgos", tipo: "entero" },
      { titulo: "Visto bueno", ancho: 18 }, { titulo: "Firmada" }, { titulo: "En sitio (QR)" }, { titulo: "Nota", ancho: 40 }, { titulo: "Id", ancho: 12 }],
      filas: ins.map((i) => [i.vence, i.estado === "hecha" ? "Hecha" : i.vence < hoy ? "Atrasada" : "Pendiente", queInspeccion(d, i), equiposDe(i).map(eqTag).filter(Boolean).join(", "),
        eqArea(equiposDe(i)[0]), plantilla(d, i.plantilla_id)?.nombre ?? "", nombre(d, i.asignada_a), i.hecha_en ?? null, i.hecha_por ? nombre(d, i.hecha_por) : "",
        i.estado === "hecha" ? (diaDe(i.hecha_en) <= i.vence ? "Sí" : "No") : "", i.estado === "hecha" ? d.hallazgos.filter((h) => h.inspeccion_id === i.id).length : null,
        i.revisada_en ? nombre(d, i.revisada_por) : "", i.estado === "hecha" ? (i.firma ? "Sí" : "No") : "", i.estado === "hecha" ? ((i.verificaciones ?? []).length ? "Sí" : "No") : "", i.nota ?? "", i.id]) },
    { nombre: "Mediciones", columnas: [
      { titulo: "Fecha", tipo: "fechahora" }, { titulo: "Tag", ancho: 14 }, { titulo: "Equipo", ancho: 28 }, { titulo: "Área", ancho: 22 }, { titulo: "Medida", ancho: 36 },
      { titulo: "Valor", tipo: "numero", decimales: 2 }, { titulo: "Unidad", ancho: 9 }, { titulo: "Mínimo", tipo: "numero", decimales: 2 }, { titulo: "Máximo", tipo: "numero", decimales: 2 },
      { titulo: "Fuera de rango" }, { titulo: "Hizo", ancho: 20 }, { titulo: "Nota", ancho: 36 }],
      filas: filas.filter((x) => x.it.tipo === "medida" && x.r.valor != null).map((x) => [x.i.hecha_en, eqTag(x.eqId), eqNom(x.eqId), eqArea(x.eqId), x.it.texto, x.r.valor, x.it.unidad ?? "",
        x.it.min, x.it.max, x.fuera ? "Sí" : "No", nombre(d, x.i.hecha_por), x.r.texto ?? ""]) },
    { nombre: "Revisiones", columnas: [
      { titulo: "Fecha", tipo: "fechahora" }, { titulo: "Tag", ancho: 14 }, { titulo: "Equipo", ancho: 28 }, { titulo: "Revisión", ancho: 40 }, { titulo: "Resultado", ancho: 12 },
      { titulo: "Valor", tipo: "numero", decimales: 2 }, { titulo: "Nota", ancho: 40 }, { titulo: "Fotos", tipo: "entero" }, { titulo: "Hizo", ancho: 20 }],
      filas: filas.map((x) => [x.i.hecha_en, eqTag(x.eqId), eqNom(x.eqId), x.it.texto, { ok: "Bien", mal: x.it.tipo === "medida" ? "Problema" : "Mal", na: "No aplica" }[x.r.resultado] ?? "",
        x.r.valor, x.r.texto ?? "", x.r.fotos?.length ?? 0, nombre(d, x.i.hecha_por)]) },
    { nombre: "Hallazgos", columnas: [
      { titulo: "N.º", ancho: 9 }, { titulo: "Anotado", tipo: "fechahora" }, { titulo: "Tag", ancho: 14 }, { titulo: "Equipo", ancho: 28 }, { titulo: "Área", ancho: 22 }, { titulo: "Revisión", ancho: 30 },
      { titulo: "Qué se encontró", ancho: 48 }, { titulo: "Prioridad", ancho: 10 }, { titulo: "Estado", ancho: 14 }, { titulo: "Qué hay que hacer", ancho: 40 }, { titulo: "A cargo", ancho: 22 },
      { titulo: "OT / aviso", ancho: 14 }, { titulo: "Compromiso", tipo: "fecha" }, { titulo: "Cerrado", tipo: "fechahora" }, { titulo: "Días abierto", tipo: "entero" }, { titulo: "Anotó", ancho: 20 }],
      filas: hall.sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0)).map((h) => [numeroHallazgo(h), h.creado, eqTag(h.equipo_id), eqNom(h.equipo_id), eqArea(h.equipo_id), h.item ?? "", h.descripcion,
        TEXTO_PRIORIDAD[h.prioridad], TEXTO_ESTADO[h.estado], h.accion ?? "", h.responsable_id ? nombre(d, h.responsable_id) : "", h.ot ?? "", h.vence, h.cerrado,
        diasEntre(diaDe(h.creado), diaDe(h.cerrado) ?? hoy), nombre(d, h.creado_por)]) },
    { nombre: "Seguimientos", columnas: [{ titulo: "Fecha", tipo: "fechahora" }, { titulo: "Hallazgo", ancho: 10 }, { titulo: "Quién", ancho: 22 }, { titulo: "Pasó a", ancho: 14 }, { titulo: "Comentario", ancho: 60 }],
      filas: d.seguimientos.filter((s) => hall.some((h) => h.id === s.hallazgo_id)).map((s) => [s.fecha, numeroHallazgo(d.hallazgos.find((h) => h.id === s.hallazgo_id)), nombre(d, s.persona_id),
        s.estado ? TEXTO_ESTADO[s.estado] : "", s.texto ?? ""]) },
    { nombre: "Paros", columnas: [{ titulo: "Tipo", ancho: 14 }, { titulo: "Inicio", tipo: "fechahora" }, { titulo: "Fin", tipo: "fechahora" }, { titulo: "Horas", tipo: "numero", decimales: 2 },
      { titulo: "Equipo", ancho: 32 }, { titulo: "Área", ancho: 22 }, { titulo: "Causa", ancho: 18 }, { titulo: "Qué pasó / qué se hace", ancho: 50 }, { titulo: "Anotó", ancho: 20 }],
      filas: (d.paros ?? []).filter((p) => al.ids.has(p.equipo_id) && (diaDe(p.inicio) <= per.hasta && (diaDe(p.fin ?? new Date().toISOString()) >= per.desde)))
        .sort((a, b) => a.inicio.localeCompare(b.inicio)).map((p) => [p.tipo === "programado" ? "Programado" : "No programado", p.inicio, p.fin,
          p.fin ? (Date.parse(p.fin) - Date.parse(p.inicio)) / 3600e3 : null, nombreCompleto(d, p.equipo_id), eqArea(p.equipo_id), p.causa ?? "", p.descripcion ?? "", nombre(d, p.creado_por)]) },
    { nombre: "Disponibilidad", columnas: [{ titulo: "Equipo", ancho: 32 }, { titulo: "Área", ancho: 22 }, { titulo: "Paros", tipo: "entero" }, { titulo: "Horas paradas", tipo: "numero", decimales: 1 },
      { titulo: "Horas del período", tipo: "numero", decimales: 0 }, { titulo: "Disponibilidad", tipo: "porcentaje", decimales: 1 }, { titulo: "MTTR (h)", tipo: "numero", decimales: 1 }, { titulo: "MTBF (h)", tipo: "numero", decimales: 0 }],
      filas: r.porEquipo.filter((x) => x.disp).map((x) => [nombreEquipo(x.e), x.e.area ?? "", x.disp.eventos, x.disp.paradas, x.disp.horas, x.disp.disp, x.disp.mttr, x.disp.mtbf]) },
    { nombre: "Tareas", columnas: [{ titulo: "Tarea", ancho: 48 }, { titulo: "Estado", ancho: 12 }, { titulo: "Prioridad", ancho: 10 }, { titulo: "Equipo", ancho: 32 }, { titulo: "A cargo", ancho: 20 },
      { titulo: "Pidió", ancho: 20 }, { titulo: "Creada", tipo: "fechahora" }, { titulo: "Vence", tipo: "fecha" }, { titulo: "Hecha", tipo: "fechahora" }, { titulo: "Hizo", ancho: 20 }, { titulo: "Cómo quedó", ancho: 40 }, { titulo: "De", ancho: 16 }],
      filas: (d.tareas ?? []).filter((t) => (!t.equipo_id || al.ids.has(t.equipo_id)) && (al.planta || t.equipo_id) && (t.estado !== "hecha" || enRango(diaDe(t.hecha_en))))
        .map((t) => [t.titulo, TEXTO_ESTADO_TAREA[t.estado], TEXTO_PRIORIDAD[t.prioridad] ?? "", t.equipo_id ? nombreCompleto(d, t.equipo_id) : "", paraQuien(d, t.asignada_a), nombre(d, t.creada_por),
          t.creada, t.vence, t.hecha_en, t.hecha_por ? nombre(d, t.hecha_por) : "", t.nota_cierre ?? "", t.inspeccion_id ? "Inspección" : t.hallazgo_id ? "Hallazgo" : "Suelta"]) },
    { nombre: "Laboratorio", columnas: [{ titulo: "Fecha", tipo: "fechahora" }, { titulo: "Molino", ancho: 28 }, { titulo: "Parámetro", ancho: 22 }, { titulo: "Valor", tipo: "numero", decimales: 2 },
      { titulo: "Unidad", ancho: 9 }, { titulo: "Mínimo", tipo: "numero", decimales: 2 }, { titulo: "Máximo", tipo: "numero", decimales: 2 }, { titulo: "Fuera de rango" }, { titulo: "Quién", ancho: 20 }, { titulo: "Nota", ancho: 30 }],
      filas: (d.laboratorio ?? []).filter((x) => al.ids.has(x.equipo_id) && enRango(diaDe(x.en))).flatMap((x) => Object.entries(x.valores ?? {}).map(([k, v]) => {
        const p = (d.ajustes?.lab?.[x.equipo_id] ?? []).find((y) => y.id === k) ?? { nombre: k };
        return [x.en, nombreCompleto(d, x.equipo_id), p.nombre, v, p.unidad ?? "", p.min ?? null, p.max ?? null, (p.min != null && v < p.min) || (p.max != null && v > p.max) ? "Sí" : "No", nombre(d, x.por), x.nota ?? ""];
      })) },
    { nombre: "Entregas de turno", columnas: [{ titulo: "Fecha", tipo: "fechahora" }, { titulo: "Turno", ancho: 8 }, { titulo: "Entregó", ancho: 22 }, { titulo: "Novedades", ancho: 60 }, { titulo: "Pendiente", ancho: 50 },
      { titulo: "Equipos no en marcha", ancho: 40 }, { titulo: "Recibió", ancho: 22 }, { titulo: "Recibida", tipo: "fechahora" }],
      filas: (d.entregas ?? []).filter((x) => enRango(diaDe(x.en))).sort((a, b) => a.en.localeCompare(b.en)).map((x) => [x.en, x.turno ?? "", nombre(d, x.de), x.novedades ?? "", x.pendientes ?? "",
        (x.equipos ?? []).filter((y) => y.estado !== "marcha").map((y) => `${nombreCompleto(d, y.equipo_id)}: ${y.estado === "parado" ? "parado" : "con restricción"}${y.nota ? ` (${y.nota})` : ""}`).join("; "),
        x.recibida_por ? nombre(d, x.recibida_por) : "", x.recibida_en]) },
    { nombre: "Equipos", columnas: [{ titulo: "Tag", ancho: 14 }, { titulo: "Nombre", ancho: 32 }, { titulo: "Es parte de", ancho: 24 }, { titulo: "Tipo", ancho: 12 }, { titulo: "Área", ancho: 24 }, { titulo: "Sirve a", ancho: 28 }, { titulo: "Nota", ancho: 36 }, { titulo: "En uso" }],
      filas: d.equipos.filter((e) => al.ids.has(e.id)).map((e) => [e.tag ?? "", e.nombre, e.padre_id ? nombreCompleto(d, e.padre_id) : "", e.tipo === "colector" ? "Colector" : "Proceso", e.area ?? "", e.sirve_a ?? "", e.nota ?? "", e.activo ? "Sí" : "No"]) },
  ], { autor: nombre(d, d.yo?.id), titulo: `Bitácora · ${al.texto}` });
}

/** Entrega un archivo: en el teléfono con «Compartir» (Archivos, Drive, WhatsApp, correo); si no, se descarga. */
export async function entregarArchivo(bytes, nombreArchivo, tipo) {
  const archivo = new File([bytes], nombreArchivo, { type: tipo });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: nombreArchivo }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(archivo);
  const a = Object.assign(document.createElement("a"), { href: url, download: nombreArchivo });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const archivoSeguro = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();

// ------------------------------------------------------------------------------- la vista

const PLANTILLAS_PDF = [
  { id: "formal", titulo: "Formal", desc: "Membrete, resumen, tablas y firmas.", rayas: [8, 16, 26, 34, 42] },
  { id: "equipo", titulo: "Por equipo", desc: "Una hoja por equipo o por área.", rayas: [8, 14, 30, 36, 42] },
  { id: "ejecutivo", titulo: "Ejecutivo", desc: "Una página con indicadores.", rayas: [8, 18, 24, 30, 44] },
];

export function vistaReportes({ d, yo, hoy, query }) {
  const per = periodo(query, hoy, d);
  const al = alcanceDe(d, query.get("alcance") ?? "planta");
  const tipo = query.get("plantilla") ?? (al.uno ? "equipo" : "formal");
  const o = { fotos: query.get("fotos") !== "0", agrupar: query.get("agrupar") === "area" ? "area" : "equipo" };
  const r = calcularReporte(d, per.desde, per.hasta, hoy, al);
  const doc = tipo === "equipo" ? docPorEquipo(d, yo, hoy, per, al, r, o) : tipo === "ejecutivo" ? docEjecutivo(d, yo, hoy, per, al, r) : docFormal(d, yo, hoy, per, al, r, o);
  const enlace = (cambios) => `#/reportes?${new URLSearchParams({ ...Object.fromEntries(query), ...cambios })}`;
  const areas = [...new Set(d.equipos.map((e) => e.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    titulo: "Reportes",
    atras: matchMedia("(max-width: 899px)").matches ? "#/mas" : null,
    html: `<div class="cabeza no-imprimir"><div><h1>Reportes</h1><p class="bajada">Elige qué y de cuándo; abajo se ve tal como sale.${d.ajustes?.logo ? "" : ` El logo de la empresa se pone en <a href="#/ajustes">Ajustes</a>.`}</p></div></div>
      <div class="reporte-opciones no-imprimir">
        <div class="campo ancho-total"><span class="rotulo">Plantilla</span>
          <div class="plantillas-pdf">${PLANTILLAS_PDF.map((p) => `<button type="button" data-plantilla="${p.id}" aria-pressed="${tipo === p.id}">
            <span class="mini">${p.rayas.map((y, k) => `<i style="top:${y}px;${k === 0 ? "width:40%;background:#1c1c1e" : k % 2 ? "right:30%" : ""}"></i>`).join("")}</span>
            <b>${p.titulo}</b><small>${p.desc}</small></button>`).join("")}</div></div>
        <div class="campo"><label for="r-alcance">De qué</label>
          <select id="r-alcance"><option value="planta" ${al.valor === "planta" ? "selected" : ""}>Toda la planta</option>
            ${d.equipos.some((e) => e.tipo === "colector") ? `<option value="colectores" ${al.valor === "colectores" ? "selected" : ""}>Colectores de polvo</option>` : ""}
            <optgroup label="Un área">${areas.map((a) => `<option value="area:${esc(a)}" ${al.valor === `area:${a}` ? "selected" : ""}>${esc(a)}</option>`).join("")}</optgroup>
            <optgroup label="Un equipo">${d.equipos.filter((e) => !e.padre_id && (e.activo || al.valor === `equipo:${e.id}`)).map((e) => `<option value="equipo:${esc(e.id)}" ${al.valor === `equipo:${e.id}` ? "selected" : ""}>${esc(nombreEquipo(e))}</option>`).join("")}</optgroup>
          </select></div>
        <div class="campo"><label for="r-periodo">De cuándo</label>
          <select id="r-periodo">${PERIODOS.map(([id, t]) => `<option value="${id}" ${per.p === id ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="campo"><span class="rotulo">Opciones</span>
          <div class="herramientas-item">
            ${tipo === "equipo" && !al.uno ? `<div class="segmento chico" role="group" aria-label="Una hoja por"><a href="${enlace({ agrupar: "equipo" })}" ${o.agrupar === "equipo" ? 'aria-current="true"' : ""}>Hoja por equipo</a><a href="${enlace({ agrupar: "area" })}" ${o.agrupar === "area" ? 'aria-current="true"' : ""}>Por área</a></div>` : ""}
            ${tipo !== "ejecutivo" ? `<label class="ajuste" style="padding:0;min-height:38px;gap:10px"><span class="interruptor"><input type="checkbox" data-fotos ${o.fotos ? "checked" : ""}><span></span></span>Con fotos</label>` : ""}
          </div></div>
        ${per.p === "rango" ? `<form class="ancho-total" id="form-rango"><div class="rejilla-campos tres" style="max-width:640px;align-items:end">
          <div class="campo"><label for="r-desde">Desde</label><input id="r-desde" type="date" value="${per.desde}"></div>
          <div class="campo"><label for="r-hasta">Hasta</label><input id="r-hasta" type="date" value="${per.hasta}"></div>
          <div><button class="boton" type="submit">Ver</button></div></div></form>` : ""}
      </div>
      <div class="salida-reporte no-imprimir">
        <button class="boton primario" data-accion="imprimir">${icono("imprimir")}PDF o imprimir</button>
        <button class="boton" data-accion="excel">${icono("excel")}Excel</button>
        <button class="boton" data-accion="correo">${icono("correo")}Copiar como correo</button>
        <button class="boton" data-accion="mailto">${icono("enviar")}Abrir en el correo</button>
        <button class="boton" data-accion="whatsapp">${icono("whatsapp")}WhatsApp</button>
      </div>
      <div class="hojas">${doc}</div>`,
    ancho: false,
    montar(m) {
      const ir2 = (c) => { location.hash = enlace(c); };
      m.querySelector("#r-alcance").addEventListener("change", (e) => ir2({ alcance: e.target.value }));
      m.querySelector("#r-periodo").addEventListener("change", (e) => ir2({ p: e.target.value }));
      m.querySelector("[data-fotos]")?.addEventListener("change", (e) => ir2({ fotos: e.target.checked ? "1" : "0" }));
      m.querySelector("#form-rango")?.addEventListener("submit", (e) => {
        e.preventDefault();
        ir2({ p: "rango", desde: e.target["r-desde"].value, hasta: e.target["r-hasta"].value });
      });
      m.addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.plantilla) return ir2({ plantilla: b.dataset.plantilla });
        const a = b.dataset.accion;
        if (a === "imprimir") print();
        if (a === "correo") {
          const c = textoCorreo(d, yo, per, al, r);
          copiar(`Asunto: ${c.asunto}\n\n${c.cuerpo}`, "Correo copiado");
        }
        if (a === "mailto") {
          const c = textoCorreo(d, yo, per, al, r);
          const cuerpo = c.cuerpo.length > 1800 ? `${c.cuerpo.slice(0, 1700)}\n…\n(El reporte completo va en el PDF adjunto.)` : c.cuerpo;
          location.href = `mailto:?subject=${encodeURIComponent(c.asunto)}&body=${encodeURIComponent(cuerpo)}`;
        }
        if (a === "whatsapp") copiar(textoWhatsApp(d, yo, per, al, r), "Resumen copiado");
        if (a === "excel") {
          b.disabled = true;
          try {
            const bytes = excelDe(d, per, al, hoy);
            await entregarArchivo(bytes, `bitacora-${archivoSeguro(al.texto)}-${per.desde}-a-${per.hasta}.xlsx`, TIPO_XLSX);
          } catch (x) { aviso(`No se pudo armar el Excel: ${x.message}`, { error: true }); }
          b.disabled = false;
        }
      });
    },
  };
}

// ------------------------------------------------------------------------------- una inspección

export function vistaReporteInspeccion({ d, yo, hoy, param }) {
  const insp = d.inspecciones.find((i) => i.id === param);
  if (!insp || insp.estado !== "hecha") return { titulo: "Reporte", atras: "#/inspecciones", html: vacio("Esa inspección no está hecha todavía.") };
  const pl = plantilla(d, insp.plantilla_id);
  const ids = equiposDe(insp);
  const items = insp.items ?? pl?.items ?? [];
  const resp = new Map((insp.respuestas ?? []).map((r) => [`${r.equipo_id ?? ids[0]}|${r.item_id}`, r]));
  const hallazgos = d.hallazgos.filter((h) => h.inspeccion_id === insp.id);
  const res = (it, r) => it.tipo === "texto" ? "" : r?.resultado === "ok" ? "Bien" : r?.resultado === "mal" ? (it.tipo === "medida" ? "Problema" : "Mal") : r?.resultado === "na" ? "No aplica" : "—";
  const tabla = (eqId) => `<table class="tabla"><thead><tr><th>Qué se revisó</th><th class="n">Valor</th><th>Resultado</th><th>Nota</th></tr></thead><tbody>
    ${items.map((it) => {
      const r = resp.get(`${eqId}|${it.id}`);
      const fuera = it.tipo === "medida" && fueraDeRango(it, r?.valor);
      return `<tr><td>${esc(it.texto)}</td><td class="n ${fuera ? "fuera" : ""}">${it.tipo === "medida" && r?.valor != null ? `${numero(r.valor, 2)} ${esc(it.unidad ?? "")}` : ""}</td>
        <td>${res(it, r)}</td><td>${esc(r?.texto ?? "")}${fotos(r?.fotos, true)}</td></tr>`;
    }).join("")}</tbody></table>`;
  const hizo = persona(d, insp.hecha_por);
  const tareasDe = (d.tareas ?? []).filter((t) => t.inspeccion_id === insp.id || (t.estado === "hecha" && t.hecha_en === insp.hecha_en && t.hecha_por === insp.hecha_por));
  return {
    titulo: "Reporte de inspección",
    atras: `#/inspeccion/${encodeURIComponent(insp.id)}`,
    html: `<div class="cabeza no-imprimir"><div><h1>Reporte de inspección</h1></div>
        <div class="acciones"><button class="boton primario" data-accion="imprimir">${icono("imprimir")}PDF o imprimir</button></div></div>
      <div class="hojas"><article class="documento">${membrete(d, yo, hoy, "Reporte de inspección")}
        <h1>${esc(queInspeccion(d, insp))} · ${esc(pl?.nombre ?? "")}</h1>
        <p class="sub-doc">${pl?.cuando === "parada" ? "Con el equipo parado" : "Con el equipo en marcha"} · ${ids.length > 1 ? "" : esc(equipo(d, ids[0])?.area ?? "")} · Hizo: ${esc(nombre(d, insp.hecha_por))}, ${esc(fechaHora(insp.hecha_en))} · Asignó: ${esc(nombre(d, insp.asignada_por))}</p>
        ${insp.nota ? `<p><b>Nota de la asignación:</b> ${esc(insp.nota)}</p>` : ""}
        ${ids.map((e) => `${ids.length > 1 ? `<h2><span class="tag-doc">${esc(equipo(d, e)?.tag ?? "")}</span>${esc(equipo(d, e)?.nombre ?? "")}</h2>` : "<h2>Revisiones</h2>"}${tabla(e)}`).join("")}
        <h2>Hallazgos</h2>${hallazgos.length ? tablaHallazgos(d, hallazgos, true) : `<p>Sin hallazgos: todo bien.</p>`}
        ${tareasDe.length ? `<h2>Tareas</h2><table class="tabla"><thead><tr><th>Tarea</th><th>Hecha</th><th>Cómo quedó</th></tr></thead><tbody>${tareasDe.map((t) => `<tr><td>${esc(t.titulo)}</td>
          <td>${t.estado === "hecha" ? "Sí" : "No (pasó a la siguiente)"}</td><td>${esc(t.nota_cierre ?? "")}</td></tr>`).join("")}</tbody></table>` : ""}
        ${(insp.verificaciones ?? []).length ? `<p style="margin-top:12px"><b>Verificado en sitio con el QR:</b> ${insp.verificaciones.map((v) => `${esc(nombreCompleto(d, v.equipo_id))} a las ${esc(fechaHora(v.en).split(", ")[1])}`).join("; ")}.</p>` : ""}
        ${insp.revisada_en ? `<p style="margin-top:14px"><b>Visto bueno:</b> ${esc(nombre(d, insp.revisada_por))}, ${esc(fechaHora(insp.revisada_en))}${insp.revision_nota ? `. ${esc(insp.revision_nota)}` : ""}</p>` : ""}
        <div class="firmas"><div>${insp.firma ? `<img src="${esc(api.urlMedio(insp.firma))}" alt="Firma" style="height:46px;margin:-50px 0 4px">` : ""}Hizo: ${esc(hizo?.nombre ?? "")}${hizo?.puesto ? `<br>${esc(hizo.puesto)}` : ""}</div><div>Revisó${insp.revisada_en ? `: ${esc(nombre(d, insp.revisada_por))}` : ""}</div></div>
        ${pie(d, yo)}</article></div>`,
    montar(m) {
      m.querySelector('[data-accion="imprimir"]').addEventListener("click", () => print());
    },
  };
}
