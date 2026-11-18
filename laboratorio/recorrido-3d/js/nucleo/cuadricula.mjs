// «Dibuja tu plano»: el modelo del editor (rectángulos sobre una cuadrícula de 0.5 m, puertas y ventanas sobre
// sus bordes) y su conversión al formato de plano que recorre el 3D. Sin DOM.

import { FORMATO, VERSION_PLANO, TIPOS_AMBIENTE, paredesDesdeAmbientes, validarPlano } from './plano.mjs';
import { puntoEtiqueta } from './geometria.mjs';
import { listaNombres } from './formato.mjs';

export const VERSION_CUADRICULA = 1;
export const PASO = 0.5;
export const MINIMO = 1; // lado mínimo de un ambiente, en metros
export const ANCHO_PUERTA = 0.8;
export const ANCHO_VENTANA = 1.0;
const E = 1e-6;

export const ajustar = (v, paso = PASO) => Math.round(v / paso) * paso;
const r3 = (v) => Math.round(v * 1000) / 1000;

export function cuadriculaVacia(ancho = 12, largo = 10) {
  return { version: VERSION_CUADRICULA, nombre: 'Tu plano', ancho, largo, ambientes: [], aberturas: [] };
}

/**
 * El plano con el que arranca el editor (y el que vuelve con «Restablecer datos de ejemplo»). Se llama «plano de
 * muestra» para no confundirlo con el apartamento de ejemplo de 95 m² que se recorre en la otra pestaña.
 */
export function cuadriculaEjemplo() {
  return {
    version: VERSION_CUADRICULA,
    nombre: 'Plano de muestra de una recámara',
    ancho: 12,
    largo: 10,
    ambientes: [
      { id: 'a1', nombre: 'Sala y cocina', tipo: 'sala', x: 1, y: 1, ancho: 6, largo: 4.5 },
      { id: 'a2', nombre: 'Recámara', tipo: 'recamara', x: 7, y: 1, ancho: 3.5, largo: 4.5 },
      { id: 'a3', nombre: 'Baño', tipo: 'bano', x: 7, y: 5.5, ancho: 3.5, largo: 2 },
      { id: 'a4', nombre: 'Balcón', tipo: 'balcon', x: 1, y: 5.5, ancho: 3, largo: 1.5 },
    ],
    aberturas: [
      { id: 'p1', tipo: 'puerta', orientacion: 'v', x: 7, y: 3.5 },
      { id: 'p2', tipo: 'puerta', orientacion: 'h', x: 8, y: 5.5 },
      { id: 'p3', tipo: 'puerta', orientacion: 'h', x: 2.5, y: 5.5 },
      { id: 'p4', tipo: 'puerta', orientacion: 'v', x: 1, y: 2 },
      { id: 'v1', tipo: 'ventana', orientacion: 'h', x: 4, y: 1 },
      { id: 'v2', tipo: 'ventana', orientacion: 'h', x: 9, y: 1 },
      { id: 'v3', tipo: 'ventana', orientacion: 'v', x: 10.5, y: 6.5 },
    ],
  };
}

export const rectDe = (a) => ({ x0: a.x, y0: a.y, x1: a.x + a.ancho, y1: a.y + a.largo });

/** Rectángulo ajustado a la cuadrícula entre dos esquinas arrastradas, dentro de los límites. */
export function rectDesdeArrastre(p0, p1, limites, paso = PASO) {
  const lim = (v, max) => Math.max(0, Math.min(max, v));
  const xa = lim(ajustar(p0.x, paso), limites.ancho), xb = lim(ajustar(p1.x, paso), limites.ancho);
  const ya = lim(ajustar(p0.y, paso), limites.largo), yb = lim(ajustar(p1.y, paso), limites.largo);
  const x = Math.min(xa, xb), y = Math.min(ya, yb);
  return { x: r3(x), y: r3(y), ancho: r3(Math.abs(xb - xa)), largo: r3(Math.abs(yb - ya)) };
}

