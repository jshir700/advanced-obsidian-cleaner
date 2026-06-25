import { App, Setting, Notice, setIcon } from 'obsidian';
import translate from '../i18n';

const t = () => translate();
import { BaseModal } from './BaseModal';
import { DragDropManager } from '../utils/DragDropManager';
import type { CleanRule, CleanTrigger, AggregationType, CleanAction, CleanScope } from '../types/CleanRule';

interface CleanRuleEditorModalOptions {
  rule: CleanRule;
  isEditMode: boolean;
  onSave: (rule: CleanRule) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export class CleanRuleEditorModal extends BaseModal {
  private ruleOptions: CleanRuleEditorModalOptions;
  private workingRule: CleanRule;
  private originalRule: CleanRule;
  private isForceClosing = false;
  private triggersContainer: HTMLElement | null = null;
  private triggerDragDropManager: DragDropManager | null = null;

  constructor(app: App, options: CleanRuleEditorModalOptions) {
    super(app, {
      title: 'Rule Editor',
      size: 'large',
      cssClass: 'aoc-rule-editor-modal',
      autoFocus: false,
    });
    this.ruleOptions = options;
    this.workingRule = JSON.parse(JSON.stringify(options.rule));
    this.originalRule = JSON.parse(JSON.stringify(options.rule));
  }

  protected createContent(): void {
    const { contentEl } = this;
    this.createNameAndActiveRow(contentEl);
    this.createMatchConditionsSelector(contentEl);
    this.createActionSelector(contentEl);
    this.createScopeSelector(contentEl);

    contentEl.createEl('hr', { cls: 'aoc-rule-editor-separator' });

    // Ensure at least one empty trigger row
    if (this.workingRule.triggers.length === 0) {
      this.workingRule.triggers.push({
        criteriaType: '' as any,
        operator: '' as any,
        value: '',
      });
    }

    this.createConditionsSection(contentEl);

    contentEl.createEl('hr', { cls: 'aoc-rule-editor-separator' });

    this.createFooterActions(contentEl);
  }

  private createNameAndActiveRow(container: HTMLElement): void {
    new Setting(container)
      .setName('Name')
      .addText(text =>
        text
          .setPlaceholder('Enter rule name')
          .setValue(this.workingRule.name)
          .onChange(value => { this.workingRule.name = value; })
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.workingRule.active)
          .setTooltip(this.workingRule.active ? 'Rule is active' : 'Rule is inactive')
          .onChange(value => {
            this.workingRule.active = value;
            toggle.setTooltip(value ? 'Rule is active' : 'Rule is inactive');
          })
      );
  }

  private createMatchConditionsSelector(container: HTMLElement): void {
    const setting = new Setting(container).setName('Match conditions');

    const buttonContainer = setting.controlEl.createDiv({
      cls: 'aoc-rule-aggregation-buttons',
    });

    const aggMap: Record<string, string> = { all: t().Settings.RuleEditor.AggregationAll, any: t().Settings.RuleEditor.AggregationAny, none: t().Settings.RuleEditor.AggregationNone };
    const aggregations: AggregationType[] = ['all', 'any', 'none'];
    aggregations.forEach(agg => {
      const button = buttonContainer.createEl('button', {
        text: aggMap[agg],
        cls: 'aoc-rule-aggregation-button',
      });

      if (this.workingRule.aggregation === agg) {
        button.addClass('is-active');
      }

      button.onclick = () => {
        this.workingRule.aggregation = agg;
        buttonContainer
          .querySelectorAll('.aoc-rule-aggregation-button')
          .forEach(btn => btn.removeClass('is-active'));
        button.addClass('is-active');
      };
    });
  }

  private createActionSelector(container: HTMLElement): void {
    new Setting(container)
      .setName('Action')
      .setDesc('What to do when a file matches this rule.')
      .addDropdown(dropdown => {
        dropdown.addOption('', '-- Select Action --');
        dropdown.addOption('delete', 'Delete');
        dropdown.addOption('skip', 'Skip');
        dropdown.setValue(this.workingRule.action ?? '');
        dropdown.onChange(value => {
          this.workingRule.action = (value === '' ? null : value) as CleanAction | null;
        });
      });
  }

