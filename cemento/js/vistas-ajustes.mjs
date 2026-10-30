// Ajustes (cada uno: su cuenta, el tema, las notificaciones de este aparato, la hora de su aviso, el calendario) y,
// para el administrador, la empresa (nombre y logo de los reportes), los usuarios, mandar avisos y los datos.
import { esc, icono, plural, hoyPanama, normal, leerNumero } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, dialogo, confirmar, vacio, avatar, esAdmin, etiquetaPersona, PERFILES, PERMISOS, perfilDe, nombrePerfil } from "./ui.mjs";
import { preferencia, elegir as elegirTema } from "./tema.mjs";
import { cerrarSesion } from "./app.mjs";
import { excelDe, alcanceDe, periodo, entregarArchivo } from "./vistas-reportes.mjs";
import { TIPO_XLSX } from "./xlsx.mjs";
import { suscribir } from "./vistas-calendario.mjs";
import { nombreCompleto, elegirEquipo } from "./componentes.mjs";

const seccion = (titulo, filas, pie = "") => `<section class="seccion"><h2>${titulo}</h2><div class="lista">${filas}</div>${pie ? `<p class="pie-seccion">${pie}</p>` : ""}</section>`;
const ajuste = (ic, color, titulo, detalle, lado = "") => `<div class="ajuste">${ic ? `<span class="icono-fila ${color}">${icono(ic)}</span>` : ""}
  <span class="texto"><b>${titulo}</b>${detalle ? `<small>${detalle}</small>` : ""}</span>${lado}</div>`;

