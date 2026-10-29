// El lector de QR fuera del hilo de la página: recibe un cuadro de la cámara ya achicado (RGBA) y contesta con el texto
// del código, o null si no hay. Worker clásico, para cargar jsQR (que no es módulo) con importScripts.
// Mensaje: { datos: ArrayBuffer RGBA, ancho, alto, invertir } → { texto }. Con invertir prueba también claro sobre oscuro.
importScripts("vendor/jsQR.js");

self.onmessage = ({ data: { datos, ancho, alto, invertir } }) => {
  let texto = null;
  try {
    // jsQR 1.4.0 falla con "onlyInvert": se usa "attemptBoth", que prueba normal y después invertido
    const r = self.jsQR(new Uint8ClampedArray(datos), ancho, alto, { inversionAttempts: invertir ? "attemptBoth" : "dontInvert" });
    texto = r && r.data ? r.data : null;
  } catch { /* cuadro que jsQR no sabe leer: como si no hubiera código */ }
  self.postMessage({ texto });
};
