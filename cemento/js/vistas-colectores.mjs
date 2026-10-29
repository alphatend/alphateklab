// Colectores de polvo: su sección propia, por tag (lo pidió Eduardo el 29-oct-2026). Por área, con el último ΔP de
// cada uno y cómo viene, lo que tiene abierto y cuándo se revisó. Se agregan de uno en uno o pegando una lista (una
// línea por colector, copiada de Excel o escrita: tag, nombre, área, a qué sirve).
import { esc, icono, plural, numero, normal, haceCuanto, diasEntre, diaDe } from "./util.mjs";
import * as api from "./api.mjs";
import { aviso, dialogo, vacio, esAdmin, chispa, equiposDe } from "./ui.mjs";
import { series, editarEquipo, areasDe } from "./vistas-equipos.mjs";
import { fueraDeRango } from "./vistas-inspecciones.mjs";

/** La medida que mejor dice cómo está un colector: el ΔP (si la plantilla lo tiene), si no la primera medida. */
function medidaClave(ss) {
  return ss.find((s) => s.it.id === "dp" || /diferencial|Δ ?p/i.test(s.it.texto)) ?? ss[0] ?? null;
}

/** Una línea por colector: separada por tabuladores (de Excel), punto y coma o comas. */
export function leerLista(texto) {
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const sep = l.includes("\t") ? "\t" : l.includes(";") ? ";" : ",";
    const [tag = "", nombre = "", area = "", sirve_a = ""] = l.split(sep).map((x) => x.trim());
    return { tag, nombre, area, sirve_a };
  }).filter((x) => x.tag || x.nombre)
    // la primera línea de una tabla de Excel suele ser el título de las columnas
    .filter((x, k) => !(k === 0 && /^tag$/i.test(x.tag)));
}

