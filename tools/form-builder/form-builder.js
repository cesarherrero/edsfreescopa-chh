/*
 * Form Builder — extensión de la Library de DA para crear y editar bloques service-form.
 *
 * - Plantillas de inicio, paleta de campos y edición por tarjetas.
 * - Reordenación con drag & drop o teclado.
 * - Vista previa en vivo con el código real del bloque (iframe con los scripts del sitio),
 *   en móvil/tablet/escritorio y envío simulado que muestra el JSON que recibiría el servicio.
 * - Inserta el bloque en el documento o actualiza el formulario seleccionado (DA App SDK).
 */
/* eslint-disable no-use-before-define */ // renderizado recursivo entre funciones
// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import {
  FIELD_TYPES, VALIDATION_PRESETS, TEMPLATES, DEFAULT_SETTINGS,
  createField, toName, presetFor, getIssues, toBlockDivs, toBlockTable,
  isServiceForm, fromBlock, uid,
} from './model.js';

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (v === undefined || v === null || v === false) return;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node && typeof v !== 'string') node[k] = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  });
  node.append(...[].concat(children).filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/* ------------------------------------------------------------------ state */

const state = { settings: { ...DEFAULT_SETTINGS }, fields: [] };
const ui = {
  openId: null,
  viewport: 'desktop',
  editingSelection: false,
  selectedBlock: null,
  sdk: null,
  draftKey: 'form-builder:standalone',
};

let previewTimer;
let saveTimer;

function saveDraft() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(ui.draftKey, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, 300);
}

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(ui.draftKey));
    if (draft?.settings && Array.isArray(draft.fields)) return draft;
  } catch (e) { /* ignore */ }
  return null;
}

function toast(text, level = 'info') {
  const t = $('toast');
  t.textContent = text;
  t.dataset.level = level;
  t.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('is-visible'), 3200);
}

/* ---------------------------------------------------------------- preview */

const VIEWPORTS = [
  { id: 'mobile', label: 'Móvil', width: 375 },
  { id: 'tablet', label: 'Tablet', width: 768 },
  { id: 'desktop', label: 'Escritorio', width: 1200 },
];

