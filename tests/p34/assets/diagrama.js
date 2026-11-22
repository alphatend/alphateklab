// alphateklab, propuesta 34: el diagrama del héroe.
// Lo que entra (QR, caja, cámara, nevera, página web) manda un pulso al panel, y el panel lo reparte a lo que sale
// (celular, pantalla de cocina, factura, reporte). Un solo reloj para todo: se detiene con el botón, fuera de
// pantalla y con la pestaña oculta. Con «reducir movimiento» queda quieto, con las líneas y el último estado.
(() => {
  const raiz = document.querySelector('[data-diagrama]');
  if (!raiz) return;
  const marco = raiz.closest('.diagrama-marco');
  const svg = raiz.querySelector('.dg-lineas');
  const panel = raiz.querySelector('.dg-panel');
  const boton = document.querySelector('[data-pausa]');
  const reducir = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const IN = ['qr', 'caja', 'camara', 'nevera', 'web'];
  const OUT = ['celular', 'cocina', 'factura', 'reporte'];
  const ent = {};
  const sal = {};
  IN.forEach((k) => (ent[k] = raiz.querySelector(`[data-in="${k}"]`)));
  OUT.forEach((k) => (sal[k] = raiz.querySelector(`[data-out="${k}"]`)));

  const VIAJE = 1150; // lo que tarda un pulso en recorrer su línea
  const PERIODO = 4000; // de un evento al siguiente
  const MIN_POR_EVENTO = 2; // el reloj del negocio avanza 2 minutos por evento
  const COLAS = [
    { largo: 76, op: 0.22 },
    { largo: 40, op: 0.45 },
    { largo: 12, op: 0.3 },
  ];

  /* ── reloj propio: avanza solo mientras se ve y no está en pausa ── */
  let t = 0;
  let ultimo = null;
  let raf = 0;
  let tareas = [];
  const anims = [];
  let pausado = false;
  let enVista = true;
  const corre = () => !pausado && enVista && !document.hidden && !reducir.matches;
  const en = (ms, fn) => tareas.push({ at: t + ms, fn });
  const animar = (dur, upd, fin) => anims.push({ ini: t, dur, upd, fin });
  const cuadro = (ahora) => {
    raf = 0;
    if (!corre()) {
      ultimo = null;
      return;
    }
    if (ultimo !== null) t += Math.min(48, ahora - ultimo);
    ultimo = ahora;
    for (let vuelta = 0; vuelta < 40; vuelta++) {
      tareas.sort((a, b) => a.at - b.at);
      if (!tareas.length || tareas[0].at > t) break;
      tareas.shift().fn();
    }
    for (const a of anims.slice()) {
      const p = Math.min(1, (t - a.ini) / a.dur);
      a.upd(p);
      if (p >= 1) {
        anims.splice(anims.indexOf(a), 1);
        a.fin?.();
      }
    }
    raf = requestAnimationFrame(cuadro);
  };
  const despertar = () => {
    if (!raf && corre()) raf = requestAnimationFrame(cuadro);
  };
  const suave = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // easeInOutCubic
  const sale = (x) => 1 - Math.pow(1 - x, 3); // easeOutCubic

  /* ── las líneas ── */
  const crear = (tag, attrs, padre) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    padre.append(el);
    return el;
  };
  const gBase = crear('g', {}, svg);
  const gCola = crear('g', {}, svg);
  const gPuerto = crear('g', {}, svg);
  const gPunto = crear('g', {}, svg);
  const rutas = {};
  [...IN.map((k) => `in:${k}`), ...OUT.map((k) => `out:${k}`)].forEach((clave) => {
    const r = { len: 0 };
    r.base = crear('path', { class: 'dg-base' }, gBase);
    r.colas = COLAS.map((_, i) => crear('path', { class: `dg-cola dg-cola--${i + 1}` }, gCola));
    r.p0 = crear('circle', { class: 'dg-puerto', r: 3.5 }, gPuerto);
    r.p1 = crear('circle', { class: 'dg-puerto', r: 3.5 }, gPuerto);
    r.punto = crear('g', { class: 'dg-punto' }, gPunto);
    crear('circle', { class: 'dg-halo', r: 8 }, r.punto);
    crear('circle', { class: 'dg-nucleo', r: 3.6 }, r.punto);
    rutas[clave] = r;
  });

  const poner = (r, d, a, b) => {
    r.base.setAttribute('d', d);
    r.colas.forEach((c) => c.setAttribute('d', d));
    r.len = r.base.getTotalLength();
    r.colas.forEach((c, i) => {
      c.style.strokeDasharray = `${COLAS[i].largo} ${r.len + COLAS[i].largo + 20}`;
      if (!c.dataset.viva) c.style.strokeDashoffset = COLAS[i].largo;
    });
    r.p0.setAttribute('cx', a.x);
    r.p0.setAttribute('cy', a.y);
    r.p1.setAttribute('cx', b.x);
    r.p1.setAttribute('cy', b.y);
  };

  const medir = () => {
    const r0 = raiz.getBoundingClientRect();
    if (!r0.width) return;
    svg.setAttribute('viewBox', `0 0 ${r0.width} ${r0.height}`);
    const vertical = getComputedStyle(raiz).getPropertyValue('--modo').trim() === 'v';
    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - r0.left, y: r.top - r0.top, w: r.width, h: r.height };
    };
    const p = rel(panel);
    IN.forEach((k, i) => {
      const n = rel(ent[k]);
      const off = i - (IN.length - 1) / 2;
      let a, b, d;
      if (!vertical) {
        a = { x: n.x + n.w, y: n.y + n.h / 2 };
        b = { x: p.x, y: p.y + p.h / 2 + off * 15 };
        const c = (b.x - a.x) * 0.52;
        d = `M${a.x},${a.y} C${a.x + c},${a.y} ${b.x - c},${b.y} ${b.x},${b.y}`;
      } else {
        a = { x: n.x + n.w / 2, y: n.y + n.h };
        b = { x: p.x + p.w / 2 + off * 22, y: p.y };
        const c = (b.y - a.y) * 0.55;
        d = `M${a.x},${a.y} C${a.x},${a.y + c} ${b.x},${b.y - c} ${b.x},${b.y}`;
      }
      poner(rutas[`in:${k}`], d, a, b);
    });
    OUT.forEach((k, i) => {
      const s = rel(sal[k]);
      const off = i - (OUT.length - 1) / 2;
      let a, b, d;
      if (!vertical) {
        a = { x: p.x + p.w, y: p.y + p.h / 2 + off * 15 };
        b = { x: s.x, y: s.y + s.h / 2 };
        const c = (b.x - a.x) * 0.52;
        d = `M${a.x},${a.y} C${a.x + c},${a.y} ${b.x - c},${b.y} ${b.x},${b.y}`;
      } else {
        const cx = p.x + p.w / 2;
        a = { x: cx, y: p.y + p.h };
        const izq = s.x + s.w / 2 < cx;
        const ex = izq ? s.x + s.w : s.x;
        const ty = s.y + 19;
        const rad = Math.min(10, Math.abs(cx - ex));
        const dir = izq ? -1 : 1;
        d = `M${cx},${a.y} L${cx},${ty - rad} Q${cx},${ty} ${cx + dir * rad},${ty} L${ex},${ty}`;
        b = { x: ex, y: ty };
      }
      poner(rutas[`out:${k}`], d, a, b);
    });
  };

  /* ── el pulso ── */
  const pulso = (clave) => {
    const r = rutas[clave];
    r.base.classList.add('viva');
    r.p0.classList.add('vivo');
    r.punto.classList.add('ve');
    r.colas.forEach((c) => (c.dataset.viva = '1'));
    animar(
      VIAJE,
      (x) => {
        const s = suave(x) * r.len;
        const pt = r.base.getPointAtLength(s);
        r.punto.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`);
        r.colas.forEach((c, i) => {
          c.style.strokeDashoffset = COLAS[i].largo - s;
          c.style.opacity = COLAS[i].op * Math.min(1, x * 5);
        });
      },
      () => {
        r.p1.classList.add('vivo');
        r.punto.classList.remove('ve');
        animar(420, (x) => r.colas.forEach((c, i) => (c.style.opacity = COLAS[i].op * (1 - x))), () => {
          r.colas.forEach((c, i) => {
            delete c.dataset.viva;
            c.style.strokeDashoffset = COLAS[i].largo;
          });
        });
        en(650, () => {
          r.base.classList.remove('viva');
          r.p0.classList.remove('vivo');
          r.p1.classList.remove('vivo');
        });
      },
    );
  };

  /* ── utilidades de la interfaz ── */
  const ICO = (id) => `<svg class="ico" aria-hidden="true" focusable="false"><use href="assets/iconos.svg#${id}"/></svg>`;
  const plata = (n) => `B/. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const reiniciar = (el, clase) => {
    el.classList.remove(clase);
    void el.offsetWidth;
    el.classList.add(clase);
  };
  // mete un elemento arriba de una lista recortada: la lista baja lo que mide el nuevo
  const meter = (lista, nuevo, max) => {
    lista.prepend(nuevo);
    const alto = nuevo.getBoundingClientRect().height + (parseFloat(getComputedStyle(nuevo).marginBottom) || 0);
    lista.style.setProperty('--sube', `${-alto}px`);
    reiniciar(lista, 'baja');
    while (lista.children.length > max) lista.lastElementChild.remove();
  };

  let minutos = 12 * 60 + 41;
  const hora = (m, larga) => {
    const h = Math.floor(m / 60) % 24;
    const mm = String(m % 60).padStart(2, '0');
    const h12 = ((h + 11) % 12) + 1;
    return larga ? `${h12}:${mm} ${h < 12 ? 'a. m.' : 'p. m.'}` : `${h12}:${mm}`;
  };
  const relojes = raiz.querySelectorAll('[data-hora]');

  const cifras = {
    ventas: { valor: 601.9, fmt: plata },
    pedidos: { valor: 40, fmt: (n) => String(n) },
    personas: { valor: 60, fmt: (n) => String(n) },
  };
  const ponerCifra = (k, suma) => {
    const c = cifras[k];
    c.valor = Math.round((c.valor + suma) * 100) / 100;
    const el = panel.querySelector(`[data-cifra="${k}"]`);
    el.querySelector('b span').textContent = c.fmt(c.valor);
    reiniciar(el, 'cambia');
  };

  /* el panel: lo último que pasó */
  const feed = panel.querySelector('.pn-feed ul');
  const MS_POR_MIN = PERIODO / MIN_POR_EVENTO;
  feed.querySelectorAll('li').forEach((li) => (li.creado = -Number(li.dataset.min || 0) * MS_POR_MIN));
  const fila = (f) => {
    const li = document.createElement('li');
    li.className = `nueva${f.alerta ? ' alerta' : ''}`;
    li.innerHTML = `<span class="pn-i">${ICO(f.ico)}</span><span></span><time>ahora</time>`;
    li.children[1].textContent = f.t;
    li.creado = t;
    feed.querySelectorAll('li').forEach((x) => {
      const m = Math.round((t - x.creado) / MS_POR_MIN);
      x.querySelector('time').textContent = m < 1 ? 'ahora' : `${m} min`;
    });
    meter(feed, li, 6);
    en(900, () => li.classList.remove('nueva'));
  };

  /* lo que sale */
  let enCurso = 2;
  let factura = 457;
  const barras = [...sal.reporte.querySelectorAll('.barras i')];
  const alturas = barras.map((b) => parseFloat(b.style.getPropertyValue('--h')) || 0.3);
  const pintarBarras = () => barras.forEach((b, i) => b.style.setProperty('--h', alturas[i].toFixed(3)));
  const SALIDA = {
    celular(ev) {
      const a = ev.aviso;
      const el = document.createElement('div');
      el.className = `aviso${a.tipo ? ` ${a.tipo}` : ''}`;
      el.innerHTML = `<span class="aviso__app">${ICO(a.ico)}</span><div><b><span></span></b><p></p></div>`;
      const b = el.querySelector('b');
      b.prepend(document.createTextNode(a.titulo));
      b.querySelector('span').textContent = hora(minutos);
      el.querySelector('p').textContent = a.texto;
      meter(sal.celular.querySelector('.sl-pila'), el, 3);
    },
    cocina(ev) {
      const c = ev.comanda;
      const el = document.createElement('div');
      el.className = 'comanda';
      el.innerHTML = '<b></b><span>Nueva</span><p></p>';
      el.querySelector('b').textContent = c.mesa;
      el.querySelector('p').textContent = c.que;
      meter(sal.cocina.querySelector('.sl-pila'), el, 3);
      enCurso = Math.min(4, enCurso + 1);
      sal.cocina.querySelector('[data-curso]').textContent = `${enCurso} en curso`;
    },
    factura(ev) {
      const f = ev.factura;
      const caja = sal.factura.querySelector('.sl-factura');
      factura += 1;
      caja.querySelector('b').textContent = `Factura ${String(factura).padStart(4, '0')}`;
      caja.querySelector('p').textContent = f.para;
      caja.querySelector('.total').textContent = plata(f.total);
      const estado = caja.querySelector('.estado');
      estado.className = 'estado espera';
      estado.querySelector('span').textContent = 'Emitiendo';
      reiniciar(caja, 'aparece');
      en(750, () => {
        estado.className = 'estado listo';
        estado.querySelector('span').textContent = 'Factura emitida';
      });
      enCurso = Math.max(1, enCurso - 1);
      en(900, () => (sal.cocina.querySelector('[data-curso]').textContent = `${enCurso} en curso`));
    },
    reporte(ev) {
      const rep = sal.reporte.querySelector('.sl-reporte');
      if (ev.venta) {
        rep.querySelector('b span').textContent = plata(cifras.ventas.valor);
        reiniciar(rep, 'cambia');
        const sube = 0.1 + ev.venta / 260;
        if (alturas[alturas.length - 1] + sube > 0.96) {
          alturas.shift();
          alturas.push(0.16 + sube);
        } else {
          alturas[alturas.length - 1] += sube;
        }
        pintarBarras();
      }
      if (ev.personas) rep.querySelector('small').textContent = `Entraron ${cifras.personas.valor} personas`;
    },
  };

  /* ── lo que pasa en el negocio de ejemplo: dos rondas que se repiten ── */
  const EVENTOS = [
    { de: 'qr', estado: 'Mesa 4 pidió', fila: { ico: 'i-qr-code', t: 'Mesa 4 pidió 2 patacones y 1 chicha' }, suma: { pedidos: 1 }, a: ['cocina'], comanda: { mesa: 'Mesa 4', que: '2 patacones, 1 chicha de piña' } },
    { de: 'caja', estado: 'Cobró B/. 10.50', fila: { ico: 'i-cash', t: 'Mesa 4 pagó B/. 10.50 con Yappy' }, suma: { ventas: 10.5 }, a: ['factura', 'reporte'], factura: { para: 'Mesa 4, Yappy', total: 10.5 }, venta: 10.5 },
    { de: 'nevera', estado: '8.9 °C, puerta abierta', alerta: true, fila: { ico: 'i-thermometer-simple', t: 'Nevera 2 subió a 8.9 °C', alerta: true }, a: ['celular'], aviso: { tipo: 'alerta', ico: 'i-thermometer-simple', titulo: 'Aviso: nevera 2', texto: 'Subió a 8.9 °C, puerta abierta.' } },
    { de: 'web', estado: 'Reserva para 4', fila: { ico: 'i-globe', t: 'Reserva en la página: 4 personas, 8:00 p. m.' }, a: ['celular'], aviso: { ico: 'i-calendar-check', titulo: 'Nueva reserva', texto: 'Mesa para 4, hoy a las 8:00 p. m.' } },
    { de: 'camara', estado: 'Entraron 3 personas', fila: { ico: 'i-security-camera', t: 'Entraron 3 personas por la puerta' }, suma: { personas: 3 }, a: ['reporte'], personas: 3 },
    { de: 'qr', estado: 'Mesa 9 pidió', fila: { ico: 'i-qr-code', t: 'Mesa 9 pidió 1 sancocho y 2 arroces con pollo' }, suma: { pedidos: 1 }, a: ['cocina'], comanda: { mesa: 'Mesa 9', que: '1 sancocho, 2 arroces con pollo' } },
    { de: 'caja', estado: 'Cobró B/. 18.75', fila: { ico: 'i-cash', t: 'Mesa 9 pagó B/. 18.75 con tarjeta' }, suma: { ventas: 18.75 }, a: ['factura', 'reporte'], factura: { para: 'Mesa 9, tarjeta', total: 18.75 }, venta: 18.75 },
    { de: 'nevera', estado: '4.2 °C, puerta cerrada', fila: { ico: 'i-thermometer-simple', t: 'Nevera 2 volvió a 4.2 °C' }, a: ['celular'], aviso: { tipo: 'bien', ico: 'i-check-circle', titulo: 'Nevera 2 en orden', texto: 'Volvió a 4.2 °C, puerta cerrada.' } },
    { de: 'web', estado: 'Pedido para llevar', fila: { ico: 'i-globe', t: 'Pedido para llevar: 3 carimañolas y 1 limonada' }, suma: { pedidos: 1 }, a: ['cocina'], comanda: { mesa: 'Para llevar', que: '3 carimañolas, 1 limonada' } },
    { de: 'camara', estado: 'Entraron 2 personas', fila: { ico: 'i-security-camera', t: 'Entraron 2 personas por la puerta' }, suma: { personas: 2 }, a: ['reporte'], personas: 2 },
  ];
  let indice = 0;

  const evento = (ev) => {
    const nodo = ent[ev.de];
    minutos += MIN_POR_EVENTO;
    relojes.forEach((r) => (r.textContent = hora(minutos, r.dataset.hora === 'larga')));
    nodo.classList.add('activo');
    reiniciar(nodo, 'emite');
    const small = nodo.querySelector('small');
    small.textContent = ev.estado;
    small.classList.toggle('alerta', !!ev.alerta);
    reiniciar(small, 'cambia');
    en(140, () => pulso(`in:${ev.de}`));
    const llega = 140 + VIAJE;
    en(llega, () => {
      panel.classList.add('recibe');
      nodo.classList.remove('activo', 'emite');
      fila(ev.fila);
      Object.entries(ev.suma || {}).forEach(([k, v]) => ponerCifra(k, v));
    });
    en(llega + 360, () => ev.a.forEach((o) => pulso(`out:${o}`)));
    en(llega + 700, () => panel.classList.remove('recibe'));
    const sale = llega + 360 + VIAJE;
    en(sale, () =>
      ev.a.forEach((o) => {
        sal[o].classList.add('activo');
        SALIDA[o](ev);
      }),
    );
    en(sale + 1500, () => ev.a.forEach((o) => sal[o].classList.remove('activo')));
  };
  const siguiente = () => {
    evento(EVENTOS[indice % EVENTOS.length]);
    indice += 1;
    en(PERIODO, siguiente);
  };

  /* ── las líneas se dibujan al entrar ── */
  const dibujar = () => {
    Object.values(rutas).forEach((r, i) => {
      r.base.style.strokeDasharray = `${r.len} ${r.len}`;
      r.base.style.strokeDashoffset = r.len;
      r.p0.style.opacity = 0;
      r.p1.style.opacity = 0;
      en(i * 45, () =>
        animar(
          900,
          (x) => {
            const e = sale(x);
            r.base.style.strokeDashoffset = r.len * (1 - e);
            r.p0.style.opacity = Math.min(1, x * 4);
            r.p1.style.opacity = Math.max(0, x * 3 - 2);
          },
          () => {
            r.base.style.strokeDasharray = '';
            r.base.style.strokeDashoffset = '';
            r.p0.style.opacity = '';
            r.p1.style.opacity = '';
          },
        ),
      );
    });
  };

  /* ── arranque, pausa y medidas ── */
  medir();
  let medirPendiente = 0;
  const remedir = () => {
    if (medirPendiente) return;
    medirPendiente = requestAnimationFrame(() => {
      medirPendiente = 0;
      medir();
    });
  };
  if ('ResizeObserver' in window) new ResizeObserver(remedir).observe(raiz);
  else addEventListener('resize', remedir);
  document.fonts?.ready.then(remedir);

  const quieto = () => {
    marco?.classList.add('sin-movimiento');
    raiz.classList.add('pausado');
  };
  if (reducir.matches) {
    quieto();
  } else {
    en(380, dibujar);
    en(1900, siguiente);
  }
  reducir.addEventListener?.('change', () => {
    if (reducir.matches) quieto();
    else {
      marco?.classList.remove('sin-movimiento');
      raiz.classList.toggle('pausado', pausado);
      if (!tareas.length) en(600, siguiente);
      despertar();
    }
  });

  boton?.addEventListener('click', () => {
    pausado = !pausado;
    boton.setAttribute('aria-pressed', String(pausado));
    boton.querySelector('span').textContent = pausado ? 'Reanudar' : 'Pausar';
    raiz.classList.toggle('pausado', pausado);
    despertar();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([e]) => {
        enVista = e.isIntersecting;
        despertar();
      },
      { threshold: 0.12 },
    ).observe(raiz);
  }
  document.addEventListener('visibilitychange', despertar);
  despertar();

  // para revisar cuadros sin esperar: window.__diagrama.avanzar(ms)
  window.__diagrama = {
    avanzar(ms) {
      const paso = 16;
      for (let x = 0; x < ms; x += paso) {
        t += paso;
        for (let v = 0; v < 40; v++) {
          tareas.sort((a, b) => a.at - b.at);
          if (!tareas.length || tareas[0].at > t) break;
          tareas.shift().fn();
        }
        for (const a of anims.slice()) {
          const p = Math.min(1, (t - a.ini) / a.dur);
          a.upd(p);
          if (p >= 1) {
            anims.splice(anims.indexOf(a), 1);
            a.fin?.();
          }
        }
      }
    },
    // detiene solo el reloj (las transiciones de CSS siguen), para tomar cuadros
    congelar(si) {
      pausado = si;
      despertar();
    },
  };
})();
