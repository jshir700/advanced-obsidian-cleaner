import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
  private resolvePromise: ((value: boolean) => void) | null = null;
  private modalTitle: string;
  private modalMessage: string;

  constructor(app: App, title: string, message: string) {
    super(app);
    this.modalTitle = title;
    this.modalMessage = message;
  }

  onOpen(): void {
    this.titleEl.setText(this.modalTitle);
    const { contentEl } = this;

    const msgEl = contentEl.createEl('p', { cls: 'aoc-confirm-message' });
    msgEl.textContent = this.modalMessage;

    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => {
          this.resolve(false);
        })
      )
      .addButton(btn =>
        btn.setButtonText('Delete').setWarning().setCta().onClick(() => {
          this.resolve(true);
        })
      );
  }

  private resolve(value: boolean): void {
    if (this.resolvePromise) {
      this.resolvePromise(value);
    }
    this.close();
  }

  confirm(): Promise<boolean> {
    return new Promise(resolve => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  static async show(app: App, title: string, message: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const modal = new ConfirmModal(app, title, message);
      modal.resolvePromise = resolve;
      modal.open();
    });
  }
}