function previewDoc() {
  const { origin } = window.location;
  const simulate = $('simulate').checked;
  // intercepta el fetch del bloque: simula la respuesta y envía el payload al constructor
  const mock = `
    (function () {
      var realFetch = window.fetch.bind(window);
      var simulate = ${simulate};
      window.fetch = function (url, init) {
        if (init && init.headers && init.headers.Accept === 'application/json') {
          var body = init.body ? JSON.parse(init.body) : Object.fromEntries(new URL(url, location.href).searchParams);
          parent.postMessage({ type: 'form-builder:submit', url: String(url), method: init.method, body: body, simulated: simulate }, '*');
          if (simulate) return new Promise(function (r) { setTimeout(function () { r(new Response('{}', { status: 200 })); }, 500); });
        }
        return realFetch(url, init);
      };
    }());`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<base href="${origin}/">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${mock}</script>
<script src="/scripts/aem.js" type="module"></script>
<script src="/scripts/scripts.js" type="module"></script>
<link rel="stylesheet" href="/styles/styles.css">
<style>header, footer { display: none; } body { padding-bottom: 32px; }</style>
</head><body>
<header><div class="header"></div></header>
<main><div>${toBlockDivs(state)}</div></main>
<footer><div class="footer"></div></footer>
</body></html>`;
}

function renderPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const frame = $('preview');
    let scroll = 0;
    try { scroll = frame.contentWindow?.scrollY || 0; } catch (e) { /* ignore */ }
    frame.onload = () => {
      setTimeout(() => {
        try { frame.contentWindow.scrollTo(0, scroll); } catch (e) { /* ignore */ }
      }, 150);
    };
    frame.srcdoc = previewDoc();
  }, 250);
}

function renderViewport() {
  const group = $('viewport');
  group.replaceChildren(...VIEWPORTS.map((v) => el('button', {
    type: 'button',
    role: 'radio',
    'aria-checked': String(ui.viewport === v.id),
    text: v.label,
    onclick: () => { ui.viewport = v.id; renderViewport(); },
  })));
  $('stage').dataset.viewport = ui.viewport;
  fitPreview();
}

/** Renderiza el iframe al ancho real del dispositivo y lo escala para que quepa. */
function fitPreview() {
  const stage = $('stage');
  const frame = $('preview');
  const vp = VIEWPORTS.find((v) => v.id === ui.viewport);
  const available = stage.clientWidth - 32;
  const height = stage.clientHeight - 32;
  const scale = Math.min(1, available / vp.width);
  frame.style.width = `${vp.width}px`;
  frame.style.height = `${Math.max(420, height / scale)}px`;
  frame.style.transform = `scale(${scale})`;
  frame.parentElement.style.width = `${vp.width * scale}px`;
  frame.parentElement.style.height = `${Math.max(420, height / scale) * scale}px`;
  $('viewport-size').textContent = `${vp.width}px${scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}`;
}

/* ----------------------------------------------------------------- issues */

function renderIssues() {
  const issues = getIssues(state);
  const errors = issues.filter((i) => i.level === 'error');
  const box = $('issues');
  if (!issues.length) {
    box.replaceChildren(el('span', { class: 'fb-ok', text: '✓ Listo para insertar' }));
  } else {
    box.replaceChildren(el('details', { class: 'fb-issue-list' }, [
      el('summary', {}, [
        errors.length ? el('span', { class: 'fb-pill fb-pill-error', text: `${errors.length} por resolver` }) : null,
        issues.length - errors.length ? el('span', { class: 'fb-pill fb-pill-warning', text: `${issues.length - errors.length} avisos` }) : null,
      ]),
      el('ul', {}, issues.map((i) => el('li', { class: `is-${i.level}` }, [
        i.target ? el('button', {
          type: 'button',
          class: 'fb-link',
          text: i.text,
          onclick: () => focusTarget(i.target),
        }) : i.text,
      ]))),
    ]));
  }
  $('insert').disabled = errors.length > 0;
  document.querySelectorAll('.fb-field').forEach((card) => {
    card.classList.toggle('has-error', errors.some((e) => e.target === card.dataset.id));
  });
}

function focusTarget(target) {
  if (target === 'settings') {
    $('settings').open = true;
    $('settings-body').querySelector('input')?.focus();
    return;
  }
  ui.openId = target;
  renderFields();
  document.querySelector(`.fb-field[data-id="${target}"] .fb-field-body input`)?.focus();
}

/* ---------------------------------------------------------------- changes */

function changed({ structural = false } = {}) {
  if (structural) renderFields();
  renderSettingsMeta();
  renderIssues();
  renderPreview();
  saveDraft();
}

function updateField(id, patch, opts) {
  const field = state.fields.find((f) => f.id === id);
  Object.assign(field, patch);
  if ('label' in patch && field.autoName) field.name = toName(field.label);
  if (!opts?.structural) refreshCardSummary(field);
  changed(opts);
}

function moveField(id, delta) {
  const i = state.fields.findIndex((f) => f.id === id);
  const j = i + delta;
  if (j < 0 || j >= state.fields.length) return;
  const [f] = state.fields.splice(i, 1);
  state.fields.splice(j, 0, f);
  changed({ structural: true });
  document.querySelector(`.fb-field[data-id="${id}"] .fb-field-toggle`)?.focus();
}

function addField(type) {
  const field = createField(type);
  // etiqueta única para que el nombre técnico no se repita
  const count = state.fields.filter((f) => f.type === type).length;
  if (count) {
    field.label = `${field.label} ${count + 1}`;
    field.name = toName(field.label);
  }
  state.fields.push(field);
  ui.openId = field.id;
  changed({ structural: true });
  const card = document.querySelector(`.fb-field[data-id="${field.id}"]`);
  card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const input = card?.querySelector('.fb-field-body input');
  input?.focus();
  input?.select();
}

/* --------------------------------------------------------------- settings */

function control(labelText, input, help) {
  return el('label', { class: 'fb-control' }, [
    el('span', { class: 'fb-label', text: labelText }),
    input,
    help ? el('span', { class: 'fb-help', text: help }) : null,
  ]);
}

function segmented(name, options, value, onChange) {
  return el('div', { class: 'fb-segmented', role: 'radiogroup', 'aria-label': name }, options.map((o) => el('button', {
    type: 'button',
    role: 'radio',
    'aria-checked': String(String(value) === String(o.value)),
    title: o.title,
    onclick: (e) => {
      e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', 'false'));
      e.currentTarget.setAttribute('aria-checked', 'true');
      onChange(o.value);
    },
  }, o.content || o.label)));
}

function columnsIcon(n) {
  return el('span', { class: 'fb-cols-icon', 'aria-hidden': 'true' }, Array.from({ length: n }, () => el('span')));
}

function renderSettingsMeta() {
  const { action, columns } = state.settings;
  $('settings-meta').textContent = `${columns} col. · ${action ? action.replace(/^https?:\/\//, '') : 'sin servicio'}`;
  $('settings-meta').classList.toggle('is-missing', !action);
}

function renderSettings() {
  const s = state.settings;
  const input = (key, props = {}) => el('input', {
    type: 'text',
    value: s[key],
    ...props,
    oninput: (e) => { s[key] = e.target.value; changed(); },
  });

  $('settings-body').replaceChildren(
    control('URL del servicio (endpoint)', input('action', { type: 'url', placeholder: 'https://api.ejemplo.com/contacto', required: true }), 'Recibe los datos en JSON. Con GET se envían como parámetros de la URL.'),
    el('div', { class: 'fb-row' }, [
      el('div', { class: 'fb-control' }, [
        el('span', { class: 'fb-label', text: 'Método' }),
        segmented('Método', ['POST', 'PUT', 'GET'].map((m) => ({ value: m, label: m })), s.method, (v) => { s.method = v; changed(); }),
      ]),
      el('div', { class: 'fb-control' }, [
        el('span', { class: 'fb-label', text: 'Columnas' }),
        segmented('Columnas', [1, 2, 3, 4].map((n) => ({
          value: n, title: `${n} columna${n > 1 ? 's' : ''}`, content: [columnsIcon(n), el('span', { text: String(n) })],
        })), s.columns, (v) => { s.columns = v; changed(); }),
      ]),
    ]),
    control('Texto del botón', input('submit', { placeholder: 'Enviar' })),
    el('div', { class: 'fb-row' }, [
      control('Mensaje de éxito', input('success', { placeholder: 'Formulario enviado correctamente.' })),
      control('Mensaje si falla el servicio', input('error', { placeholder: 'Se ha producido un error al enviar el formulario.' })),
    ]),
  );
  renderSettingsMeta();
}

/* ----------------------------------------------------------------- fields */

function typeOptions(field) {
  return Object.entries(FIELD_TYPES).map(([type, def]) => el('option', {
    value: type, text: `${def.icon}  ${def.label}`, selected: type === field.type,
  }));
}

function changeType(field, type) {
  const def = FIELD_TYPES[type];
  const patch = { type, kind: def.kind };
  if (def.kind === 'options' && field.kind !== 'options' && type !== 'switch') {
    patch.options = [{ value: 'opcion-1', text: 'Opción 1' }, { value: 'opcion-2', text: 'Opción 2' }];
  }
  updateField(field.id, patch, { structural: true });
}

function optionsEditor(field) {
  const list = el('ol', { class: 'fb-options' });
  const commit = (structural) => updateField(field.id, { options: field.options }, { structural });

  field.options.forEach((opt, i) => {
    const valueInput = el('input', {
      type: 'text',
      class: 'fb-option-value',
      value: opt.value,
      'aria-label': `Valor de la opción ${i + 1}`,
      title: 'Valor enviado al servicio',
      oninput: (e) => { opt.value = e.target.value; opt.customValue = true; commit(false); },
    });
    list.append(el('li', {}, [
      el('input', {
        type: 'text',
        value: opt.text,
        'aria-label': `Texto de la opción ${i + 1}`,
        placeholder: `Opción ${i + 1}`,
        oninput: (e) => {
          opt.text = e.target.value;
          if (!opt.customValue) { opt.value = toName(opt.text); valueInput.value = opt.value; }
          commit(false);
        },
        onkeydown: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            field.options.splice(i + 1, 0, { value: '', text: '' });
            commit(true);
            document.querySelectorAll(`.fb-field[data-id="${field.id}"] .fb-options li input:first-child`)[i + 1]?.focus();
          }
        },
      }),
      valueInput,
      el('button', {
        type: 'button',
        class: 'fb-icon-btn',
        title: 'Subir',
        'aria-label': `Subir opción ${i + 1}`,
        disabled: i === 0,
        text: '↑',
        onclick: () => {
          const { options } = field;
          [options[i - 1], options[i]] = [options[i], options[i - 1]];
          commit(true);
        },
      }),
      el('button', {
        type: 'button',
        class: 'fb-icon-btn',
        title: 'Eliminar',
        'aria-label': `Eliminar opción ${i + 1}`,
        text: '✕',
        onclick: () => { field.options.splice(i, 1); commit(true); },
      }),
    ]));
  });

  const pasteArea = el('textarea', {
    rows: 4,
    'aria-label': 'Opciones, una por línea',
    placeholder: 'Una opción por línea\nOpcional: valor|Texto',
  });
  const paste = el('div', { class: 'fb-paste', hidden: true }, [
    pasteArea,
    el('button', {
      type: 'button',
      class: 'fb-btn fb-btn-small',
      text: 'Añadir opciones',
      onclick: () => {
        const parsed = pasteArea.value.split(/\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
          const custom = line.includes('|');
          const [v, t] = custom ? line.split('|').map((x) => x.trim()) : [toName(line), line];
          return { value: v, text: t, customValue: custom };
        });
        if (!parsed.length) return;
        field.options.push(...parsed);
        commit(true);
      },
    }),
  ]);

  const single = field.type !== 'radio' && !field.options.length;
  return el('div', { class: 'fb-control' }, [
    el('span', { class: 'fb-label', text: 'Opciones' }),
    single ? el('p', { class: 'fb-note', text: 'Sin opciones: se muestra un único control con la etiqueta como texto (p. ej. «Acepto la política de privacidad»).' }) : null,
    list,
    el('div', { class: 'fb-inline' }, [
      el('button', {
        type: 'button',
        class: 'fb-btn fb-btn-quiet fb-btn-small',
        text: '+ Añadir opción',
        onclick: () => {
          field.options.push({ value: `opcion-${field.options.length + 1}`, text: `Opción ${field.options.length + 1}` });
          commit(true);
          [...document.querySelectorAll(`.fb-field[data-id="${field.id}"] .fb-options li input:first-child`)].pop()?.select();
        },
      }),
      el('button', {
        type: 'button',
        class: 'fb-btn fb-btn-quiet fb-btn-small',
        text: 'Pegar lista…',
        'aria-expanded': 'false',
        onclick: (e) => {
          const open = paste.hidden;
          paste.hidden = !open;
          e.currentTarget.setAttribute('aria-expanded', String(open));
          if (open) paste.querySelector('textarea').focus();
        },
      }),
    ]),
    paste,
  ]);
}

