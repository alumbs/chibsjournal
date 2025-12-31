declare const Quill: any;

let isRegistered = false;

// Track previous checklist states to detect changes
let previousChecklistStates: Map<HTMLElement, string> = new Map();
let isProcessingCascade = false;

/**
 * Register checklist blot (placeholder - Quill 1.3.7 has built-in list:check support)
 */
export function registerChecklistBlot(): void {
  if (isRegistered) {
    return;
  }
  isRegistered = true;
}

// Track the last clicked LI element
let lastClickedLi: HTMLElement | null = null;

/**
 * Initialize checklist event handlers for a Quill instance.
 * Uses click event to track which item was clicked, then text-change to cascade.
 * @param quill - The Quill instance
 * @param onContentChange - Optional callback to notify when content changes (for save triggering)
 */
export function initializeChecklistHandlers(quill: any, onContentChange?: (html: string) => void): void {
  if (!quill || !quill.root) {
    return;
  }

  const editorContainer = quill.root as HTMLElement;

  // Capture initial states
  captureChecklistStates(editorContainer);

  // Track clicks on checklist items to know which one was clicked
  editorContainer.addEventListener('mousedown', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const li = target.closest('ul[data-checked] > li') as HTMLElement;
    if (li) {
      lastClickedLi = li;
    }
  });

  // Listen to Quill's text-change event
  quill.on('text-change', (delta: any, _oldDelta: any, source: string) => {
    if (isProcessingCascade) return;
    if (source !== 'user') return; // Only process user-initiated changes

    // Check if this is a list format change
    let hasListChange = false;
    if (delta && delta.ops) {
      for (const op of delta.ops) {
        if (op.attributes && (op.attributes.list === 'checked' || op.attributes.list === 'unchecked')) {
          hasListChange = true;
          break;
        }
      }
    }

    if (!hasListChange) return;

    // Small delay to let DOM update
    setTimeout(() => {
      // Use the last clicked LI if available
      if (!lastClickedLi || !editorContainer.contains(lastClickedLi)) {
        captureChecklistStates(editorContainer);
        return;
      }

      const clickedLi = lastClickedLi;
      const clickedUl = clickedLi.closest('ul[data-checked]') as HTMLElement;
      if (!clickedUl) {
        captureChecklistStates(editorContainer);
        return;
      }

      const currentState = clickedUl.getAttribute('data-checked');
      const indent = getIndentLevel(clickedLi);
      const checked = currentState === 'true';

      // Cascade to children
      isProcessingCascade = true;
      const cascadeCount = cascadeCheckToChildrenFromLi(editorContainer, clickedLi, indent, checked, quill);
      isProcessingCascade = false;

      // If we cascaded any items, notify the callback to trigger save
      if (cascadeCount > 0 && onContentChange) {
        const newHtml = quill.root.innerHTML;
        onContentChange(newHtml);
      }

      // Update states
      captureChecklistStates(editorContainer);

      // Clear the tracked LI
      lastClickedLi = null;
    }, 10);
  });
}

/**
 * Capture current checklist states for comparison
 */
function captureChecklistStates(editorContainer: HTMLElement): void {
  previousChecklistStates.clear();
  const allUls = editorContainer.querySelectorAll('ul[data-checked]') as NodeListOf<HTMLElement>;
  allUls.forEach(ul => {
    previousChecklistStates.set(ul, ul.getAttribute('data-checked') || 'false');
  });
}

/**
 * Get the indent level of a list item from its class
 */
function getIndentLevel(li: HTMLElement): number {
  for (let i = 1; i <= 9; i++) {
    if (li.classList.contains(`ql-indent-${i}`)) {
      return i;
    }
  }
  return 0;
}

/**
 * Cascade check state to child items starting from a specific clicked LI
 * @returns The number of items that were cascaded
 */
function cascadeCheckToChildrenFromLi(
  editorContainer: HTMLElement,
  clickedLi: HTMLElement,
  parentIndent: number,
  checked: boolean,
  quill: any
): number {
  // Get all checklist LI items in the editor, in document order
  const allChecklistLis = Array.from(editorContainer.querySelectorAll('ul[data-checked] > li')) as HTMLElement[];

  const clickedLiIndex = allChecklistLis.indexOf(clickedLi);
  if (clickedLiIndex === -1) {
    return 0;
  }

  let cascadeCount = 0;
  const newListValue = checked ? 'checked' : 'unchecked';
  const processedUls = new Set<HTMLElement>();

  // Find all subsequent LI elements that are children (higher indent)
  for (let i = clickedLiIndex + 1; i < allChecklistLis.length; i++) {
    const li = allChecklistLis[i];
    const liIndent = getIndentLevel(li);

    // If this item has higher indent, it's a child - cascade the check state
    if (liIndent > parentIndent) {
      // Use Quill's API to change the list format for this line
      const blot = Quill.find(li);
      if (blot) {
        const index = quill.getIndex(blot);

        // Use 'api' to update Quill's model (triggers save) but isProcessingCascade prevents recursion
        quill.formatLine(index, 1, 'list', newListValue, 'api');
        cascadeCount++;

        // Also update the parent UL's data-checked attribute for styling
        const liParentUl = li.closest('ul[data-checked]') as HTMLElement;
        if (liParentUl && !processedUls.has(liParentUl)) {
          liParentUl.setAttribute('data-checked', String(checked));
          processedUls.add(liParentUl);
        }
      }
    } else {
      // Reached an item at same or lower indent - stop cascading
      break;
    }
  }

  return cascadeCount;
}

/**
 * Toggle checklist format on the current selection.
 */
export function toggleChecklist(quill: any): void {
  const range = quill.getSelection();
  if (!range) return;

  const format = quill.getFormat(range);

  if (format.list === 'checked' || format.list === 'unchecked') {
    // Remove checklist format
    quill.format('list', false, 'user');
  } else {
    // Apply checklist format (unchecked by default)
    quill.format('list', 'unchecked', 'user');
  }
}
