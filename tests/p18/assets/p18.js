/* p18: the page's own script. The kit's system.js, motion.js and layout.js do the nav, the hover layer, the hero's
   entrance and the moment; this file does only what is alphateklab's:
   - the band's pause disc (it drifts more than 5 s) and its rest while off screen;
   - the hero's story: once, after the entrance, a new order arrives on the board and its aviso on the phone;
   - the form: «Pedir mi propuesta» shows where the message goes (the brief's note), and «Copiar» copies the email
     with the source site's select-text fallback (alphateklab-portada-v2/assets/v2.js);
   - the services page's search, «¿Qué necesitas?». */
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* the band: a pause disc, and no drawing while it is off screen */
const PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="2.6" height="10" rx="1"/><rect x="9.4" y="3" width="2.6" height="10" rx="1"/></svg>';
const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.25 3.7v8.6c0 .62.68 1 1.2.66l6.5-4.3c.47-.31.47-1 0-1.32l-6.5-4.3c-.52-.34-1.2.04-1.2.66Z"/></svg>';
document.querySelectorAll('.band').forEach((band) => {
  if (!reduced()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'loop-pause band-pause';
    const show = () => {
      const held = band.classList.contains('is-held');
      b.innerHTML = held ? PLAY : PAUSE;
      b.setAttribute('aria-label', held ? 'Mover el degradado' : 'Detener el degradado');
      b.title = b.getAttribute('aria-label');
    };
    b.addEventListener('click', () => { band.classList.toggle('is-held'); show(); });
    show();
    band.after(b);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((e) => band.classList.toggle('is-off', !e.isIntersecting)), { rootMargin: '60px' }).observe(band);
  }
});

/* the hero's band: the same picture as the inner pages' CSS band, drawn on one canvas layer behind the hero so the
   product overlaps its bottom edge. Half resolution (the band is soft), about 30 frames a second, only while on screen;
   reduced motion draws one still frame; the disc holds it. */
const heroBand = document.querySelector('canvas.hero-band');
if (heroBand && heroBand.getContext) {
  const hero = heroBand.parentElement, show = hero.querySelector('.hero__show'), ctx = heroBand.getContext('2d');
  const K = 0.5;
  let W = 0, geo = null, held = false, seen = true, raf = 0, last = 0, t0 = performance.now();
  // [x, y] in the moving layer (124% of the width, 170% of the band's height), radii in the same box, colour, cycle (s)
  const LAYERS = [
    { T: 26, ax: 0.065, ay: 0.025, blobs: [[0.18, 0.42, 0.34, 0.58, '6,182,212', 0.78], [0.58, 0.64, 0.30, 0.62, '29,78,216', 0.85], [0.86, 0.36, 0.26, 0.46, '165,243,252', 0.7]] },
    { T: 34, ax: -0.075, ay: -0.025, blobs: [[0.40, 0.30, 0.30, 0.52, '56,189,248', 0.62], [0.74, 0.78, 0.22, 0.40, '37,99,235', 0.7]] },
    { T: 38, ax: 0.065, ay: 0.04, blobs: [[0.82, 0.30, 0.09, 0.22, '255,236,190', 0.95], [0.84, 0.32, 0.14, 0.30, '242,181,68', 0.55]] },
  ];
  const size = () => {
    const r = heroBand.getBoundingClientRect(), s = show.getBoundingClientRect(), phone = r.width < 640;
    W = r.width;
    heroBand.width = Math.max(1, Math.round(r.width * K));
    heroBand.height = Math.max(1, Math.round(r.height * K));
    const lift = phone ? 20 : 28;
    geo = { top: s.top - r.top - lift, h: s.height * (phone ? 0.7 : 0.64) + lift };
  };
  const draw = (now) => {
    if (!geo) return;
    const { top, h } = geo, t = (now - t0) / 1000;
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.clearRect(0, 0, W, heroBand.height / K);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, top + 0.16 * h); ctx.lineTo(W, top); ctx.lineTo(W, top + 0.84 * h); ctx.lineTo(0, top + h); ctx.closePath();
    ctx.clip();
    const base = ctx.createLinearGradient(0, top + h, W, top);
    [[0, '#1e4fd9'], [0.26, '#2563eb'], [0.52, '#1a8fe6'], [0.78, '#06b6d4'], [1, '#3fcbe0']].forEach(([o, c]) => base.addColorStop(o, c));
    ctx.fillStyle = base;
    ctx.fillRect(0, top, W, h);
    const bw = W * 1.24, bh = h * 1.7;
    for (const L of LAYERS) {
      const k = Math.sin((2 * Math.PI * t) / (2 * L.T));
      const ox = -0.12 * W + L.ax * W * k, oy = top - 0.35 * h + L.ay * h * k;
      for (const [fx, fy, rx, ry, rgb, a] of L.blobs) {
        ctx.save();
        ctx.translate(ox + fx * bw, oy + fy * bh);
        ctx.scale(rx * bw, ry * bh);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, `rgba(${rgb},${a})`);
        g.addColorStop(0.7, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }
    }
    ctx.restore();
  };
  const loop = (now) => {
    raf = 0;
    if (held || !seen || reduced()) return;
    if (now - last > 32) { draw(now); last = now; }
    raf = requestAnimationFrame(loop);
  };
  const go = () => { if (!raf && !held && seen && !reduced()) raf = requestAnimationFrame(loop); };
  const redraw = () => { size(); draw(performance.now()); go(); };
  redraw();
  if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(hero);
  document.fonts?.ready.then(redraw);
  addEventListener('load', redraw, { once: true });
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => es.forEach((e) => { seen = e.isIntersecting; go(); })).observe(hero);
  document.addEventListener('visibilitychange', () => { seen = document.visibilityState === 'visible'; go(); });
  if (!reduced()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'loop-pause band-pause';
    const show2 = () => {
      b.innerHTML = held ? PLAY : PAUSE;
      b.setAttribute('aria-label', held ? 'Mover el degradado' : 'Detener el degradado');
      b.title = b.getAttribute('aria-label');
    };
    b.addEventListener('click', () => { held = !held; show2(); go(); });
    show2();
    show.append(b);
  }
}

