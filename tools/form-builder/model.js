/*
 * Modelo del Form Builder: tipos de campo, plantillas y conversión
 * estado <-> HTML del bloque service-form (mismo contrato que blocks/service-form).
 */

export const BLOCK_NAME = 'service-form';

export const FIELD_TYPES = {
  text: {
    kind: 'text', label: 'Texto', icon: 'Aa', hint: 'Una línea de texto',
  },
  email: {
    kind: 'text', label: 'Email', icon: '@', hint: 'Valida formato de email',
  },
  tel: {
    kind: 'text', label: 'Teléfono', icon: '☎', hint: 'Valida formato de teléfono',
  },
  number: {
    kind: 'text', label: 'Número', icon: '#', hint: 'Solo números',
  },
  url: {
    kind: 'text', label: 'URL', icon: '🔗', hint: 'Dirección web',
  },
  date: {
    kind: 'text', label: 'Fecha', icon: '📅', hint: 'Selector de fecha',
  },
  password: {
    kind: 'text', label: 'Contraseña', icon: '••', hint: 'Texto oculto',
  },
  textarea: {
    kind: 'text', label: 'Área de texto', icon: '¶', hint: 'Texto largo, ocupa toda la fila',
  },
  radio: {
    kind: 'options', label: 'Opción única', icon: '◉', hint: 'Radio buttons: elegir una',
  },
  checkbox: {
    kind: 'options', label: 'Casillas', icon: '☑', hint: 'Elegir varias, o una sola casilla sin opciones',
  },
  switch: {
    kind: 'options', label: 'Interruptor', icon: '⏻', hint: 'Activar / desactivar',
  },
};

export const VALIDATION_PRESETS = [
  { id: '', label: 'Por defecto del tipo', pattern: '' },
  { id: 'digits', label: 'Solo dígitos', pattern: '^[0-9]+$' },
  { id: 'cp-es', label: 'Código postal (5 dígitos)', pattern: '^[0-9]{5}$' },
  { id: 'dni', label: 'DNI / NIE', pattern: '^([0-9]{8}|[XYZxyz][0-9]{7})[A-Za-z]$' },
  { id: 'tel-es', label: 'Móvil España', pattern: '^(\\+34)?\\s?[6789][0-9]{8}$' },
  { id: 'custom', label: 'Personalizada (regex)', pattern: null },
];

export const presetFor = (pattern) => {
  if (!pattern) return '';
  return VALIDATION_PRESETS.find((p) => p.pattern === pattern)?.id || 'custom';
};

let seq = 0;
export const uid = () => {
  seq += 1;
  return `f${Date.now().toString(36)}${seq}`;
};

