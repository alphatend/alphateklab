// alphateklab, propuesta 50: el héroe «Ventanas en perspectiva».
// Seis ventanas de negocios distintos, cada una con su propia novedad, y un cursor que pasa de una a otra tocando botones.
// Un solo reloj virtual mueve todo: si se pausa (botón, fuera de pantalla o pestaña oculta), todo queda donde está.
(() => {
  const heroe = document.querySelector('[data-heroe]');
  if (!heroe) return;
  const cumulo = heroe.querySelector('[data-cumulo]');
  const puntero = heroe.querySelector('[data-puntero]');
  const punteroY = puntero.firstElementChild;
  const boton = heroe.querySelector('[data-pausa-heroe]');
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SALIDA = 'cubic-bezier(0.23, 1, 0.32, 1)'; // ease-out fuerte
  const CUBICA = 'cubic-bezier(0.65, 0, 0.35, 1)'; // ease-in-out (easeInOutCubic)
  const CUADRA = 'cubic-bezier(0.45, 0, 0.55, 1)'; // ease-in-out (easeInOutQuad)
  let instantaneo = quieto;

  const V = (k) => heroe.querySelector(`[data-ven="${k}"]`);
  const ico = (n) => `<svg class="ico" aria-hidden="true"><use href="assets/iconos.svg#i-${n}"></use></svg>`;
  const nodo = (h) => {
    const t = document.createElement('template');
    t.innerHTML = h.trim();
    return t.content.firstElementChild;
  };
  const dinero = (n) => `B/. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /* ── el reloj ── */
  let t = 0, ultimo = 0, raf = 0, corriendo = false;
  const cola = [];
  const bucle = (ahora) => {
    t += Math.min(ahora - ultimo, 50);
    ultimo = ahora;
    while (cola.length && cola[0].en <= t) cola.shift().fn();
    raf = requestAnimationFrame(bucle);
  };
  const agendar = (ms, fn) => {
    const en = t + ms;
    let i = cola.findIndex((c) => c.en > en);
    if (i < 0) i = cola.length;
    cola.splice(i, 0, { en, fn });
  };
  const espera = (ms) => new Promise((r) => agendar(ms, r));

  /* ── piezas de movimiento ── */
  // un número que rueda: el viejo sube y se va, el nuevo entra desde abajo
  const rodar = (rueda, valor) => {
    if (!rueda) return;
    valor = String(valor);
    const viejo = rueda.lastElementChild;
    if (viejo && viejo.textContent === valor) return;
    const nuevo = document.createElement('span');
    nuevo.textContent = valor;
    rueda.append(nuevo);
    if (!viejo) return;
    if (instantaneo) {
      while (rueda.firstElementChild !== nuevo) rueda.firstElementChild.remove();
      return;
    }
    nuevo.animate([{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: SALIDA });
    viejo.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-70%)', opacity: 0 }], { duration: 260, easing: SALIDA, fill: 'forwards' }).onfinish = () => viejo.remove();
  };
  // FLIP con posiciones de maquetación (offsetLeft/Top), que no cambian con la inclinación 3D
  const flip = (els, mutar, dur = 440) => {
    const antes = new Map(els.map((e) => [e, [e.offsetLeft, e.offsetTop]]));
    mutar();
    if (instantaneo) return;
    antes.forEach(([x, y], e) => {
      if (!e.isConnected) return;
      const dx = x - e.offsetLeft, dy = y - e.offsetTop;
      if (dx || dy) e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: dur, easing: CUBICA });
    });
  };
  const entrar = (el, dy = 8) => {
    if (instantaneo) return;
    el.animate([{ opacity: 0, transform: `translateY(${dy}px) scale(.98)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SALIDA });
  };
  const destello = (el) => {
    if (instantaneo || !el) return;
    el.classList.remove('destello');
    void el.offsetWidth;
    el.classList.add('destello');
  };
  // cambia el contenido de una ventana como cuando la app pasa al siguiente registro
  const refrescar = async (els, cambiar) => {
    if (instantaneo) return cambiar();
    els.forEach((e) => e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease', fill: 'forwards' }));
    await espera(230);
    cambiar();
    els.forEach((e) => {
      e.getAnimations().forEach((a) => a.cancel());
      e.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: SALIDA });
    });
    await espera(380);
  };
  const aviso = (el, html, ms = 2400) => {
    if (!el) return;
    el.querySelector('span').textContent = html;
    el.classList.add('ver');
    if (!instantaneo) agendar(ms, () => el.classList.remove('ver'));
  };

  /* ═══ 1. Pedidos de Fonda Pixbae ═══ */
  const pedidos = (() => {
    const v = V('pedidos');
    const col = (k) => v.querySelector(`[data-col="${k}"]`);
    const vivos = (c) => [...c.children].filter((x) => !x.dataset.sale);
    const ventas = v.querySelector('[data-ventas]');
    const todos = () => [...v.querySelectorAll('.ticket')];
    let total = 601.9, i = 0;
    const LLEGAN = [['Mesa 4', '2 patacones, 1 chicha', 10.5], ['Mesa 8', '3 carimañolas, 1 café', 7.75], ['Mesa 12', '1 sancocho, 1 limonada', 8.25], ['Mesa 3', '2 hojaldras, 1 café', 6], ['Mesa 10', '1 corvina, 1 arroz', 11.5]];
    const contar = () => ['nuevos', 'cocina', 'listos'].forEach((k) => rodar(v.querySelector(`[data-n="${k}"]`), vivos(col(k)).length));
    const salir = (el) => {
      el.dataset.sale = '1';
      if (instantaneo) return el.remove();
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease', fill: 'forwards' }).onfinish = () => el.remove();
    };
    const meter = (k, tk, arriba) => {
      const c = col(k);
      flip(todos(), () => (arriba ? c.prepend(tk) : c.append(tk)));
      const vs = vivos(c);
      if (vs.length > 3) salir(vs[vs.length - 1]);
    };
    return {
      llega() {
        const [mesa, items, monto] = LLEGAN[i++ % LLEGAN.length];
        const tk = nodo(`<div class="ticket ticket--nuevo"><div class="ticket__fila"><b>${mesa}</b><span class="chip chip--nuevo">Nuevo</span></div><p>${items}</p></div>`);
        meter('nuevos', tk, true);
        entrar(tk, -10);
        total += monto;
        rodar(ventas, dinero(total));
        contar();
        if (!instantaneo) agendar(3400, () => {
          tk.classList.remove('ticket--nuevo');
          tk.querySelector('.chip--nuevo')?.replaceWith(nodo('<time>ahora</time>'));
        });
      },
      boton: () => col('cocina').querySelector('[data-listo]'),
      listo() {
        const b = this.boton();
        if (!b) return;
        const tk = b.closest('.ticket');
        b.remove();
        tk.querySelector('time')?.replaceWith(nodo('<span class="chip chip--ok">Listo</span>'));
        meter('listos', tk, true);
        destello(tk);
        contar();
      },
      aCocina() {
        const tk = vivos(col('nuevos')).pop();
        if (!tk) return;
        tk.classList.remove('ticket--nuevo');
        tk.querySelector('.chip--nuevo')?.replaceWith(nodo('<time>1 min</time>'));
        tk.append(nodo(`<span class="mini mini--linea" data-listo>${ico('check')}Marcar listo</span>`));
        meter('cocina', tk, false);
        contar();
      },
    };
  })();

  /* ═══ 2. Chat con IA de Inmobiliaria Costa ═══ */
  const chat = (() => {
    const v = V('chat');
    const caja = v.querySelector('[data-chat]');
    let h = 9, m = 41, k = 0;
    const hora = () => {
      m += 1 + (k % 2);
      if (m >= 60) { m -= 60; h += 1; }
      if (h > 12) h = 9;
      return `${h}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
    };
    const GUION = [
      ['tarjeta', 'Recorrido 3D del apartamento'],
      ['cli', 'Sí. ¿Puedo verlo el viernes?'],
      ['ia', 'Claro. Te agendé la visita para el viernes a las 10:00 a. m. Te mando la ubicación por aquí.'],
      ['cli', 'Hola, ¿tienen locales en alquiler en Obarrio?'],
      ['ia', 'Tenemos dos: uno de 60 m² a B/. 1,800 y otro de 85 m² a B/. 2,400 al mes. ¿Te mando las fotos?'],
      ['cli', 'El de 85, por favor.'],
      ['ia', 'Aquí van. Si te gusta, Ana, nuestra asesora, te lo enseña esta semana.'],
      ['cli', 'Buenas, ¿el apartamento de Costa del Este sigue disponible?'],
      ['ia', 'Sí. Tiene 2 recámaras y 98 m², a B/. 1,450 al mes. ¿Te muestro el recorrido 3D?'],
    ];
    const html = ([tipo, txt]) => {
      if (tipo === 'tarjeta') return `<div class="msj msj--ia msj--tarjeta"><img src="assets/producto/demo-recorrido-360.webp" width="1124" height="700" alt=""><div><b>${txt}</b><small>Ábrelo en tu teléfono</small></div></div>`;
      return `<div class="msj${tipo === 'ia' ? ' msj--ia' : ''}">${txt}<time>${hora()}</time></div>`;
    };
    const podar = () => [...caja.children].forEach((e) => { if (e.offsetTop + e.offsetHeight < 0) e.remove(); });
    const poner = (el, quitar) => {
      flip([...caja.children], () => (quitar ? quitar.replaceWith(el) : caja.append(el)), 420);
      entrar(el);
      if (instantaneo) podar();
      else agendar(500, podar);
    };
    return {
      async siguiente() {
        const paso = GUION[k++ % GUION.length];
        let dots = null;
        if (paso[0] !== 'cli' && !instantaneo) {
          dots = nodo('<div class="escribe" aria-hidden="true"><i></i><i></i><i></i></div>');
          poner(dots);
          await espera(1350);
        }
        poner(nodo(html(paso)), dots);
        return paso[0];
      },
    };
  })();

  /* ═══ 3. Asistencia del Colegio Los Robles ═══ */
  const asistencia = (() => {
    const v = V('asistencia');
    const lista = v.querySelector('[data-alumnos]');
    const resumen = v.querySelector('.asis__resumen');
    const grado = v.querySelector('[data-grado]');
    const pres = v.querySelector('[data-presentes]');
    const barra = v.querySelector('[data-barra]');
    const GRADOS = [
      { g: '5.º A', total: 24, p: 21, llega: 2, hora: '7:14 a. m.', al: [['Sofía Herrera', 'SH', '7:02 a. m.', 'ok'], ['Mateo González', 'MG', '7:05 a. m.', 'ok'], ['Camila Torres', 'CT', 'Sin marcar', 'pend'], ['Luis Pérez', 'LP', 'Sin marcar', 'aus'], ['Valeria Castillo', 'VC', '7:09 a. m.', 'ok']] },
      { g: '6.º B', total: 26, p: 22, llega: 1, hora: '7:12 a. m.', al: [['Diego Sánchez', 'DS', '6:58 a. m.', 'ok'], ['Isabella Ruiz', 'IR', 'Sin marcar', 'pend'], ['Andrés Vega', 'AV', '7:03 a. m.', 'ok'], ['Lucía Morales', 'LM', 'Sin marcar', 'aus'], ['Samuel Ortiz', 'SO', '7:06 a. m.', 'ok']] },
    ];
    const COLORES = ['#5a6468', '#4a5357', '#6b7376', '#3e4749', '#5f686a'];
    let gi = 0, presentes = 21, total = 24;
    const accion = (e) => (e === 'ok' ? '<span class="chip chip--ok">Presente</span>' : e === 'pend' ? '<span class="chip">Sin marcar</span>' : '<span class="chip chip--aviso">Ausente</span><span class="mini mini--linea" data-avisar>Avisar a la familia</span>');
    const pintar = (d) => {
      lista.innerHTML = d.al.map(([n, ini, h, e], i) => `<div class="alumno marca" data-al="${i}"><span class="ini" style="--c:${COLORES[i]}">${ini}</span><div><b>${n}</b><small data-hora>${h}</small></div><div class="accion" data-acc>${accion(e)}</div></div>`).join('');
      grado.textContent = `${d.g}, asistencia con QR`;
      presentes = d.p; total = d.total;
      pres.replaceChildren(nodo(`<span>${presentes}</span>`));
      pres.parentElement.lastChild.textContent = ` de ${total}`;
      barra.style.setProperty('--p', (presentes / total).toFixed(3));
    };
    return {
      escaneo() {
        const d = GRADOS[gi % GRADOS.length];
        const fila = lista.querySelector(`[data-al="${d.llega}"]`);
        if (!fila) return;
        fila.querySelector('[data-hora]').textContent = d.hora;
        fila.querySelector('[data-acc]').innerHTML = '<span class="chip chip--ok">Presente</span>';
        entrar(fila.querySelector('.chip'), 4);
        destello(fila);
        presentes += 1;
        rodar(pres, presentes);
        barra.style.setProperty('--p', (presentes / total).toFixed(3));
      },
      boton: () => lista.querySelector('[data-avisar]'),
      avisar() {
        const b = lista.querySelector('[data-avisar]');
        if (!b) return;
        const acc = b.parentElement;
        b.remove();
        acc.innerHTML = `<span class="chip chip--va">${ico('check')}Aviso enviado</span>`;
        entrar(acc.firstElementChild, 4);
      },
      async siguiente() {
        gi += 1;
        await refrescar([lista, resumen], () => pintar(GRADOS[gi % GRADOS.length]));
      },
    };
  })();

  /* ═══ 4. Inventario del Minisúper La Esquina ═══ */
  const inventario = (() => {
    const v = V('inventario');
    const cuerpo = v.querySelector('tbody');
    const sub = v.querySelector('.app__cab small');
    const porPedir = v.querySelector('[data-porpedir]');
    const avisoEl = v.querySelector('[data-aviso-inv]');
    const CATS = [
      { nombre: 'Abarrotes, 412 productos', vende: 0, cant: 2, oc: '0142', filas: [['Arroz 5 lb', 9, 8, 'ok', 'rgba(242,181,68,.28)'], ['Aceite 1 L', 11, 10, 'ok', 'rgba(224,178,90,.4)'], ['Leche 1 L', 26, 12, 'ok', 'rgba(58,125,140,.16)'], ['Café molido 425 g', 5, 8, 'pedido', 'rgba(32,39,41,.12)'], ['Azúcar 2 kg', 15, 6, 'ok', 'rgba(31,79,99,.1)']] },
      { nombre: 'Bebidas, 168 productos', vende: 1, cant: 3, oc: '0143', filas: [['Agua 1 L', 34, 24, 'ok', 'rgba(58,125,140,.16)'], ['Jugo de naranja', 10, 8, 'ok', 'rgba(242,181,68,.28)'], ['Soda 2 L', 18, 12, 'ok', 'rgba(31,79,99,.1)'], ['Malta 355 ml', 40, 24, 'ok', 'rgba(32,39,41,.12)'], ['Té frío 500 ml', 6, 10, 'pedido', 'rgba(224,178,90,.4)']] },
    ];
    let ci = 0;
    const chip = (e) => (e === 'pedido' ? '<span class="chip chip--va">Pedido</span>' : '<span class="chip chip--ok">Al día</span>');
    const pintar = (c) => {
      cuerpo.innerHTML = c.filas.map(([p, e, m, est, col], i) => `<tr class="marca${e <= m ? ' bajo' : ''}" data-prod="${i}"><td><span class="inv__prod"><i style="--c:${col}"></i>${p}</span></td><td><span class="rueda" data-exist><span>${e}</span></span></td><td>${m}</td><td><span class="estado" data-estado>${chip(est)}</span></td></tr>`).join('');
      sub.textContent = c.nombre;
    };
    return {
      venta() {
        const c = CATS[ci % CATS.length];
        const [nombre, e, m] = c.filas[c.vende];
        const fila = cuerpo.querySelector(`[data-prod="${c.vende}"]`);
        if (!fila) return;
        const queda = e - c.cant;
        rodar(fila.querySelector('[data-exist]'), queda);
        destello(fila);
        aviso(avisoEl, `Caja 2 vendió ${c.cant} de ${nombre}`, 2200);
        if (queda <= m) {
          fila.classList.add('bajo');
          fila.querySelector('[data-estado]').innerHTML = '<span class="chip chip--aviso">Por pedir</span><span class="mini mini--ambar" data-pedir>Pedir</span>';
          entrar(fila.querySelector('[data-estado]'), 4);
          rodar(porPedir, 1);
        }
      },
      boton: () => cuerpo.querySelector('[data-pedir]'),
      pedir() {
        const b = cuerpo.querySelector('[data-pedir]');
        if (!b) return;
        const est = b.parentElement;
        est.innerHTML = '<span class="chip chip--va">Pedido</span>';
        entrar(est.firstElementChild, 4);
        rodar(porPedir, 0);
        aviso(avisoEl, `Orden de compra ${CATS[ci % CATS.length].oc} enviada al proveedor`, 2600);
      },
      async siguiente() {
        ci += 1;
        await refrescar([cuerpo, sub], () => pintar(CATS[ci % CATS.length]));
      },
    };
  })();

  /* ═══ 5. Reservas de Cabañas El Valle ═══ */
  const reservas = (() => {
    const v = V('reservas');
    const cal = v.querySelector('.cal');
    const semana = v.querySelector('[data-semana]');
    const sync = v.querySelector('[data-sync]');
    const SEMANAS = [
      { etiqueta: '17 al 23 de nov.', dia0: 17, hoy: 2, filas: [[['booking', 'Booking: Familia Díaz', 2, 3]], [['directa', 'Directa: Ana Ríos', 4, 4]], [['airbnb', 'Airbnb: J. Smith', 2, 2]], [['directa', 'Directa: Luis Pérez', 3, 3], ['booking', 'Booking: K. Lee', 7, 2]]], nueva: [2, 5, 3, 'María Gómez'] },
      { etiqueta: '24 al 30 de nov.', dia0: 24, hoy: -1, filas: [[['airbnb', 'Airbnb: M. Brown', 2, 2]], [['booking', 'Booking: Familia Ortiz', 3, 3]], [['directa', 'Directa: Rosa Núñez', 5, 3]], [['directa', 'Directa: Carlos Vega', 2, 4]]], nueva: [0, 5, 3, 'Pedro Castillo'] },
    ];
    const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    let si = 0;
    const pintar = (s) => {
      const cab = `<div class="cal__fila cal__fila--dias"><span></span>${DIAS.map((d, i) => `<span${i === s.hoy ? ' class="hoy"' : ''}>${d}<b>${s.dia0 + i}</b></span>`).join('')}</div>`;
      const filas = s.filas.map((bs, f) => `<div class="cal__fila"><span class="cal__cab">Cabaña ${f + 1}</span>${bs.map(([tipo, txt, c, n]) => `<span class="barra barra--${tipo}" style="grid-column:${c} / span ${n}">${txt}</span>`).join('')}${s.nueva[0] === f ? `<span class="barra barra--nueva" data-nueva style="grid-column:${s.nueva[1]} / span ${s.nueva[2]}"></span>` : ''}</div>`).join('');
      cal.innerHTML = cab + filas;
      semana.textContent = s.etiqueta;
    };
    const nuevaBarra = () => cal.querySelector('[data-nueva]') || cal.querySelector('.barra--nueva[data-slot="0"]');
    return {
      nueva() {
        const s = SEMANAS[si % SEMANAS.length];
        const b = nuevaBarra();
        if (!b) return;
        b.innerHTML = `<span>${s.nueva[3]}</span><span class="mini mini--ambar" data-confirmar>Confirmar</span>`;
        b.classList.add('ver');
      },
      boton: () => cal.querySelector('[data-confirmar]'),
      confirmar() {
        const b = cal.querySelector('[data-confirmar]')?.closest('.barra');
        if (!b) return;
        const s = SEMANAS[si % SEMANAS.length];
        b.classList.add('lista');
        b.innerHTML = `Directa: ${s.nueva[3]}`;
        const txt = sync.querySelector('span');
        txt.textContent = 'Fechas cerradas en Booking y Airbnb';
        entrar(sync, 3);
        if (!instantaneo) agendar(3200, () => { txt.textContent = 'Calendario al día'; });
      },
      async siguiente() {
        si += 1;
        await refrescar([cal, semana], () => pintar(SEMANAS[si % SEMANAS.length]));
      },
    };
  })();

  /* ═══ 6. Factura electrónica del Taller Rivera ═══ */
  const factura = (() => {
    const v = V('factura');
    const fac = v.querySelector('[data-fac]');
    const hoja = v.querySelector('[data-fac-hoja]');
    const num = v.querySelector('[data-fac-num]');
    const estado = v.querySelector('[data-fac-estado]');
    const texto = v.querySelector('[data-fac-texto]');
    const emitirB = v.querySelector('[data-emitir]');
    const FACTURAS = [
      { n: '0457', cliente: 'Carlos Méndez', placa: 'AB 1234', lineas: [['Cambio de aceite y filtro', 45], ['Alineación y balanceo', 30]] },
      { n: '0458', cliente: 'Daniela Ruiz', placa: 'CD 5678', lineas: [['Lavado completo', 15], ['Encerado', 20], ['Aspirado interior', 8]] },
      { n: '0459', cliente: 'Jorge Batista', placa: 'EF 9012', lineas: [['Pastillas de freno', 60], ['Revisión general', 25]] },
    ];
    let fi = 0;
    const pintar = (f) => {
      const sub = f.lineas.reduce((a, [, p]) => a + p, 0);
      const itbms = Math.round(sub * 7) / 100;
      hoja.innerHTML = `<div class="fac__datos"><span>Cliente</span><span>${f.cliente}</span><span>Vehículo</span><span>Placa ${f.placa}</span></div><ul class="fac__lineas">${f.lineas.map(([d, p]) => `<li><span>${d}</span><span>${dinero(p)}</span></li>`).join('')}</ul><div class="fac__tot"><div><span>Subtotal</span><span>${dinero(sub)}</span></div><div><span>ITBMS 7 %</span><span>${dinero(itbms)}</span></div><div class="total"><span>Total</span><span>${dinero(sub + itbms)}</span></div></div>`;
      num.textContent = `Factura ${f.n}`;
      estado.className = 'chip';
      estado.textContent = 'Borrador';
      texto.innerHTML = '<b>Lista para emitir</b>Se envía al cliente por correo.';
      fac.classList.remove('fac--autorizada');
      emitirB.style.visibility = '';
    };
    const autorizar = () => {
      const f = FACTURAS[fi % FACTURAS.length];
      fac.classList.add('fac--autorizada');
      estado.className = 'chip chip--ok';
      estado.textContent = 'Autorizada';
      texto.innerHTML = `<b>Factura autorizada</b>Enviada a ${f.cliente.split(' ')[0]} por correo.`;
      entrar(texto, 4);
    };
    return {
      boton: () => (emitirB.style.visibility === 'hidden' ? null : emitirB),
      emitir() {
        emitirB.style.visibility = 'hidden';
        estado.className = 'chip chip--azul';
        estado.innerHTML = '<span class="carga" aria-hidden="true"></span>Emitiendo';
        texto.innerHTML = '<b>Emitiendo…</b>La factura va a autorizarse.';
        if (instantaneo) autorizar();
        else agendar(1500, autorizar);
      },
      async siguiente() {
        fi += 1;
        if (instantaneo) return pintar(FACTURAS[fi % FACTURAS.length]);
        hoja.classList.add('sale');
        await espera(280);
        pintar(FACTURAS[fi % FACTURAS.length]);
        hoja.classList.remove('sale');
        hoja.classList.add('llega');
        void hoja.offsetWidth;
        hoja.classList.remove('llega');
        await espera(420);
      },
    };
  })();

  /* ═══ el cursor ═══ */
  let px = 0, py = 0;
  const sinCursor = () => getComputedStyle(puntero).display === 'none';
  const visible = (el) => el && el.getClientRects().length > 0 && el.closest('.ven') && getComputedStyle(el.closest('.ven')).display !== 'none';
  const punto = (el, fx = 0.5, fy = 0.56) => {
    const r = el.getBoundingClientRect();
    const h = heroe.getBoundingClientRect();
    return [r.left + r.width * fx - h.left, r.top + r.height * fy - h.top];
  };
  const colocar = (x, y) => {
    puntero.style.transform = `translateX(${x - 3}px)`;
    punteroY.style.transform = `translateY(${y - 2}px)`;
    px = x; py = y;
  };
  const mover = async (x, y) => {
    const d = Math.hypot(x - px, y - py);
    const dur = Math.round(Math.min(1250, Math.max(620, 520 + d * 0.95)));
    const ax = puntero.animate([{ transform: `translateX(${px - 3}px)` }, { transform: `translateX(${x - 3}px)` }], { duration: dur, easing: CUBICA, fill: 'forwards' });
    const ay = punteroY.animate([{ transform: `translateY(${py - 2}px)` }, { transform: `translateY(${y - 2}px)` }], { duration: dur, easing: CUADRA, fill: 'forwards' });
    await espera(dur);
    colocar(x, y);
    ax.cancel();
    ay.cancel();
  };
  const onda = (x, y) => {
    const o = document.createElement('span');
    o.className = 'onda';
    o.style.left = `${x}px`;
    o.style.top = `${y}px`;
    heroe.append(o);
    o.addEventListener('animationend', () => o.remove());
  };
  const tocar = async (el, accion) => {
    if (!el) return;
    if (sinCursor()) {
      if (!visible(el)) { accion(); return; }
      await espera(1000);
      const [x, y] = punto(el, 0.5, 0.5);
      onda(x, y);
      el.classList.add('pulsado');
      await espera(160);
      el.classList.remove('pulsado');
      accion();
      return;
    }
    puntero.classList.add('ver');
    const [x, y] = punto(el);
    await mover(x, y);
    await espera(150);
    puntero.classList.add('toca');
    el.classList.add('pulsado');
    onda(x, y);
    await espera(150);
    puntero.classList.remove('toca');
    el.classList.remove('pulsado');
    accion();
  };
  const descansar = async () => {
    if (sinCursor()) return;
    const c = cumulo.getBoundingClientRect();
    const h = heroe.getBoundingClientRect();
    await mover(c.left + c.width * 0.36 - h.left, c.top + c.height * 0.6 - h.top);
  };

  /* ═══ el guion: una vuelta de unos 20 segundos ═══ */
  async function guion() {
    const c0 = cumulo.getBoundingClientRect();
    const h0 = heroe.getBoundingClientRect();
    colocar(c0.left + c0.width * 0.2 - h0.left, c0.top + c0.height * 0.78 - h0.top);
    let vuelta = 0;
    await espera(500);
    for (;;) {
      pedidos.llega();
      await espera(500);
      await tocar(pedidos.boton(), () => pedidos.listo());
      await espera(900);
      pedidos.aCocina();
      await espera(500);

      if (vuelta) await asistencia.siguiente();
      asistencia.escaneo();
      await espera(700);
      await tocar(asistencia.boton(), () => asistencia.avisar());
      await espera(700);

      if (vuelta) await inventario.siguiente();
      inventario.venta();
      await espera(1100);
      await tocar(inventario.boton(), () => inventario.pedir());
      await espera(800);

      if (vuelta) await reservas.siguiente();
      reservas.nueva();
      await espera(1100);
      await tocar(reservas.boton(), () => reservas.confirmar());
      await espera(800);

      if (vuelta) await factura.siguiente();
      await espera(300);
      await tocar(factura.boton(), () => factura.emitir());
      await espera(2300);
      await descansar();
      await espera(1600);
      vuelta += 1;
    }
  }
  async function charlar() {
    await espera(1800);
    for (;;) {
      const tipo = await chat.siguiente();
      await espera(tipo === 'cli' ? 1500 : 3400);
    }
  }

  /* ═══ pausa: botón, fuera de pantalla y pestaña oculta ═══ */
  const motivos = { boton: false, fuera: false, oculta: document.visibilityState !== 'visible' };
  const animaciones = () => heroe.getAnimations({ subtree: true });
  const reanudar = () => {
    if (corriendo) return;
    corriendo = true;
    ultimo = performance.now();
    raf = requestAnimationFrame(bucle);
    animaciones().forEach((a) => a.playState === 'paused' && a.play());
  };
  const detener = () => {
    if (!corriendo) return;
    corriendo = false;
    cancelAnimationFrame(raf);
    animaciones().forEach((a) => a.playState === 'running' && a.pause());
  };
  const decidir = () => (motivos.boton || motivos.fuera || motivos.oculta ? detener() : reanudar());

  /* ═══ arranque ═══ */
  if (quieto) {
    // movimiento reducido: queda quieta en el último cuadro, con todo lo que pasó a la vista
    pedidos.llega();
    pedidos.listo();
    pedidos.aCocina();
    asistencia.escaneo();
    asistencia.avisar();
    inventario.venta();
    inventario.pedir();
    reservas.nueva();
    reservas.confirmar();
    factura.emitir();
    chat.siguiente();
    chat.siguiente();
    chat.siguiente();
    heroe.querySelectorAll('.ven__aviso').forEach((a) => a.classList.remove('ver'));
    boton?.closest('.heroe__control')?.querySelector('button')?.remove();
    return;
  }
  instantaneo = false;
  boton?.addEventListener('click', () => {
    motivos.boton = !motivos.boton;
    boton.setAttribute('aria-pressed', String(motivos.boton));
    boton.querySelector('span').textContent = motivos.boton ? 'Reproducir' : 'Pausar';
    decidir();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { motivos.fuera = !e[0].isIntersecting; decidir(); }, { threshold: 0.05 }).observe(cumulo);
  }
  document.addEventListener('visibilitychange', () => { motivos.oculta = document.visibilityState !== 'visible'; decidir(); });

  // la entrada (CSS) dura ~1.4 s; luego la deriva y el reloj
  setTimeout(() => {
    heroe.classList.add('vivo');
    guion();
    charlar();
    decidir();
  }, 1250);
})();