/** ¿Se enciman con área? (tocarse por un borde no cuenta). */
export function seEncima(a, b) {
  const p = rectDe(a), q = rectDe(b);
  return p.x0 < q.x1 - E && q.x0 < p.x1 - E && p.y0 < q.y1 - E && q.y0 < p.y1 - E;
}

const enCuadricula = (v, paso = PASO) => Math.abs(v / paso - Math.round(v / paso)) < 1e-6;

/** Error en palabras si el rectángulo no se puede agregar (o cambiar, con ignorarId); null si está bien. */
export function validarAmbiente(r, c, ignorarId = null) {
  if (![r.x, r.y, r.ancho, r.largo].every(Number.isFinite)) return 'Escribe las cuatro medidas con números.';
  if (![r.x, r.y, r.ancho, r.largo].every((v) => enCuadricula(v))) return 'Las medidas van de 0.5 en 0.5 m.';
  if (r.ancho < MINIMO - E || r.largo < MINIMO - E) return `Cada lado tiene que medir al menos ${MINIMO} m.`;
  if (r.x < -E || r.y < -E || r.x + r.ancho > c.ancho + E || r.y + r.largo > c.largo + E) {
    return `El ambiente se sale de la cuadrícula de ${c.ancho} × ${c.largo} m.`;
  }
  const otro = c.ambientes.find((a) => a.id !== ignorarId && seEncima(r, a));
  if (otro) return `Se encima con «${otro.nombre}». Dibújalo en un espacio libre o achica uno de los dos.`;
  return null;
}

/** Bordes de un ambiente: horizontales (h, en y fija) y verticales (v, en x fija). */
export function bordesDe(a) {
  const k = rectDe(a);
  return [
    { orientacion: 'h', fijo: k.y0, desde: k.x0, hasta: k.x1, ambiente: a.id },
    { orientacion: 'h', fijo: k.y1, desde: k.x0, hasta: k.x1, ambiente: a.id },
    { orientacion: 'v', fijo: k.x0, desde: k.y0, hasta: k.y1, ambiente: a.id },
    { orientacion: 'v', fijo: k.x1, desde: k.y0, hasta: k.y1, ambiente: a.id },
  ];
}

/** Ambientes cuyo borde cubre entero el tramo [desde, hasta] de la línea, y si algún otro lo cubre a medias. */
export function cobertura(c, orientacion, fijo, desde, hasta) {
  const enteros = [];
  let parcial = false;
  for (const a of c.ambientes) {
    for (const b of bordesDe(a)) {
      if (b.orientacion !== orientacion || Math.abs(b.fijo - fijo) > E) continue;
      const cubre = b.desde <= desde + E && b.hasta >= hasta - E;
      const toca = b.desde < hasta - E && b.hasta > desde + E;
      if (cubre) enteros.push(a);
      else if (toca) parcial = true;
    }
  }
  return { ambientes: enteros, parcial };
}

/** Borde más cercano a un punto (para poner una puerta o ventana tocando el dibujo). */
export function bordeMasCercano(p, c, tolerancia = 0.35) {
  let mejor = null;
  for (const a of c.ambientes) {
    for (const b of bordesDe(a)) {
      const along = b.orientacion === 'h' ? p.x : p.y;
      const perp = b.orientacion === 'h' ? p.y : p.x;
      const t = Math.max(b.desde, Math.min(b.hasta, along));
      const d = Math.hypot(along - t, perp - b.fijo);
      if (d <= tolerancia && (!mejor || d < mejor.d - E)) mejor = { ...b, d, posicion: t };
    }
  }
  return mejor;
}

const anchoDe = (tipo) => (tipo === 'ventana' ? ANCHO_VENTANA : ANCHO_PUERTA);

