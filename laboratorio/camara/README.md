# Contador de personas con cámara (laboratorio de alphateklab)

Demo estática: `index.html` + módulos ES en `js/`. Detecta personas en el navegador con MediaPipe Tasks Vision 1.0.1
(EfficientDet-Lite0), las sigue entre cuadros, cuenta cruces de una línea con sentido, lleva el aforo, avisa de filas
en una zona y arma un mapa de calor. El video no sale del equipo.

- `js/nucleo/`: lógica pura sin DOM (geometría, conteo con histéresis, seguimiento, fila, calor, minutos, reloj de video, estado
  guardado, CSV, textos). Todo lo que decide una cifra vive aquí y tiene prueba.
- `js/app.js`: DOM, video, permisos y el bucle. `js/trabajador-detector.js`: el modelo en un worker.
- `media/`: video de muestra con licencia libre y vista previa; licencias en `CREDITOS.md`.

## Pruebas

```sh
cd laboratorio/camara
node --test                      # todas las pruebas del núcleo, incluida la de las detecciones reales del video de muestra
node pruebas/navegador.mjs <carpeta-para-capturas>   # recorrido con Playwright: ~8 min, necesita ffmpeg e internet
```

Con Node 22, `node --test pruebas/` (con la carpeta) no busca dentro de ella y falla; sin argumentos, o con
`node --test 'pruebas/*.test.mjs'`, sí corre todo.
