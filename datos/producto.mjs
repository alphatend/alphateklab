// Med (se llamó Citas Médicas hasta el 10-oct-2026, cuando Edwin le puso el nombre de la portada de alphateklab): el
// sistema de expediente y agenda para clínicas, y lo único que vendía alphateklab desde el 7-oct. La portada sale entera de
// aquí: los precios, lo que hace cada parte, las pantallas y las preguntas. Cambiar un precio es cambiar un número.
//
// Decisiones de Edwin (7-oct-2026):
// - La propuesta de valor es el expediente: que el médico sepa que puede dictar la nota de la consulta y no tiene que
//   escribirla a mano ni teclearla. Se explica para el médico joven que sabe de tecnología y para el señor que no:
//   con IA, y con palabras simples. El expediente va primero en toda la página; la agenda, después.
// - Dos productos que se contratan por separado: el Expediente (por profesional) y la Agenda (por clínica, con un
//   paquete de mensajes de WhatsApp). Sin la agenda, el expediente funciona solo: el médico abre la consulta del
//   paciente que llega y la recepción la imprime para el folder.
// - Los recordatorios por WhatsApp se explican por lo que ahorran: la secretaria ya no llama paciente por paciente.
// - En las tarjetas de los planes, poco: lo esencial de cada parte. El detalle va en las secciones.
// - Precios netos: van tal cual, sin sumar ITBMS. Prueba gratis de 7 días. Pago mes a mes, sin plan anual.
// - «Profesional» es cada médico que hace expedientes; la recepción, enfermería y administración no pagan.

export const PRODUCTO = 'Med';
// El nombre completo, donde «Med» solo se queda corto (los títulos de las páginas, los datos estructurados).
export const MARCA = `${PRODUCTO} by alphateklab`;
export const PRUEBA_DIAS = 7;

// Al mes, en dólares, desde el 7-oct-2026 (Edwin; los mismos de la app, citas-piloto web/js/nucleo/plan.mjs).
export const PRECIOS = {
  expediente: 29.99, // por profesional
  agenda: 14.99, // por clínica, sin los mensajes
  // El precio de antes, tachado al lado del de ahora en las tarjetas y en Precios (Edwin, 7-oct en la noche: «el de
  // expediente que aparezca un 49.99 pero tachado […], el de agenda de citas $34.99 tachado y ahora $14.99»). Los
  // mensajes no llevan tachado. No se cobra ni se suma: solo se muestra.
  antes: { expediente: 49.99, agenda: 34.99 },
  // Los mensajes de WhatsApp van aparte de la agenda, por paquete al mes. Sin paquete (0) los recordatorios salen igual
  // a su hora, y la recepción manda cada uno con un toque desde el WhatsApp de la clínica. Los paquetes (con los que
  // saldrían solos) solo se ofrecen con PAQUETES_A_LA_VENTA.
  mensajes: [{ mensajes: 0, precio: 0 }],
};

// Los paquetes de mensajes automáticos de WhatsApp: fuera de la venta desde el 13-oct-2026. El sistema todavía no manda
// nada solo («Piloto: nada sale solo», citas-piloto): los recordatorios los manda la recepción con un toque, y vender
// «salen solos» era prometer algo que no existe (QA del 13-oct). Cuando salgan solos de verdad, true aquí y
// PAQUETES_MENSAJES=1 en el servicio de cuentas.
export const PAQUETES_A_LA_VENTA = false;
const PAQUETES_PRECIOS = [
  { mensajes: 200, precio: 15 },
  { mensajes: 500, precio: 25 },
  { mensajes: 1000, precio: 35 },
];
if (PAQUETES_A_LA_VENTA) PRECIOS.mensajes.push(...PAQUETES_PRECIOS);
export const DESDE = Math.min(PRECIOS.expediente, PRECIOS.agenda);
/** El paquete más barato con mensajes automáticos (null sin paquetes a la venta). */
export const MENSAJES_DESDE = PAQUETES_A_LA_VENTA ? Math.min(...PRECIOS.mensajes.filter((m) => m.mensajes > 0).map((m) => m.precio)) : null;

