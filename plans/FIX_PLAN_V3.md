# advanced-obsidian-cleaner — 完整修复方案 V3

## 前置状态

上一轮已完成：
- 问题 7（Save 不保存）→ 已修复
- 问题 3（add 按钮 prompt）→ 已修复为 ExtensionInputModal
- 问题 4（合并 Clean Rules + Action/Scope 可选）→ 已修复
- 问题 1（trash cleanup age 空白）→ 已修复
- 问题 5（empty + add 同行）→ 已修复
- 问题 2（checkbox 替代 ×）→ 已修复（但行为需调整）
- 问题 6（按钮间距）→ 已修复
- 问题 8（响应式）→ 已修复

本轮针对以下新问题：

---

## 问题 1：Blacklist Filters 去掉，保留 File Type Categories

### 现状
`FilterSettingsSection.addFilterSettings()` 调用了 `addBlacklistFilterList()` + `addFileTypeCategories()`。用户要求只保留 File Type Categories。

### 方案
修改 `FilterSettingsSection.addFilterSettings()`：
```ts
addFilterSettings(): void {
  this.containerEl.createEl('h3', { text: '🚫 Filters' });
  // 删除 this.addBlacklistFilterList();
  this.addFileTypeCategories();
}
```
同时删除 `addBlacklistFilterList()` 方法体。`settings.ts` 中仍创建 `FilterSettingsSection`（因为它还管理 File Type Categories）。

---

## 问题 2：File Type Categories checkbox 行为调整

### 现状
取消勾选默认扩展名时，立即从数组中删除 + refreshDisplay 重建 UI → 扩展名直接消失。

### 需求
- **默认扩展名**（来自 DEFAULT_SETTINGS）：取消勾选 → 只视觉上取消勾选（checkbox unchecked），不消失，下次打开设置界面时恢复勾选
- **手动添加的扩展名**：取消勾选 → 本次 session 只取消勾选不消失，下次再打开设置界面时才真正消失

### 方案

**数据结构不变**（仍为 `string[]`），在 `FilterSettingsSection` 中增加 session 级别跟踪：

```ts
class FilterSettingsSection {
  private sessionUncheckedCustom: Set<string> = new Set(); // "Image_jpg" 格式

  addFileTypeCategories(): void {
    this.sessionUncheckedCustom.clear(); // 每次新建 section 时清空
    // ...
  }

  renderCategorySetting(name: string, extensions: string[]): void {
    const defaults = DEFAULT_SETTINGS.fileTypeCategories[name.toLowerCase() as keyof typeof DEFAULT_SETTINGS.fileTypeCategories];
    const isDefaultExt = (ext: string) => defaults?.includes(ext);

    extensions.forEach(ext => {
      const chip = extContainer.createDiv({ cls: 'aoc-category-ext-chip' });
      const key = `${name}_${ext}`;
      const isChecked = !this.sessionUncheckedCustom.has(key);

      const checkbox = chip.createEl('input', { type: 'checkbox', cls: 'aoc-ext-checkbox' });
      checkbox.checked = isChecked;

      if (!isChecked) {
        chip.addClass('aoc-ext-chip-muted'); // CSS: opacity 0.4
      }

      checkbox.onchange = async () => {
        if (!checkbox.checked) {
          // 取消勾选
          this.sessionUncheckedCustom.add(key);
          chip.addClass('aoc-ext-chip-muted');
          if (!isDefaultExt(ext)) {
            // 手动扩展名：本次 session 不删除，下次 refreshDisplay 时删除
          }
        } else {
          // 重新勾选
          this.sessionUncheckedCustom.delete(key);
          chip.removeClass('aoc-ext-chip-muted');
        }
      };
    });
  }

  // 在 refreshDisplay 之前调用，清理手动扩展名
  private flushSessionUnchecked(): void {
    this.sessionUncheckedCustom.forEach(key => {
      const [name, ext] = key.split('_');
      const cat = name.toLowerCase();
      const arr = this.plugin.settings.fileTypeCategories[cat as keyof typeof this.plugin.settings.fileTypeCategories];
      if (arr) {
        const idx = arr.indexOf(ext);
        if (idx > -1) arr.splice(idx, 1);
      }
    });
    this.sessionUncheckedCustom.clear();
  }
}
```

