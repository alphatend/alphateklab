# alphateklab.com · el sitio de la agencia

**Desde el 17-nov-2026 alphateklab.com es solo la agencia** (Jonathan: «Solo quiero que exista alphateklab.com, donde
ofrecemos nuestros servicios. Nada de cuentas.alphateklab.com, nada de lo médico aparte»; y sin tarjetas de lealtad):

- **La raíz** es la portada nueva de Edwin (su commit 30d862f, la propuesta de rediseño que estuvo en dev.alphateklab.com),
  con sus páginas en la raíz (`servicio-*.html`, `negocio-*.html`, `tipo-*.html`, `servicios.html`, `soluciones.html`,
  `paquetes.html`, `demos.html`, `equipos.html`, `telefono.html`, `como-trabajamos.html`) y sus recursos en
  `assets/v2.css`, `assets/v2.js`, `assets/sistema.js`, `assets/equipo/`, `assets/qr-mesa.svg` y `assets/v2/`.
  Es HTML estático: **se edita a mano** (no hay generador para estas páginas).
- **Se quitaron (17-nov):** Med entero (`med/`, `citasmed/`, `expediente-clinico/`, `expediente-clinico-electronico-panama/`,
  `entrar/`, `registro/`, `terminos/`, su privacidad, su 404, sus generadores `generar-citas`, `capturas-citas`,
  `imagenes-citas`, `og-citas`, sus datos `producto`, `paginas`, `guias-citas` y sus pruebas), la sección Clínicas y sus
  servicios (agente de citas, videoconsulta, expediente del paciente, turnos en sala de espera, encuesta después de la
  cita), el programa de clientes frecuentes (lealtad) y las secciones viejas del catálogo (`servicios/`, `soluciones/`,
  `cotizar/`, `diagnostico/`), que las páginas nuevas reemplazan. Todo sigue en el historial de git (el último commit
  con Med es 30d862f).
- **Sin subdominios:** nada enlaza a dev.alphateklab.com ni a cuentas.alphateklab.com (lo cuida
  `pruebas/solo-agencia.test.mjs`). Lo que la portada nueva tomaba de dev se trajo aquí: la privacidad de la agencia
  (`privacidad/`, con los formularios) y las demos del laboratorio (`laboratorio/sensores`, `camara`, `recorrido-360`,
  `recorrido-3d`). Siguen del sitio de antes, con su estilo: `guias/`, `creditos/`, `laboratorio/` y `404.html`.
- **El formulario «Pedir mi propuesta»** (portada, paquetes y teléfono) manda el mensaje y el correo o WhatsApp por
  FormSubmit al mismo `destino` que Food (`datos/food.mjs`); antes no mandaba nada (venía del prototipo).
- **La demo de reservas** se enlaza en su página de cabañas (`alphateklab-reservas/alojamiento.html`); la demo trae
  todavía la plantilla de consultorio en su propio repositorio.
- **Food** (`food/`) la genera `node herramientas/generar-portada.mjs --raiz` desde `datos/portada.mjs` y
  `datos/food.mjs` (ya sin Med). Vuelve (la tarjeta de lealtad) sigue oculta (`publicado: false`).
- **Pruebas:** `npm run prueba`. `llms.txt` y `sitemap.xml` se escribieron a mano el 17-nov desde los títulos y
  descripciones de las páginas: si cambian las páginas, se actualizan.

Lo de abajo describe el sitio de la agencia de antes (rama `sitio-agencia`); queda como historia.

# Sitio de la agencia (hasta el 6-oct-2026)

