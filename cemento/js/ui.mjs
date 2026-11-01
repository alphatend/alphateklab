// Piezas de la interfaz que usan todas las vistas: avisos, hojas de diálogo y de acciones, etiquetas de estado,
// nombres (de personas y equipos) y las filas de las listas.
import { esc, icono, fechaCorta, vencimiento, haceCuanto, plural, numeroHallazgo } from "./util.mjs";
import { urlMedio } from "./api.mjs";

const reducir = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------------------------- avisos y diálogos

let relojAviso = null;
export function aviso(texto, { error = false, ms = 3200, icono: ic = null, accion = null } = {}) {
  document.querySelector(".aviso")?.remove();
  const el = document.createElement("div");
  el.className = `aviso vidrio${error ? " error" : ""}`;
  el.setAttribute("role", error ? "alert" : "status");
  el.innerHTML = `${icono(ic ?? (error ? "hallazgos" : "bien"))}<span>${esc(texto)}</span>`;
  if (accion) {
    const b = document.createElement("button");
    b.className = "boton primario mini";
    b.textContent = accion.texto;
    b.onclick = () => { quitar(); accion.alTocar(); };
    el.append(b);
  }
  document.body.append(el);
  const quitar = () => {
    if (!el.isConnected) return;
    if (reducir()) return el.remove();
    el.classList.add("saliendo");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };
  clearTimeout(relojAviso);
  relojAviso = setTimeout(quitar, error ? Math.max(ms, 6000) : accion ? Math.max(ms, 6000) : ms);
  return el;
}

const abiertas = new Set(); // las hojas abiertas (se cierran solas al cambiar de pantalla)
/** Cierra todas las hojas abiertas (al navegar, como iOS al volver atrás). */
export const cerrarHojas = () => [...abiertas].forEach((cerrar) => cerrar(null));

/** Hoja de diálogo. botones: [{texto, valor, clase, icono, alElegir}]. Devuelve el valor del botón (o null si se cierra). */
export function dialogo({ titulo, html = "", botones = [{ texto: "Listo", valor: true, clase: "primario" }], alMontar, ancho = false }) {
  return new Promise((ok) => {
    const anterior = document.activeElement;
    const velo = document.createElement("div");
    velo.className = "velo";
    velo.innerHTML = `<div class="dialogo vidrio${ancho ? " ancho" : ""}" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">${esc(titulo)}</h2>${html}
      ${botones.length ? `<div class="botones">${botones.map((b, i) => `<button type="button" class="boton ${b.clase ?? ""}" data-i="${i}">${b.icono ? icono(b.icono) : ""}${esc(b.texto)}</button>`).join("")}</div>` : ""}
    </div>`;
    let cerrado = false;
    const cerrar = (v) => {
      if (cerrado) return;
      cerrado = true;
      abiertas.delete(cerrar);
      removeEventListener("keydown", tecla);
      anterior?.focus?.({ preventScroll: true });
      ok(v);
      if (reducir()) return velo.remove();
      velo.classList.add("cerrando");
      setTimeout(() => velo.remove(), 200);
    };
    // Escape cierra solo la hoja de encima (con una abierta sobre otra, la de abajo se queda)
    const tecla = (e) => e.key === "Escape" && velo === [...document.querySelectorAll(".velo:not(.cerrando)")].at(-1) && cerrar(null);
    velo.addEventListener("click", async (e) => {
      if (e.target === velo) return cerrar(null);
      const b = e.target.closest("[data-i]");
      if (b) {
        const def = botones[Number(b.dataset.i)];
        if (def.alElegir) {
          b.disabled = true;
          const r = await def.alElegir(velo);
          b.disabled = false;
          if (r === false) return;
        }
        cerrar(def.valor);
      }
    });
    abiertas.add(cerrar);
    const mostrar = () => {
      if (cerrado) return;
      addEventListener("keydown", tecla);
      document.body.append(velo);
      alMontar?.(velo, cerrar);
      const primero = velo.querySelector("input:not([type=hidden]), select, textarea") ?? velo.querySelector(".boton.primario") ?? velo.querySelector("button");
      // en el teléfono no se abre el teclado solo
      if (!(primero?.matches("input, textarea") && matchMedia("(pointer: coarse)").matches)) primero?.focus({ preventScroll: true });
    };
    // si otra hoja se está yendo, esta sale cuando termine (que no se vean dos encimadas)
    if (document.querySelector(".velo.cerrando")) setTimeout(mostrar, 200);
    else mostrar();
  });
}

