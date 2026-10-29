// Laboratorio por molino (Blaine, residuo 45 µm, SO₃, cal libre…): el último valor de cada parámetro contra su rango,
// cómo viene (alerta si va hacia afuera), la gráfica de cada uno y, si hay muestreos de la curva de Tromp de ese
// molino, el d50 y el bypass del separador al lado (para cruzarlos, como pidió Eduardo). Registrar funciona sin señal.
import { esc, icono, fechaHora, numero, plural } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, dialogo, vacio, nombre, esAdmin, puede, marcaSinEnviar } from "./ui.mjs";
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
        <p class="bajada">${muestras.length ? `${plural(muestras.length, "muestra", "muestras")} de ${esc(nombreCompleto(d, eq))}; la última, ${esc(fechaHora(ultima.en))}.` : `Sin muestras de ${esc(nombreCompleto(d, eq))} todavía.`}</p></div>
        ${puede(yo, "editar") ? `<div class="acciones"><button class="boton primario" data-registrar>${icono("laboratorio")}Registrar resultado</button></div>` : ""}</div>
      <nav class="filtros" aria-label="Molino">${ms.map((e) => `<a href="#/laboratorio?m=${encodeURIComponent(e.id)}" ${e.id === eq ? 'aria-current="true"' : ""}>${esc(e.tag || e.nombre)}</a>`).join("")}</nav>
      <div class="kpis-app">${ps.map(kpi).join("")}</div>
      <div class="graficas">${ps.map((p) => `<div class="grafica"><h3>${esc(p.nombre)} <small>${esc(p.unidad ?? "")} · ${esc(rango(p))}</small></h3>
        ${lineaTiempo({ series: [{ nombre: p.nombre, puntos: muestras.filter((x) => x.valores?.[p.id] != null).slice(-40).map((x) => ({ t: Date.parse(x.en), v: x.valores[p.id] })) }], min: p.min, max: p.max, unidad: p.unidad, decimales: 2 })}</div>`).join("")}
        ${tromps.length ? `<div class="grafica"><h3>Separador: corte d50 <small>µm · curva de Tromp</small></h3>
          ${lineaTiempo({ series: [{ nombre: "d50", puntos: tromps.filter((x) => x.r.d50 != null).map((x) => ({ t: Date.parse(x.en), v: x.r.d50 })) }], unidad: "µm" })}
          <p class="ayuda" style="margin:4px 2px 6px">Bypass del último muestreo: <b>${numero((tromps.at(-1).r.bypass ?? 0) * 100, 1)} %</b> · <a href="#/tromp">Ver la curva</a></p></div>` : ""}
      </div>
      <section class="seccion"><h2>Últimas muestras</h2>
        ${tabla.length ? `<div class="panel tabla-desliza" style="padding:6px 10px"><table class="tabla"><thead><tr><th>Fecha</th>${ps.map((p) => `<th class="n">${esc(p.nombre)}</th>`).join("")}<th>Quién</th></tr></thead><tbody>
          ${tabla.map((x) => `<tr><td>${esc(fechaHora(x.en))}${x._sinEnviar ? ` ${marcaSinEnviar()}` : ""}${x.nota ? `<br><small style="color:var(--tinta-3)">${esc(x.nota)}</small>` : ""}</td>
            ${ps.map((p) => { const v = x.valores?.[p.id]; return `<td class="n" style="${v != null && fuera(p, v) ? "color:var(--rojo);font-weight:700" : ""}">${v == null ? "" : numero(v, 2)}</td>`; }).join("")}
            <td>${esc(nombre(d, x.por).split(" ")[0])}</td></tr>`).join("")}</tbody></table></div>` : vacio(puede(yo, "editar") ? "Registra la primera muestra." : "Todavía no hay muestras.")}
      </section>`,
    montar(m) {
      montarRotulos(m);
      m.querySelector("[data-registrar]")?.addEventListener("click", () => registrar(d, eq, ps));
      // desde «Crear»: abre el registro de una vez (y se quita del enlace, para que no se vuelva a abrir)
      if (query.get("registrar") && puede(yo, "editar")) {
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
        <input id="l-${esc(p.id)}" data-param="${esc(p.id)}" type="text" inputmode="decimal" autocomplete="off"></div>`).join("")}</div>
      <div class="campo"><label for="l-nota">Nota <small>(opcional)</small></label><input id="l-nota" type="text"></div>
      <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>`,
    botones: [{ texto: "Cancelar", valor: null }, { texto: "Guardar", valor: true, clase: "primario", alElegir: async (v) => {
      const valores = {};
      for (const i of v.querySelectorAll("[data-param]")) { const x = i.value.replace(",", ".").trim(); if (x !== "" && Number.isFinite(Number(x))) valores[i.dataset.param] = Number(x); }
      const err = v.querySelector(".error-form");
      if (!Object.keys(valores).length) { err.hidden = false; err.textContent = "Pon por lo menos un resultado."; return false; }
      try {
        await api.encolar("laboratorio", { id: crypto.randomUUID(), equipo_id: eq, en: new Date(v.querySelector("#l-en").value).toISOString(), valores, nota: v.querySelector("#l-nota").value });
        const malos = ps.filter((p) => valores[p.id] != null && fuera(p, valores[p.id]));
        aviso(malos.length ? `Guardado. Fuera de rango: ${malos.map((p) => p.nombre).join(", ")}.` : "Resultado guardado.", { error: !!malos.length });
      } catch (x) { err.hidden = false; err.textContent = x.message; return false; }
    } }],
  });
}
