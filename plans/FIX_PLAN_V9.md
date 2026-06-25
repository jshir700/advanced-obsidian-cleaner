# advanced-obsidian-cleaner — 问题分析方案 V9

## 前置状态

V8 已完成 Q1-Q6 分析。本轮补充 Q7 完整修复方案。

---

## 问题 1：Rule Editor conditions 默认选中 parent_path/contains

### 根因
新建 rule 时 `CleanRulesSection` 传入了硬编码的 triggers `[{ criteriaType: 'parent_path', operator: 'contains', value: '' }]`。`createContent()` 中的空值初始化只在 `triggers.length === 0` 时执行，但这里 length 是 1，所以跳过。

### 方案
`CleanRulesSection.ts` 中，新建 rule 时 triggers 传空数组 `[]`：
```ts
triggers: [],  // 而不是 [{ criteriaType: 'parent_path', operator: 'contains', value: '' }]
```
`CleanRuleEditorModal.ts` 中 `createContent()` 的空值初始化逻辑保持不变（triggers 为空时 push 一个空 trigger）。

---

## 问题 2：新建 rule 时 Cancel/Save 按钮靠左

### 根因
footer 中新建 rule 时 `isEditMode = false`，leftSide 不创建。footer 只有一个子元素 `.aoc-rule-editor-footer-right`，`justify-content: space-between` 无效，按钮靠左。

### 方案
footer 结构中始终创建 leftSide div，即使为空。CSS 加 `:empty { flex: 1 }` 占位：
```ts
const leftSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-left' });
if (this.ruleOptions.isEditMode && this.ruleOptions.onDelete) {
  // 创建 delete 按钮
}
```
```css
.aoc-rule-editor-footer-left:empty { flex: 1; }
```

---

## 问题 3：编辑/克隆/删除按钮顺序

### 现状
CSS `flex-direction: row-reverse` 反转了 DOM 顺序，视觉上从左到右是 delete → clone → edit。

### 方案
- 去掉 CSS 中的 `flex-direction: row-reverse`
- DOM 顺序改为：delete → clone → edit（视觉上从左到右就是 delete/clone/edit）

---

## 问题 4：删除按钮 hover 时图标变红

### 根因
```css
.aoc-rule-action-btn.mod-warning:hover {
  color: var(--text-error);  /* ← 图标变红 */
}
```

### 方案
去掉 `color: var(--text-error)`，hover 时只改背景：
```css
.aoc-rule-action-btn.mod-warning:hover {
  background: var(--background-modifier-error-hover);
}
```

---

## 问题 5：Folder/Delete 标签美化

### 当前
纯背景色胶囊，无边框、无阴影。

