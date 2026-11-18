// Visor 3D: construye el apartamento con three.js a partir del modelo (nucleo/plano.mjs → construirModelo) y lo
// recorre en primera persona o desde arriba («casa de muñecas»). THREE llega como parámetro: la página lo importa
// con import() solo cuando hace falta. Solo dibuja cuando algo cambia.

import {
  paso, girarMirada, fovVertical, suavizarMover, intencionQuieta, ALTURA_OJOS, RADIO_JUGADOR, rumboAYaw,
} from './nucleo/movimiento.mjs';
import { ambienteEn, GROSOR_HOJA } from './nucleo/plano.mjs';
import { resolverColision, puntoEnPoligono, distancia3, medidaValida } from './nucleo/geometria.mjs';
import { area as fmtArea } from './nucleo/formato.mjs';
import { colocarEtiqueta, giroDePuerta, margenesPorOclusion } from './nucleo/etiquetas.mjs';

const C = {
  pared: 0xeceae6,
  corte: 0x202729,
  techo: 0xf5f4f1,
  zocalo: 0xcfc9be,
  marco: 0x6b7079,
  vidrio: 0xe4eef5,
  hoja: 0xe9e5dd,
  entrada: 0x7a5a40,
  manija: 0x3a4446,
  baranda: 0x4a5058,
  cielo: 0xd3dee8,
  senal: 0xf2b544,
  sol: 0xfff3da,
  etiqueta: 'rgba(32, 39, 41, 0.62)',
};

const PISO_DE = { sala: 'porcelanato', pasillo: 'porcelanato', otro: 'porcelanato', recamara: 'madera', bano: 'baldosa', cocina: 'baldosa', lavanderia: 'baldosa', balcon: 'exterior' };
// Presupuesto de la guía (§6.1): el momento de autor, una vez, hasta 800 ms; orientar (cambiar de vista), 250–400 ms.
const DUR_TRANSICION = 800; // ms: al entrar, de la vista de arriba a los ojos del visitante
const DUR_CAMBIO = 380; // ms: cambiar de vista con el botón o ir a otro punto
const ORBITA_INICIAL = { yaw: 0.3, pitch: 1.26 };
// Los nombres del piso: letra de hasta 26 cm, y lejos de las paredes que los taparían vistos desde arriba.
const LETRA_PISO = 0.26;
const ESCALA_AREA = 0.78;
const SENSIBILIDAD = 0.0032;

