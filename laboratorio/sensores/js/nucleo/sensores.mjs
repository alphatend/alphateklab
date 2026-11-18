// Los sensores del restaurante de ejemplo. La etiqueta es la que llevaría el sensor instalado
// (la misma que se ve en el tablero), para que quien revisa el local sepa cuál es cuál.

export const NEGOCIO = 'Restaurante de ejemplo';

export const SENSORES = [
  { id: 'nevera', etiqueta: 'T1', nombre: 'Nevera de la cocina', tipo: 'numero', unidad: '°C', decimales: 1, limites: [-40, 60] },
  { id: 'cuarto', etiqueta: 'T2', nombre: 'Cuarto frío', tipo: 'numero', unidad: '°C', decimales: 1, limites: [-40, 60] },
  { id: 'congelador', etiqueta: 'T3', nombre: 'Congelador', tipo: 'numero', unidad: '°C', decimales: 1, limites: [-40, 60] },
  {
    id: 'puertaNevera', etiqueta: 'P1', nombre: 'Puerta de la nevera', tipo: 'estado',
    activo: 'abierta', inactivo: 'cerrada',
  },
  {
    id: 'puertaCuarto', etiqueta: 'P2', nombre: 'Puerta del cuarto frío', tipo: 'estado',
    activo: 'abierta', inactivo: 'cerrada',
  },
  {
    id: 'bomba', etiqueta: 'B1', nombre: 'Bomba del tanque', tipo: 'estado',
    activo: 'encendida', inactivo: 'apagada',
  },
  {
    id: 'vibracion', etiqueta: 'V1', nombre: 'Vibración de la compresora de la nevera', corto: 'Compresora de la nevera',
    tipo: 'numero', unidad: 'mm/s', decimales: 1, limites: [0, 50],
  },
  { id: 'energia', etiqueta: 'E1', nombre: 'Consumo eléctrico', tipo: 'energia', unidad: 'kWh' },
  { id: 'corriente', etiqueta: 'E1', nombre: 'Corriente del local', tipo: 'corriente' },
  { id: 'tanque', etiqueta: 'N1', nombre: 'Tanque de agua', tipo: 'numero', unidad: '%', decimales: 0, limites: [0, 100] },
  { id: 'humedad', etiqueta: 'H1', nombre: 'Humedad de la bodega', tipo: 'numero', unidad: '%', decimales: 0, limites: [0, 100] },
];

export const CIRCUITOS = [
  { id: 'aire', nombre: 'Aire acondicionado del salón', corto: 'Aire acondicionado' },
  { id: 'cocina', nombre: 'Cocina y luces', corto: 'Cocina y luces' },
  { id: 'refri', nombre: 'Refrigeración (nevera, congelador y cuarto frío)', corto: 'Refrigeración' },
];

export const CAPACIDAD_TANQUE_L = 2500;

// Los límites de una regla tienen que caer dentro de lo que el sensor puede medir (`limites`): un «8e» o un
// «99999999999» mal escrito no se acepta como límite.

// Por debajo de esta potencia total el local está sin corriente. En la demo el medidor sigue reportando
// 0 kW durante el corte; en una instalación el aviso lo da la puerta de enlace con su UPS (ver la ficha).
export const UMBRAL_SIN_CORRIENTE_KW = 0.05;

const POR_ID = new Map(SENSORES.map((s) => [s.id, s]));

export function sensor(id) {
  return POR_ID.get(id) || null;
}

export const SENSORES_NUMERICOS = SENSORES.filter((s) => s.tipo === 'numero');
export const SENSORES_ESTADO = SENSORES.filter((s) => s.tipo === 'estado');
export const SENSORES_TEMPERATURA = ['nevera', 'cuarto', 'congelador'];
