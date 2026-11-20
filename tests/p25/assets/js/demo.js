/* La demo en vivo de la portada.
   Todo el recorrido es un solo ciclo de 11 s hecho con la Web Animations API: cada pieza tiene sus fotogramas
   sobre la misma línea de tiempo, así que pausar, seguir o saltar a un capítulo es mover todas a la vez.
   El HTML y el CSS ya muestran el estado final; si el visitante pide menos movimiento, se queda así, quieto. */
(() => {
  const raiz = document.querySelector('[data-demo]');
  if (!raiz || !('animate' in Element.prototype)) return;

  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)');
  const quieta = () => {
    raiz.classList.add('quieta');
    raiz.querySelectorAll('.capitulo').forEach((b) => (b.disabled = true));
  };
  if (reducir.matches) {
    quieta();
    return;
  }

  const CICLO = 11000;
  // inicio de cada capítulo (ms) y el punto al que salta su botón
  const CAPS = [
    { desde: 0, hasta: 3300, salto: 0 },
    { desde: 3300, hasta: 5200, salto: 3200 },
    { desde: 5200, hasta: 7300, salto: 5050 },
    { desde: 7300, hasta: 10600, salto: 7150 },
  ];
  const REINICIO = 10950; // dentro del fundido: todo vuelve al estado inicial

  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const SUAVE = 'ease';

  const $ = (s) => raiz.querySelector(s);
  const $$ = (s) => [...raiz.querySelectorAll(s)];
  const app = $('.app');
  const cursor = $('.cursor');
  const ondas = $$('.onda');
  const botonNuevo = $('.app__boton');
  const panel = $('.pedido-nuevo');
  const enviar = $('.pedido-nuevo__enviar');
  const nueva = $('.orden--nueva');
  const anillo = $('.orden__anillo');
  const debajo = $$('[data-baja]');
  const aviso = $('.aviso');
  const insignia = $('.app__insignia');
  const ventas = $('[data-ventas]');
  const brillo = $('.kpi--ventas .kpi__brillo');
  const pares = $$('[data-par]');
  const capitulos = $$('.capitulo');
  const llenos = $$('.capitulo__lleno');
  const pausa = $('[data-pausa]');
  const pausaTexto = pausa?.querySelector('span');

  let animaciones = [];
  let enPausaPorUsuario = false;
  let visible = true;
  let rafId = 0;

  // Fotogramas sobre el ciclo: [ms, valores, curva del tramo que sigue]
  function pista(el, puntos, extra = {}) {
    if (!el) return null;
    const claves = Object.keys(puntos[0][1]);
    const lista = [...puntos].sort((a, b) => a[0] - b[0]);
    if (lista[0][0] > 0) lista.unshift([0, lista[0][1]]);
    if (lista[lista.length - 1][0] < CICLO) lista.push([CICLO, lista[lista.length - 1][1]]);
    const fotogramas = lista.map(([t, v, curva]) => {
      const f = { offset: Math.min(1, Math.max(0, t / CICLO)) };
      claves.forEach((k) => (f[k] = v[k]));
      f.easing = curva || 'linear';
      return f;
    });
    const a = el.animate(fotogramas, { duration: CICLO, iterations: Infinity, fill: 'both', ...extra });
    animaciones.push(a);
    return a;
  }

  // Posición de un elemento dentro de la app (centro, o un punto relativo)
  function punto(el, fx = 0.5, fy = 0.5) {
    const r = el.getBoundingClientRect();
    const base = app.getBoundingClientRect();
    return { x: r.left - base.left + r.width * fx, y: r.top - base.top + r.height * fy };
  }

  function construir(tiempo = 0, seguir = true) {
    animaciones.forEach((a) => a.cancel());
    animaciones = [];

    const ancho = app.clientWidth;
    const alto = app.clientHeight;
    const B = punto(botonNuevo, 0.42, 0.55);
    const S = punto(enviar, 0.46, 0.55);
    const R0 = { x: ancho * 0.36, y: Math.min(alto * 0.78, alto - 40) };
    const R1 = { x: ancho * 0.58, y: Math.min(alto * 0.86, alto - 30) };
    const tr = (p, s = 1) => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${s})`;

    // 1. el cursor: entra, va a «Nuevo pedido», luego a «Enviar a cocina», y se aparta
    pista(cursor, [
      [0, { transform: tr(R0), opacity: 0 }],
      [300, { transform: tr(R0), opacity: 0 }, SUAVE],
      [600, { transform: tr(R0), opacity: 1 }],
      [700, { transform: tr(R0), opacity: 1 }, EASE_IN_OUT],
      [1800, { transform: tr(B), opacity: 1 }],
      [1880, { transform: tr(B, 0.86), opacity: 1 }, EASE_OUT],
      [2040, { transform: tr(B), opacity: 1 }],
      [2400, { transform: tr(B), opacity: 1 }, EASE_IN_OUT],
      [3000, { transform: tr(S), opacity: 1 }],
      [3080, { transform: tr(S, 0.86), opacity: 1 }, EASE_OUT],
      [3240, { transform: tr(S), opacity: 1 }],
      [3900, { transform: tr(S), opacity: 1 }, EASE_IN_OUT],
      [4900, { transform: tr(R1), opacity: 1 }],
      [10600, { transform: tr(R1), opacity: 1 }],
      [REINICIO, { transform: tr(R1), opacity: 0 }],
      [REINICIO + 1, { transform: tr(R0), opacity: 0 }],
    ]);

    // ondas del clic
    [[ondas[0], B, 1880], [ondas[1], S, 3080]].forEach(([o, p, t]) => {
      if (!o) return;
      o.style.left = `${p.x}px`;
      o.style.top = `${p.y}px`;
      pista(o, [
        [t - 1, { transform: 'scale(0.4)', opacity: 0 }],
        [t, { transform: 'scale(0.4)', opacity: 0.9 }, EASE_OUT],
        [t + 460, { transform: 'scale(1.35)', opacity: 0 }],
      ]);
    });

    // el botón se hunde al clic
    pista(botonNuevo, [
      [1860, { transform: 'scale(1)' }, EASE_OUT],
      [1900, { transform: 'scale(0.96)' }, EASE_OUT],
      [2060, { transform: 'scale(1)' }],
    ]);
    pista(enviar, [
      [3060, { transform: 'scale(1)' }, EASE_OUT],
      [3100, { transform: 'scale(0.96)' }, EASE_OUT],
      [3260, { transform: 'scale(1)' }],
    ]);

    // 2. el panel «Nuevo pedido» sale del botón y se cierra al enviar
    pista(panel, [
      [1980, { opacity: 0, transform: 'translateY(-4px) scale(0.96)' }, EASE_OUT],
      [2200, { opacity: 1, transform: 'none' }],
      [3240, { opacity: 1, transform: 'none' }, EASE_OUT],
      [3400, { opacity: 0, transform: 'scale(0.98)' }],
    ]);

    // 3. la orden nueva entra arriba en «Nuevos»; las de abajo bajan para hacerle sitio
    const lista = nueva.parentElement;
    const hueco = nueva.offsetHeight + parseFloat(getComputedStyle(lista).rowGap || '10');
    debajo.forEach((el) =>
      pista(el, [
        [3400, { transform: `translateY(${-hueco}px)` }, EASE_IN_OUT],
        [3860, { transform: 'translateY(0px)' }],
        [REINICIO, { transform: 'translateY(0px)' }],
        [REINICIO + 1, { transform: `translateY(${-hueco}px)` }],
      ]),
    );
    pista(nueva, [
      [3520, { opacity: 0, transform: 'translateY(-6px) scale(0.98)' }, EASE_OUT],
      [3880, { opacity: 1, transform: 'none' }],
      [REINICIO, { opacity: 1, transform: 'none' }],
      [REINICIO + 1, { opacity: 0, transform: 'translateY(-6px) scale(0.98)' }],
    ]);
    pista(anillo, [
      [3600, { opacity: 0 }, EASE_OUT],
      [3900, { opacity: 1 }],
      [4600, { opacity: 1 }, SUAVE],
      [5800, { opacity: 0 }],
    ]);

    // cifras que cambian: el valor de antes sube y se va, el de después entra
    pares.forEach((par) => {
      const t = Number(par.dataset.par);
      const antes = par.querySelector('.antes');
      const despues = par.querySelector('.despues');
      pista(antes, [
        [t, { opacity: 1, transform: 'translateY(0px)' }, EASE_OUT],
        [t + 260, { opacity: 0, transform: 'translateY(-7px)' }],
        [REINICIO, { opacity: 0, transform: 'translateY(-7px)' }],
        [REINICIO + 1, { opacity: 1, transform: 'translateY(0px)' }],
      ]);
      pista(despues, [
        [t + 60, { opacity: 0, transform: 'translateY(7px)' }, EASE_OUT],
        [t + 340, { opacity: 1, transform: 'translateY(0px)' }],
        [REINICIO, { opacity: 1, transform: 'translateY(0px)' }],
        [REINICIO + 1, { opacity: 0, transform: 'translateY(7px)' }],
      ]);
    });

    // 4. el aviso de la nevera: entra como un toast (400 ms, ease) desde su borde (arriba en la computadora,
    //    abajo en el teléfono) y se queda
    const avisoAbajo = aviso.offsetTop > app.clientHeight / 2;
    const fuera = `translateY(${avisoAbajo ? 12 : -10}px)`;
    pista(aviso, [
      [5200, { opacity: 0, transform: fuera }, SUAVE],
      [5600, { opacity: 1, transform: 'translateY(0px)' }],
      [REINICIO, { opacity: 1, transform: 'translateY(0px)' }],
      [REINICIO + 1, { opacity: 0, transform: fuera }],
    ]);
    pista(insignia, [
      [5320, { opacity: 0, transform: 'scale(0.6)' }, EASE_OUT],
      [5560, { opacity: 1, transform: 'scale(1)' }],
      [REINICIO, { opacity: 1, transform: 'scale(1)' }],
      [REINICIO + 1, { opacity: 0, transform: 'scale(0.6)' }],
    ]);

    // 5. sube el total: la cifra la escribe el reloj; aquí solo el brillo de la tarjeta
    pista(brillo, [
      [7300, { opacity: 0 }, EASE_OUT],
      [7550, { opacity: 1 }],
      [8400, { opacity: 1 }, SUAVE],
      [9400, { opacity: 0 }],
    ]);

    // fundido al final del ciclo para volver a empezar
    pista(app, [
      [0, { opacity: 0 }, SUAVE],
      [380, { opacity: 1 }],
      [10600, { opacity: 1 }, SUAVE],
      [REINICIO, { opacity: 0 }],
    ]);

    // capítulos: la barra se llena mientras dura cada uno
    llenos.forEach((barra, i) => {
      const c = CAPS[i];
      pista(barra, [
        [c.desde, { transform: 'scaleX(0)' }],
        [c.hasta, { transform: 'scaleX(1)' }],
        [REINICIO, { transform: 'scaleX(1)' }],
        [REINICIO + 1, { transform: 'scaleX(0)' }],
      ]);
    });

    animaciones.forEach((a) => (a.currentTime = tiempo));
    if (!seguir) animaciones.forEach((a) => a.pause());
    pintar();
  }

  // El total del día: de B/. 599.90 a B/. 612.40 entre 7.3 s y 8.2 s
  const DESDE = 599.9;
  const HASTA = 612.4;
  let ultimoTexto = '';
  let ultimoCap = -1;
  function pintar() {
    const a = animaciones[0];
    if (!a) return;
    const t = (Number(a.currentTime) || 0) % CICLO;
    let v = DESDE;
    if (t >= 7300 && t < REINICIO) {
      const p = Math.min(1, (t - 7300) / 900);
      v = DESDE + (HASTA - DESDE) * (1 - Math.pow(1 - p, 3));
    }
    const texto = `B/. ${v.toFixed(2)}`;
    if (texto !== ultimoTexto) {
      ventas.textContent = texto;
      ultimoTexto = texto;
    }
    const cap = CAPS.findIndex((c) => t >= c.desde && t < c.hasta);
    if (cap !== ultimoCap) {
      capitulos.forEach((b, i) => b.classList.toggle('activo', i === cap));
      ultimoCap = cap;
    }
  }
  function bucle() {
    pintar();
    rafId = requestAnimationFrame(bucle);
  }

  const corriendo = () => animaciones.length && animaciones[0].playState === 'running';
  function seguir() {
    if (!animaciones.length) return;
    animaciones.forEach((a) => a.play());
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(bucle);
  }
  function parar() {
    animaciones.forEach((a) => a.pause());
    cancelAnimationFrame(rafId);
    pintar();
  }
  function decidir() {
    if (!enPausaPorUsuario && visible && !document.hidden) seguir();
    else parar();
  }

  pausa?.addEventListener('click', () => {
    enPausaPorUsuario = !enPausaPorUsuario;
    pausa.setAttribute('aria-pressed', String(enPausaPorUsuario));
    pausa.setAttribute('aria-label', enPausaPorUsuario ? 'Reproducir la demo' : 'Pausar la demo');
    if (pausaTexto) pausaTexto.textContent = enPausaPorUsuario ? 'Seguir' : 'Pausar';
    decidir();
  });

  capitulos.forEach((b, i) =>
    b.addEventListener('click', () => {
      const t = CAPS[i].salto;
      animaciones.forEach((a) => (a.currentTime = t));
      pintar();
      decidir();
    }),
  );

  new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      decidir();
    },
    { threshold: 0.15 },
  ).observe(raiz);
  document.addEventListener('visibilitychange', decidir);

  // al cambiar el ancho, se miden de nuevo los puntos y se sigue donde iba
  let ultimoAncho = app.clientWidth;
  let espera = 0;
  window.addEventListener('resize', () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      if (app.clientWidth === ultimoAncho) return;
      ultimoAncho = app.clientWidth;
      const t = animaciones.length ? (Number(animaciones[0].currentTime) || 0) % CICLO : 0;
      construir(t, corriendo());
      decidir();
    }, 160);
  });

  reducir.addEventListener?.('change', (e) => {
    if (!e.matches) return;
    animaciones.forEach((a) => a.cancel());
    animaciones = [];
    cancelAnimationFrame(rafId);
    ventas.textContent = `B/. ${HASTA.toFixed(2)}`;
    quieta();
  });

  const empezar = () => {
    construir(0, true);
    decidir();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(empezar);
  else window.addEventListener('load', empezar);
})();
