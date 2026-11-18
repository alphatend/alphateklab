// Reglas de aviso y su evaluador.
//
// Una regla avisa cuando la condición se cumple SIN INTERRUPCIÓN durante al menos `minutos`
// (un pico de un minuto no avisa). El aviso se cierra cuando la lectura lleva `CIERRE_MIN` minutos
// seguidos dentro del rango; si vuelve a salirse antes, el mismo aviso sigue abierto (así no llegan
// diez mensajes por una nevera que ronda el límite).
//
// Tipos:
// - rango:     sensor numérico fuera de [min, max] (cualquiera de los dos puede faltar)
// - estado:    sensor de estado activo (puerta abierta, bomba encendida)
// - corriente: la potencia total del local por debajo de UMBRAL_SIN_CORRIENTE_KW

import { sensor, UMBRAL_SIN_CORRIENTE_KW } from './sensores.mjs';
import { fmtNumero } from './formato.mjs';

export const CIERRE_MIN = 5;
export const MINUTOS_MAX = 1440;
const MUESTRA_S = 60; // los sensores reportan una vez por minuto

export const REGLAS_POR_DEFECTO = [
  { id: 'r1', sensor: 'nevera', tipo: 'rango', min: 0, max: 5, minutos: 15, activa: true },
  { id: 'r2', sensor: 'cuarto', tipo: 'rango', min: 0, max: 5, minutos: 20, activa: true },
  { id: 'r3', sensor: 'congelador', tipo: 'rango', min: null, max: -15, minutos: 30, activa: true },
  { id: 'r4', sensor: 'puertaNevera', tipo: 'estado', minutos: 3, activa: true },
  { id: 'r5', sensor: 'puertaCuarto', tipo: 'estado', minutos: 5, activa: true },
  { id: 'r6', sensor: 'vibracion', tipo: 'rango', min: null, max: 4.5, minutos: 10, activa: true },
  { id: 'r7', sensor: 'corriente', tipo: 'corriente', minutos: 5, activa: true },
  { id: 'r8', sensor: 'tanque', tipo: 'rango', min: 25, max: null, minutos: 10, activa: true },
  { id: 'r9', sensor: 'bomba', tipo: 'estado', minutos: 60, activa: true },
  { id: 'r10', sensor: 'humedad', tipo: 'rango', min: null, max: 70, minutos: 60, activa: true },
];

export function tipoParaSensor(idSensor) {
  const s = sensor(idSensor);
  if (!s) return null;
  if (s.tipo === 'numero') return 'rango';
  if (s.tipo === 'estado') return 'estado';
  if (s.tipo === 'corriente') return 'corriente';
  return null;
}

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

// Devuelve la lista de errores (texto para mostrar junto al campo). Vacía = válida.
// `campos` dice qué campos marcar como inválidos cuando el error es de más de uno.
export function validarRegla(r) {
  const errores = [];
  const s = r && sensor(r.sensor);
  if (!s) return [{ campo: 'sensor', texto: 'Elige un sensor de la lista.' }];
  const tipo = tipoParaSensor(r.sensor);
  if (r.tipo !== tipo) errores.push({ campo: 'tipo', texto: 'El tipo de regla no corresponde a ese sensor.' });
  if (!Number.isInteger(r.minutos) || r.minutos < 1 || r.minutos > MINUTOS_MAX) {
    errores.push({ campo: 'minutos', texto: `Escribe un número entero de minutos entre 1 y ${MINUTOS_MAX}.` });
  }
  if (tipo === 'rango') {
    const tieneMin = r.min !== null && r.min !== undefined;
    const tieneMax = r.max !== null && r.max !== undefined;
    const [bajo, alto] = s.limites || [-Infinity, Infinity];
    const fueraDeEscala = (v) => esNumero(v) && (v < bajo || v > alto);
    const escala = `entre ${fmtNumero(bajo, 0)} y ${fmtNumero(alto, 0)}\u00a0${s.unidad}`;
    if (tieneMin && !esNumero(r.min)) errores.push({ campo: 'min', texto: 'Escribe el mínimo solo con números (usa punto para los decimales).' });
    if (tieneMax && !esNumero(r.max)) errores.push({ campo: 'max', texto: 'Escribe el máximo solo con números (usa punto para los decimales).' });
    if (fueraDeEscala(r.min)) errores.push({ campo: 'min', texto: `El mínimo tiene que estar ${escala}, lo que mide este sensor.` });
    if (fueraDeEscala(r.max)) errores.push({ campo: 'max', texto: `El máximo tiene que estar ${escala}, lo que mide este sensor.` });
    if (!tieneMin && !tieneMax) errores.push({ campo: 'max', campos: ['min', 'max'], texto: 'Pon al menos un límite: mínimo, máximo o los dos.' });
    if (esNumero(r.min) && esNumero(r.max) && r.min >= r.max) {
      errores.push({ campo: 'min', campos: ['min', 'max'], texto: 'El mínimo tiene que ser menor que el máximo.' });
    }
  }
  return errores;
}

