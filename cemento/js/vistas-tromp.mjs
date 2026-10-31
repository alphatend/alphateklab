// La curva de Tromp del separador: se meten los tamizados de la alimentación, los finos y los gruesos, y sale la
// curva con el bypass, el corte (d50), la imperfección y la carga circulante. Lo escrito queda en el aparato.
import { esc, icono, numero, fechaHora, leerNumero } from "./util.mjs";
import { aviso, dialogo, nombre, puede, vacio, esDeProceso } from "./ui.mjs";
import * as api from "./api.mjs";
import { nombreCompleto } from "./componentes.mjs";
import { calcularTromp, EJEMPLO } from "./tromp.mjs";

const CLAVE = "bp-tromp";
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; } };
const guardar = (v) => { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch { /* sin espacio */ } };

function filasDe(datos) {
  return datos.tamanos.map((t, k) => ({ t, a: datos.alimentacion[k], f: datos.finos[k], g: datos.gruesos[k] }));
}

export function vistaTromp({ d } = {}) {
  if (d?.yo && !esDeProceso(d.yo)) return { titulo: "Curva de Tromp", atras: "#/planta", html: vacio("La curva de Tromp la lleva ingeniería de procesos.") };
  let filas = leer() ?? filasDe(EJEMPLO);
  const guardados = [...(d?.tromp ?? [])].sort((a, b) => b.en.localeCompare(a.en));
  const molinos = (d?.equipos ?? []).filter((e) => e.activo && !e.padre_id && e.tipo !== "colector");
  const fila = (x, k) => `<tr data-k="${k}">
      <td><input type="text" inputmode="decimal" aria-label="Tamaño (µm), fila ${k + 1}" data-c="t" value="${esc(x.t ?? "")}"></td>
      <td><input type="text" inputmode="decimal" aria-label="Alimentación, fila ${k + 1}" data-c="a" value="${esc(x.a ?? "")}"></td>
      <td><input type="text" inputmode="decimal" aria-label="Finos, fila ${k + 1}" data-c="f" value="${esc(x.f ?? "")}"></td>
      <td><input type="text" inputmode="decimal" aria-label="Gruesos, fila ${k + 1}" data-c="g" value="${esc(x.g ?? "")}"></td>
      <td><button type="button" class="boton chico plano" data-quitar-fila aria-label="Quitar la fila ${k + 1}">${icono("mal")}</button></td></tr>`;
  return {
    titulo: "Curva de Tromp",
    atras: matchMedia("(max-width: 899px)").matches ? "#/planta" : null,
    viva: false,
    html: `<div class="cabeza"><div><h1>Curva de Tromp</h1>
        <p class="bajada">Con el tamizado de la alimentación, los finos y los gruesos del separador (% que pasa por cada malla), en el mismo muestreo.</p></div></div>
      <div class="tromp">
        <div class="panel">
          <div class="tabla-desliza"><table class="tabla tabla-tamiz">
            <thead><tr><th>Malla (µm)</th><th>Aliment. %</th><th>Finos %</th><th>Gruesos %</th><th><span class="oculto">Quitar</span></th></tr></thead>
            <tbody data-filas>${filas.map(fila).join("")}</tbody></table></div>
          <div class="herramientas-item">
            <button type="button" class="boton chico" data-accion="fila">${icono("mas1")}Agregar malla</button>
            <button type="button" class="boton chico" data-accion="ejemplo">Usar el ejemplo</button>
            <button type="button" class="boton chico plano" data-accion="limpiar">Vaciar</button></div>
          <p style="font-size:14px;color:var(--tinta-3)">El ejemplo es inventado, para ver cómo funciona. Las mallas van de la más fina a la más gruesa.</p>
          ${!d?.yo || esDeProceso(d.yo) ? `<div class="herramientas-item" style="border-top:0.5px solid var(--linea);padding-top:12px">
            <button type="button" class="boton primario chico" data-accion="guardar">${icono("bien")}Guardar este muestreo</button>
            <span class="ayuda">Queda con el molino y la fecha, para seguirlo junto al Blaine en Laboratorio.</span></div>` : ""}
          ${guardados.length ? `<div><span class="rotulo">Muestreos guardados</span><ul class="lista" style="margin-top:8px;background:var(--hundido)">${guardados.slice(0, 12).map((x) => {
            let r = null; try { r = calcularTromp(x.datos); } catch { /* datos incompletos */ }
            return `<li><button type="button" class="fila" data-cargar="${esc(x.id)}"><span class="titulo">${esc(nombreCompleto(d, x.equipo_id))} <small>· ${esc(fechaHora(x.en))}</small></span>
              <span class="detalle">${r ? `<span>d50 ${numero(r.d50, 1)} µm</span><span>bypass ${numero(r.bypass * 100, 1)} %</span>` : ""}${x.nota ? `<span>${esc(x.nota)}</span>` : ""}<span>${esc(nombre(d, x.por).split(" ")[0])}</span></span>
              <span class="lado">${x._sinEnviar ? `<span class="marca sinenviar">Sin enviar</span>` : icono("derecha", "ico chevron")}</span></button></li>`;
          }).join("")}</ul></div>` : ""}
        </div>
        <div data-resultado aria-live="polite"></div>
      </div>`,
    montar(m) {
      const cuerpo = m.querySelector("[data-filas]");
      const salida = m.querySelector("[data-resultado]");
      const num = (v) => leerNumero(v) ?? NaN;
      const recalcular = () => {
        guardar(filas);
        const llenas = filas.filter((x) => [x.t, x.a, x.f, x.g].every((v) => Number.isFinite(num(v))));
        if (llenas.length < 3) {
          salida.innerHTML = `<div class="vacio">Llena por lo menos tres mallas completas para ver la curva.</div>`;
          return;
        }
        try {
          const r = calcularTromp({ tamanos: llenas.map((x) => num(x.t)), alimentacion: llenas.map((x) => num(x.a)), finos: llenas.map((x) => num(x.f)), gruesos: llenas.map((x) => num(x.g)) });
          salida.innerHTML = resultado(r);
        } catch (e) {
          salida.innerHTML = `<div class="error-carga">${esc(e.message)}</div>`;
        }
      };
      cuerpo.addEventListener("input", (e) => {
        const t = e.target;
        const k = Number(t.closest("[data-k]").dataset.k);
        filas[k][t.dataset.c] = t.value;
        recalcular();
      });
      m.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.hasAttribute("data-quitar-fila")) filas.splice(Number(b.closest("[data-k]").dataset.k), 1);
        else if (b.dataset.accion === "fila") filas.push({ t: "", a: "", f: "", g: "" });
        else if (b.dataset.accion === "ejemplo") filas = filasDe(EJEMPLO);
        else if (b.dataset.accion === "limpiar") { filas = [0, 1, 2, 3, 4].map(() => ({ t: "", a: "", f: "", g: "" })); aviso("Tabla vacía."); }
        else if (b.dataset.cargar) {
          const x = guardados.find((y) => y.id === b.dataset.cargar);
          filas = filasDe(x.datos);
          aviso(`Cargado el muestreo del ${fechaHora(x.en)}.`);
          scrollTo({ top: 0, behavior: "smooth" });
        } else if (b.dataset.accion === "guardar") {
          const llenas = filas.filter((x) => [x.t, x.a, x.f, x.g].every((v) => Number.isFinite(num(v))));
          if (llenas.length < 3) return aviso("Llena por lo menos tres mallas completas.", { error: true });
          const ahora = new Date(); ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
          dialogo({
            titulo: "Guardar el muestreo",
            html: `<div class="campo"><label for="tr-m">Molino</label><select id="tr-m">${molinos.map((e) => `<option value="${esc(e.id)}">${esc(nombreCompleto(d, e.id))}</option>`).join("")}</select></div>
              <div class="campo"><label for="tr-en">Hora del muestreo</label><input id="tr-en" type="datetime-local" value="${ahora.toISOString().slice(0, 16)}"></div>
              <div class="campo"><label for="tr-n">Nota <small>(opcional)</small></label><input id="tr-n" type="text" placeholder="Por ejemplo: después de ajustar las paletas"></div>`,
            botones: [{ texto: "Cancelar", valor: null }, { texto: "Guardar", valor: true, clase: "primario", alElegir: async (v) => {
              try {
                await api.encolar("tromp", { id: crypto.randomUUID(), equipo_id: v.querySelector("#tr-m").value, en: new Date(v.querySelector("#tr-en").value).toISOString(), nota: v.querySelector("#tr-n").value,
                  datos: { tamanos: llenas.map((x) => num(x.t)), alimentacion: llenas.map((x) => num(x.a)), finos: llenas.map((x) => num(x.f)), gruesos: llenas.map((x) => num(x.g)) } });
                aviso("Muestreo guardado.");
              } catch (x) { aviso(x.message, { error: true }); return false; }
            } }],
          });
          return;
        } else return;
        cuerpo.innerHTML = filas.map(fila).join("");
        recalcular();
      });
      recalcular();
    },
  };
}