**关键点**：
- 默认扩展名取消勾选 → 只记录到 `sessionUncheckedCustom`，不删除数组，`flushSessionUnchecked()` 时也跳过默认扩展名
- 手动扩展名取消勾选 → 记录到 `sessionUncheckedCustom`，下次 `refreshDisplay` 前调用 `flushSessionUnchecked()` 删除
- `flushSessionUnchecked()` 在 `FilterSettingsSection` 暴露一个公共方法，由 `settings.ts` 在创建 section 前调用

---

## 问题 3：Add 按钮移到 Image 同一行，增加类别间距

### 现状
add 按钮在 `new Setting(container)` 中独占一行，每个类别之间间距较大。

### 方案

**JS 改动**：`renderCategorySetting()` 中，add 按钮不再用 Setting wrapper，改为直接在 `extContainer` 末尾创建一个 inline 按钮：
```ts
// 在 extContainer 最后
const addBtn = extContainer.createEl('button', { cls: 'aoc-category-add-btn-inline', text: '+ add' });
addBtn.onclick = () => { new ExtensionInputModal(...).open(); };
```

**CSS 改动**：
```css
.aoc-category-exts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.aoc-category-add-btn-inline {
  font-size: var(--font-ui-smaller);
  padding: 2px 8px;
  margin-left: auto; /* 推到最右侧 */
  cursor: pointer;
  opacity: 0.7;
}
.aoc-category-add-btn-inline:hover {
  opacity: 1;
}
```

**类别间距**：增加 `.aoc-category-container` 的 `margin-bottom` 从 8px → 16px，拉开 Image 和下一行的距离。

---

## 问题 4：对齐问题

### 现状
- "Clean Rules" 用 `containerEl.createEl('h3', ...)` 直接创建，没有 Setting wrapper
- "Re-evaluate" 用 `new Setting(this.containerEl)` 创建
- 两者对齐基准不同，视觉上左边缘不一致
- "No rules configured" 在 `container` div 内，与 Clean Rules 标题也没对齐

### 方案

**全部统一用 Setting wrapper**：
```ts
addCleanRulesSetting(): void {
  // 用 Setting heading 替代 h3
  new Setting(this.containerEl).setName('Clean Rules').setHeading();

  this.addAllCleanRules();
  this.addReEvaluateButton();
}
```

**CSS 对齐**：
```css
.aoc-rules-list-container {
  width: 100%;
  box-sizing: border-box;
}
```

这样 Clean Rules heading、规则列表、Re-evaluate 按钮共享同一个 setting-item 的对齐基准。

---

## 问题 5：去掉第二行中的 "Folder:" 文字

### 现状
`formatRuleSummary` 输出：`Folder: Delete — parent_path contains xxx`

### 方案
改为只输出 trigger 摘要：
```ts
private formatRuleSummary(rule: CleanRule): string {
  const triggerText = rule.triggers.map(t => `${t.criteriaType} ${t.operator} ${t.value}`).join(' + ');
  return triggerText || 'No conditions';
}
```

Scope badge 和 Action badge 已在右侧单独展示，第二行不再重复。

---

## 问题 6：Rule 过长溢出

### 现状
当规则过多时，左侧 name+desc 和右侧 actions 区域会溢出 card 容器。

### 方案

**CSS 防护**：
```css
.aoc-clean-rule-card {
  min-width: 0; /* 允许 flex 子项收缩 */
}
.aoc-clean-rule-card-left {
  flex: 1;
  min-width: 0;
}
.aoc-clean-rule-actions {
  flex-shrink: 0;
  max-width: 240px; /* 限制右侧最大宽度 */
}
.aoc-clean-rule-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.aoc-clean-rule-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
```

**JS 改动**：给 name 和 desc 加 `title` 属性，鼠标悬停显示完整文本：
```ts
left.createEl('div', {
  cls: 'aoc-clean-rule-name',
  text: rule.name || 'Unnamed Rule',
}).setAttribute('title', rule.name || 'Unnamed Rule');
```

---

## 问题 7：Delete 改为两行标签

### 现状
右侧布局：`[Scope badge] [edit 按钮] [clone 按钮] [delete 按钮]`

### 方案
改为两行标签 + 图标按钮：

```
┌──────────────────────────────┬──────────────┐
│ My Rule Name                 │ 📁 Folder   │ ← 第一行：scope badge（紫色）
│ parent_path contains /tmp    │ 🗑 Delete   │ ← 第二行：action badge（Delete=红色, Skip=绿色）
│                              │ ✏️ 📄 🗑 ☑ │ ← 第三行：edit/clone/delete icons + toggle
└──────────────────────────────┴──────────────┘
```

