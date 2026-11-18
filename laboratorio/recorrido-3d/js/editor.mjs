// «Dibuja tu plano»: cuadrícula de 0.5 m donde se dibujan ambientes (arrastrando o con medidas), se nombran y se
// les ponen puertas y ventanas. Se guarda en localStorage (con versión de esquema), se sincroniza entre pestañas y
// se exporta o importa en JSON. Las reglas están en nucleo/cuadricula.mjs; aquí solo va la interfaz.

import {
  PASO, cuadriculaEjemplo, cuadriculaVacia, rectDesdeArrastre, validarAmbiente, agregarAmbiente, cambiarAmbiente,
  quitarAmbiente, aberturaDesdeToque, validarAbertura, agregarAbertura, quitarAbertura, aberturaCercana,
  ambienteEnPunto, ambientesSinPuerta, planoDesdeCuadricula, exportarJSON, importarJSON, revisarCuadricula, totales,
  tramoDe, cobertura, aberturaEnLado, sugerirNombre, avisoAlVerEn3D,
} from './nucleo/cuadricula.mjs';
import { construirModelo, TIPOS_AMBIENTE } from './nucleo/plano.mjs';
import { svgPlano } from './nucleo/svg-plano.mjs';
import { crearAlmacen } from './nucleo/almacen.mjs';
import { crearHistorial } from './nucleo/historial.mjs';
import { area as fmtArea, medidas as fmtMedidas, cuenta, leerNumero } from './nucleo/formato.mjs';

const CLAVE = 'atk-recorrido-3d:plano';
const ESQUEMA = 1;
const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const n2 = (v) => (Math.round(v * 1000) / 1000).toString();

// Con mouse se hace clic; con el dedo se toca (igual que en el recorrido).
const verbo = () => (matchMedia('(hover: hover) and (pointer: fine)').matches ? 'Haz clic en' : 'Toca');
const PISTAS = {
  ambiente: () => `Arrastra sobre la cuadrícula para dibujar un rectángulo. ${verbo()} un ambiente para elegirlo.`,
  puerta: () => `${verbo()} el borde de un ambiente para poner una puerta de 0.80 m. Entre dos ambientes se puede pasar; hacia afuera es la puerta de entrada.`,
  ventana: () => `${verbo()} un borde que dé afuera o a un balcón para poner una ventana de 1.00 m.`,
  borrar: () => `${verbo()} una puerta, una ventana o un ambiente para quitarlo. «Deshacer» lo devuelve.`,
};

