// La pestaña del recorrido: carga el visor 3D cuando hace falta, conecta teclado, mouse y dedos, y mantiene el
// minimapa, la ficha del ambiente y las medidas. La geometría y las reglas viven en nucleo/; el 3D en visor.mjs.

import { accionDeTecla, intencionDesdeAcciones, intencionDesdeJoystick, sumarIntenciones } from './nucleo/movimiento.mjs';
import { area as fmtArea, metros, cuenta } from './nucleo/formato.mjs';
import { crearMinimapa } from './minimapa.mjs';

export const URL_THREE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

let carga = null;
let fallos = 0;
/**
 * Descarga three.js y el visor una sola vez. Si falla, se puede reintentar: el navegador guarda el fallo de un
 * import() para esa dirección, así que el reintento pide la misma dirección con «?reintento=n».
 */
export function precargar() {
  if (!carga) {
    const q = fallos ? `?reintento=${fallos}` : '';
    carga = Promise.all([import(URL_THREE + q), import(`./visor.mjs${q}`)]).catch((e) => {
      carga = null;
      fallos += 1;
      throw e;
    });
  }
  return carga;
}

const QUIETO = { avance: 0, lateral: 0, giro: 0, correr: false };

export function crearRecorrido({ modeloEjemplo, anunciar, alVolverAlEditor, alPedirActualizar }) {
  const $ = (id) => document.getElementById(id);
  const visorEl = $('visor'), escena = $('escena'), barra = $('barra');
  const hud = $('hud-ambiente'), mini = $('minimapa'), mira = $('mira'), joy = $('joystick'), pomo = $('pomo');
  const capa = $('capa-medidas'), consejo = $('consejo');
  const estadoEl = $('estado-visor'), estadoTexto = $('estado-texto'), reintentar = $('reintentar');
  const bVista = $('b-vista'), bMedir = $('b-medir'), bBorrar = $('b-borrar-medidas'), bMouse = $('b-mouse'), bCompleta = $('b-completa');
  const cajaMedidas = $('medidas'), listaMedidas = $('lista-medidas');
  const avisoPropio = $('aviso-propio'), avisoPropioTexto = $('aviso-propio-texto'), bActualizar = $('actualizar-propio');
  const infoPropio = $('info-propio');

  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  const fondo = () => getComputedStyle(document.documentElement).getPropertyValue('--papel-2').trim() || '#e9ebe6';

  let visor = null;
  let estado = 'reposo';
  let modelo = modeloEjemplo;
  let esPropio = false;
  let propio = null; // { nombre, aviso, firma } del plano dibujado que se está recorriendo
  let firmaEditor = null; // cómo está el plano en el editor ahora (para saber si el 3D quedó viejo)
  let minimapa = null;
  let entrando = null;
  let enPantalla = true;
  let bloqueado = false;
  const consejoVisto = { arriba: false };
  let pidioArriba = false;

  // ── estados de la demo ──
  function ponerEstado(e, texto = '', conReintento = false) {
    estado = e;
    visorEl.dataset.estado = e;
    estadoEl.hidden = !(e === 'cargando' || e === 'error');
    if (texto) estadoTexto.textContent = texto;
    reintentar.hidden = !conReintento;
    barra.hidden = e !== 'listo';
    if (e === 'listo') {
      escena.tabIndex = 0;
      escena.setAttribute('role', 'application');
      escena.setAttribute('aria-roledescription', 'recorrido 3D');
    }
  }

  async function asegurarVisor() {
    if (visor) return visor;
    ponerEstado('cargando', 'Cargando el visor 3D…');
    let THREE, mod;
    try {
      [THREE, mod] = await precargar();
    } catch {
      ponerEstado('error', 'No se pudo descargar el visor 3D. Revisa tu conexión y vuelve a intentarlo; el plano y la tabla de ambientes de abajo funcionan sin él.', true);
      return null;
    }
    try { await Promise.all([document.fonts?.load('700 60px Manrope'), document.fonts?.load('500 46px Inter')]); } catch { /* las etiquetas usan la fuente de respaldo */ }
    try {
      visor = mod.crearVisor(THREE, {
        contenedor: escena,
        alCambiarAmbiente,
        alMover,
        alMedir,
        alCambiarVista,
        alError,
        reducirMovimiento: reduce,
        colorFondo: fondo,
      });
    } catch {
      ponerEstado('error', 'Tu navegador no pudo abrir gráficos 3D (WebGL está apagado o no está disponible). Prueba con otro navegador, o mira el plano y la tabla de ambientes de abajo.', false);
      return null;
    }
    visor.ponerCapaEtiquetas(capa);
    return visor;
  }

  function montar(m) {
    minimapa?.destruir();
    minimapa = null;
    visor.cargarModelo(m, { vistaInicial: 'arriba' });
    // En una pantalla táctil, el primer toque agranda el minimapa (cada ambiente mide 44 px o más) y el segundo elige.
    minimapa = crearMinimapa(mini, m, {
      alElegir: (id) => { visor?.irAAmbiente(id); escena.focus({ preventScroll: true }); },
      agrandar: () => matchMedia('(pointer: coarse)').matches,
    });
    mini.hidden = false;
    const e = visor.estado();
    minimapa.mover(e);
    minimapa.marcar(e.ambiente);
    pintarMedidas([]);
  }

  /** Entra al recorrido (descarga lo que falte). Con «ambiente», aparece ya en ese ambiente. */
  async function entrar({ ambiente = null } = {}) {
    if (estado === 'listo' && visor) {
      if (ambiente) visor.irAAmbiente(ambiente);
      // El foco va a la escena: sin esto, tras «Ir» con el teclado se quedaba en la tabla y W no movía.
      escena.focus({ preventScroll: true });
      return true;
    }
    if (entrando) return entrando;
    entrando = (async () => {
      const v = await asegurarVisor();
      if (!v) return false;
      montar(modelo);
      ponerEstado('listo');
      if (ambiente) v.irAAmbiente(ambiente, { animar: false });
      else v.entrar();
      escena.focus({ preventScroll: true });
      return true;
    })();
    try { return await entrando; } finally { entrando = null; }
  }

  // ── el aviso de arriba cuando se recorre un plano dibujado ──
  function pintarAvisoPropio(error = '') {
    avisoPropio.hidden = !esPropio;
    infoPropio.hidden = !esPropio;
    if (!esPropio) return;
    const nombre = propio.nombre || 'tu plano';
    const viejo = propio.firma != null && firmaEditor != null && firmaEditor !== propio.firma;
    const datos = `${cuenta(modelo.ambientes.length, 'ambiente')}, ${fmtArea(modelo.areaTotal)}`;
    avisoPropioTexto.textContent = error
      || (viejo
        ? `Estás recorriendo «${nombre}» como estaba al pulsar «Ver en 3D» (${datos}); después lo cambiaste.`
        : `Estás recorriendo «${nombre}»: ${datos}.${propio.aviso ? ` ${propio.aviso}` : ''}`);
    bActualizar.hidden = !viejo;
  }

  /** Cambia el plano que se recorre (el de ejemplo o uno dibujado). */
  async function cargarPlano(m, { propio: esDibujado = false, nombre = '', aviso = '', firma = null } = {}) {
    modelo = m;
    esPropio = esDibujado;
    propio = esDibujado ? { nombre, aviso, firma } : null;
    if (firma != null) firmaEditor = firma;
    pintarAvisoPropio();
    escena.setAttribute('aria-label', esDibujado ? `Recorrido 3D de tu plano «${nombre || 'tu plano'}»` : 'Recorrido 3D del apartamento de ejemplo');
    if (esDibujado) anunciar(avisoPropioTexto.textContent);
    if (estado === 'listo' && visor) {
      montar(m);
      visor.entrar();
      escena.focus({ preventScroll: true });
      return true;
    }
    return entrar();
  }

  /** El editor avisa cada cambio con la «firma» del dibujo: si no es la que se ve en 3D, el aviso lo dice. */
  function planCambiado(firma) {
    firmaEditor = firma;
    if (esPropio) pintarAvisoPropio();
  }

  // ── lo que avisa el visor ──
  function alCambiarAmbiente(amb) {
    minimapa?.marcar(amb?.id ?? null);
    if (!amb) { hud.hidden = true; return; }
    hud.hidden = false;
    hud.innerHTML = '';
    const n = document.createElement('span');
    n.className = 'visor__ambiente-nombre';
    n.textContent = amb.nombre;
    const a = document.createElement('span');
    a.className = 'visor__ambiente-area';
    a.textContent = fmtArea(amb.area);
    hud.append(n, a);
    hud.classList.remove('es-nuevo');
    void hud.offsetWidth;
    hud.classList.add('es-nuevo');
    etiquetarLienzo(amb);
    if (estado === 'listo') anunciar(`Estás en ${amb.nombre}, ${fmtArea(amb.area)}.`);
  }

  function alMover(e) { minimapa?.mover(e); }

  // El lienzo dice qué muestra (para lectores de pantalla; la escena enfocable lleva la ayuda de teclado).
  let ultimoAmbiente = null;
  function etiquetarLienzo(amb = ultimoAmbiente) {
    ultimoAmbiente = amb;
    if (!visor) return;
    const donde = amb ? `${amb.nombre}, ${fmtArea(amb.area)}` : 'fuera de los ambientes';
    visor.lienzo.setAttribute('role', 'img');
    visor.lienzo.setAttribute('aria-label', visor.vista === 'primera' ? `Vista 3D en primera persona: ${donde}.` : `Vista 3D desde arriba del plano completo; estás en ${donde}.`);
  }

  function alCambiarVista(v) {
    // El botón dice la acción que hace (ir a la otra vista) y se pinta igual en las dos: relleno parecía «activo».
    bVista.textContent = v === 'primera' ? 'Ver desde arriba' : 'Caminar por dentro';
    minimapa?.achicar();
    if (v === 'arriba' && bloqueado) document.exitPointerLock?.();
    bMouse.disabled = v !== 'primera';
    actualizarAyudas();
    etiquetarLienzo();
    if (reduce() && visor) {
      visor.lienzo.classList.add('visor__lienzo--fundido');
      requestAnimationFrame(() => requestAnimationFrame(() => visor.lienzo.classList.remove('visor__lienzo--fundido')));
    }
    if (v === 'arriba' && pidioArriba && !consejoVisto.arriba && estado === 'listo' && !visor?.midiendo) {
      consejoVisto.arriba = true;
      mostrarConsejo(mouse() ? 'Arrastra para girar la vista y usa la rueda para acercar. Haz clic en el piso para bajar a ese punto.' : 'Arrastra para girar la vista y pellizca para acercar. Toca el piso para bajar a ese punto.', 5000);
    }
  }

  // El navegador cerró el contexto WebGL (pasa en teléfonos con poca memoria): se suelta todo lo que dependía de ese
  // visor y la escena queda limpia detrás del aviso, lista para «Volver a intentarlo».
  function alError(tipo) {
    if (tipo !== 'contexto') return;
    if (bloqueado) document.exitPointerLock?.();
    acciones.clear();
    intencionJoystick = QUIETO;
    visor?.destruir();
    visor = null;
    minimapa?.destruir();
    minimapa = null;
    mostrarConsejo('');
    pintarMedidas([]);
    bMedir.setAttribute('aria-pressed', 'false');
    visorEl.dataset.midiendo = 'no';
    hud.hidden = mini.hidden = mira.hidden = joy.hidden = true;
    const teniaFoco = visorEl.contains(document.activeElement);
    ponerEstado('error', 'El navegador cerró el 3D para liberar memoria. Vuelve a intentarlo; si se repite, cierra otras pestañas o aplicaciones.', true);
    if (teniaFoco) reintentar.focus({ preventScroll: true });
  }

  // ── consejos sobre la escena ──
  let temporizadorConsejo = null;
  function mostrarConsejo(texto, ms = 0) {
    clearTimeout(temporizadorConsejo);
    consejo.textContent = texto;
    consejo.hidden = !texto;
    if (ms) temporizadorConsejo = setTimeout(() => { consejo.hidden = true; }, ms);
  }

  function actualizarAyudas() {
    if (!visor) return;
    const primera = visor.vista === 'primera';
    joy.hidden = !(primera && matchMedia('(pointer: coarse)').matches);
    mira.hidden = !(primera && (bloqueado || visor.midiendo));
  }

  // ── medir ──
  const verbo = () => (mouse() ? 'Haz clic en' : 'Toca');
  function alternarMedir(forzar) {
    if (!visor) return;
    const activo = forzar ?? !visor.midiendo;
    visor.medir(activo);
    bMedir.setAttribute('aria-pressed', String(activo));
    visorEl.dataset.midiendo = activo ? 'si' : 'no';
    if (activo) {
      mostrarConsejo(`${verbo()} el primer punto, en el piso o en una pared.`);
      anunciar('Modo medir. Con el teclado, Intro marca el punto que está en el centro de la mira.');
    } else {
      mostrarConsejo('');
    }
    actualizarAyudas();
  }

  function pintarMedidas(lista) {
    // «Borrar medidas» se esconde cuando no hay medidas: si tenía el foco, pasa a «Medir» y no se pierde en la página.
    if (!lista.length && document.activeElement === bBorrar) bMedir.focus();
    capa.innerHTML = '';
    listaMedidas.innerHTML = '';
    for (const m of lista) {
      const s = document.createElement('span');
      s.className = 'medida-etiqueta';
      s.dataset.medida = String(m.n);
      s.textContent = metros(m.distancia);
      s.hidden = true;
      capa.append(s);
      const li = document.createElement('li');
      li.value = m.n;
      li.textContent = metros(m.distancia);
      listaMedidas.append(li);
    }
    cajaMedidas.hidden = !lista.length;
    bBorrar.hidden = !lista.length;
    visor?.pedirCuadro();
  }

  function alMedir(ev) {
    if (ev.fase === 'primero') mostrarConsejo(`Ahora ${verbo().toLowerCase()} el segundo punto.`);
    else if (ev.fase === 'mismo-punto') mostrarConsejo(`Ese es el mismo punto de antes. ${verbo()} otro, un poco más lejos.`);
    else if (ev.fase === 'medida') {
      pintarMedidas(ev.medidas);
      mostrarConsejo(`${metros(ev.medida.distancia)}. ${verbo()} otro punto para medir de nuevo.`);
      anunciar(`Medida ${ev.medida.n}: ${metros(ev.medida.distancia)}.`);
    } else if (ev.fase === 'borradas') {
      pintarMedidas([]);
      if (visor?.midiendo) mostrarConsejo(`${verbo()} el primer punto, en el piso o en una pared.`);
    }
  }

  // ── pantalla completa ──
  const enCompleta = () => document.fullscreenElement === visorEl || visorEl.classList.contains('visor--maximizado');
  function actualizarCompleta() {
    bCompleta.textContent = enCompleta() ? 'Salir de pantalla completa' : 'Pantalla completa';
    visor?.redimensionar();
  }
  async function alternarCompleta() {
    if (document.fullscreenElement === visorEl) { await document.exitFullscreen?.(); return; }
    if (visorEl.classList.contains('visor--maximizado')) {
      visorEl.classList.remove('visor--maximizado');
      document.body.classList.remove('con-visor-maximizado');
      actualizarCompleta();
      return;
    }
    let nativo = false;
    if (document.fullscreenEnabled && visorEl.requestFullscreen) {
      try { await visorEl.requestFullscreen(); nativo = true; } catch { nativo = false; }
    }
    if (!nativo) {
      visorEl.classList.add('visor--maximizado');
      document.body.classList.add('con-visor-maximizado');
    }
    actualizarCompleta();
    escena.focus({ preventScroll: true });
  }

  // ── entradas ──
  const acciones = new Set();
  let intencionJoystick = QUIETO;
  function actualizarIntencion() {
    visor?.ponerIntencion(sumarIntenciones(intencionDesdeAcciones(acciones), intencionJoystick));
  }

  function conectarEntradas() {
    escena.addEventListener('keydown', (e) => {
      if (!visor || estado !== 'listo' || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === 'Escape' && minimapa?.grande) { e.preventDefault(); minimapa.achicar(); return; }
      const a = accionDeTecla(e.code);
      if (visor.vista === 'arriba') {
        const orbita = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, 24], ArrowDown: [0, -24], KeyA: [-40, 0], KeyD: [40, 0], KeyW: [0, 24], KeyS: [0, -24] }[e.code];
        if (orbita) { e.preventDefault(); visor.orbitar(...orbita); return; }
        if (e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') { e.preventDefault(); visor.acercar(0.88); return; }
        if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') { e.preventDefault(); visor.acercar(1.14); return; }
      } else if (a) {
        e.preventDefault();
        acciones.add(a);
        actualizarIntencion();
        return;
      }
      if (e.code === 'KeyV') { e.preventDefault(); alternarVista({ duracion: DUR_TECLA }); }
      else if (e.code === 'KeyM') { e.preventDefault(); alternarMedir(); }
      else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        if (visor.midiendo && visor.vista === 'primera') visor.medirEnCentro();
        else if (visor.vista === 'arriba') visor.ponerVista('primera');
      } else if (e.code === 'Escape' && visorEl.classList.contains('visor--maximizado')) alternarCompleta();
    });
    escena.addEventListener('keyup', (e) => {
      const a = accionDeTecla(e.code);
      if (a && acciones.delete(a)) actualizarIntencion();
    });
    escena.addEventListener('blur', () => { acciones.clear(); actualizarIntencion(); });

    // Punteros: joystick (pulgar izquierdo en el teléfono), mirar, girar la vista de arriba, pellizcar, tocar.
    const punteros = new Map();
    const RADIO = 56;
    let distPellizco = 0;
    escena.addEventListener('pointerdown', (e) => {
      if (!visor || estado !== 'listo') return;
      if (e.target.closest('.visor__minimapa')) return;
      minimapa?.achicar();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const r = escena.getBoundingClientRect();
      const primera = visor.vista === 'primera';
      const hayJoystick = [...punteros.values()].some((p) => p.modo === 'joystick');
      let modo = primera ? 'mirar' : 'orbitar';
      if (primera && e.pointerType !== 'mouse' && !hayJoystick && e.clientX - r.left < r.width * 0.42 && e.clientY - r.top > r.height * 0.25) modo = 'joystick';
      try { escena.setPointerCapture(e.pointerId); } catch { /* sin captura, sigue funcionando */ }
      const p = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), modo, movido: false };
      punteros.set(e.pointerId, p);
      if (modo === 'joystick') {
        const cx = Math.min(Math.max(e.clientX - r.left, RADIO + 4), r.width * 0.42);
        const cy = Math.min(Math.max(e.clientY - r.top, RADIO + 4), r.height - RADIO - 4);
        p.base = { x: r.left + cx, y: r.top + cy };
        joy.hidden = false;
        joy.style.left = `${cx - RADIO}px`;
        joy.style.top = `${cy - RADIO}px`;
        joy.style.bottom = 'auto';
        joy.classList.add('esta-activo');
      }
      if (punteros.size === 2 && !primera) {
        const [a, b] = [...punteros.values()];
        distPellizco = Math.hypot(a.x - b.x, a.y - b.y);
      }
      escena.focus({ preventScroll: true });
    });
    escena.addEventListener('pointermove', (e) => {
      const p = punteros.get(e.pointerId);
      if (!p || !visor) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > 8) p.movido = true;
      if (p.modo === 'joystick') {
        let jx = e.clientX - p.base.x, jy = e.clientY - p.base.y;
        const l = Math.hypot(jx, jy);
        if (l > RADIO) { jx = (jx / l) * RADIO; jy = (jy / l) * RADIO; }
        pomo.style.transform = `translate(${jx}px, ${jy}px)`;
        intencionJoystick = intencionDesdeJoystick(jx, jy, RADIO);
        actualizarIntencion();
      } else if (p.modo === 'mirar') {
        if (!bloqueado) visor.mirar(dx, dy);
      } else if (p.modo === 'orbitar') {
        if (punteros.size >= 2) {
          const [a, b] = [...punteros.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (distPellizco > 0 && d > 0) visor.acercar(distPellizco / d);
          distPellizco = d;
        } else visor.orbitar(dx, dy);
      }
    });
    const soltar = (e, cancelado) => {
      const p = punteros.get(e.pointerId);
      if (!p) return;
      punteros.delete(e.pointerId);
      if (punteros.size < 2) distPellizco = 0;
      if (p.modo === 'joystick') {
        intencionJoystick = QUIETO;
        actualizarIntencion();
        pomo.style.transform = '';
        joy.classList.remove('esta-activo');
        joy.style.left = joy.style.top = joy.style.bottom = '';
      }
      const toque = !cancelado && !p.movido && performance.now() - p.t0 < 450;
      if (toque && visor) visor.tocar(e.clientX, e.clientY, { centro: bloqueado });
    };
    escena.addEventListener('pointerup', (e) => soltar(e, false));
    escena.addEventListener('pointercancel', (e) => soltar(e, true));
    escena.addEventListener('wheel', (e) => {
      if (!visor || visor.vista !== 'arriba') return;
      e.preventDefault();
      visor.acercar(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
    escena.addEventListener('contextmenu', (e) => { if (estado === 'listo') e.preventDefault(); });

    // Mouse bloqueado (como en un juego): Esc lo suelta.
    bMouse.addEventListener('click', () => {
      if (bloqueado) { document.exitPointerLock?.(); return; }
      if (visor?.vista !== 'primera') return;
      const r = escena.requestPointerLock?.();
      if (r && typeof r.catch === 'function') r.catch(() => mostrarConsejo('Este navegador no dejó bloquear el mouse. Arrastra para mirar.', 4000));
    });
    document.addEventListener('pointerlockchange', () => {
      bloqueado = document.pointerLockElement === escena;
      bMouse.textContent = bloqueado ? 'Soltar el mouse (Esc)' : 'Mirar con el mouse';
      if (bloqueado) mostrarConsejo('Mueve el mouse para mirar. Esc lo suelta.', 3500);
      actualizarAyudas();
    });
    document.addEventListener('mousemove', (e) => {
      if (bloqueado && visor) visor.mirar(e.movementX, e.movementY);
    });

    bVista.addEventListener('click', () => alternarVista());
    bMedir.addEventListener('click', () => alternarMedir());
    bBorrar.addEventListener('click', () => visor?.borrarMedidas());
    bCompleta.addEventListener('click', alternarCompleta);
    document.addEventListener('fullscreenchange', actualizarCompleta);

    // Pausar cuando nadie lo ve.
    new IntersectionObserver((entradas) => {
      enPantalla = entradas[0].isIntersecting;
      visor?.pausar(!enPantalla || document.hidden);
    }).observe(escena);
    document.addEventListener('visibilitychange', () => visor?.pausar(!enPantalla || document.hidden));
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => visor?.refrescarFondo());
    matchMedia('(pointer: coarse)').addEventListener?.('change', actualizarAyudas);
  }

  // Con la tecla V la transición es más corta que con el botón: al teclado se le responde rápido.
  const DUR_TECLA = 260;
  function alternarVista({ duracion } = {}) {
    if (!visor) return;
    pidioArriba = visor.vista === 'primera';
    visor.ponerVista(visor.vista === 'primera' ? 'arriba' : 'primera', duracion ? { duracion } : undefined);
  }

  // Las entradas (teclado, punteros, botones) se conectan una sola vez, aquí: cada manejador lee «visor» al ocurrir el
  // evento. Conectarlas con cada visor nuevo (tras perder el contexto WebGL) las duplicaba y «Medir», M y V se
  // anulaban a sí mismos.
  conectarEntradas();
  reintentar.addEventListener('click', () => entrar());
  const volver = $('volver-ejemplo');
  volver.textContent = `Volver al apartamento de ${Math.round(modeloEjemplo.areaTotal)} m²`;
  volver.addEventListener('click', () => cargarPlano(modeloEjemplo, { propio: false }));
  $('seguir-editando').addEventListener('click', () => alVolverAlEditor?.());
  bActualizar.addEventListener('click', async () => {
    const r = await alPedirActualizar?.();
    if (r?.error) pintarAvisoPropio(r.error);
  });

  return {
    entrar,
    cargarPlano,
    planCambiado,
    get esPropio() { return esPropio; },
    get listo() { return estado === 'listo'; },
    /** Para el editor y la tabla: ir a un ambiente del plano de ejemplo. */
    async irAAmbienteDelEjemplo(id) {
      if (esPropio) {
        await cargarPlano(modeloEjemplo, { propio: false });
      }
      return entrar({ ambiente: id });
    },
    pausar(si) { visor?.pausar(si || !enPantalla); if (!si) visor?.redimensionar(); },
    precargar,
    /** Gancho para las pruebas (solo con ?prueba=1). */
    _visor: () => visor,
  };
}