**JS 改动**：
```ts
const actions = ruleContainer.createDiv({ cls: 'aoc-clean-rule-actions' });

// 第一行：scope badge
actions.createEl('span', { cls: 'aoc-rule-scope-badge', text: rule.scope ? this.scopeLabel(rule.scope) : '—' });

// 第二行：action badge
const actionBadge = actions.createEl('span', { cls: `aoc-rule-action-badge aoc-rule-action-badge-${rule.action || 'none'}` });
actionBadge.textContent = rule.action === 'delete' ? 'Delete' : rule.action === 'skip' ? 'Skip' : '—';

// 第三行：图标按钮 + toggle
s.addExtraButton(btn => btn.setIcon('pencil').setTooltip('Edit rule').onClick(() => this.openRuleEditor(rule)));
s.addExtraButton(btn => btn.setIcon('copy').setTooltip('Clone rule').onClick(() => this.cloneRule(rule)));
s.addExtraButton(btn => btn.setIcon('trash').setTooltip('Delete rule').onClick(() => this.deleteRule(rule)));
s.addToggle(toggle => toggle.setValue(rule.active).onChange(...));
```

**CSS 改动**：
```css
.aoc-rule-scope-badge {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  padding: 1px 8px;
  border-radius: 10px;
  font-size: var(--font-ui-smaller);
  flex-shrink: 0;
}

.aoc-rule-action-badge {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: var(--font-ui-smaller);
  flex-shrink: 0;
}
.aoc-rule-action-badge-delete {
  background: var(--background-modifier-error);
  color: var(--text-on-accent);
}
.aoc-rule-action-badge-skip {
  background: var(--background-modifier-success);
  color: var(--text-on-accent);
}

.aoc-clean-rule-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}
```

---

## 问题 8：按钮图标参考 ANM

### ANM 做法
- 用 `s.addExtraButton(btn => btn.setIcon('pencil').setTooltip('Edit rule')...)` 作为 extra button
- 用 `s.addExtraButton(btn => btn.setIcon('copy').setTooltip('Clone rule')...)`
- 用 `s.addExtraButton(btn => btn.setIcon('trash').setTooltip('Delete rule')...)`
- 用 `s.addToggle(...)` 作为 toggle
- 顺序：edit(pencil) → clone(copy) → delete(trash) → toggle

### 方案
按照问题 7 的方案，使用 `addExtraButton` + `setIcon` 替代文字按钮。所有 extra buttons 和 toggle 自动排列在 Setting 的 control 区域，无需手动管理布局。

---

## 问题 9：删除确认对话框

### 方案
新建 `src/modals/ConfirmModal.ts`（精简版），参考 ANM 的 ConfirmModal：

```ts
// src/modals/ConfirmModal.ts
import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
  private resolve: (value: boolean) => void = () => {};

  constructor(app: App, private title: string, private message: string) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.title);
    const { contentEl } = this;
    contentEl.createEl('p', { text: this.message, cls: 'aoc-confirm-message' });
    new Setting(contentEl)
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => { this.resolve(false); this.close(); }))
      .addButton(btn => btn.setButtonText('Delete').setWarning().setCta().onClick(() => { this.resolve(true); this.close(); }));
  }

  onClose(): void { this.contentEl.empty(); }

  static async show(app: App, title: string, message: string): Promise<boolean> {
    return new Promise(resolve => {
      const modal = new ConfirmModal(app, title, message);
      modal.resolve = resolve;
      modal.open();
      // 覆盖 resolve 方法
      const origResolve = modal.resolve;
      modal.resolve = (v: boolean) => { origResolve(v); resolve(v); };
    });
  }
}
```

**注意**：上面的 `static show` 写法有问题，正确写法：
```ts
static async show(app: App, title: string, message: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    class TempModal extends ConfirmModal {
      constructor(app: App, title: string, message: string, private _resolve: (v: boolean) => void) {
        super(app, title, message);
      }
      onOpen(): void {
        super.onOpen();
        // 重写 Close 按钮
        const settings = this.contentEl.querySelectorAll('.setting-item');
        // 更简单的方式：直接 new 一个内部类
      }
    }
    // 更简洁的做法：
    const modal = new ConfirmModal(app, title, message);
    // 在 onOpen 中设置 resolve
    const origOnOpen = modal.onOpen.bind(modal);
    modal.onOpen = () => {
      origOnOpen();
      // 修改 Delete 按钮的 onClick
      const delBtn = modal.contentEl.querySelector('.mod-warning') as HTMLElement;
      if (delBtn) {
        delBtn.onclick = () => { resolve(true); modal.close(); };
      }
    };
    modal.open();
  });
}
```

