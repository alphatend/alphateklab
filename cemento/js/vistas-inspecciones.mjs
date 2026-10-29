// Inspecciones: la lista, asignar una y llenarla (o verla, si ya está hecha).
import { esc, icono, fechaCorta, fechaHora, sumarDias, plural, numero, diasEntre } from "./util.mjs";
import * as api from "./api.mjs";
import {
  aviso, dialogo, confirmar, filaInspeccion, vacio, equipo, plantilla, persona, nombre, nombreCorto,
  marcaVence, marcaPrioridad, galeria, botonesMedio, marcaSinEnviar,
} from "./ui.mjs";
import { prepararArchivo, dictar, hayDictado } from "./medios.mjs";

// ------------------------------------------------------------------------------- lista

export function vistaInspecciones({ d, yo, hoy, query }) {
  const esIng = yo.rol === "ingeniero";
  const f = query.get("f") ?? (esIng ? "todas" : "mias");
  let xs = d.inspecciones;
  if (f === "mias") xs = xs.filter((i) => i.asignada_a === yo.id || i.hecha_por === yo.id);
  if (f === "atrasadas") xs = xs.filter((i) => i.estado === "pendiente" && i.vence < hoy);
  if (f === "hechas") xs = xs.filter((i) => i.estado === "hecha");
  const pend = xs.filter((i) => i.estado === "pendiente").sort((a, b) => a.vence.localeCompare(b.vence));
  const grupos = [
    ["Atrasadas", pend.filter((i) => i.vence < hoy)],
    ["Hoy", pend.filter((i) => i.vence === hoy)],
    ["Próximas", pend.filter((i) => i.vence > hoy)],
    ["Hechas", xs.filter((i) => i.estado === "hecha" && diasEntre((i.hecha_en ?? "").slice(0, 10) || hoy, hoy) <= 45)
      .sort((a, b) => (b.hecha_en ?? "").localeCompare(a.hecha_en ?? ""))],
  ].filter(([, g]) => g.length);
  const cuenta = (filtro) => {
    if (filtro === "mias") return d.inspecciones.filter((i) => i.estado === "pendiente" && i.asignada_a === yo.id).length;
    if (filtro === "atrasadas") return d.inspecciones.filter((i) => i.estado === "pendiente" && i.vence < hoy).length;
    return null;
  };
  const filtro = (id, texto) => {
    const n = cuenta(id);
    return `<a href="#/inspecciones?f=${id}" ${f === id ? 'aria-current="true"' : ""}>${texto}${n ? ` <b>${n}</b>` : ""}</a>`;
  };
  return {
    titulo: "Inspecciones",
    html: `<div class="cabeza"><div><h1>Inspecciones</h1>
        <p class="bajada">${esIng ? "Las que asignaste a los jefes de turno y a ti." : "Las que te asignaron. Tócala para llenarla."}</p></div>
        ${esIng ? `<div class="acciones"><a class="boton primario" href="#/asignar">${icono("mas1")}Asignar</a></div>` : ""}</div>
      <nav class="filtros" aria-label="Filtrar">${filtro("mias", "Mías")}${filtro("todas", "Todas")}${filtro("atrasadas", "Atrasadas")}${filtro("hechas", "Hechas")}</nav>
      ${grupos.length
        ? grupos.map(([t, g]) => `<section class="seccion"><h2>${t} <small>${g.length}</small></h2><ul class="lista">${g.map((i) => filaInspeccion(d, i, hoy, { mostrarQuien: f !== "mias" })).join("")}</ul></section>`).join("")
        : vacio(f === "atrasadas" ? "Nada atrasado." : f === "mias" ? "No tienes inspecciones asignadas." : "No hay inspecciones.", esIng ? `<a class="boton chico" href="#/asignar">${icono("mas1")}Asignar una</a>` : "")}`,
  };
}

// ------------------------------------------------------------------------------- asignar

const REPETIR = [[0, "Una sola vez"], [1, "Cada día"], [7, "Cada semana"], [15, "Cada 15 días"], [30, "Cada mes"], [60, "Cada 2 meses"]];

