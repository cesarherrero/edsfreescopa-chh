/* Utilidades compartidas por los campos del bloque service-form */

export const cellText = (cell) => (cell?.textContent || '').trim();

export function isTruthy(cell) {
  return ['true', 'yes', 'si', 'sí', '1', 'required', 'obligatorio', 'x']
    .includes(cellText(cell).toLowerCase());
}

export function toName(text, fallback) {
  const name = (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return name || fallback;
}

/**
 * Crea el contenedor de campo con su zona de error accesible.
 * @returns {{ wrapper: HTMLElement, error: HTMLElement, errorId: string }}
 */
export function createFieldWrapper(kind, type, id) {
  const wrapper = document.createElement('div');
  wrapper.className = `service-form-field ${kind} ${kind}-${type}`;
  const errorId = `${id}-error`;
  const error = document.createElement('p');
  error.className = 'service-form-field-error';
  error.id = errorId;
  error.hidden = true;
  return { wrapper, error, errorId };
}

export function setFieldError(wrapper, message, controls) {
  const error = wrapper.querySelector('.service-form-field-error');
  const invalid = Boolean(message);
  wrapper.classList.toggle('is-invalid', invalid);
  error.textContent = message || '';
  error.hidden = !invalid;
  controls.forEach((control) => {
    if (invalid) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  });
  return !invalid;
}

export function appendRequiredMark(label) {
  const mark = document.createElement('span');
  mark.className = 'service-form-required';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = ' *';
  label.append(mark);
}