**实际更简洁的实现**（参考 ANM ConfirmModal 模式）：
```ts
export class ConfirmModal extends Modal {
  private resolvePromise: ((value: boolean) => void) | null = null;

  constructor(app: App, title: string, message: string, options?: { confirmText?: string; danger?: boolean }) {
    super(app);
    this.title = title;
    this.message = message;
    this.confirmText = options?.confirmText || 'Delete';
    this.danger = options?.danger ?? true;
  }

  onOpen(): void {
    this.titleEl.setText(this.title);
    // ... render message + buttons ...
  }

  confirm(): Promise<boolean> {
    return new Promise(resolve => { this.resolvePromise = resolve; this.open(); });
  }

  private setConfirmed(value: boolean): void {
    if (this.resolvePromise) this.resolvePromise(value);
    this.close();
  }

  static async show(app: App, title: string, message: string, options?: { confirmText?: string; danger?: boolean }): Promise<boolean> {
    const modal = new ConfirmModal(app, title, message, options);
    return modal.confirm();
  }
}
```

**删除按钮调用**：
```ts
s.addExtraButton(btn =>
  btn.setIcon('trash').setTooltip('Delete rule').onClick(async () => {
    const confirmed = await ConfirmModal.show(
      this.plugin.app,
      'Delete Rule',
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
  })
);
```

---

## 问题 10：Re-evaluate 实现完整功能

### 现状
`addReEvaluateButton()` 是 TODO placeholder，按钮点击后瞬间闪回，无实际效果。

### 方案

**需要做的事**：
1. 遍历 `cleanRules`，对每个 rule 用 `CleanRuleMatcher` 评估
2. 收集所有匹配的文件/文件夹
3. 展示一个预览 Modal，列出将被删除/跳过的项目

**具体实现**：

在 `CleanRulesSection.addReEvaluateButton()` 中：
```ts
private addReEvaluateButton(): void {
  new Setting(this.containerEl)
    .setName('Re-evaluate vault with current rules')
    .setDesc('Preview which files and folders will be affected by your current Clean Rules.')
    .addButton(btn =>
      btn.setButtonText('Re-evaluate').setCta().onClick(async () => {
        btn.setButtonText('Scanning…').setDisabled(true);
        try {
          // 1. 获取 vault 中的所有文件
          const allFiles = this.plugin.app.vault.getFiles();
          const allFolders = new Set<string>();
          allFiles.forEach(f => {
            const parts = f.parent?.path.split('/');
            if (parts) {
              let path = '';
              parts.forEach((p, i) => {
                if (i < parts.length - 1) {
                  path += (path ? '/' : '') + p;
                  allFolders.add(path);
                }
              });
            }
          });

          // 2. 对每个 rule 评估
          const matches: { type: 'file' | 'folder'; path: string; rule: string; action: string }[] = [];
          for (const rule of this.plugin.settings.cleanRules) {
            if (!rule.active || !rule.scope || !rule.action) continue;
            for (const file of allFiles) {
              const matched = this.evaluateRuleAgainstFile(rule, file);
              if (matched) {
                matches.push({
                  type: 'file',
                  path: file.path,
                  rule: rule.name,
                  action: rule.action,
                });
              }
            }
            for (const folder of allFolders) {
              const matched = this.evaluateRuleAgainstPath(rule, folder);
              if (matched) {
                matches.push({
                  type: 'folder',
                  path: folder,
                  rule: rule.name,
                  action: rule.action,
                });
              }
            }
          }

          // 3. 展示预览 Modal
          if (matches.length > 0) {
            new PreviewCleanModal(this.plugin.app, matches).open();
          } else {
            new Notice('No files matched any rule.');
          }
        } finally {
          btn.setButtonText('Re-evaluate').setDisabled(false);
        }
      })
    );
}

// 简易评估函数（复用 CleanRuleMatcher 的逻辑）
private evaluateRuleAgainstFile(rule: CleanRule, file: TFile): boolean {
  // 调用 CleanRuleMatcher.evaluateTrigger 或内联评估逻辑
  // ...
}
```

**更简洁的做法**：直接复用已有的 `CleanRuleMatcher`：
```ts
const matcher = new CleanRuleMatcher(this.plugin.app, this.plugin.settings);
const results = await matcher.preview(); // 新增方法
```