/** Abertura propuesta al tocar cerca de un borde: el centro se ajusta a la cuadrícula y se mete dentro del borde. */
export function aberturaDesdeToque(p, c, tipo) {
  const b = bordeMasCercano(p, c);
  if (!b) return null;
  const ancho = anchoDe(tipo);
  let centro = ajustar(b.posicion, PASO);
  const min = b.desde + ancho / 2, max = b.hasta - ancho / 2;
  if (min > max + E) return { error: `Ese borde mide ${r3(b.hasta - b.desde)} m: no cabe una ${tipo} de ${ancho} m.` };
  centro = Math.max(min, Math.min(max, centro));
  if (centro - min > E && max - centro > E && !enCuadricula(centro, 0.25)) centro = ajustar(centro, 0.25);
  const ab = b.orientacion === 'h'
    ? { tipo, orientacion: 'h', x: r3(centro), y: b.fijo }
    : { tipo, orientacion: 'v', x: b.fijo, y: r3(centro) };
  return ab;
}

/**
 * Abertura en una pared de un ambiente, dicha con palabras (para el formulario, sin mouse):
 * lado 'arriba' | 'abajo' | 'izquierda' | 'derecha'; pos = metros del centro desde la esquina de arriba o de la izquierda.
 */
export function aberturaEnLado(amb, lado, pos, tipo) {
  if (!amb) return { error: 'Elige un ambiente.' };
  if (!Number.isFinite(pos)) return { error: 'Escribe a cuántos metros de la esquina va el centro.' };
  const horizontal = lado === 'arriba' || lado === 'abajo';
  const largo = horizontal ? amb.ancho : amb.largo;
  const ancho = anchoDe(tipo);
  if (pos - ancho / 2 < -E || pos + ancho / 2 > largo + E) {
    return { error: `Esa pared mide ${r3(largo)} m: el centro de una ${tipo} de ${ancho} m tiene que ir entre ${r3(ancho / 2)} y ${r3(largo - ancho / 2)} m.` };
  }
  if (horizontal) return { tipo, orientacion: 'h', x: r3(amb.x + pos), y: r3(lado === 'arriba' ? amb.y : amb.y + amb.largo) };
  if (lado === 'izquierda' || lado === 'derecha') return { tipo, orientacion: 'v', x: r3(lado === 'izquierda' ? amb.x : amb.x + amb.ancho), y: r3(amb.y + pos) };
  return { error: 'Elige la pared: de arriba, de abajo, de la izquierda o de la derecha.' };
}

/** Tramo que ocupa una abertura sobre su línea. */
export function tramoDe(ab) {
  const ancho = anchoDe(ab.tipo);
  const c = ab.orientacion === 'h' ? ab.x : ab.y;
  return { fijo: ab.orientacion === 'h' ? ab.y : ab.x, desde: c - ancho / 2, hasta: c + ancho / 2 };
}

/** Error en palabras si la abertura no se puede poner; null si está bien. */
export function validarAbertura(ab, c, ignorarId = null) {
  if (ab.tipo !== 'puerta' && ab.tipo !== 'ventana') return 'Solo se pueden poner puertas o ventanas.';
  const t = tramoDe(ab);
  const { ambientes, parcial } = cobertura(c, ab.orientacion, t.fijo, t.desde, t.hasta);
  if (!ambientes.length) return `La ${ab.tipo} tiene que ir sobre el borde de un ambiente.`;
  if (parcial) return `La ${ab.tipo} queda a caballo entre dos paredes distintas. Muévela para que quede entera en una.`;
  if (ab.tipo === 'ventana') {
    // Una ventana da afuera: a la calle (un solo ambiente detrás) o a un balcón (un interior y un exterior).
    const interiores = ambientes.filter((a) => !TIPOS_AMBIENTE[a.tipo]?.exterior);
    if (!interiores.length) return 'Ese borde es la baranda del balcón: las ventanas van en la pared de un ambiente interior.';
    if (interiores.length > 1) return 'Entre dos ambientes interiores va una puerta, no una ventana. Las ventanas van en paredes que dan afuera o a un balcón.';
  }
  const choca = c.aberturas.find((o) => {
    if (o.id === ignorarId || o.orientacion !== ab.orientacion) return false;
    const u = tramoDe(o);
    return Math.abs(u.fijo - t.fijo) < E && t.desde < u.hasta - E && u.desde < t.hasta - E;
  });
  if (choca) return `Se encima con otra ${choca.tipo} de la misma pared.`;
  return null;
}