export function vistaAsignar({ d, yo, hoy, query, ir }) {
  const eqInicial = query.get("equipo") ?? d.equipos[0]?.id;
  const plInicial = query.get("plantilla");
  const opcionesPlantilla = (eqId, elegida) => {
    const ps = d.plantillas.filter((p) => p.equipo_id === eqId);
    return ps.length
      ? ps.map((p) => `<option value="${esc(p.id)}" ${p.id === elegida ? "selected" : ""}>${esc(p.nombre)}${p.cuando === "parada" ? " (en parada)" : ""} · ${plural(p.items.length, "revisión", "revisiones")}</option>`).join("")
      : `<option value="">Este equipo no tiene plantillas</option>`;
  };
  return {
    titulo: "Asignar inspección",
    atras: "#/inspecciones",
    viva: false,
    html: `<div class="cabeza"><div><h1>Asignar inspección</h1>
        <p class="bajada">Le llega en su lista. Si se repite, al terminarla queda programada la siguiente.</p></div></div>
      <form class="panel" id="form-asignar" novalidate style="max-width:640px">
        <div class="rejilla-campos dos">
          <div class="campo"><label for="a-equipo">Equipo</label>
            <select id="a-equipo">${d.equipos.map((e) => `<option value="${esc(e.id)}" ${e.id === eqInicial ? "selected" : ""}>${esc(e.nombre)}</option>`).join("")}</select></div>
          <div class="campo"><label for="a-plantilla">Qué revisar</label>
            <select id="a-plantilla">${opcionesPlantilla(eqInicial, plInicial)}</select></div>
          <div class="campo"><label for="a-quien">A quién</label>
            <select id="a-quien">${d.personas.map((p) => `<option value="${esc(p.id)}">${esc(p.rol === "jefe" ? `${p.turno} (${p.nombre})` : `${p.nombre} (yo)`.replace(" (yo)", p.id === yo.id ? " (yo)" : ""))}</option>`).join("")}</select></div>
          <div class="campo"><label for="a-vence">Para cuándo</label>
            <input id="a-vence" type="date" value="${hoy}" min="${sumarDias(hoy, -30)}"></div>
          <div class="campo"><label for="a-repetir">Se repite</label>
            <select id="a-repetir">${REPETIR.map(([n, t]) => `<option value="${n}">${t}</option>`).join("")}</select>
            <span class="ayuda" id="a-sugerida"></span></div>
        </div>
        <div class="campo"><label for="a-nota">Nota para quien la hace <span style="font-weight:400;color:var(--tinta-3)">(opcional)</span></label>
          <textarea id="a-nota" placeholder="Por ejemplo: aprovechar la parada del viernes"></textarea></div>
        <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>
        <div><button class="boton primario" type="submit">${icono("bien")}Asignar</button></div>
      </form>`,
    montar(m) {
      const f = m.querySelector("#form-asignar");
      const selEq = f.querySelector("#a-equipo"), selPl = f.querySelector("#a-plantilla"), selRep = f.querySelector("#a-repetir");
      const sugerir = () => {
        const p = plantilla(d, selPl.value);
        const n = p?.frecuencia_dias ?? 0;
        const opcion = REPETIR.find(([k]) => k === n) ? n : 0;
        selRep.value = String(opcion);
        f.querySelector("#a-sugerida").textContent = p?.frecuencia_dias ? `La plantilla sugiere cada ${p.frecuencia_dias === 1 ? "día" : `${p.frecuencia_dias} días`}.` : "";
      };
      selEq.addEventListener("change", () => { selPl.innerHTML = opcionesPlantilla(selEq.value); sugerir(); });
      selPl.addEventListener("change", sugerir);
      sugerir();
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = f.querySelector(".error-form");
        if (!selPl.value) { err.hidden = false; err.textContent = "Este equipo no tiene plantillas: crea una en Equipos."; return; }
        const boton = f.querySelector("button[type=submit]");
        boton.disabled = true;
        const datos = { id: crypto.randomUUID(), plantilla_id: selPl.value, asignada_a: f["a-quien"].value, vence: f["a-vence"].value, repetir_dias: Number(selRep.value) || null, nota: f["a-nota"].value };
        try {
          await api.escribir("inspecciones", datos);
          const dd = api.obtener();
          const quien = persona(dd, datos.asignada_a);
          const texto = mensajeAsignacion(dd, datos);
          const r = await dialogo({
            titulo: "Asignada",
            html: `<p>${esc(equipo(dd, plantilla(dd, datos.plantilla_id)?.equipo_id)?.nombre)} para ${esc(quien?.rol === "jefe" ? quien.turno : quien?.nombre)}, para el ${esc(fechaCorta(datos.vence))}. Ya le aparece en su lista.</p>`,
            botones: [{ texto: "Asignar otra", valor: "otra" }, { texto: "Avisar por WhatsApp", valor: "wa", icono: "whatsapp" }, { texto: "Listo", valor: "listo", clase: "primario" }],
          });
          if (r === "wa") abrirWhatsApp(texto);
          if (r === "otra") ir(`#/asignar?equipo=${encodeURIComponent(selEq.value)}`);
          else ir("#/inspecciones");
        } catch (x) {
          err.hidden = false;
          err.textContent = x.sinRed ? "Para asignar hace falta señal. Prueba cuando tengas conexión." : x.message;
          boton.disabled = false;
        }
      });
    },
  };
}

