// alphateklab, propuesta 36: menú, formulario, copiar el correo, pestañas, buscador, puertas
// y la escena del héroe (una venta en la caja 2 que mueve el inventario y prepara la compra).
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── cabecera: línea al bajar y menú del celular ── */
  const cabecera = document.querySelector('.cabecera');
  const abrir = document.querySelector('[data-abrir-menu]');
  const linea = () => cabecera?.classList.toggle('con-linea', scrollY > 8);
  addEventListener('scroll', linea, { passive: true });
  linea();
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

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, igual que el del sitio publicado.
     Sin JavaScript se manda solo y FormSubmit vuelve a la página (_next). _honey es la trampa para robots. ── */
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
      setTimeout(() => texto?.focus({ preventScroll: true }), quieto ? 0 : 600);
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

  /* ── pestañas (negocios): teclado con flechas, Inicio y Fin ── */
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
        let n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
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
    const flecha = caja.querySelector('template');
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
        a.append(nombre, flecha.content.cloneNode(true));
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

  /* ── índice de tipos (servicios): marca el tipo que estás leyendo ── */
  const indice = document.querySelectorAll('[data-indice] a');
  if (indice.length && 'IntersectionObserver' in window) {
    const porId = new Map([...indice].map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((en) => {
          if (!en.isIntersecting) return;
          indice.forEach((a) => a.classList.remove('activo'));
          porId.get(en.target.id)?.classList.add('activo');
        }),
      { rootMargin: '-25% 0px -65% 0px' },
    );
    porId.forEach((_, id) => {
      const s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  /* ── puertas del inicio: la vista de la derecha cambia con la fila que señalas ── */
  document.querySelectorAll('[data-puertas]').forEach((caja) => {
    const puertas = caja.querySelectorAll('[data-vista]');
    const vistas = caja.querySelectorAll('.vista');
    const mostrar = (id) => {
      vistas.forEach((v) => v.classList.toggle('ver', v.dataset.id === id));
      puertas.forEach((p) => p.classList.toggle('activa', p.dataset.vista === id));
    };
    puertas.forEach((p) => {
      p.addEventListener('pointerenter', () => mostrar(p.dataset.vista));
      p.addEventListener('focus', () => mostrar(p.dataset.vista));
    });
  });

  /* ── la escena del héroe ──
     Una venta entra por la caja 2, el aceite baja de 12 a 10, cruza su mínimo (11), la fila se pone en ámbar,
     el sistema arma la orden de compra #0142 y al dueño le llega el aviso. Espera, se apaga y vuelve a empezar.
     Se pausa con el botón, cuando sale de la pantalla y cuando la pestaña no se ve. Con movimiento reducido
     queda quieta en el estado final. */
  const escena = document.querySelector('[data-escena]');
  if (escena) {
    const cuerpo = escena.querySelector('.app__cuerpo');
    const plantilla = cuerpo.innerHTML;
    const boton = document.querySelector('[data-pausa]');
    const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
    const $ = (s) => cuerpo.querySelector(s);
    const dinero = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let rapido = !quieto;

    // un número que rueda: el viejo sube y se apaga, el nuevo entra desde abajo
    const rodar = (rueda, valor) => {
      const viejo = rueda.lastElementChild;
      const nuevo = document.createElement('span');
      nuevo.textContent = valor;
      rueda.append(nuevo);
      if (!rapido) {
        viejo.remove();
        return;
      }
      viejo.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-80%)', opacity: 0 }], { duration: 360, easing: EASE, fill: 'forwards' }).onfinish = () => viejo.remove();
      nuevo.animate([{ transform: 'translateY(80%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 360, easing: EASE });
    };
    // las ventas del día suben contando, sin saltar
    const contar = (el, desde, hasta, ms = 800) => {
      const poner = (v) => (el.textContent = `B/. ${dinero.format(v)}`);
      if (!rapido) return poner(hasta);
      const t0 = performance.now();
      const paso = (t) => {
        const p = Math.min(1, (t - t0) / ms);
        poner(desde + (hasta - desde) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    };
    const venta = () => {
      const lista = $('[data-ticker]');
      const li = document.createElement('li');
      li.className = 'nueva';
      li.innerHTML = '<b>Venta en caja 2</b><span class="monto">B/. 7.90</span><small>Aceite vegetal 1 L × 2</small><time>ahora</time>';
      lista.prepend(li);
      if (rapido) {
        lista.animate([{ transform: 'translateY(-52px)' }, { transform: 'translateY(0)' }], { duration: 560, easing: EASE });
        li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 140, easing: 'ease', fill: 'backwards' });
      }
      setTimeout(() => {
        while (lista.children.length > 3) lista.lastElementChild.remove();
      }, rapido ? 600 : 0);
      contar($('[data-ventas]'), 1284.6, 1292.5);
      rodar($('[data-tickets]'), '62');
    };
    const stock = (n) => {
      const fila = $('[data-fila-aceite]');
      rodar(fila.querySelector('.stock .rueda'), String(n));
      fila.querySelector('.nivel__lleno').style.transform = `scaleX(${Math.min(1, n / 22).toFixed(3)})`;
    };
    const cruza = () => {
      const fila = $('[data-fila-aceite]');
      fila.classList.remove('tocada');
      fila.classList.add('baja');
      rodar($('[data-bajos]'), '2');
    };
    const reiniciar = () => {
      escena.classList.remove('borrador', 'avisa', 'avisa-sale');
      cuerpo.innerHTML = plantilla;
    };

    // [espera desde el paso anterior en ms, qué pasa]
    const pasos = [
      [1000, venta],
      [700, () => $('[data-fila-aceite]').classList.add('tocada')],
      [260, () => stock(11)],
      [680, () => stock(10)],
      [440, cruza],
      [1000, () => {
        escena.classList.add('borrador');
        $('[data-insignia]')?.classList.add('ver');
      }],
      [850, () => $('.oc--nueva').classList.add('con-lineas')],
      [650, () => $('.oc--nueva').classList.add('lista')],
      [900, () => escena.classList.add('avisa')],
      [5200, () => escena.classList.add('avisa-sale')],
      [320, () => cuerpo.classList.add('velo')],
      [460, reiniciar],
      [60, () => cuerpo.classList.remove('velo')],
    ];

    if (quieto) {
      // movimiento reducido: el estado final, quieto, sin botón de pausa
      rapido = false;
      escena.classList.add('quieta');
      escena.closest('.heroe__visual')?.classList.add('escena-quieta');
      pasos.slice(0, 9).forEach(([, f]) => f());
    } else {
      let i = 0;
      let reloj = 0;
      let inicio = 0;
      let restante = 1900; // deja terminar la entrada de la ventana
      const motivos = new Set();
      const correr = () => {
        inicio = performance.now();
        reloj = setTimeout(() => {
          pasos[i][1]();
          i = (i + 1) % pasos.length;
          restante = pasos[i][0];
          correr();
        }, restante);
      };
      const parar = (motivo) => {
        if (motivos.has(motivo)) return;
        if (!motivos.size) {
          clearTimeout(reloj);
          restante = Math.max(0, restante - (performance.now() - inicio));
        }
        motivos.add(motivo);
      };
      const seguir = (motivo) => {
        if (!motivos.delete(motivo)) return;
        if (!motivos.size) correr();
      };
      correr();
      boton?.addEventListener('click', () => {
        const pausado = boton.getAttribute('aria-pressed') !== 'true';
        boton.setAttribute('aria-pressed', String(pausado));
        boton.querySelector('span').textContent = pausado ? 'Reanudar' : 'Pausar';
        boton.setAttribute('aria-label', pausado ? 'Reanudar la animación' : 'Pausar la animación');
        pausado ? parar('usuario') : seguir('usuario');
      });
      document.addEventListener('visibilitychange', () => (document.hidden ? parar('oculta') : seguir('oculta')));
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([en]) => (en.isIntersecting ? seguir('fuera') : parar('fuera')), { threshold: 0.15 }).observe(escena);
      }
    }
  }
})();