export const confirmar = (titulo, html, si = "Sí", clase = "primario") =>
  dialogo({ titulo, html: `<p>${html}</p>`, botones: [{ texto: "Cancelar", valor: false }, { texto: si, valor: true, clase }] });

/** Hoja de acciones (como la de iOS): una lista de opciones. Devuelve el valor elegido o null. */
export function elegir(titulo, opciones, { actual } = {}) {
  return dialogo({
    titulo,
    botones: [{ texto: "Cancelar", valor: null }],
    html: `<div class="acciones-hoja">${opciones.map((o, i) => `<button type="button" data-op="${i}" ${o.valor === actual ? 'aria-current="true"' : ""}>
      ${o.icono ? icono(o.icono) : ""}<span>${esc(o.texto)}</span></button>`).join("")}</div>`,
    alMontar: (velo, cerrar) => velo.querySelectorAll("[data-op]").forEach((b) => b.addEventListener("click", () => cerrar(opciones[Number(b.dataset.op)].valor))),
  });
}

// ------------------------------------------------------------------------------- etiquetas

export const TEXTO_PRIORIDAD = { alta: "Alta", media: "Media", baja: "Baja" };
// ------------------------------------------------------------------------------- íconos de los equipos

/** Los que se pueden elegir (el administrador, en «Editar»). «equipo» es el engranaje de siempre. */
export const ICONOS_EQUIPO = [
  ["equipo", "Equipo"], ["molino-bolas", "Molino de bolas"], ["molino-vertical", "Molino vertical"], ["horno", "Horno"],
  ["enfriador", "Enfriador"], ["quemador", "Quemador"], ["ventilador", "Ventilador"], ["motor", "Motor"], ["bomba", "Bomba"],
  ["compresor", "Compresor"], ["elevador", "Elevador"], ["banda", "Banda"], ["silo", "Silo"], ["tolva", "Tolva"],
  ["ciclon", "Ciclón"], ["colector", "Colector"], ["ensacadora", "Ensacadora"], ["trituradora", "Trituradora"],
  ["tanque", "Tanque"], ["tuberia", "Tubería"], ["electrico", "Eléctrico"], ["despacho", "Despacho"], ["auxiliares", "Auxiliares"],
];
// Sin elegir, uno según el nombre (Eduardo: «que ya existan íconos predeterminados»)
const ICONO_POR_NOMBRE = [
  // primero las piezas (el «Ventilador del enfriador» es un ventilador), después los equipos grandes
  [/quemador|burner/i, "quemador"], [/ventilador|\bfan\b|\btiro\b/i, "ventilador"], [/motor/i, "motor"], [/bomba/i, "bomba"],
  [/compresor/i, "compresor"], [/elevador/i, "elevador"], [/banda|transportador|\bcinta\b/i, "banda"],
  [/separador|cicl[oó]n/i, "ciclon"], [/colector|filtro|manga/i, "colector"], [/tolva/i, "tolva"], [/\bsilo/i, "silo"],
  [/tuber[ií]a|ducto|v[aá]lvula/i, "tuberia"], [/tanque|\btank/i, "tanque"], [/subestaci|el[eé]ctric|transformador/i, "electrico"],
  [/trituradora|chancadora|crusher/i, "trituradora"],
  [/loesche|vertical|\bvrm\b/i, "molino-vertical"], [/molino|horomill|\bmill\b/i, "molino-bolas"], [/horno|kiln/i, "horno"],
  [/enfriador|cooler/i, "enfriador"], [/ensacadora|envase|\bsacos?\b/i, "ensacadora"],
  [/despacho|cami[oó]n|b[aá]scula/i, "despacho"], [/auxiliar|servicios/i, "auxiliares"],
];
/** El que le toca: el elegido o, si no, el que dice su nombre (los colectores, el de colector). */
export function claveIconoEquipo(e) {
  if (e?.icono && ICONOS_EQUIPO.some(([k]) => k === e.icono)) return e.icono;
  if (e?.tipo === "colector") return "colector";
  const texto = `${e?.nombre ?? ""} ${e?.tag ?? ""}`;
  return ICONO_POR_NOMBRE.find(([r]) => r.test(texto))?.[1] ?? "equipo";
}
export const iconoDeClave = (clave, clase) => icono(clave === "equipo" ? "equipos" : `eq-${clave}`, clase);
export const iconoEquipo = (e, clase) => iconoDeClave(claveIconoEquipo(e), clase);