let contador = 0;
export const nuevoId = (prefijo) => `${prefijo}${Date.now().toString(36)}${(contador++).toString(36)}`;

/** Agrega un ambiente y devuelve { cuadricula, error }. No modifica la original. */
export function agregarAmbiente(c, datos) {
  const r = { x: r3(datos.x), y: r3(datos.y), ancho: r3(datos.ancho), largo: r3(datos.largo) };
  const error = validarAmbiente(r, c);
  if (error) return { cuadricula: c, error };
  const tipo = TIPOS_AMBIENTE[datos.tipo] ? datos.tipo : 'otro';
  const nombre = (datos.nombre ?? '').trim() || sugerirNombre(c, tipo);
  const amb = { id: datos.id ?? nuevoId('a'), nombre, tipo, ...r };
  return { cuadricula: { ...c, ambientes: [...c.ambientes, amb] }, error: null, ambiente: amb };
}

/** Nombre por defecto: «Recámara 2» si ya hay una recámara, etc. */
export function sugerirNombre(c, tipo) {
  const base = { sala: 'Sala', recamara: 'Recámara', bano: 'Baño', cocina: 'Cocina', lavanderia: 'Lavandería', pasillo: 'Pasillo', balcon: 'Balcón', otro: 'Ambiente' }[tipo] ?? 'Ambiente';
  const usados = new Set(c.ambientes.map((a) => a.nombre));
  if (!usados.has(base)) return base;
  for (let i = 2; ; i++) if (!usados.has(`${base} ${i}`)) return `${base} ${i}`;
}

/** Quita aberturas que ya no caen entera sobre un borde válido (tras borrar o cambiar un ambiente). */
export function depurarAberturas(c) {
  const quedan = [];
  for (const ab of c.aberturas) {
    const prueba = { ...c, aberturas: quedan };
    if (!validarAbertura(ab, prueba)) quedan.push(ab);
  }
  return { ...c, aberturas: quedan };
}

export function quitarAmbiente(c, id) {
  return depurarAberturas({ ...c, ambientes: c.ambientes.filter((a) => a.id !== id) });
}

export function cambiarAmbiente(c, id, cambios) {
  const actual = c.ambientes.find((a) => a.id === id);
  if (!actual) return { cuadricula: c, error: 'Ese ambiente ya no existe.' };
  const nuevo = { ...actual, ...cambios };
  if ('nombre' in cambios) nuevo.nombre = String(cambios.nombre).slice(0, 40);
  if (['x', 'y', 'ancho', 'largo'].some((k) => k in cambios)) {
    const error = validarAmbiente(nuevo, c, id);
    if (error) return { cuadricula: c, error };
  }
  const siguiente = { ...c, ambientes: c.ambientes.map((a) => (a.id === id ? nuevo : a)) };
  return { cuadricula: depurarAberturas(siguiente), error: null };
}

export function agregarAbertura(c, ab) {
  const nueva = { id: ab.id ?? nuevoId(ab.tipo === 'ventana' ? 'v' : 'p'), tipo: ab.tipo, orientacion: ab.orientacion, x: r3(ab.x), y: r3(ab.y) };
  const error = validarAbertura(nueva, c);
  if (error) return { cuadricula: c, error };
  return { cuadricula: { ...c, aberturas: [...c.aberturas, nueva] }, error: null, abertura: nueva };
}

export const quitarAbertura = (c, id) => ({ ...c, aberturas: c.aberturas.filter((a) => a.id !== id) });

/** Abertura más cercana a un punto (para borrarla tocándola). */
export function aberturaCercana(p, c, tolerancia = 0.4) {
  let mejor = null;
  for (const ab of c.aberturas) {
    const t = tramoDe(ab);
    const along = ab.orientacion === 'h' ? p.x : p.y;
    const perp = ab.orientacion === 'h' ? p.y : p.x;
    const q = Math.max(t.desde, Math.min(t.hasta, along));
    const d = Math.hypot(along - q, perp - t.fijo);
    if (d <= tolerancia && (!mejor || d < mejor.d)) mejor = { ab, d };
  }
  return mejor?.ab ?? null;
}

