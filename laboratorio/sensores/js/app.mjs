// Tablero de sensores: une el motor (nucleo/) con la página. Todo corre en el navegador.

import { crearMotor, periodosDeFallas } from './nucleo/motor.mjs';
import { PASO } from './nucleo/simulador.mjs';
import { CLAVE, debeAdoptar, esPartida, estadoInicial, hoyISO, leer, MAX_ACCIONES, nuevaPartida, quedaEspacio, serializar, VELOCIDADES } from './nucleo/estado.mjs';
import { bandaDe, errorDeCampo, nuevoIdRegla, tipoParaSensor, validarRegla } from './nucleo/reglas.mjs';
import { describirRegla, trozosWhatsApp } from './nucleo/mensajes.mjs';
import { fmtDuracion, fmtFecha, fmtHora, fmtMomento, fmtNumero, fmtValor, diaDe } from './nucleo/formato.mjs';
import { aCSV, BOM, FILAS_CABECERA, nombreArchivo, registroTemperaturas } from './nucleo/csv.mjs';
import { idRelevo } from './nucleo/relevo.mjs';
import { filasTabla, pasoTabla, VENTANAS } from './nucleo/escalas.mjs';
import { SENSORES, sensor } from './nucleo/sensores.mjs';
import { crearRegistrador } from './registrador.mjs';
import { crearRelevoUI } from './relevo-ui.mjs';

const $ = (id) => document.getElementById(id);
const demo = $('demo');

// ── almacenamiento (todo en try/catch: la demo funciona sin él) ──
let avisoGuardado = false;
let guardadoIlegible = false; // había algo guardado y no se pudo recuperar
function leerTexto() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}
function leerGuardado() {
  const t = leerTexto();
  if (!t) return null;
  const d = leer(t);
  if (!d) guardadoIlegible = true;
  return d;
}
const partidaNueva = () =>
  nuevaPartida(() => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  });
function borrarGuardado() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: no hay nada que borrar */
  }
}

const NOTA_VELOCIDAD = {
  1: '×1: tiempo real, el reloj avanza un minuto por minuto.',
  60: '×60: cada segundo pasa un minuto.',
  600: '×600: cada segundo pasan diez minutos.',
};
const FALLAS_UI = {
  puerta: {
    activar: 'Dejar la puerta de la nevera abierta',
    reparar: 'Cerrar la puerta de la nevera',
    reposo: 'La nevera de la cocina queda abierta hasta que la cierres.',
    activa: (p) => `Abierta desde ${p}.`,
  },
  corte: {
    activar: 'Cortar la corriente 2 h',
    reparar: 'Devolver la corriente ahora',
    reposo: 'Se va la luz en todo el local durante dos horas.',
    activa: (p, fin) => `Sin corriente desde ${p}; vuelve a las ${fin}.`,
  },
  fuga: {
    activar: 'Provocar una fuga en el tanque',
    reparar: 'Reparar la fuga',
    reposo: 'Se rompe la salida del tanque: se pierden 50 litros por minuto.',
    activa: (p) => `Fuga desde ${p}.`,
  },
  compresora: {
    activar: 'Dañar la compresora de la nevera',
    reparar: 'Reparar la compresora',
    reposo: 'Empieza a vibrar en seguida y, en la media hora siguiente, deja de enfriar aunque trabaje sin parar.',
    activa: (p) => `Dañada desde ${p}: vibra y enfría cada vez menos.`,
  },
};

let estado; // { semilla, acciones, t, velocidad, ventana, baseISO, sala, partida }
let motor;
let registrador;
let relevo;
let pausado = false;
let cursor = null;
let porDibujar = true;
let porBitacora = true;
let ultimoDibujo = 0;
let ultimoGuardado = 0;
let ultimoReal = performance.now();
let acumulado = 0;
let mensajesPintados = new Set();
let ultimoDiaChat = null;
let ultimaTabla = 0;
let reloj = null;

function guardar() {
  estado = { ...estado, ...motor.exportar() };
  // Otra pestaña del tablero pudo guardar algo más nuevo (una falla, una regla, un restablecer): no se pisa.
  const ajeno = leerOtraPestana();
  if (ajeno && debeAdoptar(estado, ajeno)) {
    adoptar(ajeno);
    return;
  }
  escribir();
}

// Escribe sin mirar lo guardado (al arrancar y al restablecer, cuando lo propio manda).
function escribir() {
  estado = { ...estado, ...motor.exportar() };
  try {
    localStorage.setItem(CLAVE, serializar(estado));
  } catch {
    if (!avisoGuardado) {
      avisoGuardado = true;
      const p = document.createElement('p');
      p.className = 'nota';
      p.textContent = 'Este navegador no deja guardar datos: si recargas la página, la demo empieza de cero.';
      $('restablecer').before(p);
    }
  }
  ultimoGuardado = performance.now();
}

function leerOtraPestana(texto = leerTexto()) {
  if (!texto) return null;
  return leer(texto);
}

