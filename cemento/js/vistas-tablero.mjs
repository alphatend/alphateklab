// El tablero (la pantalla principal): un kanban de hallazgos (Abierto → En proceso → Para el paro → Cerrado), que se
// mueven arrastrando la tarjeta, y uno de inspecciones (Atrasadas, Hoy, Próximas, Por revisar).
//
// Arrastrar: con el mouse, al mover más de 6 px; en el teléfono, dejando el dedo quieto un momento (así deslizar sigue
// siendo deslizar). Lo que se mueve es una copia fija que solo cambia de transform en cada cuadro; cerca del borde,
// el tablero y la página se deslizan solos. El cambio entra a la cola (funciona sin señal) y se puede deshacer.
import { esc, icono, fechaDia, fechaCorta, plural, numeroHallazgo, diasEntre, haceCuanto } from "./util.mjs";
import * as api from "./api.mjs";
import {
  aviso, dialogo, elegir, equipo, plantilla, persona, nombreCorto, nombreEquipo, queInspeccion, esAdmin, avatar,
  marcaPrioridad, marcaVence, marcaSinEnviar, TEXTO_ESTADO, ESTADOS, ICONO_ESTADO, PUNTO_ESTADO,
} from "./ui.mjs";

const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 };
let scrollGuardado = 0; // el tablero se redibuja cuando llegan datos: que no vuelva a la primera columna

function frase(d, yo, hoy, admin) {
  const pend = d.inspecciones.filter((i) => i.estado === "pendiente" && (admin || i.asignada_a === yo.id));
  const atrasadas = pend.filter((i) => i.vence < hoy).length;
  const deHoy = pend.filter((i) => i.vence === hoy).length;
  const hall = d.hallazgos.filter((h) => h.estado !== "cerrado" && (admin || h.responsable_id === yo.id));
  const altas = hall.filter((h) => h.prioridad === "alta").length;
  const porRevisar = admin ? d.inspecciones.filter((i) => i.estado === "hecha" && !i.revisada_en).length : 0;
  const partes = [];
  if (atrasadas) partes.push(`<a href="#/tablero?v=inspecciones"><b>${plural(atrasadas, "inspección atrasada", "inspecciones atrasadas")}</b></a>`);
  if (deHoy) partes.push(`<b>${plural(deHoy, atrasadas ? "para hoy" : "inspección para hoy", atrasadas ? "para hoy" : "inspecciones para hoy")}</b>`);
  if (hall.length) partes.push(`<a href="#/tablero?v=hallazgos"><b>${plural(hall.length, "hallazgo abierto", "hallazgos abiertos")}</b></a>${altas ? ` (${altas} de prioridad alta)` : ""}`);
  if (porRevisar) partes.push(`<a href="#/tablero?v=inspecciones"><b>${plural(porRevisar, "inspección por revisar", "inspecciones por revisar")}</b></a>`);
  const juntar = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : xs[0]);
  if (!partes.length) return admin ? "Nada atrasado, nada para hoy y ningún hallazgo abierto." : "No tienes nada pendiente ni hallazgos a tu cargo.";
  return `${admin ? "En la planta hay" : "Tienes"} ${juntar(partes)}.`;
}