  private createScopeSelector(container: HTMLElement): void {
    new Setting(container)
      .setName('Scope')
      .setDesc('Which type of item this rule applies to.')
      .addDropdown(dropdown => {
        dropdown.addOption('', '-- Select Scope --');
        dropdown.addOption('folder', 'Folders');
        dropdown.addOption('markdown', 'Markdowns');
        dropdown.addOption('attachment', 'Attachments');
        dropdown.setValue(this.workingRule.scope ?? '');
        dropdown.onChange(value => {
          this.workingRule.scope = (value === '' ? null : value) as CleanScope | null;
          // Re-render triggers when scope changes
          this.renderTriggers();
        });
      });
  }

  private createConditionsSection(container: HTMLElement): void {
    const section = container.createDiv({
      cls: 'aoc-rule-conditions-section',
    });

    section.createEl('h3', {
      text: 'Conditions:',
      cls: 'aoc-rule-conditions-title',
    });

    this.triggersContainer = section.createDiv({
      cls: 'aoc-rule-triggers-container',
    });

    this.renderTriggers();

    new Setting(section).addButton(btn =>
      btn.setButtonText('+ add condition').onClick(() => {
        this.workingRule.triggers.push({
          criteriaType: '' as any,
          operator: '' as any,
          value: '',
        });
        this.renderTriggers();
      })
    );
  }

  private renderTriggers(): void {
    if (!this.triggersContainer) return;

    this.triggersContainer.empty();

    // Determine effective scope for criteria types
    const effectiveScope = this.workingRule.scope || 'folder';

    this.workingRule.triggers.forEach((trigger, index) => {
      this.createTriggerRow(this.triggersContainer, trigger, index, effectiveScope);
    });

    // Initialize drag & drop for trigger rows
    if (this.triggerDragDropManager) {
      this.triggerDragDropManager.destroy();
    }
    this.triggerDragDropManager = new DragDropManager(this.triggersContainer, {
      itemSelector: '.aoc-rule-trigger-row',
      handleSelector: '.aoc-drag-handle',
      onReorder: (fromIndex, toIndex) => {
        const triggers = this.workingRule.triggers;
        const [moved] = triggers.splice(fromIndex, 1);
        triggers.splice(toIndex, 0, moved);
        this.renderTriggers();
      },
    });
  }

  private createTriggerRow(
    container: HTMLElement,
    trigger: CleanTrigger,
    index: number,
    scope: CleanScope
  ): void {
    const row = container.createDiv({ cls: 'aoc-rule-trigger-row' });

    // Delete button
    const deleteBtn = row.createEl('button', {
      cls: 'aoc-rule-trigger-delete-btn clickable-icon',
    });
    setIcon(deleteBtn, 'x');
    deleteBtn.onclick = () => {
      this.workingRule.triggers.splice(index, 1);
      if (this.workingRule.triggers.length === 0) {
        this.workingRule.triggers.push({
          criteriaType: '' as any,
          operator: '' as any,
          value: '',
        });
      }
      this.renderTriggers();
    };

    // CriteriaType dropdown
    const criteriaSelect = row.createEl('select', { cls: 'dropdown aoc-rule-criteria-type' });
    const criteriaTypes = this.getCriteriaTypesForScope(scope);
    // Add empty option
    criteriaSelect.createEl('option', { value: '', text: '-- Select --' });
    criteriaTypes.forEach(ct => {
      const opt = criteriaSelect.createEl('option', { value: ct, text: ct });
      if (trigger.criteriaType === ct) opt.selected = true;
    });
    criteriaSelect.onchange = () => {
      const val = criteriaSelect.value;
      trigger.criteriaType = val ? (val as any) : '';
      trigger.operator = val ? (this.getDefaultOperator(val) as any) : '';
      this.renderTriggers();
    };

    // Operator dropdown
    const operatorSelect = row.createEl('select', { cls: 'dropdown aoc-rule-operator' });
    this.populateOperators(operatorSelect, trigger);
    operatorSelect.onchange = () => {
      trigger.operator = operatorSelect.value as any;
      this.renderTriggers();
    };

    // Value input (only when operator requires one)
    if (this.requiresValue(trigger.operator)) {
      const valueInput = row.createEl('input', {
        type: 'text',
        cls: 'aoc-rule-trigger-value',
      });
      valueInput.placeholder = 'Value';
      valueInput.value = trigger.value;
      valueInput.oninput = () => { trigger.value = valueInput.value; };
    } else {
      row.addClass('aoc-no-value-field');
    }

    // Drag handle
    const handleContainer = row.createDiv({ cls: 'aoc-drag-handle-container' });
    const handle = handleContainer.createDiv({ cls: 'aoc-drag-handle' });
    handle.textContent = '⋮⋮';
    handle.setAttribute('draggable', 'true');
    handle.setAttribute('aria-label', 'Drag to reorder');
    handle.setAttribute('role', 'button');
    handle.setAttribute('tabindex', '0');
  }

