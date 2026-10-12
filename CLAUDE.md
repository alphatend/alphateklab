# alphateklab · portada de productos y sitio de Citas Médicas

**Desde el 8-oct-2026** (Edwin) la raíz de alphateklab.com es la **portada de alphateklab**, con sus productos: **Med**
(en `med/`; se llamó Citas Médicas hasta el 10-oct, `PRODUCTO` en `datos/producto.mjs`), **Food** (cafeterías, bares y restaurantes: pedidos por QR y software a la medida, en `food/`; la tarjeta de lealtad, Vuelve, está oculta desde el 11-oct)
y **alphatend** (su propio dominio). La genera `herramientas/generar-portada.mjs` desde `datos/portada.mjs` y
`datos/food.mjs`; ver «Portada y Food» abajo.

Del 7 al 8-oct alphateklab.com vendía solo **Citas Médicas**, el sistema de agenda y expediente para clínicas y
consultorios (decisión de Edwin): su portada es una sola página larga (desde el 8-oct en `med/`), con privacidad, 404
y /citasmed/ (lleva a `med/`). El sitio de la agencia (catálogo de servicios, soluciones por negocio, guías, demos, cotizador) quedó entero
en la rama **`sitio-agencia`**; para volver a él: `git checkout sitio-agencia -- .` sobre `main` (o publicar esa rama).

- **Generar, en este orden:** `node herramientas/generar-portada.mjs --raiz` (la raíz, `index.html`, y `food/`) y
  después `node herramientas/generar-citas.mjs`. Este escribe `med/` (la portada de Citas Médicas), las páginas de
  función y las guías, `privacidad/`, `terminos/`, `404.html`, `citasmed/`, `sitemap.xml`, `robots.txt` y `llms.txt`
  (el sitemap, llms.txt y la privacidad nombran `food/` si está); con el registro en línea (`REGISTRO` en
  `datos/sitio.mjs`), también `registro/` y `entrar/`, que siguen en la raíz. No se editan a mano los HTML generados. Ojo: en los scripts que van dentro de una plantilla
  del generador, las barras invertidas van dobles (`\\s`, `\\/`); si no, se pierden y el script no corre.
- **Contenido:**
  - Todo sale de `datos/producto.mjs`: los precios, las dos partes (Agenda y Expediente), las filas de funciones, la
    conversación del recordatorio, el dictado, la hoja impresa, los accesos, los pasos y las preguntas.
  - El contacto (WhatsApp y correo) sale de `datos/sitio.mjs`. Sin contacto, la portada sale sin el formulario de la
    prueba y dice que respondan el correo con el que les llegó la página (`PRUEBA.sinContacto`). Para verlo en local: `WHATSAPP=507… CORREO=… node herramientas/generar-citas.mjs`, y antes de publicar,
    generar otra vez sin esas variables.
- **Precios (Edwin, 7-oct; los mismos de la app, `web/js/nucleo/plan.mjs` de citas-piloto):** son netos, sin sumar ITBMS.
  - Expediente: $29.99 al mes por profesional (cada médico que hace expedientes; la recepción, enfermería y
    administración no pagan).
  - Agenda: $14.99 al mes por clínica. Los mensajes de WhatsApp van APARTE: sin paquete (la recepción manda cada
    recordatorio con un toque desde el WhatsApp de la clínica), o 200, 500 o 1000 al mes por $15, $25 o $35, que salen
    solos. «Sin paquete» es lo que viene marcado (Edwin, 8-oct): que los $14.99 no parezcan incluir los mensajes.
  - Al lado, el precio de antes tachado: $49.99 el expediente y $34.99 la agenda, en las tarjetas y en Precios
    (`PRECIOS.antes`; Edwin, 7-oct). Solo se muestra: no se cobra ni se suma. Los mensajes no llevan tachado.
  - Prueba gratis de 7 días, sin tarjeta, y después mes a mes, sin plan anual.
