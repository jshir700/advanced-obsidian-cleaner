# advanced-obsidian-cleaner — 完整修复方案

## 问题 1：Deletion destination 和 Preview deleted files 之间有大空白

### 根因
`toggleVisibility(false)` 设置 `display: none`，但 Obsidian 的 `.setting-item` 有固定 `min-height`（~44px）和 padding，隐藏后空间仍被占位。隐藏的元素和下一个 Setting 之间出现空白间隙。

### 修复方案
用包装 div 包裹整个 trash cleanup age 设置项：
```ts
const trashWrapper = containerEl.createDiv({ cls: 'aoc-trash-cleanup-wrapper' });
const trashSetting = new Setting(trashWrapper).setName(...).addText(...);
trashWrapper.style.display = this.plugin.settings.deletionDestination === 'obsidian' ? '' : 'none';
```
隐藏/显示整个 wrapper div 而非单个 setting-item，确保零占位。deletionDestination onChange 中更新 `wrapper.style.display` 而非重建整个 tab。

---

## 问题 2：File Type Categories 扩展名改为 checkbox

### 现状
每个扩展名显示为 chip + `×` 删除按钮。

### 改为 checkbox 列表
- 每个类别下方用 `<input type="checkbox">` 列出该类别的所有扩展名
- 默认全部 checked（表示该扩展名在类别中，参与匹配）
- 取消勾选 = 从数组中移除该扩展名
- 重新勾选 = 将该扩展名添加回数组
- 视觉上保持 chip 样式，checkbox 用 CSS 隐藏，用自定义样式化的 checkbox 外观替代
- 每个类别末尾保留一个 "+ add" 按钮（用 Obsidian `requestInput()` 替代 `prompt()`）

### 修改文件
- `FilterSettingsSection.ts` — `renderCategorySetting()` 改为渲染 checkbox 列表
- `styles.css` — 新增 checkbox chip 样式

---

## 问题 3：File Type Categories add 按钮无反应

### 根因
`prompt()` 在 Obsidian/Electron 插件 Setting 回调中可能不可靠。更关键的是 `btn.onClick()` 回调中 `await addExtension()` 保存后立刻 `refreshDisplay()`，但 Obsidian 的 Setting 事件冒泡可能干扰异步操作。

### 修复方案
用 Obsidian 内置的 `requestInput()` API 替代 `prompt()`：
```ts
btn.onClick(async () => {
  const ext = this.app.workspace.triggerEvent('open-request-input', `Enter extension for ${name}:`);
  // 或使用自定义 Modal 做输入
});
```
如果 `requestInput` 不可用，则创建一个轻量级的 `Modal` 做单行输入。确保 `refreshDisplay()` 在 `saveSettings()` 完成后再调用。

---

## 问题 4：Clean Rules 合并 + Action/Scope 改为可选但保存时必填

### 4a. 合并 Folders/Markdowns/Attachments 为统一列表

**修改文件**：`src/settings/CleanRulesSection.ts`

- 删除 `addFoldersCleanRules()`、`addMarkdownsCleanRules()`、`addAttachmentsCleanRules()` 三个方法
- 新增 `addAllCleanRules()` 方法，渲染所有 rules（不再按 scope 分组）
- 每个 rule card 中显示 scope 标签（如 "Folder"、"Markdown"、"Attachment"）
- "No rules configured. Add one using the button below." 和 "+ add rule" 按钮放在同一行（见问题 5）

### 4b. 类型定义变更

**修改文件**：`src/types/CleanRule.ts`

```ts
export interface CleanRule {
  name: string;
  active: boolean;
  aggregation: AggregationType;
  triggers: CleanTrigger[];
  action: CleanAction | null;      // ← 改为可选
  scope: CleanScope | null;        // ← 改为可选（仍叫 scope）
}
```

### 4c. 默认值变更

**修改文件**：`src/settings.ts` → `DEFAULT_SETTINGS`

- `cleanRules` 初始化为空数组（不变）
- 新增 rule 时的默认值：`action: null`, `scope: null`

### 4d. Rule Editor Modal 变更

**修改文件**：`src/modals/CleanRuleEditorModal.ts`

