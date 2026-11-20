/* alphateklab, propuesta 25: lo que comparten las cinco páginas. */
(() => {
  /* ─── La cabecera: transparente sobre la tinta, oscura al bajar, blanca al salir de la banda ─── */
  const cab = document.querySelector('.cab');
  const banda = document.querySelector('[data-banda]');
  if (cab && banda) {
    const actualizar = () => {
      const fondo = banda.getBoundingClientRect().bottom;
      const alto = cab.offsetHeight;
      const clara = fondo <= alto + 4;
      cab.classList.toggle('es-clara', clara);
      cab.classList.toggle('es-oscura-fija', !clara && window.scrollY > 8);
    };
    actualizar();
    window.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
  }

  /* ─── Menú del teléfono ─── */
  const botonMenu = document.querySelector('.cab__menu');
  const menu = document.getElementById('menu-movil');
  const cerrarMenu = () => {
    if (!menu || !botonMenu) return;
    menu.classList.remove('abierto');
    botonMenu.setAttribute('aria-expanded', 'false');
    botonMenu.setAttribute('aria-label', 'Abrir el menú');
  };
  botonMenu?.addEventListener('click', () => {
    const abrir = !menu.classList.contains('abierto');
    menu.classList.toggle('abierto', abrir);
    botonMenu.setAttribute('aria-expanded', String(abrir));
    botonMenu.setAttribute('aria-label', abrir ? 'Cerrar el menú' : 'Abrir el menú');
    if (abrir) cab.classList.add('es-clara');
    else window.dispatchEvent(new Event('scroll'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu?.classList.contains('abierto')) {
      cerrarMenu();
      botonMenu.focus();
      window.dispatchEvent(new Event('scroll'));
    }
  });
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', cerrarMenu));

  /* ─── Botones que bajan al formulario con el mensaje ya escrito ─── */
  const form = document.querySelector('[data-pregunta]');
  const texto = form?.querySelector('textarea');
  const nota = form?.querySelector('[data-pregunta-nota]');
  document.querySelectorAll('[data-mensaje]').forEach((a) =>
    a.addEventListener('click', () => {
      if (texto && !texto.value.trim()) texto.value = `${a.dataset.mensaje} `;
    }),
  );
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!nota) return;
    nota.hidden = false;
    nota.textContent = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
  });

  /* ─── Copiar el correo (con selección del texto si el portapapeles no deja) ─── */
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

  /* ─── Pestañas (negocios en la portada, demos): con teclado cambian sin animación ─── */
  document.querySelectorAll('[data-pestanas]').forEach((grupo) => {
    const botones = [...grupo.querySelectorAll('[role="tab"]')];
    const paneles = botones.map((b) => document.getElementById(b.getAttribute('aria-controls')));
    const caja = paneles[0]?.parentElement;
    const elegir = (i, conTeclado) => {
      if (caja) caja.classList.toggle('sin-transicion', !!conTeclado);
      botones.forEach((b, j) => {
        const si = i === j;
        b.setAttribute('aria-selected', String(si));
        b.tabIndex = si ? 0 : -1;
        paneles[j].classList.toggle('activo', si);
        paneles[j].setAttribute('aria-hidden', String(!si));
      });
      if (grupo.scrollWidth > grupo.clientWidth + 2) botones[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const img = paneles[i].querySelector('img[loading="lazy"]');
      if (img) img.loading = 'eager';
    };
    botones.forEach((b, i) => {
      b.addEventListener('click', () => elegir(i, false));
      b.addEventListener('keydown', (e) => {
        const vertical = grupo.getAttribute('aria-orientation') === 'vertical';
        const sig = vertical ? ['ArrowDown', 'ArrowRight'] : ['ArrowRight', 'ArrowDown'];
        const ant = vertical ? ['ArrowUp', 'ArrowLeft'] : ['ArrowLeft', 'ArrowUp'];
        let n = -1;
        if (sig.includes(e.key)) n = (i + 1) % botones.length;
        if (ant.includes(e.key)) n = (i - 1 + botones.length) % botones.length;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = botones.length - 1;
        if (n < 0) return;
        e.preventDefault();
        botones[n].focus();
        elegir(n, true);
      });
    });
  });

  /* ─── Índice de servicios: marca el tipo que se está leyendo ─── */
  const indice = document.querySelector('[data-indice]');
  if (indice) {
    const enlaces = [...indice.querySelectorAll('a')];
    const secciones = enlaces.map((a) => document.querySelector(a.getAttribute('href')));
    const marcar = () => {
      const linea = window.innerHeight * 0.3;
      let actual = 0;
      secciones.forEach((s, i) => {
        if (s && s.getBoundingClientRect().top <= linea) actual = i;
      });
      enlaces.forEach((a, i) => a.classList.toggle('activo', i === actual));
    };
    marcar();
    window.addEventListener('scroll', marcar, { passive: true });
  }
})();
