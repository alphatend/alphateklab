// Libro de Excel (.xlsx) sin librerías, para bajar los datos de la app. Corre igual en el navegador y en Node.
// Cada hoja: la fila de títulos en negrita, fija y con filtro; números, porcentajes y fechas como valores de verdad
// (se pueden sumar y graficar). Fechas y horas en hora de Panamá (UTC−5, sin horario de verano).
// El ZIP va sin comprimir (método 0): el navegador no tiene cómo desinflar de forma síncrona sin librerías.
//
// tipo de columna: "texto" (si no se dice), "numero" (con `decimales` o sin ellos), "entero", "porcentaje" (de 0 a 1),
// "fecha" ("AAAA-MM-DD") y "fechahora" (instante ISO). Lo que no se puede leer como su tipo va como texto;
// null, undefined y "" quedan vacíos; true y false, «Sí» y «No».

export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const NS = "http://schemas.openxmlformats.org";
const CT = "application/vnd.openxmlformats-officedocument.spreadsheetml";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const PANAMA = -5 * 3600e3;
const EPOCA = Date.UTC(1899, 11, 30); // el día 0 de Excel; por su 29-feb-1900 que no existió, vale desde marzo de 1900
const MAX_TEXTO = 32767; // más largo, Excel dice que el archivo está dañado
const NUMERICOS = new Set(["numero", "entero", "porcentaje"]);
const NUMERO = /^\s*[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i;
const FECHA = /^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d)(?::(\d\d)(?:\.(\d+))?)?)?\s*(Z|[+-]\d\d:?\d\d)?$/i;
const FIJOS = new Map([["General", 0], ["0", 1], ["0.00", 2], ["0%", 9], ["0.00%", 10]]); // los que ya trae Excel
const UTF8 = new TextEncoder();

