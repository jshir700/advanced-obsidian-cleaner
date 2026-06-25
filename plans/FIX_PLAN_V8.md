# advanced-obsidian-cleaner — 问题分析方案 V8

---

## 问题 1：Rule Editor conditions 默认选中 parent_path/contains

### 代码逐行分析

**步骤 1：构造函数**
```ts
this.workingRule = JSON.parse(JSON.stringify(options.rule));
```
新建 rule 时，`options.rule` 是：
```ts
{ name: 'New Rule', active: true, aggregation: 'all',
  triggers: [{ criteriaType: 'parent_path', operator: 'contains', value: '' }],
  action: null, scope: null }
```
→ `workingRule.triggers[0]` 的 `criteriaType = 'parent_path'`, `operator = 'contains'`。

**步骤 2：createContent()**
```ts
if (this.workingRule.triggers.length === 0) {
  this.workingRule.triggers.push({ criteriaType: '', operator: '', value: '' });
}
```
→ triggers 长度为 1（不为 0），所以**不会** push 空值 trigger。

**步骤 3：createScopeSelector()**
```ts
dropdown.setValue(this.workingRule.scope ?? '');  // scope 是 null → 设 ''
```
→ dropdown 选中 `-- Select Scope --`。

**步骤 4：createConditionsSection() → renderTriggers()**
```ts
const effectiveScope = this.workingRule.scope || 'folder';  // scope 是 null → 用 'folder'
this.workingRule.triggers.forEach((trigger, index) => {
  this.createTriggerRow(this.triggersContainer, trigger, index, effectiveScope);
});
```
→ trigger 是 `criteriaType: 'parent_path', operator: 'contains'`（来自步骤 1 的默认值）。

**步骤 5：createTriggerRow()**
```ts
criteriaSelect.createEl('option', { value: '', text: '-- Select --' });
criteriaTypes.forEach(ct => {
  const opt = criteriaSelect.createEl('option', { value: ct, text: ct });
  if (trigger.criteriaType === ct) opt.selected = true;  // 'parent_path' === 'parent_path' → selected!
});
```
→ **parent_path 被选中**。operator 同理。

### 根因
新建 rule 时，`CleanRulesSection` 传的初始值里 triggers 已经硬编码了 `{ criteriaType: 'parent_path', operator: 'contains', value: '' }`。`createContent()` 的空值初始化只在 `triggers.length === 0` 时才执行，但这里 length 是 1，所以跳过了。

### 方案
**两处都要改**：
1. `CleanRulesSection.ts` 中，新建 rule 时 triggers 传空数组 `[]`：
   ```ts
   triggers: [],  // 而不是 [{ criteriaType: 'parent_path', operator: 'contains', value: '' }]
   ```
2. `CleanRuleEditorModal.ts` 中 `createContent()` 的空值初始化逻辑保持不变（triggers 为空时 push 一个空 trigger）。

---

## 问题 2：新建 rule 时 Cancel/Save 按钮位置

### 代码分析

`createFooterActions()`:
```ts
const footer = container.createDiv({ cls: 'aoc-rule-editor-footer' });

if (this.ruleOptions.isEditMode && this.ruleOptions.onDelete) {
  const leftSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-left' });
  const leftButtons = this.createButtonContainer(leftSide);
  this.createButton(leftButtons, 'Delete Rule', ..., { isWarning: true });
}

const rightSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-right' });
const rightButtons = this.createButtonContainer(rightSide);
this.createButton(rightButtons, 'Cancel', ...);
this.createButton(rightButtons, 'Save', ...);
```

CSS：
```css
.aoc-rule-editor-footer {
  display: flex;
  justify-content: space-between;  /* left 和 right 分居两端 */
}
.aoc-rule-editor-footer-left,
.aoc-rule-editor-footer-right {
  display: flex;
  gap: 16px;
  align-items: center;
}
```

**新建 rule 时**：`isEditMode = false`，所以 leftSide 不创建。footer 里只有 rightSide（Cancel + Save）。

`justify-content: space-between` 在只有一个子元素（rightSide div）时，**rightSide div 会靠左对齐**（因为没有 leftSide 来推它到右边）。

### 根因
新建 rule 时没有 leftSide div，footer 只有一个子元素 `.aoc-rule-editor-footer-right`，`space-between` 无效，按钮靠左显示。

### 方案
footer 结构改为：始终创建 leftSide 和 rightSide，即使 leftSide 为空：
```ts
const footer = container.createDiv({ cls: 'aoc-rule-editor-footer' });

// Left side (always exists, but may be empty)
const leftSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-left' });
if (this.ruleOptions.isEditMode && this.ruleOptions.onDelete) {
  const leftButtons = this.createButtonContainer(leftSide);
  this.createButton(leftButtons, 'Delete Rule', ..., { isWarning: true });
}

// Right side
const rightSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-right' });
const rightButtons = this.createButtonContainer(rightSide);
this.createButton(rightButtons, 'Cancel', ...);
this.createButton(rightButtons, 'Save', ...);
```

