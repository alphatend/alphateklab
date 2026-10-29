// Bitácora de proceso: el armazón (riel en el iPad y la computadora, pestañas flotantes en el teléfono), las rutas, la
// entrada y el inicio. Las demás vistas están en vistas-*.mjs.
import { esc, icono, hoyPanama, fechaDia, plural, fechaHora } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, confirmar, filaInspeccion, filaHallazgo, vacio, persona, inicial, nombre } from "./ui.mjs";
import { vistaInspecciones, vistaInspeccion, vistaAsignar } from "./vistas-inspecciones.mjs";
import { vistaHallazgos, vistaHallazgo, vistaNuevoHallazgo } from "./vistas-hallazgos.mjs";
import { vistaEquipos, vistaEquipo, vistaPlantilla } from "./vistas-equipos.mjs";
import { vistaReportes, vistaReporteInspeccion } from "./vistas-reportes.mjs";
import { vistaTromp } from "./vistas-tromp.mjs";

const raiz = document.getElementById("app");
const NAV = [
  { ruta: "inicio", texto: "Inicio", icono: "inicio" },
  { ruta: "inspecciones", texto: "Inspecciones", icono: "inspecciones" },
  { ruta: "hallazgos", texto: "Hallazgos", icono: "hallazgos" },
  { ruta: "equipos", texto: "Equipos", icono: "equipos" },
  { ruta: "reportes", texto: "Reportes", icono: "reportes" },
];
const NAV_EXTRA = [{ ruta: "tromp", texto: "Curva de Tromp", icono: "tromp" }];
const VISTAS = {
  inicio: vistaInicio,
  inspecciones: vistaInspecciones,
  inspeccion: vistaInspeccion,
  asignar: vistaAsignar,
  hallazgos: vistaHallazgos,
  hallazgo: vistaHallazgo,
  "nuevo-hallazgo": vistaNuevoHallazgo,
  equipos: vistaEquipos,
  equipo: vistaEquipo,
  plantilla: vistaPlantilla,
  reportes: vistaReportes,
  reporte: vistaReporteInspeccion,
  tromp: vistaTromp,
  pendientes: vistaPendientes,
};
// a qué pestaña pertenece cada vista
const PESTANA = { inspeccion: "inspecciones", asignar: "inspecciones", hallazgo: "hallazgos", "nuevo-hallazgo": "hallazgos", equipo: "equipos", plantilla: "equipos", reporte: "reportes" };