export function vistaColectores({ d, yo, hoy, query }) {
  const admin = esAdmin(yo);
  const buscar = query.get("b") ?? "";
  const f = query.get("f") ?? "todos";
  const todos = d.equipos.filter((e) => e.tipo === "colector" && e.activo);
  const datos = new Map(todos.map((e) => {
    const clave = medidaClave(series(d, e.id));
    const ult = clave?.puntos.at(-1);
    const hechas = d.inspecciones.filter((i) => i.estado === "hecha" && equiposDe(i).includes(e.id)).sort((a, b) => (b.hecha_en ?? "").localeCompare(a.hecha_en ?? ""));
    const abiertos = d.hallazgos.filter((h) => h.equipo_id === e.id && h.estado !== "cerrado");
    return [e.id, {
      clave, ult, abiertos, ultima: hechas[0]?.hecha_en ?? null,
      fuera: ult ? fueraDeRango(clave.it, ult.valor) : false,
      viejo: !hechas[0] || diasEntre(diaDe(hechas[0].hecha_en), hoy) > 30,
    }];
  }));
  const problema = (e) => datos.get(e.id).fuera || datos.get(e.id).abiertos.length;
  let xs = todos;
  if (f === "problema") xs = xs.filter(problema);
  if (f === "viejos") xs = xs.filter((e) => datos.get(e.id).viejo);
  if (buscar) xs = xs.filter((e) => normal(`${e.tag} ${e.nombre} ${e.area} ${e.sirve_a}`).includes(normal(buscar)));
  const porArea = {};
  for (const e of xs) (porArea[e.area || "Sin área"] ??= []).push(e);
  const plRonda = d.plantillas.find((p) => p.tipo_equipo === "colector");
  const fila = (e) => {
    const x = datos.get(e.id);
    return `<li><a class="col-fila" href="#/equipo/${encodeURIComponent(e.id)}">
      <span class="tag-grande">${esc(e.tag || "—")}</span>
      <span class="nombre">${esc(e.nombre)}</span>
      <span class="sub">${[e.sirve_a, x.ultima ? `revisado ${haceCuanto(x.ultima, hoy)}` : "sin revisar todavía", x.abiertos.length ? `${plural(x.abiertos.length, "hallazgo abierto", "hallazgos abiertos")}` : ""].filter(Boolean).map(esc).join(" · ")}</span>
      <span class="dato">${x.clave && x.clave.puntos.length > 1 ? chispa(x.clave.puntos.slice(-12).map((p) => p.valor), { min: x.clave.it.min, max: x.clave.it.max, ancho: 72, alto: 28 }) : ""}
        ${x.ult ? `<span class="dp${x.fuera ? " fuera" : ""}">${numero(x.ult.valor, 1)}<small>${esc(x.clave.it.unidad ?? "")}</small></span>` : `<span class="dp" style="color:var(--tinta-4)">—</span>`}</span>
    </a></li>`;
  };
  const cuenta = { problema: todos.filter(problema).length, viejos: todos.filter((e) => datos.get(e.id).viejo).length };
  const enlace = (id) => `#/colectores?${new URLSearchParams({ f: id, ...(buscar ? { b: buscar } : {}) })}`;
  return {
    titulo: "Colectores",
    html: `<div class="cabeza"><div><h1>Colectores de polvo</h1>
        <p class="bajada">${todos.length ? `${plural(todos.length, "colector", "colectores")}, por área. A la derecha, el último valor de «${esc(medidaClave([...datos.values()].map((x) => x.clave).filter(Boolean))?.it.texto ?? "la medida principal")}».` : "Todavía no hay colectores."}
          ${d.equipos.some((e) => e.tipo === "colector" && String(e.id).startsWith("demo-")) ? " Los de ejemplo (COL-0…) se quitan en Ajustes." : ""}</p></div>
        ${admin ? `<div class="acciones">
          <button type="button" class="boton" data-accion="agregar">${icono("mas1")}Agregar colectores</button>
          ${todos.length && plRonda ? `<a class="boton primario" href="#/asignar?equipo=colectores&plantilla=${encodeURIComponent(plRonda.id)}">${icono("inspecciones")}Asignar ronda</a>` : ""}</div>` : ""}</div>
      <dl class="ficha-cifras" style="margin-bottom:18px">
        <div><dt>Colectores</dt><dd>${todos.length}</dd></div>
        <div><dt>Con algo fuera</dt><dd style="${cuenta.problema ? "color:var(--rojo)" : ""}">${cuenta.problema}</dd></div>
        <div><dt>Sin revisar en 30 días</dt><dd>${cuenta.viejos}</dd></div>
        <div><dt>Qué se revisa</dt><dd style="font-size:16px;font-weight:600">${plRonda ? `<a href="#/plantilla/${encodeURIComponent(plRonda.id)}">${esc(plRonda.nombre)}</a> <small>${plural(plRonda.items.length, "revisión", "revisiones")}</small>` : admin ? `<a href="#/plantilla/nueva?tipo=colector">Crear la plantilla</a>` : "—"}</dd></div>
      </dl>
      <div class="tablero-barra">
        <div class="buscador" style="flex:1 1 260px;max-width:420px">${icono("buscar")}<input type="search" placeholder="Buscar por tag, nombre o área" value="${esc(buscar)}" data-buscar aria-label="Buscar colector" autocapitalize="characters"></div>
        <nav class="filtros" style="margin:0" aria-label="Filtrar">
          <a href="${enlace("todos")}" ${f === "todos" ? 'aria-current="true"' : ""}>Todos</a>
          <a href="${enlace("problema")}" ${f === "problema" ? 'aria-current="true"' : ""}>Con algo fuera${cuenta.problema ? ` <b>${cuenta.problema}</b>` : ""}</a>
          <a href="${enlace("viejos")}" ${f === "viejos" ? 'aria-current="true"' : ""}>Sin revisar${cuenta.viejos ? ` <b>${cuenta.viejos}</b>` : ""}</a></nav>
      </div>
      <div data-resultados>${Object.keys(porArea).length ? `<div class="areas">${Object.entries(porArea).sort(([a], [b]) => a.localeCompare(b)).map(([area, es]) => `<section>
          <div class="area-titulo"><h2>${esc(area)}</h2><small>${plural(es.length, "colector", "colectores")}</small></div>
          <ul class="lista">${es.sort((a, b) => (a.tag || a.nombre).localeCompare(b.tag || b.nombre, "es", { numeric: true })).map(fila).join("")}</ul></section>`).join("")}</div>`
        : vacio(buscar || f !== "todos" ? "Ningún colector con eso." : "Agrega los colectores de la planta por su tag.", admin && !buscar ? `<button type="button" class="boton chico" data-accion="agregar">${icono("mas1")}Agregar colectores</button>` : "")}</div>`,
    montar(m) {
      m.addEventListener("click", (e) => { if (e.target.closest('[data-accion="agregar"]')) agregar(d); });
      const campo = m.querySelector("[data-buscar]");
      let reloj = null;
      campo.addEventListener("input", () => {
        clearTimeout(reloj);
        reloj = setTimeout(() => {
          const q = new URLSearchParams({ f, ...(campo.value ? { b: campo.value } : {}) });
          history.replaceState(null, "", `#/colectores?${q}`);
          const v = vistaColectores({ d: api.obtener(), yo, hoy, query: q });
          const tmp = document.createElement("div");
          tmp.innerHTML = v.html;
          m.querySelector("[data-resultados]").replaceWith(tmp.querySelector("[data-resultados]"));
        }, 160);
      });
    },
  };
}