- **Propuesta de valor (Edwin, 7-oct):** el expediente que el médico dicta con IA, sin escribir a mano ni teclear,
  explicado para el médico joven y para el que no se lleva con la tecnología. El expediente va primero en todo (héroe,
  tarjetas, secciones, precios, calculadora); la agenda después, explicada por lo que ahorra: la secretaria ya no llama
  paciente por paciente. En las tarjetas de los planes, poco (lo destacado y lo esencial); el detalle, en las secciones.
- **Iniciar sesión (Edwin, 7-oct):** arriba, «Iniciar sesión» (en el teléfono, «Entrar») lleva a `entrar/`: se escribe el
  usuario (o se pega la dirección) y pasa a `<clínica>.alphateklab.com/entrar.html?usuario=…`. La clínica la dice el
  servicio de cuentas (`cuentas.alphateklab.com/api/clinica?usuario=…`): en las cuentas del registro viejo el usuario
  no es la dirección (`edwincutire` en `clinica-alpha`). Si no contesta, va por lo de antes del primer punto. Con el
  correo no se puede.
- **Cabecera y tema:** arriba solo el logo de alphateklab, como antes. La página sale en claro aunque el equipo esté en
  oscuro, y el botón de la luna pasa al oscuro (se recuerda en `localStorage`, `atk-tema`); las capturas oscuras las
  pone `js/citas.js` desde `data-oscuro`.
- **Estilo:** `assets/citas.css` sobre los tokens de `assets/atk.css`; el script es `js/citas.js` (tema, menú,
  animaciones, calculadora y formulario). Edwin pidió una portada con más vida, como las de los programas médicos
  grandes.
  - **Movimiento:**
    - Las tarjetas del héroe entran con CSS.
    - Lo demás aparece al bajar con `animation-timeline: view()`.
    - La conversación y el dictado se animan solo mientras se ven.
    - Con «reducir movimiento», o sin soporte, todo queda quieto y visible: nada espera al JavaScript para verse.
  - **Lo que no lleva:** testimonios, logos de clientes ni cifras sin fuente.
- **Pantallas:**
  - Son capturas reales del piloto (`~/alphateklab/piloto-citas`) con un consultorio y pacientes inventados.
  - `node herramientas/capturas-citas.mjs <carpeta>` las saca en claro y oscuro, levantando un servidor temporal del
    piloto (`PILOTO=<carpeta>` para otra copia del código).
  - `node herramientas/imagenes-citas.mjs <carpeta>` las pasa a WebP en `assets/producto/citas-*.webp`.
  - `node herramientas/og-citas.mjs` rehace `assets/og-citas.jpg`, la imagen al compartir.
- **Pruebas (cerrojos):**
  - `npm run prueba` (`node --test pruebas/citas.test.mjs pruebas/portada.test.mjs pruebas/sintaxis.test.mjs`) revisa
    que lo publicado esté al día con `datos/`, los precios, los enlaces, las imágenes, los datos estructurados y el
    formulario de Food.
  - `node pruebas/navegador/citas.mjs <url>` (también con `MOTOR=webkit`) revisa de 320 a 1440 px (también la raíz y
    Food), la consola, el menú, los paquetes, la calculadora, el formulario, las animaciones, el modo oscuro y los
    títulos.
