// alphateklab, propuesta 49 «Hacemos de todo»: menú, formulario, copiar el correo, pestañas, buscador,
// el rodillo del héroe con sus tarjetas, y la franja de negocios.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!quieto) document.documentElement.classList.add('js-movil');

  /* ── cabecera: borde al bajar y menú del celular ── */
  const cabecera = document.querySelector('.cabecera');
  const abrir = document.querySelector('[data-abrir-menu]');
  const sombra = () => cabecera?.classList.toggle('con-sombra', scrollY > 8);
  addEventListener('scroll', sombra, { passive: true });
  sombra();
  const cerrarMenu = () => {
    cabecera?.classList.remove('abierta');
    abrir?.setAttribute('aria-expanded', 'false');
    if (abrir) abrir.querySelector('span').textContent = 'Menú';
  };
  abrir?.addEventListener('click', () => {
    const abierta = cabecera.classList.toggle('abierta');
    abrir.setAttribute('aria-expanded', String(abierta));
    abrir.querySelector('span').textContent = abierta ? 'Cerrar' : 'Menú';
  });
  document.querySelectorAll('.movil a').forEach((a) => a.addEventListener('click', cerrarMenu));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cabecera?.classList.contains('abierta')) {
      cerrarMenu();
      abrir?.focus();
    }
  });

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, igual que en el sitio publicado.
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
      if (b.tagName === 'BUTTON') {
        document.getElementById('propuesta')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth' });
        setTimeout(() => texto?.focus({ preventScroll: true }), quieto ? 0 : 500);
      }
    }),
  );

  /* ── copiar el correo (si el portapapeles no responde, se selecciona el texto) ── */
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

  /* ── pestañas (demos): teclado con flechas, Inicio y Fin ── */
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
        const sp = document.createElement('span');
        sp.textContent = s.a.dataset.servicio;
        const sm = document.createElement('small');
        sm.textContent = s.tipo;
        sp.append(sm);
        a.append(sp);
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

  /* ── el héroe: «Hacemos ___ para tu negocio.» La frase rueda y su tarjeta entra con ella, cada 2,6 s.
     Estado 0 es «de todo» (las ocho a la vez); 1 a 8 son las frases. Un solo reloj (requestAnimationFrame)
     mueve la barra de avance, dispara lo que pasa dentro de cada tarjeta y cambia de frase; se detiene con
     el botón, al tocar una frase, con el puntero sobre la tarjeta, o si el héroe sale de la pantalla. ── */
  const heroe = document.querySelector('[data-heroe]');
  if (heroe) {
    const frases = [...heroe.querySelectorAll('.rodillo__frase')];
    const tarjetas = [...heroe.querySelectorAll('.tarjeta')];
    const ops = [...heroe.querySelectorAll('[data-ir]')];
    const rellenos = ops.map((b) => b.querySelector('.mando__relleno'));
    const pausa = heroe.querySelector('[data-pausa]');
    const escenario = heroe.querySelector('.escenario__marco');
    const DUR = 2600;
    const PRIMERA = 3400;
    const EVENTO = 640;
    let i = 0;
    let t = 0;
    let primera = true;
    let enPausa = false;
    let visible = true;
    let encima = false;
    let reloj = 0;
    let antes = 0;
    let tEvento = 0;
    // lo que pasa dentro de la tarjeta llega poco después de que ella entra, aunque el avance esté en pausa
    const programarEvento = (n) => {
      clearTimeout(tEvento);
      tEvento = setTimeout(() => {
        if (i === n) tarjetas[n].classList.add('vivo');
      }, EVENTO);
    };

    const marcar = () => {
      ops.forEach((b, k) => {
        const n = k + 1;
        if (n === i) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
        b.classList.toggle('todas', i === 0);
        b.classList.toggle('hecho', i !== 0 && n < i);
      });
    };
    const barras = (p) => {
      rellenos.forEach((r, k) => {
        const n = k + 1;
        const s = i === 0 ? p : n < i ? 1 : n === i ? p : 0;
        r.style.transform = `scaleX(${s.toFixed(4)})`;
      });
    };
    const reiniciar = (tarjeta) => {
      tarjeta.classList.add('reinicio');
      tarjeta.classList.remove('vivo', 'se-va');
      void tarjeta.offsetWidth;
      tarjeta.classList.remove('reinicio');
    };
    const ir = (n) => {
      if (n === i) return;
      const fv = frases[i];
      const tv = tarjetas[i];
      fv.classList.replace('es-activa', 'se-va');
      tv.classList.remove('es-activa');
      tv.classList.add('se-va');
      setTimeout(() => {
        if (!tv.classList.contains('es-activa')) reiniciar(tv);
      }, 520);
      const fn = frases[n];
      const tn = tarjetas[n];
      // la frase que entra vuelve abajo sin transición, y luego sube
      fn.style.transition = 'none';
      fn.classList.remove('se-va', 'es-activa');
      void fn.offsetWidth;
      fn.style.transition = '';
      if (tn.classList.contains('se-va') || tn.classList.contains('vivo')) reiniciar(tn);
      fn.classList.add('es-activa');
      tn.classList.add('es-activa');
      i = n;
      t = 0;
      if (quieto) tn.classList.add('vivo');
      else programarEvento(n);
      marcar();
      barras(0);
    };
    const corre = () => !enPausa && visible && !encima && !document.hidden && !quieto;
    const paso = (ahora) => {
      const dt = Math.min(ahora - antes, 80);
      antes = ahora;
      t += dt;
      const dur = primera && i === 0 ? PRIMERA : DUR;
      if (t >= dur) {
        primera = false;
        ir((i + 1) % frases.length);
      } else {
        barras(t / dur);
      }
      reloj = corre() ? requestAnimationFrame(paso) : 0;
    };
    const seguir = () => {
      if (reloj || !corre()) return;
      antes = performance.now();
      reloj = requestAnimationFrame(paso);
    };
    const parar = () => {
      cancelAnimationFrame(reloj);
      reloj = 0;
    };
    const ponerPausa = (si) => {
      enPausa = si;
      pausa.querySelector('span').textContent = si ? 'Reproducir' : 'Pausar';
      pausa.querySelector('use').setAttribute('href', `assets/iconos.svg#${si ? 'i-play' : 'i-pause'}`);
      if (si) parar();
      else seguir();
    };

    pausa.addEventListener('click', () => ponerPausa(!enPausa));
    ops.forEach((b, k) =>
      b.addEventListener('click', () => {
        ir(k + 1);
        if (!quieto) ponerPausa(true);
      }),
    );
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      escenario.addEventListener('pointerenter', () => { encima = true; parar(); });
      escenario.addEventListener('pointerleave', () => { encima = false; seguir(); });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) seguir();
        else parar();
      }, { threshold: 0.15 }).observe(heroe);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? parar() : seguir()));

    // el título se mide por su frase más larga; si la letra de reserva (Public Sans) es más ancha que Mona Sans,
    // se encoge un poco para que ninguna frase se corte ni «para tu negocio.» toque la tarjeta
    const rejilla = heroe.querySelector('.heroe__rejilla');
    const rodillo = heroe.querySelector('.rodillo');
    const linea3 = heroe.querySelectorAll('.heroe__linea')[1];
    const ajustar = () => {
      rejilla.style.setProperty('--ajuste', '1');
      const ancho = rodillo.clientWidth;
      const mayor = Math.max(...frases.map((f) => f.getBoundingClientRect().width));
      let k = mayor > ancho ? ancho / mayor : 1;
      if (innerWidth > 960) {
        const limite = rejilla.clientWidth - 476;
        const l3 = linea3.getBoundingClientRect().width;
        if (l3 > limite) k = Math.min(k, limite / l3);
      }
      if (k < 1) rejilla.style.setProperty('--ajuste', (k * 0.98).toFixed(3));
    };
    let ajusteReloj = 0;
    addEventListener('resize', () => {
      cancelAnimationFrame(ajusteReloj);
      ajusteReloj = requestAnimationFrame(ajustar);
    });
    document.fonts?.ready.then(ajustar);
    ajustar();

    marcar();
    if (quieto) {
      // movimiento reducido: queda «de todo» con sus ocho tipos, sin avance; tocar una frase la muestra.
      tarjetas[0].classList.add('vivo');
      barras(1);
      pausa.hidden = true;
    } else {
      barras(0);
      programarEvento(0);
      seguir();
    }
  }

  /* ── franja de negocios: avanza despacio; se detiene con el botón o fuera de la pantalla ── */
  const cinta = document.querySelector('[data-cinta]');
  const pausaCinta = document.querySelector('[data-pausa-cinta]');
  if (cinta && pausaCinta) {
    if (quieto) pausaCinta.hidden = true;
    let detenida = false;
    let fuera = false;
    const pintar = () => cinta.classList.toggle('quieta', detenida || fuera);
    pausaCinta.addEventListener('click', () => {
      detenida = !detenida;
      pausaCinta.querySelector('span').textContent = detenida ? 'Reproducir' : 'Pausar';
      pausaCinta.querySelector('use').setAttribute('href', `assets/iconos.svg#${detenida ? 'i-play' : 'i-pause'}`);
      pintar();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        fuera = !e.isIntersecting;
        pintar();
      }).observe(cinta);
    }
  }
})();
