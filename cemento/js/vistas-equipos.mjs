// Equipos y plantillas: qué se revisa en cada equipo, cada cuánto, con qué rango; y cómo vienen sus medidas.
import { esc, icono, fechaCorta, plural, numero, diaDe, diasEntre } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, dialogo, confirmar, vacio, equipo, plantilla, filaInspeccion, filaHallazgo } from "./ui.mjs";
import { textoRango, fueraDeRango } from "./vistas-inspecciones.mjs";

export function vistaEquipos({ d, yo, hoy, dibujar }) {
  const esIng = yo.rol === "ingeniero";
  return {
    titulo: "Equipos",
    html: `<div class="cabeza"><div><h1>Equipos</h1>
        <p class="bajada">Cada uno con sus plantillas de inspección: qué revisar, cada cuánto y con qué rango.</p></div>
        ${esIng ? `<div class="acciones"><button class="boton" data-accion="nuevo-equipo">${icono("mas1")}Agregar equipo</button></div>` : ""}</div>
      <div class="equipos-rejilla">${d.equipos.map((e) => {
        const ps = d.plantillas.filter((p) => p.equipo_id === e.id);
        const abiertos = d.hallazgos.filter((h) => h.equipo_id === e.id && h.estado !== "cerrado");
        const ultima = d.inspecciones.filter((i) => i.equipo_id === e.id && i.estado === "hecha").sort((a, b) => (b.hecha_en ?? "").localeCompare(a.hecha_en ?? ""))[0];
        const atrasadas = d.inspecciones.filter((i) => i.equipo_id === e.id && i.estado === "pendiente" && i.vence < hoy).length;
        const partes = [];
        partes.push(ultima ? `Última inspección: hace ${diasEntre(diaDe(ultima.hecha_en), hoy) || "menos de 1"} ${diasEntre(diaDe(ultima.hecha_en), hoy) === 1 ? "día" : "días"}` : "Sin inspecciones todavía");
        if (atrasadas) partes.push(`<b style="color:var(--rojo)">${plural(atrasadas, "atrasada", "atrasadas")}</b>`);
        if (abiertos.length) partes.push(`${plural(abiertos.length, "hallazgo abierto", "hallazgos abiertos")}`);
        return `<a class="equipo" href="#/equipo/${encodeURIComponent(e.id)}">
          <span class="area">${esc(e.area ?? "")}</span><h2>${esc(e.nombre)}</h2>
          <span class="estado-equipo">${partes.join(" · ")}</span>
          <span class="estado-equipo" style="color:var(--tinta-3)">${plural(ps.length, "plantilla", "plantillas")}</span></a>`;
      }).join("")}</div>`,
    montar(m) {
      m.querySelector('[data-accion="nuevo-equipo"]')?.addEventListener("click", () => editarEquipo(null, dibujar));
    },
  };
}

async function editarEquipo(eq, dibujar) {
  let datos = null;
  const r = await dialogo({
    titulo: eq ? "Editar el equipo" : "Agregar un equipo",
    html: `<div class="rejilla-campos">
      <div class="campo"><label for="e-nombre">Nombre</label><input id="e-nombre" type="text" value="${esc(eq?.nombre ?? "")}" placeholder="Por ejemplo: Ventilador de tiro"></div>
      <div class="campo"><label for="e-area">Área</label><input id="e-area" type="text" value="${esc(eq?.area ?? "")}" placeholder="Por ejemplo: Clinkerización"></div>
      <div class="campo"><label for="e-nota">Nota</label><input id="e-nota" type="text" value="${esc(eq?.nota ?? "")}"></div></div>`,
    botones: [{ texto: "Cancelar", valor: null }, {
      texto: "Guardar", clase: "primario", valor: "guardar",
      alElegir: (velo) => {
        const n = velo.querySelector("#e-nombre").value.trim();
        if (!n) { velo.querySelector("#e-nombre").focus(); return false; }
        datos = { id: eq?.id, nombre: n, area: velo.querySelector("#e-area").value, nota: velo.querySelector("#e-nota").value, orden: eq?.orden };
      },
    }],
  });
  if (r !== "guardar" || !datos) return;
  try {
    await api.escribir("equipos", datos);
    aviso(eq ? "Equipo guardado." : "Equipo agregado.");
    dibujar({ forzar: true });
  } catch (x) {
    aviso(x.sinRed ? "Para guardar un equipo hace falta señal." : x.message, { error: true });
  }
}

// ------------------------------------------------------------------------------- un equipo

