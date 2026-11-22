// alphateklab, propuesta 39 («Tus números, claros»): menú, formulario, copiar el correo, pestañas, buscador
// y el tablero del héroe, que se dibuja al cargar y luego recibe una hora más de ventas cada pocos segundos.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICONOS = 'assets/iconos.svg';
  const icono = (n) => `<svg class="ico" aria-hidden="true" focusable="false"><use href="${ICONOS}#i-${n}"/></svg>`;

  /* ── cabecera: borde al bajar y menú del celular ── */
  const cabecera = document.querySelector('.cabecera');
  const abrir = document.querySelector('[data-abrir-menu]');
  const sombra = () => cabecera?.classList.toggle('con-sombra', scrollY > 8);
  addEventListener('scroll', sombra, { passive: true });
  sombra();
  const cerrarMenu = () => {
    cabecera?.classList.remove('abierta');
    abrir?.setAttribute('aria-expanded', 'false');
  };
  abrir?.addEventListener('click', () => {
    const abierta = cabecera.classList.toggle('abierta');
    abrir.setAttribute('aria-expanded', String(abierta));
  });
  document.querySelectorAll('.movil a').forEach((a) => a.addEventListener('click', cerrarMenu));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cabecera?.classList.contains('abierta')) {
      cerrarMenu();
      abrir?.focus();
    }
  });

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit (formsubmit.co), igual que en el sitio en vivo.
     Sin JavaScript, el formulario se manda solo y FormSubmit vuelve a la página (_next). _honey es la trampa para robots. ── */
  const form = document.querySelector('[data-pregunta]');
  const texto = form?.querySelector('textarea');
  const contacto = form?.querySelector('[name="contacto"]');
  const nota = form?.querySelector('[data-nota]');
  const avisar = (mensaje, error = false) => {
    nota.textContent = mensaje;
    if (error) nota.dataset.estado = 'error';
    else delete nota.dataset.estado;
  };
  const queFalta = () => {
    if (!texto.value.trim()) return 'Cuéntanos qué necesitas para preparar tu propuesta.';
    if (contacto.validity.valueMissing) return 'Déjanos tu correo para responderte.';
    if (!contacto.validity.valid) return 'Revisa tu correo: debe verse como nombre@tunegocio.com.';
    return '';
  };
  form?.addEventListener('invalid', (e) => {
    e.target.classList.add('tocado');
    avisar(queFalta(), true);
  }, true);
  form?.addEventListener('input', () => {
    if (nota.dataset.estado === 'error' && !queFalta()) avisar('');
  });
  let enviando = false;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enviando) return;
    const falta = queFalta();
    if (falta) {
      avisar(falta, true);
      return;
    }
    const boton = form.querySelector('button[type="submit"]');
    enviando = true;
    boton?.setAttribute('aria-disabled', 'true');
    avisar('Enviando…');
    const datos = Object.fromEntries(new FormData(form));
    try {
      const r = await fetch(form.dataset.ajax, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(/@/.test(datos.contacto || '') ? { ...datos, _replyto: datos.contacto } : datos),
      });
      const respuesta = await r.json().catch(() => ({}));
      if (!r.ok || String(respuesta.success) !== 'true') throw new Error(respuesta.message || `HTTP ${r.status}`);
      form.reset();
      form.querySelectorAll('.tocado').forEach((c) => c.classList.remove('tocado'));
      avisar('Recibimos tu mensaje. Te respondemos pronto a tu correo.');
    } catch {
      avisar('No se pudo enviar. Revisa tu conexión e inténtalo otra vez, o escríbenos a info@alphateklab.com.', true);
    } finally {
      enviando = false;
      boton?.removeAttribute('aria-disabled');
    }
  });
  // botones que bajan al formulario con el mensaje ya escrito
  document.querySelectorAll('[data-mensaje]').forEach((b) =>
    b.addEventListener('click', () => {
      if (texto && !texto.value.trim()) texto.value = `${b.dataset.mensaje} `;
      document.getElementById('propuesta')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth' });
      setTimeout(() => texto?.focus({ preventScroll: true }), quieto ? 0 : 500);
    }),
  );

  /* ── copiar el correo (con selección del texto si el portapapeles no responde) ── */
  document.querySelectorAll('[data-copiar]').forEach((b) =>
    b.addEventListener('click', () => {
      const correo = b.parentElement.querySelector('[data-correo]');
      const etiqueta = b.querySelector('span') || b;
      const listo = () => {
        etiqueta.textContent = 'Copiado';
        setTimeout(() => (etiqueta.textContent = 'Copiar'), 1800);
      };
      const seleccionar = () => {
        const r = document.createRange();
        r.selectNodeContents(correo);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      } else {
        seleccionar();
      }
    }),
  );

  /* ── pestañas: teclado con flechas, Inicio y Fin ── */
  document.querySelectorAll('[role="tablist"]').forEach((lista) => {
    const tabs = [...lista.querySelectorAll('[role="tab"]')];
    const elegir = (tab, enfocar) => {
      tabs.forEach((t) => {
        const si = t === tab;
        t.setAttribute('aria-selected', String(si));
        t.tabIndex = si ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !si;
      });
      if (enfocar) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => elegir(t));
      t.addEventListener('keydown', (e) => {
        const vertical = lista.getAttribute('aria-orientation') === 'vertical';
        const sig = vertical ? ['ArrowDown', 'ArrowRight'] : ['ArrowRight'];
        const ant = vertical ? ['ArrowUp', 'ArrowLeft'] : ['ArrowLeft'];
        let n = null;
        if (sig.includes(e.key)) n = tabs[(i + 1) % tabs.length];
        if (ant.includes(e.key)) n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') n = tabs[0];
        if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) {
          e.preventDefault();
          elegir(n, true);
        }
      });
    });
  });

  /* ── buscador de servicios ── */
  const buscar = document.querySelector('[data-buscar]');
  if (buscar) {
    const entrada = buscar.querySelector('input');
    const cuenta = buscar.querySelector('[data-cuenta]');
    const caja = document.querySelector('[data-resultados]');
    const lista = caja.querySelector('ul');
    const vacio = caja.querySelector('[data-vacio]');
    const titulo = caja.querySelector('h2');
    const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const vistos = new Map();
    document.querySelectorAll('[data-servicio]').forEach((a) => {
      if (!vistos.has(a.href)) vistos.set(a.href, { a, texto: sinTildes(`${a.dataset.servicio} ${a.dataset.desc || ''}`), tipo: a.dataset.tipo });
    });
    const inicial = cuenta.textContent;
    const correr = () => {
      const q = sinTildes(entrada.value.trim());
      lista.replaceChildren();
      if (q.length < 2) {
        caja.hidden = true;
        cuenta.textContent = inicial;
        return;
      }
      const palabras = q.split(/\s+/);
      const hallados = [...vistos.values()].filter((s) => palabras.every((p) => s.texto.includes(p)));
      hallados.forEach((s) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = s.a.href;
        a.target = '_blank';
        a.rel = 'noopener';
        const span = document.createElement('span');
        span.textContent = s.a.dataset.servicio;
        const small = document.createElement('small');
        small.textContent = s.tipo;
        span.append(small);
        a.append(span);
        a.insertAdjacentHTML('beforeend', icono('arrow-up-right'));
        li.append(a);
        lista.append(li);
      });
      caja.hidden = false;
      const n = hallados.length;
      titulo.textContent = n ? `${n} ${n === 1 ? 'servicio coincide' : 'servicios coinciden'} con «${entrada.value.trim()}»` : `Nada en la lista con «${entrada.value.trim()}»`;
      vacio.hidden = n > 0;
      cuenta.textContent = n ? `${n} de ${vistos.size} servicios` : `Ninguno de los ${vistos.size} servicios coincide.`;
    };
    entrada.addEventListener('input', correr);
    buscar.addEventListener('submit', (e) => {
      e.preventDefault();
      correr();
      caja.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
    });
    vacio.querySelector('a')?.addEventListener('click', () => {
      if (texto && !texto.value.trim()) texto.value = `Necesito ${entrada.value.trim()}. `;
    });
  }

  /* ── el tablero del héroe ── */
  const escena = document.querySelector('[data-escena]');
  if (escena) tablero(escena);

  function tablero(escena) {
    const app = escena.querySelector('[data-tablero]');
    const cajaLinea = app.querySelector('[data-linea]');
    const cajaBarras = app.querySelector('[data-barras]');
    const listaAvisos = app.querySelector('[data-avisos]');
    const boton = escena.querySelector('[data-pausa]');
    const vivo = app.querySelector('[data-vivo]');
    const hora = app.querySelector('[data-hora]');
    const medidor = app.querySelector('[data-medidor]');
    const kpi = (k) => app.querySelector(`[data-kpi="${k}"]`);
    const notaKpi = (k) => app.querySelector(`[data-nota-kpi="${k}"]`);
    const SVG = 'http://www.w3.org/2000/svg';

    // Curvas: las mismas de las variables --ease-out y --ease-in-out del CSS.
    const bezier = (x1, y1, x2, y2) => {
      const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
      const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
      const sx = (t) => ((ax * t + bx) * t + cx) * t;
      const sy = (t) => ((ay * t + by) * t + cy) * t;
      const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
      return (x) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let t = x;
        for (let i = 0; i < 8; i++) {
          const err = sx(t) - x;
          if (Math.abs(err) < 1e-5) return sy(t);
          const d = dx(t);
          if (Math.abs(d) < 1e-6) break;
          t -= err / d;
        }
        let lo = 0, hi = 1;
        t = x;
        for (let i = 0; i < 40 && hi - lo > 1e-6; i++) {
          if (sx(t) < x) lo = t; else hi = t;
          t = (lo + hi) / 2;
        }
        return sy(t);
      };
    };
    const SALIDA = bezier(0.23, 1, 0.32, 1);
    const CAMINO = bezier(0.77, 0, 0.175, 1);
    const SALIDA_CSS = 'cubic-bezier(0.23, 1, 0.32, 1)';

    /* Datos de ejemplo de un día de la fonda. Cada punto son las ventas de una hora: 11 = de 11 a 12. */
    const HORAS = ['11 a. m.', '12 p. m.', '1 p. m.', '2 p. m.', '3 p. m.', '4 p. m.', '5 p. m.', '6 p. m.', '7 p. m.', '8 p. m.', '9 p. m.'];
    const HOY = [64.5, 212.8, 286.4, 168.2, 74.9, 58.3, 96.7, 182.4, 248.6, 226.1, 121.3];
    const ANTES = [58, 190, 254, 176, 81, 49, 88, 160, 231, 214, 108];
    const PEDIDOS = [5, 15, 20, 12, 5, 4, 7, 13, 17, 16, 9];
    const PLATOS = ['Patacones', 'Arroz con pollo', 'Sancocho', 'Corvina frita', 'Chicha de piña'];
    // por cantidad de horas cerradas (6 = hasta las 5 p. m.)
    const VENDIDOS = { 6: [28, 24, 17, 13, 12], 7: [31, 26, 18, 15, 14], 8: [36, 30, 21, 18, 16], 9: [42, 35, 24, 21, 18], 10: [47, 39, 26, 22, 20], 11: [50, 41, 27, 22, 21] };
    const MESAS = { 6: 4, 7: 6, 8: 10, 9: 13, 10: 11, 11: 2 };
    const RELOJ = { 6: '5:00 p. m.', 7: '6:00 p. m.', 8: '7:00 p. m.', 9: '8:00 p. m.', 10: '9:00 p. m.', 11: '10:00 p. m.' };
    const LLEGAN = {
      7: ['calendar-check', '5:41 p. m.', 'Reserva para 6 personas a las 8:30 p. m. Pagó el depósito con Yappy.'],
      8: ['timer', '6:52 p. m.', 'La orden de la mesa 9 lleva 18 min en cocina.', true],
      9: ['qr-code', '7:55 p. m.', 'La mesa 4 pidió la cuenta dividida en 3 desde el QR.'],
      10: ['package', '8:46 p. m.', 'Se acabó la corvina. Ya no aparece en la carta QR.', true],
      11: ['envelope-simple', '10:00 p. m.', 'Cierre del día: B/. 1,740.20 en 123 pedidos. El resumen llegó a tu correo.'],
    };
    const INICIO = 6, FIN = 11, YMAX = 300, BMAX = 60;
    const avisosIniciales = listaAvisos.innerHTML;

    const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const balboas = (v) => `B/. ${fmt.format(v)}`;
    const suma = (arr, n) => arr.slice(0, n).reduce((a, b) => a + b, 0);
    const cifras = (n) => {
      const ventas = suma(HOY, n), pedidos = suma(PEDIDOS, n);
      return { ventas, pedidos, ticket: ventas / pedidos, mesas: MESAS[n] };
    };

    const estado = { n: INICIO, prog: INICIO - 1, antes: 1, barras: VENDIDOS[INICIO].slice(), punta: true, etiqueta: true, resalta: -1 };
    const vivas = new Set();
    const tween = (ms, curva, cada, fin) => {
      const a = { vivo: true };
      vivas.add(a);
      const t0 = performance.now();
      const cuadro = (ahora) => {
        if (!a.vivo) return;
        const p = Math.min(1, (ahora - t0) / ms);
        cada(curva(p));
        if (p < 1) requestAnimationFrame(cuadro);
        else {
          vivas.delete(a);
          fin?.();
        }
      };
      requestAnimationFrame(cuadro);
      return a;
    };
    const cancelarTodo = () => {
      vivas.forEach((a) => (a.vivo = false));
      vivas.clear();
    };
    const esperas = new Set();
    const luego = (ms, f) => {
      const id = setTimeout(() => {
        esperas.delete(id);
        f();
      }, ms);
      esperas.add(id);
    };
    const cancelarEsperas = () => {
      esperas.forEach(clearTimeout);
      esperas.clear();
    };

    /* ── gráfica de líneas: ventas por hora ── */
    const L = { svg: null };
    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta-punta';
    const globo = document.createElement('div');
    globo.className = 'globo';
    cajaLinea.append(etiqueta, globo);

    const nodo = (tag, attrs = {}, padre) => {
      const n = document.createElementNS(SVG, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      padre?.append(n);
      return n;
    };

    function montarLinea() {
      const w = cajaLinea.clientWidth, h = cajaLinea.clientHeight;
      if (!w || !h) return;
      L.svg?.remove();
      const M = { l: 36, r: 12, t: 12, b: 26 };
      const pad = 8;
      const pw = w - M.l - M.r, ph = h - M.t - M.b;
      L.X = (i) => M.l + pad + (i * (pw - pad * 2)) / 10;
      L.Y = (v) => M.t + ph * (1 - v / YMAX);
      L.M = M;
      L.w = w;
      L.h = h;
      const svg = nodo('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
      const defs = nodo('defs', {}, svg);
      const grad = nodo('linearGradient', { id: 'g-degradado', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      nodo('stop', { offset: 0, 'stop-color': '#2563eb', 'stop-opacity': 0.16 }, grad);
      nodo('stop', { offset: 1, 'stop-color': '#2563eb', 'stop-opacity': 0 }, grad);
      for (let v = 0; v <= YMAX; v += 100) {
        const y = Math.round(L.Y(v)) + 0.5;
        nodo('line', { class: v === 0 ? 'g-base' : 'g-rejilla', x1: M.l, x2: w - M.r, y1: y, y2: y }, svg);
        const t = nodo('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end' }, svg);
        t.textContent = v;
      }
      const cada = pw < 380 ? 4 : 2;
      for (let i = 0; i < HORAS.length; i += cada) {
        const t = nodo('text', { x: L.X(i), y: h - 6, 'text-anchor': 'middle' }, svg);
        t.textContent = HORAS[i];
      }
      L.antes = nodo('path', { class: 'g-antes' }, svg);
      L.area = nodo('path', { class: 'g-area' }, svg);
      L.hoy = nodo('path', { class: 'g-hoy' }, svg);
      L.cruz = nodo('line', { class: 'g-cruz', y1: M.t, y2: M.t + ph, visibility: 'hidden' }, svg);
      L.mAntes = nodo('circle', { class: 'g-marca-antes', r: 4, visibility: 'hidden' }, svg);
      L.mHoy = nodo('circle', { class: 'g-marca-hoy', r: 4, visibility: 'hidden' }, svg);
      L.halo = nodo('circle', { class: 'g-halo', r: 11 }, svg);
      L.punta = nodo('circle', { class: 'g-punta', r: 4.5 }, svg);
      cajaLinea.prepend(svg);
      L.svg = svg;
      L.antes.setAttribute('d', 'M' + ANTES.map((v, i) => `${L.X(i).toFixed(1)},${L.Y(v).toFixed(1)}`).join('L'));
      if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
        svg.addEventListener('pointermove', señalar);
        svg.addEventListener('pointerleave', soltar);
      }
    }

    function dibujarLinea() {
      if (!L.svg) return;
      const k = Math.floor(estado.prog + 1e-6), f = estado.prog - k;
      const pts = [];
      for (let i = 0; i <= k && i < HOY.length; i++) pts.push([L.X(i), L.Y(HOY[i])]);
      let valor = HOY[k];
      if (f > 1e-4 && k + 1 < HOY.length) {
        valor = HOY[k] + (HOY[k + 1] - HOY[k]) * f;
        pts.push([L.X(k + f), L.Y(valor)]);
      }
      const d = 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L');
      L.hoy.setAttribute('d', d);
      const base = L.Y(0).toFixed(1);
      const [xu, yu] = pts[pts.length - 1];
      L.area.setAttribute('d', `M${pts[0][0].toFixed(1)},${base}L${d.slice(1)}L${xu.toFixed(1)},${base}Z`);
      L.antes.style.opacity = estado.antes;
      L.punta.setAttribute('cx', xu);
      L.punta.setAttribute('cy', yu);
      L.halo.setAttribute('cx', xu);
      L.halo.setAttribute('cy', yu);
      L.punta.style.visibility = estado.punta ? 'visible' : 'hidden';
      L.halo.style.visibility = estado.punta ? 'visible' : 'hidden';
      etiqueta.textContent = balboas(valor);
      const ew = etiqueta.offsetWidth || 70, eh = etiqueta.offsetHeight || 20;
      let ex = xu - ew / 2;
      ex = Math.max(L.M.l, Math.min(L.w - ew, ex));
      let ey = yu - eh - 12;
      if (ey < 0) ey = yu + 12;
      etiqueta.style.transform = `translate(${ex.toFixed(1)}px, ${ey.toFixed(1)}px)`;
      etiqueta.classList.toggle('visible', estado.etiqueta);
    }

    function señalar(e) {
      const r = L.svg.getBoundingClientRect();
      const x = e.clientX - r.left;
      const paso = L.X(1) - L.X(0);
      const i = Math.max(0, Math.min(HOY.length - 1, Math.round((x - L.X(0)) / paso)));
      const hay = i <= Math.floor(estado.prog + 1e-6);
      const cx = L.X(i);
      L.cruz.setAttribute('x1', Math.round(cx) + 0.5);
      L.cruz.setAttribute('x2', Math.round(cx) + 0.5);
      L.cruz.setAttribute('visibility', 'visible');
      L.mAntes.setAttribute('cx', cx);
      L.mAntes.setAttribute('cy', L.Y(ANTES[i]));
      L.mAntes.setAttribute('visibility', 'visible');
      L.mHoy.setAttribute('cx', cx);
      L.mHoy.setAttribute('cy', L.Y(HOY[i]));
      L.mHoy.setAttribute('visibility', hay ? 'visible' : 'hidden');
      globo.innerHTML = `<b>De ${HORAS[i]} a ${HORAS[i + 1] || '10 p. m.'}</b><p><i></i>Hoy<span>${hay ? balboas(HOY[i]) : 'todavía no'}</span></p><p><i class="k-antes"></i>Martes pasado<span>${balboas(ANTES[i])}</span></p>`;
      const gw = globo.offsetWidth;
      const gx = cx + 14 + gw > L.w ? cx - 14 - gw : cx + 14;
      globo.style.transform = `translate(${gx.toFixed(1)}px, ${L.M.t + 4}px)`;
      globo.classList.add('visible');
    }
    function soltar() {
      L.cruz.setAttribute('visibility', 'hidden');
      L.mAntes.setAttribute('visibility', 'hidden');
      L.mHoy.setAttribute('visibility', 'hidden');
      globo.classList.remove('visible');
    }

    /* ── barras: lo más vendido ── */
    const B = { svg: null };
    function montarBarras() {
      const w = cajaBarras.clientWidth, h = cajaBarras.clientHeight;
      if (!w || !h) return;
      B.svg?.remove();
      const lw = Math.min(118, w * 0.42);
      const M = { l: lw, r: 30, t: 4, b: 26 };
      const pw = w - M.l - M.r, ph = h - M.t - M.b;
      const banda = ph / PLATOS.length;
      B.bh = Math.min(14, banda * 0.46);
      B.X = (v) => M.l + (v / BMAX) * pw;
      B.yc = (i) => M.t + banda * (i + 0.5);
      const svg = nodo('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
      for (let v = 0; v <= BMAX; v += 20) {
        const x = Math.round(B.X(v)) + 0.5;
        nodo('line', { class: v === 0 ? 'g-base' : 'g-rejilla', x1: x, x2: x, y1: M.t, y2: M.t + ph }, svg);
        const t = nodo('text', { x, y: h - 6, 'text-anchor': 'middle' }, svg);
        t.textContent = v;
      }
      B.barras = PLATOS.map((nombre, i) => {
        const t = nodo('text', { class: 't-nombre', x: 0, y: B.yc(i) + 4.5 }, svg);
        t.textContent = nombre;
        const p = nodo('path', { class: 'g-barra' }, svg);
        const v = nodo('text', { class: 't-valor', y: B.yc(i) + 4 }, svg);
        return { p, v };
      });
      cajaBarras.prepend(svg);
      B.svg = svg;
    }
    function dibujarBarras() {
      if (!B.svg) return;
      const x0 = B.X(0) + 0.5;
      B.barras.forEach(({ p, v }, i) => {
        const val = estado.barras[i];
        const x1 = Math.max(x0, B.X(val));
        const ancho = x1 - x0;
        const y0 = B.yc(i) - B.bh / 2, y1 = y0 + B.bh;
        const r = Math.min(4, ancho, B.bh / 2);
        p.setAttribute('d', ancho < 0.5 ? '' : `M${x0},${y0.toFixed(2)}H${(x1 - r).toFixed(2)}A${r},${r} 0 0 1 ${x1.toFixed(2)},${(y0 + r).toFixed(2)}V${(y1 - r).toFixed(2)}A${r},${r} 0 0 1 ${(x1 - r).toFixed(2)},${y1.toFixed(2)}H${x0}Z`);
        p.classList.toggle('resalta', estado.resalta === i);
        v.setAttribute('x', (x1 + 6).toFixed(1));
        v.textContent = Math.round(val);
        v.style.opacity = val > 0.5 ? 1 : 0;
      });
    }

    /* ── cifras de arriba ── */
    function ponerCifras(c, n) {
      kpi('ventas').textContent = balboas(c.ventas);
      kpi('pedidos').textContent = Math.round(c.pedidos);
      kpi('ticket').textContent = balboas(c.ticket || 0);
      kpi('mesas').textContent = Math.round(c.mesas);
      if (n) {
        const pct = Math.round((suma(HOY, n) / suma(ANTES, n) - 1) * 100);
        notaKpi('ventas').textContent = `${pct} % más que el martes pasado`;
        notaKpi('pedidos').textContent = `${PEDIDOS[n - 1]} en la última hora`;
      }
    }
    const contar = (desde, hasta, ms, n) =>
      tween(ms, SALIDA, (p) => {
        const c = {};
        for (const k in hasta) c[k] = desde[k] + (hasta[k] - desde[k]) * p;
        if (p >= 1) Object.assign(c, hasta);
        ponerCifras(c, null);
      }, () => ponerCifras(hasta, n));
    const ponerMedidor = (mesas) => (medidor.style.transform = `scaleX(${(mesas / 14).toFixed(4)})`);

    /* ── avisos ── */
    function crearAviso([ic, t, txt, alerta]) {
      const li = document.createElement('li');
      li.className = 'aviso' + (alerta ? ' aviso--alerta' : '');
      li.innerHTML = `<span class="aviso__ico">${icono(ic)}</span><div><p></p><time></time></div>`;
      li.querySelector('p').textContent = txt;
      li.querySelector('time').textContent = t;
      return li;
    }
    function podar() {
      const alto = listaAvisos.clientHeight;
      [...listaAvisos.children].forEach((x) => {
        if (x.offsetTop >= alto) x.remove();
      });
    }
    function llegaAviso(datos, animar) {
      const li = crearAviso(datos);
      const antes = [...listaAvisos.children];
      const arriba = antes.map((x) => x.offsetTop);
      listaAvisos.prepend(li);
      if (!animar) {
        podar();
        return;
      }
      antes.forEach((x, k) => {
        const dy = arriba[k] - x.offsetTop;
        if (dy) x.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 520, easing: SALIDA_CSS });
      });
      li.classList.add('nuevo');
      li.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 80, easing: SALIDA_CSS, fill: 'backwards' });
      luego(2400, () => li.classList.remove('nuevo'));
      luego(700, podar);
    }

    function montar() {
      montarLinea();
      montarBarras();
      dibujarLinea();
      dibujarBarras();
    }

    /* ── la secuencia ── */
    let pausado = false, visible = true, timer = 0, pendiente = null, arrancado = false;
    const puede = () => !pausado && visible && !document.hidden;
    const programar = (f, ms) => {
      pendiente = f;
      clearTimeout(timer);
      timer = 0;
      if (puede()) timer = setTimeout(correrPendiente, ms);
    };
    function correrPendiente() {
      timer = 0;
      const f = pendiente;
      pendiente = null;
      f?.();
    }
    const detener = () => {
      clearTimeout(timer);
      timer = 0;
    };
    const reanudar = () => {
      if (pendiente && !timer && puede()) timer = setTimeout(correrPendiente, 1400);
    };

    function intro() {
      arrancado = true;
      cancelarTodo();
      cancelarEsperas();
      Object.assign(estado, { n: INICIO, prog: 0, antes: 0, barras: [0, 0, 0, 0, 0], punta: false, etiqueta: false, resalta: -1 });
      vivo.classList.remove('cerrado');
      vivo.lastElementChild.textContent = 'En vivo';
      hora.textContent = RELOJ[INICIO];
      listaAvisos.innerHTML = avisosIniciales;
      const iniciales = [...listaAvisos.children];
      iniciales.forEach((li) => (li.style.opacity = 0));
      const meta = cifras(INICIO);
      ponerCifras({ ventas: 0, pedidos: 0, ticket: 0, mesas: 0 }, INICIO);
      medidor.style.transition = 'none';
      ponerMedidor(0);
      medidor.offsetWidth;
      medidor.style.transition = '';
      dibujarLinea();
      dibujarBarras();
      escena.classList.remove('reinicia');

      tween(600, SALIDA, (p) => {
        estado.antes = p;
        dibujarLinea();
      });
      luego(260, () => {
        estado.punta = true;
        tween(1800, CAMINO, (p) => {
          estado.prog = p * (INICIO - 1);
          dibujarLinea();
        }, () => {
          estado.etiqueta = true;
          dibujarLinea();
        });
      });
      luego(320, () => {
        contar({ ventas: 0, pedidos: 0, ticket: 0, mesas: 0 }, meta, 1500, INICIO);
        ponerMedidor(meta.mesas);
      });
      VENDIDOS[INICIO].forEach((meta, i) =>
        luego(480 + i * 70, () =>
          tween(1100, SALIDA, (p) => {
            estado.barras[i] = meta * p;
            dibujarBarras();
          }),
        ),
      );
      iniciales.forEach((li, i) =>
        luego(700 + i * 90, () => {
          li.style.opacity = '';
          li.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: SALIDA_CSS, fill: 'backwards' });
        }),
      );
      programar(paso, 2300 + 2800);
    }

    function paso() {
      if (estado.n >= FIN) return programar(reiniciar, 1000);
      const antes = estado.n, n = antes + 1;
      const desde = cifras(antes), hasta = cifras(n);
      estado.etiqueta = true;
      tween(1000, CAMINO, (p) => {
        estado.prog = antes - 1 + p;
        dibujarLinea();
      });
      hora.textContent = RELOJ[n];
      hora.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 400, easing: 'ease' });
      luego(260, () => {
        contar(desde, hasta, 900, n);
        ponerMedidor(hasta.mesas);
      });
      const viejo = estado.barras.slice(), nuevo = VENDIDOS[n];
      let mayor = 0;
      nuevo.forEach((v, i) => {
        if (v - viejo[i] > nuevo[mayor] - viejo[mayor]) mayor = i;
      });
      luego(320, () => {
        estado.resalta = mayor;
        tween(900, SALIDA, (p) => {
          estado.barras = viejo.map((v, i) => v + (nuevo[i] - v) * p);
          dibujarBarras();
        });
        luego(1700, () => {
          estado.resalta = -1;
          dibujarBarras();
        });
      });
      luego(420, () => llegaAviso(LLEGAN[n], true));
      estado.n = n;
      if (n === FIN) {
        luego(900, () => {
          vivo.classList.add('cerrado');
          vivo.lastElementChild.textContent = 'Día cerrado';
        });
        programar(reiniciar, 9000);
      } else {
        programar(paso, 4800);
      }
    }

    function reiniciar() {
      escena.classList.add('reinicia');
      luego(480, intro);
    }

    function estadoQuieto() {
      // movimiento reducido: el tablero queda quieto a las 8 p. m., sin repeticiones
      const n = 9;
      Object.assign(estado, { n, prog: n - 1, antes: 1, barras: VENDIDOS[n].slice(), punta: true, etiqueta: true, resalta: -1 });
      hora.textContent = RELOJ[n];
      ponerCifras(cifras(n), n);
      medidor.style.transition = 'none';
      ponerMedidor(MESAS[n]);
      for (let k = INICIO + 1; k <= n; k++) llegaAviso(LLEGAN[k], false);
      boton.hidden = true;
      escena.querySelector('.escena__pie p').textContent = 'Fonda Pixbae es un restaurante de ejemplo y sus datos son simulados.';
    }

    // medir y dibujar al tamaño real, y otra vez si cambia el ancho
    let cuadroPendiente = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(cuadroPendiente);
      cuadroPendiente = requestAnimationFrame(() => {
        montar();
        podar();
      });
    });
    ro.observe(cajaLinea);
    ro.observe(cajaBarras);

    if (quieto) {
      estadoQuieto();
      montar();
      return;
    }

    ponerMedidor(MESAS[INICIO]);
    montar();

    boton.addEventListener('click', () => {
      pausado = !pausado;
      boton.setAttribute('aria-pressed', String(pausado));
      escena.classList.toggle('en-pausa', pausado);
      if (pausado) detener();
      else reanudar();
    });

    const arrancar = () => {
      if (!arrancado && puede()) intro();
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        if (!visible) detener();
        else if (!arrancado) setTimeout(arrancar, 250);
        else reanudar();
      }, { threshold: 0.15 }).observe(escena);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) detener();
      else if (!arrancado) arrancar();
      else reanudar();
    });
    // la ventana entra con el resto del héroe; los datos empiezan cuando ya se ve
    setTimeout(arrancar, 650);
  }
})();
