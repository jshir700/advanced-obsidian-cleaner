# advanced-obsidian-cleaner — 修复方案 V10

## 问题 1：Preview Modal 的 Cancel/Apply Clean 按钮挪到右边

### 根因
PreviewCleanModal 的 footer 没有创建 leftSide div：
```ts
const footer = container.createDiv({ cls: 'aoc-rule-editor-footer' });
const rightSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-right' });
// ← 缺少 leftSide！
```

`justify-content: space-between` 只有一个子元素时，rightSide 靠左显示。

### 方案
始终创建 leftSide div（即使为空），CSS `:empty { flex: 1 }` 占位：
```ts
const leftSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-left' });
const rightSide = footer.createDiv({ cls: 'aoc-rule-editor-footer-right' });
```

### 修改后视觉效果
```
修改前:  [Cancel] [Apply Clean]          ← 靠左
修改后:                                       [Cancel] [Apply Clean]  ← 靠右
```

---

## 问题 2：add rule 替换了当前 rule

### 根因
onSave 回调中：
```ts
const existingIdx = this.plugin.settings.cleanRules.findIndex(r => r === rule);
if (existingIdx > -1) {
  // 编辑：替换
} else {
  const nameMatchIdx = this.plugin.settings.cleanRules.findIndex(
    r => r.name === updatedRule.name
  );
  if (nameMatchIdx > -1) {
    // 同名 → 替换！← 问题在这
  } else {
    this.plugin.settings.cleanRules.push(updatedRule);
  }
}
```

新建 rule 时 `rule` 是字面量对象，`r === rule` 永远为 false。进入 `else` 分支后，如果已有名为 "New Rule" 的 rule，`nameMatchIdx > -1` → **替换**。

### 方案
去掉 `nameMatchIdx` 逻辑，直接用 `indexOf(rule)` 判断：
```ts
onSave: async (updatedRule: CleanRule) => {
  const existingIdx = this.plugin.settings.cleanRules.indexOf(rule);
  if (existingIdx > -1) {
    // 编辑模式：替换
    this.plugin.settings.cleanRules[existingIdx] = updatedRule;
  } else {
    // 新增模式：直接 push
    this.plugin.settings.cleanRules.push(updatedRule);
  }
  await this.plugin.saveSettings();
  this.refreshDisplay();
}
```

---

## 问题 3：规则行拖拽排序

### 根因
当前 `CleanRulesSection` 中没有拖拽手柄和 drag & drop 逻辑。

### 方案

#### 3a. 新建 DragDropManager.ts
参考 ANM 的 `DragDropManager`，精简适配 Cleaner：

