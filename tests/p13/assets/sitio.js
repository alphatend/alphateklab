/* alphateklab, propuesta 13. Sin dependencias. */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';

  /* ═══ cabecera: borde al bajar y menú del teléfono ═══ */
  const cabecera = document.querySelector('.cabecera');
  const marcarBorde = () => cabecera && cabecera.classList.toggle('con-borde', window.scrollY > 8);
  marcarBorde();
  window.addEventListener('scroll', marcarBorde, { passive: true });

  const botonMenu = document.querySelector('.menu-boton');
  const menuMovil = document.getElementById('menu-movil');
  const cerrarMenu = (devolverFoco) => {
    if (!botonMenu || botonMenu.getAttribute('aria-expanded') !== 'true') return;
    botonMenu.setAttribute('aria-expanded', 'false');
    botonMenu.setAttribute('aria-label', 'Abrir el menú');
    menuMovil.classList.remove('abierto');
    if (devolverFoco) botonMenu.focus();
  };
  botonMenu?.addEventListener('click', () => {
    const abrir = botonMenu.getAttribute('aria-expanded') !== 'true';
    botonMenu.setAttribute('aria-expanded', String(abrir));
    botonMenu.setAttribute('aria-label', abrir ? 'Cerrar el menú' : 'Abrir el menú');
    menuMovil.classList.toggle('abierto', abrir);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenu(true); });
  document.addEventListener('click', (e) => {
    if (!menuMovil || !botonMenu) return;
    if (!menuMovil.contains(e.target) && !botonMenu.contains(e.target)) cerrarMenu(false);
  });
  menuMovil?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => cerrarMenu(false)));

  /* ═══ el formulario: no se envía; dice a dónde llega ═══ */
  const form = document.querySelector('[data-pregunta]');
  const texto = form?.querySelector('textarea');
  const nota = form?.querySelector('[data-nota]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!texto.value.trim()) { texto.focus(); return; }
    nota.hidden = false;
    nota.classList.remove('entra-nota');
    void nota.offsetWidth;
    nota.classList.add('entra-nota');
  });

  // «Pedir mi propuesta» baja al formulario y deja el cursor en el campo (sin animar el salto: es una acción del usuario)
  document.querySelectorAll('a[href="#propuesta"]').forEach((a) =>
    a.addEventListener('click', () => { if (texto) setTimeout(() => texto.focus({ preventScroll: true }), 0); }),
  );

  // «Pedir este paquete» y parecidos: bajan al formulario con el mensaje ya escrito
  document.querySelectorAll('[data-mensaje]').forEach((a) =>
    a.addEventListener('click', () => {
      if (texto && !texto.value.trim()) texto.value = `${a.dataset.mensaje} `;
    }),
  );

  // copiar el correo (con la selección del texto si el portapapeles no deja), como en assets/v2.js
  document.querySelectorAll('[data-copiar]').forEach((b) =>
    b.addEventListener('click', () => {
      const correo = b.parentElement.querySelector('[data-correo]');
      const etiqueta = b.querySelector('span') || b;
      const listo = () => {
        etiqueta.textContent = 'Copiado';
        b.classList.add('hecho');
        setTimeout(() => { etiqueta.textContent = 'Copiar'; b.classList.remove('hecho'); }, 1800);
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

  /* ═══ índice de servicios: marca el tipo que se está leyendo ═══ */
  const enlacesIndice = [...document.querySelectorAll('.indice a[href^="#"]')];
  if (enlacesIndice.length && 'IntersectionObserver' in window) {
    const porId = new Map(enlacesIndice.map((a) => [a.getAttribute('href').slice(1), a]));
    const visibles = new Set();
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => (en.isIntersecting ? visibles.add(en.target.id) : visibles.delete(en.target.id)));
      const primero = [...porId.keys()].find((id) => visibles.has(id));
      if (primero) enlacesIndice.forEach((a) => a.classList.toggle('activo', a === porId.get(primero)));
    }, { rootMargin: '-30% 0px -60% 0px' });
    porId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ═══ buscador de servicios ═══ */
  const buscador = document.querySelector('[data-buscador]');
  if (buscador) {
    const entrada = buscador.querySelector('input');
    const caja = buscador.querySelector('[data-resultados]');
    const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const vistos = new Set();
    const servicios = [];
    document.querySelectorAll('.servs a').forEach((a) => {
      if (vistos.has(a.href)) return;
      vistos.add(a.href);
      const nombre = a.querySelector('b').textContent.trim();
      const desc = a.querySelector('small').textContent.trim();
      servicios.push({ href: a.href, nombre, desc, clave: normal(`${nombre} ${desc}`) });
    });
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const pintar = () => {
      const q = normal(entrada.value.trim());
      if (q.length < 2) { caja.hidden = true; caja.innerHTML = ''; return; }
      const palabras = q.split(/\s+/).filter((p) => p.length > 1);
      const hallados = servicios
        .map((s) => ({ s, puntos: palabras.reduce((n, p) => n + (s.clave.includes(p) ? 1 : 0) + (normal(s.nombre).includes(p) ? 1 : 0), 0) }))
        .filter((x) => x.puntos >= palabras.length)
        .sort((a, b) => b.puntos - a.puntos)
        .slice(0, 6);
      caja.hidden = false;
      if (!hallados.length) {
        caja.innerHTML = `<div class="panel resultados__vacio">No está en la lista con esas palabras. <a href="#propuesta" data-mensaje-buscar>Cuéntanos qué necesitas</a> y te decimos si lo podemos hacer.</div>`;
        caja.querySelector('[data-mensaje-buscar]').addEventListener('click', () => { if (texto && !texto.value.trim()) texto.value = entrada.value.trim(); });
        return;
      }
      caja.innerHTML = `<div class="panel"><p class="resultados__n">${hallados.length === 1 ? '1 servicio' : `${hallados.length} servicios`}</p><div class="resultados__lista">${hallados
        .map(({ s }) => `<a href="${esc(s.href)}"><b>${esc(s.nombre)}</b><small>${esc(s.desc)}</small></a>`)
        .join('')}</div></div>`;
    };
    entrada.addEventListener('input', pintar);
    buscador.addEventListener('submit', (e) => e.preventDefault());
  }

  /* ═══ el bento: las pantallas de ejemplo se mueven solas, conectadas entre sí ═══ */
  const bento = document.querySelector('[data-bento]');
  if (!bento) return;

  const $ = (sel) => bento.querySelector(sel);
  const pausa = document.querySelector('[data-pausa]');
  let enPausa = reduce.matches; // con «reducir movimiento» empieza quieto
  let visible = false;
  let segundo = 0;

  const dinero = (n) => `B/. ${n.toFixed(2)}`;
  const animar = (el, frames, opts) => (reduce.matches || !el.animate ? null : el.animate(frames, opts));

  // una cifra que cambia: se apaga con un poco de desenfoque, cambia y vuelve
  function cambiar(el, valor, alCambiar) {
    if (!el || el.textContent === valor) return;
    const pon = () => { el.textContent = valor; if (alCambiar) alCambiar(); };
    if (reduce.matches) { pon(); return; }
    el.classList.add('cambia');
    setTimeout(() => { pon(); el.classList.remove('cambia'); }, 180);
  }
  // una cifra de dinero que sube contando
  function contar(el, desde, hasta, ms = 700) {
    if (reduce.matches) { el.textContent = hasta.toFixed(2); return; }
    const t0 = performance.now();
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = (desde + (hasta - desde) * e).toFixed(2);
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  /* ── la cocina ── */
  const fila = $('.kds__fila');
  const horaCocina = $('[data-hora]');
  let minutoReloj = 12 * 60 + 41;
  function hora12(min) {
    const h = Math.floor(min / 60) % 24, m = min % 60;
    const suf = h >= 12 ? 'p. m.' : 'a. m.';
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suf}`;
  }
  function comandaHTML(mesa, platos, tipo) {
    return `<div class="comanda__cab"><b>${mesa}</b><span class="comanda__t" data-seg="0">0:00</span></div>
      <div class="comanda__tipo"><span class="tag tag--azul">Nuevo</span>${tipo ? `<span class="tag">${tipo}</span>` : ''}</div>
      <ul>${platos.map(([n, p]) => `<li><b>${n}</b>${p}</li>`).join('')}</ul>
      <div class="comanda__listo">Listo</div>`;
  }
  function nuevaComanda(mesa, platos, tipo) {
    if (!fila) return;
    const antes = [...fila.children].map((el) => [el, el.getBoundingClientRect().left]);
    const el = document.createElement('article');
    el.className = 'comanda es-nueva';
    el.innerHTML = comandaHTML(mesa, platos, tipo);
    fila.prepend(el);
    if (!reduce.matches) {
      antes.forEach(([n, x0]) => {
        const dx = x0 - n.getBoundingClientRect().left;
        if (dx) n.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], { duration: 560, easing: EASE_IN_OUT });
      });
      el.animate([{ opacity: 0, transform: 'translateY(-12px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: EASE_OUT, delay: 120, fill: 'backwards' });
    } else {
      el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    }
    while (fila.children.length > 6) fila.lastElementChild.remove();
    setTimeout(() => {
      el.classList.remove('es-nueva');
      const t = el.querySelector('.tag--azul');
      if (t) { t.className = 'tag'; t.textContent = 'En preparación'; }
    }, 6000);
    const n = $('[data-nuevos]');
    if (n) cambiar(n, String(Math.min(9, Number(n.textContent) + 1)));
  }
  function relojesCocina() {
    fila?.querySelectorAll('[data-seg]').forEach((t) => {
      const s = Number(t.dataset.seg) + 1;
      t.dataset.seg = s;
      t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      t.classList.toggle('tarde', s >= 900);
    });
  }

  /* ── el teléfono con el menú QR ── */
  const MESAS = ['Mesa 7', 'Mesa 3', 'Mesa 9', 'Mesa 5'];
  let mesaI = 0;
  const pedido = [];
  const mesaEl = $('[data-mesa]');
  const nEl = $('[data-n]');
  const totalEl = $('[data-total]');
  const barra = $('.qr__barra');
  const platos = [...bento.querySelectorAll('.qr__plato')];
  platos.forEach((p) => { if (p.querySelector('.qr__mas.puesto')) pedido.push({ nombre: p.dataset.corto, precio: Number(p.dataset.precio) }); });
  function tocar(el, clase = 'toca') {
    if (!el) return;
    el.classList.add(clase);
    setTimeout(() => el.classList.remove(clase), 180);
  }
  function agregar(i) {
    const p = platos[i];
    if (!p) return;
    const mas = p.querySelector('.qr__mas');
    tocar(mas);
    mas.classList.add('puesto');
    pedido.push({ nombre: p.dataset.corto, precio: Number(p.dataset.precio) });
    const total = pedido.reduce((t, x) => t + x.precio, 0);
    cambiar(nEl, String(pedido.length));
    cambiar(totalEl, dinero(total));
  }
  function enviarPedido() {
    if (!pedido.length) return;
    tocar(barra);
    barra.classList.add('enviado');
    const mesa = MESAS[mesaI];
    const cuenta = new Map();
    pedido.forEach((x) => cuenta.set(x.nombre, (cuenta.get(x.nombre) || 0) + 1));
    const total = pedido.reduce((t, x) => t + x.precio, 0);
    setTimeout(() => nuevaComanda(mesa, [...cuenta].map(([n, c]) => [c, n]), 'QR'), 700);
    setTimeout(() => venta(total, mesa), 2600);
  }
  function reiniciarMesa() {
    barra.classList.remove('enviado');
    platos.forEach((p) => p.querySelector('.qr__mas').classList.remove('puesto'));
    pedido.length = 0;
    mesaI = (mesaI + 1) % MESAS.length;
    cambiar(mesaEl, MESAS[mesaI]);
    agregar(0);
  }

  /* ── ventas del día ── */
  const ventasEl = $('[data-ventas]');
  const deltaEl = $('[data-delta]');
  const barraAhora = $('.barras i.ahora');
  let ventas = Number(ventasEl?.textContent || 612.4);
  let alturaAhora = Number(barraAhora?.style.getPropertyValue('--h') || 0.42);
  function venta(monto, quien) {
    if (!ventasEl) return;
    const antes = ventas;
    ventas = Math.round((ventas + monto) * 100) / 100;
    if (ventas > 900) { ventas = 612.4; }
    contar(ventasEl, ventas < antes ? ventas : antes, ventas);
    cambiar(deltaEl, `${quien}, hace un momento`);
    const tag = $('[data-delta-monto]');
    cambiar(tag, `+${dinero(monto)}`);
    alturaAhora = alturaAhora > 0.9 ? 0.32 : Math.min(0.95, alturaAhora + 0.08);
    if (barraAhora) barraAhora.style.transform = `scaleY(${alturaAhora})`;
  }

  /* ── la nevera ── */
  const sensor = $('.sensor');
  const valorNevera = $('[data-temp]');
  const avisoNevera = $('.b-nevera .aviso');
  const estadoNevera = $('[data-estado-nevera]');
  const avisoTxt = avisoNevera?.querySelector('.aviso__txt');
  function nevera(alerta) {
    // el aviso no se va: cambia a «volvió a 3.9 °C», como llegaría al teléfono
    if (avisoTxt) {
      const html = alerta
        ? '<b>Aviso: la nevera 2 subió a 8.9 °C</b><small>Cocina. El límite es 5 °C.</small>'
        : '<b>La nevera 2 volvió a 3.9 °C</b><small>Cocina. Está otra vez en rango.</small>';
      const pon = () => { avisoTxt.innerHTML = html; avisoNevera.classList.toggle('ok', !alerta); };
      if (reduce.matches) pon();
      else { avisoTxt.classList.add('cambia'); setTimeout(() => { pon(); avisoTxt.classList.remove('cambia'); }, 200); }
    }
    // el color, la cifra y la etiqueta cambian juntos, en el instante en que la cifra está apagada
    cambiar(valorNevera, alerta ? '8.9 °C' : '3.9 °C', () => sensor?.classList.toggle('alerta', alerta));
    cambiar(estadoNevera, alerta ? 'Fuera de rango' : 'En rango', () => { estadoNevera.className = `tag ${alerta ? 'tag--rojo' : 'tag--verde'} cifra`; });
  }

  /* ── el inventario ── */
  const filasInv = [...bento.querySelectorAll('.inv__fila')];
  function vender(i, cuanto) {
    const f = filasInv[i];
    if (!f) return;
    const max = Number(f.dataset.max);
    let n = Number(f.dataset.n) - cuanto;
    if (n < 4) n = max - 4; // llegó el pedido del proveedor
    f.dataset.n = n;
    cambiar(f.querySelector('[data-cant]'), String(n));
    f.querySelector('.inv__barra i').style.transform = `scaleX(${Math.max(0.04, n / max)})`;
    f.classList.toggle('baja', n <= Number(f.dataset.min));
  }

  /* ── la agenda: recordatorio y confirmación ── */
  const toast = $('.toast');
  const toastCuerpo = $('.toast__cuerpo');
  function toastTexto(titulo, sub, ok) {
    if (!toast) return;
    const pon = () => {
      toastCuerpo.innerHTML = `<b>${titulo}</b><small>${sub}</small>`;
      toast.classList.toggle('ok', ok);
    };
    if (reduce.matches || toast.classList.contains('oculto')) { pon(); return; }
    toastCuerpo.classList.add('cambia');
    setTimeout(() => { pon(); toastCuerpo.classList.remove('cambia'); }, 200);
  }

  /* ── el reloj: una vuelta de 20 segundos, cada pantalla en su momento ── */
  function tic() {
    segundo += 1;
    const s = segundo % 20;
    relojesCocina();
    if (segundo % 60 === 0) { minutoReloj += 1; cambiar(horaCocina, hora12(minutoReloj)); }

    // teléfono → cocina → ventas
    if (s === 3) agregar(1);
    if (s === 6) agregar(2);
    if (s === 9) enviarPedido();
    if (s === 15) reiniciarMesa();

    // otra comanda que entra por la caja, a su ritmo
    if (segundo % 40 === 27) nuevaComanda('Para llevar', [[2, 'Empanadas de maíz'], [1, 'Chicha de tamarindo']], 'Caja');
    if (segundo % 40 === 31) venta(9.75, 'Para llevar');

    // nevera: aviso y vuelta a la normalidad
    if (s === 1) nevera(false);
    if (s === 11) nevera(true);

    // inventario
    if (s === 5) vender(2, 1);
    if (s === 13) vender(0, 2);
    if (s === 18) vender(3, 1);

    // agenda
    if (s === 2) { toastTexto('Recordatorio enviado', 'Daniela Vergara, cita de mañana a la 1:00 p. m.', false); toast?.classList.remove('oculto'); }
    if (s === 8) toastTexto('Daniela Vergara confirmó', 'Respondió «Sí, ahí estaré» por WhatsApp.', true);
    if (s === 14) toast?.classList.add('oculto');
  }

  let reloj = null;
  const vivos = [...document.querySelectorAll('.vivo')];
  function actualizar() {
    const debe = !enPausa && visible && !document.hidden;
    if (debe && !reloj) reloj = setInterval(tic, 1000);
    if (!debe && reloj) { clearInterval(reloj); reloj = null; }
    vivos.forEach((v) => v.classList.toggle('corre', debe && !reduce.matches));
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; actualizar(); }, { rootMargin: '0px 0px -10% 0px' }).observe(bento);
  } else { visible = true; }
  document.addEventListener('visibilitychange', actualizar);

  function pintarPausa() {
    if (!pausa) return;
    pausa.setAttribute('aria-pressed', String(enPausa));
    pausa.querySelector('[data-pausa-txt]').textContent = enPausa ? 'Reanudar' : 'Pausar';
  }
  pausa?.addEventListener('click', () => { enPausa = !enPausa; pintarPausa(); actualizar(); });
  reduce.addEventListener?.('change', () => { enPausa = reduce.matches; pintarPausa(); actualizar(); });
  pintarPausa();
  actualizar();
})();
