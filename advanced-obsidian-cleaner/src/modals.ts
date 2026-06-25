import { App, ButtonComponent, Modal } from "obsidian";

export class ConfirmationModal extends Modal {
  title: string;
  content: HTMLElement;
  onConfirm: () => void;

  constructor(app: App, title: string, content: HTMLElement, onConfirm: () => void) {
    super(app);
    this.title = title;
    this.content = content;
    this.onConfirm = onConfirm;
  }
  onOpen(): void {
    this.titleEl.innerText = this.title;
    const contentContainer = this.contentEl.createDiv();
    contentContainer.append(this.content);
    const buttonContainer = this.contentEl.createDiv();
    buttonContainer.setCssStyles({ cssFloat: "right", display: "flex", gap: "0.5em" });
    new ButtonComponent(buttonContainer)
      .setButtonText("Confirm")
      .setWarning()
      .onClick(() => { this.onConfirm?.(); this.close(); });
    new ButtonComponent(buttonContainer)
      .setButtonText("Cancel")
      .onClick(() => { this.close(); });
  }
}

interface ResetSettingsModalProps {
  app: App;
  onConfirm?: () => void;
}

export function ResetSettingsModal({ app, onConfirm }: ResetSettingsModalProps) {
  const modal = new ConfirmationModal(
    app,
    "Reset Settings",
    createEl("p", { text: "Are you sure you want to reset all settings to defaults?" }),
    onConfirm || (() => {})
  );
  modal.open();
}