```ts
// src/utils/DragDropManager.ts
export class DragDropManager {
  private draggedElement: HTMLElement | null = null;
  private draggedIndex = -1;
  private container: HTMLElement;
  private options: {
    onReorder: (fromIndex: number, toIndex: number) => void;
    onSave?: () => Promise<void>;
    itemSelector?: string;
    handleSelector?: string;
  };

  private boundHandlers: Map<string, (e: DragEvent) => void>;

  constructor(container: HTMLElement, options: {
    onReorder: (fromIndex: number, toIndex: number) => void;
    onSave?: () => Promise<void>;
    itemSelector?: string;
    handleSelector?: string;
  }) {
    this.container = container;
    this.options = options;
    this.boundHandlers = new Map();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const handlers = [
      ['dragstart', (e: DragEvent) => this.handleDragStart(e)],
      ['dragover', (e: DragEvent) => this.handleDragOver(e)],
      ['drop', (e: DragEvent) => this.handleDrop(e)],
      ['dragend', () => this.handleDragEnd()],
      ['dragenter', (e: DragEvent) => this.handleDragEnter(e)],
      ['dragleave', (e: DragEvent) => this.handleDragLeave(e)],
    ];
    for (const [event, handler] of handlers) {
      this.boundHandlers.set(event, handler);
      this.container.addEventListener(event, handler);
    }
  }

  private handleDragStart(event: DragEvent): void {
    const target = event.target as HTMLElement;
    const handle = target.closest(this.options.handleSelector || '.aoc-drag-handle');
    if (!handle) return;

    const item = target.closest(this.options.itemSelector || '.aoc-clean-rule-card');
    if (!item) return;

    this.draggedElement = item;
    this.draggedIndex = this.getItemIndex(item);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', this.draggedIndex.toString());
    }
    item.classList.add('aoc-dragging');
  }

  private handleDragOver(event: DragEvent): void {
    if (!this.draggedElement) return;
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const target = event.target as HTMLElement;
    const item = target.closest(this.options.itemSelector || '.aoc-clean-rule-card');
    if (!item || item === this.draggedElement) return;

    this.clearDragOverClasses();

    const rect = item.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const isAbove = event.clientY < midpoint;

    const targetIndex = this.getItemIndex(item);
    const draggedIndex = this.getItemIndex(this.draggedElement);
    const newIndex = isAbove ? targetIndex : targetIndex + 1;

    if (newIndex === draggedIndex || newIndex === draggedIndex + 1) return;

    if (isAbove) {
      item.classList.add('aoc-drag-over-top');
    } else {
      item.classList.add('aoc-drag-over-bottom');
    }
  }

  private handleDrop(event: DragEvent): void {
    if (!this.draggedElement) return;
    event.preventDefault();

    const target = event.target as HTMLElement;
    const item = target.closest(this.options.itemSelector || '.aoc-clean-rule-card');
    if (!item || item === this.draggedElement) return;

    const targetIndex = this.getItemIndex(item);
    const rect = item.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const isAbove = event.clientY < midpoint;
    const finalIndex = isAbove ? targetIndex : targetIndex + 1;

    if (this.draggedIndex !== finalIndex && finalIndex !== this.draggedIndex + 1) {
      this.options.onReorder(this.draggedIndex, finalIndex);
      if (this.options.onSave) void this.options.onSave();
    }

    this.clearDragOverClasses();
  }

  private handleDragEnd(): void {
    if (this.draggedElement) {
      this.draggedElement.classList.remove('aoc-dragging');
    }
    this.clearDragOverClasses();
    this.draggedElement = null;
    this.draggedIndex = -1;
  }

  private handleDragEnter(event: DragEvent): void {
    if (!this.draggedElement) return;
    const target = event.target as HTMLElement;
    const item = target.closest(this.options.itemSelector || '.aoc-clean-rule-card');
    if (item && item !== this.draggedElement) {
      const targetIndex = this.getItemIndex(item);
      const draggedIndex = this.getItemIndex(this.draggedElement);
      if (targetIndex !== draggedIndex && targetIndex !== draggedIndex + 1) {
        item.classList.add('aoc-drag-over');
      }
    }
  }

  private handleDragLeave(event: DragEvent): void {
    const target = event.target as HTMLElement;
    const item = target.closest(this.options.itemSelector || '.aoc-clean-rule-card');
    if (item && item !== this.draggedElement) {
      const rect = item.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        item.classList.remove('aoc-drag-over', 'aoc-drag-over-top', 'aoc-drag-over-bottom');
      }
    }
  }

  private getItemIndex(item: HTMLElement): number {
    const items = Array.from(
      this.container.querySelectorAll(this.options.itemSelector || '.aoc-clean-rule-card')
    );
    return items.indexOf(item);
  }

  private clearDragOverClasses(): void {
    this.container.querySelectorAll('.aoc-drag-over, .aoc-drag-over-top, .aoc-drag-over-bottom')
      .forEach(el => el.classList.remove('aoc-drag-over', 'aoc-drag-over-top', 'aoc-drag-over-bottom'));
  }

  public destroy(): void {
    for (const [event, handler] of this.boundHandlers) {
      this.container.removeEventListener(event, handler);
    }
    this.boundHandlers.clear();
  }

  public static createDragHandle(): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'aoc-drag-handle';
    handle.textContent = '⋮⋮';
    handle.setAttribute('draggable', 'true');
    handle.setAttribute('aria-label', 'Drag to reorder');
    handle.setAttribute('title', 'Drag to reorder');
    return handle;
  }
}
```

