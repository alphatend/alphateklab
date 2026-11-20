// alphateklab, propuesta 16. Todo lo que se mueve aquí es un negocio de ejemplo con datos simulados.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const cuando = (el, fn, umbral = 0.45) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { threshold: umbral });
    io.observe(el);
  };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ── cabecera: un filete al bajar ── */
  const cab = $('[data-cabecera]');
  let pend = false;
  const marcar = () => { pend = false; cab?.classList.toggle('con-borde', scrollY > 8); };
  addEventListener('scroll', () => { if (!pend) { pend = true; requestAnimationFrame(marcar); } }, { passive: true });
  marcar();

  /* ── anclas de la misma página: bajan con suavidad (el foco del teclado no se anima) ── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2 || e.metaKey || e.ctrlKey) return;
    const destino = document.getElementById(a.getAttribute('href').slice(1));
    if (!destino) return;
    e.preventDefault();
    destino.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
    history.pushState(null, '', a.getAttribute('href'));
    const campo = destino.querySelector('textarea');
    if (campo && matchMedia('(pointer: fine)').matches) setTimeout(() => campo.focus({ preventScroll: true }), quieto ? 0 : 500);
  });

  /* ── menú del teléfono ── */
  const botonMenu = $('[data-menu]');
  const menu = $('#menu-movil');
  const cerrarMenu = (foco) => {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    botonMenu.setAttribute('aria-expanded', 'false');
    botonMenu.querySelector('span').textContent = 'Menú';
    if (foco) botonMenu.focus();
  };
  botonMenu?.addEventListener('click', () => {
    const abrir = menu.hidden;
    menu.hidden = !abrir;
    botonMenu.setAttribute('aria-expanded', String(abrir));
    botonMenu.querySelector('span').textContent = abrir ? 'Cerrar' : 'Menú';
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenu(true); });
  $$('a', menu || document.createElement('div')).forEach((a) => a.addEventListener('click', () => cerrarMenu(false)));
  matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) cerrarMenu(false); });

  /* ── copiar el correo (con selección del texto si el portapapeles no responde) ── */
  $$('[data-copiar]').forEach((b) =>
    b.addEventListener('click', () => {
      const correo = b.parentElement.querySelector('[data-correo]');
      const etiqueta = b.querySelector('span');
      const listo = () => {
        etiqueta.textContent = 'Copiado';
        b.classList.add('hecho');
        setTimeout(() => { etiqueta.textContent = 'Copiar'; b.classList.remove('hecho'); }, 1800);
      };
      const seleccionar = () => {
        const r = document.createRange();
        r.selectNodeContents(correo);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      else seleccionar();
    }),
  );

  /* ── el formulario: no se envía; dice por dónde llega ── */
  $$('[data-formulario]').forEach((f) =>
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const nota = f.querySelector('[data-nota]');
      nota.querySelector('span').textContent = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
      nota.classList.remove('vista');
      void nota.offsetWidth;
      nota.classList.add('vista');
    }),
  );

  /* ── FLIP: mueve lo que cambió de lugar y deja entrar lo nuevo ── */
  const posicion = (el, raiz) => {
    let x = 0, y = 0, n = el;
    while (n && n !== raiz) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y };
  };
  const flip = (raiz, nodos, cambiar, animar) => {
    const antes = new Map();
    if (animar) nodos.forEach((el, id) => { if (el.isConnected) antes.set(id, posicion(el, raiz)); });
    const nuevos = cambiar();
    if (!animar) return;
    nodos.forEach((el, id) => {
      if (!el.isConnected) return;
      if (nuevos.has(id) || !antes.has(id)) {
        el.classList.remove('llega');
        void el.offsetWidth;
        el.classList.add('llega');
        return;
      }
      const a = antes.get(id), b = posicion(el, raiz);
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 560, easing: EASE });
    });
  };

  /* ── héroe: la pantalla de cocina y el teléfono ── */
  const cocina = $('[data-cocina]');
  if (cocina) {
    const PLATOS = {
      m4: ['Mesa 4', [[2, 'Patacones con ceviche'], [1, 'Chicha de piña']]],
      m7: ['Mesa 7', [[1, 'Tamal de olla'], [2, 'Hojaldras']], 'Sin cebolla'],
      pl: ['Para llevar', [[1, 'Sancocho de gallina'], [3, 'Carimañolas']]],
      m2: ['Mesa 2', [[1, 'Corvina frita'], [1, 'Limonada']]],
      m9: ['Mesa 9', [[2, 'Arroz con pollo'], [2, 'Limonadas']]],
    };
    const AVISOS = {
      ayer: ['Resumen de ayer', '58 personas, 37 pedidos y B/. 548.10 en ventas.', 'blanco'],
      p4: ['Mesa 4 hizo un pedido', '2 patacones con ceviche y 1 chicha de piña. B/. 9.50', 'blanco'],
      nev: ['Aviso: la nevera 2 subió a 8.9 °C', 'La puerta lleva 6 minutos abierta.'],
      p9: ['Mesa 9 hizo un pedido', '2 arroz con pollo y 2 limonadas. B/. 13.00', 'blanco'],
    };
    const ESTADOS = [
      { nuevos: [], prep: [['m7', 'hace 9 min', 72], ['pl', 'hace 4 min', 38]], listos: [['m2']], avisos: [['ayer', '8:00 a. m.']] },
      { nuevos: [['m4', 'ahora']], prep: [['m7', 'hace 9 min', 74], ['pl', 'hace 4 min', 40]], listos: [['m2']], avisos: [['p4', 'ahora'], ['ayer', '8:00 a. m.']] },
      { nuevos: [['m4', 'hace 1 min']], prep: [['m7', 'hace 10 min', 82], ['pl', 'hace 5 min', 52]], listos: [['m2']], avisos: [['nev', 'ahora'], ['p4', '1 min'], ['ayer', '8:00 a. m.']] },
      { nuevos: [['m9', 'ahora']], prep: [['m4', 'hace 2 min', 14], ['m7', 'hace 11 min', 90]], listos: [['pl'], ['m2']], avisos: [['p9', 'ahora'], ['nev', '3 min'], ['p4', '4 min']] },
    ];
    const cols = Object.fromEntries($$('[data-col]', cocina).map((c) => [c.dataset.col, c]));
    const cuentas = Object.fromEntries($$('[data-cuenta]', cocina).map((c) => [c.dataset.cuenta, c]));
    const pila = $('[data-avisos]', cocina);
    const nodos = new Map();
    const comanda = (id, col, edad, avance) => {
      const [mesa, items, nota] = PLATOS[id];
      let el = nodos.get(id);
      if (!el) { el = document.createElement('div'); nodos.set(id, el); }
      el.className = 'comanda' + (col === 'nuevos' && edad === 'ahora' ? ' comanda--nueva' : '');
      const lado = col === 'listos' ? `<span class="etiqueta-listo"><svg class="ico ico--plano" aria-hidden="true"><use href="#i-check"></use></svg>Listo</span>` : `<span>${edad}</span>`;
      const pie = col === 'nuevos'
        ? `<div class="comanda__acciones"><span class="mini-boton mini-boton--ambar">Aceptar</span><span class="mini-boton">Ver mesa</span></div>`
        : col === 'prep' ? `<div class="comanda__barra"><i style="--p:${avance}%"></i></div>` : '';
      el.innerHTML = `<div class="comanda__cabeza"><strong>${mesa}</strong>${lado}</div><ul>${items.map(([n, t]) => `<li><b>${n}</b>${t}</li>`).join('')}</ul>${nota && col !== 'listos' ? `<p class="comanda__nota">${nota}</p>` : ''}${pie}`;
      return el;
    };
    const aviso = (id, hora) => {
      const [titulo, texto, tono] = AVISOS[id];
      const k = 'a-' + id;
      let el = nodos.get(k);
      if (!el) { el = document.createElement('div'); el.className = 'aviso'; nodos.set(k, el); }
      el.innerHTML = `<span class="aviso__ico${tono ? ' aviso__ico--' + tono : ''}"><img src="assets/marca/favicon.svg" alt=""></span><div><div class="aviso__cabeza"><span>Fonda Pixbae</span><span>${hora}</span></div><strong>${titulo}</strong><p>${texto}</p></div>`;
      return el;
    };
    let previo = new Set();
    const pintar = (e, animar) =>
      flip(cocina, nodos, () => {
        const visibles = new Set();
        for (const col of ['nuevos', 'prep', 'listos']) {
          const hijos = e[col].map(([id, edad, av]) => { visibles.add(id); return comanda(id, col, edad, av); });
          cols[col].replaceChildren(...(hijos.length ? hijos : [Object.assign(document.createElement('p'), { className: 'carril__vacio', textContent: 'Sin pedidos nuevos' })]));
          cuentas[col].textContent = e[col].length;
        }
        pila.replaceChildren(...e.avisos.map(([id, h]) => { visibles.add('a-' + id); return aviso(id, h); }));
        const nuevos = new Set([...visibles].filter((v) => !previo.has(v)));
        previo = visibles;
        return previo.size && animar ? nuevos : new Set();
      }, animar);

    if (quieto) pintar(ESTADOS[3], false);
    else {
      pintar(ESTADOS[0], false);
      const correr = async () => {
        await espera(1100); pintar(ESTADOS[1], true);
        await espera(3200); pintar(ESTADOS[2], true);
        await espera(3200); pintar(ESTADOS[3], true);
      };
      if (document.visibilityState === 'visible') correr();
      else document.addEventListener('visibilitychange', function una() { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', una); correr(); } });
    }
  }

  /* ── fila de la clínica: el paciente confirma ── */
  const cita = $('[data-momento="cita"]');
  if (cita) {
    const final = () => {
      $('[data-burbuja]', cita).removeAttribute('data-oculta');
      const c = $('[data-cita-edgar]', cita);
      c.classList.remove('cita--pendiente');
      $('[data-estado]', c).textContent = 'Confirmada';
      $('[data-porllamar-edgar]', cita).classList.add('fuera');
      $('[data-sin-confirmar]', cita).textContent = '1';
    };
    if (quieto) final();
    else cuando(cita, async () => {
      await espera(500);
      $('[data-burbuja]', cita).removeAttribute('data-oculta');
      await espera(1100);
      final();
    });
  }

  /* ── fila de la tienda: el arroz baja del mínimo ── */
  const inv = $('[data-momento="inventario"]');
  if (inv) {
    const final = () => {
      const fila = $('[data-arroz]', inv);
      $('[data-arroz-n]', fila).textContent = '6';
      $('.nivel i', fila).style.setProperty('--n', '43%');
      const est = $('[data-arroz-estado]', fila);
      est.textContent = 'Por acabarse';
      est.classList.add('estado--bajo');
      fila.classList.add('resalta');
      $('[data-por-acabarse]', inv).textContent = '3';
    };
    if (quieto) { final(); $('[data-burbuja]', inv).removeAttribute('data-oculta'); }
    else cuando(inv, async () => {
      await espera(600);
      final();
      await espera(700);
      $('[data-burbuja]', inv).removeAttribute('data-oculta');
    });
  }

  /* ── pasos: la línea se llena de izquierda a derecha ── */
  const pasos = $('[data-pasos]');
  if (pasos && !quieto) {
    pasos.classList.add('espera');
    $$('.paso__num', pasos).forEach((n, i) => (n.style.transitionDelay = `${i * 380}ms`));
    cuando(pasos, () => requestAnimationFrame(() => pasos.classList.remove('espera')), 0.5);
  }

  /* ── tira de negocios ── */
  const tira = $('[data-tira]');
  if (tira) {
    const atras = $('[data-tira-atras]'), adelante = $('[data-tira-adelante]');
    const paso = () => { const li = tira.querySelector('li'); return li ? li.getBoundingClientRect().width + 20 : 300; };
    const revisar = () => {
      atras.disabled = tira.scrollLeft < 4;
      adelante.disabled = tira.scrollLeft + tira.clientWidth >= tira.scrollWidth - 4;
    };
    atras.addEventListener('click', () => tira.scrollBy({ left: -paso() * 2, behavior: quieto ? 'auto' : 'smooth' }));
    adelante.addEventListener('click', () => tira.scrollBy({ left: paso() * 2, behavior: quieto ? 'auto' : 'smooth' }));
    tira.addEventListener('scroll', () => requestAnimationFrame(revisar), { passive: true });
    addEventListener('resize', revisar);
    revisar();
  }

  /* ── buscador de servicios ── */
  const buscador = $('[data-buscador]');
  const datosServ = $('#datos-servicios');
  if (buscador && datosServ) {
    const lista = JSON.parse(datosServ.textContent);
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    lista.forEach((s) => (s.k = norm(`${s.n} ${s.d} ${s.t}`)));
    const campo = $('input', buscador), caja = $('[data-resultados]', buscador);
    const pintar = () => {
      const q = norm(campo.value.trim());
      if (q.length < 2) { caja.hidden = true; caja.replaceChildren(); return; }
      const palabras = q.split(/\s+/).filter((p) => p.length > 1);
      const hallados = lista.filter((s) => palabras.every((p) => s.k.includes(p))).slice(0, 8);
      caja.hidden = false;
      if (!hallados.length) {
        caja.innerHTML = `<p class="resultados__nada">No lo tenemos descrito todavía. <a class="enlace" href="#propuesta">Cuéntanos qué necesitas</a> y te decimos si lo podemos hacer.</p>`;
        return;
      }
      caja.replaceChildren(...hallados.map((s) => {
        const a = document.createElement('a');
        a.href = s.h;
        a.innerHTML = `<strong></strong><span></span>`;
        a.firstChild.textContent = s.n;
        a.lastChild.textContent = s.d;
        return a;
      }));
    };
    campo.addEventListener('input', pintar);
    buscador.addEventListener('submit', (e) => { e.preventDefault(); pintar(); });
  }

  /* ── míralo funcionando: pestañas por tipo de negocio ── */
  const tabs = $('[data-pestanas]');
  const datosF = $('#datos-funciona');
  if (tabs && datosF) {
    const datos = JSON.parse(datosF.textContent);
    const panel = $('[data-funciona]');
    const texto = $('[data-funciona-texto]', panel), chat = $('[data-f-chat]', panel);
    const botones = $$('[role="tab"]', tabs);
    let turno = 0;
    const elegir = async (b, foco) => {
      if (b.getAttribute('aria-selected') === 'true') return;
      botones.forEach((x) => { const si = x === b; x.setAttribute('aria-selected', String(si)); x.tabIndex = si ? 0 : -1; });
      if (foco) b.focus();
      panel.setAttribute('aria-labelledby', b.id);
      const d = datos[b.dataset.rubro];
      const mio = ++turno;
      if (!quieto) { texto.classList.add('saliendo'); chat.classList.add('saliendo'); await espera(200); }
      if (mio !== turno) return;
      $('[data-f-bajada]', panel).textContent = d.bajada;
      $('[data-f-pasos]', panel).innerHTML = d.pasos;
      $('[data-f-negocio]', panel).textContent = d.negocio;
      chat.innerHTML = d.chat;
      texto.classList.remove('saliendo');
      chat.classList.remove('saliendo');
    };
    botones.forEach((b, i) => {
      b.addEventListener('click', () => elegir(b, false));
      b.addEventListener('keydown', (e) => {
        const n = botones.length;
        const sig = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
        if (sig === undefined) return;
        e.preventDefault();
        elegir(botones[sig], true);
      });
    });
  }
})();
