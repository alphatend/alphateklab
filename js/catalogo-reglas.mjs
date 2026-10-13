// Reglas del catálogo. Las usa el generador (no genera si fallan) y las pruebas.
// Sin dependencias del DOM ni de node: recibe una función para saber si existe un archivo.

// Únicos precios decididos por los socios (chat del 23 y 25-sep-2026). Cualquier otro precio es inventado.
// El otro precio decidido, las fotos del recorrido 3D (+$300), se fue con el servicio: desde oct-2026 solo software.
export const PRECIOS_DECIDIDOS = { R01: '$10 al mes' };

export const REPOS_DEMO = ['https://alphatend.github.io/alphateklab-mesa/', 'https://alphatend.github.io/alphateklab-reservas/'];

// Muletillas y restos que delatan texto sin revisar (guía sin slop §2.2 y §4).
export const PALABRAS_PROHIBIDAS = [
  /\bcrucial/i,
  /\bfundamental/i,
  /cabe destacar/i,
  /sum[eé]rgete/i,
  /desbloquea/i,
  /\bno es solo\b/i,
  /\bno solo\b.*\bsino\b/i,
  /lorem/i,
  /\bTODO\b/,
  /\[[^\]]*\]/,
  /aquí tienes/i,
  /de vanguardia/i,
  /soluciones integrales/i,
  /experiencia (única|inolvidable)/i,
  /—/, // raya larga: en este sitio no se usa
];

export function textoDelServicio(s) {
  return [s.nombre, s.corto, s.para, ...(s.incluye || []), ...(s.equipo || []), s.precio?.texto, s.precio?.nota, s.aparte].filter(Boolean).join('\n');
}

export function validarCatalogo({ SECTORES, TIPOS, SERVICIOS, DEMOS = [] }, existe = () => true) {
  const errores = [];
  const sectores = new Set(SECTORES.map((s) => s.id));
  const tipos = new Set(TIPOS.map((t) => t.id));
  const ids = new Set();
  const slugs = new Set();

  for (const s of SERVICIOS) {
    const q = s.id || '(sin id)';
    if (!/^[A-Z]\d{2}$/.test(s.id || '')) errores.push(`${q}: el código debe ser una letra y dos cifras`);
    if (ids.has(s.id)) errores.push(`${q}: código repetido`);
    ids.add(s.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.slug || '')) errores.push(`${q}: slug inválido «${s.slug}»`);
    if (slugs.has(s.slug)) errores.push(`${q}: slug repetido «${s.slug}»`);
    slugs.add(s.slug);
    if (!s.nombre) errores.push(`${q}: sin nombre`);
    if (!s.corto || s.corto.length > 30) errores.push(`${q}: el nombre corto falta o pasa de 30 caracteres`);
    if (!s.para || s.para.length < 40 || s.para.length > 260) errores.push(`${q}: «para» debe tener entre 40 y 260 caracteres`);
    if (!Array.isArray(s.incluye) || s.incluye.length < 2) errores.push(`${q}: «incluye» necesita al menos 2 renglones`);
    if (!Array.isArray(s.equipo)) errores.push(`${q}: «equipo» debe ser una lista (vacía si no hay)`);
    // Solo software (oct-2026): nada se instala, no se va a tomar fotos ni a escanear, y lo que necesita un equipo usa el
    // que el negocio ya tiene (eso va en «necesitas» de la ficha, no aquí).
    if (s.instala) errores.push(`${q}: dice que se instala, y alphateklab hace solo software`);
    if (s.visita) errores.push(`${q}: pide ir a la propiedad (fotos, escaneo), y alphateklab hace solo software`);
    if (s.equipo?.length) errores.push(`${q}: lista equipo, y alphateklab no vende ni instala equipos`);
    if (!s.sectores?.length || s.sectores.some((x) => !sectores.has(x))) errores.push(`${q}: sector desconocido`);
    if (!s.tipos?.length || s.tipos.some((x) => !tipos.has(x))) errores.push(`${q}: tipo desconocido`);
    const letra = { restaurantes: 'R', comercio: 'C', salud: 'S', hospedaje: 'H', inmuebles: 'B', educacion: 'E', servicios: 'V', todos: 'T' }[s.sectores?.[0]];
    if (letra && s.id?.[0] !== letra) errores.push(`${q}: el código debe empezar con ${letra} por su sector principal`);
    if (typeof s.instala !== 'boolean') errores.push(`${q}: «instala» debe ser true o false`);

    if (s.precio !== null) {
      if (PRECIOS_DECIDIDOS[s.id] !== s.precio?.texto) errores.push(`${q}: precio «${s.precio?.texto}» no decidido por los socios`);
    } else if (PRECIOS_DECIDIDOS[s.id]) {
      errores.push(`${q}: falta el precio decidido «${PRECIOS_DECIDIDOS[s.id]}»`);
    }

    if (s.demo) {
      if (/^https?:\/\//.test(s.demo)) {
        if (!REPOS_DEMO.some((r) => s.demo.startsWith(r))) errores.push(`${q}: la demo apunta fuera de los repos de alphateklab`);
      } else if (!existe(s.demo.replace(/#.*$/, '').replace(/\/?$/, '/') + 'index.html')) {
        errores.push(`${q}: la demo «${s.demo}» no existe en el repo`);
      }
    }

    const texto = textoDelServicio(s);
    for (const re of PALABRAS_PROHIBIDAS) if (re.test(texto)) errores.push(`${q}: texto con «${texto.match(re)[0]}»`);
  }

  for (const d of DEMOS) {
    if (!d.url || !d.nombre || !d.que || !d.prueba) errores.push(`demo ${d.clave}: faltan campos`);
    for (const id of d.servicios || []) if (!ids.has(id)) errores.push(`demo ${d.clave}: servicio ${id} no existe`);
    if (!/^https?:\/\//.test(d.url) && !existe(d.url.replace(/\/?$/, '/') + 'index.html')) errores.push(`demo ${d.clave}: «${d.url}» no existe en el repo`);
    if (d.imagen && !existe(d.imagen)) errores.push(`demo ${d.clave}: falta la captura ${d.imagen}`);
  }
  return errores;
}
