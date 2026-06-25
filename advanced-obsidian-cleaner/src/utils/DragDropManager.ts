import { setIcon } from 'obsidian';
import translate from '../i18n';

const t = () => translate();

export interface DragDropOptions {
  onReorder: (fromIndex: number, toIndex: number) => void;
  onSave?: () => Promise<void>;
  itemSelector?: string;
  handleSelector?: string;
}

export class DragDropManager {
  private draggedElement: HTMLElement | null = null;
  private draggedIndex = -1;
  private container: HTMLElement;
  private options: DragDropOptions;

  private readonly onDragStartBound: (event: DragEvent) => void;
  private readonly onDragOverBound: (event: DragEvent) => void;
  private readonly onDropBound: (event: DragEvent) => void;
  private readonly onDragEndBound: (event: DragEvent) => void;
  private readonly onDragEnterBound: (event: DragEvent) => void;
  private readonly onDragLeaveBound: (event: DragEvent) => void;

  constructor(container: HTMLElement, options: DragDropOptions) {
    this.container = container;
    this.options = options;
    this.onDragStartBound = (e: DragEvent) => this.handleDragStart(e);
    this.onDragOverBound = (e: DragEvent) => this.handleDragOver(e);
    this.onDropBound = (e: DragEvent) => this.handleDrop(e);
    this.onDragEndBound = (e: DragEvent) => this.handleDragEnd(e);
    this.onDragEnterBound = (e: DragEvent) => this.handleDragEnter(e);
    this.onDragLeaveBound = (e: DragEvent) => this.handleDragLeave(e);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.container.addEventListener('dragstart', this.onDragStartBound);
    this.container.addEventListener('dragover', this.onDragOverBound);
    this.container.addEventListener('drop', this.onDropBound);
    this.container.addEventListener('dragend', this.onDragEndBound);
    this.container.addEventListener('dragenter', this.onDragEnterBound);
    this.container.addEventListener('dragleave', this.onDragLeaveBound);
  }

  private handleDragStart(event: DragEvent): void {
    const target = event.target as HTMLElement;
    const handle = target.closest(this.options.handleSelector || '.aoc-drag-handle');
    if (!handle) return;

    const item = target.closest(this.options.itemSelector || '.aoc-clean-rule-card');
    if (!item) return;

    this.draggedElement = item as HTMLElement;
    this.draggedIndex = this.getItemIndex(item as HTMLElement);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', this.draggedIndex.toString());
    }

    item.classList.add('aoc-dragging');
  }

  private handleDragOver(event: DragEvent): void {
    if (!this.draggedElement) return;

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const target = event.target as HTMLElement;
    const item = target.closest(this.options.itemSelector || '.aoc-clean-rule-card');

    if (!item || item === this.draggedElement) return;

    this.clearDragOverClasses();

    const rect = item.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const isAbove = event.clientY < midpoint;

    const targetIndex = this.getItemIndex(item as HTMLElement);
    const draggedIndex = this.getItemIndex(this.draggedElement);
    const newIndex = isAbove ? targetIndex : targetIndex + 1;

    if (newIndex === draggedIndex || newIndex === draggedIndex + 1) {
      return;
    }

    if (isAbove) {
      item.classList.add('aoc-drag-over-top');
    } else {
      item.classList.add('aoc-drag-over-bottom');
    }
  }

  private handleDrop(event: DragEvent): void {
    if (!this.draggedElement) return;

    event.preventDefault();

    const target = event.target as HTMLElement;
    const item = target.closest(this.options.itemSelector || '.aoc-clean-rule-card');

    if (!item || item === this.draggedElement) return;

    const targetIndex = this.getItemIndex(item as HTMLElement);

    const rect = item.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const isAbove = event.clientY < midpoint;

    const finalIndex = isAbove ? targetIndex : targetIndex + 1;

    if (
      this.draggedIndex !== finalIndex &&
      finalIndex !== this.draggedIndex + 1
    ) {
      this.options.onReorder(this.draggedIndex, finalIndex);

      if (this.options.onSave) {
        void this.options.onSave();
      }
    }

    this.clearDragOverClasses();
  }

  private handleDragEnd(event: DragEvent): void {
    if (this.draggedElement) {
      this.draggedElement.classList.remove('aoc-dragging');
    }

    this.clearDragOverClasses();
    this.draggedElement = null;
    this.draggedIndex = -1;
  }

  private handleDragEnter(event: DragEvent): void {
    if (!this.draggedElement) return;

    const target = event.target as HTMLElement;
    const item = target.closest(this.options.itemSelector || '.aoc-clean-rule-card');

    if (item && item !== this.draggedElement) {
      const targetIndex = this.getItemIndex(item as HTMLElement);
      const draggedIndex = this.getItemIndex(this.draggedElement);

      if (targetIndex !== draggedIndex && targetIndex !== draggedIndex + 1) {
        item.classList.add('aoc-drag-over');
      }
    }
  }

  private handleDragLeave(event: DragEvent): void {
    const target = event.target as HTMLElement;
    const item = target.closest(this.options.itemSelector || '.aoc-clean-rule-card');

    if (item && item !== this.draggedElement) {
      const rect = item.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;

      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        item.classList.remove(
          'aoc-drag-over',
          'aoc-drag-over-top',
          'aoc-drag-over-bottom'
        );
      }
    }
  }

  private getItemIndex(item: HTMLElement): number {
    const items = Array.from(
      this.container.querySelectorAll(
        this.options.itemSelector || '.aoc-clean-rule-card'
      )
    );
    return items.indexOf(item);
  }

  private clearDragOverClasses(): void {
    const items = this.container.querySelectorAll(
      '.aoc-drag-over, .aoc-drag-over-top, .aoc-drag-over-bottom'
    );
    items.forEach(item => {
      item.classList.remove(
        'aoc-drag-over',
        'aoc-drag-over-top',
        'aoc-drag-over-bottom'
      );
    });
  }

  public destroy(): void {
    this.container.removeEventListener('dragstart', this.onDragStartBound);
    this.container.removeEventListener('dragover', this.onDragOverBound);
    this.container.removeEventListener('drop', this.onDropBound);
    this.container.removeEventListener('dragend', this.onDragEndBound);
    this.container.removeEventListener('dragenter', this.onDragEnterBound);
    this.container.removeEventListener('dragleave', this.onDragLeaveBound);
  }

  public static createDragHandle(): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'aoc-drag-handle';
    handle.textContent = '⋮⋮';
    handle.setAttribute('draggable', 'true');
    handle.setAttribute('aria-label', t().Settings.CleanRules.DragToReorder);
    handle.setAttribute('title', t().Settings.CleanRules.DragToReorder);
    handle.setAttribute('role', 'button');
    handle.setAttribute('tabindex', '0');
    return handle;
  }
}
