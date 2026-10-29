// El calendario: las inspecciones por su fecha límite y las fechas compromiso de los hallazgos. Mes en el iPad y la
// computadora; en el teléfono, la semana y la agenda. Elegir un día cambia solo lo de abajo (sin redibujar todo).
// «Suscribirse» da el enlace .ics de cada persona para Google Calendar, Apple u Outlook.
import { esc, icono, fechaDia, fechaCorta, sumarDias, nombreMes, DIAS_CORTOS, diaSemana, plural, numeroHallazgo } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, dialogo, vacio, plantilla, nombreCorto, queInspeccion, esAdmin, filaInspeccion, marcaPrioridad } from "./ui.mjs";

function eventos(d, yo, hoy, quien) {
  const porDia = new Map();
  const poner = (dia, ev) => (porDia.get(dia) ?? porDia.set(dia, []).get(dia)).push(ev);
  for (const i of d.inspecciones) {
    if (quien === "mios" && i.asignada_a !== yo.id && i.hecha_por !== yo.id) continue;
    const clase = i.estado === "hecha" ? "hecha" : i.vence < hoy ? "atrasada" : "";
    poner(i.vence, { tipo: "insp", i, clase, texto: `${queInspeccion(d, i)} · ${plantilla(d, i.plantilla_id)?.nombre ?? ""}` });
  }
  for (const h of d.hallazgos) {
    if (!h.vence || h.estado === "cerrado" || (quien === "mios" && h.responsable_id !== yo.id)) continue;
    poner(h.vence, { tipo: "hall", h, clase: "compromiso", texto: `${numeroHallazgo(h)} ${h.descripcion}` });
  }
  for (const xs of porDia.values()) xs.sort((a, b) => ({ atrasada: 0, "": 1, compromiso: 2, hecha: 3 })[a.clase] - ({ atrasada: 0, "": 1, compromiso: 2, hecha: 3 })[b.clase]);
  return porDia;
}

function agenda(d, yo, hoy, porDia, dia, admin) {
  const xs = porDia.get(dia) ?? [];
  const filas = xs.map((ev) => ev.tipo === "insp" ? filaInspeccion(d, ev.i, hoy) : `<li><a class="fila" href="#/hallazgo/${encodeURIComponent(ev.h.id)}">
      <span class="titulo">${esc(ev.h.descripcion)}</span><span class="detalle"><span class="mono">${numeroHallazgo(ev.h)}</span><span>Fecha compromiso</span>
      ${ev.h.responsable_id ? `<span>${esc(nombreCorto(d, ev.h.responsable_id))}</span>` : ""}</span>
      <span class="lado"><span class="marca paro">${icono("reloj")}Compromiso</span>${marcaPrioridad(ev.h.prioridad)}</span></a></li>`);
  return `<div class="agenda-dia${dia === hoy ? " es-hoy" : ""}"><h3>${esc(fechaDia(dia))}${dia === hoy ? " · hoy" : ""}</h3>
    ${filas.length ? `<ul class="lista">${filas.join("")}</ul>` : vacio("Nada este día.")}
    ${admin ? `<div style="margin-top:10px"><a class="boton chico" href="#/asignar?vence=${dia}">${icono("mas1")}Asignar para el ${esc(fechaCorta(dia))}</a></div>` : ""}</div>`;
}

