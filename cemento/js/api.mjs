// Hablar con el servidor y seguir trabajando sin señal.
//
// Lo que se hace en campo (terminar una inspección, anotar o mover un hallazgo, sus fotos) entra primero a una cola
// guardada en el aparato (IndexedDB) y de ahí sale al servidor cuando hay señal: al abrir la app, al volver la
// conexión, al volver a la app y cada 30 s mientras queda algo. Así funciona igual en el navegador, en el iPhone
// instalado en la pantalla de inicio (que no tiene sincronización en segundo plano) y en el APK de Android.
//
// Lo que cuida:
// - Señal mala que no corta («lie-fi»): cada pedido tiene tiempo límite; si no contesta, cuenta como sin señal.
// - Pedidos repetidos: cada cosa lleva su id desde el aparato y el servidor no la duplica.
// - Un aparato compartido: cada cosa de la cola va a nombre de quien la hizo y solo sale con su sesión; si entra
//   otra persona, lo de la anterior espera (y se ve en «Por enviar»).
// - Sesión vencida con cosas en la cola: no se borra nada; se pide entrar otra vez y se sigue.
// - El servidor rechaza algo (la inspección ya no existe…): no se pierde, pasa a «no se pudo enviar», con el motivo,
//   para reintentarlo o descartarlo a mano.
// - Fotos en el iPhone: se guardan como bytes (no como Blob, que Safari pierde en IndexedDB) y se piden en
//   almacenamiento persistente para que el sistema no las borre.
// - Los datos bajados también van en IndexedDB (el logo y la historia no caben bien en localStorage).
// - Sin espacio, o navegador privado sin IndexedDB: se avisa en vez de fingir que se guardó.

const API =
  new URLSearchParams(location.search).get("api") ||
  (/^(127\.0\.0\.1)$/.test(location.hostname) && location.port !== "" ? "http://127.0.0.1:5195/api" : "https://cemento.alphateklab.com/api");
export const URL_API = API;

