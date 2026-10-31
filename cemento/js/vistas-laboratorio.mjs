// Laboratorio por molino (Blaine, residuo 45 µm, SO₃, cal libre…): el último valor de cada parámetro contra su rango,
// cómo viene (alerta si va hacia afuera), la gráfica de cada uno y, si hay muestreos de la curva de Tromp de ese
// molino, el d50 y el bypass del separador al lado (para cruzarlos, como pidió Eduardo). Registrar funciona sin señal.
import { esc, icono, fechaHora, numero, plural, leerNumero, conPunto } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, dialogo, confirmar, vacio, nombre, nombreCorto, esAdmin, puede, esDeProceso, marcaSinEnviar } from "./ui.mjs";
import { nombreCompleto } from "./componentes.mjs";
import { lineaTiempo, montarRotulos } from "./graficas.mjs";
import { haciaFuera } from "./tendencia.mjs";
import { calcularTromp } from "./tromp.mjs";

/** Los molinos con laboratorio: los que tienen parámetros en Ajustes o resultados guardados. */
export function molinos(d) {
  const ids = new Set([...Object.keys(d.ajustes?.lab ?? {}), ...(d.laboratorio ?? []).map((x) => x.equipo_id)]);
  return d.equipos.filter((e) => ids.has(e.id));
}
export const parametros = (d, eq) => {
  const def = d.ajustes?.lab?.[eq] ?? [];
  // un valor guardado de un parámetro que ya no está en Ajustes se muestra igual (sin rango)
  const extra = [...new Set((d.laboratorio ?? []).filter((x) => x.equipo_id === eq).flatMap((x) => Object.keys(x.valores ?? {})))].filter((k) => !def.some((p) => p.id === k));
  return [...def, ...extra.map((id) => ({ id, nombre: id, unidad: "", min: null, max: null }))];
};
const fuera = (p, v) => (p.min != null && v < p.min) || (p.max != null && v > p.max);
const rango = (p) => (p.min != null && p.max != null ? `${numero(p.min, 2)}–${numero(p.max, 2)}` : p.max != null ? `máx. ${numero(p.max, 2)}` : p.min != null ? `mín. ${numero(p.min, 2)}` : "sin rango");

