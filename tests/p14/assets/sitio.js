/* alphateklab, propuesta 14: menú, formulario, copiar el correo y las pantallas que se mueven. */
(() => {
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* cabecera: filete al bajar */
  const cabecera = document.querySelector('.cabecera');
  if (cabecera) {
    const marcar = () => cabecera.classList.toggle('con-borde', window.scrollY > 8);
    marcar();
    window.addEventListener('scroll', marcar, { passive: true });
  }

  /* menú del teléfono */
  const abrir = document.querySelector('[data-menu-abrir]');
  const movil = document.getElementById('menu-movil');
  if (abrir && movil) {
    const cerrar = () => {
      movil.hidden = true;
      abrir.setAttribute('aria-expanded', 'false');
      abrir.querySelector('span').textContent = 'Menú';
    };
    abrir.addEventListener('click', () => {
      const abierto = abrir.getAttribute('aria-expanded') === 'true';
      if (abierto) return cerrar();
      movil.hidden = false;
      abrir.setAttribute('aria-expanded', 'true');
      abrir.querySelector('span').textContent = 'Cerrar';
    });
    movil.addEventListener('click', (e) => { if (e.target.closest('a')) cerrar(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !movil.hidden) { cerrar(); abrir.focus(); } });
    window.matchMedia('(min-width: 981px)').addEventListener('change', (m) => { if (m.matches) cerrar(); });
  }

  /* formulario: no se envía; dice a dónde llega */
  document.querySelectorAll('[data-pregunta]').forEach((form) => {
    const nota = form.querySelector('[data-pregunta-nota]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      nota.textContent = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
      nota.classList.add('enviado');
    });
  });

  /* copiar el correo (con selección de texto si el portapapeles no deja) */
  document.querySelectorAll('[data-copiar]').forEach((b) =>
    b.addEventListener('click', () => {
      const correo = b.parentElement.querySelector('[data-correo]');
      const listo = () => {
        b.textContent = 'Copiado';
        setTimeout(() => (b.textContent = 'Copiar'), 1800);
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

  /* corre solo mientras se ve y la pestaña está abierta */
  const mientrasSeVe = (el, iniciar, parar) => {
    let visible = false;
    const revisar = () => (visible && !document.hidden ? iniciar() : parar());
    new IntersectionObserver((entradas) => {
      visible = entradas[0].isIntersecting;
      revisar();
    }, { threshold: 0.25 }).observe(el);
    document.addEventListener('visibilitychange', revisar);
  };

  /* avisos que llegan al teléfono del héroe (datos simulados) */
  const lista = document.querySelector('[data-avisos]');
  if (lista && !reducir.matches) {
    // en este orden nunca se repite uno que todavía se ve
    const nuevos = [
      { icono: 'campana', app: 'Salón', titulo: 'Mesa 9 llama al mesero', texto: 'Necesita ayuda en la mesa' },
      { icono: 'mesa', app: 'Salón', titulo: 'Mesa 2 pidió', texto: '1 sancocho y 2 limonadas' },
      { icono: 'cuenta', app: 'Caja', titulo: 'Mesa 5 pagó', texto: 'B/. 54.20 con la propina que eligió' },
      { icono: 'mesa', app: 'Salón', titulo: 'Mesa 11 pidió', texto: '3 hojaldras y 1 café' },
      { icono: 'mesa', app: 'Salón', titulo: 'Mesa 4 pidió', texto: '2 patacones y 1 chicha' },
      { icono: 'cuenta', app: 'Caja', titulo: 'Mesa 7 pidió la cuenta', texto: 'Total B/. 38.75' },
      { icono: 'nevera', app: 'Cocina', titulo: 'La nevera 2 subió a 8.9 °C', texto: 'Revisa la puerta de la nevera', tono: 'ambar' },
      { icono: 'resumen', app: 'Resumen', titulo: 'Resumen de ayer', texto: 'B/. 612.40 en ventas', tono: 'grafito' },
    ];
    const tiempos = ['ahora', 'hace 1 min', 'hace 4 min', 'hace 9 min'];
    const plantilla = document.getElementById('plantilla-aviso');
    const iconos = {};
    document.querySelectorAll('[data-icono]').forEach((s) => (iconos[s.dataset.icono] = s.innerHTML));
    let i = 0;
    let reloj = null;

    const crear = (d) => {
      const li = plantilla.content.firstElementChild.cloneNode(true);
      const ico = li.querySelector('.aviso__icono');
      ico.innerHTML = iconos[d.icono] || '';
      if (d.tono) ico.classList.add('aviso__icono--' + d.tono);
      li.querySelector('[data-app]').textContent = d.app;
      li.querySelector('[data-titulo]').textContent = d.titulo;
      li.querySelector('[data-texto]').textContent = d.texto;
      return li;
    };

    const rotular = () => lista.querySelectorAll('.aviso:not(.sale)').forEach((li, n) => {
      const t = li.querySelector('[data-hora]');
      if (t) t.textContent = tiempos[n] || '';
    });

    const llega = () => {
      const antes = new Map();
      lista.querySelectorAll('.aviso').forEach((li) => antes.set(li, li.getBoundingClientRect().top));
      const li = crear(nuevos[i % nuevos.length]);
      i += 1;
      li.classList.add('entra');
      lista.prepend(li);
      const vivos = lista.querySelectorAll('.aviso:not(.sale)');
      if (vivos.length > 4) {
        const ultimo = vivos[vivos.length - 1];
        ultimo.classList.add('sale');
        ultimo.addEventListener('animationend', () => ultimo.remove(), { once: true });
      }
      rotular();
      // los de abajo bajan a su lugar (FLIP)
      antes.forEach((top, el) => {
        const dy = top - el.getBoundingClientRect().top;
        if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 520, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      });
    };

    mientrasSeVe(
      lista,
      () => { if (!reloj) reloj = setInterval(llega, 3400); },
      () => { clearInterval(reloj); reloj = null; },
    );
  }

  /* inventario: el aceite baja del mínimo y sale el aviso (datos simulados) */
  const inv = document.querySelector('[data-inventario]');
  if (inv && !reducir.matches) {
    const cant = inv.querySelector('[data-cant]');
    const fila = cant.closest('tr');
    const estado = fila.querySelector('.estado');
    const aviso = inv.querySelector('.inv__aviso');
    const pasos = [14, 13, 12, 11];
    let p = 0;
    let reloj = null;
    const tic = () => {
      p = (p + 1) % (pasos.length + 2);
      const n = pasos[Math.min(p, pasos.length - 1)];
      if (p === 0) {
        aviso.classList.remove('visible');
        estado.className = 'estado estado--bien';
        estado.textContent = 'Bien';
      }
      cant.textContent = n;
      if (p > 0 && p < pasos.length) {
        fila.classList.add('resalta');
        setTimeout(() => fila.classList.remove('resalta'), 700);
      }
      if (n < 12) {
        estado.className = 'estado estado--poco';
        estado.textContent = 'Por acabarse';
        aviso.classList.add('visible');
      }
    };
    mientrasSeVe(
      inv,
      () => { if (!reloj) reloj = setInterval(tic, 1700); },
      () => { clearInterval(reloj); reloj = null; },
    );
  }

  /* servicios: filtro «¿Qué necesitas?» */
  const buscar = document.querySelector('[data-buscar]');
  if (buscar) {
    const estado = document.querySelector('[data-buscar-estado]');
    const tipos = [...document.querySelectorAll('[data-tipo]')];
    const vacio = document.querySelector('[data-sin-resultados]');
    const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let espera = null;
    const filtrar = () => {
      const q = normal(buscar.value.trim());
      const palabras = q.split(/\s+/).filter((w) => w.length > 2);
      let total = 0;
      const vistos = new Set();
      tipos.forEach((t) => {
        const det = t.querySelector('details');
        let n = 0;
        t.querySelectorAll('.lista-completa li').forEach((li) => {
          const ok = !palabras.length || palabras.every((w) => normal(li.textContent).includes(w));
          li.hidden = !ok;
          if (ok) { n += 1; vistos.add(li.querySelector('a').getAttribute('href')); }
        });
        t.hidden = palabras.length > 0 && n === 0;
        if (det) det.open = palabras.length > 0 ? n > 0 : det.hasAttribute('data-abierto');
        total += n;
      });
      if (!palabras.length) { estado.textContent = ''; vacio.hidden = true; return; }
      estado.textContent = vistos.size === 1 ? '1 servicio coincide.' : `${vistos.size} servicios coinciden.`;
      vacio.hidden = total > 0;
    };
    buscar.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(filtrar, 120); });
    buscar.closest('form')?.addEventListener('submit', (e) => { e.preventDefault(); filtrar(); });
  }
})();
