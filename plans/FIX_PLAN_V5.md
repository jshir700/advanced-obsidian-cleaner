# advanced-obsidian-cleaner — 修复方案 V5

## 前置状态

V4 已完成：Q11-Q10（通知/启动、去blacklist、session checkbox、add 按钮同行、对齐、summary简化、溢出、badge+图标、ConfirmModal、Re-evaluate、响应式）。

本轮针对以下新问题：

---

## 问题 1：空规则状态下 No rules configured 和 add rule 对齐

### 根因
`aoc-rules-list-container` 是 `containerEl.createDiv()`，内部 `new Setting(container)` 的 settingEl 宽度与外部 `new Setting(this.containerEl)` 的 settingEl 宽度可能不一致（Obsidian 的 Setting 依赖父容器计算宽度）。

### 方案
CSS 对齐：
```css
.aoc-rules-list-container {
  width: 100%;
  box-sizing: border-box;
}
.aoc-rules-list-container .setting-item {
  margin: 0;
  /* 确保与外部 Setting 的 setting-item 同宽 */
}
```

---

## 问题 2：Folder/Delete 标签在编辑/克隆/删除按钮左边

### 现状
badges 和 buttons 分两行（`flex-direction: column`）。

### 方案
改为同一行：
```
[aoc-rule-right-content] (flex, row)
  [Folder badge] [Delete badge] [aoc-rule-actions-inline] (flex, row-reverse)
```

**JS**：
```ts
const right = ruleContainer.createDiv({ cls: 'aoc-clean-rule-card-right' });
const rightContent = right.createDiv({ cls: 'aoc-rule-right-content' });

// Badges in-line
if (rule.scope) rightContent.createEl('span', { cls: 'aoc-rule-scope-badge', text: this.scopeLabel(rule.scope) });
if (rule.action) rightContent.createEl('span', { cls: 'aoc-rule-action-badge-delete', text: 'Delete' });

// Buttons
const actionsRow = rightContent.createDiv({ cls: 'aoc-rule-actions-inline' });
// ... edit/clone/delete buttons ...
```

**CSS**：
```css
.aoc-rule-right-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}
```

---

## 问题 3：按钮顺序反过来 + 显示图标

### 按钮顺序
从右到左：edit(closest to toggle) → clone → delete(farthest)。

**CSS**：
```css
.aoc-rule-actions-inline {
  display: flex;
  gap: 4px;
  flex-direction: row-reverse; /* DOM 顺序 edit/clone/delete → 显示 delete/clone/edit */
}
```

### 显示图标
用 `setIcon()` 替代文字按钮：
```ts
import { App, Setting, Notice, setIcon, TFile } from 'obsidian';

const editBtn = actionsRow.createEl('button', { cls: 'aoc-rule-action-btn' });
setIcon(editBtn, 'pencil');
editBtn.title = 'Edit rule';
editBtn.onclick = () => this.openRuleEditor(rule);
```

**CSS**：
```css
.aoc-rule-action-btn {
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: 4px;
  transition: all 0.15s ease;
}
.aoc-rule-action-btn:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}
.aoc-rule-action-btn.mod-warning:hover {
  background: var(--background-modifier-error-hover);
  color: var(--text-error);
}
```

---

## 问题 4：Rule Editor conditions 默认空值 + 保存校验

### 现状
打开 modal 时，如果 triggers 为空，conditions 区域什么都不显示。

### 方案

**打开时初始化一个空 trigger 行**：
```ts
protected createContent(): void {
  // ...
  // Ensure at least one empty trigger row
  if (this.workingRule.triggers.length === 0) {
    this.workingRule.triggers.push({
      criteriaType: 'parent_path',
      operator: 'contains',
      value: '',
    });
  }
  // ...
}
```

**criteriaType/operator dropdown 加空选项**：
```ts
// criteriaSelect
criteriaSelect.createEl('option', { value: '', text: '-- Select --' });
criteriaTypes.forEach(ct => {
  const opt = criteriaSelect.createEl('option', { value: ct, text: ct });
  if (trigger.criteriaType === ct) opt.selected = true;
});

// operatorSelect
const ops = this.getOperatorsForCriteria(criteriaType);
ops.unshift('-- Select --'); // 空选项
ops.forEach(op => {
  const opt = operatorSelect.createEl('option', { value: op, text: op });
  if (trigger.operator === op) opt.selected = true;
});
```

**validateRule 增加 trigger 校验**：
```ts
private validateRule(): boolean {
  // ... existing checks (name, action, scope) ...

  for (let i = 0; i < this.workingRule.triggers.length; i++) {
    const t = this.workingRule.triggers[i];
    if (!t.criteriaType || !t.operator) {
      new Notice(`Condition ${i + 1}: Please select a criteria type and operator.`);
      return false;
    }
  }
  return true;
}
```

---

## 问题 5：Cancel 和 Save 按钮太近

### 方案
增大 footer-right gap 从 12px → 16px：
```css
.aoc-rule-editor-footer-right {
  gap: 16px;
  align-items: center;
}
```

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `CleanRulesSection.ts` | 1. badges + buttons 改为同一行（aoc-rule-right-content） 2. 按钮顺序 row-reverse 3. setIcon 替代文字 4. import setIcon |
| `CleanRuleEditorModal.ts` | 1. 打开时初始化空 trigger 行 2. dropdown 加空选项 3. validateRule 增加 trigger 校验 |
| `styles.css` | 1. .aoc-rule-right-content row 布局 2. .aoc-rule-action-btn 图标样式 3. footer gap 16px 4. rules-list-container 对齐 |

---

## 实施顺序

1. **Q3**：按钮图标 + 顺序（CleanRulesSection + CSS）
2. **Q2**：badges + buttons 同行（CleanRulesSection + CSS）
3. **Q1+Q8**：对齐（CSS）
4. **Q4**：Rule Editor 空条件 + 校验（CleanRuleEditorModal）
5. **Q5**：按钮间距（CSS）
6. **Build + Deploy**