function ruta() {
  const [camino, consulta = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [nombreRuta = "inicio", ...resto] = camino.split("/").map(decodeURIComponent);
  return { nombre: nombreRuta || "inicio", param: resto.join("/"), query: new URLSearchParams(consulta) };
}

// ------------------------------------------------------------------------------- dibujar

let vistaActual = null; // { nombre, param, desmontar, viva }
let armazonListo = false;

function contexto() {
  const d = api.obtener();
  const yo = d && persona(d, api.sesion.persona);
  return { d, yo, hoy: d?.hoy && d.hoy > hoyPanama() ? d.hoy : hoyPanama() };
}

export async function dibujar({ forzar = false } = {}) {
  const r = ruta();
  if (!api.sesion.token || !api.obtener()) return dibujarEntrar();
  const { d, yo } = contexto();
  if (!yo || r.nombre === "quien") return dibujarElegirPersona(d);
  if (!armazonListo) armarArmazon();
  actualizarArmazon(r);
  const misma = vistaActual && vistaActual.nombre === r.nombre && vistaActual.param === r.param && vistaActual.consulta === r.query.toString();
  // las vistas que se están llenando (una inspección, una plantilla) no se redibujan cuando llegan datos nuevos
  if (misma && !forzar && (!vistaActual.viva || vistaActual.pendiente)) return;
  // se anota ya cuál es la pantalla (la transición la dibuja un momento después): si en ese rato llegan datos nuevos,
  // no se vuelve a dibujar encima y no se borra lo que la persona ya empezó a llenar
  const anterior = vistaActual;
  const esta = (vistaActual = { nombre: r.nombre, param: r.param, consulta: r.query.toString(), viva: false, pendiente: true, desmontar: null });
  const fn = VISTAS[r.nombre] ?? vistaNoExiste;
  const pasar = () => mostrarVista(r, fn, misma, anterior, esta);
  // al cambiar de pantalla, la transición nativa del navegador (la mueve la tarjeta gráfica, a la frecuencia de la
  // pantalla); con «reducir movimiento», o donde no existe, el cambio es directo
  if (!misma && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // si se cambia de pantalla otra vez antes de que termine, la transición se salta: no es un error
    const t = document.startViewTransition(pasar);
    t.ready.catch(() => {});
    t.finished.catch(() => {});
  } else pasar();
}

function mostrarVista(r, fn, misma, anterior, esta) {
  anterior?.desmontar?.();
  // un <main> nuevo en cada pantalla: así los oyentes que puso la anterior no siguen vivos (un clic en «Asignar» no
  // puede llegarle a la pantalla de «Por enviar» que se vio antes)
  const viejo = document.getElementById("contenido");
  const main = viejo.cloneNode(false);
  viejo.replaceWith(main);
  const scroll = misma ? scrollY : 0;
  let v;
  try {
    v = fn({ ...contexto(), param: r.param, query: r.query, ir, dibujar });
  } catch (e) {
    console.error(e);
    v = { titulo: "Algo falló", html: `<div class="error-carga">No se pudo mostrar esta pantalla: ${esc(e.message)}. <a href="#/inicio">Volver al inicio</a></div>` };
  }
  main.innerHTML = v.html;
  document.title = `${v.titulo} · Bitácora de proceso`;
  document.getElementById("titulo-barra").textContent = v.tituloCorto ?? v.titulo;
  const volver = document.getElementById("volver");
  document.body.classList.toggle("en-detalle", !!v.atras);
  volver.hidden = !v.atras;
  if (v.atras) volver.href = v.atras;
  esta.viva = v.viva !== false;
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
  raiz.innerHTML = `<div class="armazon">
    <aside class="riel vidrio" aria-label="Navegación">
      <div class="nombre-app">Bitácora de proceso</div>
      <div class="sub">Inspecciones y hallazgos</div>
      <nav>${[...NAV, ...NAV_EXTRA].map((n) => `<a href="#/${n.ruta}" data-pestana="${n.ruta}">${icono(n.icono)}<span>${n.texto}</span></a>`).join("")}</nav>
      <div class="pie-riel">
        <a class="senal" id="senal-riel" href="#/pendientes"></a>
        <button type="button" class="quien" data-accion="cambiar-persona"></button>
      </div>
    </aside>
    <div>
      <header class="barra-sup vidrio">
        <a class="volver" id="volver" href="#/inicio" hidden>${icono("flecha")}<span class="oculto">Atrás</span></a>
        <div class="nombre-app" id="titulo-barra"></div>
        <a class="senal" id="senal-barra" href="#/pendientes"></a>
        <button type="button" class="quien" data-accion="cambiar-persona"></button>
      </header>
      <main id="contenido" class="contenido" tabindex="-1"></main>
    </div>
    <nav class="pestanas vidrio" aria-label="Secciones">${NAV.map((n) => `<a href="#/${n.ruta}" data-pestana="${n.ruta}">${icono(n.icono)}<span>${n.texto}</span></a>`).join("")}</nav>
  </div>`;
  raiz.addEventListener("click", async (e) => {
    if (e.target.closest('[data-accion="cambiar-persona"]')) {
      const { d } = contexto();
      const pendientes = api.cola.pendientes.length;
      const ok = await confirmar("¿Cambiar de persona?", pendientes
        ? `Hay ${plural(pendientes, "cosa", "cosas")} por enviar; se envían igual, a nombre de quien las hizo.`
        : `Ahora estás como ${esc(nombre(d, api.sesion.persona))}.`, "Cambiar");
      if (ok) ir("#/quien");
    }
  });
  armazonListo = true;
}

function actualizarArmazon(r) {
  const { d, yo, hoy } = contexto();
  const actual = PESTANA[r.nombre] ?? r.nombre;
  document.querySelectorAll("[data-pestana]").forEach((a) => {
    if (a.dataset.pestana === actual) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  // globo: las inspecciones vencidas o de hoy que me tocan
  const mias = d.inspecciones.filter((i) => i.estado === "pendiente" && i.asignada_a === yo.id && i.vence <= hoy).length;
  document.querySelectorAll('[data-pestana="inspecciones"]').forEach((a) => {
    a.querySelector(".globo")?.remove();
    if (mias) a.insertAdjacentHTML("beforeend", `<span class="globo" aria-label="${mias} para hoy o atrasadas">${mias}</span>`);
  });
  document.querySelectorAll('[data-accion="cambiar-persona"]').forEach((b) => {
    b.innerHTML = `<span class="letra-inicial" aria-hidden="true">${esc(inicial(yo.nombre))}</span><span>${esc(yo.nombre)}</span>`;
    b.setAttribute("aria-label", `Estás como ${yo.nombre}. Cambiar de persona`);
  });
  pintarSenal();
}

function pintarSenal() {
  const n = api.cola.pendientes.length, rech = api.cola.rechazados.length;
  const sin = navigator.onLine === false;
  const texto = rech ? `${plural(rech, "envío falló", "envíos fallaron")}` : n ? `${plural(n, "cosa", "cosas")} por enviar${sin ? " · sin señal" : ""}` : sin ? "Sin señal · todo guardado" : "Al día";
  for (const el of document.querySelectorAll(".senal")) {
    el.className = `senal${sin || rech ? " sin" : ""}`;
    el.innerHTML = `${icono(sin ? "sinNube" : "nube")}<span>${texto}</span>`;
    el.setAttribute("aria-label", texto);
  }
}

// ------------------------------------------------------------------------------- entrar

function dibujarEntrar(error = "") {
  armazonListo = false;
  vistaActual = null;
  document.title = "Entrar · Bitácora de proceso";
  raiz.innerHTML = `<main class="entrar"><form class="caja vidrio" id="form-entrar" novalidate>
      <div><div class="marca-app">Bitácora de proceso</div><h1>Inspecciones de planta</h1></div>
      <p>Escribe el código de tu equipo para entrar.</p>
      <div class="campo"><label for="codigo">Código del equipo</label>
        <input id="codigo" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" required></div>
      <p class="aviso-error" role="alert" style="color:var(--rojo);font-weight:600" ${error ? "" : "hidden"}>${esc(error)}</p>
      <button class="boton primario ancho" type="submit">Entrar</button>
      <p class="nota-demo">Demostración con datos de ejemplo. Funciona sin señal después de entrar la primera vez.</p>
    </form></main>`;
  const form = document.getElementById("form-entrar");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = form.querySelector("button");
    const codigo = form.codigo.value.trim();
    const err = form.querySelector(".aviso-error");
    if (!codigo) { err.hidden = false; err.textContent = "Escribe el código."; return; }
    boton.disabled = true;
    boton.textContent = "Entrando…";
    try {
      await api.entrar(codigo);
      ir(api.sesion.persona ? "#/inicio" : "#/quien");
      dibujar({ forzar: true });
    } catch (x) {
      err.hidden = false;
      err.textContent = x.status === 401 ? "Ese código no es. Revísalo y prueba otra vez." : x.message;
      boton.disabled = false;
      boton.textContent = "Entrar";
    }
  });
  form.codigo.focus();
}

function dibujarElegirPersona(d) {
  armazonListo = false;
  vistaActual = null;
  document.title = "¿Quién eres? · Bitácora de proceso";
  raiz.innerHTML = `<main class="entrar"><div class="caja vidrio">
      <div><div class="marca-app">Bitácora de proceso</div><h1>¿Quién eres?</h1></div>
      <p>Así lo que hagas queda a tu nombre y ves lo que te toca.</p>
      <div class="personas">${d.personas.map((p) => `<button type="button" data-persona="${esc(p.id)}">
        <span class="letra-inicial" aria-hidden="true">${esc(inicial(p.nombre))}</span>
        <span>${esc(p.nombre)}<small>${esc(p.turno ?? "")}</small></span></button>`).join("")}</div>
      <p class="nota-demo">En esta demostración cualquiera puede elegir cualquier nombre.</p>
    </div></main>`;
  raiz.querySelectorAll("[data-persona]").forEach((b) =>
    b.addEventListener("click", () => {
      api.sesion.persona = b.dataset.persona;
      location.hash = "#/inicio";
      dibujar({ forzar: true });
    }),
  );
}

// ------------------------------------------------------------------------------- inicio

function vistaInicio({ d, yo, hoy }) {
  const esIng = yo.rol === "ingeniero";
  const pend = d.inspecciones.filter((i) => i.estado === "pendiente");
  const base = esIng ? pend : pend.filter((i) => i.asignada_a === yo.id);
  const atrasadas = base.filter((i) => i.vence < hoy).sort((a, b) => a.vence.localeCompare(b.vence));
  const deHoy = base.filter((i) => i.vence === hoy);
  const proximas = base.filter((i) => i.vence > hoy).sort((a, b) => a.vence.localeCompare(b.vence));
  const abiertos = d.hallazgos.filter((h) => h.estado !== "cerrado");
  const misHallazgos = esIng ? abiertos : abiertos.filter((h) => h.responsable_id === yo.id);
  const altas = misHallazgos.filter((h) => h.prioridad === "alta");

  // una frase, con las cifras adentro: «Tienes 1 inspección atrasada, 1 para hoy y 2 hallazgos abiertos.»
  const partes = [];
  if (atrasadas.length) partes.push(`<a href="#/inspecciones?f=${esIng ? "atrasadas" : "mias"}"><b>${plural(atrasadas.length, "inspección atrasada", "inspecciones atrasadas")}</b></a>`);
  if (deHoy.length) partes.push(`<b>${plural(deHoy.length, atrasadas.length ? "para hoy" : "inspección para hoy", atrasadas.length ? "para hoy" : "inspecciones para hoy")}</b>`);
  if (misHallazgos.length) {
    partes.push(`<a href="#/hallazgos${esIng ? "" : "?f=mios"}"><b>${plural(misHallazgos.length, "hallazgo abierto", "hallazgos abiertos")}</b></a>${altas.length ? ` (${altas.length} de prioridad alta)` : ""}`);
  }
  const juntar = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : xs[0]);
  const resumen = partes.length
    ? `${esIng ? "En la planta hay" : "Tienes"} ${juntar(partes)}.`
    : esIng ? "Nada atrasado, nada para hoy y ningún hallazgo abierto." : "No tienes nada pendiente ni hallazgos a tu cargo.";
  const lista = (xs) => `<ul class="lista">${xs.map((i) => filaInspeccion(d, i, hoy, { mostrarQuien: esIng })).join("")}</ul>`;
  const ahora = [...atrasadas, ...deHoy];
  const sinEnviar = api.cola.pendientes.length;
  return {
    titulo: "Inicio",
    html: `
      <div class="cabeza"><div>
        <div class="fecha-hoy">${esc(fechaDia(hoy))}</div>
        <h1>${esc(yo.rol === "jefe" ? yo.turno : `Hola, ${yo.nombre.split(" ")[0]}`)}</h1>
        <p class="resumen-dia">${resumen}</p>
      </div></div>
      ${sinEnviar ? `<p class="nota-asignacion">${icono("nube", "ico chico")} Hay ${plural(sinEnviar, "cosa guardada", "cosas guardadas")} en este aparato que se van a enviar solas cuando haya señal. <a href="#/pendientes">Ver</a></p>` : ""}
      <div class="atajos">
        ${esIng ? `<a class="boton primario" href="#/asignar">${icono("mas1")}Asignar inspección</a>` : ""}
        <a class="boton" href="#/nuevo-hallazgo">${icono("hallazgos")}Anotar un hallazgo</a>
        ${esIng ? `<a class="boton" href="#/reportes">${icono("reportes")}Reporte de la semana</a>` : ""}
      </div>
      <div class="dos-columnas">
        <div>
          <section class="seccion"><h2>${esIng ? "Atrasadas y de hoy" : "Lo tuyo para hoy"} <small>${ahora.length || ""}</small></h2>
            ${ahora.length ? lista(ahora) : vacio(esIng ? "Nada atrasado ni para hoy." : "No tienes nada pendiente para hoy.", esIng ? `<a class="boton chico" href="#/asignar">${icono("mas1")}Asignar una inspección</a>` : "")}
          </section>
          ${proximas.length ? `<section class="seccion"><h2>Próximas <small>${proximas.length}</small></h2>${lista(proximas.slice(0, 6))}
            ${proximas.length > 6 ? `<p style="margin:10px 4px"><a href="#/inspecciones?f=${esIng ? "todas" : "mias"}">Ver las ${proximas.length}</a></p>` : ""}</section>` : ""}
        </div>
        <div>
          <section class="seccion"><h2>${esIng ? "Hallazgos abiertos" : "Hallazgos a tu cargo"} <small>${misHallazgos.length || ""}</small></h2>
            ${misHallazgos.length ? `<ul class="lista">${[...misHallazgos].sort((a, b) => "alta media baja".indexOf(a.prioridad) - "alta media baja".indexOf(b.prioridad)).slice(0, 6).map((h) => filaHallazgo(d, h, hoy)).join("")}</ul>` : vacio("Ningún hallazgo abierto.")}
          </section>
          ${esIng ? `<section class="seccion"><h2>Herramientas</h2><ul class="lista"><li><a class="fila" href="#/tromp">
            <span class="titulo">Curva de Tromp</span><span class="detalle">Bypass, corte y carga circulante del separador, con los tamizados.</span>
            <span class="lado">${icono("tromp")}</span></a></li></ul></section>` : ""}
        </div>
      </div>`,
  };
}

