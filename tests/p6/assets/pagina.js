/*
  alphateklab, propuesta 6: the form's note and the email's copy button (the brief's behaviour,
  taken from assets/v2.js of the current site). system.js checks the field first; once it passes,
  the submit stays on the page and the note says where the message goes.
*/
document.querySelectorAll('form[data-propuesta]').forEach((form) => {
  const nota = form.querySelector('[data-nota]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return; // system.js already marked the field and moved the focus
    nota.textContent = 'Tu mensaje nos llega a info@alphateklab.com y te respondemos por escrito.';
  });
});

// copiar el correo de contacto (dentro de un Artifact, un enlace mailto: no siempre abre el correo)
document.querySelectorAll('[data-copiar]').forEach((b) =>
  b.addEventListener('click', () => {
    const correo = b.parentElement.querySelector('[data-correo]');
    const listo = () => {
      b.textContent = 'Copiado';
      setTimeout(() => (b.textContent = 'Copiar'), 1800);
    };
    // sin portapapeles (un navegador viejo o una página sin permiso): queda seleccionado para copiarlo a mano
    const seleccionar = () => {
      const r = document.createRange();
      r.selectNodeContents(correo);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(correo.textContent.trim()).then(listo, seleccionar);
    else seleccionar();
  }),
);
