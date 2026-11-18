// El plano como datos y lo que se construye con él: paredes con grosor, huecos de puertas y ventanas,
// segmentos de colisión y ambientes con su área. Sin DOM ni three.js.
//
// Formato (versión 1), en metros, «y» hacia abajo del plano:
// {
//   formato: 'atk-plano', version: 1, nombre, alto,
//   inicio: { x, y, rumbo },            // rumbo en grados, 0 = hacia arriba del plano, 90 = hacia la derecha
//   ambientes: [{ id, nombre, tipo, poligono: [[x, y], …] }],
//   paredes:   [{ a: [x, y], b: [x, y], grosor, tipo: 'exterior' | 'interior' | 'baranda' }],
//   aberturas: [{ tipo, x, y, ancho, antepecho?, dintel?, bisagra? }]   // (x, y) = centro del hueco; bisagra 'a' | 'b'
// }

import { areaPoligono, caja, distanciaAlBorde, distanciaPuntoSegmento, puntoEnPoligono, puntoEtiqueta } from './geometria.mjs';

export const FORMATO = 'atk-plano';
export const VERSION_PLANO = 1;
export const ALTO_PARED = 2.6;
export const ALTO_BARANDA = 1.0;
export const GROSOR = { exterior: 0.2, interior: 0.12, baranda: 0.06 };

export const TIPOS_AMBIENTE = {
  sala: { nombre: 'Sala o comedor', exterior: false },
  cocina: { nombre: 'Cocina', exterior: false },
  recamara: { nombre: 'Recámara', exterior: false },
  bano: { nombre: 'Baño', exterior: false },
  lavanderia: { nombre: 'Lavandería', exterior: false },
  pasillo: { nombre: 'Pasillo', exterior: false },
  otro: { nombre: 'Otro', exterior: false },
  balcon: { nombre: 'Balcón o terraza', exterior: true },
};

// pasa: se puede caminar por el hueco. 'mitad': corrediza con una hoja fija de vidrio. articulo: para los mensajes.
export const TIPOS_ABERTURA = {
  puerta: { nombre: 'Puerta', articulo: 'La', pasa: true, antepecho: 0, dintel: 2.1 },
  vano: { nombre: 'Vano sin puerta', articulo: 'El', pasa: true, antepecho: 0, dintel: 2.2 },
  corrediza: { nombre: 'Puerta corrediza de vidrio', articulo: 'La', pasa: 'mitad', antepecho: 0, dintel: 2.2 },
  'puerta-cerrada': { nombre: 'Puerta de entrada (cerrada)', articulo: 'La', pasa: false, antepecho: 0, dintel: 2.1 },
  ventana: { nombre: 'Ventana', articulo: 'La', pasa: false, antepecho: 0.9, dintel: 2.2 },
};
/** «La puerta en (1, 2)», «El vano sin puerta en (3.8, 3.9)». */
const nombreAbertura = (t, ab) => `${t.articulo} ${t.nombre.toLowerCase()} en (${ab.x}, ${ab.y})`;

const mm = (v) => Math.round(v * 1000);
const m = (v) => v / 1000;
const esExterior = (amb) => Boolean(TIPOS_AMBIENTE[amb.tipo]?.exterior);

/**
 * Deriva las paredes de los bordes de los ambientes (solo bordes horizontales o verticales):
 * un borde compartido por dos ambientes interiores es pared interior; el que da afuera o a un balcón, exterior;
 * el borde suelto de un balcón, baranda. Los tramos contiguos del mismo tipo se unen en una sola pared.
 */
