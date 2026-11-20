/* alphateklab, propuesta 11. Sin dependencias. */
(() => {
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── la cabecera gana su filete al bajar ── */
  const cabecera = document.querySelector('.cabecera');
  const marcar = () => cabecera?.classList.toggle('con-borde', window.scrollY > 8);
  marcar();
  window.addEventListener('scroll', marcar, { passive: true });

  /* ── menú del teléfono ── */
  const boton = document.querySelector('.menu-boton');
  const panel = document.getElementById('menu-movil');
  const cerrar = () => {
    if (!boton || !panel) return;
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-label', 'Abrir el menú');
    panel.hidden = true;
  };
  boton?.addEventListener('click', () => {
    const abierto = boton.getAttribute('aria-expanded') === 'true';
    if (abierto) return cerrar();
    boton.setAttribute('aria-expanded', 'true');
    boton.setAttribute('aria-label', 'Cerrar el menú');
    panel.hidden = false;
  });
  panel?.querySelectorAll('a').forEach((a) => a.addEventListener('click', cerrar));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && boton?.getAttribute('aria-expanded') === 'true') { cerrar(); boton.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (!panel || panel.hidden) return;
    if (!panel.contains(e.target) && !boton.contains(e.target)) cerrar();
  });

  /* ── el formulario: no se envía; dice a dónde llega ── */
  document.querySelectorAll('[data-formulario]').forEach((form) => {
    const nota = form.querySelector('[data-nota]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      nota.textContent = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
    });
  });

  /* ── copiar el correo (con la selección del texto si el portapapeles no deja) ── */
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

  /* ── el héroe: entra una comanda nueva y su aviso llega al teléfono ── */
  const escena = document.querySelector('[data-escena]');
  if (escena) {
    const pedidos = [
      { mesa: 'Mesa 4', items: [['2', 'Patacones'], ['1', 'Chicha de piña']], nota: '', aviso: '2 patacones y 1 chicha' },
      { mesa: 'Mesa 9', items: [['1', 'Sancocho de gallina'], ['2', 'Hojaldras (2)']], nota: 'Para compartir', aviso: '1 sancocho y 2 hojaldras' },
      { mesa: 'Para llevar 21', items: [['3', 'Carimañolas (3)'], ['1', 'Tamal de olla']], nota: 'Retira a las 12:55', aviso: '3 carimañolas y 1 tamal, para llevar' },
    ];
    const tarjeta = escena.querySelector('[data-comanda-nueva]');
    const aviso = escena.querySelector('[data-aviso-nuevo]');
    let i = 0;
    let reloj = null;
    let visible = true;
    let cambios = 0; // pasa por los tres pedidos una vez y se queda quieto (nada se mueve sin fin)

    const pintar = (p) => {
      tarjeta.querySelector('[data-mesa]').textContent = p.mesa;
      tarjeta.querySelector('ul').innerHTML = p.items.map(([n, t]) => `<li><b>${n}</b>${t}</li>`).join('');
      const nota = tarjeta.querySelector('[data-nota-comanda]');
      nota.textContent = p.nota;
      nota.hidden = !p.nota;
      aviso.querySelector('[data-aviso-titulo]').textContent = `${p.mesa} hizo un pedido`;
      aviso.querySelector('[data-aviso-texto]').textContent = p.aviso;
    };
    const llegar = (el) => {
      el.classList.remove('llega', 'se-va');
      void el.offsetWidth;
      el.classList.add('llega');
    };
    const siguiente = () => {
      cambios += 1;
      if (cambios >= pedidos.length - 1) parar();
      i = (i + 1) % pedidos.length;
      tarjeta.classList.add('se-va');
      aviso.classList.add('se-va');
      setTimeout(() => {
        pintar(pedidos[i]);
        llegar(tarjeta);
        setTimeout(() => llegar(aviso), 160);
      }, 230);
    };
    const arrancar = () => {
      if (reloj || reducir.matches || !visible || document.hidden || cambios >= pedidos.length - 1) return;
      reloj = setInterval(siguiente, 6500);
    };
    const parar = () => { clearInterval(reloj); reloj = null; };

    // la primera llegada, cuando ya entró la escena
    if (!reducir.matches) {
      tarjeta.style.opacity = '0';
      aviso.style.opacity = '0';
      setTimeout(() => {
        tarjeta.style.opacity = '';
        aviso.style.opacity = '';
        llegar(tarjeta);
        setTimeout(() => llegar(aviso), 180);
      }, 1250);
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? arrancar() : parar(); }, { threshold: 0.2 }).observe(escena);
    document.addEventListener('visibilitychange', () => (document.hidden ? parar() : arrancar()));
    reducir.addEventListener?.('change', () => (reducir.matches ? parar() : arrancar()));
    setTimeout(arrancar, 1600);
  }

  /* ── la respuesta del paciente aparece cuando se ve la fila ── */
  const esperas = document.querySelectorAll('.burbuja--espera');
  if (esperas.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        setTimeout(() => e.target.classList.add('visto'), reducir.matches ? 0 : 500);
        io.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    esperas.forEach((b) => io.observe(b));
  } else {
    esperas.forEach((b) => b.classList.add('visto'));
  }

  /* ── el índice pegajoso marca la parte que se está leyendo ── */
  const enlaces = [...document.querySelectorAll('[data-indice] a[href^="#"]')];
  if (enlaces.length) {
    const partes = enlaces.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const marcarActivo = (id) => {
      enlaces.forEach((a) => {
        const si = a.getAttribute('href') === `#${id}`;
        a.classList.toggle('activo', si);
        if (si) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        if (si && a.parentElement.scrollWidth > a.parentElement.clientWidth) {
          a.parentElement.scrollTo({ left: a.offsetLeft - 16, behavior: reducir.matches ? 'auto' : 'smooth' });
        }
      });
    };
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => { if (e.isIntersecting) marcarActivo(e.target.id); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    partes.forEach((p) => io.observe(p));
    // por encima del primer tipo no hay ninguno marcado
    window.addEventListener('scroll', () => {
      if (partes[0].getBoundingClientRect().top > window.innerHeight * 0.3) {
        marcarActivo('');
        enlaces[0].parentElement.scrollLeft = 0;
      }
    }, { passive: true });
  }
})();
