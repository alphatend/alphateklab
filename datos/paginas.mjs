// Las páginas de cada parte del producto (alphateklab.com/<ruta>): lo que la portada dice en corto, con el detalle que
// busca quien llega desde Google o desde un asistente como ChatGPT. Todo lo que dicen está comprobado en el sistema de
// verdad (citas-piloto y citas-servidor, 8-oct-2026): si el sistema cambia, se cambia aquí. Sin cifras sin fuente y sin
// prometer lo que el sistema todavía no hace.
//
// La de la agenda espera. Desde el 13-oct la portada ya no vende paquetes de mensajes que «salen solos»
// (PAQUETES_A_LA_VENTA en producto.mjs): el sistema todavía no manda nada solo (citas-piloto web/js/app/bandeja.mjs:
// «nada sale solo todavía; cada mensaje se manda con su botón»). Una página de la agenda tiene que decir lo mismo.

import { PRECIOS, PRUEBA_DIAS, FILAS, ACCESOS, PREGUNTAS, dolares } from './producto.mjs';

const pregunta = (q) => {
  const p = PREGUNTAS.find(([x]) => x === q);
  if (!p) throw new Error(`datos/paginas.mjs: la portada ya no tiene la pregunta «${q}»`);
  return p;
};

export const EXPEDIENTE = {
  id: 'expediente',
  ruta: 'expediente-clinico/',
  // En la pestaña y en Google (hasta ~60 caracteres a la vista) y en la descripción (hasta ~155).
  // «expediente clínico electrónico en Panamá» es lo primero que sugiere Google en Panamá (investigación del 8-oct).
  titulo: 'Expediente clínico electrónico con dictado por IA en Panamá',
  descripcion: `El médico dicta la nota de la consulta y queda escrita por secciones. Antecedentes, signos y resultados en un solo lugar. ${dolares(PRECIOS.expediente)} al mes por profesional.`,
  miga: 'Expediente clínico',
  antetitulo: 'Expediente clínico con IA, para consultorios en Panamá',
  h1: 'Expediente clínico electrónico que dictas en vez de escribir',
  bajada:
    'Durante la consulta hablas y la nota queda escrita con IA, en sus secciones: motivo, lo que refiere el paciente, examen físico, diagnóstico e indicaciones. La revisas y la guardas. Funciona con o sin la agenda, en el navegador que ya usas.',
  puntos: [`${dolares(PRECIOS.expediente)} al mes por profesional`, 'El dictado con IA va incluido', `${PRUEBA_DIAS} días gratis, sin tarjeta`],
  registro: { expediente: 1, profesionales: 1, agenda: 0 },
  boton: 'Probar el expediente',
  visual: { imagen: 'citas-nota', alt: 'La nota del médico en el expediente de un paciente de ejemplo, con un botón «Dictar» en cada sección.' },
  guarda: {
    antetitulo: 'Qué guarda',
    titulo: 'Todo lo de la consulta, en un solo lugar',
    bajada: 'Lo que antes quedaba en hojas sueltas y en la letra de cada médico, ordenado y legible en la próxima consulta.',
    puntos: [
      { icono: 'identification-card', titulo: 'Antecedentes', texto: 'Alergias, enfermedades, medicamentos y seguro, a la vista en cada consulta.' },
      { icono: 'heartbeat', titulo: 'Signos', texto: 'Presión arterial, pulso, temperatura, saturación, frecuencia respiratoria, peso, talla con su IMC y glucosa. Tu consultorio elige cuáles toma enfermería.' },
      { icono: 'file-text', titulo: 'La nota del médico, por secciones', texto: 'De fábrica: motivo de consulta, lo que refiere el paciente, examen físico, diagnóstico, e indicaciones y tratamiento. Cada médico arma las suyas, de 1 a 15.' },
      { icono: 'upload-simple', titulo: 'Resultados', texto: 'Exámenes, radiografías y documentos en PDF o en foto, también con la cámara del celular.' },
      { icono: 'clock', titulo: 'El historial', texto: 'Todas las consultas del paciente, para leerlas antes de que entre.' },
      { icono: 'printer', titulo: 'La hoja impresa', texto: 'La consulta en tamaño carta, para el folder del paciente.' },
    ],
  },
  filas: [
    {
      titulo: 'Cómo se dicta una nota',
      texto: 'Toca «Dictar» en la sección y habla como le hablas a tu asistente. Al terminar, la IA convierte tu voz en texto en la casilla; lo revisas, corriges lo que haga falta y tocas «Agregar». Nada entra al expediente sin que lo leas.',
      pasos: FILAS.expediente.filas[0].pasos,
      nota: 'Cada fragmento dura hasta 10 minutos. Funciona en Chrome, Edge y Safari, en la computadora, la tableta o el celular.',
      visual: { tipo: 'dictado' },
    },
    { ...FILAS.expediente.filas.find((f) => f.id === 'imprimir'), id: undefined },
  ],
  audio: {
    antetitulo: 'Tu voz y los datos del paciente',
    titulo: 'Qué pasa con lo que dictas',
    bajada: 'Lo que dices en la consulta es información de salud. Así la tratamos.',
    puntos: [
      { icono: 'microphone', titulo: 'El audio no se guarda', texto: 'Pasa por nuestro servidor, sin guardarse, hasta el servicio de transcripción; apenas vuelve el texto, se borra allá también.' },
      { icono: 'shield-check', titulo: 'Un servicio de transcripción médica', texto: 'Transcribe voz médica en español. Tenemos firmado con él un acuerdo para datos de salud (BAA) y no usa el audio para entrenar.' },
      { icono: 'lock-key', titulo: 'Solo dicta quien escribe notas', texto: 'El dictado es para las personas con el acceso «Notas». Las demás no pueden usarlo.' },
      { icono: 'clipboard-text', titulo: 'Lo que queda es tu texto', texto: 'En el expediente queda el texto que revisaste, con tu nombre y la hora.' },
    ],
    nota: 'Qué servicio es y el detalle, en la política de privacidad',
  },
  accesos: ACCESOS,
  guia: { ruta: 'expediente-clinico-electronico-panama/', texto: 'Lo que pide la ley del expediente clínico electrónico en Panamá' },
  precio: {
    titulo: `${dolares(PRECIOS.expediente)} al mes por profesional`,
    textos: [
      'Profesional es cada médico que hace expedientes. La recepción, enfermería y administración tienen su usuario sin costo.',
      'Sin la agenda, el médico abre la consulta del paciente que llega desde «Nueva consulta» y, si trabajan con folder, la recepción la imprime al terminar.',
      `Con la agenda (${dolares(PRECIOS.agenda)} al mes por clínica), el médico abre el expediente desde la cita.`,
    ],
  },
  preguntas: [
    pregunta('¿Cómo funciona el dictado con IA?'),
    ['¿La IA escribe cosas que no dije?', 'No inventa ni resume: convierte en texto lo que dictas, en la sección donde lo dictas, con un modelo de transcripción médica en español. Puede equivocarse con una palabra; por eso lo revisas antes de agregarlo.'],
    ['¿Graba toda la consulta?', 'No. Graba solo mientras dictas: desde que tocas «Dictar» hasta que lo detienes, hasta 10 minutos por fragmento.'],
    ['¿Se guarda el audio de lo que dicto?', 'No. El audio va de tu navegador al servicio de transcripción y se borra allá apenas vuelve el texto. En el expediente queda solo el texto que revisaste.'],
    pregunta('¿Y si no me llevo bien con la tecnología?'),
    pregunta('¿Tengo que instalar algo?'),
    ['¿Puedo cambiar las secciones de la nota?', 'Sí. Cada médico arma las suyas, de 1 a 15, con el nombre que quiera. Las de fábrica son motivo de consulta, lo que refiere el paciente, examen físico, diagnóstico, e indicaciones y tratamiento.'],
    ['¿Puedo corregir una nota?', 'Sí, el mismo día. La nota queda marcada como corregida, a la vista.'],
    pregunta('¿Puedo contratar solo el expediente?'),
    pregunta('¿Qué cuenta como profesional?'),
    pregunta('¿Quién puede ver los expedientes?'),
    pregunta('¿Puedo pasar mis pacientes desde Excel?'),
  ],
};

/** Las páginas de función que se publican, en el orden del pie de página. */
export const FUNCIONES = [EXPEDIENTE];
