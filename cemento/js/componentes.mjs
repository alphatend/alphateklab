// Piezas de la interfaz con comportamiento propio, que usan varias pantallas:
// - el selector de equipo: una hoja con búsqueda (área › equipo › subequipo; los colectores aparte), porque con
//   subequipos y colectores ya son decenas y un <select> largo no sirve en el teléfono;
// - la barra de filtros (buscar y equipo; Eduardo: «que pueda filtrar por equipos y una parte de buscar»);
// - la firma con el dedo (al terminar una inspección);
// - el escáner de QR (abre el equipo, o marca «en sitio» la inspección que se está llenando).
import { esc, icono, normal } from "./util.mjs";
import { dialogo, aviso } from "./ui.mjs";

// ------------------------------------------------------------------------------- equipos

export const equipoDe = (d, id) => d.equipos.find((e) => e.id === id);
/** «Horomill › BC1 · Banda transportadora BC1», «COL-03 · Filtro principal del Loesche» o «Horomill». */
export function nombreCompleto(d, id) {
  const e = equipoDe(d, id);
  if (!e) return "Equipo";
  const propio = e.tag ? `${e.tag} · ${e.nombre}` : e.nombre;
  const padre = e.padre_id && equipoDe(d, e.padre_id);
  return padre ? `${padre.tag || padre.nombre} › ${propio}` : propio;
}
/** El equipo y sus subequipos (para filtrar: elegir «Horomill» incluye lo de su banda y su elevador). */
export const familia = (d, id) => (id ? new Set([id, ...d.equipos.filter((e) => e.padre_id === id).map((e) => e.id)]) : null);
/** ¿Algo de estos equipos cae en el filtro? (una ronda tiene varios) */
export const enFiltro = (fam, ...ids) => !fam || ids.flat().some((x) => fam.has(x));

/** Los equipos agrupados para elegir: por área (con sus subequipos debajo) y los colectores al final. */
function grupos(d, { incluirArchivados = false } = {}) {
  const vivos = d.equipos.filter((e) => incluirArchivados || e.activo);
  const arriba = vivos.filter((e) => !e.padre_id);
  const hijos = (id) => vivos.filter((e) => e.padre_id === id).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const porArea = new Map();
  for (const e of arriba.filter((x) => x.tipo !== "colector")) (porArea.get(e.area || "Sin área") ?? porArea.set(e.area || "Sin área", []).get(e.area || "Sin área")).push(e);
  const salida = [...porArea.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([area, es]) => ({ titulo: area, filas: es.flatMap((e) => [{ e, nivel: 0 }, ...hijos(e.id).map((h) => ({ e: h, nivel: 1 }))]) }));
  const cols = arriba.filter((x) => x.tipo === "colector").sort((a, b) => (a.tag || a.nombre).localeCompare(b.tag || b.nombre, "es", { numeric: true }));
  if (cols.length) salida.push({ titulo: "Colectores", filas: cols.flatMap((e) => [{ e, nivel: 0 }, ...hijos(e.id).map((h) => ({ e: h, nivel: 1 }))]) });
  return salida;
}

/**
 * La hoja para elegir un equipo. Devuelve su id, "" si se eligió «Todos» (con `todos`), o null si se cerró.
 * `soloArriba`: sin subequipos (para elegir el padre de un subequipo).
 */
