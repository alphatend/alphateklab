// Acceso a las demos privadas de alphateklab (alphalogistics, alphadata, alphalex), 19-oct-2026.
//
// GitHub Pages no pide contraseña: es un sitio estático. Por eso los datos de cada demo están COMPRIMIDOS Y CIFRADOS
// (gzip + AES-256-GCM, un IV por archivo) y lo que se publica no se puede leer sin la contraseña. La llave sale de la
// contraseña con PBKDF2-SHA256 (600.000 vueltas, sal pública en acceso.json); la contraseña no está en el código ni en
// el repositorio. Los cifra ~/proyectos/cuire/demos/cifrar.mjs. Una vez abierta, la llave queda en este navegador
// (localStorage) y vale para las tres demos, que comparten sal y contraseña.

const LLAVE = 'atk-demo-llave';
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const dir = new URL('.', import.meta.url);

let acceso = null;
const leerAcceso = async () => (acceso ||= await (await fetch(new URL('acceso.json', dir))).json());

async function abrirConLlave(bruta) {
  return crypto.subtle.importKey('raw', bruta, 'AES-GCM', false, ['decrypt']);
}
async function descifrar(llave, datos) {
  const u8 = new Uint8Array(datos);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(0, 12) }, llave, u8.slice(12));
}
async function probar(llave) {
  const a = await leerAcceso();
  try {
    const t = new TextDecoder().decode(await descifrar(llave, deB64(a.prueba)));
    return t === 'alphateklab';
  } catch { return false; }
}
async function derivar(clave) {
  const a = await leerAcceso();
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deB64(a.sal), iterations: a.vueltas }, base, 256);
  return new Uint8Array(bits);
}
const guardar = (bruta) => { try { localStorage.setItem(LLAVE, b64(bruta)); } catch { /* sin almacenamiento: se pedirá otra vez */ } };
const guardada = () => { try { const s = localStorage.getItem(LLAVE); return s ? deB64(s) : null; } catch { return null; } };
export function salir() { try { localStorage.removeItem(LLAVE); } catch { /* nada */ } location.reload(); }

/** Muestra el formulario en `donde` hasta que la contraseña abra los datos. */
function pedir(donde, nombre) {
  return new Promise((resolver) => {
    donde.innerHTML = `
      <section class="acceso" aria-labelledby="acceso-t">
        <h1 id="acceso-t" class="acceso__t">${nombre}</h1>
        <p class="acceso__p">Es una demo privada, en desarrollo. Escribe la contraseña que te pasaron.</p>
        <form class="acceso__f" autocomplete="off">
          <label for="acceso-c">Contraseña</label>
          <input id="acceso-c" type="password" autocomplete="current-password" required />
          <button type="submit">Entrar</button>
          <p class="acceso__e" role="alert" hidden></p>
        </form>
      </section>`;
    const f = donde.querySelector('form'), c = donde.querySelector('input'), e = donde.querySelector('.acceso__e'), b = donde.querySelector('button');
    c.focus();
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      b.disabled = true; b.textContent = 'Abriendo…'; e.hidden = true;
      try {
        const bruta = await derivar(c.value);
        const llave = await abrirConLlave(bruta);
        if (await probar(llave)) { guardar(bruta); resolver(llave); return; }
        e.textContent = 'Esa no es la contraseña.';
      } catch {
        e.textContent = 'No se pudo comprobar. Revisa la conexión y vuelve a intentarlo.';
      }
      e.hidden = false; b.disabled = false; b.textContent = 'Entrar'; c.select();
    });
  });
}

/**
 * Abre los datos de una demo. Devuelve `leer(ruta)`, que baja `datos/<ruta>.dat`, lo descifra, lo descomprime y
 * devuelve el JSON. Si este navegador no tiene la llave, primero pide la contraseña dentro de `donde`.
 */
export async function abrirDatos({ donde, nombre, base = 'datos/' }) {
  let llave = null;
  const g = guardada();
  if (g) { const k = await abrirConLlave(g); if (await probar(k)) llave = k; }
  if (!llave) llave = await pedir(donde, nombre);
  return async function leer(ruta) {
    const r = await fetch(`${base}${ruta}.dat`);
    if (!r.ok) throw new Error(`no se pudo leer ${ruta} (${r.status})`);
    const plano = await descifrar(llave, await r.arrayBuffer());
    const texto = await new Response(new Blob([plano]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return JSON.parse(texto);
  };
}
