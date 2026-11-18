// «Deshacer» del editor: una pila con los estados anteriores del dibujo. Escribir en un campo de texto (un nombre)
// cuenta como un solo paso, que se registra con la primera letra que cambia, no al enfocar el campo: enfocar y salir
// sin escribir no deja nada que deshacer. Sin DOM.

const igualPorDefecto = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function crearHistorial({ maximo = 30, iguales = igualPorDefecto } = {}) {
  let pila = [];
  let pendiente = null; // el estado de antes de empezar a escribir en un campo

  function registrar(estado) {
    pendiente = null;
    if (pila.length && iguales(pila[pila.length - 1], estado)) return;
    pila.push(estado);
    if (pila.length > maximo) pila.shift();
  }

  return {
    /** Antes de un cambio: guarda el estado que se va a poder recuperar. */
    registrar,
    /** Al enfocar un campo de texto: recuerda el estado sin registrarlo todavía. */
    preparar(estado) { pendiente = estado; },
    /** En cada tecla del campo: la primera registra el estado de antes de escribir; las demás no hacen nada. */
    alEscribir() { if (pendiente !== null) registrar(pendiente); },
    /** El estado anterior que no es igual al actual (y lo saca de la pila), o null si no hay. */
    deshacer(actual) {
      pendiente = null;
      while (pila.length) {
        const e = pila.pop();
        if (!iguales(e, actual)) return e;
      }
      return null;
    },
    /** ¿Hay algo distinto del estado actual que deshacer? (para habilitar el botón) */
    hay(actual) { return pila.some((e) => !iguales(e, actual)); },
    /** Olvida todo: por ejemplo, cuando el dibujo cambió en otra pestaña y lo de antes ya no aplica. */
    vaciar() { pila = []; pendiente = null; },
    get largo() { return pila.length; },
  };
}
