// Gráficas en SVG, sin librerías: una línea en el tiempo con la banda de su rango (los puntos fuera, en rojo) y un
// rótulo que sigue al dedo o al puntero. Los colores salen del CSS (se ven bien en claro y en oscuro).
import { esc, numero } from "./util.mjs";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const diaCorto = (ms) => { const d = new Date(ms - 5 * 3600e3); return `${d.getUTCDate()}-${MESES[d.getUTCMonth()]}`; };

/**
 * series: [{ nombre, puntos: [{ t (ms), v }], clase: "" | "b" }], min/max: el rango (la banda verde), unidad.
 * Devuelve el HTML de un <svg> con data-* para el rótulo interactivo (montarRotulos).
 */
export function lineaTiempo({ series, min = null, max = null, unidad = "", alto = 190, decimales = 1 }) {
  const W = 620, H = alto, ml = 44, mr = 14, mt = 12, mb = 26;
  const todos = series.flatMap((s) => s.puntos);
  if (!todos.length) return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sin datos"><text class="vacia" x="${W / 2}" y="${H / 2}" text-anchor="middle">Todavía no hay datos</text></svg>`;
  const ts = todos.map((p) => p.t), vs = [...todos.map((p) => p.v), ...(min != null ? [min] : []), ...(max != null ? [max] : [])];
  let t0 = Math.min(...ts), t1 = Math.max(...ts);
  if (t0 === t1) { t0 -= 86400e3; t1 += 86400e3; }
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
  lo -= pad; hi += pad;
  const x = (t) => ml + ((t - t0) / (t1 - t0)) * (W - ml - mr);
  const y = (v) => mt + (1 - (v - lo) / (hi - lo)) * (H - mt - mb);
  const fuera = (v) => (min != null && v < min) || (max != null && v > max);
  // rayas horizontales en números redondos (1, 2 o 5 por potencia de 10); fechas abajo (primera, del medio, última)
  const paso = (() => { const crudo = (hi - lo) / 4, p10 = 10 ** Math.floor(Math.log10(crudo)), r = crudo / p10; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p10; })();
  const marcas = [];
  for (let v = Math.ceil(lo / paso) * paso; v <= hi; v += paso) marcas.push(+v.toPrecision(12));
  const fechas = [t0, (t0 + t1) / 2, t1];
  const banda = min != null || max != null
    ? `<rect class="banda" x="${ml}" width="${W - ml - mr}" y="${y(max ?? hi).toFixed(1)}" height="${Math.max(1, y(min ?? lo) - y(max ?? hi)).toFixed(1)}" rx="4"/>` : "";
  const lineas = series.map((s) => {
    const ps = [...s.puntos].sort((a, b) => a.t - b.t);
    const d = ps.map((p, k) => `${k ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    return `${ps.length > 1 ? `<path class="linea ${s.clase ?? ""}" d="${d}"/>` : ""}
      ${ps.map((p) => `<circle class="pto${fuera(p.v) ? " fuera" : ""}" cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${ps.length > 40 ? 2.4 : 3.6}"/>`).join("")}`;
  }).join("");
  const datos = esc(JSON.stringify(series.map((s) => ({ n: s.nombre ?? "", p: [...s.puntos].sort((a, b) => a.t - b.t).map((p) => [Math.round(x(p.t)), Math.round(y(p.v)), p.v, p.t]) }))));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => `${s.nombre ?? ""}: ${s.puntos.length} valores`).join(", "))}" data-grafica="${datos}" data-unidad="${esc(unidad)}" data-dec="${decimales}">
    ${banda}
    ${marcas.map((v) => `<line class="eje" x1="${ml}" x2="${W - mr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="eje-texto" x="${ml - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${numero(v, paso < 1 ? (paso < 0.1 ? 2 : 1) : 0)}</text>`).join("")}
    ${fechas.map((t, k) => `<text class="eje-texto" x="${x(t).toFixed(1)}" y="${H - 6}" text-anchor="${["start", "middle", "end"][k]}">${diaCorto(t)}</text>`).join("")}
    ${lineas}
    <g class="rotulo-g" visibility="hidden"><line class="eje" y1="${mt}" y2="${H - mb}"/><circle r="5.5" class="pto"/><rect rx="7" height="24" class="rotulo-fondo"/><text class="etq" y="0"></text></g>
  </svg>`;
}

/** El rótulo que sigue al dedo o al puntero en las gráficas de una vista (un solo dibujo por cuadro). */
export function montarRotulos(m) {
  m.addEventListener("pointermove", mover, { passive: true });
  m.addEventListener("pointerleave", esconder, true);
  let pendiente = null, cuadro = 0;
  function mover(e) {
    const svg = e.target.closest?.("svg[data-grafica]");
    if (!svg) return;
    pendiente = { svg, x: e.clientX };
    cuadro ||= requestAnimationFrame(pintar);
  }
  function pintar() {
    cuadro = 0;
    const { svg, x } = pendiente;
    const r = svg.getBoundingClientRect();
    const vx = ((x - r.left) / r.width) * 620;
    const series = JSON.parse(svg.dataset.grafica);
    let mejor = null;
    for (const s of series) for (const p of s.p) if (!mejor || Math.abs(p[0] - vx) < Math.abs(mejor.p[0] - vx)) mejor = { s, p };
    if (!mejor) return;
    const g = svg.querySelector(".rotulo-g");
    g.setAttribute("visibility", "visible");
    const [px, py, v, t] = mejor.p;
    g.querySelector("line").setAttribute("x1", px);
    g.querySelector("line").setAttribute("x2", px);
    g.querySelector("circle").setAttribute("cx", px);
    g.querySelector("circle").setAttribute("cy", py);
    const texto = `${mejor.s.n ? `${mejor.s.n}: ` : ""}${numero(v, Number(svg.dataset.dec))} ${svg.dataset.unidad} · ${diaCorto(t)}`;
    const tx = g.querySelector("text");
    tx.textContent = texto;
    const ancho = texto.length * 6.7 + 16;
    const rx = Math.min(Math.max(px - ancho / 2, 2), 620 - ancho - 2);
    const ry = Math.max(py - 36, 2);
    g.querySelector("rect").setAttribute("x", rx);
    g.querySelector("rect").setAttribute("y", ry);
    g.querySelector("rect").setAttribute("width", ancho);
    tx.setAttribute("x", rx + 8);
    tx.setAttribute("y", ry + 16);
  }
  function esconder(e) {
    if (e.target.matches?.("svg[data-grafica]")) e.target.querySelector(".rotulo-g")?.setAttribute("visibility", "hidden");
  }
}