function mensajeAsignacion(d, datos) {
  const pl = plantilla(d, datos.plantilla_id), eq = equipo(d, pl?.equipo_id);
  const url = `${location.origin}${location.pathname}#/inspeccion/${encodeURIComponent(datos.id)}`;
  return `Te asigné una inspección: ${eq?.nombre} · ${pl?.nombre}, para el ${fechaCorta(datos.vence)}.${datos.nota ? `\nNota: ${datos.nota}` : ""}\n${url}`;
}

export function abrirWhatsApp(texto) {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
}

// ------------------------------------------------------------------------------- una inspección

export function vistaInspeccion(ctx) {
  const { d, param } = ctx;
  const insp = d.inspecciones.find((i) => i.id === param);
  if (!insp) return { titulo: "No está", atras: "#/inspecciones", html: vacio("Esa inspección no existe: puede que la hayan borrado.", `<a class="boton" href="#/inspecciones">Ver las inspecciones</a>`) };
  return insp.estado === "hecha" ? verHecha(ctx, insp) : llenar(ctx, insp);
}

function cabeceraInspeccion(d, insp, hoy) {
  const eq = equipo(d, insp.equipo_id), pl = plantilla(d, insp.plantilla_id);
  return `<div class="cabeza"><div>
      <div class="migas"><a href="#/equipo/${encodeURIComponent(insp.equipo_id)}">${esc(eq?.nombre ?? "")}</a></div>
      <h1>${esc(pl?.nombre ?? "Inspección")}</h1>
      <p class="bajada">${pl?.cuando === "parada" ? "Con el equipo parado." : "Con el equipo en marcha."} ${esc(eq?.area ?? "")}</p>
    </div><div class="acciones">${insp._sinEnviar ? marcaSinEnviar() : marcaVence(insp, hoy)}</div></div>`;
}

function datosInspeccion(d, insp) {
  return `<dl class="datos-insp">
      <dt>Asignada a</dt><dd>${esc(nombre(d, insp.asignada_a))}</dd>
      <dt>Por</dt><dd>${esc(nombre(d, insp.asignada_por))}</dd>
      <dt>Para el</dt><dd>${esc(fechaCorta(insp.vence))}</dd>
      ${insp.repetir_dias ? `<dt>Se repite</dt><dd>cada ${insp.repetir_dias === 1 ? "día" : `${insp.repetir_dias} días`}</dd>` : ""}
      ${insp.estado === "hecha" ? `<dt>Hecha por</dt><dd>${esc(nombre(d, insp.hecha_por))}</dd><dt>El</dt><dd>${esc(fechaHora(insp.hecha_en))}</dd>` : ""}
    </dl>${insp.nota ? `<p class="nota-asignacion" style="margin-top:14px">${esc(insp.nota)}</p>` : ""}`;
}

/** ¿El valor medido se sale del rango? null si no hay valor o no hay rango. */
export function fueraDeRango(item, valor) {
  if (valor == null || valor === "" || !Number.isFinite(Number(valor))) return null;
  const v = Number(valor);
  if (item.min == null && item.max == null) return null;
  return (item.min != null && v < item.min) || (item.max != null && v > item.max);
}
export function textoRango(item) {
  const u = item.unidad ? ` ${item.unidad}` : "";
  if (item.min != null && item.max != null) return `Rango: ${numero(item.min, 2)}–${numero(item.max, 2)}${u}`;
  if (item.max != null) return `Máximo: ${numero(item.max, 2)}${u}`;
  if (item.min != null) return `Mínimo: ${numero(item.min, 2)}${u}`;
  return "Sin rango definido todavía";
}