// Rehace el motor con lo que guardó otra pestaña (misma semilla y registro: se repite igual).
function adoptar(d) {
  estado = { ...d, partida: esPartida(d.partida) ? d.partida : estado.partida, sala: estado.sala };
  motor = crearMotor({ semilla: estado.semilla, acciones: estado.acciones, hasta: estado.t, baseISO: estado.baseISO });
  cursor = null;
  acumulado = 0;
  registrador.soltar();
  $('volver-ahora').hidden = true;
  for (const r of document.querySelectorAll('input[name="velocidad"]')) r.checked = Number(r.value) === estado.velocidad;
  for (const r of document.querySelectorAll('input[name="ventana"]')) r.checked = Number(r.value) === estado.ventana;
  pintarTodo();
  pintarExportar();
  ultimoGuardado = performance.now();
}

// ── arranque ──
function arrancar() {
  estado = leerGuardado() || estadoInicial(hoyISO());
  if (!esPartida(estado.partida)) estado.partida = partidaNueva();
  motor = crearMotor({ semilla: estado.semilla, acciones: estado.acciones, hasta: estado.t, baseISO: estado.baseISO });
  // Lo guardado queda ya con su partida: así otra pestaña que abra después sigue esta misma.
  escribir();
  if (guardadoIlegible) {
    const p = document.createElement('p');
    p.className = 'nota';
    p.setAttribute('role', 'status');
    p.textContent = 'No se pudo recuperar tu demo anterior (quizás de otra versión de esta página): empieza de cero.';
    $('consola').after(p);
  }

  registrador = crearRegistrador($('registrador'), {
    alMoverCursor(t, { fijo, teclado }) {
      cursor = t === null ? null : Math.round(t / 60) * 60;
      $('volver-ahora').hidden = !(fijo && cursor !== null);
      if (t === null) registrador.soltar();
      porDibujar = true;
      dibujar(true);
      if (teclado) anunciarCursor();
    },
  });

  relevo = crearRelevoUI({
    panel: $('relevo'),
    boton: $('mi-telefono'),
    qr: $('relevo-qr'),
    enlace: $('relevo-enlace'),
    codigo: $('relevo-sala'),
    estado: $('relevo-estado'),
    prueba: $('relevo-prueba'),
    apagar: $('relevo-apagar'),
    salaInicial: estado.sala,
    alCambiarSala(sala) {
      estado.sala = sala;
      guardar();
    },
  });

  conectarConsola();
  conectarFallas();
  conectarChat();
  conectarRegistro();
  conectarReglas();
  conectarExportar();
  conectarRestablecer();
  conectarNotificacion();

  $('velocidad').disabled = false;
  $('pausa').disabled = false;
  $('mi-telefono').disabled = false;
  $('demo-error').hidden = true;
  for (const r of document.querySelectorAll('input[name="ventana"]')) r.disabled = false;
  pintarTodo();
  demo.dataset.estado = 'lista';

  document.addEventListener('visibilitychange', () => {
    ultimoReal = performance.now();
    if (document.hidden) guardar();
  });
  window.addEventListener('pagehide', guardar);
  // La otra pestaña guardó: si trae una partida nueva o más acciones, esta la sigue.
  window.addEventListener('storage', (e) => {
    if (e.key !== CLAVE || !e.newValue) return;
    const ajeno = leerOtraPestana(e.newValue);
    if (ajeno && debeAdoptar({ ...estado, ...motor.exportar() }, ajeno)) adoptar(ajeno);
  });
  // El alto de la consola fija, para que las anclas y el foco no queden debajo de ella (scroll-padding en demo.css).
  // Si la consola ocupa más de un cuarto de la ventana (letra grande, ventana baja), deja de ser fija.
  const medirConsola = () => {
    const raiz = document.documentElement.style;
    const consola = $('consola');
    const alto = Math.round(consola.getBoundingClientRect().height);
    const cabecera = document.querySelector('.cabecera');
    if (cabecera) raiz.setProperty('--alto-cabecera', `${Math.round(cabecera.getBoundingClientRect().height)}px`);
    raiz.setProperty('--alto-consola', `${alto}px`);
    demo.toggleAttribute('data-consola-suelta', alto > window.innerHeight * 0.25);
    const fija = getComputedStyle(consola).position === 'sticky';
    raiz.setProperty('--alto-consola-fija', `${fija ? alto : 0}px`);
  };
  const ro = new ResizeObserver(medirConsola);
  ro.observe($('consola'));
  if (document.querySelector('.cabecera')) ro.observe(document.querySelector('.cabecera'));
  window.addEventListener('resize', medirConsola);

  reloj = setInterval(latido, 200);
}

function pintarTodo() {
  mensajesPintados = new Set();
  ultimoDiaChat = null;
  $('chat').replaceChildren($('chat-vacio'));
  pintarChat(motor.mensajes, false);
  pintarReglas();
  pintarConsola();
  pintarFallas();
  porBitacora = true;
  porDibujar = true;
  dibujar(true);
}

// ── el latido: avanza la simulación y repinta lo que cambió ──
function latido() {
  const ahora = performance.now();
  const dt = Math.min(1, (ahora - ultimoReal) / 1000);
  ultimoReal = ahora;
  if (!pausado && !document.hidden && !motor.terminado) {
    acumulado += dt * estado.velocidad;
    const avance = Math.floor(acumulado / PASO) * PASO;
    if (avance > 0) {
      acumulado -= avance;
      const r = motor.avanzarHasta(motor.t + avance);
      if (r.muestras) porDibujar = true;
      if (r.eventos.length) {
        // un aviso que abre o cierra se ve a la vez en el teléfono, la bitácora y los gráficos
        porBitacora = true;
        dibujar(true);
      }
      if (r.mensajes.length) {
        pintarChat(r.mensajes, true);
        for (const m of r.mensajes) relevo.publicar({ tipo: m.tipo, id: idRelevo(estado.partida, m.id), texto: m.texto, hora: fmtHora(m.t) });
        notificar(r.mensajes.filter((m) => m.tipo === 'aviso'));
      }
      if (motor.terminado) {
        guardar();
        pintarFallas();
      }
    }
  }
  pintarConsola();
  dibujar(false);
  if (performance.now() - ultimoGuardado > 3000) guardar();
}