export function elegirEquipo(d, { titulo = "Elegir equipo", actual = null, todos = null, soloArriba = false } = {}) {
  let elegido = null;
  const html = `<div class="buscador" style="margin-top:-4px">${icono("buscar")}<input type="search" data-q placeholder="Buscar por nombre, tag o área" autocomplete="off" aria-label="Buscar equipo"></div>
    <div class="selector-equipos" data-lista>${pintar("")}</div>`;
  function pintar(q) {
    const b = normal(q);
    const gs = grupos(d).map((g) => ({ ...g, filas: g.filas.filter(({ e, nivel }) => (!soloArriba || nivel === 0)
      && (!b || normal(`${e.tag} ${e.nombre} ${e.area} ${g.titulo} ${nombreCompleto(d, e.id)}`).includes(b))) })).filter((g) => g.filas.length);
    return `${todos ? `<button type="button" class="opcion-equipo${actual ? "" : " elegida"}" data-id="">${icono("lista")}<span class="nombre">${esc(todos)}</span></button>` : ""}
      ${gs.length ? gs.map((g) => `<div class="grupo-equipos">${esc(g.titulo)}</div>${g.filas.map(({ e, nivel }) => `<button type="button" class="opcion-equipo${nivel ? " hijo" : ""}${e.id === actual ? " elegida" : ""}" data-id="${esc(e.id)}">
        ${nivel ? `<span class="rama" aria-hidden="true"></span>` : ""}${e.tag ? `<span class="tag">${esc(e.tag)}</span>` : ""}<span class="nombre">${esc(e.nombre)}</span>
        ${e.id === actual ? icono("bien", "ico marca-elegida") : ""}</button>`).join("")}`).join("")
      : `<p class="ayuda" style="padding:18px 8px">Ningún equipo con «${esc(q)}».</p>`}`;
  }
  return dialogo({
    titulo, html, ancho: false,
    botones: [{ texto: "Cancelar", valor: null }],
    alMontar(velo, cerrar) {
      const lista = velo.querySelector("[data-lista]");
      const q = velo.querySelector("[data-q]");
      let cuadro = 0;
      q.addEventListener("input", () => { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(() => { lista.innerHTML = pintar(q.value); }); });
      q.addEventListener("keydown", (e) => { if (e.key === "Enter") { const b = lista.querySelector("[data-id]:not([data-id=''])"); if (b) { elegido = b.dataset.id; cerrar(elegido); } } });
      lista.addEventListener("click", (e) => {
        const b = e.target.closest("[data-id]");
        if (b) { elegido = b.dataset.id; cerrar(elegido); }
      });
      lista.querySelector(".elegida")?.scrollIntoView({ block: "center" });
    },
  }).then((v) => (v === null ? null : v));
}

/**
 * Un campo de formulario para elegir equipo: un botón que muestra el elegido y un <input type=hidden> con el id. Al
 * elegir, el input dispara «change» (la vista lo escucha como cualquier otro campo).
 */
export function campoEquipo(d, { id, valor = "", titulo = "Elegir equipo", placeholder = "Elegir…", soloArriba = false, todos = null } = {}) {
  return `<input type="hidden" id="${esc(id)}" name="${esc(id)}" value="${esc(valor ?? "")}">
    <button type="button" class="campo-equipo" data-campo-equipo="${esc(id)}" data-titulo="${esc(titulo)}" data-solo-arriba="${soloArriba ? "1" : ""}" data-todos="${esc(todos ?? "")}"
      data-placeholder="${esc(placeholder)}" aria-label="${esc(titulo)}">${icono("equipos")}<span>${valor ? esc(nombreCompleto(d, valor)) : `<span class="vacio-campo">${esc(placeholder)}</span>`}</span>${icono("abajo", "ico flechita")}</button>`;
}
let datosCampos = null; // los datos con que se pinta el campo (los pone la app al dibujar)
export const usarDatos = (d) => { datosCampos = d; };
document.addEventListener("click", async (e) => {
  const b = e.target.closest?.("[data-campo-equipo]");
  if (!b || !datosCampos) return;
  const input = document.getElementById(b.dataset.campoEquipo);
  const r = await elegirEquipo(datosCampos, { titulo: b.dataset.titulo, actual: input.value || null, soloArriba: !!b.dataset.soloArriba, todos: b.dataset.todos || null });
  if (r === null) return;
  input.value = r;
  b.querySelector("span").innerHTML = r ? esc(nombreCompleto(datosCampos, r)) : `<span class="vacio-campo">${esc(b.dataset.todos || b.dataset.placeholder)}</span>`;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});

// ------------------------------------------------------------------------------- barra de filtros

/**
 * Buscar + equipo (+ las cápsulas que pase la vista). Lo elegido vive en la URL (q, eq), así el botón «atrás» y un
 * enlace guardado lo conservan. `extra`: HTML de cápsulas propias de la vista.
 */
