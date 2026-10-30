// Entrega de turno: el que sale deja las novedades, lo pendiente y el estado de cada equipo (en marcha, parado o con
// restricción); el que entra la lee y marca «Recibido». Funciona sin señal (entra a la cola).
import { esc, icono, fechaHora, haceCuanto, plural, diasEntre, diaDe } from "./util.mjs";
import * as api from "./api.mjs";
import { puede, aviso, dialogo, vacio, nombre, persona, avatar, galeria, botonesMedio, marcaSinEnviar, queInspeccion, plantilla } from "./ui.mjs";
import { nombreCompleto } from "./componentes.mjs";
import { prepararArchivo, dictar, hayDictado } from "./medios.mjs";
import { esMia } from "./vistas-tareas.mjs";

export const TEXTO_ESTADO_EQUIPO = { marcha: "En marcha", parado: "Parado", restriccion: "Con restricción" };
const ICONO_EQ = { marcha: "play", parado: "paros", restriccion: "alerta" };

/** La entrega que me toca recibir: de otro turno, de las últimas 18 horas, sin recibir. */
export function entregaPorRecibir(d, yo) {
  if (!yo.turno || !puede(yo, "editar")) return null;
  const desde = new Date(Date.now() - 18 * 3600e3).toISOString();
  return (d.entregas ?? []).find((e) => !e.recibida_por && e.de !== yo.id && e.en >= desde && String(e.turno).toUpperCase() !== String(yo.turno).toUpperCase()) ?? null;
}

const marcaEquipo = (e) => `<span class="marca ${e}">${icono(ICONO_EQ[e])}${TEXTO_ESTADO_EQUIPO[e]}</span>`;

function filaEntrega(d, e, hoy) {
  const malos = (e.equipos ?? []).filter((x) => x.estado !== "marcha");
  return `<li><a class="fila con-icono" href="#/entrega/${encodeURIComponent(e.id)}">${avatar(persona(d, e.de) ?? { id: e.de, nombre: "?" })}
    <span class="titulo">Turno ${esc(e.turno || "—")} <small>· ${esc(nombre(d, e.de))}</small></span>
    <span class="detalle"><span>${esc(fechaHora(e.en))}</span>${malos.length ? `<span style="color:var(--naranja)">${plural(malos.length, "equipo no está en marcha", "equipos no están en marcha")}</span>` : `<span>Todo en marcha</span>`}</span>
    <span class="lado">${e._sinEnviar ? marcaSinEnviar() : e.recibida_por ? `<span class="marca ok">${icono("bien")}Recibida</span>` : `<span class="marca media">${icono("reloj")}Sin recibir</span>`}</span></a></li>`;
}

export function vistaTurno({ d, yo, hoy }) {
  const xs = [...(d.entregas ?? [])].sort((a, b) => b.en.localeCompare(a.en));
  const porRecibir = entregaPorRecibir(d, yo);
  const ultimaMia = xs.find((e) => e.de === yo.id);
  return {
    titulo: "Entrega de turno",
    atras: matchMedia("(max-width: 899px)").matches ? "#/mas" : null,
    html: `<div class="cabeza"><div><h1>Entrega de turno</h1>
        <p class="bajada">El que sale deja lo que pasó, lo pendiente y cómo quedan los equipos; el que entra lo lee y marca «Recibido».</p></div>
        ${puede(yo, "editar") ? `<div class="acciones"><a class="boton primario" href="#/nueva-entrega">${icono("turno")}Entregar mi turno</a></div>` : ""}</div>
      ${porRecibir ? `<a class="tira azul" href="#/entrega/${encodeURIComponent(porRecibir.id)}" style="margin-bottom:18px"><span class="icono-tira">${icono("turno", "ico", { lleno: true })}</span>
        <span><b>El turno ${esc(porRecibir.turno)} te entregó, ${esc(haceCuanto(porRecibir.en, hoy) === "hoy" ? fechaHora(porRecibir.en).split(", ")[1] : fechaHora(porRecibir.en))}</b>
        <small>${esc((porRecibir.novedades || porRecibir.pendientes || "").slice(0, 110))}</small></span>${icono("derecha", "ico chevron")}</a>` : ""}
      ${ultimaMia && diasEntre(diaDe(ultimaMia.en), hoy) === 0 ? `<p class="nota-asignacion azul" style="margin-bottom:14px">Ya entregaste hoy (${esc(fechaHora(ultimaMia.en))}). ${ultimaMia.recibida_por ? `La recibió ${esc(nombre(d, ultimaMia.recibida_por))}.` : "Todavía nadie la recibe."}</p>` : ""}
      ${xs.length ? `<ul class="lista">${xs.map((e) => filaEntrega(d, e, hoy)).join("")}</ul>` : vacio("Todavía no hay entregas de turno.", puede(yo, "editar") ? `<a class="boton chico" href="#/nueva-entrega">${icono("turno")}Hacer la primera</a>` : "")}`,
  };
}