export function vistaEquipo({ d, yo, hoy, param, dibujar }) {
  const eq = equipo(d, param);
  if (!eq) return { titulo: "No está", atras: "#/equipos", html: vacio("Ese equipo no existe.") };
  const esIng = yo.rol === "ingeniero";
  const ps = d.plantillas.filter((p) => p.equipo_id === eq.id);
  const hechas = d.inspecciones.filter((i) => i.equipo_id === eq.id && i.estado === "hecha").sort((a, b) => (a.hecha_en ?? "").localeCompare(b.hecha_en ?? ""));
  const pendientes = d.inspecciones.filter((i) => i.equipo_id === eq.id && i.estado === "pendiente").sort((a, b) => a.vence.localeCompare(b.vence));
  const abiertos = d.hallazgos.filter((h) => h.equipo_id === eq.id && h.estado !== "cerrado");

  // cómo vienen las medidas: cada item de tipo medida con sus valores en las inspecciones hechas
  const series = [];
  for (const p of ps) {
    for (const it of p.items.filter((x) => x.tipo === "medida")) {
      const puntos = hechas
        .filter((i) => i.plantilla_id === p.id)
        .map((i) => ({ fecha: i.hecha_en, valor: (i.respuestas ?? []).find((r) => r.item_id === it.id)?.valor }))
        .filter((x) => x.valor != null);
      if (puntos.length) series.push({ it, puntos });
    }
  }
  return {
    titulo: eq.nombre,
    atras: "#/equipos",
    html: `<div class="cabeza"><div><div class="migas">${esc(eq.area ?? "")}</div><h1>${esc(eq.nombre)}</h1>
        ${eq.nota ? `<p class="bajada">${esc(eq.nota)}</p>` : ""}</div>
        <div class="acciones">${esIng ? `<a class="boton primario" href="#/asignar?equipo=${encodeURIComponent(eq.id)}">${icono("mas1")}Asignar</a>` : ""}
          <a class="boton" href="#/nuevo-hallazgo?equipo=${encodeURIComponent(eq.id)}">${icono("hallazgos")}Hallazgo</a>
          ${esIng ? `<button class="boton plano" data-accion="editar-equipo">Editar</button>` : ""}</div></div>
      <section class="seccion"><h2>Plantillas <small>${ps.length || ""}</small></h2>
        ${ps.length ? `<ul class="lista">${ps.map((p) => `<li><a class="fila" href="#/plantilla/${encodeURIComponent(p.id)}">
          <span class="titulo">${esc(p.nombre)} <small>· ${p.cuando === "parada" ? "en parada" : "en marcha"}</small></span>
          <span class="detalle"><span>${plural(p.items.length, "revisión", "revisiones")}</span><span>${p.frecuencia_dias ? `cada ${p.frecuencia_dias === 1 ? "día" : `${p.frecuencia_dias} días`}` : "sin frecuencia"}</span>
            ${p.items.some((x) => x.tipico) ? `<span class="tipico">rangos típicos por confirmar</span>` : ""}</span>
          <span class="lado" style="color:var(--tinta-3)">${icono("derecha", "ico")}</span></a></li>`).join("")}</ul>` : vacio("Todavía no tiene plantillas.")}
        ${esIng ? `<p style="margin:10px 4px"><a class="boton chico" href="#/plantilla/nueva?equipo=${encodeURIComponent(eq.id)}">${icono("mas1")}Nueva plantilla</a></p>` : ""}
      </section>
      ${series.length ? `<section class="seccion"><h2>Cómo vienen las medidas</h2><div class="lista">${series.map(({ it, puntos }) => grafiquito(it, puntos)).join("")}</div></section>` : ""}
      ${pendientes.length ? `<section class="seccion"><h2>Pendientes <small>${pendientes.length}</small></h2><ul class="lista">${pendientes.map((i) => filaInspeccion(d, i, hoy)).join("")}</ul></section>` : ""}
      ${abiertos.length ? `<section class="seccion"><h2>Hallazgos abiertos <small>${abiertos.length}</small></h2><ul class="lista">${abiertos.map((h) => filaHallazgo(d, h, hoy)).join("")}</ul></section>` : ""}
      ${hechas.length ? `<section class="seccion"><h2>Inspecciones hechas <small>${hechas.length}</small></h2><ul class="lista">${[...hechas].reverse().slice(0, 12).map((i) => filaInspeccion(d, i, hoy)).join("")}</ul></section>` : ""}`,
    montar(m) {
      m.querySelector('[data-accion="editar-equipo"]')?.addEventListener("click", () => editarEquipo(eq, dibujar));
    },
  };
}