/** ¿Se usan los códigos QR? El administrador los prende en Ajustes cuando ya están pegados en los equipos (Eduardo,
 *  31-oct-2026); apagados, no sale nada de QR en la app. */
export const usaQr = (d) => d?.ajustes?.usar_qr === true;
// «Para el paro» se quitó (Eduardo, 31-oct-2026: «eso elimínalo»): lo que todavía tenga ese estado se ve «En proceso»
export const TEXTO_ESTADO = { abierto: "Abierto", en_proceso: "En proceso", paro: "En proceso", cerrado: "Cerrado" };
export const ESTADOS = ["abierto", "en_proceso", "cerrado"];
export const ICONO_ESTADO = { abierto: "hallazgos", en_proceso: "repetir", paro: "paro", cerrado: "bien" };
export const PUNTO_ESTADO = { abierto: "rojo", en_proceso: "azul", paro: "morado", cerrado: "verde" };

/** El tipo de daño de un hallazgo (Eduardo, 30-oct-2026): los de mantenimiento van a su reporte. */
export const TIPOS_DANO = { mecanico: "Mecánico", electrico: "Eléctrico", logica: "Lógica", otro: "Otro" };
export const DE_MANTENIMIENTO = new Set(["mecanico", "electrico", "logica"]);
/**
 * El ícono y el color de cada especialidad (31-oct-2026), los mismos en el tipo de daño y en la causa de un paro:
 * mecánico la llave en gris acero, eléctrico el rayo en amarillo, lógica e instrumentación en cian (control),
 * proceso en índigo, falta de material la caja en marrón, y lo externo y «otro» en gris. Ninguno usa el rojo, el
 * naranja, el verde ni el azul: esos son de la prioridad y del estado. Siempre van con la palabra al lado.
 */
