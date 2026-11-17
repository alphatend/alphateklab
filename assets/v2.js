// alphateklab, propuesta v2 (local)
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══ 2. la calle: cada local se dibuja con sus datos (borrador de las fachadas) ═══ */
  const tono = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + ((f < 0 ? 0 : 255) - v) * Math.abs(f)));
    return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };
  const VIDRIO = '#9cc7cf';
  const NOCHE_VENTANA = '#2b2f35';
  const rotulo = (txt, x, y, w, color) => {
    const t = Math.min(30, w / (txt.length * 0.62));
    return `<text x="${x}" y="${y}" text-anchor="middle" class="local__rotulo" font-size="${t.toFixed(1)}" fill="${color}">${txt}</text>`;
  };
  const toldo = (y, alto, color) => {
    let s = '';
    for (let i = 0; i < 16; i++) s += `<rect x="${i * 17}" y="${y}" width="17" height="${alto}" fill="${i % 2 ? '#ffffff' : color}"/>`;
    let ondas = `M0 ${y + alto}`;
    for (let i = 0; i < 8; i++) ondas += ` a17 9 0 0 0 34 0`;
    return `${s}<path d="${ondas}" fill="${color}"/><rect x="0" y="${y - 4}" width="272" height="5" fill="${tono(color, -0.3)}"/>`;
  };
  const FACHADAS = {
    colonial: (p, l, c, txt) => {
      let s = `<rect width="272" height="380" fill="${p}"/><rect width="272" height="26" fill="${tono(p, -0.2)}"/><rect y="26" width="272" height="6" fill="${tono(p, 0.3)}"/>`;
      for (const x of [44, 156]) {
        s += `<rect x="${x - 16}" y="58" width="16" height="104" fill="#2e3a46"/><rect x="${x + 72}" y="58" width="16" height="104" fill="#2e3a46"/>`;
        s += `<rect x="${x}" y="56" width="72" height="108" fill="#f4f1e8"/><rect class="vidrio" x="${x + 6}" y="62" width="60" height="96" fill="${NOCHE_VENTANA}"/><path d="M${x + 36} 62v96M${x + 6} 108h60" stroke="#f4f1e8" stroke-width="4"/>`;
        s += `<rect x="${x - 20}" y="164" width="112" height="6" fill="#1b2224"/><rect x="${x - 20}" y="192" width="112" height="5" fill="#1b2224"/>`;
        for (let i = 0; i <= 14; i++) s += `<rect x="${x - 18 + i * 7.6}" y="170" width="2" height="22" fill="#1b2224"/>`;
      }
      s += `<rect x="18" y="212" width="236" height="50" rx="4" fill="${l}"/>${rotulo(txt, 136, 246, 210, c)}`;
      s += toldo(270, 20, l === '#ffffff' ? c : l);
      s += `<rect x="16" y="304" width="74" height="62" fill="#f4f1e8"/><rect class="vidrio" x="22" y="310" width="62" height="50" fill="${VIDRIO}"/>`;
      s += `<rect x="182" y="304" width="74" height="62" fill="#f4f1e8"/><rect class="vidrio" x="188" y="310" width="62" height="50" fill="${VIDRIO}"/>`;
      s += `<rect x="100" y="300" width="72" height="80" fill="#3b2a20"/><rect class="vidrio" x="108" y="308" width="56" height="38" fill="${VIDRIO}"/>`;
      return { alto: 380, s };
    },
    vitrina: (p, l, c, txt) => {
      let s = `<rect width="272" height="300" fill="${p}"/><rect width="272" height="30" fill="${tono(p, -0.18)}"/>`;
      s += `<rect x="18" y="44" width="236" height="54" rx="4" fill="${l}"/>${rotulo(txt, 136, 81, 210, c)}`;
      s += toldo(108, 20, l === '#ffffff' || l === '#f0cf5a' ? tono(p, -0.25) : l);
      s += `<rect x="14" y="144" width="244" height="156" fill="#e9ecea"/>`;
      s += `<rect class="vidrio" x="22" y="152" width="78" height="142" fill="${VIDRIO}"/><rect class="vidrio" x="172" y="152" width="78" height="142" fill="${VIDRIO}"/>`;
      s += `<rect x="106" y="160" width="60" height="140" fill="#3b2a20"/><rect class="vidrio" x="114" y="168" width="44" height="74" fill="${VIDRIO}"/>`;
      s += `<path d="M30 180l30-24M30 214l52-44M188 186l40-32" stroke="#ffffff" stroke-opacity=".55" stroke-width="5"/>`;
      return { alto: 300, s };
    },
    galera: (p, l, c, txt) => {
      let s = `<path d="M0 30L136 4L272 30Z" fill="${tono(p, -0.28)}"/><rect y="28" width="272" height="302" fill="${p}"/>`;
      s += `<rect x="26" y="46" width="220" height="48" rx="3" fill="${l}"/>${rotulo(txt, 136, 80, 196, c)}`;
      s += `<rect x="26" y="114" width="172" height="216" fill="${tono(p, -0.3)}"/>`;
      for (let y = 124; y < 330; y += 12) s += `<rect x="26" y="${y}" width="172" height="2" fill="${tono(p, -0.5)}"/>`;
      s += `<rect class="vidrio" x="210" y="118" width="40" height="40" fill="${VIDRIO}"/>`;
      s += `<rect x="210" y="208" width="42" height="122" fill="#3b2a20"/><rect class="vidrio" x="217" y="218" width="28" height="30" fill="${VIDRIO}"/>`;
      return { alto: 330, s };
    },
  };
  document.querySelectorAll('.local').forEach((li) => {
    const { tipo, pared, letrero, letra, rotulo: txt } = li.dataset;
    const f = FACHADAS[tipo](pared, letrero, letra, txt);
    li.querySelector('.local__fachada').innerHTML = `<svg viewBox="0 0 272 ${f.alto}" aria-hidden="true" focusable="false">${f.s}</svg>`;
  });
  const cuadra = document.querySelector('[data-calle]');
  document.querySelectorAll('[data-calle-mover]').forEach((b) =>
    b.addEventListener('click', () => {
      cuadra.scrollBy({ left: Number(b.dataset.calleMover) * cuadra.clientWidth * 0.75, behavior: quieto ? 'auto' : 'smooth' });
    }),
  );

  /* ═══ 3. las demos: eliges en la lista, se ve en la pantalla y se enciende en grande ═══ */
  const sala = document.querySelector('[data-sala]');
  if (sala) {
    const encender = sala.querySelector('[data-sala-encender]');
    const opciones = [...sala.querySelectorAll('.sala__opcion')];
    const img = sala.querySelector('[data-sala-img]');
    const nombre = sala.querySelector('[data-sala-nombre]');
    const qr = sala.querySelector('[data-sala-qr]');
    const elegir = (b) => {
      opciones.forEach((o) => o.setAttribute('aria-selected', String(o === b)));
      img.src = b.dataset.img;
      nombre.textContent = b.dataset.nombre;
      qr.hidden = !b.dataset.qr;
      encender.href = b.dataset.demo;
    };
    opciones.forEach((b, i) => {
      b.addEventListener('click', () => elegir(b));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const o = opciones[(i + (e.key === 'ArrowDown' ? 1 : opciones.length - 1)) % opciones.length];
        o.focus();
        elegir(o);
      });
    });
  }

  /* ═══ 4. servicios: la descripción del tipo que se señala ═══ */
  const desc = document.querySelector('[data-serv-desc]');
  document.querySelectorAll('.servicios__nube a').forEach((a) => {
    const mostrar = () => {
      desc.textContent = a.dataset.desc;
    };
    a.addEventListener('pointerenter', mostrar);
    a.addEventListener('focus', mostrar);
  });

  /* ═══ un solo botón, «Quiero mi propuesta»: baja al formulario con el mensaje ya escrito ═══ */
  const form = document.querySelector('[data-pregunta]');
  const texto = form?.querySelector('textarea');
  const nota = form?.querySelector('[data-pregunta-nota]');
  document.querySelectorAll('[data-mensaje]').forEach((a) =>
    a.addEventListener('click', () => {
      if (texto && !texto.value.trim()) texto.value = `${a.dataset.mensaje} `;
      cerrarMovil();
    }),
  );
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    nota.textContent = 'En el sitio, tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
  });
  document.querySelector('[data-buscar]')?.addEventListener('submit', (e) => e.preventDefault());
  // copiar el correo de contacto (dentro del Artifact, un enlace mailto: no siempre abre el correo)
  document.querySelectorAll('[data-copiar]').forEach((b) =>
    b.addEventListener('click', () => {
      const correo = b.parentElement.querySelector('[data-correo]');
      const listo = () => {
        b.textContent = 'Copiado';
        setTimeout(() => (b.textContent = 'Copiar'), 1800);
      };
      navigator.clipboard?.writeText(correo.textContent.trim()).then(listo, () => {
        const r = document.createRange();
        r.selectNodeContents(correo);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      });
    }),
  );

  /* ═══ la cabecera: menús desplegables en la computadora y menú completo en el celular ═══ */
  const botonesMenu = [...document.querySelectorAll('.menu__boton')];
  function cerrarMenus(excepto) {
    botonesMenu.forEach((b) => {
      if (b === excepto) return;
      b.setAttribute('aria-expanded', 'false');
      document.getElementById(b.getAttribute('aria-controls')).hidden = true;
    });
  }
  botonesMenu.forEach((b) =>
    b.addEventListener('click', () => {
      const abrir = b.getAttribute('aria-expanded') !== 'true';
      cerrarMenus(b);
      b.setAttribute('aria-expanded', String(abrir));
      document.getElementById(b.getAttribute('aria-controls')).hidden = !abrir;
    }),
  );
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu')) cerrarMenus();
  });
  const hamburguesa = document.querySelector('[data-hamburguesa]');
  const menuMovil = document.getElementById('menu-movil');
  function cerrarMovil() {
    if (!hamburguesa || menuMovil.hidden) return;
    menuMovil.hidden = true;
    hamburguesa.setAttribute('aria-expanded', 'false');
    hamburguesa.setAttribute('aria-label', 'Abrir el menú');
    document.body.classList.remove('con-menu');
  }
  hamburguesa?.addEventListener('click', () => {
    if (!menuMovil.hidden) return cerrarMovil();
    menuMovil.hidden = false;
    hamburguesa.setAttribute('aria-expanded', 'true');
    hamburguesa.setAttribute('aria-label', 'Cerrar el menú');
    document.body.classList.add('con-menu');
  });
  menuMovil?.querySelectorAll('a').forEach((a) => a.addEventListener('click', cerrarMovil));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    cerrarMenus();
    cerrarMovil();
  });

  /* ═══ servicios: los recuadros de arriba abren su desplegable ═══ */
  const abrirAcordeon = (id) => {
    const d = id && document.getElementById(id);
    if (d && d.tagName === 'DETAILS') d.open = true;
  };
  document.querySelectorAll('[data-abrir]').forEach((a) => a.addEventListener('click', () => abrirAcordeon(a.dataset.abrir)));
  abrirAcordeon(location.hash.slice(1));

  /* el botón flotante aparece cuando ya pasaste el héroe y se esconde en la sección de preguntar */
  const flotante = document.querySelector('[data-flotante]');
  const heroe = document.querySelector('.heroe');
  const banda = document.querySelector('#pregunta');
  if (flotante && heroe && 'IntersectionObserver' in window) {
    const vista = { heroe: true, banda: false };
    const pintar = () => flotante.classList.toggle('flotante--visible', !vista.heroe && !vista.banda);
    new IntersectionObserver(([e]) => { vista.heroe = e.isIntersecting; pintar(); }).observe(heroe);
    new IntersectionObserver(([e]) => { vista.banda = e.isIntersecting; pintar(); }).observe(banda);
  }

})();
