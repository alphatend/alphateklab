// Lo que comparten las tres demos privadas (19-oct-2026): descargar cualquier tabla en CSV y una lista de «seguidos»
// guardada en este navegador. Nada sale del equipo: el CSV se arma con lo que ya está en la página.

/** Pone, encima de cada tabla `table.libro` de `donde`, un botón que la baja como CSV (separado por comas, UTF-8). */
export function conCsv(donde, nombreBase = 'tabla') {
  donde.querySelectorAll('table.libro').forEach((t, i) => {
    if (t.dataset.csv) return;
    t.dataset.csv = '1';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'csv';
    b.textContent = 'Descargar CSV';
    b.addEventListener('click', () => {
      const filas = [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => {
        const x = (c.querySelector('a')?.textContent ?? c.textContent).replace(/\s+/g, ' ').trim();
        return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
      }).join(','));
      const blob = new Blob(['﻿' + filas.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const titulo = (t.closest('section')?.querySelector('h2,h3')?.textContent || `${nombreBase}-${i + 1}`).trim();
      a.download = `${titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || nombreBase}.csv`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    (t.closest('.libro-env') || t).before(b);
  });
}

/** Los seguidos de una demo: [{ id, nombre, ruta }] en localStorage. Si el navegador no guarda, no pasa nada. */
const clave = (demo) => `atk-${demo}-seguidos`;
export function seguidos(demo) {
  try { return JSON.parse(localStorage.getItem(clave(demo)) || '[]'); } catch { return []; }
}
export function sigo(demo, id) { return seguidos(demo).some((x) => x.id === id); }
export function alternarSeguir(demo, item) {
  const l = seguidos(demo);
  const i = l.findIndex((x) => x.id === item.id);
  if (i >= 0) l.splice(i, 1); else l.unshift({ ...item, desde: new Date().toISOString().slice(0, 10) });
  try { localStorage.setItem(clave(demo), JSON.stringify(l.slice(0, 200))); } catch { /* sin almacenamiento */ }
  return i < 0;
}
/** Un botón «Seguir / Siguiendo» para una ficha. */
export function botonSeguir(demo, item) {
  const s = sigo(demo, item.id);
  return `<button type="button" class="seguir" data-seguir='${JSON.stringify(item).replace(/'/g, '&#39;')}' aria-pressed="${s}">${s ? 'Siguiendo' : 'Seguir'}</button>`;
}
export function activarSeguir(donde, demo) {
  donde.querySelectorAll('button.seguir[data-seguir]').forEach((b) => b.addEventListener('click', () => {
    const ahora = alternarSeguir(demo, JSON.parse(b.dataset.seguir));
    b.setAttribute('aria-pressed', String(ahora));
    b.textContent = ahora ? 'Siguiendo' : 'Seguir';
  }));
}