/* the hero's story: the order and its aviso arrive once, 1.3 s after load (the entrance is about 1.1 s) */
const story = [...document.querySelectorAll('.story')];
if (story.length) {
  const run = () => story.forEach((el, i) => setTimeout(() => el.classList.add('is-in'), i * 520));
  if (reduced()) story.forEach((el) => el.classList.add('is-in'));
  else if (document.readyState === 'complete') setTimeout(run, 1300);
  else addEventListener('load', () => setTimeout(run, 1300), { once: true });
}

/* the form: no send yet, so the note says where the message goes */
document.querySelectorAll('[data-pregunta]').forEach((form) => {
  const nota = form.querySelector('[data-pregunta-nota]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    nota.textContent = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
  });
});
/* copy the email (inside some viewers a mailto: link does not open the mail app) */
document.querySelectorAll('[data-copiar]').forEach((b) =>
  b.addEventListener('click', () => {
    const correo = b.parentElement.querySelector('[data-correo]');
    const listo = () => {
      b.textContent = 'Copiado';
      setTimeout(() => (b.textContent = 'Copiar'), 1800);
    };
    const elegir = () => {
      const r = document.createRange();
      r.selectNodeContents(correo);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(correo.textContent.trim()).then(listo, elegir);
    else elegir();
  }),
);

/* «¿Qué necesitas?»: words against each service's name and line; the closest ones show under the box */
const caja = document.querySelector('[data-buscar]');
if (caja) {
  const salida = document.querySelector('[data-buscar-salida]');
  const pista = document.querySelector('[data-buscar-pista]');
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const VACIAS = new Set('de la el los las un una unos unas y o a en que con por para mi mis tu tus su sus del al me se lo le les quiero necesito tengo como cuando donde hay es son mas muy sin sobre'.split(' '));
  const seen = new Map();
  document.querySelectorAll('.all li a, .examples a').forEach((a) => {
    const href = a.getAttribute('href');
    if (seen.has(href)) return;
    const name = a.querySelector('b')?.textContent.trim() || '';
    const line = a.querySelector('span')?.textContent.trim() || '';
    seen.set(href, { href, name, line, text: norm(`${name} ${name} ${line}`) });
  });
  const items = [...seen.values()];
  const raiz = (w) => (w.length > 5 ? w.slice(0, w.length - 2) : w);
  const buscar = () => {
    const words = norm(caja.value).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !VACIAS.has(w)).map(raiz);
    salida.innerHTML = '';
    if (!words.length) { pista.textContent = 'Escribe con tus palabras, por ejemplo «que la nevera me avise» o «cobrar con Yappy».'; return; }
    const res = items.map((it) => ({ it, s: words.reduce((n, w) => n + (it.text.includes(w) ? 1 : 0), 0) }))
      .filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 5);
    pista.textContent = res.length ? `Lo más cercano a lo que escribiste (${res.length}):` : 'No lo tenemos descrito con esas palabras. Escríbenos abajo y te decimos si lo podemos hacer.';
    res.forEach(({ it }) => {
      const a = document.createElement('a');
      a.className = 'example';
      a.href = it.href;
      a.innerHTML = '<b></b><span></span>';
      a.querySelector('b').textContent = it.name;
      a.querySelector('span').textContent = it.line;
      salida.append(a);
    });
  };
  caja.addEventListener('input', buscar);
  caja.closest('form')?.addEventListener('submit', (e) => { e.preventDefault(); buscar(); });
}
