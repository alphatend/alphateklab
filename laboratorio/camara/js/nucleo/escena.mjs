// La escena junta todo lo que pasa con cada cuadro analizado, sin tocar el DOM:
//   detecciones → seguimiento (números estables) → línea de conteo → aforo → zona de fila → mapa de calor → minutos.
// La interfaz solo le pasa las cajas que encontró el detector (en píxeles del cuadro analizado) y dos horas:
//   · t, el tiempo de la escena: el del video (si el video va a 0,25×, un segundo de video son cuatro de reloj) o el
//     del reloj con la cámara. El seguimiento, la fila y el mapa de calor miden en este tiempo, porque sus umbrales
//     («900 ms sin verla», «2 s seguidos en la zona») hablan de lo que pasa delante de la cámara.
//   · reloj, la hora de verdad (Date.now()): en qué minuto del día cae cada entrada o salida.

import { crearSeguidor } from './seguimiento.mjs';
import { crearContador, calcularAforo } from './conteo.mjs';
import { crearVigiaDeFila } from './fila.mjs';
import { crearMapaDeCalor } from './calor.mjs';
import { crearIntervalos } from './intervalos.mjs';
import { aPixeles, puntoEnPoligono } from './geometria.mjs';
import { conteoVacio } from './estado.mjs';

export const COLUMNAS_CALOR = 48;

/** Banda de histéresis y margen de la línea, en píxeles, según el tamaño del cuadro analizado. */
export function medidasDeLinea(ancho, alto, { factorBanda = 0.02, factorMargen = 0.03 } = {}) {
  const diagonal = Math.hypot(ancho, alto);
  return { banda: Math.max(4, factorBanda * diagonal), margen: factorMargen * diagonal };
}