const LS = {
  leer(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  poner(k, v) {
    try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
  },
};
export { LS };

export const sesion = {
  get token() { return LS.leer("bp-token"); },
  set token(v) { LS.poner("bp-token", v); },
  get persona() { return LS.leer("bp-persona"); },
  set persona(v) { LS.poner("bp-persona", v); },
  /** el último usuario que entró en este aparato (para no tener que escribirlo otra vez) */
  get usuario() { return LS.leer("bp-usuario"); },
  set usuario(v) { LS.poner("bp-usuario", v); },
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
  if (r.status === 401 && ruta !== "entrar" && ruta !== "clave") {
    sesion.token = null;
    oyentesSesion.forEach((f) => f());
  }
  if (!r.ok) throw new ErrorApi(d?.error || `El servidor contestó ${r.status}.`, r.status);
  return d;
}

// ------------------------------------------------------------------------------- IndexedDB

let db = null;
const abrirDB = () =>
  (db ??= new Promise((ok) => {
    try {
      const r = indexedDB.open("bitacora-proceso", 3);
      r.onupgradeneeded = () => {
        for (const n of ["cola", "rechazados"]) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: "id" });
        if (!r.result.objectStoreNames.contains("cache")) r.result.createObjectStore("cache");
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

// ------------------------------------------------------------------------------- datos y caché

let datos = null;
const oyentes = new Set();
export const obtener = () => datos;
export const alCambiar = (f) => (oyentes.add(f), () => oyentes.delete(f));
const avisar = () => oyentes.forEach((f) => f(datos));
export const ultimaCarga = () => LS.leer("bp-cargado");

function poner(d, { guardar = true } = {}) {
  datos = d;
  if (d?.ajustes) LS.poner("bp-marca", { app_nombre: d.ajustes.app_nombre ?? "", empresa: d.ajustes.empresa ?? "" });
  if (guardar && d) base("cache", "readwrite", (s) => s.put(d, "datos")).catch(() => LS.poner("bp-datos", d));
  avisar();
}

/** Al abrir: lo último que se bajó (para trabajar sin señal) y la cola. */
export async function iniciar() {
  try { datos = (await base("cache", "readonly", (s) => s.get("datos"))) ?? LS.leer("bp-datos"); } catch { datos = LS.leer("bp-datos"); }
  // los datos de otra persona (otro usuario entró después en este aparato) no sirven
  if (datos && datos.yo?.id !== sesion.persona) datos = null;
  await leerCola();
  if (datos) datos = aplicarPendientes(datos);
  if (cola.pendientes.length) enviarCola();
}
export const marca = () => LS.leer("bp-marca") ?? {};

function recibir(d) {
  if (d.token) sesion.token = d.token; // el servidor lo renueva cuando le quedan menos de 60 días
  delete d.token;
  sesion.persona = d.yo?.id ?? sesion.persona;
  LS.poner("bp-cargado", new Date().toISOString());
  poner(aplicarPendientes(d));
}

export async function entrar(usuario, clave) {
  const d = await pedir("entrar", { metodo: "POST", datos: { usuario, clave } });
  if (sesion.persona && sesion.persona !== d.yo.id) datos = null;
  sesion.usuario = usuario;
  recibir(d);
  enviarCola();
  return d;
}

export async function cambiarClave(actual, nueva) {
  const r = await pedir("clave", { metodo: "POST", datos: { actual, nueva } });
  sesion.token = r.token;
  await refrescar();
}

export async function salir() {
  try { await desactivarPush(); } catch { /* sin señal: el aparato pasa a quien entre después */ }
  sesion.token = null;
  datos = null;
  await base("cache", "readwrite", (s) => s.delete("datos")).catch(() => {});
  LS.poner("bp-datos", null);
  avisar();
}

export async function refrescar() {
  recibir(await pedir("estado"));
  return datos;
}

/** Algo que necesita conexión (asignar, editar plantillas, usuarios…). Si no hay, lanza ErrorApi con sinRed. */
export async function escribir(ruta, cuerpo = {}) {
  const r = await pedir(ruta, { metodo: "POST", datos: cuerpo });
  if (r?.yo && r?.personas) recibir(r);
  else await refrescar().catch(() => {});
  return r;
}

export const urlMedio = (id) =>
  localUrls.has(id) ? localUrls.get(id) : `${API}/media/${encodeURIComponent(id)}?t=${encodeURIComponent(sesion.token ?? "")}`;
export const urlCalendario = (token) => `${API}/calendario/${token}.ics`;

// ------------------------------------------------------------------------------- la cola

const localUrls = new Map(); // fotos todavía en el aparato: id → object URL
export const cola = { pendientes: [], rechazados: [], enviando: false, ultimoError: null };
/** Lo de la cola que es de otra persona (espera a que esa persona entre en este aparato). */
export const deOtros = () => cola.pendientes.filter((p) => p.quien && p.quien !== sesion.persona);

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

/** Lo que está en la cola se ve ya en los datos: la inspección hecha, sus hallazgos y los cambios, aunque no haya señal. */
function aplicarPendientes(d) {
  if (!d) return d;
  for (const p of cola.pendientes) {
    if (p.tipo !== "post" || (p.quien && p.quien !== d.yo?.id)) continue;
    const m = /^inspecciones\/(.+)\/hecha$/.exec(p.ruta);
    if (m) {
      const insp = d.inspecciones.find((i) => i.id === m[1]);
      if (insp && insp.estado !== "hecha") {
        Object.assign(insp, { estado: "hecha", hecha_por: p.quien, hecha_en: p.datos.hecha_en, respuestas: p.datos.respuestas, firma: p.datos.firma ?? null,
          firma_nombre: p.datos.firma_nombre ?? null, verificaciones: p.datos.verificaciones ?? null, _sinEnviar: true });
        for (const t of p.datos.tareas ?? []) {
          const x = d.tareas?.find((y) => y.id === t.id);
          if (x && t.hecha) Object.assign(x, { estado: "hecha", hecha_por: p.quien, hecha_en: p.datos.hecha_en, nota_cierre: t.nota ?? "", _sinEnviar: true });
        }
        insp.items ??= d.plantillas.find((x) => x.id === insp.plantilla_id)?.items ?? [];
        for (const h of p.datos.hallazgos ?? []) {
          if (!d.hallazgos.some((x) => x.id === h.id)) {
            d.hallazgos.unshift({ ...h, numero: null, inspeccion_id: insp.id, equipo_id: h.equipo_id ?? insp.equipo_id, estado: "abierto", creado: p.datos.hecha_en,
              creado_por: p.quien, fotos: h.fotos ?? [], _sinEnviar: true });
          }
        }
      }
    }
    if (p.ruta === "hallazgos" && !d.hallazgos.some((x) => x.id === p.datos.id)) {
      d.hallazgos.unshift({ ...p.datos, numero: null, estado: "abierto", creado_por: p.quien, fotos: p.datos.fotos ?? [], _sinEnviar: true });
    }
    // tareas: crear o cambiar (la ruta lleva el id, o va en los datos)
    const mt = /^tareas(?:\/([^/]+))?$/.exec(p.ruta);
    if (mt && d.tareas) {
      const id = mt[1] ?? p.datos.id;
      const x = d.tareas.find((y) => y.id === id);
      const cambios = { ...p.datos, _sinEnviar: true };
      if (cambios.estado === "hecha" && x?.estado !== "hecha") Object.assign(cambios, { hecha_por: p.quien, hecha_en: p.datos.fecha ?? new Date().toISOString() });
      if (cambios.fotos && x) cambios.fotos = [...new Set([...(x.fotos ?? []), ...cambios.fotos])];
      if (x) Object.assign(x, cambios);
      else d.tareas.push({ estado: "pendiente", prioridad: "media", fotos: [], creada_por: p.quien, creada: p.datos.fecha, asignada_a: p.quien, ...cambios, id });
    }
    if (p.ruta === "entregas" && d.entregas && !d.entregas.some((x) => x.id === p.datos.id)) {
      d.entregas.unshift({ ...p.datos, de: p.quien, en: p.datos.en, recibida_por: null, _sinEnviar: true });
    }
    const mr = /^entregas\/(.+)\/recibir$/.exec(p.ruta);
    if (mr) {
      const x = d.entregas?.find((y) => y.id === mr[1]);
      if (x && !x.recibida_por) Object.assign(x, { recibida_por: p.quien, recibida_en: p.datos.en, nota_recibido: p.datos.nota ?? "", _sinEnviar: true });
    }
    const mp = /^paros(?:\/([^/]+))?$/.exec(p.ruta);
    if (mp && d.paros) {
      const id = mp[1] ?? p.datos.id;
      const x = d.paros.find((y) => y.id === id);
      if (x) Object.assign(x, p.datos, { _sinEnviar: true });
      else d.paros.unshift({ tipo: "no_programado", fin: null, creado_por: p.quien, creado: p.datos.inicio, ...p.datos, id, _sinEnviar: true });
    }
    for (const [ruta, tabla] of [["laboratorio", "laboratorio"], ["tromp", "tromp"]]) {
      if (p.ruta === ruta && d[tabla] && !d[tabla].some((x) => x.id === p.datos.id)) d[tabla].push({ ...p.datos, por: p.quien, _sinEnviar: true });
    }
    const mh = /^hallazgos\/(.+)$/.exec(p.ruta);
    if (mh) {
      const h = d.hallazgos.find((x) => x.id === mh[1]);
      if (h) {
        for (const k of ["estado", "prioridad", "accion", "responsable_id", "ot", "vence", "descripcion", "paro_id", "equipo_id"]) if (p.datos[k] !== undefined) h[k] = p.datos[k];
        if (p.datos.estado && p.datos.estado !== "paro") h.paro_id = null;
        if (p.datos.estado === "cerrado") h.cerrado ??= p.datos.fecha;
        if (p.datos.estado && p.datos.estado !== "cerrado") h.cerrado = null;
        h._sinEnviar = true;
        if (p.datos.texto || p.datos.fotos?.length || p.datos.estado) {
          if (!d.seguimientos.some((s) => s.id === p.datos.seguimiento_id)) {
            d.seguimientos.push({ id: p.datos.seguimiento_id, hallazgo_id: h.id, persona_id: p.quien, fecha: p.datos.fecha, texto: p.datos.texto ?? "",
              estado: p.datos.estado ?? null, fotos: p.datos.fotos ?? [], _sinEnviar: true });
          }
        }
      }
    }
  }
  return d;
}

/** Guarda una foto, video o audio en la cola (un Blob, o { bytes, type } si ya se tienen los bytes). Devuelve su id. */
export async function guardarMedio(medio, nombre = "") {
  const mime = medio.type || "image/jpeg";
  const medioId = `${mime.startsWith("video/") ? "v" : "f"}-${crypto.randomUUID()}`; // la letra dice cómo mostrarlo
  const bytes = medio instanceof Blob ? await medio.arrayBuffer() : medio.bytes; // ojo: los Blob nuevos también tienen .bytes(), un método
  await base("cola", "readwrite", (s) => s.put({ id: `m-${medioId}`, orden: Date.now(), tipo: "media", medioId, bytes, mime, nombre, quien: sesion.persona }));
  localUrls.set(medioId, URL.createObjectURL(medio instanceof Blob ? medio : new Blob([bytes], { type: mime })));
  pedirPersistencia();
  await leerCola();
  enviarCola();
  return medioId;
}

/** Algo que tiene que llegar aunque no haya señal ahora (terminar una inspección, un hallazgo y sus cambios). */
export async function encolar(ruta, cuerpo) {
  await base("cola", "readwrite", (s) => s.put({ id: `p-${crypto.randomUUID()}`, orden: Date.now(), tipo: "post", ruta, datos: cuerpo, quien: sesion.persona }));
  await leerCola();
  if (datos) poner(aplicarPendientes(structuredClone(datos)), { guardar: false });
  return enviarCola();
}

let enCurso = null, otraVez = false;
export function enviarCola() {
  // si ya se está mandando, lo que acaba de entrar (la firma sube y enseguida se encola la inspección) va en otra vuelta
  if (enCurso) { otraVez = true; return enCurso; }
  enCurso = (async () => {
    let enviados = 0, rechazados = 0;
    cola.enviando = true;
    avisar();
    try {
      vueltas: do {
        otraVez = false;
        await leerCola();
        for (const p of cola.pendientes) {
          if (!sesion.token) break vueltas; // sin sesión no se manda: la cola espera intacta
          if (p.quien && p.quien !== sesion.persona) continue; // de otra persona: espera a que entre
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
            if (e.sinRed || e.status === 401 || e.status === 403 && /contraseña/.test(e.message) || e.status >= 500 || e.status === 429) {
              cola.ultimoError = e.message;
              break vueltas; // se reintenta después, en el mismo orden
            }
            // lo rechazó el servidor y no se va a arreglar solo: se aparta, con el motivo, sin perderlo
            await base("rechazados", "readwrite", (s) => s.put({ ...p, motivo: e.message, rechazado: new Date().toISOString() }));
            await base("cola", "readwrite", (s) => s.delete(p.id));
            rechazados++;
          }
        }
      } while (otraVez);
    } catch (e) {
      cola.ultimoError = e.message;
    } finally {
      await leerCola();
      cola.enviando = false;
      enCurso = null;
    }
    // lo rechazado se había aplicado en la pantalla antes de mandarlo: con los datos del servidor se deshace
    if (enviados || rechazados) await refrescar().catch(() => avisar());
    else avisar();
    return { enviados, quedan: cola.pendientes.filter((p) => !p.quien || p.quien === sesion.persona).length };
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
export async function descartar(id, almacen = "rechazados") {
  await base(almacen, "readwrite", (s) => s.delete(id));
  await leerCola();
  if (datos) await refrescar().catch(() => avisar());
  else avisar();
}

let pidioPersistencia = false;
function pedirPersistencia() {
  if (pidioPersistencia) return;
  pidioPersistencia = true;
  navigator.storage?.persist?.().catch(() => {});
}

// reintentos: al volver la señal, al volver a la app y cada 30 s mientras quede algo
addEventListener("online", () => enviarCola());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  enviarCola();
  // al volver a la app, lo último (si hace más de un minuto que no se baja)
  if (sesion.token && Date.now() - Date.parse(ultimaCarga() ?? 0) > 60e3) refrescar().catch(() => {});
});
setInterval(() => cola.pendientes.length && navigator.onLine !== false && enviarCola(), 30000);

// ------------------------------------------------------------------------------- notificaciones (Web Push)

/** iPhone/iPad: solo con la app agregada a la pantalla de inicio (iOS 16.4+). */
export const esIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const instalada = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export async function estadoPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { soporta: false, motivo: esIOS && !instalada ? "agregar" : "navegador" };
  }
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return { soporta: true, permiso: Notification.permission, activa: !!sub && Notification.permission === "granted" };
}

const aBytes = (b64) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export async function activarPush() {
  if (!datos?.push_clave) throw new Error("Falta la llave del servidor: prueba con señal.");
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") throw new Error(permiso === "denied" ? "Las notificaciones están bloqueadas para esta app: actívalas en los ajustes del teléfono." : "No se dio el permiso.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // si la llave del servidor cambió, la suscripción vieja no sirve
  const llave = sub?.options?.applicationServerKey;
  if (sub && llave && btoa(String.fromCharCode(...new Uint8Array(llave))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== datos.push_clave) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(datos.push_clave) });
  await pedir("push/suscribir", { metodo: "POST", datos: { suscripcion: sub.toJSON() } });
  await refrescar().catch(() => {});
}

export async function desactivarPush() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await pedir("push/quitar", { metodo: "POST", datos: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
  await refrescar().catch(() => {});
}

// ------------------------------------------------------------------------------- borradores

/** Lo que se va llenando de una inspección se guarda en el aparato a cada cambio: si se cierra la app, sigue ahí. */
export const borrador = {
  leer: (id) => LS.leer(`bp-borrador-${id}`),
  guardar: (id, b) => LS.poner(`bp-borrador-${id}`, { ...b, guardado: new Date().toISOString() }),
  borrar: (id) => LS.poner(`bp-borrador-${id}`, null),
};
