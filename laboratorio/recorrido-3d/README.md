# Recorrido 3D de una propiedad (laboratorio)

Demo del servicio B01: un apartamento de ejemplo de 95.04 m² (dibujado a partir de un plano, no escaneado) que se
recorre en primera persona, se ve desde arriba, se mide, y un editor para dibujar un plano propio y recorrerlo.

## Archivos

| Qué | Dónde |
|---|---|
| Página (con bloques generados `<!-- gen:… -->`) | `index.html`, `demo.css` (solo tokens de `../../assets/atk.css`) |
| Plano de ejemplo (datos) | `plano.json`, escrito por `herramientas/escribir-plano-ejemplo.mjs` |
| Lógica pura, sin DOM | `js/nucleo/`: `geometria` (áreas, colisión círculo-segmento), `plano` (paredes desde ambientes, huecos, modelo), `cuadricula` (editor → plano, JSON), `movimiento`, `svg-plano`, `etiquetas` (dónde y de qué tamaño va cada nombre), `historial` («Deshacer»), `formato`, `almacen` |
| 3D (three.js 0.170.0 por `import()` desde jsDelivr) | `js/visor.mjs` |
| Interfaz | `js/pagina.mjs` (pestañas, precarga), `js/recorrido.mjs` (teclado, mouse, joystick, medir), `js/minimapa.mjs`, `js/editor.mjs` |
| Imágenes fijas (render real del modelo) | `img/`, hechas con `herramientas/capturar-vista-previa.mjs` |

## Comandos

```sh
node --test pruebas/                                  # pruebas de la lógica y de que el HTML esté al día
node herramientas/escribir-plano-ejemplo.mjs          # tras cambiar el apartamento de ejemplo
node herramientas/generar.mjs                         # tras cambiar plano.json o el catálogo (B01–B06)
python3 -m http.server 4750 -d ~/alphateklab/repos    # servidor local para lo que sigue
node herramientas/capturar-vista-previa.mjs           # rehace img/*.webp y el og (URL_DEMO=… para otro puerto)
node herramientas/verificar.mjs --salida /tmp/capturas # recorrido completo con Playwright a 390 y 1280, claro y oscuro
                                                      # (PUERTO_DEMO=4770 para otro puerto)
```

`verificar.mjs` levanta el servidor si no hay uno. Usa el Playwright de `~/alphatend-do/sitio`.

## Reglas que no se ven a simple vista

- Las paredes salen de los bordes de los ambientes (compartido = interior 0.12 m; hacia afuera o al balcón = exterior
  0.20 m; borde suelto de balcón = baranda). Solo bordes horizontales o verticales.
- En el editor, una ventana va en una pared que da afuera o a un balcón; entre dos interiores, el mensaje pide una puerta.
  Al ver un plano dibujado en 3D se aparece en el ambiente interior más grande que tenga puerta.
- Los nombres de los ambientes se colocan con `nucleo/etiquetas.mjs`: la letra más grande que cabe, en una o dos líneas
  y girada si el ambiente es angosto, sin pisar el giro de las puertas. En 3D, además, fuera de la franja de piso que
  tapan las paredes vistas desde la cámara de arriba. El plano de la página lleva dos juegos de rótulos y el CSS muestra
  los compactos (solo el nombre) por debajo de 700 px.
- Las ventanas con antepecho por encima del corte de 1.20 m (las de los baños) se dibujan en discontinua sobre el muro.
- Las aberturas se ubican por su centro sobre la pared. `puerta` y `vano` se cruzan; `ventana` y `puerta-cerrada`, no;
  la `corrediza` solo por su mitad abierta. La hoja abierta de cada puerta también choca, y es la misma línea del plano.
- Los m² son del polígono a eje de pared. Las medidas en pantalla salen de la geometría 3D (pared a pared da caras
  interiores: 2.68 m en una recámara de 2.80 m a eje).
- El editor guarda en `localStorage` (`atk-recorrido-3d:plano`, esquema 1) y avisa a otras pestañas por
  `BroadcastChannel('atk-recorrido-3d')`.
- «Deshacer» registra el estado al primer cambio real (no al enfocar un campo) y se salta los estados iguales al
  actual. Si el dibujo cambia en otra pestaña, la pila se vacía: deshacer borraría ese cambio sin avisar.
- Si el plano cambia después de «Ver en 3D», el aviso del recorrido lo dice y ofrece «Ver los cambios en 3D».
- `?prueba=1` expone `window.recorrido3d` para las pruebas del navegador.