- **Action 下拉框**：增加空选项 `-- Select Action --`（value = ''），默认选中
  ```ts
  dropdown.addOption('', '-- Select Action --');
  dropdown.addOption('delete', 'Delete');
  dropdown.addOption('skip', 'Skip');
  dropdown.setValue(this.workingRule.action ?? '');
  ```
- **新增 Scope 下拉框**（在 Action 下方）：
  ```ts
  new Setting(container)
    .setName('Scope')
    .setDesc('Which file type this rule applies to.')
    .addDropdown(dropdown =>
      dropdown
        .addOption('', '-- Select Scope --')
        .addOption('folder', 'Folders')
        .addOption('markdown', 'Markdowns')
        .addOption('attachment', 'Attachments')
        .setValue(this.workingRule.scope ?? '')
        .onChange(value => { this.workingRule.scope = value || null; })
    );
  ```
- **Scope 变化时重新渲染 triggers**：当 Scope 改变后，重新渲染条件列表（criteriaTypes 随 scope 变化）
- **validateRule()** 增加 action 和 scope 非空校验：
  ```ts
  if (!this.workingRule.action) {
    new Notice('Please select an Action.');
    return false;
  }
  if (!this.workingRule.scope) {
    new Notice('Please select a Scope.');
    return false;
  }
  ```
- 保存时如果 action 或 scope 为空，阻止保存并提示

### 4e. CleanRulesSection 打开编辑器时传 null

**修改文件**：`src/settings/CleanRulesSection.ts`

```ts
// 新增 rule 时
this.openRuleEditor({
  name: 'New Rule',
  active: true,
  aggregation: 'all',
  triggers: [{ criteriaType: 'parent_path', operator: 'contains', value: '' }],
  action: null,    // ← 默认空
  scope: null,     // ← 默认空
}, 'folder');  // 传一个临时 scope 用于渲染 modal 中的 triggers 列表，save 时会覆盖
```

注意：打开 modal 时需要一个临时的 scope 来渲染 trigger 列表（因为 trigger row 需要根据 scope 获取 criteriaTypes）。可以在 modal 内部用 `workingRule.scope ?? 'folder'` 作为 fallback。

---

## 问题 5：No rules configured 和 add rule 按钮同行

### 根因
当前 empty state 用 `container.createEl('p', {...})` 创建段落，add rule 用 `new Setting(container).addButton(...)` 创建独立 Setting，自然分两行。

### 修复方案
放在同一个 Setting 中：
```ts
new Setting(container)
  .setDesc('No rules configured. Add one using the button below.')
  .addButton(btn =>
    btn.setButtonText('+ add rule').setCta().onClick(...)
  );
```
利用 `setDesc()` 放提示文字 + `addButton()` 放按钮，自然同行。

---

## 问题 6：Cancel 和 Save 按钮太近

### 根因
footer CSS 中 `.aoc-rule-editor-footer-left, .aoc-rule-editor-footer-right` 的 `gap: 8px` 太小。

### 修复方案
- footer 左右两侧按钮组之间的间距：`.aoc-rule-editor-footer { gap: 16px; }`（已有 `justify-content: space-between`，主要问题在右侧 Cancel/Save 之间）
- 右侧按钮容器增大 gap：`.aoc-rule-editor-footer-right { gap: 12px; }`（从 8px 改为 12px）

---

## 问题 7：Save 按钮未保存规则

### 根因（关键 bug）
`CleanRulesSection.openRuleEditor()` 的 `onSave` 回调使用引用比较：
```ts
const idx = this.plugin.settings.cleanRules.findIndex(r => r === rule);
```
但 `CleanRuleEditorModal` 中做了 `JSON.parse(JSON.stringify(options.rule))` 深拷贝，所以 `workingRule` 和原始 `rule` 是**不同引用**。`findIndex(r => r === rule)` 永远返回 `-1`，规则永远不会被替换。

**同时**：新增 rule 时（`isEditMode = false`），`findIndex` 同样返回 `-1`，所以新增的规则也永远不会被 push 进去。

