// alphateklab, propuesta 44 «Cinta de soluciones»: menú, formulario, copiar el correo, pestañas, buscador,
// la cinta del héroe (dos filas que se deslizan, cada pantalla con su cambio en vivo) y los avisos del celular.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

  /* ── cabecera: sombra al bajar y menú del celular ── */
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

  /* ── pestañas (negocios y demos): teclado con flechas, Inicio y Fin ── */
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
        const span = document.createElement('span');
        span.textContent = s.a.dataset.servicio;
        const small = document.createElement('small');
        small.textContent = s.tipo || '';
        span.append(small);
        a.append(span);
        a.append(s.a.querySelector('.ico')?.cloneNode(true) || '');
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

  /* ── el cambio en vivo de cada pantalla ──
     Cada pantalla tiene data-pasos (3). En cada paso:
     · [data-valores="a|b|c"] cambia su texto (con un pequeño salto del número),
     · [data-desde="n"] aparece desde el paso n, [data-hasta="n"] se va en el paso n,
     · [data-marca="n"] solo recibe .on desde el paso n,
     · la pantalla lleva la clase paso-N para lo demás (barras, mapa, listas que se corren). */
  const salto = (el) => {
    if (quieto || !el.animate) return;
    el.animate(
      [{ transform: 'translateY(0.45em)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 380, easing: EASE_OUT },
    );
  };
  const ponerPaso = (pantalla, paso, animar = true) => {
    pantalla.classList.remove('paso-0', 'paso-1', 'paso-2', 'paso-3');
    pantalla.classList.add(`paso-${paso}`);
    pantalla.querySelectorAll('[data-valores]').forEach((el) => {
      const v = el.dataset.valores.split('|');
      const nuevo = v[Math.min(paso, v.length - 1)];
      if (el.textContent !== nuevo) {
        el.textContent = nuevo;
        if (animar) salto(el);
      }
    });
    pantalla.querySelectorAll('[data-desde], [data-hasta], [data-marca]').forEach((el) => {
      const desde = Number(el.dataset.desde ?? el.dataset.marca ?? 0);
      const hasta = el.dataset.hasta === undefined ? Infinity : Number(el.dataset.hasta);
      el.classList.toggle('on', paso >= desde && paso < hasta);
    });
  };

  /* ── la cinta: dos filas que se deslizan en sentidos contrarios (solo transform, con WAAPI) ── */
  const cinta = document.querySelector('[data-cinta]');
  if (cinta) {
    const pistas = [...cinta.querySelectorAll('[data-pista]')];
    const pausa = cinta.querySelector('[data-pausa]');

    // la segunda copia de cada fila, para que el bucle no tenga costura
    pistas.forEach((pista) => {
      [...pista.children].forEach((li) => {
        const copia = li.cloneNode(true);
        copia.setAttribute('aria-hidden', 'true');
        copia.inert = true;
        copia.querySelector('a')?.setAttribute('tabindex', '-1');
        pista.append(copia);
      });
    });

    // cada pantalla con su clave (la original y su copia cambian juntas)
    const grupos = new Map();
    pistas.forEach((pista, f) => {
      const n = pista.children.length / 2;
      [...pista.children].forEach((li, i) => {
        const clave = `${f}-${i % n}`;
        const p = li.querySelector('.pantalla');
        if (!p) return;
        p.dataset.clave = clave;
        if (!grupos.has(clave)) grupos.set(clave, { pantallas: [], paso: 0, ultimo: -Infinity, pasos: Number(p.dataset.pasos || 3) });
        grupos.get(clave).pantallas.push(p);
      });
    });

    if (quieto) {
      // movimiento reducido: todo quieto, cada pantalla en su último paso (el más completo)
      grupos.forEach((g) => g.pantallas.forEach((p) => ponerPaso(p, g.pasos - 1, false)));
    } else {
      grupos.forEach((g) => g.pantallas.forEach((p) => ponerPaso(p, 0, false)));

      // el deslizamiento: velocidad en px por segundo, igual en cualquier ancho
      const anims = pistas.map((pista) => {
        const inversa = pista.hasAttribute('data-inversa');
        const a = pista.animate(
          [{ transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-50%, 0, 0)' }],
          { duration: 60000, iterations: Infinity, easing: 'linear', direction: inversa ? 'reverse' : 'normal' },
        );
        return { pista, a, fila: pista.closest('.cinta__fila'), velocidad: Number(pista.dataset.velocidad || 30), encima: false };
      });
      const medir = () => {
        anims.forEach((x) => {
          const mitad = x.pista.scrollWidth / 2;
          const escala = innerWidth < 640 ? 0.72 : 1;
          const dur = (mitad / (x.velocidad * escala)) * 1000;
          const antes = x.dur || 60000;
          const fraccion = ((x.a.currentTime || 0) % antes) / antes;
          x.a.effect.updateTiming({ duration: dur });
          x.a.currentTime = fraccion * dur;
          x.dur = dur;
        });
      };
      medir();
      let ancho = innerWidth;
      addEventListener('resize', () => {
        if (Math.abs(innerWidth - ancho) < 2) return;
        ancho = innerWidth;
        medir();
      });

      // frenar y arrancar con suavidad (sin saltos): la velocidad se lleva a 0 o a 1 en ~450 ms
      const rampa = (x, destino) => {
        cancelAnimationFrame(x.raf);
        const desde = x.a.playbackRate;
        const t0 = performance.now();
        const paso = (t) => {
          const k = Math.min(1, (t - t0) / 450);
          const e = 1 - Math.pow(1 - k, 3);
          const v = desde + (destino - desde) * e;
          x.a.updatePlaybackRate(Math.max(v, 0.0001));
          if (k < 1) x.raf = requestAnimationFrame(paso);
          else if (destino === 0) x.a.pause();
        };
        if (destino > 0 && x.a.playState === 'paused') { x.a.updatePlaybackRate(0.0001); x.a.play(); }
        x.raf = requestAnimationFrame(paso);
      };

      let pausado = false;
      let fuera = false;
      const actualizar = () => {
        anims.forEach((x) => {
          const parar = pausado || fuera || x.encima;
          if (parar && x.destino !== 0) { x.destino = 0; fuera ? (x.a.pause(), cancelAnimationFrame(x.raf)) : rampa(x, 0); }
          if (!parar && x.destino !== 1) { x.destino = 1; rampa(x, 1); }
        });
      };
      anims.forEach((x) => {
        x.destino = 1;
        const fino = matchMedia('(hover: hover) and (pointer: fine)');
        x.fila.addEventListener('pointerenter', () => { if (fino.matches) { x.encima = true; actualizar(); } });
        x.fila.addEventListener('pointerleave', () => { x.encima = false; actualizar(); });
        x.fila.addEventListener('focusin', () => { x.encima = true; actualizar(); });
        x.fila.addEventListener('focusout', () => { x.encima = false; actualizar(); });
      });
      pausa?.addEventListener('click', () => {
        pausado = !pausado;
        pausa.setAttribute('aria-pressed', String(pausado));
        pausa.querySelector('span').textContent = pausado ? 'Reproducir' : 'Pausar';
        actualizar();
      });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([en]) => { fuera = !en.isIntersecting; actualizar(); }).observe(cinta);
      }

      // el cambio en vivo: cada ~1.5 s avanza la pantalla visible que lleva más tiempo sin cambiar
      const todas = [...cinta.querySelectorAll('.pantalla')];
      const latido = () => {
        if (pausado || fuera || document.hidden) return;
        const ahora = performance.now();
        const ancho = innerWidth;
        let elegido = null;
        for (const p of todas) {
          const r = p.getBoundingClientRect();
          if (r.right < ancho * 0.1 || r.left > ancho * 0.9) continue;
          const g = grupos.get(p.dataset.clave);
          if (ahora - g.ultimo < 4200) continue;
          if (!elegido || g.ultimo < elegido.ultimo) elegido = g;
        }
        if (!elegido) return;
        elegido.ultimo = ahora;
        elegido.paso = (elegido.paso + 1) % elegido.pasos;
        elegido.pantallas.forEach((p) => ponerPaso(p, elegido.paso));
      };
      setTimeout(() => { latido(); setInterval(latido, 1500); }, 700);
    }
  }

  /* ── los avisos que llegan al celular (abajo en la portada) ── */
  const zona = document.querySelector('[data-avisos]');
  const listaAvisos = zona?.querySelector('[data-avisos-lista]');
  if (zona && listaAvisos && !quieto) {
    const sprite = listaAvisos.querySelector('use')?.getAttribute('href').split('#')[0] || 'assets/iconos.svg';
    const avisos = [
      ['i-wrench', 'Taller Vega', 'El Kia Picanto está listo. Se avisó al cliente por WhatsApp.'],
      ['i-robot', 'Inmobiliaria Sol', 'El asistente agendó una visita para el sábado a las 10:00 a. m.'],
      ['i-rayo', 'Cabañas El Valle', 'La cabaña 3 está vacía y gasta como si tuviera el aire prendido.'],
      ['i-lock-key', 'Oficinas Altamira', 'Pase de visita para el técnico del aire. Vence a las 5:00 p. m.'],
      ['i-map-pin', 'Distribuidora Istmo', 'El camión 2 llegó a la parada 3 de 4.'],
      ['i-barras', 'Panadería Santa Ana', 'Llevas B/. 1,322.00 en ventas, 12 % más que ayer.'],
      ['i-users-three', 'Barbería El Corte', 'Reserva en línea: corte a las 10:00 a. m. con Marco.'],
      ['i-fork-knife', 'Restaurante Pixbae', 'La mesa 6 pidió desde el QR: 1 sancocho y 2 patacones.'],
      ['i-calendar-check', 'Hotel Brisas', 'Reserva directa: habitación 102, del 25 al 28.'],
      ['i-file-text', 'Ferretería El Tornillo', 'Factura 001-000413 autorizada por B/. 18.19.'],
      ['i-security-camera', 'Coralina', 'Hay 6 personas en la fila de la caja.'],
      ['i-clipboard-text', 'Minisúper La Esquina', 'El aceite de 1 L llegó al mínimo. La orden de compra está lista.'],
      ['i-graduation-cap', 'Colegio Los Robles', '26 de 28 llegaron a 4.° B. Se avisó a 2 familias.'],
    ];
    const horas = ['ahora', 'hace 1 min', 'hace 3 min', 'hace 6 min', 'hace 9 min', 'hace 12 min'];
    let i = 0;
    const crear = ([ico, quien, que]) => {
      const li = document.createElement('li');
      li.className = 'aviso aviso--nuevo';
      li.innerHTML = `<span class="ico-caja"><svg class="ico"><use href="${sprite}#${ico}"/></svg></span><div><header><b></b><time>ahora</time></header><p></p></div>`;
      li.querySelector('b').textContent = quien;
      li.querySelector('p').textContent = que;
      return li;
    };
    const llegar = () => {
      const li = crear(avisos[i++ % avisos.length]);
      listaAvisos.querySelectorAll('.aviso--nuevo').forEach((a) => a.classList.remove('aviso--nuevo'));
      listaAvisos.prepend(li);
      const alto = li.offsetHeight + 8;
      listaAvisos.animate([{ transform: `translateY(${-alto}px)` }, { transform: 'none' }], { duration: 620, easing: EASE_OUT });
      li.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 140, easing: EASE_OUT, fill: 'backwards' });
      [...listaAvisos.children].forEach((a, k) => { const t = a.querySelector('time'); if (t) t.textContent = horas[Math.min(k, horas.length - 1)]; });
      while (listaAvisos.children.length > 6) listaAvisos.lastElementChild.remove();
    };
    const boton = zona.querySelector('[data-pausa-avisos]');
    let pausado = false;
    let visible = false;
    let reloj = null;
    const correr = () => {
      const debe = visible && !pausado && !document.hidden;
      if (debe && !reloj) reloj = setInterval(llegar, 3400);
      if (!debe && reloj) { clearInterval(reloj); reloj = null; }
    };
    boton?.addEventListener('click', () => {
      pausado = !pausado;
      boton.setAttribute('aria-pressed', String(pausado));
      boton.querySelector('span').textContent = pausado ? 'Reproducir' : 'Pausar';
      correr();
    });
    document.addEventListener('visibilitychange', correr);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; correr(); }, { threshold: 0.25 }).observe(zona);
    }
  } else if (zona) {
    zona.querySelector('.cel-pie .pausa')?.setAttribute('hidden', '');
  }
})();
