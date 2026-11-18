// Perfil horario del restaurante de ejemplo (ficticio): abre a las 11:00, pico al mediodía y en la noche,
// cierra a las 22:00. La cocina empieza a preparar a las 8:00 y limpia hasta las 23:00.
// Cada función recibe la hora del día en horas decimales (0 a 24) y devuelve un valor de 0 a 1.

function interpolar(puntos, h) {
  const x = ((h % 24) + 24) % 24;
  for (let i = 1; i < puntos.length; i++) {
    const [x1, y1] = puntos[i];
    if (x <= x1) {
      const [x0, y0] = puntos[i - 1];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return puntos[puntos.length - 1][1];
}

// Clientes en el salón.
const OCUPACION = [
  [0, 0], [11, 0], [11.5, 0.35], [12.5, 0.95], [13.5, 1], [14.5, 0.45], [16, 0.2], [18, 0.3],
  [19.5, 0.85], [20.5, 0.9], [21.5, 0.45], [22, 0.1], [22.5, 0], [24, 0],
];

// Trabajo en la cocina (preparación, servicio, limpieza).
const COCINA = [
  [0, 0], [7.5, 0], [8, 0.35], [10.5, 0.5], [12.5, 1], [14.5, 0.55], [16.5, 0.35], [19.5, 0.95],
  [21.5, 0.5], [22.5, 0.25], [23, 0], [24, 0],
];

// Entregas de proveedores al cuarto frío.
const ENTREGAS = [
  [0, 0], [6.75, 0], [7, 1], [9, 1], [9.25, 0], [24, 0],
];

export const HORA_ABRE = 11;
export const HORA_CIERRA = 22;

export const ocupacion = (h) => interpolar(OCUPACION, h);
export const cocina = (h) => interpolar(COCINA, h);
export const entregas = (h) => interpolar(ENTREGAS, h);

// El aire acondicionado del salón se prende a las 10:30 y se apaga a las 22:30.
export const aireEncendido = (h) => h >= 10.5 && h < 22.5;

// Calor de la tarde: 0 de noche, 1 hacia las 14:30.
export const calorTarde = (h) => Math.max(0, Math.sin((Math.PI * (h - 8.5)) / 12));

export function horaDelDia(t) {
  return (((t / 3600) % 24) + 24) % 24;
}
