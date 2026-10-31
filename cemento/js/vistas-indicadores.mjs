// Indicadores: cómo va la planta en un período (para el ingeniero y su jefe). Cumplimiento de lo programado (por
// persona y turno), a tiempo, hallazgos (Pareto por equipo, abiertos y cerrados por semana), cierre promedio,
// disponibilidad por equipo y las medidas que vienen hacia afuera de su rango. El reporte «Ejecutivo» es su versión
// para imprimir.
import { esc, icono, numero, plural, sumarDias, diaDe, fechaCorta } from "./util.mjs";
import * as api from "./api.mjs";
import { vacio, persona, nombre, equiposDe } from "./ui.mjs";
import { barraFiltros, montarFiltros, familia, enFiltro, nombreCompleto } from "./componentes.mjs";
import { calcularReporte, alcanceDe } from "./vistas-reportes.mjs";
import { disponibilidad } from "./vistas-paros.mjs";
import { lineaTiempo, montarRotulos } from "./graficas.mjs";
import { series } from "./vistas-equipos.mjs";
import { haciaFuera } from "./tendencia.mjs";

const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)} %`);

/** Las medidas de toda la planta que vienen hacia afuera de su rango (las mismas del aviso de la mañana). */
export function alertasTendencia(d, fam = null) {
  const xs = [];
  for (const e of d.equipos.filter((x) => x.activo && enFiltro(fam, x.id))) {
    for (const s of series(d, e.id)) {
      const sentido = haciaFuera(s.puntos.map((p) => p.valor), s.it.min, s.it.max);
      if (sentido) xs.push({ e, it: s.it, sentido, ultimo: s.puntos.at(-1) });
    }
  }
  return xs;
}

/** Barras horizontales en HTML (se leen mejor que un SVG en el teléfono), animadas con transform. */
export const barras = (filas, { max = null, formato = (v) => v } = {}) => {
  const m = max ?? Math.max(1, ...filas.map((f) => f.v));
  return `<div class="barras-app">${filas.map((f) => `<div class="fila-barra"><span class="etq-barra">${f.html ?? esc(f.t)}</span>
    <span class="pista"><i class="${f.clase ?? ""}" style="transform:scaleX(${Math.max(0.005, f.v / m).toFixed(4)})"></i></span><b>${f.etiqueta ?? formato(f.v)}</b></div>`).join("")}</div>`;
};

export function vistaIndicadores({ d, yo, hoy, query }) {
  const dias = Number(query.get("dias") ?? 30);
  const eq = query.get("eq");
  const fam = familia(d, eq);
  const desde = sumarDias(hoy, -(dias - 1));
  const al = eq ? alcanceDe(d, `equipo:${eq}`) : alcanceDe(d, "planta");
  if (eq) al.ids = fam;
  const r = calcularReporte(d, desde, hoy, hoy, al);
  const ms0 = Date.parse(desde + "T05:00:00Z"), ms1 = Date.now();
  const equipos = d.equipos.filter((e) => e.activo && !e.padre_id && e.tipo !== "colector" && enFiltro(fam, e.id));
  const disp = equipos.map((e) => ({ e, ...disponibilidad(d, e.id, ms0, ms1) }));
  const dispProm = disp.length ? disp.reduce((s, x) => s + x.disp, 0) / disp.length : null;
  const alertas = alertasTendencia(d, fam);
  const tareasAtr = (d.tareas ?? []).filter((t) => t.estado !== "hecha" && t.vence && t.vence < hoy && enFiltro(fam, t.equipo_id)).length;
  // por persona (y los turnos juntos)
  const porQuien = new Map();
  for (const i of r.programadas) {
    // por persona; lo de todo un turno, aparte (si no, dos personas del mismo turno se juntaban en una barra)
    const k = i.estado === "hecha" && i.asignada_a?.startsWith("turno:") && i.hecha_por ? nombre(d, i.hecha_por) : nombre(d, i.asignada_a);
    const x = porQuien.get(k) ?? porQuien.set(k, { t: k, total: 0, hechas: 0 }).get(k);
    x.total++;
    if (i.estado === "hecha") x.hechas++;
  }
  // Pareto de hallazgos nuevos por equipo (subequipos al padre)
  const porEquipo = new Map();
  for (const h of r.nuevos) {
    const e = d.equipos.find((x) => x.id === h.equipo_id);
    const id = e?.padre_id ?? h.equipo_id;
    porEquipo.set(id, (porEquipo.get(id) ?? 0) + 1);
  }
  const pareto = [...porEquipo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalP = pareto.reduce((s, [, n]) => s + n, 0);
  let acum = 0;
  // abiertos y cerrados por semana
  const semanas = [];
  for (let k = Math.ceil(dias / 7) - 1; k >= 0; k--) {
    const fin = sumarDias(hoy, -7 * k), ini = sumarDias(fin, -6);
    const h = d.hallazgos.filter((x) => enFiltro(fam, x.equipo_id));
    semanas.push({ t: Date.parse(fin + "T17:00:00Z"), nuevos: h.filter((x) => diaDe(x.creado) >= ini && diaDe(x.creado) <= fin).length, cerrados: h.filter((x) => x.cerrado && diaDe(x.cerrado) >= ini && diaDe(x.cerrado) <= fin).length });
  }
  const enlace = (c) => `#/indicadores?${new URLSearchParams({ ...Object.fromEntries(query), ...c })}`;
  const kpi = (ic, titulo, valor, pie, clase = "") => `<div class="kpi ${clase}"><span class="rotulo-kpi">${icono(ic)}${titulo}</span><span class="valor-kpi">${valor}</span><span class="pie-kpi">${pie}</span></div>`;
  const cl = (v, bien, regular) => (v == null ? "" : v >= bien ? "bueno" : v >= regular ? "regular" : "malo");
  return {
    titulo: "Indicadores",
    atras: matchMedia("(max-width: 899px)").matches ? "#/planta" : null,
    html: `<div class="cabeza"><div><h1>Indicadores</h1>
        <p class="bajada">${esc(eq ? nombreCompleto(d, eq) : d.ajustes?.planta || "Toda la planta")} · del ${esc(fechaCorta(desde))} a hoy. Para imprimirlo: <a href="#/reportes?plantilla=ejecutivo&p=mes">reporte ejecutivo</a>.</p></div></div>
      ${barraFiltros(d, query, { placeholder: "Buscar", extra: `<nav class="filtros" style="margin:0">${[7, 30, 90].map((n) => `<a href="${enlace({ dias: n })}" ${dias === n ? 'aria-current="true"' : ""}>${n} días</a>`).join("")}</nav>` }).replace('<div class="buscador">', '<div class="buscador" hidden>')}
      <div data-cuerpo>
      <div class="kpis-app">
        ${kpi("inspecciones", "Cumplimiento", pct(r.cumplimiento), `${r.progHechas} de ${r.programadas.length} programadas`, cl(r.cumplimiento, 0.9, 0.75))}
        ${kpi("reloj", "A tiempo", pct(r.aTiempoPct), `${r.aTiempo.length} de ${r.hechas.length} hechas`, cl(r.aTiempoPct, 0.9, 0.75))}
        ${kpi("hallazgos", "Hallazgos abiertos", r.abiertos.length, `${r.abiertos.filter((h) => h.prioridad === "alta").length} de prioridad alta`, r.abiertos.some((h) => h.prioridad === "alta") ? "regular" : "")}
        ${kpi("cronometro", "Cierre promedio", r.cierreMedio == null ? "—" : `${numero(r.cierreMedio, 1)}<small>días</small>`, `${plural(r.cerrados.length, "cerrado", "cerrados")} en el período`)}
        ${kpi("paros", "Disponibilidad", dispProm == null ? "—" : `${numero(dispProm * 100, 1)}<small>%</small>`, `${plural(disp.reduce((s, x) => s + x.eventos, 0), "paro no programado", "paros no programados")}`, cl(dispProm, 0.97, 0.9))}
        ${kpi("subeT", "Vienen hacia afuera", alertas.length, alertas.length ? "medidas por vigilar" : "ninguna medida", alertas.length ? "regular" : "bueno")}
        ${kpi("tareas", "Tareas atrasadas", tareasAtr, tareasAtr ? "por ponerse al día" : "al día", tareasAtr ? "malo" : "bueno")}
      </div>
      <div class="graficas">
        <div class="grafica"><h3>Cumplimiento por persona o turno <small>programadas en el período</small></h3>
          ${porQuien.size ? barras([...porQuien.values()].sort((a, b) => a.hechas / a.total - b.hechas / b.total).map((x) => ({ t: x.t, v: x.hechas / x.total, etiqueta: `${x.hechas}/${x.total}`, clase: x.hechas / x.total < 0.8 ? "mala" : "" })), { max: 1 }) : vacio("Nada programado en el período.")}</div>
        <div class="grafica"><h3>Hallazgos nuevos por equipo <small>los que más (Pareto)</small></h3>
          ${pareto.length ? barras(pareto.map(([id, n]) => { acum += n; return { t: nombreCompleto(d, id), v: n, etiqueta: `${n} · ${Math.round((100 * acum) / totalP)} %` }; })) : vacio("Ningún hallazgo nuevo en el período.")}</div>
        <div class="grafica"><h3>Hallazgos por semana <small><span style="color:var(--tinte)">● nuevos</span> · <span style="color:var(--naranja)">● cerrados</span></small></h3>
          ${lineaTiempo({ series: [{ nombre: "Nuevos", puntos: semanas.map((s) => ({ t: s.t, v: s.nuevos })) }, { nombre: "Cerrados", clase: "b", puntos: semanas.map((s) => ({ t: s.t, v: s.cerrados })) }], decimales: 0, alto: 170 })}</div>
        <div class="grafica"><h3>Disponibilidad por equipo <small>% del tiempo sin paros no programados</small></h3>
          ${disp.length ? barras(disp.sort((a, b) => a.disp - b.disp).map((x) => ({ t: nombreCompleto(d, x.e.id), v: x.disp, etiqueta: `${numero(x.disp * 100, 1)} %`, clase: x.disp < 0.95 ? "mala" : "" })), { max: 1 }) : vacio("Sin equipos.")}</div>
      </div>
      <section class="seccion"><h2>Medidas que vienen hacia afuera <small>${alertas.length || ""}</small></h2>
        ${alertas.length ? `<ul class="lista">${alertas.map((a) => `<li><a class="fila con-icono" href="#/equipo/${encodeURIComponent(a.e.id)}"><span class="icono-fila naranja">${icono(a.sentido === "sube" ? "subeT" : "bajaT")}</span>
          <span class="titulo">${esc(a.it.texto)} <small>· ${esc(nombreCompleto(d, a.e.id))}</small></span>
          <span class="detalle"><span>Último: <b>${numero(a.ultimo.valor, 2)} ${esc(a.it.unidad ?? "")}</b></span><span>Rango: ${a.it.min != null ? numero(a.it.min, 2) : "—"} a ${a.it.max != null ? numero(a.it.max, 2) : "—"}</span><span>viene ${a.sentido === "sube" ? "subiendo" : "bajando"}</span></span>
          <span class="lado horizontal">${icono("derecha", "ico chevron")}</span></a></li>`).join("")}</ul>`
          : vacio("Ninguna medida viene hacia afuera de su rango. Se avisa cuando tres lecturas seguidas van hacia el borde o la tendencia lo cruza en las próximas tres.")}
      </section>
      </div>`,
    montar(m) {
      montarRotulos(m);
      montarFiltros(m, d, { ruta: "indicadores", alCambiar: (q) => {
        const v = vistaIndicadores({ d: api.obtener(), yo, hoy, query: q });
        const tmp = document.createElement("div");
        tmp.innerHTML = v.html;
        m.querySelector("[data-cuerpo]").replaceWith(tmp.querySelector("[data-cuerpo]"));
        m.querySelector(".cabeza .bajada").innerHTML = tmp.querySelector(".cabeza .bajada").innerHTML;
      } });
    },
  };
}