export function vistaAjustes({ d, yo }) {
  const admin = esAdmin(yo);
  const a = d.ajustes ?? {};
  const tema = preferencia();
  const version = document.querySelector('meta[name="version"]')?.content ?? "local";
  return {
    titulo: "Ajustes",
    atras: matchMedia("(max-width: 899px)").matches ? "#/mas" : null,
    html: `<div class="cabeza"><div><h1>Ajustes</h1></div></div>
      <div class="ajustes">
      <div class="lista"><div class="ajuste">${avatar(yo)}<span class="texto"><b>${esc(yo.nombre)}</b><small>${esc([yo.puesto, yo.turno ? `Turno ${yo.turno}` : "", `usuario ${yo.usuario}`].filter(Boolean).join(" · "))}</small></span>
        <span class="marca ${admin ? "en_proceso" : ""}">${esc(nombrePerfil(yo))}</span></div>
        <div class="ajuste"><span class="icono-fila gris">${icono("llave")}</span><span class="texto"><b>Contraseña</b></span><button type="button" class="boton chico" data-accion="clave">Cambiar</button></div>
        <div class="ajuste"><span class="icono-fila rojo">${icono("salir")}</span><span class="texto"><b>Salir de este aparato</b><small>Lo que no se haya enviado se queda guardado.</small></span><button type="button" class="boton chico peligro" data-accion="salir">Salir</button></div></div>

      ${seccion("Apariencia", `<div class="ajuste"><div class="segmento" role="group" aria-label="Tema" style="flex:1">
          <button type="button" data-tema="auto" aria-pressed="${tema === "auto"}">${icono("auto")}Automático</button>
          <button type="button" data-tema="claro" aria-pressed="${tema === "claro"}">${icono("sol")}Claro</button>
          <button type="button" data-tema="oscuro" aria-pressed="${tema === "oscuro"}">${icono("luna")}Oscuro</button></div></div>`,
        "Automático sigue al teléfono o a la computadora (oscuro de noche si así lo tienes). Los reportes siempre salen en blanco.")}

      ${seccion("Notificaciones", `<div data-push>${ajuste("campana", "rojo", "En este aparato", "Revisando…")}</div>
        <div class="ajuste"><span class="icono-fila naranja">${icono("reloj")}</span><span class="texto"><b>Mi aviso de «qué hay para hoy»</b><small>${admin ? "Lo de hoy en la planta, lo atrasado y lo que espera tu visto bueno." : "Tus inspecciones de hoy y lo atrasado."} Hora de Panamá.</small></span>
          <input type="time" data-hora value="${esc(yo.aviso_hora ?? "")}" aria-label="Hora del aviso"><button type="button" class="boton chico plano" data-accion="sin-hora" ${yo.aviso_hora ? "" : "hidden"}>Quitar</button></div>`,
        `Te llegan también cuando te asignan algo, cuando te recuerdan y cuando un hallazgo queda a tu cargo. Todo eso queda además en <a href="#/avisos">Avisos</a>.`)}

      ${seccion("Calendario", `<div class="ajuste"><span class="icono-fila">${icono("calendario")}</span><span class="texto"><b>Ponerlo en mi calendario</b><small>Google Calendar, Apple u Outlook: ${admin ? "todas las inspecciones" : "tus inspecciones"} y las fechas compromiso.</small></span>
        <button type="button" class="boton chico" data-accion="calendario">Ver cómo</button></div>`)}

      ${admin ? seccion("Empresa", `<form data-empresa style="display:grid;gap:16px;padding:16px">
          <div class="ajuste" style="padding:0">
            <div class="logo-vista ${a.logo ? "" : "vacio-logo"}" data-logo-vista>${a.logo ? `<img src="${esc(a.logo)}" alt="Logo">` : "Sin logo"}</div>
            <span class="texto"><b>Logo de los reportes</b><small>PNG o JPG; con fondo transparente se ve mejor. Sale arriba en cada reporte y en la app.</small></span>
            <span style="display:grid;gap:6px"><label class="boton chico">${icono("galeria")}Elegir<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="oculto" data-logo></label>
              ${a.logo ? `<button type="button" class="boton chico plano peligro" data-accion="quitar-logo">Quitar</button>` : ""}</span>
          </div>
          <div class="rejilla-campos dos">
            <div class="campo"><label for="a-empresa">Empresa</label><input id="a-empresa" type="text" value="${esc(a.empresa ?? "")}" placeholder="Por ejemplo: Cemento Bayano"></div>
            <div class="campo"><label for="a-planta">Planta</label><input id="a-planta" type="text" value="${esc(a.planta ?? "")}" placeholder="Por ejemplo: Planta Calzada Larga"></div>
            <div class="campo"><label for="a-app">Nombre de la app</label><input id="a-app" type="text" value="${esc(a.app_nombre ?? "")}" placeholder="Bitácora de proceso"></div>
            <div class="campo"><label for="a-pie">Pie de los reportes <small>(opcional)</small></label><input id="a-pie" type="text" value="${esc(a.pie_reporte ?? "")}" placeholder="Por ejemplo: Uso interno"></div>
          </div>
          <div><button type="submit" class="boton primario chico">${icono("bien")}Guardar</button></div></form>`) : ""}

      ${admin ? seccion("Reglas de la planta", `<div class="ajuste"><span class="icono-fila rojo">${icono("alerta")}</span><span class="texto"><b>Escalar hallazgos de prioridad alta</b>
          <small>Te avisa en el resumen de la mañana cuando uno lleva abierto más de estos días.</small></span>
          <input type="number" min="1" max="60" value="${esc(a.escalar_dias ?? 3)}" data-escalar aria-label="Días" style="width:84px;min-height:38px;text-align:center"><span class="ayuda">días</span></div>
        <label class="ajuste"><span class="icono-fila indigo">${icono("firma")}</span><span class="texto"><b>Firma al terminar una inspección</b>
          <small>Con el dedo; sale en el reporte. Cada plantilla puede cambiarlo.</small></span>
          <span class="interruptor"><input type="checkbox" data-firma ${a.pedir_firma === false ? "" : "checked"}><span></span></span></label>
        <div class="ajuste"><span class="icono-fila morado">${icono("laboratorio")}</span><span class="texto"><b>Parámetros del laboratorio</b>
          <small>${esc(Object.keys(a.lab ?? {}).map((id) => d.equipos.find((e) => e.id === id)?.nombre).filter(Boolean).join(", ") || "Ningún molino todavía")}</small></span>
          <button type="button" class="boton chico" data-accion="lab">Editar</button></div>`, "Los rangos del laboratorio que vienen son típicos de libro: cámbialos por los de la planta.") : ""}

      ${admin ? seccion("Equipo de trabajo", `<a class="fila con-icono" href="#/usuarios"><span class="icono-fila indigo">${icono("personas")}</span><span class="titulo">Usuarios</span>
          <span class="detalle">${plural(d.personas.filter((p) => p.activo).length, "activo", "activos")}${d.personas.some((p) => p.activo && !p.tiene_clave) ? ` · ${d.personas.filter((p) => p.activo && !p.tiene_clave).length} sin contraseña` : ""}</span>
          <span class="lado horizontal">${icono("derecha", "ico chevron")}</span></a>
        <div class="ajuste"><span class="icono-fila rojo">${icono("campana")}</span><span class="texto"><b>Mandar un aviso</b><small>A una persona, a varias o a todos: les llega al teléfono y a su bandeja.</small></span>
          <button type="button" class="boton chico" data-accion="avisar">Escribir</button></div>`) : ""}

      ${seccion("Datos", `${admin && d.demo ? `<div class="ajuste"><span class="icono-fila naranja">${icono("basura")}</span><span class="texto"><b>Quitar los datos de ejemplo</b>
          <small>Borra las inspecciones, hallazgos y colectores de ejemplo y a los jefes de turno de ejemplo que no hayan hecho nada. Lo que anotó la gente se queda; los equipos y plantillas también.</small></span>
          <button type="button" class="boton chico peligro" data-accion="quitar-ejemplo">Quitar</button></div>` : ""}
        <div class="ajuste"><span class="icono-fila verde">${icono("excel")}</span><span class="texto"><b>Todo en Excel</b><small>Inspecciones, mediciones, revisiones, hallazgos, seguimientos y equipos, desde el inicio.</small></span>
          <button type="button" class="boton chico" data-accion="excel">Descargar</button></div>
        <a class="fila con-icono" href="#/pendientes"><span class="icono-fila gris">${icono("nube")}</span><span class="titulo">Por enviar</span>
          <span class="detalle">${api.cola.pendientes.length ? plural(api.cola.pendientes.length, "cosa en cola", "cosas en cola") : "Todo enviado"}</span><span class="lado horizontal">${icono("derecha", "ico chevron")}</span></a>`)}

      ${seccion("Aplicación", `<div class="ajuste"><span class="icono-fila gris">${icono("inicio")}</span><span class="texto"><b>${esc(a.app_nombre || "Bitácora de proceso")}</b><small>Versión ${esc(version)}</small></span>
        <button type="button" class="boton chico" data-accion="actualizar">Buscar actualización</button></div>`,
        api.instalada ? "" : api.esIOS ? "Para usarla como app (y recibir notificaciones): en Safari, Compartir → «Agregar a pantalla de inicio»." : "Para usarla como app: en Chrome, menú → «Instalar app».")}
      </div>`,
    montar(m) {
      pintarPush(m);
      m.addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.tema) {
          elegirTema(b.dataset.tema);
          b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          return;
        }
        const ac = b.dataset.accion;
        if (ac === "salir") return cerrarSesion();
        if (ac === "clave") return cambiarClave();
        if (ac === "calendario") return suscribir(d);
        if (ac === "avisar") return mandarAviso(d, yo);
        if (ac === "lab") return editarLab(d);
        if (ac === "sin-hora") return guardarHora(m, "");
        if (ac === "activar-push" || ac === "probar-push" || ac === "quitar-push") return manejarPush(m, ac, b);
        if (ac === "actualizar") {
          const reg = await navigator.serviceWorker?.getRegistration();
          await reg?.update().catch(() => {});
          aviso(reg?.waiting || reg?.installing ? "Hay una versión nueva: se instala en un momento." : "Ya tienes la última versión.");
        }
        if (ac === "quitar-logo") {
          try { await api.escribir("ajustes", { logo: null }); aviso("Logo quitado."); } catch (x) { aviso(x.sinRed ? "Hace falta señal." : x.message, { error: true }); }
        }
        if (ac === "quitar-ejemplo") {
          if (!(await confirmar("¿Quitar los datos de ejemplo?", "Se borran las inspecciones, hallazgos y colectores de ejemplo. Lo que anotó la gente se queda. No se puede deshacer.", "Quitar", "peligro"))) return;
          b.disabled = true;
          try {
            const x = await api.escribir("datos/quitar-ejemplo", {});
            aviso(`Listo. Quedan ${plural(x.quedan.hallazgos, "hallazgo", "hallazgos")} y ${plural(x.quedan.inspecciones, "inspección", "inspecciones")} de verdad.`);
          } catch (x) { aviso(x.sinRed ? "Hace falta señal." : x.message, { error: true }); b.disabled = false; }
        }
        if (ac === "excel") {
          b.disabled = true;
          try {
            const hoy = hoyPanama();
            const per = periodo(new URLSearchParams({ p: "todo" }), hoy, d);
            await entregarArchivo(excelDe(d, per, alcanceDe(d, "planta"), hoy), `bitacora-todo-${hoy}.xlsx`, TIPO_XLSX);
          } catch (x) { aviso(`No se pudo armar el Excel: ${x.message}`, { error: true }); }
          b.disabled = false;
        }
      });
      m.querySelector("[data-hora]").addEventListener("change", (e) => guardarHora(m, e.target.value));
      m.querySelector("[data-escalar]")?.addEventListener("change", async (e) => {
        try { await api.escribir("ajustes", { escalar_dias: Number(e.target.value) }); aviso(`Se escala a los ${e.target.value} días.`); } catch (x) { aviso(x.sinRed ? "Hace falta señal." : x.message, { error: true }); }
      });
      m.querySelector("[data-firma]")?.addEventListener("change", async (e) => {
        try { await api.escribir("ajustes", { pedir_firma: e.target.checked }); aviso(e.target.checked ? "Se pide firma al terminar." : "Ya no se pide firma (salvo en las plantillas que la pidan)."); }
        catch (x) { e.target.checked = !e.target.checked; aviso(x.sinRed ? "Hace falta señal." : x.message, { error: true }); }
      });
      const fEmp = m.querySelector("[data-empresa]");
      fEmp?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const b = fEmp.querySelector("button[type=submit]");
        b.disabled = true;
        try {
          await api.escribir("ajustes", { empresa: fEmp["a-empresa"].value, planta: fEmp["a-planta"].value, app_nombre: fEmp["a-app"].value, pie_reporte: fEmp["a-pie"].value });
          aviso("Guardado.");
        } catch (x) { aviso(x.sinRed ? "Para guardar hace falta señal." : x.message, { error: true }); }
        b.disabled = false;
      });
      fEmp?.querySelector("[data-logo]").addEventListener("change", async (e) => {
        const archivo = e.target.files?.[0];
        e.target.value = "";
        if (!archivo) return;
        try {
          const logo = await achicarLogo(archivo);
          await api.escribir("ajustes", { logo });
          aviso("Logo guardado: ya sale en los reportes.");
        } catch (x) { aviso(x.sinRed ? "Para subir el logo hace falta señal." : x.message, { error: true }); }
      });
    },
  };
}

