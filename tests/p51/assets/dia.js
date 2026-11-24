// alphateklab, propuesta 51: «Un día con tu tecnología».
// Un reloj virtual recorre el día de 7:00 a. m. a 10:00 p. m. en unos 24 s. Cada evento llega arriba con un resorte,
// los anteriores se compactan y los más viejos se apilan al fondo. Se detiene con el botón, fuera de pantalla y con la
// pestaña oculta. Con movimiento reducido queda quieto en el cierre del día.
(() => {
  const dia = document.querySelector('[data-dia]');
  if (!dia) return;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const feed = dia.querySelector('.feed');
  const pista = dia.querySelector('.reloj__pista');
  const lleno = dia.querySelector('.reloj__lleno');
  const cursor = dia.querySelector('.reloj__cursor');
  const hora = dia.querySelector('.reloj__hora');
  const num = dia.querySelector('.cuenta__num');
  const etiqueta = dia.querySelector('.cuenta__txt');
  const boton = dia.querySelector('.dia__pausa');
  const botonTxt = boton?.querySelector('.p-txt');
  const SPRITE = 'assets/iconos.svg';

  const EV = [
    { m: 420, neg: 'Escuela', ico: 'graduation-cap', res: 'Asistencia marcada al entrar', sol: 'Asistencia con QR', solIco: 'qr-code', det: '286 estudiantes; aviso a 3 familias' },
    { m: 570, neg: 'Tienda', ico: 'storefront', res: 'Pedido desde la página web', sol: 'Tienda en línea', solIco: 'globe-simple', det: 'Pedido 0458, B/. 46.80 con tarjeta' },
    { m: 760, neg: 'Restaurante', ico: 'fork-knife', res: 'Mesa 4 pagó con Yappy y salió la factura', sol: 'Cobro y factura electrónica', solIco: 'credit-card', det: 'B/. 18.40, factura enviada al cliente' },
    { m: 900, neg: 'Hotel', ico: 'bed', res: 'Reserva confirmada', sol: 'Reservas en tu página', solIco: 'calendar-check', det: 'Cabaña 2, del 21 al 23, sin comisión' },
    { m: 1040, neg: 'Taller', ico: 'wrench', res: 'El carro está listo y se avisó al cliente', sol: 'Aviso de listo por WhatsApp', solIco: 'chat-circle-dots', det: 'Orden 118: frenos y cambio de aceite' },
    { m: 1140, neg: 'Bodega', ico: 'warehouse', res: 'La cámara contó 230 entradas', sol: 'Cámara que cuenta', solIco: 'security-camera', det: 'La hora con más gente: 7 a 8 a. m.' },
    { m: 1290, neg: 'Café', ico: 'coffee', res: 'Menú de mañana en la pantalla', sol: 'Menú en pantallas', solIco: 'monitor', det: 'Desayunos desde las 6:30 a. m.' },
    { m: 1320, neg: 'Dueño', ico: 'chart-line-up', res: 'El reporte del día', sol: 'Reporte automático', solIco: 'file-text', det: null },
  ];
  // segundos entre un evento y el siguiente; el día dura unos 24 s con la pausa del cierre y el reinicio
  const SEG = [2.7, 2.7, 2.7, 2.7, 2.4, 2.7, 1.8];
  const T = [0.55];
  SEG.forEach((s) => T.push(T[T.length - 1] + s));
  const CIERRE = T[T.length - 1] + 4.6;
  const REINICIO = 0.9;
  const CICLO = CIERRE + REINICIO;
  const INICIO = 420;
  const FINAL = 1320;

  const fmt = (min) => {
    const h = Math.floor(min / 60) % 24;
    const m = Math.floor(min % 60);
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  };
  const suave = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const minutos = (t) => {
    if (t <= T[0]) return INICIO;
    for (let i = 0; i < T.length - 1; i++) {
      if (t <= T[i + 1]) return EV[i].m + (EV[i + 1].m - EV[i].m) * ((t - T[i]) / (T[i + 1] - T[i]));
    }
    if (t <= CIERRE) return FINAL;
    return FINAL - (FINAL - INICIO) * suave(Math.min(1, (t - CIERRE) / REINICIO));
  };

  /* ── marcas de la barra ── */
  const marcas = EV.map((e) => {
    const m = document.createElement('span');
    m.className = 'reloj__marca';
    m.style.left = `${((e.m - INICIO) / (FINAL - INICIO)) * 100}%`;
    pista.append(m);
    return m;
  });

  /* ── tarjetas ── */
  const ico = (n) => `<svg class="ico" aria-hidden="true" focusable="false"><use href="${SPRITE}#i-${n}"/></svg>`;
  const crear = (e) => {
    const c = document.createElement('div');
    c.className = 'ev';
    const det = e.det
      ? `<span>${e.det}</span>`
      : '<span class="ev__lista"><span>Ventas<b>B/. 2,431</b></span><span>Pedidos<b>57</b></span><span>Reservas<b>3</b></span></span>';
    c.innerHTML = `<span class="ev__ico">${ico(e.ico)}</span><p class="ev__cab"><b>${e.neg}</b><time>${fmt(e.m)}</time></p><p class="ev__res">${e.res}</p><p class="ev__det"><span class="sol">${ico(e.solIco)}${e.sol}</span>${det}</p>`;
    return c;
  };
  const medir = (c) => {
    c.hLlena = c.offsetHeight;
    c.hCompacta = Math.min(c.hLlena, c.querySelector('.ev__det').offsetTop + 13);
  };

  let vivos = []; // la más nueva primero
  const ARRIBA = () => (innerWidth <= 720 ? 10 : 14);
  const HUECO = 8;
  const colocar = () => {
    const alto = feed.clientHeight;
    const arriba = ARRIBA();
    let y = arriba;
    let ultima = null;
    let k = 0;
    vivos.forEach((c, i) => {
      let estado;
      if (i === 0) estado = 'llena';
      else if (!k && y + c.hCompacta <= alto - 22) estado = 'compacta';
      else estado = ++k <= 2 ? 'mazo' : 'fuera';
      c.dataset.estado = estado;
      delete c.dataset.n;
      c.style.zIndex = String(20 - i);
      const recorte = estado === 'llena' ? 0 : c.hLlena - c.hCompacta;
      c.style.clipPath = `inset(0px 0px ${recorte}px 0px round 8px)`;
      if (estado === 'llena' || estado === 'compacta') {
        c.style.transform = `translate3d(0, ${y}px, 0)`;
        c.style.opacity = '1';
        ultima = { y, h: estado === 'llena' ? c.hLlena : c.hCompacta };
        y += ultima.h + HUECO;
      } else {
        const n = Math.min(k, 3);
        const s = 1 - 0.05 * n;
        const ty = ultima.y + ultima.h + 8 * n - c.hCompacta * s;
        c.style.transform = `translate3d(0, ${ty}px, 0) scale(${s})`;
        c.dataset.n = String(n);
        c.style.opacity = estado === 'mazo' ? (n === 1 ? '1' : '0.8') : '0';
        if (estado === 'fuera' && !c.quitando) {
          c.quitando = true;
          setTimeout(() => {
            c.remove();
            vivos = vivos.filter((v) => v !== c);
          }, 420);
        }
      }
    });
  };
  const sinTransicion = (f) => {
    vivos.forEach((c) => (c.style.transition = 'none'));
    f();
    feed.offsetHeight;
    vivos.forEach((c) => (c.style.transition = ''));
  };

  const llegar = (i, animar) => {
    const c = crear(EV[i]);
    c.dataset.i = String(i);
    vivos[0]?.classList.remove('nueva');
    c.classList.add('nueva');
    c.style.transition = 'none';
    c.style.opacity = '0';
    c.style.transform = `translate3d(0, ${ARRIBA() - 16}px, 0) scale(0.96)`;
    c.style.clipPath = 'inset(0px 0px 0px 0px round 8px)';
    feed.append(c);
    medir(c);
    vivos.unshift(c);
    feed.classList.remove('vacio');
    if (animar) {
      c.offsetHeight;
      c.style.transition = '';
      colocar();
    } else {
      sinTransicion(colocar);
    }
    marcas.forEach((m, j) => {
      m.classList.toggle('hecha', j <= i);
      m.classList.toggle('ahora', j === i);
    });
  };

  const vaciar = () => {
    vivos.forEach((c) => {
      c.style.transition = 'opacity 320ms ease, transform 420ms var(--ease-out)';
      c.style.opacity = '0';
      c.style.transform += ' translateY(10px)';
      setTimeout(() => c.remove(), 440);
    });
    vivos = [];
    marcas.forEach((m) => m.classList.remove('hecha', 'ahora'));
    setTimeout(() => !vivos.length && feed.classList.add('vacio'), 260);
  };

  /* ── contador «soluciones funcionando hoy» ── */
  let cuenta = -1;
  const ponerCuenta = (n, animar) => {
    if (n === cuenta) return;
    cuenta = n;
    etiqueta.textContent = n === 1 ? 'solución funcionando hoy' : 'soluciones funcionando hoy';
    const viejo = num.querySelector('span:not(.sale)');
    const nuevo = document.createElement('span');
    nuevo.textContent = String(n);
    if (!animar || !viejo) {
      num.replaceChildren(nuevo);
      return;
    }
    nuevo.className = 'entra-num';
    num.append(nuevo);
    nuevo.offsetHeight;
    viejo.classList.add('sale');
    nuevo.classList.remove('entra-num');
    setTimeout(() => viejo.remove(), 460);
  };

  /* ── reloj ── */
  let anchoPista = pista.clientWidth;
  let horaMostrada = '';
  const pintarReloj = (min) => {
    const p = (min - INICIO) / (FINAL - INICIO);
    lleno.style.transform = `scaleX(${p.toFixed(4)})`;
    const x = p * anchoPista;
    cursor.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    const texto = fmt(Math.round(min / 5) * 5);
    if (texto !== horaMostrada) {
      horaMostrada = texto;
      hora.textContent = texto;
    }
    const bw = hora.offsetWidth;
    let off = -bw / 2;
    off = Math.max(off, -x - 12);
    off = Math.min(off, anchoPista - x + 12 - bw);
    hora.style.transform = `translateX(${off.toFixed(1)}px)`;
  };

  /* ── el motor ── */
  let t = 0;
  let llegadas = 0;
  const avanzar = (animar) => {
    if (t >= CICLO) {
      t -= CICLO;
      llegadas = 0;
    }
    if (t < CIERRE) {
      while (llegadas < EV.length && T[llegadas] <= t) {
        llegar(llegadas, animar);
        llegadas++;
        ponerCuenta(llegadas, animar);
      }
    } else if (vivos.length && llegadas) {
      vaciar();
      llegadas = 0;
      ponerCuenta(0, animar);
    }
    pintarReloj(minutos(t));
  };

  const listo = document.fonts?.ready || Promise.resolve();
  listo.then(() => {
    anchoPista = pista.clientWidth;
    if (quieto) {
      t = T[T.length - 1] + 0.01;
      avanzar(false);
      dia.dataset.estado = 'quieto';
      return;
    }
    // la primera vez el día ya va por la tarde: escuela, tienda, restaurante y hotel; el taller llega enseguida
    t = T[3] + 0.01;
    avanzar(false);
    t = T[4] - 1.2;
    pintarReloj(minutos(t));
    arrancar();
  });

  let pausado = false;
  let enVista = true;
  let corriendo = false;
  let antes = 0;
  const cuadro = (ahora) => {
    if (!corriendo) return;
    const dt = Math.min(ahora - antes, 80) / 1000;
    antes = ahora;
    t += dt;
    avanzar(true);
    requestAnimationFrame(cuadro);
  };
  function arrancar() {
    const debe = !pausado && enVista && !document.hidden && !quieto;
    dia.dataset.estado = pausado ? 'pausa' : 'corre';
    if (debe && !corriendo) {
      corriendo = true;
      antes = performance.now();
      requestAnimationFrame(cuadro);
    } else if (!debe) {
      corriendo = false;
    }
  }

  boton?.addEventListener('click', () => {
    pausado = !pausado;
    botonTxt.textContent = pausado ? 'Reproducir' : 'Pausar';
    boton.setAttribute('aria-pressed', String(pausado));
    arrancar();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => {
      enVista = en[0].isIntersecting;
      arrancar();
    }).observe(dia);
  }
  document.addEventListener('visibilitychange', arrancar);

  let espera;
  addEventListener('resize', () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      anchoPista = pista.clientWidth;
      vivos.forEach(medir);
      sinTransicion(colocar);
      pintarReloj(minutos(t));
    }, 120);
  });
})();
