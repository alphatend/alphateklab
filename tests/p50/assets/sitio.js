// alphateklab, propuesta 50: menú, formulario, copiar el correo, pestañas, buscador, la tira de negocios y el contador.
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

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, como en el sitio en vivo. Sin JavaScript,
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
  form?.addEventListener('invalid', (e) => {
    e.target.setAttribute('aria-invalid', 'true');
    avisar(queFalta(), true);
  }, true);
  form?.addEventListener('input', (e) => {
    if (e.target.validity?.valid) e.target.removeAttribute('aria-invalid');
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
  // botones que bajan al formulario con el mensaje ya escrito (paquetes)
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
        small.textContent = s.tipo;
        span.append(small);
        a.append(span);
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

  /* ── botón de pausa genérico ── */
  const ponerPausa = (boton, pausado) => {
    boton.setAttribute('aria-pressed', String(pausado));
    boton.querySelector('span').textContent = pausado ? 'Reproducir' : 'Pausar';
  };
  const mirar = (el, fn) => {
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver((e) => fn(e[0].isIntersecting), { rootMargin: '80px' }).observe(el);
  };

  /* ── la tira de negocios: avanza sola, se pausa con el botón o fuera de pantalla ── */
  const tira = document.querySelector('[data-tira]');
  const bTira = document.querySelector('[data-pausa-tira]');
  if (tira && bTira && !quieto) {
    bTira.addEventListener('click', () => {
      const p = !tira.classList.contains('pausada');
      tira.classList.toggle('pausada', p);
      ponerPausa(bTira, p);
    });
    mirar(tira, (si) => tira.classList.toggle('fuera', !si));
  }

  /* ── el contador de personas: cada pocos segundos entra alguien ── */
  const cont = document.querySelector('[data-contador]');
  if (cont) {
    const hoy = cont.querySelector('[data-c-hoy]');
    const adentro = cont.querySelector('[data-c-adentro]');
    const fila = cont.querySelector('[data-c-fila]');
    const barra = cont.querySelector('[data-ahora]');
    const bCont = cont.querySelector('[data-pausa-contador]');
    let n = 214, dentro = 18, f = 2, h = 0.3, k = 0, timer = 0, usuario = false, visible = false;
    const rodar = (rueda, valor) => {
      const viejo = rueda.lastElementChild;
      const nuevo = document.createElement('span');
      nuevo.textContent = valor;
      rueda.append(nuevo);
      if (!viejo) return;
      nuevo.animate([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      viejo.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-60%)', opacity: 0 }], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }).onfinish = () => viejo.remove();
    };
    const paso = () => {
      k++;
      const entra = k % 4 !== 0; // de vez en cuando alguien sale
      if (entra) {
        n++; dentro++; h = Math.min(0.95, h + 0.035);
        rodar(hoy, String(n));
        barra.style.setProperty('--h', h.toFixed(3));
      } else {
        dentro--;
      }
      rodar(adentro, String(dentro));
      if (k % 3 === 0) { f = f === 2 ? 3 : 2; rodar(fila, String(f)); }
    };
    const activo = () => !quieto && !usuario && visible && document.visibilityState === 'visible';
    const correr = () => {
      clearInterval(timer);
      cont.classList.toggle('corre', activo());
      if (activo()) timer = setInterval(paso, 2600);
    };
    if (quieto) bCont?.remove();
    bCont?.addEventListener('click', () => {
      usuario = !usuario;
      ponerPausa(bCont, usuario);
      correr();
    });
    mirar(cont, (si) => { visible = si; correr(); });
    document.addEventListener('visibilitychange', correr);
  }
})();
