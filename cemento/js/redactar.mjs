// «Mejorar redacción» (Eduardo, 31-oct-2026: «que lo que tú digas, la IA lo organice y lo redacte mucho mejor»): al lado
// de «Dictar», manda lo escrito al Worker de Cloudflare (api.redactar) y lo cambia por lo que vuelve, con «Deshacer».
// Si mientras tanto alguien siguió escribiendo, no se pisa. Necesita señal.
import { icono, esc } from "./util.mjs";
import { aviso } from "./ui.mjs";
import * as api from "./api.mjs";

/** El botón para un campo (`para`: novedades, pendientes, hallazgo o nota). Vacío si no hay Worker configurado. */
export const botonRedactar = (id, para) => (api.hayRedaccion
  ? `<button type="button" class="boton chico" data-redactar="${esc(id)}" data-para="${esc(para)}">${icono("lapiz")}Mejorar redacción</button>`
  : "");

const avisar = (campo) => campo.dispatchEvent(new Event("input", { bubbles: true }));

document.addEventListener("click", async (e) => {
  const b = e.target.closest?.("[data-redactar]");
  if (!b || b.disabled) return;
  const campo = document.getElementById(b.dataset.redactar);
  if (!campo) return;
  const antes = campo.value;
  if (!antes.trim()) { aviso("Escribe o dicta algo primero."); return; }
  const html = b.innerHTML;
  b.disabled = true;
  b.innerHTML = `${icono("lapiz")}Redactando…`;
  try {
    const nuevo = await api.redactar(antes, b.dataset.para);
    if (campo.value !== antes) { aviso("Seguiste escribiendo: no se cambió."); return; }
    campo.value = nuevo;
    avisar(campo);
    aviso("Redacción mejorada.", { ms: 9000, accion: { texto: "Deshacer", alTocar: () => { campo.value = antes; avisar(campo); } } });
  } catch (x) {
    aviso(x.message, { error: true });
  } finally {
    b.disabled = false;
    b.innerHTML = html;
  }
});
