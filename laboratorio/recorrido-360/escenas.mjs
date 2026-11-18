// Recorrido 360 de ejemplo: cuatro fotos esféricas de licencia libre (CC0, Poly Haven), de lugares distintos,
// unidas como si fueran un mismo apartamento. Ángulos en grados: yaw (horizontal, -180..180) y pitch (vertical).
// En el servicio real cada escena es una foto de la Insta360 X5 en la propiedad del cliente.

export const PRIMERA = 'sala';

export const ESCENAS = {
  sala: {
    nombre: 'Sala y cocina',
    foto: 'fotos/small_empty_house.jpg',
    autor: 'Greg Zaal',
    fuente: 'https://polyhaven.com/a/small_empty_house',
    vista: { yaw: 10, pitch: -4 },
    puntos: [
      { tipo: 'ir', a: 'recamara1', yaw: -105, pitch: -8 },
      { tipo: 'ir', a: 'recamara2', yaw: 124, pitch: -8 },
      { tipo: 'ir', a: 'bano', yaw: 148, pitch: -8 },
      { tipo: 'info', yaw: -160, pitch: -8, texto: 'Cocina abierta a la sala, con gabinetes altos y bajos y ventana sobre el fregador.' },
      { tipo: 'info', yaw: 9, pitch: -6, texto: 'Puerta principal con vista a la calle.' },
      { tipo: 'info', yaw: 13, pitch: 38, texto: 'Abanico de techo con luz.' },
      { tipo: 'info', yaw: 65, pitch: 2, texto: 'Ventana con rejas hacia el frente.' },
    ],
  },
  recamara1: {
    nombre: 'Recámara 1',
    foto: 'fotos/small_empty_room_1.jpg',
    autor: 'Sergej Majboroda',
    fuente: 'https://polyhaven.com/a/small_empty_room_1',
    vista: { yaw: 20, pitch: -2 },
    puntos: [
      { tipo: 'ir', a: 'sala', yaw: -160, pitch: -8 },
      { tipo: 'info', yaw: -14, pitch: 24, texto: 'Aire acondicionado split instalado.' },
      { tipo: 'info', yaw: 37, pitch: -4, texto: 'Puerta de vidrio al balcón.' },
    ],
  },
  recamara2: {
    nombre: 'Recámara 2',
    foto: 'fotos/small_empty_room_4.jpg',
    autor: 'Sergej Majboroda',
    fuente: 'https://polyhaven.com/a/small_empty_room_4',
    vista: { yaw: 38, pitch: -2 },
    puntos: [
      { tipo: 'ir', a: 'sala', yaw: -122, pitch: -8 },
      { tipo: 'info', yaw: 88, pitch: 24, texto: 'Aire acondicionado split instalado.' },
      { tipo: 'info', yaw: 38, pitch: -4, texto: 'Puerta de vidrio al balcón.' },
    ],
  },
  bano: {
    nombre: 'Baño',
    foto: 'fotos/modern_bathroom.jpg',
    autor: 'Adrian Kubasa',
    fuente: 'https://polyhaven.com/a/modern_bathroom',
    vista: { yaw: -20, pitch: -10 },
    puntos: [
      { tipo: 'ir', a: 'sala', yaw: 121, pitch: -8 },
      { tipo: 'info', yaw: -140, pitch: -18, texto: 'Ducha con mampara de vidrio.' },
      { tipo: 'info', yaw: -8, pitch: -24, texto: 'Tina.' },
      { tipo: 'info', yaw: 15, pitch: 16, texto: 'Tragaluz.' },
    ],
  },
};

// Convierte las escenas al formato de configuración de Pannellum (multiescena).
export function configuracionPannellum(escenas = ESCENAS, primera = PRIMERA) {
  const scenes = {};
  for (const [id, e] of Object.entries(escenas)) {
    scenes[id] = {
      title: e.nombre,
      type: 'equirectangular',
      panorama: e.foto,
      yaw: e.vista.yaw,
      pitch: e.vista.pitch,
      hfov: 100,
      hotSpots: e.puntos.map((p) =>
        p.tipo === 'ir'
          ? { type: 'scene', sceneId: p.a, yaw: p.yaw, pitch: p.pitch, text: `Ir a ${escenas[p.a].nombre.toLowerCase()}` }
          : { type: 'info', yaw: p.yaw, pitch: p.pitch, text: p.texto },
      ),
    };
  }
  return { default: { firstScene: primera, sceneFadeDuration: 400 }, scenes };
}

// Comprobaciones del recorrido: enlaces a escenas que existen, ángulos válidos y todas las escenas alcanzables.
export function validarRecorrido(escenas = ESCENAS, primera = PRIMERA) {
  const errores = [];
  if (!escenas[primera]) errores.push(`la primera escena «${primera}» no existe`);
  for (const [id, e] of Object.entries(escenas)) {
    if (!e.nombre || !e.foto || !e.autor || !e.fuente) errores.push(`${id}: faltan nombre, foto, autor o fuente`);
    for (const p of e.puntos) {
      if (p.yaw < -180 || p.yaw > 180 || p.pitch < -90 || p.pitch > 90) errores.push(`${id}: ángulo fuera de rango`);
      if (p.tipo === 'ir' && !escenas[p.a]) errores.push(`${id}: enlaza a «${p.a}», que no existe`);
      if (p.tipo === 'ir' && p.a === id) errores.push(`${id}: se enlaza a sí misma`);
      if (p.tipo === 'info' && !p.texto) errores.push(`${id}: punto de información sin texto`);
    }
  }
  const vistas = new Set([primera]);
  const cola = [primera];
  while (cola.length) {
    const e = escenas[cola.shift()];
    for (const p of e?.puntos || []) if (p.tipo === 'ir' && escenas[p.a] && !vistas.has(p.a)) { vistas.add(p.a); cola.push(p.a); }
  }
  for (const id of Object.keys(escenas)) if (!vistas.has(id)) errores.push(`${id}: no se puede llegar desde ${primera}`);
  // cada escena debe poder volver a la primera
  for (const id of Object.keys(escenas)) {
    if (id === primera) continue;
    const ok = new Set([id]); const q = [id]; let llega = false;
    while (q.length && !llega) { for (const p of escenas[q.shift()].puntos) if (p.tipo === 'ir') { if (p.a === primera) llega = true; if (!ok.has(p.a) && escenas[p.a]) { ok.add(p.a); q.push(p.a); } } }
    if (!llega) errores.push(`${id}: no tiene salida hacia ${primera}`);
  }
  return errores;
}
