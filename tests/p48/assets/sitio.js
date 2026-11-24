// alphateklab, propuesta 48 «Se arma a tu medida»: menú, formulario, copiar el correo, buscador,
// la ventana del héroe que se arma sola, la franja de negocios y el contador en vivo.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICO = 'assets/iconos.svg#';
  const ico = (n, c = 'ico') => `<svg class="${c}" aria-hidden="true" focusable="false"><use href="${ICO}${n}"/></svg>`;
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';

  /* ── cabecera: línea al bajar y menú del celular ── */
  const cab = document.querySelector('.cab');
  const abrir = document.querySelector('[data-abrir-menu]');
  const linea = () => cab?.classList.toggle('con-linea', scrollY > 8);
  addEventListener('scroll', linea, { passive: true });
  linea();
  const cerrarMenu = () => {
    cab?.classList.remove('abierta');
    abrir?.setAttribute('aria-expanded', 'false');
  };
  abrir?.addEventListener('click', () => {
    const abierta = cab.classList.toggle('abierta');
    abrir.setAttribute('aria-expanded', String(abierta));
  });
  document.querySelectorAll('.movil a').forEach((a) => a.addEventListener('click', cerrarMenu));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cab?.classList.contains('abierta')) {
      cerrarMenu();
      abrir?.focus();
    }
  });

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, igual que el del sitio publicado.
     Sin JavaScript el formulario se manda solo y FormSubmit vuelve a la página (_next). ── */
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
  form?.addEventListener('invalid', () => avisar(queFalta(), true), true);
  form?.addEventListener('input', () => {
    if (nota.dataset.estado === 'error' && !queFalta()) avisar('');
  });
  let enviando = false;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enviando) return;
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
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      else seleccionar();
    }),
  );

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
        const sp = document.createElement('span');
        sp.textContent = s.a.dataset.servicio;
        const sm = document.createElement('small');
        sm.textContent = s.tipo;
        sp.append(sm);
        a.append(sp, s.a.querySelector('.ico')?.cloneNode(true) || '');
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

  /* ── un botón de pausa (texto e icono) ── */
  const ponerBoton = (b, pausado, texto2 = 'Reproducir') => {
    if (!b) return;
    b.querySelector('span').textContent = pausado ? texto2 : 'Pausar';
    b.querySelector('use').setAttribute('href', ICO + (pausado ? 'i-play' : 'i-pause'));
  };

  /* ══════════════════════════════════════════════════════════════════════
     La ventana que se arma sola: esqueleto → módulos → tarjetas → gráfica → datos → un momento en vivo
     → se deshace y se arma para el negocio siguiente. Todo corre con un reloj propio que se detiene con
     «Pausar», fuera de pantalla o con la pestaña oculta; las animaciones en curso se congelan con él.
     ══════════════════════════════════════════════════════════════════════ */
  const NEGOCIOS = [
    {
      art: 'una tienda', titulo: 'Sistema de Minisúper La Esquina (ejemplo)',
      inicial: 'E', nombre: 'La Esquina', sub: 'Minisúper', aviso: 0,
      modulos: [['i-cash-register', 'Ventas y caja'], ['i-package', 'Inventario'], ['i-receipt', 'Facturas'], ['i-shopping-bag', 'Tienda en línea'], ['i-users', 'Clientes'], ['i-security-camera', 'Cámaras']],
      cab: ['Hoy en La Esquina', 'Martes, 4:12 p. m.'],
      kpis: [
        { t: 'Ventas de hoy', tipo: 'bal', v: 1840.5, vivo: 1864.25, delta: '+23.75' },
        { t: 'Ventas', tipo: 'int', v: 96, vivo: 97, delta: '+1' },
        { t: 'Entraron hoy', tipo: 'int', v: 214 },
      ],
      graf: { tipo: 'linea', t: 'Ventas por hora', sub: 'Hoy', ejes: ['8 a. m.', '12 m.', '4 p. m.'], datos: [40, 72, 96, 150, 128, 176, 214, 190, 246] },
      feed: [
        ['Venta 0457', 'B/. 18.20, factura electrónica enviada', '3 min'],
        ['Pedido en línea 88', 'Para recoger a las 5:00 p. m.', '9 min'],
        ['Arroz de 5 lb', 'Quedan 6: al ritmo de hoy, se acaba el jueves', '14 min'],
        ['Caja 1', 'Abrió con B/. 100.00', '8 h'],
      ],
      nueva: ['Venta 0458', 'B/. 23.75 con tarjeta, factura enviada', 'Nueva'],
      equipos: [['i-cash-register', 'Caja 1'], ['i-security-camera', 'Cámara de la puerta'], ['i-tag', 'Etiquetas de precio']],
    },
    {
      art: 'un hotel', titulo: 'Sistema de Cabañas La Loma (ejemplo)',
      inicial: 'L', nombre: 'Cabañas La Loma', sub: 'Hotel y cabañas', aviso: 0,
      modulos: [['i-calendar-check', 'Reservas'], ['i-arrows-clockwise', 'Booking y Airbnb'], ['i-lock-key', 'Cerraduras'], ['i-identification-card', 'Registro en línea'], ['i-credit-card', 'Cobros en línea'], ['i-wifi-high', 'Wifi de huéspedes']],
      cab: ['Hoy en La Loma', 'Viernes, 11:20 a. m.'],
      kpis: [
        { t: 'Ocupación hoy', tipo: 'de', v: 6, vivo: 7, de: 8, delta: '+1' },
        { t: 'Reservas directas', tipo: 'int', v: 3, vivo: 4, delta: '+1' },
        { t: 'Depósitos hoy', tipo: 'bal', v: 380, vivo: 470, delta: '+90.00' },
      ],
      graf: { tipo: 'barras', t: 'Ocupación de la semana', sub: '%', ejes: ['L', 'M', 'M', 'J', 'V', 'S', 'D'], datos: [50, 38, 63, 75, 88, 100, 75], hoy: 4 },
      feed: [
        ['Cabaña 3', 'Código de la puerta enviado al huésped', '8 min'],
        ['Booking', 'Calendario sincronizado, sin choques', '15 min'],
        ['Cabaña 1', 'Registro en línea completo', '40 min'],
        ['Cabaña 4', 'Salida a las 11:00 a. m., limpieza lista', '1 h'],
      ],
      nueva: ['Reserva directa', 'Cabaña 2, 3 noches, depósito B/. 90.00', 'Nueva'],
      equipos: [['i-lock-key', 'Cerraduras de 4 cabañas'], ['i-arrows-clockwise', 'Booking y Airbnb'], ['i-wifi-high', 'Wifi']],
    },
    {
      art: 'una escuela', titulo: 'Sistema de Academia Horizonte (ejemplo)',
      inicial: 'H', nombre: 'Horizonte', sub: 'Academia', aviso: 1,
      modulos: [['i-student', 'Matrícula'], ['i-currency-circle-dollar', 'Mensualidades'], ['i-qr-code', 'Asistencia con QR'], ['i-chat-circle-text', 'Avisos a padres'], ['i-globe', 'Página web'], ['i-chart-bar', 'Reportes']],
      cab: ['Hoy en la academia', 'Lunes, 8:05 a. m.'],
      kpis: [
        { t: 'Asistencia hoy', tipo: 'de', v: 412, vivo: 413, de: 430, delta: '+1' },
        { t: 'Familias al día', tipo: 'pct', v: 86, vivo: 87, delta: '+1' },
        { t: 'Pagos de hoy', tipo: 'bal', v: 1150, vivo: 1235, delta: '+85.00' },
      ],
      graf: { tipo: 'linea', t: 'Asistencia', sub: 'Últimos 10 días', ejes: ['Hace 2 semanas', 'Hoy'], datos: [91, 93, 92, 95, 94, 96, 95, 97, 96, 96.5], piso: 86 },
      feed: [
        ['4.° B', 'Asistencia pasada con QR', '5 min'],
        ['Circular', 'Reunión del viernes, enviada a 430 familias', '25 min'],
        ['Recordatorio', 'Mensualidad de diciembre, a 38 familias', '1 h'],
        ['Matrícula 2027', '12 solicitudes nuevas en línea', '2 h'],
      ],
      nueva: ['Pago de mensualidad', 'Familia Rodríguez, B/. 85.00 con Yappy', 'Pagado'],
      equipos: [['i-qr-code', 'Lector de la entrada'], ['i-credit-card', 'Yappy y tarjeta'], ['i-chat-circle-text', 'Avisos por WhatsApp']],
    },
    {
      art: 'un taller', titulo: 'Sistema de Autotaller El Puente (ejemplo)',
      inicial: 'P', nombre: 'El Puente', sub: 'Autotaller', aviso: 3,
      modulos: [['i-clock', 'Turnos'], ['i-clipboard-text', 'Órdenes'], ['i-file-text', 'Presupuestos'], ['i-bell-ringing', 'Aviso de listo'], ['i-wrench', 'Repuestos'], ['i-credit-card', 'Cobros']],
      cab: ['Hoy en el taller', 'Miércoles, 2:40 p. m.'],
      kpis: [
        { t: 'Autos en el taller', tipo: 'int', v: 9 },
        { t: 'Por entregar', tipo: 'int', v: 3, vivo: 4, delta: '+1' },
        { t: 'Aprobados hoy', tipo: 'int', v: 5 },
      ],
      graf: { tipo: 'barras', t: 'Órdenes por día', sub: 'Esta semana', ejes: ['L', 'M', 'M', 'J', 'V', 'S'], datos: [6, 8, 7, 9, 11, 5], hoy: 2 },
      feed: [
        ['Turno 14', 'Pick-up gris, cambio de aceite', '10 min'],
        ['Orden 231', 'Presupuesto aprobado por WhatsApp', '22 min'],
        ['Turno 12', 'Frenos delanteros, con fotos del auto', '45 min'],
        ['Orden 228', 'Entregado y cobrado con tarjeta', '1 h'],
      ],
      nueva: ['Turno 13', 'Listo: le avisamos al cliente por WhatsApp', 'Listo'],
      equipos: [['i-car', 'Cámara del portón'], ['i-monitor', 'Pantalla de turnos'], ['i-chat-circle-text', 'Avisos por WhatsApp']],
    },
    {
      art: 'un restaurante', titulo: 'Sistema de Fonda Pixbae (ejemplo)',
      inicial: 'P', nombre: 'Fonda Pixbae', sub: 'Restaurante', aviso: 0,
      modulos: [['i-qr-code', 'Pedidos'], ['i-squares-four', 'Mapa de mesas'], ['i-monitor', 'Pantalla de cocina'], ['i-calendar-check', 'Reservas'], ['i-receipt', 'Caja y facturas'], ['i-chart-line-up', 'Reportes']],
      cab: ['Hoy en Pixbae', 'Martes, 12:41 p. m.'],
      kpis: [
        { t: 'Ventas de hoy', tipo: 'bal', v: 601.9, vivo: 612.4, delta: '+10.50' },
        { t: 'Pedidos por QR', tipo: 'int', v: 40, vivo: 41, delta: '+1' },
        { t: 'Mesas ocupadas', tipo: 'de', v: 7, vivo: 8, de: 12, delta: '+1' },
      ],
      graf: { tipo: 'linea', t: 'Pedidos por hora', sub: 'Hoy', ejes: ['11 a. m.', '12 m.', '1 p. m.'], datos: [4, 6, 9, 14, 12, 18, 22, 19, 24] },
      feed: [
        ['Mesa 9', '1 sancocho, 2 arroces con pollo', '6 min'],
        ['Mesa 2', '3 carimañolas, 1 limonada', '12 min'],
        ['Reserva', '4 personas a las 7:30 p. m.', '18 min'],
        ['Mesa 11', 'Pagó con tarjeta, factura enviada', '20 min'],
      ],
      nueva: ['Mesa 4', '2 patacones, 1 chicha de piña', 'Nuevo'],
      equipos: [['i-qr-code', 'QR en 12 mesas'], ['i-monitor', 'Pantalla de cocina'], ['i-security-camera', 'Cámara de la puerta']],
    },
  ];

  const numero = (v, tipo) => {
    if (tipo === 'bal') return `B/. ${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return Math.round(v).toLocaleString('en-US');
  };
  const cola = (k) => (k.tipo === 'de' ? ` <em>de ${k.de}</em>` : k.tipo === 'pct' ? ' <em>%</em>' : '');
  const MAS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';
  const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

  const armado = document.querySelector('[data-armado]');
  if (armado) {
    const win = armado.querySelector('.win');
    const cuerpo = win.querySelector('.win__cuerpo');
    const tituloWin = win.querySelector('.win__titulo');
    const chip = armado.querySelector('.chip');
    const chipTexto = chip.querySelector('.chip__texto');
    const chipBarra = chip.querySelector('.chip__barra');
    const chipListo = chip.querySelector('.chip__listo');
    chipListo.innerHTML = CHECK;
    const botonPausa = armado.querySelector('[data-pausa]');

    let idx = 0;
    let n = NEGOCIOS[0];

    const fila = (f, r, nueva = false) =>
      `<div class="w-ev pz${nueva ? ' nuevo' : ''}" style="--i:${r}"><b>${f[0]}</b>${nueva ? `<em class="w-tag">${f[2]}</em>` : `<time>${f[2]}</time>`}<span>${f[1]}</span></div>`;
    const sk = (w, extra = '') => `<i class="sk" style="width:${w}%${extra}"></i>`;

    const plantilla = (neg) => {
      const anchos = [70, 55, 78, 62, 50, 66];
      const lado =
        `<div class="w-lado">` +
        `<div class="w-negocio ra"><div class="sk-capa" style="--i:0"><i class="sk sk--avatar"></i><span style="flex:1;display:grid;gap:7px">${sk(80)}${sk(48)}</span></div>` +
        `<div class="pz" style="--i:0;--d:12"><span class="w-avatar">${neg.inicial}</span><span class="txt"><b>${neg.nombre}</b><small>${neg.sub}</small></span></div></div>` +
        neg.modulos
          .map(([ic, t], k) =>
            `<div class="w-mod ra${k === 0 ? ' activo' : ''}"><div class="sk-capa" style="--i:${k + 1}"><i class="sk sk--cuadro"></i>${sk(anchos[k])}</div>` +
            `<div class="pz" style="--i:${k + 1};--d:${11 - k}">${ico(ic)}<span>${t}</span>${k === neg.aviso ? '<em class="w-insignia">1</em>' : ''}</div></div>`)
          .join('') +
        `<div class="w-otro ra"><div class="pz" style="--i:7;--d:5">${MAS}<span>Lo que necesites</span></div></div>` +
        `</div>`;
      const kpis = neg.kpis
        .map((k, j) =>
          `<div class="w-hueco"><div class="w-ranura">${sk(52)}${sk(72, ';height:12px;margin-top:auto')}</div>` +
          `<div class="w-tarjeta w-cifra pz" style="--i:${j};--d:${5 + j}"><span class="w-cifra__cab"><small>${k.t}</small>${k.delta ? `<em class="w-delta">${k.delta}</em>` : ''}</span><span class="w-valor"><i class="sk"></i><span class="w-num"><span>${numero(0, k.tipo)}</span>${cola(k)}</span></span></div></div>`)
        .join('');
      const g = neg.graf;
      const graf =
        g.tipo === 'barras'
          ? `<div class="w-graf"><div class="g-barras">${g.datos.map((v, b) => `<i class="g-barra${b === g.hoy ? ' hoy' : ''}" style="height:${((v / Math.max(...g.datos)) * 100).toFixed(1)}%;--b:${b}"></i>`).join('')}</div></div><div class="g-ejes g-ejes--barras">${g.ejes.map((e) => `<span>${e}</span>`).join('')}</div>`
          : `<div class="w-graf" data-linea></div><div class="g-ejes">${g.ejes.map((e) => `<span>${e}</span>`).join('')}</div>`;
      const main =
        `<div class="w-main">` +
        `<div class="w-cab"><div class="ra"><div class="sk-capa">${sk(36, ';height:12px')}${sk(22)}</div><div class="pz" style="--i:0;--d:8"><h4>${neg.cab[0]}</h4><p>${neg.cab[1]}</p></div></div>` +
        `<span class="w-buscar">${ico('i-magnifying-glass')}Buscar</span></div>` +
        `<div class="w-cifras">${kpis}</div>` +
        `<div class="w-fila">` +
        `<div class="w-hueco"><div class="w-ranura">${sk(40)}<i class="sk" style="flex:1;width:100%;height:auto;opacity:.55"></i></div>` +
        `<div class="w-tarjeta pz" style="--i:3;--d:3"><div class="w-tit"><b>${g.t}</b><span>${g.sub}</span></div>${graf}</div></div>` +
        `<div class="w-hueco"><div class="w-ranura">${sk(34)}${sk(88)}${sk(74)}${sk(84)}${sk(66)}</div>` +
        `<div class="w-tarjeta pz" style="--i:4;--d:0"><div class="w-tit"><b>Lo último</b><span>Hoy</span></div><div class="w-lista">${neg.feed.map((f, r) => fila(f, r)).join('')}</div></div></div>` +
        `</div>` +
        `<div class="w-equipos"><small class="pz" style="--i:3;--d:2">Conectado</small>${neg.equipos.map(([ic, t], e) => `<span class="w-eq pz" style="--i:${e + 4};--d:1">${ico(ic)}${t}</span>`).join('')}</div>` +
        `</div>`;
      return lado + main;
    };

    // la línea se dibuja con el tamaño real de su caja, para que el trazo no se deforme
    const dibujarLinea = () => {
      const caja = cuerpo.querySelector('[data-linea]');
      if (!caja) return;
      const g = n.graf;
      const w = Math.max(40, caja.clientWidth);
      const h = Math.max(30, caja.clientHeight);
      const min = g.piso ?? Math.min(...g.datos) * 0.6;
      const max = Math.max(...g.datos);
      const pad = 8;
      const p = g.datos.map((v, i) => [(i / (g.datos.length - 1)) * w, h - pad - ((v - min) / (max - min)) * (h - pad * 2)]);
      let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
      for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[i - 1] || p[i];
        const p1 = p[i];
        const p2 = p[i + 1];
        const p3 = p[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      const area = `${d} L${w} ${h} L0 ${h} Z`;
      const ult = p[p.length - 1];
      const guias = [0.25, 0.5, 0.75].map((f) => `<line class="g-guia" x1="0" x2="${w}" y1="${(h * f).toFixed(1)}" y2="${(h * f).toFixed(1)}"/>`).join('');
      caja.innerHTML =
        `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><linearGradient id="g-relleno" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a7d8c" stop-opacity=".2"/><stop offset="1" stop-color="#3a7d8c" stop-opacity="0"/></linearGradient></defs>` +
        `${guias}<path class="g-area" d="${area}" fill="url(#g-relleno)"/><path class="g-linea" d="${d}" pathLength="1"/></svg>` +
        `<span class="g-punto" style="left:${ult[0]}px;top:${ult[1]}px"></span><span class="g-onda" style="left:${ult[0]}px;top:${ult[1]}px"></span>`;
    };

    /* reloj propio */
    let t = 0;
    let ultimo = null;
    let raf = 0;
    let eventos = [];
    let tweens = [];
    let pausaUsuario = false;
    let fuera = false;
    let oculta = document.hidden;
    let congeladas = [];
    const activo = () => !pausaUsuario && !fuera && !oculta;

    const fase = (c) => win.classList.add(c);
    const anim = (el, kf, op) => el.animate(kf, op);

    const decirChip = (html, listo) => {
      if (quieto) {
        chipTexto.innerHTML = html;
        chip.classList.toggle('listo', listo);
        return;
      }
      const w0 = chip.offsetWidth;
      anim(chipTexto, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(3px)' }], { duration: 140, easing: EASE_OUT, fill: 'forwards' }).finished.then((a) => {
        chipTexto.innerHTML = html;
        chip.classList.toggle('listo', listo);
        chip.style.width = 'auto';
        const w1 = chip.offsetWidth;
        chip.style.width = `${w0}px`;
        void chip.offsetWidth;
        chip.style.width = `${w1}px`;
        a.cancel();
        anim(chipTexto, [{ opacity: 0, filter: 'blur(3px)', transform: 'translateY(3px)' }, { opacity: 1, filter: 'blur(0px)', transform: 'none' }], { duration: 260, easing: EASE_OUT });
      }, () => {});
    };

    const cambiarTitulo = (txt) => {
      if (quieto || !tituloWin.textContent) {
        tituloWin.textContent = txt;
        return;
      }
      anim(tituloWin, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE_OUT, fill: 'forwards' }).finished.then((a) => {
        tituloWin.textContent = txt;
        a.cancel();
        anim(tituloWin, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: EASE_OUT });
      }, () => {});
    };

    const render = () => {
      n = NEGOCIOS[idx];
      win.className = `win${quieto ? ' quieto' : ''}`;
      win.style.setProperty('--brillo-fase', `${-(performance.now() % 1600)}ms`);
      cuerpo.innerHTML = plantilla(n);
      cambiarTitulo(n.titulo);
      dibujarLinea();
      tweens = [];
    };

    const contar = () => {
      cuerpo.querySelectorAll('.w-num').forEach((el, j) => {
        const k = n.kpis[j];
        const span = el.firstElementChild;
        const t0 = t;
        tweens.push((ahora) => {
          const p = Math.min(1, (ahora - t0) / 950);
          const e = 1 - (1 - p) ** 3;
          span.textContent = numero(k.v * e, k.tipo);
          return p < 1;
        });
      });
    };

    const enVivo = (animar = true) => {
      // 1. llega lo nuevo arriba de «Lo último»; lo de abajo baja un lugar
      const lista = cuerpo.querySelector('.w-lista');
      const filas = [...lista.children];
      const antes = filas.map((f) => f.getBoundingClientRect().top);
      lista.insertAdjacentHTML('afterbegin', fila(n.nueva, 0, true));
      const nueva = lista.firstElementChild;
      if (animar) {
        filas.forEach((f, i) => {
          const dy = antes[i] - f.getBoundingClientRect().top;
          if (dy) anim(f, [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 560, easing: EASE_IN_OUT });
        });
        anim(nueva, [{ opacity: 0, transform: 'translateY(-8px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 140, easing: EASE_OUT, fill: 'backwards' });
      }
      // 2. las cifras que cambian ruedan al valor nuevo
      cuerpo.querySelectorAll('.w-cifra').forEach((tarjeta, j) => {
        const k = n.kpis[j];
        if (k.vivo == null) return;
        const num = tarjeta.querySelector('.w-num');
        const poner = () => (num.firstElementChild.textContent = numero(k.vivo, k.tipo));
        const delta = tarjeta.querySelector('.w-delta');
        if (!animar) {
          poner();
          delta?.classList.add('si');
          return;
        }
        const r = j * 90 + 260;
        anim(num, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-70%)', opacity: 0 }], { duration: 200, delay: r, easing: EASE_OUT, fill: 'forwards' }).finished.then((a) => {
          poner();
          a.cancel();
          anim(num, [{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 420, easing: EASE_OUT, fill: 'backwards' });
          delta?.classList.add('si');
        }, () => {});
      });
      // 3. el módulo que recibió algo muestra su aviso
      cuerpo.querySelectorAll('.w-mod')[n.aviso]?.classList.add('con-aviso');
      // 4. la gráfica late en su último punto
      const onda = cuerpo.querySelector('.g-onda');
      if (onda && animar) anim(onda, [{ opacity: 0.8, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(3.2)' }], { duration: 1000, easing: EASE_OUT, iterations: 2, delay: 300 });
    };

    const PASOS = [
      [0, () => {
        render();
        decirChip(`<b>Armando:</b> sistema para ${n.art}`, false);
        chipBarra.getAnimations().forEach((a) => a.cancel());
        anim(chipBarra, [{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: 3500, easing: 'linear', fill: 'forwards' });
      }],
      [380, () => fase('f-mod')],
      [1080, () => fase('f-tar')],
      [1880, () => fase('f-gra')],
      [2680, () => {
        fase('f-dat');
        contar();
      }],
      [3620, () => {
        decirChip(`<b>Listo:</b> sistema para ${n.art}`, true);
        chipBarra.getAnimations().forEach((a) => a.cancel());
        anim(chipBarra, [{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 0 }], { duration: 400, easing: EASE_OUT, fill: 'forwards' });
      }],
      [4200, () => enVivo(true)],
      [7150, () => fase('f-dis')],
      [7800, () => {
        idx = (idx + 1) % NEGOCIOS.length;
        programar();
      }],
    ];
    const programar = () => {
      t = 0;
      eventos = PASOS.map(([at, fn]) => ({ at, fn }));
    };

    const bucle = (ahora) => {
      raf = 0;
      if (!activo()) return;
      if (ultimo != null) t += Math.min(ahora - ultimo, 50);
      ultimo = ahora;
      while (eventos.length && eventos[0].at <= t) eventos.shift().fn();
      tweens = tweens.filter((f) => f(t));
      raf = requestAnimationFrame(bucle);
    };

    const actualizar = () => {
      if (activo()) {
        congeladas.forEach((a) => {
          if (a.playState === 'paused') a.play();
        });
        congeladas = [];
        if (!raf) {
          ultimo = null;
          raf = requestAnimationFrame(bucle);
        }
      } else {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        armado.getAnimations({ subtree: true }).forEach((a) => {
          if (a.playState === 'running') {
            a.pause();
            congeladas.push(a);
          }
        });
      }
    };

    if (quieto) {
      // sin movimiento: el sistema armado y con su dato en vivo; el botón cambia de negocio sin animar
      const completo = () => {
        render();
        win.classList.add('f-mod', 'f-tar', 'f-gra', 'f-dat');
        cuerpo.querySelectorAll('.w-num').forEach((el, j) => (el.firstElementChild.textContent = numero(n.kpis[j].v, n.kpis[j].tipo)));
        enVivo(false);
        chip.classList.add('quieto');
        decirChip(`<b>Listo:</b> sistema para ${n.art}`, true);
      };
      completo();
      if (botonPausa) {
        botonPausa.querySelector('span').textContent = 'Ver otro negocio';
        botonPausa.querySelector('use').setAttribute('href', `${ICO}i-arrow-right`);
        botonPausa.addEventListener('click', () => {
          idx = (idx + 1) % NEGOCIOS.length;
          completo();
        });
      }
    } else {
      programar();
      botonPausa?.addEventListener('click', () => {
        pausaUsuario = !pausaUsuario;
        ponerBoton(botonPausa, pausaUsuario);
        actualizar();
      });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((e) => {
          fuera = !e[0].isIntersecting;
          actualizar();
        }).observe(armado);
      }
      document.addEventListener('visibilitychange', () => {
        oculta = document.hidden;
        actualizar();
      });
      actualizar();
    }

    // si cambia el ancho, la línea se vuelve a trazar en su estado actual
    let espera = 0;
    addEventListener('resize', () => {
      clearTimeout(espera);
      espera = setTimeout(dibujarLinea, 150);
    });
  }

  /* ── la franja de negocios: avanza lenta, se puede pausar y se detiene fuera de pantalla ── */
  document.querySelectorAll('[data-franja]').forEach((franja) => {
    const b = franja.querySelector('.pausa');
    b?.addEventListener('click', () => {
      const p = franja.classList.toggle('quieta');
      ponerBoton(b, p);
    });
    if ('IntersectionObserver' in window) new IntersectionObserver((e) => franja.classList.toggle('fuera', !e[0].isIntersecting)).observe(franja);
  });

  /* ── el contador en vivo del vistazo: entra gente, cambia el aforo y crece la barra de esta hora ── */
  const contador = document.querySelector('[data-contador]');
  if (contador && !quieto) {
    const campo = (k) => contador.querySelector(`[data-c="${k}"]`);
    const entraron = campo('entraron');
    const adentro = campo('adentro');
    const enFila = campo('fila');
    const barra = contador.querySelector('.c-barras i:last-child');
    const b = contador.querySelector('[data-pausa-contador]');
    let total = Number(entraron.textContent);
    let dentro = Number(adentro.textContent);
    let altura = Number(barra.style.getPropertyValue('--h')) || 46;
    const cambiosDentro = [1, 1, -1, 1, 0, -1, 1, -1, 1, 0, -1, -1];
    const filas = [2, 3, 3, 2, 2, 1, 2, 2, 3, 2, 2, 1];
    let paso = 0;
    let timer = 0;
    let pausa = false;
    let lejos = true;
    const rodar = (el, valor) => {
      if (el.textContent === String(valor)) return;
      const viejo = el.firstElementChild;
      const nuevo = document.createElement('span');
      nuevo.textContent = valor;
      nuevo.style.position = 'absolute';
      nuevo.style.inset = '0';
      el.append(nuevo);
      viejo.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-60%)', opacity: 0 }], { duration: 320, easing: EASE_OUT, fill: 'forwards' });
      nuevo.animate([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 420, easing: EASE_OUT }).finished.then(() => {
        viejo.remove();
        nuevo.style.position = '';
        nuevo.style.inset = '';
      }, () => {});
    };
    const latir = () => {
      total += 1;
      dentro = Math.max(8, dentro + cambiosDentro[paso % cambiosDentro.length]);
      rodar(entraron, total);
      setTimeout(() => rodar(adentro, dentro), 140);
      setTimeout(() => rodar(enFila, filas[paso % filas.length]), 280);
      if (altura < 96) {
        altura += 3;
        barra.style.setProperty('--h', altura);
        barra.animate([{ transform: 'scaleY(0.94)' }, { transform: 'scaleY(1)' }], { duration: 600, easing: EASE_OUT });
      }
      paso += 1;
    };
    const seguir = () => {
      clearTimeout(timer);
      if (pausa || lejos || document.hidden) return;
      timer = setTimeout(() => {
        latir();
        seguir();
      }, 2600);
    };
    b?.addEventListener('click', () => {
      pausa = !pausa;
      ponerBoton(b, pausa);
      seguir();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => {
        lejos = !e[0].isIntersecting;
        seguir();
      }).observe(contador);
    } else {
      lejos = false;
      seguir();
    }
    document.addEventListener('visibilitychange', seguir);
  } else if (contador) {
    contador.querySelector('[data-pausa-contador]')?.setAttribute('hidden', '');
  }
})();
