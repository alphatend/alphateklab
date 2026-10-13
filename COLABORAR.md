# Colaborar en alphateklab

Para quien trabaja en estos repositorios además de Jonathan, sea una persona o un agente. Lo técnico de cada
repositorio está en su `CLAUDE.md` y su `README.md`. Aquí va cómo entran los cambios sin pisarse.

## Los tres repositorios

| Repositorio | Publicado en | Qué es |
|---|---|---|
| `alphatend/alphateklab` | https://alphateklab.com/ | Desde el 7-oct-2026, la portada de Citas Médicas (agenda y expediente para consultorios). El sitio de la agencia quedó en la rama `sitio-agencia` |
| `alphatend/alphateklab-mesa` | https://alphatend.github.io/alphateklab-mesa/ | Demo de pedir y pagar desde la mesa: carta QR, salón, cocina, kiosco y administración |
| `alphatend/alphateklab-reservas` | https://alphatend.github.io/alphateklab-reservas/ | Demo de citas con recordatorios y de reservas de cabañas por canal |

Los tres son públicos. `main` es producción: GitHub Pages publica cada push en uno o dos minutos.

## Preparar la máquina

```sh
mkdir alphateklab-trabajo && cd alphateklab-trabajo
git clone https://github.com/alphatend/alphateklab.git
git clone https://github.com/alphatend/alphateklab-mesa.git
git clone https://github.com/alphatend/alphateklab-reservas.git
for r in alphateklab alphateklab-mesa alphateklab-reservas; do (cd $r && npm install); done
(cd alphateklab && npx playwright install chromium)    # y «webkit» para probar como en un iPhone
node alphateklab/herramientas/servir.mjs                  # sirve los tres en http://localhost:4900/alphateklab/
```

Los tres van en la misma carpeta, porque el sitio enlaza las demos por ruta. Hace falta Node 22 y Git. Algunas
herramientas de imagen piden además ImageMagick 7 (`magick`), ffmpeg y Python 3 con Pillow y numpy.

**Edwin** puede publicar directo en `main` (Jonathan lo autorizó el 3-oct-2026). El acceso es una llave de despliegue
con escritura por repositorio, que Jonathan crea en GitHub (Settings → Deploy keys de cada uno) y le pasa en su paquete
junto con un `preparar.sh` que clona los tres por SSH con ellas. Jonathan las revoca ahí mismo cuando quiera.

## Cómo entra un cambio

1. **Nada directo a `main`** salvo que Jonathan lo autorice (Jonathan y Edwin sí empujan a `main`). Los demás trabajan
   en una rama o en un fork y abren un pull request contra `main`.
2. **Antes de empujar o de abrir el pull request**, en el sitio:
   - `node herramientas/generar-portada.mjs --raiz` y después `node herramientas/generar-citas.mjs`. Las páginas se
     generan desde `datos/` y el resultado se versiona. Los HTML no se editan a mano. (En la rama `sitio-agencia`, el
     generador de antes: `node herramientas/generar.mjs`.)
   - `npm run prueba` (`node --test pruebas/citas.test.mjs pruebas/portada.test.mjs pruebas/sintaxis.test.mjs`)
   - `node pruebas/navegador/citas.mjs http://localhost:4900/alphateklab/` (y con `MOTOR=webkit`)
   - Mirarlo en el navegador a 1440 px y a 390 px, en claro y en oscuro.

   En las demos: `node --test pruebas/` y su recorrido (`herramientas/recorrido.mjs`; ver el README de cada una).
3. **Cada arreglo deja su prueba**, y se comprueba que la prueba falla contra lo publicado antes del arreglo. Si no
   falla, no está probando nada.
4. **En el mensaje del commit o del pull request** van:
   - qué cambió y por qué;
   - cómo se comprobó, con las cifras;
   - lo que no se hizo o quedó a medias.
5. **Una cosa por commit**, chico. Antes de empezar, `git pull --rebase` y avisar qué parte se toma, para no tocar a la
   vez los mismos archivos que otra persona. Los más compartidos son `datos/producto.mjs`, `herramientas/generar-citas.mjs` y `assets/citas.css`.
   Antes de empujar, otra vez `git pull --rebase`. Si chocan los archivos generados (los `.html`, `assets/indice.json`),
   se resuelven primero las fuentes (`datos/`, `herramientas/`, `js/`, `assets/*.css`), se vuelve a correr
   `node herramientas/generar-citas.mjs` y se agrega lo generado. Nunca `git push --force` a `main`.
6. **Después de empujar**, mirar que GitHub Pages haya publicado (uno o dos minutos) y correr las dos pruebas de
   navegador contra el sitio publicado (`https://alphateklab.com/`).
7. **Verificar contra el artefacto** (el código, la página en el navegador, el sitio publicado) y no contra la memoria
   ni contra una nota.

## Lo que no se hace

- Los repositorios son públicos. Nunca entran credenciales, chats exportados, datos de clientes reales ni números de
  teléfono reales.
- Las demos usan negocios y personas ficticios, rotulados como de ejemplo.
- Solo hay precios donde los decidieron los socios: el menú QR, a $10 al mes, y las fotos del recorrido 3D, +$300.
  `js/catalogo-reglas.mjs` los fija y una prueba lo vigila. El resto va «a cotizar». Tampoco van testimonios, logos de
  clientes ni cifras sin fuente.
- Redacción:
  - tuteo panameño;
  - el hecho primero;
  - sin «¡», sin marketing y sin muletillas (la lista de palabras prohibidas está en `js/catalogo-reglas.mjs`);
  - verbos fijos: «Preguntar» y «Agregar a mi lista».
- Imágenes:
  - capturas reales de las demos o fotos generadas rotuladas «Imagen ilustrativa»;
  - nunca una pantalla o un QR inventados: se componen encima los reales (ver `CLAUDE.md`).
