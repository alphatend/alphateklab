// Textos de las reglas y de los avisos tal como le llegarían al dueño por WhatsApp
// (los asteriscos son la negrita de WhatsApp).

import { CAPACIDAD_TANQUE_L, NEGOCIO, sensor } from './sensores.mjs';
import { fmtDesde, fmtDuracion, fmtHora, fmtLimite, fmtNumero, fmtValor } from './formato.mjs';

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

function conUnidad(idSensor, v) {
  return fmtValor(idSensor, v);
}

// «fuera de 0 a 5 °C», «por encima de −15 °C», «por debajo de 25 %», «abierta», «sin corriente»
export function condicion(regla) {
  const s = sensor(regla.sensor);
  if (!s) return '';
  if (regla.tipo === 'estado') return s.activo;
  if (regla.tipo === 'corriente') return 'sin corriente';
  const tieneMin = esNumero(regla.min);
  const tieneMax = esNumero(regla.max);
  if (tieneMin && tieneMax) {
    const dec = Number.isInteger(regla.min) ? 0 : s.decimales;
    return `fuera de ${fmtNumero(regla.min, dec)} a ${fmtLimite(regla.sensor, regla.max)}`;
  }
  if (tieneMax) return `por encima de ${fmtLimite(regla.sensor, regla.max)}`;
  if (tieneMin) return `por debajo de ${fmtLimite(regla.sensor, regla.min)}`;
  return '';
}

// «Nevera de la cocina fuera de 0 a 5 °C por más de 15 min»
export function describirRegla(regla) {
  const s = sensor(regla.sensor);
  if (!s) return 'Regla sin sensor';
  const dur = `por más de ${regla.minutos}\u00a0min`;
  if (regla.tipo === 'corriente') return `Local sin corriente ${dur}`;
  return `${s.nombre} ${condicion(regla)} ${dur}`;
}

// Qué revisar, según el sensor y lo que pasa en el resto del local en ese minuto (contexto: { sinCorriente,
// vibracionAlta }), para no pedir «que la compresora encienda» durante un corte de luz.
export function queRevisar(alerta, contexto = {}) {
  const { sensor: id, lado } = alerta;
  const frio = id === 'nevera' || id === 'cuarto' || id === 'congelador';
  if (frio && lado !== 'bajo' && contexto.sinCorriente) {
    return 'Es por el corte de luz: no abras los equipos de frío hasta que vuelva la corriente.';
  }
  if (id === 'nevera' && lado !== 'bajo' && contexto.vibracionAlta) {
    return 'La compresora vibra de más (V1) y la nevera no enfría: llama al técnico de refrigeración y pasa lo delicado a otro equipo de frío.';
  }
  if (id === 'nevera' || id === 'cuarto') {
    return lado === 'bajo'
      ? 'Qué revisar: que el termostato no esté demasiado bajo; la comida se puede congelar.'
      : 'Qué revisar: que la puerta cierre bien y que la compresora encienda.';
  }
  if (id === 'congelador') return 'Qué revisar: que la puerta cierre bien y que el congelador no tenga hielo acumulado.';
  if (id === 'puertaNevera' || id === 'puertaCuarto') return 'Ciérrala o revisa que no quedó trabada.';
  if (id === 'vibracion') return 'Llama al técnico de refrigeración: la compresora vibra más de lo normal.';
  if (id === 'corriente') return 'Mantén cerradas la nevera, el congelador y el cuarto frío hasta que vuelva.';
  if (id === 'tanque') return 'Revisa la bomba y busca fugas.';
  if (id === 'bomba') return 'Puede haber una fuga, o la bomba no está subiendo agua.';
  if (id === 'humedad') return 'Revisa que no entre agua y que la bodega esté ventilada.';
  return '';
}

export function textoAviso(alerta, baseISO, contexto = {}) {
  const s = sensor(alerta.sensor);
  const r = alerta.regla;
  const desde = fmtDesde(alerta.inicio, alerta.aviso, baseISO);
  const lleva = fmtDuracion(alerta.aviso - alerta.inicio);
  let cuerpo;
  if (r.tipo === 'corriente') {
    cuerpo = `El local está sin corriente desde ${desde}.`;
  } else if (r.tipo === 'estado') {
    cuerpo = `${s.nombre}: lleva ${lleva} ${s.activo} (desde ${desde}).`;
  } else {
    const v = conUnidad(alerta.sensor, alerta.valorAviso);
    const limite = alerta.lado === 'bajo' ? `por debajo de ${fmtLimite(alerta.sensor, r.min)}` : `por encima de ${fmtLimite(alerta.sensor, r.max)}`;
    let extra = '';
    if (alerta.sensor === 'tanque') extra = ` (unos ${fmtNumero(Math.round((alerta.valorAviso / 100) * CAPACIDAD_TANQUE_L / 10) * 10, 0)}\u00a0litros)`;
    cuerpo = `${s.nombre}: ${v}${extra}. Está ${limite} desde ${desde} (${lleva}).`;
  }
  const lineas = [`*Aviso en ${NEGOCIO}*`, cuerpo];
  const revisar = queRevisar(alerta, contexto);
  if (revisar) lineas.push(revisar);
  return lineas.join('\n');
}

export function textoResuelto(alerta, baseISO) {
  const s = sensor(alerta.sensor);
  const r = alerta.regla;
  const duro = fmtDuracion(alerta.fin - alerta.inicio);
  if (alerta.motivo === 'regla') {
    // No es un «Resuelto»: el problema puede seguir. El encabezado (lo que se ve en la notificación) lo dice.
    return [
      `*Aviso cerrado sin resolver en ${NEGOCIO}*`,
      `Se apagó o se quitó la regla «${describirRegla(r)}» a las ${fmtHora(alerta.fin)}. Este aviso ya no se sigue, pero eso no quiere decir que se resolvió: mira ${s.etiqueta} ${s.nombre} en el tablero.`,
    ].join('\n');
  }
  let cuerpo;
  if (r.tipo === 'corriente') {
    cuerpo = `Volvió la corriente a las ${fmtHora(alerta.fin)}. El local estuvo ${duro} sin corriente.`;
  } else if (r.tipo === 'estado') {
    const fin = s.id === 'bomba' ? 'se apagó' : 'se cerró';
    cuerpo = `${s.nombre} ${fin} a las ${fmtHora(alerta.fin)}. Estuvo ${s.activo} ${duro}.`;
  } else {
    const extremo = alerta.lado === 'bajo' ? 'bajó hasta' : 'llegó a';
    cuerpo = `${s.nombre} volvió al rango a las ${fmtHora(alerta.fin)}. Estuvo fuera ${duro} y ${extremo} ${conUnidad(alerta.sensor, alerta.extremo)}.`;
  }
  return [`*Resuelto en ${NEGOCIO}*`, cuerpo].join('\n');
}

// Para pintar la negrita de WhatsApp sin innerHTML: [{ texto, negrita }]
export function trozosWhatsApp(linea) {
  const trozos = [];
  const re = /\*([^*\n]+)\*/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(linea))) {
    if (m.index > ultimo) trozos.push({ texto: linea.slice(ultimo, m.index), negrita: false });
    trozos.push({ texto: m[1], negrita: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linea.length) trozos.push({ texto: linea.slice(ultimo), negrita: false });
  return trozos;
}
