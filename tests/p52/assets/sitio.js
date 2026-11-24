// alphateklab, propuesta 52: menú, formulario, copiar el correo, pestañas, buscador,
// el configurador del héroe, la cinta de negocios y la propuesta que se escribe.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICONOS = 'assets/iconos.svg#i-';

  /* ── cabecera: borde al bajar y menú del celular ── */
  const cabecera = document.querySelector('.cabecera');
  const abrir = document.querySelector('[data-abrir-menu]');
  const sombra = () => cabecera?.classList.toggle('con-sombra', scrollY > 8);
  addEventListener('scroll', sombra, { passive: true });
  sombra();
  const cerrarMenu = () => {
    cabecera?.classList.remove('abierta');
    abrir?.setAttribute('aria-expanded', 'false');
  };
  abrir?.addEventListener('click', () => {
    const abierta = cabecera.classList.toggle('abierta');
    abrir.setAttribute('aria-expanded', String(abierta));
  });
  document.querySelectorAll('.movil a').forEach((a) => a.addEventListener('click', cerrarMenu));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cabecera?.classList.contains('abierta')) {
      cerrarMenu();
      abrir?.focus();
    }
  });

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, igual que en el sitio publicado. Sin JavaScript,
     el formulario se manda solo y FormSubmit vuelve a la página (_next). _honey es la trampa para robots. ── */
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
      if (b.tagName === 'BUTTON') {
        document.getElementById('propuesta')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth' });
        setTimeout(() => texto?.focus({ preventScroll: true }), quieto ? 0 : 500);
      }
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
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      } else {
        seleccionar();
      }
    }),
  );

  /* ── pestañas (demos y negocios): teclado con flechas, Inicio y Fin ── */
  document.querySelectorAll('[role="tablist"]').forEach((lista) => {
    const tabs = [...lista.querySelectorAll('[role="tab"]')];
    const elegir = (tab, enfocar) => {
      tabs.forEach((t) => {
        const si = t === tab;
        t.setAttribute('aria-selected', String(si));
        t.tabIndex = si ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !si;
      });
      if (enfocar) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => elegir(t));
      t.addEventListener('keydown', (e) => {
        const horizontal = lista.getAttribute('aria-orientation') !== 'vertical';
        const sig = horizontal ? 'ArrowRight' : 'ArrowDown';
        const ant = horizontal ? 'ArrowLeft' : 'ArrowUp';
        let n = null;
        if (e.key === sig) n = tabs[(i + 1) % tabs.length];
        if (e.key === ant) n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') n = tabs[0];
        if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) {
          e.preventDefault();
          elegir(n, true);
        }
      });
    });
  });

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
        const nombre = document.createElement('span');
        nombre.textContent = s.a.dataset.servicio;
        const tipo = document.createElement('small');
        tipo.textContent = s.tipo;
        nombre.append(tipo);
        a.append(nombre);
        const ico = s.a.querySelector('.ico');
        if (ico) a.append(ico.cloneNode(true));
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

  /* ── botón Pausar / Reproducir (se usa en el héroe y en la cinta) ── */
  const rotular = (boton, pausado) => {
    boton.querySelector('use')?.setAttribute('href', ICONOS + (pausado ? 'play' : 'pause'));
    boton.querySelector('span').textContent = pausado ? 'Reproducir' : 'Pausar';
    boton.setAttribute('aria-label', pausado ? 'Reproducir la animación' : 'Pausar la animación');
  };
  const vigilar = (el, cambio, margen = '0px') => {
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver((es) => es.forEach((en) => cambio(en.isIntersecting)), { rootMargin: margen }).observe(el);
  };

  /* ── el configurador del héroe: un dueño cuenta su negocio y su solución se arma pieza por pieza ── */
  const cfg = document.querySelector('[data-config]');
  if (cfg) {
    // [icono, pieza, para qué sirve, tipo de servicio]
    const NEGOCIOS = [
      {
        ico: 't-shirt', para: 'para una tienda de ropa',
        msg: 'Tengo una tienda de ropa y quiero vender por internet.',
        piezas: [
          ['storefront', 'Página web con tienda', 'Tu catálogo con carrito, en tu dominio', 'Web y apps'],
          ['package', 'Inventario', 'Tallas y existencias al día', 'Software a medida'],
          ['credit-card', 'Cobros con Yappy', 'Y con tarjeta, desde el teléfono', 'Cobros y facturación'],
          ['receipt', 'Factura electrónica', 'Sale sola con cada venta', 'Cobros y facturación'],
        ],
      },
      {
        ico: 'house-line', para: 'para un hotel de cabañas',
        msg: 'Tengo un hotel de cabañas y quiero más reservas directas.',
        piezas: [
          ['calendar-check', 'Reservas en línea', 'En tu página, con depósito incluido', 'Web y apps'],
          ['cube-focus', 'Recorrido 3D', 'Que vean la cabaña antes de reservar', 'Recorridos 3D'],
          ['security-camera', 'Cámaras', 'Las miras desde tu teléfono', 'Cámaras'],
          ['monitor', 'Pantalla en recepción', 'Llegadas del día y avisos a la vista', 'Pantallas y kioscos'],
        ],
      },
      {
        ico: 'graduation-cap', para: 'para una escuela',
        msg: 'Tengo una escuela y quiero cobrar las mensualidades a tiempo.',
        piezas: [
          ['identification-card', 'Asistencia con QR', 'Y aviso si el estudiante no llegó', 'Software a medida'],
          ['chat-circle-dots', 'Avisos a padres', 'Circulares y recordatorios por WhatsApp', 'Software a medida'],
          ['credit-card', 'Cobro de mensualidades', 'Con Yappy o tarjeta, sin perseguir a nadie', 'Cobros y facturación'],
          ['globe', 'Página web de la escuela', 'Con todo lo que preguntan los padres nuevos', 'Web y apps'],
        ],
      },
      {
        ico: 'wrench', para: 'para un taller mecánico',
        msg: 'Tengo un taller mecánico y quiero organizar las citas.',
        piezas: [
          ['calendar-blank', 'Citas de servicio', 'Agenda en línea con recordatorio', 'Software a medida'],
          ['clipboard-text', 'Órdenes de trabajo', 'Con fotos del carro y aprobación del cliente', 'Software a medida'],
          ['bell-ringing', 'Aviso de carro listo', 'Le llega al cliente por WhatsApp', 'Software a medida'],
          ['receipt', 'Facturación', 'Factura electrónica con cada orden', 'Cobros y facturación'],
        ],
      },
      {
        ico: 'fork-knife', para: 'para un restaurante',
        msg: 'Tengo un restaurante y quiero que pidan desde la mesa.',
        piezas: [
          ['qr-code', 'Menú QR', 'La carta en el teléfono del cliente', 'Web y apps'],
          ['chef-hat', 'Pantalla de cocina', 'Cada pedido con su hora de entrada', 'Pantallas y kioscos'],
          ['credit-card', 'Cobros en la mesa', 'Pagan con Yappy o tarjeta, con propina', 'Cobros y facturación'],
          ['chat-circle-dots', 'Pedidos por WhatsApp', 'Los toma solo y los manda a la cocina', 'Inteligencia artificial'],
        ],
      },
    ];
    const DURA = 10600; // lo que dura cada negocio, en ms
    const tabs = [...cfg.querySelectorAll('.cfg__tab')];
    const elTexto = cfg.querySelector('[data-texto]');
    const elPara = cfg.querySelector('[data-para]');
    const elCuenta = cfg.querySelector('[data-cuenta]');
    const elResumen = cfg.querySelector('[data-resumen]');
    const elIco = cfg.querySelector('[data-ico-negocio]');
    const piezas = [...cfg.querySelectorAll('[data-pieza]')];
    const botonPausa = cfg.querySelector('[data-pausa]');

    let idx = 0;
    let t = 0;
    let plan = null;
    let antes = {};
    let jugando = !quieto;
    let enPantalla = true;
    let raf = 0;
    let ultimo = 0;

    // el ritmo de tecleo: parejo, con una pausa breve en los espacios y después de las comas
    const planear = (n) => {
      const tiempos = [];
      let acc = 380;
      for (let i = 0; i < n.msg.length; i++) {
        const c = n.msg[i];
        acc += 27 + ((i * 37) % 19) + (c === ' ' ? 24 : 0) + (n.msg[i - 1] === ',' ? 150 : 0);
        tiempos.push(acc);
      }
      const fin = acc;
      const pulsa = fin + 360;
      const enviado = pulsa + 200;
      const llega = n.piezas.map((_, i) => enviado + 300 + i * 560);
      const lista = llega.map((x) => x + 320);
      const pie = lista[lista.length - 1] + 380;
      return { tiempos, fin, pulsa, enviado, llega, lista, pie, sale: DURA - 540 };
    };

    const cargar = (i) => {
      idx = i;
      const n = NEGOCIOS[i];
      plan = planear(n);
      antes = {};
      tabs.forEach((b, k) => {
        b.setAttribute('aria-pressed', String(k === i));
        b.querySelector('.cfg__barra b').style.transform = 'scaleX(0)';
      });
      elIco.setAttribute('href', ICONOS + n.ico);
      elPara.textContent = n.para;
      piezas.forEach((li, k) => {
        const [ico, nombre, que, tipo] = n.piezas[k];
        li.querySelector('.pieza__ico use').setAttribute('href', ICONOS + ico);
        li.querySelector('.pieza__txt b').textContent = nombre;
        li.querySelector('.pieza__txt small').textContent = que;
        li.querySelector('.pieza__tipo').textContent = tipo;
      });
      const tipos = new Set(n.piezas.map((p) => p[3])).size;
      elResumen.textContent = `${n.piezas.length} piezas de ${tipos} tipos, un solo equipo`;
    };

    const clase = (nombre, si) => cfg.classList.toggle(nombre, si);
    const pintar = () => {
      const n = NEGOCIOS[idx];
      const p = plan;
      let letras = 0;
      while (letras < p.tiempos.length && p.tiempos[letras] <= t) letras++;
      if (antes.letras !== letras) {
        elTexto.textContent = n.msg.slice(0, letras);
        antes.letras = letras;
      }
      clase('escribiendo', t >= 260 && t < p.fin + 240);
      clase('listo', letras === n.msg.length);
      clase('pulsado', t >= p.pulsa && t < p.pulsa + 170);
      clase('enviado', t >= p.enviado);
      let listas = 0;
      piezas.forEach((li, k) => {
        const lista = t >= p.lista[k];
        if (lista) listas++;
        li.classList.toggle('llega', t >= p.llega[k]);
        li.classList.toggle('lista', lista);
      });
      const cuenta = t >= p.enviado ? `${listas} de ${n.piezas.length} listas` : '';
      if (antes.cuenta !== cuenta) {
        elCuenta.textContent = cuenta;
        antes.cuenta = cuenta;
      }
      clase('cerrada', t >= p.pie);
      clase('saliendo', t >= p.sale);
      tabs[idx].querySelector('.cfg__barra b').style.transform = `scaleX(${Math.min(t / DURA, 1).toFixed(4)})`;
    };

    const corriendo = () => jugando && enPantalla && !document.hidden;
    const paso = (ahora) => {
      raf = 0;
      t += Math.min(ahora - ultimo, 200); // si un cuadro se atrasa mucho, no saltamos medio negocio
      ultimo = ahora;
      if (t >= DURA) {
        cargar((idx + 1) % NEGOCIOS.length);
        t = 0;
      }
      pintar();
      if (corriendo()) raf = requestAnimationFrame(paso);
    };
    const arrancar = () => {
      if (raf || !corriendo()) return;
      ultimo = performance.now();
      raf = requestAnimationFrame(paso);
    };
    const parar = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // primer cuadro: el mensaje de la tienda ya escrito y las piezas a punto de llegar
    cargar(0);
    t = quieto ? plan.pie + 300 : plan.enviado + 120;
    pintar();

    tabs.forEach((b, k) =>
      b.addEventListener('click', () => {
        cargar(k);
        // con la animación corriendo, el negocio elegido empieza a escribir; en pausa, se ve ya armado
        t = corriendo() ? 0 : plan.pie + 300;
        pintar();
        arrancar();
      }),
    );

    if (!quieto) {
      botonPausa.hidden = false;
      rotular(botonPausa, false);
      botonPausa.addEventListener('click', () => {
        jugando = !jugando;
        rotular(botonPausa, !jugando);
        if (jugando) arrancar();
        else parar();
      });
      vigilar(cfg, (si) => {
        enPantalla = si;
        if (si) arrancar();
        else parar();
      });
      document.addEventListener('visibilitychange', () => (document.hidden ? parar() : arrancar()));
      arrancar();
    }
  }

  /* ── la cinta de negocios: se mueve despacio, se detiene al pasar el ratón, con el botón o fuera de pantalla ── */
  const cinta = document.querySelector('[data-cinta]');
  if (cinta && !quieto) {
    const pista = cinta.querySelector('.cinta__pista');
    const grupo = pista.querySelector('.cinta__grupo');
    const copia = grupo.cloneNode(true);
    copia.setAttribute('aria-hidden', 'true');
    copia.querySelectorAll('a').forEach((a) => (a.tabIndex = -1));
    copia.querySelectorAll('img').forEach((img) => (img.alt = ''));
    pista.append(copia);
    // unos 34 px por segundo, sea cual sea el ancho de las tarjetas
    const medir = () => cinta.style.setProperty('--cinta-dur', `${Math.round(grupo.getBoundingClientRect().width / 34)}s`);
    medir();
    addEventListener('resize', medir, { passive: true });
    cinta.classList.add('en-marcha');
    const boton = document.querySelector('[data-pausa-cinta]');
    if (boton) {
      boton.hidden = false;
      rotular(boton, false);
      boton.addEventListener('click', () => rotular(boton, cinta.classList.toggle('pausada')));
    }
    vigilar(cinta, (si) => cinta.classList.toggle('fuera', !si));
  }

  /* ── la propuesta de ejemplo se escribe una vez, cuando entra en pantalla ── */
  const propuesta = document.querySelector('[data-propuesta]');
  if (propuesta) {
    if (quieto || !('IntersectionObserver' in window)) propuesta.classList.add('escrita');
    else {
      const io = new IntersectionObserver(
        (es) =>
          es.forEach((en) => {
            if (en.isIntersecting) {
              propuesta.classList.add('escrita');
              io.disconnect();
            }
          }),
        { threshold: 0.4 },
      );
      io.observe(propuesta);
    }
  }
})();