/** Los parámetros del laboratorio de cada molino: nombre, unidad y rango. */
async function editarLab(d) {
  const lab = structuredClone(d.ajustes?.lab ?? {});
  const fila = (eq, p, k) => `<div class="rejilla-campos" style="grid-template-columns:2fr 1fr 1fr 1fr auto;gap:6px;align-items:center" data-eq="${esc(eq)}" data-k="${k}">
    <input type="text" data-c="nombre" value="${esc(p.nombre)}" placeholder="Blaine" aria-label="Parámetro"><input type="text" data-c="unidad" value="${esc(p.unidad ?? "")}" placeholder="cm²/g" aria-label="Unidad">
    <input type="text" inputmode="decimal" data-c="min" value="${esc(p.min ?? "")}" placeholder="mín." aria-label="Mínimo"><input type="text" inputmode="decimal" data-c="max" value="${esc(p.max ?? "")}" placeholder="máx." aria-label="Máximo">
    <button type="button" class="boton-icono" data-quitar-p aria-label="Quitar">${icono("basura")}</button></div>`;
  const pintar = () => Object.entries(lab).map(([eq, ps]) => `<section class="panel" style="background:var(--hundido);padding:12px"><h3 style="display:flex;justify-content:space-between;align-items:center">${esc(nombreCompleto(d, eq))}
      <button type="button" class="boton mini plano peligro" data-quitar-m="${esc(eq)}">Quitar molino</button></h3>
    ${ps.map((p, k) => fila(eq, p, k)).join("")}<div><button type="button" class="boton mini" data-agregar-p="${esc(eq)}">${icono("mas1")}Parámetro</button></div></section>`).join("") || `<p class="ayuda">Ningún molino todavía.</p>`;
  await dialogo({
    titulo: "Parámetros del laboratorio",
    ancho: true,
    html: `<div data-lab style="display:grid;gap:10px">${pintar()}</div><div><button type="button" class="boton chico" data-agregar-m>${icono("mas1")}Agregar un molino</button></div>
      <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>`,
    botones: [{ texto: "Cancelar", valor: null }, { texto: "Guardar", valor: true, clase: "primario", alElegir: async (v) => {
      const num = (x) => (String(x ?? "").trim() === "" ? null : leerNumero(x) ?? NaN);
      for (const ps of Object.values(lab)) for (const p of ps) { p.min = num(p.min ?? ""); p.max = num(p.max ?? ""); p.id ||= normal(p.nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `p${Math.random().toString(36).slice(2, 6)}`; }
      if (Object.values(lab).flat().some((p) => !p.nombre?.trim() || Number.isNaN(p.min) || Number.isNaN(p.max))) { const err = v.querySelector(".error-form"); err.hidden = false; err.textContent = "Cada parámetro necesita nombre, y el mínimo y máximo tienen que ser números."; return false; }
      const alReves = Object.values(lab).flat().find((p) => p.min != null && p.max != null && p.min > p.max);
      if (alReves) { const err = v.querySelector(".error-form"); err.hidden = false; err.textContent = `En «${alReves.nombre}» el mínimo es mayor que el máximo.`; return false; }
      try { await api.escribir("ajustes", { lab }); aviso("Parámetros guardados."); } catch (x) { const err = v.querySelector(".error-form"); err.hidden = false; err.textContent = x.sinRed ? "Hace falta señal." : x.message; return false; }
    } }],
    alMontar(v) {
      const zona = v.querySelector("[data-lab]");
      zona.addEventListener("input", (e) => { const f = e.target.closest("[data-eq]"); if (f) lab[f.dataset.eq][Number(f.dataset.k)][e.target.dataset.c] = e.target.value; });
      v.addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.hasAttribute("data-quitar-p")) { const f = b.closest("[data-eq]"); lab[f.dataset.eq].splice(Number(f.dataset.k), 1); zona.innerHTML = pintar(); }
        if (b.dataset.agregarP) { lab[b.dataset.agregarP].push({ id: "", nombre: "", unidad: "", min: null, max: null }); zona.innerHTML = pintar(); zona.querySelector(`[data-eq="${CSS.escape(b.dataset.agregarP)}"]:last-of-type input`)?.focus(); }
        if (b.dataset.quitarM) { delete lab[b.dataset.quitarM]; zona.innerHTML = pintar(); }
        if (b.hasAttribute("data-agregar-m")) {
          const id = await elegirEquipo(d, { titulo: "¿De qué molino?", soloArriba: true });
          if (id && !lab[id]) { lab[id] = [{ id: "", nombre: "", unidad: "", min: null, max: null }]; zona.innerHTML = pintar(); }
        }
      });
    },
  });
}

