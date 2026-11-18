// El registrador: una tira por sensor, todas con el mismo eje de tiempo y un cursor común.
// Solo dibuja (SVG); las escalas, ventanas y estados salen de nucleo/.

import { anchoBin, binsEnergia, dominioY, enVentana, indiceCercano, intervaloEn, intervalosEnVentana, ticksTiempo } from './nucleo/escalas.mjs';
import { bandaDe, estadoEn } from './nucleo/reglas.mjs';
import { fmtDuracion, fmtHora, fmtFecha, fmtLimite, fmtMomento, fmtNumero, fmtValor } from './nucleo/formato.mjs';
import { CIRCUITOS, sensor } from './nucleo/sensores.mjs';

const NS = 'http://www.w3.org/2000/svg';
export const IZQ = 40; // margen izquierdo (rótulos del eje Y)
export const DER = 8;

const LINEAS = {
  nevera: { alto: 92, rangoMin: 4 },
  cuarto: { alto: 92, rangoMin: 4 },
  congelador: { alto: 92, rangoMin: 4 },
  vibracion: { alto: 64, rangoMin: 3, piso: 0 },
  tanque: { alto: 72, fijo: [0, 100] },
  humedad: { alto: 72, rangoMin: 20, piso: 0, techo: 100 },
};
const ESTADOS = ['puertaNevera', 'puertaCuarto', 'bomba'];
const NOMBRE_FALLA = {
  puerta: 'Puerta de la nevera abierta',
  corte: 'Corte de corriente',
  fuga: 'Fuga en el tanque',
  compresora: 'Compresora dañada',
};
const ORDEN_FALLAS = ['puerta', 'corte', 'fuga', 'compresora'];
// De abajo arriba en la barra (refrigeración pegada a la base: es la serie resaltada).
const PILA = ['refri', 'cocina', 'aire'];
const CLAVE_ENERGIA = { aire: 'eAire', cocina: 'eCocina', refri: 'eRefri' };

function nodo(nombre, attrs = {}, texto) {
  const n = document.createElementNS(NS, nombre);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (texto !== undefined) n.textContent = texto;
  return n;
}

const r1 = (v) => Math.round(v * 10) / 10;

