// alphateklab, propuesta 42: menú, formulario, copiar el correo, buscador y la escena del héroe
// (cinco negocios, una sola ventana del sistema que cambia de uno a otro).
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── menú del celular ── */
  const cabecera = document.querySelector('.cabecera');
  const abrir = document.querySelector('[data-abrir-menu]');
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

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, como en el sitio publicado. Sin JavaScript,
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
  // botones que bajan al formulario con el mensaje ya escrito (los paquetes)
  document.querySelectorAll('[data-mensaje]').forEach((b) =>
    b.addEventListener('click', () => {
      if (texto && !texto.value.trim()) texto.value = `${b.dataset.mensaje} `;
      document.getElementById('propuesta')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth' });
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
        a.target = '_blank';
        a.rel = 'noopener';
        const span = document.createElement('span');
        span.textContent = s.a.dataset.servicio;
        const small = document.createElement('small');
        small.textContent = s.tipo;
        span.append(small);
        a.append(span, s.a.querySelector('.ico')?.cloneNode(true) || '');
        li.append(a);
        lista.append(li);
      });
      caja.hidden = false;
      const n = hallados.length;
      const q2 = entrada.value.trim();
      titulo.textContent = n ? `${n} ${n === 1 ? 'servicio coincide' : 'servicios coinciden'} con «${q2}»` : `Nada en la lista con «${q2}»`;
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

  /* ── la escena del héroe ──
     Cinco pestañas de negocio sobre una sola ventana. Cada ~4 s pasa a la siguiente (la barra amarilla bajo la
     pestaña activa es el reloj: al terminar su animación, cambia). Al tocar una pestaña se detiene el avance.
     Al llegar a cada pantalla, pasa una sola cosa en vivo (.vivo). Con movimiento reducido no avanza sola. */
  const escena = document.querySelector('[data-escena]');
  if (escena) {
    const tabs = [...escena.querySelectorAll('[data-pestana]')];
    const ids = tabs.map((t) => t.dataset.pestana);
    const panel = escena.querySelector('[role="tabpanel"]');
    const pausa = escena.querySelector('[data-pausa]');
    const pausaTxt = pausa.querySelector('span');
    const capasDe = (id) => escena.querySelectorAll(`.capa[data-n="${id}"]`);
    let actual = 0;
    let auto = false;
    let pausado = false;
    let tVivo = 0;
    const tLimpiar = {};

    const vivo = (id) => capasDe(id).forEach((c) => c.classList.add('vivo'));
    const limpiar = (id) => capasDe(id).forEach((c) => c.classList.remove('vivo'));

    const mostrar = (i, { foco = false, espera = 950 } = {}) => {
      const antes = ids[actual];
      actual = (i + ids.length) % ids.length;
      const id = ids[actual];
      tabs.forEach((t, k) => {
        const si = k === actual;
        t.setAttribute('aria-selected', String(si));
        t.tabIndex = si ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', tabs[actual].id);
      if (foco) tabs[actual].focus();
      escena.querySelectorAll('.capa').forEach((c) => c.classList.toggle('on', c.dataset.n === id));
      // la pantalla que se fue vuelve a su estado inicial cuando ya no se ve, para repetir su cambio la próxima vez
      if (antes !== id) {
        clearTimeout(tLimpiar[antes]);
        tLimpiar[antes] = setTimeout(() => limpiar(antes), 480);
      }
      clearTimeout(tLimpiar[id]);
      clearTimeout(tVivo);
      if (quieto) vivo(id);
      else {
        limpiar(id);
        tVivo = setTimeout(() => vivo(id), espera);
      }
    };

    const estadoBoton = () => {
      const corre = auto && !pausado;
      escena.classList.toggle('detenido', !corre);
      pausaTxt.textContent = corre ? 'Pausar' : 'Reproducir';
      pausa.setAttribute('aria-label', corre ? 'Pausar el cambio automático de negocio' : 'Reproducir el cambio automático de negocio');
    };
    const arrancar = () => {
      auto = true;
      pausado = false;
      escena.classList.remove('auto', 'pausado');
      void escena.offsetWidth; // reinicia la barra de la pestaña activa
      escena.classList.add('auto');
      estadoBoton();
    };
    const detener = () => {
      auto = false;
      pausado = false;
      escena.classList.remove('auto', 'pausado');
      estadoBoton();
    };

    // la barra de progreso es el reloj: cuando se llena, siguiente negocio
    escena.addEventListener('animationend', (e) => {
      if (e.animationName !== 'llenar' || !auto || pausado) return;
      mostrar(actual + 1);
    });

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => {
        detener();
        mostrar(i, { espera: quieto ? 0 : 650 });
      });
      t.addEventListener('keydown', (e) => {
        let n = null;
        if (e.key === 'ArrowRight') n = i + 1;
        if (e.key === 'ArrowLeft') n = i - 1;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = ids.length - 1;
        if (n === null) return;
        e.preventDefault();
        detener();
        mostrar(n, { foco: true, espera: quieto ? 0 : 650 });
      });
    });

    pausa.addEventListener('click', () => {
      if (auto && !pausado) {
        pausado = true;
        escena.classList.add('pausado');
        estadoBoton();
      } else if (auto && pausado) {
        pausado = false;
        escena.classList.remove('pausado');
        estadoBoton();
      } else {
        arrancar();
      }
    });

    // fuera de la pantalla, el reloj espera
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => escena.classList.toggle('fuera', !en.isIntersecting), { threshold: 0.25 }).observe(escena);
    }

    if (quieto) {
      // sin movimiento: el primer negocio ya con su cambio; las pestañas cambian al tocarlas
      ids.forEach(vivo);
      detener();
    } else {
      const empezar = () => {
        mostrar(0, { espera: 1500 });
        setTimeout(arrancar, 900);
      };
      if (document.visibilityState === 'visible') empezar();
      else document.addEventListener('visibilitychange', function una() {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', una);
          empezar();
        }
      });
    }
  }
})();
