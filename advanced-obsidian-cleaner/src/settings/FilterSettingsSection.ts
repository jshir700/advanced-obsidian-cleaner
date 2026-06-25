import { App, Modal, Setting } from 'obsidian';
import type FileCleanerPlugin from '../index';
import { DEFAULT_SETTINGS } from '../settings';

class ExtensionInputModal extends Modal {
  private onSubmit: (value: string) => void;

  constructor(app: App, private title: string, onSubmit: (value: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    this.titleEl.setText(this.title);
    const { contentEl } = this;

    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Enter the extension (without dot):',
    });

    const input = contentEl.createEl('input', {
      type: 'text',
      cls: 'aoc-extension-input',
    });
    input.placeholder = 'e.g. jpg, png';

    new Setting(contentEl)
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(btn =>
        btn.setButtonText('Add').setCta().onClick(() => {
          const val = input.value.trim();
          if (val) {
            this.onSubmit(val);
            this.close();
          }
        })
      );

    setTimeout(() => { input.focus(); input.select(); }, 100);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class FilterSettingsSection {
  constructor(
    private plugin: FileCleanerPlugin,
    private containerEl: HTMLElement,
    private refreshDisplay: () => void
  ) {}

  addFilterSettings(): void {
    this.containerEl.createEl('h3', { text: '🚫 Filters' });
    this.addFileTypeCategories();
  }

  private addFileTypeCategories(): void {
    this.containerEl.createEl('h4', { text: 'File Type Categories' });

    const categories = this.plugin.settings.fileTypeCategories;
    const defaults = DEFAULT_SETTINGS.fileTypeCategories;

    this.renderCategorySetting('Image', categories.image, defaults.image);
    this.renderCategorySetting('Video', categories.video, defaults.video);
    this.renderCategorySetting('Audio', categories.audio, defaults.audio);
    this.renderCategorySetting('Document', categories.document, defaults.document);
    this.renderCategorySetting('Archive', categories.archive, defaults.archive);
  }

  private getCategoryKey(categoryName: string): keyof typeof this.plugin.settings.fileTypeCategories {
    return categoryName.toLowerCase() as keyof typeof this.plugin.settings.fileTypeCategories;
  }

  private async addExtension(categoryName: string, ext: string): Promise<void> {
    const key = this.getCategoryKey(categoryName);
    const arr = this.plugin.settings.fileTypeCategories[key];
    if (arr && !arr.includes(ext.toLowerCase())) {
      arr.push(ext.toLowerCase());
      await this.plugin.saveSettings();
    }
  }

  private renderCategorySetting(name: string, extensions: string[], defaults: string[]): void {
    const container = this.containerEl.createDiv({ cls: 'aoc-category-container' });

    // Header row: category name + add button
    const header = container.createDiv({ cls: 'aoc-category-header' });
    header.createEl('strong', { text: name });
    const addBtn = header.createEl('button', { cls: 'aoc-category-add-btn-inline', text: '+ add' });
    addBtn.onclick = () => {
      new ExtensionInputModal(this.plugin.app, `Add extension for ${name}`, async (ext) => {
        await this.addExtension(name, ext);
        this.refreshDisplay();
      }).open();
    };

    // Description
    container.createEl('p', {
      cls: 'aoc-category-description',
      text: 'Check/uncheck to include/exclude from cleanup matching.'
    });

    // Chips row
    const extContainer = container.createDiv({ cls: 'aoc-category-exts' });

    extensions.forEach(ext => {
      const chip = extContainer.createDiv({ cls: 'aoc-category-ext-chip' });

      const checkbox = chip.createEl('input', {
        type: 'checkbox',
        cls: 'aoc-ext-checkbox',
      });
      checkbox.checked = true;
      checkbox.title = `Toggle .${ext}`;

      checkbox.onchange = async () => {
        if (!checkbox.checked) {
          // Uncheck: remove from array
          const catKey = this.getCategoryKey(name);
          const arr = this.plugin.settings.fileTypeCategories[catKey];
          if (arr) {
            const idx = arr.indexOf(ext);
            if (idx > -1) arr.splice(idx, 1);
            await this.plugin.saveSettings();
            this.refreshDisplay();
          }
        } else {
          // Re-check: only allow adding back default extensions
          const catKey = this.getCategoryKey(name);
          const arr = this.plugin.settings.fileTypeCategories[catKey];
          const defArr = DEFAULT_SETTINGS.fileTypeCategories[
            this.getCategoryKey(name)
          ];
          if (arr && defArr && defArr.includes(ext) && !arr.includes(ext)) {
            arr.push(ext);
            await this.plugin.saveSettings();
            this.refreshDisplay();
          } else {
            // Non-default extension: re-check the checkbox
            checkbox.checked = true;
          }
        }
      };

      const label = chip.createSpan({ cls: 'aoc-ext-label' });
      label.textContent = `.${ext}`;
    });
  }
}
