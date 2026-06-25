# advanced-obsidian-cleaner — 问题分析与修复方案 V13

> 日期: 2026-06-24
> 范围: Badge 紧凑化、Re-evaluate 实时刷新、拖拽按钮一致性、Apply Clean 确认

---

## 问题 1：Folder 和 Delete 标签（Badge）纵向长度太大

### 现状

**文件**: [styles.css:192-235](../advanced-obsidian-cleaner/styles.css#L192-L235)

```css
/* 当前 Badge 样式 */
.aoc-rule-scope-badge {
  padding: 2px 10px;
  font-size: var(--font-ui-smaller);
  border-radius: 6px;
  border: 1px solid var(--interactive-accent);   /* ← 多余 */
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);         /* ← 多余 */
}

.aoc-rule-action-badge {
  padding: 2px 10px;
  font-size: var(--font-ui-smaller);
  border-radius: 6px;
  border: 1px solid;                              /* ← 多余 */
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);         /* ← 多余 */
}

/* 两 badge 垂直排列 */
.aoc-rule-badges-col {
  gap: 2px;                                       /* ← 可更小 */
}
```

**布局结构**（[CleanRulesSection.ts:78-93](../advanced-obsidian-cleaner/src/settings/CleanRulesSection.ts#L78-L93)）：
```
.aoc-rule-badges-col (flex-direction: column)
  ├─ [Folder]  ← scope badge
  └─ [Delete]  ← action badge
```

### 根因

- `padding: 2px 10px` + `border-radius: 6px` + `border` + `box-shadow` 四重叠加，每个 badge 高度约 22-24px
- 两个 badge + 2px gap = 总计 ~46-50px 纵向占用
- Badge 的背景色已足够区分语义，border 和 shadow 是多余的视觉重量

### 方案

| 属性 | 当前值 | 改为 |
|------|--------|------|
| `padding` | `2px 10px` | `1px 8px` |
| `border-radius` | `6px` | `4px` |
| `border` | `1px solid ...` | **删除** |
| `box-shadow` | `0 1px 2px ...` | **删除** |
| badges-col `gap` | `2px` | `1px` |

### 修改后视觉效果

```
修改前 (≈48px 高):              修改后 (≈30px 高):
┌──────────────┐                ┌────┐
│              │                │Fol │
│   Folder     │                ├────┤
│              │                │Del │
├──────────────┤                └────┘
│              │
│   Delete     │
│              │
└──────────────┘
  border+shadow       无border/shadow
  padding 2px 10px    padding 1px 8px
  border-radius 6px   border-radius 4px
```

### 涉及 CSS 修改

**`.aoc-rule-scope-badge`** — 删除 `border`、`box-shadow`，`padding` → `1px 8px`，`border-radius` → `4px`

**`.aoc-rule-action-badge`** — 同上

**`.aoc-rule-badges-col`** — `gap: 2px` → `gap: 1px`

---

## 问题 2：修改规则内容和开关后，Re-evaluate 的列表没有实时刷新

### 现状

**触发点**（两处）：

1. **Toggle 开关** ([CleanRulesSection.ts:149-153](../advanced-obsidian-cleaner/src/settings/CleanRulesSection.ts#L149-L153)):
```ts
checkbox.onchange = async () => {
  rule.active = checkbox.checked;
  await this.plugin.saveSettings();
  this.refreshDisplay();  // ← 仅重绘设置面板
};
```

2. **规则编辑器 onSave** ([CleanRulesSection.ts:181-189](../advanced-obsidian-cleaner/src/settings/CleanRulesSection.ts#L181-L189)):
```ts
onSave: async (updatedRule: CleanRule) => {
  // ... 更新 rules 数组 ...
  await this.plugin.saveSettings();
  this.refreshDisplay();  // ← 仅重绘设置面板
};
```

**Re-evaluate 按钮** ([CleanRulesSection.ts:213-279](../advanced-obsidian-cleaner/src/settings/CleanRulesSection.ts#L213-L279)) — 每次点击都从 `this.plugin.settings.cleanRules` 重新扫描，**数据是最新的**，但 Modal 不会自动更新。

### 根因

`refreshDisplay()` 只是重新调用 `FileCleanerSettingTab.display()`，重绘设置面板 UI。已打开的 `PreviewCleanModal` 实例不受影响——它是独立的 Modal，没有与设置面板共享数据引用。

### 方案 A：Notice 提示 + 按钮视觉反馈

**核心思路**：不尝试跨 Modal 通信（增加复杂度），而是引导用户手动重新点击 Re-evaluate。

#### 改动 1：Toggle 开关变化时发送提示

在 [CleanRulesSection.ts:149-153](../advanced-obsidian-cleaner/src/settings/CleanRulesSection.ts#L149-L153) 的 `onchange` 回调末尾添加：

```ts
checkbox.onchange = async () => {
  rule.active = checkbox.checked;
  await this.plugin.saveSettings();
  this.refreshDisplay();
  new Notice('⚠️ Rule state changed — click "Re-evaluate" to refresh the preview.');
};
```

#### 改动 2：规则编辑器保存后发送提示

在 [CleanRulesSection.ts:181-189](../advanced-obsidian-cleaner/src/settings/CleanRulesSection.ts#L181-L189) 的 `onSave` 回调末尾添加：

```ts
onSave: async (updatedRule: CleanRule) => {
  const existingIdx = this.plugin.settings.cleanRules.indexOf(rule);
  if (existingIdx > -1) {
    this.plugin.settings.cleanRules[existingIdx] = updatedRule;
  } else {
    this.plugin.settings.cleanRules.push(updatedRule);
  }
  await this.plugin.saveSettings();
  this.refreshDisplay();
  new Notice('⚠️ Rule updated — click "Re-evaluate" to refresh the preview.');
};
```

#### 改动 3：Re-evaluate 按钮视觉反馈

在 Re-evaluate 按钮旁边增加一个未读指示器（小圆点），当规则自上次 Re-evaluate 后发生变化时显示：

- 新增一个 `private lastReEvaluatedAt: number = 0;` 字段
- 在 toggle onchange 和 onSave 中更新时间戳
- 在 `addReEvaluateButton()` 中根据时间戳决定是否显示红点

**视觉示意**：
```
修改前:                    修改后:
[Re-evaluate]            [Re-evaluate] ●
                           ↑ 红色小圆点提示有未刷新的变更
```

### 为什么选方案 A 而非其他

| 方案 | 优点 | 缺点 |
|------|------|------|
| **A: Notice + 视觉反馈** (推荐) | 改动最小，无需跨 Modal 通信 | 用户需手动点 Re-evaluate |
| B: 自动关闭已打开的 Modal | 数据一定最新 | 打断用户阅读，体验差 |
| C: Modal 间共享数据引用 | 全自动 | 架构改动大，Modal 生命周期管理复杂 |

---

## 问题 3：规则行的拖拽排序按钮样式跟 ANM 插件差异大，也未实现功能

### 现状对比

| 特性 | ANM 插件 | AO Cleaner (当前) |
|------|---------|-------------------|
| **图标** | `setIcon(el, 'grip-vertical')` — Obsidian 原生 SVG | 纯文本 `⋮` / `⋮⋮` |
| **focus-visible** | `outline: 2px solid var(--interactive-accent)` | **缺失** |
| **hover 背景** | `background: var(--background-modifier-hover)` | 有 ✅ |
| **规则行拖拽** | 完整实现（DragDropManager） | 完整实现 ✅ |
| **条件行拖拽** | 完整实现（条件行也有 handle） | **缺失** — 仅渲染了 handle 元素 |
| **容器** | `.advancedNoteMover-drag-handle-container` | `.aoc-drag-handle-container` |

### 根因

1. **图标不一致**：`DragDropManager.createDragHandle()` 使用 `textContent = '⋮'`，而 ANM 使用 Obsidian 的 `setIcon` API
2. **条件行缺拖拽**：[CleanRuleEditorModal.ts:240-243](../advanced-obsidian-cleaner/src/modals/CleanRuleEditorModal.ts#L240-L243) 在条件行渲染了 drag handle 元素，但 `renderTriggers()` 没有接入任何 DragDropManager，所以条件行无法拖拽
3. **缺少无障碍支持**：没有 `focus-visible` outline

### 方案

#### 3a. 统一 drag handle 图标

修改 [DragDropManager.ts:204-213](../advanced-obsidian-cleaner/src/utils/DragDropManager.ts#L204-L213) 的 `createDragHandle()`：

```ts
public static createDragHandle(): HTMLElement {
  const handle = document.createElement('div');
  handle.className = 'aoc-drag-handle';
  // 使用 Obsidian 原生 grip-vertical 图标，与 ANM 一致
  setIcon(handle, 'grip-vertical');
  handle.setAttribute('draggable', 'true');
  handle.setAttribute('aria-label', 'Drag to reorder');
  handle.setAttribute('title', 'Drag to reorder');
  return handle;
}
```

需要 import `setIcon` 来自 `obsidian`。

#### 3b. 添加 focus-visible 样式

在 [styles.css](../advanced-obsidian-cleaner/styles.css) 的 `.aoc-drag-handle` 中追加：

```css
.aoc-drag-handle:focus-visible {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 1px;
}
```

#### 3c. 条件行拖拽功能

**思路**：在 `CleanRuleEditorModal` 的条件行容器中集成拖拽排序。

**改动位置**：[CleanRuleEditorModal.ts:165-176](../advanced-obsidian-cleaner/src/modals/CleanRuleEditorModal.ts#L165-L176) `renderTriggers()` 方法

在 `renderTriggers()` 中，渲染完所有 trigger row 后，初始化一个 DragDropManager：

```ts
private renderTriggers(): void {
  if (!this.triggersContainer) return;

  this.triggersContainer.empty();

  const effectiveScope = this.workingRule.scope || 'folder';

  this.workingRule.triggers.forEach((trigger, index) => {
    this.createTriggerRow(this.triggersContainer, trigger, index, effectiveScope);
  });

  // 初始化条件行拖拽
  if (this.triggerDragDropManager) {
    this.triggerDragDropManager.destroy();
  }
  this.triggerDragDropManager = new DragDropManager(this.triggersContainer, {
    itemSelector: '.aoc-rule-trigger-row',
    handleSelector: '.aoc-drag-handle',
    onReorder: (fromIndex, toIndex) => {
      const triggers = this.workingRule.triggers;
      const [moved] = triggers.splice(fromIndex, 1);
      triggers.splice(toIndex, 0, moved);
      this.renderTriggers(); // 重排 DOM
    },
  });
}
```

需要在 `CleanRuleEditorModal` 类中新增字段：
```ts
private triggerDragDropManager: DragDropManager | null = null;
```

并在 `onClose()` 中销毁：
```ts
onClose(): void {
  if (this.triggerDragDropManager) {
    this.triggerDragDropManager.destroy();
    this.triggerDragDropManager = null;
  }
  super.onClose();
}
```

#### 3d. 条件行的 drag handle 需要 draggable=true

当前 `createTriggerRow` 中创建的 handle 是普通 div，没有 `draggable="true"` 属性。DragDropManager 的 `handleDragStart` 通过 `target.closest(handleSelector)` 找到 handle，但 div 本身需要设置 `draggable="true"` 才能触发 dragstart 事件。

修改 `createTriggerRow` 中创建 handle 的代码：

```ts
// Drag handle
const handleContainer = row.createDiv({ cls: 'aoc-drag-handle-container' });
const handle = handleContainer.createDiv({ cls: 'aoc-drag-handle' });
setIcon(handle, 'grip-vertical');  // 统一图标
handle.setAttribute('draggable', 'true');
handle.setAttribute('aria-label', 'Drag to reorder');
```

### 修改后视觉效果

```
修改前 (文本图标):              修改后 (Obsidian SVG 图标):
┌─────────────────────────┐    ┌─────────────────────────┐
│ ⋮⋮  [选择] [运算符] 值  │    │ ⠿  [选择] [运算符] 值  │
│    (纯文本 ⋮⋮)           │    │    (Obsidian grip-vertical SVG) │
├─────────────────────────┤    ├─────────────────────────┤
│ ⋮⋮  [选择] [运算符] 值  │    │ ⠿  [选择] [运算符] 值  │
└─────────────────────────┘    └─────────────────────────┘

ANM 插件:                      AO Cleaner (修改后):
│ ⠿  [选择] [运算符] 值  │     │ ⠿  [选择] [运算符] 值  │
│    (SVG 图标)               │    (SVG 图标) ← 一致 ✓
└─────────────────────────┘    └─────────────────────────┘
```

---

## 问题 4：Re-evaluate 对话框的 Apply Clean 按钮是否有二次确认

### 现状

**文件**: [PreviewCleanModal.ts:99-102](../advanced-obsidian-cleaner/src/modals/PreviewCleanModal.ts#L99-L102)

```ts
private applyClean(): void {
  console.log('Apply clean triggered');
  this.close();
}
```

**按钮绑定** ([PreviewCleanModal.ts:69](../advanced-obsidian-cleaner/src/modals/PreviewCleanModal.ts#L69)):
```ts
this.createButton(rightButtons, 'Apply Clean', () => this.applyClean(), { isPrimary: true });
```

### 结论

**没有二次确认**。点击 "Apply Clean" 后直接 `console.log` + 关闭 Modal，没有任何确认对话框。

对比插件中已有的 [DeletionConfirmationModal](../advanced-obsidian-cleaner/src/modals/DeletionConfirmationModal.ts)（用于常规清理流程的确认），PreviewCleanModal 的 Apply Clean 跳过了确认步骤。

### 方案

在 `applyClean()` 中增加二次确认。有两种方式：

#### 方案 A：使用已有的 ConfirmModal

```ts
private async applyClean(): Promise<void> {
  const confirmed = await ConfirmModal.show(
    this.app,
    'Apply Clean',
    'This will permanently delete the files and folders listed above.\n\nThis action cannot be undone.'
  );
  if (confirmed) {
    // 执行实际清理逻辑
    await this.executeClean();
  }
}
```

#### 方案 B：轻量内联确认（不弹新 Modal）

在 PreviewCleanModal 内部切换按钮行为：第一次点击 "Apply Clean" → 按钮变为 "Confirm Delete" + 红色警告文字；再次点击才执行。

```ts
private async applyClean(): void {
  // 切换为确认模式
  if (!this.isConfirmMode) {
    this.isConfirmMode = true;
    // 按钮变红，文字改为 "Confirm Delete"
    // 添加警告文字
    return;
  }
  // 第二次点击：执行清理
  await this.executeClean();
  this.close();
}
```

### 推荐：方案 A

- `ConfirmModal` 已在插件中使用（删除规则时），保持一致性
- 改动最小，一行替换
- 后续如果 `executeClean()` 实现正式清理逻辑，也自然接入确认流程

---

## 文件变更清单

| 文件 | 改动 |
|------|------|
| [styles.css](../advanced-obsidian-cleaner/styles.css) | 1. Badge 紧凑化（删除 border/shadow，缩小 padding/radius）2. drag handle 添加 focus-visible |
| [CleanRulesSection.ts](../advanced-obsidian-cleaner/src/settings/CleanRulesSection.ts) | 1. toggle/onSave 后加 Notice 提示 2. 新增 `lastReEvaluatedAt` 时间戳 3. Re-evaluate 按钮旁加未读指示器 |
| [DragDropManager.ts](../advanced-obsidian-cleaner/src/utils/DragDropManager.ts) | `createDragHandle()` 改用 `setIcon(el, 'grip-vertical')`，import setIcon |
| [CleanRuleEditorModal.ts](../advanced-obsidian-cleaner/src/modals/CleanRuleEditorModal.ts) | 1. 条件行集成 DragDropManager 2. 条件行 handle 改用 setIcon + draggable=true 3. onClose 中销毁 manager |
| [PreviewCleanModal.ts](../advanced-obsidian-cleaner/src/modals/PreviewCleanModal.ts) | `applyClean()` 增加 ConfirmModal 二次确认 |

---

## 实施顺序

1. **Q1**：Badge 紧凑化（styles.css 三处 CSS 修改）
2. **Q2**：Re-evaluate 实时刷新（Notice + 时间戳 + 按钮指示器）
3. **Q3**：拖拽按钮统一（DragDropManager 图标 → CleanRuleEditorModal 条件行拖拽）
4. **Q4**：Apply Clean 二次确认（PreviewCleanModal 接入 ConfirmModal）
5. **Build + Deploy**