const ESPECIALIDAD = {
  mecanico: { icono: "herramienta", color: "acero" }, electrico: { icono: "rayo", color: "amarillo" }, logica: { icono: "cpu", color: "cian" },
  instrumentacion: { icono: "medidor", color: "cian" }, proceso: { icono: "proceso", color: "indigo" }, material: { icono: "paquete", color: "marron" },
  externa: { icono: "externa", color: "gris" }, otro: { icono: "otro", color: "gris" },
};
const especialidad = (k) => (Object.hasOwn(ESPECIALIDAD, k) ? ESPECIALIDAD[k] : ESPECIALIDAD.otro);
/** La causa de un paro (texto libre de la lista del servidor) a su especialidad; lo que no se reconoce, «otro». */
export const claveCausa = (c) => {
  const t = String(c ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /mecan/.test(t) ? "mecanico" : /electr/.test(t) ? "electrico" : /instrument/.test(t) ? "instrumentacion" : /logic|plc|control/.test(t) ? "logica"
    : /proceso/.test(t) ? "proceso" : /material/.test(t) ? "material" : /extern/.test(t) ? "externa" : "otro";
};
export const colorEspecialidad = (k) => especialidad(k).color;
export const colorCausa = (c) => colorEspecialidad(claveCausa(c));
export const iconoEspecialidad = (k, clase) => icono(especialidad(k).icono, clase);
const marcaEspecialidad = (k, texto) => `<span class="marca disc-${especialidad(k).color}">${iconoEspecialidad(k)}${esc(texto)}</span>`;
export const marcaTipoDano = (t) => (t ? marcaEspecialidad(t, TIPOS_DANO[t] ?? t) : "");
export const marcaCausa = (c) => (c ? marcaEspecialidad(claveCausa(c), c) : "");
/** Los botones para elegir el tipo de daño (data-tipo-dano). */
export const segmentoTipoDano = (actual, id = "tipo") => `<div class="campo"><span class="rotulo" id="r-${id}">Tipo de daño <small>(mecánico, eléctrico o de lógica van al reporte de mantenimiento)</small></span>
  <div class="segmento con-iconos" role="group" aria-labelledby="r-${id}">${Object.entries(TIPOS_DANO).map(([k, t]) => `<button type="button" class="disc-${ESPECIALIDAD[k].color}" data-tipo-dano="${k}" aria-pressed="${(actual ?? "") === k}">${iconoEspecialidad(k)}${t}</button>`).join("")}</div></div>`;
export const marcaPrioridad = (p) => `<span class="marca ${p}">${icono(p === "baja" ? "na" : "hallazgos")}${TEXTO_PRIORIDAD[p] ?? p}</span>`;
export const marcaEstado = (e0) => { const e = e0 === "paro" ? "en_proceso" : e0; return `<span class="marca ${e}">${icono(ICONO_ESTADO[e] ?? "na")}${TEXTO_ESTADO[e] ?? e}</span>`; };
export const marcaSinEnviar = () => `<span class="marca sinenviar">${icono("nube")}Sin enviar</span>`;
export const marcaTag = (tag) => (tag ? `<span class="marca tag">${esc(tag)}</span>` : "");

export function marcaVence(insp, hoy) {
  if (insp.estado === "hecha") {
    return insp.revisada_en ? `<span class="marca revisada">${icono("visto")}Visto bueno</span>` : `<span class="marca hecha">${icono("bien")}Hecha</span>`;
  }
  const v = vencimiento(insp.vence, hoy);
  const ic = v.clase === "atrasada" ? "hallazgos" : "inspecciones";
  return `<span class="marca ${v.clase}">${icono(ic)}${esc(v.texto)}</span>`;
}

// ------------------------------------------------------------------------------- consultas comunes

export const persona = (d, id) => d.personas.find((p) => p.id === id);
/** El nombre completo; lo asignado a todo un turno, «Turno A (todo el turno)». */
export const nombre = (d, id) => (id === "todos" ? "Todos" : String(id ?? "").startsWith("turno:") ? `${textoTurno(id.slice(6))} (todo el turno)` : persona(d, id)?.nombre ?? "—");
/**
 * Quién: nombre y apellido, como está en Usuarios (Eduardo, 31-oct-2026: «coloque nombre y apellido porque hay gente
 * que se llama igual»; antes era solo el nombre de pila). Lo de todo un turno, «Turno 1»; lo de todos, «Todos».
 */
export const nombreCorto = (d, id) => {
  if (id === "todos") return "Todos";
  if (String(id ?? "").startsWith("turno:")) return textoTurno(id.slice(6));
  return persona(d, id)?.nombre ?? "—";
};
/** Para elegir a alguien: «Turno A · Jefe de turno A» o el nombre. */
export const etiquetaPersona = (p, yo) => `${p.turno ? `${textoTurno(p.turno)} · ` : ""}${p.nombre}${p.id === yo?.id ? " (yo)" : ""}`;
export const equipo = (d, id) => d.equipos.find((e) => e.id === id);
export const plantilla = (d, id) => d.plantillas.find((p) => p.id === id);
export const inicial = (n) => (n || "?").trim().charAt(0).toUpperCase();
/** «Eduardo González» → «EG»; «Jefe de turno A» → «JA»; un solo nombre, su letra. Sin «de», «del», «la»… */
export const iniciales = (n) => {
  const p = String(n ?? "").trim().split(/\s+/).filter((x) => x && !/^(de|del|la|las|los|y)$/i.test(x));
  return p.length ? (p.length > 1 ? p[0].charAt(0) + p.at(-1).charAt(0) : p[0].charAt(0)).toUpperCase() : "?";
};
/**
 * El ícono de cada persona (Jonathan, 31-oct-2026: sin fotos, «solo algo para la app para identificar»): sus
 * iniciales o un símbolo, en uno de 8 colores. Lo elige cada uno en Ajustes o el administrador en Usuarios; se guarda
 * como «3» (color 3, iniciales) o «3:pajaro». Sin elegir: las iniciales en un color según quién es. Los símbolos no
 * repiten los que ya dicen algo en la app (rayo, llave, gota, sol, luna…). La lista es la misma que en el servidor.
 */
export const TONOS_AVATAR = ["Grafito", "Azul", "Ámbar", "Verde", "Morado", "Coral", "Cian", "Índigo"];
export const SIMBOLOS_AVATAR = { pajaro: "Pájaro", pez: "Pez", gato: "Gato", perro: "Perro", caballo: "Caballo", mariposa: "Mariposa", arbol: "Árbol", flor: "Flor",
  montana: "Montaña", ancla: "Ancla", balon: "Balón", cafe: "Café" };
const tonoPorId = (id) => [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 6;
/** { tono, simbolo } del ícono guardado (o el de siempre si no eligió). */
export const leerAvatar = (p) => {
  const m = /^([0-7])(?::([a-z]+))?$/.exec(p?.avatar ?? "");
  return { tono: m ? Number(m[1]) : tonoPorId(p?.id ?? ""), simbolo: m?.[2] && Object.hasOwn(SIMBOLOS_AVATAR, m[2]) ? m[2] : "" };
};
const circulo = (tono, simbolo, nombreP, chica) => `<span class="letra-inicial${chica ? " chica" : ""}${simbolo ? " simbolo" : ""}" data-tono="${tono}" aria-hidden="true">${simbolo ? icono(`av-${simbolo}`) : esc(iniciales(nombreP))}</span>`;
export const avatar = (p, chica = false) => { const a = leerAvatar(p); return circulo(a.tono, a.simbolo, p?.nombre, chica); };
/** Para elegir el ícono: los 8 colores y las iniciales o un símbolo, ya en el color elegido. Se lee con valorAvatar. */
export function selectorAvatar(p) {
  const a = leerAvatar(p);
  return `<div class="elegir-avatar" data-elegir-avatar>
    <span class="rotulo" id="r-av-tono">Color</span>
    <div class="tonos" role="group" aria-labelledby="r-av-tono">${TONOS_AVATAR.map((t, k) => `<button type="button" data-av-tono="${k}" aria-pressed="${a.tono === k}" aria-label="${t}"><span class="letra-inicial chica" data-tono="${k}"></span></button>`).join("")}</div>
    <span class="rotulo" id="r-av-simbolo">Iniciales o un símbolo</span>
    <div class="simbolos" role="group" aria-labelledby="r-av-simbolo">${[["", "Iniciales"], ...Object.entries(SIMBOLOS_AVATAR)].map(([k, t]) => `<button type="button" data-av-simbolo="${k}" aria-pressed="${a.simbolo === k}" aria-label="${t}">${circulo(a.tono, k, p?.nombre, false)}</button>`).join("")}</div>
  </div>`;
}
/** Conecta el selector: elegir un color pinta los símbolos con ese color; las iniciales siguen al nombre escrito. */
export function montarSelectorAvatar(raiz, campoNombre) {
  const sel = raiz.querySelector("[data-elegir-avatar]");
  if (!sel) return;
  sel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-av-tono], [data-av-simbolo]");
    if (!b) return;
    sel.dataset.tocado = "1";
    const grupo = b.hasAttribute("data-av-tono") ? "[data-av-tono]" : "[data-av-simbolo]";
    for (const x of sel.querySelectorAll(grupo)) x.setAttribute("aria-pressed", String(x === b));
    if (b.dataset.avTono) for (const c of sel.querySelectorAll("[data-av-simbolo] .letra-inicial")) c.dataset.tono = b.dataset.avTono;
  });
  campoNombre?.addEventListener("input", () => { const c = sel.querySelector('[data-av-simbolo=""] .letra-inicial'); if (c) c.textContent = iniciales(campoNombre.value); });
}
/** «3» o «3:pajaro»; con soloSiCambio, undefined si no tocó nada (así no se guarda un color que nadie eligió). */
export const valorAvatar = (raiz, soloSiCambio = false) => {
  const sel = raiz.querySelector("[data-elegir-avatar]");
  if (!sel || (soloSiCambio && !sel.dataset.tocado)) return undefined;
  const t = sel.querySelector('[data-av-tono][aria-pressed="true"]')?.dataset.avTono ?? "0";
  const s = sel.querySelector('[data-av-simbolo][aria-pressed="true"]')?.dataset.avSimbolo ?? "";
  return s ? `${t}:${s}` : t;
};
/** «COL-03 · Filtro principal del Loesche» o el nombre solo. */
export const nombreEquipo = (e) => (e ? (e.tag ? `${e.tag} · ${e.nombre}` : e.nombre) : "Equipo");
export const equiposDe = (i) => (i.equipos?.length ? i.equipos : [i.equipo_id]);
/** Lo que se inspecciona: el equipo, o «Ronda · 8 colectores». */
export function queInspeccion(d, i) {
  const ids = equiposDe(i);
  if (ids.length > 1) {
    const tipo = equipo(d, ids[0])?.tipo === "colector" ? ["colector", "colectores"] : ["equipo", "equipos"];
    return plural(ids.length, tipo[0], tipo[1]);
  }
  return nombreEquipo(equipo(d, ids[0]));
}
export const esAdmin = (yo) => yo?.rol === "admin";
/**
 * Los turnos (Eduardo, 30-oct-2026: «solo existen 3»). Por dentro siguen siendo A, B y C (lo guardado no cambia); se
 * muestran por número y su horario. Un turno D de antes se ve como «Turno D».
 */
