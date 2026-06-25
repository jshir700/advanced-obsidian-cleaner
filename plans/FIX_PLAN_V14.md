## 问题 4：Preview: Cleanup Results 的框架有问题

### 当前框架

```
┌─ Preview: Cleanup Results ──────────────────────────┐
│ 📄 0 files will be deleted                           │
│ 📁 3 folders will be deleted                         │
│ ⏭️ 5 files will be skipped                           │
│                                                      │
│ [Files] [Folders] [Skipped]  ← 按 type 分 tab        │
│                                                      │
│ (当前显示 Files tab，但为空)                          │
│ ─────────────────────────────────                     │
│                                    [Cancel] [Apply]  │
└──────────────────────────────────────────────────────┘
```

### 问题

1. **tab 维度混乱**：tab 叫 "Files" 但里面放的是 file 类型的条目，"Folders" 放 folder 类型。用户需要的是先看 **action**（Deleted / Skipped），再看 **scope**（Folder / Markdown / Attachment）。
2. **空 tab 误导**：Files tab 永远是第一个且默认 active（紫色），即使内容为空。
3. **缺少 scope 维度**：用户不知道 deleted 的文件属于哪个 scope。
4. **summary 统计维度不对**：当前按 type 统计（files/folders），应与 action 维度对齐。

### 用户期望的框架

**一行 summary + 双层 tab**：

- **Summary 行**：按 action 分组，每个 action 下列出所有 scope 的计数（0 也显示，隐藏 0 的 scope）
- **外层 tab**：按 action 分 — `[Deleted] [Skipped]`（2 个 tab）
- **内层 tab**：在每个 action tab 内按 scope 分 — `Folders | Markdowns | Attachments`（3 个子 tab，隐藏计数为 0 的 tab）

#### 场景 1：Deleted → Folders（默认视图）

```
┌─ Preview: Cleanup Results ──────────────────────────┐
│                                                          │
│ 🗑️ To be deleted:  📁 3 Folders                   │
│ ⏭️ To be skipped:   📝 3 Markdowns  📎 2 Attachments                   │
│                                                          │
│ [Deleted] [Skipped]          ← 外层 tab（按 action）     │
│   ↑ 默认选中 Deleted                                     │
│                                                          │
│ ── Deleted ─────────────────────────────────────────    │
│                                                          │
│ 📁 Folders  |  📝 Markdowns  |  📎 Attachments          │
│   ↑ 内层 tab（按 scope），Folders 默认选中                │
│                                                          │
│ 📁 backups/old       ↳ Rule: "清理备份目录"              │
│ 📁 temp/cache        ↳ Rule: "清理临时文件"              │
│ 📁 downloads/unused  ↳ Rule: "清理下载目录"              │
│                                                          │
│                                    [Cancel] [Apply]      │
└──────────────────────────────────────────────────────────┘
```

#### 场景 2：Deleted → Markdowns（该 scope 计数为 0，内层 tab 隐藏）

```
┌─ Preview: Cleanup Results ──────────────────────────┐
│                                                          │
│ 🗑️ To be deleted:  📁 3 Folders                   │
│ ⏭️ To be skipped:   📝 3 Markdowns  📎 2 Attachments                   │
│                                                          │
│ [Deleted] [Skipped]                                      │
│   ↑ 紫色                                                 │
│                                                          │
│ ── Deleted ─────────────────────────────────────────    │
│                                                          │
│ 📁 Folders  |  📎 Attachments                          │
│   ↑ Markdowns 被隐藏（计数为 0）                         │
│                                                          │
│ 📁 backups/old       ↳ Rule: "清理备份目录"              │
│ 📁 temp/cache        ↳ Rule: "清理临时文件"              │
│ 📁 downloads/unused  ↳ Rule: "清理下载目录"              │
│                                                          │
│                                    [Cancel] [Apply]      │
└──────────────────────────────────────────────────────────┘
```

#### 场景 3：Skipped → Markdowns

