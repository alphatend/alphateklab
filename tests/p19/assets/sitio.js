// alphateklab, propuesta 19: «Tres pantallas». Cabecera, formulario, buscador, pestañas y el héroe vivo.
// Todo lo que se ve en las pantallas es un negocio de ejemplo con datos simulados.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const icono = (n, cls = 'ico') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${n}"></use></svg>`;

  /* ═══ cabecera: fondo al bajar y menú del teléfono ═══ */
  const cab = document.querySelector('[data-cabecera]');
  if (cab) {
    const marcar = () => cab.classList.toggle('es-bajada', scrollY > 8);
    marcar();
    addEventListener('scroll', marcar, { passive: true });
    const abrir = cab.querySelector('[data-abrir]');
    const cerrar = () => {
      cab.classList.remove('esta-abierta');
      abrir.setAttribute('aria-expanded', 'false');
    };
    abrir.addEventListener('click', () => {
      const va = !cab.classList.contains('esta-abierta');
      cab.classList.toggle('esta-abierta', va);
      abrir.setAttribute('aria-expanded', String(va));
    });
    cab.querySelectorAll('.cabecera__menu a').forEach((a) => a.addEventListener('click', cerrar));
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && cab.classList.contains('esta-abierta')) {
        cerrar();
        abrir.focus();
      }
    });
  }

  /* ═══ el formulario: la nota y «Copiar» ═══ */
  document.querySelectorAll('[data-formulario]').forEach((f) => {
    const nota = f.querySelector('[data-nota]');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      nota.classList.remove('ve');
      void nota.offsetWidth;
      nota.innerHTML = `${icono('check-circle')}<span>Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.</span>`;
      nota.classList.add('ve');
    });
  });
  // copiar el correo; si el navegador no deja escribir en el portapapeles, deja el correo seleccionado
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
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      else seleccionar();
    }),
  );

  /* ═══ servicios.html: el buscador «¿Qué necesitas?» y el índice ═══ */
  const buscar = document.querySelector('[data-buscar]');
  if (buscar && window.SERVICIOS) {
    const caja = document.querySelector('[data-resultados]');
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const indice = window.SERVICIOS.map((s) => ({ ...s, x: norm(`${s.n} ${s.d} ${s.t.join(' ')}`) }));
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const VACIAS = new Set(['que', 'de', 'la', 'el', 'los', 'las', 'me', 'mi', 'un', 'una', 'y', 'o', 'en', 'para', 'con', 'se', 'si', 'por', 'a', 'al', 'del', 'quiero', 'necesito']);
    const correr = () => {
      const q = norm(buscar.value.trim());
      if (!q) {
        caja.hidden = true;
        caja.innerHTML = '';
        return;
      }
      const palabras = q.split(/\s+/).filter((p) => p.length > 1 && !VACIAS.has(p));
      const pal = palabras.length ? palabras : [q];
      // cada palabra pesa más cuanto más rara es entre los 79, y más si está en el nombre del servicio
      const raices = pal.map((w) => w.slice(0, Math.max(4, w.length - 2)));
      const peso = raices.map((r) => Math.log((indice.length + 1) / (1 + indice.filter((s) => s.x.includes(r)).length)));
      const puntos = indice
        .map((s) => ({ s, p: raices.reduce((n, r, i) => n + (s.x.includes(r) ? peso[i] * (norm(s.n).includes(r) ? 2 : 1) : 0), 0) }))
        .filter((r) => r.p > 0)
        .sort((a, b) => b.p - a.p);
      caja.hidden = false;
      if (!puntos.length) {
        caja.innerHTML = '<p>No lo tenemos descrito todavía. <a class="flecha" href="#propuesta" style="display:inline;padding:0;border:0">Escríbenos y te decimos si lo podemos hacer.</a></p>';
        return;
      }
      const n = Math.min(puntos.length, 8);
      caja.innerHTML =
        `<p>${n === 1 ? 'El servicio que más se parece' : `Los ${n} servicios que más se parecen`} a «${esc(buscar.value.trim())}»</p>` +
        puntos
          .slice(0, 8)
          .map(({ s }) => `<a href="${s.h}"><b>${esc(s.n)}</b><span>${esc(s.d)}</span></a>`)
          .join('');
    };
    buscar.addEventListener('input', correr);
    buscar.closest('[role=search]')?.addEventListener('submit', (e) => e.preventDefault());
  }
  const enlacesIndice = [...document.querySelectorAll('[data-indice]')];
  if (enlacesIndice.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((en) => {
          if (!en.isIntersecting) return;
          enlacesIndice.forEach((a) => a.classList.toggle('on', a.dataset.indice === en.target.id));
        });
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    document.querySelectorAll('.tipo-b').forEach((s) => io.observe(s));
  }

  /* ═══ negocios.html: «Míralo funcionando», cinco pestañas ═══ */
  const pestanas = [...document.querySelectorAll('[data-rubro]')];
  if (pestanas.length && window.TELEFONO) {
    const recorrido = document.querySelector('[data-recorrido]');
    const chat = document.querySelector('[data-chat]');
    const negocio = document.querySelector('[data-chat-negocio]');
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    let turno = 0;
    const mostrar = (b, foco) => {
      const r = b.dataset.rubro;
      const d = window.TELEFONO[r];
      pestanas.forEach((p) => {
        const si = p === b;
        p.setAttribute('aria-selected', String(si));
        p.tabIndex = si ? 0 : -1;
      });
      recorrido.setAttribute('aria-labelledby', b.id);
      if (foco) b.focus();
      const mio = ++turno;
      recorrido.classList.add('fuera');
      chat.classList.add('fuera');
      setTimeout(() => {
        if (mio !== turno) return;
        recorrido.querySelector('[data-bajada]').textContent = d.bajada;
        recorrido.querySelector('[data-pasos]').innerHTML = d.pasos.map(([a, z]) => `<li><span><b>${esc(a)}</b>${esc(z)}</span></li>`).join('');
        negocio.textContent = d.negocio;
        chat.innerHTML = d.chat.map((c) => `<div class="burbuja${c[2] ? ` ${c[2]}` : ''}">${c[1]}<time>${c[0]}</time></div>`).join('');
        requestAnimationFrame(() => {
          recorrido.classList.remove('fuera');
          chat.classList.remove('fuera');
        });
      }, 200);
    };
    pestanas.forEach((b, i) => {
      b.addEventListener('click', () => mostrar(b));
      b.addEventListener('keydown', (e) => {
        const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!paso) return;
        e.preventDefault();
        mostrar(pestanas[(i + paso + pestanas.length) % pestanas.length], true);
      });
    });
  }

  /* ═══ el héroe: entrada y el pedido que pasa por las tres pantallas ═══ */
  const heroe = document.querySelector('[data-heroe]');
  if (!heroe) return;
  requestAnimationFrame(() => requestAnimationFrame(() => heroe.classList.add('entro')));
  if (quieto) return;

  const carta = heroe.querySelector('[data-carta]');
  const cocina = heroe.querySelector('[data-cocina]');
  const panel = heroe.querySelector('[data-panel]');
  const botonPausa = heroe.querySelector('[data-pausa]');
  if (!carta || !cocina || !panel) return;

  const PLATOS = {
    cari: ['Carimañolas (3)', 4.5, 'carimañolas', 'carimañolas'],
    pata: ['Patacones con ceviche', 8.5, 'patacones', 'patacones'],
    sanc: ['Sancocho de gallina', 6.5, 'sancocho', 'sancochos'],
    hoja: ['Hojaldras (2)', 3.5, 'hojaldras', 'hojaldras'],
    chicha: ['Chicha de piña', 2, 'chicha', 'chichas'],
  };
  const PEDIDOS = [
    { mesa: 'Mesa 4', c: { pata: 2, chicha: 1 } },
    { mesa: 'Mesa 9', c: { sanc: 1, cari: 1, chicha: 1 } },
    { mesa: 'Mesa 12', c: { hoja: 2, chicha: 2 } },
    { mesa: 'Mesa 11', c: { cari: 1, pata: 1, sanc: 1 } },
    { mesa: 'Mesa 6', c: { sanc: 2, chicha: 2 } },
    { mesa: 'Mesa 3', c: { pata: 1, hoja: 1, chicha: 1 } },
    { mesa: 'Mesa 8', c: { cari: 2, chicha: 1 } },
    { mesa: 'Mesa 10', c: { pata: 2, sanc: 1 } },
  ];
  const ORDEN = ['cari', 'pata', 'sanc', 'hoja', 'chicha'];
  const plata = (n) => `B/. ${n.toFixed(2)}`;
  const totalDe = (c) => Object.entries(c).reduce((s, [k, q]) => s + PLATOS[k][1] * q, 0);
  const resumenDe = (c) =>
    ORDEN.filter((k) => c[k])
      .map((k) => `${c[k]} ${c[k] > 1 ? PLATOS[k][3] : PLATOS[k][2]}`)
      .join(', ');

  /* pausa: el botón, la pestaña oculta y el héroe fuera de la vista */
  let pausado = false;
  let enVista = true;
  const espera = (ms) =>
    new Promise((listo) => {
      let falta = ms;
      const tic = () => {
        if (!pausado && enVista && !document.hidden) falta -= 100;
        if (falta <= 0) listo();
        else setTimeout(tic, 100);
      };
      setTimeout(tic, 100);
    });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => (enVista = e.isIntersecting)).observe(heroe.querySelector('.estudio'));
  botonPausa.hidden = false;
  botonPausa.addEventListener('click', () => {
    pausado = !pausado;
    botonPausa.innerHTML = pausado ? `${icono('reproducir')}<span>Seguir</span>` : `${icono('pausa')}<span>Pausar</span>`;
    botonPausa.setAttribute('aria-pressed', String(pausado));
  });

  /* un cambio de texto con fundido y un poco de desenfoque */
  const cambiar = (el, contenido, comoHtml) => {
    if (!el) return;
    el.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(2px)' }], { duration: 130, easing: 'ease' }).finished.then(() => {
      if (comoHtml) el.innerHTML = contenido;
      else el.textContent = contenido;
      el.animate([{ opacity: 0, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 220, easing: EASE_OUT });
    });
  };
  /* FLIP: lo que cambia de lugar se desliza desde donde estaba */
  const flip = (lista, cambio) => {
    const antes = new Map(lista().map((e) => [e, e.getBoundingClientRect()]));
    cambio();
    lista().forEach((e) => {
      const a = antes.get(e);
      if (!a) return;
      const b = e.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
      e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 560, easing: EASE_IN_OUT });
    });
  };
  const entrar = (el) => el.animate([{ opacity: 0, transform: 'translateY(-10px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE_OUT });
  const salir = (el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease', fill: 'forwards' }).finished.then(() => el.remove());

  /* ── el teléfono: la carta de la mesa ── */
  const filasCarta = Object.fromEntries([...carta.querySelectorAll('[data-plato]')].map((li) => [li.dataset.plato, li.querySelector('[data-q]')]));
  const mesaEl = carta.querySelector('[data-mesa]');
  const nEl = carta.querySelector('[data-n]');
  const totalEl = carta.querySelector('[data-total]');
  const boton = carta.querySelector('[data-enviar]');
  const hoja = carta.querySelector('[data-hoja]');
  const ponerCarrito = async (p) => {
    cambiar(mesaEl, p.mesa);
    await espera(500);
    for (const k of ORDEN) {
      const q = p.c[k] || 0;
      const b = filasCarta[k];
      if (Number(b.textContent) === q) continue;
      b.textContent = q;
      b.classList.toggle('cero', !q);
      if (q) b.animate([{ transform: 'scale(1.35)', color: '#1d4ed8' }, { transform: 'none' }], { duration: 320, easing: EASE_OUT });
      await espera(200);
    }
    nEl.textContent = Object.values(p.c).reduce((a, b) => a + b, 0);
    cambiar(totalEl, plata(totalDe(p.c)));
  };
  const vaciarCarrito = () => {
    Object.values(filasCarta).forEach((b) => {
      b.textContent = '0';
      b.classList.add('cero');
    });
    nEl.textContent = '0';
    totalEl.textContent = plata(0);
  };

  /* ── la tableta: la cocina ── */
  const columnas = Object.fromEntries([...cocina.querySelectorAll('[data-col]')].map((c) => [c.dataset.col, c]));
  const BOTON = { nuevos: 'Empezar', prep: 'Marcar listo', listos: 'Entregado' };
  const leer = (col) =>
    [...columnas[col].querySelectorAll('.comanda')].map((el) => ({
      id: el.dataset.id,
      edad: parseInt(el.querySelector('.comanda__top span').textContent, 10) || 0,
      el,
    }));
  const K = { nuevos: leer('nuevos'), prep: leer('prep'), listos: leer('listos') };
  let cuenta = 0;
  const pintarCocina = () => {
    for (const col of ['nuevos', 'prep', 'listos']) {
      const lista = columnas[col].querySelector('.col__lista');
      K[col].forEach((t) => {
        t.el.querySelector('.comanda__btn').textContent = BOTON[col];
        t.el.querySelector('.comanda__top span').textContent = t.edad ? `${t.edad} min` : 'ahora';
        t.el.classList.toggle('comanda--nueva', col === 'nuevos' && t.edad === 0);
      });
      lista.replaceChildren(...K[col].map((t) => t.el));
      columnas[col].querySelector('h6 i').textContent = K[col].length;
    }
  };
  const comandaNueva = (p) => {
    const el = document.createElement('div');
    el.className = 'comanda';
    el.dataset.id = `c${++cuenta}`;
    el.innerHTML = `<div class="comanda__top"><b>${p.mesa}</b><span>ahora</span></div><ul>${ORDEN.filter((k) => p.c[k])
      .map((k) => `<li><b>${p.c[k]}</b> ${PLATOS[k][0]}</li>`)
      .join('')}</ul><span class="comanda__btn">Empezar</span>`;
    return { id: el.dataset.id, edad: 0, el };
  };
  const pasarALaCocina = async (p) => {
    const t = comandaNueva(p);
    for (const col of Object.values(K)) col.forEach((x) => (x.edad += 3));
    K.nuevos.unshift(t);
    if (K.nuevos.length > 2) K.prep.unshift(K.nuevos.pop());
    if (K.prep.length > 2) K.listos.unshift(K.prep.pop());
    const sale = K.listos.length > 2 ? K.listos.pop() : null;
    if (sale) await salir(sale.el);
    flip(() => [...cocina.querySelectorAll('.comanda')], pintarCocina);
    entrar(t.el);
    return t.id;
  };
  const estadoDe = (id) => (K.nuevos.some((t) => t.id === id) ? 'nuevo' : K.prep.some((t) => t.id === id) ? 'cocina' : 'listo');

  /* ── la laptop: el panel del dueño ── */
  const CHIP = { nuevo: ['chip--nuevo', 'Nuevo'], cocina: ['chip--cocina', 'En cocina'], listo: ['chip--listo', 'Listo'] };
  const listaPedidos = panel.querySelector('[data-pedidos]');
  const kVentas = panel.querySelector('[data-k="ventas"]');
  const kPedidos = panel.querySelector('[data-k="pedidos"]');
  const kQr = panel.querySelector('[data-k="qr"]');
  const kCocina = panel.querySelector('[data-k="cocina"]');
  const kNevera = panel.querySelector('[data-k="nevera"]');
  const filaNevera = panel.querySelector('[data-nevera]');
  const aviso = panel.querySelector('[data-aviso]');
  const avisoTexto = panel.querySelector('[data-aviso-texto]');
  let ventas = 612.4;
  let pedidos = 41;
  const ponerChips = () =>
    listaPedidos.querySelectorAll('li').forEach((li) => {
      const [c, t] = CHIP[estadoDe(li.dataset.id)];
      const chip = li.querySelector('.chip');
      if (chip.textContent !== t) {
        chip.className = `chip ${c}`;
        chip.textContent = t;
      }
    });
  const alPanel = async (p, id) => {
    ventas += totalDe(p.c);
    pedidos += 1;
    cambiar(kVentas, plata(ventas));
    cambiar(kPedidos, String(pedidos));
    cambiar(kQr, `<i class="punto"></i>${pedidos} pedidos`, true);
    cambiar(kCocina, `<i class="punto"></i>${K.nuevos.length + K.prep.length} en curso`, true);
    const li = document.createElement('li');
    li.dataset.id = id;
    li.innerHTML = `<b>${p.mesa}</b><span>${resumenDe(p.c)}</span><em>${plata(totalDe(p.c))}</em><span class="chip chip--nuevo">Nuevo</span>`;
    const filas = [...listaPedidos.children];
    if (filas.length >= 4) await salir(filas[filas.length - 1]);
    flip(() => [...listaPedidos.children], () => {
      listaPedidos.prepend(li);
      ponerChips();
    });
    entrar(li);
  };
  const nevera = (estado) => {
    if (estado === 'alerta') {
      filaNevera.classList.add('alerta');
      cambiar(kNevera, '<i class="punto"></i>8.9 °C', true);
      aviso.classList.remove('bien');
      avisoTexto.textContent = 'La nevera 2 subió a 8.9 °C. La puerta lleva 6 minutos abierta.';
      aviso.hidden = false;
      entrar(aviso);
    } else if (estado === 'bien') {
      filaNevera.classList.remove('alerta');
      cambiar(kNevera, '<i class="punto"></i>4.3 °C', true);
      aviso.classList.add('bien');
      cambiar(avisoTexto, 'La nevera 2 volvió a 4.3 °C. Todo en orden.');
    } else if (!aviso.hidden) {
      aviso.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease' }).finished.then(() => (aviso.hidden = true));
    }
  };

  /* ── la historia: un pedido cada pocos segundos ── */
  const ciclo = async (i) => {
    const p = PEDIDOS[i % PEDIDOS.length];
    if (i > 0) {
      if (i % 4 === 0) nevera('ocultar');
      await ponerCarrito(p);
      await espera(1100);
    }
    boton.classList.add('pulsado');
    await espera(200);
    boton.classList.remove('pulsado');
    hoja.classList.remove('sale');
    hoja.classList.add('ve');
    await espera(500);
    const id = await pasarALaCocina(p);
    await espera(700);
    await alPanel(p, id);
    await espera(1200);
    hoja.classList.remove('ve');
    hoja.classList.add('sale');
    await espera(500);
    vaciarCarrito();
    if (i % 4 === 1) {
      await espera(900);
      nevera('alerta');
    }
    if (i % 4 === 3) {
      await espera(900);
      nevera('bien');
    }
    await espera(2400);
  };
  (async () => {
    await espera(1900);
    for (let i = 0; ; i++) await ciclo(i);
  })();
})();