function fieldBody(field) {
  const text = (key, labelText, props = {}, help = null) => control(labelText, el('input', {
    type: 'text',
    value: field[key],
    ...props,
    oninput: (e) => updateField(field.id, { [key]: e.target.value }),
  }), help);

  const nameInput = el('input', {
    type: 'text',
    value: field.name,
    class: 'fb-mono',
    oninput: (e) => {
      const name = e.target.value.trim().replace(/\s+/g, '-');
      updateField(field.id, { name, autoName: false });
      autoBtn.hidden = false;
    },
  });
  const autoBtn = el('button', {
    type: 'button',
    class: 'fb-link',
    text: 'Generar desde la etiqueta',
    hidden: field.autoName,
    onclick: () => {
      updateField(field.id, { autoName: true, name: toName(field.label) });
      nameInput.value = field.name;
      autoBtn.hidden = true;
    },
  });

  const labelInput = el('input', {
    type: 'text',
    value: field.label,
    oninput: (e) => {
      updateField(field.id, { label: e.target.value });
      if (field.autoName) nameInput.value = field.name;
    },
  });

  const required = el('label', { class: 'fb-switch' }, [
    el('input', {
      type: 'checkbox',
      role: 'switch',
      checked: field.required,
      onchange: (e) => {
        updateField(field.id, { required: e.target.checked });
        e.target.closest('.fb-field-body').querySelectorAll('[data-when="required"]').forEach((n) => { n.hidden = !e.target.checked; });
      },
    }),
    el('span', { text: 'Obligatorio' }),
  ]);

  const rows = [
    el('div', { class: 'fb-row' }, [
      control('Etiqueta', labelInput),
      control('Tipo', el('select', { onchange: (e) => changeType(field, e.target.value) }, typeOptions(field))),
    ]),
    el('div', { class: 'fb-control' }, [
      el('span', { class: 'fb-label' }, ['Nombre técnico ', el('span', { class: 'fb-help', text: '(clave que recibe el servicio)' })]),
      nameInput,
      autoBtn,
    ]),
    text('placeholder', field.kind === 'text' ? 'Placeholder' : 'Texto de ayuda', {
      placeholder: field.kind === 'text' ? 'Texto de ejemplo dentro del campo' : 'Se muestra bajo la etiqueta',
    }),
  ];

  if (field.kind === 'options') rows.push(optionsEditor(field));

  rows.push(required);

  if (field.kind === 'text') {
    const preset = presetFor(field.pattern);
    const patternInput = el('input', {
      type: 'text',
      class: 'fb-mono',
      value: field.pattern,
      placeholder: '^[0-9]{5}$',
      oninput: (e) => updateField(field.id, { pattern: e.target.value }),
    });
    const patternWrap = control('Expresión regular', patternInput);
    patternWrap.hidden = preset !== 'custom';
    rows.push(el('div', { class: 'fb-control' }, [
      el('span', { class: 'fb-label', text: 'Validación' }),
      el('select', {
        onchange: (e) => {
          const p = VALIDATION_PRESETS.find((x) => x.id === e.target.value);
          patternWrap.hidden = p.id !== 'custom';
          if (p.pattern !== null) {
            patternInput.value = p.pattern;
            updateField(field.id, { pattern: p.pattern });
          } else {
            patternInput.focus();
          }
        },
      }, VALIDATION_PRESETS.map((p) => el('option', { value: p.id, text: p.label, selected: p.id === preset }))),
    ]));
    rows.push(patternWrap);
    const reqMsg = text('requiredMessage', 'Mensaje si está vacío', { placeholder: 'Este campo es obligatorio.' });
    reqMsg.dataset.when = 'required';
    reqMsg.hidden = !field.required;
    rows.push(el('div', { class: 'fb-row' }, [
      reqMsg,
      text('validationMessage', 'Mensaje si no es válido', { placeholder: 'El valor introducido no es válido.' }),
    ]));
  } else {
    const errMsg = text('errorMessage', 'Mensaje de error', { placeholder: 'Selecciona al menos una opción.' });
    errMsg.dataset.when = 'required';
    errMsg.hidden = !field.required;
    rows.push(errMsg);
  }

  return el('div', { class: 'fb-field-body' }, rows);
}

