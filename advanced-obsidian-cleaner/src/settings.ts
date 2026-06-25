import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import FileCleanerPlugin from '.';
import translate from './i18n';
import { Deletion, Notification } from './enums';
import { CleanRuleEditorModal } from './modals/CleanRuleEditorModal';
import { CleanRuleMatcher } from './engine/CleanRuleMatcher';
import type { CleanRule, CleanAction, AggregationType, CleanScope } from './types/CleanRule';
import { CleanRulesSection } from './settings/CleanRulesSection';
import { AttachmentsSection } from './settings/AttachmentsSection';
import { TriggerSettingsSection } from './settings/TriggerSettingsSection';
import { FilterSettingsSection } from './settings/FilterSettingsSection';
import { HistorySettingsSection } from './settings/HistorySettingsSection';
import { ImportExportSettingsSection } from './settings/ImportExportSettingsSection';
import { PerformanceDebugSettingsSection } from './settings/PerformanceDebugSettingsSection';
import { UpdateSettingsSection } from './settings/UpdateSettingsSection';

// ========================
// Settings Interface
// ========================
export interface FileCleanerSettings {
  // === Settings（触发方式 + 删除目标 + 预览 + 通知 + 启动）===
  enableOnEditTrigger: boolean;
  enablePeriodicClean: boolean;
  periodicCleanInterval: number;
  deletionDestination: Deletion;
  obsidianTrashCleanupAge: number;
  deletionConfirmation: boolean;
  closeNewTabs: boolean;
  notifications: Notification;
  runOnStartup: boolean;

  // === Filters ===
  filters: { value: string }[];
  fileTypeCategories: {
    image: string[];
    video: string[];
    audio: string[];
    document: string[];
    archive: string[];
  };

  // === Clean Rules ===
  cleanRules: CleanRule[];

  // === Attachments 模块 ===
  attachments: {
    deleteAttachmentsWithNote: boolean;
    skipSharedAttachments: boolean;
    deleteEmptyAssetFolders: boolean;
    assetFoldersCheckDepth: number;
  };

  // === External Plugins ===
  ExternalPlugins: {
    Excalidraw: {
      TreatAsAttachments: boolean;
    };
  };

  // === Performance ===
  enableRuleEvaluationCache: boolean;
  enableVaultIndexCache: boolean;
  enablePerformanceDebug: boolean;

  // === History ===
  history: HistoryEntry[];
  retentionPolicy: RetentionPolicy;

  // === Updates ===
  showReleaseNotesOnUpdate: boolean;

  // === Legacy/compatibility properties (used by helpers) ===
  codeblockTypes?: string[];
  attachmentExtensions?: string[];
  deleteEmptyMarkdownFiles?: boolean;
  deleteEmptyMarkdownFilesWithBacklinks?: boolean;
  ignoredFrontmatter?: string[];
  ignoreAllFrontmatter?: boolean;
  fileAgeThreshold?: number;
  lastSeenVersion?: string;
  schemaVersion?: string;
}

export interface HistoryEntry {
  timestamp: number;
  operationType: 'single' | 'periodic' | 'onEdit';
  filesDeleted: string[];
  foldersDeleted: string[];
  matchedRules: string[];
}

export interface RetentionPolicy {
  value: number;
  unit: 'days' | 'weeks' | 'months';
}

// ========================
// Default Settings
// ========================
export const DEFAULT_SETTINGS: FileCleanerSettings = {
  enableOnEditTrigger: false,
  enablePeriodicClean: false,
  periodicCleanInterval: 30,
  deletionDestination: Deletion.SystemTrash,
  obsidianTrashCleanupAge: -1,
  deletionConfirmation: true,
  closeNewTabs: false,
  notifications: Notification.ShowAll,
  runOnStartup: false,

  filters: [],
  fileTypeCategories: {
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'avif'],
    video: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv'],
    audio: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'wma', 'm4a', 'midi', 'opus'],
    document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'odt'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'dmg', 'iso'],
  },

  cleanRules: [],

  attachments: {
    deleteAttachmentsWithNote: false,
    skipSharedAttachments: true,
    deleteEmptyAssetFolders: false,
    assetFoldersCheckDepth: 0,
  },

  ExternalPlugins: {
    Excalidraw: {
      TreatAsAttachments: false,
    },
  },

  enableRuleEvaluationCache: true,
  enableVaultIndexCache: true,
  enablePerformanceDebug: false,

  history: [],
  retentionPolicy: { value: 30, unit: 'days' },

  showReleaseNotesOnUpdate: true,

  // Legacy/compatibility defaults
  codeblockTypes: [],
  attachmentExtensions: [],
  deleteEmptyMarkdownFiles: false,
  deleteEmptyMarkdownFilesWithBacklinks: false,
  ignoredFrontmatter: [],
  ignoreAllFrontmatter: false,
  fileAgeThreshold: 0,
  lastSeenVersion: '',
  schemaVersion: '',
};

// ========================
// Setting Tab
// ========================
export class FileCleanerSettingTab extends PluginSettingTab {
  plugin: FileCleanerPlugin;