export function vistaLaboratorio({ d, yo, query }) {
  const ms = molinos(d);
  if (!ms.length) return { titulo: "Laboratorio", html: `<div class="cabeza"><div><h1>Laboratorio</h1></div></div>${vacio("Todavía no hay molinos con parámetros de laboratorio. El administrador los pone en Ajustes.", esAdmin(yo) ? `<a class="boton chico" href="#/ajustes">Ir a Ajustes</a>` : "")}` };
  const eq = ms.find((e) => e.id === query.get("m"))?.id ?? ms[0].id;
  const ps = parametros(d, eq);
  const muestras = (d.laboratorio ?? []).filter((x) => x.equipo_id === eq).sort((a, b) => a.en.localeCompare(b.en));
  const ultima = muestras.at(-1);
  const tromps = (d.tromp ?? []).filter((x) => x.equipo_id === eq).sort((a, b) => a.en.localeCompare(b.en)).map((x) => {
    try { return { ...x, r: calcularTromp(x.datos) }; } catch { return null; }
  }).filter(Boolean);
  const kpi = (p) => {
    const vs = muestras.filter((x) => x.valores?.[p.id] != null).map((x) => x.valores[p.id]);
    const v = vs.at(-1);
    const sentido = haciaFuera(vs, p.min, p.max);
    const clase = v == null ? "" : fuera(p, v) ? "malo" : sentido ? "regular" : "bueno";
    return `<div class="kpi ${clase}"><span class="rotulo-kpi">${esc(p.nombre)}</span>
      <span class="valor-kpi">${v == null ? "—" : numero(v, 2)}<small>${esc(p.unidad ?? "")}</small></span>
      <span class="pie-kpi">${esc(rango(p))}${sentido ? ` · <b style="color:var(--naranja)">${icono(sentido === "sube" ? "subeT" : "bajaT", "ico chico")} viene ${sentido === "sube" ? "subiendo" : "bajando"}</b>` : ""}</span></div>`;
  };
  const tabla = muestras.slice(-15).reverse();
  return {
    titulo: "Laboratorio",
    html: `<div class="cabeza"><div><h1>Laboratorio</h1>
        <p class="bajada">${muestras.length ? `${plural(muestras.length, "muestra", "muestras")} de ${esc(nombreCompleto(d, eq))}; la última, ${esc(conPunto(fechaHora(ultima.en)))}` : `Sin muestras de ${esc(nombreCompleto(d, eq))} todavía.`}</p></div>
        ${esDeProceso(yo) && puede(yo, "editar") ? `<div class="acciones"><button class="boton primario" data-registrar>${icono("laboratorio")}Registrar resultado</button></div>` : ""}</div>
      <nav class="filtros" aria-label="Molino">${ms.map((e) => `<a href="#/laboratorio?m=${encodeURIComponent(e.id)}" ${e.id === eq ? 'aria-current="true"' : ""}>${esc(e.tag || e.nombre)}</a>`).join("")}</nav>
      <div class="kpis-app">${ps.map(kpi).join("")}</div>
      <div class="graficas">${ps.map((p) => `<div class="grafica"><h3>${esc(p.nombre)} <small>${esc(p.unidad ?? "")} · ${esc(rango(p))}</small></h3>
        ${lineaTiempo({ series: [{ nombre: p.nombre, puntos: muestras.filter((x) => x.valores?.[p.id] != null).slice(-40).map((x) => ({ t: Date.parse(x.en), v: x.valores[p.id] })) }], min: p.min, max: p.max, unidad: p.unidad, decimales: 2 })}</div>`).join("")}
        ${tromps.length && esDeProceso(yo) ? `<div class="grafica"><h3>Separador: corte d50 <small>µm · curva de Tromp</small></h3>
          ${lineaTiempo({ series: [{ nombre: "d50", puntos: tromps.filter((x) => x.r.d50 != null).map((x) => ({ t: Date.parse(x.en), v: x.r.d50 })) }], unidad: "µm" })}
          <p class="ayuda" style="margin:4px 2px 6px">Bypass del último muestreo: <b>${numero((tromps.at(-1).r.bypass ?? 0) * 100, 1)} %</b> · <a href="#/tromp">Ver la curva</a></p></div>` : ""}
      </div>
      <section class="seccion"><h2>Últimas muestras</h2>
        ${tabla.length ? `<div class="panel tabla-desliza" style="padding:6px 10px"><table class="tabla"><thead><tr><th>Fecha</th>${ps.map((p) => `<th class="n">${esc(p.nombre)}</th>`).join("")}<th>Quién</th><th><span class="oculto">Borrar</span></th></tr></thead><tbody>
          ${tabla.map((x) => `<tr><td>${esc(fechaHora(x.en))}${x._sinEnviar ? ` ${marcaSinEnviar()}` : ""}${x.nota ? `<br><small style="color:var(--tinta-3)">${esc(x.nota)}</small>` : ""}</td>
            ${ps.map((p) => { const v = x.valores?.[p.id]; return `<td class="n" style="${v != null && fuera(p, v) ? "color:var(--rojo);font-weight:700" : ""}">${v == null ? "" : numero(v, 2)}</td>`; }).join("")}
            <td>${esc(nombreCorto(d, x.por))}</td>
            <td>${esDeProceso(yo) && (x.por === yo.id || esAdmin(yo)) && !x._sinEnviar ? `<button type="button" class="boton-icono" data-borrar-lab="${esc(x.id)}" aria-label="Borrar la muestra del ${esc(fechaHora(x.en))}">${icono("basura")}</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : vacio(esDeProceso(yo) ? "Registra la primera muestra." : "Todavía no hay muestras.")}
      </section>`,
    montar(m) {
      montarRotulos(m);
      m.querySelector("[data-registrar]")?.addEventListener("click", () => registrar(d, eq, ps));
      // una muestra mal anotada se borra (la de uno, o cualquiera si es el administrador) y se vuelve a registrar
      m.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-borrar-lab]");
        if (!b || !(await confirmar("¿Borrar esta muestra?", "Se quita de la tabla y de las gráficas.", "Borrar", "peligro"))) return;
        try { await api.escribir(`laboratorio/${encodeURIComponent(b.dataset.borrarLab)}/borrar`, {}); aviso("Muestra borrada."); }
        catch (x) { aviso(x.sinRed ? "Para borrar hace falta señal." : x.message, { error: true }); }
      });
      // desde «Crear»: abre el registro de una vez (y se quita del enlace, para que no se vuelva a abrir)
      if (query.get("registrar") && esDeProceso(yo)) {
        history.replaceState(null, "", `#/laboratorio${query.get("m") ? `?m=${encodeURIComponent(query.get("m"))}` : ""}`);
        registrar(d, eq, ps);
      }
    },
  };
}

