import { Setting } from 'obsidian';
import type FileCleanerPlugin from '../index';

export class TriggerSettingsSection {
  constructor(
    private plugin: FileCleanerPlugin,
    private containerEl: HTMLElement,
    private refreshDisplay: () => void
  ) {}

  addTriggerSettings(): void {
    this.containerEl.createEl('h3', { text: '⚡ Triggers' });

    this.addOnEditTriggerSetting();
    this.addPeriodicCleanSetting();
  }

  private addOnEditTriggerSetting(): void {
    new Setting(this.containerEl)
      .setName('Enable on-edit trigger')
      .setDesc('Automatically check and clean the edited file when a file is modified. Only scans the modified file, not the entire vault.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableOnEditTrigger)
          .onChange(async value => {
            this.plugin.settings.enableOnEditTrigger = value;
            await this.plugin.saveSettings();
            this.refreshDisplay();
          })
      );
  }

  private addPeriodicCleanSetting(): void {
    new Setting(this.containerEl)
      .setName('Enable periodic clean')
      .setDesc('Automatically scan and clean the entire vault at regular intervals.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enablePeriodicClean)
          .onChange(async value => {
            this.plugin.settings.enablePeriodicClean = value;
            await this.plugin.saveSettings();
            this.refreshDisplay();
          })
      );

    if (this.plugin.settings.enablePeriodicClean) {
      new Setting(this.containerEl)
        .setName('Periodic clean interval')
        .setDesc('How often to run the periodic clean in minutes.')
        .addText(text =>
          text
            .setPlaceholder('30')
            .setValue(String(this.plugin.settings.periodicCleanInterval))
            .onChange(async value => {
              const interval = parseInt(value);
              if (!isNaN(interval) && interval > 0) {
                this.plugin.settings.periodicCleanInterval = interval;
                await this.plugin.saveSettings();
              }
            })
        )
        .addDropdown(dropdown =>
          dropdown.addOption('minutes', 'minutes')
            .setValue('minutes')
        );
    }
  }
}
