import { App, Setting, Notice, setIcon, TFile } from 'obsidian';
import type FileCleanerPlugin from '../index';
import { CleanRuleEditorModal } from '../modals/CleanRuleEditorModal';
import { ConfirmModal } from '../modals/ConfirmModal';
import { PreviewCleanModal } from '../modals/PreviewCleanModal';
import { DragDropManager } from '../utils/DragDropManager';
import type { CleanRule, CleanScope, CleanTrigger } from '../types/CleanRule';
import type { PreviewEntry } from '../modals/PreviewCleanModal';
import translate from '../i18n';

const t = () => translate();

export class CleanRulesSection {
  private dragDropManager: DragDropManager | null = null;
  private lastReEvaluatedAt: number = 0;
  private rulesChangedSinceReEval: boolean = false;

  constructor(
    private plugin: FileCleanerPlugin,
    private containerEl: HTMLElement,
    private refreshDisplay: () => void
  ) {}

  addCleanRulesSetting(): void {
    const headingSetting = new Setting(this.containerEl).setName(t().Settings.CleanRules.Header).setHeading();

    if (this.plugin.settings.cleanRules.length > 0) {
      headingSetting.addButton(btn =>
        btn.setButtonText(t().Settings.CleanRules.AddRule).setCta().onClick(() => {
          this.openRuleEditor({
            name: 'New Rule',
            active: true,
            aggregation: 'all',
            triggers: [],
            action: null,
            scope: null,
          });
        })
      );
    }

    this.addAllCleanRules();
    this.addReEvaluateButton();
  }