CSS 加：
```css
.aoc-rule-editor-footer-left:empty {
  flex: 1;  /* 占满左侧空间，把 rightSide 推到最右 */
}
```

---

## 问题 3：编辑按钮和删除按钮调换位置

### 现状
DOM 顺序：edit → clone → delete
CSS：`.aoc-rule-actions-inline { flex-direction: row-reverse; }`

`row-reverse` 把 DOM 顺序反转，所以视觉上从左到右是：delete → clone → edit。

**用户想要**：从左到右是 edit → clone → delete（和 DOM 顺序一致，去掉 row-reverse）。

### 方案
- 去掉 CSS 中的 `flex-direction: row-reverse`
- 调整 DOM 顺序为：delete → clone → edit（这样视觉上从左到右就是 delete/clone/edit）

或者更简单：
- 去掉 `row-reverse`
- DOM 顺序保持 edit/clone/delete，视觉上从左到右就是 edit/clone/delete

---

## 问题 4：删除按钮 hover 时图标变红

### 根因
CSS：
```css
.aoc-rule-action-btn.mod-warning:hover {
  background: var(--background-modifier-error-hover);
  color: var(--text-error);  /* ← 图标变红 */
}
```

### 方案
去掉 `color: var(--text-error)`，hover 时只改背景：
```css
.aoc-rule-action-btn.mod-warning:hover {
  background: var(--background-modifier-error-hover);
  /* 不改变 color，图标保持原色 */
}
```

---

## 问题 5：Folder/Delete 标签美化

### 当前样式
```css
.aoc-rule-scope-badge {
  padding: 1px 8px;
  font-size: var(--font-ui-smaller);
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-radius: 10px;
}
```

### 优化后效果

**修改前**：
```
[Folder]  My Rule Name
[Delete]  parent_path contains /tmp
```
标签是纯背景色胶囊，看起来像一个按钮。

**修改后**：
```
┌──────────┐ My Rule Name
│ 📁 Folder│ parent_path contains /tmp
└──────────┘
┌──────────┐
│ 🗑 Delete│
└──────────┘
```

**具体 CSS 改动**：
```css
.aoc-rule-scope-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  font-size: var(--font-ui-smaller);
  font-weight: 600;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-radius: 6px;
  border: 1px solid var(--interactive-accent);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  letter-spacing: 0.02em;
}

.aoc-rule-action-badge-delete {
  background: var(--background-modifier-error);
  border-color: var(--background-modifier-error);
  color: var(--text-on-accent);
}

.aoc-rule-action-badge-skip {
  background: var(--background-modifier-success);
  border-color: var(--background-modifier-success);
  color: var(--text-on-accent);
}
```

效果：更精致的胶囊标签，有边框、微阴影、加粗字体，视觉上更像"标签"而非"按钮"。

---

## 问题 6：Re-evaluate 弹出对话框美化

### 当前样式
`PreviewCleanModal` 继承 `Modal`（不是 `BaseModal`），用 `contentEl.createEl('h2', ...)` 直接创建标题，没有尺寸控制、没有 padding、没有滚动重置。tabs 和列表也没有专门的 CSS 样式。

### 优化后效果

**修改前**：
```
╔═══════════════════════════════════╗
║ Preview: Cleanup Results          ║  ← 标题无样式
╠═══════════════════════════════════╣
║ 📄 5 files will be deleted        ║  ← 纯文本
║ 📁 2 folders will be deleted      ║
║ ⏭️ 10 files will be skipped       ║
║                                   ║
║ [Files] [Folders] [Skipped]       ║  ← 按钮无样式
║                                   ║
║ 🗑️ /path/to/file1                 ║  ← 列表无样式
║ 🗑️ /path/to/file2                 ║
║                                   ║
║ [Cancel]                    [Apply Clean] ║  ← 按钮无样式
╚═══════════════════════════════════╝
```

**修改后**：
```
╔═══════════════════════════════════════════╗
║ 🧹  Preview: Cleanup Results              ║  ← BaseModal 标题样式
╠═══════════════════════════════════════════╣
║                                           ║
║  Summary                                  ║  ← 分区标题
║  ┌─────────────────────────────────────┐  ║
║  │ 📄 5 files · 📁 2 folders · ⏭️ 10 skipped │  ║  ← 摘要卡片
║  └─────────────────────────────────────┘  ║
║                                           ║
║  [Files] [Folders] [Skipped]              ║  ← 带样式的 tab
║  ───────────────────────────────────────  ║
║  🗑️ /path/to/file1    ↳ Rule: "Old files"  ║  ← 列表项卡片
║  🗑️ /path/to/file2    ↳ Rule: "Temp files" ║
║                                           ║
║                            [Cancel] [Apply] ║  ← 底部按钮
╚═══════════════════════════════════════════╝
```