function resultado(r) {
  const pct = (v) => (v == null ? "—" : `${numero(v * 100, 1)}`);
  const cifra = (t, v, u = "") => `<div><dt>${t}</dt><dd>${v}${u ? ` <small>${u}</small>` : ""}</dd></div>`;
  return `<dl class="cifras">
      ${cifra("Rendimiento de finos", pct(r.rendimientoFinos), "%")}
      ${cifra("Carga circulante (gruesos/finos)", numero(r.cargaCirculante, 2))}
      ${cifra("Bypass", pct(r.bypass), "%")}
      ${cifra("Corte d50", numero(r.d50, 1), "µm")}
      ${cifra("Imperfección", numero(r.imperfeccion, 2))}
      ${cifra("Nitidez d25/d75", numero(r.nitidez, 2))}
    </dl>
    <div class="grafico" style="margin-top:16px">${grafico(r)}
      <div class="leyenda"><span><i></i>Tromp</span><span><i class="c"></i>Corregida (sin el bypass)</span><span><i class="b"></i>Bypass</span></div></div>
    <p style="font-size:14px;color:var(--tinta-3);margin:10px 4px 0">La curva dice qué parte de cada tamaño se va a los gruesos (de vuelta al molino). El bypass es lo fino que se va a gruesos sin separarse; el d50, el tamaño que se reparte mitad y mitad. Factor de circulación (alimentación / finos): ${numero(r.factorCirculacion, 2)}.</p>`;
}

