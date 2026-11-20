/*
 * Service Form Block
 * Formulario contenedor que envía los datos a un servicio (endpoint) configurable.
 *
 * Estructura de autoría (cada línea es una fila del bloque):
 *
 *  Filas de configuración (2 celdas, clave | valor):
 *    action   | https://api.example.com/contact   (URL del servicio, obligatorio)
 *    method   | POST                              (POST | GET | PUT, por defecto POST)
 *    columns  | 2                                 (1-4, también vía clase columns-N)
 *    submit   | Enviar                            (texto del botón)
 *    success  | ¡Gracias! Hemos recibido tus datos
 *    error    | No se pudo enviar el formulario
 *
 *  Filas de campo: la primera celda es el tipo de campo.
 *    - Input text    -> input-text.js (text, email, tel, number, url, date, password, textarea)
 *    - Input options -> ver input-options.js (checkbox, radio, switch)
 */
import { moveInstrumentation } from '../../scripts/scripts.js';
import { cellText } from './field-utils.js';
import { TEXT_TYPES, buildInputText, validateInputText } from './input-text.js';
import { OPTION_TYPES, buildInputOptions, validateInputOptions } from './input-options.js';

const CONFIG_KEYS = ['action', 'method', 'columns', 'submit', 'success', 'error'];
const ALLOWED_METHODS = ['POST', 'GET', 'PUT'];

const toKey = (text) => text.toLowerCase().replace(/[^a-z]/g, '');

function getLinkOrText(cell) {
  const a = cell?.querySelector('a[href]');
  return a ? a.getAttribute('href') : cellText(cell);
}

function readConfig(rows) {
  const config = {};
  const fieldRows = [];
  rows.forEach((row) => {
    const cells = [...row.children];
    const key = toKey(cellText(cells[0]));
    if (cells.length === 2 && CONFIG_KEYS.includes(key)) {
      config[key] = key === 'action' ? getLinkOrText(cells[1]) : cellText(cells[1]);
    } else {
      fieldRows.push(row);
    }
  });
  return { config, fieldRows };
}

function resolveColumns(block, config) {
  const fromClass = [...block.classList]
    .map((c) => c.match(/^columns-(\d)$/))
    .find(Boolean);
  const value = parseInt(fromClass ? fromClass[1] : config.columns, 10);
  return Number.isInteger(value) && value >= 1 && value <= 4 ? value : 1;
}

function buildField(row, index) {
  const cells = [...row.children];
  const type = cellText(cells[0]).toLowerCase();
  let field = null;
  if (TEXT_TYPES.includes(type)) field = buildInputText(cells, index);
  else if (OPTION_TYPES.includes(type)) field = buildInputOptions(cells, index);
  if (field) moveInstrumentation(row, field);
  return field;
}

function validateField(field) {
  if (field.classList.contains('input-options')) return validateInputOptions(field);
  return validateInputText(field);
}

function serialize(form) {
  const data = {};
  const formData = new FormData(form);
  formData.forEach((value, key) => {
    if (key in data) {
      data[key] = [].concat(data[key], value);
    } else {
      data[key] = value;
    }
  });
  // checkbox groups: always send an array, even with a single value
  form.querySelectorAll('.input-options[data-multiple="true"]').forEach((group) => {
    const { name } = group.dataset;
    if (name in data) data[name] = [].concat(data[name]);
    else data[name] = [];
  });
  // single switches/checkboxes: send boolean
  form.querySelectorAll('.input-options[data-single="true"] input').forEach((input) => {
    data[input.name] = input.checked;
  });
  return data;
}

async function send(config, data) {
  const method = ALLOWED_METHODS.includes(config.method?.toUpperCase())
    ? config.method.toUpperCase() : 'POST';
  let url = config.action;
  const init = { method, headers: { Accept: 'application/json' } };
  if (method === 'GET') {
    const params = new URLSearchParams();
    Object.entries(data).forEach(([k, v]) => [].concat(v).forEach((x) => params.append(k, x)));
    url += (url.includes('?') ? '&' : '?') + params.toString();
  } else {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(data);
  }
  const resp = await fetch(url, init);
  if (!resp.ok) throw new Error(`Service responded ${resp.status}`);
  return resp;
}

export default function decorate(block) {
  const { config, fieldRows } = readConfig([...block.children]);
  const columns = resolveColumns(block, config);

  const form = document.createElement('form');
  form.noValidate = true;
  form.className = 'service-form-form';

  const grid = document.createElement('div');
  grid.className = 'service-form-fields';
  grid.style.setProperty('--service-form-columns', columns);
  block.dataset.columns = columns;

  fieldRows.forEach((row, i) => {
    const field = buildField(row, i);
    if (field) grid.append(field);
  });

  const actions = document.createElement('div');
  actions.className = 'service-form-actions';
  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'button';
  button.textContent = config.submit || 'Enviar';
  actions.append(button);

  const status = document.createElement('div');
  status.className = 'service-form-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  form.append(grid, actions, status);

  // live re-validation once a field has been touched
  form.addEventListener('focusout', (e) => {
    const field = e.target.closest('.service-form-field');
    if (field && !field.contains(e.relatedTarget)) {
      field.dataset.touched = 'true';
      validateField(field);
    }
  });
  const revalidate = (e) => {
    const field = e.target.closest('.service-form-field');
    if (field?.dataset.touched === 'true') validateField(field);
  };
  form.addEventListener('input', revalidate);
  form.addEventListener('change', revalidate);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.className = 'service-form-status';

    const fields = [...form.querySelectorAll('.service-form-field')];
    const invalid = fields.filter((field) => {
      field.dataset.touched = 'true';
      return !validateField(field);
    });
    if (invalid.length) {
      invalid[0].querySelector('input, textarea, select')?.focus();
      return;
    }

    if (!config.action) {
      status.textContent = 'Formulario sin servicio configurado (action).';
      status.classList.add('is-error');
      return;
    }

    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      await send(config, serialize(form));
      status.textContent = config.success || 'Formulario enviado correctamente.';
      status.classList.add('is-success');
      form.reset();
      fields.forEach((field) => { delete field.dataset.touched; });
      form.dispatchEvent(new CustomEvent('service-form:success', { bubbles: true }));
    } catch (err) {
      status.textContent = config.error || 'Se ha producido un error al enviar el formulario.';
      status.classList.add('is-error');
      form.dispatchEvent(new CustomEvent('service-form:error', { bubbles: true, detail: err }));
    } finally {
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });

  block.textContent = '';
  block.append(form);
}
