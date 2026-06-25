# advanced-obsidian-cleaner — 修复方案 V4

## 前置状态

V3 已完成：Q11(通知/启动移到Triggers)、Q1(去blacklist)、Q2(session checkbox)、Q3(add 按钮)、Q4(对齐)、Q5(summary简化)、Q6(溢出)、Q7+8(badge+图标)、Q9(ConfirmModal)、Q10(Re-evaluate)、checkbox、响应式。

本轮针对以下新问题：

---

## 问题 1：Add 按钮移到 Image 同一行

### 现状
`+ add` 按钮在 `extContainer`（chips flex 容器）末尾，chips 换行时按钮也换行。

### 方案
新建 `aoc-category-header` div 包含类别名和 add 按钮：
```
<div class="aoc-category-container">
  <div class="aoc-category-header">
    <strong>Image</strong>
    <button>+ add</button>
  </div>
  <div class="aoc-category-exts">...chips...</div>
</div>
```

**JS 改动**（FilterSettingsSection.ts）：
```ts
renderCategorySetting(name, extensions, defaults) {
  const container = this.containerEl.createDiv({ cls: 'aoc-category-container' });

  // Header row: category name + add button
  const header = container.createDiv({ cls: 'aoc-category-header' });
  header.createEl('strong', { text: name });
  const addBtn = header.createEl('button', { cls: 'aoc-category-add-btn-inline', text: '+ add' });
  addBtn.onclick = () => { new ExtensionInputModal(...).open(); };

  // Chips row
  const extContainer = container.createDiv({ cls: 'aoc-category-exts' });
  // ... render chips ...
}
```

**CSS 改动**：
```css
.aoc-category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
```

---

## 问题 2：Description 文字右移对齐

### 现状
`File Type Categories` heading 下的 description 文字（`Define which extensions...`）左对齐在 h4 下面，但 Obsidian 的 `setting-item-description` class 有默认 margin-left。

### 方案
description 放在 `aoc-category-container` 内，与 heading 共享相同的左边界：
```ts
// 在 renderCategorySetting 之前，放在 container 内
container.createEl('p', {
  cls: 'aoc-category-description',
  text: 'Define which extensions belong to each category. Check/uncheck to include/exclude from cleanup matching.'
});
```

**CSS**：
```css
.aoc-category-description {
  margin: 0 0 12px 0;
  font-size: var(--font-ui-smaller);
  color: var(--text-muted);
  line-height: 1.4;
}
```

---

## 问题 3：按钮顺序 + toggle 在最右边同一行

### 现状
当前 edit/clone/delete 用 `addExtraButton`（在 Setting 的 control 区域），toggle 也用 `addToggle`（也在 control 区域）。它们在 `.setting-item-control` 内横向排列。

**但**：badge（scope + action）应该在 rule card 的 right 侧，与 name+desc 同行。

### 方案
调整布局为：
```
.setting-el
  ├─ .aoc-clean-rule-card (flex, width: 100%)
  │   ├─ .aoc-clean-rule-card-left (flex: 1)
  │   │   ├─ .aoc-clean-rule-name
  │   │   └─ .aoc-clean-rule-desc
  │   └─ .aoc-clean-rule-card-right (flex-shrink: 0)
  │       ├─ .aoc-rule-badges
  │       │   ├─ [Scope badge]
  │       │   └─ [Action badge]
  │       └─ .aoc-rule-inline-actions
  │           ├─ [edit btn] [clone btn] [delete btn]
  └─ .setting-item-control
      └─ [toggle]
```

**JS 改动**（CleanRulesSection.ts）：
- 不再用 `addExtraButton` 放 edit/clone/delete，改为在 `ruleContainer` 内用普通 button 元素
- badge 和 inline buttons 放在 `ruleContainer` 的 right 侧
- toggle 仍用 `addToggle` 放在 control 区域

```ts
rules.forEach((rule, index) => {
  const s = new Setting(container);
  s.infoEl.remove();

  const ruleContainer = s.settingEl.createDiv({ cls: 'aoc-clean-rule-card' });

  // Left: name + desc
  const left = ruleContainer.createDiv({ cls: 'aoc-clean-rule-card-left' });
  left.createEl('div', { cls: 'aoc-clean-rule-name', text: rule.name || 'Unnamed Rule' })
    .setAttribute('title', rule.name || 'Unnamed Rule');
  left.createEl('div', { cls: 'aoc-clean-rule-desc', text: this.formatRuleSummary(rule) })
    .setAttribute('title', this.formatRuleSummary(rule));

  // Right: badges + inline buttons
  const right = ruleContainer.createDiv({ cls: 'aoc-clean-rule-card-right' });

  // Badges
  const badges = right.createDiv({ cls: 'aoc-rule-badges' });
  if (rule.scope) {
    badges.createEl('span', {
      cls: 'aoc-rule-scope-badge',
      text: this.scopeLabel(rule.scope)
    });
  }
  if (rule.action) {
    const actionCls = rule.action === 'delete'
      ? 'aoc-rule-action-badge aoc-rule-action-badge-delete'
      : 'aoc-rule-action-badge aoc-rule-action-badge-skip';
    badges.createEl('span', {
      cls: actionCls,
      text: rule.action === 'delete' ? 'Delete' : 'Skip'
    });
  }

  // Inline action buttons (edit, clone, delete)
  const actionsRow = right.createDiv({ cls: 'aoc-rule-actions-inline' });
  actionsRow.createEl('button', { text: 'edit' })
    .addEventListener('click', () => this.openRuleEditor(rule));
  actionsRow.createEl('button', { text: 'clone' })
    .addEventListener('click', () => this.cloneRule(rule));
  const delBtn = actionsRow.createEl('button', { text: 'delete' });
  delBtn.addClass('mod-warning');
  delBtn.addEventListener('click', async () => {
    const confirmed = await ConfirmModal.show(
      this.plugin.app, 'Delete Rule',
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

  // Toggle (in setting's control area, rightmost)
  s.addToggle(toggle =>
    toggle.setValue(rule.active)
      .setTooltip(rule.active ? 'Rule is active' : 'Rule is inactive')
      .onChange(async value => {
        rule.active = value;
        await this.plugin.saveSettings();
      })
  );
});
```