export const TURNOS = [
  { id: "A", nombre: "Turno 1", horas: "12 a. m. – 7 a. m.", desde: 0, hasta: 7, icono: "luna" },
  { id: "B", nombre: "Turno 2", horas: "7 a. m. – 5 p. m.", desde: 7, hasta: 17, icono: "sol" },
  { id: "C", nombre: "Turno 3", horas: "5 p. m. – 12 a. m.", desde: 17, hasta: 24, icono: "atardecer" },
];
export const textoTurno = (t) => TURNOS.find((x) => x.id === String(t ?? "").toUpperCase())?.nombre ?? `Turno ${t}`;
/**
 * La luna, el sol o el atardecer de cada turno (31-oct-2026), en el color del texto: la forma ya lo dice, y un color
 * más se confundiría con los de la prioridad o el tipo de daño. Un turno D de antes no lleva ícono.
 */
export const iconoTurno = (t, clase) => { const x = TURNOS.find((y) => y.id === String(t ?? "").toUpperCase()); return x ? icono(x.icono, clase) : ""; };
/** «☾ Turno 1», ya escapado, para poner en HTML. */
export const turnoConIcono = (t) => `<span class="con-turno">${iconoTurno(t, "ico chico")}${esc(textoTurno(t))}</span>`;
/** En qué turno cae una hora (en Panamá). */
export const turnoDeHora = (iso) => { const h = new Date(Date.parse(iso) - 5 * 3600e3).getUTCHours(); return TURNOS.find((x) => h >= x.desde && h < x.hasta)?.id ?? null; };
/**
 * La curva de Tromp la llena ingeniería de procesos (Eduardo, 30-oct-2026: «él lo llena, los demás solo lo
 * ven»): el administrador y quien tenga de cargo procesos, gerencia o coordinación. La curva de Tromp solo la ven ellos.
 */