/** Un monto en dólares, con centavos solo si los tiene: «$15», «$14.99», «$89.97». Las sumas, en centavos. */
export function dolares(n) {
  const c = Math.round(Number(n) * 100);
  return `$${c % 100 === 0 ? c / 100 : (c / 100).toFixed(2)}`;
}
/** Suma montos en dólares sin el error de los decimales (14.99 + 15 = 29.99, no 29.990000000000002). */
export const sumar = (...montos) => montos.reduce((t, n) => t + Math.round(Number(n) * 100), 0) / 100;
/** Los paquetes de mensajes en palabras: «200 por $15, 500 por $25 o 1000 por $35». */
const PAQUETES = PRECIOS.mensajes.filter((m) => m.mensajes > 0).map((m) => `${m.mensajes} por ${dolares(m.precio)}`).join(', ').replace(/, ([^,]+)$/, ' o $1');

export const HEROE = {
  antetitulo: `${PRODUCTO}, para clínicas y consultorios en Panamá`,
  // la parte entre [] va resaltada
  titulo: 'El expediente de tu paciente, [sin escribir a mano ni teclear]',
  bajada:
    'Durante la consulta hablas y el sistema escribe la nota con IA, sección por sección. Tú la revisas y queda guardada; si trabajas con folder, la recepción la imprime. Y si quieres, también la agenda, con los recordatorios por WhatsApp listos para mandar con un toque.',
  puntos: [`${PRUEBA_DIAS} días gratis, sin tarjeta`, 'Sin instalar nada', `Desde ${dolares(DESDE)} al mes`],
  // Las tarjetas que flotan sobre las pantallas del héroe (nombres inventados).
  avisos: [
    { icono: 'microphone', titulo: 'Dictando con IA', texto: 'Sin escribir ni teclear' },
    { icono: 'check-circle', titulo: 'Nota guardada', texto: '10:04 a. m., Dra. Ríos' },
    { icono: 'whatsapp-logo', titulo: 'Cita confirmada', texto: 'Por WhatsApp, sin llamar' },
  ],
};

// Las dos partes, como se contratan, en el orden de la página: primero el expediente.
export const PARTES = [
  {
    id: 'expediente',
    icono: 'stethoscope',
    nombre: 'Expediente clínico con IA',
    para: 'Para el médico',
    resumen: 'Dictas la nota de cada consulta y queda escrita. Con o sin la agenda.',
    destacado: { icono: 'microphone', titulo: 'Nota por secciones, con dictado por voz con IA', texto: 'Hablas y queda escrita: sin escribir a mano ni teclear.' },
    incluye: ['Antecedentes: alergias, enfermedades, medicamentos y seguro'],
    unidad: 'al mes por profesional',
  },
  {
    id: 'agenda',
    icono: 'calendar-check',
    nombre: 'Agenda de citas',
    para: 'Para la recepción',
    resumen: 'Citas sin choques y recordatorios por WhatsApp.',
    destacado: { icono: 'whatsapp-logo', titulo: 'Recordatorios por WhatsApp', texto: 'Tu secretaria ya no llama paciente por paciente para confirmar.' },
    incluye: [
      'Agenda por médico y por consultorio, por día o por semana',
      'Quién no ha confirmado hoy y mañana',
      'Registro del paciente por QR desde su teléfono',
      'Lista de espera y sala de espera',
      PAQUETES_A_LA_VENTA ? `Confirmaciones automáticas por WhatsApp, desde ${dolares(MENSAJES_DESDE)} al mes aparte` : 'Recordatorios por WhatsApp que la recepción manda con un toque',
    ],
    unidad: 'al mes por clínica',
  },
];