function llenar({ d, yo, hoy, dibujar, ir }, insp) {
  const pl = plantilla(d, insp.plantilla_id);
  const items = pl?.items ?? [];
  const ingeniero = d.personas.find((p) => p.rol === "ingeniero");
  const guardado = api.borrador.leer(insp.id);
  // estado de lo que se va llenando: item_id → respuesta
  const R = guardado?.respuestas ?? {};
  for (const it of items) R[it.id] ??= { resultado: null, valor: "", texto: "", fotos: [], hallazgo: null, manual: false };
  const guardar = () => api.borrador.guardar(insp.id, { respuestas: R });
  const esMia = insp.asignada_a === yo.id;

  const htmlHallazgo = (it, r) => {
    if (r.resultado !== "mal") return "";
    const h = (r.hallazgo ??= {
      id: crypto.randomUUID(),
      descripcion: "",
      prioridad: "media",
      accion: "",
      responsable_id: yo.rol === "ingeniero" ? yo.id : ingeniero?.id ?? yo.id,
    });
    return `<div class="subhallazgo">
      <p>${icono("hallazgos")}Se anota como hallazgo</p>
      <div class="campo"><label for="hd-${esc(it.id)}">Qué se encontró</label>
        <textarea id="hd-${esc(it.id)}" data-h="descripcion" placeholder="${esc(sugerenciaHallazgo(it, r))}">${esc(h.descripcion)}</textarea>
        ${hayDictado ? `<div><button type="button" class="boton chico" data-dictar="hd-${esc(it.id)}">${icono("microfono")}Dictar</button></div>` : ""}</div>
      <div class="campo"><span class="rotulo" id="hp-${esc(it.id)}">Prioridad</span>
        <div class="segmento" role="group" aria-labelledby="hp-${esc(it.id)}">${["alta", "media", "baja"].map((p) => `<button type="button" data-prioridad="${p}" data-valor="${p}" aria-pressed="${h.prioridad === p}">${p === "alta" ? "Alta" : p === "media" ? "Media" : "Baja"}</button>`).join("")}</div></div>
      <div class="rejilla-campos dos">
        <div class="campo"><label for="ha-${esc(it.id)}">Qué hay que hacer <span style="font-weight:400;color:var(--tinta-3)">(opcional)</span></label>
          <input id="ha-${esc(it.id)}" type="text" data-h="accion" value="${esc(h.accion)}" placeholder="Por ejemplo: gestionar el reemplazo"></div>
        <div class="campo"><label for="hr-${esc(it.id)}">A cargo de</label>
          <select id="hr-${esc(it.id)}" data-h="responsable_id">${d.personas.map((p) => `<option value="${esc(p.id)}" ${p.id === h.responsable_id ? "selected" : ""}>${esc(p.rol === "jefe" ? p.turno : p.nombre)}</option>`).join("")}</select></div>
      </div>
    </div>`;
  };

  const htmlItem = (it, k) => {
    const r = R[it.id];
    const id = esc(it.id);
    let control = "";
    if (it.tipo === "ok" || it.tipo === "medida") {
      const seg = `<div class="segmento" role="group" aria-label="Resultado">
        <button type="button" data-resultado="ok" data-valor="ok" aria-pressed="${r.resultado === "ok"}">${icono("bien")}Bien</button>
        <button type="button" data-resultado="mal" data-valor="mal" aria-pressed="${r.resultado === "mal"}">${icono("mal")}${it.tipo === "medida" ? "Problema" : "Mal"}</button>
        <button type="button" data-resultado="na" data-valor="na" aria-pressed="${r.resultado === "na"}">${icono("na")}No aplica</button></div>`;
      if (it.tipo === "medida") {
        const fuera = fueraDeRango(it, r.valor);
        control = `<div class="medida">
            <div class="con-unidad"><label class="oculto" for="v-${id}">Valor medido</label>
              <input id="v-${id}" type="text" inputmode="decimal" autocomplete="off" data-valor-de="${id}" value="${esc(r.valor)}" placeholder="0">
              ${it.unidad ? `<span class="unidad">${esc(it.unidad)}</span>` : ""}</div>
            <span class="rango${fuera ? " fuera" : ""}" data-rango="${id}">${fuera ? `Fuera de rango · ` : ""}${esc(textoRango(it))}${it.tipico && it.min == null && it.max == null ? "" : it.tipico ? " (típico)" : ""}</span>
          </div>${seg}`;
      } else control = seg;
    }
    return `<li class="item" data-item="${id}" id="item-${id}">
      <div class="item-cabeza"><h3>${esc(it.texto)}</h3></div>
      ${it.ayuda ? `<p class="ayuda">${esc(it.ayuda)}</p>` : ""}
      ${control}
      <div class="campo"><label class="oculto" for="t-${id}">Nota</label>
        <textarea id="t-${id}" data-texto-de="${id}" placeholder="${it.tipo === "texto" ? "Escribe o dicta…" : "Nota (opcional)"}" ${it.tipo === "texto" ? "" : 'style="min-height:58px"'}>${esc(r.texto)}</textarea></div>
      <div class="herramientas-item">
        ${botonesMedio(it.id)}
        ${hayDictado ? `<button type="button" class="boton chico" data-dictar="t-${id}">${icono("microfono")}Dictar</button>` : ""}
        ${it.foto === "siempre" ? `<span class="tipico" style="align-self:center">Lleva foto</span>` : it.foto === "pedir" && !r.fotos.length ? `<span style="align-self:center;color:var(--tinta-3);font-size:14px">Una foto ayuda</span>` : ""}
      </div>
      <div data-galeria="${id}">${galeria(r.fotos, { quitar: true })}</div>
      <div data-zona-hallazgo="${id}">${htmlHallazgo(it, r)}</div>
    </li>`;
  };

  const avance = () => {
    const cuentan = items.filter((it) => it.tipo !== "texto");
    const hechos = cuentan.filter((it) => R[it.id].resultado).length;
    const mal = cuentan.filter((it) => R[it.id].resultado === "mal").length;
    return { hechos, total: cuentan.length, mal };
  };

  return {
    titulo: pl?.nombre ?? "Inspección",
    tituloCorto: equipo(d, insp.equipo_id)?.nombre ?? "Inspección",
    atras: "#/inspecciones",
    viva: false,
    html: `${cabeceraInspeccion(d, insp, hoy)}
      <div class="hoja-insp">
        <div>
          ${!esMia ? `<p class="nota-asignacion" style="margin-bottom:12px">Está asignada a ${esc(nombreCorto(d, insp.asignada_a))}. Si la llenas tú, queda a tu nombre.</p>` : ""}
          ${guardado ? `<p class="nota-asignacion" style="margin-bottom:12px">Seguiste donde la dejaste (${esc(fechaHora(guardado.guardado))}).</p>` : ""}
          ${items.length ? `<ol class="items">${items.map(htmlItem).join("")}</ol>` : vacio("Esta plantilla no tiene revisiones. Edítala en Equipos.")}
          <div class="pie-fijo vidrio">
            <div class="avance" aria-live="polite"><span data-avance></span><div class="barra-avance"><i data-barra style="width:0"></i></div></div>
            <button type="button" class="boton primario" data-accion="terminar">${icono("bien")}Terminar</button>
          </div>
        </div>
        <aside class="panel">${datosInspeccion(d, insp)}
          ${yo.rol === "ingeniero" ? `<div class="herramientas-item"><button type="button" class="boton chico" data-accion="avisar">${icono("whatsapp")}Avisar</button>
            <button type="button" class="boton chico peligro" data-accion="borrar">${icono("basura")}Borrar</button></div>` : ""}
        </aside>
      </div>`,
    montar(m) {
      const pintarAvance = () => {
        const a = avance();
        m.querySelector("[data-avance]").innerHTML = `<b>${a.hechos} de ${a.total}</b><span class="largo"> revisadas</span>${a.mal ? ` · ${plural(a.mal, "hallazgo", "hallazgos")}` : ""}`;
        m.querySelector("[data-barra]").style.width = `${a.total ? (100 * a.hechos) / a.total : 100}%`;
      };
      const repintarItem = (itemId, foco) => {
        const it = items.find((x) => x.id === itemId);
        const li = m.querySelector(`[data-item="${CSS.escape(itemId)}"]`);
        const k = items.indexOf(it);
        li.outerHTML = htmlItem(it, k);
        if (foco) m.querySelector(`[data-item="${CSS.escape(itemId)}"] ${foco}`)?.focus();
        pintarAvance();
      };
      pintarAvance();

      let parar = null;
      m.addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        const li = b.closest("[data-item]");
        const itemId = li?.dataset.item;
        if (b.dataset.resultado) {
          const r = R[itemId];
          r.resultado = r.resultado === b.dataset.resultado ? null : b.dataset.resultado;
          r.manual = true;
          if (r.resultado !== "mal") r.hallazgo = r.hallazgo && (r.hallazgo.descripcion || r.hallazgo.accion) ? r.hallazgo : null;
          guardar();
          repintarItem(itemId, `[data-resultado="${b.dataset.resultado}"]`);
          li.classList.remove("falta");
        } else if (b.dataset.prioridad) {
          R[itemId].hallazgo.prioridad = b.dataset.prioridad;
          guardar();
          b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        } else if (b.dataset.quitar) {
          const r = R[itemId];
          r.fotos = r.fotos.filter((x) => x !== b.dataset.quitar);
          guardar();
          m.querySelector(`[data-galeria="${CSS.escape(itemId)}"]`).innerHTML = galeria(r.fotos, { quitar: true });
        } else if (b.dataset.dictar) {
          if (parar) { parar(); parar = null; return; }
          const campo = m.querySelector(`#${CSS.escape(b.dataset.dictar)}`);
          parar = dictar(campo, {
            alEmpezar: () => { b.innerHTML = `${icono("microfono")}Escuchando… toca para parar`; },
            alTerminar: () => { b.innerHTML = `${icono("microfono")}Dictar`; parar = null; },
            alError: (t) => aviso(t, { error: true }),
          });
        } else if (b.dataset.accion === "terminar") terminar(b);
        else if (b.dataset.accion === "avisar") abrirWhatsApp(mensajeAsignacion(d, insp));
        else if (b.dataset.accion === "borrar") {
          if (!(await confirmar("¿Borrar esta inspección?", "Se quita de la lista de quien la tiene asignada.", "Borrar", "peligro"))) return;
          try {
            await api.escribir(`inspecciones/${encodeURIComponent(insp.id)}/borrar`, {});
            api.borrador.borrar(insp.id);
            aviso("Inspección borrada.");
            ir("#/inspecciones");
          } catch (x) {
            aviso(x.sinRed ? "Para borrar hace falta señal." : x.message, { error: true });
          }
        }
      });

      m.addEventListener("input", (e) => {
        const t = e.target;
        if (t.dataset.textoDe) { R[t.dataset.textoDe].texto = t.value; guardar(); return; }
        if (t.dataset.h) {
          const itemId = t.closest("[data-item]").dataset.item;
          R[itemId].hallazgo[t.dataset.h] = t.value;
          guardar();
          return;
        }
        if (t.dataset.valorDe) {
          const itemId = t.dataset.valorDe;
          const it = items.find((x) => x.id === itemId);
          const r = R[itemId];
          t.value = t.value.replace(",", ".").replace(/[^\d.\-]/g, "");
          r.valor = t.value;
          const fuera = fueraDeRango(it, r.valor);
          const antes = r.resultado;
          if (!r.manual || antes == null) r.resultado = r.valor === "" ? null : fuera ? "mal" : "ok";
          if (fuera && r.resultado === "ok" && !r.manual) r.resultado = "mal";
          guardar();
          const rango = m.querySelector(`[data-rango="${CSS.escape(itemId)}"]`);
          rango.className = `rango${fuera ? " fuera" : ""}`;
          rango.textContent = `${fuera ? "Fuera de rango · " : ""}${textoRango(it)}${it.tipico && (it.min != null || it.max != null) ? " (típico)" : ""}`;
          if (r.resultado !== antes) {
            const li = t.closest("[data-item]");
            li.querySelectorAll("[data-resultado]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.resultado === r.resultado)));
            if (r.resultado !== "mal" && r.hallazgo && !r.hallazgo.descripcion) r.hallazgo = null;
            m.querySelector(`[data-zona-hallazgo="${CSS.escape(itemId)}"]`).innerHTML = htmlHallazgo(it, r);
            li.classList.remove("falta");
            pintarAvance();
          }
        }
      });

      m.addEventListener("change", async (e) => {
        const t = e.target;
        if (t.dataset.h === "responsable_id") {
          R[t.closest("[data-item]").dataset.item].hallazgo.responsable_id = t.value;
          guardar();
        }
        if (t.dataset.medioDe && t.files?.length) {
          const itemId = t.dataset.medioDe;
          const archivos = [...t.files];
          t.value = "";
          for (const a of archivos) {
            try {
              const listo = await prepararArchivo(a);
              const id = await api.guardarMedio(listo, a.name);
              R[itemId].fotos.push(id);
              guardar();
              m.querySelector(`[data-galeria="${CSS.escape(itemId)}"]`).innerHTML = galeria(R[itemId].fotos, { quitar: true });
            } catch (x) {
              aviso(x.message, { error: true });
            }
          }
        }
      });

      async function terminar(boton) {
        const faltan = [];
        for (const it of items) {
          const r = R[it.id];
          let falta = false;
          if (it.tipo !== "texto" && !r.resultado) falta = true;
          if (it.tipo === "medida" && r.resultado && r.resultado !== "na" && r.valor === "") falta = true;
          if (it.foto === "siempre" && r.resultado !== "na" && !r.fotos.length) falta = true;
          m.querySelector(`[data-item="${CSS.escape(it.id)}"]`)?.classList.toggle("falta", falta);
          if (falta) faltan.push(it);
        }
        if (faltan.length) {
          aviso(`Falta${faltan.length === 1 ? "" : "n"} ${plural(faltan.length, "revisión", "revisiones")}: están marcadas en rojo.`, { error: true });
          m.querySelector(`[data-item="${CSS.escape(faltan[0].id)}"]`)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
          return;
        }
        const hallazgos = items
          .filter((it) => R[it.id].resultado === "mal")
          .map((it) => {
            const r = R[it.id];
            return { ...r.hallazgo, item: it.texto, descripcion: (r.hallazgo?.descripcion || sugerenciaHallazgo(it, r)).trim(), fotos: r.fotos };
          });
        const ok = await dialogo({
          titulo: "¿Terminar la inspección?",
          html: `<p>${plural(avance().total, "revisión", "revisiones")}${hallazgos.length ? `, con ${plural(hallazgos.length, "hallazgo", "hallazgos")}` : ", todo bien"}. Después no se puede cambiar.</p>`,
          botones: [{ texto: "Seguir revisando", valor: false }, { texto: "Terminar", valor: true, clase: "primario" }],
        });
        if (!ok) return;
        boton.disabled = true;
        const respuestas = items.map((it) => {
          const r = R[it.id];
          return { item_id: it.id, resultado: it.tipo === "texto" ? (r.texto ? "ok" : null) : r.resultado, valor: r.valor === "" ? null : Number(r.valor), texto: r.texto, fotos: r.fotos };
        });
        try {
          // se guarda en el aparato y se intenta mandar; se espera hasta 8 s para poder decir si ya llegó
          const envio = api.encolar(`inspecciones/${encodeURIComponent(insp.id)}/hecha`, { hecha_en: new Date().toISOString(), respuestas, hallazgos });
          await Promise.race([envio, new Promise((ok) => setTimeout(ok, 8000))]);
        } catch (x) {
          boton.disabled = false;
          aviso(`No se pudo guardar: ${x.message}`, { error: true });
          return;
        }
        api.borrador.borrar(insp.id);
        const enviado = !api.cola.pendientes.some((p) => p.ruta?.includes(insp.id));
        const resumen = resumenWhatsApp(d, insp, items, respuestas, hallazgos, yo);
        const r = await dialogo({
          titulo: "Inspección terminada",
          html: `<p>${enviado ? "Ya llegó al servidor." : "No hay señal: quedó guardada en este aparato y se envía sola cuando vuelva la conexión."}${hallazgos.length ? ` Se anotaron ${plural(hallazgos.length, "hallazgo", "hallazgos")}.` : ""}</p>`,
          botones: [{ texto: "Avisar por WhatsApp", valor: "wa", icono: "whatsapp" }, { texto: "Ver el resumen", valor: "ver", clase: "primario" }],
        });
        if (r === "wa") abrirWhatsApp(resumen);
        dibujar({ forzar: true });
      }
      return () => parar?.();
    },
  };
}

