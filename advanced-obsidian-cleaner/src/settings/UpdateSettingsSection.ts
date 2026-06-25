import { Setting } from 'obsidian';
import type FileCleanerPlugin from '../index';

export class UpdateSettingsSection {
  constructor(
    private plugin: FileCleanerPlugin,
    private containerEl: HTMLElement
  ) {}

  addUpdateSettings(): void {
    this.containerEl.createEl('h3', { text: '🔄 Updates' });

    new Setting(this.containerEl)
      .setName('Show release notes after plugin update')
      .setDesc('When enabled, opens the changelog once after you install a newer plugin version.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showReleaseNotesOnUpdate !== false)
          .onChange(async value => {
            this.plugin.settings.showReleaseNotesOnUpdate = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