function dibujar(forzar) {
  const ahora = performance.now();
  if (!porDibujar && !forzar) return;
  if (!forzar && ahora - ultimoDibujo < 240) return;
  ultimoDibujo = ahora;
  porDibujar = false;
  const horas = estado.ventana;
  const hasta = motor.t;
  const desde = hasta - horas * 3600;
  if (cursor !== null && (cursor < desde || cursor > hasta)) {
    cursor = null;
    $('volver-ahora').hidden = true;
    registrador.soltar();
  }
  registrador.dibujar({
    muestras: motor.muestras,
    intervalos: motor.intervalos,
    alertas: motor.alertas,
    reglas: motor.reglas,
    periodos: periodosDeFallas(motor.registro, motor.t),
    desde,
    hasta,
    ahora: motor.t,
    cursor,
    horas,
    baseISO: estado.baseISO,
  });
  pintarLectura();
  pintarSituaciones();
  if (porBitacora || motor.activas().length) pintarBitacora();
  if (!$('tabla').hidden && (forzar || ahora - ultimaTabla > 2000)) pintarTabla();
  pintarFallas();
}

function pintarLectura() {
  const txt = cursor === null ? `Lectura de ahora: ${fmtFecha(motor.t, estado.baseISO)}, ${fmtHora(motor.t)}` : `Lectura de ${fmtMomento(cursor, motor.t, estado.baseISO)} (hace ${fmtDuracion(motor.t - cursor)})`;
  if ($('lectura').textContent !== txt) $('lectura').textContent = txt;
}

// ── consola ──
function conectarConsola() {
  for (const r of document.querySelectorAll('input[name="velocidad"]')) {
    r.checked = Number(r.value) === estado.velocidad;
    r.addEventListener('change', () => {
      if (!r.checked) return;
      estado.velocidad = VELOCIDADES.includes(Number(r.value)) ? Number(r.value) : 60;
      acumulado = 0;
      guardar();
      pintarConsola();
    });
  }
  $('pausa').addEventListener('click', () => {
    pausado = !pausado;
    ultimoReal = performance.now();
    pintarConsola();
    if (pausado) dibujar(true);
  });
}

function pintarConsola() {
  const texto = `${fmtFecha(motor.t, estado.baseISO)}, ${fmtHora(motor.t)}`;
  if ($('reloj').textContent !== texto) $('reloj').textContent = texto;
  const pausa = $('pausa');
  const p = pausado ? 'true' : 'false';
  if (pausa.getAttribute('aria-pressed') !== p) {
    pausa.setAttribute('aria-pressed', p);
    pausa.textContent = pausado ? 'Seguir' : 'Pausar';
  }
  pausa.disabled = motor.terminado;
  for (const r of document.querySelectorAll('input[name="velocidad"]')) r.disabled = motor.terminado;
  const nota = motor.terminado
    ? 'La simulación llegó al final del día 7. Restablece los datos de ejemplo para empezar de nuevo.'
    : pausado
      ? 'En pausa. El reloj y los sensores esperan a que sigas.'
      : NOTA_VELOCIDAD[estado.velocidad];
  if ($('velocidad-nota').textContent !== nota) $('velocidad-nota').textContent = nota;

  if (cursor === null) pintarLectura();

  // El estado general cuenta los avisos abiertos y también lo que ya está fuera de lo normal sin aviso todavía.
  const activas = motor.activas();
  const contando = motor.reglas
    .filter((r) => r.activa)
    .map((r) => ({ r, s: motor.situacion(r) }))
    .filter((x) => x.s.estado === 'contando')
    .sort((a, b) => a.s.avisaEn - b.s.avisaEn);
  let tipo = 'ok';
  let txt = pausado ? 'En pausa, todo en rango' : 'Todo en rango';
  if (activas.length) {
    tipo = 'aviso';
    txt = activas.length === 1 ? `1 aviso activo: ${sensor(activas[0].sensor).nombre}` : `${activas.length} avisos activos`;
  } else if (contando.length) {
    tipo = 'fuera';
    const primero = contando[0];
    const quien = contando.length === 1 ? `${sensor(primero.r.sensor).corto || sensor(primero.r.sensor).nombre} fuera de lo normal` : `${contando.length} lecturas fuera de lo normal`;
    txt = `${quien}: avisa a las ${fmtHora(primero.s.avisaEn)} si sigue así`;
  } else if (motor.terminado) {
    tipo = 'fin';
    txt = 'Fin de la simulación';
  } else if (pausado) {
    tipo = 'pausa';
  }
  const g = $('general');
  if (g.dataset.estado !== tipo) g.dataset.estado = tipo;
  if ($('general-texto').textContent !== txt) $('general-texto').textContent = txt;
}