function summaryParts(field) {
  const def = FIELD_TYPES[field.type];
  return {
    icon: def.icon,
    title: field.label || '(sin etiqueta)',
    meta: [def.label, field.name ? `· ${field.name}` : '', field.kind === 'options' && field.options.length ? `· ${field.options.length} opciones` : ''].join(' '),
  };
}

function refreshCardSummary(field) {
  const card = document.querySelector(`.fb-field[data-id="${field.id}"]`);
  if (!card) return;
  const s = summaryParts(field);
  card.querySelector('.fb-field-icon').textContent = s.icon;
  card.querySelector('.fb-field-title').textContent = s.title;
  card.querySelector('.fb-field-meta').textContent = s.meta;
  card.querySelector('.fb-badge-required').hidden = !field.required;
}

let dragId = null;

function fieldCard(field, index) {
  const open = ui.openId === field.id;
  const s = summaryParts(field);
  const bodyId = `body-${field.id}`;

  const card = el('li', {
    class: `fb-field${open ? ' is-open' : ''}`,
    dataset: { id: field.id },
    ondragover: (e) => {
      if (!dragId || dragId === field.id) return;
      e.preventDefault();
      const rect = card.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      card.classList.toggle('drop-before', !after);
      card.classList.toggle('drop-after', after);
    },
    ondragleave: () => card.classList.remove('drop-before', 'drop-after'),
    ondrop: (e) => {
      e.preventDefault();
      const after = card.classList.contains('drop-after');
      card.classList.remove('drop-before', 'drop-after');
      const from = state.fields.findIndex((f) => f.id === dragId);
      const [moved] = state.fields.splice(from, 1);
      let to = state.fields.findIndex((f) => f.id === field.id);
      if (after) to += 1;
      state.fields.splice(to, 0, moved);
      changed({ structural: true });
    },
  });

  const handle = el('span', {
    class: 'fb-handle',
    title: 'Arrastrar para reordenar',
    'aria-hidden': 'true',
    draggable: 'true',
    text: '⋮⋮',
    ondragstart: (e) => {
      dragId = field.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', field.id);
      e.dataTransfer.setDragImage(card, 20, 20);
      card.classList.add('is-dragging');
    },
    ondragend: () => {
      dragId = null;
      card.classList.remove('is-dragging');
    },
  });

  const toggle = el('button', {
    type: 'button',
    class: 'fb-field-toggle',
    'aria-expanded': String(open),
    'aria-controls': bodyId,
    onclick: () => { ui.openId = open ? null : field.id; renderFields(); document.querySelector(`.fb-field[data-id="${field.id}"] .fb-field-toggle`)?.focus(); },
    onkeydown: (e) => {
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        moveField(field.id, e.key === 'ArrowUp' ? -1 : 1);
      }
    },
  }, [
    el('span', { class: 'fb-field-icon', 'aria-hidden': 'true', text: s.icon }),
    el('span', { class: 'fb-field-text' }, [
      el('span', { class: 'fb-field-title', text: s.title }),
      el('span', { class: 'fb-field-meta', text: s.meta }),
    ]),
    el('span', { class: 'fb-badge fb-badge-required', text: 'Obligatorio', hidden: !field.required }),
  ]);

  const actions = el('div', { class: 'fb-field-actions' }, [
    el('button', {
      type: 'button',
      class: 'fb-icon-btn',
      title: 'Subir',
      'aria-label': `Subir ${s.title}`,
      disabled: index === 0,
      text: '↑',
      onclick: () => moveField(field.id, -1),
    }),
    el('button', {
      type: 'button',
      class: 'fb-icon-btn',
      title: 'Bajar',
      'aria-label': `Bajar ${s.title}`,
      disabled: index === state.fields.length - 1,
      text: '↓',
      onclick: () => moveField(field.id, 1),
    }),
    el('button', {
      type: 'button',
      class: 'fb-icon-btn',
      title: 'Duplicar',
      'aria-label': `Duplicar ${s.title}`,
      text: '⧉',
      onclick: () => {
        const copy = JSON.parse(JSON.stringify(field));
        copy.id = uid();
        copy.label = `${field.label} (copia)`;
        copy.name = toName(copy.label);
        copy.autoName = true;
        state.fields.splice(index + 1, 0, copy);
        ui.openId = copy.id;
        changed({ structural: true });
      },
    }),
    el('button', {
      type: 'button',
      class: 'fb-icon-btn fb-danger',
      title: 'Eliminar',
      'aria-label': `Eliminar ${s.title}`,
      text: '🗑',
      onclick: () => {
        const [removed] = state.fields.splice(index, 1);
        changed({ structural: true });
        toast(`Campo «${removed.label}» eliminado`);
        showUndo(() => {
          state.fields.splice(index, 0, removed);
          changed({ structural: true });
        });
      },
    }),
  ]);

  card.append(el('div', { class: 'fb-field-head' }, [handle, toggle, actions]));
  if (open) {
    const body = fieldBody(field);
    body.id = bodyId;
    card.append(body);
  }
  return card;
}

