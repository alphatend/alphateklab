// alphateklab, propuesta 40: la escena del héroe. Los equipos de un restaurante de ejemplo se turnan: el equipo late,
// una línea fina llega al teléfono del dueño y el aviso entra en su lista. Se puede tocar un equipo y pausar.
// Todo es un negocio de ejemplo con datos simulados.
(() => {
  const escena = document.querySelector('[data-escena]');
  if (!escena) return;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const PASO = 3800; // un equipo cada 3.8 s: calmado

  const piso = escena.querySelector('.piso');
  const tel = escena.querySelector('.telefono');
  const svg = escena.querySelector('[data-cables]');
  const lista = escena.querySelector('[data-lista]');
  const ventasEl = escena.querySelector('[data-ventas]');
  const pedidosEl = escena.querySelector('[data-pedidos]');
  const horaEl = escena.querySelector('[data-hora]');
  const anuncio = escena.querySelector('[data-anuncio]');
  const boton = escena.querySelector('[data-pausa]');
  const tejas = Object.fromEntries([...escena.querySelectorAll('.equipo')].map((b) => [b.dataset.equipo, b]));

  const ICO = { qr: 'i-qr-code', pantalla: 'i-monitor', caja: 'i-cash-register', camara: 'i-security-camera', nevera: 'i-thermometer-simple' };
  const NOMBRE = { qr: 'QR en las mesas', pantalla: 'Pantalla de cocina', caja: 'Caja', camara: 'Cámara de la puerta', nevera: 'Sensor de la nevera' };
  const ORDEN = ['qr', 'pantalla', 'caja', 'camara', 'nevera'];

  // el estado del día (simulado)
  const dia = { min: 12 * 60 + 41, ventas: 601.9, pedidos: 41, personas: 63 };
  const dinero = (n) => `B/. ${n.toFixed(2)}`;
  // cada equipo alterna sus dos avisos; «m» son los minutos simulados desde el aviso anterior
  const EVENTOS = {
    qr: [
      { m: 0, titulo: 'Mesa 4', texto: 'Pidió desde el QR: 2 patacones y 1 chicha de piña.', antes: () => dia.pedidos++, valor: () => `${dia.pedidos} pedidos hoy` },
      { m: 9, titulo: 'Mesa 9', texto: 'Pidió desde el QR: 1 sancocho y 2 arroces con pollo.', antes: () => dia.pedidos++, valor: () => `${dia.pedidos} pedidos hoy` },
    ],
    pantalla: [
      { m: 11, titulo: 'Cocina', texto: 'La orden de la mesa 4 está lista. Salió en 11 minutos.', valor: () => '2 órdenes en curso' },
      { m: 14, titulo: 'Cocina', texto: 'La orden de la mesa 9 está lista. Salió en 14 minutos.', valor: () => '1 orden en curso' },
    ],
    caja: [
      { m: 26, titulo: 'Caja', texto: 'La mesa 4 pagó B/. 10.50 con Yappy. Factura electrónica enviada.', antes: () => (dia.ventas += 10.5), valor: () => `${dinero(dia.ventas)} hoy` },
      { m: 22, titulo: 'Caja', texto: 'La mesa 9 pagó B/. 19.50 con tarjeta y dividió la cuenta en 3.', antes: () => (dia.ventas += 19.5), valor: () => `${dinero(dia.ventas)} hoy` },
    ],
    camara: [
      { m: 14, titulo: 'Cámara de la puerta', texto: 'Hoy entraron 64 personas. La hora pico fue de 12 a 1 p. m.', antes: () => (dia.personas = Math.max(dia.personas + 1, 64)), valor: () => `${dia.personas} personas hoy` },
      { m: 12, titulo: 'Cámara de la puerta', texto: 'Hay 6 personas esperando mesa en la entrada.', valor: () => '6 esperando mesa' },
    ],
    nevera: [
      { m: 48, titulo: 'Nevera 2', alerta: true, texto: 'Subió a 8.9 °C. La puerta lleva 6 minutos abierta.', valor: () => 'Nevera 2: 8.9 °C' },
      { m: 9, titulo: 'Nevera 2', texto: 'Volvió a 4.3 °C y la puerta está cerrada. Todo en orden.', valor: () => 'Nevera 2: 4.3 °C' },
    ],
  };
  const vuelta = Object.fromEntries(ORDEN.map((k) => [k, 0]));

  const icono = (id) => `<svg class="ico" aria-hidden="true" focusable="false"><use href="assets/iconos.svg#${id}"/></svg>`;
  const horaDe = (min) => {
    const h = Math.floor(min / 60) % 24;
    return `${h % 12 || 12}:${String(min % 60).padStart(2, '0')}`;
  };
  const relativo = (dif) => (dif <= 0 ? 'ahora' : dif < 60 ? `hace ${dif} min` : `hace ${Math.floor(dif / 60)} h`);

  /* ── los cables: uno por equipo, del equipo al borde del teléfono ── */
  const cables = {};
  let vertical = false;
  for (const k of ORDEN) {
    const base = document.createElementNS(NS, 'path');
    base.setAttribute('class', 'cable-base');
    const vivo = document.createElementNS(NS, 'path');
    vivo.setAttribute('class', 'cable-vivo');
    const punta = document.createElementNS(NS, 'circle');
    punta.setAttribute('class', 'cable-punta');
    punta.setAttribute('r', '3.5');
    svg.append(base, vivo, punta);
    cables[k] = { base, vivo, punta, largo: 0 };
  }
  function trazar() {
    const p = piso.getBoundingClientRect();
    const t = tel.getBoundingClientRect();
    if (!p.width) return;
    svg.setAttribute('viewBox', `0 0 ${p.width} ${p.height}`);
    vertical = t.left < p.right - 4;
    escena.classList.toggle('escena--vertical', vertical);
    for (const k of ORDEN) {
      const r = tejas[k].getBoundingClientRect();
      let d, x2, y2;
      if (!vertical) {
        const x1 = r.right - p.left;
        const y1 = r.top + r.height / 2 - p.top;
        x2 = t.left - p.left + 2;
        y2 = Math.min(Math.max(y1, t.top - p.top + 64), t.bottom - p.top - 48);
        const mx = x1 + (x2 - x1) * 0.55;
        d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      } else {
        const x1 = r.left + r.width / 2 - p.left;
        const y1 = r.bottom - p.top;
        x2 = Math.min(Math.max(x1, t.left - p.left + 44), t.right - p.left - 44);
        y2 = t.top - p.top + 2;
        const my = y1 + (y2 - y1) * 0.6;
        d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
      }
      const c = cables[k];
      c.base.setAttribute('d', d);
      c.vivo.setAttribute('d', d);
      c.punta.setAttribute('cx', x2);
      c.punta.setAttribute('cy', y2);
      c.largo = c.vivo.getTotalLength();
      c.vivo.style.strokeDasharray = `${c.largo}`;
      c.vivo.style.strokeDashoffset = `${c.largo}`;
    }
  }

  /* ── cambiar un texto sin salto: se funde con un desenfoque leve ── */
  function cambiar(el, valor) {
    if (!el || el.textContent === valor) return;
    el.textContent = valor;
    if (!quieto) el.animate([{ opacity: 0, filter: 'blur(2px)', transform: 'translateY(3px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 320, easing: EASE_OUT });
  }

  /* ── el aviso entra arriba de la lista: la lista baja lo que mide el aviso nuevo ── */
  function avisar(k, ev) {
    const li = document.createElement('li');
    li.className = 'aviso nuevo';
    li.innerHTML = `<span class="aviso__ico">${icono(ICO[k])}</span><div><div class="aviso__cab"><b></b><time data-min="${dia.min}">ahora</time></div><p>${ev.alerta ? '<span class="aviso__marca">Aviso</span>' : ''}</p></div>`;
    li.querySelector('b').textContent = ev.titulo;
    li.querySelector('p').append(ev.texto);
    lista.querySelectorAll('.aviso.nuevo').forEach((a) => a.classList.remove('nuevo'));
    lista.prepend(li);
    lista.querySelectorAll('time[data-min]').forEach((t) => (t.textContent = relativo(dia.min - Number(t.dataset.min))));
    if (!quieto) {
      const alto = li.offsetHeight + parseFloat(getComputedStyle(lista).rowGap || 0);
      lista.animate([{ transform: `translateY(${-alto}px)` }, { transform: 'translateY(0)' }], { duration: 640, easing: EASE_OUT });
      li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 460, delay: 90, easing: 'ease', fill: 'backwards' });
    } else {
      li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease' });
    }
    setTimeout(() => {
      while (lista.children.length > 6) lista.lastElementChild.remove();
    }, 700);
  }

  /* ── un paso: late el equipo, se dibuja la línea y entra el aviso ── */
  let pendientes = [];
  let activo = null;
  const despues = (ms, f) => pendientes.push(setTimeout(f, ms));
  function soltar() {
    pendientes.forEach(clearTimeout);
    pendientes = [];
    if (activo) {
      tejas[activo].classList.remove('activo', 'onda');
      const c = cables[activo];
      c.vivo.getAnimations().forEach((a) => a.cancel());
      c.punta.getAnimations().forEach((a) => a.cancel());
      activo = null;
    }
  }
  function paso(k, { manual = false } = {}) {
    soltar();
    const ev = EVENTOS[k][vuelta[k]++ % EVENTOS[k].length];
    dia.min += ev.m || 2;
    ev.antes?.();
    activo = k;
    const teja = tejas[k];
    const c = cables[k];
    teja.classList.remove('onda');
    void teja.offsetWidth;
    teja.classList.add('activo', 'onda');
    despues(quieto ? 0 : 140, () => cambiar(teja.querySelector('[data-valor]'), ev.valor()));

    const llega = quieto ? 0 : 760;
    if (quieto) {
      c.vivo.animate([{ opacity: 0, strokeDashoffset: 0 }, { opacity: 1, strokeDashoffset: 0 }], { duration: 200, fill: 'forwards' });
      c.punta.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' });
    } else {
      c.vivo.animate([{ strokeDashoffset: c.largo, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: 700, delay: 120, easing: EASE_IN_OUT, fill: 'both' });
      c.punta.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, delay: 700, easing: EASE_OUT, fill: 'both' });
    }
    despues(llega, () => {
      avisar(k, ev);
      cambiar(horaEl, horaDe(dia.min));
      if (k === 'caja') cambiar(ventasEl, dinero(dia.ventas));
      if (k === 'qr') cambiar(pedidosEl, String(dia.pedidos));
      if (manual && anuncio) anuncio.textContent = `${NOMBRE[k]}: ${ev.titulo}. ${ev.alerta ? 'Aviso: ' : ''}${ev.texto}`;
    });
    // la línea se apaga y el equipo vuelve a reposo
    despues(quieto ? 2600 : 2300, () => {
      const fuera = { duration: 500, easing: 'ease', fill: 'forwards' };
      c.vivo.animate([{ opacity: 1, strokeDashoffset: 0 }, { opacity: 0, strokeDashoffset: 0 }], fuera);
      c.punta.animate([{ opacity: 1 }, { opacity: 0 }], fuera);
      teja.classList.remove('activo');
    });
    despues(quieto ? 3200 : 3000, () => {
      c.vivo.getAnimations().forEach((a) => a.cancel());
      c.punta.getAnimations().forEach((a) => a.cancel());
      teja.classList.remove('onda');
      if (activo === k) activo = null;
    });
  }

  /* ── el turno automático, la pausa y la visibilidad ── */
  let turno = 0;
  let reloj = null;
  let pausado = quieto;
  let visible = false;
  const detener = () => {
    clearTimeout(reloj);
    reloj = null;
  };
  const programar = (ms) => {
    detener();
    if (pausado || !visible || document.hidden) return;
    reloj = setTimeout(() => {
      paso(ORDEN[turno++ % ORDEN.length]);
      programar(PASO);
    }, ms);
  };

  for (const k of ORDEN) {
    tejas[k].addEventListener('click', () => {
      paso(k, { manual: true });
      turno = ORDEN.indexOf(k) + 1;
      programar(PASO + 2600); // después de un toque, una pausa más larga antes de seguir solo
    });
  }

  boton?.addEventListener('click', () => {
    pausado = !pausado;
    boton.toggleAttribute('data-pausado', pausado);
    boton.querySelector('span').textContent = pausado ? 'Reanudar' : 'Pausar';
    if (pausado) detener();
    else programar(500);
  });

  // con movimiento reducido no hay turno automático: el teléfono ya trae avisos y se puede tocar cada equipo
  if (quieto) {
    for (const k of ['qr', 'nevera']) {
      const ev = EVENTOS[k][vuelta[k]++];
      dia.min += ev.m || 2;
      ev.antes?.();
      tejas[k].querySelector('[data-valor]').textContent = ev.valor();
      avisar(k, ev);
    }
    lista.querySelectorAll('.aviso.nuevo').forEach((a) => a.classList.remove('nuevo'));
    pedidosEl.textContent = String(dia.pedidos);
    horaEl.textContent = horaDe(dia.min);
  }

  const listo = () => {
    trazar();
    new ResizeObserver(() => trazar()).observe(piso);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) programar(reloj ? PASO : 1500);
        else detener();
      }, { threshold: 0.25 }).observe(escena);
    } else {
      visible = true;
      programar(1500);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? detener() : programar(900)));
  };
  if (document.fonts?.ready) document.fonts.ready.then(listo);
  else listo();
})();
