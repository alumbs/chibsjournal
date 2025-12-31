import { ChecklistItem, ChecklistContainer } from './checklist-blot';

declare const Quill: any;

let isRegistered = false;

/**
 * Register the checklist Blot with Quill.
 * Must be called before any Quill instances are created.
 */
export function registerChecklistBlot(): void {
  if (isRegistered) {
    return;
  }

  // Register the custom blots
  Quill.register('formats/checklist-item', ChecklistItem, true);
  Quill.register('formats/checklist', ChecklistContainer, true);

  isRegistered = true;
  console.log('Checklist blot registered with Quill');
}

/**
 * Initialize checklist event handlers for a Quill instance.
 * Handles checkbox clicks and collapse toggle functionality.
 */
export function initializeChecklistHandlers(quill: any): void {
  const editorContainer = quill.root as HTMLElement;

  editorContainer.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Handle checkbox toggle
    if (target.classList.contains('ql-checklist-checkbox')) {
      e.preventDefault();
      e.stopPropagation();

      const checkbox = target as HTMLInputElement;
      const listItem = checkbox.closest('.ql-checklist-item') as HTMLElement;

      if (listItem) {
        const newChecked = !checkbox.checked;
        checkbox.checked = newChecked;
        listItem.setAttribute('data-checked', String(newChecked));

        // Trigger content change for auto-save
        quill.update('user');
      }
    }

    // Handle collapse toggle
    if (target.classList.contains('ql-checklist-collapse-btn')) {
      e.preventDefault();
      e.stopPropagation();

      const listItem = target.closest('.ql-checklist-item') as HTMLElement;
      if (listItem) {
        const isCollapsed = listItem.getAttribute('data-collapsed') === 'true';
        listItem.setAttribute('data-collapsed', String(!isCollapsed));

        // Trigger content change for auto-save
        quill.update('user');
      }
    }
  });

  // Prevent checkbox from capturing keyboard events
  editorContainer.addEventListener('keydown', (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('ql-checklist-checkbox') ||
        target.classList.contains('ql-checklist-collapse-btn')) {
      // Let the editor handle keyboard events
      e.stopPropagation();
    }
  });
}

/**
 * Toggle checklist format on the current selection.
 */
export function toggleChecklist(quill: any): void {
  const range = quill.getSelection();
  if (!range) return;

  const format = quill.getFormat(range);

  if (format['checklist-item']) {
    // Remove checklist format - convert to plain paragraph
    quill.format('checklist-item', false);
  } else {
    // Apply checklist format
    quill.format('checklist-item', { checked: false, collapsed: false });
  }
}