export function barraFiltros(d, query, { placeholder = "Buscar", extra = "" } = {}) {
  const eq = query.get("eq") ?? "";
  return `<div class="barra-filtros" data-filtros>
    <div class="buscador">${icono("buscar")}<input type="search" data-buscar value="${esc(query.get("b") ?? "")}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off"></div>
    <button type="button" class="chip-equipo${eq ? " activo" : ""}" data-filtro-equipo>${icono("filtro")}<span>${eq ? esc(nombreCompleto(d, eq)) : "Todos los equipos"}</span>
      ${eq ? `<span class="quitar-filtro" data-quitar-equipo role="button" aria-label="Quitar el filtro de equipo">${icono("mal")}</span>` : ""}</button>
    ${extra}
  </div>`;
}
/** Conecta la barra: al escribir (con una pausa corta) o al elegir equipo, cambia la URL sin redibujar y llama a alCambiar. */
export function montarFiltros(m, d, { ruta, alCambiar }) {
  const zona = m.querySelector("[data-filtros]");
  if (!zona) return;
  const query = () => new URLSearchParams(location.hash.split("?")[1] ?? "");
  const poner = (cambios) => {
    const q = query();
    for (const [k, v] of Object.entries(cambios)) (v ? q.set(k, v) : q.delete(k));
    history.replaceState(null, "", `#/${ruta}${q.toString() ? `?${q}` : ""}`);
    alCambiar(q);
  };
  let reloj = null;
  zona.querySelector("[data-buscar]").addEventListener("input", (e) => {
    clearTimeout(reloj);
    reloj = setTimeout(() => poner({ b: e.target.value.trim() }), 140);
  });
  zona.addEventListener("click", async (e) => {
    if (e.target.closest("[data-quitar-equipo]")) { e.stopPropagation(); return poner({ eq: "" }), pintarChip(""); }
    if (!e.target.closest("[data-filtro-equipo]")) return;
    const r = await elegirEquipo(d, { titulo: "Ver solo un equipo", actual: query().get("eq"), todos: "Todos los equipos" });
    if (r === null) return;
    pintarChip(r);
    poner({ eq: r });
  });
  function pintarChip(eq) {
    const b = zona.querySelector("[data-filtro-equipo]");
    b.classList.toggle("activo", !!eq);
    b.innerHTML = `${icono("filtro")}<span>${eq ? esc(nombreCompleto(d, eq)) : "Todos los equipos"}</span>${eq ? `<span class="quitar-filtro" data-quitar-equipo role="button" aria-label="Quitar el filtro de equipo">${icono("mal")}</span>` : ""}`;
  }
}

// ------------------------------------------------------------------------------- firma con el dedo