**具体改动**：
1. `PreviewCleanModal` 继承 `BaseModal`，设 `size: 'large'`，`cssClass: 'aoc-preview-modal'`
2. 用 `BaseModal.createTitle()` 渲染标题（可选加 titleIcon）
3. 用 `BaseModal.createSection()` 渲染 summary/tabs/content
4. 用 `BaseModal.createButton()` 渲染 footer 按钮
5. CSS 新增：
   ```css
   .aoc-preview-modal { padding: 20px 0; }
   .aoc-preview-summary {
     display: flex; gap: 16px; padding: 12px 16px;
     background: var(--background-secondary);
     border-radius: 6px; border: 1px solid var(--background-modifier-border);
     margin-bottom: 16px;
   }
   .aoc-preview-tab-btn {
     padding: 6px 16px; border: 1px solid var(--background-modifier-border);
     background: var(--background-primary); border-radius: 4px; cursor: pointer;
   }
   .aoc-preview-tab-btn.is-active {
     background: var(--interactive-accent); color: var(--text-on-accent);
     border-color: var(--interactive-accent);
   }
   .aoc-preview-list-item {
     display: flex; align-items: center; gap: 8px;
     padding: 8px 12px; border-bottom: 1px solid var(--background-modifier-border);
   }
   ```

---

## 问题 7：File Type Categories 取消勾选后退出重进又被勾选

### 代码流程分析

**步骤 1：用户取消勾选 jpg**
```ts
checkbox.onchange = () => {
  if (!checkbox.checked) {
    this.sessionUncheckedCustom.add(key);  // key = "Image_jpg"
    chip.addClass('aoc-ext-chip-muted');
  }
};
```
→ `sessionUncheckedCustom` 包含 `"Image_jpg"`，**但数组没有被修改**。

**步骤 2：用户离开设置页，触发 refreshDisplay → display()**
```ts
// settings.ts
const filterSection = new FilterSettingsSection(this.plugin, containerEl, () => this.display());
filterSection.flushSessionUnchecked();  // ← 这里！
filterSection.addFilterSettings();
```

**步骤 3：flushSessionUnchecked()**
```ts
flushSessionUnchecked(): void {
  for (const key of this.sessionUncheckedCustom) {
    // key = "Image_jpg"
    const name = key.substring(0, underscoreIdx);  // "Image"
    const ext = key.substring(underscoreIdx + 1);   // "jpg"
    const catKey = name.toLowerCase();  // "image"
    const arr = this.plugin.settings.fileTypeCategories[catKey];
    const idx = arr.indexOf(ext);  // arr = ['jpg', 'jpeg', ...]
    if (idx > -1) arr.splice(idx, 1);  // ← 从数组中删除 jpg
  }
  this.plugin.saveSettings();
  this.sessionUncheckedCustom.clear();
}
```
→ `jpg` 从 `fileTypeCategories.image` 数组中被删除。

**步骤 4：addFileTypeCategories()**
```ts
this.sessionUncheckedCustom.clear();  // ← 清空 session 跟踪
```
→ 但此时 `this.plugin.settings.fileTypeCategories.image` 已经被 `flushSessionUnchecked()` 删除了 `jpg`。

**步骤 5：renderCategorySetting('Image', categories.image, defaults.image)**
```ts
const categories = this.plugin.settings.fileTypeCategories;  // jpg 已被删除！
const defaults = DEFAULT_SETTINGS.fileTypeCategories;        // defaults.image 仍包含 jpg
this.renderCategorySetting('Image', categories.image, defaults.image);
```
→ `extensions` 参数是 `categories.image`（已不含 jpg），所以 jpg 不会被渲染。

**等等——那为什么用户说"又被勾选上了"？**

重新看步骤 3：`flushSessionUnchecked()` 只在**每次 display() 时**被调用一次。但 `addFileTypeCategories()` 中 `this.sessionUncheckedCustom.clear()` 也在每次 `addFileTypeCategories()` 时被调用。

**关键问题**：`flushSessionUnchecked()` 在 `settings.ts` 中：
```ts
filterSection.flushSessionUnchecked();
filterSection.addFilterSettings();
```
而 `addFileTypeCategories()` 中：
```ts
this.sessionUncheckedCustom.clear();
```

