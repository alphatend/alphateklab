/* p22: el recorrido del teléfono, las pestañas de negocios, el buscador, el formulario y el menú del celular. */
(() => {
  const d = document;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  /* ── cabecera: línea al bajar y menú del celular ── */
  const nav = d.querySelector('.nav');
  const borde = () => nav && nav.classList.toggle('con-borde', scrollY > 8);
  addEventListener('scroll', borde, { passive: true });
  borde();

  const menu = d.querySelector('.nav__menu');
  const panel = d.getElementById('menu-movil');
  const cerrarMenu = () => { if (!menu) return; menu.setAttribute('aria-expanded', 'false'); panel.hidden = true; };
  menu?.addEventListener('click', () => {
    const abierto = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!abierto));
    panel.hidden = abierto;
  });
  panel?.querySelectorAll('a').forEach((a) => a.addEventListener('click', cerrarMenu));
  d.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') { cerrarMenu(); menu.focus(); }
  });

  /* ── el recorrido: un teléfono fijo que cambia de pantalla con cada paso ── */
  const rec = d.querySelector('[data-recorrido]');
  if (rec) {
    const pasos = [...rec.querySelectorAll('.paso')];
    const fijo = rec.querySelector('.tel-fijo');
    const pantallas = fijo ? [...fijo.querySelectorAll('.pantalla')] : [];
    const botones = fijo ? [...fijo.querySelectorAll('[data-ir]')] : [];
    const compu = matchMedia('(min-width: 1024px)');
    let activo = -1;
    let raf = 0;
    let fijoOn = false;

    const pintar = (a) => {
      if (a === activo) return;
      activo = a;
      const vis = Math.max(a, 1);
      pasos.forEach((p, i) => p.classList.toggle('activo', i + 1 === a));
      pantallas.forEach((s, i) => {
        s.classList.toggle('visible', i + 1 === vis);
        s.classList.toggle('is-on', i + 1 === a);
      });
      botones.forEach((b, i) => (i + 1 === vis ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    };
    // el paso activo es el último cuyo borde de arriba ya pasó la mitad de la pantalla
    const medir = () => {
      raf = 0;
      const linea = innerHeight * 0.56;
      let a = 0;
      pasos.forEach((p, i) => { if (p.getBoundingClientRect().top < linea) a = i + 1; });
      pintar(a);
    };
    const alMover = () => { if (!raf) raf = requestAnimationFrame(medir); };

    const modo = () => {
      const quiere = compu.matches && !reduce.matches;
      if (quiere === fijoOn) return;
      fijoOn = quiere;
      rec.classList.toggle('es-fijo', fijoOn);
      if (fijoOn) {
        addEventListener('scroll', alMover, { passive: true });
        addEventListener('resize', alMover);
        activo = -1;
        medir();
      } else {
        removeEventListener('scroll', alMover);
        removeEventListener('resize', alMover);
        pasos.forEach((p) => p.classList.remove('activo'));
      }
    };

    botones.forEach((b, i) =>
      b.addEventListener('click', () => pasos[i].scrollIntoView({ block: 'center', behavior: reduce.matches ? 'auto' : 'smooth' })),
    );

    // la versión apilada (celular, o movimiento reducido): cada teléfono hace su parte al verse, o queda quieto
    const sueltas = [...rec.querySelectorAll('.paso__tel .pantalla')];
    let io = null;
    const apiladas = () => {
      io?.disconnect();
      if (reduce.matches || !('IntersectionObserver' in window)) {
        rec.classList.toggle('sin-mov', reduce.matches);
        sueltas.forEach((s) => s.classList.add('is-on'));
        return;
      }
      rec.classList.remove('sin-mov');
      io = new IntersectionObserver(
        (es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-on'); io.unobserve(en.target); } }),
        { threshold: 0.5 },
      );
      sueltas.forEach((s) => { if (!s.classList.contains('is-on')) io.observe(s); });
    };

    compu.addEventListener('change', modo);
    reduce.addEventListener('change', () => { modo(); apiladas(); });
    modo();
    apiladas();
  }

  /* ── negocios: pestañas con la foto que cambia ── */
  d.querySelectorAll('[data-negocios]').forEach((caja) => {
    const tabs = [...caja.querySelectorAll('[role="tab"]')];
    const fotos = [...caja.querySelectorAll('.negocios__fotos img')];
    const paneles = [...caja.querySelectorAll('[role="tabpanel"]')];
    const lista = caja.querySelector('[role="tablist"]');
    const elegir = (i, foco) => {
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(j === i)); t.tabIndex = j === i ? 0 : -1; });
      fotos.forEach((f, j) => f.classList.toggle('on', j === i));
      paneles.forEach((p, j) => p.classList.toggle('on', j === i));
      if (foco) tabs[i].focus({ preventScroll: true });
      if (lista.scrollWidth > lista.clientWidth) {
        const t = tabs[i];
        lista.scrollTo({ left: t.offsetLeft - 20, behavior: reduce.matches ? 'auto' : 'smooth' });
      }
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => elegir(i));
      t.addEventListener('keydown', (ev) => {
        const k = ev.key;
        let n = null;
        if (k === 'ArrowDown' || k === 'ArrowRight') n = (i + 1) % tabs.length;
        if (k === 'ArrowUp' || k === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        if (k === 'Home') n = 0;
        if (k === 'End') n = tabs.length - 1;
        if (n !== null) { ev.preventDefault(); elegir(n, true); }
      });
    });
  });

  /* ── formulario: no se envía; dice a dónde llega el mensaje ── */
  d.querySelectorAll('[data-form]').forEach((f) =>
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const nota = f.querySelector('[data-nota]');
      if (!nota) return;
      const nueva = nota.hidden;
      nota.hidden = false;
      if (nueva) {
        nota.classList.add('nueva');
        requestAnimationFrame(() => requestAnimationFrame(() => nota.classList.remove('nueva')));
      }
    }),
  );

  /* ── copiar el correo (con la selección del texto si el portapapeles no está) ── */
  d.querySelectorAll('[data-copiar]').forEach((b) =>
    b.addEventListener('click', () => {
      const correo = b.parentElement.querySelector('[data-correo]');
      const listo = () => {
        b.textContent = 'Copiado';
        setTimeout(() => (b.textContent = 'Copiar'), 1800);
      };
      const seleccionar = () => {
        const r = d.createRange();
        r.selectNodeContents(correo);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      else seleccionar();
    }),
  );

  /* ── servicios: el buscador «¿Qué necesitas?» y el índice que sigue la lectura ── */
  const buscar = d.querySelector('[data-buscar]');
  if (buscar) {
    const input = buscar.querySelector('input');
    const res = d.querySelector('[data-resultados]');
    const cat = d.querySelector('[data-catalogo]');
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const items = new Map();
    d.querySelectorAll('.tipo-bloque').forEach((bl) => {
      const tipo = bl.dataset.nombre;
      bl.querySelectorAll('.lista-serv a').forEach((a) => {
        const it = items.get(a.href) || { href: a.href, nombre: a.querySelector('b').textContent, desc: a.querySelector('span').textContent, tipos: [], txt: '' };
        it.tipos.push(tipo);
        it.txt = norm(`${it.nombre} ${it.desc} ${it.tipos.join(' ')}`);
        items.set(a.href, it);
      });
    });
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    buscar.addEventListener('submit', (ev) => ev.preventDefault());
    input.addEventListener('input', () => {
      const q = norm(input.value.trim());
      if (!q) { res.hidden = true; cat.hidden = false; res.innerHTML = ''; return; }
      const palabras = q.split(/\s+/).map((w) => (w.length > 4 ? w.replace(/(es|s)$/, '') : w));
      const hits = [...items.values()].filter((it) => palabras.every((w) => it.txt.includes(w)));
      cat.hidden = true;
      res.hidden = false;
      const dicho = esc(input.value.trim());
      if (!hits.length) {
        res.innerHTML = `<p class="resultados__n">Ningún servicio de la lista dice «${dicho}».</p><p class="vacio">La lista es lo que ya tenemos descrito, no todo lo que podemos hacer. <a class="enlace" href="#propuesta">Cuéntanos qué necesitas</a> y te decimos si lo podemos hacer.</p>`;
        return;
      }
      res.innerHTML = `<p class="resultados__n">${hits.length} ${hits.length === 1 ? 'servicio' : 'servicios'} para «${dicho}»</p><ul>${hits
        .map((it) => `<li><a href="${it.href}"><b>${esc(it.nombre)}</b><span>${esc(it.desc)}</span><small>${esc(it.tipos.join(', '))}</small></a></li>`)
        .join('')}</ul>`;
    });

    const enlaces = [...d.querySelectorAll('.indice a')];
    if ('IntersectionObserver' in window && enlaces.length) {
      const io = new IntersectionObserver(
        (es) => es.forEach((en) => {
          if (!en.isIntersecting) return;
          enlaces.forEach((a) => a.classList.toggle('activo', a.hash === `#${en.target.id}`));
        }),
        { rootMargin: '-40% 0px -55% 0px' },
      );
      d.querySelectorAll('.tipo-bloque').forEach((b) => io.observe(b));
    }
  }
})();