/** La curva en escala logarítmica de tamaño, de 0 a 100 %, con los ejes rotulados. */
function grafico(r) {
  const W = 640, H = 380, ml = 58, mr = 20, mt = 18, mb = 52;
  const pts = r.clases.filter((c) => c.tromp != null);
  const lo = Math.log10(Math.min(...pts.map((c) => c.tamano))), hi = Math.log10(Math.max(...pts.map((c) => c.tamano)));
  const x = (d) => ml + ((Math.log10(d) - lo) / (hi - lo || 1)) * (W - ml - mr);
  const y = (v) => mt + (1 - v) * (H - mt - mb);
  const camino = (campo) => pts.map((c, k) => `${k ? "L" : "M"}${x(c.tamano).toFixed(1)},${y(c[campo]).toFixed(1)}`).join("");
  const marcasX = [1, 2, 5, 10, 20, 50, 100, 200, 500].filter((v) => Math.log10(v) >= lo - 0.01 && Math.log10(v) <= hi + 0.01);
  const rejilla = [0, 0.25, 0.5, 0.75, 1].map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" class="rejilla-g"/><text x="${ml - 8}" y="${y(v) + 4}" text-anchor="end" font-size="15" class="texto-g">${v * 100}</text>`).join("");
  const ejeX = marcasX.map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="${mt}" y2="${H - mb}" class="rejilla-g" stroke-opacity=".6"/><text x="${x(v)}" y="${H - mb + 18}" text-anchor="middle" font-size="15" class="texto-g">${v}</text>`).join("");
  const d50 = r.d50 ? `<line x1="${x(r.d50)}" x2="${x(r.d50)}" y1="${y(0.5)}" y2="${H - mb}" class="acento-g" stroke-dasharray="3 3"/>
      <circle cx="${x(r.d50)}" cy="${y(0.5)}" r="4.5" class="acento-relleno"/><text x="${x(r.d50) + 7}" y="${y(0.5) - 8}" font-size="15" font-weight="600" class="acento-texto">d50 ${numero(r.d50, 1)} µm</text>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva de Tromp: bypass ${numero(r.bypass * 100, 1)} %, corte d50 ${numero(r.d50, 1)} µm">
    ${ejeX}${rejilla}
    <line x1="${ml}" x2="${W - mr}" y1="${y(r.bypass)}" y2="${y(r.bypass)}" class="bypass-g" stroke-width="1.5" stroke-dasharray="5 4"/>
    <path d="${camino("tromp")}" fill="none" class="linea-g" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${camino("corregida")}" fill="none" class="acento-g" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.map((c) => `<circle cx="${x(c.tamano).toFixed(1)}" cy="${y(c.tromp).toFixed(1)}" r="3" class="punto-g"/>`).join("")}
    ${d50}
    <text x="${(ml + W - mr) / 2}" y="${H - 8}" text-anchor="middle" font-size="15" class="texto-g fuerte">Tamaño de partícula (µm, escala logarítmica)</text>
    <text x="16" y="${(mt + H - mb) / 2}" text-anchor="middle" font-size="15" class="texto-g fuerte" transform="rotate(-90 16 ${(mt + H - mb) / 2})">% que va a gruesos</text>
  </svg>`;
}
