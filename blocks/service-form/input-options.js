/*
 * Input Options (campo hijo de service-form)
 *
 * Celdas de la fila, en orden:
 *  1. type          checkbox | radio | switch
 *  2. name          nombre del campo enviado al servicio (si vacío, se deriva de label)
 *  3. label         etiqueta / título del grupo
 *  4. placeholder   texto de ayuda mostrado bajo la etiqueta
 *  5. options       una opción por línea o elemento de lista: "valor|Texto" o "Texto".
 *                   Vacío en checkbox/switch => un único control (p. ej. aceptar condiciones)
 *  6. required      true / false
 *  7. errorMessage  mensaje cuando es obligatorio y no se ha seleccionado nada
 */
import {
  cellText, isTruthy, toName, createFieldWrapper, setFieldError, appendRequiredMark,
} from './field-utils.js';

export const OPTION_TYPES = ['checkbox', 'radio', 'switch'];

const DEFAULT_MESSAGES = {
  checkbox: 'Selecciona al menos una opción.',
  radio: 'Selecciona una opción.',
  switch: 'Debes activar esta opción.',
  single: 'Debes aceptar esta opción.',
};

function parseOptions(cell) {
  if (!cell) return [];
  const items = cell.querySelectorAll('li');
  let lines;
  if (items.length) {
    lines = [...items].map((li) => li.textContent);
  } else if (cell.querySelector('p')) {
    lines = [...cell.querySelectorAll('p')].map((p) => p.textContent);
  } else {
    lines = cell.textContent.split(/\n|,/);
  }
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, text] = line.includes('|') ? line.split('|').map((s) => s.trim()) : [line, line];
      return { value: value || text, text: text || value };
    });
}

function createControl({
  type, name, id, value, text, required, errorId,
}) {
  const label = document.createElement('label');
  label.className = 'input-options-option';
  label.htmlFor = id;

  const input = document.createElement('input');
  input.type = type === 'radio' ? 'radio' : 'checkbox';
  input.id = id;
  input.name = name;
  input.value = value;
  if (required) input.required = true;
  if (type === 'switch') input.setAttribute('role', 'switch');
  input.setAttribute('aria-describedby', errorId);

  const span = document.createElement('span');
  span.className = 'input-options-text';
  span.textContent = text;

  label.append(input, span);
  return label;
}

export function buildInputOptions(cells, index) {
  const type = cellText(cells[0]).toLowerCase();
  const label = cellText(cells[2]);
  const name = toName(cellText(cells[1]) || label, `field-${index + 1}`);
  const placeholder = cellText(cells[3]);
  const options = parseOptions(cells[4]);
  const required = isTruthy(cells[5]);
  const errorMessage = cellText(cells[6]);

  const id = `service-form-${name}-${index}`;
  const { wrapper, error, errorId } = createFieldWrapper('input-options', type, id);
  wrapper.dataset.name = name;
  if (required) wrapper.dataset.required = 'true';

  const single = type !== 'radio' && options.length === 0;
  if (single) wrapper.dataset.single = 'true';
  if (type !== 'radio' && !single) wrapper.dataset.multiple = 'true';
  wrapper.dataset.errorMessage = errorMessage
    || (single ? DEFAULT_MESSAGES.single : DEFAULT_MESSAGES[type]);

  const hint = placeholder ? document.createElement('p') : null;
  if (hint) {
    hint.className = 'input-options-hint';
    hint.id = `${id}-hint`;
    hint.textContent = placeholder;
  }

  if (single) {
    // un único checkbox/switch: la etiqueta es el texto del propio control
    const control = createControl({
      type, name, id, value: 'true', text: label || name, required, errorId,
    });
    if (required) appendRequiredMark(control.querySelector('.input-options-text'));
    if (hint) {
      control.querySelector('input').setAttribute('aria-describedby', `${hint.id} ${errorId}`);
      wrapper.append(control, hint, error);
    } else {
      wrapper.append(control, error);
    }
    return wrapper;
  }

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'input-options-group';
  if (hint) fieldset.setAttribute('aria-describedby', hint.id);
  const legend = document.createElement('legend');
  legend.textContent = label || name;
  if (required) appendRequiredMark(legend);
  fieldset.append(legend);
  if (hint) fieldset.append(hint);

  const list = document.createElement('div');
  list.className = 'input-options-list';
  options.forEach((opt, i) => {
    list.append(createControl({
      type,
      name,
      id: `${id}-${i}`,
      value: opt.value,
      text: opt.text,
      // en grupos de checkbox el "obligatorio" se valida a mano (al menos uno)
      required: required && type === 'radio',
      errorId,
    }));
  });
  fieldset.append(list, error);
  wrapper.append(fieldset);
  return wrapper;
}

export function validateInputOptions(wrapper) {
  const inputs = [...wrapper.querySelectorAll('input')];
  const missing = wrapper.dataset.required === 'true' && !inputs.some((i) => i.checked);
  return setFieldError(wrapper, missing ? wrapper.dataset.errorMessage : '', inputs);
}