function showUndo(undo) {
  const t = $('toast');
  t.append(' ', el('button', {
    type: 'button',
    class: 'fb-link',
    text: 'Deshacer',
    onclick: () => { undo(); t.classList.remove('is-visible'); },
  }));
}

function renderFields() {
  const list = $('fields');
  $('field-count').textContent = state.fields.length;
  if (!state.fields.length) {
    list.replaceChildren(el('li', { class: 'fb-empty' }, [
      el('strong', { text: 'Aún no hay campos' }),
      el('span', { text: 'Añade campos desde la paleta de abajo o empieza con una plantilla.' }),
    ]));
  } else {
    list.replaceChildren(...state.fields.map(fieldCard));
  }
  renderIssues();
}

function renderPalette() {
  const group = (title, kind) => el('div', { class: 'fb-palette-group' }, [
    el('h3', { text: title }),
    el('div', { class: 'fb-palette-grid' }, Object.entries(FIELD_TYPES)
      .filter(([, def]) => def.kind === kind)
      .map(([type, def]) => el('button', {
        type: 'button',
        class: 'fb-palette-item',
        title: def.hint,
        onclick: () => addField(type),
      }, [
        el('span', { class: 'fb-field-icon', 'aria-hidden': 'true', text: def.icon }),
        el('span', { text: def.label }),
      ]))),
  ]);
  $('palette').replaceChildren(
    el('h2', { text: 'Añadir campo' }),
    group('Input text', 'text'),
    group('Input options', 'options'),
  );
}

