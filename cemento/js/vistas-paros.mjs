// Paros. Los no programados (causa y duración) dan la disponibilidad de cada equipo; los programados juntan los
// hallazgos «Para el paro» en su lista de trabajos (para imprimir y llevar). Un paro sin fin está en curso.
import { esc, icono, fechaHora, fechaCorta, plural, numero, numeroHallazgo, sumarDias } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, confirmar, vacio, nombre, esAdmin, puede, marcaSinEnviar, marcaPrioridad, nombreCorto } from "./ui.mjs";
import { barraFiltros, montarFiltros, familia, enFiltro, nombreCompleto, campoEquipo } from "./componentes.mjs";

const H = 3600e3;
/** Horas de un paro dentro de [desde, hasta] (milisegundos). Un paro en curso cuenta hasta ahora. */
export const horasDentro = (p, desde, hasta) => Math.max(0, (Math.min(Date.parse(p.fin ?? new Date().toISOString()), hasta) - Math.max(Date.parse(p.inicio), desde)) / H);
/** «2 h 15 min», «45 min», «3 d 4 h» */
export function duracion(h) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return mm ? `${hh} h ${mm} min` : `${hh} h`; }
  const dd = Math.floor(h / 24), hh = Math.round(h - dd * 24);
  return hh ? `${dd} d ${hh} h` : `${dd} d`;
}

/**
 * Disponibilidad de un equipo (con sus subequipos) en un período: 1 − horas de paro no programado / horas del período.
 * También el tiempo medio para reparar (MTTR) y entre fallas (MTBF), si hubo paros.
 */
export function disponibilidad(d, equipoId, desde, hasta) {
  const fam = familia(d, equipoId) ?? new Set(d.equipos.map((e) => e.id));
  const xs = (d.paros ?? []).filter((p) => p.tipo === "no_programado" && fam.has(p.equipo_id) && Date.parse(p.inicio) < hasta && Date.parse(p.fin ?? new Date().toISOString()) > desde);
  const horas = (hasta - desde) / H;
  const paradas = Math.min(horas, xs.reduce((s, p) => s + horasDentro(p, desde, hasta), 0));
  return { horas, paradas, disp: horas ? 1 - paradas / horas : 1, eventos: xs.length, mttr: xs.length ? paradas / xs.length : null, mtbf: xs.length ? (horas - paradas) / xs.length : null, paros: xs };
}
export const enCurso = (d) => (d.paros ?? []).filter((p) => p.tipo === "no_programado" && !p.fin);
export const proximosProgramados = (d) => (d.paros ?? []).filter((p) => p.tipo === "programado" && Date.parse(p.fin ?? p.inicio) >= Date.now() - 12 * H).sort((a, b) => a.inicio.localeCompare(b.inicio));
const pct = (v) => `${numero(v * 100, 1)} %`;

function tarjetaEnCurso(d, p) {
  return `<div class="paro-en-curso" data-paro="${esc(p.id)}"><span class="pulso" aria-hidden="true"></span>
    <span style="flex:1;min-width:0"><b>${esc(nombreCompleto(d, p.equipo_id))}</b> parado desde ${esc(fechaHora(p.inicio))}<br>
      <small style="color:var(--tinta-2)">${esc([p.causa, p.descripcion].filter(Boolean).join(": "))}</small></span>
    <span class="reloj-vivo" data-desde="${esc(p.inicio)}">${duracion((Date.now() - Date.parse(p.inicio)) / H)}</span>
    ${d.yo && !puede(d.yo, "editar") ? "" : `<button type="button" class="boton chico primario" data-termino="${esc(p.id)}">Terminó</button>`}</div>`;
}