  private addAllCleanRules(): void {
    const rules = this.plugin.settings.cleanRules;
    const container = this.containerEl.createDiv({ cls: 'aoc-rules-list-container' });

    // Setup drag & drop
    this.setupDragDropManager(container);

    if (rules.length === 0) {
      // Empty state: put Setting directly on containerEl, NOT inside aoc-rules-list-container
      // so the infoEl/controlEl hiding CSS doesn't affect it
      new Setting(this.containerEl)
        .setDesc(t().Settings.CleanRules.NoRules)
        .addButton(btn =>
          btn.setButtonText(t().Settings.CleanRules.AddRule).setCta().onClick(() => {
            this.openRuleEditor({
              name: 'New Rule',
              active: true,
              aggregation: 'all',
              triggers: [],
              action: null,
              scope: null,
            });
          })
        );
    } else {
      const container = this.containerEl.createDiv({ cls: 'aoc-rules-list-container' });

      rules.forEach((rule) => {
        const s = new Setting(container);
        s.infoEl.remove();

        const ruleContainer = s.settingEl.createDiv({ cls: 'aoc-clean-rule-card' });

        // Left: badges column + name column (side by side)
        const left = ruleContainer.createDiv({ cls: 'aoc-clean-rule-card-left' });

        // Badges column (vertical, left side)
        const badgesCol = left.createDiv({ cls: 'aoc-rule-badges-col' });
        if (rule.scope) {
          badgesCol.createEl('span', {
            cls: 'aoc-rule-scope-badge',
            text: this.scopeLabel(rule.scope)
          });
        }
        if (rule.action) {
          const actionCls = rule.action === 'delete'
            ? 'aoc-rule-action-badge aoc-rule-action-badge-delete'
            : 'aoc-rule-action-badge aoc-rule-action-badge-skip';
          badgesCol.createEl('span', {
            cls: actionCls,
            text: rule.action === 'delete' ? 'Delete' : 'Skip'
          });
        }

        // Name + desc column (right of badges)
        const nameCol = left.createDiv({ cls: 'aoc-rule-name-col' });
        nameCol.createEl('div', {
          cls: 'aoc-clean-rule-name',
          text: rule.name || 'Unnamed Rule'
        }).setAttribute('title', rule.name || 'Unnamed Rule');
        nameCol.createEl('div', {
          cls: 'aoc-clean-rule-desc',
          text: this.formatRuleSummary(rule)
        }).setAttribute('title', this.formatRuleSummary(rule));

        // Right: actions + toggle
        const actionsRow = ruleContainer.createDiv({ cls: 'aoc-rule-actions-inline' });

        // Delete
        const delBtn = actionsRow.createEl('button', { cls: 'aoc-rule-action-btn mod-warning' });
        setIcon(delBtn, 'trash');
        delBtn.title = t().Settings.CleanRules.DeleteRule;
        delBtn.addEventListener('click', async () => {
          const confirmed = await ConfirmModal.show(
            this.plugin.app,
            t().Modals.Confirm.DeleteRuleTitle,
            `Are you sure you want to delete "${rule.name}"?\n\nThis action cannot be undone.`
          );
          if (confirmed) {
            const idx = this.plugin.settings.cleanRules.indexOf(rule);
            if (idx > -1) {
              this.plugin.settings.cleanRules.splice(idx, 1);
              await this.plugin.saveSettings();
              this.refreshDisplay();
            }
          }
        });

        // Clone
        const cloneBtn = actionsRow.createEl('button', { cls: 'aoc-rule-action-btn' });
        setIcon(cloneBtn, 'copy');
        cloneBtn.title = t().Settings.CleanRules.CloneRule;
        cloneBtn.addEventListener('click', () => this.cloneRule(rule));

        // Edit
        const editBtn = actionsRow.createEl('button', { cls: 'aoc-rule-action-btn' });
        setIcon(editBtn, 'pencil');
        editBtn.title = t().Settings.CleanRules.EditRule;
        editBtn.addEventListener('click', () => this.openRuleEditor(rule));

        // Toggle switch (inline with buttons, rightmost)
        const toggleLabel = actionsRow.createEl('label', { cls: 'aoc-rule-toggle' });
        const checkbox = toggleLabel.createEl('input', {
          type: 'checkbox',
          cls: 'aoc-rule-toggle-input',
        });
        checkbox.checked = rule.active;
        checkbox.title = rule.active ? t().Settings.CleanRules.RuleActive : t().Settings.CleanRules.RuleInactive;
        checkbox.onchange = async () => {
          rule.active = checkbox.checked;
          await this.plugin.saveSettings();
          this.rulesChangedSinceReEval = true;
          this.updateReEvaluateIndicator();
          new Notice(t().Settings.CleanRules.ReEvaluateChanged);
          this.refreshDisplay();
        };
        toggleLabel.createEl('span', { cls: 'aoc-rule-toggle-track' });

        // Drag handle (rightmost, after toggle)
        const dragHandle = DragDropManager.createDragHandle();
        actionsRow.appendChild(dragHandle);
      });
    }
  }

  private scopeLabel(scope: CleanScope): string {
    switch (scope) {
      case 'folder': return t().Settings.RuleEditor.ScopeFolder;
      case 'markdown': return t().Settings.RuleEditor.ScopeMarkdown;
      case 'attachment': return t().Settings.RuleEditor.ScopeAttachment;
    }
  }

  private formatRuleSummary(rule: CleanRule): string {
    const triggerText = rule.triggers.map(tr => `${tr.criteriaType} ${tr.operator} ${tr.value}`).join(' + ');
    return triggerText || t().Settings.CleanRules.NoConditions;
  }

  private openRuleEditor(rule: CleanRule): void {
    const isEditMode = this.plugin.settings.cleanRules.includes(rule);
    const modal = new CleanRuleEditorModal(this.plugin.app, {
      rule,
      isEditMode,
      onSave: async (updatedRule: CleanRule) => {
        const existingIdx = this.plugin.settings.cleanRules.indexOf(rule);
        if (existingIdx > -1) {
          this.plugin.settings.cleanRules[existingIdx] = updatedRule;
        } else {
          this.plugin.settings.cleanRules.push(updatedRule);
        }
        await this.plugin.saveSettings();
        this.rulesChangedSinceReEval = true;
        this.updateReEvaluateIndicator();
        new Notice(t().Settings.CleanRules.ReEvaluateUpdated);
        this.refreshDisplay();
      },
      onDelete: async () => {
        const idx = this.plugin.settings.cleanRules.indexOf(rule);
        if (idx > -1) {
          this.plugin.settings.cleanRules.splice(idx, 1);
          await this.plugin.saveSettings();
          this.refreshDisplay();
        }
      },
    });
    modal.open();
  }