/** Ambiente bajo un punto. */
export const ambienteEnPunto = (p, c) =>
  c.ambientes.find((a) => p.x >= a.x - E && p.x <= a.x + a.ancho + E && p.y >= a.y - E && p.y <= a.y + a.largo + E) ?? null;

/** Ambientes a los que no se puede entrar: sin ninguna puerta que los conecte con otro. */
export function ambientesSinPuerta(c) {
  const conPuerta = new Set();
  for (const ab of c.aberturas) {
    if (ab.tipo !== 'puerta') continue;
    const t = tramoDe(ab);
    const { ambientes } = cobertura(c, ab.orientacion, t.fijo, t.desde, t.hasta);
    if (ambientes.length >= 2) ambientes.forEach((a) => conPuerta.add(a.id));
  }
  if (c.ambientes.length < 2) return [];
  return c.ambientes.filter((a) => !conPuerta.has(a.id));
}

/**
 * Dónde aparece quien entra al plano en 3D: en el ambiente interior más grande que tenga puerta hacia otro, para que
 * pueda recorrer el resto; si ninguno tiene, en el más grande.
 */
export function ambienteDeInicio(c) {
  const sin = new Set(ambientesSinPuerta(c).map((a) => a.id));
  const interiores = c.ambientes.filter((a) => !TIPOS_AMBIENTE[a.tipo]?.exterior);
  const orden = [...(interiores.length ? interiores : c.ambientes)].sort((a, b) => b.ancho * b.largo - a.ancho * a.largo);
  return orden.find((a) => !sin.has(a.id)) ?? orden[0] ?? null;
}

/** Lo que conviene saber antes de recorrer el plano en 3D: dónde no se va a poder entrar. Vacío si nada. */
export function avisoAlVerEn3D(c) {
  const sin = ambientesSinPuerta(c);
  if (!sin.length) return '';
  const inicio = ambienteDeInicio(c);
  const encerrado = sin.some((a) => a.id === inicio?.id);
  const otros = sin.filter((a) => a.id !== inicio?.id);
  const nombres = listaNombres(otros.map((a) => a.nombre));
  if (encerrado) {
    const tampoco = otros.length ? ` Tampoco se puede entrar a ${nombres}.` : '';
    return `Vas a empezar en «${inicio.nombre}», que no tiene puerta hacia otro ambiente: no vas a poder salir de ahí.${tampoco} Ponles puertas para recorrerlos.`;
  }
  return `No se puede entrar a ${nombres}: ${otros.length === 1 ? 'no tiene' : 'no tienen'} puerta hacia otro ambiente.`;
}

/**
 * Hacia dónde mira quien entra a un plano dibujado: a la puerta más cercana del ambiente donde aparece (para ver
 * por dónde seguir); sin puertas, a lo largo del lado más largo. Rumbo en grados: 0 = arriba, 90 = derecha.
 */
export function rumboInicial(c, amb) {
  const cx = amb.x + amb.ancho / 2, cy = amb.y + amb.largo / 2;
  let mejor = null;
  for (const ab of c.aberturas) {
    if (ab.tipo !== 'puerta') continue;
    const t = tramoDe(ab);
    const { ambientes } = cobertura(c, ab.orientacion, t.fijo, t.desde, t.hasta);
    if (ambientes.length < 2 || !ambientes.some((a) => a.id === amb.id)) continue;
    const d = Math.hypot(ab.x - cx, ab.y - cy);
    if (!mejor || d < mejor.d) mejor = { d, dx: ab.x - cx, dy: ab.y - cy };
  }
  if (!mejor) return amb.ancho >= amb.largo ? 90 : 0;
  const g = (Math.atan2(mejor.dx, -mejor.dy) * 180) / Math.PI;
  return Math.round(((g % 360) + 360) % 360);
}

