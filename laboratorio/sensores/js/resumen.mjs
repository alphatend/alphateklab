// «Ahora en el local»: en el teléfono, debajo del reloj, una cuadrícula con cada sensor (valor y estado) para ver
// el tablero de un vistazo sin bajar hasta las gráficas; tocar uno lleva a su gráfica. Copia lo que el registrador
// escribe en la cabecera de cada tira, así nunca dice otra cosa que el gráfico. En pantallas anchas el CSS la oculta:
// ahí las lecturas ya se ven junto al reloj.

const lista = document.getElementById('resumen-sensores');
const tiras = [...document.querySelectorAll('.tira[data-tira]')].filter((t) => t.dataset.tira !== 'fallas');

if (lista && tiras.length) {
  for (const t of tiras) {
    if (!t.id) t.id = `tira-${t.dataset.tira}`;
    // el nombre sin la unidad: la unidad ya va con el valor («3.9 °C»)
    const nombre = t.querySelector('.tira__nombre');
    const titulo = [...(nombre?.childNodes ?? [])].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();
    const valor = document.createElement('span');
    valor.className = 'resumen-sensor__valor num';
    const estado = document.createElement('span');
    estado.className = 'resumen-sensor__estado';
    const enlace = document.createElement('a');
    enlace.className = 'resumen-sensor';
    enlace.href = `#${t.id}`;
    const rotulo = document.createElement('span');
    rotulo.className = 'resumen-sensor__nombre';
    rotulo.textContent = titulo;
    enlace.append(rotulo, valor, estado);
    const li = document.createElement('li');
    li.append(enlace);
    lista.append(li);

    const origenValor = t.querySelector('[data-valor]');
    const origenEstado = t.querySelector('[data-estado]');
    const esLista = origenValor?.classList.contains('tira__valor--lista');
    if (esLista) valor.classList.add('resumen-sensor__valor--lista');
    const copiar = () => {
      if (esLista) {
        // «Puertas y bomba» trae varias lecturas cortas: una por renglón, en letra normal
        valor.replaceChildren(...[...origenValor.children].map((n) => Object.assign(document.createElement('span'), { textContent: n.textContent.replace(/\s+/g, ' ').trim() })));
        if (!valor.children.length) valor.textContent = origenValor.textContent.trim() || '—';
      } else {
        // el número no se separa de su unidad al cortar la línea («6 h», «3.9 °C»)
        valor.textContent = (origenValor?.textContent.replace(/\s+/g, ' ').trim() || '—').replace(/(\d) (?=\S)/g, '$1\u00a0');
      }
      if (origenEstado) {
        estado.replaceChildren(...[...origenEstado.childNodes].map((n) => n.cloneNode(true)));
        estado.dataset.tipo = origenEstado.dataset.tipo || '';
      }
    };
    copiar();
    new MutationObserver(copiar).observe(t.querySelector('.tira__cabeza') ?? t, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-tipo'] });
  }
}
