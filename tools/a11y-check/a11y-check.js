// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const GENERIC_LINKS = [
  'aquí', 'click aquí', 'haz clic aquí', 'pulsa aquí', 'leer más', 'más', 'más info',
  'más información', 'ver más', 'saber más', 'here', 'click here', 'read more', 'more', 'learn more',
];
const MAX_HEADING_LENGTH = 120;

const error = (text) => ({ type: 'error', text });
const warning = (text) => ({ type: 'warning', text });
const quote = (text) => `«${text.length > 60 ? `${text.slice(0, 57)}…` : text}»`;

function checkHeadings(doc) {
  const headings = [...doc.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')]
    .map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim() }));
  const issues = [];
  const h1Count = headings.filter((h) => h.level === 1).length;

  if (!headings.length) return { headings, issues: [error('La página no tiene encabezados.')] };
  if (!h1Count) issues.push(error('Falta el H1: la página debe tener un encabezado principal.'));
  if (h1Count > 1) issues.push(error(`Hay ${h1Count} H1; debe haber solo uno.`));
  if (headings[0].level !== 1) issues.push(warning(`El primer encabezado es H${headings[0].level}; debería ser el H1.`));

  headings.forEach((h, i) => {
    const prev = headings[i - 1];
    if (prev && h.level > prev.level + 1) {
      issues.push(error(`Salto de nivel H${prev.level} → H${h.level} en ${quote(h.text || '(vacío)')}.`));
    }
    if (!h.text) issues.push(error(`H${h.level} vacío.`));
    else if (h.text.length > MAX_HEADING_LENGTH) {
      issues.push(warning(`H${h.level} demasiado largo (${h.text.length} caracteres): ${quote(h.text)}.`));
    }
  });

  return { headings, issues };
}

function checkImages(doc) {
  return [...doc.querySelectorAll('main img')]
    .filter((img) => !img.getAttribute('alt')?.trim())
    .map((img) => {
      const name = (img.getAttribute('src') || '').split('/').pop().split('?')[0] || 'sin nombre';
      return warning(`Imagen sin texto alternativo: ${name} (ignóralo solo si es decorativa).`);
    });
}

function checkLinks(doc) {
  const issues = [];
  doc.querySelectorAll('main a').forEach((a) => {
    const text = a.textContent.trim();
    const altText = [...a.querySelectorAll('img')].map((img) => img.getAttribute('alt') || '').join('').trim();
    const href = a.getAttribute('href') || '';
    if (!text && !altText) issues.push(error(`Enlace sin texto: ${href || '(sin destino)'}.`));
    else if (GENERIC_LINKS.includes(text.toLowerCase().replace(/[.…:»>]+$/, '').trim())) {
      issues.push(warning(`Texto de enlace poco descriptivo: ${quote(text)} → ${href}.`));
    }
  });
  return issues;
}

function checkTitle(doc, headings) {
  const hasTitle = [...doc.querySelectorAll('.metadata > div')]
    .some((row) => row.children[0]?.textContent.trim().toLowerCase() === 'title'
      && row.children[1]?.textContent.trim());
  return hasTitle || headings.some((h) => h.level === 1 && h.text)
    ? [] : [error('La página no tiene título (ni Title en Metadata ni H1).')];
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function render(report, headings, issues) {
  const errors = issues.filter((i) => i.type === 'error').length;
  const warnings = issues.length - errors;

  const outline = headings.length
    ? el('ul', { className: 'outline' }, headings.map((h) => {
      const li = el('li', {}, [
        el('span', { className: 'tag', textContent: `H${h.level}` }),
        el('span', { className: h.text ? '' : 'empty', textContent: h.text || '(vacío)' }),
      ]);
      li.style.setProperty('--level', h.level);
      return li;
    }))
    : el('p', { textContent: 'Sin encabezados.' });

  const list = issues.length
    ? el('ul', { className: 'issues' }, issues.map((i) => el('li', { className: i.type, textContent: i.text })))
    : el('ul', { className: 'issues' }, [el('li', { className: 'ok', textContent: 'Cumple los requisitos básicos revisados.' })]);

  report.replaceChildren(
    el('div', { className: 'summary' }, [
      el('span', { className: 'error', textContent: `${errors} errores` }),
      el('span', { className: 'warning', textContent: `${warnings} avisos` }),
    ]),
    el('h2', { textContent: 'Estructura de encabezados' }),
    outline,
    el('h2', { textContent: 'Incidencias' }),
    list,
  );
}

async function analyze(report, { context, token }) {
  report.textContent = 'Analizando…';
  const { org, repo, path } = context;
  const file = path.endsWith('.html') ? path : `${path}.html`;
  try {
    const resp = await fetch(`https://admin.da.live/source/${org}/${repo}${file}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`No se pudo leer el documento (${resp.status}).`);
    const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
    const { headings, issues } = checkHeadings(doc);
    render(report, headings, [
      ...checkTitle(doc, headings), ...issues, ...checkImages(doc), ...checkLinks(doc),
    ]);
  } catch (e) {
    report.replaceChildren(el('p', { className: 'error', textContent: e.message }));
  }
}

(async function init() {
  const sdk = await DA_SDK;
  const report = document.getElementById('report');
  document.getElementById('refresh').addEventListener('click', () => analyze(report, sdk));
  analyze(report, sdk);
}());