export function vistaParos({ d, yo, hoy, query }) {
  const admin = puede(yo, "asignar");
  const dias = Number(query.get("dias") ?? 30);
  const fam = familia(d, query.get("eq"));
  const hasta = Date.now(), desde = hasta - dias * 86400e3;
  const curso = enCurso(d).filter((p) => enFiltro(fam, p.equipo_id));
  const prog = proximosProgramados(d).filter((p) => enFiltro(fam, p.equipo_id));
  const nop = (d.paros ?? []).filter((p) => p.tipo === "no_programado" && p.fin && Date.parse(p.inicio) >= desde && enFiltro(fam, p.equipo_id)).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const equipos = d.equipos.filter((e) => e.activo && !e.padre_id && e.tipo !== "colector" && enFiltro(fam, e.id));
  const disp = equipos.map((e) => ({ e, ...disponibilidad(d, e.id, desde, hasta) })).sort((a, b) => a.disp - b.disp);
  const enlace = (c) => `#/paros?${new URLSearchParams({ ...Object.fromEntries(query), ...c })}`;
  const trabajos = (p) => d.hallazgos.filter((h) => h.paro_id === p.id && h.estado !== "cerrado").length;
  return {
    titulo: "Paros",
    html: `<div class="cabeza"><div><h1>Paros</h1>
        <p class="bajada">Los no programados dan la disponibilidad; los programados juntan los trabajos «para el paro».</p></div>
        <div class="acciones">${puede(yo, "editar") ? `<a class="boton primario" href="#/paro/nuevo">${icono("paros")}Anotar un paro</a>` : ""}
          ${admin ? `<a class="boton" href="#/paro/nuevo?tipo=programado">${icono("calendario")}Programar</a>` : ""}</div></div>
      ${barraFiltros(d, query, { placeholder: "Buscar", extra: `<nav class="filtros" style="margin:0">${[7, 30, 90].map((n) => `<a href="${enlace({ dias: n })}" ${dias === n ? 'aria-current="true"' : ""}>${n} días</a>`).join("")}</nav>` })}
      <div data-cuerpo>
      ${curso.length ? `<section style="margin-bottom:8px">${curso.map((p) => tarjetaEnCurso(d, p)).join("")}</section>` : ""}
      <div class="kpis-app">
        <div class="kpi ${disp.length && disp.every((x) => x.disp >= 0.95) ? "bueno" : "regular"}"><span class="rotulo-kpi">${icono("indicadores")}Disponibilidad promedio</span>
          <span class="valor-kpi">${disp.length ? pct(disp.reduce((s, x) => s + x.disp, 0) / disp.length) : "—"}</span><span class="pie-kpi">últimos ${dias} días</span></div>
        <div class="kpi"><span class="rotulo-kpi">${icono("paros")}Paros no programados</span><span class="valor-kpi">${nop.length + curso.length}</span><span class="pie-kpi">${duracion(nop.reduce((s, p) => s + horasDentro(p, desde, hasta), 0) + curso.reduce((s, p) => s + horasDentro(p, desde, hasta), 0))} en total</span></div>
        <div class="kpi"><span class="rotulo-kpi">${icono("cronometro")}Tiempo medio para reparar</span><span class="valor-kpi">${nop.length ? duracion(nop.reduce((s, p) => s + horasDentro(p, desde, hasta), 0) / nop.length) : "—"}</span><span class="pie-kpi">por paro (MTTR)</span></div>
        <div class="kpi"><span class="rotulo-kpi">${icono("calendario")}Programados</span><span class="valor-kpi">${prog.length}</span><span class="pie-kpi">${prog[0] ? `el próximo: ${esc(fechaCorta(prog[0].inicio.slice(0, 10)))}` : "ninguno próximo"}</span></div>
      </div>
      ${prog.length ? `<section class="seccion"><h2>Programados <small>${prog.length}</small></h2><ul class="lista">${prog.map((p) => `<li><a class="fila con-icono" href="#/paro/${encodeURIComponent(p.id)}">
          <span class="icono-fila morado">${icono("calendario")}</span><span class="titulo">${esc(nombreCompleto(d, p.equipo_id))}</span>
          <span class="detalle"><span>${esc(fechaHora(p.inicio))}${p.fin ? ` → ${esc(fechaHora(p.fin))}` : ""}</span>${p.descripcion ? `<span>${esc(p.descripcion.slice(0, 80))}</span>` : ""}</span>
          <span class="lado">${trabajos(p) ? `<span class="marca paro">${plural(trabajos(p), "trabajo", "trabajos")}</span>` : ""}${p._sinEnviar ? marcaSinEnviar() : ""}</span></a></li>`).join("")}</ul></section>` : ""}
      <section class="seccion"><h2>Disponibilidad por equipo <small>últimos ${dias} días</small></h2>
        ${disp.length ? `<div class="lista">${disp.map((x) => `<a class="tendencia" href="#/equipo/${encodeURIComponent(x.e.id)}" style="color:inherit">
          <div><div style="font-weight:600">${esc(nombreCompleto(d, x.e.id))}</div><div style="font-size:14px;color:var(--tinta-3)">${x.eventos ? `${plural(x.eventos, "paro", "paros")} · ${duracion(x.paradas)} parado` : "Sin paros no programados"}</div></div>
          <div class="barra-disp" role="img" aria-label="Disponibilidad ${pct(x.disp)}"><i style="transform:scaleX(${x.disp.toFixed(4)})"></i></div>
          <div style="text-align:right;font:700 18px var(--titulo);${x.disp < 0.9 ? "color:var(--rojo)" : x.disp < 0.97 ? "color:var(--naranja)" : ""}">${pct(x.disp)}</div></a>`).join("")}</div>` : vacio("No hay equipos con ese filtro.")}
      </section>
      <section class="seccion"><h2>No programados <small>${nop.length || ""}</small></h2>
        ${nop.length ? `<ul class="lista">${nop.map((p) => `<li><a class="fila" href="#/paro/${encodeURIComponent(p.id)}">
          <span class="titulo">${esc(nombreCompleto(d, p.equipo_id))} <small>· ${esc(p.causa || "sin causa")}</small></span>
          <span class="detalle"><span>${esc(fechaHora(p.inicio))}</span><span>${duracion(horasDentro(p, 0, Date.now()))}</span>${p.descripcion ? `<span>${esc(p.descripcion.slice(0, 90))}</span>` : ""}</span>
          <span class="lado">${p._sinEnviar ? marcaSinEnviar() : `<span class="marca">${esc(nombreCorto(d, p.creado_por))}</span>`}</span></a></li>`).join("")}</ul>` : vacio(`Ningún paro no programado en los últimos ${dias} días.`)}
      </section>
      </div>`,
    montar(m) {
      montarFiltros(m, d, { ruta: "paros", alCambiar: (q) => {
        const v = vistaParos({ d: api.obtener(), yo, hoy, query: q });
        const tmp = document.createElement("div");
        tmp.innerHTML = v.html;
        m.querySelector("[data-cuerpo]").replaceWith(tmp.querySelector("[data-cuerpo]"));
      } });
      return montarEnCurso(m);
    },
  };
}

