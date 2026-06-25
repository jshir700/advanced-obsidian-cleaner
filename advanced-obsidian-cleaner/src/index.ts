import { Plugin, TFile } from 'obsidian';
import type { FileCleanerSettings } from './settings';
import { DEFAULT_SETTINGS, FileCleanerSettingTab } from './settings';
import {
  scanVault,
  runCleanup,
} from './util';
import translate from './i18n';
import { notify } from './helpers/helpers';
import { NotificationType } from './enums';

export default class FileCleanerPlugin extends Plugin {
  settings: FileCleanerSettings;

  async onload() {
    await this.loadSettings();

    // Add ribbon icon
    this.addRibbonIcon(
      'trash',
      translate().Buttons.CleanFiles,
      this.runVaultCleanup
    );

    // Add command
    this.addCommand({
      id: 'clean-files',
      name: translate().Buttons.CleanFiles,
      callback: this.runVaultCleanup,
    });

    // Add settings tab
    this.addSettingTab(new FileCleanerSettingTab(this.app, this));

    // Run on startup
    if (this.settings.runOnStartup) {
      setTimeout(() => this.runVaultCleanup(), 1000);
    }

    // On-edit trigger
    if (this.settings.enableOnEditTrigger) {
      this.registerEvent(
        this.app.vault.on('modify', async (file: TFile) => {
          if (file.extension !== 'md') return;
          // Only process markdown files on edit
          console.debug('[AO Cleaner] On-edit triggered for:', file.path);
        })
      );
    }

    // Periodic clean
    if (this.settings.enablePeriodicClean) {
      this.startPeriodicClean();
    }
  }

  onunload() {
    // Stop periodic clean
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = null;
    }
  }

  private periodicInterval: number | null = null;

  private startPeriodicClean(): void {
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
    }
    const interval = this.settings.periodicCleanInterval * 60 * 1000;
    this.periodicInterval = window.setInterval(() => {
      void this.runVaultCleanup();
    }, interval);
  }

  private runVaultCleanup = async () => {
    try {
      const { filesToRemove, foldersToRemove } = await scanVault(
        this.app,
        this.settings
      );

      await runCleanup(filesToRemove, foldersToRemove, this.app, this.settings);

      // Record history
      if (filesToRemove.length > 0 || foldersToRemove.length > 0) {
        this.settings.history.push({
          timestamp: Date.now(),
          operationType: 'single',
          filesDeleted: filesToRemove.map(f => f.path),
          foldersDeleted: foldersToRemove.map(f => f.path),
          matchedRules: [],
        });
        await this.saveSettings();
      }
    } catch (error) {
      notify(
        translate().Notifications.UnexpectedErrorOccurred,
        NotificationType.Error
      );
      throw error;
    }
  };

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