export function paredesDesdeAmbientes(ambientes) {
  const lineas = new Map(); // 'h:<y>' o 'v:<x>' → [{ i0, i1, amb }]
  for (const amb of ambientes) {
    const p = amb.poligono;
    for (let i = 0; i < p.length; i++) {
      const [ax, ay] = p[i].map(mm);
      const [bx, by] = p[(i + 1) % p.length].map(mm);
      if (ax === bx && ay === by) continue;
      let clave, i0, i1;
      if (ay === by) { clave = `h:${ay}`; i0 = Math.min(ax, bx); i1 = Math.max(ax, bx); }
      else if (ax === bx) { clave = `v:${ax}`; i0 = Math.min(ay, by); i1 = Math.max(ay, by); }
      else throw new Error(`El ambiente «${amb.nombre}» tiene una pared en diagonal; este plano solo admite paredes horizontales o verticales.`);
      if (!lineas.has(clave)) lineas.set(clave, []);
      lineas.get(clave).push({ i0, i1, amb });
    }
  }
  const claves = [...lineas.keys()].sort((a, b) => {
    if (a[0] !== b[0]) return a[0] === 'h' ? -1 : 1;
    return Number(a.slice(2)) - Number(b.slice(2));
  });
  const paredes = [];
  for (const clave of claves) {
    const bordes = lineas.get(clave);
    const cortes = [...new Set(bordes.flatMap((b) => [b.i0, b.i1]))].sort((a, b) => a - b);
    const tramos = [];
    for (let k = 0; k < cortes.length - 1; k++) {
      const p = cortes[k], q = cortes[k + 1];
      const cubren = bordes.filter((b) => b.i0 <= p && b.i1 >= q).map((b) => b.amb);
      if (!cubren.length) continue;
      const interiores = cubren.filter((a) => !esExterior(a)).length;
      const tipo = interiores >= 2 ? 'interior' : interiores === 1 ? 'exterior' : cubren.length === 1 ? 'baranda' : null;
      if (!tipo) continue;
      const ultimo = tramos[tramos.length - 1];
      if (ultimo && ultimo.tipo === tipo && ultimo.q === p) ultimo.q = q;
      else tramos.push({ p, q, tipo });
    }
    const fijo = Number(clave.slice(2));
    for (const t of tramos) {
      const a = clave[0] === 'h' ? [m(t.p), m(fijo)] : [m(fijo), m(t.p)];
      const b = clave[0] === 'h' ? [m(t.q), m(fijo)] : [m(fijo), m(t.q)];
      paredes.push({ a, b, grosor: GROSOR[t.tipo], tipo: t.tipo });
    }
  }
  return paredes;
}

/**
 * Piezas sólidas de una pared de largo «largo» con huecos [{ desde, hasta, antepecho, dintel }]:
 * lo que queda entre huecos va de piso a techo; bajo una ventana queda el antepecho y sobre cada hueco, el dintel.
 */
export function piezasDePared(largo, alto, huecos) {
  const piezas = [];
  let cursor = 0;
  const orden = [...huecos].sort((a, b) => a.desde - b.desde);
  for (const h of orden) {
    if (h.desde > cursor + 1e-6) piezas.push({ desde: cursor, hasta: h.desde, y0: 0, y1: alto });
    if (h.antepecho > 1e-6) piezas.push({ desde: h.desde, hasta: h.hasta, y0: 0, y1: Math.min(h.antepecho, alto) });
    if (h.dintel < alto - 1e-6) piezas.push({ desde: h.desde, hasta: h.hasta, y0: Math.max(h.dintel, 0), y1: alto });
    cursor = Math.max(cursor, h.hasta);
  }
  if (cursor < largo - 1e-6) piezas.push({ desde: cursor, hasta: largo, y0: 0, y1: alto });
  return piezas;
}

/** Tramos de la pared que no se pueden cruzar caminando: todo menos los huecos de paso. */
export function tramosDeColision(largo, huecos) {
  const libres = [];
  for (const h of huecos) {
    const t = TIPOS_ABERTURA[h.tipo];
    if (!t) continue;
    if (t.pasa === true) libres.push([h.desde, h.hasta]);
    else if (t.pasa === 'mitad') libres.push([h.desde, (h.desde + h.hasta) / 2]);
  }
  libres.sort((a, b) => a[0] - b[0]);
  const tramos = [];
  let cursor = 0;
  for (const [d, h] of libres) {
    if (d > cursor + 1e-6) tramos.push([cursor, d]);
    cursor = Math.max(cursor, h);
  }
  if (cursor < largo - 1e-6) tramos.push([cursor, largo]);
  return tramos;
}

const aPunto = (p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y });