export function vistaCalendario({ d, yo, hoy, query }) {
  const admin = esAdmin(yo);
  const quien = query.get("q") ?? (admin ? "todos" : "mios");
  let elegido = query.get("d") ?? hoy;
  const mes = (query.get("m") ?? elegido.slice(0, 7)) + "-01";
  const porDia = eventos(d, yo, hoy, quien);
  // la cuadrícula: de lunes a domingo, las semanas que toca el mes
  const primero = sumarDias(mes, -diaSemana(mes));
  const finMes = sumarDias(sumarDias(mes, 32).slice(0, 8) + "01", -1);
  const dias = [];
  for (let x = primero; x <= finMes || diaSemana(x) !== 0; x = sumarDias(x, 1)) dias.push(x);
  const mesAnterior = sumarDias(mes, -1).slice(0, 7), mesSiguiente = sumarDias(finMes, 1).slice(0, 7);
  const enlace = (cambios) => `#/calendario?${new URLSearchParams({ q: quien, ...(query.get("m") ? { m: query.get("m") } : {}), ...cambios })}`;
  const celda = (x) => {
    const xs = porDia.get(x) ?? [];
    return `<button type="button" class="dia${x.slice(0, 7) !== mes.slice(0, 7) ? " fuera" : ""}${x === hoy ? " hoy" : ""}${x === elegido ? " elegido" : ""}" data-dia="${x}"
        aria-label="${esc(fechaDia(x))}: ${xs.length ? plural(xs.length, "cosa", "cosas") : "nada"}">
      <span class="num-dia">${Number(x.slice(8))}</span>
      ${xs.slice(0, 3).map((ev) => `<span class="chip-cal ${ev.clase}">${esc(ev.texto)}</span>`).join("")}
      ${xs.length > 3 ? `<span class="chip-cal mas">+${xs.length - 3} más</span>` : ""}
    </button>`;
  };
  const semana = (dia) => {
    const lunes = sumarDias(dia, -diaSemana(dia));
    return [0, 1, 2, 3, 4, 5, 6].map((k) => {
      const x = sumarDias(lunes, k);
      const xs = porDia.get(x) ?? [];
      return `<button type="button" data-dia="${x}" class="${x === hoy ? "hoy" : ""}${x === elegido ? " elegido" : ""}" aria-label="${esc(fechaDia(x))}">
        <small>${DIAS_CORTOS[k]}</small><span class="num-dia">${Number(x.slice(8))}</span>
        <span class="puntos-dia">${xs.slice(0, 3).map((ev) => `<i class="${ev.clase}"></i>`).join("")}</span></button>`;
    }).join("");
  };
  const proximos = () => {
    const xs = [];
    for (let k = 1; k <= 14; k++) {
      const x = sumarDias(elegido, k);
      if (porDia.get(x)?.length) xs.push(agenda(d, yo, hoy, porDia, x, false));
    }
    return xs.length ? `<section class="seccion"><h2>Lo que viene</h2>${xs.join("")}</section>` : "";
  };
  return {
    titulo: "Calendario",
    html: `<div class="cabeza"><div><h1>Calendario</h1>
        <p class="bajada">${admin ? "Las inspecciones de todos por su fecha límite y las fechas compromiso de los hallazgos." : "Tus inspecciones y los compromisos de tus hallazgos."}</p></div>
        <div class="acciones"><button type="button" class="boton" data-accion="suscribir">${icono("enlace")}Ponerlo en mi calendario</button>
          ${admin ? `<a class="boton primario" href="#/asignar?vence=${elegido}">${icono("mas1")}Asignar</a>` : ""}</div></div>
      <div class="cal-barra">
        <h2>${esc(nombreMes(mes))}</h2>
        <div class="flechas"><a class="boton-icono" href="${enlace({ m: mesAnterior })}" aria-label="Mes anterior">${icono("flecha")}</a>
          <a class="boton-icono" href="${enlace({ m: mesSiguiente })}" aria-label="Mes siguiente">${icono("derecha")}</a></div>
        <a class="boton chico" href="#/calendario?${new URLSearchParams({ q: quien })}">Hoy</a>
        <nav class="filtros derecha" style="margin:0" aria-label="De quién">
          <a href="${enlace({ q: "mios" })}" ${quien === "mios" ? 'aria-current="true"' : ""}>Mío</a>
          <a href="${enlace({ q: "todos" })}" ${quien === "todos" ? 'aria-current="true"' : ""}>Todos</a></nav>
      </div>
      <div class="mes" role="grid">${DIAS_CORTOS.map((x) => `<div class="dia-sem">${x}</div>`).join("")}${dias.map(celda).join("")}</div>
      <div class="cal-telefono">
        <div class="cal-barra" style="margin-bottom:8px"><button type="button" class="boton-icono" data-semana="-7" aria-label="Semana anterior">${icono("flecha")}</button>
          <span style="flex:1;text-align:center;font-weight:600;color:var(--tinta-3)" data-rotulo-semana></span>
          <button type="button" class="boton-icono" data-semana="7" aria-label="Semana siguiente">${icono("derecha")}</button></div>
        <div class="semana-tira" data-semana-tira>${semana(elegido)}</div>
      </div>
      <div data-agenda>${agenda(d, yo, hoy, porDia, elegido, admin)}</div>
      <div data-proximos class="cal-telefono">${proximos()}</div>`,
    montar(m) {
      const rotulo = () => {
        const l = sumarDias(elegido, -diaSemana(elegido));
        m.querySelector("[data-rotulo-semana]").textContent = `${fechaCorta(l)} – ${fechaCorta(sumarDias(l, 6))}`;
      };
      rotulo();
      const elegir = (x) => {
        elegido = x;
        m.querySelectorAll("[data-dia]").forEach((b) => b.classList.toggle("elegido", b.dataset.dia === x));
        m.querySelector("[data-agenda]").innerHTML = agenda(d, yo, hoy, porDia, x, admin);
        m.querySelector("[data-proximos]").innerHTML = proximos();
        const q = new URLSearchParams(location.hash.split("?")[1] ?? "");
        q.set("d", x);
        history.replaceState(null, "", `#/calendario?${q}`);
      };
      m.addEventListener("click", async (e) => {
        const dia = e.target.closest("[data-dia]");
        if (dia) {
          // en el mes, un día de otro mes lleva a ese mes
          if (dia.classList.contains("fuera")) location.hash = enlace({ m: dia.dataset.dia.slice(0, 7), d: dia.dataset.dia });
          else elegir(dia.dataset.dia);
          return;
        }
        const s = e.target.closest("[data-semana]");
        if (s) {
          elegido = sumarDias(elegido, Number(s.dataset.semana));
          m.querySelector("[data-semana-tira]").innerHTML = semana(elegido);
          rotulo();
          elegir(elegido);
          return;
        }
        if (e.target.closest('[data-accion="suscribir"]')) suscribir(d);
      });
      // en el teléfono, deslizar la semana con el dedo
      const tira = m.querySelector("[data-semana-tira]");
      let x0 = null;
      tira.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      tira.addEventListener("touchend", (e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0;
        x0 = null;
        if (Math.abs(dx) < 50) return;
        elegido = sumarDias(elegido, dx < 0 ? 7 : -7);
        tira.innerHTML = semana(elegido);
        rotulo();
        elegir(elegido);
      });
    },
  };
}

