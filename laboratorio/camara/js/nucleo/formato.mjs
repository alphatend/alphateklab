// Textos y números que muestra la demo. Puros, para poder probarlos.
// Números con el formato de Panamá (es-PA): punto decimal y coma de miles.

import { normalDerecha } from './geometria.mjs';

export function numero(v, decimales = 0) {
  return new Intl.NumberFormat('es-PA', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
}

/** «3.1 MB» */
export function megas(bytes) {
  return `${numero(bytes / 1e6, 1)} MB`;
}

/** «14:05» en la hora local. */
export function horaCorta(t) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** «45 s», «2 min 5 s», «1 h 3 min». */
export function duracion(segundos) {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return s % 60 ? `${min} min ${s % 60} s` : `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/** Máximo redondo para el eje de un gráfico: 4, 5, 10, 15, 20, 25, 30, 40, 50… nunca menos de 4. */
export function maximoRedondo(v) {
  const candidatos = [4, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 500, 1000];
  for (const c of candidatos) if (v <= c) return c;
  return Math.ceil(v / 500) * 500;
}

/**
 * Hacia dónde hay que cruzar la línea para que cuente como entrada, dicho con palabras de pantalla.
 * `linea` en coordenadas normalizadas; `proporcion` = ancho / alto del video (para que «derecha» sea la de verdad).
 */
export function textoSentido(linea, sentido, proporcion = 16 / 9) {
  const a = { x: linea.a.x * proporcion, y: linea.a.y };
  const b = { x: linea.b.x * proporcion, y: linea.b.y };
  const n = normalDerecha(a, b);
  const x = n.x * (sentido >= 0 ? 1 : -1);
  const y = n.y * (sentido >= 0 ? 1 : -1);
  if (Math.abs(x) >= Math.abs(y)) return x > 0 ? 'hacia la derecha' : 'hacia la izquierda';
  return y > 0 ? 'hacia abajo' : 'hacia arriba';
}

/** La regla de la fila en una frase: «más de 2» se dice «3 o más», que es como lo piensa un encargado. */
export function textoReglaFila(maxPersonas, segundos) {
  const desde = maxPersonas + 1;
  const quien = desde === 1 ? 'al menos 1 persona' : `${desde} o más personas`;
  return `Avisa cuando hay ${quien} en la zona durante ${segundos} ${segundos === 1 ? 'segundo seguido' : 'segundos seguidos'}.`;
}

export function personas(n) {
  return `${n} ${n === 1 ? 'persona' : 'personas'}`;
}

/**
 * Una línea de la bitácora de avisos: «Abrir otra caja: 3 personas en la fila; llegó a 5».
 * «llegó a» solo si la cuenta subió después de abrirse el aviso; «(sigue)» mientras no se cierra.
 */
export function textoDeAviso(a) {
  let texto = a.detalle;
  if (a.tipo === 'fila' && a.fin !== null && a.maximo > (a.inicial || 0)) texto += `; llegó a ${a.maximo}`;
  if (a.fin === null) texto += ' (sigue)';
  return texto;
}

/** Hora o rango de un aviso de la bitácora: «14:05–14:09»; una sola hora si sigue abierto o si empezó y terminó en el mismo minuto. */
export function horasDeAviso(inicio, fin) {
  if (fin === null || fin === undefined || horaCorta(inicio) === horaCorta(fin)) return horaCorta(inicio);
  return `${horaCorta(inicio)}–${horaCorta(fin)}`;
}

/** «5 dentro; el máximo es 4»: sin plural forzado («5 de 1 personas»). */
export function textoAforo(dentro, maximo) {
  return `${dentro} dentro; el máximo es ${maximo}`;
}

/**
 * Lo que lleva el día, en una línea, para la demo apagada: «Hoy con el video de muestra van 3 entradas, 2 salidas
 * y 1 aviso; 1 persona dentro.» Vacío si todavía no pasó nada.
 */
export function textoResumen({ entradas, salidas, dentro }, avisos, con) {
  if (!entradas && !salidas && !dentro && !avisos) return '';
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const partes = [plural(entradas, 'entrada', 'entradas'), plural(salidas, 'salida', 'salidas')];
  if (avisos) partes.push(plural(avisos, 'aviso', 'avisos'));
  const lista = partes.length === 2 ? partes.join(' y ') : `${partes[0]}, ${partes[1]} y ${partes[2]}`;
  const adentro = dentro ? `; ${personas(dentro)} dentro` : '';
  return `Hoy ${con} van ${lista}${adentro}. Al encender la demo, el conteo sigue desde ahí.`;
}
