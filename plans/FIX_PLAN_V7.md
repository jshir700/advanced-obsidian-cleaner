# advanced-obsidian-cleaner — 修复方案 V7

## 前置状态

V6 已完成大部分布局重构。本轮针对以下 4 个遗留问题：

---

## 问题 1：空规则状态下 No rules configured + add rule 按钮不见了

### 根因
CSS 中 `.aoc-rules-list-container .setting-item-info, .setting-item-control { display: none !important; }` 把 Setting 的两栏都隐藏了。空规则状态的 `new Setting(container).setDesc('...').addButton(...)` 依赖 infoEl 放 desc、controlEl 放按钮，全被隐藏了。

### 方案
CSS 里分开处理：
- 规则行的 setting-item（有 `.aoc-clean-rule-card` 的）隐藏 infoEl + controlEl
- 空规则状态的 setting-item 保留 infoEl + controlEl

```css
/* 有规则卡片的 setting-item 隐藏 Obsidian 默认分区 */
.aoc-rules-list-container .setting-item:has(.aoc-clean-rule-card) .setting-item-info,
.aoc-rules-list-container .setting-item:has(.aoc-clean-rule-card) .setting-item-control {
  display: none;
}
/* 空规则状态的 setting-item 不受影响 */
```

如果 `:has()` 不支持，替代方案：
```css
.aoc-rules-list-container .setting-item .setting-item-info,
.aoc-rules-list-container .setting-item .setting-item-control {
  display: none;
}
/* 但空规则状态的 Setting 不放在 aoc-rules-list-container 内，直接放在 containerEl 上 */
```

**推荐方案**：空规则状态的 Setting 不放在 `aoc-rules-list-container` 内，而是直接放在 `this.containerEl` 上。这样全局隐藏规则行的 infoEl/controlEl 不会影响它。

```ts
if (rules.length === 0) {
  // 直接挂在 containerEl 上，不在 aoc-rules-list-container 内
  new Setting(this.containerEl)
    .setDesc('No rules configured. Add one using the button below.')
    .addButton(btn => btn.setButtonText('+ add rule').setCta().onClick(...));
} else {
  const container = this.containerEl.createDiv({ cls: 'aoc-rules-list-container' });
  // ... 规则卡片 ...
}
```

---

## 问题 2：标签移到名字左边 + 上下叠放

### 需求
```
[Folder]  My Rule Name            ✏️  📄  🗑️  ☑
[Delete]  parent_path contains /tmp
```

标签在名字左侧竖向排列，名字和描述紧随其后。

### 方案

**JS 改动**（CleanRulesSection.ts）：
```ts
const left = ruleContainer.createDiv({ cls: 'aoc-clean-rule-card-left' });

// 左侧列：badges（竖向）
const badgesCol = left.createDiv({ cls: 'aoc-rule-badges-col' });
if (rule.scope) badgesCol.createEl('span', { cls: 'aoc-rule-scope-badge', text: this.scopeLabel(rule.scope) });
if (rule.action) {
  const actionCls = rule.action === 'delete'
    ? 'aoc-rule-action-badge aoc-rule-action-badge-delete'
    : 'aoc-rule-action-badge aoc-rule-action-badge-skip';
  badgesCol.createEl('span', { cls: actionCls, text: rule.action === 'delete' ? 'Delete' : 'Skip' });
}

// 右侧列：name + desc
const nameCol = left.createDiv({ cls: 'aoc-rule-name-col' });
nameCol.createEl('div', { cls: 'aoc-clean-rule-name', text: rule.name || 'Unnamed Rule' })
  .setAttribute('title', rule.name || 'Unnamed Rule');
nameCol.createEl('div', { cls: 'aoc-clean-rule-desc', text: this.formatRuleSummary(rule) })
  .setAttribute('title', this.formatRuleSummary(rule));
```

**CSS 改动**：
```css
.aoc-clean-rule-card-left {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.aoc-rule-badges-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.aoc-rule-name-col {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
```

---

## 问题 3：按钮去掉红色背景

### 根因
`setIcon(delBtn, 'trash')` 创建的 SVG 按钮被 Obsidian 的 `.clickable-icon` 全局样式影响，`mod-warning` class 进一步加了红色背景。

### 方案

**CSS 改动**：
```css
.aoc-rule-action-btn {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 4px;
  color: var(--text-muted);
  border-radius: 4px;
  transition: all 0.15s ease;
}

.aoc-rule-action-btn:hover {
  background: var(--background-modifier-hover) !important;
  color: var(--text-normal);
}

.aoc-rule-action-btn.mod-warning:hover {
  background: var(--background-modifier-error-hover) !important;
  color: var(--text-error);
}
```

---

## 问题 4：规则行比左右两边更宽

### 根因
`aoc-rules-list-container` 是 `containerEl.createDiv()` 创建的 div。Obsidian 的 `.setting-item` 默认 `display: flex; min-width: 0;`，但我们改成 `display: block` 后，它不再受 flex 约束，宽度可能膨胀。而且 `aoc-rules-list-container` 没有明确的宽度限制，setting-item 可能超出 containerEl 的可用宽度。

### 方案

**CSS 改动**：
```css
.aoc-rules-list-container {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  box-sizing: border-box;
  max-width: 100%;
}

/* 规则行的 setting-item：隐藏 Obsidian 默认分区，让 ruleContainer 撑满 */
.aoc-rules-list-container .setting-item {
  display: flex;
  padding: 0;
  margin: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.aoc-rules-list-container .setting-item-info,
.aoc-rules-list-container .setting-item-control {
  display: none;
}

.aoc-clean-rule-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-width: 0;
  padding: 8px 12px;
}
```

关键：`width: 100%` + `max-width: 100%` + `box-sizing: border-box` 三重保障，确保 setting-item 不超过父容器宽度。

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `CleanRulesSection.ts` | 1. 空规则状态 Setting 直接挂 containerEl 而非 aoc-rules-list-container 2. badges 移到 left 内，竖向排列在 name 左边 3. 移除 addToggle，toggle 改为自定义 checkbox 放 actions-inline 4. 按钮用 setIcon 但 CSS 强制透明 |
| `styles.css` | 1. 规则行 infoEl/controlEl 隐藏（用 :has 或嵌套选择器）2. badges-col + name-col 布局 3. 按钮透明背景强制覆盖 4. rules-list-container 宽度限制 5. modal-button-container gap |

---

## 实施顺序

1. **Q1**：空规则状态 Setting 直接挂 containerEl（CleanRulesSection.ts）
2. **Q2**：badges 移到 name 左边竖向排列（CleanRulesSection.ts + CSS）
3. **Q3**：按钮强制透明背景（CSS）
4. **Q4**：rules-list-container 宽度限制（CSS）
5. **Build + Deploy**