export const esDeProceso = (p) => p?.rol === "admin" || /proceso|gerent|gerenc|coordin/i.test(p?.puesto ?? "");
/** ¿Esta persona puede…? (editar, asignar, tareas, equipos, revisar). El administrador, todo. */
export const puede = (yo, permiso) => yo?.rol === "admin" || (yo?.permisos ?? ["editar"]).includes(permiso);
export const PERFILES = {
  lectura: { nombre: "Solo ver", desc: "Ve inspecciones, hallazgos, tareas y reportes. No cambia nada.", permisos: [] },
  inspector: { nombre: "Inspector", desc: "Llena inspecciones, anota hallazgos, sus tareas, entregas de turno y paros.", permisos: ["editar"] },
  supervisor: { nombre: "Supervisor", desc: "Además asigna inspecciones, le pasa tareas a otros y da el visto bueno.", permisos: ["editar", "asignar", "tareas", "revisar"] },
  admin: { nombre: "Administrador", desc: "Todo, también usuarios, equipos y ajustes.", permisos: ["editar", "asignar", "tareas", "equipos", "revisar"] },
};
export const PERMISOS = {
  editar: ["Llenar y anotar", "Inspecciones, hallazgos, sus tareas, entregas de turno y paros"],
  asignar: ["Asignar inspecciones", "Y programar paros"],
  tareas: ["Pasarles tareas a otros", "A una persona o a un turno"],
  equipos: ["Editar equipos y plantillas", "Equipos, subequipos, colectores y lo que se revisa"],
  revisar: ["Dar el visto bueno", "A las inspecciones hechas"],
};
/** El perfil que corresponde a unos permisos («Personalizado» si no calza con ninguno). */
export function perfilDe(p) {
  if (p?.rol === "admin") return "admin";
  const xs = [...(p?.permisos ?? ["editar"])].sort().join(",");
  return Object.entries(PERFILES).find(([k, v]) => k !== "admin" && [...v.permisos].sort().join(",") === xs)?.[0] ?? "personalizado";
}
export const nombrePerfil = (p) => PERFILES[perfilDe(p)]?.nombre ?? "Personalizado";

// ------------------------------------------------------------------------------- filas