  private getCriteriaTypesForScope(scope: CleanScope): string[] {
    switch (scope) {
      case 'folder': return ['parent_path', 'folder_name', 'depth', 'folder_depth', 'created_at', 'modified_at', 'size', 'children_count', 'subfolders_count'];
      case 'markdown': return ['parent_path', 'parent_name', 'fileName', 'file_size', 'content_length', 'created_at', 'modified_at', 'links', 'backlinks', 'headings', 'frontmatter'];
      case 'attachment': return ['parent_path', 'parent_name', 'fileName', 'extension', 'file_size', 'created_at', 'modified_at', 'attachment_usage'];
    }
  }

  private getDefaultOperator(criteriaType: string): string {
    switch (criteriaType) {
      case 'parent_path': case 'parent_name': case 'folder_name': case 'fileName':
        return 'contains';
      case 'extension': return 'is';
      case 'created_at': case 'modified_at': return 'is';
      case 'file_size': case 'size': case 'content_length': case 'depth':
        return '>';
      case 'links': case 'backlinks': case 'children_count': case 'subfolders_count':
        return '>';
      case 'attachment_usage': return 'link count =';
      case 'headings': return 'none contain';
      case 'frontmatter': return 'has any value';
      default: return 'is';
    }
  }

  private populateOperators(select: HTMLSelectElement, trigger: CleanTrigger): void {
    select.empty();
    const ops = this.getOperatorsForCriteria(trigger.criteriaType);
    // Add empty option
    select.createEl('option', { value: '', text: '-- Select --' });
    ops.forEach(op => {
      const opt = select.createEl('option', { value: op, text: op });
      if (trigger.operator === op) opt.selected = true;
    });
  }

  private getOperatorsForCriteria(criteriaType: string): string[] {
    switch (criteriaType) {
      case 'parent_path': case 'parent_name': case 'folder_name': case 'fileName':
        return ['is', 'is not', 'contains', 'does not contain', 'starts with', 'does not start with', 'ends with', 'does not end with', 'match regex', 'does not match regex'];
      case 'extension':
        return ['is', 'is not', 'contains', 'does not contain', 'starts with', 'does not start with', 'ends with', 'does not end with', 'match regex', 'does not match regex', 'is image', 'is video', 'is audio', 'is document', 'is archive'];
      case 'depth': case 'file_size': case 'size': case 'content_length':
      case 'links': case 'backlinks': case 'children_count': case 'subfolders_count':
        return ['=', '>', '<', '≥', '≤'];
      case 'created_at': case 'modified_at':
        return ['is', 'is before', 'is after', 'time is before', 'time is after', 'time is before now', 'time is after now', 'date is', 'date is not', 'date is before', 'date is after', 'date is today', 'date is not today', 'is under X days ago', 'is over X days ago', 'day of week is', 'day of week is not', 'day of week is before', 'day of week is after', 'day of month is', 'day of month is not', 'day of month is before', 'day of month is after', 'month is', 'month is not', 'month is before', 'month is after', 'year is', 'year is not', 'year is before', 'year is after'];
      case 'headings':
        return ['includes item', 'does not include item', 'all are', 'all start with', 'all end with', 'all match regex', 'any contain', 'any end with', 'any match regex', 'none contain', 'none start with', 'none end with'];
      case 'frontmatter':
        return ['has any value', 'has no value', 'property is present', 'property is missing', 'is', 'is not', 'contains', 'does not contain', 'starts with', 'does not start with', 'ends with', 'does not end with', 'match regex', 'does not match regex'];
      case 'attachment_usage':
        return ['link count =', 'link count >', 'link count <', 'link count ≥', 'link count ≤'];
      default:
        return ['is'];
    }
  }

