// alphateklab, propuesta 47 «Todas las pantallas»: menú, formulario, copiar el correo, pestañas, buscador,
// el relevo de los seis equipos del héroe, la tira de negocios y el salón en vivo.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

  /* ── cabecera: borde al bajar y menú del celular ── */
  const cabecera = document.querySelector('.cabecera');
  const abrir = document.querySelector('[data-abrir-menu]');
  const sombra = () => cabecera?.classList.toggle('con-sombra', scrollY > 8);
  addEventListener('scroll', sombra, { passive: true });
  sombra();
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

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, igual que en el sitio publicado.
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
  form?.addEventListener('invalid', () => avisar(queFalta(), true), true);
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
      if (b.tagName === 'BUTTON') {
        document.getElementById('propuesta')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth' });
        setTimeout(() => texto?.focus({ preventScroll: true }), quieto ? 0 : 500);
      }
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
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      else seleccionar();
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
        const sp = document.createElement('span');
        sp.textContent = s.a.dataset.servicio;
        const sm = document.createElement('small');
        sm.textContent = s.tipo;
        sp.append(sm);
        a.append(sp, s.a.querySelector('.ico')?.cloneNode(true) || '');
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

  /* ── control común de lo que se mueve: Pausar/Reproducir, fuera de pantalla y pestaña oculta ── */
  const controlar = (raiz, boton, alCambiar) => {
    const est = { usuario: false, fuera: false, oculto: document.hidden };
    const corre = () => !est.usuario && !est.fuera && !est.oculto;
    const aplicar = () => {
      raiz.toggleAttribute('data-detenido', !corre());
      alCambiar?.(corre());
    };
    const fijarUsuario = (pausado) => {
      est.usuario = pausado;
      if (boton) {
        boton.setAttribute('aria-pressed', String(pausado));
        boton.querySelector('span').textContent = pausado ? 'Reproducir' : 'Pausar';
      }
      aplicar();
    };
    boton?.addEventListener('click', () => fijarUsuario(!est.usuario));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        est.fuera = !e.isIntersecting;
        aplicar();
      }, { threshold: 0.06 }).observe(raiz);
    }
    document.addEventListener('visibilitychange', () => {
      est.oculto = document.hidden;
      aplicar();
    });
    aplicar();
    return { reanudar: () => est.usuario && fijarUsuario(false) };
  };
  // un reloj con requestAnimationFrame que solo corre mientras se ve
  const reloj = (tick) => {
    let ultimo = null;
    let id = null;
    const cuadro = (ahora) => {
      if (ultimo !== null) tick(Math.min(ahora - ultimo, 64));
      ultimo = ahora;
      id = requestAnimationFrame(cuadro);
    };
    return (corre) => {
      if (corre && id === null) {
        ultimo = null;
        id = requestAnimationFrame(cuadro);
      } else if (!corre && id !== null) {
        cancelAnimationFrame(id);
        id = null;
      }
    };
  };
  const rodar = (el, valor) => {
    if (!el) return;
    el.textContent = valor;
    if (!quieto) el.animate([{ transform: 'translateY(45%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: EASE_OUT });
  };
  const centro = (el, marco) => {
    const a = el.getBoundingClientRect();
    const b = marco.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
  };

  /* ── el héroe: seis equipos que se pasan el turno ── */
  const vitrina = document.querySelector('[data-vitrina]');
  if (vitrina) {
    const PASO = 3200;
    const DESCANSO = 900;
    const ORDEN = ['camara', 'web', 'app', 'menu', 'kiosco', 'cobro'];
    const dv = Object.fromEntries(ORDEN.map((id) => [id, vitrina.querySelector(`[data-dv="${id}"]`)]));
    const etiquetas = Object.fromEntries(ORDEN.map((id) => [id, document.querySelector(`.relevo__lista li[data-para="${id}"]`)]));
    document.querySelector('.relevo')?.style.setProperty('--paso', `${PASO}ms`);
    const celular = matchMedia('(max-width: 700px)');

    // cámara que cuenta
    const pCam = dv.camara.querySelector('.p-cam');
    const cuentaCam = dv.camara.querySelector('[data-cuenta]');
    let personas = 213;
    // tienda en línea
    const pWeb = dv.web.querySelector('.p-web');
    const prods = [...pWeb.querySelectorAll('[data-prod]')];
    const cursor = pWeb.querySelector('.web__cursor');
    const carrito = pWeb.querySelector('[data-carrito]');
    const avisoWeb = pWeb.querySelector('[data-aviso-web]');
    const nombres = ['Café de Boquete', 'Cacao de Bocas', 'Taza de barro'];
    let enCarrito = 2;
    let iProd = 0;
    const elegibles = () => (celular.matches ? [1] : [0, 1, 2]);
    let prodActual = prods[0];
    const cursorA = (el) => {
      const c = centro(el, pWeb);
      const w = cursor.getBoundingClientRect().width;
      cursor.style.transform = `translate(${c.x - w * 0.18}px, ${c.y - w * 0.12}px)`;
    };
    // app de pedidos
    const pApp = dv.app.querySelector('.p-app');
    const listaApp = pApp.querySelector('[data-lista]');
    const cuentaApp = pApp.querySelector('[data-pedidos]');
    const avisoT = pApp.querySelector('[data-aviso-t]');
    const avisoD = pApp.querySelector('[data-aviso-d]');
    const pedidos = [
      'Para llevar: 6 pan de huevo, 2 cafés',
      'Domicilio: 1 dulce de tres leches',
      'Retiro: 12 bollos de maíz',
      'Domicilio: 4 empanadas, 1 chicheme',
    ];
    let nPedido = 1284;
    let nHoy = 23;
    const prepararAviso = () => {
      avisoT.textContent = `Nuevo pedido ${nPedido}`;
      avisoD.textContent = pedidos[(nPedido - 1284) % pedidos.length];
    };
    const nuevaFila = () => {
      const filas = [...listaApp.children];
      const antes = filas.map((f) => f.getBoundingClientRect().top);
      const li = document.createElement('li');
      li.innerHTML = `<b>${nPedido}</b><span></span><em class="est est--nuevo">Nuevo</em>`;
      li.querySelector('span').textContent = pedidos[(nPedido - 1284) % pedidos.length];
      filas.forEach((f) => {
        const em = f.querySelector('.est');
        if (em.classList.contains('est--prep')) { em.className = 'est est--listo'; em.textContent = 'Listo'; }
        else if (em.classList.contains('est--nuevo')) { em.className = 'est est--prep'; em.textContent = 'Preparando'; }
      });
      listaApp.prepend(li);
      if (!quieto) {
        filas.forEach((f, i) => {
          const d = antes[i] - f.getBoundingClientRect().top;
          f.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 520, easing: EASE_OUT });
        });
        li.animate([{ opacity: 0, transform: 'translateY(-35%)' }, { opacity: 1, transform: 'none' }], { duration: 460, easing: EASE_OUT });
      }
      while (listaApp.children.length > 4) listaApp.lastElementChild.remove();
      nHoy += 1;
      nPedido += 1;
      rodar(cuentaApp, String(nHoy));
    };
    // kiosco
    const pKio = dv.kiosco.querySelector('.p-kio');
    const itemKio = pKio.querySelector('[data-kio-item]');
    const totalKio = pKio.querySelector('[data-kio-total]');
    const pagarKio = pKio.querySelector('[data-kio-pagar]');
    const numKio = pKio.querySelector('[data-kio-num]');
    const toque = pKio.querySelector('[data-toque]');
    let pedidoKio = 47;
    const tocar = (el) => {
      const c = centro(el, pKio);
      toque.style.left = `${c.x}px`;
      toque.style.top = `${c.y}px`;
      if (!quieto) toque.animate([{ opacity: 0.95, transform: 'scale(0.5)' }, { opacity: 0, transform: 'scale(1.3)' }], { duration: 560, easing: EASE_OUT });
    };
    // menú en pantalla
    const pMenu = dv.menu.querySelector('.p-menu');
    const platos = [...pMenu.querySelectorAll('[data-plato]')];
    const filasMenu = [...pMenu.querySelectorAll('[data-fila]')];
    const marca = pMenu.querySelector('[data-marca]');
    let iPlato = 0;
    const marcar = (i) => {
      const fila = filasMenu[Number(platos[i].dataset.plato)];
      marca.style.height = `${fila.offsetHeight}px`;
      marca.style.transform = `translateY(${fila.offsetTop}px)`;
    };
    const verPlato = (i) => {
      platos.forEach((p, j) => p.classList.toggle('activo', j === i));
      marcar(i);
    };
    // cobro
    const pCobro = dv.cobro.querySelector('.p-cobro');
    const papel = dv.cobro.querySelector('[data-papel]');

    const acciones = {
      camara: [
        [120, () => { pCam.classList.remove('entra'); void pCam.offsetWidth; pCam.classList.add('entra'); }],
        [1100, () => { pCam.classList.add('cruce'); personas += 1; rodar(cuentaCam, String(personas)); }],
        [1600, () => pCam.classList.remove('cruce')],
      ],
      web: [
        [60, () => {
          const op = elegibles();
          prodActual = prods[op[iProd % op.length]];
          cursorA(prodActual.querySelector('.web__agregar'));
        }],
        [1020, () => { cursor.classList.add('pulsa'); prodActual.classList.add('pulsa'); }],
        [1150, () => {
          cursor.classList.remove('pulsa');
          prodActual.classList.remove('pulsa');
          prodActual.classList.add('agregado');
          enCarrito = enCarrito >= 9 ? 1 : enCarrito + 1;
          carrito.textContent = String(enCarrito);
          carrito.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 420, easing: EASE_OUT });
          avisoWeb.textContent = `${nombres[prods.indexOf(prodActual)]}, en tu carrito`;
          pWeb.classList.add('aviso');
        }],
        [2800, () => pWeb.classList.remove('aviso')],
        [3000, () => { cursor.style.transform = ''; }],
        [4600, () => { prodActual.classList.remove('agregado'); iProd += 1; }],
      ],
      app: [
        [150, () => { prepararAviso(); pApp.classList.add('aviso'); }],
        [850, nuevaFila],
        [2700, () => pApp.classList.remove('aviso')],
      ],
      menu: [
        [220, () => { iPlato = (iPlato + 1) % platos.length; verPlato(iPlato); }],
      ],
      kiosco: [
        [220, () => { tocar(itemKio); itemKio.classList.add('sel'); rodar(totalKio, 'B/. 6.50'); }],
        [1150, () => { tocar(pagarKio); pagarKio.classList.add('pulsa'); }],
        [1300, () => pagarKio.classList.remove('pulsa')],
        [1450, () => pKio.classList.add('listo')],
        [6200, () => {
          pKio.classList.remove('listo');
          itemKio.classList.remove('sel');
          totalKio.textContent = 'B/. 0.00';
          pedidoKio += 1;
          numKio.textContent = String(pedidoKio).padStart(3, '0');
        }],
      ],
      cobro: [
        [150, () => (pCobro.dataset.cobro = 'yappy')],
        [1150, () => { pCobro.dataset.cobro = 'ok'; papel.classList.add('imprime'); }],
        [4900, () => papel.classList.add('corta')],
        [5350, () => {
          papel.classList.add('sin-transicion');
          papel.classList.remove('imprime', 'corta');
          void papel.offsetWidth;
          papel.classList.remove('sin-transicion');
          pCobro.dataset.cobro = 'espera';
        }],
      ],
    };

    const visible = (id) => getComputedStyle(dv[id]).display !== 'none';
    let orden = [];
    let eventos = [];
    let largo = 0;
    let t = -1300; // espera a que los equipos terminen de entrar
    const activar = (id) => {
      ORDEN.forEach((k) => {
        const si = k === id;
        dv[k].classList.toggle('activo', si);
        const li = etiquetas[k];
        if (!li) return;
        if (si) {
          li.classList.remove('activo');
          void li.offsetWidth; // reinicia la barra de tiempo
          li.classList.add('activo');
        } else li.classList.remove('activo');
      });
    };
    const armar = () => {
      orden = ORDEN.filter(visible);
      largo = orden.length * PASO + DESCANSO;
      eventos = [];
      orden.forEach((id, i) => {
        const base = i * PASO;
        eventos.push([base, () => activar(id)]);
        acciones[id].forEach(([dt, fn]) => eventos.push([(base + dt) % largo, fn]));
      });
      eventos.sort((a, b) => a[0] - b[0]);
    };
    const disparar = (a, b) => eventos.forEach(([m, fn]) => m > a && m <= b && fn());
    const avanzar = (dt) => {
      let nt = t + dt;
      if (nt >= largo) {
        disparar(t, largo);
        nt -= largo;
        disparar(-1, nt);
      } else disparar(t, nt);
      t = nt;
    };

    // posición inicial de la marca del menú, sin animarla
    marca.style.transition = 'none';
    verPlato(0);
    requestAnimationFrame(() => (marca.style.transition = ''));

    if (quieto) {
      // un cuadro final con sentido: cada equipo muestra lo que acaba de hacer
      armar();
      cuentaCam.textContent = '214';
      prodActual = prods[elegibles()[0]];
      prodActual.classList.add('agregado');
      carrito.textContent = '3';
      pWeb.classList.add('aviso');
      cursor.style.transition = 'none';
      requestAnimationFrame(() => cursorA(prodActual.querySelector('.web__agregar')));
      prepararAviso();
      nuevaFila();
      pApp.classList.add('aviso');
      itemKio.classList.add('sel');
      totalKio.textContent = 'B/. 6.50';
      pKio.classList.add('listo');
      verPlato(1);
      pCobro.dataset.cobro = 'ok';
      papel.classList.add('imprime');
    } else {
      armar();
      celular.addEventListener('change', () => {
        armar();
        t = -1;
      });
      const mover = reloj(avanzar);
      const ctrl = controlar(vitrina, document.querySelector('[data-pausa="vitrina"]'), (corre) => {
        document.querySelector('.relevo')?.toggleAttribute('data-detenido', !corre);
        mover(corre);
      });
      // tocar una etiqueta lleva el relevo a ese equipo
      document.querySelectorAll('[data-ir]').forEach((b) =>
        b.addEventListener('click', () => {
          const i = orden.indexOf(b.dataset.ir);
          if (i < 0) return;
          t = i * PASO - 1;
          ctrl.reanudar();
        }),
      );
    }
  }

  /* ── la tira de negocios: se desliza despacio; se detiene al pasar el ratón, con Pausar o fuera de pantalla ── */
  const tira = document.querySelector('[data-tira]');
  if (tira && !quieto) {
    const pista = tira.querySelector('.tira__pista');
    [...pista.children].forEach((li) => {
      const copia = li.cloneNode(true);
      copia.setAttribute('aria-hidden', 'true');
      copia.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
      copia.querySelectorAll('img').forEach((img) => (img.alt = ''));
      pista.append(copia);
    });
    controlar(tira, tira.querySelector('[data-pausa="tira"]'));
  }

  /* ── el salón en vivo: llega un evento nuevo cada 2.8 s ── */
  const salon = document.querySelector('[data-salon]');
  if (salon && !quieto) {
    const lista = salon.querySelector('[data-salon-lista]');
    const eventosSalon = [
      ['Mesa 5', 'Pidió 1 sancocho y 1 limonada'],
      ['Mesa 9', 'Pagó B/. 24.60 con propina'],
      ['Cocina', 'La orden de la mesa 4 está lista'],
      ['Mesa 11', 'Pidió la carta en inglés'],
      ['Mesa 7', 'Pidió la cuenta, dividida en 3'],
      ['Mesa 2', 'Llama al mesero'],
      ['Mesa 4', 'Pidió 2 patacones y 1 chicha'],
    ];
    let i = 0;
    let acumulado = 0;
    const llega = () => {
      const [mesa, que] = eventosSalon[i % eventosSalon.length];
      i += 1;
      const filas = [...lista.children];
      const antes = filas.map((f) => f.getBoundingClientRect().top);
      const li = document.createElement('li');
      li.className = 'nuevo';
      li.innerHTML = '<span class="salon__mesa"></span><span></span><time>ahora</time>';
      li.children[0].textContent = mesa;
      li.children[1].textContent = que;
      filas.forEach((f, k) => {
        f.classList.remove('nuevo');
        f.querySelector('time').textContent = ['1 min', '3 min', '5 min'][k] || '5 min';
      });
      lista.prepend(li);
      filas.forEach((f, k) => {
        const d = antes[k] - f.getBoundingClientRect().top;
        f.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 520, easing: EASE_OUT });
      });
      li.animate([{ opacity: 0, transform: 'translateY(-40%)' }, { opacity: 1, transform: 'none' }], { duration: 460, easing: EASE_OUT });
      while (lista.children.length > 3) lista.lastElementChild.remove();
    };
    const mover = reloj((dt) => {
      acumulado += dt;
      if (acumulado >= 2800) {
        acumulado -= 2800;
        llega();
      }
    });
    controlar(salon, salon.querySelector('[data-pausa="salon"]'), mover);
  }
})();