如果用户在设置页中取消了勾选 jpg，然后**没有离开设置页**（即没有触发 `refreshDisplay`），那么 `sessionUncheckedCustom` 包含 `"Image_jpg"`，但 `flushSessionUnchecked()` 还没被调用，jpg 还在数组中。

但如果用户**切换了设置标签页再切回来**，`display()` 被调用 → `flushSessionUnchecked()` 被调用 → jpg 从数组中删除 → `sessionUncheckedCustom.clear()` → 下次打开设置页时 jpg 不会再出现（因为已从数组删除）。

**那"退出重进又被勾选"的情况是什么？**

可能的原因：
1. `flushSessionUnchecked()` 调用时，`this.plugin.settings.fileTypeCategories` 可能还没从磁盘加载最新数据（`loadSettings()` 是异步的，但 `display()` 是同步的）
2. 或者 `flushSessionUnchecked()` 中 `this.plugin.saveSettings()` 失败了（异步未 await）

**再看代码**：
```ts
flushSessionUnchecked(): void {
  // ...
  this.plugin.saveSettings();  // ← 没有 await！
  this.sessionUncheckedCustom.clear();
}
```

`saveSettings()` 返回 `Promise<void>`，但没有 await。如果 saveSettings 还没完成，`this.plugin.settings` 可能还是旧数据。

**但更根本的问题**：`flushSessionUnchecked()` 在 `display()` 中被调用，此时 `this.plugin.settings` 是**内存中的旧数据**（上一次 saveSettings 完成后的数据）。如果 `flushSessionUnchecked()` 修改了 `this.plugin.settings.fileTypeCategories` 但 saveSettings 还没完成，然后用户又做了其他操作，数据可能不一致。

**另一个可能**：`flushSessionUnchecked()` 中 `this.plugin.settings.fileTypeCategories` 和 `DEFAULT_SETTINGS.fileTypeCategories` 是**不同的对象引用**。如果用户之前手动添加了扩展名，这些扩展名在 `this.plugin.settings.fileTypeCategories` 中但不在 `DEFAULT_SETTINGS` 中。`flushSessionUnchecked()` 只检查 `sessionUncheckedCustom` 中的 key，而 key 的格式是 `"Image_jpg"`，其中 `Image` 是类别名。如果用户取消了勾选 jpg，`sessionUncheckedCustom` 包含 `"Image_jpg"`，`flushSessionUnchecked()` 会从 `this.plugin.settings.fileTypeCategories.image` 中删除 jpg。

**但**：`addFileTypeCategories()` 中 `this.sessionUncheckedCustom.clear()` 在 `flushSessionUnchecked()` 之后被调用。所以 `sessionUncheckedCustom` 被清空了，但 jpg 已经从数组中删除了。下次打开设置页时，jpg 不会出现在 `extensions` 参数中（因为它已被删除），所以不会被渲染。

**结论**：如果用户说"退出重进又被勾选"，最可能的原因是：
1. `flushSessionUnchecked()` 中的 `saveSettings()` 没有 await，导致数据未持久化
2. 或者用户取消勾选后**没有离开设置页**，`flushSessionUnchecked()` 未被调用，jpg 仍在数组中，退出重进后从磁盘加载了旧数据

**修复方向**：
- `flushSessionUnchecked()` 中 `await this.plugin.saveSettings()`
- 或者：不在 `flushSessionUnchecked()` 中修改数组，而是在 `renderCategorySetting` 中根据 `sessionUncheckedCustom` 决定是否渲染每个 chip

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `CleanRulesSection.ts` | 新建 rule 时 triggers 传空数组 `[]` |
| `CleanRuleEditorModal.ts` | footer 始终创建 leftSide（空时 flex: 1 占位）；去掉 row-reverse；删除按钮 hover 不改变颜色 |
| `PreviewCleanModal.ts` | 继承 BaseModal，用 BaseModal 方法渲染；美化 summary/tabs/list/footer |
| `styles.css` | 1. badges 标签美化 2. PreviewCleanModal 样式 3. 去掉 row-reverse 4. 删除按钮 hover 不红 |

---

## 实施顺序

1. **Q1**：CleanRulesSection 新建 rule 时 triggers 传 `[]`
2. **Q2**：footer 始终创建 leftSide，CSS `:empty { flex: 1 }`
3. **Q3**：去掉 `row-reverse`，DOM 顺序改为 delete/clone/edit
4. **Q4**：删除按钮 hover 去掉 `color: var(--text-error)`
5. **Q5**：badges 标签美化（边框、阴影、加粗）
6. **Q6**：PreviewCleanModal 继承 BaseModal + 完整 CSS
7. **Q7**：flushSessionUnchecked 中 await saveSettings
8. **Build + Deploy**