/** Pared en la que cae el centro de la abertura y en la que cabe entera. */
export function ubicarAbertura(ab, paredes) {
  const c = { x: ab.x, y: ab.y };
  let mejor = null;
  paredes.forEach((pared, indice) => {
    const a = aPunto(pared.a), b = aPunto(pared.b);
    if (distanciaPuntoSegmento(c, a, b) > 0.011) return;
    const largo = Math.hypot(b.x - a.x, b.y - a.y);
    const s = ((c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y)) / largo;
    const desde = s - ab.ancho / 2;
    const hasta = s + ab.ancho / 2;
    const cabe = desde >= -0.001 && hasta <= largo + 0.001;
    if (cabe && !mejor) mejor = { indice, desde: Math.max(0, desde), hasta: Math.min(largo, hasta) };
  });
  return mejor;
}

/** Revisa un plano (por ejemplo, uno importado) y dice qué está mal, en frases que dicen qué hacer. */
export function validarPlano(plano) {
  const errores = [];
  if (!plano || typeof plano !== 'object') return { errores: ['El archivo no trae un plano.'] };
  if (plano.formato !== FORMATO) errores.push('El archivo no es un plano de este recorrido (falta «formato: atk-plano»).');
  if (plano.version !== VERSION_PLANO) errores.push(`El plano es de la versión ${plano.version ?? 'desconocida'}; este recorrido lee la versión ${VERSION_PLANO}.`);
  const ambientes = Array.isArray(plano.ambientes) ? plano.ambientes : [];
  if (!ambientes.length) errores.push('El plano no tiene ambientes.');
  const ids = new Set();
  for (const amb of ambientes) {
    const nombre = typeof amb?.nombre === 'string' && amb.nombre.trim() ? amb.nombre.trim() : null;
    if (!nombre) errores.push('Hay un ambiente sin nombre.');
    if (!amb?.id || ids.has(amb.id)) errores.push(`El ambiente «${nombre ?? '?'}» no tiene un id único.`);
    ids.add(amb?.id);
    const pol = amb?.poligono;
    const valido = Array.isArray(pol) && pol.length >= 3 && pol.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
    if (!valido) errores.push(`El ambiente «${nombre ?? '?'}» no tiene un polígono válido (hacen falta 3 puntos o más).`);
    else if (areaPoligono(pol) < 0.25) errores.push(`El ambiente «${nombre ?? '?'}» mide menos de 0.25 m².`);
    if (amb && !TIPOS_AMBIENTE[amb.tipo]) errores.push(`El ambiente «${nombre ?? '?'}» tiene un tipo desconocido («${amb.tipo}»).`);
  }
  if (errores.length) return { errores };

  let paredes = plano.paredes;
  if (!Array.isArray(paredes)) {
    try { paredes = paredesDesdeAmbientes(ambientes); }
    catch (e) { return { errores: [e.message] }; }
  }
  for (const p of paredes) {
    const ok = [p?.a, p?.b].every((q) => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite)) && p.grosor > 0;
    if (!ok) { errores.push('Hay una pared con coordenadas o grosor inválidos.'); break; }
  }
  const porPared = new Map();
  for (const ab of plano.aberturas ?? []) {
    const t = TIPOS_ABERTURA[ab?.tipo];
    if (!t) { errores.push(`Hay una abertura de tipo desconocido («${ab?.tipo}»).`); continue; }
    if (!(ab.ancho >= 0.3)) { errores.push(`${nombreAbertura(t, ab)} mide menos de 0.30 m de ancho.`); continue; }
    const u = ubicarAbertura(ab, paredes);
    if (!u) { errores.push(`${nombreAbertura(t, ab)} no cae sobre ninguna pared o no cabe en ella.`); continue; }
    const lista = porPared.get(u.indice) ?? [];
    if (lista.some((o) => u.desde < o.hasta - 1e-6 && o.desde < u.hasta - 1e-6)) {
      errores.push(`${nombreAbertura(t, ab)} se encima con otra abertura de la misma pared.`);
    }
    lista.push(u);
    porPared.set(u.indice, lista);
  }
  return { errores };
}

export const GROSOR_HOJA = 0.04;
const HOLGURA_HOJA = 0.03; // la hoja abierta queda pegada al marco del lado de la bisagra

const PRIORIDAD_GIRO = { bano: 0, recamara: 1, lavanderia: 2, cocina: 3, otro: 4, pasillo: 5, sala: 6, balcon: 7 };

