// Leer códigos QR con la cámara. Solo el lector: la vista pone el <video> y decide qué hacer con lo leído.
// - La cámara de atrás, a unos 1280 px. Se lee unas 9 veces por segundo, una lectura a la vez.
// - Donde el navegador trae su lector (BarcodeDetector con qr_code: Chrome en Android) se usa ese. Si no (iPhone,
//   Firefox, computadora), el cuadro se achica (720 px de ancho como mucho) y lo lee jsQR en un worker, fuera del hilo
//   de la página.
// - alLeer(texto) una vez por código: el mismo texto no se repite mientras se siga viendo; después de 2 s sin verlo,
//   vuelve a contar. Para parar, la función que devuelve (apaga la cámara); para sola si el <video> sale de la página.

const CADA = 100; // ms entre lecturas
const MAX_ANCHO = 720, MAX_ALTO = 960; // el cuadro que va al worker
const OLVIDO = 2000; // ms sin ver un código para volver a avisarlo

function mensajeCamara(e) {
  switch (e?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Sin permiso para la cámara: actívalo en los ajustes del navegador";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "No se encontró ninguna cámara en este aparato.";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "La cámara no responde: puede que otra app la esté usando. Ciérrala y vuelve a intentar.";
    default:
      return `No se pudo abrir la cámara${e?.message ? ` (${e.message})` : ""}.`;
  }
}

/** Un lienzo 2D para achicar el cuadro: OffscreenCanvas si hay, si no uno de la página. */
function lienzo2d() {
  try {
    const c = new OffscreenCanvas(1, 1), x = c.getContext("2d", { willReadFrequently: true });
    if (x) return [c, x];
  } catch { /* Safari viejo */ }
  const c = document.createElement("canvas");
  return [c, c.getContext("2d", { willReadFrequently: true })];
}

/** Prende la cámara en `video` y avisa cada código leído. Devuelve detener(). Si no se puede, avisa por alError y
 *  devuelve un detener() que no hace nada. */
export async function iniciarLector(video, { alLeer, alError } = {}) {
  const fallar = (m) => (alError?.(m), () => {});
  if (!globalThis.isSecureContext) return fallar("La cámara solo funciona con https: abre la app desde su dirección https://.");
  if (!navigator.mediaDevices?.getUserMedia) return fallar("Este navegador no deja usar la cámara. Prueba con Chrome o Safari.");
  let flujo;
  try {
    flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
  } catch (e) {
    return fallar(mensajeCamara(e));
  }

  let parado = false, ocupado = false, ultimo = 0, cuadro = 0, reloj = 0, n = 0;
  let visto = null, vistoEn = 0, detector = null, trabajador = null, lienzo = null, ctx = null;
  const alVolver = () => document.visibilityState === "visible" && video.paused && !parado && video.play().catch(() => {});
  const alPausar = () => !video.isConnected && detener(); // sacar el <video> de la página lo pausa: la vista se fue
  function detener() {
    if (parado) return;
    parado = true;
    if (cuadro) video.cancelVideoFrameCallback?.(cuadro);
    clearTimeout(reloj);
    for (const p of flujo.getTracks()) p.stop(); // apaga la luz de la cámara
    if (video.srcObject === flujo) video.srcObject = null;
    trabajador?.terminate();
    document.removeEventListener("visibilitychange", alVolver);
    video.removeEventListener("pause", alPausar);
  }
  const perder = (m) => {
    if (parado) return;
    detener();
    alError?.(m);
  };

  video.playsInline = true;
  video.muted = true;
  video.setAttribute("playsinline", ""); // iOS viejo
  video.srcObject = flujo;
  for (const p of flujo.getVideoTracks()) p.addEventListener("ended", () => perder("Se perdió la cámara (¿la tomó otra app?). Vuelve a abrir el lector."));
  document.addEventListener("visibilitychange", alVolver);
  video.addEventListener("pause", alPausar);
  try {
    await video.play();
  } catch (e) {
    if (!parado) return detener(), fallar(`No se pudo mostrar la cámara${e?.message ? ` (${e.message})` : ""}.`);
  }

  try {
    if (globalThis.BarcodeDetector && (await BarcodeDetector.getSupportedFormats()).includes("qr_code")) {
      detector = new BarcodeDetector({ formats: ["qr_code"] });
    }
  } catch { detector = null; }
  if (parado) return detener; // la cámara se perdió mientras arrancaba (ya se avisó)
  if (!detector) {
    try {
      trabajador = new Worker(new URL("./lector-qr-worker.js", import.meta.url));
    } catch {
      return detener(), fallar("Este navegador no puede leer códigos QR.");
    }
    trabajador.onmessage = ({ data }) => {
      ocupado = false;
      if (data?.texto) leido(data.texto);
    };
    trabajador.onerror = (e) => {
      e.preventDefault?.();
      perder("No se pudo cargar el lector de códigos QR. Recarga la página.");
    };
  }

  function leido(texto) {
    const ahora = performance.now(), repetido = texto === visto && ahora - vistoEn < OLVIDO;
    visto = texto;
    vistoEn = ahora;
    if (repetido || parado) return;
    try {
      alLeer?.(texto);
    } catch (e) {
      globalThis.reportError ? reportError(e) : console.error(e); // el error de la vista no para el lector
    }
  }

  async function leer() {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h || video.readyState < 2) return;
    ocupado = true;
    if (detector) {
      try {
        for (const c of await detector.detect(video)) if (c.rawValue) leido(c.rawValue);
      } catch { /* cuadro que no se pudo leer */ }
      ocupado = false;
      return;
    }
    const k = Math.min(1, MAX_ANCHO / w, MAX_ALTO / h), a = Math.round(w * k), b = Math.round(h * k);
    if (!lienzo) [lienzo, ctx] = lienzo2d();
    if (lienzo.width !== a || lienzo.height !== b) lienzo.width = a, lienzo.height = b;
    ctx.drawImage(video, 0, 0, a, b);
    const { data } = ctx.getImageData(0, 0, a, b);
    // uno de cada 4 también invertido (claro sobre oscuro: un QR en una pantalla en modo oscuro)
    trabajador.postMessage({ datos: data.buffer, ancho: a, alto: b, invertir: ++n % 4 === 0 }, [data.buffer]);
  }

  // con requestVideoFrameCallback se mira cada cuadro nuevo de la cámara y se lee si ya pasaron CADA ms
  const porCuadro = typeof video.requestVideoFrameCallback === "function";
  function paso() {
    cuadro = reloj = 0;
    if (parado) return;
    const ahora = performance.now();
    if (!ocupado && ahora - ultimo >= CADA - 5) {
      ultimo = ahora;
      leer().catch(() => (ocupado = false));
    }
    if (porCuadro) cuadro = video.requestVideoFrameCallback(paso);
    else reloj = setTimeout(paso, CADA);
  }
  paso();
  return detener;
}
