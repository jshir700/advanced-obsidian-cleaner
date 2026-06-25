import { App, Setting } from 'obsidian';

interface TaggableSelectOptions {
  container: HTMLElement;
  placeholder: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  maxSelections?: number;
}

/**
 * A reusable taggable select component.
 * Users can select multiple values from a dropdown.
 * Selected values appear as removable chips.
 * Values not from the preset list disappear when deselected.
 */
export class TaggableSelect {
  private container: HTMLElement;
  private inputEl: HTMLInputElement;
  private dropdownEl: HTMLElement | null = null;
  private options: string[];
  private selectedValues: string[];
  private onChange: (values: string[]) => void;
  private maxSelections: number;
  private isOpen = false;
  private filterText = '';

  constructor(options: TaggableSelectOptions) {
    this.container = options.container;
    this.options = options.options;
    this.selectedValues = [...options.selectedValues];
    this.onChange = options.onChange;
    this.maxSelections = options.maxSelections ?? Infinity;

    this.createInput();
  }

  private createInput(): void {
    const setting = new Setting(this.container);
    setting.settingEl.addClass('advanced-obsidian-cleaner-taggable-select');

    this.inputEl = setting.controlEl.createEl('input', {
      type: 'text',
      cls: 'advanced-obsidian-cleaner-taggable-select-input',
    });
    this.inputEl.placeholder = setting.settingEl.getAttribute('data-name') || '';

    // Render initial chips
    this.renderChips();

    // Event listeners
    this.inputEl.addEventListener('focus', () => this.openDropdown());
    this.inputEl.addEventListener('blur', () => this.onBlur());
    this.inputEl.addEventListener('input', () => this.onInputChange());
    this.inputEl.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  private renderChips(): void {
    // Remove existing chips
    this.container.querySelectorAll('.advanced-obsidian-cleaner-taggable-select-chip').forEach(el => el.remove());

    for (const value of this.selectedValues) {
      const chip = this.container.createEl('span', {
        cls: 'advanced-obsidian-cleaner-taggable-select-chip',
      });
      chip.textContent = value;

      const removeBtn = chip.createEl('button', {
        cls: 'advanced-obsidian-cleaner-taggable-select-chip-remove',
      });
      removeBtn.innerHTML = '×';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        this.removeValue(value);
      };

      // Insert chip before input
      this.inputEl.parentNode?.insertBefore(chip, this.inputEl);
    }
  }

  private openDropdown(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.filterText = '';
    this.inputEl.value = '';

    this.dropdownEl = this.container.createDiv({
      cls: 'advanced-obsidian-cleaner-taggable-select-dropdown',
    });

    const filtered = this.options.filter(opt =>
      opt.toLowerCase().includes(this.filterText.toLowerCase())
    );

    for (const option of filtered) {
      const item = this.dropdownEl.createDiv({
        cls: 'advanced-obsidian-cleaner-taggable-select-option',
      });

      const isSelected = this.selectedValues.includes(option);
      if (isSelected) {
        item.addClass('is-selected');
        item.innerHTML = `✓ ${option}`;
      } else {
        item.textContent = option;
      }

      item.onclick = () => {
        if (isSelected) {
          this.removeValue(option);
        } else if (this.selectedValues.length < this.maxSelections) {
          this.addValue(option);
        }
      };

      this.dropdownEl.appendChild(item);
    }

    if (filtered.length === 0) {
      const empty = this.dropdownEl.createDiv({
        cls: 'advanced-obsidian-cleaner-taggable-select-empty',
      });
      empty.textContent = 'No matches';
    }
  }

  private closeDropdown(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.dropdownEl) {
      this.dropdownEl.remove();
      this.dropdownEl = null;
    }
  }

  private onBlur(): void {
    // Delay to allow click events to fire
    setTimeout(() => this.closeDropdown(), 150);
  }

  private onInputChange(): void {
    this.filterText = this.inputEl.value;
    if (this.isOpen) {
      this.closeDropdown();
      this.openDropdown();
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.isOpen && this.dropdownEl) {
        const firstOption = this.dropdownEl.querySelector('.advanced-obsidian-cleaner-taggable-select-option:not(.is-selected)');
        if (firstOption) {
          firstOption.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      }
    }
    if (e.key === 'Backspace' && this.selectedValues.length > 0 && this.inputEl.value === '') {
      this.removeValue(this.selectedValues[this.selectedValues.length - 1]);
    }
  }

  private addValue(value: string): void {
    if (!this.selectedValues.includes(value)) {
      this.selectedValues.push(value);
      this.onChange([...this.selectedValues]);
      this.renderChips();
    }
  }

  private removeValue(value: string): void {
    this.selectedValues = this.selectedValues.filter(v => v !== value);
    this.onChange([...this.selectedValues]);
    this.renderChips();
  }

  destroy(): void {
    this.closeDropdown();
  }
}
