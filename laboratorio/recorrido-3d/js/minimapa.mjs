// Minimapa: el plano en SVG con la posición y la dirección de la cámara. Tocar un ambiente lleva a él.
// En una pantalla táctil el minimapa mide unos 104 px y un baño queda de 13 × 18 px: el primer toque lo agranda a todo
// el ancho de la escena (cada ambiente del ejemplo mide 44 px o más, con su nombre) y el segundo elige el ambiente.

import { svgPlano } from './nucleo/svg-plano.mjs';
import { anguloFlechaMinimapa } from './nucleo/movimiento.mjs';
import { ambienteCercano } from './nucleo/plano.mjs';

const TOLERANCIA_PX = 22; // un toque sobre una pared elige el ambiente más cercano a menos de esto

export function crearMinimapa(contenedor, modelo, { alElegir, agrandar = () => false }) {
  const marca =
    '<g class="minimapa__marca">' +
    '<path class="minimapa__cono" d="M0 0L-1.15 -2.3A2.57 2.57 0 0 1 1.15 -2.3Z"/>' +
    '<circle class="minimapa__jugador" r="0.34"/>' +
    '</g>';
  contenedor.innerHTML =
    '<div class="minimapa__barra"><p class="minimapa__pista">Toca el ambiente al que quieres ir.</p>' +
    '<button class="boton boton--linea boton--chico minimapa__cerrar" type="button">Cerrar</button></div>' +
    svgPlano(modelo, { etiquetas: false, compactas: true, cotas: false, margen: 0.3, atributos: 'aria-hidden="true" focusable="false"' }).replace(
      '</svg>',
      `${marca}</svg>`,
    );
  const svg = contenedor.querySelector('svg');
  const g = svg.querySelector('.minimapa__marca');
  const pisos = new Map([...svg.querySelectorAll('[data-ambiente]')].map((p) => [p.dataset.ambiente, p]));
  let actual = null;
  let grande = false;

  function ponerGrande(si) {
    grande = si;
    contenedor.classList.toggle('visor__minimapa--grande', si);
  }

  const alClic = (e) => {
    if (agrandar() && !grande) { ponerGrande(true); return; }
    let id = e.target.closest('[data-ambiente]')?.dataset.ambiente ?? null;
    if (!id) {
      // El dedo cayó en una pared o entre dos ambientes: el más cercano, si está a menos de 22 px.
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const p = pt.matrixTransform(ctm.inverse());
        id = ambienteCercano({ x: p.x, y: p.y }, modelo.ambientes, TOLERANCIA_PX / ctm.a)?.id ?? null;
      }
    }
    if (id) alElegir(id);
    if (grande) ponerGrande(false);
  };
  const alCerrar = () => ponerGrande(false);
  svg.addEventListener('click', alClic);
  const cerrar = contenedor.querySelector('.minimapa__cerrar');
  cerrar.addEventListener('click', alCerrar);

  return {
    get grande() { return grande; },
    achicar() { if (grande) ponerGrande(false); },
    mover({ x, y, yaw }) {
      g.setAttribute('transform', `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${anguloFlechaMinimapa(yaw).toFixed(1)})`);
    },
    marcar(id) {
      if (actual) pisos.get(actual)?.classList.remove('es-actual');
      actual = id;
      if (id) pisos.get(id)?.classList.add('es-actual');
    },
    destruir() {
      svg.removeEventListener('click', alClic);
      cerrar.removeEventListener('click', alCerrar);
      ponerGrande(false);
      contenedor.innerHTML = '';
    },
  };
}
