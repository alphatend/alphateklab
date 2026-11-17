// alphateklab, propuesta v2: el tablero del sistema en vivo (héroe) y «lo que te llega al teléfono», por tipo de negocio.
// Todo es un negocio de ejemplo con datos simulados.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── los datos de cada tipo de negocio ── */
  const RUBROS = {
    restaurante: {
      equipos: [
        { ico: 'i-qr-code', nombre: 'QR en las mesas', valor: '41 pedidos hoy' },
        { ico: 'i-monitor', nombre: 'Pantalla de cocina', valor: '3 órdenes en curso' },
        { ico: 'i-thermometer-simple', nombre: 'Sensor de la nevera', valor: '4.1 °C' },
        { ico: 'i-security-camera', nombre: 'Cámara de la puerta', valor: '63 personas hoy' },
      ],
      inicio: { wa: 'Resumen de ayer: 58 personas, 37 pedidos y B/. 548.10 en ventas.', cifra: 'B/. 612.40', etiqueta: 'ventas de hoy', clientes: 'Mesa 7 pidió la cuenta dividida en 3.' },
      eventos: [
        { e: 0, s: 'clientes', t: 'Mesa 4 pidió desde el QR y pagó con Yappy.', v: '42 pedidos hoy' },
        { e: 1, s: 'panel', cifra: 'B/. 631.90', etiqueta: 'ventas de hoy', v: '4 órdenes en curso' },
        { e: 2, s: 'wa', t: 'Aviso: la nevera 2 subió a 8.9 °C. La puerta lleva 6 minutos abierta.', v: '8.9 °C', alerta: true },
        { e: 3, s: 'panel', cifra: '64', etiqueta: 'personas hoy', v: '64 personas hoy' },
        { e: 2, s: 'wa', t: 'La nevera 2 volvió a 4.3 °C. Todo en orden.', v: '4.3 °C' },
        { e: 1, s: 'clientes', t: 'La orden de la mesa 4 salió de la cocina en 11 minutos.', v: '2 órdenes en curso' },
      ],
    },
    tienda: {
      equipos: [
        { ico: 'i-security-camera', nombre: 'Cámara que cuenta', valor: '214 visitas hoy' },
        { ico: 'i-contactless-payment', nombre: 'Caja y cobro', valor: '96 ventas' },
        { ico: 'i-cube-focus', nombre: 'Inventario', valor: '3 productos por pedir' },
        { ico: 'i-lightning', nombre: 'Consumo eléctrico', valor: '41 kWh hoy' },
      ],
      inicio: { wa: 'Ayer la hora pico fue de 5 a 7 p. m.', cifra: 'B/. 1,840.50', etiqueta: 'ventas de hoy', clientes: 'Factura electrónica enviada al cliente de la venta 0457.' },
      eventos: [
        { e: 1, s: 'clientes', t: 'Venta 0458: B/. 23.75 con tarjeta. Factura electrónica enviada.', v: '97 ventas' },
        { e: 2, s: 'wa', t: 'Arroz de 5 lb: quedan 6. Al ritmo de hoy se acaba el jueves.', v: '4 productos por pedir', alerta: true },
        { e: 0, s: 'panel', cifra: '219', etiqueta: 'visitas hoy', v: '219 visitas hoy' },
        { e: 3, s: 'panel', cifra: '−8 %', etiqueta: 'luz frente a ayer', v: '43 kWh hoy' },
        { e: 1, s: 'wa', t: 'Aviso: la caja 1 cerró con B/. 12.00 menos de lo vendido.', alerta: true },
      ],
    },
    clinica: {
      equipos: [
        { ico: 'i-calendar-check', nombre: 'Agenda en línea', valor: '18 citas hoy' },
        { ico: 'i-chat-circle-dots', nombre: 'Recordatorios', valor: '16 confirmadas' },
        { ico: 'i-monitor', nombre: 'Pantalla de turnos', valor: 'Turno 12' },
        { ico: 'i-robot', nombre: 'Asistente con IA', valor: '9 chats atendidos' },
      ],
      inicio: { wa: 'Mañana tienes 18 citas; 16 ya confirmaron.', cifra: '4 %', etiqueta: 'inasistencias del mes', clientes: 'Recordatorio enviado a los 18 pacientes de mañana.' },
      eventos: [
        { e: 3, s: 'clientes', t: 'El asistente agendó una cita a las 10:47 p. m., con la clínica cerrada.', v: '10 chats atendidos' },
        { e: 1, s: 'wa', t: 'Aviso: 2 pacientes de mañana no han confirmado su cita.', alerta: true },
        { e: 0, s: 'panel', cifra: '17 de 18', etiqueta: 'pacientes atendidos', v: '18 citas hoy' },
        { e: 1, s: 'clientes', t: 'Un paciente canceló y su hora se ofreció a la lista de espera.', v: '17 confirmadas' },
        { e: 2, s: 'panel', cifra: '9 min', etiqueta: 'espera promedio', v: 'Turno 13' },
      ],
    },
    hotel: {
      equipos: [
        { ico: 'i-lock-key', nombre: 'Cerraduras con código', valor: '4 cabañas' },
        { ico: 'i-calendar-check', nombre: 'Reservas directas', valor: '3 esta semana' },
        { ico: 'i-broadcast', nombre: 'Booking y Airbnb', valor: 'Calendario al día' },
        { ico: 'i-thermometer-simple', nombre: 'Tanque de agua', valor: '78 %' },
      ],
      inicio: { wa: 'El fin de semana va al 90 % de ocupación.', cifra: 'B/. 72', etiqueta: 'ahorrados en comisiones', clientes: 'Código de la cabaña 2 enviado al huésped.' },
      eventos: [
        { e: 1, s: 'clientes', t: 'Reserva directa: cabaña 2, del 21 al 23. B/. 240 pagados con Yappy.', v: '4 esta semana' },
        { e: 2, s: 'panel', cifra: 'B/. 108', etiqueta: 'ahorrados en comisiones', v: 'Fechas bloqueadas' },
        { e: 0, s: 'wa', t: 'Llegó el huésped de la cabaña 2: abrió a las 3:12 p. m.', v: 'Cabaña 2 ocupada' },
        { e: 3, s: 'wa', t: 'Aviso: el tanque de agua bajó al 20 %.', v: '20 %', alerta: true },
        { e: 2, s: 'clientes', t: 'Booking y Airbnb ya no muestran las fechas de la reserva directa.', v: 'Calendario al día' },
      ],
    },
    bodega: {
      equipos: [
        { ico: 'i-broadcast', nombre: 'Sensor del motor 3', valor: 'Vibración normal' },
        { ico: 'i-thermometer-simple', nombre: 'Nivel del tanque 1', valor: '62 %' },
        { ico: 'i-map-pin', nombre: 'GPS de la flota', valor: '4 camiones en ruta' },
        { ico: 'i-shield-check', nombre: 'Control de acceso', valor: '12 entradas' },
      ],
      inicio: { wa: 'Ayer: 4 entregas y ninguna parada imprevista.', cifra: '0', etiqueta: 'paradas imprevistas este mes', clientes: 'Pedido 2219 entregado en Santiago, con firma.' },
      eventos: [
        { e: 2, s: 'clientes', t: 'El camión 2 llegó a David y entregó el pedido 2220.', v: '3 camiones en ruta' },
        { e: 0, s: 'wa', t: 'Aviso: el motor 3 vibra fuera de lo normal. Conviene revisarlo hoy.', v: 'Vibración alta', alerta: true },
        { e: 3, s: 'panel', cifra: '13', etiqueta: 'entradas antes de las 8 a. m.', v: '13 entradas' },
        { e: 1, s: 'panel', cifra: '58 %', etiqueta: 'nivel del tanque 1', v: '58 %' },
        { e: 0, s: 'wa', t: 'El motor 3 volvió a vibración normal tras el ajuste.', v: 'Vibración normal' },
      ],
    },
  };

  /* ── el teléfono: cinco pasos y sus mensajes por tipo de negocio ── */
  const TELEFONO = {
    restaurante: {
      negocio: 'Fonda Pixbae (ejemplo)',
      bajada: 'Un pedido de punta a punta en una fonda de ejemplo, y el aviso que llega antes de que se dañe la mercancía.',
      pasos: [
        ['El cliente escanea el QR de la mesa', ' y pide desde su teléfono, sin esperar al mesero.'],
        ['La comanda sale en la pantalla de la cocina', ', sin papelitos.'],
        ['Paga con Yappy o tarjeta', ' desde la misma mesa, y puede dividir la cuenta.'],
        ['Si algo se sale de lo normal, te avisa', ': la nevera, la luz, el tanque.'],
        ['Al cerrar, el resumen del día', ' te llega al teléfono.'],
      ],
      chat: [
        ['12:41', 'Mesa 4 pidió: 2 patacones con ceviche y 1 chicha de piña. B/. 9.50'],
        ['12:53', 'Cocina: la orden de la mesa 4 está lista.'],
        ['13:20', 'Mesa 4 pagó B/. 10.17 con Yappy (ITBMS incluido) y dejó B/. 1.00 de propina.'],
        ['15:02', '<strong>Aviso:</strong> la nevera 2 subió a 8.9 °C. La puerta lleva 6 minutos abierta.', 'aviso'],
        ['22:00', '<strong>Resumen de hoy</strong><span>63 personas entraron</span><span>41 pedidos por QR</span><span>B/. 612.40 en ventas</span><span>1 aviso de la nevera, resuelto</span>', 'resumen'],
      ],
    },
    tienda: {
      negocio: 'Minisúper de ejemplo',
      bajada: 'Un día en un minisúper de ejemplo: quién entra, qué se vende, qué se acaba y si la caja cuadra.',
      pasos: [
        ['La cámara cuenta quién entra', ' y te dice a qué hora llega más gente.'],
        ['Cobras con Yappy o tarjeta', ' y la factura electrónica sale sola.'],
        ['El inventario se descuenta con cada venta', ' y te dice qué pedir.'],
        ['Si la caja no cuadra, te avisa', ' al cerrar, no a fin de mes.'],
        ['Al cerrar, el resumen del día', ' te llega al teléfono.'],
      ],
      chat: [
        ['11:00', 'Entraron 96 personas en la mañana. La hora pico de ayer fue de 5 a 7 p. m.'],
        ['13:14', 'Venta 0458: B/. 23.75 con tarjeta. Factura electrónica enviada.'],
        ['16:30', 'Arroz de 5 lb: quedan 6. Al ritmo de hoy se acaba el jueves.'],
        ['21:05', '<strong>Aviso:</strong> la caja 1 cerró con B/. 12.00 menos de lo vendido.', 'aviso'],
        ['21:30', '<strong>Resumen de hoy</strong><span>214 personas entraron</span><span>96 ventas</span><span>B/. 1,840.50 vendidos</span><span>3 productos por pedir</span>', 'resumen'],
      ],
    },
    clinica: {
      negocio: 'Clínica de ejemplo',
      bajada: 'Cómo llega una cita en una clínica de ejemplo, y lo que pasa para que el paciente no falte.',
      pasos: [
        ['El paciente agenda en línea', ' a cualquier hora; el asistente con IA le ofrece los espacios libres.'],
        ['Le recordamos la cita', ' 2 días y 1 día antes.'],
        ['Confirma con un toque, o libera la hora', ' para alguien de la lista de espera.'],
        ['Si alguien no confirma, te avisa', ' a tiempo para llamarlo.'],
        ['Al cerrar, el resumen del día', ' te llega al teléfono.'],
      ],
      chat: [
        ['22:47', 'Nueva cita agendada por el asistente: martes 10:30 a. m., consulta de control.'],
        ['08:00', 'Recordatorio enviado a los 18 pacientes de mañana.'],
        ['10:15', '16 confirmaron. 1 canceló y su hora ya se ofreció a la lista de espera.'],
        ['17:00', '<strong>Aviso:</strong> 2 pacientes de mañana no han confirmado su cita.', 'aviso'],
        ['18:30', '<strong>Resumen de hoy</strong><span>18 citas</span><span>17 atendidas</span><span>1 reprogramada</span><span>Inasistencias del mes: 4 %</span>', 'resumen'],
      ],
    },
    hotel: {
      negocio: 'Cabañas de ejemplo',
      bajada: 'Una reserva directa en unas cabañas de ejemplo, de punta a punta y sin pagarle comisión a nadie.',
      pasos: [
        ['El huésped reserva en tu página', ' y paga con Yappy o tarjeta, sin comisión.'],
        ['El calendario se cruza con Booking y Airbnb', ' para que no haya dos reservas el mismo día.'],
        ['Le llega el código de la cerradura', ', válido solo para sus fechas.'],
        ['Si algo falla, te avisa', ': el agua, la luz, una puerta abierta.'],
        ['Cada lunes, el resumen de la semana', ' te llega al teléfono.'],
      ],
      chat: [
        ['09:12', 'Reserva directa: cabaña 2, del 21 al 23. B/. 240 pagados con Yappy.'],
        ['09:13', 'Calendario al día: las fechas quedaron bloqueadas en Booking y Airbnb.'],
        ['15:12', 'Código de la cabaña 2 enviado al huésped. El huésped abrió a las 3:12 p. m.'],
        ['19:40', '<strong>Aviso:</strong> el tanque de agua bajó al 20 %.', 'aviso'],
        ['Lun', '<strong>Resumen de la semana</strong><span>3 reservas directas</span><span>B/. 72 ahorrados en comisiones</span><span>Fin de semana al 90 %</span>', 'resumen'],
      ],
    },
    bodega: {
      negocio: 'Bodega de ejemplo',
      bajada: 'Un día en una bodega de ejemplo: motores, tanques, camiones y puertas, medidos todo el día.',
      pasos: [
        ['Los sensores miden motores y tanques', ' todo el día, sin que nadie vaya a mirar.'],
        ['El GPS sigue cada camión', ' y avisa cuando entrega.'],
        ['Cada entrada queda registrada', ' con hora y persona.'],
        ['Si algo se sale de lo normal, te avisa', ' antes de que se dañe.'],
        ['Al cerrar, el resumen del día', ' te llega al teléfono.'],
      ],
      chat: [
        ['07:00', 'Tanque 1 al 62 %. Motor 3: vibración normal.'],
        ['07:10', 'El camión 2 salió rumbo a David con el pedido 2220.'],
        ['07:58', '13 personas entraron antes de las 8 a. m.'],
        ['14:25', '<strong>Aviso:</strong> el motor 3 vibra fuera de lo normal. Conviene revisarlo hoy.', 'aviso'],
        ['18:00', '<strong>Resumen de hoy</strong><span>4 entregas hechas</span><span>0 paradas imprevistas</span><span>Tanque 1 al 58 %</span>', 'resumen'],
      ],
    },
  };

  /* ═══ el tablero ═══ */
  const tablero = document.querySelector('[data-tablero]');
  const equiposUl = tablero?.querySelector('[data-equipos]');
  const cables = tablero?.querySelector('[data-cables]');
  const nucleo = tablero?.querySelector('[data-nucleo]');
  const salidas = Object.fromEntries([...(tablero?.querySelectorAll('[data-salida]') || [])].map((li) => [li.dataset.salida, li]));
  const contador = tablero?.querySelector('[data-eventos]');
  const anuncio = document.querySelector('[data-anuncio]');
  const NS = 'http://www.w3.org/2000/svg';

  let rubro = 'restaurante';
  let paso = 0;
  let reloj = null;
  let eventos = 1284;
  let rutas = { equipos: [], salidas: {} };
  const linea = [];

  const icono = (id) => `<svg class="ico" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;

  function pintarEquipos() {
    const r = RUBROS[rubro];
    equiposUl.innerHTML = r.equipos
      .map(
        (q, i) => `<li><button type="button" class="nodo" data-i="${i}"><span class="nodo__ico">${icono(q.ico)}</span><span class="nodo__texto"><span class="nodo__nombre">${q.nombre}</span><span class="nodo__valor" data-valor>${q.valor}</span></span><span class="nodo__led" aria-hidden="true"></span></button></li>`,
      )
      .join('');
    equiposUl.querySelectorAll('.nodo').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.i);
        const lista = RUBROS[rubro].eventos;
        const k = lista.findIndex((ev, n) => ev.e === i && n >= paso % lista.length);
        const j = k >= 0 ? k : lista.findIndex((ev) => ev.e === i);
        if (j >= 0) {
          paso = j;
          siguiente(true);
          reiniciar();
        }
      }),
    );
    const s = r.inicio;
    salidas.wa.querySelector('[data-texto]').textContent = s.wa;
    salidas.wa.classList.remove('salida--alerta');
    salidas.panel.querySelector('[data-cifra]').textContent = s.cifra;
    salidas.panel.querySelector('[data-etiqueta]').textContent = s.etiqueta;
    salidas.clientes.querySelector('[data-texto]').textContent = s.clientes;
    linea.length = 0;
    let y = 18;
    for (let i = 0; i < 12; i++) {
      y = Math.max(4, Math.min(26, y + (Math.sin(i * 1.7 + rubro.length) * 6)));
      linea.push(y);
    }
    pintarLinea();
    paso = 0;
    requestAnimationFrame(trazarCables);
  }
  function pintarLinea() {
    const pl = salidas.panel.querySelector('[data-linea]');
    pl.setAttribute('points', linea.map((y, i) => `${(i * 120) / (linea.length - 1)},${y.toFixed(1)}`).join(' '));
  }

  // los cables: de cada equipo al núcleo y del núcleo a cada salida
  function trazarCables() {
    if (!cables) return;
    const caja = tablero.getBoundingClientRect();
    cables.setAttribute('viewBox', `0 0 ${caja.width} ${caja.height}`);
    cables.innerHTML = '';
    rutas = { equipos: [], salidas: {} };
    if (getComputedStyle(cables).display === 'none') return;
    const n = nucleo.getBoundingClientRect();
    const nIzq = { x: n.left - caja.left, y: n.top + n.height / 2 - caja.top };
    const nDer = { x: n.right - caja.left, y: n.top + n.height / 2 - caja.top };
    const curva = (a, b) => {
      const dx = (b.x - a.x) * 0.5;
      return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
    };
    const trazo = (d) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', 'cable');
      cables.appendChild(p);
      return p;
    };
    equiposUl.querySelectorAll('.nodo').forEach((b) => {
      const r = b.getBoundingClientRect();
      rutas.equipos.push(trazo(curva({ x: r.right - caja.left, y: r.top + r.height / 2 - caja.top }, nIzq)));
    });
    for (const [k, li] of Object.entries(salidas)) {
      const r = li.getBoundingClientRect();
      rutas.salidas[k] = trazo(curva(nDer, { x: r.left - caja.left, y: r.top + r.height / 2 - caja.top }));
    }
  }

  // un paquete de datos que viaja por un cable
  const viajar = (ruta, ms) =>
    new Promise((listo) => {
      if (!ruta || quieto) return listo();
      ruta.classList.add('cable--activo');
      const punto = document.createElementNS(NS, 'circle');
      punto.setAttribute('r', '5');
      punto.setAttribute('class', 'paquete');
      cables.appendChild(punto);
      const largo = ruta.getTotalLength();
      const t0 = performance.now();
      const cuadro = (t) => {
        const f = Math.min(1, (t - t0) / ms);
        const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        const p = ruta.getPointAtLength(e * largo);
        punto.setAttribute('cx', p.x);
        punto.setAttribute('cy', p.y);
        if (f < 1) requestAnimationFrame(cuadro);
        else {
          punto.remove();
          setTimeout(() => ruta.classList.remove('cable--activo'), 250);
          listo();
        }
      };
      requestAnimationFrame(cuadro);
    });

  async function siguiente(anunciar = false) {
    const r = RUBROS[rubro];
    const ev = r.eventos[paso++ % r.eventos.length];
    const rubroAhora = rubro;
    const nodo = equiposUl.querySelector(`.nodo[data-i="${ev.e}"]`);
    nodo?.classList.add('nodo--activo');
    await viajar(rutas.equipos[ev.e], 650);
    if (rubro !== rubroAhora) return;
    nucleo.classList.add('nucleo--latido');
    setTimeout(() => nucleo.classList.remove('nucleo--latido'), 500);
    eventos += 1 + Math.floor(Math.random() * 3);
    contador.textContent = eventos.toLocaleString('en-US');
    await viajar(rutas.salidas[ev.s], 650);
    if (rubro !== rubroAhora) return;
    const li = salidas[ev.s];
    if (ev.s === 'panel') {
      li.querySelector('[data-cifra]').textContent = ev.cifra;
      li.querySelector('[data-etiqueta]').textContent = ev.etiqueta;
      linea.shift();
      linea.push(4 + Math.random() * 20);
      pintarLinea();
    } else {
      li.querySelector('[data-texto]').textContent = ev.t;
      if (ev.s === 'wa') {
        li.classList.toggle('salida--alerta', !!ev.alerta);
        const ahora = new Date();
        li.querySelector('[data-hora]').textContent = ahora.toLocaleTimeString('es-PA', { hour: 'numeric', minute: '2-digit' });
      }
    }
    if (ev.v && nodo) nodo.querySelector('[data-valor]').textContent = ev.v;
    li.classList.remove('salida--nueva');
    void li.offsetWidth;
    li.classList.add('salida--nueva');
    setTimeout(() => nodo?.classList.remove('nodo--activo'), 600);
    if (anunciar && anuncio) anuncio.textContent = ev.t || `${ev.cifra} ${ev.etiqueta}`;
  }

  function reiniciar() {
    clearInterval(reloj);
    reloj = null;
    if (!quieto && visible) reloj = setInterval(() => siguiente(), 2800);
  }

  let visible = true;
  if (tablero) {
    pintarEquipos();
    new ResizeObserver(() => trazarCables()).observe(tablero);
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      reiniciar();
    }).observe(tablero);
    document.fonts?.ready.then(trazarCables);
  }

  /* ═══ el teléfono ═══ */
  const telefono = document.querySelector('[data-telefono]');
  function pintarTelefono() {
    if (!telefono) return;
    const d = TELEFONO[rubro];
    telefono.querySelector('[data-tel-bajada]').textContent = d.bajada;
    telefono.querySelector('[data-tel-negocio]').textContent = d.negocio;
    telefono.querySelector('[data-pasos]').innerHTML = d.pasos.map(([f, r], i) => `<li data-paso="${i}" tabindex="0"><strong>${f}</strong>${r}</li>`).join('');
    telefono.querySelector('[data-chat]').innerHTML = d.chat
      .map(([h, t, tipo], i) => `<li class="msj${tipo ? ` msj--${tipo}` : ''}" data-paso="${i}"><span class="msj__hora">${h}</span>${t}</li>`)
      .join('');
    enlazarPasos();
    // al cambiar de negocio, los mensajes entran de nuevo uno detrás de otro
    if (!quieto) {
      telefono.classList.remove('telefono--entrar');
      void telefono.offsetWidth;
      telefono.classList.add('telefono--entrar');
    }
  }
  function enlazarPasos() {
    const pasos = telefono.querySelectorAll('.recorrido [data-paso]');
    const mensajes = telefono.querySelectorAll('.msj[data-paso]');
    const marcar = (n) => {
      pasos.forEach((p) => p.classList.toggle('activo', p.dataset.paso === n));
      mensajes.forEach((m) => m.classList.toggle('activo', m.dataset.paso === n));
    };
    [...pasos, ...mensajes].forEach((el) => {
      el.addEventListener('pointerenter', () => marcar(el.dataset.paso));
      el.addEventListener('focus', () => marcar(el.dataset.paso));
    });
    telefono.addEventListener('pointerleave', () => marcar(null));
  }
  if (telefono) {
    enlazarPasos();

  }

  /* ═══ elegir el tipo de negocio: cambia el tablero y el teléfono a la vez ═══ */
  function ponerRubro(r) {
    if (!RUBROS[r] || r === rubro) return;
    rubro = r;
    document.querySelectorAll('[data-rubros] [data-rubro]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.rubro === r)));
    if (tablero) {
      pintarEquipos();
      reiniciar();
    }
    pintarTelefono();
  }
  document.querySelectorAll('[data-rubros]').forEach((lista) => {
    const botones = [...lista.querySelectorAll('[data-rubro]')];
    botones.forEach((b, i) => {
      b.addEventListener('click', () => ponerRubro(b.dataset.rubro));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const j = (i + (e.key === 'ArrowRight' ? 1 : botones.length - 1)) % botones.length;
        botones[j].focus();
        ponerRubro(botones[j].dataset.rubro);
      });
    });
  });
  window.addEventListener('tipo-cambiado', () => document.fonts?.ready.then(trazarCables));
})();
