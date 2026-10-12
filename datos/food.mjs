// Página de Food (cafeterías, bares y restaurantes): Sobremesa (pedidos por QR desde la mesa) y el sistema a la medida
// (Edwin, 8-oct-2026). La genera herramientas/generar-portada.mjs. Todo lo que dice está en el sistema de pedidos por
// QR: si el sistema cambia, se cambia aquí. Sin precios: no hay decididos.
//
// Vuelve (la tarjeta de lealtad, en vuelve.alphateklab.com; del 8 al 10-oct se llamó Racha aquí) está oculta desde el
// 11-oct: Edwin, «de momento no ofreceremos ese servicio». Sus datos se guardan aquí (su servicio, `vuelve` y sus
// preguntas). Para volver a ponerla: `publicado: true` en su servicio y, en los textos generales de aquí y de
// datos/portada.mjs (Food), lo que decían de ella en el commit 11c67ae.

export const FOOD = {
  titulo: 'Food: pedidos por QR para cafeterías, bares y restaurantes', // sin «Panamá» (Edwin, 10-oct)
  descripcion:
    'Sobremesa: tus mesas piden por QR y la barra lo ve al instante. Y comandas, facturación e inventario a la medida.',
  heroe: {
    titulo: ['Pedidos desde la mesa.', 'Directo a la barra.'],
    bajada:
      'Para cafeterías, bares y restaurantes: con Sobremesa, tus mesas piden desde el celular y en la barra suena el timbre. Y si necesitas un sistema de comandas, facturación e inventario, te lo hacemos a la medida.',
  },
  // Las tarjetas de vidrio del héroe: llevan a cada sección.
  servicios: [
    // `entrar` y `probar`: a dónde llevan «Iniciar sesión» y «Probar gratis» de arriba (Edwin, 10-oct). Sobremesa no
    // tiene panel en línea todavía: solo «Probar gratis», a su formulario; cuando lo tenga, su `entrar`.
    // `publicado: false`: no sale en la página (ni su tarjeta, ni su sección, ni sus accesos, ni sus preguntas).
    { id: 'sobremesa', glifo: 'qr-code', nombre: 'Sobremesa', resumen: 'Pedidos por QR desde la mesa, con timbre en la barra.', entrar: null, probar: '#contacto' },
    {
      id: 'vuelve',
      publicado: false, // oculta desde el 11-oct (Edwin: de momento no se ofrece); se guarda para volver a ponerla
      glifo: 'sparkle',
      nombre: 'Vuelve',
      resumen: 'Tarjeta de lealtad en el celular de tus clientes.',
      entrar: 'https://vuelve.alphateklab.com/entrar',
      probar: 'https://vuelve.alphateklab.com/registro',
    },
    { id: 'medida', glifo: 'file-text', nombre: 'A la medida', resumen: 'Comandas, facturación e inventario para tu negocio.' },
  ],
  sobremesa: {
    antetitulo: 'Pedidos desde la mesa',
    titulo: 'Del celular de la mesa a la barra, sin esperar al mesero',
    bajada:
      'Cada mesa tiene su QR impreso. Tu cliente ve el menú, elige y envía; en la barra suena el timbre y aparece «Mesa 8: 2 hamburguesas, 4 cervezas».',
    pasos: [
      { icono: 'printer', titulo: 'Imprimes los QR', texto: 'Uno por mesa, 4 por hoja carta, listos para recortar y poner en cada mesa.' },
      {
        icono: 'hand-tap',
        titulo: 'La mesa pide',
        texto: 'El cliente escanea con la cámara, ve tu menú con sus opciones, agrega notas y toca «Enviar a la barra». Sin descargar nada.',
      },
      { icono: 'bell-ringing', titulo: 'La barra lo recibe', texto: 'En la tableta o el celular de la barra suena un timbre que se repite hasta que alguien lo ve.' },
      { icono: 'check-circle', titulo: 'Marcas y entregas', texto: 'Tocas «Lo vimos» y «Entregado», y el cliente ve en su celular cómo va su pedido.' },
    ],
    funciones: [
      ['Cada QR tiene un código secreto', 'nadie pide a nombre de una mesa sin estar en ella. Si un QR se pierde, le das otro código y el viejo deja de servir.'],
      ['Tu menú, con opciones y notas', 'acompañantes, «sin cebolla», bebidas de la barra. Lo que se agota se apaga con un toque.'],
      ['Pausa cuando la cocina va a tope', 'las mesas siguen viendo el menú, pero no envían pedidos hasta que la reanudes.'],
      ['Con lo que ya tienes', 'una tableta o un celular en la barra, con internet. La pantalla se queda encendida.'],
      ['No cobra ni factura', 'la cuenta la sigues haciendo en tu sistema de siempre.'],
    ],
  },
  // Capturas reales del sistema de pedidos por QR, funcionando en un restaurante de Panamá. Sin su nombre ni su logo
  // (Edwin, 8-oct): solo el sistema.
  caso: {
    etiqueta: 'Sistema real, funcionando',
    pie: 'Pantallas reales del sistema: la carta en el celular de la mesa 8 y la barra recibiendo los pedidos de las mesas.',
    mesa: { s: 'assets/producto/food-caso-mesa-390.webp', l: 'assets/producto/food-caso-mesa-780.webp', alt: 'Celular de la mesa 8 con la carta del restaurante y 2 productos listos para enviar' },
    barra: { s: 'assets/producto/food-caso-barra-800.webp', l: 'assets/producto/food-caso-barra-1280.webp', alt: 'Tableta de la barra con los pedidos de las mesas 4, 2 y 1' },
  },
  vuelve: {
    antetitulo: 'Tarjeta de lealtad',
    titulo: 'Que vuelvan, con una tarjeta de sellos en su celular',
    bajada: 'Vuelve es la tarjeta de lealtad de tu local, en Apple Wallet y Google Wallet. Es un servicio aparte: puedes tenerlo solo o junto con Sobremesa.',
    pasos: [
      { icono: 'sparkle', titulo: 'Diseñas tu tarjeta', texto: 'De sellos o de puntos, con el nombre de tu local y tu premio.' },
      { icono: 'user-plus', titulo: 'El cliente se inscribe', texto: 'Escanea el QR del local, deja su nombre, correo y cumpleaños, y guarda la tarjeta en su Wallet.' },
      { icono: 'device-mobile', titulo: 'Suman los sellos', texto: 'El personal escanea la tarjeta con su celular y suma el sello. Al completarla, el premio.' },
      { icono: 'envelope-simple', titulo: 'Los vuelves a invitar', texto: 'Con tus clientes inscritos mandas promociones por correo y avisos que les llegan al Wallet.' },
    ],
    // Se suman a las de abajo cuando Vuelve está publicada.
    preguntas: [['¿Puedo tener solo Vuelve, sin los pedidos por QR?', 'Sí. Son dos servicios aparte: puedes tener uno, el otro o los dos.']],
  },
  medida: {
    antetitulo: 'Software a la medida',
    titulo: '¿Necesitas un sistema para gestionar comandas, facturación e inventario?',
    bajada:
      'Te lo hacemos a la medida de tu cafetería, bar o restaurante y lo conectamos con los pedidos de Sobremesa. Cuéntanos cómo trabajas hoy y lo vemos juntos.',
  },
  // Contacto por formulario (Edwin, 8-oct: sin WhatsApp). El sitio es estático: los mensajes los manda FormSubmit
  // (formsubmit.co) al `destino`, el correo que los recibe. El primer envío le llega a ese correo para activarlo; al
  // activarlo, FormSubmit da una cadena que va aquí en lugar del correo, para no dejarlo a la vista en la página.
  // Sin destino no se publica.
  formulario: {
    titulo: 'Cuéntanos de tu negocio',
    bajada: 'Déjanos tu nombre, tu correo y lo que necesitas. Te escribimos para mostrarte Sobremesa funcionando y decirte cuánto cuesta.',
    ejemplo: 'Ej.: tengo un bar con 12 mesas y quiero que pidan por QR desde la mesa.',
    asunto: 'Food: mensaje desde alphateklab.com',
    destino: '3a73a4e7fca71a1aba1ccc3921334bad', // la cadena de FormSubmit (activada el 10-oct), no el correo
    gracias: 'Recibimos tu mensaje. Te escribimos pronto a tu correo.',
    error: 'No se pudo enviar. Revisa tu conexión e inténtalo otra vez.',
  },
  preguntas: [
    ['¿Mis clientes tienen que descargar algo?', 'No. Escanean el QR con la cámara del celular y el menú se abre en el navegador.'],
    ['¿Necesito comprar equipos?', 'No. En la barra basta una tableta o un celular con internet, el que ya tengas.'],
    [
      '¿Sobremesa cobra o factura?',
      'No. Sobremesa lleva el pedido de la mesa a la barra. La cuenta la sigues haciendo en tu sistema; si quieres uno nuevo de comandas, facturación e inventario, te lo hacemos a la medida.',
    ],
    ['¿Qué pasa si alguien se lleva o fotografía un QR?', 'Desde el panel le das un código nuevo a esa mesa: el QR viejo deja de servir y se imprime el nuevo.'],
  ],
};
