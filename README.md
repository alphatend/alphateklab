# alphateklab · Citas Médicas

Desde el 7-oct-2026, **alphateklab.com** presenta un solo producto: **Citas Médicas**, la agenda con recordatorios por
WhatsApp y el expediente clínico para clínicas y consultorios de Panamá. Se contratan por separado:

- **Expediente:** $29.99 al mes por profesional.
- **Agenda:** $14.99 al mes por clínica. Los mensajes automáticos de WhatsApp, aparte: 200, 500 o 1000 al mes por $15,
  $25 o $35 (sin paquete, la recepción manda cada recordatorio con un toque).
- **Prueba:** 7 días gratis.

Dominio: https://alphateklab.com/ (GitHub Pages de este repositorio, rama `main`).

## Qué hay

| Ruta | Qué es |
|---|---|
| `index.html` | La portada: las dos partes, cómo funciona cada una (con capturas reales y animaciones), accesos, precios con calculadora, cómo empezar, preguntas y el formulario de la prueba |
| `privacidad/` | Qué datos trata el sitio (ninguno) |
| `citasmed/` | Lleva a la portada |
| `404.html` | Página que no existe |

## Cómo se cambia

Todo el contenido está en `datos/producto.mjs` (precios, textos, preguntas) y `datos/sitio.mjs` (contacto):

```sh
node herramientas/generar-citas.mjs                        # escribe las páginas
node --test pruebas/citas.test.mjs pruebas/sintaxis.test.mjs
node herramientas/servir.mjs                               # y abrir http://localhost:4900/alphateklab/
node pruebas/navegador/citas.mjs http://localhost:4900/alphateklab/
```

Las capturas salen del piloto del sistema con datos inventados: `node herramientas/capturas-citas.mjs <carpeta>`,
`node herramientas/imagenes-citas.mjs <carpeta>` y `node herramientas/og-citas.mjs`.

## El sitio de la agencia

El sitio de la agencia (catálogo de servicios, soluciones por negocio, guías y demos) está en la rama
`sitio-agencia`. Lo que sigue lo describe.

## Qué había (sitio de la agencia)

| Ruta | Qué es |
|---|---|
| `index.html` | Portada: índice de servicios, catálogo con filtros, laboratorio de demos, preguntas y cotizador |
| `servicios/<slug>/` | Una página por servicio, para mandar el enlace de uno solo |
| `laboratorio/` | Índice de las demos (la de la mesa y la de citas y reservas) |
| `privacidad/` | Qué datos trata el sitio (ninguno) y las demos |

Las demos de restaurante y de citas viven en sus propios repos:
[alphateklab-mesa](https://alphatend.github.io/alphateklab-mesa/) y
[alphateklab-reservas](https://alphatend.github.io/alphateklab-reservas/).

## Cómo se cambia

El catálogo vive en `datos/catalogo.mjs`. Las páginas se generan de ahí:

```sh
node herramientas/generar.mjs        # escribe index.html, servicios/, privacidad/, 404.html, sitemap.xml, robots.txt
node --test pruebas/*.test.mjs       # reglas del catálogo y lógica de la portada
python3 -m http.server 4900 -d ..    # y abrir http://localhost:4900/alphateklab/
node pruebas/navegador/portada.mjs http://localhost:4900/alphateklab/
```

El generador se niega a escribir si el catálogo tiene un precio que no decidieron los socios, una demo que no
existe, un código repetido, un servicio que se instala o lista equipo, o una muletilla de las que la guía de la casa
prohíbe. El único precio publicado es el del menú QR ($10 al mes); el resto dice «A cotizar».

Sin paso de build en el navegador: HTML, CSS y módulos ES. La fuente (Archivo) va autoalojada en `assets/fuentes/`.
