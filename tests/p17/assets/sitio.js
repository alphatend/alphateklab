/* alphateklab, propuesta 17. Sin librerías. Nada queda escondido esperando a este archivo. */
(() => {
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

  /* ── la cabecera: su filete al bajar, y el menú del teléfono ── */
  const cabecera = document.querySelector('.cabecera');
  const filete = () => cabecera?.classList.toggle('con-linea', window.scrollY > 8);
  filete();
  window.addEventListener('scroll', filete, { passive: true });

  const botonMenu = document.querySelector('.menu-boton');
  const cerrarMenu = () => {
    if (!botonMenu) return;
    cabecera.classList.remove('abierta');
    botonMenu.setAttribute('aria-expanded', 'false');
    botonMenu.querySelector('span').textContent = 'Menú';
    botonMenu.querySelector('use').setAttribute('href', '#i-menu');
  };
  botonMenu?.addEventListener('click', () => {
    const abrir = botonMenu.getAttribute('aria-expanded') !== 'true';
    cabecera.classList.toggle('abierta', abrir);
    botonMenu.setAttribute('aria-expanded', String(abrir));
    botonMenu.querySelector('span').textContent = abrir ? 'Cerrar' : 'Menú';
    botonMenu.querySelector('use').setAttribute('href', abrir ? '#i-cerrar' : '#i-menu');
  });
  document.querySelectorAll('.menu-movil a').forEach((a) => a.addEventListener('click', cerrarMenu));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cabecera?.classList.contains('abierta')) { cerrarMenu(); botonMenu.focus(); }
  });

  /* ── el formulario: la nota de envío y el correo para copiar ── */
  document.querySelectorAll('[data-pregunta]').forEach((form) => {
    const nota = form.querySelector('[data-pregunta-nota]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      nota.textContent = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
    });
  });
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
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      } else {
        seleccionar();
      }
    }),
  );

  /* ── el panel de la cocina: entra una comanda nueva cada pocos segundos ── */
  const panel = document.querySelector('[data-panel]');
  if (panel) {
    const lista = panel.querySelector('[data-nuevos]');
    const cuentaNuevos = panel.querySelector('[data-cuenta-nuevos]');
    const navNuevos = panel.querySelector('[data-nav-nuevos]');
    const pedidos = panel.querySelector('[data-pedidos]');
    const ventas = panel.querySelector('[data-ventas]');
    const boton = document.querySelector('[data-pausa]');
    const PEDIDOS = [
      { mesa: 'Mesa 9', platos: [['1', 'Sancocho de gallina'], ['2', 'Arroz con pollo']], monto: 21.5 },
      { mesa: 'Para llevar', platos: [['3', 'Carimañolas'], ['1', 'Chicha de tamarindo']], monto: 9.75 },
      { mesa: 'Mesa 11', platos: [['1', 'Corvina frita'], ['1', 'Limonada']], monto: 14.25 },
      { mesa: 'Mesa 5', platos: [['2', 'Hojaldras'], ['2', 'Café con leche']], monto: 8.0 },
      { mesa: 'Mesa 3', platos: [['1', 'Ropa vieja'], ['1', 'Patacones']], monto: 12.5 },
    ];
    let i = 0;
    let nPedidos = Number(pedidos.textContent);
    let nVentas = 612.4;
    let corriendo = !reducir.matches;
    let visible = true;
    let reloj = null;

    const comanda = (p) => {
      const art = document.createElement('article');
      art.className = 'comanda comanda--nueva';
      art.innerHTML = `<div class="comanda__cabeza"><b></b><span>ahora</span></div><ul></ul>
        <div class="comanda__acciones"><span class="mini-boton mini-boton--azul">Aceptar</span><span class="mini-boton">Ver mesa</span></div>`;
      art.querySelector('b').textContent = p.mesa;
      const ul = art.querySelector('ul');
      p.platos.forEach(([n, plato]) => {
        const li = document.createElement('li');
        li.innerHTML = '<i></i><span></span>';
        li.querySelector('i').textContent = n;
        li.querySelector('span').textContent = plato;
        ul.append(li);
      });
      return art;
    };
    const cambiar = (el, texto) => {
      el.style.opacity = '0.25';
      setTimeout(() => { el.textContent = texto; el.style.opacity = ''; }, 180);
    };

    const llega = () => {
      const p = PEDIDOS[i % PEDIDOS.length];
      i += 1;
      const antes = [...lista.children];
      const tops = antes.map((el) => el.getBoundingClientRect().top);
      antes.forEach((el) => {
        el.classList.remove('comanda--nueva');
        const t = el.querySelector('.comanda__cabeza span');
        if (t.textContent === 'ahora') t.textContent = '1 min';
      });
      const nueva = comanda(p);
      lista.prepend(nueva);
      // la de abajo sale para que la columna no crezca
      const sobra = lista.children.length > 2 ? lista.lastElementChild : null;
      // FLIP: las que ya estaban bajan desde donde estaban
      antes.forEach((el, k) => {
        if (el === sobra) return;
        const dy = tops[k] - el.getBoundingClientRect().top;
        if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: EASE });
      });
      nueva.animate(
        [{ opacity: 0, transform: 'translateY(-10px) scale(0.98)' }, { opacity: 1, transform: 'none' }],
        { duration: 480, easing: EASE },
      );
      if (sobra) sobra.remove();
      nPedidos += 1;
      nVentas += p.monto;
      cambiar(pedidos, String(nPedidos));
      cambiar(ventas, 'B/. ' + nVentas.toFixed(2));
      const n = lista.children.length;
      cuentaNuevos.textContent = String(n);
      navNuevos.textContent = String(n);
    };

    const programar = () => {
      clearInterval(reloj);
      reloj = null;
      if (corriendo && visible && !document.hidden) reloj = setInterval(llega, 4200);
    };
    const pintarBoton = () => {
      if (!boton) return;
      boton.setAttribute('aria-pressed', String(!corriendo));
      boton.querySelector('span').textContent = corriendo ? 'Pausar' : 'Reanudar';
      boton.querySelector('[data-ico-pausa]').style.display = corriendo ? '' : 'none';
      boton.querySelector('[data-ico-seguir]').style.display = corriendo ? 'none' : '';
    };
    boton?.addEventListener('click', () => { corriendo = !corriendo; pintarBoton(); programar(); });
    document.addEventListener('visibilitychange', programar);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; programar(); }, { threshold: 0.2 }).observe(panel);
    }
    reducir.addEventListener?.('change', () => { if (reducir.matches) { corriendo = false; pintarBoton(); programar(); } });
    pintarBoton();
    programar();
  }

  /* ── el teléfono: los avisos llegan uno por uno la primera vez que se ve ── */
  const escenario = document.querySelector('[data-avisos]');
  if (escenario && 'IntersectionObserver' in window && !reducir.matches) {
    escenario.classList.add('espera');
    const notis = [...escenario.querySelectorAll('.noti')];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        notis.forEach((n, k) => setTimeout(() => {
          n.style.transitionDelay = '0ms';
          if (k === notis.length - 1) escenario.classList.remove('espera');
          else { n.style.opacity = '1'; n.style.transform = 'none'; }
        }, 380 + k * 620));
      },
      { threshold: 0.45 },
    );
    io.observe(escenario);
  }
})();