// ------------------------------------------------------------------------------- pendientes de enviar

function vistaPendientes({ d }) {
  const fila = (p, rechazado) => {
    const que = p.tipo === "media" ? (p.mime?.startsWith("video/") ? "Un video" : "Una foto")
      : /hecha$/.test(p.ruta) ? "Una inspección terminada" : p.ruta === "hallazgos" ? "Un hallazgo nuevo" : /^hallazgos\//.test(p.ruta) ? "Un cambio en un hallazgo" : "Un cambio";
    return `<li><div class="fila"><span class="titulo">${que}</span>
      <span class="detalle"><span>${esc(fechaHora(new Date(p.orden).toISOString()))}</span>${p.datos?.quien ? `<span>${esc(nombre(d, p.datos.quien))}</span>` : ""}${rechazado ? `<span style="color:var(--rojo)">${esc(p.motivo)}</span>` : ""}</span>
      ${rechazado ? `<span class="lado"><button class="boton chico" data-reintentar="${esc(p.id)}">Reintentar</button><button class="boton chico peligro" data-descartar="${esc(p.id)}">Descartar</button></span>` : ""}
    </div></li>`;
  };
  const p = api.cola.pendientes, r = api.cola.rechazados;
  return {
    titulo: "Por enviar",
    atras: "#/inicio",
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
        } catch (x) {
          aviso(x.message, { error: true });
        }
        dibujar({ forzar: true });
      });
    },
  };
}

