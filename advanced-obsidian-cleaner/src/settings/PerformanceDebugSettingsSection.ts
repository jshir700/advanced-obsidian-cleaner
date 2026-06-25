import { Setting, Notice } from 'obsidian';
import type FileCleanerPlugin from '../index';

export class PerformanceDebugSettingsSection {
  constructor(
    private plugin: FileCleanerPlugin,
    private containerEl: HTMLElement,
    private refreshDisplay: () => void
  ) {}

  addPerformanceDebugSettings(): void {
    this.containerEl.createEl('h3', { text: '⚡ Performance' });

    this.addRuleEvaluationCacheSetting();
    this.addVaultIndexCacheSetting();
    this.addPerformanceDebugLogsSetting();
    this.addExportTraceButton();
  }

  private addRuleEvaluationCacheSetting(): void {
    new Setting(this.containerEl)
      .setName('Enable rule evaluation cache')
      .setDesc('Cache rule evaluation results so unchanged files are not re-evaluated on every run.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableRuleEvaluationCache ?? true)
          .onChange(async value => {
            this.plugin.settings.enableRuleEvaluationCache = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private addVaultIndexCacheSetting(): void {
    new Setting(this.containerEl)
      .setName('Enable vault index cache')
      .setDesc('Caches file lists and derived indices from markdown. Turn off to always scan fresh (useful for debugging).')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableVaultIndexCache !== false)
          .onChange(async value => {
            this.plugin.settings.enableVaultIndexCache = value;
            await this.plugin.saveSettings();
            this.refreshDisplay();
          })
      );
  }

  private addPerformanceDebugLogsSetting(): void {
    new Setting(this.containerEl)
      .setName('Enable performance debug logs')
      .setDesc('Logs timing spans to the developer console. Disable when not profiling.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enablePerformanceDebug === true)
          .onChange(async value => {
            this.plugin.settings.enablePerformanceDebug = value;
            await this.plugin.saveSettings();
            this.refreshDisplay();
          })
      );
  }

  private addExportTraceButton(): void {
    const debugOn = this.plugin.settings.enablePerformanceDebug === true;

    new Setting(this.containerEl)
      .setName('Export performance trace')
      .setDesc(debugOn
        ? 'Writes recorded timings as JSON to a file in your vault.'
        : 'Turn on performance debug logs first to record timings.')
      .addButton(btn =>
        btn
          .setButtonText('Export trace JSON')
          .setDisabled(!debugOn)
          .onClick(async () => {
            if (this.plugin.settings.enablePerformanceDebug !== true) {
              new Notice('Enable performance debug logs first.');
              return;
            }
            new Notice('Trace export not yet implemented.');
          })
      );
  }
}