async function guardarHora(m, hora) {
  try {
    await api.escribir("yo", { aviso_hora: hora });
    aviso(hora ? `Tu aviso llega a las ${hora}.` : "Ya no te llega el aviso diario.");
  } catch (x) { aviso(x.sinRed ? "Hace falta señal." : x.message, { error: true }); }
}

/** El logo, achicado en el aparato (lado mayor 600 px). PNG y SVG conservan la transparencia. */
async function achicarLogo(archivo) {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(archivo.type)) throw new Error("El logo tiene que ser una imagen PNG, JPG, WebP o SVG.");
  if (archivo.type === "image/svg+xml") {
    if (archivo.size > 300_000) throw new Error("Ese SVG pesa demasiado.");
    return `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new Uint8Array(await archivo.arrayBuffer())))}`;
  }
  const img = await createImageBitmap(archivo);
  const k = Math.min(1, 600 / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL(archivo.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.9);
  if (url.length > 480_000) return c.toDataURL("image/jpeg", 0.85);
  return url;
}

async function pintarPush(m) {
  const zona = m.querySelector("[data-push]");
  if (!zona) return;
  const e = await api.estadoPush();
  const d = api.obtener();
  let detalle, lado = "";
  if (!e.soporta) {
    detalle = e.motivo === "agregar"
      ? "En el iPhone y el iPad las notificaciones funcionan con la app en la pantalla de inicio: Safari → Compartir → «Agregar a pantalla de inicio», y ábrela desde ahí."
      : "Este navegador no recibe notificaciones. Usa Chrome en Android o la app en la pantalla de inicio del iPhone.";
  } else if (e.permiso === "denied") {
    detalle = "Están bloqueadas para esta app. Actívalas en los ajustes del teléfono (Notificaciones) y vuelve aquí.";
  } else if (e.activa) {
    detalle = `Activadas${d?.yo?.aparatos > 1 ? ` (en ${d.yo.aparatos} aparatos)` : ""}.`;
    lado = `<span style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="boton chico" data-accion="probar-push">Probar</button><button type="button" class="boton chico plano" data-accion="quitar-push">Desactivar</button></span>`;
  } else {
    detalle = "Apagadas en este aparato.";
    lado = `<button type="button" class="boton chico primario" data-accion="activar-push">Activar</button>`;
  }
  zona.innerHTML = ajuste("campana", "rojo", "En este aparato", detalle, lado);
}

