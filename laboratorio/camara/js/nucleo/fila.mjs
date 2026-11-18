// Aviso de fila: si dentro de la zona hay MÁS de `maxPersonas` durante `segundos` seguidos, se abre el aviso
// «Abrir otra caja». Se cierra cuando la cuenta vuelve a `maxPersonas` o menos durante `segundosCierre` seguidos,
// para que no parpadee si alguien entra y sale del borde de la zona.
// Lo mismo al abrir: el detector pierde a una persona un instante (alguien la tapa, gira), y eso no es que la fila
// se haya acortado. Una bajada de menos de `segundosTolerancia` no reinicia la racha; una más larga, sí.

export function crearVigiaDeFila({ maxPersonas = 3, segundos = 10, segundosCierre = 3, segundosTolerancia = 1 } = {}) {
  let reglas = { maxPersonas, segundos, segundosCierre, segundosTolerancia };
  let activa = false;
  let excedeDesde = null; // primera vez (en la racha actual) que la cuenta pasó del máximo
  let caidaDesde = null; // primera vez que la cuenta bajó al máximo o menos durante una racha, antes de abrir
  let bajoDesde = null; // primera vez (en la racha actual) que la cuenta volvió al máximo o menos, con el aviso abierto
  let abiertaDesde = null;
  let maximoEnAviso = 0;
  const historial = []; // { inicio, fin, maximo }

  function actualizar(cuenta, t) {
    let cambio = null;
    const excede = cuenta > reglas.maxPersonas;
    if (excede) {
      bajoDesde = null;
      // una bajada que duró la tolerancia o más cortó la racha, aunque no hubiera otra lectura en medio
      if (caidaDesde !== null && t - caidaDesde >= reglas.segundosTolerancia * 1000) excedeDesde = null;
      caidaDesde = null;
      if (excedeDesde === null) excedeDesde = t;
      if (!activa && t - excedeDesde >= reglas.segundos * 1000) {
        activa = true;
        abiertaDesde = t;
        maximoEnAviso = cuenta;
        cambio = 'abre';
      }
    } else {
      if (!activa && excedeDesde !== null) {
        if (caidaDesde === null) caidaDesde = t;
        if (t - caidaDesde >= reglas.segundosTolerancia * 1000) {
          excedeDesde = null;
          caidaDesde = null;
        }
      } else excedeDesde = null;
      if (activa) {
        if (bajoDesde === null) bajoDesde = t;
        if (t - bajoDesde >= reglas.segundosCierre * 1000) {
          activa = false;
          historial.push({ inicio: abiertaDesde, fin: t, maximo: maximoEnAviso });
          abiertaDesde = null;
          bajoDesde = null;
          cambio = 'cierra';
        }
      }
    }
    if (activa) maximoEnAviso = Math.max(maximoEnAviso, cuenta);
    return {
      activa,
      cambio,
      cuenta,
      abiertaDesde,
      excedeDesde,
      // segundos que faltan para que salte el aviso (null si no está en camino)
      faltan: !activa && excedeDesde !== null ? Math.max(0, reglas.segundos - (t - excedeDesde) / 1000) : null,
      maximoEnAviso: activa ? maximoEnAviso : null,
    };
  }

  function configurar(nuevas) {
    reglas = { ...reglas, ...nuevas };
  }

  function reiniciar() {
    activa = false;
    excedeDesde = null;
    caidaDesde = null;
    bajoDesde = null;
    abiertaDesde = null;
    maximoEnAviso = 0;
    historial.length = 0;
  }

  return {
    actualizar,
    configurar,
    reiniciar,
    get activa() {
      return activa;
    },
    get historial() {
      return historial.map((h) => ({ ...h }));
    },
    get reglas() {
      return { ...reglas };
    },
  };
}