// Las filas de cada parte: texto de un lado y su pantalla del otro. `visual`: la captura (assets/producto/<nombre>.webp,
// con su versión -oscuro) o una de las animaciones de la página («chat», «dictado», «hoja»).
export const FILAS = {
  expediente: {
    titulo: 'Dicta el expediente en vez de escribirlo',
    bajada: 'Para el médico, con o sin la agenda: lo que antes escribías a mano o tecleabas, ahora lo dices y queda escrito, ordenado y legible.',
    filas: [
      {
        titulo: 'Hablas y la nota queda escrita',
        texto: 'Toca «Dictar» en la sección de la nota y habla como si se lo dictaras a tu asistente. La IA convierte tu voz en texto; tú lo revisas y lo guardas. Sin escribir a mano y sin teclear.',
        pasos: ['Toca «Dictar» en la sección', 'Habla con calma, como le hablas a tu asistente', 'Revisa el texto y toca «Agregar»'],
        nota: 'Funciona en Chrome, Edge y Safari, en la computadora, la tableta o el celular.',
        visual: { tipo: 'dictado' },
      },
      {
        titulo: 'Todo el expediente de la consulta, en orden',
        texto: 'Los antecedentes, los signos que anota enfermería, la nota del médico por secciones y los resultados, en un solo lugar y legibles en la próxima consulta.',
        puntos: ['Alergias y enfermedades a la vista en cada consulta', 'Resultados en PDF o foto, también con la cámara del celular', 'El historial con todas las consultas del paciente'],
        visual: { tipo: 'portatil', imagen: 'citas-expediente', alt: 'El expediente de un paciente de ejemplo: los signos que tomó enfermería, los resultados y la nota del médico.' },
      },
      {
        id: 'imprimir',
        titulo: '¿Trabajas con folder? Imprime la consulta',
        texto: 'Si tu clínica prefiere seguir con su secretaria y sus folders, no hay que cambiar eso: el médico dicta el expediente y, al terminar la consulta, la recepción lo imprime para el folder del paciente.',
        pasos: ['El médico toca «Terminar consulta»', 'A la recepción le aparece en «Por imprimir»', 'Imprime la hoja tamaño carta y la guarda en el folder'],
        visual: { tipo: 'hoja' },
      },
    ],
  },
  agenda: {
    titulo: 'Que tus pacientes lleguen a su cita',
    bajada: 'Para la recepción: citas sin choques y recordatorios por WhatsApp con un toque, sin llamar paciente por paciente.',
    filas: [
      {
        titulo: 'La agenda del día, de un vistazo',
        texto: 'Cada médico en su columna, con los huecos libres, el almuerzo y quién ya está en la sala de espera.',
        puntos: ['Por día o por semana, por médico o por consultorio', 'No deja encimar citas del mismo médico, consultorio o paciente', 'Días sin atención, feriados y el almuerzo de cada médico'],
        visual: { tipo: 'portatil', imagen: 'citas-agenda', alt: 'La agenda de un consultorio de ejemplo: las citas del día de la Dra. Ríos y del Dr. Herrera, con las confirmadas, las atendidas y quién está en la sala.' },
      },
      {
        titulo: 'Recordatorios por WhatsApp',
        texto: 'Tu secretaria ya no tiene que pasar la mañana llamando paciente por paciente para confirmar. Uno o dos días antes, el sistema deja listo el mensaje de cada paciente con la fecha, la hora y el médico; la recepción lo manda con un toque desde el WhatsApp de la clínica y el paciente confirma respondiendo.',
        puntos: [
          ...(PAQUETES_A_LA_VENTA ? [`Salen solos con un paquete de mensajes aparte: ${PAQUETES} al mes`] : []),
          'Cada recordatorio sale con un toque desde el WhatsApp de la clínica',
          'Quién ya confirmó y quién no, de un vistazo',
          'Si no responde, el sistema deja listo un segundo recordatorio',
        ],
        visual: { tipo: 'chat' },
      },
      {
        titulo: 'El paciente se registra desde su teléfono',
        texto: 'Escanea un código QR en la recepción y llena sus datos: nombre, cédula o pasaporte, celular, alergias y seguro. Acepta ahí mismo el uso de sus datos.',
        puntos: ['Sin hojas que pasar en limpio', 'La recepción lo ve llegar al momento', 'Desde cualquier celular, sin instalar nada'],
        visual: { tipo: 'telefono', imagen: 'citas-registro', alt: 'El formulario «Tus datos» en el teléfono de una paciente de ejemplo, con su nombre, cédula y celular.' },
      },
    ],
  },
};

// Todo con el mismo consultorio inventado de las capturas («Dermatología Ríos»), para que la historia sea una sola.
// La conversación de la animación de recordatorios: el mensaje es el que arma el sistema; el nombre, inventado.
export const CHAT = {
  consultorio: 'Dermatología Ríos',
  mensaje: 'Hola, Daniela. Te recordamos tu cita en Dermatología Ríos el jueves 8 de octubre a las 9:00 a. m. con Dra. Ana Ríos. Responde SÍ para confirmar, o escríbenos si necesitas cambiarla o no podrás venir.',
  respuesta: 'Sí, ahí estaré',
  estado: 'Cita confirmada',
};