/* -------------------------------------------------------------- templates */

function applyState(next) {
  state.settings = { ...DEFAULT_SETTINGS, ...next.settings };
  state.fields = next.fields;
  ui.openId = null;
  renderSettings();
  changed({ structural: true });
}

function openTemplates() {
  $('template-list').replaceChildren(...TEMPLATES.map((t) => el('button', {
    type: 'button',
    class: 'fb-template',
    onclick: () => {
      const keepAction = state.settings.action;
      const next = t.build();
      if (keepAction) next.settings.action = keepAction;
      ui.editingSelection = false;
      renderSelectionBanner();
      applyState(next);
      $('templates').close();
    },
  }, [
    el('strong', { text: t.title }),
    el('span', { text: t.description }),
  ])));
  $('templates').showModal();
}

/* ----------------------------------------------------- DA document bridge */

function renderSelectionBanner() {
  const banner = $('selection-banner');
  const selected = ui.selectedBlock;
  $('insert').textContent = ui.editingSelection ? 'Actualizar formulario' : 'Insertar en el documento';
  if (ui.editingSelection) {
    banner.hidden = false;
    banner.replaceChildren(
      el('span', { text: 'Editando el formulario seleccionado en el documento.' }),
      el('button', {
        type: 'button',
        class: 'fb-link',
        text: 'Crear uno nuevo en su lugar',
        onclick: () => { ui.editingSelection = false; renderSelectionBanner(); },
      }),
    );
    return;
  }
  if (selected && isServiceForm(selected)) {
    banner.hidden = false;
    banner.replaceChildren(
      el('span', { text: 'Tienes un formulario seleccionado en el documento.' }),
      el('button', {
        type: 'button',
        class: 'fb-btn fb-btn-small',
        text: 'Editarlo aquí',
        onclick: () => {
          ui.editingSelection = true;
          applyState(fromBlock(selected));
          renderSelectionBanner();
          toast('Formulario cargado desde el documento');
        },
      }),
    );
    return;
  }
  banner.hidden = true;
}

