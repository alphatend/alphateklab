// alphateklab, propuesta 43 «Mosaico de soluciones»: menú, formulario, copiar el correo, buscador,
// el mosaico del héroe (ocho bucles chicos, uno por tipo de servicio) y los negocios que rotan.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IO = 'cubic-bezier(0.77, 0, 0.175, 1)';

  /* ── cabecera: borde al bajar y menú del teléfono ── */
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

  /* ── formulario «Pedir mi propuesta»: sale por FormSubmit, como en el sitio en vivo.
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
  // botones que bajan al formulario con el mensaje ya escrito (paquetes)
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
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
      else seleccionar();
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
        a.target = '_blank';
        a.rel = 'noopener';
        const sp = document.createElement('span');
        sp.textContent = s.a.dataset.servicio;
        const sm = document.createElement('small');
        sm.textContent = s.tipo;
        sp.append(sm);
        a.append(sp);
        const ic = s.a.querySelector('.ico');
        if (ic) a.append(ic.cloneNode(true));
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

  /* ══════════════════════════════════════════════════════════════════════════════════════════
     El mosaico del héroe. Cada tesela corre su propio bucle; un solo reloj (requestAnimationFrame)
     dispara los pasos y el movimiento lo hacen transiciones de CSS y WAAPI (transform y opacity).
     Los bucles arrancan escalonados, así siempre hay una o dos teselas cambiando, nunca todas.
     Un botón lo pausa todo; fuera de pantalla o con la pestaña oculta también se detiene.
     Con «reducir movimiento» no arranca: cada tesela queda en su cuadro final, que es el HTML.
     ══════════════════════════════════════════════════════════════════════════════════════════ */
  const mosaico = document.querySelector('[data-mosaico]');
  const botonPausa = mosaico?.querySelector('[data-pausa]');

  const anima = (el, cuadros, ops) => el.animate(cuadros, { easing: EASE, ...ops });
  const sinTransicion = (els, fn) => {
    els.forEach((e) => (e.style.transition = 'none'));
    fn();
    els.forEach((e) => e.offsetWidth);
    els.forEach((e) => (e.style.transition = ''));
  };
  // un número que cambia: sale hacia arriba y entra el nuevo desde abajo
  const rodar = (el, valor) => {
    if (el.textContent === String(valor)) return;
    const fuera = el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-45%)', opacity: 0 }], { duration: 130, easing: 'ease-out' });
    fuera.onfinish = () => {
      el.textContent = valor;
      el.animate([{ transform: 'translateY(45%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: EASE });
    };
  };
  // un texto que se reemplaza con un fundido corto
  const cambiarTexto = (el, valor) => {
    if (el.textContent === valor) return;
    const fuera = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-3px)' }], { duration: 140, easing: 'ease-out' });
    fuera.onfinish = () => {
      el.textContent = valor;
      el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE });
    };
  };
  // desde = null: solo opacidad (para lo que ya tiene su propio transform en CSS)
  const aparecer = (el, dur = 320, desde = 'translateY(4px)', hasta = 'none') => {
    el.style.opacity = '1';
    const cuadros = desde === null ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: desde }, { opacity: 1, transform: hasta }];
    return el.animate(cuadros, { duration: dur, easing: EASE });
  };
  const desaparecer = (el, dur = 280) => {
    el.style.opacity = '0';
    return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'ease-out' });
  };
  const chip = (el, clase, txt) => {
    el.innerHTML = `<span class="chip${clase ? ` chip--${clase}` : ''}">${txt}</span>`;
    if (!quieto) el.firstChild.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
  };

  /* Un programa: pasos [ms, función] en un bucle de «dur» ms. armar() se llama al empezar cada vuelta
     y devuelve { dur, pasos }; así una tesela puede cambiar de historia entre vueltas. */
  const programas = [];
  const programa = (desfase, armar) => programas.push({ t: -desfase, i: 0, armar, ...armar() });

  /* ── software a medida: inventario de una ferretería ── */
  const progInventario = (m) => {
    const fila = (id) => m.querySelector(`[data-fila="${id}"]`);
    const cant = (id) => fila(id).querySelector('[data-cant]');
    const estado = (id) => fila(id).querySelector('[data-estado]');
    const ultimo = m.querySelector('[data-ultimo]');
    const cuerpo = m.querySelector('tbody');
    const tocar = (id, clase = 'toca', ms = 1300) => {
      fila(id).classList.add(clase);
      setTimeout(() => fila(id).classList.remove(clase), ms);
    };
    const inicio = () => {
      cant('cemento').textContent = '38';
      cant('pintura').textContent = '9';
      estado('pintura').innerHTML = '<span class="chip">En existencia</span>';
      ultimo.textContent = 'Venta 0457: 1 tubo PVC';
    };
    let primera = true;
    return () => ({
      dur: 11600,
      pasos: [
        [0, () => {
          if (primera) { primera = false; inicio(); return; }
          // un día nuevo: la tabla vuelve a su punto de partida con un fundido corto
          cuerpo.animate([{ opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }], { duration: 520, easing: 'ease-in-out' });
          setTimeout(inicio, 260);
        }],
        [1000, () => { tocar('cemento'); rodar(cant('cemento'), 36); cambiarTexto(ultimo, 'Venta 0458: 2 sacos de cemento'); }],
        [3100, () => { tocar('pintura'); rodar(cant('pintura'), 7); chip(estado('pintura'), 'rojo', 'Por acabarse'); cambiarTexto(ultimo, 'Pintura blanca llegó al mínimo'); }],
        [5300, () => { chip(estado('pintura'), 'acento', 'Orden enviada'); cambiarTexto(ultimo, 'Orden de compra 112 enviada al proveedor'); }],
        [8400, () => { tocar('pintura', 'entra', 1500); rodar(cant('pintura'), 31); chip(estado('pintura'), '', 'En existencia'); cambiarTexto(ultimo, 'Entrada: 24 galones de pintura'); }],
      ],
    });
  };

  /* ── web y apps: una página que se arma y baja ── */
  const progWeb = (m) => {
    const pagina = m.querySelector('[data-pagina]');
    const vista = m.querySelector('.m-web__vista');
    const bloques = [...m.querySelectorAll('.b')];
    const carro = m.querySelector('[data-carro]');
    const prod = m.querySelectorAll('.w-prod')[1];
    const inicio = () => {
      sinTransicion([pagina, ...bloques], () => {
        bloques.forEach((b) => b.classList.add('oculto'));
        pagina.style.transform = 'none';
        prod.classList.remove('presionado');
      });
      carro.textContent = '0';
      carro.dataset.vacio = '';
      pagina.style.opacity = '1';
    };
    const orden = ['.w-nav', '.w-texto', '.w-img', '.w-titulo', '.w-prod:nth-child(1)', '.w-prod:nth-child(2)', '.w-prod:nth-child(3)', '.w-pie'];
    const tiempos = [150, 420, 640, 980, 1160, 1290, 1420, 1650];
    return () => ({
      dur: 9600,
      pasos: [
        [0, inicio],
        ...orden.map((sel, k) => [tiempos[k], () => m.querySelector(sel)?.classList.remove('oculto')]),
        [3000, () => {
          const d = Math.max(0, pagina.offsetHeight - vista.clientHeight);
          pagina.style.transform = `translateY(${-d}px)`;
        }],
        [4700, () => prod.classList.add('apretando')],
        [4860, () => {
          prod.classList.remove('apretando');
          prod.classList.add('presionado');
          carro.textContent = '1';
          delete carro.dataset.vacio;
          carro.animate([{ transform: 'scale(.6)' }, { transform: 'scale(1.15)' }, { transform: 'none' }], { duration: 360, easing: EASE });
        }],
        [6500, () => (pagina.style.transform = 'none')],
        [9150, () => (pagina.style.opacity = '0')],
      ],
    });
  };

  /* ── IA: un asistente que contesta (cabañas, y luego una inmobiliaria) ── */
  const CHARLAS = [
    {
      neg: 'Cabañas Lumbre (ejemplo)',
      msgs: [
        ['cli', '¿Tienen cabaña para 4 el sábado?'],
        ['ia', 'Sí, la cabaña 2 está libre el sábado 21. Son B/. 120 la noche. ¿Te la aparto?'],
        ['cli', 'Sí, por favor.'],
        ['ia', 'Listo. Te mandé el enlace para pagar el depósito con Yappy.'],
      ],
    },
    {
      neg: 'Inmobiliaria Costa (ejemplo)',
      msgs: [
        ['cli', '¿El apartamento de San Francisco sigue disponible?'],
        ['ia', 'Sí. Tiene 2 recámaras y 98 m². ¿Quieres ver el recorrido 3D o agendar una visita?'],
        ['cli', 'Agendar una visita.'],
        ['ia', 'Te anoté el jueves a las 4:00 p. m. Te confirmo por aquí.'],
      ],
    },
  ];
  const progChat = (m) => {
    const pila = m.querySelector('[data-pila]');
    const neg = m.querySelector('[data-chat-neg]');
    let n = 0;
    const agregar = (nodo) => {
      pila.append(nodo);
      const alto = nodo.offsetHeight + 5;
      pila.animate([{ transform: `translateY(${alto}px)` }, { transform: 'none' }], { duration: 340, easing: EASE });
      nodo.style.transformOrigin = nodo.classList.contains('msg--cli') ? '100% 100%' : '0 100%';
      nodo.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: EASE });
    };
    const burbuja = (quien, txt = '') => {
      const p = document.createElement('p');
      p.className = `msg msg--${quien}`;
      p.textContent = txt;
      return p;
    };
    return () => {
      const charla = CHARLAS[n++ % CHARLAS.length];
      const pasos = [[0, () => {
        pila.replaceChildren();
        pila.style.opacity = '1';
        if (neg.textContent !== charla.neg) cambiarTexto(neg, charla.neg);
      }]];
      let t = 350;
      let escribe = null;
      charla.msgs.forEach(([quien, txt]) => {
        if (quien === 'cli') {
          pasos.push([t, () => agregar(burbuja('cli', txt))]);
          t += 650;
        } else {
          pasos.push([t, () => {
            escribe = burbuja('ia');
            escribe.classList.add('msg--escribe');
            escribe.innerHTML = '<i></i><i></i><i></i>';
            agregar(escribe);
          }]);
          t += 1000;
          const palabras = txt.split(' ');
          pasos.push([t, () => {
            escribe.classList.remove('msg--escribe');
            escribe.textContent = palabras[0];
          }]);
          palabras.slice(1).forEach((_, k) => {
            t += 62;
            pasos.push([t, () => (escribe.textContent = palabras.slice(0, k + 2).join(' '))]);
          });
          t += 1100;
        }
      });
      t += 2600;
      pasos.push([t, () => desaparecer(pila, 300)]);
      return { dur: t + 380, pasos };
    };
  };

  /* ── cámaras: alguien cruza la línea de la entrada y el contador sube ── */
  const progCamara = (m) => {
    const vista = m.querySelector('.m-cam__vista');
    const caja = m.querySelector('[data-caja]');
    const id = caja.querySelector('em');
    const cuenta = m.querySelector('[data-cuenta]');
    const mas = m.querySelector('[data-mas]');
    const barra = m.querySelector('.m-cam__barras i:last-child');
    let n = 213;
    let vuelta = 0;
    return () => {
      const dur = vuelta++ % 3 === 2 ? 3900 : 3000;
      return {
        dur,
        pasos: [
          [0, () => {
            const W = vista.clientWidth;
            const w = caja.offsetWidth;
            caja.style.left = '0';
            caja.style.transform = `translateX(${W + w}px)`;
            id.textContent = String(n + 1);
            caja.animate([{ transform: `translateX(${-w}px)` }, { transform: `translateX(${W + w}px)` }], { duration: 2600, easing: 'linear' });
          }],
          [1290, () => {
            if (n >= 299) n = 213;
            n += 1;
            rodar(cuenta, n);
            mas.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none', offset: 0.25 }, { opacity: 1, transform: 'none', offset: 0.7 }, { opacity: 0, transform: 'translateY(-4px)' }], { duration: 1100, easing: 'ease-out' });
            barra?.animate([{ transform: 'scaleY(.9)' }, { transform: 'none' }], { duration: 360, easing: EASE });
          }],
        ],
      };
    };
  };

  /* ── sensores: el consumo que sube y la puerta del depósito ── */
  const progSensor = (m) => {
    const serie = m.querySelector('[data-serie]');
    const linea = serie.querySelector('polyline');
    const area = serie.querySelector('.area');
    const punta = m.querySelector('[data-punta]');
    const graf = m.querySelector('.m-sen__grafica');
    const kwh = m.querySelector('[data-kwh]');
    const vals = [2.1, 2.0, 1.9, 2.0, 2.4, 3.1, 3.6, 3.4, 3.8, 4.2, 4.0, 4.4, 4.1, 3.7, 3.9, 4.3, 4.6, 4.2, 3.8, 3.5, 3.9, 4.1, 3.7, 3.9, 4.2];
    const paso = 200 / (vals.length - 2);
    const y = (v) => 56 - ((v - 1.5) / 3.5) * 48;
    const dibujar = () => {
      const pts = vals.map((v, i) => `${(i * paso).toFixed(1)},${y(v).toFixed(1)}`);
      linea.setAttribute('points', pts.join(' '));
      area.setAttribute('d', `M0,60 L${pts.join(' L')} L${((vals.length - 1) * paso).toFixed(1)},60 Z`);
    };
    let total = 41.2;
    punta.style.display = 'block';
    const TICK = 1600;
    return () => ({
      dur: TICK,
      pasos: [[0, () => {
        vals.shift();
        let v = vals[vals.length - 1] + (Math.random() - 0.45) * 0.7;
        v = Math.min(4.7, Math.max(3.1, v));
        vals.push(+v.toFixed(2));
        dibujar();
        serie.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-paso}px)` }], { duration: TICK, easing: 'linear' });
        serie.style.transform = `translateX(${-paso}px)`;
        const h = graf.clientHeight / 60;
        const a = y(vals[vals.length - 2]) * h;
        const b = y(vals[vals.length - 1]) * h;
        punta.animate([{ transform: `translateY(${a}px)` }, { transform: `translateY(${b}px)` }], { duration: TICK, easing: 'linear' });
        punta.style.transform = `translateY(${b}px)`;
        total = +(total + (v > 4 ? 0.2 : 0.1)).toFixed(1);
        if (total > 58) total = 41.2;
        rodar(kwh, total.toFixed(1));
      }]],
    });
  };
  const progPuerta = (m) => {
    const chipPuerta = m.querySelector('[data-puerta]').parentElement;
    const poner = (clase, txt) => {
      chipPuerta.querySelector('.chip').remove();
      const s = document.createElement('span');
      s.className = `chip${clase ? ` chip--${clase}` : ''}`;
      s.dataset.puerta = '';
      s.textContent = txt;
      chipPuerta.append(s);
      s.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
    };
    const seg = (k) => () => (chipPuerta.querySelector('.chip').textContent = `Abierta 0:0${k}`);
    return () => ({
      dur: 13000,
      pasos: [
        [5200, () => poner('rojo', 'Abierta 0:01')],
        [6200, seg(2)], [7200, seg(3)], [8200, seg(4)], [9200, seg(5)],
        [10100, () => poner('', 'Cerrada')],
      ],
    });
  };

  /* ── pantallas y kioscos: el menú de la fonda rota cada pocos segundos ── */
  const MENU = [
    ['Plato del día', 'Sancocho de gallina', 'Con arroz blanco y tajadas', '5.75'],
    ['Para compartir', 'Patacones con ceviche', 'Doce patacones y ceviche de corvina', '6.50'],
    ['El más pedido', 'Ropa vieja', 'Con arroz con coco', '5.25'],
    ['Natural, de la casa', 'Chicha de piña', 'Vaso grande, con hielo', '1.75'],
  ];
  const progMenu = (m) => {
    const marca = m.querySelector('[data-marca]');
    const items = m.querySelectorAll('.m-menu__lista li');
    const caja = m.querySelector('.m-menu__destacado');
    const prog = m.querySelector('[data-progreso]');
    let i = 0;
    const DUR = 3700;
    return () => ({
      dur: DUR,
      pasos: [
        [0, () => prog.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DUR - 300, easing: 'linear' })],
        [DUR - 300, () => {
          i = (i + 1) % MENU.length;
          const [r, n, d, p] = MENU[i];
          const viejo = caja.querySelector('[data-dest]');
          const nuevo = viejo.cloneNode();
          nuevo.innerHTML = `<span class="rotulo">${r}</span><strong>${n}</strong><em>${d}</em><b>B/. ${p}</b>`;
          viejo.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-30%)' }], { duration: 240, easing: 'ease-out' }).onfinish = () => {
            viejo.replaceWith(nuevo);
            nuevo.animate([{ opacity: 0, transform: 'translateY(30%)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
          };
          marca.style.setProperty('--i', i);
          items.forEach((li, k) => li.classList.toggle('activo', k === i));
        }],
      ],
    });
  };

  /* ── recorridos 3D: el plano se dibuja y la cámara del recorrido pasa por los cuartos ── */
  const progPlano = (m) => {
    const lienzo = m.querySelector('[data-lienzo]');
    const ext = m.querySelector('.p-muro--ext');
    const ints = [...m.querySelectorAll('.p-muro--int')];
    const fundir = [...m.querySelectorAll('.p-ventanas, .p-detalle, .p-cota, .p-cota-txt')];
    const etqs = [...m.querySelectorAll('.p-etq')];
    const puntos = [...m.querySelectorAll('.p-puntos circle')];
    const pin = m.querySelector('[data-pin]');
    const cono = pin.querySelector('i');
    const pie = m.querySelector('[data-plano-estado]');
    const SALA = [96, 106];
    const ir = (x, y, giro) => {
      const W = lienzo.clientWidth / 280;
      const H = lienzo.clientHeight / 170;
      const desde = getComputedStyle(pin).transform;
      const hacia = `translate(${(x - SALA[0]) * W}px, ${(y - SALA[1]) * H}px)`;
      pin.style.transform = hacia;
      pin.animate([{ transform: desde === 'none' ? 'none' : desde }, { transform: hacia }], { duration: 950, easing: EASE_IO });
      cono.style.setProperty('--r', `${giro}deg`);
    };
    const dibujar = (el, dur) => {
      el.style.strokeDashoffset = '0';
      el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: dur, easing: EASE_IO });
    };
    const inicio = () => {
      [ext, ...ints].forEach((e) => (e.style.strokeDashoffset = '1'));
      [...fundir, ...etqs, pin].forEach((e) => (e.style.opacity = '0'));
      puntos.forEach((c) => (c.style.opacity = '0'));
      pin.style.transform = 'none';
      sinTransicion([cono], () => cono.style.setProperty('--r', '0deg'));
      lienzo.style.opacity = '1';
      pie.textContent = 'Dibujando el plano con medidas';
    };
    return () => ({
      dur: 11000,
      pasos: [
        [0, inicio],
        [150, () => dibujar(ext, 1700)],
        [1150, () => ints.forEach((e, k) => setTimeout(() => dibujar(e, 650), k * 110))],
        [2350, () => fundir.forEach((e) => aparecer(e, 450, null))],
        [2700, () => etqs.forEach((e, k) => setTimeout(() => aparecer(e, 380, 'translate(-50%, -36%)', 'translate(-50%, -50%)'), k * 90))],
        [3500, () => cambiarTexto(pie, 'Plano listo: 11.40 m de frente, 4 ambientes')],
        [4500, () => puntos.forEach((c, k) => setTimeout(() => aparecer(c, 300, null), k * 130))],
        [5100, () => { aparecer(pin, 360, 'scale(.6)'); cambiarTexto(pie, 'Recorrido 3D: sala y comedor'); }],
        [6400, () => { ir(220, 78, 90); cambiarTexto(pie, 'Recorrido 3D: recámara'); }],
        [8000, () => { ir(195, 146, 160); cambiarTexto(pie, 'Recorrido 3D: baño'); }],
        [10500, () => desaparecer(lienzo, 380)],
      ],
    });
  };

  /* ── cobros: pagan con Yappy y la factura electrónica sale sola ── */
  const COBROS = [
    { neg: 'Colegio Las Palmas (ejemplo)', concepto: 'Mensualidad de noviembre', monto: '85.00' },
    { neg: 'Taller Pinto (ejemplo)', concepto: 'Orden 112: cambio de aceite', monto: '64.20' },
  ];
  const progCobro = (m) => {
    const q = (s) => m.querySelector(s);
    const boton = q('.m-cobro__boton');
    const flujo = q('.m-cobro__flujo');
    const punto = flujo.querySelector('i');
    const tarjetas = [q('.m-cobro__pago'), q('.m-cobro__factura')];
    let n = 0;
    let num = 458;
    let primera = true;
    return () => {
      const c = COBROS[n++ % COBROS.length];
      const est = (e) => (m.dataset.estado = e);
      return {
        dur: 10200,
        pasos: [
          [0, () => {
            q('[data-neg]').textContent = c.neg;
            q('[data-concepto]').textContent = c.concepto;
            q('[data-concepto2]').textContent = c.concepto;
            q('[data-monto]').textContent = `B/. ${c.monto}`;
            q('[data-monto2]').textContent = c.monto;
            q('[data-monto3]').textContent = `B/. ${c.monto}`;
            q('[data-num]').textContent = `N.º 0${num++}`;
            if (num > 470) num = 458;
            sinTransicion([...m.querySelectorAll('.t, .m-cobro__boton, .f-estado, .f-linea, .f-total, .m-cobro__factura')], () => est('listo'));
            if (primera) primera = false;
            else tarjetas.forEach((t) => aparecer(t, 320, 'translateY(4px)'));
          }],
          [1500, () => boton.classList.add('presion')],
          [1660, () => { boton.classList.remove('presion'); est('procesando'); }],
          [3000, () => est('pagado')],
          [3400, () => {
            if (flujo.offsetParent) {
              const w = flujo.clientWidth;
              punto.animate([{ opacity: 0, transform: 'translateX(0)' }, { opacity: 1, transform: `translateX(${w * 0.5}px)`, offset: 0.5 }, { opacity: 0, transform: `translateX(${w}px)` }], { duration: 520, easing: 'ease-in-out' });
            }
          }],
          [3800, () => est('enviando')],
          [5300, () => est('emitida')],
          [9800, () => tarjetas.forEach((t) => desaparecer(t, 300))],
        ],
      };
    };
  };

  if (mosaico && !quieto) {
    const mini = (n) => mosaico.querySelector(`[data-mini="${n}"]`);
    // desfase de la primera vuelta de cada tesela, para que no cambien todas a la vez
    programa(0, progWeb(mini('web')));
    programa(120, progPlano(mini('plano')));
    programa(300, progChat(mini('chat')));
    programa(500, progCamara(mini('cam')));
    programa(0, progSensor(mini('sen')));
    programa(0, progPuerta(mini('sen')));
    programa(700, progMenu(mini('menu')));
    programa(0, progInventario(mini('inv')));
    programa(2000, progCobro(mini('cobro')));

    let corriendo = false;
    let pausadoPorUsuario = false;
    let enPantalla = true;
    let ultimo = 0;
    let detenidas = [];
    const cuadro = (ahora) => {
      if (!corriendo) return;
      const dt = Math.min(64, ahora - ultimo);
      ultimo = ahora;
      for (const p of programas) {
        p.t += dt;
        while (p.t >= 0 && p.i < p.pasos.length && p.t >= p.pasos[p.i][0]) {
          p.pasos[p.i][1]();
          p.i += 1;
        }
        if (p.t >= p.dur) {
          p.t -= p.dur;
          p.i = 0;
          Object.assign(p, p.armar());
        }
      }
      requestAnimationFrame(cuadro);
    };
    const arrancar = () => {
      if (corriendo || pausadoPorUsuario || !enPantalla || document.hidden) return;
      corriendo = true;
      detenidas.forEach((a) => a.play());
      detenidas = [];
      ultimo = performance.now();
      requestAnimationFrame(cuadro);
    };
    const detener = () => {
      if (!corriendo) return;
      corriendo = false;
      detenidas = mosaico.getAnimations({ subtree: true }).filter((a) => a.playState === 'running');
      detenidas.forEach((a) => a.pause());
    };
    botonPausa.hidden = false;
    botonPausa.addEventListener('click', () => {
      pausadoPorUsuario = !pausadoPorUsuario;
      botonPausa.querySelector('span').textContent = pausadoPorUsuario ? 'Reproducir' : 'Pausar';
      botonPausa.toggleAttribute('data-pausado', pausadoPorUsuario);
      if (pausadoPorUsuario) detener();
      else arrancar();
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? detener() : arrancar()));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        enPantalla = e.isIntersecting;
        if (enPantalla) arrancar();
        else detener();
      }, { threshold: 0.08 }).observe(mosaico);
    }
    arrancar();
  }

  /* ══ negocios que rotan: un tipo de negocio cada 5.5 s, con su foto y lo que solemos hacer ══ */
  const rot = document.querySelector('[data-rotador]');
  if (rot) {
    const tabs = [...rot.querySelectorAll('[role="tab"]')];
    const boton = rot.querySelector('[data-pausa-rotador]');
    const DUR = 5500;
    let actual = 0;
    let barra = null;
    let auto = !quieto;
    let enPantalla = false;
    const precargar = (k) => {
      const img = document.getElementById(tabs[k].getAttribute('aria-controls'))?.querySelector('img');
      if (img) img.loading = 'eager';
    };
    const correrBarra = () => {
      barra?.cancel();
      barra = null;
      if (!auto) return;
      barra = tabs[actual].querySelector('.nr__barra').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DUR, easing: 'linear' });
      barra.onfinish = () => elegir((actual + 1) % tabs.length, false);
      if (!enPantalla) barra.pause();
    };
    const elegir = (k, enfocar) => {
      actual = k;
      tabs.forEach((t, j) => {
        const si = j === k;
        t.setAttribute('aria-selected', String(si));
        t.tabIndex = si ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) {
          panel.hidden = !si;
          if (si && !quieto) panel.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: EASE });
        }
      });
      if (enfocar) tabs[k].focus();
      precargar((k + 1) % tabs.length);
      correrBarra();
    };
    const ponerBoton = () => {
      boton.querySelector('span').textContent = auto ? 'Pausar' : 'Reproducir';
      boton.toggleAttribute('data-pausado', !auto);
    };
    const detenerAuto = () => {
      if (!auto) return;
      auto = false;
      ponerBoton();
      barra?.cancel();
      barra = null;
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => {
        detenerAuto();
        elegir(i);
      });
      t.addEventListener('keydown', (e) => {
        const sig = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        let n = null;
        if (sig) n = (i + sig + tabs.length) % tabs.length;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = tabs.length - 1;
        if (n !== null) {
          e.preventDefault();
          detenerAuto();
          elegir(n, true);
        }
      });
    });
    if (!quieto) {
      boton.hidden = false;
      ponerBoton();
      boton.addEventListener('click', () => {
        auto = !auto;
        ponerBoton();
        correrBarra();
      });
      precargar(1);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => {
          enPantalla = e.isIntersecting;
          if (!barra) {
            if (enPantalla) correrBarra();
          } else if (enPantalla) barra.play();
          else barra.pause();
        }, { threshold: 0.3 }).observe(rot);
      } else {
        enPantalla = true;
        correrBarra();
      }
    }
  }
})();
