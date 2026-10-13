// Lo que se hace en cada demo antes de fotografiarla (herramientas/capturas.mjs y herramientas/tarjetas-demos.mjs),
// para que se vea trabajando y no vacía.
export const PREPARAR = {
  // mesa: la carta de la mesa 7 con las fotos de los platos (lo que ve el comensal), no la portada con la placa
  mesa: async (p) => {
    const href = await p.getAttribute('#abrir-mesa-telefono', 'href');
    await p.goto(new URL(href, p.url()).href, { waitUntil: 'load' });
    await p.waitForSelector('img.plato__foto');
    await p.evaluate(async () => {
      const fotos = [...document.querySelectorAll('img.plato__foto')];
      for (const f of fotos) f.loading = 'eager';
      await Promise.all(fotos.map((f) => (f.complete ? null : new Promise((listo) => { f.onload = f.onerror = listo; }))));
    });
    await p.addStyleTag({ content: '.barra-demo { display: none !important; }' });
    await p.waitForTimeout(600);
  },
  // reservas: la agenda de recepción con el día lleno, no la portada de la demo (que es casi todo texto)
  reservas: async (p) => {
    await p.goto(new URL('citas.html', p.url()).href, { waitUntil: 'load' });
    await p.waitForTimeout(1500);
  },
};

// las demos de otros repos se abren en local con la misma ruta que tienen en GitHub Pages
export const local = (url, BASE) => url.replace('https://alphatend.github.io', BASE).replace(/^(?!http)/, `${BASE}/alphateklab/`);