// La animación del dictado: el caso del expediente de las capturas. El héroe muestra las dos primeras secciones.
export const DICTADO = [
  { seccion: 'Motivo de consulta', texto: 'Lesiones rojas con descamación en codos y rodillas desde hace dos meses.' },
  { seccion: 'Examen físico', texto: 'Placas bien delimitadas con escama plateada en ambos codos.' },
  { seccion: 'Diagnóstico', texto: 'Psoriasis en placas, leve.' },
];

// La hoja impresa de la animación (datos inventados; la de verdad sale del sistema).
export const HOJA = {
  consultorio: 'Dermatología Ríos',
  paciente: 'Carlos Méndez Castillo',
  documento: '8-903-1111',
  edad: '47 años',
  fecha: 'Miércoles 7 de octubre, 10:00 a. m.',
  medico: 'Dra. Ana Ríos',
  antecedentes: 'Alergias: ninguna conocida · Enfermedades: diabetes',
  signos: 'PA 118/76 mmHg · Pulso 72 lpm · T 36.6 °C · SpO₂ 98 %',
  notas: [
    ['Motivo de consulta', 'Lesiones rojas con descamación en codos y rodillas desde hace dos meses.'],
    ['Examen físico', 'Placas bien delimitadas con escama plateada en ambos codos.'],
    ['Diagnóstico', 'Psoriasis en placas, leve.'],
    ['Indicaciones', 'Crema con corticoide dos veces al día por dos semanas. Control en un mes.'],
  ],
};

export const ACCESOS = {
  titulo: 'Cada quien ve lo que le toca',
  bajada: 'Tú decides qué puede hacer cada persona de tu equipo.',
  imagen: 'citas-accesos',
  alt: 'Personal y accesos en un consultorio de ejemplo: las casillas de acceso a expedientes, notas, signos y resultados de cada persona.',
  puntos: [
    { icono: 'users-three', titulo: 'Un usuario por persona', texto: 'Nadie comparte la clave de la recepción: cada quien entra con la suya.' },
    { icono: 'lock-key', titulo: 'Permisos con casillas', texto: 'Acceso a expedientes, notas, signos, imprimir y configuración, persona por persona.' },
    { icono: 'shield-check', titulo: 'El consentimiento del paciente', texto: 'Antes de guardar sus datos, el paciente acepta su uso según la Ley 81 de 2019, en la recepción o en su teléfono, y queda la fecha.' },
    { icono: 'clipboard-text', titulo: 'Las correcciones a la vista', texto: 'Una nota se corrige el mismo día y queda marcada como corregida.' },
  ],
};

export const PASOS = [
  { titulo: 'Pides tu prueba', texto: 'Nos escribes y nos dices cuántos médicos son y si quieres el expediente, la agenda o los dos.' },
  { titulo: 'Te lo dejamos listo', texto: 'Configuramos a tus médicos, sus horarios y las secciones de su nota, y creamos el usuario de cada persona.' },
  { titulo: `Lo usas ${PRUEBA_DIAS} días gratis`, texto: 'Con el plan que elijas. Si te sirve, sigues mes a mes; si no, no pagas nada.' },
];

export const PRUEBA = {
  titulo: 'Pruébalo en tu consultorio',
  bajada: 'Dicta tus primeros expedientes esta semana. Sin tarjeta y sin plan anual.',
  puntos: ['El dictado con IA, incluido en la prueba', 'Creamos el usuario de cada persona', 'Te mostramos cómo se usa'],
  // Mientras no haya WhatsApp ni correo en datos/sitio.mjs: los doctores llegan desde el correo que les mandamos.
  sinContacto: 'Para pedirla, responde el correo con el que te llegó esta página y te escribimos.',
};