  private cloneRule(rule: CleanRule): void {
    const cloned = JSON.parse(JSON.stringify(rule)) as CleanRule;
    cloned.name = `${rule.name} (copy)`;
    cloned.action = null;
    cloned.scope = null;
    this.plugin.settings.cleanRules.push(cloned);
    this.plugin.saveSettings();
    this.refreshDisplay();
  }

  private addReEvaluateButton(): void {
    const setting = new Setting(this.containerEl)
      .setName(t().Settings.CleanRules.ReEvaluate)
      .setDesc(t().Settings.CleanRules.ReEvaluateDesc);

    const btnContainer = setting.controlEl.createDiv({ cls: 'aoc-reval-btn-container' });
    const btn = btnContainer.createEl('button', { text: 'Re-evaluate', cls: 'aoc-reval-btn mod-cta' });
    const badge = btnContainer.createEl('span', { cls: 'aoc-reval-badge', text: '●' });
    badge.style.display = 'none';

    this.updateReEvaluateIndicator();

    btn.onclick = async () => {
      badge.style.display = 'none';
      btn.disabled = true;
      btn.textContent = t().Settings.CleanRules.ReEvaluateScanning;
      try {
        const allFiles = this.plugin.app.vault.getFiles();
        const allFolders = new Set<string>();
        allFiles.forEach(f => {
          let path = '';
          const parts = f.parent?.path.split('/');
          if (parts) {
            parts.forEach((p, i) => {
              if (i < parts.length - 1) {
                path += (path ? '/' : '') + p;
                allFolders.add(path);
              }
            });
          }
        });

        const matches: PreviewEntry[] = [];
        for (const rule of this.plugin.settings.cleanRules) {
          if (!rule.active || !rule.scope || !rule.action) continue;

          for (const file of allFiles) {
            if (this.ruleMatchesFile(rule, file)) {
              matches.push({
                type: 'file',
                path: file.path,
                action: rule.action,
                scope: rule.scope ?? undefined,
                ruleName: rule.name,
              });
            }
          }

          for (const folder of allFolders) {
            if (this.ruleMatchesPath(rule, folder)) {
              matches.push({
                type: 'folder',
                path: folder,
                action: rule.action,
                scope: rule.scope ?? undefined,
                ruleName: rule.name,
              });
            }
          }
        }

        this.lastReEvaluatedAt = Date.now();
        this.rulesChangedSinceReEval = false;
        this.updateReEvaluateIndicator();

        if (matches.length > 0) {
          new PreviewCleanModal(this.plugin.app, matches).open();
        } else {
          const activeRules = this.plugin.settings.cleanRules.filter(r => r.active && r.scope && r.action);
          if (activeRules.length === 0) {
            new Notice(t().Settings.CleanRules.ReEvaluateNoActiveRules);
          } else {
            new Notice(t().Settings.CleanRules.ReEvaluateNoMatches);
          }
        }
      } catch (error) {
        new Notice(`Re-evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Re-evaluate';
      }
    };
  }

  private updateReEvaluateIndicator(): void {
    // Find the badge element in the container
    const badgeEl = this.containerEl.querySelector('.aoc-reval-badge') as HTMLElement | null;
    if (badgeEl) {
      badgeEl.style.display = this.rulesChangedSinceReEval ? 'inline' : 'none';
    }
  }

  private ruleMatchesFile(rule: CleanRule, file: TFile): boolean {
    const context = {
      type: 'file' as const,
      path: file.path,
      name: file.basename,
      extension: file.extension,
      size: file.stat.size,
      mtime: file.stat.mtime,
      ctime: file.stat.ctime,
    };
    return this.evaluateTriggersForRule(rule, context);
  }

  private ruleMatchesPath(rule: CleanRule, folderPath: string): boolean {
    const context = {
      type: 'folder' as const,
      path: folderPath,
      name: folderPath.split('/').pop() || folderPath,
      extension: '',
      size: 0,
      mtime: 0,
      ctime: 0,
    };
    return this.evaluateTriggersForRule(rule, context);
  }

  private evaluateTriggersForRule(rule: CleanRule, context: {
    type: 'file' | 'folder';
    path: string;
    name: string;
    extension: string;
    size: number;
    mtime: number;
    ctime: number;
  }): boolean {
    if (rule.triggers.length === 0) return false;
    const results = rule.triggers.map(tr => this.evaluateSingleTrigger(tr, context));

    switch (rule.aggregation) {
      case 'all': return results.every(r => r);
      case 'any': return results.some(r => r);
      case 'none': return results.every(r => !r);
      default: return results.every(r => r);
    }
  }

  private evaluateSingleTrigger(trigger: CleanRule['triggers'][0], context: {
    type: 'file' | 'folder';
    path: string;
    name: string;
    extension: string;
    size: number;
    mtime: number;
    ctime: number;
  }): boolean {
    const { criteriaType, operator, value } = trigger;
    let fieldValue: string | number = '';

    switch (criteriaType) {
      case 'parent_path': case 'parent_path_md': case 'parent_path_att':
        fieldValue = context.path; break;
      case 'parent_name':
        fieldValue = context.path.split('/').slice(0, -1).pop() || ''; break;
      case 'folder_name':
        fieldValue = context.path.split('/').pop() || ''; break;
      case 'fileName': case 'fileName_att':
        fieldValue = context.name; break;
      case 'extension':
        fieldValue = context.extension; break;
      case 'file_size': case 'file_size_att':
        fieldValue = context.size; break;
      case 'modified_at': case 'modified_at_md': case 'modified_at_att':
        fieldValue = context.mtime; break;
      case 'created_at': case 'created_at_md': case 'created_at_att':
        fieldValue = context.ctime; break;
      default:
        return false;
    }

    return this.evaluateOperator(fieldValue, operator, value);
  }

  private evaluateOperator(fieldValue: string | number, operator: string, value: string): boolean {
    if (typeof fieldValue === 'number' && typeof value === 'string') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return false;
      switch (operator) {
        case '=': return fieldValue === numValue;
        case '>': return fieldValue > numValue;
        case '<': return fieldValue < numValue;
        case '≥': return fieldValue >= numValue;
        case '≤': return fieldValue <= numValue;
        default: return false;
      }
    }

    const strValue = String(fieldValue).toLowerCase();
    const strOperand = value.toLowerCase();

    switch (operator) {
      case 'is': return strValue === strOperand;
      case 'is not': return strValue !== strOperand;
      case 'contains': return strValue.includes(strOperand);
      case 'does not contain': return !strValue.includes(strOperand);
      case 'starts with': return strValue.startsWith(strOperand);
      case 'does not start with': return !strValue.startsWith(strOperand);
      case 'ends with': return strValue.endsWith(strOperand);
      case 'does not end with': return !strValue.endsWith(strOperand);
      case 'match regex':
        try { return new RegExp(value, 'i').test(String(fieldValue)); }
        catch { return false; }
      case 'does not match regex':
        try { return !new RegExp(value, 'i').test(String(fieldValue)); }
        catch { return true; }
      default: return false;
    }
  }

  private setupDragDropManager(container: HTMLElement): void {
    if (this.dragDropManager) {
      this.dragDropManager.destroy();
    }
    this.dragDropManager = new DragDropManager(container, {
      itemSelector: '.aoc-clean-rule-card',
      handleSelector: '.aoc-drag-handle',
      onReorder: (fromIndex: number, toIndex: number) => {
        const rules = this.plugin.settings.cleanRules;
        const [movedRule] = rules.splice(fromIndex, 1);
        rules.splice(toIndex, 0, movedRule);
      },
      onSave: async () => {
        await this.plugin.saveSettings();
        this.refreshDisplay();
      },
    });
  }
}