#### 3b. CleanRulesSection 集成拖拽

```ts
export class CleanRulesSection {
  private dragDropManager: DragDropManager | null = null;

  addCleanRulesSetting(): void {
    // ...
  }

  private addAllCleanRules(): void {
    const rules = this.plugin.settings.cleanRules;
    const container = this.containerEl.createDiv({ cls: 'aoc-rules-list-container' });

    // Setup drag & drop
    this.setupDragDropManager(container);

    if (rules.length === 0) {
      // empty state...
    } else {
      rules.forEach((rule) => {
        const s = new Setting(container);
        s.infoEl.remove();

        const ruleContainer = s.settingEl.createDiv({ cls: 'aoc-clean-rule-card' });

        // 在 left 区域内添加拖拽手柄
        const left = ruleContainer.createDiv({ cls: 'aoc-clean-rule-card-left' });
        
        // Drag handle (最左侧)
        const dragHandle = DragDropManager.createDragHandle();
        dragHandle.addEventListener('dragstart', (e) => {
          // 让 dragstart 事件冒泡到 container，由 DragDropManager 捕获
        });
        left.insertBefore(dragHandle, left.firstChild);

        // ... 其余布局不变 ...
      });
    }
  }

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

  // cleanup 方法（可选，在 section 销毁时调用）
  cleanup(): void {
    if (this.dragDropManager) {
      this.dragDropManager.destroy();
      this.dragDropManager = null;
    }
  }
}
```

#### 3c. CSS 拖拽样式
```css
/* Dragging state */
.aoc-clean-rule-card.aoc-dragging {
  opacity: 0.5;
  transform: rotate(1deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  position: relative;
}

/* Drop indicators */
.aoc-rules-list-container .aoc-clean-rule-card.aoc-drag-over-top {
  border-top: 2px solid var(--interactive-accent);
}

.aoc-rules-list-container .aoc-clean-rule-card.aoc-drag-over-bottom {
  border-bottom: 2px solid var(--interactive-accent);
}

.aoc-rules-list-container .aoc-clean-rule-card.aoc-drag-over {
  background: var(--background-modifier-hover);
}

/* Drag handle */
.aoc-drag-handle {
  cursor: grab;
  opacity: 0.6;
  transition: opacity 0.2s ease;
  color: var(--text-muted);
  padding: 2px 4px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  font-size: 12px;
}

.aoc-drag-handle:hover {
  opacity: 1;
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.aoc-drag-handle:active {
  cursor: grabbing;
}
```

#### 3d. 布局调整
拖拽手柄放在 `left` 区域的最左侧，和 badges 并列：
```
.left (display: flex, gap: 8px)
  ├─ .aoc-drag-handle (⋮⋮, 最左)
  ├─ .aoc-rule-badges-col (竖向 badges)
  └─ .aoc-rule-name-col (name + desc)
```

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `PreviewCleanModal.ts` | footer 始终创建 leftSide div |
| `CleanRulesSection.ts` | 1. onSave 去掉 nameMatchIdx 逻辑 2. 集成 DragDropManager 3. 添加拖拽手柄 |
| `DragDropManager.ts` | **新建**：精简版拖拽管理器 |
| `styles.css` | 1. 拖拽状态样式 2. 拖拽手柄样式 3. drop indicator 样式 |

---

## 实施顺序

1. **Q1**：PreviewCleanModal footer 始终创建 leftSide
2. **Q2**：CleanRulesSection onSave 去掉 nameMatchIdx
3. **Q3**：新建 DragDropManager → 集成到 CleanRulesSection → 添加 CSS
4. **Build + Deploy**