export async function suscribir(d) {
  const token = d.yo?.cal_token;
  if (!token) return aviso("Para esto hace falta señal la primera vez.", { error: true });
  const url = api.urlCalendario(token);
  const webcal = url.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
  await dialogo({
    titulo: "Ponerlo en tu calendario",
    html: `<p>Se suscribe tu calendario a ${esAdmin(d.yo) ? "las inspecciones de todos" : "tus inspecciones"} y a las fechas compromiso. Se actualiza solo.</p>
      <div class="acciones-hoja">
        <button type="button" data-ir="${esc(google)}">${icono("calendario")}<span>Google Calendar</span></button>
        <button type="button" data-ir="${esc(webcal)}">${icono("calendario")}<span>Apple (iPhone, iPad, Mac) u Outlook</span></button>
        <button type="button" data-copiar>${icono("copiar")}<span>Copiar el enlace</span></button>
      </div>
      <p class="ayuda">Google refresca los calendarios suscritos cada varias horas; Apple y Outlook, más seguido. En la app lo ves al instante.
        El enlace es personal: si se lo pasaste a alguien por error, <button type="button" class="boton plano mini" data-nuevo style="display:inline-flex;padding:0 4px">crea uno nuevo</button> y el viejo deja de servir.</p>`,
    botones: [{ texto: "Listo", valor: true, clase: "primario" }],
    alMontar(velo) {
      velo.addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.ir) window.open(b.dataset.ir, "_blank", "noopener");
        if (b.hasAttribute("data-copiar")) {
          try { await navigator.clipboard.writeText(url); aviso("Enlace copiado."); } catch { aviso(url); }
        }
        if (b.hasAttribute("data-nuevo")) {
          try { await api.escribir("calendario/nuevo", {}); aviso("Enlace nuevo creado: vuelve a suscribirte."); } catch (x) { aviso(x.sinRed ? "Hace falta señal." : x.message, { error: true }); }
        }
      });
    },
  });
}
