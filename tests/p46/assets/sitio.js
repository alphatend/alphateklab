// alphateklab, propuesta 46: menú, formulario, copiar el correo, pestañas, buscador, índice que sigue la lectura,
// la franja de negocios y la vitrina de demos. El formulario y el copiar salen del sitio en vivo (assets/web/sitio.js).
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── menú del celular ── */
  const cabecera = document.querySelector('.cab');
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

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, como en el sitio en vivo.
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
  form?.addEventListener('invalid', () => {
    form.classList.add('revisar');
    avisar(queFalta(), true);
  }, true);
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
      form.classList.remove('revisar');
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
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      } else {
        seleccionar();
      }
    }),
  );

  /* ── pestañas: flechas, Inicio y Fin. Avisan con el evento «cambio» (detail.usuario = lo tocó una persona). ── */
  document.querySelectorAll('[role="tablist"]').forEach((lista) => {
    const tabs = [...lista.querySelectorAll('[role="tab"]')];
    const paneles = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
    paneles.forEach((p, i) => p && (p.hidden = i !== 0));
    const elegir = (tab, { enfocar = false, usuario = false } = {}) => {
      tabs.forEach((t, i) => {
        const si = t === tab;
        t.setAttribute('aria-selected', String(si));
        t.tabIndex = si ? 0 : -1;
        if (paneles[i]) paneles[i].hidden = !si;
      });
      if (enfocar) tab.focus();
      lista.dispatchEvent(new CustomEvent('cambio', { detail: { tab, indice: tabs.indexOf(tab), usuario } }));
    };
    lista.elegir = elegir;
    lista.pestanas = tabs;
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => elegir(t, { usuario: true }));
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
          elegir(n, { enfocar: true, usuario: true });
        }
      });
    });
  });

  /* ── negocios: la pestaña sigue el ancla (negocios.html#tiendas) ── */
  const negTabs = document.querySelector('.neg-tabs');
  if (negTabs?.elegir) {
    const porAncla = (desplazar) => {
      const id = decodeURIComponent(location.hash.slice(1));
      const tab = negTabs.pestanas.find((t) => t.getAttribute('aria-controls') === id);
      if (!tab) return;
      negTabs.elegir(tab);
      if (desplazar) requestAnimationFrame(() => negTabs.scrollIntoView({ block: 'start', behavior: quieto ? 'auto' : 'smooth' }));
    };
    porAncla(true);
    addEventListener('hashchange', () => porAncla(true));
    negTabs.addEventListener('cambio', (e) => {
      if (e.detail.usuario) history.replaceState(null, '', `#${e.detail.tab.getAttribute('aria-controls')}`);
    });
  }

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
    const flecha = '<svg class="ico" aria-hidden="true" focusable="false"><use href="assets/iconos.svg#i-arrow-up-right"/></svg>';
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
        small.textContent = s.tipo;
        span.append(small);
        a.append(span);
        a.insertAdjacentHTML('beforeend', flecha);
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
    });
    vacio.querySelector('a')?.addEventListener('click', () => {
      if (texto && !texto.value.trim()) texto.value = `Necesito ${entrada.value.trim()}. `;
    });
  }

  /* ── índice de servicios: marca el tipo que estás leyendo ── */
  const espias = document.querySelectorAll('[data-espia]');
  if (espias.length && 'IntersectionObserver' in window) {
    const porId = new Map([...espias].map((a) => [a.dataset.espia, a]));
    const io = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((en) => {
          if (!en.isIntersecting) return;
          espias.forEach((a) => a.classList.remove('activo'));
          porId.get(en.target.id)?.classList.add('activo');
        }),
      { rootMargin: '-35% 0px -60% 0px' },
    );
    porId.forEach((_, id) => {
      const s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  /* ── helper del botón Pausar / Reproducir ── */
  const marcarBoton = (b, pausado) => {
    if (!b) return;
    b.dataset.estado = pausado ? 'pausado' : '';
    b.querySelector('span').textContent = pausado ? 'Reproducir' : 'Pausar';
  };

  /* ── franja de negocios: se mueve sola; se pausa con el botón, al pasar el ratón y fuera de pantalla ── */
  const franja = document.querySelector('[data-franja]');
  const bFranja = document.querySelector('[data-pausa-franja]');
  if (franja) {
    bFranja?.addEventListener('click', () => marcarBoton(bFranja, franja.classList.toggle('quieta')));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => franja.classList.toggle('fuera', !e[0].isIntersecting)).observe(franja);
    }
  }

  /* ── vitrina de demos: avanza sola cada 6 s con una barra de progreso ── */
  const vitrina = document.querySelector('[data-vitrina]');
  if (vitrina) {
    const tablist = vitrina.querySelector('[role="tablist"]');
    const bVit = vitrina.querySelector('[data-pausa-vitrina]');
    const DUR = 6000;
    let barra = null;
    let pausado = quieto;
    let enPantalla = true;
    const correr = () => {
      if (!barra) return;
      if (!pausado && enPantalla && !document.hidden) barra.play();
      else barra.pause();
    };
    const arrancar = (indice) => {
      barra?.cancel();
      barra = null;
      if (quieto || !tablist?.pestanas) return;
      const el = tablist.pestanas[indice].querySelector('.demo-op__barra');
      if (!el?.animate) return;
      barra = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DUR, easing: 'linear', fill: 'forwards' });
      barra.onfinish = () => {
        const sig = tablist.pestanas[(indice + 1) % tablist.pestanas.length];
        tablist.elegir(sig);
      };
      correr();
    };
    tablist?.addEventListener('cambio', (e) => {
      if (e.detail.usuario && !pausado) {
        pausado = true;
        marcarBoton(bVit, true);
      }
      arrancar(e.detail.indice);
    });
    bVit?.addEventListener('click', () => {
      pausado = !pausado;
      marcarBoton(bVit, pausado);
      if (!barra) {
        const actual = tablist.pestanas.findIndex((t) => t.getAttribute('aria-selected') === 'true');
        arrancar(Math.max(0, actual));
      } else correr();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => {
        enPantalla = e[0].isIntersecting;
        correr();
      }).observe(vitrina);
    }
    document.addEventListener('visibilitychange', correr);
    arrancar(0);
  }
})();
