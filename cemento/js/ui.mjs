// Piezas de la interfaz que usan todas las vistas: avisos, hojas de diálogo, etiquetas de estado y las filas de las
// listas.
import { esc, icono, fechaCorta, vencimiento, haceCuanto } from "./util.mjs";
import { urlMedio } from "./api.mjs";

// ------------------------------------------------------------------------------- avisos y diálogos

let relojAviso = null;
export function aviso(texto, { error = false, ms = 3200, icono: ic = null } = {}) {
  document.querySelector(".aviso")?.remove();
  const el = document.createElement("div");
  el.className = `aviso vidrio${error ? " error" : ""}`;
  el.setAttribute("role", error ? "alert" : "status");
  el.innerHTML = `${icono(ic ?? (error ? "hallazgos" : "bien"))}<span>${esc(texto)}</span>`;
  document.body.append(el);
  clearTimeout(relojAviso);
  relojAviso = setTimeout(() => el.remove(), error ? Math.max(ms, 6000) : ms);
}

/** Hoja de diálogo. botones: [{texto, valor, clase}]. Devuelve el valor del botón (o null si se cierra). */
export function dialogo({ titulo, html = "", botones = [{ texto: "Listo", valor: true, clase: "primario" }], alMontar }) {
  return new Promise((ok) => {
    const anterior = document.activeElement;
    const velo = document.createElement("div");
    velo.className = "velo";
    velo.innerHTML = `<div class="dialogo vidrio" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">${esc(titulo)}</h2>${html}
      <div class="botones">${botones.map((b, i) => `<button type="button" class="boton ${b.clase ?? ""}" data-i="${i}">${b.icono ? icono(b.icono) : ""}${esc(b.texto)}</button>`).join("")}</div>
    </div>`;
    const cerrar = (v) => {
      velo.remove();
      removeEventListener("keydown", tecla);
      anterior?.focus?.();
      ok(v);
    };
    const tecla = (e) => e.key === "Escape" && cerrar(null);
    velo.addEventListener("click", (e) => {
      if (e.target === velo) return cerrar(null);
      const b = e.target.closest("[data-i]");
      if (b) {
        const def = botones[Number(b.dataset.i)];
        if (def.alElegir && def.alElegir(velo) === false) return;
        cerrar(def.valor);
      }
    });
    addEventListener("keydown", tecla);
    document.body.append(velo);
    alMontar?.(velo);
    (velo.querySelector("input, select, textarea") ?? velo.querySelector(".boton.primario") ?? velo.querySelector(".boton"))?.focus();
  });
}

export const confirmar = (titulo, html, si = "Sí", clase = "primario") =>
  dialogo({ titulo, html: `<p>${html}</p>`, botones: [{ texto: "Cancelar", valor: false }, { texto: si, valor: true, clase }] });

// ------------------------------------------------------------------------------- etiquetas

export const TEXTO_PRIORIDAD = { alta: "Alta", media: "Media", baja: "Baja" };
export const TEXTO_ESTADO = { abierto: "Abierto", en_proceso: "En proceso", cerrado: "Cerrado" };
const ICONO_ESTADO = { abierto: "hallazgos", en_proceso: "repetir", cerrado: "bien" };

export const marcaPrioridad = (p) => `<span class="marca ${p}">${icono(p === "baja" ? "na" : "hallazgos")}${TEXTO_PRIORIDAD[p] ?? p}</span>`;
export const marcaEstado = (e) => `<span class="marca ${e}">${icono(ICONO_ESTADO[e] ?? "na")}${TEXTO_ESTADO[e] ?? e}</span>`;
export const marcaSinEnviar = () => `<span class="marca sinenviar">${icono("nube")}Sin enviar</span>`;

export function marcaVence(insp, hoy) {
  if (insp.estado === "hecha") return `<span class="marca hecha">${icono("bien")}Hecha</span>`;
  const v = vencimiento(insp.vence, hoy);
  const ic = v.clase === "atrasada" ? "hallazgos" : "inspecciones";
  return `<span class="marca ${v.clase}">${icono(ic)}${esc(v.texto)}</span>`;
}

// ------------------------------------------------------------------------------- consultas comunes

export const persona = (d, id) => d.personas.find((p) => p.id === id);
export const nombre = (d, id) => persona(d, id)?.nombre ?? "—";
export const nombreCorto = (d, id) => {
  const p = persona(d, id);
  if (!p) return "—";
  return p.rol === "jefe" ? p.turno : p.nombre.split(" ")[0];
};
export const equipo = (d, id) => d.equipos.find((e) => e.id === id);
export const plantilla = (d, id) => d.plantillas.find((p) => p.id === id);
export const inicial = (n) => (n || "?").trim().charAt(0).toUpperCase();

// ------------------------------------------------------------------------------- filas

export function filaInspeccion(d, i, hoy, { mostrarQuien = true } = {}) {
  const eq = equipo(d, i.equipo_id), pl = plantilla(d, i.plantilla_id);
  const repetir = i.repetir_dias ? `<span>${icono("repetir", "ico chico")} cada ${i.repetir_dias === 1 ? "día" : `${i.repetir_dias} días`}</span>` : "";
  const cuando = i.estado === "hecha" ? `Hecha ${haceCuanto(i.hecha_en, hoy)} por ${esc(nombreCorto(d, i.hecha_por))}` : `Vence ${esc(fechaCorta(i.vence))}`;
  return `<li><a class="fila" href="#/inspeccion/${encodeURIComponent(i.id)}">
    <span class="titulo">${esc(eq?.nombre ?? "Equipo")} <small>· ${esc(pl?.nombre ?? "Inspección")}</small></span>
    <span class="detalle">${mostrarQuien && i.estado !== "hecha" ? `<span>${esc(nombreCorto(d, i.asignada_a))}</span>` : ""}<span>${cuando}</span>${repetir}</span>
    <span class="lado">${i._sinEnviar ? marcaSinEnviar() : marcaVence(i, hoy)}</span>
  </a></li>`;
}

export function filaHallazgo(d, h, hoy) {
  const eq = equipo(d, h.equipo_id);
  const foto = h.fotos?.[0];
  return `<li><a class="fila" href="#/hallazgo/${encodeURIComponent(h.id)}">
    <span class="titulo">${esc(h.descripcion)}</span>
    <span class="detalle"><span>${esc(eq?.nombre ?? "")}</span><span>${h.responsable_id ? `A cargo: ${esc(nombreCorto(d, h.responsable_id))}` : "Sin responsable"}</span><span>${esc(haceCuanto(h.creado, hoy))}</span></span>
    <span class="lado">${foto ? `<img class="miniatura" src="${esc(urlMedio(foto))}" alt="" loading="lazy" onerror="this.remove()">` : ""}
      ${h._sinEnviar ? marcaSinEnviar() : h.estado === "cerrado" ? marcaEstado("cerrado") : marcaPrioridad(h.prioridad)}</span>
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

/** Botones de foto: «Tomar foto» abre la cámara; «Galería» deja elegir fotos o videos guardados. */
export function botonesMedio(clave) {
  return `<label class="boton chico" role="button" tabindex="0">${icono("camara")}Foto
      <input type="file" accept="image/*" capture="environment" data-medio-de="${esc(clave)}" class="oculto"></label>
    <label class="boton chico" role="button" tabindex="0">${icono("galeria")}Galería
      <input type="file" accept="image/*,video/*" multiple data-medio-de="${esc(clave)}" class="oculto"></label>`;
}