// ── fallas ──
function conectarFallas() {
  for (const b of document.querySelectorAll('.falla__boton')) {
    b.addEventListener('click', () => {
      if (!hayEspacio()) return;
      const f = b.dataset.falla;
      const activa = estaActiva(f);
      motor.ponerFalla(f, !activa);
      guardar();
      porDibujar = true;
      pintarFallas();
      dibujar(true);
    });
  }
}

// El registro de acciones tiene un tope (lo guardado con más acciones no se vuelve a leer): al llegar, se dice.
const TEXTO_TOPE = `Llegaste a ${MAX_ACCIONES} cambios en esta demo, el máximo que se puede guardar. Restablece los datos de ejemplo para seguir provocando fallas o cambiando reglas.`;
function hayEspacio() {
  return quedaEspacio(motor.registro);
}

function estaActiva(f) {
  const fa = motor.fallas();
  return f === 'corte' ? fa.corte !== null : !!fa[f];
}

function pintarFallas() {
  const periodos = periodosDeFallas(motor.registro, motor.t);
  const fa = motor.fallas();
  for (const li of document.querySelectorAll('.falla')) {
    const f = li.dataset.falla;
    const ui = FALLAS_UI[f];
    const activa = estaActiva(f);
    const boton = li.querySelector('.falla__boton');
    const texto = li.querySelector('.falla__estado');
    let etiqueta = ui.activar;
    let estadoTxt = ui.reposo;
    if (activa) {
      const p = [...periodos].reverse().find((x) => x.falla === f && x.fin === null);
      const desde = p ? fmtMomento(p.inicio, motor.t, estado.baseISO) : '';
      etiqueta = ui.reparar;
      estadoTxt = ui.activa(desde, f === 'corte' && fa.corte ? fmtHora(fa.corte) : '');
      li.dataset.activa = '';
    } else {
      delete li.dataset.activa;
    }
    if (boton.textContent !== etiqueta) boton.textContent = etiqueta;
    if (texto.textContent !== estadoTxt) texto.textContent = estadoTxt;
    boton.disabled = motor.terminado || !hayEspacio();
  }
  const tope = $('tope-acciones');
  const lleno = !hayEspacio();
  if (tope.hidden === lleno) {
    tope.hidden = !lleno;
    tope.textContent = lleno ? TEXTO_TOPE : '';
  }
}

// ── teléfono del dueño ──
function conectarChat() {
  $('copiar').addEventListener('click', async () => {
    const ultimo = [...motor.mensajes].reverse().find((m) => m.tipo === 'aviso');
    const est = $('copiar-estado');
    if (!ultimo) return;
    try {
      await navigator.clipboard.writeText(ultimo.texto);
      est.textContent = 'Texto del último aviso copiado.';
    } catch {
      est.textContent = 'Este navegador no dejó copiar. Selecciona el texto del mensaje y cópialo a mano.';
    }
  });
}

function burbuja(m, nueva) {
  const b = document.createElement('div');
  b.className = `burbuja${nueva ? ' burbuja--nueva' : ''}`;
  b.dataset.id = m.id;
  for (const linea of m.texto.split('\n')) {
    const p = document.createElement('p');
    p.className = 'burbuja__linea';
    for (const t of trozosWhatsApp(linea)) {
      if (t.negrita) {
        const s = document.createElement('strong');
        s.textContent = t.texto;
        p.append(s);
      } else {
        p.append(document.createTextNode(t.texto));
      }
    }
    b.append(p);
  }
  const hora = document.createElement('span');
  hora.className = 'burbuja__hora';
  hora.textContent = fmtHora(m.t);
  b.append(hora);
  return b;
}

function pintarChat(mensajes, nuevos) {
  const chat = $('chat');
  const vacio = $('chat-vacio');
  const abajo = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
  let agregados = 0;
  for (const m of mensajes.slice(-80)) {
    if (mensajesPintados.has(m.id)) continue;
    mensajesPintados.add(m.id);
    const dia = diaDe(m.t);
    if (dia !== ultimoDiaChat) {
      ultimoDiaChat = dia;
      const sep = document.createElement('p');
      sep.className = 'chat__dia';
      sep.textContent = fmtFecha(m.t, estado.baseISO);
      chat.append(sep);
    }
    chat.append(burbuja(m, nuevos));
    agregados++;
  }
  while (chat.querySelectorAll('.burbuja').length > 80) {
    const primero = chat.querySelector('.burbuja');
    const anterior = primero.previousElementSibling;
    primero.remove();
    if (anterior && anterior.classList.contains('chat__dia') && !(anterior.nextElementSibling?.classList.contains('burbuja'))) anterior.remove();
  }
  vacio.hidden = mensajesPintados.size > 0;
  $('copiar').disabled = !motor.mensajes.some((m) => m.tipo === 'aviso');
  if (agregados && (abajo || !nuevos)) chat.scrollTop = chat.scrollHeight;
}