```
┌─ Preview: Cleanup Results ──────────────────────────┐
│                                                          │
│ 🗑️ To be deleted:  📁 3 Folders                   │
│ ⏭️ To be skipped:   📝 3 Markdowns  📎 2 Attachments                   │
│                                                          │
│ [Deleted] [Skipped]                                      │
│           ↑ 选中 Skipped                                 │
│                                                          │
│ ── Skipped ─────────────────────────────────────────    │
│                                                          │
│ 📁 Folders  |  📝 Markdowns  |  📎 Attachments          │
│              ↑ 选中 Markdowns                             │
│                                                          │
│ 📝 Markdowns (3)                                         │
│ 📄 important.md      ↳ Rule: "保护重要文件"              │
│ 📄 readme.md         ↳ Rule: "保护重要文件"              │
│ 📄 config.yaml       ↳ Rule: "排除配置文件"              │
│                                                          │
│                                    [Cancel] [Apply]      │
└──────────────────────────────────────────────────────────┘
```

#### 场景 4：Skipped → Attachments

```
┌─ Preview: Cleanup Results ──────────────────────────┐
│                                                          │
│ 🗑️ To be deleted:  📁 3 Folders                   │
│ ⏭️ To be skipped:   📝 3 Markdowns  📎 2 Attachments                   │
│                                                          │
│ [Deleted] [Skipped]                                      │
│           ↑ 选中 Skipped                                 │
│                                                          │
│ ── Skipped ─────────────────────────────────────────    │
│                                                          │
│ 📁 Folders  |  📝 Markdowns  |  📎 Attachments          │
│                        ↑ 选中 Attachments                 │
│                                                          │
│ 📎 Attachments (2)                                       │
│ 📄 logo.png          ↳ Rule: "保护品牌素材"              │
│ 📄 manual.pdf        ↳ Rule: "保护文档"                  │
│                                                          │
│                                    [Cancel] [Apply]      │
└──────────────────────────────────────────────────────────┘
```

### 根因

当前的 `PreviewEntry` 类型只有 `type: 'file' | 'folder'` 和 `action: 'delete' | 'skip'`，**没有 scope 信息**。tab 按 `type` 分（Files/Folders/Skipped），summary 按 `type` 统计，缺少 action 和 scope 两个维度。

### 方案

#### 4a. 扩展 PreviewEntry 类型