export function vistaEntrega({ d, yo, param, ir }) {
  const e = (d.entregas ?? []).find((x) => x.id === param);
  if (!e) return { titulo: "No está", atras: "#/turno", html: vacio("Esa entrega no existe.") };
  const puedeRecibir = !e.recibida_por && e.de !== yo.id && puede(yo, "editar");
  const malos = (e.equipos ?? []).filter((x) => x.estado !== "marcha");
  return {
    titulo: `Entrega del turno ${e.turno || ""}`,
    atras: "#/turno",
    html: `<div class="cabeza"><div><div class="migas"><a href="#/turno">Entrega de turno</a></div>
        <h1>Turno ${esc(e.turno || "—")}</h1><p class="bajada">${esc(nombre(d, e.de))} · ${esc(fechaHora(e.en))}</p></div>
        <div class="acciones">${e._sinEnviar ? marcaSinEnviar() : e.recibida_por ? `<span class="marca ok">${icono("bien")}Recibida por ${esc(nombre(d, e.recibida_por).split(" ")[0])}</span>` : ""}
          ${puedeRecibir ? `<button class="boton primario" data-recibir>${icono("bien")}Recibido</button>` : ""}</div></div>
      <div class="hoja-insp">
        <div>
          <section class="panel"><h2>Novedades</h2><p class="texto-largo">${esc(e.novedades || "Sin novedades.")}</p></section>
          <section class="panel" style="margin-top:12px"><h2>Pendiente</h2><p class="texto-largo">${esc(e.pendientes || "Nada pendiente.")}</p></section>
          ${(e.fotos ?? []).length ? `<section class="seccion"><h2>Fotos</h2>${galeria(e.fotos)}</section>` : ""}
          ${e.recibida_por ? `<div class="visto-bueno" style="margin-top:14px">${icono("bien")}<div><b>Recibida por ${esc(nombre(d, e.recibida_por))}</b><span>${esc(fechaHora(e.recibida_en))}${e.nota_recibido ? ` · ${esc(e.nota_recibido)}` : ""}</span></div></div>` : ""}
        </div>
        <aside class="panel"><h2>Equipos <small style="font:500 14px var(--letra);color:var(--tinta-3)">${malos.length ? `${malos.length} sin marcha normal` : "todos en marcha"}</small></h2>
          ${(e.equipos ?? []).length ? `<div class="estados-equipos">${[...e.equipos].sort((a, b) => (a.estado === "marcha") - (b.estado === "marcha")).map((x) => `<div class="estado-equipo-fila">
            <span><b style="font-weight:600">${esc(nombreCompleto(d, x.equipo_id))}</b>${x.nota ? `<br><small style="color:var(--tinta-3)">${esc(x.nota)}</small>` : ""}</span>${marcaEquipo(x.estado)}</div>`).join("")}</div>` : `<p class="ayuda">No se marcaron equipos.</p>`}
        </aside>
      </div>`,
    montar(m) {
      m.querySelector("[data-recibir]")?.addEventListener("click", async () => {
        let nota = "";
        const ok = await dialogo({
          titulo: "Recibir el turno",
          html: `<p>Le llega un aviso a ${esc(nombre(d, e.de).split(" ")[0])}.</p><div class="campo"><label for="r-nota">Comentario <small>(opcional)</small></label>
            <textarea id="r-nota" style="min-height:70px" placeholder="Por ejemplo: recibido, voy a ver la purga"></textarea></div>`,
          botones: [{ texto: "Cancelar", valor: false }, { texto: "Recibido", valor: true, clase: "primario", alElegir: (v) => { nota = v.querySelector("#r-nota").value; } }],
        });
        if (!ok) return;
        try {
          await api.encolar(`entregas/${encodeURIComponent(e.id)}/recibir`, { nota, en: new Date().toISOString() });
          aviso("Turno recibido.");
          ir("#/tablero");
        } catch (x) { aviso(x.message, { error: true }); }
      });
    },
  };
}