### 修复方案
改用名称匹配 + 新增判断：
```ts
onSave: async (updatedRule: CleanRule) => {
  const existingIdx = this.plugin.settings.cleanRules.findIndex(
    r => r.name === rule.name && r.scope === rule.scope
  );
  if (existingIdx > -1) {
    // 编辑模式：替换
    this.plugin.settings.cleanRules[existingIdx] = updatedRule;
  } else {
    // 新增模式：添加
    this.plugin.settings.cleanRules.push(updatedRule);
  }
  await this.plugin.saveSettings();
  this.refreshDisplay();
}
```

---

## 问题 8：设置界面未适配窗口尺寸变化和移动端

### 根因
1. `BaseModal` 用 `!important` 内联样式设置尺寸，但没有 resize listener
2. `FileCleanerSettingTab` 没有应用 mobile class 或响应式 CSS
3. `styles.css` 只有 modal 内部的响应式样式，没有 setting tab 内组件的响应式样式
4. `BaseModal` 的 `clearModalSizeStyles()` 在 `onClose` 中调用，但如果用户点遮罩层关闭，可能不走 `close()` 方法

### 修复方案

#### 8a. BaseModal 增加 resize 适配
```ts
// BaseModal.ts onOpen() 中增加
protected onOpen(): void {
  // ...现有代码...
  this.setupResizeHandler();
}

private setupResizeHandler(): void {
  // 移动端检测变化时清除固定尺寸
  this.resizeHandler = () => {
    if (MobileUtils.isMobile() && this.options.size) {
      this.clearModalSizeStyles();
      // 重新应用 mobile 全屏样式
    }
  };
  window.addEventListener('resize', this.resizeHandler);
}

// onClose 中清理
protected clearModalSizeStyles(): void {
  // ...现有代码...
  if (this.resizeHandler) {
    window.removeEventListener('resize', this.resizeHandler);
  }
}
```

#### 8b. SettingTab 增加 mobile class
```ts
// settings.ts display() 开头
display(): void {
  const { containerEl } = this;
  containerEl.empty();
  containerEl.addClass('aoc-settings-root');
  // ...
}
```

#### 8c. styles.css 补充响应式样式

```css
/* Rule card 响应式 */
@media (max-width: 768px) {
  .aoc-clean-rule-card {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 12px;
  }
  .aoc-clean-rule-actions {
    width: 100%;
    justify-content: space-between;
  }
}

/* Category container 响应式 */
@media (max-width: 768px) {
  .aoc-category-container {
    padding: 8px;
  }
  .aoc-category-exts {
    gap: 4px;
  }
}
```

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `styles.css` | **重写** | 删除 filter/chip 旧样式，新增 checkbox chip、空行合并、按钮间距、响应式样式 |
| `src/types/CleanRule.ts` | **修改** | `action: CleanAction \| null`，`scope: CleanScope \| null` |
| `src/settings.ts` | **修改** | DEFAULT_SETTINGS 中 action/scope 默认为 null；deletion destination onChange 加 display()；trash cleanup 用 wrapper div |
| `src/settings/CleanRulesSection.ts` | **大幅修改** | 合并三个 scope 为一个列表；empty + add 同行；onSave 改用名称匹配 |
| `src/settings/FilterSettingsSection.ts` | **大幅修改** | categories 改为 checkbox 列表；add 按钮用 requestInput/Modal 替代 prompt |
| `src/modals/CleanRuleEditorModal.ts` | **大幅修改** | Action/Scope 下拉框默认空选项；scope 变化重渲染 triggers；validateRule 增加 action/scope 非空校验 |
| `src/modals/BaseModal.ts` | **修改** | 增加 resize handler 和清理 |

---

## 实施顺序

1. **P0 — 问题 7**：修复 onSave 引用比较 bug（最快，影响最大）
2. **P0 — 问题 3**：add 按钮改用 requestInput/Modal
3. **P1 — 问题 4**：类型变更 + CleanRulesSection 合并 + Modal 新增 Action/Scope 下拉框
4. **P1 — 问题 1**：trash cleanup age wrapper div
5. **P1 — 问题 5**：empty + add 同行
6. **P2 — 问题 2**：checkbox 替代 ×
7. **P2 — 问题 6**：按钮间距
8. **P2 — 问题 8**：响应式/移动端
9. **Build + Deploy**