  private requiresValue(operator: string): boolean {
    const noValueOps = ['time is before now', 'time is after now', 'date is today', 'date is not today',
      'is image', 'is video', 'is audio', 'is document', 'is archive',
      'has any value', 'has no value', 'property is present', 'property is missing'];
    return !noValueOps.includes(operator);
  }

  private createFooterActions(container: HTMLElement): void {
    const footer = container.createDiv({ cls: 'aoc-rule-editor-footer' });

    // Always create leftSide so space-between works correctly
    const leftSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-left' });
    if (this.ruleOptions.isEditMode && this.ruleOptions.onDelete) {
      const leftButtons = this.createButtonContainer(leftSide);
      this.createButton(
        leftButtons,
        'Delete Rule',
        () => { void this.handleRemoveRule(); },
        { isWarning: true }
      );
    }

    const rightSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-right' });
    const rightButtons = this.createButtonContainer(rightSide);

    this.createButton(rightButtons, 'Cancel', () => {
      void this.requestClose();
    });

    this.createButton(
      rightButtons,
      'Save',
      () => { void this.handleSave(); },
      { isPrimary: true }
    );
  }

  private async handleSave(): Promise<void> {
    if (!this.validateRule()) return;
    await this.ruleOptions.onSave(this.workingRule);
    this.isForceClosing = true;
    super.close();
  }

  private async handleRemoveRule(): Promise<void> {
    if (this.ruleOptions.onDelete) {
      await this.ruleOptions.onDelete();
    }
    this.isForceClosing = true;
    super.close();
  }

  private hasUnsavedChanges(): boolean {
    return JSON.stringify(this.workingRule) !== JSON.stringify(this.originalRule);
  }

  private async requestClose(): Promise<void> {
    this.close();
  }

  close(): void {
    if (this.isForceClosing || !this.hasUnsavedChanges()) {
      super.close();
      return;
    }
    new Notice('There are unsaved changes. Closing without saving.');
    super.close();
  }

  private validateRule(): boolean {
    if (!this.workingRule.name || this.workingRule.name.trim() === '') {
      new Notice('Rule name cannot be empty.');
      return false;
    }
    if (!this.workingRule.action) {
      new Notice('Please select an Action (Delete or Skip).');
      return false;
    }
    if (!this.workingRule.scope) {
      new Notice('Please select a Scope (Folder, Markdown, or Attachment).');
      return false;
    }
    if (this.workingRule.triggers.length === 0) {
      new Notice('At least one condition is required.');
      return false;
    }
    for (let i = 0; i < this.workingRule.triggers.length; i++) {
      const tr = this.workingRule.triggers[i];
      if (!tr.criteriaType || !tr.operator) {
        new Notice(t().Modals.RuleEditor.ConditionIncomplete.replace("{n}", String(i + 1)));
        return false;
      }
    }
    return true;
  }

  onClose(): void {
    if (this.triggerDragDropManager) {
      this.triggerDragDropManager.destroy();
      this.triggerDragDropManager = null;
    }
    super.onClose();
  }
}
