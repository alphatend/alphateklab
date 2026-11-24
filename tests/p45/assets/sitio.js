// alphateklab, propuesta 45 «Para cada negocio»: menú, formulario, copiar el correo, buscador,
// el héroe (palabra que rueda, foto y tarjetas), la franja de negocios y los avisos del teléfono.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';

  /* Un resorte (masa 1, rigidez 170, amortiguación 18: rebote corto) muestreado como curva linear().
     Si el navegador no conoce linear(), se usa la salida fuerte de siempre. */
  const resorte = (() => {
    const puede = window.CSS && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)');
    if (!puede) return { easing: EASE_OUT, duracion: 560 };
    const k = 170, c = 18, dt = 1 / 240;
    let x = 0, v = 0, t = 0;
    const muestras = [0];
    while (t < 1.6) {
      v += (-k * (x - 1) - c * v) * dt;
      x += v * dt;
      t += dt;
      muestras.push(x);
      if (t > 0.25 && Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02) break;
    }
    const paso = Math.max(1, Math.round(muestras.length / 48));
    const puntos = [];
    for (let i = 0; i < muestras.length; i += paso) puntos.push(+muestras[i].toFixed(4));
    puntos.push(1);
    return { easing: `linear(${puntos.join(', ')})`, duracion: Math.round(t * 1000) };
  })();

  const cancelar = (el) => el.getAnimations().forEach((a) => a.cancel());

  /* ── cabecera: borde al bajar y menú del celular ── */
  const cabecera = document.querySelector('.cabecera');
  const abrir = document.querySelector('[data-abrir-menu]');
  const borde = () => cabecera?.classList.toggle('con-sombra', scrollY > 8);
  addEventListener('scroll', borde, { passive: true });
  borde();
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

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, como en el sitio en vivo. Sin JavaScript,
     el formulario se manda solo y FormSubmit vuelve a la página (_next). _honey es la trampa para robots. ── */
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
  // el navegador marca el campo; la nota dice qué falta con palabras
  form?.addEventListener('invalid', (e) => {
    e.target.setAttribute('aria-invalid', 'true');
    avisar(queFalta(), true);
  }, true);
  form?.addEventListener('input', (e) => {
    if (e.target.validity?.valid) e.target.removeAttribute('aria-invalid');
    if (nota.dataset.estado === 'error' && !queFalta()) avisar('');
  });
  let enviando = false;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (texto.value.trim() === '') {
      texto.setAttribute('aria-invalid', 'true');
      avisar(queFalta(), true);
      texto.focus();
      return;
    }
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
      document.getElementById('propuesta')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth' });
      setTimeout(() => texto?.focus({ preventScroll: true }), quieto ? 0 : 500);
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
        const chico = document.createElement('small');
        a.href = s.a.href;
        a.textContent = s.a.dataset.servicio;
        chico.textContent = s.tipo;
        a.append(chico);
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

  /* Un bucle que se detiene por varias razones a la vez: el botón, el puntero encima,
     fuera de pantalla o la pestaña oculta. Corre solo cuando no queda ninguna. */
  const bucle = (alCambiar) => {
    const razones = new Set();
    return {
      razones,
      corre: () => razones.size === 0,
      poner(r, si) {
        const antes = razones.size === 0;
        if (si) razones.add(r);
        else razones.delete(r);
        if (antes !== (razones.size === 0)) alCambiar(razones.size === 0);
      },
    };
  };
  const vigilarPantalla = (el, b) => {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => b.poner('fuera', !e.isIntersecting), { threshold: 0.1 }).observe(el);
    }
    document.addEventListener('visibilitychange', () => b.poner('oculta', document.visibilityState !== 'visible'));
  };
  const botonPausa = (boton, b) => {
    const etiqueta = boton.querySelector('span');
    boton.addEventListener('click', () => {
      const pausar = !b.razones.has('usuario');
      boton.classList.toggle('en-pausa', pausar);
      etiqueta.textContent = pausar ? 'Reproducir' : 'Pausar';
      b.poner('usuario', pausar);
    });
  };

  /* ── el héroe: cada 4 s rueda la palabra, la foto se funde y las tarjetas cambian con un resorte corto ── */
  const vitrina = document.querySelector('[data-vitrina]');
  if (vitrina) {
    const DURA = 4000;
    const rueda = document.querySelector('[data-rueda]');
    const base = rueda.querySelector('.rueda__palabra--base');
    const palabras = [...rueda.querySelectorAll('.rueda__palabra:not(.rueda__palabra--base)')];
    const fotos = [...vitrina.querySelectorAll('.vitrina__foto img')];
    const ranuras = [...vitrina.querySelectorAll('.ranura')].map((r) => [...r.children]);
    const pasos = [...vitrina.querySelectorAll('.paso')];
    const pausa = vitrina.querySelector('[data-pausa]');
    const N = fotos.length;
    let actual = 0;
    let visible = base; // la palabra que se ve ahora
    let reloj = null; // la barrita del paso activo: cuando termina, pasa al siguiente negocio
    let zoom = null;
    let tLatido = 0;
    let latido = false;

    const b = bucle((corre) => {
      if (reloj && reloj.playState !== 'finished') corre ? reloj.play() : reloj.pause();
      if (zoom && zoom.playState !== 'finished') corre ? zoom.play() : zoom.pause();
      clearTimeout(tLatido);
      if (corre) programarLatido();
    });

    // estado actual de una animación en curso, para salir desde donde está y no desde cero
    const fotograma = (el) => {
      const cs = getComputedStyle(el);
      return { transform: cs.transform === 'none' ? 'none' : cs.transform, opacity: cs.opacity };
    };

    const rodar = (entra) => {
      const sale = visible;
      if (sale === entra) return;
      visible = entra;
      [base, ...palabras].forEach((p) => {
        if (p !== sale && p !== entra) {
          cancelar(p);
          p.classList.remove('activa', 'sale');
        }
      });
      if (quieto) {
        sale.classList.remove('activa');
        entra.classList.add('activa');
        return;
      }
      const desde = fotograma(sale);
      cancelar(sale);
      cancelar(entra);
      sale.classList.remove('activa');
      sale.classList.add('sale');
      entra.classList.remove('sale');
      entra.classList.add('activa');
      sale
        .animate([desde, { transform: 'translateY(-104%)', opacity: 0 }], { duration: 620, easing: EASE_IN_OUT, fill: 'forwards' })
        .finished.then(() => {
          sale.classList.remove('sale');
          cancelar(sale);
        })
        .catch(() => {});
      entra.animate([{ transform: 'translateY(104%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 620, easing: EASE_IN_OUT });
    };

    const fundirFoto = (sale, entra) => {
      fotos.forEach((f) => {
        if (f !== sale && f !== entra) {
          cancelar(f);
          f.classList.remove('activa');
          f.style.zIndex = '';
        }
      });
      cancelar(entra);
      sale.style.zIndex = '1';
      entra.style.zIndex = '2';
      entra.classList.add('activa');
      if (quieto) {
        sale.classList.remove('activa');
        cancelar(sale);
        return;
      }
      entra
        .animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease' })
        .finished.then(() => {
          if (fotos[actual] !== entra) return;
          sale.classList.remove('activa');
          sale.style.zIndex = '';
          cancelar(sale);
        })
        .catch(() => {});
      acercar(entra);
    };
    // movimiento lento de la foto mientras se ve: constante, por eso lineal
    const acercar = (foto) => {
      zoom = foto.animate([{ transform: 'scale(1.045)' }, { transform: 'scale(1)' }], { duration: DURA + 900, easing: 'linear', fill: 'forwards' });
      if (!b.corre()) zoom.pause();
    };

    const cambiarTarjeta = (sale, entra, k) => {
      const retraso = 120 + k * 80;
      if (sale !== entra) {
        if (quieto) {
          sale.classList.remove('activa', 'primera', 'listo', 'sale');
        } else {
          const desde = fotograma(sale);
          cancelar(sale);
          sale.classList.remove('activa', 'primera');
          sale.classList.add('sale');
          sale
            .animate([desde, { opacity: 0, transform: 'translateY(-8px) scale(0.97)' }], { duration: 200, easing: EASE_OUT, delay: k * 40, fill: 'forwards' })
            .finished.then(() => {
              sale.classList.remove('sale', 'listo');
              cancelar(sale);
            })
            .catch(() => {});
        }
      }
      cancelar(entra);
      entra.classList.remove('listo', 'sale', 'primera');
      entra.classList.add('activa');
      if (quieto) return;
      entra.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: EASE_OUT, delay: retraso, fill: 'backwards' });
      entra.animate([{ transform: 'translateY(18px) scale(0.96)' }, { transform: 'none' }], { duration: resorte.duracion, easing: resorte.easing, delay: retraso, fill: 'backwards' });
    };

    // a mitad de cada negocio pasa una cosa en vivo: una etiqueta cambia, una cifra sube, llega la respuesta
    const hacerLatido = () => {
      latido = true;
      ranuras.forEach((lista) => lista[actual].classList.add('listo'));
    };
    function programarLatido() {
      clearTimeout(tLatido);
      if (latido || quieto || !reloj) return;
      const resto = 1700 - (reloj.currentTime || 0);
      if (resto <= 0) hacerLatido();
      else tLatido = setTimeout(hacerLatido, resto);
    }

    const arrancarReloj = () => {
      pasos.forEach((p) => cancelar(p.querySelector('.paso__relleno')));
      latido = false;
      clearTimeout(tLatido);
      if (quieto) return;
      reloj = pasos[actual].querySelector('.paso__relleno').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DURA, easing: 'linear', fill: 'forwards' });
      reloj.onfinish = () => ir((actual + 1) % N);
      if (b.corre()) programarLatido();
      else reloj.pause();
    };

    const marcarPaso = () => pasos.forEach((p, i) => (i === actual ? p.setAttribute('aria-current', 'true') : p.removeAttribute('aria-current')));

    function ir(n) {
      const antes = actual;
      actual = n;
      rodar(palabras[n]);
      if (antes !== n) fundirFoto(fotos[antes], fotos[n]);
      ranuras.forEach((lista, k) => cambiarTarjeta(lista[antes], lista[n], k));
      marcarPaso();
      arrancarReloj();
    }

    pasos.forEach((p, i) =>
      p.addEventListener('click', () => {
        if (i === actual && visible === palabras[i]) return;
        ir(i);
      }),
    );

    if (quieto) {
      vitrina.classList.add('quieta');
    } else {
      vitrina.classList.add('moviendo');
      botonPausa(pausa, b);
      vigilarPantalla(vitrina, b);
      const escena = vitrina.querySelector('.vitrina__escena');
      escena.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && b.poner('encima', true));
      escena.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && b.poner('encima', false));
      // las fotos que siguen se bajan en cuanto termina de cargar la página
      addEventListener('load', () => fotos.forEach((f) => (f.loading = 'eager')), { once: true });
      // entrada: «negocio.» se queda un momento y rueda al primer negocio; desde ahí, cada 4 s
      const empezar = () => {
        acercar(fotos[0]);
        setTimeout(() => {
          rodar(palabras[0]);
          arrancarReloj();
        }, 900);
      };
      if (document.visibilityState === 'visible') empezar();
      else document.addEventListener('visibilitychange', function una() {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', una);
        empezar();
      });
    }
  }

  /* ── la franja de negocios: corre despacio, se detiene con el botón, con el puntero o fuera de pantalla ── */
  const franja = document.querySelector('[data-franja]');
  if (franja && !quieto) {
    const b = bucle((corre) => franja.classList.toggle('pausada', !corre));
    botonPausa(franja.querySelector('[data-pausa-franja]'), b);
    vigilarPantalla(franja, b);
  }

  /* ── los avisos del teléfono: llega uno nuevo arriba cada 2.8 s y los demás bajan ── */
  const escenario = document.querySelector('[data-avisos]');
  if (escenario && !quieto) {
    const lista = escenario.querySelector('.avisos');
    const plantillas = [...lista.children].map((li) => li.cloneNode(true));
    const HORAS = ['ahora', '3 min', '7 min', '12 min', '18 min'];
    const ponerHoras = () => [...lista.children].forEach((li, i) => (li.querySelector('time').textContent = HORAS[i] || ''));
    while (lista.children.length > 5) lista.lastElementChild.remove();
    ponerHoras();
    let siguiente = 5 % plantillas.length;
    let t = 0;
    const llegar = () => {
      const antes = new Map([...lista.children].map((li) => [li, li.getBoundingClientRect().top]));
      const nuevo = plantillas[siguiente].cloneNode(true);
      siguiente = (siguiente + 1) % plantillas.length;
      lista.prepend(nuevo);
      ponerHoras();
      antes.forEach((arriba, li) => {
        const d = arriba - li.getBoundingClientRect().top;
        if (d) li.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: resorte.duracion, easing: resorte.easing });
      });
      nuevo.animate([{ opacity: 0, transform: 'translateY(-12px) scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE_OUT });
      setTimeout(() => {
        while (lista.children.length > 5) lista.lastElementChild.remove();
      }, 900);
    };
    const programar = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        llegar();
        programar();
      }, 2800);
    };
    const b = bucle((corre) => (corre ? programar() : clearTimeout(t)));
    botonPausa(escenario.querySelector('[data-pausa-avisos]'), b);
    vigilarPantalla(escenario, b);
    if (b.corre()) programar();
  }
})();
