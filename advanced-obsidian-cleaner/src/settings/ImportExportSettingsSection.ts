import { App, Notice, Setting } from 'obsidian';
import type FileCleanerPlugin from '../index';

export class ImportExportSettingsSection {
  constructor(
    private plugin: FileCleanerPlugin,
    private containerEl: HTMLElement,
    private refreshDisplay: () => void
  ) {}

  addImportExportSettings(): void {
    this.containerEl.createEl('h3', { text: '📥 Import/Export' });

    this.addExportButton();
    this.addImportButton();
  }

  private addExportButton(): void {
    new Setting(this.containerEl)
      .setName('Export settings')
      .setDesc('Export your current settings as a JSON file.')
      .addButton(btn =>
        btn
          .setButtonText('Export')
          .setCta()
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText('Exporting…');
            try {
              const settingsToExport = {
                settings: this.plugin.settings,
                lastSeenVersion: (this.plugin.settings as any).lastSeenVersion,
                schemaVersion: (this.plugin.settings as any).schemaVersion,
              };
              const jsonString = JSON.stringify(settingsToExport, null, 2);
              const blob = new Blob([jsonString], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `cleaner-settings-${new Date().toISOString().split('T')[0]}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              new Notice('Settings exported successfully.');
            } catch (error) {
              new Notice(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
              btn.setButtonText('Export');
              btn.setDisabled(false);
            }
          })
      );
  }

  private addImportButton(): void {
    new Setting(this.containerEl)
      .setName('Import settings')
      .setDesc('Import settings from a JSON file.')
      .addButton(btn =>
        btn
          .setButtonText('Import')
          .setWarning()
          .onClick(() => {
            btn.setDisabled(true);
            btn.setButtonText('Importing…');
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e: Event) => {
              const target = e.target as HTMLInputElement;
              if (target.files && target.files[0]) {
                try {
                  const fileContent = await target.files[0].text();
                  const importedSettings = JSON.parse(fileContent);
                  // Apply imported settings
                  if (importedSettings.settings) {
                    Object.assign(this.plugin.settings, importedSettings.settings);
                  }
                  if (importedSettings.lastSeenVersion) {
                    (this.plugin.settings as any).lastSeenVersion = importedSettings.lastSeenVersion;
                  }
                  if (importedSettings.schemaVersion) {
                    (this.plugin.settings as any).schemaVersion = importedSettings.schemaVersion;
                  }
                  await this.plugin.saveSettings();
                  this.refreshDisplay();
                  new Notice('Settings imported successfully.');
                } catch (error) {
                  new Notice(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
                }
              }
              btn.setButtonText('Import');
              btn.setDisabled(false);
            };
            input.click();
          })
      );
  }
}
