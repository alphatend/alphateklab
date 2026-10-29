// Hablar con el servidor y seguir trabajando sin señal.
//
// Lo que se hace en campo (terminar una inspección, anotar un hallazgo, sus fotos) entra primero a una cola guardada
// en el aparato (IndexedDB) y de ahí sale al servidor cuando hay señal: al abrir la app, al volver la conexión, al
// volver a la app y cada 30 s mientras queda algo. Así funciona igual en el navegador, en el iPhone instalado en la
// pantalla de inicio (que no tiene sincronización en segundo plano) y en el APK de Android.
//
// Lo que cuida:
// - Señal mala que no corta («lie-fi»): cada pedido tiene tiempo límite; si no contesta, cuenta como sin señal.
// - Pedidos repetidos: cada cosa lleva su id desde el aparato y el servidor no la duplica.
// - Sesión vencida con cosas en la cola: no se borra nada; se pide entrar otra vez y se sigue.
// - El servidor rechaza algo (la inspección ya no existe…): no se pierde, pasa a «no se pudo enviar», con el motivo,
//   para reintentarlo o descartarlo a mano.
// - Fotos en el iPhone: se guardan como bytes (no como Blob, que Safari pierde en IndexedDB) y se piden en
//   almacenamiento persistente para que el sistema no las borre.
// - Sin espacio, o navegador privado sin IndexedDB: se avisa en vez de fingir que se guardó.

const API =
  new URLSearchParams(location.search).get("api") ||
  (/^(127\.0\.0\.1)$/.test(location.hostname) && location.port !== "" ? "http://127.0.0.1:5195/api" : "https://cemento.alphateklab.com/api");

const LS = {
  leer(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  poner(k, v) {
    try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
  },
};

export const sesion = {
  get token() { return LS.leer("bp-token"); },
  set token(v) { LS.poner("bp-token", v); },
  get persona() { return LS.leer("bp-persona"); },
  set persona(v) { LS.poner("bp-persona", v); },
};

export class ErrorApi extends Error {
  constructor(mensaje, status = 0) {
    super(mensaje);
    this.status = status;
    this.sinRed = status === 0;
  }
}

const oyentesSesion = new Set();
export const alVencerSesion = (f) => oyentesSesion.add(f);

async function pedir(ruta, { metodo = "GET", datos, cuerpo, tipo, limite = 25000 } = {}) {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), limite);
  let r;
  try {
    r = await fetch(`${API}/${ruta}`, {
      method: metodo,
      signal: corte.signal,
      headers: {
        ...(sesion.token ? { Authorization: `Bearer ${sesion.token}` } : {}),
        ...(datos ? { "Content-Type": "application/json" } : tipo ? { "Content-Type": tipo } : {}),
      },
      body: datos ? JSON.stringify(datos) : cuerpo,
    });
  } catch {
    throw new ErrorApi(corte.signal.aborted ? "La señal está muy mala: el servidor no contestó a tiempo." : "No hay conexión con el servidor.", 0);
  } finally {
    clearTimeout(reloj);
  }
  let d = null;
  try { d = await r.json(); } catch { /* sin cuerpo */ }
  if (r.status === 401 && ruta !== "entrar") {
    sesion.token = null;
    oyentesSesion.forEach((f) => f());
  }
  if (!r.ok) throw new ErrorApi(d?.error || `El servidor contestó ${r.status}.`, r.status);
  return d;
}

// ------------------------------------------------------------------------------- datos y caché

let datos = LS.leer("bp-datos");
const oyentes = new Set();
export const obtener = () => datos;
export const alCambiar = (f) => (oyentes.add(f), () => oyentes.delete(f));
function poner(d) {
  datos = d;
  LS.poner("bp-datos", d);
  avisar();
}
const avisar = () => oyentes.forEach((f) => f(datos));
export const ultimaCarga = () => LS.leer("bp-cargado");

export async function entrar(codigo) {
  const d = await pedir("entrar", { metodo: "POST", datos: { codigo } });
  sesion.token = d.token;
  delete d.token;
  LS.poner("bp-cargado", new Date().toISOString());
  poner(aplicarPendientes(d));
  enviarCola();
  return d;
}

export async function refrescar() {
  const d = await pedir("estado");
  LS.poner("bp-cargado", new Date().toISOString());
  poner(aplicarPendientes(d));
  return d;
}