function onLiveDocument({ html, selection }) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let blocks = [...doc.querySelectorAll('main > div > div[class]')];
  if (!blocks.length) blocks = [...doc.querySelectorAll('table')];
  ui.selectedBlock = selection?.blockIndex === null || selection?.blockIndex === undefined
    ? null : blocks[selection.blockIndex] || null;
  renderSelectionBanner();
}

async function insert() {
  const { actions } = ui.sdk || {};
  const html = toBlockTable(state);
  if (!actions?.sendHTML) {
    await navigator.clipboard?.writeText(html).catch(() => {});
    toast('Abre el constructor desde la Library de DA para insertar. Bloque copiado al portapapeles.', 'warning');
    return;
  }
  if (ui.editingSelection) {
    const result = await actions.sendHTML(html, { replace: true });
    if (result?.ok) {
      toast('Formulario actualizado en el documento ✓', 'success');
      localStorage.removeItem(ui.draftKey);
      return;
    }
    toast('Este editor no permite reemplazar el bloque: se insertará uno nuevo. Elimina el anterior.', 'warning');
  }
  actions.sendHTML(html);
  localStorage.removeItem(ui.draftKey);
  toast('Formulario insertado ✓', 'success');
  setTimeout(() => actions.closeLibrary?.(), 900);
}

