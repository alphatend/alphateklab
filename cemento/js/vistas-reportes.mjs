// Reportes: el de la semana (o del período que se elija) para el jefe, y el de una inspección. Se imprimen o se
// guardan en PDF con el diálogo de impresión, y el resumen se copia para mandarlo por WhatsApp o correo.
import { esc, icono, fechaCorta, fechaLarga, fechaHora, sumarDias, diaDe, plural, numero } from "./util.mjs";
import { aviso, vacio, equipo, plantilla, nombre, nombreCorto, TEXTO_PRIORIDAD, TEXTO_ESTADO } from "./ui.mjs";
import { urlMedio } from "./api.mjs";
import { fueraDeRango } from "./vistas-inspecciones.mjs";

/** Lunes de la semana de un día (AAAA-MM-DD). */
function lunes(dia) {
  const w = new Date(dia + "T12:00:00Z").getUTCDay();
  return sumarDias(dia, -((w + 6) % 7));
}

function periodo(query, hoy) {
  const p = query.get("p") ?? "semana";
  if (p === "pasada") { const l = lunes(sumarDias(hoy, -7)); return { p, desde: l, hasta: sumarDias(l, 6), texto: "La semana pasada" }; }
  if (p === "mes") return { p, desde: hoy.slice(0, 8) + "01", hasta: hoy, texto: "Este mes" };
  if (p === "rango") {
    const desde = query.get("desde") ?? sumarDias(hoy, -6), hasta = query.get("hasta") ?? hoy;
    return { p, desde: desde <= hasta ? desde : hasta, hasta: desde <= hasta ? hasta : desde, texto: "Del período" };
  }
  return { p: "semana", desde: lunes(hoy), hasta: hoy, texto: "Esta semana" };
}

export function calcularReporte(d, desde, hasta, hoy) {
  const enRango = (dia) => dia && dia >= desde && dia <= hasta;
  const programadas = d.inspecciones.filter((i) => enRango(i.vence));
  const hechas = d.inspecciones.filter((i) => i.estado === "hecha" && enRango(diaDe(i.hecha_en)));
  const aTiempo = hechas.filter((i) => diaDe(i.hecha_en) <= i.vence);
  const atrasadas = d.inspecciones.filter((i) => i.estado === "pendiente" && i.vence < (hasta < hoy ? hasta : hoy) && i.vence <= hasta);
  const nuevos = d.hallazgos.filter((h) => enRango(diaDe(h.creado)));
  const cerrados = d.hallazgos.filter((h) => h.estado === "cerrado" && enRango(diaDe(h.cerrado)));
  const abiertos = d.hallazgos.filter((h) => h.estado !== "cerrado");
  const progHechas = programadas.filter((i) => i.estado === "hecha").length;
  const porEquipo = d.equipos.map((e) => ({
    e,
    hechas: hechas.filter((i) => i.equipo_id === e.id).length,
    atrasadas: atrasadas.filter((i) => i.equipo_id === e.id).length,
    nuevos: nuevos.filter((h) => h.equipo_id === e.id).length,
    abiertos: abiertos.filter((h) => h.equipo_id === e.id).length,
  }));
  return { programadas, hechas, aTiempo, atrasadas, nuevos, cerrados, abiertos, progHechas, porEquipo };
}