/** Algo que necesita conexión (asignar, editar plantillas…). Si no hay, lanza ErrorApi con sinRed. */
export async function escribir(ruta, cuerpo) {
  const r = await pedir(ruta, { metodo: "POST", datos: { quien: sesion.persona, ...cuerpo } });
  if (ruta === "demo/reiniciar") {
    LS.poner("bp-cargado", new Date().toISOString());
    poner(aplicarPendientes(r));
  } else await refrescar().catch(() => {});
  return r;
}

export const urlMedio = (id) =>
  localUrls.has(id) ? localUrls.get(id) : `${API}/media/${encodeURIComponent(id)}?t=${encodeURIComponent(sesion.token ?? "")}`;

// ------------------------------------------------------------------------------- la cola

let db = null;
const abrirDB = () =>
  (db ??= new Promise((ok) => {
    try {
      const r = indexedDB.open("bitacora-proceso", 2);
      r.onupgradeneeded = () => {
        for (const n of ["cola", "rechazados"]) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: "id" });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
    } catch { ok(null); }
  }));
async function base(almacen, modo, f) {
  const b = await abrirDB();
  if (!b) throw new Error("Este navegador no deja guardar datos en el aparato (¿ventana privada?). Así no se puede trabajar sin señal.");
  return new Promise((ok, mal) => {
    const t = b.transaction(almacen, modo);
    const req = f(t.objectStore(almacen));
    t.oncomplete = () => ok(req?.result ?? null);
    t.onerror = () => mal(t.error?.name === "QuotaExceededError" ? new Error("El aparato no tiene espacio para guardar más. Libera espacio o espera a tener señal.") : t.error);
    t.onabort = () => mal(t.error ?? new Error("No se pudo guardar en el aparato."));
  });
}
export const sinAlmacen = abrirDB().then((b) => !b);

const localUrls = new Map(); // fotos todavía en el aparato: id → object URL
export const cola = { pendientes: [], rechazados: [], enviando: false, ultimoError: null };

async function leerCola() {
  try {
    cola.pendientes = ((await base("cola", "readonly", (s) => s.getAll())) ?? []).sort((a, b) => a.orden - b.orden);
    cola.rechazados = ((await base("rechazados", "readonly", (s) => s.getAll())) ?? []).sort((a, b) => a.orden - b.orden);
  } catch {
    cola.pendientes = [];
    cola.rechazados = [];
  }
  for (const p of [...cola.pendientes, ...cola.rechazados]) {
    if (p.tipo === "media" && !localUrls.has(p.medioId)) localUrls.set(p.medioId, URL.createObjectURL(new Blob([p.bytes], { type: p.mime })));
  }
}

/** Lo que está en la cola se ve ya en los datos: la inspección hecha y sus hallazgos, aunque no haya señal. */
function aplicarPendientes(d) {
  if (!d) return d;
  for (const p of cola.pendientes) {
    if (p.tipo !== "post") continue;
    const m = /^inspecciones\/(.+)\/hecha$/.exec(p.ruta);
    if (m) {
      const insp = d.inspecciones.find((i) => i.id === m[1]);
      if (insp && insp.estado !== "hecha") {
        Object.assign(insp, { estado: "hecha", hecha_por: p.datos.quien, hecha_en: p.datos.hecha_en, respuestas: p.datos.respuestas, _sinEnviar: true });
        insp.items ??= d.plantillas.find((x) => x.id === insp.plantilla_id)?.items ?? [];
        for (const h of p.datos.hallazgos ?? []) {
          if (!d.hallazgos.some((x) => x.id === h.id)) {
            d.hallazgos.unshift({ ...h, inspeccion_id: insp.id, equipo_id: insp.equipo_id, estado: "abierto", creado: p.datos.hecha_en, creado_por: p.datos.quien, fotos: h.fotos ?? [], _sinEnviar: true });
          }
        }
      }
    }
    if (p.ruta === "hallazgos" && !d.hallazgos.some((x) => x.id === p.datos.id)) {
      d.hallazgos.unshift({ ...p.datos, estado: "abierto", creado: p.datos.creado, creado_por: p.datos.quien, fotos: p.datos.fotos ?? [], _sinEnviar: true });
    }
    const mh = /^hallazgos\/(.+)$/.exec(p.ruta);
    if (mh) {
      const h = d.hallazgos.find((x) => x.id === mh[1]);
      if (h) {
        if (p.datos.estado) h.estado = p.datos.estado;
        if (p.datos.texto || p.datos.fotos?.length) {
          d.seguimientos.push({ id: p.datos.seguimiento_id, hallazgo_id: h.id, persona_id: p.datos.quien, fecha: p.datos.fecha, texto: p.datos.texto, estado: p.datos.estado ?? null, fotos: p.datos.fotos ?? [], _sinEnviar: true });
        }
      }
    }
  }
  return d;
}