**CSS**：
```css
.aoc-clean-rule-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
  padding: 8px 12px;
  box-sizing: border-box;
  min-width: 0;
}

.aoc-clean-rule-card-left {
  flex: 1;
  min-width: 0;
}

.aoc-clean-rule-card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  max-width: 280px;
  min-width: 100px;
}

.aoc-rule-badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.aoc-rule-actions-inline {
  display: flex;
  gap: 4px;
  align-items: center;
}

.aoc-rule-actions-inline button {
  font-size: var(--font-ui-smaller);
  padding: 4px 8px;
  cursor: pointer;
}
```

---

## 问题 4：Folder/Delete 标签没显示

### 现状
当前 `formatRuleSummary` 只输出 trigger 文本，badge 没有在 UI 中渲染。

### 方案
见问题 3 的 JS 改动 — 在 `ruleContainer` 的 right 侧渲染 scope badge 和 action badge。

---

## 问题 5：Add rule 按钮移到 Clean Rules 同一行（有规则时）

### 现状
```
Clean Rules               ← heading
[rule cards...]
+ add rule                ← 单独一行
Re-evaluate               ← 单独一行
```

### 方案
当有规则时，add rule 按钮放到 Clean Rules heading 的 control 区域：
```ts
addCleanRulesSetting(): void {
  const headingSetting = new Setting(this.containerEl).setName('Clean Rules').setHeading();
  if (this.plugin.settings.cleanRules.length > 0) {
    headingSetting.addButton(btn =>
      btn.setButtonText('+ add rule').setCta().onClick(() => {
        this.openRuleEditor({
          name: 'New Rule', active: true, aggregation: 'all',
          triggers: [{ criteriaType: 'parent_path', operator: 'contains', value: '' }],
          action: null, scope: null,
        });
      })
    );
  }
  this.addAllCleanRules();
  this.addReEvaluateButton();
}
```

当没有规则时，"No rules configured" + add rule 仍在同一行（已有）。

Re-evaluate 按钮已用 `new Setting(this.containerEl)` 创建，与 heading 共享 `containerEl` 的对齐基准。

---

## 问题 6：Rule 行左右边界

### 现状
`aoc-clean-rule-card` 的 right 侧可能溢出 card 容器。

### 方案
CSS 已在上节设定：
```css
.aoc-clean-rule-card { min-width: 0; }
.aoc-clean-rule-card-left { flex: 1; min-width: 0; }
.aoc-clean-rule-card-right {
  flex-shrink: 0;
  max-width: 280px;
  min-width: 100px;
}
```

---

## 问题 7：Re-evaluate 只有通知

### 现状
Re-evaluate 按钮有完整逻辑（遍历 vault 文件/文件夹 → 评估规则 → 展示 PreviewCleanModal）。但用户说"只有一个通知"，原因是：
- 如果没有任何 active rule（action 和 scope 都填了），`matches` 为空 → 显示 "No files matched..."
- 这是**预期行为**，不是 bug

### 方案
加一个提示说明为什么没匹配：
```ts
const activeRules = this.plugin.settings.cleanRules.filter(r => r.active && r.scope && r.action);
if (activeRules.length === 0) {
  new Notice('No active rules with Action and Scope configured. Create a rule first.');
}
```

---

## 问题 8：No rules configured 描述文字右移

### 现状
"No rules configured" 在 `aoc-rules-list-container` div 内的 Setting 中，可能与 Clean Rules heading 不对齐。

### 方案
CSS 对齐：
```css
.aoc-rules-list-container {
  width: 100%;
  box-sizing: border-box;
}
```

或者更简单的方案：不用 `container.createDiv()` 包裹规则列表，直接在 `this.containerEl` 上创建 Setting。

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `FilterSettingsSection.ts` | add 按钮移到 category-header 行内 |
| `CleanRulesSection.ts` | 1. badge 渲染（scope + action）在 ruleContainer 内 2. edit/clone/delete 改为 inline buttons 在 ruleContainer 内 3. 删除逻辑内联（不再用 addExtraButton） 4. add rule 按钮移到 heading 行（有规则时） 5. Re-evaluate 对齐 6. No rules description 对齐 |
| `styles.css` | 1. `.aoc-category-header` flex 布局 2. `.aoc-clean-rule-card-right` badge + inline buttons 样式 3. `.aoc-rules-list-container` 对齐 4. `.aoc-category-description` 右移 |

---

## 实施顺序

1. **问题 1**：add 按钮移到 category-header（FilterSettingsSection + CSS）
2. **问题 2**：description 右移（CSS）
3. **问题 3+4**：badge + inline buttons 重构（CleanRulesSection + CSS）
4. **问题 5**：add rule 移到 heading 行（CleanRulesSection）
5. **问题 6**：overflow 边界（CSS）
6. **问题 7**：Re-evaluate 提示优化（CleanRulesSection）
7. **问题 8**：No rules description 对齐（CSS）
8. **Build + Deploy**
