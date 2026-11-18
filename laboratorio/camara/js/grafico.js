// Barras de entradas por minuto (SVG propio, sin librería). Una sola serie: el título dice qué es, no lleva leyenda.
// Eje y de 0 a un máximo redondo, con su rótulo; eje x con la hora del primer y del último minuto.
// Globo al pasar el puntero o tocar una barra; la tabla equivalente va aparte.

import { horaCorta as hora, maximoRedondo } from './nucleo/formato.mjs';

const NS = 'http://www.w3.org/2000/svg';

function el(nombre, atributos = {}, padre) {
  const n = document.createElementNS(NS, nombre);
  for (const [k, v] of Object.entries(atributos)) n.setAttribute(k, String(v));
  if (padre) padre.appendChild(n);
  return n;
}

/** Barra con la punta redondeada (4 px) y la base recta, creciendo desde la línea base. */
function caminoBarra(x, yBase, w, h) {
  const r = Math.min(4, h, w / 2);
  const y = yBase - h;
  return `M${x},${yBase}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${yBase}Z`;
}

export function crearGraficoMinutos(contenedor) {
  const globo = document.createElement('div');
  globo.className = 'grafico__globo';
  globo.hidden = true;
  let ultimo = null;

  function pintar(datos) {
    ultimo = datos;
    const ancho = Math.max(240, Math.round(contenedor.clientWidth || 600));
    // Los rótulos van en rem (crecen con la letra del navegador); los márgenes que los contienen, también.
    const k = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
    const m = { izq: Math.round(30 * k), der: 8, arriba: Math.round(12 * k), abajo: Math.round(24 * k) };
    const alto = 96 + m.arriba + m.abajo;
    const w = ancho - m.izq - m.der;
    const h = alto - m.arriba - m.abajo;
    const total = datos.reduce((s, d) => s + d.entradas, 0);
    const mayor = datos.reduce((p, d) => (d.entradas > p.entradas ? d : p), datos[0]);
    const max = maximoRedondo(mayor ? mayor.entradas : 0);
    const svg = el('svg', {
      viewBox: `0 0 ${ancho} ${alto}`,
      width: ancho,
      height: alto,
      role: 'img',
      'aria-label':
        total === 0
          ? 'Sin entradas en los últimos 15 minutos.'
          : `${total} entradas en los últimos 15 minutos; el minuto con más fue ${hora(mayor.inicio)}, con ${mayor.entradas}.`,
    });
    const base = m.arriba + h;
    // eje y: 0 y el máximo, con una línea fina en el máximo
    el('line', { class: 'grafico__eje', x1: m.izq, x2: m.izq + w, y1: m.arriba, y2: m.arriba }, svg);
    el('line', { class: 'grafico__eje', x1: m.izq, x2: m.izq + w, y1: base, y2: base }, svg);
    const tMax = el('text', { class: 'grafico__texto', x: m.izq - 6, y: m.arriba + 4 * k, 'text-anchor': 'end' }, svg);
    tMax.textContent = String(max);
    const t0 = el('text', { class: 'grafico__texto', x: m.izq - 6, y: base + 4 * k, 'text-anchor': 'end' }, svg);
    t0.textContent = '0';
    const banda = w / datos.length;
    const anchoBarra = Math.min(24, Math.max(3, banda - 2));
    datos.forEach((d, i) => {
      const x = m.izq + i * banda + (banda - anchoBarra) / 2;
      if (d.entradas > 0) {
        const altoBarra = Math.max(2, (d.entradas / max) * h);
        el('path', { class: 'grafico__barra' + (d.enCurso ? ' grafico__barra--curso' : ''), d: caminoBarra(x, base, anchoBarra, altoBarra) }, svg);
      }
      const blanco = el('rect', { class: 'grafico__blanco', x: m.izq + i * banda, y: m.arriba, width: banda, height: h + m.abajo, 'data-i': i }, svg);
      blanco.addEventListener('pointerenter', () => mostrarGlobo(i, x + anchoBarra / 2, base - (d.entradas / max) * h));
      blanco.addEventListener('pointerdown', () => mostrarGlobo(i, x + anchoBarra / 2, base - (d.entradas / max) * h));
      blanco.addEventListener('pointerleave', () => (globo.hidden = true));
    });
    // eje x: primera hora, la de en medio y «ahora»
    const rotulos = [
      [0, hora(datos[0].inicio), 'start'],
      [Math.floor(datos.length / 2), hora(datos[Math.floor(datos.length / 2)].inicio), 'middle'],
      [datos.length - 1, 'ahora', 'end'],
    ];
    for (const [i, texto, ancla] of rotulos) {
      const x = ancla === 'start' ? m.izq + i * banda : ancla === 'end' ? m.izq + (i + 1) * banda : m.izq + (i + 0.5) * banda;
      const t = el('text', { class: 'grafico__texto', x, y: alto - 6 * k, 'text-anchor': ancla }, svg);
      t.textContent = texto;
    }
    const nodos = [svg, globo];
    if (total === 0) {
      // en HTML y no en el SVG: con la letra grande se parte en renglones en vez de salirse del gráfico
      const vacio = document.createElement('p');
      vacio.className = 'grafico__vacio';
      vacio.textContent = 'Todavía no entra nadie en estos 15 minutos';
      const escala = contenedor.clientWidth / ancho || 1;
      vacio.style.left = `${m.izq * escala}px`;
      vacio.style.width = `${w * escala}px`;
      vacio.style.top = `${(m.arriba + h / 2) * escala}px`;
      nodos.push(vacio);
    }
    contenedor.replaceChildren(...nodos);
    globo.hidden = true;

    function mostrarGlobo(i, x, y) {
      const d = datos[i];
      globo.textContent = `${hora(d.inicio)}${d.enCurso ? ' (en curso)' : ''}: ${d.entradas} ${d.entradas === 1 ? 'entrada' : 'entradas'}, ${d.salidas} ${d.salidas === 1 ? 'salida' : 'salidas'}`;
      const escala = contenedor.clientWidth / ancho || 1;
      globo.style.top = `${y * escala}px`;
      globo.hidden = false;
      // centrado sobre la barra, pero sin salirse del gráfico por los costados
      const mitad = globo.offsetWidth / 2;
      const izquierda = Math.min(Math.max(x * escala, mitad), contenedor.clientWidth - mitad);
      globo.style.left = `${izquierda}px`;
    }
  }

  const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(() => ultimo && pintar(ultimo)) : null;
  if (observador) observador.observe(contenedor);

  return { pintar };
}

export function pintarTablaMinutos(contenedor, datos) {
  const tabla = document.createElement('table');
  tabla.className = 'tabla';
  const cab = tabla.createTHead().insertRow();
  for (const t of ['Minuto', 'Entradas', 'Salidas']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = t;
    cab.appendChild(th);
  }
  const cuerpo = tabla.createTBody();
  for (const d of [...datos].reverse()) {
    const fila = cuerpo.insertRow();
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = hora(d.inicio) + (d.enCurso ? ' (en curso)' : '');
    fila.appendChild(th);
    fila.insertCell().textContent = String(d.entradas);
    fila.insertCell().textContent = String(d.salidas);
  }
  contenedor.replaceChildren(tabla);
}