### 优化后
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
```
效果：更精致的胶囊标签，有边框、微阴影、加粗字体。

---

## 问题 6：Re-evaluate 弹出对话框美化

### 现状
`PreviewCleanModal` 继承 `Modal`，无尺寸控制、无 padding、tabs 和列表无样式。

### 方案
1. `PreviewCleanModal` 继承 `BaseModal`，设 `size: 'large'`，`cssClass: 'aoc-preview-modal'`
2. 用 `BaseModal.createTitle()` 渲染标题
3. 用 `BaseModal.createSection()` 渲染 summary/tabs/content
4. 用 `BaseModal.createButton()` 渲染 footer 按钮
5. CSS 新增 `.aoc-preview-modal`、`.aoc-preview-summary`、`.aoc-preview-tab-btn`、`.aoc-preview-list-item` 等样式

---

## 问题 7：File Type Categories 取消勾选后退出重进又被勾选

### 代码逐行追踪

**Step 1：用户取消勾选 jpg**
```ts
// FilterSettingsSection.ts line 148-156
checkbox.onchange = () => {
  if (!checkbox.checked) {
    this.sessionUncheckedCustom.add(key);  // key = "Image_jpg"
    chip.addClass('aoc-ext-chip-muted');
  }
};
```
→ `sessionUncheckedCustom` = `{"Image_jpg"}`，但 `this.plugin.settings.fileTypeCategories.image` 中 jpg **仍在数组中**。

**Step 2：用户离开设置页，触发 `refreshDisplay()` → `display()`**
```ts
// settings.ts line 294-297
const filterSection = new FilterSettingsSection(this.plugin, containerEl, () => this.display());
filterSection.flushSessionUnchecked();
filterSection.addFilterSettings();
```
→ **创建了全新的 FilterSettingsSection 实例**！旧实例的 `sessionUncheckedCustom` 丢失。

**Step 3：flushSessionUnchecked() 在新实例上调用**
```ts
flushSessionUnchecked(): void {
  if (this.sessionUncheckedCustom.size === 0) return;  // ← 新实例的 set 是空的，直接 return！
  // ...
}
```
→ **什么都没做**。jpg 仍在数组中。

**Step 4：addFileTypeCategories() 在新实例上调用**
```ts
addFileTypeCategories(): void {
  this.sessionUncheckedCustom.clear();  // 本来就是空的
  const categories = this.plugin.settings.fileTypeCategories;  // jpg 还在！
  this.renderCategorySetting('Image', categories.image, defaults.image);
}
```

**Step 5：renderCategorySetting 渲染 jpg**
```ts
extensions.forEach(ext => {
  const isUnchecked = this.sessionUncheckedCustom.has(key);  // false（新实例的 set 是空的）
  checkbox.checked = !isUnchecked;  // true — jpg 被勾选了！
});
```
→ **jpg 重新显示为勾选状态**。

### 根因总结
每次 `display()` 都创建**全新的 FilterSettingsSection 实例**，旧实例的 `sessionUncheckedCustom` 状态丢失。`flushSessionUnchecked()` 在新实例上调用时，新实例的 session 是空的，所以什么都没做。

### 方案：直接修改数组 + 持久化（不用 session 跟踪）

去掉 `sessionUncheckedCustom`，改为 checkbox onchange 直接操作数组：

```ts
// FilterSettingsSection.ts
private renderCategorySetting(name: string, extensions: string[], defaults: string[]): void {
  // ... header + description ...

  extensions.forEach(ext => {
    const key = `${name}_${ext}`;
    const isDefault = defaults.includes(ext);

    const chip = extContainer.createDiv({ cls: 'aoc-category-ext-chip' });

    const checkbox = chip.createEl('input', {
      type: 'checkbox',
      cls: 'aoc-ext-checkbox',
    });
    checkbox.checked = true;  // 始终 checked（因为数组中就有这个 ext）
    checkbox.title = `Toggle .${ext}${isDefault ? ' (default)' : ''}`;

    checkbox.onchange = async () => {
      if (!checkbox.checked) {
        // 取消勾选：从数组中删除
        const catKey = name.toLowerCase() as keyof typeof this.plugin.settings.fileTypeCategories;
        const arr = this.plugin.settings.fileTypeCategories[catKey];
        if (arr) {
          const idx = arr.indexOf(ext);
          if (idx > -1) arr.splice(idx, 1);
          await this.plugin.saveSettings();
          this.refreshDisplay();
        }
      } else {
        // 重新勾选：只允许加回默认扩展名
        const catKey = name.toLowerCase() as keyof typeof this.plugin.settings.fileTypeCategories;
        const arr = this.plugin.settings.fileTypeCategories[catKey];
        const defArr = DEFAULT_SETTINGS.fileTypeCategories[
          name.toLowerCase() as keyof typeof DEFAULT_SETTINGS.fileTypeCategories
        ];
        if (arr && defArr && defArr.includes(ext) && !arr.includes(ext)) {
          arr.push(ext);
          await this.plugin.saveSettings();
          this.refreshDisplay();
        } else {
          // 非默认扩展名不能重新勾选
          checkbox.checked = false;
        }
      }
    };

    const label = chip.createSpan({ cls: 'aoc-ext-label' });
    label.textContent = `.${ext}`;
  });
}
```

同时删除：
- `sessionUncheckedCustom: Set<string>` 属性
- `flushSessionUnchecked()` 方法
- `settings.ts` 中的 `filterSection.flushSessionUnchecked()` 调用
- `addFileTypeCategories()` 中的 `this.sessionUncheckedCustom.clear()` 调用

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `CleanRulesSection.ts` | 1. 新建 rule 时 triggers 传 `[]` 2. footer 始终创建 leftSide 3. 去掉 row-reverse 4. 删除按钮 hover 不红 5. badges 移到 name 左边 6. 按钮顺序 delete/clone/edit |
| `CleanRuleEditorModal.ts` | footer 始终创建 leftSide；去掉 row-reverse；删除按钮 hover 不红 |
| `PreviewCleanModal.ts` | 继承 BaseModal，用 createTitle/createSection/createButton |
| `FilterSettingsSection.ts` | 去掉 sessionUncheckedCustom，checkbox onchange 直接操作数组 + await saveSettings |
| `settings.ts` | 去掉 flushSessionUnchecked() 调用 |
| `styles.css` | 1. badges 标签美化 2. PreviewCleanModal 样式 3. 去掉 row-reverse 4. 删除按钮 hover 不红 5. footer :empty flex: 1 |

---

## 实施顺序

1. **Q1**：CleanRulesSection 新建 rule 时 triggers 传 `[]`
2. **Q2**：footer 始终创建 leftSide + CSS `:empty { flex: 1 }`
3. **Q3**：去掉 `row-reverse`，DOM 顺序改为 delete/clone/edit
4. **Q4**：删除按钮 hover 去掉 `color: var(--text-error)`
5. **Q5**：badges 标签美化（边框、阴影、加粗）
6. **Q6**：PreviewCleanModal 继承 BaseModal + 完整 CSS
7. **Q7**：去掉 sessionUncheckedCustom，checkbox onchange 直接操作数组
8. **Build + Deploy**