async function agregar(d) {
  const r = await dialogo({
    titulo: "Agregar colectores",
    ancho: true,
    html: `<div class="segmento" role="group" aria-label="Cómo"><button type="button" data-modo="uno">Uno</button><button type="button" data-modo="lista" aria-pressed="true">Pegar una lista</button></div>
      <div data-zona-lista class="rejilla-campos">
        <div class="campo"><label for="c-lista">Un colector por línea: <b>tag</b>, nombre, área, a qué sirve</label>
          <textarea id="c-lista" style="min-height:160px;font-family:var(--mono);font-size:15px" spellcheck="false" placeholder="431-FM-01; Filtro del separador; Molienda de cemento; Horomill&#10;431-FM-02; Colector de la banda 3&#10;541-FM-01"></textarea>
          <span class="ayuda">Se puede copiar de Excel (columnas en ese orden). Solo el tag es obligatorio. Si el tag ya existe, se actualiza.</span></div>
        <div class="campo"><label for="c-area">Área para los que no dicen <small>(opcional)</small></label>
          <input id="c-area" type="text" list="areas-col">
          <datalist id="areas-col">${areasDe(d).map((a) => `<option value="${esc(a)}">`).join("")}</datalist></div>
        <p class="ayuda" data-vista-previa></p>
      </div>
      <p class="error-form" role="alert" hidden style="color:var(--rojo);font-weight:600"></p>`,
    botones: [{ texto: "Cancelar", valor: null }, { texto: "Agregar", valor: "lista", clase: "primario", alElegir: async (velo) => {
      const xs = leerLista(velo.querySelector("#c-lista").value);
      const err = velo.querySelector(".error-form");
      if (!xs.length) { err.hidden = false; err.textContent = "Pega o escribe por lo menos un tag."; return false; }
      try {
        const x = await api.escribir("equipos/varios", { tipo: "colector", area: velo.querySelector("#c-area").value, equipos: xs });
        aviso(`${x.creados ? plural(x.creados, "colector agregado", "colectores agregados") : ""}${x.creados && x.actualizados ? " y " : ""}${x.actualizados ? plural(x.actualizados, "actualizado", "actualizados") : ""}.`);
      } catch (e) {
        err.hidden = false;
        err.textContent = e.sinRed ? "Para agregar hace falta señal." : e.message;
        return false;
      }
    } }],
    alMontar(velo, cerrar) {
      const ta = velo.querySelector("#c-lista");
      const previa = velo.querySelector("[data-vista-previa]");
      ta.addEventListener("input", () => {
        const xs = leerLista(ta.value);
        previa.textContent = xs.length ? `${plural(xs.length, "colector", "colectores")}: ${xs.slice(0, 6).map((x) => x.tag || x.nombre).join(", ")}${xs.length > 6 ? "…" : ""}` : "";
      });
      velo.querySelector('[data-modo="uno"]').addEventListener("click", () => {
        cerrar(null);
        setTimeout(() => editarEquipo(d, { tipo: "colector" }), 220);
      });
    },
  });
  return r;
}
