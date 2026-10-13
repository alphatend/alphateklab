// Demos del laboratorio que se muestran en la portada. Las rutas relativas son a la raíz del sitio.
// imagen: captura real de la demo (herramientas/capturas.mjs), nunca una imagen generada.
// Solo software (oct-2026): se quitaron las del recorrido 3D, el recorrido 360, el contador con cámara y los sensores.

const MESA = 'https://alphatend.github.io/alphateklab-mesa/';
const RESERVAS = 'https://alphatend.github.io/alphateklab-reservas/';

export const DEMOS = [
  {
    clave: 'mesa',
    url: MESA,
    nombre: 'Pedir y pagar desde la mesa',
    corto: 'Pedir desde la mesa',
    que: 'La carta de un restaurante de ejemplo con un QR por mesa. Pides desde el teléfono, la comanda aparece en la pantalla de la cocina y en el mapa del salón, y al final divides la cuenta y pones la propina tú.',
    prueba: 'ábrela en el teléfono y pide desde la mesa 7; en una computadora ves llegar el pedido al salón.',
    servicios: ['R01', 'R02', 'R04', 'R05'],
    imagen: 'assets/demos/mesa.webp',
  },
  {
    clave: 'reservas',
    url: RESERVAS,
    nombre: 'Agente de citas y reservas de cabañas',
    corto: 'Citas y cabañas',
    que: 'La agenda de un consultorio de ejemplo que recuerda la cita 2 o 1 día antes e insiste hasta que el paciente responde, y el calendario de unas cabañas de ejemplo que avisa cuando un canal como Booking deja de sincronizar.',
    prueba: 'adelanta el reloj de la demo y mira salir los recordatorios.',
    servicios: ['S01', 'H01', 'H02', 'R08'],
    imagen: 'assets/demos/reservas.webp',
  },
];
