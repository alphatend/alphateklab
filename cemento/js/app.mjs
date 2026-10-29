// Bitácora de proceso: el armazón (riel en el iPad y la computadora, pestañas flotantes en el teléfono), las rutas,
// entrar con usuario y contraseña, la bandeja de avisos y lo que falta por enviar. Las demás vistas están en
// vistas-*.mjs.
import "./tema.mjs";
import { esc, icono, hoyPanama, plural, fechaHora, haceCuanto } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, confirmar, vacio, persona, nombre, avatar, esAdmin } from "./ui.mjs";
import { vistaTablero } from "./vistas-tablero.mjs";
import { vistaCalendario } from "./vistas-calendario.mjs";
import { vistaInspecciones, vistaInspeccion, vistaAsignar } from "./vistas-inspecciones.mjs";
import { vistaHallazgos, vistaHallazgo, vistaNuevoHallazgo } from "./vistas-hallazgos.mjs";
import { vistaEquipos, vistaEquipo, vistaPlantilla } from "./vistas-equipos.mjs";
import { vistaColectores } from "./vistas-colectores.mjs";
import { vistaReportes, vistaReporteInspeccion } from "./vistas-reportes.mjs";
import { vistaTromp } from "./vistas-tromp.mjs";
import { vistaAjustes, vistaUsuarios } from "./vistas-ajustes.mjs";

const raiz = document.getElementById("app");
const NAV = [
  { grupo: null, items: [
    { ruta: "tablero", texto: "Tablero", icono: "tablero" },
    { ruta: "calendario", texto: "Calendario", icono: "calendario" },
    { ruta: "inspecciones", texto: "Inspecciones", icono: "inspecciones" },
    { ruta: "hallazgos", texto: "Hallazgos", icono: "hallazgos" },
  ] },
  { grupo: "Planta", items: [
    { ruta: "equipos", texto: "Equipos", icono: "equipos" },
    { ruta: "colectores", texto: "Colectores", icono: "colector" },
  ] },
  { grupo: "Informes", items: [
    { ruta: "reportes", texto: "Reportes", icono: "reportes" },
    { ruta: "tromp", texto: "Curva de Tromp", icono: "tromp" },
  ] },
];
const PESTANAS = [
  { ruta: "tablero", texto: "Tablero", icono: "tablero" },
  { ruta: "calendario", texto: "Calendario", icono: "calendario" },
  { ruta: "equipos", texto: "Equipos", icono: "equipos" },
  { ruta: "colectores", texto: "Colectores", icono: "colector" },
  { ruta: "mas", texto: "Más", icono: "mas" },
];
const VISTAS = {
  tablero: vistaTablero,
  calendario: vistaCalendario,
  inspecciones: vistaInspecciones,
  inspeccion: vistaInspeccion,
  asignar: vistaAsignar,
  hallazgos: vistaHallazgos,
  hallazgo: vistaHallazgo,
  "nuevo-hallazgo": vistaNuevoHallazgo,
  equipos: vistaEquipos,
  equipo: vistaEquipo,
  plantilla: vistaPlantilla,
  colectores: vistaColectores,
  reportes: vistaReportes,
  reporte: vistaReporteInspeccion,
  tromp: vistaTromp,
  ajustes: vistaAjustes,
  usuarios: vistaUsuarios,
  avisos: vistaAvisos,
  pendientes: vistaPendientes,
  mas: vistaMas,
};
// a qué sección pertenece cada vista (para marcarla en el riel y en las pestañas)
const SECCION = {
  inicio: "tablero", inspeccion: "inspecciones", asignar: "inspecciones", hallazgo: "hallazgos", "nuevo-hallazgo": "hallazgos",
  plantilla: "equipos", reporte: "reportes", usuarios: "ajustes",
};
const EN_MAS = new Set(["inspecciones", "hallazgos", "reportes", "tromp", "ajustes", "avisos", "pendientes", "mas"]);