// ¿Este error marca el campo `nombre`?
export function errorDeCampo(error, nombre) {
  return error.campo === nombre || (Array.isArray(error.campos) && error.campos.includes(nombre));
}

// ¿La lectura incumple la regla? null si la muestra no trae el dato.
export function incumple(regla, muestra) {
  if (regla.tipo === 'corriente') {
    const total = muestra.aire + muestra.cocina + muestra.refri;
    return esNumero(total) ? total < UMBRAL_SIN_CORRIENTE_KW : null;
  }
  const v = muestra[regla.sensor];
  if (regla.tipo === 'estado') return v === 1 || v === true;
  if (!esNumero(v)) return null;
  if (esNumero(regla.min) && v < regla.min) return true;
  if (esNumero(regla.max) && v > regla.max) return true;
  return false;
}

// Valor que se informa en el aviso (y el extremo que se guarda en la bitácora).
export function valorDe(regla, muestra) {
  if (regla.tipo === 'corriente') return muestra.aire + muestra.cocina + muestra.refri;
  return muestra[regla.sensor];
}

// Hacia qué lado se salió (para saber si el extremo es el máximo o el mínimo).
function lado(regla, v) {
  if (regla.tipo !== 'rango' || !esNumero(v)) return null;
  if (esNumero(regla.min) && v < regla.min) return 'bajo';
  if (esNumero(regla.max) && v > regla.max) return 'alto';
  return null;
}

// La identidad de una regla para el evaluador: si un id pasa a otro sensor u otro tipo, es otra regla.
const firma = (regla) => `${regla.sensor}|${regla.tipo}`;

export function crearEvaluador({ cierreMin = CIERRE_MIN, alertas = [], siguienteId = 1 } = {}) {
  const estado = new Map(); // id de regla → { firma, fueraDesde, dentroDesde, alerta }
  let proximo = siguienteId;
  const todas = alertas; // bitácora, la más vieja primero

  function cerrar(e, fin, cerradaEn, motivo, eventos) {
    e.alerta.fin = fin;
    e.alerta.cerradaEn = cerradaEn;
    e.alerta.motivo = motivo;
    eventos.push({ tipo: 'cierra', alerta: e.alerta });
    e.alerta = null;
    e.dentroDesde = null;
  }

  function estadoDe(regla, t, eventos) {
    const e = estado.get(regla.id);
    if (e && e.firma === firma(regla)) return e;
    // Un id que ahora es otra regla no hereda nada de la anterior: su aviso se cierra como «regla quitada».
    if (e && e.alerta) cerrar(e, t, t, 'regla', eventos);
    const nuevo = { firma: firma(regla), fueraDesde: null, dentroDesde: null, alerta: null };
    estado.set(regla.id, nuevo);
    return nuevo;
  }

  // Evalúa una muestra con las reglas vigentes. Devuelve los eventos { tipo: 'abre'|'cierra', alerta }.
  // `tramos` (opcional): el último intervalo { inicio, fin } de cada sensor de estado (y del corte de corriente),
  // con la hora exacta en que se abrió o se cerró la puerta (o se fue la luz) entre una muestra y la siguiente. Así el aviso
  // dice «abierta desde las 10:30» y no la hora de la primera muestra que la vio abierta.
  function evaluar(muestra, reglas, tramos = {}) {
    const t = muestra.t;
    const eventos = [];
    const vigentes = new Set();
    for (const regla of reglas) {
      if (!regla.activa) continue;
      vigentes.add(regla.id);
      const e = estadoDe(regla, t, eventos);
      const fuera = incumple(regla, muestra);
      if (fuera === null) continue;
      const v = valorDe(regla, muestra);
      const tramo = regla.tipo === 'estado' || regla.tipo === 'corriente' ? tramos[regla.sensor] : null;
      if (fuera) {
        e.dentroDesde = null;
        if (e.fueraDesde === null) {
          e.fueraDesde = tramo && tramo.fin === null && tramo.inicio <= t && tramo.inicio > t - 2 * MUESTRA_S ? tramo.inicio : t;
        }
        if (e.alerta) {
          const l = lado(regla, v);
          if (l === 'alto' && v > e.alerta.extremo) e.alerta.extremo = v;
          if (l === 'bajo' && v < e.alerta.extremo) e.alerta.extremo = v;
        } else if (t - e.fueraDesde >= regla.minutos * 60) {
          e.alerta = {
            id: proximo++,
            reglaId: regla.id,
            sensor: regla.sensor,
            regla: { ...regla },
            inicio: e.fueraDesde,
            aviso: t,
            fin: null,
            cerradaEn: null,
            motivo: null,
            valorAviso: v,
            extremo: v,
            lado: lado(regla, v),
          };
          todas.push(e.alerta);
          eventos.push({ tipo: 'abre', alerta: e.alerta });
        }
      } else {
        e.fueraDesde = null;
        if (e.alerta) {
          if (e.dentroDesde === null) {
            e.dentroDesde = tramo && tramo.fin !== null && tramo.fin <= t && tramo.fin > Math.max(e.alerta.inicio, t - 2 * MUESTRA_S) ? tramo.fin : t;
          }
          if (t - e.dentroDesde >= cierreMin * 60) cerrar(e, e.dentroDesde, t, 'volvio', eventos);
        }
      }
    }
    // Reglas quitadas o apagadas: su aviso abierto se cierra en este momento.
    for (const [id, e] of estado) {
      if (vigentes.has(id)) continue;
      if (e.alerta) cerrar(e, t, t, 'regla', eventos);
      estado.delete(id);
    }
    return eventos;
  }

  // Cómo va cada regla, para mostrarlo junto a ella.
  function situacion(regla, t) {
    if (!regla.activa) return { estado: 'apagada' };
    const e = estado.get(regla.id);
    if (!e) return { estado: 'normal' };
    if (e.alerta && e.dentroDesde !== null) {
      return { estado: 'cerrando', desde: e.dentroDesde, cierraEn: e.dentroDesde + cierreMin * 60, alerta: e.alerta };
    }
    if (e.alerta) return { estado: 'activa', desde: e.alerta.aviso, alerta: e.alerta };
    if (e.fueraDesde !== null) {
      return { estado: 'contando', desde: e.fueraDesde, avisaEn: e.fueraDesde + regla.minutos * 60, transcurrido: t - e.fueraDesde };
    }
    return { estado: 'normal' };
  }

  return {
    evaluar,
    situacion,
    alertas: todas,
    activas() {
      return todas.filter((a) => a.fin === null);
    },
  };
}