/** La cuadrícula convertida en un plano que el 3D puede recorrer. */
export function planoDesdeCuadricula(c) {
  const ambientes = c.ambientes.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    tipo: a.tipo,
    poligono: [[a.x, a.y], [a.x + a.ancho, a.y], [a.x + a.ancho, a.y + a.largo], [a.x, a.y + a.largo]].map((p) => p.map(r3)),
  }));
  const aberturas = c.aberturas.map((ab) => {
    const t = tramoDe(ab);
    const { ambientes: cubren } = cobertura(c, ab.orientacion, t.fijo, t.desde, t.hasta);
    let tipo = ab.tipo;
    // Una puerta con un solo ambiente detrás da al pasillo del edificio: se dibuja cerrada.
    if (ab.tipo === 'puerta' && cubren.length < 2) tipo = 'puerta-cerrada';
    const out = { tipo, x: ab.x, y: ab.y, ancho: anchoDe(ab.tipo) };
    if (ab.tipo === 'ventana') {
      // El antepecho depende del ambiente de adentro (en una ventana hacia el balcón, no del balcón).
      const amb = cubren.find((a) => !TIPOS_AMBIENTE[a.tipo]?.exterior) ?? cubren[0];
      out.antepecho = amb?.tipo === 'bano' ? 1.6 : amb?.tipo === 'cocina' || amb?.tipo === 'lavanderia' ? 1.1 : 0.9;
      out.dintel = 2.2;
    }
    return out;
  });
  const mayor = ambienteDeInicio(c);
  const rumbo = mayor ? rumboInicial(c, mayor) : 0;
  const plano = {
    formato: FORMATO,
    version: VERSION_PLANO,
    nombre: c.nombre || 'Tu plano',
    alto: 2.6,
    inicio: mayor ? { ...puntoEtiqueta([[mayor.x, mayor.y], [mayor.x + mayor.ancho, mayor.y], [mayor.x + mayor.ancho, mayor.y + mayor.largo], [mayor.x, mayor.y + mayor.largo]]), rumbo } : undefined,
    ambientes,
    paredes: ambientes.length ? paredesDesdeAmbientes(ambientes) : [],
    aberturas,
  };
  return plano;
}

/** Texto JSON para descargar: el plano completo más la cuadrícula para volver a editarlo. */
export function exportarJSON(c) {
  const plano = planoDesdeCuadricula(c);
  return JSON.stringify({ ...plano, cuadricula: { ...c, version: VERSION_CUADRICULA } }, null, 2);
}

/**
 * Valida una cuadrícula leída de un archivo o de localStorage. Devuelve { cuadricula } o { error }.
 * Los id que faltan o se repiten se cambian por uno nuevo: con dos ambientes del mismo id, «Quitar» uno borraba los dos.
 */
export function revisarCuadricula(c) {
  if (!c || typeof c !== 'object') return { error: 'No hay datos de plano.' };
  if (c.version !== VERSION_CUADRICULA) return { error: `El dibujo es de la versión ${c.version ?? 'desconocida'}; este editor lee la versión ${VERSION_CUADRICULA}.` };
  const ancho = Number(c.ancho), largo = Number(c.largo);
  if (!(ancho >= 2 && ancho <= 40 && largo >= 2 && largo <= 40)) return { error: 'La cuadrícula tiene que medir entre 2 y 40 m por lado.' };
  let limpia = { version: VERSION_CUADRICULA, nombre: String(c.nombre ?? 'Tu plano').slice(0, 60), ancho, largo, ambientes: [], aberturas: [] };
  const unico = (usados, id, prefijo) => {
    let s = id == null ? '' : String(id).trim();
    while (!s || usados.has(s)) s = nuevoId(prefijo);
    usados.add(s);
    return s;
  };
  const idsAmbientes = new Set(), idsAberturas = new Set();
  for (const a of Array.isArray(c.ambientes) ? c.ambientes : []) {
    const r = agregarAmbiente(limpia, { id: unico(idsAmbientes, a?.id, 'a'), nombre: String(a?.nombre ?? '').slice(0, 40), tipo: a?.tipo, x: Number(a?.x), y: Number(a?.y), ancho: Number(a?.ancho), largo: Number(a?.largo) });
    if (r.error) return { error: `«${a?.nombre ?? 'Ambiente'}»: ${r.error}` };
    limpia = r.cuadricula;
  }
  for (const ab of Array.isArray(c.aberturas) ? c.aberturas : []) {
    const r = agregarAbertura(limpia, { id: unico(idsAberturas, ab?.id, ab?.tipo === 'ventana' ? 'v' : 'p'), tipo: ab?.tipo, orientacion: ab?.orientacion, x: Number(ab?.x), y: Number(ab?.y) });
    if (r.error) return { error: `Una ${ab?.tipo ?? 'abertura'}: ${r.error}` };
    limpia = r.cuadricula;
  }
  return { cuadricula: limpia };
}