function ruta() {
  const [camino, consulta = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [nombreRuta = "tablero", ...resto] = camino.split("/").map(decodeURIComponent);
  const n = nombreRuta === "inicio" || !nombreRuta ? "tablero" : nombreRuta;
  return { nombre: n, param: resto.join("/"), query: new URLSearchParams(consulta) };
}

// ------------------------------------------------------------------------------- dibujar

let vistaActual = null; // { nombre, param, consulta, desmontar, viva, pendiente }
let armazonListo = false;

function contexto() {
  const d = api.obtener();
  const yo = d && (d.yo ? { ...persona(d, d.yo.id), ...d.yo } : null);
  return { d, yo, hoy: d?.hoy && d.hoy > hoyPanama() ? d.hoy : hoyPanama() };
}
export const nombreApp = () => api.obtener()?.ajustes?.app_nombre || api.marca().app_nombre || "Bitácora de proceso";

export async function dibujar({ forzar = false } = {}) {
  const r = ruta();
  if (!api.sesion.token || !api.obtener()) return dibujarEntrar();
  const { d, yo } = contexto();
  if (!yo) return dibujarEntrar();
  if (yo.debe_cambiar) return dibujarCambiarClave();
  if (!armazonListo) armarArmazon();
  actualizarArmazon(r);
  const misma = vistaActual && vistaActual.nombre === r.nombre && vistaActual.param === r.param && vistaActual.consulta === r.query.toString();
  // las vistas que se están llenando (una inspección, una plantilla) no se redibujan cuando llegan datos nuevos
  if (misma && !forzar && (!vistaActual.viva || vistaActual.pendiente || vistaActual.ocupada?.())) return;
  // se anota ya cuál es la pantalla (la transición la dibuja un momento después): si en ese rato llegan datos nuevos,
  // no se vuelve a dibujar encima y no se borra lo que la persona ya empezó a llenar
  const anterior = vistaActual;
  const esta = (vistaActual = { nombre: r.nombre, param: r.param, consulta: r.query.toString(), viva: false, pendiente: true, desmontar: null });
  const fn = VISTAS[r.nombre] ?? vistaNoExiste;
  const pasar = () => mostrarVista(r, fn, misma, anterior, esta);
  // al cambiar de pantalla, la transición nativa del navegador (la mueve la tarjeta gráfica, a la frecuencia de la
  // pantalla); con «reducir movimiento», o donde no existe, el cambio es directo
  if (!misma && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const t = document.startViewTransition(pasar);
    t.ready.catch(() => {});
    t.finished.catch(() => {});
  } else pasar();
}

function mostrarVista(r, fn, misma, anterior, esta) {
  anterior?.desmontar?.();
  // un <main> nuevo en cada pantalla: así los oyentes que puso la anterior no siguen vivos
  const viejo = document.getElementById("contenido");
  const main = viejo.cloneNode(false);
  viejo.replaceWith(main);
  const scroll = misma ? scrollY : 0;
  let v;
  try {
    v = fn({ ...contexto(), param: r.param, query: r.query, ir, dibujar });
  } catch (e) {
    console.error(e);
    v = { titulo: "Algo falló", html: `<div class="error-carga">No se pudo mostrar esta pantalla: ${esc(e.message)}. <a href="#/tablero">Volver al tablero</a></div>` };
  }
  main.innerHTML = v.html;
  main.classList.toggle("ancho", !!v.ancho);
  document.title = `${v.titulo} · ${nombreApp()}`;
  document.getElementById("titulo-barra").textContent = v.tituloCorto ?? v.titulo;
  const volver = document.getElementById("volver");
  document.body.classList.toggle("en-detalle", !!v.atras);
  volver.hidden = !v.atras;
  if (v.atras) volver.href = v.atras;
  esta.viva = v.viva !== false;
  esta.ocupada = v.ocupada ?? null;
  esta.pendiente = false;
  esta.desmontar = v.montar?.(main) ?? null;
  if (!misma) {
    scrollTo(0, 0);
    main.focus({ preventScroll: true });
  } else scrollTo(0, scroll);
}

export const ir = (hash) => {
  if (location.hash === hash) dibujar({ forzar: true });
  else location.hash = hash;
};

function armarArmazon() {
  const { d } = contexto();
  const logo = d.ajustes?.logo;
  raiz.innerHTML = `<div class="armazon">
    <aside class="riel vidrio" aria-label="Navegación">
      <div class="marca-riel">${logo ? `<img src="${esc(logo)}" alt="">` : ""}<div><div class="nombre-app">${esc(nombreApp())}</div>
        <div class="sub">${esc(d.ajustes?.planta || d.ajustes?.empresa || "Inspecciones y hallazgos")}</div></div></div>
      <nav>${NAV.map((g) => `${g.grupo ? `<div class="grupo-nav">${g.grupo}</div>` : ""}${g.items.map((n) => `<a href="#/${n.ruta}" data-seccion="${n.ruta}">${icono(n.icono)}<span>${n.texto}</span></a>`).join("")}`).join("")}</nav>
      <div class="pie-riel">
        <nav><a href="#/avisos" data-seccion="avisos">${icono("campana")}<span>Avisos</span></a>
          <a href="#/ajustes" data-seccion="ajustes">${icono("ajustes")}<span>Ajustes</span></a></nav>
        <a class="senal" id="senal-riel" href="#/pendientes"></a>
        <a class="yo-riel" href="#/ajustes" id="yo-riel"></a>
      </div>
    </aside>
    <div>
      <header class="barra-sup vidrio">
        <a class="volver" id="volver" href="#/tablero" hidden>${icono("flecha")}<span class="oculto">Atrás</span></a>
        <div class="nombre-app" id="titulo-barra"></div>
        <a class="senal" id="senal-barra" href="#/pendientes"></a>
        <a class="boton-icono" href="#/avisos" id="campana-barra" aria-label="Avisos">${icono("campana")}</a>
      </header>
      <main id="contenido" class="contenido" tabindex="-1"></main>
    </div>
    <nav class="pestanas vidrio" aria-label="Secciones">${PESTANAS.map((n) => `<a href="#/${n.ruta}" data-seccion="${n.ruta}">${icono(n.icono)}<span>${n.texto}</span></a>`).join("")}</nav>
  </div>`;
  armazonListo = true;
}

const avisosNuevos = (d) => {
  const visto = api.LS.leer("bp-avisos-visto") ?? "";
  return (d.avisos ?? []).filter((a) => a.fecha > visto).length;
};

function actualizarArmazon(r) {
  const { d, yo, hoy } = contexto();
  const actual = SECCION[r.nombre] ?? r.nombre;
  document.querySelectorAll("[data-seccion]").forEach((a) => {
    const es = a.dataset.seccion === actual || (a.dataset.seccion === "mas" && EN_MAS.has(actual) && a.closest(".pestanas"));
    if (es) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  // globos: las inspecciones vencidas o de hoy que me tocan; los avisos sin ver
  const mias = d.inspecciones.filter((i) => i.estado === "pendiente" && i.asignada_a === yo.id && i.vence <= hoy).length;
  const nuevos = avisosNuevos(d);
  const globo = (sel, n, etiqueta) => document.querySelectorAll(sel).forEach((a) => {
    a.querySelector(".globo")?.remove();
    if (n) a.insertAdjacentHTML("beforeend", `<span class="globo" aria-label="${etiqueta}">${n > 99 ? "99+" : n}</span>`);
  });
  globo('[data-seccion="tablero"]', mias, `${mias} para hoy o atrasadas`);
  globo('[data-seccion="avisos"], #campana-barra', nuevos, `${nuevos} avisos nuevos`);
  globo('.pestanas [data-seccion="mas"]', nuevos, `${nuevos} avisos nuevos`);
  const yoRiel = document.getElementById("yo-riel");
  if (yoRiel) yoRiel.innerHTML = `${avatar(yo)}<span><b>${esc(yo.nombre)}</b><small>${esc(yo.puesto || (esAdmin(yo) ? "Administrador" : ""))}</small></span>`;
  pintarSenal();
}

function pintarSenal() {
  const n = api.cola.pendientes.length, rech = api.cola.rechazados.length;
  const sin = navigator.onLine === false;
  const texto = rech ? `${plural(rech, "envío falló", "envíos fallaron")}` : n ? `${plural(n, "cosa", "cosas")} por enviar${sin ? " · sin señal" : ""}` : sin ? "Sin señal · todo guardado" : "Al día";
  for (const el of document.querySelectorAll(".senal")) {
    el.className = `senal${sin || rech || n ? " sin" : ""}`;
    el.innerHTML = `${icono(sin ? "sinNube" : "nube")}<span>${texto}</span>`;
    el.setAttribute("aria-label", texto);
    // en el teléfono el ícono de la nube solo aparece cuando hay algo que decir
    if (el.id === "senal-barra") el.hidden = !(sin || rech || n);
  }
}

// ------------------------------------------------------------------------------- entrar

function marcaEntrada() {
  const d = api.obtener();
  const logo = d?.ajustes?.logo;
  return `<div class="marca-app">${logo ? `<img src="${esc(logo)}" alt="">` : ""}${esc(nombreApp())}</div>`;
}

function dibujarEntrar(error = "") {
  armazonListo = false;
  vistaActual = null;
  document.body.classList.remove("en-detalle");
  document.title = `Entrar · ${nombreApp()}`;
  const usuario = api.sesion.usuario ?? "";
  raiz.innerHTML = `<main class="entrar"><form class="caja vidrio" id="form-entrar" novalidate>
      <div>${marcaEntrada()}<h1>Entrar</h1></div>
      <div class="campo"><label for="usuario">Usuario</label>
        <input id="usuario" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(usuario)}" required></div>
      <div class="campo"><label for="clave">Contraseña</label>
        <input id="clave" type="password" autocomplete="current-password" required></div>
      <p class="aviso-error" role="alert" ${error ? "" : "hidden"}>${esc(error)}</p>
      <button class="boton primario ancho" type="submit">Entrar</button>
      <p class="nota-demo">La primera vez, usa la contraseña que te dio el administrador: después eliges la tuya. Funciona sin señal después de entrar.</p>
    </form></main>`;
  const form = document.getElementById("form-entrar");
  const err = form.querySelector(".aviso-error");
  const fallo = (t) => { err.hidden = false; err.textContent = t; };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = form.querySelector("button");
    const u = form.usuario.value.trim().toLowerCase(), c = form.clave.value;
    if (!u || !c) return fallo("Escribe tu usuario y tu contraseña.");
    boton.disabled = true;
    boton.textContent = "Entrando…";
    try {
      await api.entrar(u, c);
      if (!location.hash || location.hash === "#/") location.hash = "#/tablero";
      dibujar({ forzar: true });
    } catch (x) {
      fallo(x.status === 401 ? "Usuario o contraseña equivocados." : x.sinRed ? "Sin señal: para entrar la primera vez hace falta conexión." : x.message);
      boton.disabled = false;
      boton.textContent = "Entrar";
    }
  });
  (usuario ? form.clave : form.usuario).focus();
}

function dibujarCambiarClave() {
  armazonListo = false;
  vistaActual = null;
  const { yo } = contexto();
  document.title = `Tu contraseña · ${nombreApp()}`;
  raiz.innerHTML = `<main class="entrar"><form class="caja vidrio" id="form-clave" novalidate>
      <div>${marcaEntrada()}<h1>Hola, ${esc(yo.nombre.split(" ")[0])}</h1></div>
      <p>Elige tu contraseña. La que te dieron era temporal.</p>
      <input type="text" autocomplete="username" value="${esc(yo.usuario)}" hidden>
      <div class="campo"><label for="actual">Contraseña temporal</label><input id="actual" type="password" autocomplete="current-password"></div>
      <div class="campo"><label for="nueva">Tu contraseña nueva</label><input id="nueva" type="password" autocomplete="new-password">
        <span class="ayuda">Por lo menos 6 caracteres.</span></div>
      <div class="campo"><label for="otra">Otra vez</label><input id="otra" type="password" autocomplete="new-password"></div>
      <p class="aviso-error" role="alert" hidden></p>
      <button class="boton primario ancho" type="submit">Guardar y entrar</button>
      <button class="boton plano ancho" type="button" data-salir>Salir</button>
    </form></main>`;
  const form = document.getElementById("form-clave");
  const err = form.querySelector(".aviso-error");
  form.querySelector("[data-salir]").addEventListener("click", async () => { await api.salir(); dibujarEntrar(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fallo = (t) => { err.hidden = false; err.textContent = t; };
    if (form.nueva.value.length < 6) return fallo("La nueva tiene que tener por lo menos 6 caracteres.");
    if (form.nueva.value !== form.otra.value) return fallo("Las dos contraseñas nuevas no son iguales.");
    const b = form.querySelector("button[type=submit]");
    b.disabled = true;
    try {
      await api.cambiarClave(form.actual.value, form.nueva.value);
      aviso("Listo: ya tienes tu contraseña.");
      dibujar({ forzar: true });
    } catch (x) {
      fallo(x.sinRed ? "Para cambiarla hace falta señal." : x.message);
      b.disabled = false;
    }
  });
  form.actual.focus();
}

// ------------------------------------------------------------------------------- más (teléfono)

function vistaMas({ d, yo }) {
  const nuevos = avisosNuevos(d);
  const fila = (href, ic, color, titulo, detalle = "", extra = "") => `<li><a class="fila con-icono" href="${href}">
      <span class="icono-fila ${color}">${icono(ic)}</span><span class="titulo">${titulo}</span>
      ${detalle ? `<span class="detalle">${detalle}</span>` : ""}<span class="lado horizontal">${extra}${icono("derecha", "ico chevron")}</span></a></li>`;
  const pend = d.inspecciones.filter((i) => i.estado === "pendiente").length;
  const abiertos = d.hallazgos.filter((h) => h.estado !== "cerrado").length;
  return {
    titulo: "Más",
    html: `<div class="cabeza"><div><h1>Más</h1></div></div>
      <ul class="lista"><li><a class="fila con-icono" href="#/ajustes">${avatar(yo)}<span class="titulo">${esc(yo.nombre)}</span>
        <span class="detalle">${esc(yo.puesto || (esAdmin(yo) ? "Administrador" : "Inspector"))} · ${esc(yo.usuario)}</span><span class="lado horizontal">${icono("derecha", "ico chevron")}</span></a></li></ul>
      <section class="seccion"><ul class="lista">
        ${fila("#/inspecciones", "inspecciones", "", "Inspecciones", `${pend} pendientes`)}
        ${fila("#/hallazgos", "hallazgos", "rojo", "Hallazgos", `${abiertos} abiertos`)}
        ${fila("#/reportes", "reportes", "verde", "Reportes", "Por equipo, PDF, Excel y correo")}
        ${fila("#/tromp", "tromp", "indigo", "Curva de Tromp")}
      </ul></section>
      <section class="seccion"><ul class="lista">
        ${fila("#/avisos", "campana", "rojo", "Avisos", "", nuevos ? `<span class="marca alta">${nuevos} nuevos</span>` : "")}
        ${fila("#/pendientes", "nube", "gris", "Por enviar", api.cola.pendientes.length ? plural(api.cola.pendientes.length, "cosa en cola", "cosas en cola") : "Todo enviado")}
        ${fila("#/ajustes", "ajustes", "gris", "Ajustes", "Apariencia, notificaciones, calendario")}
      </ul></section>`,
  };
}

// ------------------------------------------------------------------------------- avisos (la bandeja)

function vistaAvisos({ d, hoy }) {
  const visto = api.LS.leer("bp-avisos-visto") ?? "";
  const xs = d.avisos ?? [];
  return {
    titulo: "Avisos",
    html: `<div class="cabeza"><div><h1>Avisos</h1>
        <p class="bajada">Recordatorios, asignaciones y lo que te mandan. Si activas las notificaciones en Ajustes, también te llegan al teléfono.</p></div></div>
      ${xs.length ? `<ul class="lista bandeja">${xs.map((a) => `<li class="${a.fecha > visto ? "nuevo" : ""}"><a class="fila" href="${esc(a.url || "#/tablero")}">
          <span class="titulo">${esc(a.titulo)}</span><span class="detalle"><span>${esc(a.cuerpo)}</span></span>
          <span class="lado"><small style="color:var(--tinta-3);font-size:13px">${esc(haceCuanto(a.fecha, hoy))}</small></span></a></li>`).join("")}</ul>`
        : vacio("No tienes avisos todavía.")}`,
    montar() {
      if (xs[0]) {
        api.LS.poner("bp-avisos-visto", xs[0].fecha);
        setTimeout(() => actualizarArmazon(ruta()), 600);
      }
    },
  };
}

// ------------------------------------------------------------------------------- pendientes de enviar

function vistaPendientes({ d }) {
  const fila = (p, rechazado) => {
    const que = p.tipo === "media" ? (p.mime?.startsWith("video/") ? "Un video" : "Una foto")
      : /hecha$/.test(p.ruta) ? "Una inspección terminada" : p.ruta === "hallazgos" ? "Un hallazgo nuevo" : /^hallazgos\//.test(p.ruta) ? "Un cambio en un hallazgo" : "Un cambio";
    const otro = p.quien && p.quien !== api.sesion.persona;
    return `<li><div class="fila"><span class="titulo">${que}</span>
      <span class="detalle"><span>${esc(fechaHora(new Date(p.orden).toISOString()))}</span>${p.quien ? `<span>${esc(nombre(d, p.quien))}</span>` : ""}
        ${otro ? `<span style="color:var(--naranja)">Espera a que ${esc(nombre(d, p.quien).split(" ")[0])} entre en este aparato</span>` : ""}
        ${rechazado ? `<span style="color:var(--rojo)">${esc(p.motivo)}</span>` : ""}</span>
      ${rechazado ? `<span class="lado"><button class="boton chico" data-reintentar="${esc(p.id)}">Reintentar</button><button class="boton chico peligro" data-descartar="${esc(p.id)}">Descartar</button></span>`
        : otro ? `<span class="lado"><button class="boton chico peligro" data-descartar-cola="${esc(p.id)}">Descartar</button></span>` : ""}
    </div></li>`;
  };
  const p = api.cola.pendientes, r = api.cola.rechazados;
  return {
    titulo: "Por enviar",
    atras: "#/mas",
    html: `<div class="cabeza"><div><h1>Por enviar</h1>
        <p class="bajada">Lo que se hace sin señal queda guardado en este aparato y se envía solo, en orden, cuando vuelve la conexión.
        ${api.ultimaCarga() ? `Los datos que ves se bajaron el ${esc(fechaHora(api.ultimaCarga()))}.` : ""}</p></div>
        <div class="acciones"><button class="boton primario" data-accion="enviar" ${p.length ? "" : "disabled"}>${icono("nube")}Enviar ahora</button>
        <button class="boton" data-accion="refrescar">Bajar lo último</button></div></div>
      ${api.cola.ultimoError && p.length ? `<p class="nota-asignacion">${esc(api.cola.ultimoError)} Se vuelve a intentar solo.</p>` : ""}
      <section class="seccion"><h2>En cola <small>${p.length || ""}</small></h2>
        ${p.length ? `<ul class="lista">${p.map((x) => fila(x, false)).join("")}</ul>` : vacio("Nada por enviar: todo llegó al servidor.")}</section>
      ${r.length ? `<section class="seccion"><h2>No se pudo enviar <small>${r.length}</small></h2>
        <p style="margin:0 4px 10px;color:var(--tinta-3)">El servidor no los aceptó. No se borran solos: reinténtalos o descártalos.</p>
        <ul class="lista">${r.map((x) => fila(x, true)).join("")}</ul></section>` : ""}`,
    montar(m) {
      m.addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        b.disabled = true;
        try {
          if (b.dataset.accion === "enviar") {
            const r2 = await api.enviarCola();
            aviso(r2.quedan ? `Quedan ${r2.quedan}: ${api.cola.ultimoError ?? "sin señal"}` : "Todo enviado.", { error: !!r2.quedan });
          } else if (b.dataset.accion === "refrescar") {
            await api.refrescar();
            aviso("Datos al día.");
          } else if (b.dataset.reintentar) await api.reintentar(b.dataset.reintentar);
          else if (b.dataset.descartar && (await confirmar("¿Descartarlo?", "Se borra de este aparato y no se envía.", "Descartar", "peligro"))) await api.descartar(b.dataset.descartar);
          else if (b.dataset.descartarCola && (await confirmar("¿Descartarlo?", "Es de otra persona y todavía no se envió. Se borra de este aparato.", "Descartar", "peligro"))) await api.descartar(b.dataset.descartarCola, "cola");
        } catch (x) {
          aviso(x.message, { error: true });
        }
        dibujar({ forzar: true });
      });
    },
  };
}