Sitio estático (https://alphateklab.com/, en la raíz del dominio; antes en GitHub Pages, https://jojomunoz.github.io/alphateklab/). Sin build en el navegador: HTML, CSS y
módulos ES. Las páginas del catálogo se generan con `node herramientas/generar.mjs` a partir de `datos/catalogo.mjs`
y el resultado se versiona (así el HTML trae el contenido sin esperar al JavaScript): no se editan a mano los HTML
generados, se cambia `datos/` o `herramientas/generar.mjs` y se regenera. Pruebas: ver «Cerrojos» abajo, y las de cada
demo en `laboratorio/<demo>/pruebas/`. Para trabajar desde otra máquina o como colaborador: `COLABORAR.md`.

Reglas del proyecto: `~/alphateklab/BRIEF.md` (fuera del repo; los colaboradores la reciben en su paquete). Guía de
diseño de la casa: `~/Documents/NovahWEB/conocimiento/GUIA-DISENO-SIN-SLOP.md` (solo en la máquina de Jonathan).

## Solo software (rama solo-software, 6-oct-2026)

- alphateklab hace solo software: páginas y apps, software a medida, IA y WhatsApp, cobros y facturación. No vende ni
  instala equipos ni va a tomar fotos, escanear o volar un dron. Lo que funciona en un equipo (la tableta de la cocina,
  el televisor de la sala) usa el que el negocio ya tiene, y eso va en «Qué necesitas tener» de la ficha.
- Se quitaron 32 servicios de equipos y de visita, los tipos `vision`, `iot`, `pantallas` y `tresd`, la página de
  «Bodegas, oficinas e industria» (el sector se juntó con «Cualquier negocio»), la guía de cámaras y la Ley 81, y las
  demos del recorrido 3D, el 360, la cámara y los sensores. `js/catalogo-reglas.mjs` no deja generar con
  `instala: true`, `visita` ni `equipo`.
- El héroe de la portada es la caja de avisos (la foto con la placa, el teléfono y la tableta se fue).
- `URL_BASE` es `https://alphateklab.com/` y el 404 enlaza desde la raíz del dominio; lo demás usa rutas relativas.

## Dirección visual (marca entregada por Jonathan el 3-oct-2026; manda sobre cualquier versión anterior)

- **Marca:** logo «a» con módulo ámbar (`assets/marca/logo-claro.svg` en fondo claro, `logo-oscuro.svg` en oscuro, con
  `<picture>` y `prefers-color-scheme`).
- **Paleta** (tokens en `assets/atk.css`, con modo oscuro): ámbar `#F2B544` (`--senal`) SOLO para la acción (botones,
  «Probar la demo», lo agregado a la lista) y el módulo del logo; encima va texto grafito, NUNCA blanco ni crema.
  Números, palomitas, franjas, antetítulos y subrayados van en verde petróleo `#176B64` (`--acento`/`--enlace`/`--foco`,
  sobre `--apoyo`). Grafito `#202729`, claro `#F7F5EF`, apoyo `#DCE9E5`. Bordes de controles con `--borde-control` (≥ 3:1).
- **Tipografía:** Manrope 700 para todos los títulos (la marca pide 600-700; con 800 todo se leía en negrita) e Inter
  para el texto (400, y 600 en controles y énfasis), autoalojadas en `assets/fuentes/`. Cuatro papeles, un estilo cada
  uno (`--t-h1`, `--t-seccion`, `--t-bloque` al final de `sitio.css`): H1 de página 32 → 48 px; H2 de sección 26 → 40 px
  en las páginas de recorrido; título de bloque 20 → 25 px (todos los H2 de fichas y guías, y los H3 de bloque); título
  de tarjeta 17 px. Un paso de `interaccion.mjs` lo exige. Cifras con `tabular-nums`, sin monoespaciada.
- **Radios:** solo tres, con rol: `--r-control` 8 px (botones, campos, íconos), `--r-tarjeta` 12 px (tarjetas y paneles),
  `--r-chico` 6 px (insignias, casillas). Nada de 999 px salvo la cuenta redonda de la cabecera.
- **Composición:** filetes en vez de cajas donde se pueda (cómo trabajamos, ficha, etapas); una sola apuesta por pantalla.
- **Lo que ve el visitante no lleva códigos internos** (R01, C05…): siguen en `data-id` y en el mensaje de WhatsApp.
- **Verbos:** «Preguntar» (manda un mensaje) y «Agregar a mi lista» (arma la cotización). No inventar otros.
- **Movimiento:** solo responder y estado. Hover solo con puntero fino. Nada en `opacity:0` esperando al JS.
- **Contenido:** precios solo los decididos por los socios (menú QR $10/mes; el de las fotos del recorrido 3D, +$300, se
  fue con el servicio); el resto «A cotizar». Nada de testimonios, logos de clientes ni cifras sin fuente. Las demos usan
  negocios ficticios rotulados.

## Cómo se trabaja (3-oct-2026)

- Generar: `node herramientas/generar.mjs` (las dos demos ya pasaron su verificación; el modo `PUBLICAR_PARCIAL` queda para
  una demo nueva que todavía no esté lista).
- Capturas: `node herramientas/capturas.mjs http://localhost:4900 <demo>` (cartel de cada demo) y
  `node herramientas/producto.mjs http://localhost:4900` (las pantallas reales que van en los héroes de la portada y de
  las páginas de negocio). Las tarjetas de las seis demos salen de `node herramientas/tarjetas-demos.mjs
  http://localhost:4900` (la pantalla clave de cada una en una ventana sobre el petróleo, siempre igual). Las tarjetas de
  las seis demos de antes quedan en la mesa y las reservas (oct-2026).
- Imágenes: capturas reales de las demos y fotos generadas con GPT (autorizado mientras el sitio sea interno), rotuladas
  «Imagen ilustrativa» y listadas en /creditos/. Las fotos generadas nunca llevan una pantalla o un QR inventado: encima
  van las pantallas reales (abajo). Dos platos o dos cabañas nunca comparten foto.
- Playwright (herramientas y pruebas de navegador) se carga con `herramientas/navegador.mjs`: la variable `PW`, el del
  repositorio (`npm install`, fija la 1.61.1, y `npx playwright install chromium`) o el de la máquina de Jonathan.
- Video de la portada: `node herramientas/video-producto.mjs http://localhost:4900` (~80 s). Graba la demo real de la mesa
  cuadro por cuadro con el tiempo bajo control (reloj falso de Playwright + animaciones pausadas y puestas en su tiempo),
  30 por segundo, y codifica AV1 (`.av1.mp4`, con su códec en `video-codecs.json`) y H.264 (`.mp4`), 4:2:0 de 8 bits, con
  el póster sacado del primer cuadro. Probado y descartado: la transmisión de pantalla de Chrome (CDP screencast) da
  ~15 cuadros por segundo y sin doble densidad; el webm VP9 de antes salía en 4:4:4 (Profile 1), que muchos
  decodificadores de teléfono no aceptan.
- Fotos con pantallas reales (3-oct): las fotos de GPT traen las pantallas en gris o apagadas y la placa en blanco;
  encima van las pantallas de las demos y QR que funcionan. `node herramientas/pantallas-equipo.mjs http://localhost:4900 ~/alphateklab/originales/pantallas`
  captura los contenidos y `python3 herramientas/componer-equipo.py ~/alphateklab/originales ~/alphateklab/originales/pantallas ~/alphateklab/originales/compuestas [nombres]`
  busca cada pantalla (región de luz pareja o rayos hasta el bisel), la deforma en perspectiva y la mezcla con la luz
  de la foto (deja `<nombre>-contorno.png` para revisar las esquinas). Todo eso vive en `~/alphateklab/originales`
  (fuera del repo, y no en /tmp: el apagón del 3-oct se llevó las compuestas que estaban ahí). Después de componer,
  comprobar que los QR se leen (jsQR sobre cada tamaño publicado).
- (Hasta oct-2026; con solo software se fue y volvió la caja de avisos.) El héroe de la portada era esa foto compuesta con pantallas de varios negocios a propósito: con solo la mesa, los
  dueños leían «hacen menús QR para restaurantes». Se recorta a 1250 px alrededor de los objetos (424, 392, 1674,
  1642 de la de 2048), se lleva su fondo (12, 47, 43) al petróleo de la banda (15, 44, 41) sumando (3, -3, -2) para que
  no se vea el borde, y se exporta a `assets/heroe/heroe-portada-{640,960,1250}.webp`. En la computadora mide hasta
  620 px (con 520 los objetos ocupaban el 8,5 % de la pantalla). Si faltan los archivos, vuelve la caja de avisos.
  Los avisos del teléfono de la foto salen de la portada anterior a 1b15188 (pantallas-equipo.mjs los toma de git).
- Edwin puede empujar a `main` (autorizado el 3-oct; llaves de despliegue que crea Jonathan, ver COLABORAR.md): siempre
  `git pull --rebase` antes de empezar y antes de empujar; si chocan archivos generados, resolver las fuentes y regenerar.
- Servidor local sin Python: `node herramientas/servir.mjs` (sirve la carpeta de los tres repos en el 4900, con rangos
  de bytes para los videos).
- Después de cada push, mirar que GitHub Pages haya publicado: `gh api repos/alphatend/<repo>/pages/builds --jq '.[0]'`
  (un despliegue de reservas falló una vez por un tiempo de espera de Jekyll; los tres repos llevan `.nojekyll`).
- Cerrojos, contra local y contra el sitio en vivo después de cada push:
  `PERMITIR_PENDIENTES=1 node --test pruebas/*.test.mjs pruebas/control/*.test.mjs`, `node pruebas/navegador/sitio.mjs <url>` y
  `node pruebas/navegador/interaccion.mjs <url>` (cada falla que encontró la revisión de clase mundial es un paso).
- Las dos de navegador también con el motor de Safari (iPhone), `MOTOR=webkit`. En la Fedora de Jonathan el WebKit de
  Playwright pide ICU 74 y libjpeg8, que el sistema no trae; hay un lanzador que los pone, y el Playwright de la versión
  que coincide (en otra máquina basta `npx playwright install webkit` y `MOTOR=webkit`):
  `MOTOR=webkit WEBKIT_EXE=/home/jonathan/Documents/NovahWEB/proyectos/guia-anfibios/qa-2026-09-30/a11y/webkit-libs/run-webkit.sh PW=/home/jonathan/Documents/NovahWEB/proyectos/guia-anfibios-panama/node_modules/playwright-core/index.mjs node pruebas/navegador/sitio.mjs <url>`.
- El buscador se mide de verdad con `node pruebas/control/medir.mjs`: 87 frases que escribieron agentes en el papel de
  dueños de negocios sin ver cómo está afinado (70 con respuesta, 17 de cosas que no hacemos), partidas en dos mitades.
  La de «desarrollo» se puede mirar (`--fallas`); la de «control» solo da cifras: no se leen sus fallas una por una ni se
  agregan sus palabras a `datos/`. Los arreglos son reglas generales del motor o datos escritos sin ver la batería.
  Al 3-oct-2026, en control: primero correcto 18/33 (era 11), a la vista 26/33, «no lo tenemos» 6/7. Con solo software
  (6-oct-2026): 11/33, 19/33 y 5/7 (11 de las 33 frases solo aceptan servicios de equipos; ver
  `pruebas/control/control.test.mjs`). `pruebas/buscador-solo-software.test.mjs` exige que lo de equipos dé «no lo tenemos».
  `pruebas/control/control.test.mjs` es el piso (sube, no baja); corre con `node --test pruebas/*.test.mjs pruebas/control/*.test.mjs`.
  `pruebas/buscador-personas.test.mjs` (40 frases de la revisión, 95 %) queda como cerrojo, pero ya se afinó con ellas.
- Datos del buscador: `datos/busqueda.mjs` (palabras por servicio y por negocio, equivalencias de Panamá y del chat,
  relleno) y `datos/situaciones.mjs` (~1.400 frases de situación por servicio, escritas y verificadas por agentes sin ver
  la batería). El motor (`js/buscador.mjs`): palabras vacías del español, faltas comunes por sonido, rareza de cada palabra
  (IDF), cobertura sobre las palabras que el índice conoce, y un mínimo que crece con el largo de la frase; lo que queda
  debajo se muestra como «lo más parecido que hacemos».

## Probado y descartado

- **View Transitions entre documentos (`@view-transition { navigation: auto }`), 3-oct-2026:** en Chromium 149 sin
  interfaz, una navegación por script con transición seguida de otra navegación dejó la página nueva sin pintar
  (`requestAnimationFrame` no corre, las capturas no salen, los clics esperan para siempre). No se pudo descartar que le
  pase a una persona con el botón atrás, así que no se usa. La prueba de navegador lo detecta (4 pasos fallan).
