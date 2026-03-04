# 🎨 Smooth & Cute UI Design Tokens

## 颜色系统

### 主品牌色
```
品牌主色: #c96031 (温暖的棕红色)
深色: #8e3a18 (深棕)
浅色: #d97d46 (浅棕)
背景: rgba(201, 96, 49, 0.08)
```

### 角色配色

#### 主人 (Owner) - 深色系
```
基础色: #8e3a18
浅色: #d97d46
重音色: #c96031
悬停: #7a3215
背景: rgba(201, 96, 49, 0.08)
```

#### 仆人 (Puppy) - 蓝紫系
```
基础色: #5b6b8f
浅色: #7b8fb5
重音色: #6b7fa8
悬停: #4a5578
背景: rgba(91, 107, 143, 0.08)
```

### 状态颜色

| 状态 | 颜色 | Emoji | 用途 |
|------|------|-------|------|
| 待处理 | #d4a574 | ⏳ | 任务、关系待处理 |
| 已提交 | #5b6b8f | 📤 | 任务已提交 |
| 已批准 | #5b8c6f | ✅ | 任务已批准 |
| 已拒绝 | #8b2d2d | ❌ | 任务被拒绝 |
| 活跃 | #5b8c6f | 💚 | 关系活跃 |
| 暂停 | #607164 | ⏸️ | 关系暂停 |

---

## 排版系统

### 字体大小梯度
```
--text-xs: 0.75rem (12px)    - 辅助文本
--text-sm: 0.875rem (14px)   - 标签、提示
--text-base: 1rem (16px)     - 正文
--text-lg: 1.125rem (18px)   - 副标题
--text-xl: 1.25rem (20px)    - 大标题
--text-2xl: 1.5rem (24px)    - 页面标题
--text-3xl: 1.875rem (30px)  - 主标题
```

### 行高系统
```
--leading-tight: 1.2   - 标题
--leading-normal: 1.5  - 正文
--leading-relaxed: 1.75 - 长文本
```

### 字体权重
```
--font-normal: 400     - 正文
--font-medium: 500     - 强调
--font-semibold: 600   - 副标题
--font-bold: 700       - 标题
```

---

## 间距系统 (8px 网格)

```
--space-1: 4px      --space-10: 40px
--space-2: 8px      --space-12: 48px
--space-3: 12px     --space-16: 64px
--space-4: 16px     --space-20: 80px
--space-5: 20px
--space-6: 24px
--space-7: 28px
--space-8: 32px
```

---

## 圆角系统

```
--radius-sm: 6px      - 小元素
--radius-md: 12px     - 中等元素（默认）
--radius-lg: 16px     - 大卡片
--radius-xl: 24px     - 超大卡片
--radius-round: 9999px - 完全圆形
```

---

## 动画和过渡

### 过渡缓动曲线

#### 快速 (150ms)
```
cubic-bezier(0.4, 0, 0.2, 1)
用于: 简单状态变化
```

#### 标准 (200ms)
```
cubic-bezier(0.4, 0, 0.2, 1)
用于: 常规交互
```

#### 平滑 (250ms)
```
cubic-bezier(0.25, 0.46, 0.45, 0.94)
用于: 按钮悬停、输入框聚焦
```

#### 弹性 (400ms)
```
cubic-bezier(0.34, 1.56, 0.64, 1)
用于: 出现动画
```

### 预定义动画

```css
@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes slideInUp {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes slideInDown {
  0% { opacity: 0; transform: translateY(-20px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes gentle-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(201, 96, 49, 0.3); }
  50% { box-shadow: 0 0 0 8px rgba(201, 96, 49, 0); }
}

@keyframes ripple {
  0% { width: 0; height: 0; opacity: 1; }
  100% { width: 300px; height: 300px; opacity: 0; }
}
```

---

## 阴影系统

### 精细阴影梯度

```
按钮阴影:
  默认: 0 4px 12px rgba(color, 0.2)
  悬停: 0 8px 20px rgba(color, 0.3)

卡片阴影:
  默认: 0 2px 8px rgba(37, 44, 39, 0.06)
  悬停: 0 12px 24px rgba(37, 44, 39, 0.1)

输入焦点:
  0 0 0 4px rgba(201, 96, 49, 0.1)

浮动效果:
  0 20px 36px rgba(37, 44, 39, 0.15)
```

---

## 交互规范

### 按钮状态

#### Primary Button
```
默认: 背景 #c96031, 阴影
悬停: 背景 #8e3a18, 阴影增强, translateY(-3px)
按下: 涟漪效果
禁用: opacity 0.6, cursor not-allowed
```

#### Secondary Button
```
默认: 透明背景, 深色边框
悬停: 浅色背景, 阴影, translateY(-2px)
```

### 输入框状态

#### 默认
```
边框: 2px solid var(--line)
背景: var(--surface)
圆角: 12px
```

#### 聚焦
```
边框: 2px solid var(--brand)
背景: var(--surface-strong)
阴影: 4px 内光晕
```

#### 错误
```
边框颜色: var(--danger)
文本: 显示错误信息
```

### 卡片状态

#### 默认
```
背景: var(--surface-strong)
阴影: 0 2px 8px
圆角: 16px
```

#### 悬停（可交互）
```
阴影: 0 12px 24px
变换: translateY(-4px)
边框: 颜色变化
```

---

## 响应式断点

```css
@media (max-width: 768px) {
  /* 平板和小屏幕 */
  grid-template-columns: 1fr
  padding: var(--space-4)
}

@media (max-width: 480px) {
  /* 手机 */
  padding: var(--space-3)
  font-size: 缩小
}
```

---

## 颜色对比度

所有颜色组合都满足 WCAG AA 标准：
- 正文 vs 背景: 4.5:1 以上
- UI 组件 vs 背景: 3:1 以上
- 图标 vs 背景: 3:1 以上

---

## 使用示例

### 完美的卡片设计
```tsx
<Card interactive role="puppy">
  <CardHeader>
    <h3>标题</h3>
  </CardHeader>
  <CardBody>
    内容在这里
  </CardBody>
  <CardFooter>
    <ButtonGroup>
      <Button variant="primary">操作</Button>
      <Button variant="secondary">取消</Button>
    </ButtonGroup>
  </CardFooter>
</Card>
```

### 流畅的列表
```jsx
<div className="grid-2">
  {items.map((item) => (
    <div key={item.id} className="list-item">
      {/* 自动级联动画 */}
    </div>
  ))}
</div>
```

### 优雅的加载缩略图
```jsx
<div className="loading-skeleton" style={{ height: '200px' }} />
```

---

## 设计哲学

### 核心原则
1. **平滑** - 所有过渡都应该自然流畅
2. **可爱** - 使用温暖的色彩和友好的反馈
3. **清晰** - 强对比，易于使用
4. **一致** - 统一的设计语言

### 微交互指南
- 用户操作 → 立即反馈 (0-150ms)
- 状态变化 → 平滑过渡 (200-300ms)
- 页面转换 → 缓入缓出 (300-400ms)

---

## 🎯 快检清单

- [ ] 所有按钮都有悬停效果
- [ ] 输入框焦点状态清晰
- [ ] 加载状态有动画
- [ ] 空状态有友好提示
- [ ] 错误信息容易看见
- [ ] 卡片有层级感
- [ ] 动画不超过 400ms
- [ ] 颜色对比度满足标准
- [ ] 移动端响应正确
- [ ] 无障碍性符合要求

---

**最后更新**: 2026-03-01
**状态**: ✅ 已完全实现