function vistaNoExiste() {
  return { titulo: "No existe", html: vacio("Esa pantalla no existe.", `<a class="boton" href="#/tablero">Ir al tablero</a>`) };
}

// ------------------------------------------------------------------------------- arranque

export async function cerrarSesion() {
  const mios = api.cola.pendientes.filter((p) => !p.quien || p.quien === api.sesion.persona).length;
  const ok = await confirmar("¿Salir?", mios
    ? `Hay ${plural(mios, "cosa tuya", "cosas tuyas")} sin enviar. Quedan guardadas en este aparato y se envían cuando vuelvas a entrar.`
    : "Para volver a entrar vas a necesitar tu contraseña.", "Salir", "peligro");
  if (!ok) return;
  await api.salir();
  dibujarEntrar();
}

addEventListener("hashchange", () => dibujar());
api.alCambiar(() => {
  if (!armazonListo) return;
  pintarSenal();
  dibujar();
});
api.alVencerSesion(() => {
  aviso("La sesión venció. Entra otra vez: lo que estaba por enviar sigue guardado.", { error: true });
  dibujarEntrar();
});
addEventListener("online", () => { pintarSenal(); aviso("Volvió la señal."); });
addEventListener("offline", () => { pintarSenal(); aviso("Sin señal: puedes seguir trabajando, se guarda en este aparato.", { icono: "sinNube" }); });

