// alphateklab, propuesta 41: la historia del héroe. Un pedido de la mesa 4 recorre las seis tarjetas:
// reserva → pedido por QR → cocina → inventario → factura → reporte. Cada tarjeta se enciende con su sello «ahora».
//
// Decisiones (skill animate): es una animación de explicación en una página de mercadeo, vista una vez por visita.
// Cada cambio es una transición de CSS (opacity y transform, más un clip de escala en las barras), con la curva
// fuerte de salida para lo que entra y la de entrada y salida para lo que se mueve en pantalla. El reloj del guion es
// propio: el botón lo pausa, se detiene cuando el héroe no se ve y vuelve a empezar después de una pausa. El HTML trae
// el estado final, así que sin JavaScript o con «reducir movimiento» se ve la historia terminada y quieta.
(() => {
  const zona = document.querySelector('[data-historia]');
  if (!zona) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const q = (s) => zona.querySelector(s);
  const orden = ['reservas', 'pedidos', 'cocina', 'inventario', 'cobros', 'reportes'];
  const tarjetas = [...zona.querySelectorAll('[data-card]')];
  const segs = [...zona.querySelectorAll('[data-seg]')];
  const vals = {};
  zona.querySelectorAll('[data-val]').forEach((v) => (vals[v.dataset.val] = v));
  const fila = q('[data-fila-res]');
  const coc = q('[data-coc]');
  const inv = q('[data-inv]');
  const fac = q('[data-fac]');
  const rep = q('[data-rep]');
  const enviar = q('[data-enviar]');
  const reloj = q('[data-reloj]');
  const pausa = q('[data-pausa]');
  const platos = { patacones: q('[data-plato="patacones"]'), chicha: q('[data-plato="chicha"]') };

  // muestra el valor i de un grupo: los anteriores suben, los siguientes esperan abajo
  const val = (n, i) => {
    [...(vals[n]?.children || [])].forEach((c, j) => {
      c.classList.toggle('on', j === i);
      c.classList.toggle('antes', j < i);
    });
  };
  const toque = (n) => {
    const t = q(`[data-toque="${n}"]`);
    if (!t) return;
    t.classList.remove('toca');
    void t.offsetWidth; // vuelve a disparar el círculo del toque
    t.classList.add('toca');
  };
  const presionar = (el) => {
    el.classList.add('presiona');
    setTimeout(() => el.classList.remove('presiona'), 170);
  };
  const activar = (n) => {
    const k = orden.indexOf(n);
    tarjetas.forEach((c) => c.classList.toggle('activa', c.dataset.card === n));
    tarjetas[k]?.classList.add('hecho');
    segs.forEach((s, j) => {
      s.classList.toggle('hecho', j <= k);
      s.classList.toggle('ahora', j === k);
    });
  };

  let relojDesde = null;
  let relojTexto = '';
  const inicio = () => {
    tarjetas.forEach((c) => c.classList.remove('activa', 'hecho'));
    segs.forEach((s) => s.classList.remove('hecho', 'ahora'));
    Object.keys(vals).forEach((n) => val(n, 0));
    fila.classList.remove('activa');
    Object.values(platos).forEach((p) => p.classList.remove('con'));
    enviar.classList.remove('enviado');
    coc.classList.remove('entra');
    inv.classList.remove('baja', 'avisa');
    fac.classList.remove('llena', 'emitida');
    rep.classList.remove('sube');
    relojDesde = null;
    relojTexto = reloj.textContent = '0:00';
  };

  let t = -700; // la primera vuelta espera a que entren las tarjetas
  const guion = [
    [600, () => activar('reservas')],
    [850, () => { fila.classList.add('activa'); val('res', 1); }],
    [2300, () => activar('pedidos')],
    [2650, () => toque('patacones')],
    [2790, () => { val('pat', 1); val('total', 1); platos.patacones.classList.add('con'); }],
    [3250, () => toque('patacones')],
    [3390, () => { val('pat', 2); val('total', 2); }],
    [3850, () => toque('chicha')],
    [3990, () => { val('chi', 1); val('total', 3); platos.chicha.classList.add('con'); }],
    [4650, () => { toque('enviar'); presionar(enviar); }],
    [4850, () => enviar.classList.add('enviado')],
    [5800, () => activar('cocina')],
    [5950, () => { coc.classList.add('entra'); val('nuevos', 1); relojDesde = t; }],
    [7700, () => activar('inventario')],
    [7900, () => { inv.classList.add('baja'); val('platano', 1); val('pina', 1); }],
    [8750, () => inv.classList.add('avisa')],
    [9700, () => activar('cobros')],
    [9850, () => { fac.classList.add('llena'); val('factotal', 1); }],
    [10650, () => { val('pago', 1); fac.classList.add('emitida'); }],
    [11700, () => activar('reportes')],
    [11850, () => { rep.classList.add('sube'); val('ventas', 1); val('pedidos', 1); }],
    [14600, () => { tarjetas.forEach((c) => c.classList.remove('activa')); segs.forEach((s) => s.classList.remove('ahora')); }],
    [17200, () => { zona.classList.add('volviendo'); inicio(); }],
    [18000, () => zona.classList.remove('volviendo')],
  ];
  const DURA = 18800;

  let i = 0;
  let ultimo = null;
  let andando = true;
  let visible = true;
  let pidio = false;

  const cuadro = (ahora) => {
    pidio = false;
    if (!andando || !visible) { ultimo = null; return; }
    if (ultimo === null) ultimo = ahora;
    t += Math.min(ahora - ultimo, 64);
    ultimo = ahora;
    while (i < guion.length && guion[i][0] <= t) guion[i++][1]();
    if (relojDesde !== null) {
      const s = Math.max(0, Math.floor((t - relojDesde) / 1000));
      const texto = `0:${String(s).padStart(2, '0')}`;
      if (texto !== relojTexto) relojTexto = reloj.textContent = texto;
    }
    if (t >= DURA) { t = 0; i = 0; }
    seguir();
  };
  const seguir = () => {
    if (pidio || !andando || !visible) return;
    pidio = true;
    requestAnimationFrame(cuadro);
  };

  inicio();
  zona.classList.add('en-vivo');
  seguir();

  pausa?.addEventListener('click', () => {
    andando = !andando;
    zona.classList.toggle('pausado', !andando);
    pausa.toggleAttribute('data-pausado', !andando);
    pausa.querySelector('[data-texto]').textContent = andando ? 'Pausar' : 'Reproducir';
    seguir();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      seguir();
    }, { threshold: 0.12 }).observe(zona);
  }
})();
