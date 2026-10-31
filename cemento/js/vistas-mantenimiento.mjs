// Mantenimiento (Eduardo, 30-oct-2026): los hallazgos de tipo mecánico, eléctrico o de lógica. Lo pendiente cuenta los
// días desde que se anotó (no se registra una fecha de fin: el único dato es cuándo se anotó); lo completado dice cuánto
// tardó en resolverse. Ingeniería de procesos valida aquí que quedó resuelto: el hallazgo se cierra y sale de lo
// pendiente. Lo que se anotó sin tipo se clasifica aquí mismo, para que entre.
import { esc, icono, fechaCorta, diaDe, diasEntre, plural, numeroHallazgo, numero, normal } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, vacio, equipo, nombreCorto, esDeProceso, puede, marcaSinEnviar, TIPOS_DANO, DE_MANTENIMIENTO } from "./ui.mjs";
import { barraFiltros, montarFiltros, familia, enFiltro, nombreCompleto } from "./componentes.mjs";

/** Días que lleva abierto un hallazgo, o los que tardó en cerrarse. */
export const diasAbierto = (h, hoy) => diasEntre(diaDe(h.creado), h.estado === "cerrado" ? diaDe(h.cerrado) ?? hoy : hoy);
/** Desde cuántos días se marca: una semana en rojo, tres días en naranja. */
export const claseDias = (n) => (n >= 7 ? "alta" : n >= 3 ? "media" : "baja");
const textoDias = (n) => (n === 0 ? "Hoy" : n === 1 ? "1 día" : `${n} días`);
/** El equipo de arriba (lo de un subequipo se cuenta en su equipo). */
const raiz = (d, id) => equipo(d, id)?.padre_id ?? id;
/** Quién lo validó: el último seguimiento que lo cerró. */
const validoPor = (d, h) => d.seguimientos.filter((s) => s.hallazgo_id === h.id && s.estado === "cerrado").sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))[0];