export function vistaTablero(ctx) {
  const { d, yo, hoy, query } = ctx;
  const admin = esAdmin(yo);
  const v = query.get("v") ?? api.LS.leer("bp-tablero") ?? (admin ? "hallazgos" : "inspecciones");
  const quien = query.get("q") ?? (admin ? "todos" : "mios");
  api.LS.poner("bp-tablero", v);
  const cols = v === "hallazgos" ? columnasHallazgos(ctx, quien) : columnasInspecciones(ctx, quien);
  const enlace = (cambios) => {
    const q = new URLSearchParams({ v, q: quien, ...cambios });
    return `#/tablero?${q}`;
  };
  return {
    titulo: "Tablero",
    tituloCorto: d.ajustes?.app_nombre || "Tablero",
    html: `<div class="cabeza"><div>
        <div class="fecha-hoy">${esc(fechaDia(hoy))}</div>
        <h1>${esc(yo.turno && !admin ? `Turno ${yo.turno}` : `Hola, ${yo.nombre.split(" ")[0]}`)}</h1>
        <p class="resumen-dia">${frase(d, yo, hoy, admin)}</p>
      </div>
      <div class="acciones">
        ${admin ? `<a class="boton primario" href="#/asignar">${icono("mas1")}Asignar</a>` : ""}
        <a class="boton" href="#/nuevo-hallazgo">${icono("hallazgos")}Anotar hallazgo</a>
      </div></div>
      <div class="tablero-barra">
        <div class="segmento vista" role="group" aria-label="Qué tablero">
          <a href="${enlace({ v: "hallazgos" })}" ${v === "hallazgos" ? 'aria-current="true"' : ""}>${icono("hallazgos")}Hallazgos</a>
          <a href="${enlace({ v: "inspecciones" })}" ${v === "inspecciones" ? 'aria-current="true"' : ""}>${icono("inspecciones")}Inspecciones</a>
        </div>
        <nav class="filtros" style="margin:0" aria-label="De quién">
          <a href="${enlace({ q: "mios" })}" ${quien === "mios" ? 'aria-current="true"' : ""}>${v === "hallazgos" ? "A mi cargo" : "Mías"}</a>
          <a href="${enlace({ q: "todos" })}" ${quien === "todos" ? 'aria-current="true"' : ""}>${v === "hallazgos" ? "Todos" : "Todas"}</a>
        </nav>
      </div>
      <div class="columnas-salto" role="tablist" aria-label="Columnas">${cols.map((c, k) => `<button type="button" data-ir-col="${k}" ${k === 0 ? 'aria-current="true"' : ""}>
        <i class="punto ${c.punto}"></i>${esc(c.titulo)} <b>${c.tarjetas.length}</b></button>`).join("")}</div>
      <div class="tablero" data-tablero="${v}">${cols.map((c) => `<section class="columna" data-estado="${c.id}" aria-label="${esc(c.titulo)}">
          <header><i class="punto ${c.punto}"></i><h3>${esc(c.titulo)}</h3><span class="cuenta">${c.cuenta ?? c.tarjetas.length}</span></header>
          <div class="tarjetas">${c.tarjetas.length ? c.tarjetas.join("") : `<div class="nada">${c.nada}</div>`}</div>
          ${c.pie ?? ""}
        </section>`).join("")}</div>
      ${v === "hallazgos" ? `<p class="no-imprimir" style="font-size:14px;color:var(--tinta-3);margin:2px 4px">${matchMedia("(pointer: coarse)").matches ? "Deja el dedo sobre una tarjeta para moverla de columna" : "Arrastra una tarjeta para cambiarla de columna"}, o toca ${icono("arrastrar", "ico chico")}.</p>` : ""}`,
    montar(m) {
      const tablero = m.querySelector(".tablero");
      tablero.scrollLeft = scrollGuardado;
      const saltos = [...m.querySelectorAll("[data-ir-col]")];
      let cuadro = 0;
      const marcarColumna = () => {
        cuadro = 0;
        scrollGuardado = tablero.scrollLeft;
        const ancho = tablero.querySelector(".columna")?.getBoundingClientRect().width ?? 1;
        const k = Math.round(tablero.scrollLeft / (ancho + 14));
        saltos.forEach((b, i) => (i === k ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current")));
      };
      tablero.addEventListener("scroll", () => { cuadro ||= requestAnimationFrame(marcarColumna); }, { passive: true });
      marcarColumna();
      m.addEventListener("click", (e) => {
        const salto = e.target.closest("[data-ir-col]");
        if (salto) {
          const col = tablero.children[Number(salto.dataset.irCol)];
          // las columnas comparten el mismo offsetParent: la diferencia es su lugar dentro del tablero
          tablero.scrollTo({ left: col.offsetLeft - tablero.firstElementChild.offsetLeft, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        }
      });
      const desmontes = [];
      if (v === "hallazgos") desmontes.push(montarHallazgos(m, ctx));
      else desmontes.push(montarInspecciones(m, ctx));
      return () => desmontes.forEach((f) => f?.());
    },
    ocupada: () => !!arrastre,
  };
}

// ------------------------------------------------------------------------------- hallazgos

function tarjetaHallazgo(d, h, hoy) {
  const eq = equipo(d, h.equipo_id);
  const resp = persona(d, h.responsable_id);
  const foto = h.fotos?.[0];
  const tarde = h.vence && h.estado !== "cerrado" && h.vence < hoy;
  return `<article class="tarjeta${foto ? " con-foto" : ""}" data-h="${esc(h.id)}" tabindex="0" aria-label="${esc(`${numeroHallazgo(h)}: ${h.descripcion}`)}">
    <div class="arriba"><span class="num">${numeroHallazgo(h)}</span>${h.estado === "cerrado" ? "" : marcaPrioridad(h.prioridad)}${h._sinEnviar ? marcaSinEnviar() : ""}</div>
    <div class="que">${esc(h.descripcion)}</div>
    <div class="donde"><span>${esc(nombreEquipo(eq))}</span>${h.ot ? `<span class="mono">${esc(h.ot)}</span>` : ""}</div>
    <div class="abajo">${resp ? `${avatar(resp, true)}<span>${esc(nombreCorto(d, resp.id))}</span>` : "<span>Sin responsable</span>"}
      ${h.vence && h.estado !== "cerrado" ? `<span class="${tarde ? "vence-tarde" : ""}">${icono("reloj", "ico chico")} ${esc(fechaCorta(h.vence))}</span>` : ""}
      ${h.estado === "cerrado" && h.cerrado ? `<span>${esc(haceCuanto(h.cerrado, hoy))}</span>` : ""}
      <span class="derecha"><button type="button" class="boton-icono" data-mover style="width:36px;height:36px;margin:-8px -6px -8px 0" aria-label="Mover a otra columna">${icono("arrastrar")}</button></span></div>
    ${foto ? `<img class="foto" src="${esc(api.urlMedio(foto))}" alt="" loading="lazy" onerror="this.remove()">` : ""}
  </article>`;
}

function columnasHallazgos({ d, yo, hoy }, quien) {
  const xs = d.hallazgos.filter((h) => quien === "todos" || h.responsable_id === yo.id);
  const orden = (a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || (a.vence ?? "9").localeCompare(b.vence ?? "9") || (b.creado ?? "").localeCompare(a.creado ?? "");
  const NADA = { abierto: "Nada abierto.", en_proceso: "Nada en proceso.", paro: "Nada esperando el paro.", cerrado: "Nada cerrado en las últimas dos semanas." };
  return ESTADOS.map((e) => {
    let grupo = xs.filter((h) => h.estado === e);
    const total = grupo.length;
    if (e === "cerrado") grupo = grupo.filter((h) => !h.cerrado || diasEntre(h.cerrado.slice(0, 10), hoy) <= 14).sort((a, b) => (b.cerrado ?? "").localeCompare(a.cerrado ?? ""));
    else grupo.sort(orden);
    return {
      id: e, titulo: TEXTO_ESTADO[e], punto: PUNTO_ESTADO[e], nada: NADA[e], cuenta: total,
      tarjetas: grupo.map((h) => tarjetaHallazgo(d, h, hoy)),
      pie: e === "cerrado" && total > grupo.length ? `<p style="margin:10px 6px 2px;font-size:14px"><a href="#/hallazgos?f=cerrados">Ver los ${total} cerrados</a></p>` : "",
    };
  });
}

let arrastre = null;

function montarHallazgos(m, { d, ir }) {
  const tablero = m.querySelector(".tablero");
  let recien = false; // un arrastre termina con un clic que no tiene que abrir la tarjeta

  async function mover(id, estado) {
    const h = d.hallazgos.find((x) => x.id === id);
    if (!h || h.estado === estado) return false;
    let texto = "";
    if (estado === "cerrado") {
      const r = await dialogo({
        titulo: "Cerrar el hallazgo",
        html: `<p>${esc(h.descripcion)}</p><div class="campo"><label for="como">Cómo se resolvió <small>(opcional)</small></label>
          <textarea id="como" placeholder="Por ejemplo: se cambiaron los rascadores 3 y 5"></textarea></div>`,
        botones: [{ texto: "Cancelar", valor: null }, { texto: "Cerrar hallazgo", valor: true, clase: "primario", alElegir: (velo) => { texto = velo.querySelector("#como").value.trim(); } }],
      });
      if (!r) return false;
    }
    const antes = h.estado;
    try {
      await api.encolar(`hallazgos/${encodeURIComponent(id)}`, { estado, texto, seguimiento_id: crypto.randomUUID(), fecha: new Date().toISOString() });
    } catch (x) {
      aviso(x.message, { error: true });
      return false;
    }
    aviso(`${numeroHallazgo(h)} → ${TEXTO_ESTADO[estado]}`, {
      icono: ICONO_ESTADO[estado],
      accion: { texto: "Deshacer", alTocar: () => api.encolar(`hallazgos/${encodeURIComponent(id)}`, { estado: antes, seguimiento_id: crypto.randomUUID(), fecha: new Date().toISOString() }).catch((x) => aviso(x.message, { error: true })) },
    });
    return true;
  }

  m.addEventListener("click", async (e) => {
    const t = e.target.closest(".tarjeta");
    if (!t) return;
    if (recien) { recien = false; return; }
    if (e.target.closest("[data-mover]")) {
      const h = d.hallazgos.find((x) => x.id === t.dataset.h);
      const r = await elegir("Mover a", ESTADOS.map((s) => ({ valor: s, texto: TEXTO_ESTADO[s], icono: ICONO_ESTADO[s] })), { actual: h?.estado });
      if (r) mover(t.dataset.h, r);
      return;
    }
    ir(`#/hallazgo/${encodeURIComponent(t.dataset.h)}`);
  });
  m.addEventListener("keydown", (e) => {
    const t = e.target.closest?.(".tarjeta");
    if (t && (e.key === "Enter" || e.key === " ") && e.target === t) { e.preventDefault(); ir(`#/hallazgo/${encodeURIComponent(t.dataset.h)}`); }
  });
  m.addEventListener("contextmenu", (e) => { if (e.target.closest(".tarjeta") && matchMedia("(pointer: coarse)").matches) e.preventDefault(); });

  // ---- arrastrar
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const columnaEn = (x, y) => document.elementFromPoint(x, y)?.closest?.(".columna");

  function empezar(tarjeta, x, y) {
    const r = tarjeta.getBoundingClientRect();
    const f = tarjeta.cloneNode(true);
    f.classList.remove("preparando");
    f.classList.add("fantasma");
    f.style.width = `${r.width}px`;
    f.style.height = `${r.height}px`;
    f.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
    document.body.append(f);
    arrastre = { tarjeta, id: tarjeta.dataset.h, origen: tarjeta.closest(".columna").dataset.estado, fantasma: f, dx: x - r.left, dy: y - r.top, x, y, destino: null, raf: 0 };
    tarjeta.classList.remove("preparando");
    tarjeta.classList.add("levantada");
    document.documentElement.classList.add("arrastrando");
    tablero.style.scrollSnapType = "none"; // si no, cada paso del deslizamiento automático vuelve a la columna
    navigator.vibrate?.(8);
    arrastre.raf = requestAnimationFrame(cuadro);
  }

  function cuadro() {
    const a = arrastre;
    if (!a) return;
    a.fantasma.style.transform = `translate3d(${a.x - a.dx}px, ${a.y - a.dy}px, 0) rotate(${reducir ? 0 : 1.5}deg) scale(${reducir ? 1 : 1.03})`;
    const col = columnaEn(a.x, a.y);
    if (col !== a.destino) {
      a.destino?.classList.remove("destino");
      if (col && col.dataset.estado !== a.origen) col.classList.add("destino");
      a.destino = col ?? null;
    }
    // cerca del borde se desliza solo: el tablero (teléfono) y la página
    if (tablero.scrollWidth > tablero.clientWidth + 2) {
      const r = tablero.getBoundingClientRect();
      if (a.x < r.left + 36) tablero.scrollLeft -= 14;
      else if (a.x > r.right - 36) tablero.scrollLeft += 14;
    }
    if (a.y < 90) scrollBy(0, -12);
    else if (a.y > innerHeight - 110) scrollBy(0, 12);
    a.raf = requestAnimationFrame(cuadro);
  }

  async function soltar() {
    const a = arrastre;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    a.destino?.classList.remove("destino");
    document.documentElement.classList.remove("arrastrando");
    recien = true;
    setTimeout(() => (recien = false), 400);
    const destino = a.destino && a.destino.dataset.estado !== a.origen ? a.destino : null;
    // la tarjeta va a su columna nueva ya (y la copia vuela a su lugar); si se cancela, vuelve
    const lugar = destino ? destino.querySelector(".tarjetas") : null;
    if (lugar) {
      lugar.querySelector(".nada")?.remove();
      lugar.prepend(a.tarjeta);
    }
    const r = a.tarjeta.getBoundingClientRect();
    if (!reducir) {
      a.fantasma.style.transition = "transform 240ms cubic-bezier(0.22, 1.12, 0.36, 1)";
      a.fantasma.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
      await new Promise((ok) => setTimeout(ok, 240));
    }
    a.fantasma.remove();
    a.tarjeta.classList.remove("levantada");
    tablero.style.scrollSnapType = "";
    arrastre = null;
    if (destino && !(await mover(a.id, destino.dataset.estado))) ir(location.hash); // cancelado: se redibuja como estaba
  }

  function cancelar() {
    if (!arrastre) return;
    arrastre.destino = null;
    soltar();
  }

  // mouse y lápiz: al mover más de 6 px
  let inicio = null;
  m.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    const t = e.target.closest(".tarjeta");
    if (!t || e.target.closest("button, a")) return;
    inicio = { t, x: e.clientX, y: e.clientY };
  });
  const alMover = (e) => {
    if (e.pointerType === "touch") return;
    if (arrastre) { arrastre.x = e.clientX; arrastre.y = e.clientY; return; }
    if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 6) {
      empezar(inicio.t, e.clientX, e.clientY);
      inicio = null;
    }
  };
  const alSoltar = (e) => {
    if (e.pointerType === "touch") return;
    inicio = null;
    if (arrastre) soltar();
  };
  addEventListener("pointermove", alMover);
  addEventListener("pointerup", alSoltar);
  const tecla = (e) => e.key === "Escape" && cancelar();
  addEventListener("keydown", tecla);

  // dedo: dejarlo quieto 320 ms; si se mueve antes, es deslizar (y no se toca)
  m.addEventListener("touchstart", (e) => {
    const t = e.target.closest(".tarjeta");
    if (!t || e.touches.length > 1 || e.target.closest("button, a")) return;
    const p = e.touches[0];
    let x = p.clientX, y = p.clientY;
    const x0 = x, y0 = y;
    const preparar = setTimeout(() => t.classList.add("preparando"), 140);
    const reloj = setTimeout(() => empezar(t, x, y), 320);
    const mov = (ev) => {
      const q = ev.touches[0];
      x = q.clientX; y = q.clientY;
      if (arrastre) { ev.preventDefault(); arrastre.x = x; arrastre.y = y; return; }
      if (Math.hypot(x - x0, y - y0) > 8) fin(false);
    };
    const fin = (soltarSiHay = true) => {
      clearTimeout(reloj);
      clearTimeout(preparar);
      t.classList.remove("preparando");
      t.removeEventListener("touchmove", mov);
      t.removeEventListener("touchend", fin);
      t.removeEventListener("touchcancel", fin);
      if (soltarSiHay && arrastre) soltar();
    };
    t.addEventListener("touchmove", mov, { passive: false });
    t.addEventListener("touchend", fin);
    t.addEventListener("touchcancel", fin);
  }, { passive: true });

  return () => {
    removeEventListener("pointermove", alMover);
    removeEventListener("pointerup", alSoltar);
    removeEventListener("keydown", tecla);
    if (arrastre) { arrastre.fantasma.remove(); cancelAnimationFrame(arrastre.raf); arrastre = null; document.documentElement.classList.remove("arrastrando"); }
  };
}

// ------------------------------------------------------------------------------- inspecciones

function tarjetaInspeccion(d, i, hoy, admin) {
  const pl = plantilla(d, i.plantilla_id);
  const quien = persona(d, i.estado === "hecha" ? i.hecha_por : i.asignada_a);
  const hall = i.estado === "hecha" ? d.hallazgos.filter((h) => h.inspeccion_id === i.id).length : 0;
  const ids = i.equipos?.length ? i.equipos : [i.equipo_id];
  const area = equipo(d, ids[0])?.area;
  return `<article class="tarjeta" data-i="${esc(i.id)}" tabindex="0" aria-label="${esc(`${queInspeccion(d, i)} · ${pl?.nombre ?? ""}`)}">
    <div class="arriba">${i._sinEnviar ? marcaSinEnviar() : marcaVence(i, hoy)}${i.repetir_dias ? `<span class="num">${icono("repetir", "ico chico")}</span>` : ""}</div>
    <div class="que">${esc(queInspeccion(d, i))} · ${esc(pl?.nombre ?? "Inspección")}</div>
    <div class="donde">${area ? `<span>${esc(area)}</span>` : ""}${i.estado === "pendiente" ? `<span>${esc(fechaCorta(i.vence))}</span>` : ""}
      ${i.estado === "hecha" ? `<span>${hall ? plural(hall, "hallazgo", "hallazgos") : "Todo bien"}</span>` : ""}</div>
    <div class="abajo">${quien ? `${avatar(quien, true)}<span>${esc(nombreCorto(d, quien.id))}</span>` : ""}
      <span class="derecha">
        ${admin && i.estado === "pendiente" ? `<button type="button" class="boton mini" data-recordar>${icono("campana")}Recordar</button>` : ""}
        ${admin && i.estado === "hecha" && !i.revisada_en && !i._sinEnviar ? `<button type="button" class="boton mini verde" data-visto>${icono("visto")}Visto bueno</button>` : ""}
      </span></div>
  </article>`;
}

function columnasInspecciones({ d, yo, hoy }, quien) {
  const admin = esAdmin(yo);
  const mias = (i) => quien === "todos" || i.asignada_a === yo.id || i.hecha_por === yo.id;
  const pend = d.inspecciones.filter((i) => i.estado === "pendiente" && mias(i)).sort((a, b) => a.vence.localeCompare(b.vence));
  const semana = pend.filter((i) => i.vence > hoy && diasEntre(hoy, i.vence) <= 7);
  const despues = pend.filter((i) => i.vence > hoy).length - semana.length;
  const hechas = d.inspecciones.filter((i) => i.estado === "hecha" && mias(i) && (admin ? !i.revisada_en : diasEntre((i.hecha_en ?? "").slice(0, 10) || hoy, hoy) <= 7))
    .sort((a, b) => (b.hecha_en ?? "").localeCompare(a.hecha_en ?? ""));
  const t = (xs) => xs.map((i) => tarjetaInspeccion(d, i, hoy, admin));
  return [
    { id: "atrasadas", titulo: "Atrasadas", punto: "rojo", nada: "Nada atrasado.", tarjetas: t(pend.filter((i) => i.vence < hoy)) },
    { id: "hoy", titulo: "Hoy", punto: "naranja", nada: "Nada para hoy.", tarjetas: t(pend.filter((i) => i.vence === hoy)) },
    { id: "proximas", titulo: "Próximos 7 días", punto: "azul", nada: "Nada en la semana.", tarjetas: t(semana),
      pie: despues ? `<p style="margin:10px 6px 2px;font-size:14px"><a href="#/calendario">${plural(despues, "más adelante", "más adelante")} · ver el calendario</a></p>` : "" },
    { id: "hechas", titulo: admin ? "Por revisar" : "Hechas esta semana", punto: "verde", nada: admin ? "Todo revisado." : "Nada todavía.", tarjetas: t(hechas) },
  ];
}

function montarInspecciones(m, { d, ir }) {
  m.addEventListener("click", async (e) => {
    const t = e.target.closest(".tarjeta");
    if (!t) return;
    const id = t.dataset.i;
    const b = e.target.closest("button");
    if (b?.hasAttribute("data-recordar")) {
      b.disabled = true;
      try {
        const r = await api.escribir(`inspecciones/${encodeURIComponent(id)}/recordar`, {});
        const i = d.inspecciones.find((x) => x.id === id);
        aviso(r.entregados ? `Recordatorio enviado a ${nombreCorto(d, i.asignada_a)}.` : `Quedó en sus avisos de la app: ${nombreCorto(d, i.asignada_a)} no tiene notificaciones activadas.`);
      } catch (x) {
        aviso(x.sinRed ? "Para recordar hace falta señal." : x.message, { error: true });
      }
      b.disabled = false;
      return;
    }
    if (b?.hasAttribute("data-visto")) {
      b.disabled = true;
      try {
        await api.escribir(`inspecciones/${encodeURIComponent(id)}/revisar`, {});
        aviso("Visto bueno dado.", { icono: "visto" });
      } catch (x) {
        aviso(x.sinRed ? "Para el visto bueno hace falta señal." : x.message, { error: true });
        b.disabled = false;
      }
      return;
    }
    ir(`#/inspeccion/${encodeURIComponent(id)}`);
  });
  m.addEventListener("keydown", (e) => {
    const t = e.target.closest?.(".tarjeta");
    if (t && (e.key === "Enter" || e.key === " ") && e.target === t) { e.preventDefault(); ir(`#/inspeccion/${encodeURIComponent(t.dataset.i)}`); }
  });
}