function sugerenciaHallazgo(it, r) {
  if (it.tipo === "medida" && r.valor !== "") {
    const u = it.unidad ? ` ${it.unidad}` : "";
    const lim = it.max != null && Number(r.valor) > it.max ? ` (máximo ${numero(it.max, 2)}${u})` : it.min != null && Number(r.valor) < it.min ? ` (mínimo ${numero(it.min, 2)}${u})` : "";
    return `${it.texto}: ${numero(Number(r.valor), 2)}${u}${lim}`;
  }
  return r.texto ? `${it.texto}: ${r.texto}` : it.texto;
}

function resumenWhatsApp(d, insp, items, respuestas, hallazgos, yo) {
  const eq = equipo(d, insp.equipo_id), pl = plantilla(d, insp.plantilla_id);
  const lineas = [`Inspección hecha: ${eq?.nombre} · ${pl?.nombre} (${yo.rol === "jefe" ? yo.turno : yo.nombre})`];
  if (!hallazgos.length) lineas.push("Todo bien.");
  for (const h of hallazgos) lineas.push(`⚠ ${h.descripcion} — prioridad ${h.prioridad}${h.accion ? `. Acción: ${h.accion}` : ""}`);
  const medidas = items.filter((it) => it.tipo === "medida").map((it) => {
    const r = respuestas.find((x) => x.item_id === it.id);
    return r?.valor != null ? `${it.texto}: ${numero(r.valor, 2)} ${it.unidad ?? ""}`.trim() : null;
  }).filter(Boolean);
  if (medidas.length) lineas.push("", ...medidas);
  lineas.push("", `${location.origin}${location.pathname}#/inspeccion/${encodeURIComponent(insp.id)}`);
  return lineas.join("\n");
}