export function vistaReportes({ d, yo, hoy, query }) {
  const per = periodo(query, hoy);
  const r = calcularReporte(d, per.desde, per.hasta, hoy);
  const cumplimiento = r.programadas.length ? Math.round((100 * r.progHechas) / r.programadas.length) : null;
  const altas = r.abiertos.filter((h) => h.prioridad === "alta");
  const orden = { alta: 0, media: 1, baja: 2 };
  const listaHallazgos = [...r.nuevos].sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);
  const filtro = (id, texto) => `<a href="#/reportes?p=${id}" ${per.p === id ? 'aria-current="true"' : ""}>${texto}</a>`;
  const parrafo =
    `Del ${fechaLarga(per.desde)} al ${fechaLarga(per.hasta)} se hicieron ${plural(r.hechas.length, "inspección", "inspecciones")}` +
    (r.programadas.length ? `; de las ${r.programadas.length} programadas para el período se completaron ${r.progHechas} (${cumplimiento} %)` : "") +
    (r.atrasadas.length ? ` y quedan ${plural(r.atrasadas.length, "atrasada", "atrasadas")}` : "") +
    `. Se anotaron ${plural(r.nuevos.length, "hallazgo", "hallazgos")} y se cerraron ${r.cerrados.length}; ` +
    (r.abiertos.length ? `quedan ${plural(r.abiertos.length, "abierto", "abiertos")}${altas.length ? `, ${plural(altas.length, "de prioridad alta", "de prioridad alta")}` : ""}.` : "no queda ninguno abierto.");
  const textoCopiar = [
    `Reporte de inspecciones — ${fechaCorta(per.desde)} al ${fechaCorta(per.hasta)}`,
    parrafo,
    ...(listaHallazgos.length ? ["", "Hallazgos:", ...listaHallazgos.map((h) => `• [${TEXTO_PRIORIDAD[h.prioridad]}] ${equipo(d, h.equipo_id)?.nombre}: ${h.descripcion}${h.accion ? ` → ${h.accion}` : ""} (${TEXTO_ESTADO[h.estado]})`)] : []),
    ...(r.atrasadas.length ? ["", "Atrasadas:", ...r.atrasadas.map((i) => `• ${equipo(d, i.equipo_id)?.nombre} · ${plantilla(d, i.plantilla_id)?.nombre} — ${nombreCorto(d, i.asignada_a)}, vencía el ${fechaCorta(i.vence)}`)] : []),
    "", `Preparó: ${yo.nombre}`,
  ].join("\n");
  return {
    titulo: "Reportes",
    html: `<div class="cabeza no-imprimir"><div><h1>Reportes</h1><p class="bajada">Listo para imprimir, guardar en PDF o pegar en un mensaje.</p></div>
        <div class="acciones"><button class="boton" data-accion="copiar">${icono("copiar")}Copiar resumen</button>
          <button class="boton primario" data-accion="imprimir">${icono("imprimir")}Imprimir o PDF</button></div></div>
      <nav class="filtros no-imprimir" aria-label="Período">${filtro("semana", "Esta semana")}${filtro("pasada", "La semana pasada")}${filtro("mes", "Este mes")}${filtro("rango", "Otro período")}</nav>
      ${per.p === "rango" ? `<form class="panel no-imprimir" id="form-rango" style="margin-bottom:16px;max-width:560px"><div class="rejilla-campos dos">
        <div class="campo"><label for="r-desde">Desde</label><input id="r-desde" type="date" value="${per.desde}"></div>
        <div class="campo"><label for="r-hasta">Hasta</label><input id="r-hasta" type="date" value="${per.hasta}"></div></div>
        <div><button class="boton chico" type="submit">Ver</button></div></form>` : ""}
      <article class="reporte">
        <header><div><h1>Reporte de inspecciones</h1><div style="color:var(--tinta-3);margin-top:4px">${esc(per.texto)} · ${esc(fechaLarga(per.desde))} al ${esc(fechaLarga(per.hasta))}</div></div>
          <div class="de">Ingeniería de procesos<br>Preparó: ${esc(yo.nombre)}<br>${esc(fechaLarga(hoy))}</div></header>
        <p class="parrafo">${esc(parrafo)}</p>
        <h2>Por equipo</h2>
        <div class="tabla-desliza"><table class="tabla"><thead><tr><th>Equipo</th><th class="n">Hechas</th><th class="n">Atrasadas</th><th class="n">Hallazgos nuevos</th><th class="n">Abiertos</th></tr></thead>
          <tbody>${r.porEquipo.map((x) => `<tr><td>${esc(x.e.nombre)}</td><td class="n">${x.hechas}</td><td class="n" ${x.atrasadas ? 'style="color:var(--rojo);font-weight:700"' : ""}>${x.atrasadas}</td><td class="n">${x.nuevos}</td><td class="n">${x.abiertos}</td></tr>`).join("")}</tbody></table></div>
        <h2>Hallazgos del período</h2>
        ${listaHallazgos.length ? `<div class="tabla-desliza"><table class="tabla"><thead><tr><th>Prioridad</th><th>Equipo</th><th>Qué se encontró</th><th>Qué hay que hacer</th><th>A cargo</th><th>Estado</th></tr></thead><tbody>
          ${listaHallazgos.map((h) => `<tr><td>${TEXTO_PRIORIDAD[h.prioridad]}</td><td>${esc(equipo(d, h.equipo_id)?.nombre ?? "")}</td>
            <td>${esc(h.descripcion)}${h.fotos?.length ? `<div class="fotos-reporte">${h.fotos.filter((f) => !f.startsWith("v-")).slice(0, 2).map((f) => `<img src="${esc(urlMedio(f))}" alt="" onerror="this.remove()">`).join("")}</div>` : ""}</td>
            <td>${esc(h.accion ?? "")}</td><td>${esc(nombreCorto(d, h.responsable_id))}</td><td>${TEXTO_ESTADO[h.estado]}</td></tr>`).join("")}</tbody></table></div>`
          : `<p class="parrafo" style="color:var(--tinta-3)">No se anotaron hallazgos en el período.</p>`}
        ${r.atrasadas.length ? `<h2>Inspecciones atrasadas</h2><div class="tabla-desliza"><table class="tabla"><thead><tr><th>Equipo</th><th>Inspección</th><th>A cargo</th><th>Vencía</th></tr></thead><tbody>
          ${r.atrasadas.map((i) => `<tr><td>${esc(equipo(d, i.equipo_id)?.nombre ?? "")}</td><td>${esc(plantilla(d, i.plantilla_id)?.nombre ?? "")}</td><td>${esc(nombreCorto(d, i.asignada_a))}</td><td>${esc(fechaCorta(i.vence))}</td></tr>`).join("")}</tbody></table></div>` : ""}
        <h2>Inspecciones hechas</h2>
        ${r.hechas.length ? `<div class="tabla-desliza"><table class="tabla"><thead><tr><th>Fecha</th><th>Equipo</th><th>Inspección</th><th>Hizo</th><th class="n">Hallazgos</th></tr></thead><tbody>
          ${[...r.hechas].sort((a, b) => (a.hecha_en ?? "").localeCompare(b.hecha_en ?? "")).map((i) => `<tr><td>${esc(fechaCorta(diaDe(i.hecha_en)))}</td><td>${esc(equipo(d, i.equipo_id)?.nombre ?? "")}</td><td>${esc(plantilla(d, i.plantilla_id)?.nombre ?? "")}</td><td>${esc(nombreCorto(d, i.hecha_por))}</td><td class="n">${d.hallazgos.filter((h) => h.inspeccion_id === i.id).length}</td></tr>`).join("")}</tbody></table></div>`
          : `<p class="parrafo" style="color:var(--tinta-3)">Ninguna en el período.</p>`}
        <div class="firma"><div>Preparó: ${esc(yo.nombre)}</div><div>Revisó</div></div>
      </article>`,
    montar(m) {
      m.querySelector('[data-accion="imprimir"]').addEventListener("click", () => print());
      m.querySelector('[data-accion="copiar"]').addEventListener("click", () => copiar(textoCopiar));
      m.querySelector("#form-rango")?.addEventListener("submit", (e) => {
        e.preventDefault();
        location.hash = `#/reportes?p=rango&desde=${e.target["r-desde"].value}&hasta=${e.target["r-hasta"].value}`;
      });
    },
  };
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    aviso("Resumen copiado: pégalo en WhatsApp o en un correo.");
  } catch {
    // sin permiso para el portapapeles (algunas vistas embebidas): se muestra para copiarlo a mano
    const ta = Object.assign(document.createElement("textarea"), { value: texto });
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand?.("copy");
    ta.remove();
    aviso(ok ? "Resumen copiado." : "No se pudo copiar solo en este aparato.", { error: !ok });
  }
}