[PreviewCleanModal.ts:5-11](../advanced-obsidian-cleaner/src/modals/PreviewCleanModal.ts#L5-L11)：

```ts
export interface PreviewEntry {
  type: 'file' | 'folder';
  path: string;
  action: 'delete' | 'skip';
  scope?: CleanScope;           // ← 新增
  ruleName?: string;
  reason?: string;
}
```

#### 4b. Re-evaluate 逻辑中传入 scope

[CleanRulesSection.ts:257-277](../advanced-obsidian-cleaner/src/settings/CleanRulesSection.ts#L257-L277)：

```ts
for (const file of allFiles) {
  if (this.ruleMatchesFile(rule, file)) {
    matches.push({
      type: 'file',
      path: file.path,
      action: rule.action,
      scope: rule.scope ?? undefined,  // ← 新增
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
      scope: rule.scope ?? undefined,  // ← 新增
      ruleName: rule.name,
    });
  }
}
```

#### 4c. 重构 PreviewCleanModal 渲染

**Summary 行**：按 action 分组，每个 action 下列出所有 scope 计数（0 也显示），隐藏计数为 0 的 scope tab。

```ts
protected createContent(): void {
  const { contentEl } = this;

  // ── Summary 行（按 action × scope 统计） ──
  const summary = contentEl.createDiv({ cls: 'aoc-preview-summary' });

  const deleted = this.entries.filter(e => e.action === 'delete');
  const skipped = this.entries.filter(e => e.action === 'skip');

  const deletedByScope = this.countByScope(deleted);
  const skippedByScope = this.countByScope(skipped);

  // 过滤掉计数为 0 的 scope
  const visibleDeletedScopes = this.getVisibleScopes(deletedByScope);
  const visibleSkippedScopes = this.getVisibleScopes(skippedByScope);

  // 拼接 summary 文本（隐藏 0 计数，数字在前 scope 在后，1 用单数）
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

  // ── 外层 tab（按 action 分） ──
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

  // ── 内容区 ──
  const contentArea = contentEl.createDiv({ cls: 'aoc-preview-content-area' });

  // Deleted 内容
  this.deletedTabEl = contentArea.createDiv({
    cls: 'aoc-preview-tab-pane',
    attr: { 'data-action': 'deleted' },
  });
  this.deletedTabEl.style.display = 'block';
  this.buildInnerTabs(this.deletedTabEl, deleted);

  // Skipped 内容
  this.skippedTabEl = contentArea.createDiv({
    cls: 'aoc-preview-tab-pane',
    attr: { 'data-action': 'skipped' },
  });
  this.skippedTabEl.style.display = 'none';
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
  return ['folder', 'markdown', 'attachment'].filter(
    s => (counts.get(s) || 0) > 0
  );
}

private buildInnerTabs(container: HTMLElement, entries: PreviewEntry[]): void {
  const counts = this.countByScope(entries);
  const visibleScopes = this.getVisibleScopes(counts);

  // 内层 tab 按钮（只渲染计数 > 0 的 scope）
  const innerTabs = container.createDiv({ cls: 'aoc-preview-inner-tabs' });
  const scopeList: CleanScope[] = ['folder', 'markdown', 'attachment'];

  scopeList.forEach(key => {
    if (counts.get(key) === 0) return;  // 隐藏 0 计数的 tab

    const btn = innerTabs.createEl('button', {
      text: `${this.scopeIcon(key)} ${this.scopeLabel(key, scopeEntries.length)}`,
      cls: 'aoc-preview-inner-tab-btn',
    });
    btn.onclick = () => {
      innerTabs.querySelectorAll('.aoc-preview-inner-tab-btn').forEach(b => b.removeClass('is-active'));
      btn.addClass('is-active');
      this.innerTab = key;
      this.showInnerTab();
    };
  });

  // 渲染内容面板（全部渲染，通过 display:none 隐藏 0 计数的）
  const panes: HTMLElement[] = [];
  scopeList.forEach(key => {
    const pane = container.createDiv({ cls: 'aoc-preview-inner-pane' });
    const scopeEntries = entries.filter(e => e.scope === key);

    pane.createEl('h4', {
      text: `${this.scopeIcon(key)} ${this.scopeLabel(key, scopeEntries.length)} (${scopeEntries.length})`,
      cls: 'aoc-preview-scope-title',
    });

    if (scopeEntries.length === 0) {
      pane.createEl('p', { text: '(无匹配文件)', cls: 'aoc-preview-empty' });
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
```

#### 4d. CSS 新增

```css
/* Summary 行按 action × scope 统计 */
.aoc-preview-summary p {
  margin: 0;
  line-height: 1.8;
}

/* 双层 tab 结构 */
.aoc-preview-content-area {
  margin-top: 12px;
}

.aoc-preview-inner-tabs {
  display: flex;
  gap: 4px;
  margin: 0 0 12px 0;
  padding-left: 4px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.aoc-preview-inner-tab-btn {
  padding: 4px 12px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  color: var(--text-normal);
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  font-size: var(--font-ui-small);
  transition: all 0.15s ease;
  border-bottom: none;
}

.aoc-preview-inner-tab-btn:hover {
  background: var(--background-modifier-hover);
}

.aoc-preview-inner-tab-btn.is-active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

.aoc-preview-inner-pane {
  display: none;
}

.aoc-preview-scope-title {
  font-size: 0.95em;
  font-weight: 600;
  color: var(--text-muted);
  margin: 0 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.aoc-preview-empty {
  margin: 8px 0;
  font-size: var(--font-ui-smaller);
  color: var(--text-muted);
  font-style: italic;
}

.aoc-preview-list {
  display: flex;
  flex-direction: column;
}
```

### 修改后视觉效果（汇总）

```
修改前 (summary 按 type 分):              修改后 (summary 按 action × scope 分):
┌─────────────────────────────┐          ┌─────────────────────────────┐
│ 🗑️ To be deleted:  📁 3 Folders       │
│ ⏭️ To be skipped:   📝 3 Markdowns  📎 2 Attachments│
│ ⏭️ 5 files skipped          │          │                             │
│                             │          │ [Deleted] [Skipped]         │
│ [Files] [Folders] [Skip]    │          │                             │
│  ↑ 紫色, 空                  │          │ 📁 Folders | 📝 Markdowns |  │
│                             │          │        📎 Attachments        │
│ 📁 Folders (3)              │          │                             │
│ 📁 backups/old  ↳ Rule A   │          │ 📁 backups/old  ↳ Rule A    │
│ 📁 temp/cache   ↳ Rule B   │          │ 📁 temp/cache   ↳ Rule B    │
│ 📁 downloads/ ↳ Rule C     │          │ 📁 downloads/ ↳ Rule C      │
│                             │          │                             │
│ 📝 Markdowns (0)            │          │                                    │
│ (无匹配文件)                │          │                                    │
│                             │          │                                    │
│ 📎 Attachments (0)          │          │                                    │
│ (无匹配文件)                │          │                                    │
│                             │          │                                    │
│ ── Skipped ──               │          │                                    │
│ 📄 important.md ↳ Rule X   │          │                                    │
│ 📄 readme.md    ↳ Rule Y   │          │                                    │
└─────────────────────────────┘          └─────────────────────────────┘

Summary 对比:
修改前:                                   修改后:
📄 0 files deleted   📁 3 folders deleted │ 🗑️ To be deleted:  📁 3 Folders
⏭️ 5 skipped                  ⏭️ To be skipped:   📝 3 Markdowns  📎 2 Attachments
 ↑ 按 type 统计，skipped 无 scope 分布     ↑ 按 action 统计，每个 action 下
                                            显示各 scope 计数，0 的不显示
```

关键变化：
- **Summary 行按 action × scope 统计**：`🗑️ To be deleted: 📁 3 Folders` + `⏭️ To be skipped: 📝 3 Markdowns 📎 2 Attachments`
- **Summary 中隐藏计数为 0 的 scope**：只显示有匹配的 scope，避免冗余
- **外层 tab 改为 2 个**：Deleted / Skipped（按 action 分）
- **内层 tab 3 个**：Folders / Markdowns / Attachments（按 scope 分），**隐藏计数为 0 的 tab**
- **scope 信息从 rule 中提取**：每个 entry 携带 `scope` 字段

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| [styles.css](../advanced-obsidian-cleaner/styles.css) | 1. badge 添加 `justify-content: center` 2. 合并重复 `.aoc-drag-handle` 块 3. 新增双层 tab / scope group / empty 样式 |
| [DragDropManager.ts](../advanced-obsidian-cleaner/src/utils/DragDropManager.ts) | `createDragHandle()` 改回 `textContent = '⋮⋮'`，添加 `role` 和 `tabindex` |
| [CleanRulesSection.ts](../advanced-obsidian-cleaner/src/settings/CleanRulesSection.ts) | Re-evaluate 逻辑中传入 `scope` 字段 |
| [PreviewCleanModal.ts](../advanced-obsidian-cleaner/src/modals/PreviewCleanModal.ts) | 1. `PreviewEntry` 增加 `scope` 字段 2. Summary 按 action × scope 统计（隐藏 0）3. 双层 tab 结构 4. 内层 tab 隐藏计数为 0 的 scope |

---

## 实施顺序

1. **Q1**：Badge `justify-content: center`（单行 CSS）
2. **Q2**：恢复纯文本图标 + 合并 CSS + 添加无障碍属性
3. **Q3**：随 Q4 一起修复（重构 tab 结构后不再有空 tab 问题）
4. **Q4**：重构 PreviewCleanModal — scope 字段 + Summary 按 action × scope 统计 + 双层 tab + 隐藏 0 计数
5. **Build + Deploy**


