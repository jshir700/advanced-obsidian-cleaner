import { Setting } from 'obsidian';
import type FileCleanerPlugin from '../index';

export class HistorySettingsSection {
  constructor(
    private plugin: FileCleanerPlugin,
    private containerEl: HTMLElement
  ) {}

  addHistorySettings(): void {
    this.containerEl.createEl('h3', { text: '📜 History' });

    this.addRetentionPolicySettings();
    this.addClearHistoryButton();
  }

  private addRetentionPolicySettings(): void {
    const retentionPolicy = this.plugin.settings.retentionPolicy;

    new Setting(this.containerEl)
      .setName('Retention Policy')
      .setDesc('How long to keep cleanup history records.')
      .addText(text =>
        text
          .setPlaceholder('30')
          .setValue(retentionPolicy.value.toString())
          .onChange(async value => {
            const numValue = parseInt(value);
            if (!isNaN(numValue) && numValue > 0) {
              this.plugin.settings.retentionPolicy.value = numValue;
              await this.plugin.saveSettings();
            }
          })
      )
      .addDropdown(dropdown =>
        dropdown
          .addOption('days', 'days')
          .addOption('weeks', 'weeks')
          .addOption('months', 'months')
          .setValue(retentionPolicy.unit)
          .onChange(async value => {
            this.plugin.settings.retentionPolicy.unit = value as 'days' | 'weeks' | 'months';
            await this.plugin.saveSettings();
          })
      );
  }

  private addClearHistoryButton(): void {
    new Setting(this.containerEl)
      .setName('Clear history')
      .setDesc('Removes all cleanup history records.')
      .addButton(btn => {
        btn.setButtonText('Clear').setWarning().onClick(async () => {
          this.plugin.settings.history = [];
          await this.plugin.saveSettings();
        });
      });
  }
}