// ------------------------------------------------------------------------------- una inspección hecha

function verHecha({ d, hoy }, insp) {
  const items = insp.items ?? plantilla(d, insp.plantilla_id)?.items ?? [];
  const resp = new Map((insp.respuestas ?? []).map((r) => [r.item_id, r]));
  const hallazgos = d.hallazgos.filter((h) => h.inspeccion_id === insp.id);
  const fila = (it) => {
    const r = resp.get(it.id) ?? {};
    const fuera = it.tipo === "medida" && fueraDeRango(it, r.valor);
    const res = it.tipo === "texto" ? "" : r.resultado === "ok" ? `<span class="marca ok">${icono("bien")}Bien</span>`
      : r.resultado === "mal" ? `<span class="marca alta">${icono("mal")}${it.tipo === "medida" ? "Problema" : "Mal"}</span>`
      : r.resultado === "na" ? `<span class="marca">${icono("na")}No aplica</span>` : `<span class="marca">Sin dato</span>`;
    const valor = it.tipo === "medida" && r.valor != null ? `<span style="${fuera ? "color:var(--rojo)" : ""}">${numero(r.valor, 2)} ${esc(it.unidad ?? "")}</span>` : "";
    return `<li><span class="que">${esc(it.texto)}</span><span class="valor">${valor} ${res}</span>
      ${r.texto ? `<p class="nota">${esc(r.texto)}</p>` : ""}${galeria(r.fotos ?? [])}</li>`;
  };
  const resumen = `${plural(items.filter((i) => i.tipo !== "texto").length, "revisión", "revisiones")}, ${hallazgos.length ? plural(hallazgos.length, "hallazgo", "hallazgos") : "sin hallazgos"}`;
  return {
    titulo: plantilla(d, insp.plantilla_id)?.nombre ?? "Inspección",
    tituloCorto: equipo(d, insp.equipo_id)?.nombre ?? "Inspección",
    atras: "#/inspecciones",
    html: `${cabeceraInspeccion(d, insp, hoy)}
      <div class="hoja-insp">
        <div>
          <p style="margin:0 4px 12px;color:var(--tinta-3)">${resumen}.</p>
          <ul class="resultados">${items.map(fila).join("")}</ul>
          ${hallazgos.length ? `<section class="seccion"><h2>Hallazgos</h2><ul class="lista">${hallazgos.map((h) => `<li><a class="fila" href="#/hallazgo/${encodeURIComponent(h.id)}">
            <span class="titulo">${esc(h.descripcion)}</span><span class="detalle">${h.responsable_id ? `A cargo: ${esc(nombreCorto(d, h.responsable_id))}` : ""}</span>
            <span class="lado">${marcaPrioridad(h.prioridad)}</span></a></li>`).join("")}</ul></section>` : ""}
        </div>
        <aside class="panel">${datosInspeccion(d, insp)}
          <a class="boton" href="#/reporte/${encodeURIComponent(insp.id)}">${icono("imprimir")}Reporte para imprimir</a>
        </aside>
      </div>`,
  };
}
