# advanced-obsidian-cleaner — 修复方案 V6

## 前置状态

V5 已完成大部分布局重构。本轮针对剩余对齐、布局、交互问题。

---

## 问题 1：空规则状态下对齐

### 根因
`aoc-rules-list-container` 内的 `new Setting(container)` 创建的 setting-item，其 `.setting-item-info` 和 `.setting-item-control` 各占 50%。而外部的 `new Setting(this.containerEl)` 同样 50/50 分割。但由于 `aoc-rules-list-container` 是普通 div 而非 tab-content，setting-item 的宽度计算可能不一致。

### 方案
- 给 `.aoc-rules-list-container .setting-item` 加 `margin: 0`
- 确保 `.aoc-rules-list-container` 继承 `containerEl` 的宽度
- CSS:
  ```css
  .aoc-rules-list-container {
    width: 100%;
    box-sizing: border-box;
  }
  .aoc-rules-list-container .setting-item {
    margin: 0;
    width: 100%;
  }
  ```

---

## 问题 2：Folder/Delete 标签上下叠为 2 行

### 现状
badges 和 buttons 在同一个 `.aoc-rule-right-content`（flex row）内，全部同行。

### 方案
拆成两行：
```
.aoc-clean-rule-card-right
  ├─ .aoc-rule-badges-row (flex, badges 横向排列)
  └─ .aoc-rule-actions-inline (flex, buttons)
```

JS：
```ts
const right = ruleContainer.createDiv({ cls: 'aoc-clean-rule-card-right' });

// Badges row
const badgesRow = right.createDiv({ cls: 'aoc-rule-badges-row' });
if (rule.scope) badgesRow.createEl('span', { cls: 'aoc-rule-scope-badge', text: ... });
if (rule.action) badgesRow.createEl('span', { cls: ..., text: ... });

// Actions row
const actionsRow = right.createDiv({ cls: 'aoc-rule-actions-inline' });
// ... buttons ...
```

CSS：
```css
.aoc-clean-rule-card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}
.aoc-rule-badges-row {
  display: flex;
  gap: 4px;
  align-items: center;
}
```

---

## 问题 3：按钮透明背景 + 开关移到编辑按钮右边

### 根因
toggle 通过 `s.addToggle()` 放在 Setting 的 `.setting-item-control` 区域，与 `ruleContainer` 不在同一 DOM 层级。

### 方案
放弃 `addToggle`，改用自定义 checkbox 按钮放在 `actions-inline` 内，和 edit/clone/delete 同级：

```ts
// 在 actionsRow 内
const toggleBtn = actionsRow.createEl('label', { cls: 'aoc-rule-toggle' });
const checkbox = toggleBtn.createEl('input', { type: 'checkbox', cls: 'aoc-rule-toggle-input' });
checkbox.checked = rule.active;
checkbox.onchange = async () => {
  rule.active = checkbox.checked;
  await this.plugin.saveSettings();
  this.refreshDisplay();
};
const track = toggleBtn.createEl('span', { cls: 'aoc-rule-toggle-track' });
```

CSS：
```css
.aoc-rule-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 4px;
}
.aoc-rule-toggle-input {
  display: none;
}
.aoc-rule-toggle-track {
  width: 36px;
  height: 20px;
  background: var(--background-modifier-border);
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
}
.aoc-rule-toggle-input:checked + .aoc-rule-toggle-track {
  background: var(--interactive-accent);
}
.aoc-rule-toggle-track::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
}
.aoc-rule-toggle-input:checked + .aoc-rule-toggle-track::after {
  transform: translateX(16px);
}
```

按钮背景色：CSS 已是 `background: transparent`，确认不被 Obsidian 覆盖即可。

---

## 问题 4：规则行左右边界对齐

### 根因
`ruleContainer` 在 `s.settingEl` 内，Obsidian 的 `.setting-item` 默认 `display: flex`，`.setting-item-info` 和 `.setting-item-control` 各占 50%。`ruleContainer` 在 infoEl 区域内，宽度只有 ~50%。

### 方案
在 CSS 中强制 settingEl 内所有子元素占满 100% 宽度：
```css
.aoc-rules-list-container .setting-item {
  display: block; /* 移除 flex 分隔 */
}
.aoc-rules-list-container .setting-item-info,
.aoc-rules-list-container .setting-item-control {
  display: none; /* 隐藏 Obsidian 默认分区 */
}
.aoc-rules-list-container .setting-item > .setting-item-info {
  display: none;
}
.aoc-clean-rule-card {
  width: 100%;
}
```

---

## 问题 5：Rule Editor conditions 默认空值

### 根因
`createContent()` 中初始化 trigger 时硬编码：
```ts
this.workingRule.triggers.push({
  criteriaType: 'parent_path',  // ← 导致 dropdown 选中 parent_path
  operator: 'contains',          // ← 导致 dropdown 选中 contains
  value: '',
});
```

### 方案
改为空字符串：
```ts
this.workingRule.triggers.push({
  criteriaType: '',
  operator: '',
  value: '',
});
```

dropdown 渲染时，如果 `trigger.criteriaType === ''`，不选中任何 option（保持 `-- Select --` 选中）。

---

## 问题 6：Cancel 和 Save 按钮太近

### 根因
`createButton(rightButtons, 'Cancel', ...)` 和 `createButton(rightButtons, 'Save', ...)` 创建的两个按钮在 `rightButtons` div 内。`rightButtons` 是 `createButtonContainer(rightSide)` 创建的，class 是 `aoc-modal-button-container`。**我们的 CSS 中没有 `.aoc-modal-button-container` 的 gap 规则**。

`.aoc-rule-editor-footer-right` 的 `gap: 16px` 作用于其直接子元素（left div 和 right div），但 `rightButtons` 内部没有 gap。

### 方案
给 `aoc-modal-button-container` 加 gap：
```css
.aoc-modal-button-container {
  display: flex;
  gap: 12px;
  align-items: center;
}
```

或者直接在 footer-right 上加：
```css
.aoc-rule-editor-footer-right .aoc-modal-button-container {
  gap: 12px;
}
```

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `CleanRulesSection.ts` | 1. badges 和 buttons 拆成两行 2. toggle 改为自定义 checkbox 放在 actions-inline 内 3. 移除 addToggle 调用 |
| `CleanRuleEditorModal.ts` | 初始化 trigger 用空字符串而非 parent_path/contains |
| `styles.css` | 1. badges-row 布局 2. toggle checkbox 样式 3. setting-item 去除 infoEl/controlEl 分隔 4. modal-button-container gap 5. alignment fixes |

---

## 实施顺序

1. **Q4**：移除 setting-item infoEl/controlEl 分隔（CSS）
2. **Q1**：空规则状态对齐（CSS）
3. **Q2**：badges 拆成两行（JS + CSS）
4. **Q3**：toggle 改为自定义 checkbox + 按钮透明背景（JS + CSS）
5. **Q5**：Rule Editor 默认空值（JS）
6. **Q6**：Cancel/Save 按钮间距（CSS）
7. **Build + Deploy**
