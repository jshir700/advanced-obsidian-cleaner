# advanced-obsidian-cleaner — 修复方案 V12

## 问题 1：Preview Modal 的 Cancel/Apply Clean 按钮挪到右边

### 根因
PreviewCleanModal 的 footer 没有创建 leftSide div，`justify-content: space-between` 只有一个子元素时无效，按钮靠左。

### 方案
始终创建 leftSide div，CSS `:empty { flex: 1 }` 占位。

### 修改后视觉效果
```
修改前:  [Cancel] [Apply Clean]          ← 靠左
修改后:                                       [Cancel] [Apply Clean]  ← 靠右
```

---

## 问题 2：add rule 替换了当前 rule

### 根因
onSave 回调中用 `nameMatchIdx` 按名称匹配，同名 rule 被替换。

### 方案
去掉 `nameMatchIdx`，直接用 `indexOf(rule)` 判断编辑/新增。

---

## 问题 3：规则行拖拽排序（拖拽按钮在开关右边）

### 根因
当前没有拖拽功能。

### 方案

#### 3a. 新建 DragDropManager.ts
参考 ANM 的 `DragDropManager`，精简适配 Cleaner。

#### 3b. CleanRulesSection 集成拖拽

**拖拽手柄放在 toggle 开关的右边（最右侧）**：

```
.aoc-rule-actions-inline (flex, gap: 4px)
  ├─ 🗑️ (delete)
  ├─ 📄 (clone)
  ├─ ✏️ (edit)
  ├─ ☑️ (toggle)
  └─ ⋮⋮ (拖拽手柄)  ← 最右侧
```

**JS 改动**（在 toggle 之后添加）：
```ts
// Toggle switch (inline with buttons, rightmost before drag handle)
const toggleLabel = actionsRow.createEl('label', { cls: 'aoc-rule-toggle' });
// ... checkbox setup ...

// Drag handle (rightmost)
const dragHandle = actionsRow.createEl('div', { cls: 'aoc-drag-handle' });
dragHandle.textContent = '⋮⋮';
dragHandle.setAttribute('draggable', 'true');
dragHandle.title = 'Drag to reorder';
```

**setupDragDropManager**：
```ts
private setupDragDropManager(container: HTMLElement): void {
  if (this.dragDropManager) {
    this.dragDropManager.destroy();
  }
  this.dragDropManager = new DragDropManager(container, {
    itemSelector: '.aoc-clean-rule-card',
    handleSelector: '.aoc-drag-handle',
    onReorder: (fromIndex: number, toIndex: number) => {
      const rules = this.plugin.settings.cleanRules;
      const [movedRule] = rules.splice(fromIndex, 1);
      rules.splice(toIndex, 0, movedRule);
    },
    onSave: async () => {
      await this.plugin.saveSettings();
      this.refreshDisplay();
    },
  });
}
```

#### 3c. CSS
```css
/* 拖拽手柄 */
.aoc-drag-handle {
  cursor: grab;
  opacity: 0.6;
  transition: opacity 0.2s ease;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  font-size: 14px;
}
.aoc-drag-handle:hover {
  opacity: 1;
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}
.aoc-drag-handle:active {
  cursor: grabbing;
}

/* 拖拽中状态 */
.aoc-clean-rule-card.aoc-dragging {
  opacity: 0.5;
  transform: rotate(1deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  position: relative;
}

/* 放置指示器 */
.aoc-rules-list-container .aoc-clean-rule-card.aoc-drag-over-top {
  border-top: 2px solid var(--interactive-accent);
}
.aoc-rules-list-container .aoc-clean-rule-card.aoc-drag-over-bottom {
  border-bottom: 2px solid var(--interactive-accent);
}
```

### 修改后视觉效果

**正常状态**：
```
[Folder] [Delete]  My Rule Name              🗑️  📄  ✏️  ☑  ⋮⋮
             parent_path contains /tmp
```

**拖拽中**：
```
[Folder] [Delete]  My Rule Name              🗑️  📄  ✏️  ☑  ⋮⋮  ← 半透明 + 旋转
             parent_path contains /tmp

[Folder] [Delete]  Another Rule              🗑️  📄  ✏️  ☑  ⋮⋮
             modified_at > 1000000          ↑ 蓝色上边框（放置指示器）
```

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `PreviewCleanModal.ts` | footer 始终创建 leftSide div |
| `CleanRulesSection.ts` | 1. onSave 去掉 nameMatchIdx 2. 集成 DragDropManager 3. 右侧（toggle 后）添加拖拽手柄 |
| `DragDropManager.ts` | **新建**：精简版拖拽管理器 |
| `styles.css` | 1. 拖拽状态样式 2. 拖拽手柄样式 3. drop indicator 样式 |

---

## 实施顺序

1. **Q1**：PreviewCleanModal footer 始终创建 leftSide
2. **Q2**：CleanRulesSection onSave 去掉 nameMatchIdx
3. **Q3**：新建 DragDropManager → 集成到 CleanRulesSection → toggle 后添加拖拽手柄 → 添加 CSS
4. **Build + Deploy**