export function toName(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createField(type, overrides = {}) {
  const { kind, label } = FIELD_TYPES[type];
  const base = {
    id: uid(),
    type,
    kind,
    label,
    name: '',
    autoName: true,
    placeholder: '',
    required: false,
    pattern: '',
    requiredMessage: '',
    validationMessage: '',
    errorMessage: '',
    options: kind === 'options' && type !== 'switch'
      ? [{ value: 'opcion-1', text: 'Opción 1' }, { value: 'opcion-2', text: 'Opción 2' }]
      : [],
  };
  const field = { ...base, ...overrides };
  if (field.autoName) field.name = toName(field.label);
  return field;
}

export const DEFAULT_SETTINGS = {
  action: '',
  method: 'POST',
  columns: 1,
  submit: 'Enviar',
  success: '',
  error: '',
};

const opts = (...texts) => texts.map((text) => ({ value: toName(text), text }));

export const TEMPLATES = [
  {
    id: 'contact',
    title: 'Contacto',
    description: 'Nombre, email, teléfono, mensaje y aceptación',
    build: () => ({
      settings: {
        ...DEFAULT_SETTINGS, columns: 2, submit: 'Enviar mensaje', success: '¡Gracias! Te responderemos pronto.',
      },
      fields: [
        createField('text', { label: 'Nombre', placeholder: 'Tu nombre', required: true }),
        createField('email', { label: 'Email', placeholder: 'tu@email.com', required: true }),
        createField('tel', { label: 'Teléfono', placeholder: '+34 600 000 000' }),
        createField('radio', { label: 'Motivo', required: true, options: opts('Información', 'Soporte', 'Otro') }),
        createField('textarea', { label: 'Mensaje', placeholder: '¿En qué podemos ayudarte?', required: true }),
        createField('checkbox', {
          label: 'Acepto la política de privacidad', name: 'privacidad', autoName: false, required: true, options: [], errorMessage: 'Debes aceptar la política de privacidad.',
        }),
      ],
    }),
  },
  {
    id: 'newsletter',
    title: 'Newsletter',
    description: 'Email, intereses y consentimiento',
    build: () => ({
      settings: {
        ...DEFAULT_SETTINGS, columns: 1, submit: 'Suscribirme', success: '¡Suscripción completada!',
      },
      fields: [
        createField('email', { label: 'Email', placeholder: 'tu@email.com', required: true }),
        createField('checkbox', { label: 'Temas de interés', options: opts('Novedades', 'Ofertas', 'Eventos') }),
        createField('checkbox', {
          label: 'Acepto recibir comunicaciones', name: 'consentimiento', autoName: false, required: true, options: [],
        }),
      ],
    }),
  },
  {
    id: 'quote',
    title: 'Solicitud de presupuesto',
    description: 'Datos de empresa, servicio y detalle',
    build: () => ({
      settings: {
        ...DEFAULT_SETTINGS, columns: 2, submit: 'Solicitar presupuesto', success: 'Hemos recibido tu solicitud.',
      },
      fields: [
        createField('text', { label: 'Nombre', required: true }),
        createField('text', { label: 'Empresa' }),
        createField('email', { label: 'Email', required: true }),
        createField('tel', { label: 'Teléfono', required: true }),
        createField('radio', { label: 'Servicio', required: true, options: opts('Consultoría', 'Desarrollo', 'Mantenimiento') }),
        createField('date', { label: 'Fecha deseada de inicio' }),
        createField('textarea', { label: 'Describe tu proyecto', required: true }),
        createField('switch', { label: 'Quiero que me llaméis', name: 'llamada', autoName: false }),
      ],
    }),
  },
  {
    id: 'blank',
    title: 'En blanco',
    description: 'Empieza desde cero',
    build: () => ({ settings: { ...DEFAULT_SETTINGS }, fields: [] }),
  },
];

/* ---------- validación del formulario antes de insertar ---------- */

export function getIssues({ settings, fields }) {
  const issues = [];
  if (!settings.action.trim()) issues.push({ level: 'error', text: 'Falta la URL del servicio (endpoint).', target: 'settings' });
  else if (!/^(https?:\/\/|\/)/.test(settings.action.trim())) {
    issues.push({ level: 'warning', text: 'La URL del servicio debería empezar por https:// o /.', target: 'settings' });
  }
  if (!fields.length) issues.push({ level: 'error', text: 'El formulario no tiene campos.' });
  const seen = new Map();
  fields.forEach((f) => {
    const name = f.name || '(sin nombre)';
    if (!f.label.trim()) issues.push({ level: 'error', text: 'Hay un campo sin etiqueta.', target: f.id });
    if (!f.name) issues.push({ level: 'error', text: `«${f.label}» no tiene nombre técnico.`, target: f.id });
    if (seen.has(f.name) && f.name) issues.push({ level: 'error', text: `Nombre técnico repetido: «${name}».`, target: f.id });
    seen.set(f.name, true);
    if (f.type === 'radio' && f.options.length < 2) {
      issues.push({ level: 'error', text: `«${f.label}» (opción única) necesita al menos 2 opciones.`, target: f.id });
    }
    if (f.kind === 'options' && f.options.some((o) => !o.text.trim())) {
      issues.push({ level: 'warning', text: `«${f.label}» tiene opciones vacías.`, target: f.id });
    }
    if (f.pattern) {
      try { RegExp(f.pattern); } catch (e) {
        issues.push({ level: 'error', text: `La expresión regular de «${f.label}» no es válida.`, target: f.id });
      }
    }
  });
  return issues;
}

/* ---------- estado -> HTML ---------- */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function settingsRows(settings) {
  const action = settings.action.trim();
  const rows = [['action', action ? `<a href="${esc(action)}">${esc(action)}</a>` : '']];
  rows.push(['method', esc(settings.method)]);
  rows.push(['submit', esc(settings.submit)]);
  if (settings.success) rows.push(['success', esc(settings.success)]);
  if (settings.error) rows.push(['error', esc(settings.error)]);
  return rows;
}

function fieldCells(f) {
  const bool = f.required ? 'true' : 'false';
  if (f.kind === 'text') {
    return [
      f.type, f.name, f.label, f.placeholder, bool,
      f.pattern, f.requiredMessage, f.validationMessage,
    ].map(esc);
  }
  const list = f.options.length
    ? `<ul>${f.options.map((o) => `<li>${esc(o.value)}|${esc(o.text)}</li>`).join('')}</ul>` : '';
  const [type, name, label, placeholder, errorMessage] = [
    f.type, f.name, f.label, f.placeholder, f.errorMessage,
  ].map(esc);
  return [type, name, label, placeholder, list, bool, errorMessage];
}

const blockClass = (settings) => `${BLOCK_NAME} columns-${settings.columns}`;

/** Formato "div" (el que genera AEM y el que usa la vista previa). */
export function toBlockDivs(state) {
  const rows = [...settingsRows(state.settings), ...state.fields.map(fieldCells)];
  return `<div class="${blockClass(state.settings)}">${rows
    .map((cells) => `<div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`).join('')}</div>`;
}

/** Formato tabla (el que ve el autor en el editor de documentos de DA). */
export function toBlockTable(state) {
  const rows = [...settingsRows(state.settings), ...state.fields.map(fieldCells)];
  const width = Math.max(...rows.map((r) => r.length));
  const head = `<tr><td colspan="${width}"><p>${BLOCK_NAME} (columns-${state.settings.columns})</p></td></tr>`;
  const body = rows.map((cells) => {
    const tds = cells.map((c, i) => {
      const span = i === cells.length - 1 && cells.length < width ? ` colspan="${width - cells.length + 1}"` : '';
      return `<td${span}>${c.startsWith('<ul>') ? c : `<p>${c}</p>`}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<table>${head}${body}</table>`;
}

/* ---------- HTML -> estado (para editar un formulario existente) ---------- */

const cellText = (cell) => (cell?.textContent || '').trim();
const TRUE = ['true', 'yes', 'si', 'sí', '1', 'required', 'obligatorio', 'x'];

function blockRows(el) {
  if (el.tagName === 'TABLE') {
    return [...el.querySelectorAll('tr')].slice(1).map((tr) => [...tr.children]);
  }
  return [...el.children].map((row) => [...row.children]);
}

export function blockName(el) {
  if (el.tagName === 'TABLE') return cellText(el.querySelector('tr td, tr th')).toLowerCase();
  return `${el.classList[0] || ''} (${[...el.classList].slice(1).join(', ')})`;
}

export function isServiceForm(el) {
  return el && blockName(el).replace(/\s*\(.*$/, '').trim() === BLOCK_NAME;
}

function parseOptions(cell) {
  if (!cell) return [];
  const items = cell.querySelectorAll('li');
  let lines;
  if (items.length) lines = [...items].map((li) => li.textContent);
  else if (cell.querySelector('p')) lines = [...cell.querySelectorAll('p')].map((p) => p.textContent);
  else lines = cell.textContent.split(/\n|,/);
  return lines.map((l) => l.trim()).filter(Boolean).map((line) => {
    const [value, text] = line.includes('|') ? line.split('|').map((s) => s.trim()) : [toName(line), line];
    return { value: value || toName(text), text: text || value };
  });
}

export function fromBlock(el) {
  const settings = { ...DEFAULT_SETTINGS };
  const cols = blockName(el).match(/columns-(\d)/);
  if (cols) settings.columns = Number(cols[1]);
  const fields = [];
  blockRows(el).forEach((cells) => {
    const first = cellText(cells[0]).toLowerCase();
    if (cells.length === 2 && ['action', 'method', 'columns', 'submit', 'success', 'error'].includes(first)) {
      const a = cells[1].querySelector('a[href]');
      const value = first === 'action' && a ? a.getAttribute('href') : cellText(cells[1]);
      if (first === 'columns') settings.columns = Number(value) || settings.columns;
      else settings[first] = value;
      return;
    }
    const def = FIELD_TYPES[first];
    if (!def) return;
    const label = cellText(cells[2]);
    const name = cellText(cells[1]);
    const common = {
      label, name: name || toName(label), autoName: !name || name === toName(label),
    };
    if (def.kind === 'text') {
      fields.push(createField(first, {
        ...common,
        placeholder: cellText(cells[3]),
        required: TRUE.includes(cellText(cells[4]).toLowerCase()),
        pattern: cellText(cells[5]),
        requiredMessage: cellText(cells[6]),
        validationMessage: cellText(cells[7]),
      }));
    } else {
      fields.push(createField(first, {
        ...common,
        placeholder: cellText(cells[3]),
        options: parseOptions(cells[4]),
        required: TRUE.includes(cellText(cells[5]).toLowerCase()),
        errorMessage: cellText(cells[6]),
      }));
    }
  });
  return { settings, fields };
}
