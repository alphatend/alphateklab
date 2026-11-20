// alphateklab, propuesta 20: menú, pestañas por negocio, formulario, copiar el correo y buscador de servicios.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── cabecera: línea al bajar ── */
  const cabecera = document.querySelector('[data-cabecera]');
  if (cabecera) {
    const pintar = () => cabecera.classList.toggle('con-borde', scrollY > 8);
    pintar();
    addEventListener('scroll', pintar, { passive: true });
  }

  /* ── menú del teléfono ── */
  const hamburguesa = document.querySelector('[data-hamburguesa]');
  const menuMovil = document.getElementById('menu-movil');
  const usar = (nombre) => `<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-${nombre}"></use></svg>`;
  function cerrarMenu(devolverFoco) {
    if (!hamburguesa || menuMovil.hidden) return;
    menuMovil.hidden = true;
    hamburguesa.setAttribute('aria-expanded', 'false');
    hamburguesa.setAttribute('aria-label', 'Abrir el menú');
    hamburguesa.innerHTML = usar('list');
    if (devolverFoco) hamburguesa.focus();
  }
  hamburguesa?.addEventListener('click', () => {
    if (!menuMovil.hidden) return cerrarMenu(false);
    menuMovil.hidden = false;
    hamburguesa.setAttribute('aria-expanded', 'true');
    hamburguesa.setAttribute('aria-label', 'Cerrar el menú');
    hamburguesa.innerHTML = usar('x');
  });
  menuMovil?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => cerrarMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenu(true); });
  document.addEventListener('click', (e) => {
    if (menuMovil && !menuMovil.hidden && !e.target.closest('#menu-movil, [data-hamburguesa]')) cerrarMenu(false);
  });

  /* ── pestañas por negocio ── */
  const lista = document.querySelector('[data-pestanas]');
  if (lista) {
    const pestanas = [...lista.querySelectorAll('[role="tab"]')];
    const titulo = document.querySelector('[data-ventana-titulo]');
    const enlace = document.querySelector('[data-escenario-enlace]');
    const avisos = [...document.querySelectorAll('[data-aviso]')];
    const pausa = document.querySelector('[data-pausa]');
    let actual = 0;
    let temporizadorAviso = 0;
    let temporizadorTitulo = 0;
    let automatico = !quieto;
    let pausadoPorUsuario = false;

    const mostrarAviso = (id, espera) => {
      clearTimeout(temporizadorAviso);
      avisos.forEach((a) => a.classList.remove('visible'));
      temporizadorAviso = setTimeout(() => {
        avisos.find((a) => a.dataset.aviso === id)?.classList.add('visible');
      }, espera);
    };

    const elegir = (i, { foco = false } = {}) => {
      if (i === actual) return;
      const antes = pestanas[actual];
      const ahora = pestanas[i];
      antes.setAttribute('aria-selected', 'false');
      antes.tabIndex = -1;
      ahora.setAttribute('aria-selected', 'true');
      ahora.tabIndex = 0;
      if (foco) ahora.focus();
      const panelAntes = document.getElementById(antes.getAttribute('aria-controls'));
      const panelAhora = document.getElementById(ahora.getAttribute('aria-controls'));
      panelAntes.setAttribute('aria-hidden', 'true');
      panelAntes.inert = true;
      panelAhora.setAttribute('aria-hidden', 'false');
      panelAhora.inert = false;
      // el título de la ventana cambia con un parpadeo corto
      clearTimeout(temporizadorTitulo);
      titulo.classList.add('cambia');
      temporizadorTitulo = setTimeout(() => {
        titulo.textContent = ahora.dataset.titulo;
        titulo.classList.remove('cambia');
      }, quieto ? 0 : 140);
      enlace.firstChild.textContent = ahora.dataset.enlaceTexto;
      enlace.href = ahora.dataset.enlace;
      mostrarAviso(ahora.id.replace('tab-', ''), quieto ? 0 : 700);
      actual = i;
      // en el teléfono, la pestaña elegida queda a la vista dentro de la fila
      if (lista.scrollWidth > lista.clientWidth) {
        const izq = ahora.offsetLeft - lista.offsetLeft - 16;
        lista.scrollTo({ left: izq, behavior: quieto ? 'auto' : 'smooth' });
      }
    };

    // la vuelta sola: la barrita de la pestaña marca el tiempo y, al llenarse, pasa a la siguiente
    const pintarPausa = () => {
      if (!pausa) return;
      const corre = automatico && !pausadoPorUsuario;
      pausa.innerHTML = corre ? `${usar('pausa')}<span>Pausar</span>` : `${usar('reproducir')}<span>Seguir</span>`;
      pausa.setAttribute('aria-label', corre ? 'Pausar el cambio automático de pantallas' : 'Seguir con el cambio automático de pantallas');
    };
    const detener = () => {
      automatico = false;
      lista.classList.remove('corre', 'pausada');
      pintarPausa();
    };
    lista.addEventListener('animationend', (e) => {
      if (!automatico || !e.target.classList.contains('pestana__barra')) return;
      elegir((actual + 1) % pestanas.length);
    });

    pestanas.forEach((p, i) => {
      p.addEventListener('click', () => {
        detener();
        elegir(i);
      });
      p.addEventListener('keydown', (e) => {
        const teclas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let destino = null;
        if (e.key in teclas) destino = (actual + teclas[e.key] + pestanas.length) % pestanas.length;
        if (e.key === 'Home') destino = 0;
        if (e.key === 'End') destino = pestanas.length - 1;
        if (destino === null) return;
        e.preventDefault();
        detener();
        elegir(destino, { foco: true });
      });
    });

    if (!quieto) {
      // fuera de la vista o con el puntero encima de la pantalla, la vuelta espera
      let visible = true;
      let encima = false;
      const aplicar = () => lista.classList.toggle('pausada', pausadoPorUsuario || !visible || encima);
      const escenario = document.querySelector('.escenario');
      lista.classList.add('corre');
      pausa.hidden = false;
      pintarPausa();
      pausa.addEventListener('click', () => {
        if (!automatico) {
          automatico = true;
          pausadoPorUsuario = false;
          lista.classList.remove('corre');
          void lista.offsetWidth; // reinicia la barrita de la pestaña actual
          lista.classList.add('corre');
        } else {
          pausadoPorUsuario = !pausadoPorUsuario;
        }
        aplicar();
        pintarPausa();
      });
      escenario?.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { encima = true; aplicar(); } });
      escenario?.addEventListener('pointerleave', () => { encima = false; aplicar(); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([en]) => { visible = en.isIntersecting; aplicar(); }, { threshold: 0.25 }).observe(escenario);
      }
    }
    mostrarAviso(pestanas[0].id.replace('tab-', ''), quieto ? 0 : 1100);
  }

  /* ── formulario: no se envía; dice a dónde llega el mensaje ── */
  document.querySelectorAll('[data-formulario]').forEach((form) => {
    const texto = form.querySelector('textarea');
    const nota = form.querySelector('[data-nota]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!texto.value.trim()) {
        texto.setAttribute('aria-invalid', 'true');
        nota.classList.add('error');
        nota.innerHTML = `${usar('chat-circle-dots')}<span>Escribe en pocas palabras qué necesitas y te mandamos la propuesta.</span>`;
        texto.focus();
        return;
      }
      texto.removeAttribute('aria-invalid');
      nota.classList.remove('error');
      nota.innerHTML = `${usar('check-circle')}<span>Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.</span>`;
    });
    texto.addEventListener('input', () => {
      if (texto.getAttribute('aria-invalid') === 'true' && texto.value.trim()) {
        texto.removeAttribute('aria-invalid');
        nota.classList.remove('error');
        nota.textContent = '';
      }
    });
  });

  /* ── copiar el correo (con selección del texto si el portapapeles no deja) ── */
  document.querySelectorAll('[data-copiar]').forEach((b) =>
    b.addEventListener('click', () => {
      const correo = b.parentElement.querySelector('[data-correo]');
      const etiqueta = b.querySelector('span');
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
  const buscador = document.querySelector('[data-buscador]');
  const datos = document.getElementById('datos-servicios');
  if (buscador && datos) {
    const servicios = JSON.parse(datos.textContent);
    const campo = buscador.querySelector('input');
    const salida = buscador.querySelector('[data-resultados]');
    const limpiar = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const vacias = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'que', 'mi', 'mis', 'un', 'una', 'con', 'por', 'para', 'del', 'al', 'se', 'lo', 'quiero', 'necesito']);
    const indice = servicios.map((s) => ({ ...s, n2: limpiar(s.n), d2: limpiar(s.d) }));
    const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    buscador.addEventListener('submit', (e) => e.preventDefault());
    campo.addEventListener('input', () => {
      const palabras = limpiar(campo.value).split(/[^a-z0-9ñ]+/).filter((p) => p.length > 1 && !vacias.has(p));
      if (!palabras.length) {
        salida.hidden = true;
        salida.innerHTML = '';
        return;
      }
      const puntaje = (s) => palabras.reduce((t, p) => {
        const raiz = p.length > 5 ? p.slice(0, p.length - 2) : p;
        return t + (s.n2.includes(raiz) ? 3 : 0) + (s.d2.includes(raiz) ? 1 : 0);
      }, 0);
      const hallados = indice.map((s) => [puntaje(s), s]).filter(([p]) => p > 0).sort((a, b) => b[0] - a[0]).slice(0, 8);
      salida.hidden = false;
      salida.innerHTML = hallados.length
        ? hallados.map(([, s]) => `<a href="${s.h}"><strong>${esc(s.n)}</strong><small>${esc(s.d)}</small></a>`).join('')
        : '<p>No lo encontramos en la lista. Cuéntanos qué necesitas en el <a class="enlace" href="#pedir">formulario de abajo</a> y te decimos si lo podemos hacer.</p>';
    });
  }
})();
