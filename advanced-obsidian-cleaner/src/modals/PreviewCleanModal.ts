import { App, Notice, setIcon } from "obsidian";
import { BaseModal } from "./BaseModal";
import { ConfirmModal } from "./ConfirmModal";
import type { CleanScope } from "../types/CleanRule";

export interface PreviewEntry {
  type: 'file' | 'folder';
  path: string;
  action: 'delete' | 'skip';
  scope?: CleanScope;
  ruleName?: string;
  reason?: string;
}

export class PreviewCleanModal extends BaseModal {
  private entries: PreviewEntry[];

  // Outer tab (action)
  private deletedTabEl!: HTMLElement;
  private skippedTabEl!: HTMLElement;

  // Inner tab panes mapped by action key
  private innerPanes: Map<string, HTMLElement[]> = new Map();
  private outerTab = 'deleted';
  private innerTab = 'folder';

  constructor(app: App, entries: PreviewEntry[]) {
    super(app, {
      title: 'Preview: Cleanup Results',
      size: 'large',
      cssClass: 'aoc-preview-modal',
      autoFocus: false,
    });
    this.entries = entries;
  }

  protected createContent(): void {
    const { contentEl } = this;

    // ── Summary row (action × scope) ──
    const summary = contentEl.createDiv({ cls: 'aoc-preview-summary' });

    const deleted = this.entries.filter(e => e.action === 'delete');
    const skipped = this.entries.filter(e => e.action === 'skip');

    const deletedByScope = this.countByScope(deleted);
    const skippedByScope = this.countByScope(skipped);

    const deletedParts = ['🗑️ To be deleted:'];
    for (const scope of ['folder', 'markdown', 'attachment'] as CleanScope[]) {
      const count = deletedByScope.get(scope) || 0;
      if (count > 0) {
        deletedParts.push(`${this.scopeIcon(scope)} ${count} ${this.scopeLabel(scope, count)}`);
      }
    }

    const skippedParts = ['⏭️ To be skipped:'];
    for (const scope of ['folder', 'markdown', 'attachment'] as CleanScope[]) {
      const count = skippedByScope.get(scope) || 0;
      if (count > 0) {
        skippedParts.push(`${this.scopeIcon(scope)} ${count} ${this.scopeLabel(scope, count)}`);
      }
    }

    summary.createEl('p', { text: deletedParts.join('  ') });
    summary.createEl('p', { text: skippedParts.join('  ') });

    // ── Outer tabs (by action) ──
    const outerTabs = contentEl.createDiv({ cls: 'aoc-preview-tabs' });
    const outerLabels = ['Deleted', 'Skipped'];
    outerLabels.forEach(label => {
      const btn = outerTabs.createEl('button', { text: label, cls: 'aoc-preview-tab-btn' });
      btn.onclick = () => {
        outerTabs.querySelectorAll('.aoc-preview-tab-btn').forEach(b => b.removeClass('is-active'));
        btn.addClass('is-active');
        this.outerTab = label.toLowerCase();
        this.showOuterTab();
      };
    });
    outerTabs.querySelector('button')?.addClass('is-active');

    // ── Content area ──
    const contentArea = contentEl.createDiv({ cls: 'aoc-preview-content-area' });

    this.deletedTabEl = contentArea.createDiv({
      cls: 'aoc-preview-tab-pane',
      attr: { 'data-action': 'deleted' },
    });
    this.deletedTabEl.style.display = 'block';
    this.buildInnerTabs(this.deletedTabEl, deleted);

    this.skippedTabEl = contentArea.createDiv({
      cls: 'aoc-preview-tab-pane',
      attr: { 'data-action': 'skipped' },
    });
    this.skippedTabEl.style.display = skipped.length > 0 ? 'block' : 'none';
    this.buildInnerTabs(this.skippedTabEl, skipped);

    // ── Footer ──
    const footer = contentEl.createDiv({ cls: 'aoc-rule-editor-footer' });
    const leftSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-left' });
    const rightSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-right' });
    const rightButtons = this.createButtonContainer(rightSide);
    this.createButton(rightButtons, 'Cancel', () => this.close());
    this.createButton(rightButtons, 'Apply Clean', () => this.applyClean(), { isPrimary: true });
  }

  private countByScope(entries: PreviewEntry[]): Map<CleanScope, number> {
    const map = new Map<CleanScope, number>();
    map.set('folder', 0);
    map.set('markdown', 0);
    map.set('attachment', 0);
    for (const entry of entries) {
      const scope = entry.scope || 'folder';
      map.set(scope, (map.get(scope) || 0) + 1);
    }
    return map;
  }