// quita lo que XML 1.0 no admite: controles, sustitutos sueltos, U+FFFE y U+FFFF
const limpio = (s) => s.replace(/[^\t\n\r\u{20}-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/gu, "");
const xml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Corta a `max` unidades UTF-16 sin partir un emoji. */
function cortar(s, max) {
  if (s.length <= max) return s;
  let r = "";
  for (const c of s) {
    if (r.length + c.length > max) break;
    r += c;
  }
  return r;
}

/** 0 → A, 25 → Z, 26 → AA */
function letras(i) {
  let s = "";
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

/** AAAA-MM-DD[Thh:mm[:ss[.mmm]]][Z|±hh:mm] → número de serie de Excel en hora de Panamá. Sin zona, ya lo es. */
function serial(s, conHora) {
  const m = FECHA.exec(s.trim());
  if (!m) return null;
  const [, a, me, d, h = 0, mi = 0, se = 0, fr = "0", zona] = m;
  let ms = Date.UTC(a, me - 1, d, h, mi, se, fr.slice(0, 3).padEnd(3, "0"));
  const t = new Date(ms);
  if (a < 1900 || t.getUTCMonth() !== me - 1 || t.getUTCDate() !== +d || h > 23 || mi > 59 || se > 59) return null; // 30-feb…
  if (zona) ms += PANAMA - (/z/i.test(zona) ? 0 : (zona[0] === "-" ? -1 : 1) * (zona.slice(1, 3) * 60 + +zona.slice(-2)) * 60e3);
  const n = (ms - EPOCA) / 86400e3;
  return n < 61 ? null : conHora ? n : Math.floor(n);
}

/** El valor según el tipo de la columna: { n } número o { s } texto, con su largo a la vista; null si va vacía. */
function celda(v, { tipo, dec }) {
  if (v == null || v === "" || Number.isNaN(v)) return null;
  if (tipo === "fecha" || tipo === "fechahora") {
    const n = typeof v === "string" ? serial(v, tipo === "fechahora") : null;
    if (n != null) return { n, largo: tipo === "fecha" ? 10 : 16 };
  } else if (NUMERICOS.has(tipo)) {
    const n = typeof v === "number" ? v : typeof v === "string" && NUMERO.test(v) ? Number(v) : NaN;
    if (Number.isFinite(n)) {
      const largo = tipo === "porcentaje" ? (n * 100).toFixed(dec).length + 1 : dec != null ? n.toFixed(dec).length : Math.min(String(n).length, 11);
      return { n, largo };
    }
  }
  const s = cortar(limpio(typeof v === "boolean" ? (v ? "Sí" : "No") : String(v)).replace(/\r\n?/g, "\n"), MAX_TEXTO);
  return s ? { s, largo: s.split("\n").reduce((m, l) => Math.max(m, l.length), 0) } : null;
}

function formato({ tipo, dec }) {
  const d = dec > 0 ? "." + "0".repeat(dec) : "";
  if (tipo === "numero") return dec == null ? "General" : "0" + d;
  if (tipo === "entero") return "0";
  if (tipo === "porcentaje") return "0" + d + "%";
  if (tipo === "fecha") return "dd/mm/yyyy";
  if (tipo === "fechahora") return "dd/mm/yyyy hh:mm";
  return "General";
}

/** Nombres que Excel acepta: sin []:*?/\, sin ' en los bordes, hasta 31, no vacíos, únicos sin importar
 *  mayúsculas y no «History», que está reservado. */
function nombresHojas(hojas) {
  const usados = new Set();
  const bordes = (s) => s.replace(/^[\s']+|[\s']+$/g, "");
  return hojas.map((h, i) => {
    let base = bordes(limpio(String(h?.nombre ?? "")).replace(/[[\]:*?\/\\\s]+/g, " ")) || `Hoja ${i + 1}`;
    if (/^history$/i.test(base)) base += " 1";
    for (let n = 1; ; n++) {
      const suf = n > 1 ? ` (${n})` : "";
      const nombre = bordes(cortar(base, 31 - suf.length)) + suf;
      if (!usados.has(nombre.toLowerCase())) {
        usados.add(nombre.toLowerCase());
        return nombre;
      }
    }
  });
}

function hoja({ columnas = [], filas = [] }, i, cadena, estilo) {
  if (filas.length > 1048575) throw new Error("Una hoja de Excel no pasa de 1 048 576 filas.");
  const cols = columnas.slice(0, 16384).map((c) => {
    const tipo = c.tipo ?? "texto";
    const dec = tipo === "entero" ? 0 : Number.isInteger(c.decimales) ? Math.min(Math.max(c.decimales, 0), 10) : tipo === "porcentaje" ? 0 : null;
    const titulo = celda(c.titulo, {});
    return { ...c, tipo, dec, formato: formato({ tipo, dec }), titulo, largo: (titulo?.largo ?? 0) + 3 }; // + el botón del filtro
  });
  // primero todos los valores, para tener el ancho antes de escribir (el texto más ancho que la columna se ajusta)
  const celdas = filas.map((f) => cols.map((c, j) => celda(f?.[j], c)));
  for (const f of celdas) f.forEach((v, j) => v && (cols[j].largo = Math.max(cols[j].largo, v.largo)));
  for (const c of cols) c.ancho = c.ancho > 0 ? Math.min(+c.ancho, 255) : Math.min(60, Math.max(8, c.largo + 2));
  const L = cols.map((_, j) => letras(j));

  let filasXml = '<row r="1">' + cols.map((c, j) => `<c r="${L[j]}1" s="1"${c.titulo ? ` t="s"><v>${cadena(c.titulo.s)}</v></c>` : "/>"}`).join("") + "</row>";
  celdas.forEach((f, k) => {
    const r = k + 2;
    filasXml += `<row r="${r}">`;
    f.forEach((v, j) => {
      if (!v) return;
      if (v.s != null) filasXml += `<c r="${L[j]}${r}" s="${estilo("General", v.s.includes("\n") || v.largo > cols[j].ancho)}" t="s"><v>${cadena(v.s)}</v></c>`;
      else filasXml += `<c r="${L[j]}${r}" s="${estilo(cols[j].formato, false)}"><v>${v.n}</v></c>`;
    });
    filasXml += "</row>";
  });

  const rango = cols.length ? `A1:${L.at(-1)}${celdas.length + 1}` : null;
  return {
    rango,
    xml:
      XML +
      `<worksheet xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships">` +
      `<dimension ref="${rango ?? "A1"}"/><sheetViews><sheetView workbookViewId="0"${i === 0 ? ' tabSelected="1"' : ""}>` +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
      (cols.length ? `<cols>${cols.map((c, j) => `<col min="${j + 1}" max="${j + 1}" width="${c.ancho}" customWidth="1"/>`).join("")}</cols>` : "") +
      `<sheetData>${filasXml}</sheetData>` +
      (rango ? `<autoFilter ref="${rango}"/>` : "") +
      '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>',
  };
}

/**
 * hojas: [{ nombre, columnas: [{ titulo, ancho?, tipo?, decimales? }], filas: [[valores en el orden de las columnas]] }]
 * Devuelve los bytes del .xlsx: new Blob([bytes], { type: TIPO_XLSX }).
 */
export function libroXlsx(hojas, { autor = "", titulo = "" } = {}) {
  if (!Array.isArray(hojas) || !hojas.length) throw new Error("El libro tiene que tener por lo menos una hoja.");
  const ahora = Date.now();
  const cadenas = new Map(); // texto → su número en sharedStrings
  let usos = 0;
  const cadena = (s) => {
    usos++;
    if (!cadenas.has(s)) cadenas.set(s, cadenas.size);
    return cadenas.get(s);
  };
  // estilos de celda: 0 normal, 1 títulos; los de datos se arman según el formato de número y si ajusta el texto
  const propios = new Map(); // formatos que Excel no trae: código → id (desde 164)
  const xfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>',
  ];
  const indices = new Map();
  const estilo = (codigo, ajusta) => {
    const clave = codigo + (ajusta ? "|ajusta" : "");
    if (!indices.has(clave)) {
      if (!FIJOS.has(codigo) && !propios.has(codigo)) propios.set(codigo, 164 + propios.size);
      indices.set(clave, xfs.length);
      xfs.push(
        `<xf numFmtId="${FIJOS.get(codigo) ?? propios.get(codigo)}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1">` +
          `<alignment vertical="top"${ajusta ? ' wrapText="1"' : ""}/></xf>`,
      );
    }
    return indices.get(clave);
  };

  const nombres = nombresHojas(hojas);
  const hechas = hojas.map((h, i) => hoja(h ?? {}, i, cadena, estilo));
  const k = hechas.length;
  const rel = (id, tipo, destino) => `<Relationship Id="rId${id}" Type="${NS}/${tipo}" Target="${destino}"/>`;
  // el filtro necesita su nombre oculto por hoja, o Excel lo «repara»
  const filtros = hechas
    .map((h, i) => h.rango && `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">` +
      `${xml(`'${nombres[i].replace(/'/g, "''")}'!${h.rango.replace(/([A-Z]+)(\d+)/g, "$$$1$$$2")}`)}</definedName>`)
    .filter(Boolean)
    .join("");
  const fecha = new Date(ahora).toISOString().slice(0, 19) + "Z"; // sin milésimas: Excel no las quiere
  const propiedad = (etiqueta, v) => (v ? `<${etiqueta}>${xml(limpio(String(v)))}</${etiqueta}>` : "");

  const partes = [
    ["[Content_Types].xml", XML + `<Types xmlns="${NS}/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      `<Override PartName="/xl/workbook.xml" ContentType="${CT}.sheet.main+xml"/>` +
      hechas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${CT}.worksheet+xml"/>`).join("") +
      `<Override PartName="/xl/styles.xml" ContentType="${CT}.styles+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="${CT}.sharedStrings+xml"/>` +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
    ["_rels/.rels", XML + `<Relationships xmlns="${NS}/package/2006/relationships">` +
      rel(1, "officeDocument/2006/relationships/officeDocument", "xl/workbook.xml") +
      rel(2, "package/2006/relationships/metadata/core-properties", "docProps/core.xml") + "</Relationships>"],
    ["docProps/core.xml", XML + `<cp:coreProperties xmlns:cp="${NS}/package/2006/metadata/core-properties" ` +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      propiedad("dc:title", titulo) + propiedad("dc:creator", autor) + propiedad("cp:lastModifiedBy", autor) +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${fecha}</dcterms:created>` +
      `<dcterms:modified xsi:type="dcterms:W3CDTF">${fecha}</dcterms:modified></cp:coreProperties>`],
    ["xl/workbook.xml", XML + `<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships">` +
      '<bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
      nombres.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + "</sheets>" +
      (filtros ? `<definedNames>${filtros}</definedNames>` : "") + "</workbook>"],
    ["xl/_rels/workbook.xml.rels", XML + `<Relationships xmlns="${NS}/package/2006/relationships">` +
      hechas.map((_, i) => rel(i + 1, "officeDocument/2006/relationships/worksheet", `worksheets/sheet${i + 1}.xml`)).join("") +
      rel(k + 1, "officeDocument/2006/relationships/styles", "styles.xml") +
      rel(k + 2, "officeDocument/2006/relationships/sharedStrings", "sharedStrings.xml") + "</Relationships>"],
    // los rellenos 0 y 1 tienen que ser none y gray125, aunque no se usen
    ["xl/styles.xml", XML + `<styleSheet xmlns="${NS}/spreadsheetml/2006/main">` +
      (propios.size ? `<numFmts count="${propios.size}">${[...propios].map(([c, id]) => `<numFmt numFmtId="${id}" formatCode="${xml(c)}"/>`).join("")}</numFmts>` : "") +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE7E7E7"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="thin"><color rgb="FF8C8C8C"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '<dxfs count="0"/><tableStyles count="0"/></styleSheet>'],
    // _xHHHH_ es un escape de OOXML: el «_» de un texto que lo traiga tal cual se escribe _x005F_
    ["xl/sharedStrings.xml", XML + `<sst xmlns="${NS}/spreadsheetml/2006/main" count="${usos}" uniqueCount="${cadenas.size}">` +
      [...cadenas.keys()].map((s) => `<si><t xml:space="preserve">${xml(s).replace(/_(x[0-9a-f]{4}_)/gi, "_x005F_$1")}</t></si>`).join("") + "</sst>"],
    ...hechas.map((h, i) => [`xl/worksheets/sheet${i + 1}.xml`, h.xml]),
  ];
  return zip(partes.map(([nombre, texto]) => [nombre, UTF8.encode(texto)]), ahora);
}

const TABLA_CRC = new Uint32Array(256).map((_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n;
});
function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

/** ZIP sin comprimir: [[nombre, bytes]] → Uint8Array. Nombres en UTF-8 (bit 11) y la hora DOS de Panamá. */
function zip(archivos, ahora) {
  const d = new Date(ahora + PANAMA);
  const hora = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1);
  const dia = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  const ent = archivos.map(([nombre, datos]) => ({ nombre: UTF8.encode(nombre), datos, crc: crc32(datos), desde: 0 }));
  const tamLocal = ent.reduce((s, e) => s + 30 + e.nombre.length + e.datos.length, 0);
  const tamCentral = ent.reduce((s, e) => s + 46 + e.nombre.length, 0);
  const out = new Uint8Array(tamLocal + tamCentral + 22), v = new DataView(out.buffer);
  let p = 0;
  const u16 = (x) => { v.setUint16(p, x, true); p += 2; };
  const u32 = (x) => { v.setUint32(p, x, true); p += 4; };
  const bytes = (b) => { out.set(b, p); p += b.length; };
  // común a la cabecera local y a la del directorio: versión 2.0, UTF-8, sin comprimir, hora, CRC, tamaños, nombre
  const cabecera = (e) => { u16(20); u16(0x0800); u16(0); u16(hora); u16(dia); u32(e.crc); u32(e.datos.length); u32(e.datos.length); u16(e.nombre.length); u16(0); };
  for (const e of ent) {
    e.desde = p;
    u32(0x04034b50); cabecera(e); bytes(e.nombre); bytes(e.datos);
  }
  for (const e of ent) {
    u32(0x02014b50); u16(20); cabecera(e);
    u16(0); u16(0); u16(0); u32(0); u32(e.desde); // comentario, disco, atributos internos y externos, dónde empieza
    bytes(e.nombre);
  }
  u32(0x06054b50); u16(0); u16(0); u16(ent.length); u16(ent.length); u32(tamCentral); u32(tamLocal); u16(0);
  return out;
}
