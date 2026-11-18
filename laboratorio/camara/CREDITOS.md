# Créditos y licencias · laboratorio/camara

## Video de muestra (`media/muestra-zona-peatonal.mp4` y `.webm`)

- **Qué es:** «Pedestrian Area», secuencia de prueba de video de 15 s (375 cuadros, 1920 × 1080, 25 cuadros/s) de una
  zona peatonal de Múnich. Cámara baja y fija; la gente pasa muy cerca.
- **Quién la grabó:** Taurus Media Technik (Dr. Karl Mauthe), verano de 2001. Publicada entre las secuencias de prueba
  1080p de la Universidad Técnica de Múnich (TUM) y distribuida por Xiph.org.
- **Licencia:** la ficha original (`ReadMe_1080p.txt`) dice textualmente:
  «Restrictions of use: No restrictions» y «Copyright: No Copyright».
  - Ficha: https://media.xiph.org/video/derf/ftp.ldv.e-technik.tu-muenchen.de/pub/test_sequences/1080p/ReadMe_1080p.txt
  - Índice de Xiph.org: https://media.xiph.org/video/derf/ (entrada `pedestrian_area`)
  - Copia en Wikimedia Commons, marcada CC0:
    https://commons.wikimedia.org/wiki/File:Video_Codec_Test_pedestrian_area_1080p25.y4m.webm
- **Qué le hicimos:** partimos de la copia de Commons (WebM VP8, sha256 `bfadaa62…0c26`), le quitamos el audio, la
  reducimos a 960 × 540 y la recomprimimos:
  - `muestra-zona-peatonal.mp4`: H.264, `ffmpeg -an -vf scale=960:540:flags=lanczos -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -profile:v high -movflags +faststart` (1.99 MB).
  - `muestra-zona-peatonal.webm`: VP9, `ffmpeg -an -vf scale=960:540:flags=lanczos -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1` (1.73 MB).
- **Ojo:** muestra personas reales en la calle. Por eso la demo arranca con el pixelado de personas encendido.

Comprobado el 3-oct-2026. Se descartaron los videos de Netflix del mismo índice (licencia CC BY-NC-ND: no comercial y
sin obras derivadas) y otros de Commons con CC BY-SA.

## Vista previa (`media/vista-previa.webp`, `media/vista-previa-og.jpg`)

Captura de esta misma demo corriendo sobre el video de muestra, con el pixelado encendido, hecha con Playwright.

## Detección

- **MediaPipe Tasks Vision 1.0.1** (Google), licencia Apache 2.0. Se carga en ejecución desde
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/`.
- **Modelo EfficientDet-Lite0, float16** (7.25 MB), el que Google publica para el detector de objetos de MediaPipe,
  entrenado con COCO. Se baja en ejecución desde
  `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`.
  La documentación de MediaPipe no publica una licencia propia del modelo; no está copiado en este repositorio.
