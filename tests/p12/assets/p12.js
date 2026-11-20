// p12 · navy con degradado: the page's own behaviour on top of the kit (system.js, motion.js).
// 1. the panel: avisos arrive once at the top of the feed, the equipment value flips, the phone gets the note
// 2. negocios: the live panel switches business with its tabs and plays that business's avisos
// 3. the form: preventDefault and the note; the email's Copiar button (from assets/v2.js of the source)
// 4. servicios: the search filters the 79 services
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const done = () => document.documentElement.classList.add('p12-done');

/* ---------- 1. a row arrives at the top: the others make room by transform (FLIP), never by height ---------- */
function arrive(row) {
  const list = row.parentElement;
  const others = [...list.children].filter((r) => r !== row && getComputedStyle(r).display !== 'none');
  const before = new Map(others.map((r) => [r, r.getBoundingClientRect().top]));
  row.classList.add('is-shown', 'is-new');
  if (!still) {
    others.forEach((r) => {
      const d = before.get(r) - r.getBoundingClientRect().top;
      if (d) r.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 520, easing: EASE });
    });
  }
  requestAnimationFrame(() => requestAnimationFrame(() => row.classList.add('is-in')));
}

async function play(app) {
  const rows = [...app.querySelectorAll('[data-arrive]')].sort((a, b) => a.dataset.arrive - b.dataset.arrive);
  if (!rows.length) return;
  await wait(still ? 300 : 1300);
  for (const row of rows) {
    arrive(row);
    const flip = row.dataset.flip && app.querySelector(row.dataset.flip);
    if (flip) {
      flip.classList.add('is-alert');
      const v = flip.querySelector('.eq__val');
      if (v && flip.dataset.to) v.textContent = flip.dataset.to;
    }
    const note = row.dataset.note && document.querySelector(row.dataset.note);
    if (note) arrive(note);
    await wait(still ? 120 : 1250);
  }
}

const hero = document.querySelector('[data-panel="hero"]');
if (hero) play(hero).then(done); else done();
setTimeout(done, 7000);

