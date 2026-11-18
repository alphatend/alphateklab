// Escribe plano.json: el apartamento de ejemplo (ficticio) de 3 recámaras y 2 baños.
// Los ambientes y las aberturas se escriben a mano aquí; las paredes se derivan de los bordes de los ambientes
// con la misma función que usa el editor, para que el JSON publicado y el código nunca se contradigan.
// Uso: node herramientas/escribir-plano-ejemplo.mjs

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMATO, VERSION_PLANO, ALTO_PARED, paredesDesdeAmbientes, validarPlano } from '../js/nucleo/plano.mjs';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// x hacia la derecha, y hacia abajo del plano, en metros (a eje de pared).
export const ambientes = [
  { id: 'recamara-principal', nombre: 'Recámara principal', tipo: 'recamara', poligono: rect(0, 0, 3.8, 3.4) },
  { id: 'bano-principal', nombre: 'Baño principal', tipo: 'bano', poligono: rect(3.8, 0, 5.4, 2.2), etiqueta: [4.7, 0.8] },
  { id: 'recamara-2', nombre: 'Recámara 2', tipo: 'recamara', poligono: rect(5.4, 0, 8.2, 3.4) },
  { id: 'recamara-3', nombre: 'Recámara 3', tipo: 'recamara', poligono: rect(8.2, 0, 11, 3.4) },
  {
    id: 'pasillo', nombre: 'Pasillo', tipo: 'pasillo',
    poligono: [[3.8, 2.2], [5.4, 2.2], [5.4, 3.4], [9.4, 3.4], [9.4, 4.4], [3.8, 4.4]],
  },
  {
    id: 'sala-comedor', nombre: 'Sala-comedor', tipo: 'sala',
    poligono: [[0, 3.4], [3.8, 3.4], [3.8, 4.4], [6.6, 4.4], [6.6, 8], [0, 8]],
  },
  { id: 'cocina', nombre: 'Cocina', tipo: 'cocina', poligono: rect(6.6, 4.4, 9.4, 8) },
  { id: 'bano-2', nombre: 'Baño 2', tipo: 'bano', poligono: rect(9.4, 3.4, 11, 5.6) },
  { id: 'lavanderia', nombre: 'Lavandería', tipo: 'lavanderia', poligono: rect(9.4, 5.6, 11, 8), etiqueta: [10.2, 6.3] },
  { id: 'balcon', nombre: 'Balcón', tipo: 'balcon', poligono: rect(0.6, 8, 5, 9.6) },
];

export const aberturas = [
  // Puertas y vanos
  { tipo: 'puerta-cerrada', x: 0, y: 4.05, ancho: 0.9 }, // entrada del apartamento
  { tipo: 'vano', x: 3.8, y: 3.9, ancho: 1.0 }, // de la sala al pasillo
  { tipo: 'puerta', x: 3.8, y: 2.8, ancho: 0.8, bisagra: 'b' }, // recámara principal
  { tipo: 'puerta', x: 3.8, y: 1.75, ancho: 0.7, bisagra: 'b' }, // baño principal, desde la recámara
  { tipo: 'puerta', x: 6.4, y: 3.4, ancho: 0.8 }, // recámara 2
  { tipo: 'puerta', x: 8.8, y: 3.4, ancho: 0.8 }, // recámara 3
  { tipo: 'puerta', x: 9.4, y: 3.9, ancho: 0.7 }, // baño 2
  { tipo: 'vano', x: 6.6, y: 6.2, ancho: 1.8 }, // cocina abierta a la sala-comedor
  { tipo: 'puerta', x: 9.4, y: 7.4, ancho: 0.8, bisagra: 'b' }, // lavandería, desde la cocina
  { tipo: 'corrediza', x: 2.4, y: 8, ancho: 2.4 }, // al balcón
  // Ventanas
  { tipo: 'ventana', x: 1.9, y: 0, ancho: 1.6, antepecho: 0.9, dintel: 2.2 },
  { tipo: 'ventana', x: 0, y: 1.7, ancho: 1.2, antepecho: 0.9, dintel: 2.2 },
  { tipo: 'ventana', x: 4.6, y: 0, ancho: 0.6, antepecho: 1.6, dintel: 2.2 },
  { tipo: 'ventana', x: 6.8, y: 0, ancho: 1.6, antepecho: 0.9, dintel: 2.2 },
  { tipo: 'ventana', x: 9.6, y: 0, ancho: 1.6, antepecho: 0.9, dintel: 2.2 },
  { tipo: 'ventana', x: 11, y: 1.7, ancho: 1.2, antepecho: 0.9, dintel: 2.2 },
  { tipo: 'ventana', x: 11, y: 4.5, ancho: 0.6, antepecho: 1.6, dintel: 2.2 },
  { tipo: 'ventana', x: 11, y: 6.8, ancho: 1.0, antepecho: 1.1, dintel: 2.2 },
  { tipo: 'ventana', x: 8.0, y: 8, ancho: 1.4, antepecho: 1.1, dintel: 2.2 },
  { tipo: 'ventana', x: 5.8, y: 8, ancho: 1.0, antepecho: 0.9, dintel: 2.2 },
  { tipo: 'ventana', x: 0, y: 6.4, ancho: 1.6, antepecho: 0.9, dintel: 2.2 },
];

export function planoEjemplo() {
  return {
    formato: FORMATO,
    version: VERSION_PLANO,
    nombre: 'Apartamento de ejemplo',
    nota: 'Modelo de ejemplo dibujado a partir de un plano, no un escaneo. La propiedad no existe.',
    alto: ALTO_PARED,
    inicio: { x: 0.9, y: 4.1, rumbo: 120 },
    ambientes,
    paredes: paredesDesdeAmbientes(ambientes),
    aberturas,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const plano = planoEjemplo();
  const { errores } = validarPlano(plano);
  if (errores.length) {
    console.error('El plano de ejemplo no es válido:\n- ' + errores.join('\n- '));
    process.exit(1);
  }
  const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'plano.json');
  writeFileSync(destino, JSON.stringify(plano, null, 1) + '\n');
  console.log(`plano.json: ${plano.ambientes.length} ambientes, ${plano.paredes.length} paredes, ${plano.aberturas.length} aberturas.`);
}
