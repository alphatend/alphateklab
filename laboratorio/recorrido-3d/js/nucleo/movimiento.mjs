// Caminar en primera persona: de teclas, joystick y arrastres a una posición nueva, chocando con las paredes.
// Convención: «yaw» en radianes; con yaw = 0 se mira hacia arriba del plano (−y), con yaw = −π/2 hacia la derecha (+x).
// Coincide con three.js (cámara con rotación 'YXZ', mundo x = plano x, mundo z = plano y).

import { moverConColision } from './geometria.mjs';

export const ALTURA_OJOS = 1.6;
export const RADIO_JUGADOR = 0.25;
export const VELOCIDAD = 1.4; // m/s, paso normal de una persona
export const VELOCIDAD_RAPIDA = 2.6;
export const GIRO_TECLADO = 1.9; // rad/s con las flechas
export const PITCH_MAX = (80 * Math.PI) / 180;

export const adelante = (yaw) => ({ x: -Math.sin(yaw), y: -Math.cos(yaw) });
export const derecha = (yaw) => ({ x: Math.cos(yaw), y: -Math.sin(yaw) });

/** Rumbo en grados (0 = arriba del plano, 90 = derecha, como una brújula sobre el plano) a yaw. */
export const rumboAYaw = (grados) => (-grados * Math.PI) / 180;
export const yawARumbo = (yaw) => {
  const g = (-yaw * 180) / Math.PI;
  return ((g % 360) + 360) % 360;
};

const MAPA_TECLAS = {
  KeyW: 'adelante', ArrowUp: 'adelante',
  KeyS: 'atras', ArrowDown: 'atras',
  KeyA: 'izquierda', KeyD: 'derecha',
  ArrowLeft: 'girarIzquierda', ArrowRight: 'girarDerecha',
  KeyQ: 'girarIzquierda', KeyE: 'girarDerecha',
  ShiftLeft: 'correr', ShiftRight: 'correr',
};

export const accionDeTecla = (code) => MAPA_TECLAS[code] ?? null;

/** De las acciones apretadas (Set) a una intención: avance y lateral en [-1, 1], giro en [-1, 1]. */
export function intencionDesdeAcciones(acciones) {
  const a = (k) => (acciones.has(k) ? 1 : 0);
  return {
    avance: a('adelante') - a('atras'),
    lateral: a('derecha') - a('izquierda'),
    giro: a('girarDerecha') - a('girarIzquierda'),
    correr: acciones.has('correr'),
  };
}

/** Joystick virtual: desplazamiento del pulgar (px) → intención, con zona muerta y tope en el radio. */
export function intencionDesdeJoystick(dx, dy, radio, zonaMuerta = 0.12) {
  const l = Math.hypot(dx, dy);
  if (l < 1e-6) return { avance: 0, lateral: 0, giro: 0, correr: false };
  const f = Math.min(1, l / radio);
  if (f < zonaMuerta) return { avance: 0, lateral: 0, giro: 0, correr: false };
  const escala = (f - zonaMuerta) / (1 - zonaMuerta);
  return { avance: (-dy / l) * escala, lateral: (dx / l) * escala, giro: 0, correr: false };
}

export function sumarIntenciones(a, b) {
  const lim = (v) => Math.max(-1, Math.min(1, v));
  return {
    avance: lim(a.avance + b.avance),
    lateral: lim(a.lateral + b.lateral),
    giro: lim(a.giro + b.giro),
    correr: a.correr || b.correr,
  };
}

export const intencionQuieta = (i) => !i.avance && !i.lateral && !i.giro;

/**
 * Un paso de simulación. estado = { x, y, yaw, pitch }; devuelve uno nuevo.
 * dt se limita a 0.1 s para que una pestaña que vuelve de segundo plano no dé un salto.
 */
export function paso(estado, intencion, dt, segmentos, radio = RADIO_JUGADOR) {
  const t = Math.min(Math.max(dt, 0), 0.1);
  const yaw = estado.yaw - intencion.giro * GIRO_TECLADO * t;
  let av = intencion.avance, la = intencion.lateral;
  const l = Math.hypot(av, la);
  if (l > 1) { av /= l; la /= l; }
  const v = (intencion.correr ? VELOCIDAD_RAPIDA : VELOCIDAD) * t;
  const f = adelante(yaw), r = derecha(yaw);
  const delta = { x: (f.x * av + r.x * la) * v, y: (f.y * av + r.y * la) * v };
  const p = Math.hypot(delta.x, delta.y) > 0 ? moverConColision(estado, delta, segmentos, radio) : { x: estado.x, y: estado.y };
  return { x: p.x, y: p.y, yaw, pitch: estado.pitch };
}

/** Mirar arrastrando o con el mouse bloqueado: px → radianes, con la cabeza limitada a ±80°. */
export function girarMirada(estado, dx, dy, sensibilidad) {
  const pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, estado.pitch - dy * sensibilidad));
  return { ...estado, yaw: estado.yaw - dx * sensibilidad, pitch };
}

/**
 * Campo de visión vertical para que el horizontal quede cerca de «horizontal» grados en cualquier pantalla
 * (en un teléfono vertical, un fov vertical fijo deja ver un pasillo de 40°).
 */
export function fovVertical(aspecto, horizontal = 80, min = 50, max = 95) {
  const h = (horizontal * Math.PI) / 180;
  const v = (2 * Math.atan(Math.tan(h / 2) / aspecto) * 180) / Math.PI;
  return Math.max(min, Math.min(max, v));
}

/** Ángulo (grados, sentido horario en pantalla) para dibujar la flecha del jugador en el minimapa. */
export const anguloFlechaMinimapa = (yaw) => (-yaw * 180) / Math.PI;

/** Interpolación con la curva «mover» de la guía: cubic-bezier(0.65, 0, 0.35, 1) aproximada. */
export function suavizarMover(t) {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Diferencia angular más corta de a hacia b (radianes). */
export function diferenciaAngulo(a, b) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