/* ---------- 2. the live panel on negocios.html ---------- */
const RUBROS = {
  restaurante: {
    nombre: 'Fonda Pixbae', tipo: 'Restaurante de ejemplo en Ciudad de Panamá', avatar: 'FP',
    kpis: [['Ventas de hoy', 'B/. 612.40'], ['Pedidos por QR', '41']],
    equipos: [['i-qr-code', 'QR en las mesas', '41 pedidos'], ['i-monitor', 'Pantalla de cocina', '3 órdenes'], ['i-thermometer-simple', 'Sensor de la nevera', '4.1 °C', '8.9 °C'], ['i-security-camera', 'Cámara de la puerta', '63 personas']],
    antes: [['i-clipboard-text', 'Mesa 7 pidió la cuenta dividida en 3.', 'Desde el QR de la mesa', '12:20', ['Cuenta', '']]],
    llegan: [
      ['order', 'i-fork-knife', 'Mesa 4 pidió 2 patacones con ceviche y 1 chicha de piña.', 'B/. 9.50, desde el QR de la mesa', '12:41', ['Pedido', 'em']],
      ['ok', 'i-calendar-check', 'Reserva confirmada: mesa para 6, sábado a las 8:00 p. m.', 'Desde tu página, con recordatorio', '13:05', ['Reserva', 'blue']],
      ['alert', 'i-thermometer-simple', 'La nevera 2 subió a 8.9 °C.', 'La puerta lleva 6 minutos abierta', '15:02', ['Aviso', 'alert'], 2],
    ],
  },
  tienda: {
    nombre: 'Minisúper de ejemplo', tipo: 'Tienda de barrio en Panamá', avatar: 'MS',
    kpis: [['Ventas de hoy', 'B/. 1,840.50'], ['Visitas hoy', '219']],
    equipos: [['i-security-camera', 'Cámara que cuenta', '219 visitas'], ['i-contactless-payment', 'Caja y cobro', '97 ventas'], ['i-cube-focus', 'Inventario', '3 por pedir', '4 por pedir'], ['i-lightning', 'Consumo eléctrico', '43 kWh']],
    antes: [['i-clipboard-text', 'Factura electrónica enviada al cliente de la venta 0457.', 'Caja 1', '13:02', ['Factura', '']]],
    llegan: [
      ['order', 'i-credit-card', 'Venta 0458: B/. 23.75 con tarjeta.', 'Factura electrónica enviada', '13:14', ['Venta', 'em']],
      ['alert', 'i-cube-focus', 'Arroz de 5 lb: quedan 6.', 'Al ritmo de hoy se acaba el jueves', '16:30', ['Inventario', 'alert'], 2],
      ['ok', 'i-chart-line-up', 'La hora pico de hoy fue de 5 a 7 p. m.', 'Cámara de la entrada', '19:00', ['Resumen', 'blue']],
    ],
  },
  clinica: {
    nombre: 'Clínica de ejemplo', tipo: 'Consultorio en Ciudad de Panamá', avatar: 'CE',
    kpis: [['Citas hoy', '18'], ['Confirmadas', '16']],
    equipos: [['i-calendar-check', 'Agenda en línea', '18 citas'], ['i-chat-circle-dots', 'Recordatorios', '16 confirmadas'], ['i-monitor', 'Pantalla de turnos', 'Turno 12'], ['i-robot', 'Asistente con IA', '9 chats']],
    antes: [['i-chat-circle-dots', 'Recordatorio enviado a los 18 pacientes de mañana.', 'Por WhatsApp', '08:00', ['Enviado', '']]],
    llegan: [
      ['ok', 'i-calendar-check', 'Cita confirmada: martes 10:30 a. m., consulta de control.', 'El paciente confirmó con un toque', '10:15', ['Cita', 'blue']],
      ['order', 'i-robot', 'El asistente agendó una cita a las 10:47 p. m.', 'Con la clínica cerrada', '22:47', ['Nueva', 'em']],
      ['alert', 'i-bell-ringing', 'Aviso: 2 pacientes de mañana no han confirmado.', 'A tiempo para llamarlos', '17:00', ['Aviso', 'alert']],
    ],
  },
  hotel: {
    nombre: 'Cabañas de ejemplo', tipo: 'Hospedaje en Chiriquí', avatar: 'CA',
    kpis: [['Reservas directas', '3 esta semana'], ['Ahorro en comisiones', 'B/. 108']],
    equipos: [['i-lock-key', 'Cerraduras con código', '4 cabañas'], ['i-calendar-check', 'Reservas directas', '3 esta semana'], ['i-broadcast', 'Booking y Airbnb', 'Al día'], ['i-thermometer-simple', 'Tanque de agua', '78 %', '20 %']],
    antes: [['i-lock-key', 'Código de la cabaña 2 enviado al huésped.', 'Válido solo para sus fechas', '09:20', ['Código', '']]],
    llegan: [
      ['order', 'i-calendar-check', 'Reserva directa: cabaña 2, del 21 al 23.', 'B/. 240 pagados con Yappy', '09:12', ['Reserva', 'em']],
      ['ok', 'i-broadcast', 'Booking y Airbnb ya bloquearon esas fechas.', 'Calendario al día', '09:13', ['Calendario', 'blue']],
      ['alert', 'i-thermometer-simple', 'Aviso: el tanque de agua bajó al 20 %.', 'Cabañas de arriba', '19:40', ['Aviso', 'alert'], 3],
    ],
  },
  bodega: {
    nombre: 'Bodega de ejemplo', tipo: 'Distribuidora en Panamá', avatar: 'BE',
    kpis: [['Camiones en ruta', '3'], ['Entradas hoy', '13']],
    equipos: [['i-broadcast', 'Sensor del motor 3', 'Normal', 'Vibración alta'], ['i-thermometer-simple', 'Nivel del tanque 1', '58 %'], ['i-map-pin', 'GPS de la flota', '3 en ruta'], ['i-shield-check', 'Control de acceso', '13 entradas']],
    antes: [['i-map-pin', 'El camión 2 salió rumbo a David con el pedido 2220.', 'GPS de la flota', '07:10', ['Ruta', '']]],
    llegan: [
      ['ok', 'i-shield-check', '13 personas entraron antes de las 8 a. m.', 'Control de acceso', '07:58', ['Accesos', 'blue']],
      ['order', 'i-map-pin', 'El camión 2 llegó a David y entregó el pedido 2220.', 'Con firma del cliente', '11:40', ['Entrega', 'em']],
      ['alert', 'i-broadcast', 'Aviso: el motor 3 vibra fuera de lo normal.', 'Conviene revisarlo hoy', '14:25', ['Aviso', 'alert'], 0],
    ],
  },
};
const ico = (id) => `<svg class="i" aria-hidden="true"><use href="#${id}"></use></svg>`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function rowHtml([kind, icon, title, sub, time, [label, tone]], arriveAt, flip) {
  const cls = kind === 'alert' ? 'feed__row--alert' : kind === 'order' ? 'feed__row--order' : kind === 'ok' ? 'feed__row--ok' : '';
  const a = arriveAt != null ? ` data-arrive="${arriveAt}"` : '';
  const f = flip != null ? ` data-flip="[data-eq='${flip}']"` : '';
  return `<li class="feed__row ${cls}"${a}${f}><span class="feed__ico">${ico(icon)}</span><span class="feed__txt"><b>${esc(title)}</b><span>${esc(sub)}</span></span><span class="feed__meta"><span>${time}</span><span class="tag${tone ? ` tag--${tone}` : ''}">${label}</span></span></li>`;
}
function renderLive(app, key) {
  const r = RUBROS[key];
  if (!r) return;
  app.querySelector('[data-l="avatar"]').textContent = r.avatar;
  app.querySelector('[data-l="nombre"]').textContent = r.nombre;
  app.querySelector('[data-l="tipo"]').textContent = r.tipo;
  app.querySelector('[data-l="titulo"]').textContent = r.nombre;
  app.querySelector('[data-l="kpis"]').innerHTML = r.kpis.map(([k, v]) => `<div class="kpi"><small>${k}</small><b>${v}</b></div>`).join('');
  app.querySelector('[data-l="equipos"]').innerHTML = r.equipos.map(([i, n, v, to], ix) => `<li class="eq__row" data-eq="${ix}"${to ? ` data-to="${to}"` : ''}>${ico(i)}<span>${n}</span><span class="eq__val">${v}</span></li>`).join('');
  const llegan = [...r.llegan].reverse();
  app.querySelector('[data-l="feed"]').innerHTML = llegan.map((x, ix) => rowHtml(x, llegan.length - ix, x[6])).join('') + r.antes.map((x) => rowHtml(['', ...x])).join('');
  app.querySelector('[data-l="count"]').textContent = `${r.llegan.length} nuevos`;
}
const live = document.querySelector('[data-panel="live"]');
if (live) {
  const tabs = [...document.querySelectorAll('[data-rubro]')];
  let run = 0;
  const go = async (key) => {
    const me = ++run;
    renderLive(live, key);
    live.classList.add('is-playing');
    await play(live);
    if (me === run) live.classList.remove('is-playing');
  };
  tabs.forEach((t) => t.addEventListener('click', () => go(t.dataset.rubro)));
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); go((tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0]).dataset.rubro); }
  }, { threshold: 0.35 });
  io.observe(live);
}