// Siguiente id para una regla nueva («r11», «r12»…), sin azar: el registro se puede repetir igual.
// Nunca reutiliza un id que ya existió (`usados`: los ids del registro de acciones y de la bitácora), para
// que una regla nueva no herede el aviso ni el «Resuelto» de una regla quitada.
export function nuevoIdRegla(reglas, usados = []) {
  let n = 0;
  for (const id of [...reglas.map((r) => r.id), ...usados]) {
    const m = /^r(\d+)$/.exec(id);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return `r${n + 1}`;
}

// La banda del rango aceptable de un sensor: la de su primera regla de rango activa.
export function bandaDe(idSensor, reglas) {
  const r = reglas.find((x) => x.activa && x.tipo === 'rango' && x.sensor === idSensor);
  if (!r) return null;
  return { min: esNumero(r.min) ? r.min : null, max: esNumero(r.max) ? r.max : null, minutos: r.minutos, id: r.id };
}

// Cómo estaba un sensor en el momento t, para la cabecera de su gráfico:
// 'aviso' (había un aviso enviado), 'fuera' (fuera de rango, todavía sin aviso), 'ok' o 'neutro' (sin regla).
export function estadoEn(idSensor, t, valor, alertas, reglas) {
  for (let i = alertas.length - 1; i >= 0; i--) {
    const a = alertas[i];
    if (a.sensor !== idSensor) continue;
    if (a.inicio <= t && (a.fin === null || t < a.fin)) {
      return t >= a.aviso ? { tipo: 'aviso', texto: 'aviso' } : { tipo: 'fuera', texto: 'fuera de rango' };
    }
  }
  const regla = reglas.find((r) => r.activa && r.sensor === idSensor);
  if (!regla) return { tipo: 'neutro', texto: 'sin regla' };
  const m = { [idSensor]: valor, aire: valor, cocina: 0, refri: 0 };
  return incumple(regla, m) ? { tipo: 'fuera', texto: 'fuera de rango' } : { tipo: 'ok', texto: regla.tipo === 'estado' ? 'normal' : 'en rango' };
}