// ── notificación flotante (solo si el teléfono no se ve) ──
let telefonoVisible = false;
let temporizadorNoti = null;
function conectarNotificacion() {
  new IntersectionObserver((entradas) => {
    telefonoVisible = entradas.some((e) => e.isIntersecting);
    if (telefonoVisible) ocultarNotificacion();
  }, { threshold: 0.35 }).observe($('chat'));
  $('notificacion-cerrar').addEventListener('click', ocultarNotificacion);
  $('notificacion-ver').addEventListener('click', () => {
    ocultarNotificacion();
    $('telefono').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    $('chat').focus({ preventScroll: true });
  });
  const noti = $('notificacion');
  noti.addEventListener('pointerenter', () => clearTimeout(temporizadorNoti));
  noti.addEventListener('focusin', () => clearTimeout(temporizadorNoti));
  noti.addEventListener('pointerleave', programarOcultar);
  noti.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ocultarNotificacion();
  });
}
function programarOcultar() {
  clearTimeout(temporizadorNoti);
  temporizadorNoti = setTimeout(ocultarNotificacion, 9000);
}
function ocultarNotificacion() {
  clearTimeout(temporizadorNoti);
  $('notificacion').hidden = true;
}
function notificar(avisos) {
  if (!avisos.length || telefonoVisible) return;
  const ultimo = avisos.at(-1);
  const lineas = ultimo.texto.split('\n').slice(1, 2).join('\n');
  $('notificacion-texto').textContent = avisos.length > 1 ? `${lineas}\n(y ${avisos.length - 1} aviso más)` : lineas;
  $('notificacion').hidden = false;
  programarOcultar();
}

// ── registro: ventana, cursor y tabla ──
function conectarRegistro() {
  for (const r of document.querySelectorAll('input[name="ventana"]')) {
    r.checked = Number(r.value) === estado.ventana;
    r.addEventListener('change', () => {
      if (!r.checked) return;
      estado.ventana = VENTANAS.includes(Number(r.value)) ? Number(r.value) : 6;
      guardar();
      dibujar(true);
    });
  }
  $('volver-ahora').addEventListener('click', () => {
    cursor = null;
    registrador.soltar();
    $('volver-ahora').hidden = true;
    dibujar(true);
    $('registrador').focus();
  });
  $('ver-tabla').addEventListener('click', () => {
    const tabla = $('tabla');
    tabla.hidden = !tabla.hidden;
    $('ver-tabla').setAttribute('aria-expanded', String(!tabla.hidden));
    $('ver-tabla').textContent = tabla.hidden ? 'Ver los datos en tabla' : 'Ocultar la tabla';
    if (!tabla.hidden) pintarTabla();
  });
}

let anuncioPendiente = null;
function anunciarCursor() {
  clearTimeout(anuncioPendiente);
  anuncioPendiente = setTimeout(() => {
    const valores = [...document.querySelectorAll('#registrador .tira')]
      .map((t) => {
        const nombre = t.querySelector('.tira__nombre')?.firstChild?.textContent?.trim();
        const nodoValor = t.querySelector('[data-valor]');
        // una lista (puertas y bomba) se lee renglón por renglón, no pegada
        const partes = nodoValor ? [...nodoValor.children].map((c) => c.textContent) : [];
        const valor = partes.length ? partes.join('. ') : nodoValor?.textContent;
        return nombre && valor ? `${nombre}: ${valor}` : null;
      })
      .filter(Boolean);
    $('registrador-anuncio').textContent = `${$('lectura').textContent}. ${valores.join('. ')}`;
  }, 350);
}

function celda(texto, fuera = false) {
  const td = document.createElement('td');
  td.textContent = texto;
  if (fuera) td.className = 'celda-fuera';
  return td;
}

function pintarTabla() {
  ultimaTabla = performance.now();
  const horas = estado.ventana;
  const paso = pasoTabla(horas);
  const filas = filasTabla(motor.muestras, motor.intervalos, motor.t - horas * 3600, motor.t, paso);
  $('tabla-nota').textContent = `Un renglón cada ${paso === 3600 ? 'hora' : `${paso / 60} min`} con lo más alto de cada temperatura, el tiempo que estuvo abierta cada puerta y el consumo. En rojo, lo que quedó fuera del rango de su regla. Se actualiza con la simulación; pausa para leerla con calma.`;
  const fuera = (id, v) => {
    const b = bandaDe(id, motor.reglas);
    return !!b && ((b.max !== null && v > b.max) || (b.min !== null && v < b.min));
  };
  const cuerpo = $('tabla-cuerpo');
  cuerpo.replaceChildren(
    ...filas.reverse().map((f) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = `${fmtMomento(f.inicio, motor.t, estado.baseISO)}–${fmtHora(f.fin)}`;
      tr.append(
        th,
        celda(fmtValor('nevera', f.neveraMax), fuera('nevera', f.neveraMax)),
        celda(fmtValor('cuarto', f.cuartoMax), fuera('cuarto', f.cuartoMax)),
        celda(fmtValor('congelador', f.congeladorMax), fuera('congelador', f.congeladorMax)),
        celda(fmtDuracion(f.puertaNeveraS)),
        celda(fmtDuracion(f.puertaCuartoS)),
        celda(fmtDuracion(f.bombaS)),
        celda(fmtValor('vibracion', f.vibracionMax), fuera('vibracion', f.vibracionMax)),
        celda(`${fmtNumero(f.kwh, 2)} kWh`),
        celda(fmtValor('tanque', f.tanqueMin), fuera('tanque', f.tanqueMin)),
        celda(fmtValor('humedad', f.humedadMax), fuera('humedad', f.humedadMax)),
      );
      return tr;
    }),
  );
}

