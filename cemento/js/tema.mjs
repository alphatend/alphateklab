// El tema: automático (sigue al sistema), claro u oscuro, guardado en el aparato. El script del <head> pone
// data-tema en <html> antes de pintar (sin destello); aquí se mantiene al día y se cambia desde Ajustes, con un
// fundido de la transición de vista. Al imprimir, siempre en claro.
const CLAVE = "bp-tema";
const sistema = matchMedia("(prefers-color-scheme: dark)");

export const preferencia = () => {
  try { return localStorage.getItem(CLAVE) || "auto"; } catch { return "auto"; }
};

function aplicar(p = preferencia()) {
  const oscuro = p === "oscuro" || (p === "auto" && sistema.matches);
  document.documentElement.dataset.tema = oscuro ? "oscuro" : "claro";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", oscuro ? "#000000" : "#f2f2f7");
}

export function elegir(p) {
  try { localStorage.setItem(CLAVE, p); } catch { /* sin almacenamiento: dura hasta cerrar */ }
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("cambio-tema");
    const t = document.startViewTransition(() => aplicar(p));
    t.finished.catch(() => {}).finally(() => document.documentElement.classList.remove("cambio-tema"));
  } else aplicar(p);
}

sistema.addEventListener("change", () => aplicar());
addEventListener("beforeprint", () => { document.documentElement.dataset.tema = "claro"; });
addEventListener("afterprint", () => aplicar());
aplicar();
