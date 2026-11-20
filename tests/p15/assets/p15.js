// p15: the proposal form and the «Copiar» button (behaviour from alphateklab's assets/v2.js, lines 110-140).
// The kit (system.js, motion.js, layout.js) runs the nav, the hovers, the hero and the moment.
const NOTA = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';

document.querySelectorAll('[data-pregunta]').forEach((form) => {
  const nota = form.querySelector('[data-pregunta-nota]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (nota) nota.textContent = NOTA;
  });
});

// copiar el correo de contacto; si el portapapeles no está, se selecciona el texto para copiarlo a mano
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

// «Míralo funcionando»: tabs that swap the phone on a click or with the arrow keys (click only, never timed)
document.querySelectorAll('[role="tablist"]').forEach((list) => {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const show = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', (e) => {
      const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); show(tabs[(i + k + tabs.length) % tabs.length], true); }
      if (e.key === 'Home') { e.preventDefault(); show(tabs[0], true); }
      if (e.key === 'End') { e.preventDefault(); show(tabs[tabs.length - 1], true); }
    });
  });
});

// «¿Qué necesitas?»: finds the services whose name or line hold the words typed (accents and case ignored)
document.querySelectorAll('[data-buscar]').forEach((form) => {
  const input = form.querySelector('input');
  const res = form.querySelector('[data-buscar-res]');
  const nada = form.querySelector('[data-buscar-nada]');
  let idx = [];
  try { idx = JSON.parse(form.querySelector('[data-buscar-idx]').textContent); } catch (e) { return; }
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set('que los las del por para con una uno unos unas mis tus sus mas pero como cuando donde quiero necesito tengo hay esta este esto ese esa sea son ser muy algo todo toda todos cada otra otro les nos'.split(' '));
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
    }).filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
    for (const { d } of hits) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = d.s.h;
      const b = document.createElement('b'); b.textContent = d.s.n;
      const sp = document.createElement('span'); sp.textContent = d.s.d;
      a.append(b, sp); li.append(a); res.append(li);
    }
    res.hidden = !hits.length;
    nada.hidden = !!hits.length;
  };
  input.addEventListener('input', run);
  form.addEventListener('submit', (e) => { e.preventDefault(); run(); const first = res.querySelector('a'); if (first) first.focus(); });
});