/* ---------- 3. the form: the note, and the copy button ---------- */
document.querySelectorAll('form[data-pedido]').forEach((form) => {
  const text = form.querySelector('textarea');
  const note = form.querySelector('[data-nota]');
  const err = form.querySelector('[data-error]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!text.value.trim()) {
      text.setAttribute('aria-invalid', 'true');
      err.hidden = false;
      note.textContent = '';
      text.focus();
      return;
    }
    text.removeAttribute('aria-invalid');
    err.hidden = true;
    note.textContent = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
  });
  text.addEventListener('input', () => { if (text.value.trim()) { text.removeAttribute('aria-invalid'); err.hidden = true; } });
});
// a link that asks for a package or a business writes its words into the empty form
document.querySelectorAll('[data-mensaje]').forEach((a) => a.addEventListener('click', () => {
  const t = document.querySelector('form[data-pedido] textarea');
  if (t && !t.value.trim()) t.value = `${a.dataset.mensaje} `;
}));
// copy the email (the clipboard, with the select-text fallback of the source's assets/v2.js)
document.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', () => {
  const correo = b.parentElement.querySelector('[data-correo]');
  const label = b.querySelector('span') || b;
  const listo = () => { label.textContent = 'Copiado'; setTimeout(() => (label.textContent = 'Copiar'), 1800); };
  const marcar = () => {
    const r = document.createRange();
    r.selectNodeContents(correo);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(correo.textContent.trim()).then(listo, marcar);
  else marcar();
}));

/* ---------- 4. servicios: the search ---------- */
const q = document.querySelector('[data-buscar]');
if (q) {
  const out = document.querySelector('[data-resultados]');
  const list = out.querySelector('[data-lista]');
  const say = out.querySelector('[data-cuenta]');
  const all = [...new Map([...document.querySelectorAll('.svc-list a')].map((a) => [a.getAttribute('href'), a])).values()];
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'y', 'en', 'un', 'una', 'que', 'para', 'con', 'mi', 'mis', 'por', 'a', 'al', 'del', 'se', 'lo', 'quiero', 'necesito', 'me', 'tu', 'su']);
  q.addEventListener('input', () => {
    const words = norm(q.value).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !STOP.has(w));
    if (!words.length) { out.hidden = true; return; }
    const hits = all.map((a) => {
      const t = norm(a.textContent);
      const score = words.reduce((n, w) => n + (t.includes(w) ? 1 : t.includes(w.slice(0, -1)) ? 0.6 : 0), 0);
      return [score, a];
    }).filter(([s]) => s > 0).sort((x, y) => y[0] - x[0]).slice(0, 8);
    list.innerHTML = '';
    hits.forEach(([, a]) => list.appendChild(a.cloneNode(true)));
    say.textContent = hits.length ? `${hits.length === 8 ? 'Los 8 más parecidos' : hits.length === 1 ? '1 servicio' : `${hits.length} servicios`} a lo que escribiste.` : 'Ninguno se parece. Escríbelo abajo con tus palabras y te decimos si lo hacemos.';
    out.hidden = false;
  });
  q.closest('form')?.addEventListener('submit', (e) => e.preventDefault());
}
