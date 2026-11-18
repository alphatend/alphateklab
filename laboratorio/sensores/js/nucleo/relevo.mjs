// Avisos entre dispositivos por el relevo público ntfy.sh (y entre pestañas por BroadcastChannel).
// Lo que llega por el relevo es de un servidor público: cualquiera podría publicar en el tema, así que
// se valida la forma, se recorta y se muestra siempre como texto.

export const PREFIJO_TEMA = 'atk-sensores-';
export const CANAL_LOCAL = 'atk-sensores';
export const SERVIDOR = 'https://ntfy.sh';
export const TIPOS = ['aviso', 'resuelto', 'hola', 'prueba'];
export const MAX_TEXTO = 800;
export const MAX_ID = 40;

const ALFABETO = 'abcdefghijkmnpqrstuvwxyz23456789'; // sin l, o, 0 ni 1, que se confunden al dictarlos

export function nuevaSala(aleatorio = Math.random) {
  let s = '';
  for (let i = 0; i < 10; i++) s += ALFABETO[Math.floor(aleatorio() * ALFABETO.length) % ALFABETO.length];
  return s;
}

export function salaValida(s) {
  return typeof s === 'string' && /^[a-z0-9]{10}$/.test(s);
}

export function normalizarSala(s) {
  return String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function tema(sala) {
  if (!salaValida(sala)) throw new Error('Sala no válida');
  return PREFIJO_TEMA + sala;
}

export function urlPublicar(sala) {
  return `${SERVIDOR}/${tema(sala)}`;
}

export function urlEscuchar(sala) {
  return `${SERVIDOR}/${tema(sala)}/sse`;
}

// El id con que viaja un aviso: la partida (cambia al restablecer) y el id del mensaje en el motor. El
// teléfono descarta los ids que ya vio; sin la partida, el aviso «1» de una partida nueva se perdería.
export function idRelevo(partida, idMensaje) {
  const id = `${partida}-${idMensaje}`;
  if (id.length > MAX_ID) throw new Error('Id de aviso demasiado largo');
  return id;
}

export function paquete({ tipo, id, texto, hora }) {
  return JSON.stringify({ v: 1, tipo, id: String(id).slice(0, MAX_ID), texto: String(texto).slice(0, MAX_TEXTO), hora: String(hora ?? '').slice(0, 20) });
}

// El mensaje propio dentro de un paquete (texto JSON). null si no tiene la forma esperada.
export function leerPaquete(texto) {
  if (typeof texto !== 'string' || texto.length > 4000) return null;
  let d;
  try {
    d = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!d || d.v !== 1 || !TIPOS.includes(d.tipo)) return null;
  if (typeof d.id !== 'string' || !d.id || d.id.length > MAX_ID) return null;
  if (typeof d.texto !== 'string' || d.texto.length > MAX_TEXTO) return null;
  return { tipo: d.tipo, id: d.id, texto: d.texto, hora: typeof d.hora === 'string' ? d.hora.slice(0, 20) : '' };
}

// Un evento del SSE de ntfy: su campo data es JSON con event = 'message' y el texto publicado en message.
export function leerEventoNtfy(data) {
  let e;
  try {
    e = JSON.parse(data);
  } catch {
    return null;
  }
  if (!e || e.event !== 'message' || typeof e.message !== 'string') return null;
  return leerPaquete(e.message);
}