需要在 `CleanRuleMatcher.ts` 中新增 `preview()` 方法，返回匹配结果。

**PreviewCleanModal**（已有 `src/modals/PreviewCleanModal.ts`）需要接收匹配结果并展示：
```ts
// PreviewCleanModal.ts
export class PreviewCleanModal extends Modal {
  constructor(app: App, private matches: MatchResult[]) {
    super(app);
    this.titleEl.setText('Preview: Files Affected by Clean Rules');
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('p', { text: `${this.matches.length} items matched.` });
    const list = contentEl.createDiv({ cls: 'aoc-preview-list' });
    this.matches.forEach(m => {
      const item = list.createDiv({ cls: 'aoc-preview-item' });
      item.createEl('span', { text: m.path, cls: 'aoc-preview-path' });
      item.createEl('span', { text: `→ ${m.rule} (${m.action})`, cls: 'aoc-preview-rule' });
    });
  }
}
```

---

## 问题 11：Notification level 和 Run on startup 移到 Triggers 里面

### 现状
```
⚙️ Settings
  ── Triggers (heading)
     Enable on-edit trigger
     Enable periodic clean
     Periodic clean interval (conditional)
  ── Deleted Files (heading)
     Deletion destination
     Obsidian trash cleanup age (conditional)
     Preview deleted files
     Close new tabs after clean
  ── Notifications (heading)
     Notification level
  ── Startup (heading)
     Run on startup
```

### 目标
```
⚙️ Settings
  ── Triggers (heading)
     Enable on-edit trigger
     Enable periodic clean
     Periodic clean interval (conditional)
     Notification level          ← 移动到这里
     Run on startup              ← 移动到这里
  ── Deleted Files (heading)
     Deletion destination
     Obsidian trash cleanup age (conditional)
     Preview deleted files
     Close new tabs after clean
```

### 方案
从 `settings.ts` 中：
1. 删除 `// Notifications` heading 及其 Setting
2. 删除 `// Startup` heading 及其 Setting
3. 将 Notification level dropdown 和 Run on startup toggle 的代码剪切，粘贴到 `enablePeriodicClean` 的 `if` 块之后（即在 Triggers 区域内）

```ts
// Deleted Files section 保持不变

// Notifications heading + setting → 删除
// Startup heading + setting → 删除

// 在 Triggers 区域的 enablePeriodicClean if 块之后，添加：
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
```

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `settings.ts` | 删除 FilterSettingsSection 的 blacklist 调用（或直接不调用）；删除 Notifications/Startup heading，移动 Notification level + Run on startup 到 Triggers 区域 |
| `FilterSettingsSection.ts` | 删除 `addBlacklistFilterList()`；checkbox session 级别隐藏逻辑（默认扩展名不删，手动扩展名 flush 时删）；add 按钮移到 exts 同行 |
| `CleanRulesSection.ts` | 用 `Setting.setName().setHeading()` 替代 `h3`；按钮改图标（addExtraButton + setIcon）；两行标签布局（scope/action badges）；删除加 ConfirmModal；overflow 防护 |
| `ConfirmModal.ts` | **新建**：轻量确认对话框 |
| `PreviewCleanModal.ts` | **修改**：接收匹配结果并展示列表 |
| `CleanRuleMatcher.ts` | **新增** `preview()` 方法（或 `evaluateVault()`），返回匹配结果 |
| `styles.css` | scope badge 紫色；action badge 样式；对齐修复；溢出防护；checkbox 视觉淡化样式；类别间距 |

---

## 实施顺序

1. **问题 11**：Notification level + Run on startup 移到 Triggers（settings.ts 内部移动，最安全）
2. **问题 1**：删除 Blacklist filters（FilterSettingsSection）
3. **问题 2**：checkbox session 级别隐藏逻辑（FilterSettingsSection）
4. **问题 3**：Add 按钮同行化（FilterSettingsSection + CSS）
5. **问题 4**：对齐修复（CleanRulesSection heading 改用 Setting + CSS）
6. **问题 5**：formatRuleSummary 简化（去掉 scope/action 文字）
7. **问题 6**：overflow 防护（CSS min-width: 0 + max-width）
8. **问题 7+8**：两行标签 + 图标按钮（CleanRulesSection 布局重构）
9. **问题 9**：删除确认对话框（新建 ConfirmModal.ts）
10. **问题 10**：Re-evaluate 完整功能（CleanRuleMatcher.preview() + PreviewCleanModal 更新）
11. **Build + Deploy**