// Generador determinista para que las baldosas varíen igual en cada carga.
function azar(semilla) {
  let s = semilla >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function crearVisor(THREE, opciones) {
  const { contenedor, alCambiarAmbiente, alMover, alMedir, alCambiarVista, alError, reducirMovimiento, colorFondo } = opciones;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'default' });
  } catch (e) {
    const err = new Error('webgl');
    err.causa = e;
    throw err;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const lienzo = renderer.domElement;
  lienzo.className = 'visor__lienzo';
  lienzo.setAttribute('role', 'img');
  lienzo.setAttribute('aria-label', 'Vista 3D del plano.');
  contenedor.prepend(lienzo);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(70, 1, 0.05, 80);
  camara.rotation.order = 'YXZ';
  const anisotropia = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  escena.add(new THREE.HemisphereLight(0xf6f8ff, 0xcfc8bb, 2.1));
  const sol = new THREE.DirectionalLight(0xfff6ea, 1.55);
  sol.position.set(-6, 10, 7);
  escena.add(sol);
  const contraluz = new THREE.DirectionalLight(0xe8eef8, 0.55);
  contraluz.position.set(8, 6, -6);
  escena.add(contraluz);

  // ── texturas hechas en código (sin descargas de terceros) ──
  const texturas = new Map();
  function texturaPiso(tipo) {
    if (texturas.has(tipo)) return texturas.get(tipo);
    const lado = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = lado;
    const g = cv.getContext('2d');
    const r = azar(tipo.length * 977 + 13);
    let metrosPorTextura;
    if (tipo === 'madera') {
      metrosPorTextura = 1.2;
      const tablas = 10, ancho = lado / tablas;
      for (let i = 0; i < tablas; i++) {
        let y = -r() * lado;
        while (y < lado) {
          const largoT = lado * (0.45 + r() * 0.5);
          const v = (r() - 0.5) * 22;
          g.fillStyle = `rgb(${196 + v}, ${162 + v * 0.9}, ${121 + v * 0.7})`;
          g.fillRect(i * ancho, y, ancho, largoT);
          g.strokeStyle = 'rgba(90, 60, 30, 0.10)';
          g.lineWidth = 1;
          for (let k = 0; k < 4; k++) {
            const gx = i * ancho + 4 + r() * (ancho - 8);
            g.beginPath(); g.moveTo(gx, y); g.lineTo(gx + (r() - 0.5) * 3, y + largoT); g.stroke();
          }
          g.fillStyle = 'rgba(80, 52, 28, 0.35)';
          g.fillRect(i * ancho, y, ancho, 1.5);
          y += largoT;
        }
        g.fillStyle = 'rgba(80, 52, 28, 0.38)';
        g.fillRect(i * ancho, 0, 1.5, lado);
      }
    } else {
      const conf = {
        porcelanato: { m: 1.2, n: 2, base: [216, 212, 204], junta: 'rgba(150, 144, 134, 0.75)', vari: 7 },
        baldosa: { m: 1.2, n: 4, base: [228, 230, 228], junta: 'rgba(150, 156, 154, 0.8)', vari: 5 },
        exterior: { m: 1.2, n: 3, base: [178, 172, 162], junta: 'rgba(110, 104, 96, 0.8)', vari: 9 },
      }[tipo];
      metrosPorTextura = conf.m;
      const t = lado / conf.n;
      for (let i = 0; i < conf.n; i++) {
        for (let j = 0; j < conf.n; j++) {
          const v = (r() - 0.5) * conf.vari;
          g.fillStyle = `rgb(${conf.base[0] + v}, ${conf.base[1] + v}, ${conf.base[2] + v})`;
          g.fillRect(i * t, j * t, t, t);
        }
      }
      g.fillStyle = conf.junta;
      for (let i = 0; i < conf.n; i++) {
        g.fillRect(i * t, 0, 2, lado);
        g.fillRect(0, i * t, lado, 2);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / metrosPorTextura, 1 / metrosPorTextura);
    tex.anisotropy = anisotropia;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    texturas.set(tipo, mat);
    return mat;
  }

  let degradadoSol = null;
  function texturaSol() {
    if (degradadoSol) return degradadoSol;
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 64;
    const g = cv.getContext('2d');
    const d = g.createLinearGradient(0, 0, 0, 64);
    d.addColorStop(0, 'rgba(255, 246, 222, 0.62)');
    d.addColorStop(1, 'rgba(255, 246, 222, 0)');
    g.fillStyle = d;
    g.fillRect(0, 0, 4, 64);
    degradadoSol = new THREE.CanvasTexture(cv);
    degradadoSol.colorSpace = THREE.SRGBColorSpace;
    return degradadoSol;
  }

  const F1 = 'Manrope, Inter, "Helvetica Neue", Arial, sans-serif';
  const F2 = 'Inter, "Helvetica Neue", Arial, sans-serif';
  const PX = 64; // letra del nombre en la textura
  const PAD = 12;
  const medidor = document.createElement('canvas').getContext('2d');
  /** Ancho del área («12.92 m²») en Inter, con letra de tamaño 1. */
  function anchoArea(texto) {
    medidor.font = `500 100px ${F2}`;
    return medidor.measureText(texto).width / 100;
  }

  /** Nombre (en una o dos líneas) y área, centrados en un lienzo; devuelve la textura y su tamaño en metros con letra t. */
  function texturaEtiqueta(lineas, sub, t) {
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d');
    const salto = PX * 1.15, pxSub = PX * ESCALA_AREA;
    g.font = `700 ${PX}px ${F1}`;
    const w1 = Math.max(...lineas.map((l) => g.measureText(l).width));
    g.font = `500 ${pxSub}px ${F2}`;
    const w2 = g.measureText(sub).width;
    cv.width = Math.ceil(Math.max(w1, w2) + 2 * PAD);
    cv.height = Math.ceil((lineas.length + ESCALA_AREA) * salto + 2 * PAD);
    g.fillStyle = C.etiqueta;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${PX}px ${F1}`;
    lineas.forEach((l, i) => g.fillText(l, cv.width / 2, PAD + salto * (i + 0.5)));
    g.font = `500 ${pxSub}px ${F2}`;
    g.fillText(sub, cv.width / 2, PAD + salto * lineas.length + (salto * ESCALA_AREA) / 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = anisotropia;
    const metrosPorPx = t / PX;
    return { tex, ancho: cv.width * metrosPorPx, alto: cv.height * metrosPorPx };
  }

  // ── materiales compartidos ──
  const M = {
    pared: new THREE.MeshLambertMaterial({ color: C.pared }),
    corte: new THREE.MeshLambertMaterial({ color: C.corte }),
    techo: new THREE.MeshLambertMaterial({ color: C.techo, side: THREE.BackSide }),
    zocalo: new THREE.MeshLambertMaterial({ color: C.zocalo }),
    marco: new THREE.MeshLambertMaterial({ color: C.marco }),
    vidrio: new THREE.MeshBasicMaterial({ color: C.vidrio, transparent: true, opacity: 0.55, depthWrite: false }),
    hoja: new THREE.MeshLambertMaterial({ color: C.hoja }),
    entrada: new THREE.MeshLambertMaterial({ color: C.entrada }),
    manija: new THREE.MeshLambertMaterial({ color: C.manija }),
    baranda: new THREE.MeshLambertMaterial({ color: C.baranda }),
    senal: new THREE.MeshBasicMaterial({ color: C.senal }),
    senalLinea: new THREE.MeshBasicMaterial({ color: C.senal, depthTest: false, transparent: true }),
  };
  const cajaUnidad = new THREE.BoxGeometry(1, 1, 1);

  // ── estado ──
  let modelo = null;
  let grupoModelo = null;
  let pisos = [];
  let paredesMalla = null;
  let techos = null;
  let marcador = null;
  let estado = { x: 0, y: 0, yaw: 0, pitch: 0 };
  let ambienteActual = null;
  let vista = 'arriba';
  const orbita = { ...ORBITA_INICIAL, dist: 16, objetivo: new THREE.Vector3() };
  let intencion = { avance: 0, lateral: 0, giro: 0, correr: false };
  let animacion = null;
  let pausado = false;
  let solicitado = false;
  let ultimoT = null;
  let midiendo = false;
  let cuadros = 0; // cuadros dibujados (las pruebas comprueban que no hay bucle cuando nada cambia)
  const medidas = []; // { a, b, distancia, grupo }
  let puntoPendiente = null;
  const raycaster = new THREE.Raycaster();

  // ── construir el modelo ──
  function liberar(obj) {
    obj.traverse((o) => {
      if (o.geometry && o.geometry !== cajaUnidad) o.geometry.dispose();
      if (o.material && o.userData.propio) {
        if (o.material.map && o.userData.mapaPropio) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  function cajas(material, lista, nombre) {
    if (!lista.length) return null;
    const malla = new THREE.InstancedMesh(cajaUnidad, material, lista.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0);
    lista.forEach((c, i) => {
      q.setFromAxisAngle(eje, c.angulo);
      m4.compose(new THREE.Vector3(c.x, c.y, c.z), q, new THREE.Vector3(Math.max(c.largo, 1e-4), Math.max(c.alto, 1e-4), Math.max(c.prof, 1e-4)));
      malla.setMatrixAt(i, m4);
    });
    malla.instanceMatrix.needsUpdate = true;
    malla.computeBoundingSphere();
    malla.name = nombre;
    return malla;
  }

  // Caja alineada con una dirección del plano: centro (cx, cy) en planta, de y0 a y1 de alto.
  const caja = (cx, cy, dir, largo, y0, y1, prof) => ({
    x: cx, z: cy, y: (y0 + y1) / 2, alto: y1 - y0, largo, prof, angulo: Math.atan2(-dir.y, dir.x),
  });

  // Los nombres en el piso se leen desde arriba. Caminando se esconden: desde los ojos se leían al revés, y el
  // nombre del ambiente ya va en el rótulo de la pantalla.
  let materialesEtiqueta = [];
  function opacidadEtiquetas(v) {
    for (const mat of materialesEtiqueta) mat.visible = v !== 'primera';
  }

  function construir(m) {
    const g = new THREE.Group();
    pisos = [];
    materialesEtiqueta = [];
    // Dónde queda la cámara de la vista desde arriba (en planta y de alto), para no escribir los nombres en la franja
    // de piso que tapan las paredes: así se cortaba «Baño princip» y «avandería» en la imagen de portada.
    const k = m.limites;
    const d0 = 18;
    const camaraArriba = {
      x: (k.x0 + k.x1) / 2 + d0 * Math.cos(ORBITA_INICIAL.pitch) * Math.sin(ORBITA_INICIAL.yaw),
      y: (k.y0 + k.y1) / 2 + d0 * Math.cos(ORBITA_INICIAL.pitch) * Math.cos(ORBITA_INICIAL.yaw),
      alto: 1.2 + d0 * Math.sin(ORBITA_INICIAL.pitch),
    };
    const giros = m.aberturas.map(giroDePuerta).filter(Boolean);
    // Pisos y techos
    const grupoTechos = new THREE.Group();
    for (const amb of m.ambientes) {
      const forma = new THREE.Shape(amb.poligono.map((p) => new THREE.Vector2(p.x, -p.y)));
      const geo = new THREE.ShapeGeometry(forma);
      geo.rotateX(-Math.PI / 2);
      const piso = new THREE.Mesh(geo, texturaPiso(PISO_DE[amb.tipo] ?? 'porcelanato'));
      piso.userData = { tipo: 'piso', ambiente: amb.id };
      g.add(piso);
      pisos.push(piso);
      if (!amb.exterior) {
        const t = new THREE.Mesh(geo.clone(), M.techo);
        t.position.y = m.alto;
        grupoTechos.add(t);
      }
      // Nombre y m² en el piso: discretos (letra de hasta 26 cm), en una o dos líneas, girados si el ambiente es angosto,
      // sin pisar el giro de las puertas y fuera de la franja que tapan las paredes vistas desde arriba.
      const sub = fmtArea(amb.area);
      const centro = { x: (amb.caja.x0 + amb.caja.x1) / 2, y: (amb.caja.y0 + amb.caja.y1) / 2 };
      const margen = margenesPorOclusion(centro, camaraArriba, { altoPared: m.alto, base: 0.16 });
      const e = colocarEtiqueta(amb.nombre, {
        poligono: amb.poligono, obstaculos: giros, margen, preferido: amb.etiqueta, maxT: LETRA_PISO,
        paso: Math.max(0.05, Math.min(amb.caja.ancho, amb.caja.largo) / 24), extra: { ancho: anchoArea(sub), escala: ESCALA_AREA },
      });
      if (e.t > 0) {
        const { tex, ancho, alto } = texturaEtiqueta(e.lineas, sub, e.t);
        const matEtiqueta = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        materialesEtiqueta.push(matEtiqueta);
        const plano = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), matEtiqueta);
        plano.userData = { propio: true, mapaPropio: true };
        // Acostado en el piso; girado, se lee de abajo hacia arriba del plano, como en el plano en SVG.
        plano.rotation.set(-Math.PI / 2, 0, e.girada ? Math.PI / 2 : 0);
        plano.position.set(e.x, 0.006, e.y);
        plano.renderOrder = 2;
        g.add(plano);
      }
    }
    g.add(grupoTechos);

    // Paredes, barandas y zócalos
    const listaParedes = [], listaBarandaVidrio = [], listaBarandaTubo = [], listaZocalos = [];
    for (const pared of m.paredes) {
      for (const pz of pared.piezas) {
        const cx = (pz.a.x + pz.b.x) / 2, cy = (pz.a.y + pz.b.y) / 2;
        const largo = Math.hypot(pz.b.x - pz.a.x, pz.b.y - pz.a.y);
        if (pared.tipo === 'baranda') {
          listaBarandaVidrio.push(caja(cx, cy, pared.dir, largo, 0.06, pared.alto - 0.05, 0.016));
          listaBarandaTubo.push(caja(cx, cy, pared.dir, largo, pared.alto - 0.05, pared.alto, pared.grosor));
          listaBarandaTubo.push(caja(cx, cy, pared.dir, largo, 0, 0.06, pared.grosor));
          continue;
        }
        listaParedes.push(caja(cx, cy, pared.dir, largo, pz.y0, pz.y1, pared.grosor));
        if (pz.y0 < 1e-6) listaZocalos.push(caja(cx, cy, pared.dir, largo, 0, 0.085, pared.grosor + 0.024));
      }
    }
    // Las tapas de las paredes (lo que se ve desde arriba) van en grafito, como el corte de un plano.
    paredesMalla = cajas([M.pared, M.pared, M.corte, M.pared, M.pared, M.pared], listaParedes, 'paredes');
    for (const malla of [
      paredesMalla,
      cajas(M.vidrio, listaBarandaVidrio, 'baranda-vidrio'),
      cajas(M.baranda, listaBarandaTubo, 'baranda'),
      cajas(M.zocalo, listaZocalos, 'zocalos'),
    ]) if (malla) g.add(malla);

    // Marcos, vidrios, hojas de puerta y la luz que entra por las ventanas
    const listaMarcos = [], listaVidrios = [], listaHojas = [], listaEntrada = [], listaManijas = [], listaRepisas = [];
    const barra = 0.05;
    for (const ab of m.aberturas) {
      const { a, b, dir, grosor } = ab;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const prof = grosor + 0.02;
      const jamba = (p, s) => ({ x: p.x + dir.x * s, y: p.y + dir.y * s });
      if (ab.tipo === 'ventana') {
        const j0 = jamba(a, barra / 2), j1 = jamba(b, -barra / 2);
        listaMarcos.push(caja(j0.x, j0.y, dir, barra, ab.antepecho, ab.dintel, 0.07));
        listaMarcos.push(caja(j1.x, j1.y, dir, barra, ab.antepecho, ab.dintel, 0.07));
        listaMarcos.push(caja(cx, cy, dir, ab.ancho, ab.antepecho, ab.antepecho + barra, 0.07));
        listaMarcos.push(caja(cx, cy, dir, ab.ancho, ab.dintel - barra, ab.dintel, 0.07));
        listaMarcos.push(caja(cx, cy, dir, 0.03, ab.antepecho, ab.dintel, 0.05)); // parteluz
        listaVidrios.push(caja(cx, cy, dir, ab.ancho - barra, ab.antepecho + barra, ab.dintel - barra, 0.012));
        // repisa hacia adentro
        const n = ab.haciaDentro;
        listaRepisas.push(caja(cx + n.x * 0.03, cy + n.y * 0.03, dir, ab.ancho + 0.08, ab.antepecho - 0.025, ab.antepecho + 0.005, grosor + 0.08));
      } else if (ab.tipo === 'puerta' || ab.tipo === 'puerta-cerrada') {
        const j0 = jamba(a, 0.03), j1 = jamba(b, -0.03);
        listaMarcos.push(caja(j0.x, j0.y, dir, 0.06, 0, ab.dintel, prof));
        listaMarcos.push(caja(j1.x, j1.y, dir, 0.06, 0, ab.dintel, prof));
        listaMarcos.push(caja(cx, cy, dir, ab.ancho, ab.dintel - 0.06, ab.dintel, prof));
        if (ab.tipo === 'puerta-cerrada') {
          listaEntrada.push(caja(cx, cy, dir, ab.ancho - 0.12, 0, ab.dintel - 0.06, 0.045));
          for (const s of [1, -1]) {
            const p = jamba(b, -0.16);
            listaManijas.push(caja(p.x + -dir.y * 0.04 * s, p.y + dir.x * 0.04 * s, dir, 0.12, 1.0, 1.03, 0.025));
          }
        } else if (ab.hoja) {
          const hdir = { x: ab.hoja.b.x - ab.hoja.a.x, y: ab.hoja.b.y - ab.hoja.a.y };
          const l = Math.hypot(hdir.x, hdir.y);
          const u = { x: hdir.x / l, y: hdir.y / l };
          listaHojas.push(caja((ab.hoja.a.x + ab.hoja.b.x) / 2, (ab.hoja.a.y + ab.hoja.b.y) / 2, u, l, 0.005, ab.dintel - 0.07, GROSOR_HOJA));
          const pm = { x: ab.hoja.b.x - u.x * 0.07, y: ab.hoja.b.y - u.y * 0.07 };
          for (const s of [1, -1]) listaManijas.push(caja(pm.x + -u.y * 0.04 * s, pm.y + u.x * 0.04 * s, u, 0.1, 1.0, 1.025, 0.025));
        }
      } else if (ab.tipo === 'corrediza') {
        const j0 = jamba(a, barra / 2), j1 = jamba(b, -barra / 2);
        listaMarcos.push(caja(j0.x, j0.y, dir, barra, 0, ab.dintel, prof));
        listaMarcos.push(caja(j1.x, j1.y, dir, barra, 0, ab.dintel, prof));
        listaMarcos.push(caja(cx, cy, dir, ab.ancho, ab.dintel - barra, ab.dintel, prof));
        listaMarcos.push(caja(cx, cy, dir, ab.ancho, 0, 0.03, prof));
        // Las dos hojas quedan apiladas en la mitad fija: la otra mitad es el paso al balcón.
        const mitad = ab.ancho / 2;
        for (const s of [1, -1]) {
          const off = (grosor / 4) * s;
          const p = { x: cx + dir.x * mitad / 2 - dir.y * off, y: cy + dir.y * mitad / 2 + dir.x * off };
          listaMarcos.push(caja(p.x - dir.x * (mitad / 2 - 0.025), p.y - dir.y * (mitad / 2 - 0.025), dir, 0.05, 0.03, ab.dintel - barra, 0.04));
          listaMarcos.push(caja(p.x + dir.x * (mitad / 2 - 0.025), p.y + dir.y * (mitad / 2 - 0.025), dir, 0.05, 0.03, ab.dintel - barra, 0.04));
          listaVidrios.push(caja(p.x, p.y, dir, mitad - 0.06, 0.03, ab.dintel - barra, 0.012));
        }
      }
      // Luz de día sobre el piso, del lado de adentro
      if ((ab.tipo === 'ventana' || ab.tipo === 'corrediza') && ab.daAfuera && ab.ambienteDentro) {
        const amb = m.ambientes.find((x) => x.id === ab.ambienteDentro);
        if (amb && !amb.exterior) {
          const n = ab.haciaDentro;
          const fondo = ab.tipo === 'corrediza' ? 2.1 : ab.antepecho > 1.3 ? 0.8 : 1.4;
          const p = (q, d) => [q.x + n.x * d, 0.004, q.y + n.y * d];
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute([...p(a, ab.grosor / 2), ...p(b, ab.grosor / 2), ...p(b, fondo), ...p(a, fondo)], 3));
          geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
          geo.setIndex([0, 1, 2, 0, 2, 3]);
          const parche = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texturaSol(), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
          parche.userData = { propio: true };
          parche.renderOrder = 1;
          g.add(parche);
        }
      }
    }
    for (const malla of [
      cajas(M.marco, listaMarcos, 'marcos'),
      cajas(M.vidrio, listaVidrios, 'vidrios'),
      cajas(M.hoja, listaHojas, 'hojas'),
      cajas(M.entrada, listaEntrada, 'entrada'),
      cajas(M.manija, listaManijas, 'manijas'),
      cajas(M.pared, listaRepisas, 'repisas'),
    ]) if (malla) g.add(malla);

    // «Estás aquí» para la vista desde arriba
    const forma = new THREE.Shape();
    forma.moveTo(0, 0.42); forma.lineTo(0.24, -0.16); forma.lineTo(0, -0.04); forma.lineTo(-0.24, -0.16); forma.closePath();
    const flecha = new THREE.ShapeGeometry(forma);
    flecha.rotateX(-Math.PI / 2);
    marcador = new THREE.Group();
    const disco = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x202729, transparent: true, opacity: 0.85, depthWrite: false }));
    disco.userData = { propio: true };
    const punta = new THREE.Mesh(flecha, M.senal);
    punta.position.y = 0.002;
    marcador.add(disco, punta);
    marcador.position.y = 0.012;
    marcador.renderOrder = 3;
    g.add(marcador);

    techos = grupoTechos;
    return g;
  }

  function cargarModelo(m, { vistaInicial = 'arriba' } = {}) {
    borrarMedidas();
    if (grupoModelo) {
      escena.remove(grupoModelo);
      liberar(grupoModelo);
    }
    modelo = m;
    grupoModelo = construir(m);
    escena.add(grupoModelo);
    estado = { x: m.inicio.x, y: m.inicio.y, yaw: rumboAYaw(m.inicio.rumbo ?? 0), pitch: -0.06 };
    const k = m.limites;
    orbita.objetivo.set((k.x0 + k.x1) / 2, 1.2, (k.y0 + k.y1) / 2); // a media altura: así el modelo queda centrado
    orbitaTocada = false;
    encuadrar();
    orbita.yaw = ORBITA_INICIAL.yaw;
    orbita.pitch = ORBITA_INICIAL.pitch;
    ambienteActual = ambienteEn(estado, m.ambientes)?.id ?? null;
    animacion = null;
    ponerVista(vistaInicial, { animar: false });
    alCambiarAmbiente?.(ambienteDe(ambienteActual));
    alMover?.(estado);
  }

  const ambienteDe = (id) => modelo?.ambientes.find((a) => a.id === id) ?? null;

  // Distancia de la vista de arriba para que entre el plano entero; en pantallas angostas (teléfono vertical) se aleja.
  // Se busca (por bisección) la distancia más corta a la que las 8 esquinas del modelo caen dentro de la imagen.
  let orbitaTocada = false;
  const camaraPrueba = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  function encuadrar() {
    if (!modelo || orbitaTocada) return;
    const k = modelo.limites;
    const esquinas = [];
    for (const x of [k.x0 - 0.15, k.x1 + 0.15]) for (const y of [0, modelo.alto]) for (const z of [k.y0 - 0.15, k.y1 + 0.15]) esquinas.push(new THREE.Vector3(x, y, z));
    camaraPrueba.aspect = camara.aspect;
    camaraPrueba.updateProjectionMatrix();
    const cabe = (d) => {
      orbita.dist = d;
      const p = poseOrbita();
      camaraPrueba.position.copy(p.pos);
      camaraPrueba.quaternion.copy(p.quat);
      camaraPrueba.updateMatrixWorld();
      return esquinas.every((v) => { const q = v.clone().project(camaraPrueba); return Math.abs(q.x) <= 0.94 && Math.abs(q.y) <= 0.9 && q.z < 1; });
    };
    let lo = 2, hi = 200;
    for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (cabe(m)) hi = m; else lo = m; }
    orbita.dist = hi;
  }

  // ── cámara ──
  function poseOrbita() {
    const o = orbita;
    const pos = new THREE.Vector3(
      o.objetivo.x + o.dist * Math.cos(o.pitch) * Math.sin(o.yaw),
      o.objetivo.y + o.dist * Math.sin(o.pitch),
      o.objetivo.z + o.dist * Math.cos(o.pitch) * Math.cos(o.yaw),
    );
    // Matrix4.lookAt(ojo, objetivo) deja el −z mirando al objetivo, como una cámara (un Object3D cualquiera mira con +z).
    const m4 = new THREE.Matrix4().lookAt(pos, o.objetivo, camara.up);
    return { pos, quat: new THREE.Quaternion().setFromRotationMatrix(m4), fov: 42 };
  }

  function posePrimera() {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(estado.pitch, estado.yaw, 0, 'YXZ'));
    return { pos: new THREE.Vector3(estado.x, ALTURA_OJOS, estado.y), quat: q, fov: fovVertical(camara.aspect) };
  }

  function aplicarPose(p) {
    camara.position.copy(p.pos);
    camara.quaternion.copy(p.quat);
    if (Math.abs(camara.fov - p.fov) > 1e-3) {
      camara.fov = p.fov;
      camara.updateProjectionMatrix();
    }
  }

  function fondo() {
    if (vista === 'primera' && !animacion) escena.background = new THREE.Color(C.cielo);
    else {
      try { escena.background = new THREE.Color(colorFondo?.() || '#e9ebe6'); }
      catch { escena.background = new THREE.Color('#e9ebe6'); }
    }
  }

  function ponerVista(nueva, { animar = true, duracion = DUR_CAMBIO } = {}) {
    const anterior = vista;
    vista = nueva;
    const destino = nueva === 'primera' ? posePrimera() : poseOrbita();
    if (techos) techos.visible = false;
    if (marcador) marcador.visible = nueva === 'arriba';
    opacidadEtiquetas(nueva);
    const sinMovimiento = reducirMovimiento?.() || !animar || anterior === nueva && !animar;
    if (sinMovimiento) {
      animacion = null;
      aplicarPose(destino);
      if (techos) techos.visible = nueva === 'primera';
    } else {
      animacion = {
        t0: null,
        dur: duracion,
        desde: { pos: camara.position.clone(), quat: camara.quaternion.clone(), fov: camara.fov },
        hasta: destino,
        alFinal: () => { if (techos) techos.visible = vista === 'primera'; },
      };
    }
    fondo();
    alCambiarVista?.(nueva);
    pedirCuadro();
  }

  function avanzarAnimacion(t) {
    if (!animacion.t0) animacion.t0 = t;
    const u = Math.min(1, (t - animacion.t0) / animacion.dur);
    const e = suavizarMover(u);
    const { desde } = animacion;
    // El destino se recalcula si el jugador se mueve durante la transición.
    const hasta = vista === 'primera' ? posePrimera() : poseOrbita();
    camara.position.lerpVectors(desde.pos, hasta.pos, e);
    camara.quaternion.slerpQuaternions(desde.quat, hasta.quat, e);
    camara.fov = desde.fov + (hasta.fov - desde.fov) * e;
    camara.updateProjectionMatrix();
    if (u >= 1) {
      const fin = animacion.alFinal;
      animacion = null;
      fin?.();
      fondo();
      return false;
    }
    return true;
  }

  // ── bucle: solo cuando algo cambia ──
  function pedirCuadro() {
    if (solicitado || pausado || !modelo) return;
    solicitado = true;
    requestAnimationFrame(cuadro);
  }

  function cuadro(t) {
    solicitado = false;
    if (pausado || !modelo) { ultimoT = null; return; }
    const dt = ultimoT == null ? 1 / 60 : (t - ultimoT) / 1000;
    let sigue = false;
    if (vista === 'primera' && !intencionQuieta(intencion)) {
      const antes = estado;
      estado = paso(estado, intencion, dt, modelo.colision, RADIO_JUGADOR);
      if (estado.x !== antes.x || estado.y !== antes.y || estado.yaw !== antes.yaw) revisarAmbiente();
      alMover?.(estado);
      sigue = true;
    }
    if (animacion) sigue = avanzarAnimacion(t) || sigue;
    else if (vista === 'primera') aplicarPose(posePrimera());
    if (marcador) {
      marcador.position.x = estado.x;
      marcador.position.z = estado.y;
      marcador.rotation.y = estado.yaw;
    }
    renderer.render(escena, camara);
    cuadros += 1;
    actualizarEtiquetasMedidas();
    ultimoT = sigue ? t : null;
    if (sigue) pedirCuadro();
  }

  function revisarAmbiente() {
    const amb = ambienteEn(estado, modelo.ambientes, ambienteActual);
    const id = amb?.id ?? ambienteActual;
    if (id !== ambienteActual) {
      ambienteActual = id;
      alCambiarAmbiente?.(ambienteDe(id));
    }
  }

  // ── tamaño ──
  function redimensionar() {
    const w = Math.max(1, contenedor.clientWidth), h = Math.max(1, contenedor.clientHeight);
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    if (vista === 'primera' && !animacion) camara.fov = fovVertical(camara.aspect);
    camara.updateProjectionMatrix();
    encuadrar();
    if (vista === 'arriba' && !animacion) aplicarPose(poseOrbita());
    pedirCuadro();
  }
  const ro = new ResizeObserver(redimensionar);
  ro.observe(contenedor);

  lienzo.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    pausado = true;
    alError?.('contexto');
  });

  // ── medir ──
  function puntoBajo(ndcX, ndcY) {
    // La matriz de la cámara solo se actualiza al dibujar: sin esto, medir justo después de girar usa la pose vieja.
    camara.updateMatrixWorld();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camara);
    const objetos = [...pisos, ...(paredesMalla ? [paredesMalla] : [])];
    if (techos?.visible) objetos.push(...techos.children);
    const hit = raycaster.intersectObjects(objetos, false)[0];
    return hit ? hit.point.clone() : null;
  }

  function crearMarca(p) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), M.senal);
    s.position.copy(p);
    return s;
  }

  function medirEn(ndcX, ndcY) {
    const p = puntoBajo(ndcX, ndcY);
    if (!p) return { ok: false };
    if (!puntoPendiente) {
      const marca = crearMarca(p);
      grupoModelo.add(marca);
      puntoPendiente = { p, marca };
      pedirCuadro();
      alMedir?.({ fase: 'primero', punto: p });
      return { ok: true, fase: 'primero' };
    }
    const a = puntoPendiente.p, b = p;
    // Un doble clic (o dos Intro sin girar) da el mismo punto: no es una medida de 0.00 m, se espera otro punto.
    if (!medidaValida(a, b)) {
      alMedir?.({ fase: 'mismo-punto' });
      return { ok: false, fase: 'mismo-punto' };
    }
    const grupo = new THREE.Group();
    grupo.add(puntoPendiente.marca);
    grupo.add(crearMarca(b));
    const largo = a.distanceTo(b);
    if (largo > 1e-4) {
      const cil = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, largo, 8), M.senalLinea);
      cil.position.copy(a).add(b).multiplyScalar(0.5);
      cil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      cil.renderOrder = 10;
      grupo.add(cil);
    }
    grupoModelo.add(grupo);
    const d = distancia3(a, b);
    const medida = { a: a.clone(), b: b.clone(), distancia: d, grupo, n: (medidas.at(-1)?.n ?? 0) + 1 };
    medidas.push(medida);
    puntoPendiente = null;
    while (medidas.length > 8) quitarMedida(medidas[0]);
    pedirCuadro();
    alMedir?.({ fase: 'medida', medida, medidas: medidas.slice() });
    return { ok: true, fase: 'medida', distancia: d };
  }

  function quitarMedida(m) {
    grupoModelo?.remove(m.grupo);
    m.grupo.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    medidas.splice(medidas.indexOf(m), 1);
  }

  function borrarMedidas() {
    while (medidas.length) quitarMedida(medidas[0]);
    if (puntoPendiente) {
      grupoModelo?.remove(puntoPendiente.marca);
      puntoPendiente.marca.geometry.dispose();
      puntoPendiente = null;
    }
    alMedir?.({ fase: 'borradas', medidas: [] });
    pedirCuadro();
  }

  // Etiquetas HTML de las medidas, sobre el punto medio de cada una.
  let capaEtiquetas = null;
  function actualizarEtiquetasMedidas() {
    if (!capaEtiquetas) return;
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    for (const m of medidas) {
      const el = capaEtiquetas.querySelector(`[data-medida="${m.n}"]`);
      if (!el) continue;
      const v = m.a.clone().add(m.b).multiplyScalar(0.5).project(camara);
      const visible = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      el.hidden = !visible;
      if (visible) el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -130%)`;
    }
  }

  // ── acciones desde la interfaz ──
  function ndcDe(clientX, clientY) {
    const r = lienzo.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 2 - 1, y: -((clientY - r.top) / r.height) * 2 + 1 };
  }

  /** Toque o clic sin arrastre. centro=true usa la mira (mouse bloqueado). */
  function tocar(clientX, clientY, { centro = false } = {}) {
    if (!modelo) return null;
    const ndc = centro ? { x: 0, y: 0 } : ndcDe(clientX, clientY);
    if (midiendo) return medirEn(ndc.x, ndc.y);
    if (vista === 'arriba') {
      // Tocar el piso desde arriba te lleva a ese punto, caminando.
      camara.updateMatrixWorld();
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camara);
      const hit = raycaster.intersectObjects(pisos, false)[0];
      if (hit) {
        irAPunto(hit.point.x, hit.point.z);
        return { ok: true, fase: 'ir' };
      }
    }
    return null;
  }

  function irAPunto(x, y, { animar = true } = {}) {
    const amb = modelo.ambientes.find((a) => puntoEnPoligono({ x, y }, a.poligono));
    if (!amb) return false;
    const p = resolverColision({ x, y }, modelo.colision, RADIO_JUGADOR + 0.02);
    // Mirar hacia donde miraba la cámara de arriba, para que el cambio se entienda.
    const yaw = vista === 'arriba' ? orbita.yaw : estado.yaw;
    estado = { x: p.x, y: p.y, yaw, pitch: -0.06 };
    ambienteActual = ambienteEn(estado, modelo.ambientes)?.id ?? amb.id;
    alCambiarAmbiente?.(ambienteDe(ambienteActual));
    alMover?.(estado);
    if (vista === 'primera') {
      if (animar && !reducirMovimiento?.()) ponerVista('primera', { animar: true, duracion: DUR_CAMBIO });
      else pedirCuadro();
    } else ponerVista('primera', { animar });
    return true;
  }

  function irAAmbiente(id, opciones) {
    const amb = ambienteDe(id);
    if (!amb) return false;
    return irAPunto(amb.etiqueta.x, amb.etiqueta.y, opciones);
  }

  return {
    lienzo,
    cargarModelo,
    get vista() { return vista; },
    get modelo() { return modelo; },
    get midiendo() { return midiendo; },
    get animando() { return Boolean(animacion); },
    get cuadros() { return cuadros; },
    estado: () => ({ ...estado, ambiente: ambienteActual, vista }),
    medidas: () => medidas.map((m) => ({ n: m.n, distancia: m.distancia })),
    ponerVista,
    /** Entrada al recorrido: de la vista de arriba baja hasta los ojos del visitante. */
    entrar() {
      ponerVista('arriba', { animar: false });
      ponerVista('primera', { animar: true, duracion: DUR_TRANSICION });
    },
    ponerIntencion(i) {
      intencion = i;
      if (!intencionQuieta(i)) pedirCuadro();
    },
    mirar(dx, dy) {
      if (vista !== 'primera') return;
      estado = girarMirada(estado, dx, dy, SENSIBILIDAD);
      alMover?.(estado);
      pedirCuadro();
    },
    orbitar(dx, dy) {
      if (vista !== 'arriba' || animacion) return;
      orbita.yaw -= dx * 0.006;
      orbita.pitch = Math.max(0.35, Math.min(1.45, orbita.pitch + dy * 0.005));
      aplicarPose(poseOrbita());
      pedirCuadro();
    },
    acercar(factor) {
      if (vista !== 'arriba' || animacion || !modelo) return;
      const k = modelo.limites;
      const max = Math.max(k.ancho, k.largo) * 2.6 + 4;
      orbita.dist = Math.max(4, Math.min(max, orbita.dist * factor));
      orbitaTocada = true;
      aplicarPose(poseOrbita());
      pedirCuadro();
    },
    tocar,
    irAAmbiente,
    irAPunto,
    /** Pone al visitante en un punto exacto, mirando a un rumbo (grados; 0 = arriba del plano). */
    colocar({ x, y, rumbo = 0, pitch = 0 }) {
      if (!modelo) return;
      estado = { x, y, yaw: rumboAYaw(rumbo), pitch };
      const amb = ambienteEn(estado, modelo.ambientes, ambienteActual);
      if ((amb?.id ?? null) !== ambienteActual) { ambienteActual = amb?.id ?? null; alCambiarAmbiente?.(amb); }
      alMover?.(estado);
      if (vista !== 'primera') ponerVista('primera', { animar: false });
      else { aplicarPose(posePrimera()); pedirCuadro(); }
    },
    medir(activo) {
      midiendo = Boolean(activo);
      if (!midiendo && puntoPendiente) {
        grupoModelo?.remove(puntoPendiente.marca);
        puntoPendiente.marca.geometry.dispose();
        puntoPendiente = null;
        pedirCuadro();
      }
    },
    medirEnCentro: () => medirEn(0, 0),
    borrarMedidas,
    ponerCapaEtiquetas(el) { capaEtiquetas = el; },
    redimensionar,
    refrescarFondo() { fondo(); pedirCuadro(); },
    pausar(si) {
      const antes = pausado;
      pausado = Boolean(si);
      if (antes && !pausado) { ultimoT = null; pedirCuadro(); }
    },
    pedirCuadro,
    /** Imagen del render (para la vista previa estática de la página). */
    capturar({ ancho, alto, tipo = 'image/webp', calidad = 0.82, vistaCaptura = 'arriba' }) {
      const tam = new THREE.Vector2();
      renderer.getSize(tam);
      const pr = renderer.getPixelRatio();
      const vistaAntes = vista;
      renderer.setPixelRatio(1);
      renderer.setSize(ancho, alto, false);
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();
      vista = vistaCaptura;
      animacion = null;
      if (techos) techos.visible = vistaCaptura === 'primera';
      if (marcador) marcador.visible = false;
      opacidadEtiquetas(vistaCaptura);
      fondo();
      aplicarPose(vistaCaptura === 'primera' ? posePrimera() : poseOrbita());
      renderer.render(escena, camara);
      const url = lienzo.toDataURL(tipo, calidad);
      renderer.setPixelRatio(pr);
      renderer.setSize(tam.x, tam.y, false);
      vista = vistaAntes;
      redimensionar();
      ponerVista(vista, { animar: false });
      return url;
    },
    ajustarOrbita({ yaw, pitch, dist }) {
      if (Number.isFinite(yaw)) orbita.yaw = yaw;
      if (Number.isFinite(pitch)) orbita.pitch = pitch;
      if (Number.isFinite(dist)) { orbita.dist = dist; orbitaTocada = true; }
      if (vista === 'arriba') { aplicarPose(poseOrbita()); pedirCuadro(); }
    },
    destruir() {
      pausado = true;
      ro.disconnect();
      if (grupoModelo) liberar(grupoModelo);
      for (const mat of texturas.values()) { mat.map?.dispose(); mat.dispose(); }
      renderer.dispose();
      lienzo.remove();
    },
  };
}