async function manejarPush(m, ac, b) {
  b.disabled = true;
  try {
    if (ac === "activar-push") { await api.activarPush(); aviso("Notificaciones activadas."); }
    if (ac === "quitar-push") { await api.desactivarPush(); aviso("Notificaciones desactivadas en este aparato."); }
    if (ac === "probar-push") {
      const r = await api.escribir("push/probar", {});
      aviso(r.entregados ? "Enviada: te tiene que llegar en unos segundos." : "No se pudo entregar: desactívalas y vuelve a activarlas.", { error: !r.entregados });
    }
  } catch (x) {
    aviso(x.sinRed ? "Para esto hace falta señal." : x.message, { error: true });
  }
  b.disabled = false;
  pintarPush(m);
}

async function cambiarClave() {
  await dialogo({
    titulo: "Cambiar la contraseña",
    html: `<div class="campo"><label for="c-actual">La de ahora</label><input id="c-actual" type="password" autocomplete="current-password"></div>
      <div class="campo"><label for="c-nueva">La nueva</label><input id="c-nueva" type="password" autocomplete="new-password"><span class="ayuda">Por lo menos 6 caracteres. Se cierra la sesión en tus otros aparatos.</span></div>
      <div class="campo"><label for="c-otra">Otra vez</label><input id="c-otra" type="password" autocomplete="new-password"></div>
      <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>`,
    botones: [{ texto: "Cancelar", valor: null }, { texto: "Cambiar", valor: true, clase: "primario", alElegir: async (v) => {
      const err = v.querySelector(".error-form");
      const fallo = (t) => { err.hidden = false; err.textContent = t; return false; };
      const nueva = v.querySelector("#c-nueva").value;
      if (nueva.length < 6) return fallo("La nueva tiene que tener por lo menos 6 caracteres.");
      if (nueva !== v.querySelector("#c-otra").value) return fallo("Las dos nuevas no son iguales.");
      try { await api.cambiarClave(v.querySelector("#c-actual").value, nueva); aviso("Contraseña cambiada."); } catch (x) { return fallo(x.sinRed ? "Para esto hace falta señal." : x.message); }
    } }],
  });
}