// ── bitácora ──
function pintarBitacora() {
  porBitacora = false;
  const alertas = motor.alertas;
  $('bitacora-vacia').hidden = alertas.length > 0;
  $('bitacora-envoltura').hidden = alertas.length === 0;
  const cuerpo = $('bitacora');
  const filas = [...alertas].reverse().slice(0, 50).map((a) => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    const regla = document.createElement('span');
    regla.className = 'bitacora__regla';
    regla.textContent = describirRegla(a.regla);
    const detalle = document.createElement('span');
    detalle.className = 'bitacora__detalle';
    const extremo = a.regla.tipo === 'rango' ? `; ${a.lado === 'bajo' ? 'bajó hasta' : 'llegó a'} ${fmtValor(a.sensor, a.extremo)}` : '';
    detalle.textContent = `Aviso a las ${fmtHora(a.aviso)}${extremo}${a.motivo === 'regla' ? '; cerrado al apagar la regla' : ''}`;
    td.append(regla, detalle);
    const fin = document.createElement('td');
    if (a.fin === null) {
      const s = document.createElement('span');
      s.className = 'bitacora__sigue';
      const punto = document.createElement('span');
      punto.className = 'punto punto--aviso';
      punto.setAttribute('aria-hidden', 'true');
      s.append(punto, document.createTextNode('sigue'));
      fin.append(s);
    } else {
      fin.textContent = fmtMomento(a.fin, motor.t, estado.baseISO);
    }
    const duracion = fmtDuracion((a.fin ?? motor.t) - a.inicio);
    tr.append(td, celda(fmtMomento(a.inicio, motor.t, estado.baseISO)), fin, celda(a.fin === null ? `lleva ${duracion}` : duracion));
    return tr;
  });
  cuerpo.replaceChildren(...filas);
  let mas = $('bitacora-mas');
  if (alertas.length > 50) {
    if (!mas) {
      mas = document.createElement('p');
      mas.id = 'bitacora-mas';
      mas.className = 'bitacora__mas';
      $('bitacora-envoltura').after(mas);
    }
    mas.textContent = `Se muestran los 50 avisos más recientes de ${alertas.length}. El CSV trae todo lo simulado.`;
  } else if (mas) mas.remove();
}

// ── reglas ──
const SENSORES_CON_REGLA = SENSORES.filter((s) => tipoParaSensor(s.id));

function leerNumero(input) {
  // «8e» o «1e400» en un campo numérico: el navegador deja value vacío y marca badInput. No es «sin límite».
  if (input.validity?.badInput) return Number.NaN;
  const v = input.value.trim();
  if (v === '') return null;
  const n = Number(v.replace(',', '.').replace('−', '-'));
  return Number.isFinite(n) ? n : Number.NaN;
}
function leerEntero(input) {
  if (input.validity?.badInput) return Number.NaN;
  const v = input.value.trim();
  if (v === '') return Number.NaN;
  const n = Number(v);
  return Number.isInteger(n) ? n : Number.NaN;
}

function campoNumero(etiqueta, nombre, valor, extra = {}) {
  const label = document.createElement('label');
  label.className = 'campo';
  const span = document.createElement('span');
  span.textContent = etiqueta;
  const input = document.createElement('input');
  input.type = 'number';
  input.name = nombre;
  input.step = extra.step || 'any';
  input.inputMode = extra.inputMode || 'decimal';
  if (extra.min !== undefined) input.min = extra.min;
  if (extra.max !== undefined) input.max = extra.max;
  input.value = valor === null || valor === undefined ? '' : String(valor);
  label.append(span, input);
  return { label, input };
}