export function crearEditor({ anunciar, alVerEn3D, alCambiar }) {
  const $ = (id) => document.getElementById(id);
  const raiz = document.querySelector('.editor');
  const lienzo = $('editor-lienzo'), mensaje = $('editor-mensaje'), pista = $('editor-pista');
  const lista = $('editor-lista'), vacio = $('editor-vacio'), avisos = $('editor-avisos'), total = $('editor-total');
  const nota = $('editor-nota'), bDeshacer = $('deshacer'), bVer = $('ver-3d');
  const tipoNuevo = $('tipo-nuevo'), cajaTipo = tipoNuevo.closest('.editor__tipo');
  const formAmb = $('form-ambiente'), formAb = $('form-abertura');

  const almacen = crearAlmacen(() => window.localStorage, CLAVE, ESQUEMA);
  const canal = 'BroadcastChannel' in window ? new BroadcastChannel('atk-recorrido-3d') : null;

  // Lo guardado puede no valer (otra versión, datos dañados, un ambiente que se sale): se dice, no se cambia en silencio.
  const guardado = leerGuardado();
  let c = guardado?.cuadricula ?? cuadriculaEjemplo();
  const historial = crearHistorial({ maximo: 30 });
  let herramienta = 'ambiente';
  let elegido = null;
  let arrastre = null;

  /** { cuadricula } si había un dibujo guardado que se puede abrir, { error } si había uno que no, null si nada. */
  function leerGuardado() {
    const { valor, motivo } = almacen.leerDetalle();
    if (motivo) return { error: motivo };
    if (!valor) return null;
    const r = revisarCuadricula(valor);
    return r.error ? { error: r.error } : { cuadricula: r.cuadricula };
  }

  /** La «firma» del dibujo: el recorrido la compara con la del plano que muestra en 3D. */
  const firma = () => JSON.stringify(c);
  const avisarCambio = () => alCambiar?.(firma());

  // ── mensajes ──
  function decir(texto, tipo = '', destino = mensaje) {
    destino.textContent = texto;
    destino.className = `editor__mensaje${tipo ? ` es-${tipo}` : ''}`;
  }

  // ── cambios con deshacer, guardado y aviso a las otras pestañas ──
  function cambiar(nueva, { sinHistorial = false } = {}) {
    if (nueva === c) return;
    if (!sinHistorial) historial.registrar(c);
    c = nueva;
    if (elegido && !c.ambientes.some((a) => a.id === elegido)) elegido = null;
    guardar();
    pintar();
    avisarCambio();
  }

  function guardar() {
    const ok = almacen.guardar(c);
    nota.textContent = ok
      ? 'Tu dibujo se guarda solo en este navegador; no se envía a ningún lado.'
      : 'Este navegador no deja guardar datos: tu dibujo se pierde al cerrar la pestaña. Descarga una copia para no perderlo.';
    canal?.postMessage({ tipo: 'plano-guardado' });
  }

  canal?.addEventListener('message', (e) => {
    if (e.data?.tipo !== 'plano-guardado' || arrastre) return;
    const otro = leerGuardado()?.cuadricula;
    if (!otro) return;
    c = otro;
    // Lo que había para deshacer era de antes del cambio de la otra pestaña: deshacerlo la borraría sin avisar.
    historial.vaciar();
    pintar();
    avisarCambio();
    decir('Se actualizó con lo que dibujaste en otra pestaña. «Deshacer» empieza de nuevo desde aquí.');
  });

  // ── dibujo ──
  let svg = null;
  let capaPrevia = null;

  function aMetros(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: m.x, y: m.y };
  }

  function pintarSvg() {
    const W = c.ancho, H = c.largo, M = 0.75; // margen para la regla de metros (en el teléfono, con letra más grande)
    const partes = [];
    partes.push(`<svg viewBox="${-M} ${-M} ${W + 2 * M} ${H + 2 * M}" xmlns="${NS}" role="img" aria-label="Cuadrícula de dibujo de ${W} × ${H} m. Sin mouse, usa los formularios «Agregar un ambiente con medidas» y «Agregar una puerta o ventana con medidas».">`);
    partes.push(`<rect class="ed-fondo" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`);
    partes.push('<g class="ed-cuadricula" aria-hidden="true">');
    for (let x = 0; x <= W + 1e-9; x += PASO) partes.push(`<line class="ed-linea${Math.abs(x % 1) < 1e-9 ? ' ed-linea--metro' : ''}" x1="${n2(x)}" y1="0" x2="${n2(x)}" y2="${H}"/>`);
    for (let y = 0; y <= H + 1e-9; y += PASO) partes.push(`<line class="ed-linea${Math.abs(y % 1) < 1e-9 ? ' ed-linea--metro' : ''}" x1="0" y1="${n2(y)}" x2="${W}" y2="${n2(y)}"/>`);
    for (let x = 0; x <= W; x += 2) partes.push(`<text class="ed-regla" x="${x}" y="-0.18" text-anchor="middle">${x}</text>`);
    for (let y = 2; y <= H; y += 2) partes.push(`<text class="ed-regla" x="-0.2" y="${y}" text-anchor="end" dominant-baseline="central">${y}</text>`);
    partes.push(`<text class="ed-regla" x="${W}" y="${H + 0.42}" text-anchor="end">metros</text>`);
    partes.push('</g>');
    if (c.ambientes.length) {
      try {
        const modelo = construirModelo(planoDesdeCuadricula(c));
        // Con los rótulos compactos que usa el teléfono (el CSS elige unos u otros según el ancho).
        partes.push(`<g class="ed-plano">${svgPlano(modelo, { cotas: false, soloContenido: true, compactas: true })}</g>`);
      } catch (e) {
        decir(`El dibujo tiene un problema: ${e.message}`, 'error');
      }
    } else {
      partes.push(`<text class="ed-vacio" x="${W / 2}" y="${H / 2}" text-anchor="middle">Arrastra aquí para dibujar el primer ambiente</text>`);
    }
    partes.push('<g class="ed-previa-capa"></g></svg>');
    lienzo.innerHTML = partes.join('');
    svg = lienzo.querySelector('svg');
    capaPrevia = svg.querySelector('.ed-previa-capa');
    if (elegido) svg.querySelector(`.pl-piso[data-ambiente="${CSS.escape(elegido)}"]`)?.classList.add('es-elegido');
  }

  function previaRect(p0, p1) {
    const r = rectDesdeArrastre(p0, p1, c);
    const error = r.ancho && r.largo ? validarAmbiente(r, c) : 'muy chico';
    capaPrevia.innerHTML = r.ancho && r.largo
      ? `<rect class="ed-previa${error ? ' ed-previa--mal' : ''}" x="${r.x}" y="${r.y}" width="${r.ancho}" height="${r.largo}"/>` +
        `<text class="ed-previa-texto" x="${n2(r.x + r.ancho / 2)}" y="${n2(r.y + r.largo / 2)}" text-anchor="middle" dominant-baseline="central">${esc(fmtMedidas(r.ancho, r.largo))}</text>`
      : '';
    return { r, error };
  }

  function previaAbertura(p) {
    const ab = aberturaDesdeToque(p, c, herramienta);
    if (!ab || ab.error) { capaPrevia.innerHTML = ''; return; }
    const t = tramoDe(ab);
    const mal = validarAbertura(ab, c);
    const [x1, y1, x2, y2] = ab.orientacion === 'h' ? [t.desde, t.fijo, t.hasta, t.fijo] : [t.fijo, t.desde, t.fijo, t.hasta];
    capaPrevia.innerHTML = `<line class="ed-abertura-previa${mal ? ' ed-abertura-previa--mal' : ''}" x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}"/>`;
  }

  lienzo.addEventListener('pointerdown', (e) => {
    if (!svg || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = aMetros(e);
    arrastre = { id: e.pointerId, p0: p, p1: p, movido: false, x0: e.clientX, y0: e.clientY };
    try { lienzo.setPointerCapture(e.pointerId); } catch { /* sigue sin captura */ }
    if (herramienta === 'ambiente') e.preventDefault();
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!svg) return;
    const p = aMetros(e);
    if (arrastre && arrastre.id === e.pointerId) {
      arrastre.p1 = p;
      if (Math.hypot(e.clientX - arrastre.x0, e.clientY - arrastre.y0) > 6) arrastre.movido = true;
      if (herramienta === 'ambiente' && arrastre.movido) previaRect(arrastre.p0, p);
    } else if ((herramienta === 'puerta' || herramienta === 'ventana') && e.pointerType === 'mouse') {
      previaAbertura(p);
    }
  });
  lienzo.addEventListener('pointerleave', () => { if (!arrastre && capaPrevia) capaPrevia.innerHTML = ''; });
  lienzo.addEventListener('pointercancel', () => { arrastre = null; if (capaPrevia) capaPrevia.innerHTML = ''; });
  lienzo.addEventListener('pointerup', (e) => {
    if (!arrastre || arrastre.id !== e.pointerId) return;
    const a = arrastre;
    arrastre = null;
    capaPrevia.innerHTML = '';
    const p = aMetros(e);
    if (herramienta === 'ambiente' && a.movido) return terminarRect(a.p0, p);
    tocar(p);
  });

  function terminarRect(p0, p1) {
    const r = rectDesdeArrastre(p0, p1, c);
    if (!r.ancho || !r.largo) return decir('Arrastra un poco más: cada lado tiene que medir al menos 1 m.', 'error');
    const tipo = tipoNuevo.value;
    const res = agregarAmbiente(c, { ...r, tipo, nombre: sugerirNombre(c, tipo) });
    if (res.error) return decir(res.error, 'error');
    elegido = res.ambiente.id;
    cambiar(res.cuadricula);
    decir(`Agregaste «${res.ambiente.nombre}» de ${fmtMedidas(r.ancho, r.largo)} (${fmtArea(r.ancho * r.largo)}). Cambia el nombre en la lista.`, 'ok');
    anunciar(`Agregaste ${res.ambiente.nombre}.`);
  }

  function tocar(p) {
    if (herramienta === 'puerta' || herramienta === 'ventana') {
      const ab = aberturaDesdeToque(p, c, herramienta);
      if (!ab) return decir(`${verbo()} más cerca del borde de un ambiente para poner la ${herramienta}.`, 'error');
      if (ab.error) return decir(ab.error, 'error');
      const res = agregarAbertura(c, ab);
      if (res.error) return decir(res.error, 'error');
      cambiar(res.cuadricula);
      const t = tramoDe(res.abertura);
      const { ambientes } = cobertura(c, res.abertura.orientacion, t.fijo, t.desde, t.hasta);
      const donde = ambientes.length >= 2 ? `entre «${ambientes[0].nombre}» y «${ambientes[1].nombre}»` : `en «${ambientes[0]?.nombre ?? 'el ambiente'}», hacia afuera`;
      decir(`Pusiste una ${herramienta} ${donde}.`, 'ok');
      return;
    }
    if (herramienta === 'borrar') {
      const ab = aberturaCercana(p, c);
      if (ab) {
        cambiar(quitarAbertura(c, ab.id));
        return decir(`Quitaste una ${ab.tipo}. «Deshacer» la devuelve.`, 'ok');
      }
      const amb = ambienteEnPunto(p, c);
      if (amb) {
        cambiar(quitarAmbiente(c, amb.id));
        return decir(`Quitaste «${amb.nombre}». «Deshacer» lo devuelve.`, 'ok');
      }
      return decir('Ahí no hay nada que quitar.', '');
    }
    const amb = ambienteEnPunto(p, c);
    elegido = amb?.id ?? null;
    pintar();
    if (amb) {
      decir(`Elegiste «${amb.nombre}».`);
      document.getElementById(`n-${amb.id}`)?.focus({ preventScroll: true });
    }
  }

  // ── lista de ambientes ──
  function opcionesTipo(sel) {
    return Object.entries(TIPOS_AMBIENTE).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v.nombre)}</option>`).join('');
  }

  function pintarLista() {
    const activo = document.activeElement?.id;
    lista.innerHTML = c.ambientes
      .map((a) => `<li class="editor__item${a.id === elegido ? ' es-elegido' : ''}" data-id="${esc(a.id)}">
        <label class="sr" for="n-${esc(a.id)}">Nombre del ambiente</label>
        <input id="n-${esc(a.id)}" type="text" maxlength="40" value="${esc(a.nombre)}" data-campo="nombre" autocomplete="off" />
        <button class="boton boton--linea boton--chico" type="button" data-quitar>Quitar<span class="sr"> ${esc(a.nombre)}</span></button>
        <div class="editor__item-datos">
          <label class="sr" for="t-${esc(a.id)}">Tipo de ${esc(a.nombre)}</label>
          <select id="t-${esc(a.id)}" data-campo="tipo">${opcionesTipo(a.tipo)}</select>
          <span>${esc(fmtMedidas(a.ancho, a.largo))}</span><span>${esc(fmtArea(a.ancho * a.largo))}</span>
        </div>
      </li>`)
      .join('');
    vacio.hidden = c.ambientes.length > 0;
    if (activo) document.getElementById(activo)?.focus({ preventScroll: true });
  }

  lista.addEventListener('input', (e) => {
    const li = e.target.closest('[data-id]');
    if (!li || e.target.dataset.campo !== 'nombre') return;
    // El nombre se cambia sin redibujar la lista, para no perder el foco mientras se escribe.
    const res = cambiarAmbiente(c, li.dataset.id, { nombre: e.target.value });
    if (!res.error) {
      historial.alEscribir();
      c = res.cuadricula;
      guardar();
      pintarSvg();
      pintarResumen();
      avisarCambio();
    }
  });
  // Un solo paso de «Deshacer» por cada vez que se edita un nombre (no uno por letra). Al enfocar solo se recuerda
  // el estado; se registra con la primera letra: enfocar y salir no deja un «Deshacer» que no deshace nada.
  lista.addEventListener('focusin', (e) => {
    if (e.target.dataset?.campo === 'nombre') historial.preparar(c);
  });
  lista.addEventListener('change', (e) => {
    const li = e.target.closest('[data-id]');
    if (!li) return;
    if (e.target.dataset.campo === 'nombre' && !e.target.value.trim()) {
      const amb = c.ambientes.find((a) => a.id === li.dataset.id);
      const nombre = sugerirNombre({ ...c, ambientes: c.ambientes.filter((a) => a.id !== amb.id) }, amb.tipo);
      cambiar(cambiarAmbiente(c, amb.id, { nombre }).cuadricula, { sinHistorial: true });
      decir(`Un ambiente no puede quedar sin nombre: le puse «${nombre}».`);
    } else if (e.target.dataset.campo === 'tipo') {
      const res = cambiarAmbiente(c, li.dataset.id, { tipo: e.target.value });
      if (!res.error) cambiar(res.cuadricula);
    }
  });
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-quitar]');
    if (!b) return;
    const li = b.closest('[data-id]');
    const amb = c.ambientes.find((a) => a.id === li.dataset.id);
    cambiar(quitarAmbiente(c, amb.id));
    decir(`Quitaste «${amb.nombre}». «Deshacer» lo devuelve.`, 'ok');
    anunciar(`Quitaste ${amb.nombre}.`);
    (lista.querySelector('input') ?? $('ver-3d')).focus();
  });

  function pintarResumen() {
    const t = totales(c);
    total.textContent = t.ambientes ? fmtArea(t.total) : '';
    const sinPuerta = ambientesSinPuerta(c);
    const puertas = c.aberturas.filter((a) => a.tipo === 'puerta').length;
    const ventanas = c.aberturas.filter((a) => a.tipo === 'ventana').length;
    const items = sinPuerta.map((a) => `«${esc(a.nombre)}» no tiene puerta hacia otro ambiente: en 3D no vas a poder entrar.`);
    if (t.ambientes && !c.aberturas.some((a) => a.tipo === 'ventana')) items.push('No hay ventanas: en 3D no vas a ver por dónde entra la luz.');
    avisos.innerHTML = items.map((x) => `<li>${x}</li>`).join('');
    if (t.ambientes) {
      const li = document.createElement('li');
      li.className = 'editor__conteo';
      li.textContent = `${cuenta(t.ambientes, 'ambiente')}, ${cuenta(puertas, 'puerta')} y ${cuenta(ventanas, 'ventana')}. Interior: ${fmtArea(t.interior)}${t.exterior ? `; balcón: ${fmtArea(t.exterior)}` : ''}.`;
      avisos.prepend(li);
    }
    bVer.disabled = !t.ambientes;
    bVer.title = t.ambientes ? '' : 'Dibuja al menos un ambiente';
    bDeshacer.disabled = !historial.hay(c);
    // selector de ambientes del formulario de puertas
    const sel = $('fp-ambiente');
    const antes = sel.value;
    sel.innerHTML = c.ambientes.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join('');
    if (c.ambientes.some((a) => a.id === antes)) sel.value = antes;
    else if (elegido) sel.value = elegido;
  }

  const campoNombre = $('editor-nombre');
  function pintar() {
    pintarSvg();
    pintarLista();
    pintarResumen();
    if (document.activeElement !== campoNombre) campoNombre.value = c.nombre;
  }
  campoNombre.addEventListener('focus', () => historial.preparar(c));
  campoNombre.addEventListener('input', () => {
    historial.alEscribir();
    c = { ...c, nombre: campoNombre.value.slice(0, 60) };
    guardar();
    bDeshacer.disabled = !historial.hay(c);
    avisarCambio();
  });
  campoNombre.addEventListener('change', () => {
    if (!campoNombre.value.trim()) { c = { ...c, nombre: 'Tu plano' }; campoNombre.value = c.nombre; guardar(); avisarCambio(); }
  });

  // ── herramientas ──
  for (const r of document.querySelectorAll('input[name="herramienta"]')) {
    r.addEventListener('change', () => {
      herramienta = r.value;
      raiz.dataset.herramienta = herramienta;
      pista.textContent = PISTAS[herramienta]();
      cajaTipo.hidden = herramienta !== 'ambiente';
      if (capaPrevia) capaPrevia.innerHTML = '';
      decir('');
    });
  }
  raiz.dataset.herramienta = herramienta;

  // ── formularios sin mouse ──
  // Los campos de metros son de texto con teclado decimal: un type="number" se traga la coma («2,5» llegaba como 25)
  // y uno vacío llegaba como 0. Aquí se acepta la coma y un campo vacío o mal escrito se pide de nuevo.
  function leerCampos(form, campos, salida) {
    const valores = {};
    for (const [nombre, etiqueta] of campos) {
      const v = leerNumero(form.elements[nombre].value);
      if (!Number.isFinite(v)) {
        decir(`Escribe «${etiqueta}» en metros, con números; por ejemplo, 2.5.`, 'error', salida);
        form.elements[nombre].focus();
        return null;
      }
      valores[nombre] = v;
    }
    return valores;
  }
  const msgAmb = Object.assign(document.createElement('p'), { className: 'editor__mensaje' });
  msgAmb.setAttribute('role', 'status');
  formAmb.append(msgAmb);
  const msgAb = Object.assign(document.createElement('p'), { className: 'editor__mensaje' });
  msgAb.setAttribute('role', 'status');
  formAb.append(msgAb);
  $('fa-tipo').innerHTML = opcionesTipo('recamara');

  formAmb.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(formAmb);
    const medidas = leerCampos(formAmb, [['x', 'Desde la izquierda'], ['y', 'Desde arriba'], ['ancho', 'Ancho'], ['largo', 'Largo']], msgAmb);
    if (!medidas) return;
    const datos = { nombre: f.get('nombre'), tipo: f.get('tipo'), ...medidas };
    const res = agregarAmbiente(c, datos);
    if (res.error) return decir(res.error, 'error', msgAmb);
    elegido = res.ambiente.id;
    cambiar(res.cuadricula);
    decir(`Agregaste «${res.ambiente.nombre}» (${fmtMedidas(datos.ancho, datos.largo)}).`, 'ok', msgAmb);
    formAmb.reset();
    $('fa-tipo').value = 'recamara';
  });

  formAb.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(formAb);
    const amb = c.ambientes.find((a) => a.id === f.get('ambiente'));
    const pos = leerCampos(formAb, [['pos', 'Centro a cuántos metros de la esquina']], msgAb);
    if (!pos) return;
    const ab = aberturaEnLado(amb, f.get('lado'), pos.pos, f.get('tipo'));
    if (ab.error) return decir(ab.error, 'error', msgAb);
    const res = agregarAbertura(c, ab);
    if (res.error) return decir(res.error, 'error', msgAb);
    cambiar(res.cuadricula);
    decir(`Pusiste una ${ab.tipo} en «${amb.nombre}».`, 'ok', msgAb);
  });

  // ── acciones ──
  bDeshacer.addEventListener('click', () => {
    const anterior = historial.deshacer(c);
    if (!anterior) {
      pintarResumen();
      return decir('No hay cambios para deshacer.');
    }
    c = anterior;
    if (elegido && !c.ambientes.some((a) => a.id === elegido)) elegido = null;
    guardar();
    pintar();
    avisarCambio();
    decir('Deshiciste el último cambio.');
  });

  $('restablecer').addEventListener('click', () => {
    cambiar(cuadriculaEjemplo());
    elegido = null;
    pintar();
    decir('Volviste al plano de muestra. Si fue sin querer, «Deshacer» trae tu dibujo de vuelta.', 'ok');
  });

  $('vaciar').addEventListener('click', () => {
    cambiar({ ...cuadriculaVacia(c.ancho, c.largo), nombre: 'Tu plano' });
    decir('Cuadrícula en blanco. «Deshacer» trae de vuelta lo que había.', 'ok');
  });

  $('exportar').addEventListener('click', () => {
    if (!c.ambientes.length) return decir('No hay nada que exportar todavía: dibuja al menos un ambiente.', 'error');
    const nombre = `plano-${(c.nombre || 'tu-plano').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tu-plano'}.json`;
    const blob = new Blob([exportarJSON(c)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    decir(`Se descargó ${nombre}. Para volver a abrirlo, usa «Cargar una copia».`, 'ok');
  });

  $('importar').addEventListener('change', async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (archivo.size > 1_000_000) return decir('Ese archivo pesa más de 1 MB; un plano exportado de aquí pesa unos pocos KB. Revisa que sea el correcto.', 'error');
    let texto;
    try { texto = await archivo.text(); } catch { return decir('No se pudo leer el archivo. Vuelve a intentarlo.', 'error'); }
    const res = importarJSON(texto);
    if (res.error) return decir(`No se importó: ${res.error}`, 'error');
    elegido = null;
    cambiar(res.cuadricula);
    decir(`Importaste «${res.cuadricula.nombre}»: ${cuenta(res.cuadricula.ambientes.length, 'ambiente')}. «Deshacer» vuelve a lo que tenías.`, 'ok');
  });

  /** El plano listo para el 3D, con lo que conviene saber antes de entrar; o { error } si no se puede. */
  function modeloParaVer() {
    if (!c.ambientes.length) return { error: 'Tu plano no tiene ambientes: dibuja al menos uno para verlo en 3D.' };
    try {
      return { modelo: construirModelo(planoDesdeCuadricula(c)), nombre: c.nombre, aviso: avisoAlVerEn3D(c), firma: firma() };
    } catch (err) {
      return { error: `No se puede ver en 3D: ${err.message}` };
    }
  }

  bVer.addEventListener('click', () => {
    const r = modeloParaVer();
    if (r.error) return decir(r.error, 'error');
    decir('Abriendo en 3D.');
    alVerEn3D(r);
  });

  pintar();
  pista.textContent = PISTAS[herramienta]();
  nota.textContent = almacen.disponible()
    ? 'Tu dibujo se guarda solo en este navegador; no se envía a ningún lado.'
    : 'Este navegador no deja guardar datos: tu dibujo se pierde al cerrar la pestaña. Descarga una copia para no perderlo.';
  const t = totales(c);
  if (guardado?.error) {
    const motivo = guardado.error.replace(/^./, (l) => l.toUpperCase()).replace(/([^.])$/, '$1.');
    decir(`No se pudo abrir el dibujo que tenías guardado en este navegador. ${motivo} Te muestro el plano de muestra; tu próximo cambio reemplaza lo guardado.`, 'error');
  } else if (t.ambientes) {
    decir(`Tienes ${cuenta(t.ambientes, 'ambiente')}, ${fmtArea(t.total)}${guardado?.cuadricula ? ' (guardados en este navegador)' : ''}.`);
  }

  return {
    modeloParaVer,
    get firma() { return firma(); },
    /** Para las pruebas */
    get cuadricula() { return c; },
  };
}
