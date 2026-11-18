// Tiempo de escena de un video que se repite. El seguimiento y la fila miden en el tiempo de lo que pasa delante de
// la cámara: con un video, ese es su currentTime, no el reloj (si la demo lo baja a 0,25×, un segundo de video dura
// cuatro de reloj). Cuando el video vuelve a empezar (o salta hacia atrás), el tiempo sigue creciendo: así una pista,
// el aviso de fila o el mapa de calor nunca ven el tiempo ir para atrás.

export function crearRelojDeVideo({ pasoAlVolverMs = 40 } = {}) {
  let base = 0;
  let ultimo = null; // último currentTime leído, en ms

  /** `segundos` es video.currentTime. Devuelve ms de escena, siempre crecientes (o iguales si el video no avanzó). */
  function leer(segundos) {
    const ms = Math.max(0, Number(segundos) || 0) * 1000;
    if (ultimo !== null && ms < ultimo) base += ultimo - ms + pasoAlVolverMs;
    ultimo = ms;
    return base + ms;
  }

  function reiniciar() {
    base = 0;
    ultimo = null;
  }

  return { leer, reiniciar };
}
