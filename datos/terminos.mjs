// Términos del servicio de Citas Médicas (borrador del 7-oct-2026 para que Edwin lo revise antes de publicarlo; no
// reemplaza la revisión de un abogado). Lenguaje simple, en tú, como el resto del sitio.
// Decisiones marcadas para Edwin: cuánto se guardan los datos después de la pausa (90 días), que no hay reembolsos
// por partes de un mes y el aviso de 30 días antes de cambiar precios.

// 13-oct-2026: la prueba es con el plan que se elija y se alarga mientras no haya pago con tarjeta; la agenda ya no
// se cobra según los mensajes (los paquetes salieron de la venta).
export const VIGENTE = '13 de octubre de 2026';

export const SECCIONES = [
  ['Quiénes somos', [
    'Med es un servicio de alphateklab, en Panamá. Estos términos son el acuerdo entre alphateklab y la clínica o el consultorio que crea una cuenta («tú»). Al crear la cuenta los aceptas.',
  ]],
  ['El servicio', [
    'Med es un sistema en línea con dos partes que se contratan por separado: el expediente clínico (con dictado por voz) y la agenda de citas (con recordatorios por WhatsApp). Tu sistema vive en su propia dirección y se usa desde el navegador.',
    'Tú decides quién de tu equipo entra y qué puede hacer cada persona. Cada persona es responsable de cuidar su usuario y su contraseña.',
  ]],
  ['La prueba gratis', [
    'Cada cuenta nueva tiene 7 días de prueba con el plan que elijas, sin tarjeta. Los últimos días te lo recordamos dentro del sistema.',
    'Mientras el pago con tarjeta no esté disponible, la prueba se alarga sin costo. Cuando lo esté, si al terminar la prueba no pagas, tu sistema queda en pausa: nadie puede entrar, pero tus datos siguen guardados como se explica más abajo.',
  ]],
  ['Precios y pagos', [
    'Los precios son los que muestra alphateklab.com al contratar: el expediente, por cada profesional que lo usa; la agenda, por clínica. Son netos y en dólares.',
    'Se paga mes a mes con tarjeta, a través de Tilopay. Al primer pago la tarjeta queda guardada en Tilopay (nosotros no vemos su número) y cada mes se cobra sola en la misma fecha. Te llega el recibo por correo.',
    'Si un cobro no pasa, lo volvemos a intentar dos veces más, cada dos días, y te avisamos. Si los tres fallan, tu sistema queda en pausa hasta que pagues.',
    'Si cambiamos los precios, te avisamos por correo al menos 30 días antes de que el cambio se aplique a tu cuenta.',
  ]],
  ['Cambios de plan', [
    'Puedes cambiar tu plan cuando quieras desde «Tu plan», en tu sistema. Si agregas profesionales o una parte, se cobra al momento la diferencia por los días que quedan del mes pagado. Si quitas algo, el precio nuevo se aplica desde el siguiente cobro.',
  ]],
  ['Cancelación', [
    'Puedes cancelar cuando quieras desde «Tu plan». No se te vuelve a cobrar y tu sistema sigue funcionando hasta el final del periodo ya pagado. No hay reembolsos por las partes de un mes que no se usen.',
  ]],
  ['Los datos de tus pacientes', [
    'Los datos de tus pacientes son tuyos. Tú eres el responsable de su tratamiento y alphateklab los trata solo por encargo tuyo, para prestarte el servicio, según la Ley 81 de 2019 de protección de datos personales y su reglamento.',
    'El sistema pide el consentimiento del paciente antes de guardar sus datos y guarda la fecha y la forma en que lo dio. Obtenerlo es tu responsabilidad.',
    'No vendemos ni compartimos los datos de tus pacientes, ni los usamos para nada distinto de prestarte el servicio. Nuestro personal no consulta los expedientes, salvo para resolver un problema técnico que tú nos pidas o por una obligación legal.',
    'Las conexiones van cifradas (HTTPS), cada clínica tiene su propia base de datos separada de las demás, y hacemos respaldos todos los días.',
    'Puedes pedirnos en cualquier momento una copia de tus datos. Si tu sistema queda en pausa o cancelas, guardamos tus datos 90 días; antes de borrarlos te avisamos por correo para que pidas tu copia si la quieres.',
  ]],
  ['El dictado con IA y el uso clínico', [
    'El dictado convierte la voz en texto con inteligencia artificial. Puede equivocarse: el médico revisa lo que quedó escrito antes de guardarlo y es responsable del contenido del expediente.',
    'Med es una herramienta para organizar el trabajo del consultorio. No da diagnósticos ni recomendaciones médicas.',
  ]],
  ['Recordatorios por WhatsApp', [
    'Los recordatorios se mandan a los pacientes que dieron su permiso. Los paquetes son de 200, 500 o 1000 mensajes al mes; si se te acaban, te avisamos para pasar al siguiente.',
  ]],
  ['Disponibilidad y soporte', [
    'Trabajamos para que tu sistema esté disponible siempre, pero puede haber interrupciones por mantenimiento o por fallas de terceros (internet, proveedores de servidores, Tilopay o WhatsApp). Cuando podamos, avisamos antes.',
  ]],
  ['Responsabilidad', [
    'alphateklab responde por prestar el servicio con cuidado. No responde por decisiones clínicas, por el uso que tu equipo haga del sistema ni por daños indirectos. En cualquier caso, la responsabilidad de alphateklab no supera lo que pagaste en los últimos tres meses.',
  ]],
  ['Cambios a estos términos', [
    'Si cambiamos estos términos, te avisamos por correo al menos 30 días antes. Si no estás de acuerdo, puedes cancelar sin costo antes de que apliquen.',
  ]],
  ['Ley aplicable', [
    'Estos términos se rigen por las leyes de la República de Panamá.',
  ]],
];
