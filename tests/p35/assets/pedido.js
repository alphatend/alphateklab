// alphateklab, propuesta 35: el héroe «El pedido viaja».
// Un solo pedido recorre el sistema: la mesa 4 lo manda desde el menú QR, vuela por una línea a la columna «Nuevos»
// de la cocina, la cocina lo marca listo, pasa a la caja, se cobra B/. 10.17 y el resumen del dueño sube.
// Todo corre sobre un reloj propio: la pausa detiene el reloj y también las animaciones en curso.
(() => {
  const raiz = document.querySelector('[data-viaje]');
  if (!raiz) return;
  const escena = raiz.querySelector('.viaje__escena');
  const fila = raiz.querySelector('.viaje__equipos');
  const equipos = [...raiz.querySelectorAll('[data-equipo]')];
  const pasos = [...raiz.querySelectorAll('[data-paso]')];
  const botonPausa = raiz.querySelector('[data-pausa]');
  const textoPausa = raiz.querySelector('[data-pausa-texto]');
  const boleto = raiz.querySelector('[data-boleto]');
  const ficha = raiz.querySelector('[data-ficha]');
  const toque = raiz.querySelector('[data-toque]');
  const rutas = [1, 2, 3].map((n) => raiz.querySelector(`[data-ruta="${n}"]`));
  const vivas = [1, 2, 3].map((n) => raiz.querySelector(`[data-viva="${n}"]`));
  const mqQuieto = matchMedia('(prefers-reduced-motion: reduce)');
  const mqCarrusel = matchMedia('(max-width: 1180px)');
  const SALIDA = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const VIAJE = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const originales = equipos.map((e) => e.querySelector('.pantalla').innerHTML);
  const $ = (s) => escena.querySelector(s);
  const carrusel = () => mqCarrusel.matches;
  const r1 = (v) => Math.round(v * 10) / 10;
  const dinero = (v) => `B/. ${v.toFixed(2)}`;
  const salidaJS = (p) => 1 - Math.pow(1 - p, 4);
  const animsDe = (el) => (el.getAnimations ? el.getAnimations({ subtree: true }) : []);
  let dibujada = {};
  let actual = 0;

  /* ── geometría: todo relativo a la escena ── */
  const rect = (el) => {
    const e = escena.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - e.left, y: r.top - e.top, w: r.width, h: r.height };
  };
  const centro = (el) => {
    const b = rect(el);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  };
  function puntos(n) {
    const kt = rect($('[data-kt]'));
    if (n === 1) {
      const col = rect($('[data-col="nuevos"] .mon__cuerpo'));
      return [centro($('[data-q-enviar]')), { x: col.x + col.w / 2, y: col.y + kt.h / 2 }];
    }
    if (n === 2) {
      const col = rect($('[data-col="listos"] .mon__cuerpo'));
      const cuenta = rect($('.caj__cuenta'));
      return [{ x: col.x + col.w / 2, y: col.y + kt.h / 2 }, { x: cuenta.x + cuenta.w / 2, y: cuenta.y + 30 }];
    }
    return [centro($('.caj__fondo')), centro($('.res__venta'))];
  }
  // curva que sale de una pantalla, pasa por encima de la tableta y entra en la siguiente
  function trazo(n) {
    const [a, b] = puntos(n);
    const tableta = rect(equipos[n === 3 ? 2 : 1]);
    const pico = tableta.y - 74;
    const alto = (8 * pico - a.y - b.y) / 6;
    const dx = b.x - a.x;
    return `M${r1(a.x)} ${r1(a.y)} C${r1(a.x + dx * 0.3)} ${r1(alto)} ${r1(a.x + dx * 0.7)} ${r1(alto)} ${r1(b.x)} ${r1(b.y)}`;
  }
  function dibujarRutas() {
    if (carrusel()) return;
    for (let n = 1; n <= 3; n++) {
      const d = trazo(n);
      const viva = vivas[n - 1];
      rutas[n - 1].setAttribute('d', d);
      viva.setAttribute('d', d);
      const L = viva.getTotalLength();
      viva.style.strokeDasharray = `${L} ${L}`;
      viva.style.strokeDashoffset = dibujada[n] ? '0' : String(L);
      viva.style.opacity = dibujada[n] ? '1' : '0';
    }
  }

  /* ── reloj ── */
  let reloj = 0;
  let idx = 0;
  let ultimo = null;
  let raf = 0;
  let corriendo = false;
  let listo = false;
  let pausaUsuario = false;
  let enVista = true;
  let cola = [];
  let tweens = [];
  const luego = (ms, fn) => cola.push({ t: reloj + ms, fn });
  const tween = (dur, fn) => tweens.push({ t0: reloj, dur, fn });

  /* ── piezas de la historia (rapido = sin animar, para el estado final) ── */
  function tocar(el) {
    if (!el) return;
    const c = centro(el);
    toque.style.left = `${c.x}px`;
    toque.style.top = `${c.y}px`;
    toque.animate(
      [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.35)' }],
      { duration: 560, easing: SALIDA },
    );
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.95)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 300, easing: SALIDA });
  }
  function reanimar(el) {
    el.classList.remove('cambia');
    void el.offsetWidth;
    el.classList.add('cambia');
  }
  function marcar(n) {
    equipos.forEach((e, i) => e.classList.toggle('activo', i === n - 1));
    pasos.forEach((li, i) => li.classList.toggle('activo', i === n - 1));
  }
  function mostrar(n) {
    equipos.forEach((e, i) => {
      const si = i === n - 1;
      if (si) e.classList.remove('salio');
      else if (e.classList.contains('visto')) e.classList.add('salio');
      e.classList.toggle('visto', si);
    });
  }
  const DUR = { 1: 2150, 2: 3800, 3: 3650, 4: 3100 };
  function paso(n) {
    actual = n;
    marcar(n);
    pasos.forEach((li, i) => li.classList.toggle('hecho', i < n - 1));
    const barra = pasos[n - 1].querySelector('.paso__barra i');
    barra.getAnimations().forEach((a) => a.cancel());
    barra.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DUR[n], easing: 'linear', fill: 'forwards' });
    if (carrusel()) mostrar(n);
  }
  function terminar() {
    raiz.classList.remove('en-marcha');
    equipos.forEach((e) => e.classList.remove('activo'));
    pasos.forEach((li) => {
      li.classList.remove('activo');
      li.classList.add('hecho');
    });
  }

  // 1. la mesa agrega una chicha y manda el pedido
  function chicha(rapido) {
    const cant = $('[data-q-cant]');
    cant.classList.remove('qr__cant--cero');
    $('[data-q-num]').textContent = '1';
    $('[data-q-total]').textContent = 'B/. 9.50';
    $('[data-q-resumen]').textContent = '3 productos';
    if (!rapido) {
      reanimar($('[data-q-total]'));
      reanimar($('[data-q-num]'));
    }
  }

  // vuelo por la línea: el elemento sigue el mismo trazo que se dibuja
  function volar(n, el, dur) {
    if (carrusel()) return;
    const d = trazo(n);
    const viva = vivas[n - 1];
    viva.setAttribute('d', d);
    const L = viva.getTotalLength();
    viva.style.strokeDasharray = `${L} ${L}`;
    el.style.offsetPath = `path('${d}')`;
    el.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }], { duration: dur, easing: VIAJE, fill: 'forwards' });
    el.animate(
      [{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'scale(1)', offset: 0.16 }, { opacity: 1, transform: 'scale(1)' }],
      { duration: dur, easing: 'linear', fill: 'forwards' },
    );
    viva.animate([{ strokeDashoffset: L, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: dur, easing: VIAJE, fill: 'forwards' });
    dibujada[n] = true;
  }
  const apagar = (el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease', fill: 'forwards' });
  function copiarBoleto() {
    const kt = $('[data-kt]');
    boleto.innerHTML = kt.innerHTML;
    boleto.dataset.estado = kt.dataset.estado;
    boleto.style.width = `${kt.offsetWidth}px`;
  }

  // 2. la cocina
  function contar() {
    ['nuevos', 'prep', 'listos'].forEach((c) => {
      const col = $(`[data-col="${c}"]`);
      const n = col.querySelectorAll('.kt:not(.kt--oculta)').length;
      const b = col.querySelector('[data-cuenta]');
      if (b.textContent !== String(n)) {
        b.textContent = String(n);
        b.classList.toggle('hay', n > 0);
      }
      col.classList.toggle('con-pedido', !!col.querySelector('.kt:not(.kt--oculta)'));
    });
  }
  function aterrizar1(rapido) {
    const kt = $('[data-kt]');
    kt.classList.remove('kt--oculta');
    contar();
    if (rapido) return;
    if (carrusel()) kt.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: SALIDA });
    else apagar(boleto);
    kt.classList.add('recien');
    luego(220, () => kt.classList.remove('recien'));
  }
  function moverKt(columna, rapido) {
    const kt = $('[data-kt]');
    const todas = [...equipos[1].querySelectorAll('.kt')];
    const antes = new Map(todas.map((c) => [c, c.getBoundingClientRect()]));
    const cuerpo = $(`[data-col="${columna}"] .mon__cuerpo`);
    cuerpo.insertBefore(kt, cuerpo.querySelector('.kt'));
    kt.dataset.estado = columna === 'prep' ? 'prep' : 'listo';
    kt.querySelector('[data-kt-accion]').textContent = columna === 'prep' ? 'Marcar listo' : 'Listo';
    kt.querySelector('.kt__cab span').textContent = columna === 'prep' ? '1 min' : '9 min';
    contar();
    if (rapido) return;
    todas.forEach((c) => {
      const a = antes.get(c);
      const b = c.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
      c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: c === kt ? 480 : 340, easing: c === kt ? VIAJE : SALIDA });
    });
  }

  // 3. la caja
  function aterrizar2(rapido) {
    const cuenta = $('.caj__cuenta');
    cuenta.dataset.cEstado = 'cuenta';
    $('[data-c-m4]').classList.add('activa');
    $('[data-c-m4-estado]').textContent = 'Por cobrar';
    if (rapido) return;
    if (!carrusel()) apagar(boleto);
    [...cuenta.querySelectorAll('.caj__titulo, .caj__lineas > div, .caj__suma > div, .caj__fondo')].forEach((el, i) =>
      el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 80 + i * 55, easing: SALIDA, fill: 'backwards' }),
    );
  }
  function pagar() {
    $('.caj__cuenta').dataset.cEstado = 'pagado';
    const tag = $('[data-c-tag]');
    tag.textContent = 'Pagada';
    tag.classList.add('pagada');
    $('[data-c-m4-estado]').textContent = 'Pagada';
  }

  // 4. el celular del dueño
  function insertarFila(rapido) {
    const lista = $('[data-r-lista]');
    const nuevo = $('[data-r-nuevo]');
    const otras = [...lista.children].filter((li) => li !== nuevo);
    const antes = otras.map((li) => li.getBoundingClientRect().top);
    nuevo.classList.add('ve');
    if (rapido) return;
    otras.forEach((li, i) => {
      const dy = antes[i] - li.getBoundingClientRect().top;
      if (dy) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: SALIDA });
    });
    nuevo.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SALIDA });
  }
  function llegar4(rapido) {
    const ventas = $('[data-r-ventas]');
    const ticket = $('[data-r-ticket]');
    const pedidos = $('[data-r-pedidos]');
    const barra = $('[data-r-barra]');
    const final = () => {
      ventas.textContent = dinero(612.4);
      ticket.textContent = dinero(14.94);
      pedidos.textContent = '41';
      barra.style.transform = 'scaleY(0.66)';
      $('[data-r-delta]').classList.add('ve');
      insertarFila(true);
    };
    if (rapido) return final();
    if (!carrusel()) apagar(ficha);
    $('[data-r-aviso]').classList.add('ve');
    luego(260, () => {
      $('[data-r-delta]').classList.add('ve');
      tween(1000, (p) => {
        ventas.textContent = dinero(602.23 + 10.17 * p);
        ticket.textContent = dinero(15.06 - 0.12 * p);
        barra.style.transform = `scaleY(${(0.58 + 0.08 * p).toFixed(3)})`;
      });
      luego(420, () => {
        pedidos.textContent = '41';
        reanimar(pedidos);
      });
      insertarFila();
    });
  }

  function apagarRutas() {
    vivas.forEach((v) => {
      if (dibujada[[...vivas].indexOf(v) + 1]) v.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease', fill: 'forwards' });
    });
  }
  function reiniciar() {
    equipos.forEach((e, i) => {
      e.querySelector('.pantalla').innerHTML = originales[i];
    });
    [boleto, ficha, toque, ...vivas].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    pasos.forEach((li) => {
      li.classList.remove('activo', 'hecho');
      li.querySelector('.paso__barra i').getAnimations().forEach((a) => a.cancel());
    });
    dibujada = {};
    dibujarRutas();
  }

  /* ── la línea de tiempo (ms) ── */
  const LINEA = [
    [0, () => { raiz.classList.add('en-marcha'); paso(1); }],
    [650, () => tocar($('[data-q-mas]'))],
    [780, () => chicha()],
    [1650, () => tocar($('[data-q-enviar]'))],
    [1820, () => $('[data-q-enviar]').classList.add('enviado')],
    [2150, () => { paso(2); copiarBoleto(); boleto.dataset.estado = 'nuevo'; volar(1, boleto, 1150); }],
    [3300, () => aterrizar1()],
    [4150, () => tocar($('[data-kt-accion]'))],
    [4300, () => moverKt('prep')],
    [5150, () => tocar($('[data-kt-accion]'))],
    [5300, () => moverKt('listos')],
    [5950, () => { paso(3); copiarBoleto(); volar(2, boleto, 1000); }],
    [6950, () => aterrizar2()],
    [7850, () => tocar($('[data-c-yappy]'))],
    [7950, () => $('[data-c-yappy]').classList.add('elegido')],
    [8550, () => tocar($('[data-c-cobrar]'))],
    [8750, () => pagar()],
    [9600, () => { paso(4); volar(3, ficha, 900); }],
    [10500, () => llegar4()],
    [12500, () => $('[data-r-aviso]').classList.remove('ve')],
    [12700, () => terminar()],
    [16000, () => { fila.classList.add('refresca'); apagarRutas(); }],
    [16320, () => { reiniciar(); fila.classList.remove('refresca'); }],
  ];
  const FIN = 16700;

  function cuadro(ahora) {
    raf = 0;
    if (!corriendo) return;
    const dt = ultimo == null ? 16 : Math.min(64, ahora - ultimo);
    ultimo = ahora;
    reloj += dt;
    while (idx < LINEA.length && LINEA[idx][0] <= reloj) LINEA[idx++][1]();
    const vencida = cola;
    cola = [];
    vencida.forEach((c) => (c.t <= reloj ? c.fn() : cola.push(c)));
    tweens = tweens.filter((w) => {
      const p = Math.min(1, (reloj - w.t0) / w.dur);
      w.fn(salidaJS(p));
      return p < 1;
    });
    if (reloj >= FIN) {
      reloj = 0;
      idx = 0;
      cola = [];
      tweens = [];
    }
    raf = requestAnimationFrame(cuadro);
  }
  function actualizar() {
    const debe = listo && !pausaUsuario && enVista && !document.hidden && !mqQuieto.matches;
    if (debe && !corriendo) {
      corriendo = true;
      ultimo = null;
      animsDe(raiz).forEach((a) => a.playState === 'paused' && a.play());
      raf = requestAnimationFrame(cuadro);
    } else if (!debe && corriendo) {
      corriendo = false;
      cancelAnimationFrame(raf);
      animsDe(raiz).forEach((a) => a.playState === 'running' && a.pause());
    }
  }

  /* ── estado final, sin movimiento (prefers-reduced-motion) ── */
  function estadoFinal() {
    escena.classList.add('sin-transicion');
    chicha(true);
    $('[data-q-enviar]').classList.add('enviado');
    aterrizar1(true);
    moverKt('prep', true);
    moverKt('listos', true);
    aterrizar2(true);
    $('[data-c-yappy]').classList.add('elegido');
    pagar();
    llegar4(true);
    dibujada = { 1: true, 2: true, 3: true };
    dibujarRutas();
    pasos.forEach((li) => li.classList.add('hecho'));
    actual = 1;
    if (carrusel()) {
      mostrar(1);
      marcar(1);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => escena.classList.remove('sin-transicion')));
  }

  /* ── controles ── */
  const ajustarBotones = () => pasos.forEach((li) => (li.querySelector('button').disabled = !carrusel()));
  ajustarBotones();
  pasos.forEach((li, i) =>
    li.querySelector('button').addEventListener('click', () => {
      if (!carrusel()) return;
      if (!mqQuieto.matches && !pausaUsuario) {
        pausaUsuario = true;
        botonPausa.setAttribute('aria-pressed', 'true');
        textoPausa.textContent = 'Seguir';
        actualizar();
      }
      mostrar(i + 1);
      marcar(i + 1);
    }),
  );
  botonPausa?.addEventListener('click', () => {
    pausaUsuario = !pausaUsuario;
    botonPausa.setAttribute('aria-pressed', String(pausaUsuario));
    textoPausa.textContent = pausaUsuario ? 'Seguir' : 'Pausar';
    if (!pausaUsuario && actual) {
      if (raiz.classList.contains('en-marcha')) marcar(actual);
      if (carrusel()) mostrar(actual);
    }
    actualizar();
  });
  mqCarrusel.addEventListener?.('change', () => {
    ajustarBotones();
    if (carrusel()) mostrar(actual || 1);
    else requestAnimationFrame(dibujarRutas);
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => dibujarRutas()).observe(escena);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([e]) => {
        enVista = e.isIntersecting;
        actualizar();
      },
      { threshold: 0.2 },
    ).observe(escena);
  }
  document.addEventListener('visibilitychange', actualizar);

  const empezar = () => {
    dibujarRutas();
    if (mqQuieto.matches) {
      raiz.classList.add('quieto');
      estadoFinal();
      return;
    }
    if (carrusel()) mostrar(1);
    setTimeout(() => {
      listo = true;
      actualizar();
    }, 650);
  };
  (document.fonts?.ready || Promise.resolve()).then(empezar);
})();