async function copyBlock() {
  try {
    const html = toBlockTable(state);
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([html], { type: 'text/plain' }),
    })]);
    toast('Bloque copiado: pégalo en el documento', 'success');
  } catch (e) {
    toast('No se pudo copiar al portapapeles', 'error');
  }
}

async function connectSdk() {
  const timeout = new Promise((resolve) => { setTimeout(() => resolve(null), 2500); });
  const sdk = await Promise.race([DA_SDK, timeout]);
  if (!sdk) {
    document.body.classList.add('is-standalone');
    return;
  }
  ui.sdk = sdk;
  const { org, repo, path } = sdk.context || {};
  if (org) ui.draftKey = `form-builder:${org}/${repo}${path || ''}`;
  try {
    sdk.actions.subscribeLiveDocument?.(onLiveDocument);
  } catch (e) {
    // el host no soporta documento en vivo: solo inserción
  }
}

/* ------------------------------------------------------------------- init */

function setView(view) {
  document.querySelector('.fb-layout').dataset.view = view;
  $('tab-edit').setAttribute('aria-selected', String(view === 'edit'));
  $('tab-preview').setAttribute('aria-selected', String(view === 'preview'));
}

(async function init() {
  renderPalette();
  renderViewport();
  new ResizeObserver(fitPreview).observe($('stage'));
  $('open-templates').addEventListener('click', openTemplates);
  $('simulate').addEventListener('change', renderPreview);
  $('insert').addEventListener('click', insert);
  $('copy').addEventListener('click', copyBlock);
  $('tab-edit').addEventListener('click', () => setView('edit'));
  $('tab-preview').addEventListener('click', () => setView('preview'));
  $('payload-close').addEventListener('click', () => { $('payload').hidden = true; });

  window.addEventListener('message', ({ data, source }) => {
    if (data?.type !== 'form-builder:submit' || source !== $('preview').contentWindow) return;
    $('payload').hidden = false;
    $('payload-json').textContent = `${data.method} ${data.url}${data.simulated ? '  (simulado)' : ''}\n\n${JSON.stringify(data.body, null, 2)}`;
  });

  await connectSdk();

  const draft = loadDraft();
  if (draft) {
    applyState(draft);
    toast('Borrador recuperado');
  } else {
    applyState(TEMPLATES.find((t) => t.id === 'blank').build());
    openTemplates();
  }
}());