async function registrar(d, eq, ps) {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  await dialogo({
    titulo: `Resultado de ${nombreCompleto(d, eq)}`,
    html: `<div class="campo"><label for="l-en">Hora de la muestra</label><input id="l-en" type="datetime-local" value="${ahora.toISOString().slice(0, 16)}"></div>
      <div class="rejilla-campos dos">${ps.map((p) => `<div class="campo"><label for="l-${esc(p.id)}">${esc(p.nombre)} <small>${esc(p.unidad ?? "")} · ${esc(rango(p))}</small></label>
        <input id="l-${esc(p.id)}" data-param="${esc(p.id)}" type="text" inputmode="decimal" autocomplete="off"><span class="ayuda" data-leido="${esc(p.id)}"></span></div>`).join("")}</div>
      <div class="campo"><label for="l-nota">Nota <small>(opcional)</small></label><input id="l-nota" type="text"></div>
      <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>`,
    botones: [{ texto: "Cancelar", valor: null }, { texto: "Guardar", valor: true, clase: "primario", alElegir: async (v) => {
      const valores = {};
      const err = v.querySelector(".error-form");
      for (const i of v.querySelectorAll("[data-param]")) {
        if (!i.value.trim()) continue;
        const x = leerNumero(i.value, ps.find((p) => p.id === i.dataset.param));
        if (x == null) { err.hidden = false; err.textContent = `«${i.value}» no es un número.`; i.focus(); return false; }
        valores[i.dataset.param] = x;
      }
      if (!Object.keys(valores).length) { err.hidden = false; err.textContent = "Pon por lo menos un resultado."; return false; }
      try {
        await api.encolar("laboratorio", { id: crypto.randomUUID(), equipo_id: eq, en: new Date(v.querySelector("#l-en").value).toISOString(), valores, nota: v.querySelector("#l-nota").value });
        const malos = ps.filter((p) => valores[p.id] != null && fuera(p, valores[p.id]));
        aviso(malos.length ? `Guardado. Fuera de rango: ${malos.map((p) => p.nombre).join(", ")}.` : "Resultado guardado.", { error: !!malos.length });
      } catch (x) { err.hidden = false; err.textContent = x.message; return false; }
    } }],
    alMontar(v) {
      // al escribir: cómo se entendió el número y si se sale del rango (antes de guardar, no después)
      v.addEventListener("input", (e) => {
        const p = ps.find((x) => x.id === e.target.dataset?.param);
        if (!p) return;
        const x = leerNumero(e.target.value, p), s = v.querySelector(`[data-leido="${CSS.escape(p.id)}"]`);
        s.textContent = !e.target.value.trim() ? "" : x == null ? "No es un número" : `${numero(x, 3)} ${p.unidad ?? ""}${fuera(p, x) ? " · fuera de rango" : ""}`;
        s.style.color = x != null && fuera(p, x) ? "var(--rojo)" : "";
      });
    },
  });
}