/** Línea chica de una medida en el tiempo, con su rango y el último valor. Escala propia, rotulada con mín y máx. */
function grafiquito(it, puntos) {
  const W = 150, H = 40, p = 4;
  const vals = puntos.map((x) => x.valor);
  const lim = [it.min, it.max].filter((v) => v != null);
  const lo = Math.min(...vals, ...lim), hi = Math.max(...vals, ...lim);
  const span = hi - lo || Math.abs(hi) || 1;
  const y = (v) => H - p - ((v - lo) / span) * (H - 2 * p);
  const x = (k) => (puntos.length === 1 ? W / 2 : p + (k * (W - 2 * p)) / (puntos.length - 1));
  const linea = puntos.map((q, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(q.valor).toFixed(1)}`).join("");
  const banda = it.min != null || it.max != null
    ? `<rect x="0" width="${W}" y="${y(it.max ?? hi).toFixed(1)}" height="${Math.max(1, y(it.min ?? lo) - y(it.max ?? hi)).toFixed(1)}" fill="#34c75922"/>`
    : "";
  const ult = puntos.at(-1);
  const fuera = fueraDeRango(it, ult.valor);
  const rango = puntos.length > 1 ? `${plural(puntos.length, "medida", "medidas")}, de ${numero(Math.min(...vals), 2)} a ${numero(Math.max(...vals), 2)}` : "una sola medida: con la próxima se ve hacia dónde va";
  const dibujo = puntos.length < 2 ? `<span></span>` : `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${it.texto}: ${vals.map((v) => numero(v, 2)).join(", ")}`)}">${banda}
      <path d="${linea}" fill="none" stroke="${fuera ? "#d70015" : "#0a64d6"}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${puntos.map((q, k) => `<circle cx="${x(k).toFixed(1)}" cy="${y(q.valor).toFixed(1)}" r="${k === puntos.length - 1 ? 3.2 : 2}" fill="${fueraDeRango(it, q.valor) ? "#d70015" : "#0a64d6"}"/>`).join("")}</svg>`;
  return `<div class="tendencia">
    <div><div style="font-weight:600">${esc(it.texto)}</div><div style="font-size:14px;color:var(--tinta-3)">${esc(textoRango(it))} · ${rango}</div></div>
    ${dibujo}
    <div style="text-align:right"><div style="font:700 20px var(--titulo);${fuera ? "color:var(--rojo)" : ""}">${numero(ult.valor, 2)}</div><div style="font-size:13px;color:var(--tinta-3)">${esc(it.unidad ?? "")} · ${esc(fechaCorta(diaDe(ult.fecha)))}</div></div>
  </div>`;
}

// ------------------------------------------------------------------------------- editar una plantilla

const TIPOS = [["ok", "Bien / mal"], ["medida", "Medida (número)"], ["texto", "Texto libre"]];
const FOTO = [["", "Sin foto"], ["pedir", "Sugerir foto"], ["siempre", "Foto obligatoria"]];

export function vistaPlantilla({ d, yo, param, query, ir }) {
  const nueva = param === "nueva";
  const original = nueva ? null : plantilla(d, param);
  if (!nueva && !original) return { titulo: "No está", atras: "#/equipos", html: vacio("Esa plantilla no existe.") };
  const eqId = original?.equipo_id ?? query.get("equipo") ?? d.equipos[0]?.id;
  const eq = equipo(d, eqId);
  const esIng = yo.rol === "ingeniero";
  const P = structuredClone(original ?? { equipo_id: eqId, nombre: "", cuando: "marcha", frecuencia_dias: 7, items: [{ id: `item-${Date.now()}`, tipo: "ok", texto: "", ayuda: "", foto: "" }] });
  const htmlItem = (it, k) => `<li class="editor-item" data-k="${k}">
      <div class="rejilla-campos dos">
        <div class="campo"><label for="i-t-${k}">Qué se revisa</label><input id="i-t-${k}" type="text" data-c="texto" value="${esc(it.texto)}" ${esIng ? "" : "disabled"}></div>
        <div class="campo"><label for="i-tipo-${k}">Cómo se contesta</label><select id="i-tipo-${k}" data-c="tipo" ${esIng ? "" : "disabled"}>${TIPOS.map(([v, t]) => `<option value="${v}" ${it.tipo === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      </div>
      ${it.tipo === "medida" ? `<div class="rejilla-campos" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="campo"><label for="i-u-${k}">Unidad</label><input id="i-u-${k}" type="text" data-c="unidad" value="${esc(it.unidad ?? "")}" ${esIng ? "" : "disabled"}></div>
        <div class="campo"><label for="i-min-${k}">Mínimo</label><input id="i-min-${k}" type="text" inputmode="decimal" data-c="min" value="${esc(it.min ?? "")}" ${esIng ? "" : "disabled"}></div>
        <div class="campo"><label for="i-max-${k}">Máximo</label><input id="i-max-${k}" type="text" inputmode="decimal" data-c="max" value="${esc(it.max ?? "")}" ${esIng ? "" : "disabled"}></div>
      </div>${it.tipico ? `<p class="tipico">Rango típico de libro: confírmalo o cámbialo por el de la planta.</p>` : it.min == null && it.max == null ? `<p class="ayuda" style="margin:0;color:var(--tinta-3);font-size:14px">Sin rango: no se marca solo cuando se sale. Ponle uno cuando lo tengas.</p>` : ""}` : ""}
      <div class="rejilla-campos dos">
        <div class="campo"><label for="i-a-${k}">Ayuda para quien revisa</label><input id="i-a-${k}" type="text" data-c="ayuda" value="${esc(it.ayuda ?? "")}" ${esIng ? "" : "disabled"}></div>
        ${it.tipo !== "texto" ? `<div class="campo"><label for="i-f-${k}">Foto</label><select id="i-f-${k}" data-c="foto" ${esIng ? "" : "disabled"}>${FOTO.map(([v, t]) => `<option value="${v}" ${(it.foto ?? "") === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>` : ""}
      </div>
      ${esIng ? `<div class="mover">
        <button type="button" class="boton chico plano" data-mover="-1" ${k === 0 ? "disabled" : ""} aria-label="Subir">${icono("arriba")}</button>
        <button type="button" class="boton chico plano" data-mover="1" ${k === P.items.length - 1 ? "disabled" : ""} aria-label="Bajar">${icono("abajo")}</button>
        <button type="button" class="boton chico peligro" data-quitar-item aria-label="Quitar esta revisión">${icono("basura")}</button></div>` : ""}
    </li>`;
  return {
    titulo: nueva ? "Nueva plantilla" : P.nombre,
    tituloCorto: eq?.nombre ?? "Plantilla",
    atras: `#/equipo/${encodeURIComponent(eqId)}`,
    viva: false,
    html: `<div class="cabeza"><div><div class="migas"><a href="#/equipo/${encodeURIComponent(eqId)}">${esc(eq?.nombre ?? "")}</a></div>
        <h1>${nueva ? "Nueva plantilla" : esc(P.nombre)}</h1>
        <p class="bajada">${esIng ? "Los cambios valen para las inspecciones que se hagan desde ahora; las hechas guardan cómo eran." : "Solo el ingeniero de procesos cambia las plantillas."}</p></div></div>
      <form id="form-pl" novalidate>
        <div class="panel" style="margin-bottom:16px"><div class="rejilla-campos dos">
          <div class="campo"><label for="p-nombre">Nombre</label><input id="p-nombre" type="text" value="${esc(P.nombre)}" placeholder="Por ejemplo: Ronda en marcha" ${esIng ? "" : "disabled"}></div>
          <div class="campo"><label for="p-cuando">Cuándo se hace</label><select id="p-cuando" ${esIng ? "" : "disabled"}>
            <option value="marcha" ${P.cuando !== "parada" ? "selected" : ""}>Con el equipo en marcha</option>
            <option value="parada" ${P.cuando === "parada" ? "selected" : ""}>Con el equipo parado</option></select></div>
          <div class="campo"><label for="p-frec">Cada cuántos días (sugerido)</label><input id="p-frec" type="number" min="1" max="365" value="${esc(P.frecuencia_dias ?? "")}" ${esIng ? "" : "disabled"}>
            <span class="ayuda">Es lo que se propone al asignarla. Ajústalo con lo que vayas viendo.</span></div>
        </div></div>
        <h2 style="margin:0 4px 10px">Revisiones</h2>
        <ol class="editor-items">${P.items.map(htmlItem).join("")}</ol>
        ${esIng ? `<div class="atajos" style="margin-top:14px"><button type="button" class="boton" data-accion="agregar">${icono("mas1")}Agregar revisión</button></div>
        <div class="pie-fijo vidrio"><div class="avance" data-cambios>Sin cambios</div>
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
          it[t.dataset.c] = t.value;
          if (t.dataset.c === "min" || t.dataset.c === "max") it.tipico = false;
        }
        marcar();
      });
      f.addEventListener("change", (e) => {
        const t = e.target;
        if (t.dataset.c === "tipo") { repintar(); }
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
            ir(`#/equipo/${encodeURIComponent(eqId)}`);
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
        if (!P.nombre) { aviso("Ponle un nombre a la plantilla.", { error: true }); f["p-nombre"].focus(); return; }
        const vacios = P.items.filter((it) => !String(it.texto).trim());
        if (vacios.length) { aviso("Hay revisiones sin nombre: escríbelo o quítalas.", { error: true }); return; }
        const malos = P.items.filter((it) => it.tipo === "medida" && [it.min, it.max].some((v) => v !== "" && v != null && !Number.isFinite(Number(v))));
        if (malos.length) { aviso("Un mínimo o máximo no es un número.", { error: true }); return; }
        const b = f.querySelector("button[type=submit]");
        b.disabled = true;
        try {
          const r = await api.escribir("plantillas", { ...P, id: original?.id });
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
  };
}
