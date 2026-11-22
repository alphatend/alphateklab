// alphateklab, propuesta 37: el lienzo de automatizaciones del héroe.
// Un solo reloj (t) manda todo: los nodos se encienden en orden, un pulso recorre cada arista, cada acción
// queda con su palomita y su hora, y una línea entra al historial. Descansa y corre el otro ejemplo.
// Pausa con el botón, se detiene fuera de pantalla y con «menos movimiento» se queda quieto en el resultado.
(() => {
  const flujo = document.querySelector('[data-flujo]');
  if (!flujo) return;

  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lienzo = flujo.querySelector('[data-lienzo]');
  const capaAbajo = flujo.querySelector('[data-aristas]');
  const capaArriba = flujo.querySelector('[data-pulsos]');
  const nodos = [...lienzo.querySelectorAll('[data-nodo]')];
  const nombre = flujo.querySelector('[data-nombre]');
  const lado = [...flujo.querySelectorAll('[data-lado]')];
  const cuenta = flujo.querySelector('[data-cuenta]');
  const registro = flujo.querySelector('[data-registro]');
  const boton = flujo.querySelector('[data-pausa]');
  const SPRITE = 'assets/iconos.svg#';
  const NS = 'http://www.w3.org/2000/svg';

  /* curvas: las mismas de sitio.css (--ease-out y --ease-in-out) */
  const bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const fx = (s) => ((ax * s + bx) * s + cx) * s;
    const fy = (s) => ((ay * s + by) * s + cy) * s;
    const dx = (s) => (3 * ax * s + 2 * bx) * s + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let s = x;
      for (let i = 0; i < 8; i++) {
        const e = fx(s) - x;
        const d = dx(s);
        if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break;
        s -= e / d;
      }
      return fy(Math.min(1, Math.max(0, s)));
    };
  };
  const salida = bezier(0.23, 1, 0.32, 1);
  const vaiven = bezier(0.77, 0, 0.175, 1);

  /* los dos ejemplos */
  const ESCENAS = [
    {
      nombre: 'Nevera fuera de rango',
      duracion: '1.4 s',
      nodos: [
        { ico: 'i-thermometer-simple', t: 'La nevera 2 pasa de 5 °C', espera: 'Lectura: 4.6 °C', activo: (p) => `Lectura: ${(4.6 + 0.8 * p).toFixed(1)} °C`, hecho: 'Lectura: 5.4 °C, arriba del límite' },
        { ico: 'i-clock', t: 'Por más de 10 minutos', espera: 'En espera', activo: (p) => `Lleva ${Math.round(10 * p)} min arriba de 5 °C`, hecho: 'Se cumple: 10 min arriba de 5 °C' },
        { ico: 'i-chat-circle-dots', t: 'Avisar al encargado por mensaje', espera: 'En espera', activo: 'Enviando el mensaje…' },
        { ico: 'i-monitor', t: 'Mostrar alerta en la pantalla de cocina', espera: 'En espera', activo: 'Mostrando la alerta…' },
        { ico: 'i-file-text', t: 'Guardar en el reporte', espera: 'En espera', activo: 'Guardando la lectura…' },
      ],
    },
    {
      nombre: 'Reserva de mesa',
      duracion: '0.9 s',
      nodos: [
        { ico: 'i-calendar-check', t: 'Un cliente reserva una mesa', espera: 'Esperando reservas', activo: 'Mesa para 4, sábado 8:00 p. m.', hecho: 'Reserva de 4, sábado 8:00 p. m.' },
        { ico: 'i-rama', t: 'Hay mesa libre a esa hora', espera: 'En espera', activo: 'Revisando el mapa de mesas…', hecho: 'Sí: la mesa 6 está libre' },
        { ico: 'i-chat-circle-dots', t: 'Confirmar la reserva al cliente', espera: 'En espera', activo: 'Enviando la confirmación…' },
        { ico: 'i-monitor', t: 'Avisar a cocina', espera: 'En espera', activo: 'Mandando a la pantalla de cocina…' },
        { ico: 'i-clipboard-text', t: 'Apartar la mesa 6 en el mapa', espera: 'En espera', activo: 'Apartando la mesa…' },
      ],
    },
  ];

  /* reloj de mentira: cada corrida pasa unos minutos después de la anterior */
  let reloj = 15 * 3600 + 42 * 60 + 8;
  const hora = (seg, conSegundos = true) => {
    const h = Math.floor(seg / 3600) % 24;
    const m = String(Math.floor(seg / 60) % 60).padStart(2, '0');
    const s = String(seg % 60).padStart(2, '0');
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${m}${conSegundos ? `:${s}` : ''} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  };

  /* ── aristas ── */
  // 0: cuando → si; 1, 2 y 3: si → cada acción. Puertos: 0 salida de «cuando», 1 entrada de «si»,
  // 2 salida de «si», 3 a 5 entrada de cada acción.
  const UNION = [[0, 1], [2, 3], [2, 4], [2, 5]];
  let aristas = [];
  let puertos = [];
  const avance = [0, 0, 0, 0];
  const puertoOn = [false, false, false, false, false, false];

  const crear = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  const medir = () => {
    const rl = lienzo.getBoundingClientRect();
    if (!rl.width) return;
    const r = nodos.map((n) => {
      const b = n.getBoundingClientRect();
      return { x: b.left - rl.left, y: b.top - rl.top, w: b.width, h: b.height };
    });
    const vertical = getComputedStyle(lienzo).display === 'flex';
    let caminos;
    let pts;
    if (!vertical) {
      const sale = (q) => ({ x: q.x + q.w, y: q.y + q.h / 2 });
      const entra = (q) => ({ x: q.x, y: q.y + q.h / 2 });
      const curva = (a, b) => {
        const dx = Math.max(24, (b.x - a.x) * 0.5);
        return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
      };
      pts = [sale(r[0]), entra(r[1]), sale(r[1]), entra(r[2]), entra(r[3]), entra(r[4])];
      caminos = UNION.map(([a, b]) => curva(pts[a], pts[b]));
    } else {
      // de arriba abajo: una columna vertebral que se abre hacia cada acción
      const sx = r[0].x + 25;
      const yAccion = (q) => q.y + 23;
      pts = [
        { x: sx, y: r[0].y + r[0].h },
        { x: sx, y: r[1].y },
        { x: sx, y: r[1].y + r[1].h },
        ...[2, 3, 4].map((i) => ({ x: r[i].x, y: yAccion(r[i]) })),
      ];
      const rama = (q) => {
        const y = yAccion(q);
        const rad = Math.min(8, (q.x - sx) / 2);
        return `M${sx},${pts[2].y} V${y - rad} Q${sx},${y} ${sx + rad},${y} H${q.x}`;
      };
      caminos = [`M${sx},${pts[0].y} V${pts[1].y}`, rama(r[2]), rama(r[3]), rama(r[4])];
    }
    const caja = `0 0 ${rl.width} ${rl.height}`;
    capaAbajo.setAttribute('viewBox', caja);
    capaArriba.setAttribute('viewBox', caja);
    capaAbajo.replaceChildren();
    capaArriba.replaceChildren();
    aristas = caminos.map((d) => {
      const base = crear('path', { d, class: 'a-base' });
      const traza = crear('path', { d, class: 'a-traza' });
      capaAbajo.append(base, traza);
      const largo = traza.getTotalLength();
      traza.style.strokeDasharray = `${largo} ${largo + 2}`;
      const pulso = crear('g', { class: 'a-grupo' });
      pulso.append(crear('circle', { r: 7, class: 'a-halo' }), crear('circle', { r: 3, class: 'a-pulso' }));
      pulso.style.opacity = '0';
      return { traza, pulso, largo };
    });
    puertos = pts.map((p) => crear('circle', { cx: p.x, cy: p.y, r: 3.5, class: 'a-puerto' }));
    capaArriba.append(...puertos, ...aristas.map((a) => a.pulso));
    aristas.forEach((_, i) => pintar(i, true));
    puertos.forEach((p, i) => p.classList.toggle('on', puertoOn[i]));
  };

  const pintar = (i, sinTransicion) => {
    const a = aristas[i];
    if (!a) return;
    const p = avance[i];
    a.traza.style.strokeDashoffset = String(a.largo * (1 - p));
    const viaja = p > 0 && p < 1;
    if (viaja) {
      const pt = a.traza.getPointAtLength(a.largo * p);
      a.pulso.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    }
    if (sinTransicion) a.pulso.style.transition = 'none';
    a.pulso.style.opacity = viaja ? '1' : '0';
    if (sinTransicion) requestAnimationFrame(() => (a.pulso.style.transition = ''));
  };

  const arista = (i, p) => {
    avance[i] = p;
    const [de, a] = UNION[i];
    if (p > 0) prender(de);
    if (p >= 1) prender(a);
    pintar(i);
  };
  const prender = (i) => {
    puertoOn[i] = true;
    puertos[i]?.classList.add('on');
  };

  /* ── nodos ── */
  let escena = ESCENAS[0];
  const textoDe = (v, p) => (typeof v === 'function' ? v(p) : v);
  const estado = (i, cual, cuando) => {
    const n = nodos[i];
    const d = escena.nodos[i];
    n.classList.toggle('es-activo', cual === 'activo');
    n.classList.toggle('es-hecho', cual === 'hecho');
    const e = n.querySelector('[data-e]');
    if (cual === 'espera') e.textContent = d.espera;
    if (cual === 'activo') e.textContent = textoDe(d.activo, 0);
    if (cual === 'hecho') e.textContent = cuando ? `Hecho, ${cuando}` : d.hecho;
  };
  const barra = (i, p) => {
    const b = nodos[i].querySelector('.nodo__barra');
    if (p == null) {
      b.classList.remove('on');
      return;
    }
    b.classList.add('on');
    b.style.transform = `scaleX(${p})`;
  };

  const poner = (esc) => {
    escena = esc;
    nombre.textContent = esc.nombre;
    lado.forEach((li) => li.classList.toggle('activo', ESCENAS[+li.dataset.lado] === esc));
    nodos.forEach((n, i) => {
      const d = esc.nodos[i];
      n.querySelector('[data-t]').textContent = d.t;
      n.querySelector('.nodo__ico use').setAttribute('href', SPRITE + d.ico);
      const b = n.querySelector('.nodo__barra');
      b.classList.remove('on');
      b.style.transform = 'scaleX(0)';
      estado(i, 'espera');
    });
    avance.fill(0);
    puertoOn.fill(false);
    puertos.forEach((p) => p.classList.remove('on'));
    aristas.forEach((a, i) => {
      a.traza.classList.remove('apagada');
      pintar(i, true);
    });
  };

  /* ── historial ── */
  const registrar = (esc, seg, animar) => {
    const li = document.createElement('li');
    li.innerHTML = `<time></time><span class="r-nombre"></span><span class="r-res">3 de 3 acciones</span><span class="r-dur"></span>`;
    li.querySelector('time').textContent = hora(seg, false);
    li.querySelector('.r-nombre').textContent = esc.nombre;
    li.querySelector('.r-dur').textContent = esc.duracion;
    registro.prepend(li);
    while (registro.children.length > 4) registro.lastElementChild.remove();
    if (animar) {
      li.classList.add('nueva');
      const alto = li.getBoundingClientRect().height || 36;
      registro.animate([{ transform: `translateY(-${alto}px)` }, { transform: 'translateY(0)' }], {
        duration: 460,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
      });
    }
    const n = Number(cuenta.textContent) + 1;
    cuenta.textContent = String(n);
    if (animar) {
      cuenta.classList.add('sube');
      void cuenta.offsetWidth;
      cuenta.classList.remove('sube');
    }
  };

  /* ── la línea de tiempo de una corrida ── */
  const linea = (esc) => {
    const L = [];
    const en = (t, fn) => L.push({ t, d: 0, fn });
    const tramo = (t, d, fn, curva) => L.push({ t, d, fn, curva });
    const seg = reloj;
    en(400, () => estado(0, 'activo'));
    tramo(400, 800, (p) => {
      if (typeof esc.nodos[0].activo === 'function') nodos[0].querySelector('[data-e]').textContent = esc.nodos[0].activo(p);
    });
    en(1260, () => estado(0, 'hecho'));
    tramo(1260, 620, (p) => arista(0, p), vaiven);
    en(1880, () => estado(1, 'activo'));
    tramo(1880, 1000, (p) => {
      if (typeof esc.nodos[1].activo === 'function') nodos[1].querySelector('[data-e]').textContent = esc.nodos[1].activo(p);
      barra(1, p);
    });
    en(2900, () => {
      estado(1, 'hecho');
      barra(1, null);
    });
    [0, 1, 2].forEach((k) => {
      const sale = 2940 + k * 130;
      const llega = sale + 640;
      const listo = llega + 520 + k * 60;
      tramo(sale, 640, (p) => arista(1 + k, p), vaiven);
      en(llega, () => estado(2 + k, 'activo'));
      tramo(llega, listo - llega - 40, (p) => barra(2 + k, p), salida);
      en(listo, () => {
        estado(2 + k, 'hecho', hora(seg + (k === 2 ? 1 : 0)));
        barra(2 + k, null);
      });
    });
    en(4720, () => registrar(esc, seg, true));
    // descanso, y el lienzo se funde al otro ejemplo
    en(8700, () => {
      lienzo.classList.add('cambiando');
      flujo.classList.add('cambiando');
      aristas.forEach((a) => a.traza.classList.add('apagada'));
      puertos.forEach((p) => p.classList.remove('on'));
    });
    en(8940, () => (cambiar = true));
    return L.sort((a, b) => a.t + a.d - (b.t + b.d));
  };

  /* ── el motor ── */
  let indice = 0;
  let t = 0;
  let items = [];
  let ultimo = null;
  let corriendo = false;
  let pausado = false;
  let visible = true;
  let cambiar = false;

  const iniciar = (i) => {
    indice = i;
    poner(ESCENAS[i]);
    items = linea(ESCENAS[i]);
    t = 0;
    requestAnimationFrame(() => {
      lienzo.classList.remove('cambiando');
      flujo.classList.remove('cambiando');
    });
  };

  const cuadro = (ahora) => {
    if (!corriendo) return;
    if (ultimo == null) ultimo = ahora;
    t += Math.min(ahora - ultimo, 50);
    ultimo = ahora;
    for (const it of items) {
      if (it.listo || t < it.t) continue;
      if (it.d) {
        const p = Math.min(1, (t - it.t) / it.d);
        it.fn(it.curva ? it.curva(p) : p);
        if (p === 1) it.listo = true;
      } else {
        it.fn();
        it.listo = true;
      }
    }
    if (cambiar) {
      cambiar = false;
      reloj += 5 * 60 + 7;
      iniciar((indice + 1) % ESCENAS.length);
    }
    requestAnimationFrame(cuadro);
  };
  const arrancar = () => {
    if (corriendo || pausado || !visible || document.hidden) return;
    corriendo = true;
    ultimo = null;
    requestAnimationFrame(cuadro);
  };
  const parar = () => {
    corriendo = false;
  };

  /* el resultado quieto de un ejemplo (para «menos movimiento») */
  const final = (i) => {
    poner(ESCENAS[i]);
    nodos.forEach((_, k) => estado(k, 'hecho', k >= 2 ? hora(reloj + (k === 4 ? 1 : 0)) : null));
    avance.fill(1);
    puertoOn.fill(true);
    puertos.forEach((p) => p.classList.add('on'));
    aristas.forEach((_, k) => pintar(k, true));
  };

  // el lienzo guarda el alto del ejemplo más alto, para que la página no salte al cambiar de ejemplo
  const fijarAlto = () => {
    const titulos = nodos.map((n) => n.querySelector('[data-t]').textContent);
    lienzo.style.minHeight = '';
    let alto = 0;
    for (const esc of ESCENAS) {
      nodos.forEach((n, i) => (n.querySelector('[data-t]').textContent = esc.nodos[i].t));
      alto = Math.max(alto, lienzo.getBoundingClientRect().height);
    }
    nodos.forEach((n, i) => (n.querySelector('[data-t]').textContent = titulos[i]));
    lienzo.style.minHeight = `${Math.ceil(alto)}px`;
  };
  let ancho = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === ancho) return;
    ancho = innerWidth;
    fijarAlto();
  });
  fijarAlto();
  document.fonts?.ready.then(fijarAlto);

  // medir cuando cambia el tamaño (y cuando llega la fuente)
  const ro = new ResizeObserver(() => medir());
  ro.observe(lienzo);
  nodos.forEach((n) => ro.observe(n));
  medir();

  if (quieto) {
    final(0);
    registrar(ESCENAS[0], reloj, false);
    const etiqueta = boton.querySelector('span');
    etiqueta.textContent = 'Otro ejemplo';
    boton.removeAttribute('aria-pressed');
    boton.setAttribute('aria-label', 'Ver el otro ejemplo');
    boton.querySelector('.i-pausa').style.display = 'none';
    boton.querySelector('.i-seguir').style.display = 'block';
    boton.addEventListener('click', () => {
      indice = (indice + 1) % ESCENAS.length;
      reloj += 5 * 60 + 7;
      final(indice);
      registrar(ESCENAS[indice], reloj, false);
    });
    return;
  }

  iniciar(0);

  boton.addEventListener('click', () => {
    pausado = !pausado;
    boton.setAttribute('aria-pressed', String(pausado));
    boton.setAttribute('aria-label', pausado ? 'Seguir la animación' : 'Pausar la animación');
    boton.querySelector('span').textContent = pausado ? 'Seguir' : 'Pausar';
    if (pausado) parar();
    else arrancar();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) arrancar();
        else parar();
      },
      { threshold: 0.15 },
    ).observe(flujo);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? parar() : arrancar()));

  // empieza cuando la ventana ya terminó de entrar
  setTimeout(arrancar, 700);
})();
