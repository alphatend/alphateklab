// «Recibir los avisos en mi teléfono»: QR con el enlace a telefono.html#<sala> y envío de cada aviso por
// el relevo público ntfy.sh. Entre pestañas del mismo equipo los avisos van por BroadcastChannel siempre
// (no salen del equipo). Si ntfy no responde, la demo sigue igual en esta pantalla.

import { CANAL_LOCAL, leerEventoNtfy, nuevaSala, paquete, salaValida, urlEscuchar, urlPublicar } from './nucleo/relevo.mjs';

const HORA_REAL = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
const QR_URL = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm';
const NS = 'http://www.w3.org/2000/svg';

let generadorQR = null;
async function cargarQR() {
  if (!generadorQR) generadorQR = import(QR_URL).then((m) => m.default);
  return generadorQR;
}

// SVG del QR hecho con nodos (sin innerHTML): un solo path con los módulos oscuros.
function svgQR(qrcode, texto) {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) if (qr.isDark(f, c)) d += `M${c} ${f}h1v1h-1z`;
  }
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `-2 -2 ${n + 4} ${n + 4}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const fondo = document.createElementNS(NS, 'rect');
  fondo.setAttribute('x', '-2');
  fondo.setAttribute('y', '-2');
  fondo.setAttribute('width', String(n + 4));
  fondo.setAttribute('height', String(n + 4));
  fondo.setAttribute('fill', '#fff');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', '#15171b');
  svg.append(fondo, path);
  return svg;
}

export function crearRelevoUI({ panel, boton, qr, enlace, codigo, estado, prueba, apagar, salaInicial, alCambiarSala }) {
  let sala = salaValida(salaInicial) ? salaInicial : null;
  let fuente = null;
  let canal = null;
  try {
    canal = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CANAL_LOCAL) : null;
  } catch {
    canal = null;
  }

  function ponerEstado(texto, tipo = '') {
    estado.textContent = texto;
    if (tipo) estado.dataset.tipo = tipo;
    else delete estado.dataset.tipo;
  }

  const SIN_RELEVO = 'No hay conexión con el relevo público (ntfy.sh). Los avisos siguen apareciendo en esta pantalla.';
  let espera = null;

  function escuchar() {
    if (fuente) fuente.close();
    clearTimeout(espera);
    let abierta = false;
    try {
      fuente = new EventSource(urlEscuchar(sala));
    } catch {
      ponerEstado('Este navegador no puede escuchar el relevo. Los avisos siguen apareciendo aquí.', 'error');
      return;
    }
    // Sin red, EventSource reintenta en silencio (CONNECTING) y nunca llega a CLOSED: a los 6 s sin abrir, se dice.
    espera = setTimeout(() => {
      if (!abierta && fuente) ponerEstado(SIN_RELEVO, 'error');
    }, 6000);
    fuente.onopen = () => {
      abierta = true;
      clearTimeout(espera);
      if (estado.dataset.tipo !== 'ok') ponerEstado('Sala lista. Esperando que abras el enlace en tu teléfono.');
    };
    fuente.onmessage = (e) => {
      const p = leerEventoNtfy(e.data);
      if (p && p.tipo === 'hola') {
        const hora = new Date().toLocaleTimeString('es-PA', HORA_REAL);
        ponerEstado(`Tu teléfono se conectó a las ${hora} (hora real). Los avisos nuevos le llegan también a él.`, 'ok');
      }
    };
    fuente.onerror = () => {
      if (!fuente) return;
      if (fuente.readyState === EventSource.CLOSED || !abierta) ponerEstado(SIN_RELEVO, 'error');
      else ponerEstado('Se perdió la conexión con el relevo; reintentando. Los avisos siguen apareciendo en esta pantalla.', 'error');
    };
  }

  async function mostrarQR() {
    const url = new URL(`telefono.html#${sala}`, location.href).href;
    enlace.href = url;
    enlace.textContent = url;
    codigo.textContent = sala;
    qr.replaceChildren();
    try {
      const qrcode = await cargarQR();
      qr.replaceChildren(svgQR(qrcode, url));
    } catch {
      const p = document.createElement('p');
      p.className = 'nota';
      p.textContent = 'No se pudo cargar el generador del código QR (¿sin internet?). Usa el enlace o el código de la sala.';
      qr.replaceChildren(p);
    }
  }

  async function abrir() {
    if (!sala) {
      sala = nuevaSala(() => {
        const a = new Uint32Array(1);
        crypto.getRandomValues(a);
        return a[0] / 4294967296;
      });
      alCambiarSala(sala);
    }
    panel.hidden = false;
    // Mientras el panel está abierto, el botón lleva al código de la sala (no es un desplegable que se pliega).
    boton.textContent = 'Ver el código de la sala';
    ponerEstado('Preparando la sala…');
    escuchar();
    await mostrarQR();
  }

  function cerrar() {
    if (fuente) fuente.close();
    fuente = null;
    clearTimeout(espera);
    sala = null;
    alCambiarSala(null);
    panel.hidden = true;
    boton.textContent = 'Recibir los avisos en mi teléfono';
    boton.focus();
  }

  async function publicar(msg) {
    const cuerpo = paquete(msg);
    try {
      canal?.postMessage(cuerpo);
    } catch {
      /* otra pestaña cerrada: no importa */
    }
    if (!sala) return;
    try {
      const r = await fetch(urlPublicar(sala), { method: 'POST', body: cuerpo });
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      ponerEstado('No se pudo enviar por el relevo (ntfy.sh no respondió). El aviso está aquí en la pantalla; el próximo se vuelve a intentar.', 'error');
    }
  }

  boton.addEventListener('click', () => {
    if (panel.hidden) abrir();
    else {
      panel.querySelector('.relevo__aviso')?.scrollIntoView({ block: 'nearest' });
      codigo.focus?.();
    }
  });
  apagar.addEventListener('click', cerrar);
  prueba.addEventListener('click', () => {
    const hora = new Date().toLocaleTimeString('es-PA', HORA_REAL);
    publicar({ tipo: 'prueba', id: `prueba-${Date.now()}`, texto: '*Prueba*\nSi ves esto en tu teléfono, los avisos de la demo te van a llegar aquí.', hora });
    ponerEstado(`Aviso de prueba enviado a las ${hora} (hora real).`, estado.dataset.tipo === 'ok' ? 'ok' : '');
  });

  if (sala) abrir();

  return { publicar, get activa() { return !!sala; } };
}