/** El reloj de los paros en curso y el botón «Terminó» (sirve donde se muestren: paros, tablero, ficha del equipo). */
export function montarEnCurso(m) {
  const reloj = setInterval(() => m.querySelectorAll("[data-desde]").forEach((x) => { x.textContent = duracion((Date.now() - Date.parse(x.dataset.desde)) / H); }), 20000);
  m.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-termino]");
    if (!b) return;
    const hora = new Date().toLocaleTimeString("es-PA", { hour: "numeric", minute: "2-digit", timeZone: "America/Panama" });
    if (!(await confirmar("¿Ya arrancó?", `El paro queda terminado a las ${hora}. Si fue a otra hora, ábrelo y cámbiala.`, "Terminó"))) return;
    b.disabled = true;
    try {
      await api.encolar(`paros/${encodeURIComponent(b.dataset.termino)}`, { fin: new Date().toISOString() });
      aviso("Paro terminado: el equipo vuelve a contar como disponible.");
    } catch (x) { aviso(x.message, { error: true }); b.disabled = false; }
  });
  return () => clearInterval(reloj);
}
export { tarjetaEnCurso };

// ------------------------------------------------------------------------------- un paro (o nuevo)

const local = (iso) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export function vistaParo({ d, yo, hoy, param, query, ir }) {
  const nuevo = param === "nuevo";
  const p = nuevo ? null : (d.paros ?? []).find((x) => x.id === param);
  if (!nuevo && !p) return { titulo: "No está", atras: "#/paros", html: vacio("Ese paro no existe.") };
  const admin = puede(yo, "asignar");
  const tipo = p?.tipo ?? (query.get("tipo") === "programado" && admin ? "programado" : "no_programado");
  const puedeCambiar = puede(yo, "editar") && (nuevo || esAdmin(yo) || p.creado_por === yo.id || (p.tipo === "programado" && puede(yo, "asignar")));
  const ahora = new Date().toISOString();
  const P = p ?? { equipo_id: query.get("equipo") ?? "", inicio: tipo === "programado" ? `${sumarDias(hoy, 7)}T11:00:00.000Z` : ahora, fin: tipo === "programado" ? `${sumarDias(hoy, 7)}T23:00:00.000Z` : null, causa: "", descripcion: "" };
  const trabajos = p ? d.hallazgos.filter((h) => h.paro_id === p.id).sort((a, b) => (a.estado === "cerrado") - (b.estado === "cerrado")) : [];
  const sueltos = p && tipo === "programado" ? d.hallazgos.filter((h) => h.estado === "paro" && !h.paro_id && familia(d, p.equipo_id)?.has(h.equipo_id)) : [];
  const docTrabajos = () => `<article class="documento" style="margin-top:16px"><h1>Lista de trabajos del paro</h1>
      <p class="sub-doc">${esc(nombreCompleto(d, P.equipo_id))} · ${esc(fechaHora(P.inicio))}${P.fin ? ` → ${esc(fechaHora(P.fin))}` : ""}${P.descripcion ? ` · ${esc(P.descripcion)}` : ""}</p>
      ${trabajos.length ? `<table class="tabla"><thead><tr><th>N.º</th><th>Equipo</th><th>Qué</th><th>Qué hay que hacer</th><th>A cargo</th><th>Hecho</th></tr></thead><tbody>
        ${trabajos.map((h) => `<tr><td class="n">${numeroHallazgo(h)}</td><td>${esc(nombreCompleto(d, h.equipo_id))}</td><td>${esc(h.descripcion)}</td><td>${esc(h.accion ?? "")}${h.ot ? `<br><b>${esc(h.ot)}</b>` : ""}</td>
          <td>${esc(nombreCorto(d, h.responsable_id))}</td><td>${h.estado === "cerrado" ? "✓" : "☐"}</td></tr>`).join("")}</tbody></table>` : `<p class="vacio-doc">Todavía no hay trabajos para este paro.</p>`}
    </article>`;
  return {
    titulo: nuevo ? (tipo === "programado" ? "Programar un paro" : "Anotar un paro") : `Paro: ${nombreCompleto(d, P.equipo_id)}`,
    tituloCorto: "Paro",
    atras: "#/paros",
    viva: false,
    html: `<div class="cabeza no-imprimir"><div><div class="migas"><a href="#/paros">Paros</a><span>· ${tipo === "programado" ? "programado" : "no programado"}</span></div>
        <h1>${nuevo ? (tipo === "programado" ? "Programar un paro" : "Anotar un paro") : esc(nombreCompleto(d, P.equipo_id))}</h1>
        ${!nuevo ? `<p class="bajada">${esc(fechaHora(P.inicio))}${P.fin ? ` → ${esc(fechaHora(P.fin))} · ${duracion((Date.parse(P.fin) - Date.parse(P.inicio)) / H)}` : " · sigue parado"} · anotó ${esc(nombre(d, P.creado_por))}</p>` : ""}</div>
        ${p?._sinEnviar ? marcaSinEnviar() : ""}</div>
      <div class="hoja-insp no-imprimir">
        ${!nuevo && !puedeCambiar ? `<div class="panel"><dl class="datos-insp">
            <dt>Causa</dt><dd>${esc(P.causa || "—")}</dd>
            <dt>${tipo === "programado" ? "Empieza" : "Paró"}</dt><dd>${esc(fechaHora(P.inicio))}</dd>
            <dt>${tipo === "programado" ? "Termina" : "Arrancó"}</dt><dd>${P.fin ? esc(fechaHora(P.fin)) : "Sigue parado"}</dd></dl>
            ${P.descripcion ? `<p class="texto-largo" style="margin:0">${esc(P.descripcion)}</p>` : ""}
            ${tipo === "no_programado" && !P.fin && puede(yo, "editar") ? `<div><button type="button" class="boton primario" data-termino="${esc(P.id)}">${icono("play")}Terminó</button></div>` : ""}
            <p class="ayuda">${icono("candado", "ico chico")} Lo cambia quien lo anotó o el administrador${tipo === "no_programado" && !P.fin && puede(yo, "editar") ? "; decir que terminó, cualquiera" : ""}.</p></div>` : `<form class="panel" id="form-paro" novalidate>
          <div class="rejilla-campos dos">
            <div class="campo"><span class="rotulo">Equipo</span>${campoEquipo(d, { id: "p-equipo", valor: P.equipo_id, titulo: "Qué equipo paró", placeholder: "Elegir el equipo" })}</div>
            <div class="campo"><label for="p-causa">Causa</label><select id="p-causa"><option value="">Elegir…</option>${(d.causas_paro ?? []).map((c) => `<option ${c === P.causa ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
            <div class="campo"><label for="p-inicio">${tipo === "programado" ? "Empieza" : "Paró"}</label><input id="p-inicio" type="datetime-local" value="${esc(local(P.inicio))}"></div>
            <div class="campo"><label for="p-fin">${tipo === "programado" ? "Termina" : "Arrancó"} ${tipo === "programado" ? "" : "<small>(vacío si sigue parado)</small>"}</label>
              <input id="p-fin" type="datetime-local" value="${esc(local(P.fin))}"></div>
          </div>
          <div class="campo"><label for="p-desc">${tipo === "programado" ? "Qué se va a hacer" : "Qué pasó"}</label><textarea id="p-desc" style="min-height:90px">${esc(P.descripcion ?? "")}</textarea></div>
          <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>
          ${puedeCambiar ? `<div class="herramientas-item"><button class="boton primario" type="submit">${icono("bien")}${nuevo ? "Guardar" : "Guardar cambios"}</button>
            ${!nuevo && !P.fin ? `<button type="button" class="boton" data-ahora>${icono("play")}Terminó ahora</button>` : ""}
            ${!nuevo ? `<button type="button" class="boton plano peligro" data-borrar>${icono("basura")}Borrar</button>` : ""}</div>` : ""}
        </form>`}
        ${tipo === "programado" && !nuevo ? `<aside class="panel"><h2>Trabajos para este paro</h2>
          ${trabajos.length ? `<ul class="lista" style="box-shadow:none;background:var(--hundido)">${trabajos.map((h) => `<li><a class="fila" href="#/hallazgo/${encodeURIComponent(h.id)}"><span class="titulo">${esc(h.descripcion)}</span>
            <span class="detalle"><span class="mono">${numeroHallazgo(h)}</span><span>${esc(nombreCompleto(d, h.equipo_id))}</span></span><span class="lado">${h.estado === "cerrado" ? `<span class="marca ok">Hecho</span>` : marcaPrioridad(h.prioridad)}</span></a></li>`).join("")}</ul>`
            : `<p class="ayuda">Cuando un hallazgo pase a «Para el paro», se elige este paro y entra aquí.</p>`}
          ${sueltos.length ? `<button type="button" class="boton chico" data-juntar>${icono("mas1")}Juntar ${plural(sueltos.length, "hallazgo «para el paro» de este equipo", "hallazgos «para el paro» de este equipo")}</button>` : ""}
          <button type="button" class="boton chico" data-imprimir>${icono("imprimir")}Imprimir la lista</button></aside>` : ""}
      </div>
      ${tipo === "programado" && !nuevo ? `<div class="hojas solo-imprimir">${docTrabajos()}</div>` : ""}`,
    montar(m) {
      const f = m.querySelector("#form-paro");
      if (!f) return montarEnCurso(m);
      const instante = (v) => (v ? new Date(v).toISOString() : null);
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = f.querySelector(".error-form");
        const fallo = (t) => { err.hidden = false; err.textContent = t; };
        const datos = { id: p?.id ?? crypto.randomUUID(), tipo, equipo_id: f["p-equipo"].value, causa: f["p-causa"].value, inicio: instante(f["p-inicio"].value), fin: instante(f["p-fin"].value), descripcion: f["p-desc"].value };
        if (!datos.equipo_id) return fallo("Elige el equipo.");
        if (!datos.inicio) return fallo(`Pon cuándo ${tipo === "programado" ? "empieza" : "paró"}.`);
        if (datos.fin && datos.fin < datos.inicio) return fallo("Termina antes de empezar: revisa las horas.");
        const b = f.querySelector("button[type=submit]");
        b.disabled = true;
        try {
          if (tipo === "programado") await api.escribir(nuevo ? "paros" : `paros/${encodeURIComponent(datos.id)}`, datos);
          else await Promise.race([api.encolar(nuevo ? "paros" : `paros/${encodeURIComponent(datos.id)}`, datos), new Promise((ok) => setTimeout(ok, 5000))]);
          aviso(nuevo ? "Paro anotado." : "Guardado.");
          ir(tipo === "programado" ? `#/paro/${encodeURIComponent(datos.id)}` : "#/paros");
        } catch (x) {
          b.disabled = false;
          fallo(x.sinRed ? "Para programar un paro hace falta señal." : x.message);
        }
      });
      m.addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.hasAttribute("data-ahora")) { f["p-fin"].value = local(new Date().toISOString()); f.requestSubmit(); }
        if (b.hasAttribute("data-imprimir")) print();
        if (b.hasAttribute("data-borrar")) {
          if (!(await confirmar("¿Borrar el paro?", tipo === "programado" ? "Sus trabajos vuelven a quedar sin paro." : "Deja de contar para la disponibilidad.", "Borrar", "peligro"))) return;
          try { await api.escribir(`paros/${encodeURIComponent(p.id)}/borrar`, {}); aviso("Paro borrado."); ir("#/paros"); }
          catch (x) { aviso(x.sinRed ? "Para borrar hace falta señal." : x.message, { error: true }); }
        }
        if (b.hasAttribute("data-juntar")) {
          b.disabled = true;
          try {
            for (const h of sueltos) await api.encolar(`hallazgos/${encodeURIComponent(h.id)}`, { estado: "paro", paro_id: p.id, seguimiento_id: crypto.randomUUID(), fecha: new Date().toISOString() });
            aviso(`${plural(sueltos.length, "trabajo agregado", "trabajos agregados")} al paro.`);
          } catch (x) { aviso(x.message, { error: true }); b.disabled = false; }
        }
      });
    },
  };
}