export function filaInspeccion(d, i, hoy, { mostrarQuien = true } = {}) {
  const pl = plantilla(d, i.plantilla_id);
  const repetir = i.repetir_dias ? `<span>${icono("repetir", "ico chico")} cada ${i.repetir_dias === 1 ? "día" : `${i.repetir_dias} días`}</span>` : "";
  const cuando = i.estado === "hecha" ? `Hecha ${haceCuanto(i.hecha_en, hoy)} por ${esc(nombreCorto(d, i.hecha_por))}` : `Vence ${esc(fechaCorta(i.vence))}`;
  return `<li><a class="fila" href="#/inspeccion/${encodeURIComponent(i.id)}">
    <span class="titulo">${esc(queInspeccion(d, i))} <small>· ${esc(pl?.nombre ?? "Inspección")}</small></span>
    <span class="detalle">${mostrarQuien && i.estado !== "hecha" ? `<span>${esc(nombreCorto(d, i.asignada_a))}</span>` : ""}<span>${cuando}</span>${repetir}</span>
    <span class="lado">${i._sinEnviar ? marcaSinEnviar() : marcaVence(i, hoy)}</span>
  </a></li>`;
}

export function filaHallazgo(d, h, hoy) {
  const eq = equipo(d, h.equipo_id);
  const foto = h.fotos?.[0];
  return `<li><a class="fila" href="#/hallazgo/${encodeURIComponent(h.id)}">
    <span class="titulo">${esc(h.descripcion)}</span>
    <span class="detalle"><span class="mono">${numeroHallazgo(h)}</span><span>${esc(nombreEquipo(eq))}</span><span>${h.responsable_id ? `A cargo: ${esc(nombreCorto(d, h.responsable_id))}` : "Sin responsable"}</span><span>${esc(haceCuanto(h.creado, hoy))}</span></span>
    <span class="lado">${foto ? `<img class="miniatura" src="${esc(urlMedio(foto))}" alt="" loading="lazy" onerror="this.remove()">` : ""}
      ${h._sinEnviar ? marcaSinEnviar() : h.estado === "abierto" ? marcaPrioridad(h.prioridad) : marcaEstado(h.estado)}</span>
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

/** Botones de foto: «Foto» abre la cámara; «Galería» deja elegir fotos o videos guardados. */
export function botonesMedio(clave) {
  // el control es el input (queda enfocable aunque no se vea); la etiqueta es lo que se toca
  return `<label class="boton chico">${icono("camara")}Foto
      <input type="file" accept="image/*" capture="environment" data-medio-de="${esc(clave)}" class="oculto"></label>
    <label class="boton chico">${icono("galeria")}Galería
      <input type="file" accept="image/*,video/*" multiple data-medio-de="${esc(clave)}" class="oculto"></label>`;
}

/** Una línea chica con los últimos valores de una medida y su rango (verde), los fuera de rango en rojo. */
export function chispa(valores, { min = null, max = null, ancho = 150, alto = 40 } = {}) {
  const vs = valores.filter((v) => Number.isFinite(v));
  if (!vs.length) return "";
  const todos = [...vs, ...(min != null ? [min] : []), ...(max != null ? [max] : [])];
  let lo = Math.min(...todos), hi = Math.max(...todos);
  if (hi === lo) { hi += 1; lo -= 1; }
  const m = 4;
  const x = (k) => (vs.length === 1 ? ancho / 2 : m + (k / (vs.length - 1)) * (ancho - 2 * m));
  const y = (v) => m + (1 - (v - lo) / (hi - lo)) * (alto - 2 * m);
  const fuera = (v) => (min != null && v < min) || (max != null && v > max);
  const banda = min != null || max != null
    ? `<rect class="rango-g" x="0" width="${ancho}" y="${y(max ?? hi).toFixed(1)}" height="${Math.max(1, y(min ?? lo) - y(max ?? hi)).toFixed(1)}" rx="3"/>` : "";
  const camino = vs.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return `<svg class="chispa" viewBox="0 0 ${ancho} ${alto}" aria-hidden="true">${banda}
    ${vs.length > 1 ? `<path class="linea-g" d="${camino}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
    ${vs.map((v, k) => (fuera(v) || k === vs.length - 1 ? `<circle class="${fuera(v) ? "fuera-g" : "punto-g"}" cx="${x(k).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"/>` : "")).join("")}</svg>`;
}