/** Guarda una foto, video o audio en la cola. Devuelve su id (el que se usa en las respuestas). */
export async function guardarMedio(blob, nombre = "") {
  const medioId = `${blob.type.startsWith("video/") ? "v" : "f"}-${crypto.randomUUID()}`; // la letra dice cómo mostrarlo
  const bytes = await blob.arrayBuffer();
  await base("cola", "readwrite", (s) => s.put({ id: `m-${medioId}`, orden: Date.now(), tipo: "media", medioId, bytes, mime: blob.type || "image/jpeg", nombre }));
  localUrls.set(medioId, URL.createObjectURL(blob));
  pedirPersistencia();
  await leerCola();
  enviarCola();
  return medioId;
}

/** Algo que tiene que llegar aunque no haya señal ahora (terminar una inspección, un hallazgo y su seguimiento). */
export async function encolar(ruta, cuerpo) {
  const datosPost = { quien: sesion.persona, ...cuerpo };
  await base("cola", "readwrite", (s) => s.put({ id: `p-${crypto.randomUUID()}`, orden: Date.now(), tipo: "post", ruta, datos: datosPost }));
  await leerCola();
  if (datos) poner(aplicarPendientes(structuredClone(datos)));
  return enviarCola();
}

let enCurso = null;
export function enviarCola() {
  enCurso ??= (async () => {
    let enviados = 0;
    cola.enviando = true;
    avisar();
    try {
      await leerCola();
      for (const p of cola.pendientes) {
        if (!sesion.token) break; // sin sesión no se manda: la cola espera intacta
        try {
          if (p.tipo === "media") {
            await pedir(`media?id=${encodeURIComponent(p.medioId)}&nombre=${encodeURIComponent(p.nombre ?? "")}`, { metodo: "POST", cuerpo: p.bytes, tipo: p.mime, limite: 120000 });
          } else {
            await pedir(p.ruta, { metodo: "POST", datos: p.datos });
          }
          await base("cola", "readwrite", (s) => s.delete(p.id));
          enviados++;
          cola.ultimoError = null;
        } catch (e) {
          if (e.sinRed || e.status === 401 || e.status >= 500) {
            cola.ultimoError = e.message;
            break; // se reintenta después, en el mismo orden
          }
          // lo rechazó el servidor y no se va a arreglar solo: se aparta, con el motivo, sin perderlo
          await base("rechazados", "readwrite", (s) => s.put({ ...p, motivo: e.message, rechazado: new Date().toISOString() }));
          await base("cola", "readwrite", (s) => s.delete(p.id));
        }
      }
    } catch (e) {
      cola.ultimoError = e.message;
    } finally {
      await leerCola();
      cola.enviando = false;
      enCurso = null;
    }
    if (enviados) await refrescar().catch(() => avisar());
    else avisar();
    return { enviados, quedan: cola.pendientes.length };
  })();
  return enCurso;
}

/** Volver a mandar algo que el servidor rechazó (por ejemplo, después de corregir la causa). */
export async function reintentar(id) {
  const p = cola.rechazados.find((x) => x.id === id);
  if (!p) return;
  const { motivo, rechazado, ...limpio } = p;
  await base("cola", "readwrite", (s) => s.put({ ...limpio, orden: Date.now() }));
  await base("rechazados", "readwrite", (s) => s.delete(id));
  await leerCola();
  return enviarCola();
}
export async function descartar(id) {
  await base("rechazados", "readwrite", (s) => s.delete(id));
  await leerCola();
  avisar();
}

let pidioPersistencia = false;
function pedirPersistencia() {
  if (pidioPersistencia) return;
  pidioPersistencia = true;
  navigator.storage?.persist?.().catch(() => {});
}

// reintentos: al volver la señal, al volver a la app y cada 30 s mientras quede algo
addEventListener("online", () => enviarCola());
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && enviarCola());
setInterval(() => cola.pendientes.length && navigator.onLine !== false && enviarCola(), 30000);
leerCola().then(() => {
  if (datos) poner(aplicarPendientes(datos));
  if (cola.pendientes.length) enviarCola();
});

// ------------------------------------------------------------------------------- borradores

/** Lo que se va llenando de una inspección se guarda en el aparato a cada cambio: si se cierra la app, sigue ahí. */
export const borrador = {
  leer: (id) => LS.leer(`bp-borrador-${id}`),
  guardar: (id, b) => LS.poner(`bp-borrador-${id}`, { ...b, guardado: new Date().toISOString() }),
  borrar: (id) => LS.poner(`bp-borrador-${id}`, null),
};