async function mandarAviso(d, yo) {
  const otros = d.personas.filter((p) => p.activo && p.id !== yo.id);
  await dialogo({
    titulo: "Mandar un aviso",
    html: `<div class="campo"><span class="rotulo">A quién</span><div class="elegir-equipos">
        <div class="grupo"><span>Personas</span><button type="button" data-todas>Todas</button></div>
        ${otros.map((p) => `<label><input type="checkbox" value="${esc(p.id)}">${avatar(p, true)}<span>${esc(etiquetaPersona(p))}</span></label>`).join("")}</div></div>
      <div class="campo"><label for="av-texto">Aviso</label><textarea id="av-texto" maxlength="400" placeholder="Por ejemplo: mañana a las 6 hay paro del horno; revisen las mangas del COL-03"></textarea></div>
      <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>`,
    botones: [{ texto: "Cancelar", valor: null }, { texto: "Mandar", valor: true, clase: "primario", alElegir: async (v) => {
      const err = v.querySelector(".error-form");
      const ids = [...v.querySelectorAll("input:checked")].map((c) => c.value);
      const texto = v.querySelector("#av-texto").value.trim();
      if (!ids.length || !texto) { err.hidden = false; err.textContent = !ids.length ? "Elige a quién." : "Escribe el aviso."; return false; }
      try {
        const r = await api.escribir("avisar", { personas: ids, texto });
        aviso(`Aviso enviado a ${plural(r.personas, "persona", "personas")}${r.aparatos ? ` (${plural(r.entregados, "teléfono", "teléfonos")})` : ""}.`);
      } catch (x) { err.hidden = false; err.textContent = x.sinRed ? "Para mandar avisos hace falta señal." : x.message; return false; }
    } }],
    alMontar(v) {
      v.querySelector("[data-todas]").addEventListener("click", () => {
        const cajas = [...v.querySelectorAll("input[type=checkbox]")];
        const todas = cajas.every((c) => c.checked);
        cajas.forEach((c) => (c.checked = !todas));
      });
    },
  });
}

// ------------------------------------------------------------------------------- usuarios

const PALABRAS = ["horno", "clinker", "molino", "silo", "banda", "ciclon", "tolva", "mangas", "rodillo", "caliza"];
const claveTemporal = () => {
  const n = crypto.getRandomValues(new Uint32Array(2));
  return `${PALABRAS[n[0] % PALABRAS.length]}-${String(1000 + (n[1] % 9000))}`;
};
const usuarioDe = (nombre) => nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".").replace(/[^a-z0-9._-]/g, "");

export function vistaUsuarios({ d, yo }) {
  if (!esAdmin(yo)) return { titulo: "Usuarios", atras: "#/ajustes", html: vacio("Los usuarios los maneja el administrador.") };
  const fila = (p) => `<li><button type="button" class="fila con-icono" data-persona="${esc(p.id)}" style="${p.activo ? "" : "opacity:.55"}">${avatar(p)}
      <span class="titulo">${esc(p.nombre)}${p.id === yo.id ? " <small>(tú)</small>" : ""}</span>
      <span class="detalle"><span class="mono">${esc(p.usuario)}</span>${p.puesto ? `<span>${esc(p.puesto)}</span>` : ""}${p.turno ? `<span>Turno ${esc(p.turno)}</span>` : ""}
        ${p.aviso_hora ? `<span>${icono("reloj", "ico chico")} ${esc(p.aviso_hora)}</span>` : ""}</span>
      <span class="lado"><span class="marca ${p.rol === "admin" ? "en_proceso" : ""}">${esc(nombrePerfil(p))}</span>
        ${!p.activo ? `<span class="marca">Desactivado</span>` : !p.tiene_clave ? `<span class="marca media">Sin contraseña</span>` : p.debe_cambiar ? `<span class="marca">Contraseña temporal</span>` : ""}</span>
    </button></li>`;
  const activos = d.personas.filter((p) => p.activo), inactivos = d.personas.filter((p) => !p.activo);
  return {
    titulo: "Usuarios",
    atras: "#/ajustes",
    html: `<div class="cabeza"><div><h1>Usuarios</h1>
        <p class="bajada">Cada persona entra con su usuario y su contraseña. Tú le pones una temporal y la cambia al entrar. Desactivar a alguien no borra lo que hizo.</p></div>
        <div class="acciones"><button type="button" class="boton primario" data-accion="nuevo">${icono("mas1")}Agregar usuario</button></div></div>
      <ul class="lista">${activos.map(fila).join("")}</ul>
      ${inactivos.length ? `<section class="seccion"><h2>Desactivados <small>${inactivos.length}</small></h2><ul class="lista">${inactivos.map(fila).join("")}</ul></section>` : ""}`,
    montar(m) {
      m.addEventListener("click", (e) => {
        if (e.target.closest('[data-accion="nuevo"]')) return editarPersona(d, yo, null);
        const b = e.target.closest("[data-persona]");
        if (b) editarPersona(d, yo, d.personas.find((p) => p.id === b.dataset.persona));
      });
    },
  };
}

