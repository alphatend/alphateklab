// El motor de la demo: simulador + reglas + registro de acciones + mensajes.
//
// Todo lo que hace el visitante (provocar o reparar una falla, cambiar las reglas) queda en el registro
// de acciones con el momento de la simulación en que pasó. Con la semilla y ese registro se vuelve a
// obtener exactamente lo mismo: así se guarda la demo entre visitas sin guardar los datos.

import { DIA, DURACION_CORTE, PASO, SEMILLA, crearSimulador } from './simulador.mjs';
import { REGLAS_POR_DEFECTO, crearEvaluador, incumple } from './reglas.mjs';
import { textoAviso, textoResuelto } from './mensajes.mjs';

export const T_INICIO = DIA + 10.5 * 3600; // día 1 a las 10:30, media hora antes de abrir
export const T_LIMITE = 8 * DIA - 60; // la demo cubre hasta el final del día 7 (23:59)

const copiar = (x) => JSON.parse(JSON.stringify(x));

export function crearMotor({ semilla = SEMILLA, acciones = [], hasta = T_INICIO, baseISO = '2026-10-03', reglasIniciales = REGLAS_POR_DEFECTO } = {}) {
  const sim = crearSimulador({ semilla });
  let reglas = copiar(reglasIniciales);
  const evaluador = crearEvaluador();
  const registro = [];
  const mensajes = [];
  const pendientes = acciones
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.t - y.a.t || x.i - y.i)
    .map((x) => x.a);

  function aplicar(accion) {
    if (accion.tipo === 'falla') sim.ponerFalla(accion.falla, accion.activa);
    else if (accion.tipo === 'reglas') reglas = copiar(accion.reglas);
    else throw new Error(`Acción desconocida: ${accion.tipo}`);
    registro.push(copiar(accion));
  }

  // Lo que el aviso necesita saber del resto del local para no dar un consejo que contradiga la causa:
  // si en ese minuto no hay corriente, o si la compresora de la nevera vibra fuera de su regla.
  function contextoDe(muestra) {
    const vibra = reglas.find((r) => r.activa && r.sensor === 'vibracion' && r.tipo === 'rango');
    return {
      sinCorriente: incumple({ tipo: 'corriente' }, muestra) === true,
      vibracionAlta: vibra ? incumple(vibra, muestra) === true : false,
    };
  }

  function mensajeDe(evento, muestra) {
    const a = evento.alerta;
    if (evento.tipo === 'abre') {
      return { id: `${a.id}-aviso`, t: a.aviso, tipo: 'aviso', alertaId: a.id, sensor: a.sensor, texto: textoAviso(a, baseISO, contextoDe(muestra)) };
    }
    return { id: `${a.id}-resuelto`, t: a.cerradaEn, tipo: 'resuelto', alertaId: a.id, sensor: a.sensor, texto: textoResuelto(a, baseISO) };
  }

  // Un paso de física; devuelve { muestra, eventos, mensajes } (muestra null si no tocaba reportar).
  function paso() {
    while (pendientes.length && pendientes[0].t <= sim.t) aplicar(pendientes.shift());
    const muestra = sim.paso();
    if (!muestra) return null;
    const tramos = {};
    for (const [id, lista] of Object.entries(sim.intervalos)) tramos[id] = lista[lista.length - 1] || null;
    tramos.corriente = sim.cortes[sim.cortes.length - 1] || null;
    const eventos = evaluador.evaluar(muestra, reglas, tramos);
    const nuevos = eventos.map((e) => mensajeDe(e, muestra));
    mensajes.push(...nuevos);
    if (mensajes.length > 400) mensajes.splice(0, mensajes.length - 400);
    return { muestra, eventos, mensajes: nuevos };
  }

  function avanzarHasta(objetivo) {
    const salida = { muestras: 0, eventos: [], mensajes: [] };
    const fin = Math.min(objetivo, T_LIMITE);
    while (sim.t + PASO <= fin) {
      const r = paso();
      if (r) {
        salida.muestras++;
        salida.eventos.push(...r.eventos);
        salida.mensajes.push(...r.mensajes);
      }
    }
    while (pendientes.length && pendientes[0].t <= sim.t) aplicar(pendientes.shift());
    return salida;
  }

  // Acción del visitante en el momento actual de la simulación.
  function accion(a) {
    const conMomento = { ...copiar(a), t: sim.t };
    aplicar(conMomento);
    return conMomento;
  }

  avanzarHasta(hasta);

  return {
    get t() {
      return sim.t;
    },
    get reglas() {
      return reglas;
    },
    get terminado() {
      return sim.t + PASO > T_LIMITE;
    },
    semilla,
    baseISO,
    sim,
    muestras: sim.muestras,
    intervalos: sim.intervalos,
    alertas: evaluador.alertas,
    mensajes,
    activas: () => evaluador.activas(),
    situacion: (regla) => evaluador.situacion(regla, sim.t),
    fallas: () => sim.fallas(),
    avanzarHasta,
    accion,
    cambiarReglas(nuevas) {
      return accion({ tipo: 'reglas', reglas: nuevas });
    },
    ponerFalla(falla, activa) {
      return accion({ tipo: 'falla', falla, activa });
    },
    registro,
    // Todos los ids de regla que ya existieron (registro de acciones y bitácora), para no reutilizarlos.
    idsUsados() {
      const ids = new Set(REGLAS_POR_DEFECTO.map((r) => r.id));
      for (const r of reglasIniciales) ids.add(r.id);
      for (const a of registro) if (a.tipo === 'reglas') for (const r of a.reglas) ids.add(r.id);
      for (const a of evaluador.alertas) ids.add(a.reglaId);
      return [...ids];
    },
    exportar() {
      return { semilla, acciones: copiar(registro), t: sim.t };
    },
  };
}

// Los tramos de cada falla provocada, para dibujarlos en el tiempo: { falla, inicio, fin } (fin null si sigue).
// El corte de corriente termina solo a las 2 h, o antes si se devolvió la corriente.
export function periodosDeFallas(registro, ahora) {
  const abiertos = new Map();
  const periodos = [];
  const cerrar = (falla, fin) => {
    const p = abiertos.get(falla);
    if (!p) return;
    p.fin = falla === 'corte' ? Math.min(fin, p.inicio + DURACION_CORTE) : fin;
    abiertos.delete(falla);
  };
  for (const a of registro) {
    if (a.tipo !== 'falla') continue;
    const corte = abiertos.get('corte');
    if (corte && corte.inicio + DURACION_CORTE <= a.t) cerrar('corte', a.t);
    if (a.activa) {
      if (abiertos.has(a.falla) && a.falla !== 'corte') continue;
      if (abiertos.has(a.falla)) cerrar(a.falla, a.t);
      const p = { falla: a.falla, inicio: a.t, fin: null };
      periodos.push(p);
      abiertos.set(a.falla, p);
    } else {
      cerrar(a.falla, a.t);
    }
  }
  for (const p of abiertos.values()) {
    if (p.falla === 'corte' && p.inicio + DURACION_CORTE <= ahora) p.fin = p.inicio + DURACION_CORTE;
  }
  return periodos;
}
