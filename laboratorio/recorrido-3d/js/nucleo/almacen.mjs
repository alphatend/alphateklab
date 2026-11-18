// localStorage con versión de esquema. Cada lectura y escritura va en try/catch: en una ventana privada, con los
// datos del sitio bloqueados o en una vista previa, el acceso puede lanzar y la página tiene que seguir funcionando.

export function crearAlmacen(obtenerStorage, clave, version) {
  let memoria = null; // respaldo en memoria cuando no hay localStorage
  const storage = () => {
    try { return obtenerStorage() ?? null; } catch { return null; }
  };
  /**
   * Lo guardado y, si había algo que no se pudo leer, por qué (para decirlo en vez de cambiarlo en silencio).
   * { valor: null, motivo: null } quiere decir que no hay nada guardado.
   */
  function leerDetalle() {
    let texto = null;
    const s = storage();
    if (s) {
      try { texto = s.getItem(clave); } catch { texto = null; }
    } else texto = memoria;
    if (!texto) return { valor: null, motivo: null };
    let datos;
    try { datos = JSON.parse(texto); } catch { return { valor: null, motivo: 'los datos están dañados' }; }
    if (!datos || typeof datos !== 'object') return { valor: null, motivo: 'los datos están dañados' };
    if (datos.esquema !== version) return { valor: null, motivo: `se guardó con otra versión del editor (${datos.esquema ?? 'sin versión'})` };
    return { valor: datos.valor ?? null, motivo: null };
  }
  return {
    leerDetalle,
    leer: () => leerDetalle().valor,
    /** ¿Este navegador deja guardar? (en una ventana privada o con los datos del sitio bloqueados, no). */
    disponible() {
      const s = storage();
      if (!s) return false;
      try { s.setItem(`${clave}:prueba`, '1'); s.removeItem(`${clave}:prueba`); return true; } catch { return false; }
    },
    /** Devuelve true si quedó guardado en el navegador; false si solo quedó en memoria. */
    guardar(valor) {
      const texto = JSON.stringify({ esquema: version, guardado: new Date().toISOString(), valor });
      memoria = texto;
      const s = storage();
      if (!s) return false;
      try { s.setItem(clave, texto); return true; } catch { return false; }
    },
    borrar() {
      memoria = null;
      const s = storage();
      if (!s) return;
      try { s.removeItem(clave); } catch { /* sin localStorage no hay nada que borrar */ }
    },
  };
}