export function crearRegistrador(raiz, { alMoverCursor }) {
  const tiras = new Map();
  for (const t of raiz.querySelectorAll('.tira[data-tira]')) {
    tiras.set(t.dataset.tira, {
      nodo: t,
      svg: t.querySelector('svg'),
      valor: t.querySelector('[data-valor]'),
      estado: t.querySelector('[data-estado]'),
      unidad: t.querySelector('[data-unidad]'),
      leyenda: t.querySelector('[data-leyenda]'),
      texto: { valor: '', estado: '', tipo: '' },
      etiqueta: '',
    });
  }
  // El eje del tiempo va arriba (junto a la nevera, la tira principal) y abajo (junto al consumo).
  const ejesX = [...raiz.querySelectorAll('.eje-x')];
  let ancho = Math.max(240, Math.round(raiz.clientWidth));
  let ultimo = null;
  let ultimaEtiqueta = 0;

  const ro = new ResizeObserver(() => {
    const nuevo = Math.max(240, Math.round(raiz.clientWidth));
    if (nuevo !== ancho) {
      ancho = nuevo;
      if (ultimo) dibujar(ultimo);
    }
  });
  ro.observe(raiz);

  // ── puntero y teclado ──
  let fijado = false;
  function tDesdeEvento(e) {
    if (!ultimo) return null;
    const caja = raiz.getBoundingClientRect();
    const px = e.clientX - caja.left;
    const { desde, hasta } = ultimo;
    const util = ancho - IZQ - DER;
    const t = desde + ((px - IZQ) / util) * (hasta - desde);
    return Math.min(hasta, Math.max(desde, t));
  }
  raiz.addEventListener('pointerdown', (e) => {
    const t = tDesdeEvento(e);
    if (t === null) return;
    fijado = true;
    if (e.pointerType !== 'mouse') raiz.setPointerCapture?.(e.pointerId);
    alMoverCursor(t, { fijo: true });
  });
  raiz.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && !fijado) {
      alMoverCursor(tDesdeEvento(e), { fijo: false });
    } else if (e.pointerType !== 'mouse' && raiz.hasPointerCapture?.(e.pointerId)) {
      alMoverCursor(tDesdeEvento(e), { fijo: true });
    }
  });
  raiz.addEventListener('pointerup', (e) => {
    if (raiz.hasPointerCapture?.(e.pointerId)) raiz.releasePointerCapture(e.pointerId);
  });
  raiz.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !fijado) alMoverCursor(null, { fijo: false });
  });
  raiz.addEventListener('keydown', (e) => {
    if (!ultimo) return;
    const { desde, hasta, cursor } = ultimo;
    const actual = cursor ?? hasta;
    const paso = e.shiftKey ? 600 : 60;
    let t = null;
    if (e.key === 'ArrowLeft') t = actual - paso;
    else if (e.key === 'ArrowRight') t = actual + paso;
    else if (e.key === 'Home') t = desde;
    else if (e.key === 'End') t = hasta;
    else if (e.key === 'Escape') {
      fijado = false;
      alMoverCursor(null, { fijo: false, teclado: true });
      e.preventDefault();
      return;
    } else return;
    e.preventDefault();
    fijado = true;
    alMoverCursor(Math.min(hasta, Math.max(desde, t)), { fijo: true, teclado: true });
  });

  function soltar() {
    fijado = false;
  }

  // ── dibujo ──
  // d: { muestras, intervalos, alertas, reglas, periodos, desde, hasta, ahora, cursor, horas, baseISO }
  function dibujar(d) {
    ultimo = d;
    const { desde, hasta } = d;
    const util = ancho - IZQ - DER;
    const x = (t) => IZQ + ((t - desde) / (hasta - desde)) * util;
    const visibles = enVentana(d.muestras, desde - 60, hasta);
    const { ticks } = ticksTiempo(desde, hasta, util);
    const tCursor = d.cursor ?? d.ahora;
    const iCursor = indiceCercano(d.muestras, tCursor);
    const mCursor = iCursor >= 0 ? d.muestras[iCursor] : null;
    const contexto = { d, x, util, visibles, ticks, tCursor, mCursor };
    const etiquetar = performance.now() - ultimaEtiqueta > 1500;
    if (etiquetar) ultimaEtiqueta = performance.now();

    dibujarFallas(contexto);
    for (const id of Object.keys(LINEAS)) dibujarLinea(id, contexto, etiquetar);
    dibujarEstados(contexto, etiquetar);
    dibujarEnergia(contexto, etiquetar);
    dibujarEjeX(contexto);
  }

  function base(svg, alto) {
    svg.setAttribute('width', ancho);
    svg.setAttribute('height', alto);
    svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
    const hijos = [];
    return hijos;
  }

  function rejillaVertical(hijos, ctx, y0, y1) {
    for (const t of ctx.ticks) {
      const px = Math.round(ctx.x(t)) + 0.5;
      hijos.push(nodo('line', { class: 'g-rejilla', x1: px, x2: px, y1: y0, y2: y1 }));
    }
  }

  function cursorVertical(hijos, ctx, y0, y1) {
    if (ctx.d.cursor === null || ctx.d.cursor === undefined) return;
    const px = Math.round(ctx.x(ctx.d.cursor)) + 0.5;
    hijos.push(nodo('line', { class: 'g-cursor', x1: px, x2: px, y1: y0, y2: y1 }));
  }

  function marcasDeFallas(hijos, ctx, y0, y1) {
    for (const p of ctx.d.periodos) {
      if (p.inicio < ctx.d.desde || p.inicio > ctx.d.hasta) continue;
      const px = Math.round(ctx.x(p.inicio)) + 0.5;
      hijos.push(nodo('line', { class: 'g-marca-falla', x1: px, x2: px, y1: y0, y2: y1 }));
    }
  }

  function tramosDeAviso(hijos, ctx, sensores, y0, y1) {
    for (const a of ctx.d.alertas) {
      if (!sensores.includes(a.sensor)) continue;
      const fin = a.fin ?? ctx.d.ahora;
      if (fin < ctx.d.desde || a.inicio > ctx.d.hasta) continue;
      const xa = Math.max(IZQ, ctx.x(a.inicio));
      const xb = Math.min(IZQ + ctx.util, ctx.x(fin));
      hijos.push(nodo('rect', { class: 'g-tramo-aviso', x: r1(xa), y: y0, width: r1(Math.max(1, xb - xa)), height: y1 - y0 }));
      if (a.aviso >= ctx.d.desde && a.aviso <= ctx.d.hasta) {
        const px = r1(ctx.x(a.aviso));
        hijos.push(nodo('line', { class: 'g-marca-aviso', x1: px, x2: px, y1: y0, y2: y1 }));
      }
    }
  }

  function ponerTexto(t, valor, estado) {
    if (valor !== undefined && t.texto.valor !== valor) {
      t.valor.textContent = valor;
      t.texto.valor = valor;
    }
    if (estado && t.estado && (t.texto.estado !== estado.texto || t.texto.tipo !== estado.tipo)) {
      t.estado.replaceChildren();
      const punto = document.createElement('span');
      punto.className = `punto ${estado.tipo === 'aviso' ? 'punto--aviso' : estado.tipo === 'fuera' ? 'punto--fuera' : estado.tipo === 'neutro' ? 'punto--neutro' : ''}`;
      punto.setAttribute('aria-hidden', 'true');
      t.estado.append(punto, document.createTextNode(estado.texto));
      t.estado.dataset.tipo = estado.tipo;
      t.texto.estado = estado.texto;
      t.texto.tipo = estado.tipo;
    }
  }

  // Varias lecturas cortas en la misma cabecera, cada una en su renglón flexible.
  function ponerLista(t, partes) {
    const clave = partes.join('|');
    if (t.texto.valor === clave) return;
    t.valor.replaceChildren(
      ...partes.map((p) => {
        const s = document.createElement('span');
        s.textContent = p;
        return s;
      }),
    );
    t.texto.valor = clave;
  }

  function dibujarLinea(id, ctx, etiquetar) {
    const t = tiras.get(id);
    if (!t) return;
    const cfg = LINEAS[id];
    const s = sensor(id);
    const alto = cfg.alto;
    const hijos = base(t.svg, alto);
    // 8 px de margen: los rótulos del eje Y (12 px, centrados en su línea) no se salen del gráfico
    const y0 = 8;
    const y1 = alto - 8;
    const banda = bandaDe(id, ctx.d.reglas);
    const valores = ctx.visibles.map((m) => m[id]);
    const dom = cfg.fijo
      ? { lo: cfg.fijo[0], hi: cfg.fijo[1], ticks: [0, 50, 100] }
      : dominioY(valores, { banda, rangoMin: cfg.rangoMin, piso: cfg.piso ?? null, techo: cfg.techo ?? null, cuantos: 4 });
    const y = (v) => y0 + ((dom.hi - v) / (dom.hi - dom.lo)) * (y1 - y0);

    tramosDeAviso(hijos, ctx, [id], y0, y1);
    if (banda) {
      const ya = banda.max !== null ? Math.max(y0, y(banda.max)) : y0;
      const yb = banda.min !== null ? Math.min(y1, y(banda.min)) : y1;
      hijos.push(nodo('rect', { class: 'g-banda', x: IZQ, y: r1(ya), width: ctx.util, height: r1(Math.max(0, yb - ya)) }));
      for (const lim of [banda.max, banda.min]) {
        if (lim === null || lim < dom.lo || lim > dom.hi) continue;
        const py = Math.round(y(lim)) + 0.5;
        hijos.push(nodo('line', { class: 'g-banda-borde', x1: IZQ, x2: IZQ + ctx.util, y1: py, y2: py }));
      }
    }
    for (const v of dom.ticks) {
      const py = Math.round(y(v)) + 0.5;
      hijos.push(nodo('line', { class: 'g-rejilla', x1: IZQ, x2: IZQ + ctx.util, y1: py, y2: py, opacity: 0.6 }));
      hijos.push(nodo('text', { class: 'g-eje', x: IZQ - 6, y: py + 4, 'text-anchor': 'end' }, fmtNumero(v, Number.isInteger(v) ? 0 : 1)));
    }
    rejillaVertical(hijos, ctx, y0, y1);
    marcasDeFallas(hijos, ctx, y0, y1);

    // la línea; fuera del rango se repinta en rojo con un recorte
    let dPath = '';
    for (let i = 0; i < ctx.visibles.length; i++) {
      const m = ctx.visibles[i];
      const px = r1(Math.max(IZQ - 2, ctx.x(m.t)));
      const py = r1(y(m[id]));
      dPath += (i ? 'L' : 'M') + px + ' ' + py;
    }
    if (dPath) {
      hijos.push(nodo('path', { class: 'g-linea', d: dPath }));
      if (banda) {
        const idRecorte = `fuera-${id}`;
        const recorte = nodo('clipPath', { id: idRecorte });
        if (banda.max !== null) recorte.append(nodo('rect', { x: 0, y: -10, width: ancho, height: r1(Math.max(0, y(banda.max) + 10)) }));
        if (banda.min !== null) recorte.append(nodo('rect', { x: 0, y: r1(y(banda.min)), width: ancho, height: alto + 10 }));
        hijos.push(recorte);
        hijos.push(nodo('path', { class: 'g-linea g-linea--fuera', d: dPath, 'clip-path': `url(#${idRecorte})` }));
      }
    } else {
      hijos.push(nodo('text', { class: 'g-vacio', x: IZQ + 6, y: (y0 + y1) / 2 + 4 }, 'Sin lecturas en esta ventana'));
    }

    cursorVertical(hijos, ctx, y0, y1);
    const m = ctx.mCursor;
    if (m && ctx.d.cursor !== null && ctx.d.cursor !== undefined) {
      const fuera = banda && ((banda.max !== null && m[id] > banda.max) || (banda.min !== null && m[id] < banda.min));
      hijos.push(nodo('circle', { class: `g-punto${fuera ? ' g-punto--fuera' : ''}`, cx: r1(ctx.x(m.t)), cy: r1(y(m[id])), r: 4.5 }));
    }
    t.svg.replaceChildren(...hijos);

    if (m) ponerTexto(t, fmtValor(id, m[id]), estadoEn(id, m.t, m[id], ctx.d.alertas, ctx.d.reglas));
    if (etiquetar) {
      const lo = Math.min(...valores.filter(Number.isFinite));
      const hi = Math.max(...valores.filter(Number.isFinite));
      let rango = '';
      if (banda && banda.min !== null && banda.max !== null) rango = ` Rango de la regla: de ${fmtLimite(id, banda.min)} a ${fmtLimite(id, banda.max)}.`;
      else if (banda && banda.max !== null) rango = ` Rango de la regla: ${fmtLimite(id, banda.max)} o menos.`;
      else if (banda && banda.min !== null) rango = ` Rango de la regla: ${fmtLimite(id, banda.min)} o más.`;
      const texto = valores.length
        ? `${s.nombre}, últimas ${ctx.d.horas} h: entre ${fmtValor(id, lo)} y ${fmtValor(id, hi)}. Ahora ${fmtValor(id, ctx.d.muestras.at(-1)[id])}.${rango}`
        : `${s.nombre}: sin lecturas en esta ventana.`;
      if (t.etiqueta !== texto) {
        t.svg.setAttribute('aria-label', texto);
        t.etiqueta = texto;
      }
    }
  }

  function dibujarEstados(ctx, etiquetar) {
    const t = tiras.get('estados');
    if (!t) return;
    const carril = 16;
    const sep = 6;
    const alto = ESTADOS.length * (carril + sep) + 2;
    const hijos = base(t.svg, alto);
    rejillaVertical(hijos, ctx, 0, alto);
    marcasDeFallas(hijos, ctx, 0, alto);
    const partes = [];
    ESTADOS.forEach((id, i) => {
      const s = sensor(id);
      const ya = 2 + i * (carril + sep);
      hijos.push(nodo('rect', { class: 'g-estado-fondo', x: IZQ, y: ya, width: ctx.util, height: carril }));
      tramosDeAviso(hijos, ctx, [id], ya, ya + carril);
      for (const iv of intervalosEnVentana(ctx.d.intervalos[id], ctx.d.desde, ctx.d.hasta)) {
        const xa = ctx.x(iv.inicio);
        const w = Math.max(1.5, ctx.x(iv.fin) - xa);
        hijos.push(nodo('rect', { class: 'g-estado', x: r1(xa), y: ya + 3, width: r1(w), height: carril - 6 }));
      }
      hijos.push(nodo('text', { class: 'g-eje', x: IZQ - 6, y: ya + carril - 4, 'text-anchor': 'end' }, s.etiqueta));
      const iv = intervaloEn(ctx.d.intervalos[id], ctx.tCursor);
      let txt = `${s.etiqueta} ${s.nombre.replace('Puerta de la ', 'Puerta ').replace('Puerta del ', 'Puerta ')}: ${iv ? s.activo : s.inactivo}`;
      if (iv) txt += ` desde ${fmtMomento(iv.inicio, ctx.tCursor, ctx.d.baseISO)}`;
      partes.push(txt);
    });
    cursorVertical(hijos, ctx, 0, alto);
    t.svg.replaceChildren(...hijos);
    ponerLista(t, partes);
    if (etiquetar) {
      const resumen = ESTADOS.map((id) => {
        const s = sensor(id);
        const ivs = intervalosEnVentana(ctx.d.intervalos[id], ctx.d.desde, ctx.d.hasta);
        const total = ivs.reduce((acc, iv) => acc + (iv.fin - iv.inicio), 0);
        if (!ivs.length) return `${s.nombre}: no ${s.activo === 'abierta' ? 'se abrió' : 'se encendió'}`;
        return `${s.nombre}: ${ivs.length === 1 ? '1 vez' : `${ivs.length} veces`} ${s.activo}, ${fmtDuracion(total)} en total`;
      }).join('; ');
      const texto = `Puertas y bomba, últimas ${ctx.d.horas} h. ${resumen}.`;
      if (t.etiqueta !== texto) {
        t.svg.setAttribute('aria-label', texto);
        t.etiqueta = texto;
      }
    }
  }

  function dibujarFallas(ctx) {
    const t = tiras.get('fallas');
    if (!t) return;
    const enVentanaFallas = ctx.d.periodos.filter((p) => (p.fin ?? ctx.d.ahora) >= ctx.d.desde && p.inicio <= ctx.d.hasta);
    const carriles = ORDEN_FALLAS.filter((f) => enVentanaFallas.some((p) => p.falla === f));
    const carril = 18;
    const alto = Math.max(1, carriles.length) * (carril + 4) + 2;
    const hijos = base(t.svg, alto);
    rejillaVertical(hijos, ctx, 0, alto);
    if (!carriles.length) {
      hijos.push(nodo('text', { class: 'g-vacio', x: IZQ + 6, y: 15 }, 'Sin fallas en esta ventana'));
    }
    carriles.forEach((f, i) => {
      const ya = 2 + i * (carril + 4);
      for (const p of enVentanaFallas.filter((q) => q.falla === f)) {
        const xa = Math.max(IZQ, ctx.x(p.inicio));
        const xb = Math.min(IZQ + ctx.util, ctx.x(p.fin ?? ctx.d.ahora));
        const w = Math.max(2, xb - xa);
        hijos.push(nodo('rect', { class: 'g-falla', x: r1(xa), y: ya, width: r1(w), height: carril, rx: 2 }));
        const nombre = NOMBRE_FALLA[f];
        if (w > nombre.length * 6.6 + 12) hijos.push(nodo('text', { class: 'g-falla-texto', x: r1(xa + 6), y: ya + 13 }, nombre));
      }
    });
    cursorVertical(hijos, ctx, 0, alto);
    t.svg.replaceChildren(...hijos);
    const activas = ctx.d.periodos.filter((p) => p.inicio <= ctx.tCursor && (p.fin === null || ctx.tCursor < p.fin));
    const valor = activas.length
      ? activas.map((p) => `${NOMBRE_FALLA[p.falla]} desde ${fmtMomento(p.inicio, ctx.tCursor, ctx.d.baseISO)}`).join('; ')
      : ctx.d.cursor !== null && ctx.d.cursor !== undefined
        ? 'Ninguna en ese momento'
        : 'Ninguna ahora';
    ponerTexto(t, valor);
  }

  function dibujarEnergia(ctx, etiquetar) {
    const t = tiras.get('energia');
    if (!t) return;
    const alto = 92;
    const y0 = 8;
    const y1 = alto - 8;
    const hijos = base(t.svg, alto);
    const ancho1 = anchoBin(ctx.d.horas);
    const bins = binsEnergia(ctx.d.muestras, ctx.d.desde, ctx.d.hasta, ancho1);
    const maximo = Math.max(0.1, ...bins.map((b) => b.total));
    const dom = dominioY([0, maximo], { piso: 0, cuantos: 3 });
    const y = (v) => y0 + ((dom.hi - v) / (dom.hi - dom.lo)) * (y1 - y0);
    tramosDeAviso(hijos, ctx, ['corriente'], y0, y1);
    for (const v of dom.ticks) {
      const py = Math.round(y(v)) - 0.5;
      hijos.push(nodo('line', { class: 'g-rejilla', x1: IZQ, x2: IZQ + ctx.util, y1: py, y2: py, opacity: v === 0 ? 1 : 0.6 }));
      hijos.push(nodo('text', { class: 'g-eje', x: IZQ - 6, y: py + 4, 'text-anchor': 'end' }, fmtNumero(v, Number.isInteger(v) ? 0 : 1)));
    }
    marcasDeFallas(hijos, ctx, y0, y1);
    const idRecorte = 'recorte-energia';
    hijos.push(nodo('clipPath', { id: idRecorte }, undefined));
    hijos.at(-1).append(nodo('rect', { x: IZQ, y: 0, width: ctx.util, height: alto }));
    const grupo = nodo('g', { 'clip-path': `url(#${idRecorte})` });
    const pxBin = (ancho1 / (ctx.d.hasta - ctx.d.desde)) * ctx.util;
    const w = Math.max(2, Math.min(24, pxBin - 2));
    const binCursor = ctx.d.cursor !== null && ctx.d.cursor !== undefined ? bins.find((b) => b.inicio < ctx.d.cursor && ctx.d.cursor <= b.fin) : null;
    for (const b of bins) {
      if (b.minutos === 0) continue;
      const cx = ctx.x(b.inicio + ancho1 / 2);
      const xa = r1(cx - w / 2);
      let acumulado = 0;
      const segmentos = PILA.filter((c) => b[c] > 0);
      segmentos.forEach((c, k) => {
        const ya = y(acumulado + b[c]);
        const yb = y(acumulado);
        acumulado += b[c];
        const hueco = k > 0 ? 2 : 0; // 2 px de papel entre segmentos
        const h = yb - ya - hueco;
        if (h <= 0.4) return;
        const clase = `g-${c}${b.enCurso ? ' g-barra-curso' : ''}`;
        if (k === segmentos.length - 1) {
          // extremo de datos redondeado (4 px), base recta
          const rr = Math.min(4, w / 2, h);
          const d = `M${xa} ${r1(ya + h)}V${r1(ya + rr)}Q${xa} ${r1(ya)} ${r1(xa + rr)} ${r1(ya)}H${r1(xa + w - rr)}Q${r1(xa + w)} ${r1(ya)} ${r1(xa + w)} ${r1(ya + rr)}V${r1(ya + h)}Z`;
          grupo.append(nodo('path', { class: clase, d }));
        } else {
          grupo.append(nodo('rect', { class: clase, x: xa, y: r1(ya), width: r1(w), height: r1(h) }));
        }
      });
      if (b === binCursor) {
        grupo.append(nodo('rect', { class: 'g-barra-elegida', x: r1(xa - 2), y: r1(y(b.total) - 2), width: r1(w + 4), height: r1(y(0) - y(b.total) + 2), fill: 'none', rx: 2 }));
      }
    }
    hijos.push(grupo);
    rejillaVertical(hijos, ctx, y0, y1 - 1);
    cursorVertical(hijos, ctx, y0, y1);
    t.svg.replaceChildren(...hijos);

    const etiquetaAncho = ancho1 === 3600 ? '(kWh por hora)' : `(kWh cada ${ancho1 / 60} min)`;
    if (t.unidad && t.unidad.textContent !== etiquetaAncho) t.unidad.textContent = etiquetaAncho;
    const m = ctx.mCursor;
    const enCorte = m ? m.aire + m.cocina + m.refri < 0.05 : false;
    const estado = enCorte ? estadoEn('corriente', m.t, 0, ctx.d.alertas, ctx.d.reglas) : { tipo: 'ok', texto: 'con corriente' };
    if (enCorte && estado.tipo !== 'aviso') estado.texto = 'sin corriente';
    else if (enCorte) estado.texto = 'aviso: sin corriente';
    let valor;
    let porCircuito;
    if (binCursor) {
      valor = `${fmtNumero(binCursor.total, 2)} kWh de ${fmtHora(binCursor.inicio)} a ${fmtHora(binCursor.fin)}${binCursor.enCurso ? ' (en curso)' : ''}`;
      porCircuito = binCursor;
    } else {
      const totales = { aire: 0, cocina: 0, refri: 0 };
      for (const mm of ctx.visibles) {
        if (mm.t <= ctx.d.desde) continue;
        for (const c of PILA) totales[c] += mm[CLAVE_ENERGIA[c]];
      }
      const total = totales.aire + totales.cocina + totales.refri;
      valor = `${fmtNumero(total, 1)} kWh en ${ctx.d.horas} h`;
      porCircuito = totales;
    }
    ponerTexto(t, valor, estado);
    if (t.leyenda) {
      for (const li of t.leyenda.querySelectorAll('[data-circuito]')) {
        const c = li.dataset.circuito;
        const span = li.querySelector('[data-kwh]');
        const txt = `${fmtNumero(porCircuito[c], binCursor ? 2 : 1)} kWh`;
        if (span.textContent !== txt) span.textContent = txt;
      }
    }
    if (etiquetar) {
      const max = bins.reduce((a, b) => (b.total > a.total ? b : a), bins[0]);
      const texto = max
        ? `Consumo eléctrico, últimas ${ctx.d.horas} h, en barras ${etiquetaAncho}: el máximo fue ${fmtNumero(max.total, 2)} kWh de ${fmtHora(max.inicio)} a ${fmtHora(max.fin)}. ${CIRCUITOS.map((c) => c.corto).join(', ')}.`
        : 'Consumo eléctrico: sin lecturas en esta ventana.';
      if (t.etiqueta !== texto) {
        t.svg.setAttribute('aria-label', texto);
        t.etiqueta = texto;
      }
    }
  }

  function dibujarEjeX(ctx) {
    for (const ejeX of ejesX) dibujarUnEje(ejeX, ctx);
  }

  function dibujarUnEje(ejeX, ctx) {
    const hijos = base(ejeX, 22);
    let ultimoFin = -Infinity;
    for (const t of ctx.ticks) {
      const px = ctx.x(t);
      const medianoche = t % 86400 === 0;
      const texto = medianoche ? fmtFecha(t, ctx.d.baseISO) : fmtHora(t);
      const anchoTexto = texto.length * 7;
      let ax = px;
      let anchor = 'middle';
      if (px - anchoTexto / 2 < 0) {
        ax = 0;
        anchor = 'start';
      } else if (px + anchoTexto / 2 > ancho) {
        ax = ancho;
        anchor = 'end';
      }
      const inicioTexto = anchor === 'middle' ? ax - anchoTexto / 2 : anchor === 'start' ? ax : ax - anchoTexto;
      if (inicioTexto < ultimoFin + 6) continue;
      ultimoFin = inicioTexto + anchoTexto;
      hijos.push(nodo('text', { class: 'g-eje', x: r1(ax), y: 15, 'text-anchor': anchor, 'font-weight': medianoche ? 700 : null }, texto));
    }
    ejeX.replaceChildren(...hijos);
  }

  return { dibujar, soltar, get ancho() { return ancho; } };
}