function pintarReglas() {
  const lista = $('reglas');
  lista.replaceChildren(
    ...motor.reglas.map((r) => {
      const s = sensor(r.sensor);
      const li = document.createElement('li');
      li.className = 'regla';
      li.dataset.regla = r.id;
      if (!r.activa) li.dataset.apagada = '';
      const errorId = `regla-error-${r.id}`;

      const activa = document.createElement('label');
      activa.className = 'regla__activa';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = r.activa;
      check.name = 'activa';
      activa.append(check, document.createTextNode('Activa'));
      const textos = document.createElement('div');
      textos.className = 'regla__textos';
      const texto = document.createElement('p');
      texto.className = 'regla__texto';
      texto.textContent = describirRegla(r);
      const situacion = document.createElement('p');
      situacion.className = 'regla__situacion';
      situacion.dataset.situacion = '';
      textos.append(texto, situacion);

      // Los campos van plegados detrás de «Cambiar»: la lista se lee en una línea por regla.
      const editar = document.createElement('button');
      editar.type = 'button';
      editar.className = 'enlace-boton regla__editar';
      editar.textContent = 'Cambiar';
      editar.setAttribute('aria-expanded', 'false');
      editar.setAttribute('aria-controls', `regla-campos-${r.id}`);
      editar.setAttribute('aria-label', `Cambiar la regla: ${describirRegla(r)}`);
      const campos = document.createElement('div');
      campos.className = 'campos regla__campos';
      campos.id = `regla-campos-${r.id}`;
      campos.hidden = true;
      editar.addEventListener('click', () => {
        campos.hidden = !campos.hidden;
        editar.setAttribute('aria-expanded', String(!campos.hidden));
        editar.textContent = campos.hidden ? 'Cambiar' : 'Listo';
        if (!campos.hidden) campos.querySelector('input')?.focus();
      });
      const unidad = s.unidad ? ` (${s.unidad})` : '';
      const entradas = {};
      if (r.tipo === 'rango') {
        const mn = campoNumero(`Mínimo${unidad}`, 'min', r.min);
        const mx = campoNumero(`Máximo${unidad}`, 'max', r.max);
        entradas.min = mn.input;
        entradas.max = mx.input;
        const par = document.createElement('div');
        par.className = 'campos__par';
        par.append(mn.label, mx.label);
        campos.append(par);
      }
      const mi = campoNumero('Por más de (min)', 'minutos', r.minutos, { step: '1', inputMode: 'numeric', min: 1, max: 1440 });
      entradas.minutos = mi.input;
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'boton boton--linea regla__quitar';
      quitar.textContent = 'Quitar';
      quitar.setAttribute('aria-label', `Quitar la regla: ${describirRegla(r)}`);
      campos.append(mi.label, quitar);

      const error = document.createElement('p');
      error.className = 'error';
      error.id = errorId;
      error.setAttribute('role', 'alert');
      for (const inp of Object.values(entradas)) inp.setAttribute('aria-describedby', errorId);

      const aplicar = () => {
        if (!hayEspacio()) {
          error.textContent = TEXTO_TOPE;
          check.checked = r.activa;
          return;
        }
        const candidata = { ...r, activa: check.checked, minutos: leerEntero(entradas.minutos) };
        if (r.tipo === 'rango') {
          candidata.min = leerNumero(entradas.min);
          candidata.max = leerNumero(entradas.max);
        }
        const errores = validarRegla(candidata);
        for (const [campo, inp] of Object.entries(entradas)) inp.setAttribute('aria-invalid', String(errores.some((e) => errorDeCampo(e, campo))));
        if (errores.length) {
          error.textContent = errores.map((e) => e.texto).join(' ');
          if (campos.hidden) editar.click();
          return;
        }
        error.textContent = '';
        const nuevas = motor.reglas.map((x) => (x.id === r.id ? candidata : x));
        motor.cambiarReglas(nuevas);
        Object.assign(r, candidata);
        texto.textContent = describirRegla(candidata);
        quitar.setAttribute('aria-label', `Quitar la regla: ${describirRegla(candidata)}`);
        editar.setAttribute('aria-label', `Cambiar la regla: ${describirRegla(candidata)}`);
        if (candidata.activa) delete li.dataset.apagada;
        else li.dataset.apagada = '';
        guardar();
        porBitacora = true;
        dibujar(true);
      };
      check.addEventListener('change', aplicar);
      for (const inp of Object.values(entradas)) inp.addEventListener('change', aplicar);
      quitar.addEventListener('click', () => {
        if (!hayEspacio()) {
          error.textContent = TEXTO_TOPE;
          return;
        }
        const siguiente = li.nextElementSibling?.querySelector('input') || li.previousElementSibling?.querySelector('input') || $('nueva-sensor');
        motor.cambiarReglas(motor.reglas.filter((x) => x.id !== r.id));
        guardar();
        li.remove();
        $('nueva-error').textContent = '';
        porBitacora = true;
        dibujar(true);
        siguiente.focus();
      });

      li.append(activa, editar, textos, campos, error);
      return li;
    }),
  );
  pintarSituaciones();
}

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// Cómo se dice que una regla se está incumpliendo, o que volvió a lo normal, según su tipo.
function comoFuera(r) {
  if (r.tipo === 'estado') return mayuscula(sensor(r.sensor).activo);
  if (r.tipo === 'corriente') return 'Sin corriente';
  return 'Fuera de rango';
}
function comoDentro(r) {
  if (r.tipo === 'estado') return mayuscula(sensor(r.sensor).inactivo);
  if (r.tipo === 'corriente') return 'Con corriente';
  return 'De vuelta en el rango';
}

function pintarSituaciones() {
  for (const li of document.querySelectorAll('#reglas .regla')) {
    const r = motor.reglas.find((x) => x.id === li.dataset.regla);
    if (!r) continue;
    const s = motor.situacion(r);
    const nodo = li.querySelector('[data-situacion]');
    let texto;
    let tipo = s.estado;
    if (s.estado === 'apagada') texto = 'Apagada: no avisa.';
    else if (s.estado === 'normal') texto = r.tipo === 'estado' ? 'Normal.' : r.tipo === 'corriente' ? 'Con corriente.' : 'En rango.';
    else if (s.estado === 'contando') texto = `${comoFuera(r)} desde las ${fmtHora(s.desde)}: avisa a las ${fmtHora(s.avisaEn)} si sigue así.`;
    else if (s.estado === 'activa') texto = `Aviso enviado a las ${fmtHora(s.desde)}.`;
    else if (s.estado === 'cerrando') texto = `${comoDentro(r)} desde las ${fmtHora(s.desde)}: se da por resuelto a las ${fmtHora(s.cierraEn)}.`;
    if (nodo.textContent !== texto) nodo.textContent = texto;
    if (nodo.dataset.tipo !== tipo) nodo.dataset.tipo = tipo;
  }
}