  private getVisibleScopes(counts: Map<CleanScope, number>): CleanScope[] {
    return ['folder' as CleanScope, 'markdown' as CleanScope, 'attachment' as CleanScope].filter(
      s => (counts.get(s) || 0) > 0
    );
  }

  private buildInnerTabs(container: HTMLElement, entries: PreviewEntry[]): void {
    const counts = this.countByScope(entries);
    const scopeOrder: CleanScope[] = ['folder' as CleanScope, 'markdown' as CleanScope, 'attachment' as CleanScope];

    // Inner tab buttons (hide 0-count scopes)
    const innerTabs = container.createDiv({ cls: 'aoc-preview-inner-tabs' });
    const panes: HTMLElement[] = [];

    scopeOrder.forEach(key => {
      const count = counts.get(key) || 0;
      if (count === 0) return; // hide 0-count scope tabs

      const btn = innerTabs.createEl('button', {
        text: `${this.scopeIcon(key)} ${this.scopeLabel(key, count)}`,
        cls: 'aoc-preview-inner-tab-btn',
      });
      btn.onclick = () => {
        innerTabs.querySelectorAll('.aoc-preview-inner-tab-btn').forEach(b => b.removeClass('is-active'));
        btn.addClass('is-active');
        this.innerTab = key;
        this.showInnerTab();
      };
    });

    // Render all panes (0-count ones hidden via display:none)
    scopeOrder.forEach(key => {
      const pane = container.createDiv({ cls: 'aoc-preview-inner-pane' });
      const scopeEntries = entries.filter(e => e.scope === key);

      pane.createEl('h4', {
        text: `${this.scopeIcon(key)} ${this.scopeLabel(key, scopeEntries.length)} (${scopeEntries.length})`,
        cls: 'aoc-preview-scope-title',
      });

      if (scopeEntries.length === 0) {
        pane.createEl('p', { text: '(No matches)', cls: 'aoc-preview-empty' });
      } else {
        const list = pane.createDiv({ cls: 'aoc-preview-list' });
        for (const entry of scopeEntries) {
          const item = list.createDiv({ cls: 'aoc-preview-list-item' });
          const icon = entry.type === 'folder' ? '📁' : '📄';
          item.createEl('span', { text: `${icon} ${entry.path}`, cls: 'aoc-preview-path' });
          if (entry.ruleName) {
            item.createEl('span', { text: `↳ ${entry.ruleName}`, cls: 'aoc-preview-rule' });
          }
        }
      }
      panes.push(pane);
    });

    this.innerPanes.set(container.getAttribute('data-action')!, panes);
  }

  private showOuterTab(): void {
    this.deletedTabEl.style.display = this.outerTab === 'deleted' ? 'block' : 'none';
    this.skippedTabEl.style.display = this.outerTab === 'skipped' ? 'block' : 'none';
  }

  private showInnerTab(): void {
    const allPanes = [...this.innerPanes.values()].flat() as HTMLElement[];
    const scopeKeys: CleanScope[] = ['folder' as CleanScope, 'markdown' as CleanScope, 'attachment' as CleanScope];
    allPanes.forEach((pane, i) => {
      pane.style.display = scopeKeys[i] === this.innerTab ? 'block' : 'none';
    });
  }

  private scopeIcon(scope: string): string {
    switch (scope) {
      case 'folder': return '📁';
      case 'markdown': return '📝';
      case 'attachment': return '📎';
      default: return '📄';
    }
  }

  private scopeLabel(scope: string, count?: number): string {
    const labels: Record<string, { singular: string; plural: string }> = {
      folder: { singular: 'Folder', plural: 'Folders' },
      markdown: { singular: 'Markdown', plural: 'Markdowns' },
      attachment: { singular: 'Attachment', plural: 'Attachments' },
    };
    const entry = labels[scope] || { singular: scope, plural: scope };
    return (count !== undefined && count === 1) ? entry.singular : entry.plural;
  }

  private async applyClean(): Promise<void> {
    const deletedFiles = this.entries.filter(e => e.type === 'file' && e.action === 'delete');
    const deletedFolders = this.entries.filter(e => e.type === 'folder' && e.action === 'delete');

    const confirmed = await ConfirmModal.show(
      this.app,
      'Apply Clean',
      `This will permanently delete ${deletedFiles.length} file(s) and ${deletedFolders.length} folder(s).\n\nThis action cannot be undone.`
    );

    if (confirmed) {
      new Notice(`Cleaning ${deletedFiles.length + deletedFolders.length} item(s)...`);
      console.log('Apply clean confirmed — entries:', this.entries);
      this.close();
    }
  }
}