- **Portada y Food (8-oct):**
  - **Vuelve oculta (Edwin, 11-oct: «de momento no ofreceremos ese servicio»; no se borra):** su servicio lleva
    `publicado: false` en `datos/food.mjs` y no sale nada de ella en la portada, food/ ni llms.txt (ni tarjeta, ni
    sección, ni accesos de arriba, ni preguntas); sus datos siguen ahí. Sin ella, «Probar gratis» de food/ va directo
    a #contacto y no hay «Iniciar sesión». Para volver a ponerla: `publicado: true` y devolver los textos generales de
    Food (título, descripción, héroe, formulario y su tarjeta de la portada en `datos/portada.mjs`) a los del commit
    11c67ae; `pruebas/portada.test.mjs` exige hoy que no aparezca, así que esa prueba cambia también.
  - La vista previa sin publicar: `node herramientas/generar-portada.mjs` escribe `portada-nueva/` (noindex). No se
    versiona.
  - Food no tiene WhatsApp: «Contactar» lleva a su formulario (nombre, correo y lo que necesitan), que manda
    FormSubmit (formsubmit.co) al `destino` de `datos/food.mjs`. Sin destino, `--raiz` no genera. El primer envío
    desde el sitio publicado le llega a ese correo para activar el formulario.
  - El caso real de Food son pantallas del sistema de pedidos por QR de un restaurante: no se nombra al restaurante
    ni se ve su logo (pedido de Edwin).
  - `med.alphateklab.com` y `food.alphateklab.com` van hoy al servidor de las clínicas (comodín `*.alphateklab.com`):
    para usarlos, que lleven a `med/` y `food/` desde ese servidor y quedar reservados para que ninguna clínica los
    tome.
  - Correr las dos contra local y contra el sitio en vivo después de cada push.
- **Buscadores (8-oct):**
  - **Páginas de función:** la portada resume y `datos/paginas.mjs` da el detalle de cada parte en su propia página: hoy `expediente-clinico/`.
    - Cada una lleva el título y la descripción a la medida de Google (≤70 y ≤160), su canónica, las migas y sus preguntas en JSON-LD.
    - Va en el sitemap, en `llms.txt` y en el pie de todas las páginas, y su sección de la portada la enlaza («Todo sobre…»).
    - Lo que dicen está comprobado en el código del sistema: si el sistema cambia, se cambian.
  - **Guías:** van en `datos/guias-citas.mjs`; `datos/guias.mjs` es de la agencia.
    - Hoy hay una: `expediente-clinico-electronico-panama/`, sobre lo que pide la ley.
    - Cada dato legal lleva su norma, su artículo y el enlace a la Gaceta Oficial. La prueba exige que cada enlace de afuera esté en las fuentes y sea un `.gob.pa`.
    - Lo que el texto de la ley no resuelve va a «preguntarle a un abogado».
  - **Investigación del 8-oct:** en Panamá se busca «expediente clínico electrónico en Panamá» y «ley 68 expediente clínico».
    - «Citas Médicas» solo trae pacientes que buscan cita en la CSS: los títulos dicen la función.
    - Nada de páginas por especialidad o por ciudad con el mismo texto (serían páginas puerta).
  - **La de la agenda espera:** la portada vende paquetes de mensajes que «salen solos» y el sistema todavía no manda nada solo (ver el comentario en `datos/paginas.mjs`).
  - **`llms.txt`** (para ChatGPT y compañía, que es por donde más llega la gente a alphatend) sale de los mismos datos.
  - **IndexNow:** la clave está en `datos/sitio.mjs` y se sirve en `/<clave>.txt`. Después de publicar y de que Pages termine: `node herramientas/indexnow.mjs`.
  - **HTTPS obligatorio** en GitHub Pages (`https_enforced`, 8-oct): http y www van a `https://alphateklab.com/`.
  - **Cerrojos de `pruebas/citas.test.mjs`:** las pruebas «para los buscadores».
- **Pendiente (7-oct):** quitar del repositorio las páginas y fuentes del sitio de la agencia que siguen en `main`
  (`servicios/`, `soluciones/`, `guias/`, `laboratorio/`, `cotizar/`, `diagnostico/`, `creditos/`, sus `datos/`, `js/`,
  pruebas y herramientas). La portada ya no las enlaza, pero se abren por su dirección. Están a salvo en
  `sitio-agencia`.

Lo de abajo describe el sitio de la agencia (rama `sitio-agencia`).

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
- Después de cada push, mirar que GitHub Pages haya publicado: `gh api repos/jojomunoz/<repo>/pages/builds --jq '.[0]'`
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
