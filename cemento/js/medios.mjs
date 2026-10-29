// Fotos, videos y dictado.
// - Las fotos se achican en el aparato (lado mayor 1600 px, JPEG): de ~4 MB a ~300 KB, para que la cola sin señal no
//   llene el teléfono y suban rápido con poca señal. Se corrige la orientación (EXIF) al dibujarlas.
// - Los videos van tal cual, hasta 20 MB (lo que acepta el servidor).
// - Dictado: el reconocimiento de voz del navegador (Chrome en Android, Safari en el iPhone). Necesita señal; sin ella,
//   o donde no existe, se dice que se use el micrófono del teclado.

const MAX_LADO = 1600;
export const MAX_VIDEO = 20 * 1024 * 1024;

export async function prepararArchivo(archivo) {
  if (archivo.type.startsWith("video/")) {
    if (archivo.size > MAX_VIDEO) throw new Error(`El video pesa ${(archivo.size / 1048576).toFixed(0)} MB: el máximo es 20 MB. Graba uno más corto (unos 30 segundos).`);
    return archivo;
  }
  if (!archivo.type.startsWith("image/")) throw new Error("Solo se pueden agregar fotos o videos.");
  try {
    const img = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const k = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(img.width * k);
    lienzo.height = Math.round(img.height * k);
    lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
    img.close?.();
    const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.82));
    if (blob && blob.size) return blob;
  } catch { /* formato que el navegador no sabe abrir (HEIC en algunos Android): se manda tal cual */ }
  if (archivo.size > MAX_VIDEO) throw new Error("La foto es demasiado grande para mandarla.");
  return archivo;
}

const Reconocimiento = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const hayDictado = !!Reconocimiento;

/** Dicta en un campo de texto: agrega lo que se dice al final. Devuelve una función para parar. */
export function dictar(campo, { alEmpezar, alTerminar, alError } = {}) {
  if (!Reconocimiento) {
    alError?.("Este aparato no dicta aquí: usa el micrófono del teclado.");
    return () => {};
  }
  if (navigator.onLine === false) {
    alError?.("Para dictar hace falta señal. Usa el micrófono del teclado, que funciona sin señal en muchos teléfonos.");
    return () => {};
  }
  const r = new Reconocimiento();
  r.lang = "es-PA";
  r.interimResults = false;
  r.continuous = false;
  r.maxAlternatives = 1;
  r.onstart = () => alEmpezar?.();
  r.onresult = (e) => {
    const texto = Array.from(e.results).map((x) => x[0].transcript).join(" ").trim();
    if (!texto) return;
    const antes = campo.value.trimEnd();
    campo.value = antes ? `${antes} ${texto}` : texto.charAt(0).toUpperCase() + texto.slice(1);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  };
  r.onerror = (e) => {
    const m = {
      "not-allowed": "No hay permiso para usar el micrófono. Dalo en los ajustes del navegador.",
      "service-not-allowed": "No hay permiso para usar el micrófono. Dalo en los ajustes del navegador.",
      network: "Para dictar hace falta señal. Usa el micrófono del teclado.",
      "no-speech": "No se oyó nada. Prueba otra vez, más cerca.",
      "audio-capture": "No se encontró el micrófono.",
    }[e.error];
    if (e.error !== "aborted") alError?.(m ?? "No se pudo dictar. Usa el micrófono del teclado.");
  };
  r.onend = () => alTerminar?.();
  try { r.start(); } catch { alError?.("No se pudo empezar a dictar."); }
  return () => { try { r.stop(); } catch { /* ya paró */ } };
}
