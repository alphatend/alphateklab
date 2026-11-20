// p21 «Dos tonos»: the page's own behaviour. The kit (system.js, motion.js, layout.js) runs the nav,
// the hovers, the hero's entrance and the moment; this file runs the proposal form, «Copiar», the
// tabs, the avisos that reach the phone in the hero, and the search «¿Qué necesitas?».

// ---------------------------------------------------------------- the proposal form (BRIEF.md)
const NOTA = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
document.querySelectorAll('[data-pregunta]').forEach((form) => {
  const nota = form.querySelector('[data-pregunta-nota]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (nota) nota.textContent = NOTA;
  });
});

// ---------------------------------------------------------------- «Copiar» (alphateklab's assets/v2.js, lines 123-138)
// the clipboard when it is there; else the address is selected so it can be copied by hand
document.querySelectorAll('[data-copiar]').forEach((b) =>
  b.addEventListener('click', () => {
    const correo = b.parentElement.querySelector('[data-correo]');
    const texto = b.querySelector('[data-copiar-texto]') || b;
    const listo = () => {
      texto.textContent = 'Copiado';
      setTimeout(() => (texto.textContent = 'Copiar'), 1800);
    };
    const seleccionar = () => {
      const r = document.createRange();
      r.selectNodeContents(correo);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
    } else {
      seleccionar();
    }
  }),
);

// ---------------------------------------------------------------- tabs: click or arrow keys, never timed
function tabs(list, onShow) {
  const all = [...list.querySelectorAll('[role="tab"]')];
  const show = (tab, focus) => {
    all.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (!panel) return;
      panel.hidden = !on;
      if (on && onShow) onShow(panel);
    });
    if (focus) tab.focus();
  };
  all.forEach((t, i) => {
    t.addEventListener('click', () => { if (t.getAttribute('aria-selected') !== 'true') show(t); });
    t.addEventListener('keydown', (e) => {
      const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); show(all[(i + k + all.length) % all.length], true); }
      if (e.key === 'Home') { e.preventDefault(); show(all[0], true); }
      if (e.key === 'End') { e.preventDefault(); show(all[all.length - 1], true); }
    });
  });
}
const entrar = (panel) => {
  panel.classList.remove('is-entrando');
  void panel.offsetWidth;
  panel.classList.add('is-entrando');
};
document.querySelectorAll('[role="tablist"]').forEach((list) => tabs(list, entrar));

// ---------------------------------------------------------------- the hero: three avisos reach the phone, once
// Each aviso waits in its own slot (no layout shift); the panel's row for that equipment lights at the
// same moment. Without script, under reduced motion or on a phone they simply stand.
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('avisos-espera')) return;
  const avisos = [...document.querySelectorAll('.dos-stage .aviso')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!avisos.length || reduce) { root.classList.remove('avisos-espera'); return; }
  const fila = (id) => document.querySelector(`.dos-stage [data-eq="${id}"]`);
  avisos.forEach((a, i) => {
    setTimeout(() => {
      a.classList.add('is-in');
      const f = fila(a.dataset.eq);
      if (f) f.classList.add(a.classList.contains('aviso--alerta') ? 'is-alerta' : 'is-nuevo');
      if (f && a.dataset.estado) {
        const tag = f.querySelector('.tag');
        if (tag) { tag.textContent = a.dataset.estado; tag.className = 'tag ' + (a.classList.contains('aviso--alerta') ? 'tag--aviso' : 'tag--azul'); }
      }
    }, 900 + i * 750);
  });
  setTimeout(() => root.classList.remove('avisos-espera'), 900 + avisos.length * 750 + 600);
})();

// ---------------------------------------------------------------- «¿Qué necesitas?»: the services whose name or line hold the words typed
document.querySelectorAll('[data-buscar]').forEach((form) => {
  const input = form.querySelector('input');
  const res = form.querySelector('[data-buscar-res]');
  const nada = form.querySelector('[data-buscar-nada]');
  let idx = [];
  try { idx = JSON.parse(form.querySelector('[data-buscar-idx]').textContent); } catch (e) { return; }
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set('que los las del por para con una uno unos unas mis tus sus mas pero como cuando donde quiero necesito tengo hay esta este esto ese esa sea son ser muy algo todo toda todos cada otra otro les nos mi tu su de la el en un y o a'.split(' '));
  const docs = idx.map((s) => ({ s, t: norm(s.n + ' ' + s.d), n: norm(s.n) }));
  const run = () => {
    const words = norm(input.value).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3 && !STOP.has(w));
    res.textContent = '';
    if (!words.length) { res.hidden = true; nada.hidden = true; return; }
    const hits = docs.map((d) => {
      let score = 0;
      for (const w of words) {
        const stem = w.length > 5 ? w.slice(0, w.length - 2) : w;
        if (d.n.includes(stem)) score += 2; else if (d.t.includes(stem)) score += 1;
      }
      return { d, score };
    }).filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    if (!hits.length) { res.hidden = true; nada.hidden = false; return; }
    nada.hidden = true;
    res.hidden = false;
    for (const { d } of hits) {
      const a = document.createElement('a');
      a.href = d.s.h;
      const b = document.createElement('b'); b.textContent = d.s.n;
      const s = document.createElement('span'); s.textContent = d.s.d;
      a.append(b, s);
      res.append(a);
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
  input.addEventListener('input', () => { if (!input.value.trim()) run(); });
});