export function vistaNuevaEntrega({ d, yo, hoy, ir }) {
  if (!puede(yo, "editar")) return { titulo: "Entregar mi turno", atras: "#/turno", html: vacio("Tu usuario es de solo ver: entrega el turno quien tiene permiso de editar.") };
  const equipos = d.equipos.filter((e) => e.activo && !e.padre_id && e.tipo !== "colector");
  const enCurso = new Map((d.paros ?? []).filter((p) => p.tipo === "no_programado" && !p.fin).map((p) => [p.equipo_id, p]));
  const estados = Object.fromEntries(equipos.map((e) => [e.id, enCurso.has(e.id) ? { estado: "parado", nota: enCurso.get(e.id).descripcion ?? "" } : { estado: "marcha", nota: "" }]));
  // lo que se había escrito y no se entregó vuelve (recargar, ir atrás…)
  const B = (() => { const b = api.borrador.leer("entrega"); return b && (b.novedades || b.pendientes || b.fotos?.length) ? b : null; })();
  if (B) for (const [id, s] of Object.entries(B.estados ?? {})) if (estados[id]) estados[id] = s;
  const fotos = [...(B?.fotos ?? [])];
  const sugerencia = () => {
    const turno = yo.turno ? `turno:${yo.turno}` : "-";
    const xs = [];
    for (const i of d.inspecciones.filter((i) => i.estado === "pendiente" && (i.asignada_a === yo.id || i.asignada_a === turno) && i.vence <= hoy)) xs.push(`- Inspección sin hacer: ${queInspeccion(d, i)} · ${plantilla(d, i.plantilla_id)?.nombre ?? ""}`);
    for (const t of (d.tareas ?? []).filter((t) => t.estado !== "hecha" && esMia(t, yo) && t.vence && t.vence <= hoy)) xs.push(`- Tarea: ${t.titulo}`);
    for (const h of d.hallazgos.filter((h) => h.estado !== "cerrado" && h.prioridad === "alta")) xs.push(`- Hallazgo alto abierto: ${nombreCompleto(d, h.equipo_id)}: ${h.descripcion}`);
    for (const p of enCurso.values()) xs.push(`- Sigue parado: ${nombreCompleto(d, p.equipo_id)}${p.causa ? ` (${p.causa})` : ""}`);
    return xs.join("\n");
  };
  const fila = (e) => {
    const s = estados[e.id];
    return `<div class="estado-equipo-fila" data-eq="${esc(e.id)}"><span><b style="font-weight:600">${esc(e.tag ? `${e.tag} · ${e.nombre}` : e.nombre)}</b><br><small style="color:var(--tinta-3)">${esc(e.area ?? "")}</small></span>
      <div class="segmento chico" role="group" aria-label="Estado de ${esc(e.nombre)}">${["marcha", "restriccion", "parado"].map((x) => `<button type="button" data-valor="${x}" aria-pressed="${s.estado === x}">${TEXTO_ESTADO_EQUIPO[x].replace("Con restricción", "Restricción")}</button>`).join("")}</div>
      <input type="text" data-nota placeholder="Qué pasa (por ejemplo: sin sacos)" value="${esc(s.nota)}" ${s.estado === "marcha" ? "hidden" : ""} aria-label="Nota de ${esc(e.nombre)}"></div>`;
  };
  return {
    titulo: "Entregar mi turno",
    atras: "#/turno",
    viva: false,
    html: `<div class="cabeza"><div><h1>Entregar el turno${yo.turno ? ` ${esc(yo.turno)}` : ""}</h1>
        <p class="bajada">Le llega a los otros turnos y al ingeniero. Funciona sin señal.</p></div></div>
      <form id="form-entrega" novalidate class="hoja-insp">
        ${B ? `<p class="nota-asignacion azul" style="grid-column:1/-1;margin:0">Seguiste donde lo dejaste (${esc(fechaHora(B.guardado))}). <button type="button" class="boton mini plano" data-descartar>Empezar de nuevo</button></p>` : ""}
        <div style="display:grid;gap:12px">
          <div class="panel"><div class="campo"><label for="e-novedades">Novedades del turno</label>
            <textarea id="e-novedades" style="min-height:130px" placeholder="Qué pasó: cambios, ajustes, problemas, cómo quedó la producción…">${esc(B?.novedades ?? "")}</textarea>
            ${hayDictado ? `<div><button type="button" class="boton chico" data-dictar="e-novedades">${icono("microfono")}Dictar</button></div>` : ""}</div></div>
          <div class="panel"><div class="campo"><label for="e-pendientes" style="display:flex;justify-content:space-between;align-items:center">Lo que queda pendiente
              <button type="button" class="boton mini" data-sugerir>${icono("lista")}Sugerir desde lo abierto</button></label>
            <textarea id="e-pendientes" style="min-height:110px" placeholder="Lo que el que entra tiene que seguir">${esc(B?.pendientes ?? "")}</textarea>
            ${hayDictado ? `<div><button type="button" class="boton chico" data-dictar="e-pendientes">${icono("microfono")}Dictar</button></div>` : ""}</div>
            <div class="campo"><span class="rotulo">Fotos <small>(opcional)</small></span><div class="herramientas-item">${botonesMedio("entrega")}</div><div data-galeria-nueva>${fotos.length ? galeria(fotos, { quitar: true }) : ""}</div></div></div>
        </div>
        <div class="panel" style="align-content:start"><h2>Cómo quedan los equipos</h2><p class="ayuda" style="margin-top:-8px">Los que están parados por un paro en curso ya vienen marcados.</p>
          <div class="estados-equipos">${equipos.map(fila).join("")}</div></div>
        <div class="pie-fijo" style="grid-column:1/-1"><div class="avance" data-resumen></div>
          <button type="submit" class="boton primario">${icono("turno")}Entregar turno</button></div>
      </form>`,
    montar(m) {
      const f = m.querySelector("#form-entrega");
      const resumen = () => {
        const malos = Object.values(estados).filter((s) => s.estado !== "marcha").length;
        m.querySelector("[data-resumen]").innerHTML = `<b>${plural(equipos.length - malos, "en marcha", "en marcha")}</b>${malos ? ` · ${plural(malos, "parado o con restricción", "parados o con restricción")}` : ""}`;
      };
      resumen();
      let parar = null;
      f.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        const fila = b.closest("[data-eq]");
        if (fila && b.dataset.valor) {
          estados[fila.dataset.eq].estado = b.dataset.valor;
          b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          const nota = fila.querySelector("[data-nota]");
          nota.hidden = b.dataset.valor === "marcha";
          if (!nota.hidden) nota.focus({ preventScroll: true });
          resumen();
        }
        if (b.hasAttribute("data-sugerir")) {
          const s = sugerencia();
          const ta = f["e-pendientes"];
          ta.value = ta.value ? `${ta.value}\n${s}` : s;
          if (!s) aviso("No hay nada abierto que sugerir.");
        }
        if (b.dataset.quitar) { fotos.splice(fotos.indexOf(b.dataset.quitar), 1); m.querySelector("[data-galeria-nueva]").innerHTML = galeria(fotos, { quitar: true }); }
        if (b.dataset.dictar) {
          if (parar) { parar(); parar = null; return; }
          parar = dictar(m.querySelector(`#${b.dataset.dictar}`), {
            alEmpezar: () => { b.innerHTML = `${icono("microfono")}Escuchando… toca para parar`; },
            alTerminar: () => { b.innerHTML = `${icono("microfono")}Dictar`; parar = null; },
            alError: (t) => aviso(t, { error: true }),
          });
        }
      });
      const guardarBorrador = () => api.borrador.guardar("entrega", { novedades: f["e-novedades"].value, pendientes: f["e-pendientes"].value, estados, fotos });
      f.addEventListener("input", (e) => { const fila = e.target.closest("[data-eq]"); if (fila && e.target.dataset.nota !== undefined) estados[fila.dataset.eq].nota = e.target.value; guardarBorrador(); });
      f.addEventListener("click", (e) => { if (e.target.closest("[data-valor], [data-quitar], [data-sugerir]")) setTimeout(guardarBorrador, 0); });
      f.querySelector("[data-descartar]")?.addEventListener("click", () => { api.borrador.borrar("entrega"); ir("#/nueva-entrega"); });
      f.addEventListener("change", async (e) => {
        const el = e.target;
        if (!el.dataset.medioDe || !el.files?.length) return;
        for (const a of [...el.files]) { try { fotos.push(await api.guardarMedio(await prepararArchivo(a), a.name)); } catch (x) { aviso(x.message, { error: true }); } }
        el.value = "";
        m.querySelector("[data-galeria-nueva]").innerHTML = galeria(fotos, { quitar: true });
        guardarBorrador();
      });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const novedades = f["e-novedades"].value.trim(), pendientes = f["e-pendientes"].value.trim();
        if (!novedades && !pendientes) { aviso("Escribe por lo menos las novedades o lo pendiente.", { error: true }); f["e-novedades"].focus(); return; }
        const b = f.querySelector("button[type=submit]");
        b.disabled = true;
        const id = crypto.randomUUID();
        try {
          await Promise.race([api.encolar("entregas", { id, turno: yo.turno ?? "", en: new Date().toISOString(), novedades, pendientes, fotos,
            equipos: Object.entries(estados).map(([equipo_id, s]) => ({ equipo_id, estado: s.estado, nota: s.estado === "marcha" ? "" : s.nota })) }), new Promise((ok) => setTimeout(ok, 5000))]);
          api.borrador.borrar("entrega");
          aviso(api.cola.pendientes.some((p) => p.datos?.id === id) ? "Entrega guardada en este aparato: se envía cuando haya señal." : "Turno entregado.");
          ir(`#/entrega/${id}`);
        } catch (x) {
          b.disabled = false;
          aviso(`No se pudo guardar: ${x.message}`, { error: true });
        }
      });
      return () => parar?.();
    },
  };
}
