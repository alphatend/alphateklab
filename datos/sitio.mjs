// Datos generales del sitio.
export const ACTUALIZADO = { iso: '2026-10-13', texto: '13 de octubre de 2026' };

// A dónde piden la prueba de Citas Médicas los doctores: WhatsApp en formato wa.me (507XXXXXXXX) y el correo completo.
// Sin ninguno de los dos, la portada no muestra el formulario de la prueba (no tendría a dónde mandarlo).
export const CONTACTO = { whatsapp: null, correo: null };

// El registro de las clínicas (servicio de cuentas, ~/alphateklab/citas-servidor). Con él, «Probar gratis» lleva a
// crear la cuenta (con el plan que la persona eligió en la calculadora); sin él (null), a la sección de la prueba.
export const REGISTRO = 'https://cuentas.alphateklab.com/registro';

// El sitio vive en la raíz de su dominio (oct-2026; antes en https://jojomunoz.github.io/alphateklab/).
export const URL_BASE = 'https://alphateklab.com/';

// IndexNow (Bing, Yandex, Seznam, Naver): la clave es pública a propósito; el sitio la sirve en /<clave>.txt para
// probar que el dominio es nuestro. `node herramientas/indexnow.mjs` avisa de las páginas del sitemap después de publicar.
export const INDEXNOW = '3c55b7b9ed6485b6e164f1eafb1e0581';