/**
 * Construye todo lo que necesitan el 3D, el minimapa y el plano en SVG.
 * Lanza un Error con la lista si el plano no es válido.
 */
export function construirModelo(plano) {
  const { errores } = validarPlano(plano);
  if (errores.length) {
    const e = new Error(errores.join(' '));
    e.errores = errores;
    throw e;
  }
  const alto = Number.isFinite(plano.alto) ? plano.alto : ALTO_PARED;
  const ambientes = plano.ambientes.map((amb) => {
    const pol = amb.poligono.map(([x, y]) => ({ x, y }));
    return {
      id: amb.id,
      nombre: amb.nombre.trim(),
      tipo: amb.tipo,
      exterior: esExterior(amb),
      poligono: pol,
      area: areaPoligono(pol),
      caja: caja(pol),
      // «etiqueta» opcional en el plano para mover el nombre (p. ej. lejos del giro de una puerta).
      etiqueta: Array.isArray(amb.etiqueta) && puntoEnPoligono({ x: amb.etiqueta[0], y: amb.etiqueta[1] }, pol)
        ? { x: amb.etiqueta[0], y: amb.etiqueta[1] }
        : puntoEtiqueta(pol),
    };
  });
  const paredesFuente = Array.isArray(plano.paredes) ? plano.paredes : paredesDesdeAmbientes(plano.ambientes);
  const paredes = paredesFuente.map((p) => {
    const a = aPunto(p.a), b = aPunto(p.b);
    const largo = Math.hypot(b.x - a.x, b.y - a.y);
    return {
      a, b, largo,
      dir: { x: (b.x - a.x) / largo, y: (b.y - a.y) / largo },
      grosor: p.grosor,
      tipo: p.tipo ?? 'interior',
      alto: p.tipo === 'baranda' ? ALTO_BARANDA : alto,
      huecos: [],
    };
  });

  const enPared = (pared, s) => ({ x: pared.a.x + pared.dir.x * s, y: pared.a.y + pared.dir.y * s });
  const ladoDe = (p) => ambientes.find((amb) => puntoEnPoligono(p, amb.poligono)) ?? null;

  const aberturas = (plano.aberturas ?? []).map((ab) => {
    const t = TIPOS_ABERTURA[ab.tipo];
    const u = ubicarAbertura(ab, paredesFuente);
    const pared = paredes[u.indice];
    const normal = { x: -pared.dir.y, y: pared.dir.x };
    const centro = { x: ab.x, y: ab.y };
    const lado1 = ladoDe({ x: centro.x + normal.x * 0.3, y: centro.y + normal.y * 0.3 });
    const lado2 = ladoDe({ x: centro.x - normal.x * 0.3, y: centro.y - normal.y * 0.3 });
    const hueco = {
      tipo: ab.tipo,
      ancho: ab.ancho,
      desde: u.desde,
      hasta: u.hasta,
      antepecho: Number.isFinite(ab.antepecho) ? ab.antepecho : t.antepecho,
      dintel: Math.min(Number.isFinite(ab.dintel) ? ab.dintel : t.dintel, pared.alto),
    };
    pared.huecos.push(hueco);
    // Hacia dónde entra la luz (o hacia dónde gira la hoja): al ambiente interior, o al de más prioridad.
    const candidatos = [[lado1, normal], [lado2, { x: -normal.x, y: -normal.y }]].filter(([l]) => l);
    candidatos.sort((x, y) => (x[0].exterior - y[0].exterior) || ((PRIORIDAD_GIRO[x[0].tipo] ?? 9) - (PRIORIDAD_GIRO[y[0].tipo] ?? 9)));
    const [dentro, haciaDentro] = candidatos[0] ?? [null, normal];
    const a = enPared(pared, u.desde);
    const b = enPared(pared, u.hasta);
    // Puerta abierta a 90°: la hoja sale de la bisagra hacia adentro. Es la misma línea que dibuja el plano.
    // La bisagra va en el extremo «a» (el de menor coordenada) salvo que el plano diga bisagra: 'b'.
    const enB = ab.bisagra === 'b';
    const bisagra = enB ? b : a;
    const haciaHueco = enB ? { x: -pared.dir.x, y: -pared.dir.y } : pared.dir;
    const base = { x: bisagra.x + haciaHueco.x * HOLGURA_HOJA, y: bisagra.y + haciaHueco.y * HOLGURA_HOJA };
    const hoja = ab.tipo === 'puerta'
      ? { a: base, b: { x: base.x + haciaDentro.x * ab.ancho, y: base.y + haciaDentro.y * ab.ancho }, bisagra, otro: enB ? a : b }
      : null;
    return {
      ...hueco,
      hoja,
      pared: u.indice,
      centro,
      a,
      b,
      dir: pared.dir,
      grosor: pared.grosor,
      haciaDentro,
      ambienteDentro: dentro?.id ?? null,
      lados: [lado1?.id ?? null, lado2?.id ?? null],
      daAfuera: !lado1 || !lado2 || Boolean(lado1?.exterior) !== Boolean(lado2?.exterior),
    };
  });

  const colision = [];
  for (const pared of paredes) {
    pared.piezas = piezasDePared(pared.largo, pared.alto, pared.huecos).map((pz) => {
      // Las piezas de los extremos se alargan medio grosor para cerrar las esquinas.
      const ext0 = pz.desde < 1e-6 ? pared.grosor / 2 : 0;
      const ext1 = pz.hasta > pared.largo - 1e-6 ? pared.grosor / 2 : 0;
      return { ...pz, a: enPared(pared, pz.desde - ext0), b: enPared(pared, pz.hasta + ext1) };
    });
    for (const [d, h] of tramosDeColision(pared.largo, pared.huecos)) {
      colision.push({ a: enPared(pared, d), b: enPared(pared, h), medio: pared.grosor / 2 });
    }
  }
  for (const ab of aberturas) {
    if (ab.hoja) colision.push({ a: ab.hoja.a, b: ab.hoja.b, medio: GROSOR_HOJA / 2, hoja: true });
  }

  const limites = caja(ambientes.flatMap((a) => a.poligono));
  const mayor = ambientes.filter((a) => !a.exterior).sort((a, b) => b.area - a.area)[0] ?? ambientes[0];
  let inicio = plano.inicio && Number.isFinite(plano.inicio.x) && Number.isFinite(plano.inicio.y)
    ? { x: plano.inicio.x, y: plano.inicio.y, rumbo: plano.inicio.rumbo ?? 0 }
    : null;
  if (!inicio || !ambientes.some((a) => puntoEnPoligono(inicio, a.poligono))) {
    inicio = { x: mayor.etiqueta.x, y: mayor.etiqueta.y, rumbo: 0 };
  }

  return {
    nombre: plano.nombre ?? 'Plano',
    alto,
    ambientes,
    paredes,
    aberturas,
    colision,
    limites,
    inicio,
    areaTotal: ambientes.reduce((s, a) => s + a.area, 0),
  };
}