/** La hoja de firma. Devuelve un Blob PNG (trazo negro, recortado a lo dibujado) o null si se cancela. */
export function pedirFirma({ nombre = "", texto = "Firma con el dedo para cerrar la inspección." } = {}) {
  let lienzo, trazos = [], actual = null;
  const dibujar = () => {
    const g = lienzo.getContext("2d");
    const k = devicePixelRatio || 1;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, lienzo.width, lienzo.height);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#111";
    for (const t of [...trazos, ...(actual ? [actual] : [])]) {
      if (t.length === 1) { g.beginPath(); g.arc(t[0].x, t[0].y, 1.6, 0, 7); g.fillStyle = "#111"; g.fill(); continue; }
      for (let i = 1; i < t.length; i++) {
        // más rápido = más fino, como una pluma
        const a = t[i - 1], b = t[i];
        g.lineWidth = Math.max(1.4, Math.min(3.6, 3.6 - Math.hypot(b.x - a.x, b.y - a.y) / 14));
        g.beginPath();
        const ma = i > 1 ? { x: (t[i - 2].x + a.x) / 2, y: (t[i - 2].y + a.y) / 2 } : a, mb = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        g.moveTo(ma.x, ma.y);
        g.quadraticCurveTo(a.x, a.y, mb.x, mb.y);
        g.stroke();
      }
    }
  };
  return dialogo({
    titulo: "Firma",
    html: `<p>${esc(texto)}</p>
      <div class="lienzo-firma"><canvas data-lienzo aria-label="Espacio para firmar"></canvas><span class="linea-firma">${esc(nombre)}</span>
        <button type="button" class="boton mini plano" data-borrar hidden>${icono("basura")}Borrar</button></div>`,
    botones: [{ texto: "Cancelar", valor: null }, { texto: "Firmar y terminar", valor: "ok", clase: "primario", alElegir: () => (trazos.length ? true : (aviso("Firma antes de terminar.", { error: true }), false)) }],
    alMontar(velo) {
      lienzo = velo.querySelector("[data-lienzo]");
      const r = lienzo.getBoundingClientRect();
      const k = devicePixelRatio || 1;
      lienzo.width = Math.round(r.width * k);
      lienzo.height = Math.round(r.height * k);
      const borrar = velo.querySelector("[data-borrar]");
      const punto = (e) => { const b = lienzo.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
      let cuadro = 0;
      const pedir = () => { cuadro ||= requestAnimationFrame(() => { cuadro = 0; dibujar(); }); };
      lienzo.addEventListener("pointerdown", (e) => { lienzo.setPointerCapture(e.pointerId); actual = [punto(e)]; pedir(); });
      lienzo.addEventListener("pointermove", (e) => {
        if (!actual) return;
        for (const ev of e.getCoalescedEvents?.() ?? [e]) actual.push(punto(ev)); // todos los puntos, aunque el cuadro vaya atrasado
        pedir();
      });
      const soltar = () => { if (!actual) return; trazos.push(actual); actual = null; borrar.hidden = false; pedir(); };
      lienzo.addEventListener("pointerup", soltar);
      lienzo.addEventListener("pointercancel", soltar);
      borrar.addEventListener("click", () => { trazos = []; borrar.hidden = true; dibujar(); });
    },
  }).then(async (v) => {
    if (v !== "ok") return null;
    // recortado a lo dibujado, con un margen
    const k = devicePixelRatio || 1;
    const pts = trazos.flat();
    const x0 = Math.max(0, Math.min(...pts.map((p) => p.x)) - 8) * k, y0 = Math.max(0, Math.min(...pts.map((p) => p.y)) - 8) * k;
    const x1 = Math.min(lienzo.width, (Math.max(...pts.map((p) => p.x)) + 8) * k), y1 = Math.min(lienzo.height, (Math.max(...pts.map((p) => p.y)) + 8) * k);
    const c = Object.assign(document.createElement("canvas"), { width: Math.max(1, Math.round(x1 - x0)), height: Math.max(1, Math.round(y1 - y0)) });
    c.getContext("2d").drawImage(lienzo, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    // los bytes de una vez, sin pasar por un Blob que haya que volver a leer
    const bin = atob(c.toDataURL("image/png").split(",")[1]);
    return { type: "image/png", bytes: Uint8Array.from(bin, (ch) => ch.charCodeAt(0)).buffer };
  });
}

// ------------------------------------------------------------------------------- escáner de QR

/** Del texto de un QR, el id del equipo (los QR de la app llevan …/#/qr/<id>; también sirve un tag suelto). */
export function equipoDelQr(d, texto) {
  const m = /#\/qr\/([^?#\s]+)/.exec(texto ?? "");
  if (m) {
    const id = decodeURIComponent(m[1]);
    return equipoDe(d, id) ? id : null;
  }
  const t = String(texto ?? "").trim().toUpperCase();
  return d.equipos.find((e) => e.tag && e.tag.toUpperCase() === t)?.id ?? null;
}

/** La cámara a pantalla completa con su visor. Devuelve el texto leído o null si se cierra. */
export async function escanear({ titulo = "Escanear el QR del equipo", ayuda = "Apunta al código pegado en el equipo." } = {}) {
  let detener = null, pista = null;
  const r = await dialogo({
    titulo,
    html: `<div class="visor"><video data-video playsinline muted></video><div class="marco" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="barrido"></span></div>
        <button type="button" class="boton-icono linterna" data-linterna hidden aria-label="Linterna">${icono("rayo")}</button></div>
      <p class="ayuda" data-estado>${esc(ayuda)}</p>`,
    ancho: true,
    botones: [{ texto: "Cerrar", valor: null }],
    async alMontar(velo, cerrar) {
      const estado = velo.querySelector("[data-estado]");
      try {
        const { iniciarLector } = await import("./lector-qr.mjs");
        detener = await iniciarLector(velo.querySelector("[data-video]"), {
          alLeer: (t) => { navigator.vibrate?.(12); cerrar(t); },
          alError: (m) => { estado.textContent = m; estado.style.color = "var(--rojo)"; },
        });
        // la linterna, donde la cámara la tiene (Android)
        pista = velo.querySelector("video").srcObject?.getVideoTracks?.()[0];
        if (pista?.getCapabilities?.().torch) {
          const b = velo.querySelector("[data-linterna]");
          let on = false;
          b.hidden = false;
          b.addEventListener("click", async () => { on = !on; b.classList.toggle("activo", on); await pista.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}); });
        }
      } catch (x) {
        estado.textContent = x.message;
        estado.style.color = "var(--rojo)";
      }
    },
  });
  detener?.();
  return r;
}

// ------------------------------------------------------------------------------- listas pegadas

/** Una línea por equipo (colectores, subequipos): separada por tabuladores (de Excel), punto y coma o comas. */
export function leerLista(texto) {
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const sep = l.includes("\t") ? "\t" : l.includes(";") ? ";" : ",";
    const [tag = "", nombre = "", area = "", sirve_a = ""] = l.split(sep).map((x) => x.trim());
    return { tag, nombre, area, sirve_a };
  }).filter((x) => x.tag || x.nombre)
    // la primera línea de una tabla de Excel suele ser el título de las columnas
    .filter((x, k) => !(k === 0 && /^tag$/i.test(x.tag)));
}
