/* p24 · Cielo amable — comportamiento del sitio */
(() => {
  const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══ cabecera: borde al bajar y menú del celular ═══ */
  const cabecera = document.querySelector('.cabecera');
  const marcarBorde = () => cabecera?.classList.toggle('con-borde', window.scrollY > 8);
  marcarBorde();
  window.addEventListener('scroll', marcarBorde, { passive: true });

  const menuBoton = document.querySelector('.menu-boton');
  menuBoton?.addEventListener('click', () => {
    const abierto = cabecera.classList.toggle('abierta');
    menuBoton.setAttribute('aria-expanded', String(abierto));
    menuBoton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  });
  document.querySelectorAll('.menu-movil a').forEach((a) =>
    a.addEventListener('click', () => {
      cabecera.classList.remove('abierta');
      menuBoton?.setAttribute('aria-expanded', 'false');
    }),
  );

  /* ═══ formulario «Pedir mi propuesta» ═══ */
  document.querySelectorAll('[data-pregunta]').forEach((form) => {
    const nota = form.querySelector('[data-pregunta-nota]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      nota.textContent = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
    });
  });

  // copiar el correo de contacto (dentro del Artifact, un enlace mailto: no siempre abre el correo)
  document.querySelectorAll('[data-copiar]').forEach((b) =>
    b.addEventListener('click', () => {
      const correo = b.parentElement.querySelector('[data-correo]');
      const listo = () => {
        b.textContent = 'Copiado';
        setTimeout(() => (b.textContent = 'Copiar'), 1800);
      };
      navigator.clipboard?.writeText(correo.textContent.trim()).then(listo, () => {
        const r = document.createRange();
        r.selectNodeContents(correo);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      });
    }),
  );

  /* ═══ el teléfono de la portada: llegan los avisos ═══ */
  const lista = document.querySelector('[data-avisos]');
  if (lista) {
    const ICONOS = {
      cita: 'i-calendar-check',
      pago: 'i-currency-circle-dollar',
      aviso: 'i-bell-ringing',
      resumen: 'i-chart-line-up',
    };
    const AVISOS = [
      { tipo: 'cita', app: 'Agenda', hora: 'ahora', titulo: 'Laura confirmó su cita', texto: 'Mañana a las 10:30 a. m., limpieza facial.', ok: true },
      { tipo: 'pago', app: 'Cobros', hora: 'ahora', titulo: 'Pago recibido: B/.\u00a035.00', texto: 'Depósito de la cita de las 3:00 p. m.' },
      { tipo: 'aviso', app: 'Agenda', hora: 'ahora', titulo: 'Recordatorios enviados', texto: 'Las 6 clientas de mañana ya lo tienen.' },
      { tipo: 'cita', app: 'Agenda', hora: 'ahora', titulo: 'Nueva cita en línea', texto: 'Sofía reservó el jueves a las 4:00 p. m.' },
      { tipo: 'resumen', app: 'Resumen', hora: 'ahora', titulo: 'Tu día de hoy', texto: '8 citas y 2 espacios libres en la tarde.' },
      { tipo: 'cita', app: 'Agenda', hora: 'ahora', titulo: 'Andrea movió su cita', texto: 'Pasó del martes al miércoles, 9:00 a. m.', ok: true },
    ];
    const MAX = 3;
    const crear = (a) => {
      const li = document.createElement('li');
      li.className = 'aviso';
      li.innerHTML = `<span class="aviso__ico${a.ok ? ' aviso__ico--ok' : ''}"><svg class="ico" aria-hidden="true"><use href="#${ICONOS[a.tipo]}"></use></svg></span>
        <span><span class="aviso__cabeza"><b>${a.app}</b><span data-hora>${a.hora}</span></span>
        <span class="aviso__titulo">${a.titulo}</span>
        <span class="aviso__texto">${a.texto.replace(/ ([ap])\. m\./g, '\u00a0$1.\u00a0m.')}</span></span>`;
      return li;
    };
    const envejecer = () => {
      // los avisos anteriores dejan de decir «ahora»
      [...lista.children].forEach((li, i) => {
        const h = li.querySelector('[data-hora]');
        if (h && i > 0 && h.textContent === 'ahora') h.textContent = `${i * 3} min`;
        else if (h && i > 0 && /min$/.test(h.textContent)) h.textContent = `${parseInt(h.textContent, 10) + 3} min`;
      });
    };
    const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
    let i = 0;
    const llega = () => {
      const antes = new Map([...lista.children].map((el) => [el, el.getBoundingClientRect().top]));
      const nuevo = crear(AVISOS[i % AVISOS.length]);
      i += 1;
      lista.prepend(nuevo);
      envejecer();
      antes.forEach((top, el) => {
        const d = top - el.getBoundingClientRect().top;
        if (d) el.animate([{ transform: `translateY(${d}px)` }, { transform: 'translateY(0)' }], { duration: 520, easing: EASE });
      });
      nuevo.animate(
        [
          { opacity: 0, transform: 'translateY(-12px) scale(0.97)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 520, easing: EASE },
      );
      while (lista.children.length > MAX + 1) lista.lastElementChild.remove();
      const sobra = lista.children[MAX];
      if (sobra) sobra.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' }).finished.then(() => sobra.remove()).catch(() => {});
    };

    if (!menosMovimiento && 'animate' in Element.prototype) {
      // la escena: el teléfono empieza vacío y los avisos llegan uno por uno
      lista.innerHTML = '';
      let timer = null;
      let visible = true;
      const siguiente = (ms) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (visible && !document.hidden) llega();
          siguiente(4400);
        }, ms);
      };
      setTimeout(llega, 1000);
      setTimeout(llega, 1700);
      setTimeout(() => {
        llega();
        siguiente(4400);
      }, 2400);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(lista);
      }
      i = 0;
    }
  }

  /* ═══ buscador de servicios ═══ */
  const buscador = document.querySelector('[data-buscador]');
  if (buscador) {
    const datos = JSON.parse(document.getElementById('datos-servicios').textContent);
    const campo = buscador.querySelector('input');
    const estado = buscador.querySelector('[data-estado]');
    const salida = buscador.querySelector('[data-resultados]');
    const limpio = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const indice = datos.map((s) => ({ ...s, q: limpio(`${s.n} ${s.d} ${s.t.join(' ')}`) }));
    buscador.addEventListener('submit', (e) => e.preventDefault());
    campo.addEventListener('input', () => {
      const palabras = limpio(campo.value).split(/\s+/).filter((p) => p.length > 1);
      salida.innerHTML = '';
      if (!palabras.length) {
        estado.textContent = '';
        return;
      }
      const hallados = indice.filter((s) => palabras.every((p) => s.q.includes(p)));
      estado.textContent = hallados.length
        ? `${hallados.length} ${hallados.length === 1 ? 'servicio' : 'servicios'} con «${campo.value.trim()}»`
        : 'No está en la lista con esas palabras. Escríbenos abajo: te decimos si lo podemos hacer.';
      hallados.slice(0, 8).forEach((s) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = s.u;
        a.innerHTML = `<span></span><small></small>`;
        a.firstChild.textContent = s.n;
        a.lastChild.textContent = s.t[0];
        li.append(a);
        salida.append(li);
      });
    });
  }
})();