export function vistaMantenimiento({ d, yo, hoy, query }) {
  const ver = ["completado", "sintipo"].includes(query.get("ver")) ? query.get("ver") : "pendiente";
  const tipo = DE_MANTENIMIENTO.has(query.get("tipo")) ? query.get("tipo") : "";
  const eq = query.get("eq") ?? "";
  const buscar = normal(query.get("b") ?? "");
  const fam = familia(d, eq);
  const valida = esDeProceso(yo) && puede(yo, "editar");
  const deMant = d.hallazgos.filter((h) => DE_MANTENIMIENTO.has(h.tipo));
  const pendientes = deMant.filter((h) => h.estado !== "cerrado");
  const completados = deMant.filter((h) => h.estado === "cerrado");
  const sinTipo = d.hallazgos.filter((h) => h.estado !== "cerrado" && !h.tipo);
  const filtrar = (xs) => xs.filter((h) => enFiltro(fam, h.equipo_id) && (!tipo || h.tipo === tipo)
    && (!buscar || normal(`${numeroHallazgo(h)} ${h.descripcion} ${h.accion ?? ""} ${h.ot ?? ""} ${nombreCompleto(d, h.equipo_id)}`).includes(buscar)));
  const promedio = (xs) => (xs.length ? xs.reduce((s, h) => s + diasAbierto(h, hoy), 0) / xs.length : null);
  const pend = filtrar(pendientes).sort((a, b) => diasAbierto(b, hoy) - diasAbierto(a, hoy) || (a.creado ?? "").localeCompare(b.creado ?? ""));
  const comp = filtrar(completados).sort((a, b) => (b.cerrado ?? "").localeCompare(a.cerrado ?? ""));
  const q = (cambios) => `#/mantenimiento?${new URLSearchParams(Object.entries({ ...Object.fromEntries(query), ...cambios }).filter(([, v]) => v))}`;
  const pestana = (id, texto, n) => `<a href="${q({ ver: id === "pendiente" ? "" : id })}" ${ver === id ? 'aria-current="true"' : ""}>${texto}${n ? ` <b>${n}</b>` : ""}</a>`;
  const deTipo = (id, texto) => `<a href="${q({ tipo: id })}" ${tipo === id ? 'aria-current="true"' : ""}>${texto}</a>`;

  const fila = (h) => {
    const n = diasAbierto(h, hoy);
    const cerrado = h.estado === "cerrado";
    const s = cerrado && validoPor(d, h);
    const det = [`<span class="mono">${numeroHallazgo(h)}</span>`, `<span>${esc(TIPOS_DANO[h.tipo] ?? "Sin tipo")}</span>`,
      h.responsable_id ? `<span>${esc(nombreCorto(d, h.responsable_id))}</span>` : "",
      `<span>Anotado el ${esc(fechaCorta(diaDe(h.creado)))}</span>`,
      cerrado ? `<span>Validó ${esc(s ? nombreCorto(d, s.persona_id) : "—")} el ${esc(fechaCorta(diaDe(h.cerrado)))}</span>` : "",
      h.estado === "en_proceso" ? `<span style="color:var(--tinte);font-weight:600">En proceso</span>` : h.estado === "paro" ? `<span style="color:var(--morado);font-weight:600">Para el paro</span>` : ""].join("");
    return `<li class="${cerrado ? "hecha" : ""}" data-h="${esc(h.id)}"><span class="icono-lista ${cerrado ? "verde" : "rojo"}" aria-hidden="true">${icono(cerrado ? "bien" : "herramienta")}</span>
      <a class="que" href="#/hallazgo/${encodeURIComponent(h.id)}"><b>${esc(h.descripcion)}</b><small>${det}</small></a>
      <span class="lado">${h._sinEnviar ? marcaSinEnviar() : ""}<span class="marca ${cerrado ? "baja" : claseDias(n)}" title="${cerrado ? "Lo que tardó en resolverse" : "Lo que lleva sin resolverse"}">${cerrado ? `Tardó ${textoDias(n).toLowerCase()}` : textoDias(n)}</span></span>
      ${!cerrado && valida && !h._sinEnviar ? `<button type="button" class="boton mini verde validar" data-validar>${icono("visto")}Validar</button>` : ""}</li>`;
  };
  const filaSinTipo = (h) => `<li data-h="${esc(h.id)}"><span class="icono-lista rojo" aria-hidden="true">${icono("hallazgos")}</span>
      <a class="que" href="#/hallazgo/${encodeURIComponent(h.id)}"><b>${esc(h.descripcion)}</b><small><span class="mono">${numeroHallazgo(h)}</span><span>${esc(nombreCompleto(d, h.equipo_id))}</span><span>Anotado el ${esc(fechaCorta(diaDe(h.creado)))}</span></small></a>
      <span class="lado"></span>
      ${puede(yo, "editar") ? `<div class="segmento chico clasificar" role="group" aria-label="Tipo de daño">${Object.entries(TIPOS_DANO).map(([k, t]) => `<button type="button" data-clasificar="${k}">${t}</button>`).join("")}</div>` : ""}</li>`;

  // lo pendiente, por equipo: el equipo con lo más viejo arriba
  const porEquipo = Object.values(pend.reduce((a, h) => ((a[raiz(d, h.equipo_id)] ??= { id: raiz(d, h.equipo_id), xs: [] }).xs.push(h), a), {}));
  const listaPend = pend.length
    ? porEquipo.map((g) => `<section class="seccion"><h2>${esc(nombreCompleto(d, g.id))} <small class="cuenta-grupo">${plural(g.xs.length, "pendiente", "pendientes")} · el más viejo lleva ${textoDias(diasAbierto(g.xs[0], hoy)).toLowerCase()}</small></h2>
        <ul class="lista-tareas lista-mant">${g.xs.map(fila).join("")}</ul></section>`).join("")
    : vacio(fam || tipo || buscar ? "Nada pendiente con ese filtro." : deMant.length ? "No hay nada pendiente de mantenimiento." : "Todavía no hay hallazgos de mantenimiento. Al anotar un hallazgo, elige si el daño es mecánico, eléctrico o de lógica.");
  const listaComp = comp.length ? `<ul class="lista-tareas lista-mant">${comp.slice(0, 150).map(fila).join("")}</ul>${comp.length > 150 ? `<p class="ayuda">Se ven los 150 más recientes; el reporte trae todos los del período.</p>` : ""}`
    : vacio(fam || tipo || buscar ? "Nada completado con ese filtro." : "Todavía no hay nada validado.");
  const listaSin = sinTipo.length ? `<p class="ayuda" style="margin:0 4px 10px">Hallazgos abiertos que se anotaron sin tipo de daño. Elige el tipo y, si es mecánico, eléctrico o de lógica, pasa a lo pendiente de mantenimiento.</p>
      <ul class="lista-tareas lista-clasificar">${sinTipo.sort((a, b) => (a.creado ?? "").localeCompare(b.creado ?? "")).map(filaSinTipo).join("")}</ul>` : vacio("Todos los hallazgos abiertos tienen su tipo de daño.");

  const prom = promedio(filtrar(pendientes)), tardo = promedio(filtrar(completados));
  const reporte = `#/reportes?${new URLSearchParams({ plantilla: "mantenimiento", ...(eq ? { alcance: `equipo:${raiz(d, eq)}` } : {}) })}`;
  return {
    titulo: "Mantenimiento",
    atras: matchMedia("(max-width: 899px)").matches ? "#/planta" : null,
    html: `<div class="cabeza"><div><h1>Mantenimiento</h1><p class="bajada">Los hallazgos mecánicos, eléctricos y de lógica. Los días se cuentan desde que se anotó.${valida ? " Cuando quede resuelto, tócale «Validar»: pasa a completado." : ""}</p></div>
        <div class="acciones"><a class="boton" href="${reporte}">${icono("reportes")}Reporte</a></div></div>
      <div data-resultados>
      <dl class="cifras cuatro" style="margin-bottom:18px">
        <div><dt>Pendientes</dt><dd>${filtrar(pendientes).length}</dd></div>
        <div><dt>Llevan en promedio</dt><dd>${prom == null ? "—" : `${numero(prom, prom < 10 ? 1 : 0)} <small>días</small>`}</dd></div>
        <div><dt>Con más de una semana</dt><dd>${filtrar(pendientes).filter((h) => diasAbierto(h, hoy) >= 7).length}</dd></div>
        <div><dt>Tardan en resolverse</dt><dd>${tardo == null ? "—" : `${numero(tardo, tardo < 10 ? 1 : 0)} <small>días</small>`}</dd></div>
      </dl>
      <nav class="filtros" aria-label="Qué ver">${pestana("pendiente", "Pendiente", pendientes.length)}${pestana("completado", "Completado", completados.length)}${sinTipo.length ? pestana("sintipo", "Sin tipo", sinTipo.length) : ""}</nav>
      ${ver === "sintipo" ? "" : `${barraFiltros(d, query, { placeholder: "Buscar por número, OT o texto" })}
      <div class="segmento chico" role="group" aria-label="Tipo de daño" style="margin:0 0 16px">${deTipo("", "Todos")}${[...DE_MANTENIMIENTO].map((k) => deTipo(k, TIPOS_DANO[k])).join("")}</div>`}
      ${ver === "pendiente" ? listaPend : ver === "completado" ? listaComp : listaSin}
      </div>`,
    montar(m) {
      const repintar = () => {
        const v = vistaMantenimiento({ d: api.obtener(), yo, hoy, query: new URLSearchParams(location.hash.split("?")[1] ?? "") });
        const tmp = document.createElement("div");
        tmp.innerHTML = v.html;
        const nuevo = tmp.querySelector("[data-resultados]");
        // la barra de filtros se queda (no pierde el foco de la búsqueda); lo demás se cambia
        const barra = m.querySelector("[data-filtros]");
        if (barra) nuevo.querySelector("[data-filtros]")?.replaceWith(barra);
        m.querySelector("[data-resultados]").replaceWith(nuevo);
      };
      montarFiltros(m, d, { ruta: "mantenimiento", alCambiar: repintar });
      m.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-validar], [data-clasificar]");
        const li = b?.closest("[data-h]");
        if (!b || !li) return;
        e.preventDefault();
        const id = li.dataset.h;
        const h = d.hallazgos.find((x) => x.id === id);
        b.disabled = true;
        const enviar = (cambio) => Promise.race([api.encolar(`hallazgos/${encodeURIComponent(id)}`, cambio), new Promise((ok) => setTimeout(ok, 6000))]);
        const salir = async () => { li.classList.add("saliendo"); await new Promise((ok) => setTimeout(ok, 300)); repintar(); };
        try {
          if (b.dataset.clasificar) {
            const t = b.dataset.clasificar;
            await enviar({ tipo: t });
            await salir();
            aviso(DE_MANTENIMIENTO.has(t) ? `${TIPOS_DANO[t]}: pasó a lo pendiente de mantenimiento.` : "Quedó como «Otro»: no entra en mantenimiento.");
            return;
          }
          const antes = h.estado;
          await enviar({ estado: "cerrado", texto: "Validado en mantenimiento: quedó resuelto.", seguimiento_id: crypto.randomUUID(), fecha: new Date().toISOString() });
          await salir();
          aviso(`${numeroHallazgo(h)} validado: pasó a completado.`, { icono: "visto", ms: 6000, accion: { texto: "Deshacer", alTocar: async () => {
            await enviar({ estado: antes, texto: "Se deshizo la validación.", seguimiento_id: crypto.randomUUID(), fecha: new Date().toISOString() });
            repintar();
          } } });
        } catch (x) {
          b.disabled = false;
          aviso(`No se pudo guardar: ${x.message}`, { error: true });
        }
      });
    },
  };
}