/** Ambiente en el que está el punto. Si sigue dentro del anterior, se queda en él (evita parpadeos en el marco de una puerta). */
export function ambienteEn(punto, ambientes, anteriorId = null) {
  const anterior = anteriorId ? ambientes.find((a) => a.id === anteriorId) : null;
  if (anterior && puntoEnPoligono(punto, anterior.poligono)) return anterior;
  return ambientes.find((a) => puntoEnPoligono(punto, a.poligono)) ?? null;
}

/**
 * El ambiente que se quiso tocar en el minimapa: el que contiene el punto o, si el dedo cayó en una pared o entre
 * dos, el más cercano a menos de «maximo» metros. null si no hay ninguno tan cerca.
 */
export function ambienteCercano(punto, ambientes, maximo) {
  const dentro = ambientes.find((a) => puntoEnPoligono(punto, a.poligono));
  if (dentro) return dentro;
  let mejor = null, mejorD = maximo;
  for (const a of ambientes) {
    const d = distanciaAlBorde(punto, a.poligono);
    if (d <= mejorD) { mejor = a; mejorD = d; }
  }
  return mejor;
}

/** Medidas de un ambiente rectangular («3.80 × 3.40»); null si no es rectángulo. */
export function esRectangulo(amb) {
  const p = amb.poligono;
  if (p.length !== 4) return false;
  return Math.abs(amb.area - amb.caja.ancho * amb.caja.largo) < 1e-6;
}