// Con el registro en línea (REGISTRO en datos/sitio.mjs): los pasos, la sección de la prueba y las preguntas de pago.
export const PASOS_REGISTRO = [
  { titulo: 'Creas tu cuenta', texto: 'En unos minutos: el nombre de tu clínica, la dirección de tu sistema y tu plan. Sin tarjeta.' },
  { titulo: 'Tu sistema queda listo', texto: 'Al momento, en tu propia dirección (tuclinica.alphateklab.com). Agregas a tu equipo y le das a cada quien sus accesos.' },
  { titulo: `Lo usas ${PRUEBA_DIAS} días gratis`, texto: 'Con el plan que elijas. Si te sirve, pagas con tarjeta y sigues mes a mes; si no, no pagas nada.' },
];
export const PRUEBA_REGISTRO = {
  titulo: 'Pruébalo en tu consultorio',
  bajada: 'Crea tu cuenta y dicta tus primeros expedientes hoy mismo. Sin tarjeta y sin plan anual.',
  puntos: ['Tu sistema queda listo al momento, en tu propia dirección', 'El dictado con IA, incluido en la prueba', 'Al terminar, pagas con tarjeta solo si te sirve'],
  boton: 'Crear mi cuenta',
};
export const PREGUNTAS_REGISTRO = [
  ['¿Cómo pago?', 'Con tarjeta de crédito o débito, mes a mes. Al terminar la prueba pagas desde tu sistema, en «Tu plan»; después el cobro es automático y te llega el recibo por correo.'],
  ['¿Puedo agregar profesionales después?', 'Sí, cuando quieras, desde «Tu plan» en tu sistema: agregas profesionales o la agenda y pagas solo la diferencia por los días que quedan del mes.'],
  ['¿Puedo cancelar?', 'Sí, cuando quieras, desde «Tu plan». No se te vuelve a cobrar y tu sistema sigue hasta el final del mes pagado.'],
];

export const PREGUNTAS = [
  ['¿Cómo funciona el dictado con IA?', 'Tocas «Dictar» en la sección de la nota y hablas. La IA convierte tu voz en texto en la casilla; lo revisas, corriges si hace falta y tocas «Agregar». No hace falta escribir a mano ni teclear. Funciona en Chrome, Edge y Safari.'],
  ['¿Y si no me llevo bien con la tecnología?', 'Es un botón: tocas «Dictar», hablas y revisas lo que quedó escrito. En la prueba te mostramos cómo se usa, paso a paso.'],
  ['¿Tengo que instalar algo?', 'No. Se usa en el navegador de la computadora, la tableta o el celular que ya tienes. Solo necesitas internet.'],
  ['¿Puedo contratar solo el expediente?', 'Sí. El expediente funciona sin la agenda: el médico abre la consulta del paciente que llega, la dicta y, si trabajan con folder, la recepción la imprime al terminar.'],
  ['¿Puedo contratar solo la agenda?', 'Sí. Tienes las citas, los recordatorios por WhatsApp, el registro de pacientes y la lista de espera, sin el expediente.'],
  [
    '¿Los mensajes de WhatsApp están incluidos en la agenda?',
    PAQUETES_A_LA_VENTA
      ? `No. La agenda cuesta ${dolares(PRECIOS.agenda)} al mes por clínica y con ella los recordatorios los manda la recepción con un toque desde el WhatsApp de la clínica. Para que salgan solos, se suma un paquete de mensajes: ${PAQUETES} al mes.`
      : `Sí. Con la agenda (${dolares(PRECIOS.agenda)} al mes por clínica), el sistema deja listo cada recordatorio a su hora y la recepción lo manda con un toque desde el WhatsApp de la clínica, sin costo aparte. Hoy cada mensaje necesita ese toque.`,
  ],
  ['¿Qué cuenta como profesional?', 'Cada médico que hace expedientes. La recepción, enfermería y administración tienen su propio usuario sin costo.'],
  ...(PAQUETES_A_LA_VENTA ? [['¿Qué pasa si se me acaban los mensajes del mes?', 'Te avisamos para pasar al paquete siguiente. Mientras tanto, los recordatorios que falten se mandan con un toque desde el WhatsApp del consultorio.']] : []),
  ['¿Puedo pasar mis pacientes desde Excel?', 'Sí. El sistema importa tus pacientes desde un Excel o un CSV: nombre, cédula o pasaporte, celular, correo, fecha de nacimiento, alergias, enfermedades, medicamentos y seguro.'],
  ['¿Quién puede ver los expedientes?', 'Solo las personas a las que les das ese acceso. La recepción puede agendar sin ver el expediente; si le das «Imprimir expedientes», lo puede ver e imprimir, pero no cambiar.'],
  [`¿Cómo es la prueba de ${PRUEBA_DIAS} días?`, 'Te dejamos el sistema listo y lo usas una semana con el plan que elijas. No pedimos tarjeta.'],
  ['¿Hay contrato o plan anual?', 'No. Después de la prueba pagas mes a mes.'],
];