// el service worker: la app abre sin señal; una versión nueva se instala cuando la persona quiere. Un toque en una
// notificación abre la pantalla de lo que avisa.
if (("serviceWorker" in navigator && location.protocol === "https:") || location.hostname === "127.0.0.1") {
  navigator.serviceWorker?.register("./sw.js").then((reg) => {
    const ofrecer = (w) => aviso("Hay una versión nueva de la app.", { ms: 10000, accion: { texto: "Actualizar", alTocar: () => w.postMessage("activar") } });
    if (reg.waiting && navigator.serviceWorker.controller) ofrecer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => w.state === "installed" && navigator.serviceWorker.controller && ofrecer(w));
    });
  }).catch(() => {});
  // la primera instalación también dispara «controllerchange»: ahí no se recarga (se perdería lo que se escribe)
  const habiaControlador = !!navigator.serviceWorker?.controller;
  let recargando = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (recargando || !habiaControlador) return;
    recargando = true;
    location.reload();
  });
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data?.tipo === "abrir" && e.data.url) {
      ir(e.data.url);
      api.refrescar().catch(() => {});
    }
  });
}

(async () => {
  await api.iniciar();
  if (await api.sinAlmacen) aviso("Este navegador no deja guardar en el aparato (¿ventana privada?): sin señal no se va a poder trabajar.", { error: true });
  dibujar({ forzar: true });
  if (api.sesion.token) {
    api.refrescar().catch((e) => {
      if (e.status === 403 && /contraseña/.test(e.message)) return dibujar({ forzar: true });
      if (!e.sinRed && e.status !== 401) aviso(e.message, { error: true });
    });
  }
})();