export function crearEscena({ ancho, alto, config, conteo = null, opcionesSeguimiento = {}, opcionesLinea = {}, opcionesFila = {} }) {
  const W = ancho;
  const H = alto;
  const { banda, margen } = medidasDeLinea(W, H, opcionesLinea);
  const seguidor = crearSeguidor(opcionesSeguimiento);
  let cfg = config;
  const pix = (p) => aPixeles(p, W, H);
  const contador = crearContador({ a: pix(cfg.linea.a), b: pix(cfg.linea.b), sentido: cfg.sentido, banda, margen });
  const vigia = crearVigiaDeFila({ ...opcionesFila, maxPersonas: cfg.filaMax, segundos: cfg.filaSegundos });
  const calor = crearMapaDeCalor(COLUMNAS_CALOR, Math.max(1, Math.round((COLUMNAS_CALOR * H) / W)));
  const intervalos = crearIntervalos();
  let zonaPx = cfg.zona ? cfg.zona.map(pix) : null;

  const base = conteo || conteoVacio('');
  let ajuste = base.ajuste || 0;
  let maximo = base.maximo || 0;
  let avisosFila = base.avisosFila || 0;
  let fecha = base.fecha;
  contador.reiniciar({ entradas: base.entradas || 0, salidas: base.salidas || 0 });
  intervalos.cargar(base.intervalos);
  // Si lo guardado es de otra cuadrícula (un video vertical o una cámara 4:3 leídos con una escena provisional de
  // 16:9), no se puede cargar aquí, pero tampoco se borra: se devuelve tal cual al exportar mientras esta escena no
  // haya sumado calor propio.
  let calorGuardado = base.calor && !calor.cargar(base.calor) ? base.calor : null;

  let ultimoT = null; // para el mapa de calor; se olvida cuando el video vuelve a empezar
  let tActual = null; // el último tiempo de escena procesado
  let ultimoLleno = calcularAforo({ entradas: contador.entradas, salidas: contador.salidas, ajuste, maximo: cfg.aforoMax }).lleno;
  let ultimaFila = { activa: false, cambio: null, cuenta: 0, abiertaDesde: null, excedeDesde: null, faltan: null };
  let ultimasPistas = [];

  function aforo() {
    return calcularAforo({ entradas: contador.entradas, salidas: contador.salidas, ajuste, maximo: cfg.aforoMax });
  }

  function cifras() {
    const a = aforo();
    return {
      entradas: contador.entradas,
      salidas: contador.salidas,
      dentro: a.dentro,
      maximo,
      aforoMax: a.maximo,
      lleno: a.lleno,
      proporcion: a.proporcion,
      enFila: zonaPx ? ultimaFila.cuenta : null,
      filaActiva: zonaPx ? ultimaFila.activa : false,
      // segundos (de escena) que lleva abierto el aviso de fila
      filaLleva: zonaPx && ultimaFila.activa && tActual !== null ? Math.max(0, (tActual - ultimaFila.abiertaDesde) / 1000) : null,
      filaFaltan: ultimaFila.faltan,
      avisosFila,
      visibles: ultimasPistas.filter((p) => p.confirmada && p.vistaAhora).length,
    };
  }

  function procesar(detecciones, t, reloj = t) {
    const eventos = [];
    const cambios = { aforo: null, fila: null };
    tActual = t;
    const { pistas, eliminadas } = seguidor.actualizar(detecciones, t);
    for (const id of eliminadas) contador.olvidar(id);
    ultimasPistas = pistas;

    for (const p of pistas) {
      if (!p.confirmada || !p.vistaAhora) continue;
      const dentroAntes = aforo().dentro;
      const ev = contador.observar(p.id, p.punto);
      if (!ev) continue;
      // Alguien sale y no lo habíamos visto entrar (ya estaba dentro al empezar): el aforo se queda en cero en vez
      // de quedar en negativo y tragarse las próximas entradas.
      if (ev === 'salida' && dentroAntes === 0) ajuste += 1;
      intervalos.registrar(ev, reloj);
      eventos.push({ tipo: ev, numero: p.numero, id: p.id, t: reloj });
    }

    const a = aforo();
    if (a.dentro > maximo) maximo = a.dentro;
    if (a.lleno !== ultimoLleno) {
      cambios.aforo = a.lleno ? 'lleno' : 'libre';
      ultimoLleno = a.lleno;
    }

    if (zonaPx) {
      const enFila = pistas.filter((p) => p.confirmada && puntoEnPoligono(p.punto, zonaPx)).length;
      ultimaFila = vigia.actualizar(enFila, t);
      if (ultimaFila.cambio) {
        cambios.fila = ultimaFila.cambio;
        if (ultimaFila.cambio === 'abre') avisosFila += 1;
      }
    }

    const dt = ultimoT === null ? 0 : Math.min(0.5, Math.max(0, (t - ultimoT) / 1000));
    ultimoT = t;
    if (dt > 0) {
      for (const p of pistas) if (p.confirmada && p.vistaAhora) calor.sumar(p.punto.x / W, p.punto.y / H, dt);
    }

    return { pistas, eventos, cambios, cifras: cifras() };
  }

  /** Cambia línea, zona o umbrales. Mover la línea olvida de qué lado estaba cada persona (los totales quedan). */
  function configurar(nueva) {
    const lineaCambio =
      JSON.stringify(nueva.linea) !== JSON.stringify(cfg.linea) || nueva.sentido !== cfg.sentido;
    cfg = nueva;
    if (lineaCambio) contador.moverLinea({ a: pix(cfg.linea.a), b: pix(cfg.linea.b), sentido: cfg.sentido });
    zonaPx = cfg.zona ? cfg.zona.map(pix) : null;
    vigia.configurar({ maxPersonas: cfg.filaMax, segundos: cfg.filaSegundos });
    if (!zonaPx) {
      vigia.reiniciar();
      ultimaFila = { activa: false, cambio: null, cuenta: 0, abiertaDesde: null, excedeDesde: null, faltan: null };
    }
    const a = aforo();
    const cambio = a.lleno !== ultimoLleno ? (a.lleno ? 'lleno' : 'libre') : null;
    ultimoLleno = a.lleno;
    return { cifras: cifras(), cambios: { aforo: cambio, fila: null } };
  }

  /** Corrige a mano las personas dentro (por ejemplo, las que ya estaban al empezar). Nunca deja el aforo bajo cero. */
  function ajustarDentro(delta) {
    const minimo = contador.salidas - contador.entradas; // ajuste con el que «dentro» da cero
    ajuste = Math.max(minimo, ajuste + delta);
    const a = aforo();
    if (a.dentro > maximo) maximo = a.dentro;
    const cambio = a.lleno !== ultimoLleno ? (a.lleno ? 'lleno' : 'libre') : null;
    ultimoLleno = a.lleno;
    return { cifras: cifras(), cambios: { aforo: cambio, fila: null } };
  }

  function reiniciarConteo(nuevaFecha = fecha) {
    contador.reiniciar();
    vigia.reiniciar();
    calor.reiniciar();
    calorGuardado = null;
    intervalos.reiniciar();
    ajuste = 0;
    maximo = 0;
    avisosFila = 0;
    fecha = nuevaFecha;
    ultimoLleno = aforo().lleno;
    ultimaFila = { activa: false, cambio: null, cuenta: 0, abiertaDesde: null, excedeDesde: null, faltan: null };
    return cifras();
  }

  /** El video volvió a empezar o se adelantó: las personas en pantalla ya no son las mismas. */
  function reiniciarPistas() {
    seguidor.reiniciar();
    contador.olvidarTodas();
    ultimasPistas = [];
    ultimoT = null;
  }

  function exportarConteo() {
    return {
      fecha,
      entradas: contador.entradas,
      salidas: contador.salidas,
      ajuste,
      maximo,
      intervalos: intervalos.serializar(),
      calor: calorGuardado && calor.total === 0 ? calorGuardado : calor.serializar(),
      avisosFila,
      bitacora: [],
    };
  }

  return {
    procesar,
    configurar,
    ajustarDentro,
    reiniciarConteo,
    reiniciarPistas,
    exportarConteo,
    cifras,
    calor,
    intervalos,
    ancho: W,
    alto: H,
    get pistas() {
      return ultimasPistas;
    },
    get config() {
      return cfg;
    },
    get fecha() {
      return fecha;
    },
    get historialFila() {
      return vigia.historial;
    },
  };
}