/** Lee un archivo exportado. Acepta el JSON con «cuadricula», o un plano de solo rectángulos alineados a 0.5 m. */
export function importarJSON(texto) {
  let datos;
  try { datos = JSON.parse(texto); }
  catch { return { error: 'Ese archivo no es una copia de un plano: no se pudo leer. Descarga la copia desde este editor y vuelve a intentarlo.' }; }
  if (datos && datos.cuadricula) return revisarCuadricula(datos.cuadricula);
  if (datos?.formato === FORMATO) {
    const { errores } = validarPlano(datos);
    if (errores.length) return { error: errores[0] };
    return cuadriculaDesdePlano(datos);
  }
  return { error: 'Ese archivo no es una copia de un plano de este editor.' };
}

/** Pasa un plano a la cuadrícula si todos sus ambientes son rectángulos alineados a 0.5 m. */
export function cuadriculaDesdePlano(plano) {
  const ambientes = [];
  for (const amb of plano.ambientes) {
    const xs = amb.poligono.map((p) => p[0]), ys = amb.poligono.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const esRect = amb.poligono.length === 4 && amb.poligono.every(([x, y]) => (Math.abs(x - x0) < E || Math.abs(x - x1) < E) && (Math.abs(y - y0) < E || Math.abs(y - y1) < E));
    if (!esRect || ![x0, x1, y0, y1].every((v) => enCuadricula(v))) {
      return { error: `«${amb.nombre}» no es un rectángulo sobre la cuadrícula de 0.5 m, así que este editor no lo puede abrir.` };
    }
    ambientes.push({ id: amb.id, nombre: amb.nombre, tipo: amb.tipo, x: x0, y: y0, ancho: x1 - x0, largo: y1 - y0 });
  }
  const ancho = Math.max(12, Math.ceil(Math.max(...ambientes.map((a) => a.x + a.ancho)) + 1));
  const largo = Math.max(10, Math.ceil(Math.max(...ambientes.map((a) => a.y + a.largo)) + 1));
  const aberturas = (plano.aberturas ?? [])
    .filter((ab) => ab.tipo === 'puerta' || ab.tipo === 'ventana' || ab.tipo === 'puerta-cerrada')
    .map((ab) => {
      const horizontal = ambientes.some(
        (a) => (Math.abs(a.y - ab.y) < E || Math.abs(a.y + a.largo - ab.y) < E) && ab.x > a.x + E && ab.x < a.x + a.ancho - E,
      );
      return { tipo: ab.tipo === 'ventana' ? 'ventana' : 'puerta', orientacion: horizontal ? 'h' : 'v', x: ab.x, y: ab.y };
    });
  return revisarCuadricula({ version: VERSION_CUADRICULA, nombre: plano.nombre, ancho, largo, ambientes, aberturas });
}

/** Totales para mostrar: ambientes, área interior y área exterior (balcones). */
export function totales(c) {
  let interior = 0, exterior = 0;
  for (const a of c.ambientes) {
    const area = a.ancho * a.largo;
    if (TIPOS_AMBIENTE[a.tipo]?.exterior) exterior += area; else interior += area;
  }
  return { ambientes: c.ambientes.length, interior: r3(interior), exterior: r3(exterior), total: r3(interior + exterior) };
}
