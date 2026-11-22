// alphateklab, propuesta 38: menú, formulario, copiar el correo, buscador de servicios y la conversación del héroe.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICONOS = 'assets/iconos.svg';
  const ico = (n) => `<svg class="ico" aria-hidden="true" focusable="false"><use href="${ICONOS}#i-${n}"/></svg>`;

  /* ── cabecera: línea al bajar y menú del celular ── */
  const cabecera = document.querySelector('.cabecera');
  const abrir = document.querySelector('[data-abrir-menu]');
  const linea = () => cabecera?.classList.toggle('con-linea', scrollY > 8);
  addEventListener('scroll', linea, { passive: true });
  linea();
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

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, igual que en el sitio publicado (assets/web/sitio.js).
     Sin JavaScript, el formulario se manda solo y FormSubmit vuelve a la página (_next). _honey es la trampa para robots. ── */
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
    e.target.classList.add('tocado');
    avisar(queFalta(), true);
  }, true);
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
      form.querySelectorAll('.tocado').forEach((c) => c.classList.remove('tocado'));
      avisar('Recibimos tu mensaje. Te respondemos pronto a tu correo.');
    } catch {
      avisar('No se pudo enviar. Revisa tu conexión e inténtalo otra vez, o escríbenos a info@alphateklab.com.', true);
    } finally {
      enviando = false;
      boton?.removeAttribute('aria-disabled');
    }
  });
  // botones que bajan al formulario con el mensaje ya escrito (los paquetes)
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
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      } else {
        seleccionar();
      }
    }),
  );

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
        const nombre = document.createElement('span');
        nombre.textContent = s.a.dataset.servicio;
        const tipo = document.createElement('small');
        tipo.textContent = s.tipo;
        nombre.append(tipo);
        a.append(nombre);
        a.insertAdjacentHTML('beforeend', ico('arrow-up-right'));
        li.append(a);
        lista.append(li);
      });
      caja.hidden = false;
      const n = hallados.length;
      const dicho = entrada.value.trim();
      titulo.textContent = n ? `${n} ${n === 1 ? 'servicio coincide' : 'servicios coinciden'} con «${dicho}»` : `Nada en la lista con «${dicho}»`;
      vacio.hidden = n > 0;
      cuenta.textContent = n ? `${n} de ${vistos.size} servicios.` : `Ninguno de los ${vistos.size} servicios coincide.`;
    };
    entrada.addEventListener('input', correr);
    buscar.addEventListener('submit', (e) => {
      e.preventDefault();
      correr();
      if (!caja.hidden) caja.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'nearest' });
    });
    vacio.querySelector('a')?.addEventListener('click', () => {
      if (texto && !texto.value.trim()) texto.value = `Necesito ${entrada.value.trim()}. `;
    });
  }

  /* ── el héroe: el dueño le pregunta a su sistema y el asistente contesta ──
     Explicación de marketing, así que puede durar: unos 21 s por vuelta y luego descansa. Se puede pausar, se detiene
     sola fuera de la pantalla o con la pestaña oculta, y con movimiento reducido queda quieta en el estado final
     que ya trae el HTML (sin JavaScript también). */
  const raiz = document.querySelector('[data-conversa]');
  if (raiz && !quieto) conversa(raiz);

  function conversa(raiz) {
    const pista = raiz.querySelector('.chat__pista');
    const hilo = raiz.querySelector('.chat__hilo');
    const campo = raiz.querySelector('.chat__campo');
    const escrito = raiz.querySelector('.chat__texto');
    const enviar = raiz.querySelector('.chat__enviar');
    const boton = document.querySelector('[data-pausa]');
    pista.querySelectorAll('.estatico').forEach((e) => e.remove());
    const saludo = pista.innerHTML;

    // reloj que se puede pausar: cuenta solo el tiempo en que la demo está a la vista y sin pausa
    let pausado = false;
    let fuera = false;
    const parado = () => pausado || fuera || document.hidden;
    const pintarPausa = () => raiz.classList.toggle('en-pausa', pausado || fuera);
    const espera = (ms) =>
      new Promise((listo) => {
        let t = 0;
        let antes = performance.now();
        const paso = (ahora) => {
          const dt = Math.min(ahora - antes, 64);
          antes = ahora;
          if (!parado()) t += dt;
          if (t >= ms) listo();
          else requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      });

    // el hilo sube solo cuando el contenido ya no cabe (como una conversación de verdad)
    const seguir = () => {
      const d = Math.max(0, pista.offsetHeight - hilo.clientHeight);
      pista.style.transform = d ? `translateY(${-d}px)` : '';
    };
    const ro = new ResizeObserver(seguir);
    ro.observe(pista);
    ro.observe(hilo);

    const nuevo = (html) => {
      const t = document.createElement('template');
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    };
    const meter = (el, padre = pista) => {
      el.classList.add('nace');
      padre.append(el);
      void el.offsetWidth;
      el.classList.remove('nace');
      return el;
    };
    // texto en trozos, como llega una respuesta en vivo; [texto, resaltado]
    const trozos = (partes) =>
      partes
        .map(([t, resaltar]) => {
          const palabras = (t.match(/\S+\s*|\s+/g) || []).map((w) => `<span class="tk">${w}</span>`).join('');
          return resaltar ? `<mark>${palabras}</mark>` : palabras;
        })
        .join('');

    const RITMO = [6, 24, 2, 16, 38, 10, 0, 20, 8, 28, 4, 14, 32, 12];
    const escribir = async (frase) => {
      campo.classList.add('activo');
      await espera(520);
      campo.classList.add('escribiendo', 'lleno');
      const respiro = frase.indexOf('hoy') + 3;
      for (let i = 1; i <= frase.length; i++) {
        escrito.textContent = frase.slice(0, i);
        let ms = 36 + RITMO[i % RITMO.length];
        if (frase[i - 1] === ' ') ms += 18;
        if (i === respiro) ms += 260;
        await espera(ms);
      }
      campo.classList.remove('escribiendo');
      await espera(460);
    };
    const mandar = async (frase) => {
      enviar.classList.add('presionado');
      await espera(150);
      enviar.classList.remove('presionado');
      escrito.textContent = '';
      campo.classList.remove('lleno', 'activo');
      meter(nuevo(`<div class="msg msg--yo">${frase}</div>`));
      await espera(420);
    };
    const responder = async ({ pensando, listo, partes, pausa = 1500 }) => {
      const m = meter(
        nuevo(`<div class="msg msg--ia"><span class="msg__avatar">${ico('sparkle')}</span><div class="msg__cuerpo"><p class="msg__estado pensando"><span>${pensando}</span></p></div></div>`),
      );
      const cuerpo = m.querySelector('.msg__cuerpo');
      const estado = m.querySelector('.msg__estado');
      await espera(pausa);
      estado.classList.add('cambia');
      await espera(150);
      estado.classList.remove('pensando');
      estado.innerHTML = `${ico('check')}<span>${listo}</span>`;
      estado.classList.remove('cambia');
      const p = nuevo(`<p class="msg__texto">${trozos(partes)}</p>`);
      cuerpo.append(p);
      const tks = [...p.querySelectorAll('.tk')];
      for (let i = 0; i < tks.length; i++) {
        tks[i].classList.add('on');
        await espera(58 + RITMO[(i * 3) % RITMO.length] * 1.4);
      }
      await espera(160);
      for (const mk of p.querySelectorAll('mark')) {
        mk.classList.add('on');
        await espera(150);
      }
      return cuerpo;
    };

    const PLATOS = [['Patacones con ceviche', 21], ['Arroz con pollo', 16], ['Sancocho', 12], ['Carimañolas', 9]];
    const P1 = '¿Cuánto vendí hoy y qué fue lo que más salió?';
    const P2 = '¿Qué me falta en inventario?';

    const vuelta = async () => {
      await escribir(P1);
      await mandar(P1);
      const c1 = await responder({
        pensando: 'Revisando la caja y los pedidos de hoy…',
        listo: 'Revisó la caja y los pedidos de hoy',
        partes: [['B/. 612.40', true], [' en ', false], ['58 pedidos', true], ['. Lo que más salió: ', false], ['patacones con ceviche (21)', true], ['.', false]],
      });
      await espera(260);
      const g = meter(
        nuevo(`<div class="grafico"><p class="grafico__t"><span>Lo más pedido hoy</span><span>Platos</span></p><div class="grafico__filas">${PLATOS.map(
          ([n, v]) => `<div class="barra"><span>${n}</span><span class="barra__pista"><span class="barra__relleno" style="width:${((v / 21) * 100).toFixed(1)}%"></span></span><span class="barra__n">${v}</span></div>`,
        ).join('')}</div></div>`),
        c1,
      );
      await espera(240);
      for (const b of g.querySelectorAll('.barra')) {
        b.classList.add('on');
        await espera(90);
      }
      await espera(1100);
      const s = nuevo(`<div class="sugerencias"><span class="chip nace">Compárame con el martes</span><span class="chip nace">${P2}</span></div>`);
      pista.append(s);
      const chips = [...s.querySelectorAll('.chip')];
      void s.offsetWidth;
      for (const ch of chips) {
        ch.classList.remove('nace');
        await espera(90);
      }
      await espera(2000);
      // el dueño toca la segunda sugerencia
      chips[1].classList.add('sobre');
      await espera(520);
      chips[1].classList.add('presionado');
      await espera(170);
      chips[1].classList.remove('presionado');
      await espera(140);
      s.classList.add('se-va');
      await espera(220);
      s.remove();
      meter(nuevo(`<div class="msg msg--yo">${P2}</div>`));
      await espera(420);
      const c2 = await responder({
        pensando: 'Revisando el inventario de la cocina…',
        listo: 'Revisó el inventario de la cocina',
        partes: [['Se acaban mañana: ', false], ['corvina (quedan 4 lb)', true], [' y ', false], ['plátano verde (quedan 12)', true], ['. Te dejé lista la orden de compra para que la revises.', false]],
        pausa: 1100,
      });
      await espera(280);
      meter(nuevo(`<div class="msg__acciones"><span class="mini mini--ambar">Revisar la orden</span><span class="mini">Ahora no</span></div>`), c2);
      await espera(6500);
      // descanso terminado: se borra con calma y vuelve a empezar
      pista.classList.add('se-va');
      await espera(460);
      pista.style.transition = 'none';
      pista.innerHTML = saludo;
      pista.style.transform = '';
      void pista.offsetWidth;
      pista.style.transition = '';
      pista.classList.remove('se-va');
      await espera(900);
    };

    const correr = async () => {
      await espera(1100);
      for (;;) await vuelta();
    };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([en]) => {
          fuera = !en.isIntersecting;
          pintarPausa();
        },
        { threshold: 0.2 },
      ).observe(raiz);
    }
    boton?.addEventListener('click', () => {
      pausado = !pausado;
      boton.querySelector('span').textContent = pausado ? 'Reanudar' : 'Pausar';
      boton.setAttribute('aria-label', pausado ? 'Reanudar la conversación de ejemplo' : 'Pausar la conversación de ejemplo');
      boton.querySelector('use').setAttribute('href', `${ICONOS}#i-${pausado ? 'play' : 'pause'}`);
      pintarPausa();
    });
    correr();
  }
})();
