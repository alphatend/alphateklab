// alphateklab, propuesta 33 «Panel en vivo»: menú, formulario, copiar el correo, pestañas, buscador,
// puertas con vista previa y la demo del héroe (eventos que llegan y la respuesta del sistema).
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit (formsubmit.co), igual que en el sitio en vivo.
     Sin JavaScript, el formulario se manda solo y FormSubmit vuelve a la página (_next). _honey es la trampa para robots. ── */
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
  const marcar = () => {
    texto?.setAttribute('aria-invalid', String(!texto.value.trim()));
    contacto?.setAttribute('aria-invalid', String(!contacto.validity.valid));
  };
  // el navegador marca el campo; la nota dice qué falta con palabras
  form?.addEventListener('invalid', () => { avisar(queFalta(), true); marcar(); }, true);
  form?.addEventListener('input', () => {
    if (nota.dataset.estado === 'error') {
      marcar();
      if (!queFalta()) avisar('');
    }
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
      texto.removeAttribute('aria-invalid');
      contacto.removeAttribute('aria-invalid');
      avisar('Recibimos tu mensaje. Te respondemos pronto a tu correo.');
    } catch {
      avisar('No se pudo enviar. Revisa tu conexión e inténtalo otra vez, o escríbenos a info@alphateklab.com.', true);
    } finally {
      enviando = false;
      boton?.removeAttribute('aria-disabled');
    }
  });
  // botones que bajan al formulario con el mensaje ya escrito (paquetes)
  document.querySelectorAll('[data-mensaje]').forEach((b) =>
    b.addEventListener('click', () => {
      if (texto && !texto.value.trim()) texto.value = `${b.dataset.mensaje} `;
      if (b.tagName === 'BUTTON') {
        document.getElementById('propuesta')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth' });
        setTimeout(() => texto?.focus({ preventScroll: true }), quieto ? 0 : 600);
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

  /* ── índice de servicios: marca el tipo que estás leyendo ── */
  const indice = document.querySelectorAll('.indice a[href^="#"]');
  if (indice.length && 'IntersectionObserver' in window) {
    const porId = new Map([...indice].map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((en) => {
          if (!en.isIntersecting) return;
          indice.forEach((a) => a.classList.remove('activo'));
          porId.get(en.target.id)?.classList.add('activo');
        }),
      { rootMargin: '-30% 0px -60% 0px' },
    );
    porId.forEach((_, id) => {
      const s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  /* ── puertas: la fila que señalas cambia la vista previa ── */
  const puertas = document.querySelector('[data-puertas]');
  if (puertas) {
    const filas = puertas.querySelectorAll('.puerta');
    const vistas = puertas.querySelectorAll('.vista');
    const mostrar = (cual) => {
      filas.forEach((f) => f.classList.toggle('activa', f.dataset.vista === cual));
      vistas.forEach((v) => v.classList.toggle('activa', v.dataset.vista === cual));
    };
    filas.forEach((f) => {
      f.addEventListener('pointerenter', () => mostrar(f.dataset.vista));
      f.addEventListener('focus', () => mostrar(f.dataset.vista));
    });
  }

  /* ── la demo del héroe ──
     Un reloj propio (t, en ms) que solo avanza cuando la demo se ve, la pestaña está activa y no está en pausa.
     Cada cuadro se dibuja a partir de t, así que pausar y reanudar no pierde nada. */
  const demo = document.querySelector('[data-demo]');
  if (demo) {
    const respuesta = 'Avisé al encargado y a la pantalla de cocina';
    const escrito = demo.querySelector('.escrito');
    const n1 = demo.querySelector('.evento--n1');
    const n2 = demo.querySelector('.evento--n2');
    const botonPausa = demo.querySelector('[data-pausa]');
    const T = { e1: 900, e2: 2700, resp: 3500, escribe: 4150, porLetra: 31 };
    T.finEscribe = T.escribe + respuesta.length * T.porLetra;
    T.recibos = T.finEscribe + 320;
    T.reinicio = T.recibos + 6000; // la ventana descansa unos 6 s antes de repetir
    T.limpia = T.reinicio + 300;
    T.ciclo = T.reinicio + 700;

    let paso = -1;
    let letras = -1;
    const brillar = (fila) => {
      fila.classList.add('brilla');
      requestAnimationFrame(() => requestAnimationFrame(() => fila.classList.remove('brilla')));
    };
    const ponerPaso = (p) => {
      if (p === paso) return;
      const antes = paso;
      paso = p;
      demo.dataset.paso = String(p);
      demo.classList.toggle('rodo', p >= 1);
      demo.classList.toggle('alerta', p >= 2);
      if (!demo.classList.contains('quieto')) {
        if (p === 1 && antes < 1) brillar(n1);
        if (p === 2 && antes < 2) brillar(n2);
      }
    };
    const ponerLetras = (n) => {
      if (n === letras) return;
      letras = n;
      escrito.textContent = respuesta.slice(0, n);
    };
    const dibujar = (t) => {
      if (t >= T.limpia) {
        if (!demo.classList.contains('limpia')) {
          demo.classList.add('quieto', 'limpia');
          ponerPaso(0);
          ponerLetras(0);
          demo.classList.remove('piensa');
          void demo.offsetWidth; // aplica el estado inicial sin transiciones
          demo.classList.remove('quieto', 'reinicia');
        }
        return;
      }
      if (t >= T.reinicio) {
        demo.classList.add('reinicia');
        return;
      }
      ponerPaso(t < T.e1 ? 0 : t < T.e2 ? 1 : t < T.resp ? 2 : t < T.finEscribe ? 3 : t < T.recibos ? 4 : 5);
      demo.classList.toggle('piensa', t >= T.resp && t < T.escribe);
      ponerLetras(Math.max(0, Math.min(respuesta.length, Math.floor((t - T.escribe) / T.porLetra))));
    };

    if (quieto) {
      // con movimiento reducido: el estado final, quieto y completo
      demo.classList.add('sin-movimiento', 'quieto');
      dibujar(T.recibos + 10);
      requestAnimationFrame(() => demo.classList.remove('quieto'));
    } else {
      let t = 0;
      let previo = 0;
      let raf = 0;
      let enPausa = false;
      let enPantalla = true;
      let arrancada = false;
      const anda = () => arrancada && !enPausa && enPantalla && document.visibilityState === 'visible';
      const cuadro = (ahora) => {
        t += Math.min(64, ahora - previo); // si el navegador se atrasa, no salta pasos
        previo = ahora;
        if (t >= T.ciclo) {
          t = 0;
          demo.classList.remove('limpia');
        }
        dibujar(t);
        raf = anda() ? requestAnimationFrame(cuadro) : 0;
      };
      const seguir = () => {
        if (raf || !anda()) return;
        previo = performance.now();
        raf = requestAnimationFrame(cuadro);
      };
      const parar = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };
      dibujar(0);
      botonPausa?.addEventListener('click', () => {
        enPausa = !enPausa;
        demo.classList.toggle('en-pausa', enPausa);
        botonPausa.setAttribute('aria-pressed', String(enPausa));
        enPausa ? parar() : seguir();
      });
      document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? seguir() : parar()));
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((e) => {
          enPantalla = e[0].isIntersecting;
          enPantalla ? seguir() : parar();
        }, { threshold: 0.15 }).observe(demo);
      }
      // empieza cuando termina la entrada de la ventana
      setTimeout(() => {
        arrancada = true;
        seguir();
      }, 700);
    }
  }
})();