function conectarReglas() {
  const form = $('nueva-regla');
  const select = $('nueva-sensor');
  select.replaceChildren(
    ...SENSORES_CON_REGLA.map((s) => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = `${s.etiqueta} ${s.nombre}`;
      return o;
    }),
  );
  const ajustar = () => {
    const tipo = tipoParaSensor(select.value);
    const s = sensor(select.value);
    for (const el of form.querySelectorAll('[data-solo="rango"]')) el.hidden = tipo !== 'rango';
    for (const u of form.querySelectorAll('[data-unidad]')) u.textContent = s.unidad ? `(${s.unidad})` : '';
  };
  select.addEventListener('change', ajustar);
  ajustar();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const tipo = tipoParaSensor(select.value);
    const regla = { id: nuevoIdRegla(motor.reglas, motor.idsUsados()), sensor: select.value, tipo, minutos: leerEntero(form.minutos), activa: true };
    if (tipo === 'rango') {
      regla.min = leerNumero(form.min);
      regla.max = leerNumero(form.max);
    }
    const errores = validarRegla(regla);
    for (const n of ['min', 'max', 'minutos']) form[n].setAttribute('aria-invalid', String(errores.some((x) => errorDeCampo(x, n))));
    if (motor.reglas.length >= 40) errores.push({ campo: 'sensor', texto: 'Ya hay 40 reglas: quita alguna antes de agregar otra.' });
    if (!hayEspacio()) errores.push({ campo: 'sensor', texto: TEXTO_TOPE });
    if (errores.length) {
      $('nueva-error').textContent = errores.map((x) => x.texto).join(' ');
      return;
    }
    $('nueva-error').textContent = '';
    motor.cambiarReglas([...motor.reglas, regla]);
    guardar();
    pintarReglas();
    form.min.value = '';
    form.max.value = '';
    const li = document.querySelector(`#reglas [data-regla="${regla.id}"]`);
    li?.scrollIntoView({ block: 'nearest' });
    li?.querySelector('input')?.focus();
    porBitacora = true;
    dibujar(true);
  });
}

// ── exportar ──
function datosExportar() {
  const form = $('exportar');
  const periodo = form.periodo.value;
  const cada = Number(form.cada.value);
  const hasta = motor.t;
  const desde = periodo === 'todo' ? motor.muestras[0]?.t ?? hasta : hasta - 86400;
  const filas = registroTemperaturas(motor.muestras, motor.alertas, { desde, hasta, cada, baseISO: estado.baseISO });
  return { filas, nombre: nombreArchivo(desde, hasta, estado.baseISO) };
}
function pintarExportar() {
  const { filas, nombre } = datosExportar();
  $('exportar-info').textContent = `${fmtNumero(filas.length - FILAS_CABECERA, 0)} filas de lecturas, archivo ${nombre}`;
  if ($('csv-muestra').closest('details').open) {
    $('csv-muestra').textContent = aCSV(filas.slice(0, 6), { bom: false });
  }
}
function conectarExportar() {
  const form = $('exportar');
  $('descargar').disabled = false;
  form.addEventListener('change', pintarExportar);
  $('csv-muestra').closest('details').addEventListener('toggle', pintarExportar);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { filas, nombre } = datosExportar();
    const texto = aCSV(filas);
    const blob = new Blob([texto.startsWith(BOM) ? texto : BOM + texto], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    $('exportar-info').textContent = `Descargado: ${nombre} (${fmtNumero(filas.length - FILAS_CABECERA, 0)} filas).`;
  });
  setInterval(() => {
    if (!document.hidden) pintarExportar();
  }, 5000);
  pintarExportar();
}

// ── restablecer ──
function conectarRestablecer() {
  const boton = $('restablecer');
  const confirmar = $('restablecer-confirmar');
  boton.disabled = false;
  boton.addEventListener('click', () => {
    confirmar.hidden = false;
    boton.hidden = true;
    $('restablecer-no').focus();
  });
  $('restablecer-no').addEventListener('click', () => {
    confirmar.hidden = true;
    boton.hidden = false;
    boton.focus();
  });
  $('restablecer-si').addEventListener('click', () => {
    const sala = estado.sala;
    // Se borra antes de guardar: lo guardado es de la partida anterior y guardar() lo adoptaría.
    borrarGuardado();
    estado = { ...estadoInicial(hoyISO(), partidaNueva()), sala };
    motor = crearMotor({ semilla: estado.semilla, acciones: [], hasta: estado.t, baseISO: estado.baseISO });
    pausado = false;
    cursor = null;
    acumulado = 0;
    registrador.soltar();
    $('volver-ahora').hidden = true;
    for (const r of document.querySelectorAll('input[name="velocidad"]')) r.checked = Number(r.value) === estado.velocidad;
    for (const r of document.querySelectorAll('input[name="ventana"]')) r.checked = Number(r.value) === estado.ventana;
    $('nueva-error').textContent = '';
    ocultarNotificacion();
    guardar();
    pintarTodo();
    pintarExportar();
    confirmar.hidden = true;
    boton.hidden = false;
    boton.focus();
  });
}

// El botón «Restablecer datos de ejemplo y volver a cargar» del error lo atiende el script en línea de index.html,
// que funciona aunque este módulo no haya llegado a cargar.

try {
  arrancar();
} catch (e) {
  if (reloj) clearInterval(reloj);
  demo.dataset.estado = 'error';
  $('demo-error').hidden = false;
  $('demo-error-texto').textContent = `Algo falló al preparar la simulación (${e && e.message ? e.message : 'error desconocido'}). Si guardaste cambios en una visita anterior, restablecer los datos de ejemplo suele resolverlo.`;
  console.error(e);
}

