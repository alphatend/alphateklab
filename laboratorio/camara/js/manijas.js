// Manijas para mover las puntas de la línea y las esquinas de la zona. Son <button> de verdad, encima del lienzo:
// se arrastran con el dedo o el mouse y, con el foco puesto, se mueven con las flechas (Mayús + flecha, más lejos).

const PASO = 0.01;
const PASO_GRANDE = 0.05;

/**
 * @param contenedor elemento posicionado encima del lienzo
 * @param op.aPantalla (p normalizado) → {x, y} en px CSS del contenedor
 * @param op.aNormal (clientX, clientY) → p normalizado (recortado al video)
 * @param op.alMover (manija, p) — durante el arrastre o con cada flecha
 * @param op.alSoltar (manija) — al terminar un arrastre o una tecla
 * @param op.alActivar (manija) — Enter o clic sin arrastre
 */
export function crearManijas(contenedor, op) {
  let lista = [];
  const botones = new Map();

  function crearBoton(m) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'manija' + (m.clase ? ' ' + m.clase : '');
    b.dataset.clave = m.clave;
    const rot = document.createElement('span');
    rot.setAttribute('aria-hidden', 'true');
    b.appendChild(rot);
    let arrastre = null;

    b.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      b.focus({ preventScroll: true });
      b.setPointerCapture(e.pointerId);
      arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY, movio: false };
    });
    b.addEventListener('pointermove', (e) => {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      if (!arrastre.movio && Math.hypot(e.clientX - arrastre.x, e.clientY - arrastre.y) < 3) return;
      arrastre.movio = true;
      const p = op.aNormal(e.clientX, e.clientY);
      if (p) op.alMover(manijaActual(b), p);
    });
    const terminar = (e) => {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      const movio = arrastre.movio;
      arrastre = null;
      if (movio) op.alSoltar(manijaActual(b));
      else op.alActivar(manijaActual(b));
    };
    b.addEventListener('pointerup', terminar);
    b.addEventListener('pointercancel', terminar);
    b.addEventListener('click', (e) => {
      // un clic de teclado (Enter/Espacio) llega sin pointerdown
      if (e.detail === 0) op.alActivar(manijaActual(b));
    });
    b.addEventListener('keydown', (e) => {
      const paso = e.shiftKey ? PASO_GRANDE : PASO;
      const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
      if (!d) return;
      e.preventDefault();
      const m = manijaActual(b);
      const p = { x: Math.min(1, Math.max(0, m.punto.x + d[0])), y: Math.min(1, Math.max(0, m.punto.y + d[1])) };
      op.alMover(m, p);
      op.alSoltar(m);
    });
    return b;
  }

  function manijaActual(boton) {
    return lista.find((m) => m.clave === boton.dataset.clave);
  }

  /** Muestra estas manijas: [{ clave, punto, etiqueta, rotulo, clase }]. Reutiliza los botones (no pierde el foco). */
  function mostrar(nuevas) {
    lista = nuevas;
    const claves = new Set(nuevas.map((m) => m.clave));
    for (const [clave, b] of botones) {
      if (!claves.has(clave)) {
        b.remove();
        botones.delete(clave);
      }
    }
    for (const m of nuevas) {
      let b = botones.get(m.clave);
      if (!b) {
        b = crearBoton(m);
        botones.set(m.clave, b);
        contenedor.appendChild(b);
      }
      b.className = 'manija' + (m.clase ? ' ' + m.clase : '');
      b.setAttribute('aria-label', m.etiqueta);
      b.querySelector('span').textContent = m.rotulo || '';
      b.querySelector('span').hidden = !m.rotulo;
      // El centro de la manija nunca queda a menos de media manija (22 px) del borde del video: si no, el borde le
      // corta el foco y parte del área táctil. La punta de la línea puede estar más cerca; la manija se queda adentro.
      const p = op.aPantalla(m.punto);
      const ancho = contenedor.clientWidth;
      const alto = contenedor.clientHeight;
      const x = ancho > 44 ? Math.min(ancho - 22, Math.max(22, p.x)) : p.x;
      const y = alto > 44 ? Math.min(alto - 22, Math.max(22, p.y)) : p.y;
      b.style.left = `${x}px`;
      b.style.top = `${y}px`;
    }
  }

  function ocultar() {
    mostrar([]);
  }

  /** Pone el foco en la manija de esa clave (si está a la vista). */
  function enfocar(clave) {
    const b = botones.get(clave);
    if (b) b.focus();
  }

  return { mostrar, ocultar, enfocar };
}
