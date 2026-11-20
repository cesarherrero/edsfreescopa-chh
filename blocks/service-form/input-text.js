/*
 * Input Text (campo hijo de service-form)
 *
 * Celdas de la fila, en orden:
 *  1. type               text | email | tel | number | url | date | password | textarea
 *  2. name               nombre del campo enviado al servicio (si vacío, se deriva de label)
 *  3. label              etiqueta visible
 *  4. placeholder
 *  5. required           true / false
 *  6. pattern            expresión regular de validación (opcional)
 *  7. requiredMessage    mensaje cuando es obligatorio y está vacío
 *  8. validationMessage  mensaje cuando el valor no es válido
 */
import {
  cellText, isTruthy, toName, createFieldWrapper, setFieldError, appendRequiredMark,
} from './field-utils.js';

export const TEXT_TYPES = ['text', 'email', 'tel', 'number', 'url', 'date', 'password', 'textarea'];

const DEFAULT_PATTERNS = {
  tel: '^\\+?[0-9\\s\\-\\(\\)]{6,20}$',
};

const DEFAULT_MESSAGES = {
  required: 'Este campo es obligatorio.',
  email: 'Introduce un email válido.',
  tel: 'Introduce un teléfono válido.',
  url: 'Introduce una URL válida.',
  number: 'Introduce un número válido.',
  date: 'Introduce una fecha válida.',
  invalid: 'El valor introducido no es válido.',
};

export function buildInputText(cells, index) {
  const type = cellText(cells[0]).toLowerCase();
  const label = cellText(cells[2]);
  const name = toName(cellText(cells[1]) || label, `field-${index + 1}`);
  const placeholder = cellText(cells[3]);
  const required = isTruthy(cells[4]);
  const pattern = cellText(cells[5]) || DEFAULT_PATTERNS[type] || '';
  const requiredMessage = cellText(cells[6]);
  const validationMessage = cellText(cells[7]);

  const id = `service-form-${name}-${index}`;
  const { wrapper, error, errorId } = createFieldWrapper('input-text', type, id);
  wrapper.dataset.requiredMessage = requiredMessage
    || validationMessage || DEFAULT_MESSAGES.required;
  wrapper.dataset.validationMessage = validationMessage
    || DEFAULT_MESSAGES[type] || DEFAULT_MESSAGES.invalid;

  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent = label || name;
  if (required) appendRequiredMark(labelEl);

  const control = document.createElement(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') control.type = type;
  else control.rows = 4;
  control.id = id;
  control.name = name;
  if (placeholder) control.placeholder = placeholder;
  if (required) control.required = true;
  if (pattern && type !== 'textarea') control.pattern = pattern;
  if (pattern && type === 'textarea') wrapper.dataset.pattern = pattern;
  control.setAttribute('aria-describedby', errorId);
  const autocomplete = { email: 'email', tel: 'tel', url: 'url' }[type];
  if (autocomplete) control.autocomplete = autocomplete;
  if (type === 'tel') control.inputMode = 'tel';

  wrapper.append(labelEl, control, error);
  return wrapper;
}

export function validateInputText(wrapper) {
  const control = wrapper.querySelector('input, textarea');
  const value = control.value.trim();
  let message = '';

  if (control.required && !value) {
    message = wrapper.dataset.requiredMessage;
  } else if (value) {
    let valid = control.checkValidity();
    if (valid && wrapper.dataset.pattern) {
      try {
        valid = new RegExp(wrapper.dataset.pattern).test(value);
      } catch (e) {
        valid = true; // patrón mal configurado: no bloquear el envío
      }
    }
    if (!valid) message = wrapper.dataset.validationMessage;
  }
  return setFieldError(wrapper, message, [control]);
}