// ------------------------------------------------------------------------------- una inspección

export function vistaReporteInspeccion({ d, param }) {
  const insp = d.inspecciones.find((i) => i.id === param);
  if (!insp || insp.estado !== "hecha") return { titulo: "Reporte", atras: "#/inspecciones", html: vacio("Esa inspección no está hecha todavía.") };
  const eq = equipo(d, insp.equipo_id), pl = plantilla(d, insp.plantilla_id);
  const items = insp.items ?? pl?.items ?? [];
  const resp = new Map((insp.respuestas ?? []).map((r) => [r.item_id, r]));
  const hallazgos = d.hallazgos.filter((h) => h.inspeccion_id === insp.id);
  const res = (it, r) => it.tipo === "texto" ? "" : r?.resultado === "ok" ? "Bien" : r?.resultado === "mal" ? (it.tipo === "medida" ? "Problema" : "Mal") : r?.resultado === "na" ? "No aplica" : "—";
  return {
    titulo: "Reporte de inspección",
    atras: `#/inspeccion/${encodeURIComponent(insp.id)}`,
    html: `<div class="cabeza no-imprimir"><div><h1>Reporte de inspección</h1></div>
        <div class="acciones"><button class="boton primario" data-accion="imprimir">${icono("imprimir")}Imprimir o PDF</button></div></div>
      <article class="reporte">
        <header><div><h1>${esc(eq?.nombre ?? "")} · ${esc(pl?.nombre ?? "")}</h1>
            <div style="color:var(--tinta-3);margin-top:4px">${pl?.cuando === "parada" ? "Con el equipo parado" : "Con el equipo en marcha"} · ${esc(eq?.area ?? "")}</div></div>
          <div class="de">Hizo: ${esc(nombre(d, insp.hecha_por))}<br>${esc(fechaHora(insp.hecha_en))}<br>Asignó: ${esc(nombre(d, insp.asignada_por))}</div></header>
        ${insp.nota ? `<p class="parrafo"><b>Nota de la asignación:</b> ${esc(insp.nota)}</p>` : ""}
        <h2>Revisiones</h2>
        <div class="tabla-desliza"><table class="tabla"><thead><tr><th>Qué se revisó</th><th class="n">Valor</th><th>Resultado</th><th>Nota</th></tr></thead><tbody>
          ${items.map((it) => {
            const r = resp.get(it.id);
            const fuera = it.tipo === "medida" && fueraDeRango(it, r?.valor);
            return `<tr><td>${esc(it.texto)}</td><td class="n" ${fuera ? 'style="color:var(--rojo);font-weight:700"' : ""}>${it.tipo === "medida" && r?.valor != null ? `${numero(r.valor, 2)} ${esc(it.unidad ?? "")}` : ""}</td>
              <td>${res(it, r)}</td><td>${esc(r?.texto ?? "")}${r?.fotos?.length ? `<div class="fotos-reporte">${r.fotos.filter((f) => !f.startsWith("v-")).map((f) => `<img src="${esc(urlMedio(f))}" alt="" onerror="this.remove()">`).join("")}</div>` : ""}</td></tr>`;
          }).join("")}</tbody></table></div>
        <h2>Hallazgos</h2>
        ${hallazgos.length ? `<div class="tabla-desliza"><table class="tabla"><thead><tr><th>Prioridad</th><th>Qué se encontró</th><th>Qué hay que hacer</th><th>A cargo</th><th>Estado</th></tr></thead><tbody>
          ${hallazgos.map((h) => `<tr><td>${TEXTO_PRIORIDAD[h.prioridad]}</td><td>${esc(h.descripcion)}</td><td>${esc(h.accion ?? "")}</td><td>${esc(nombreCorto(d, h.responsable_id))}</td><td>${TEXTO_ESTADO[h.estado]}</td></tr>`).join("")}</tbody></table></div>`
          : `<p class="parrafo">Sin hallazgos: todo bien.</p>`}
        <div class="firma"><div>Hizo: ${esc(nombre(d, insp.hecha_por))}</div><div>Revisó</div></div>
      </article>`,
    montar(m) {
      m.querySelector('[data-accion="imprimir"]').addEventListener("click", () => print());
    },
  };
}
