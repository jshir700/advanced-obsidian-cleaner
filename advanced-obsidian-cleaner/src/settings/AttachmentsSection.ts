import { App, Setting } from 'obsidian';
import type FileCleanerPlugin from '../index';

export class AttachmentsSection {
  constructor(
    private plugin: FileCleanerPlugin,
    private containerEl: HTMLElement,
    private refreshDisplay: () => void
  ) {}

  addAttachmentsSettings(): void {
    this.containerEl.createEl('h3', { text: '📎 Attachments' });

    this.addDeleteAttachmentsWithNoteSetting();
    this.addSkipSharedAttachmentsSetting();
    this.addDeleteEmptyAssetFoldersSetting();
    this.addExcalidrawSetting();
  }

  private addDeleteAttachmentsWithNoteSetting(): void {
    new Setting(this.containerEl)
      .setName('Delete attachments with note')
      .setDesc('When a note is deleted, also delete its referenced attachments if they are no longer referenced by other notes.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.attachments.deleteAttachmentsWithNote)
          .onChange(async value => {
            this.plugin.settings.attachments.deleteAttachmentsWithNote = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private addSkipSharedAttachmentsSetting(): void {
    new Setting(this.containerEl)
      .setName('Skip shared attachments')
      .setDesc('Do not delete attachment files that are referenced by two or more notes. Prevents breaking references elsewhere in the vault.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.attachments.skipSharedAttachments)
          .onChange(async value => {
            this.plugin.settings.attachments.skipSharedAttachments = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private addDeleteEmptyAssetFoldersSetting(): void {
    const setting = new Setting(this.containerEl)
      .setName('Delete empty asset folders')
      .setDesc('After deleting attachments, remove source folders (such as _assets) that no longer contain any files.');

    setting.addToggle(toggle =>
      toggle
        .setValue(this.plugin.settings.attachments.deleteEmptyAssetFolders)
        .onChange(async value => {
          this.plugin.settings.attachments.deleteEmptyAssetFolders = value;
          await this.plugin.saveSettings();
          this.refreshDisplay();
        })
    );

    if (this.plugin.settings.attachments.deleteEmptyAssetFolders) {
      const depthSetting = new Setting(this.containerEl)
        .setName('Asset folders check depth')
        .setDesc('How many levels of parent folders to check for emptiness. 0 = only check the immediate folder. 1 = also check the parent folder, etc.');

      depthSetting.addText(text =>
        text
          .setPlaceholder('0')
          .setValue(String(this.plugin.settings.attachments.assetFoldersCheckDepth))
          .onChange(async value => {
            const depth = parseInt(value);
            if (!isNaN(depth) && depth >= 0) {
              this.plugin.settings.attachments.assetFoldersCheckDepth = depth;
              await this.plugin.saveSettings();
            }
          })
      );
    }
  }

  private addExcalidrawSetting(): void {
    new Setting(this.containerEl)
      .setName('Treat Excalidraw files as attachments')
      .setDesc('If the Excalidraw plugin is installed, treat .excalidraw files as attachments for cleanup purposes.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.ExternalPlugins.Excalidraw.TreatAsAttachments)
          .onChange(async value => {
            this.plugin.settings.ExternalPlugins.Excalidraw.TreatAsAttachments = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