async function editarPersona(d, yo, p) {
  const nueva = !p;
  const temporal = nueva ? claveTemporal() : "";
  let creada = null;
  await dialogo({
    titulo: nueva ? "Agregar usuario" : p.nombre,
    html: `<div class="rejilla-campos dos">
        <div class="campo"><label for="u-nombre">Nombre</label><input id="u-nombre" type="text" value="${esc(p?.nombre ?? "")}" placeholder="Juan Pérez" autocomplete="off"></div>
        <div class="campo"><label for="u-usuario">Usuario</label><input id="u-usuario" type="text" value="${esc(p?.usuario ?? "")}" placeholder="juan.perez" autocapitalize="none" spellcheck="false" autocomplete="off"></div>
        <div class="campo"><label for="u-puesto">Puesto</label><input id="u-puesto" type="text" value="${esc(p?.puesto ?? "")}" placeholder="Jefe de turno" list="u-puestos">
          <datalist id="u-puestos"><option value="Jefe de turno"><option value="Ingeniero de procesos"><option value="Técnico mecánico"><option value="Técnico eléctrico"><option value="Operador"></datalist></div>
        <div class="campo"><label for="u-turno">Turno</label><select id="u-turno">${["", "A", "B", "C", "D"].map((t) => `<option value="${t}" ${(p?.turno ?? "") === t ? "selected" : ""}>${t ? `Turno ${t}` : "Sin turno"}</option>`).join("")}</select></div>
        <div class="campo"><label for="u-hora">Aviso diario <small>(hora)</small></label><input id="u-hora" type="time" value="${esc(p?.aviso_hora ?? "06:00")}"></div>
      </div>
      ${elegirPerfil(p, yo)}
      <div class="campo"><label for="u-clave">${nueva ? "Contraseña temporal" : "Poner una contraseña temporal nueva"} ${nueva ? "" : "<small>(si se le olvidó)</small>"}</label>
        <div style="display:flex;gap:8px"><input id="u-clave" type="text" value="${esc(temporal)}" autocomplete="off" spellcheck="false" style="font-family:var(--mono)">
          <button type="button" class="boton chico" data-generar>Otra</button></div>
        <span class="ayuda">${nueva ? "Se la das tú; la cambia la primera vez que entre." : "Déjalo vacío para no cambiarla. Si pones una, se cierra su sesión y la cambia al entrar."}</span></div>
      ${!nueva && p.id !== yo.id ? `<label class="ajuste" style="padding:0;gap:12px"><span class="interruptor"><input type="checkbox" id="u-activo" ${p.activo ? "checked" : ""}><span></span></span><span class="texto"><b>Activo</b><small>Desactivado no puede entrar, pero lo que hizo se queda.</small></span></label>` : ""}
      <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>`,
    botones: [{ texto: "Cancelar", valor: null }, { texto: nueva ? "Agregar" : "Guardar", valor: true, clase: "primario", alElegir: async (v) => {
      const val = (id) => v.querySelector(id)?.value ?? "";
      const err = v.querySelector(".error-form");
      const fallo = (t) => { err.hidden = false; err.textContent = t; return false; };
      if (!val("#u-nombre").trim()) return fallo("Falta el nombre.");
      const clave = val("#u-clave").trim();
      if (nueva && clave.length < 6) return fallo("La contraseña temporal necesita por lo menos 6 caracteres.");
      if (clave && clave.length < 6) return fallo("La contraseña temporal necesita por lo menos 6 caracteres.");
      try {
        const r = await api.escribir("personas", {
          id: p?.id, nombre: val("#u-nombre").trim(), usuario: val("#u-usuario").trim() || usuarioDe(val("#u-nombre")), puesto: val("#u-puesto"), turno: val("#u-turno"),
          ...permisosElegidos(v, p, yo), aviso_hora: val("#u-hora"), activo: v.querySelector("#u-activo") ? v.querySelector("#u-activo").checked : true,
          ...(clave ? { clave } : {}),
        });
        if (clave) creada = { ...r, clave };
        else aviso("Guardado.");
      } catch (x) { return fallo(x.sinRed ? "Para esto hace falta señal." : x.message); }
    } }],
    alMontar(v) {
      const nombre = v.querySelector("#u-nombre"), usuario = v.querySelector("#u-usuario");
      let tocado = !nueva;
      usuario.addEventListener("input", () => { tocado = true; });
      nombre.addEventListener("input", () => { if (!tocado) usuario.value = usuarioDe(nombre.value); });
      v.querySelector("[data-generar]").addEventListener("click", () => { v.querySelector("#u-clave").value = claveTemporal(); });
      montarPerfil(v);
    },
  });
  if (creada) entregarCredenciales(creada);
}

// Qué puede hacer: cuatro perfiles para elegir de un toque y, plegado, «Personalizar» con un interruptor por permiso
// (Eduardo: «como en Excel: solo leer, permite editar»). Si los interruptores no calzan con ningún perfil, es «Personalizado».
const ICONO_PERFIL = { lectura: "ojo", inspector: "inspecciones", supervisor: "personas", admin: "llave" };

