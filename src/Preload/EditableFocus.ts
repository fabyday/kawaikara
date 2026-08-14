import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../Common/IPC';

export function installEditableFocusReporter(): void {
  let lastValue: boolean | undefined;

  const report = () => {
    const editing =
      document.hasFocus() && isEditableElement(getDeepActiveElement());
    if (editing === lastValue) return;
    lastValue = editing;
    ipcRenderer.send(IPC_CHANNELS.overlay.editingChanged, editing);
  };

  const reportAfterFocusChange = () => queueMicrotask(report);
  window.addEventListener('focus', report, true);
  window.addEventListener('blur', reportAfterFocusChange, true);
  document.addEventListener('focusin', report, true);
  document.addEventListener('focusout', reportAfterFocusChange, true);
  document.addEventListener('DOMContentLoaded', report, { once: true });
  report();
}

function getDeepActiveElement(): Element | null {
  let activeElement: Element | null = document.activeElement;
  while (activeElement?.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }
  return activeElement;
}

function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return !element.disabled;
  }
  if (element instanceof HTMLInputElement) {
    return !element.disabled && !NON_EDITABLE_INPUT_TYPES.has(element.type);
  }
  if (element instanceof HTMLElement) {
    return (
      element.isContentEditable ||
      Boolean(element.closest('[contenteditable="true"]')) ||
      ['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(
        element.getAttribute('role') ?? '',
      )
    );
  }
  return false;
}

const NON_EDITABLE_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);
