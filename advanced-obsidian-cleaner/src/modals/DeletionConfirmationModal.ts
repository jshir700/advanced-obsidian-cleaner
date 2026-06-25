import { App, Modal, TAbstractFile, Notice } from "obsidian";
import translate from "src/i18n";
import type { FileCleanerSettings } from "src/settings";

export class DeletionConfirmationModal extends Modal {
  filesAndFolders: TAbstractFile[] = [];
  settings: FileCleanerSettings;

  constructor({
    app,
    filesAndFolders,
    settings,
  }: {
    app: App;
    filesAndFolders: TAbstractFile[];
    settings: FileCleanerSettings;
  }) {
    super(app);

    this.filesAndFolders = filesAndFolders;
    this.settings = settings;

    this.modalEl.style.maxWidth = "90%";
  }

  async onOpen(): Promise<void> {
    this.titleEl.innerText = translate().Modals.DeletionConfirmation.Title;

    const { contentEl } = this;

    // Show list of files/folders
    const listDiv = contentEl.createDiv();
    listDiv.createEl('p', { text: `${translate().Modals.DeletionConfirmation.TotalCount.replace('{count}', String(this.filesAndFolders.length))}` });

    const ul = listDiv.createEl('ul');
    for (const item of this.filesAndFolders.slice(0, 100)) {
      ul.createEl('li', { text: item.path });
    }
    if (this.filesAndFolders.length > 100) {
      ul.createEl('li', { text: `... and ${this.filesAndFolders.length - 100} more` });
    }

    // Buttons
    const buttonContainer = contentEl.createDiv();
    buttonContainer.setCssStyles({
      cssFloat: "right",
      display: "flex",
      gap: "0.5em",
    });

    const cancelBtn = buttonContainer.createEl('button', { text: translate().Modals.ButtonCancel });
    cancelBtn.addEventListener('click', () => this.close());

    const confirmBtn = buttonContainer.createEl('button', { text: translate().Modals.ButtonConfirm });
    confirmBtn.addClass('mod-cta');
    confirmBtn.addEventListener('click', async () => {
      this.close();
      // Trigger the actual cleanup through the plugin
      console.log('Deletion confirmed for', this.filesAndFolders.length, 'items');
      new Notice('Cleanup initiated.');
    });
  }

  async onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
