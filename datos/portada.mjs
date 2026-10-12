// Portada de alphateklab con todos los productos (Edwin, 8-oct-2026). La genera herramientas/generar-portada.mjs.
// Lo de cada producto sale de su propio sitio o de su propio código: aquí no se inventan precios ni cifras.

export const PORTADA = {
  // Sin «Panamá»: apuntamos también al mercado de afuera (Edwin, 10-oct).
  titulo: 'alphateklab: software para consultorios, restaurantes y empresas',
  descripcion:
    'Med para consultorios, Food para cafeterías, bares y restaurantes, y alphatend para venderle al Estado. Elige la herramienta de tu negocio.',
  heroe: {
    // La segunda frase va resaltada.
    titulo: ['Menos papeleo.', 'Más clientes.'],
    bajada: 'Herramientas para consultorios, cafeterías, bares, restaurantes y empresas que le venden al Estado. Elige la tuya:',
  },
};

/**
 * Una categoría por sección, en este orden (también el de las tarjetas de arriba). Cada una tiene su ícono de app
 * (`glifo`, del sprite) y su miniatura en la tarjeta de arriba (`mini`). `href` es relativo a la raíz del sitio (Med
 * vive en med/; «Iniciar sesión», en entrar/), salvo los de afuera (https://); `{contacto}` es el formulario de Food.
 * `ejemplo`: una captura real del sistema o una pantalla de ejemplo en HTML.
 */
export const PRODUCTOS = [
  {
    id: 'med',
    glifo: 'stethoscope',
    mini: 'med',
    sector: 'Consultorios y clínicas',
    resumen: 'El expediente se escribe mientras hablas.',
    nombre: 'Med',
    firma: 'by alphateklab',
    frase: 'El expediente se escribe mientras hablas con tu paciente.',
    puntos: [
      'Dictas la nota de la consulta y la IA la escribe, sección por sección. Tú la revisas y queda guardada.',
      'Agenda de citas con recordatorios por WhatsApp: la secretaria ya no llama paciente por paciente.',
      'Desde $14.99 al mes. Pruébalo 7 días gratis, sin tarjeta.',
    ],
    acciones: [
      { texto: 'Conocer Med', href: 'med/', tipo: 'principal' },
      // «Probar gratis» en vez de «Iniciar sesión» (Edwin, 10-oct): el registro de siempre; entrar sigue arriba.
      { texto: 'Probar gratis', href: 'registro/', tipo: 'secundaria' },
    ],
    ejemplo: {
      tipo: 'captura',
      claro: 'assets/producto/citas-nota-800.webp',
      oscuro: 'assets/producto/citas-nota-oscuro-800.webp',
      ancho: 800,
      alto: 500,
      alt: 'Pantalla de Med: la nota de la consulta, escrita con IA a partir del dictado del médico',
      pie: 'Pantalla real de Med, con un consultorio de ejemplo y pacientes ficticios.',
    },
  },
  {
    // Food reúne los pedidos por QR (Sobremesa) y el sistema a la medida; aquí no se nombran: los explica su página
    // (Edwin, 8-oct). La tarjeta de lealtad (Vuelve) está oculta desde el 11-oct: ver datos/food.mjs.
    id: 'food',
    glifo: 'fork-knife',
    mini: 'food',
    sector: 'Cafeterías, bares y restaurantes',
    resumen: 'Pedidos por QR, directo a la barra.',
    nombre: 'Food',
    firma: 'by alphateklab',
    frase: 'Tus mesas piden por QR y la barra lo ve al instante.',
    puntos: [
      'Cada mesa tiene su QR: el cliente ve el menú en su celular y envía el pedido. La barra lo recibe al instante, con timbre.',
      'Lo que se agota se apaga con un toque, y si la cocina va a tope pausas los pedidos sin esconder el menú.',
      '¿Necesitas un sistema de comandas, facturación e inventario? Te lo hacemos a la medida.',
    ],
    acciones: [
      { texto: 'Conocer Food', href: 'food/', tipo: 'principal' },
      // «Probar gratis» lleva al formulario de Food: Sobremesa no tiene alta propia (Edwin, 10-oct).
      { texto: 'Probar gratis', href: '{contacto}', tipo: 'secundaria' },
    ],
    ejemplo: { tipo: 'food', pie: 'Pantallas de ejemplo, con negocios ficticios.' },
  },
  {
    id: 'alphatend',
    glifo: 'chart-line-up',
    mini: 'alphatend',
    sector: 'Empresas que le venden al Estado',
    resumen: 'Te avisamos de cada compra del Estado.',
    nombre: 'alphatend',
    frase: 'El Estado compra lo que tú vendes. Te avisamos con monto, cierre y renglones.',
    puntos: [
      'Revisa PanamaCompra varias veces al día y te escribe solo cuando hay una compra de lo que vendes.',
      'Cada aviso trae el monto de referencia, la fecha de cierre, los renglones y el enlace al proceso oficial.',
      'Empiezas gratis, sin tarjeta.',
    ],
    acciones: [
      { texto: 'Ir a alphatend', href: 'https://alphatend.com/', tipo: 'principal' },
      // El mismo destino que «Empieza gratis, sin tarjeta» en alphatend.com (Edwin, 10-oct).
      { texto: 'Probar gratis', href: 'https://alphatend.com/entrar?gratis=1', tipo: 'secundaria' },
    ],
    ejemplo: {
      tipo: 'captura',
      claro: 'assets/producto/alphatend-800.webp',
      grande: 'assets/producto/alphatend-1280.webp',
      ancho: 800,
      alto: 500,
      alt: 'Portada de alphatend con las compras abiertas en PanamaCompra, por rubro',
      pie: 'Portada real de alphatend.com.',
    },
  },
];