  constructor(app: App, plugin: FileCleanerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // === Settings Section ===
    containerEl.createEl('h3', { text: '⚙️ Settings' });

    // Triggers
    new Setting(containerEl).setName('Triggers').setHeading();
    new Setting(containerEl)
      .setName('Enable on-edit trigger')
      .setDesc('Automatically check and clean modified files.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.enableOnEditTrigger)
          .onChange(async v => {
            this.plugin.settings.enableOnEditTrigger = v;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName('Enable periodic clean')
      .setDesc('Automatically scan and clean the entire vault at regular intervals.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.enablePeriodicClean)
          .onChange(async v => {
            this.plugin.settings.enablePeriodicClean = v;
            await this.plugin.saveSettings();
            this.display();
          })
      );
    if (this.plugin.settings.enablePeriodicClean) {
      new Setting(containerEl)
        .setName('Periodic clean interval')
        .setDesc('Interval in minutes.')
        .addText(text =>
          text.setPlaceholder('30')
            .setValue(String(this.plugin.settings.periodicCleanInterval))
            .onChange(async v => {
              const n = parseInt(v);
              if (!isNaN(n) && n > 0) {
                this.plugin.settings.periodicCleanInterval = n;
                await this.plugin.saveSettings();
              }
            })
        );
    }
    new Setting(containerEl)
      .setName('Notification level')
      .setDesc('Notification level.')
      .addDropdown(dropdown =>
        dropdown
          .addOption('showAll', 'Show All')
          .addOption('showOnlyErrors', 'Show Only Errors')
          .addOption('hideAll', 'Hide All')
          .setValue(this.plugin.settings.notifications)
          .onChange(async v => {
            this.plugin.settings.notifications = v as Notification;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName('Run on startup')
      .setDesc('Run cleanup automatically when the vault is opened.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.runOnStartup)
          .onChange(async v => {
            this.plugin.settings.runOnStartup = v;
            await this.plugin.saveSettings();
          })
      );

    // Deleted Files
    new Setting(containerEl).setName('Deleted Files').setHeading();
    let trashCleanupAgeWrapper: HTMLDivElement | null = null;
    new Setting(containerEl)
      .setName('Deletion destination')
      .addDropdown(dropdown =>
        dropdown
          .addOption('system', 'System Trash')
          .addOption('obsidian', 'Obsidian Trash')
          .addOption('permanent', 'Permanent Delete')
          .setValue(this.plugin.settings.deletionDestination)
          .onChange(async v => {
            this.plugin.settings.deletionDestination = v as Deletion;
            await this.plugin.saveSettings();
            // Toggle visibility of trash cleanup age wrapper
            if (trashCleanupAgeWrapper) {
              trashCleanupAgeWrapper.style.display = v === 'obsidian' ? '' : 'none';
            }
          })
      );
    trashCleanupAgeWrapper = containerEl.createDiv();
    trashCleanupAgeWrapper.style.display = this.plugin.settings.deletionDestination === 'obsidian' ? '' : 'none';
    new Setting(trashCleanupAgeWrapper)
      .setName('Obsidian trash cleanup age')
      .setDesc('Days to keep files in Obsidian trash before auto-deleting. -1 = disabled.')
      .addText(text => {
        text.setPlaceholder('-1');
        text.setValue(this.plugin.settings.obsidianTrashCleanupAge >= 0 ? String(this.plugin.settings.obsidianTrashCleanupAge) : '');
        text.onChange(async v => {
          const days = parseInt(v) || -1;
          this.plugin.settings.obsidianTrashCleanupAge = days;
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName('Preview deleted files')
      .setDesc('Show a confirmation dialog before deleting.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.deletionConfirmation)
          .onChange(async v => {
            this.plugin.settings.deletionConfirmation = v;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName('Close new tabs after clean')
      .setDesc('Close all blank tabs after cleanup.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.closeNewTabs)
          .onChange(async v => {
            this.plugin.settings.closeNewTabs = v;
            await this.plugin.saveSettings();
          })
      );

    // === Filters Section ===
    const filterSection = new FilterSettingsSection(this.plugin, containerEl, () => this.display());
    filterSection.addFilterSettings();

    // === Clean Rules Section ===
    const cleanRulesSection = new CleanRulesSection(this.plugin, containerEl, () => this.display());
    cleanRulesSection.addCleanRulesSetting();

    // === Attachments Section ===
    const attachmentsSection = new AttachmentsSection(this.plugin, containerEl, () => this.display());
    attachmentsSection.addAttachmentsSettings();

    // === History Section ===
    const historySection = new HistorySettingsSection(this.plugin, containerEl);
    historySection.addHistorySettings();

    // === Import/Export Section ===
    const importExportSection = new ImportExportSettingsSection(this.plugin, containerEl, () => this.display());
    importExportSection.addImportExportSettings();

    // === Performance Section ===
    const perfSection = new PerformanceDebugSettingsSection(this.plugin, containerEl, () => this.display());
    perfSection.addPerformanceDebugSettings();

    // === Updates Section ===
    const updateSection = new UpdateSettingsSection(this.plugin, containerEl);
    updateSection.addUpdateSettings();

    // === Danger Zone ===
    containerEl.createEl('h3', { text: '⚠️ Danger Zone' });
    new Setting(containerEl)
      .setName('Reset Settings')
      .setDesc('Reset all settings to defaults.')
      .addButton(btn =>
        btn.setWarning()
          .setButtonText('Reset')
          .onClick(() => {
            this.plugin.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            this.plugin.saveSettings();
            this.display();
            new Notice('Settings reset to defaults.');
          })
      );
  }
}
