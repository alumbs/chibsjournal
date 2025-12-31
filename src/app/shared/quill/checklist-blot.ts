declare const Quill: any;

const Block = Quill.import('blots/block');
const Container = Quill.import('blots/container');

export interface ChecklistValue {
  checked?: boolean;
  collapsed?: boolean;
  indent?: number;
}

/**
 * ChecklistItem Blot - represents a single checklist item
 * Renders as: <li class="ql-checklist-item" data-checked="false" data-collapsed="false">
 */
export class ChecklistItem extends Block {
  static blotName = 'checklist-item';
  static tagName = 'LI';
  static className = 'ql-checklist-item';

  static create(value: ChecklistValue | boolean = {}): HTMLElement {
    const node = super.create() as HTMLElement;

    // Handle both boolean (simple toggle) and object (full state) values
    const normalizedValue: ChecklistValue = typeof value === 'boolean'
      ? { checked: false, collapsed: false }
      : value;

    node.setAttribute('data-checked', String(normalizedValue.checked || false));
    node.setAttribute('data-collapsed', String(normalizedValue.collapsed || false));

    if (normalizedValue.indent) {
      node.setAttribute('data-indent', String(normalizedValue.indent));
      node.classList.add(`ql-indent-${normalizedValue.indent}`);
    }

    // Create collapse button (chevron indicator)
    const collapseBtn = document.createElement('span');
    collapseBtn.className = 'ql-checklist-collapse-btn';
    collapseBtn.setAttribute('contenteditable', 'false');

    // Create checkbox element
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ql-checklist-checkbox';
    checkbox.checked = normalizedValue.checked || false;
    checkbox.setAttribute('contenteditable', 'false');

    // Insert elements at the beginning of the node
    node.insertBefore(checkbox, node.firstChild);
    node.insertBefore(collapseBtn, node.firstChild);

    return node;
  }

  static formats(node: HTMLElement): ChecklistValue {
    return {
      checked: node.getAttribute('data-checked') === 'true',
      collapsed: node.getAttribute('data-collapsed') === 'true',
      indent: parseInt(node.getAttribute('data-indent') || '0', 10)
    };
  }

  format(name: string, value: any): void {
    if (name === 'checklist-item' || name === ChecklistItem.blotName) {
      if (value) {
        const normalizedValue: ChecklistValue = typeof value === 'boolean'
          ? { checked: false, collapsed: false }
          : value;

        this.domNode.setAttribute('data-checked', String(normalizedValue.checked || false));
        this.domNode.setAttribute('data-collapsed', String(normalizedValue.collapsed || false));

        const checkbox = this.domNode.querySelector('.ql-checklist-checkbox') as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = normalizedValue.checked || false;
        }
      }
    } else if (name === 'indent') {
      // Handle indentation for nesting
      const indentClasses = Array.from(this.domNode.classList)
        .filter((c: string) => c.startsWith('ql-indent-'));
      indentClasses.forEach((c: string) => this.domNode.classList.remove(c));

      if (value && value > 0) {
        this.domNode.classList.add(`ql-indent-${value}`);
        this.domNode.setAttribute('data-indent', String(value));
      } else {
        this.domNode.removeAttribute('data-indent');
      }
    } else {
      super.format(name, value);
    }
  }
}

/**
 * ChecklistContainer Blot - wraps checklist items in a <ul>
 */
export class ChecklistContainer extends Container {
  static blotName = 'checklist';
  static tagName = 'UL';
  static className = 'ql-checklist';
  static allowedChildren = [ChecklistItem];
  static defaultChild = ChecklistItem;
}

// Set up parent-child relationship for nesting support
ChecklistItem.allowedChildren = [ChecklistContainer];
