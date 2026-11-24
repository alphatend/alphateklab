// alphateklab, propuesta 46: el centro del héroe.
// Un pulso sale de «Tu negocio», recorre un radio hasta una solución, la enciende y la voltea a un resultado
// de ejemplo. Una a la vez, en círculo, sin parar. Todo con la Web Animations API (transform y opacity),
// en una sola línea de tiempo: se pausa con el botón, se detiene fuera de pantalla y, con «reducir movimiento»,
// queda quieto en un cuadro con un resultado a la vista. En el celular el anillo es una lista con una línea que baja.
(() => {
  const raiz = document.querySelector('[data-centro]');
  if (!raiz) return;
  const marco = raiz.querySelector('.centro__marco');
  const escena = raiz.querySelector('.centro__escena');
  const nucleo = escena.querySelector('.nucleo');
  const nodos = [...escena.querySelectorAll('.nodo')];
  const rayos = [...escena.querySelectorAll('.rayo')];
  const boton = raiz.querySelector('[data-pausa]');
  const quieto = matchMedia('(prefers-reduced-motion: reduce)');
  const lista = matchMedia('(max-width: 720px)');

  // escala del escenario de 760 × 560 al ancho disponible
  const escalar = () => {
    if (lista.matches) escena.style.removeProperty('--k');
    else escena.style.setProperty('--k', Math.min(1, marco.clientWidth / 760).toFixed(4));
  };
  escalar();
  if (!escena.animate) return;

  const P = 3400; // cada solución tiene su turno de 3.4 s
  const C = P * nodos.length; // vuelta completa: 27.2 s
  const BASE = 1000; // espera a que termine la entrada del héroe
  const VIAJE = 820; // lo que tarda el pulso en llegar
  const W = 60; // largo del cometa
  const RECORRIDO = 'cubic-bezier(0.65, 0, 0.35, 1)'; // ease-in-out: sale y aterriza
  const GIRO = 'cubic-bezier(0.77, 0, 0.175, 1)'; // ease-in-out fuerte para voltear
  const SALIDA = 'cubic-bezier(0.23, 1, 0.32, 1)'; // ease-out
  const o = (ms) => ms / C;

  let anims = [];
  let pausadoPorUsuario = false;
  let enPantalla = true;
  let modo = null;

  // distancia del centro de una caja a su borde, en la dirección (c, s)
  const borde = (mw, mh, c, s) => Math.min(c ? mw / c : Infinity, s ? mh / s : Infinity);

  const geometria = () =>
    nodos.map((n) => {
      if (lista.matches) {
        const y0 = nucleo.offsetTop + nucleo.offsetHeight;
        const L = n.offsetTop + n.offsetHeight / 2 - y0;
        return { x: 24, y: y0, ang: 90, L, d0: 0, d1: L, fin: L };
      }
      const cx = 380, cy = 280;
      const dx = n.offsetLeft + n.offsetWidth / 2 - cx;
      const dy = n.offsetTop + n.offsetHeight / 2 - cy;
      const L = Math.hypot(dx, dy);
      const c = Math.abs(dx) / L, s = Math.abs(dy) / L;
      const d0 = borde(nucleo.offsetWidth / 2, nucleo.offsetHeight / 2, c, s);
      const d1 = L - borde(n.offsetWidth / 2, n.offsetHeight / 2, c, s);
      return { x: cx, y: cy, ang: (Math.atan2(dy, dx) * 180) / Math.PI, L, d0, d1, fin: Math.min(L, d1 + 22) };
    });

  const construir = () => {
    anims.forEach((a) => a.cancel());
    anims = [];
    modo = lista.matches ? 'lista' : 'anillo';
    const g = geometria();
    const turno = (i) => ({ duration: C, iterations: Infinity, delay: BASE + i * P, fill: 'both' });
    const add = (el, kf, op) => anims.push(el.animate(kf, op));

    g.forEach((r, i) => {
      const rayo = rayos[i];
      const nodo = nodos[i];
      rayo.style.left = `${r.x}px`;
      rayo.style.top = `${r.y - 1}px`;
      rayo.style.width = `${r.L}px`;
      rayo.style.transform = `rotate(${r.ang}deg)`;
      const cometa = rayo.querySelector('.rayo__cometa');
      const rastro = rayo.querySelector('.rayo__rastro');
      const giro = nodo.querySelector('.nodo__giro');
      const [puertoA, puertoB, puertoLuz] = rayo.querySelectorAll('.rayo__puerto');
      if (puertoA) {
        puertoA.style.left = `${r.d0 + 14}px`;
        puertoB.style.left = puertoLuz.style.left = `${r.d1 - 5}px`;
      }
      const luz = nodo.querySelector('.nodo__luz');
      const brillo = nodo.querySelector('.nodo__brillo');
      const op = turno(i);

      // 1. el pulso viaja por el radio
      add(cometa, [
        { offset: 0, transform: `translateX(${r.d0 - W}px)`, easing: RECORRIDO },
        { offset: o(VIAJE), transform: `translateX(${r.fin - W}px)` },
        { offset: 1, transform: `translateX(${r.fin - W}px)` },
      ], op);
      add(cometa, [
        { offset: 0, opacity: 0 },
        { offset: o(90), opacity: 1 },
        { offset: o(VIAJE - 120), opacity: 1 },
        { offset: o(VIAJE + 40), opacity: 0 },
        { offset: 1, opacity: 0 },
      ], op);
      // 2. el radio queda encendido detrás del pulso mientras se ve el resultado
      add(rastro, [
        { offset: 0, transform: `scaleX(${r.d0 / r.L})`, easing: RECORRIDO },
        { offset: o(VIAJE), transform: `scaleX(${r.fin / r.L})` },
        { offset: 1, transform: `scaleX(${r.fin / r.L})` },
      ], op);
      add(rastro, [
        { offset: 0, opacity: 0 },
        { offset: o(60), opacity: 1 },
        { offset: o(3000), opacity: 1 },
        { offset: o(3500), opacity: 0, easing: SALIDA },
        { offset: 1, opacity: 0 },
      ], op);
      // 3. la solución se enciende…
      const encendido = [
        { offset: 0, opacity: 0 },
        { offset: o(VIAJE - 90), opacity: 0, easing: SALIDA },
        { offset: o(VIAJE + 200), opacity: 1 },
        { offset: o(3050), opacity: 1 },
        { offset: o(3550), opacity: 0 },
        { offset: 1, opacity: 0 },
      ];
      add(luz, encendido, op);
      add(brillo, encendido, op);
      if (puertoLuz && modo === 'anillo') add(puertoLuz, encendido, op);
      // 4. …y se voltea al resultado; después vuelve
      add(giro, [
        { offset: 0, transform: 'rotateX(0deg)' },
        { offset: o(VIAJE + 60), transform: 'rotateX(0deg)', easing: GIRO },
        { offset: o(VIAJE + 680), transform: 'rotateX(180deg)' },
        { offset: o(2980), transform: 'rotateX(180deg)', easing: GIRO },
        { offset: o(3560), transform: 'rotateX(0deg)' },
        { offset: 1, transform: 'rotateX(0deg)' },
      ], op);
    });

    // el núcleo suelta una onda cada vez que despacha un pulso
    const onda = nucleo.querySelector('.nucleo__onda');
    const grande = modo === 'lista' ? 'scale(1.025, 1.22)' : 'scale(1.26)';
    add(onda, [
      { offset: 0, transform: 'scale(1)', opacity: 0 },
      { offset: 0.02, transform: 'scale(1)', opacity: 0.7, easing: SALIDA },
      { offset: 0.3, transform: grande, opacity: 0 },
      { offset: 1, transform: grande, opacity: 0 },
    ], { duration: P, iterations: Infinity, delay: BASE, fill: 'both' });
  };

  // las animaciones de fondo (la órbita que gira y el punto que late) se pausan con todo lo demás
  const ambiente = () =>
    escena.getAnimations({ subtree: true }).filter((a) => a.animationName === 'orbita' || a.animationName === 'latido');
  const todas = () => [...anims, ...ambiente()];

  const aplicar = () => {
    if (quieto.matches) return;
    const correr = !pausadoPorUsuario && enPantalla && !document.hidden;
    todas().forEach((a) => (correr ? a.play() : a.pause()));
  };

  // un cuadro con sentido para «reducir movimiento»: la primera solución mostrando su resultado
  const reposo = () => {
    todas().forEach((a) => {
      a.currentTime = BASE + 2000;
      a.pause();
    });
  };

  const iniciar = (t) => {
    construir();
    if (t != null) todas().forEach((a) => (a.currentTime = t));
    if (quieto.matches) reposo();
    else aplicar();
  };
  iniciar();

  // botón Pausar / Reproducir
  boton?.addEventListener('click', () => {
    pausadoPorUsuario = !pausadoPorUsuario;
    boton.dataset.estado = pausadoPorUsuario ? 'pausado' : '';
    boton.querySelector('span').textContent = pausadoPorUsuario ? 'Reproducir' : 'Pausar';
    aplicar();
  });

  // fuera de pantalla se detiene
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => {
      enPantalla = e[0].isIntersecting;
      aplicar();
    }).observe(raiz);
  }
  document.addEventListener('visibilitychange', aplicar);

  // cambio de tamaño: se reescala; si cambia de anillo a lista, se rearma sin perder el punto del ciclo
  let pendiente = 0;
  const alCambiar = () => {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(() => {
      escalar();
      const nuevo = lista.matches ? 'lista' : 'anillo';
      if (nuevo !== modo || nuevo === 'lista') iniciar(anims[0]?.currentTime ?? null);
    });
  };
  if ('ResizeObserver' in window) new ResizeObserver(alCambiar).observe(marco);
  else addEventListener('resize', alCambiar);
  quieto.addEventListener?.('change', () => iniciar(anims[0]?.currentTime ?? null));

  // para las capturas: lleva todo al mismo instante del ciclo (ms desde el primer pulso)
  window.__centro = {
    ir(ms) { todas().forEach((a) => { a.currentTime = BASE + ms; a.pause(); }); },
    seguir() { aplicar(); },
  };
})();