function vistaNoExiste() {
  return { titulo: "No existe", html: vacio("Esa pantalla no existe.", `<a class="boton" href="#/inicio">Ir al inicio</a>`) };
}

// ------------------------------------------------------------------------------- arranque

addEventListener("hashchange", () => dibujar());
api.alCambiar(() => {
  if (!armazonListo) return;
  pintarSenal();
  dibujar();
});
api.alVencerSesion(() => {
  aviso("La sesión venció. Entra otra vez con el código: lo que estaba por enviar sigue guardado.", { error: true });
  dibujarEntrar();
});
addEventListener("online", () => { pintarSenal(); aviso("Volvió la señal."); });
addEventListener("offline", () => { pintarSenal(); aviso("Sin señal: puedes seguir trabajando, se guarda en este aparato.", { icono: "sinNube" }); });

// el service worker: la app abre sin señal; una versión nueva se instala cuando la persona quiere
if ("serviceWorker" in navigator && location.protocol === "https:" || location.hostname === "127.0.0.1") {
  navigator.serviceWorker?.register("./sw.js").then((reg) => {
    const ofrecer = (w) => {
      aviso("Hay una versión nueva de la app.", { ms: 8000 });
      const b = document.createElement("button");
      b.className = "boton primario chico";
      b.textContent = "Actualizar";
      b.onclick = () => w.postMessage("activar");
      document.querySelector(".aviso")?.append(b);
    };
    if (reg.waiting && navigator.serviceWorker.controller) ofrecer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => w.state === "installed" && navigator.serviceWorker.controller && ofrecer(w));
    });
  }).catch(() => {});
  let recargando = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (recargando) return;
    recargando = true;
    location.reload();
  });
}

(async () => {
  if (await api.sinAlmacen) aviso("Este navegador no deja guardar en el aparato (¿ventana privada?): sin señal no se va a poder trabajar.", { error: true });
  dibujar({ forzar: true });
  if (api.sesion.token) api.refrescar().catch((e) => { if (!e.sinRed && e.status !== 401) aviso(e.message, { error: true }); });
})();