function elegirPerfil(p, yo) {
  const yoMismo = p?.id === yo.id;
  const actual = p ? perfilDe(p) : "inspector";
  const tiene = new Set(actual === "admin" ? PERFILES.admin.permisos : p?.permisos ?? PERFILES.inspector.permisos);
  const marcado = actual === "personalizado" ? null : actual;
  return `<div class="campo" data-perfiles><span class="rotulo" id="u-r-perfil">Qué puede hacer <span class="marca" data-personalizado ${marcado ? "hidden" : ""}>Personalizado</span></span>
      <div class="perfiles" role="radiogroup" aria-labelledby="u-r-perfil">${Object.entries(PERFILES).map(([k, x], n) => `<button type="button" role="radio" class="perfil" data-perfil="${k}"
          aria-checked="${k === marcado}" tabindex="${k === marcado || (!marcado && !n) ? 0 : -1}" ${yoMismo ? "disabled" : ""}>
          <span class="perfil-ico">${icono(ICONO_PERFIL[k])}</span><span class="perfil-texto"><b>${esc(x.nombre)}</b><small>${esc(x.desc)}</small></span>
          <span class="perfil-check" aria-hidden="true">${icono("bien")}</span></button>`).join("")}</div>
      ${yoMismo ? `<span class="ayuda">Eres el administrador: eso no te lo puedes quitar tú mismo.</span>` : `<details class="mas-detalles" ${marcado ? "" : "open"}><summary>${icono("derecha", "ico")}<span>Personalizar</span><small>permiso por permiso</small></summary>
        <div class="permisos">${Object.entries(PERMISOS).map(([k, [t, dsc]]) => `<label class="ajuste"><span class="texto"><b>${esc(t)}</b><small>${esc(dsc)}</small></span>
          <span class="interruptor"><input type="checkbox" data-permiso="${k}" ${tiene.has(k) ? "checked" : ""} ${actual === "admin" ? "disabled" : ""}><span></span></span></label>`).join("")}</div></details>`}</div>`;
}

function montarPerfil(v) {
  const caja = v.querySelector("[data-perfiles]");
  const cards = [...caja.querySelectorAll("[data-perfil]")];
  const llaves = [...caja.querySelectorAll("[data-permiso]")];
  const marcar = (k) => {
    cards.forEach((c) => { c.setAttribute("aria-checked", String(c.dataset.perfil === k)); c.tabIndex = c.dataset.perfil === k ? 0 : -1; });
    caja.querySelector("[data-personalizado]").hidden = !!k;
  };
  const elegir = (k) => {
    marcar(k);
    const xs = new Set(PERFILES[k].permisos);
    llaves.forEach((l) => { l.checked = xs.has(l.dataset.permiso); l.disabled = k === "admin"; });
    navigator.vibrate?.(6);
  };
  caja.addEventListener("click", (e) => { const c = e.target.closest("[data-perfil]"); if (c && !c.disabled) elegir(c.dataset.perfil); });
  caja.addEventListener("keydown", (e) => {
    const c = e.target.closest?.("[data-perfil]");
    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!c || !paso) return;
    e.preventDefault();
    const sig = cards[(cards.indexOf(c) + paso + cards.length) % cards.length];
    sig.focus();
    elegir(sig.dataset.perfil);
  });
  caja.addEventListener("change", (e) => {
    if (!e.target.dataset.permiso) return;
    const k = perfilDe({ permisos: llaves.filter((l) => l.checked).map((l) => l.dataset.permiso) });
    marcar(k === "personalizado" ? null : k);
  });
}

/** rol y permisos para mandar al servidor. */
function permisosElegidos(v, p, yo) {
  if (p?.id === yo.id) return { rol: "admin" };
  if (v.querySelector('[data-perfil="admin"][aria-checked="true"]')) return { rol: "admin" };
  return { rol: "inspector", permisos: [...v.querySelectorAll("[data-permiso]")].filter((l) => l.checked).map((l) => l.dataset.permiso) };
}

async function entregarCredenciales(p) {
  const url = `${location.origin}${location.pathname}`;
  const texto = `Hola, ${p.nombre.split(" ")[0]}. Para entrar a la bitácora de inspecciones:\n${url}\nUsuario: ${p.usuario}\nContraseña temporal: ${p.clave}\nAl entrar te pide que elijas la tuya. En el iPhone: Safari → Compartir → «Agregar a pantalla de inicio»; en Android: Chrome → «Instalar app».`;
  const r = await dialogo({
    titulo: "Listo: pásale estos datos",
    html: `<div class="panel" style="background:var(--hundido)"><dl class="datos-insp"><dt>Usuario</dt><dd class="mono">${esc(p.usuario)}</dd><dt>Contraseña</dt><dd class="mono">${esc(p.clave)}</dd></dl></div>
      <p class="ayuda">La contraseña no se vuelve a mostrar. Si se pierde, le pones otra temporal.</p>`,
    botones: [{ texto: "Copiar", valor: "copiar", icono: "copiar" }, { texto: "WhatsApp", valor: "wa", icono: "whatsapp" }, { texto: "Listo", valor: null, clase: "primario" }],
  });
  if (r === "copiar") {
    try { await navigator.clipboard.writeText(texto); aviso("Copiado."); } catch { aviso("No se pudo copiar solo.", { error: true }); }
  }
  if (r === "wa") window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
}
