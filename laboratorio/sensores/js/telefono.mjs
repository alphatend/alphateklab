// El teléfono del dueño: escucha los avisos de la demo por el relevo público ntfy.sh (otro dispositivo)
// y por BroadcastChannel (otra pestaña del mismo equipo). Todo lo que llega se valida y se pinta como texto.

import { CANAL_LOCAL, leerEventoNtfy, leerPaquete, normalizarSala, paquete, salaValida, urlEscuchar, urlPublicar } from './nucleo/relevo.mjs';
import { trozosWhatsApp } from './nucleo/mensajes.mjs';

const $ = (id) => document.getElementById(id);
const vistos = new Set();
let fuente = null;
let saludado = false;

function ponerEstado(texto, tipo = '') {
  const e = $('estado');
  e.textContent = texto;
  if (tipo) e.dataset.tipo = tipo;
  else delete e.dataset.tipo;
}

function mostrar(p) {
  if (!p || p.tipo === 'hola' || vistos.has(p.id)) return;
  vistos.add(p.id);
  const chat = $('chat');
  $('chat-vacio').hidden = true;
  const b = document.createElement('div');
  b.className = 'burbuja burbuja--nueva';
  for (const linea of p.texto.split('\n')) {
    const par = document.createElement('p');
    par.className = 'burbuja__linea';
    for (const t of trozosWhatsApp(linea)) {
      if (t.negrita) {
        const s = document.createElement('strong');
        s.textContent = t.texto;
        par.append(s);
      } else par.append(document.createTextNode(t.texto));
    }
    b.append(par);
  }
  const hora = document.createElement('span');
  hora.className = 'burbuja__hora';
  hora.textContent = p.hora ? `${p.hora} (${p.tipo === 'prueba' ? 'hora real' : 'hora de la simulación'})` : '';
  b.append(hora);
  chat.append(b);
  chat.scrollTop = chat.scrollHeight;
  if (p.tipo === 'aviso') vibrar();
}

// El navegador solo deja vibrar después de que la persona tocó la página; antes, se lo pedimos.
function vibrar() {
  if (typeof navigator.vibrate !== 'function') return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    $('vibrar').hidden = false;
    return;
  }
  navigator.vibrate(200);
}
document.addEventListener('pointerdown', () => {
  $('vibrar').hidden = true;
}, { once: true });

function conectar(sala) {
  $('sala-texto').textContent = `sala ${sala}`;
  $('sala-form').hidden = true;
  ponerEstado('Conectando con el relevo…');
  if (fuente) fuente.close();
  try {
    fuente = new EventSource(urlEscuchar(sala));
  } catch {
    ponerEstado('Este navegador no puede escuchar el relevo. Abre el tablero en este mismo equipo para ver los avisos.', 'error');
    return;
  }
  fuente.onopen = async () => {
    ponerEstado(`Conectado a la sala ${sala}. Los avisos del tablero llegan aquí.`, 'ok');
    if (saludado) return;
    saludado = true;
    try {
      await fetch(urlPublicar(sala), { method: 'POST', body: paquete({ tipo: 'hola', id: `hola-${Date.now()}`, texto: 'Teléfono conectado', hora: '' }) });
    } catch {
      /* el saludo es solo informativo para el tablero */
    }
  };
  fuente.onmessage = (e) => mostrar(leerEventoNtfy(e.data));
  fuente.onerror = () => {
    if (fuente.readyState === EventSource.CLOSED) {
      ponerEstado('Se cortó la conexión con el relevo (ntfy.sh). Recarga la página para volver a intentar.', 'error');
    } else {
      ponerEstado('Se perdió la conexión con el relevo; reintentando…', 'error');
    }
  };
}

function pedirSala(mensaje) {
  $('sala-form').hidden = false;
  ponerEstado(mensaje);
}

try {
  const canal = new BroadcastChannel(CANAL_LOCAL);
  canal.onmessage = (e) => mostrar(leerPaquete(e.data));
} catch {
  /* sin BroadcastChannel: solo el relevo */
}

$('sala-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const sala = normalizarSala($('sala-codigo').value);
  if (!salaValida(sala)) {
    $('sala-error').textContent = 'El código tiene 10 letras y números. Cópialo tal como aparece debajo del QR en el tablero.';
    $('sala-codigo').setAttribute('aria-invalid', 'true');
    return;
  }
  $('sala-error').textContent = '';
  $('sala-codigo').setAttribute('aria-invalid', 'false');
  history.replaceState(null, '', `#${sala}`);
  conectar(sala);
});

const desdeEnlace = normalizarSala(location.hash.slice(1));
if (salaValida(desdeEnlace)) conectar(desdeEnlace);
else pedirSala('Escribe el código de la sala que aparece en el tablero. Si abres el tablero en otra ventana de este mismo equipo, al lado de esta, los avisos llegan aquí sin código (en una pestaña de atrás el tablero se pausa).');
