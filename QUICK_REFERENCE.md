# 🎨 Quick Reference Card - 丝滑可爱 UI 速查表

## 🚀 立即使用

### 动画类名
```css
.fade-in          /* 淡入 */
.pulse            /* 脉冲 */
.hover-scale      /* 缩放交互 */
.shadow-lift      /* 阴影提升 */
.loading-skeleton /* 加载骨架 */
.list-item        /* 列表项（自动延迟） */
```

### 组件速查
```tsx
// 加载
<LoadingState message="加载..." />

// 空状态
<EmptyState title="没有数据" icon="🌸" />

// 错误
<ErrorState title="出错了" onRetry={() => {}} />

// 按钮
<Button size="sm|md|lg" variant="primary|secondary" />

// 卡片
<Card interactive role="owner|puppy" />

// 徽章（自动 emoji）
<Badge className="badge-pending|submitted|approved|rejected|active|paused" />
```

---

## 🎭 颜色速查

| 用途 | 颜色代码 | Emoji | CSS 变量 |
|------|---------|-------|----------|
| 主色 | #c96031 | N/A | var(--brand) |
| 主人 | #8e3a18 | 👑 | var(--owner-base) |
| 仆人 | #5b6b8f | 🐕 | var(--puppy-base) |
| 成功 | #5b8c6f | ✅ | var(--ok) |
| 警告 | #d4a574 | ⏳ | var(--warning) |
| 错误 | #8b2d2d | ❌ | var(--danger) |

---

## ⏱️ 动画速度

```
快速 (150ms)   → 悬停反馈
标准 (200ms)   → 常规交互
平滑 (250ms)   → 按钮/输入
缓慢 (300ms)   → 页面加载
```

---

## 📐 间距速查

```
var(--space-2)  = 8px   (最小)
var(--space-4)  = 16px  (常用)
var(--space-6)  = 24px  (卡片间距)
var(--space-8)  = 32px  (容器)
```

---

## 📱 响应式断点

```css
@media (max-width: 768px) {
  /* 平板 */
  grid-template-columns: 1fr;
}

@media (max-width: 480px) {
  /* 手机 */
  padding: var(--space-3);
}
```

---

## 🎯 完美页面模板

```tsx
export default function Page() {
  return (
    <div className="container fade-in">
      <h1>页面标题</h1>
      
      <div className="grid-2">
        {items.map((item) => (
          <Card 
            key={item.id}
            interactive 
            role="owner"
            className="list-item"
          >
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <Badge className="badge-active">
              {item.status}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## 💡 常见需求

### "我想要加载效果"
```tsx
isLoading ? (
  <LoadingState message="加载中..." />
) : (
  <Content />
)
```

### "我想要空状态"
```tsx
items.length === 0 ? (
  <EmptyState 
    title="没有项目"
    icon="🌸"
    action={<Button>创建</Button>}
  />
) : (
  <ItemList />
)
```

### "我想要可爱徽章"
```tsx
<Badge className={`badge-${task.status}`}>
  {task.status}  {/* 自动加 emoji */}
</Badge>
```

### "我想要级联动画"
```tsx
<div className="grid-2">
  {/* 自动级联延迟 0ms, 100ms, 200ms... */}
  {items.map((i) => <div key={i.id} className="list-item" />)}
</div>
```

### "我想要漂亮表单"
```tsx
<FormField label="邮箱" required error={error}>
  <Input 
    type="email"
    placeholder="your@email.com"
    error={!!error}
  />
</FormField>
```

---

## 🎨 CSS 变量完整表

### 尺寸
```css
--text-xs: 0.75rem
--text-sm: 0.875rem
--text-base: 1rem
--text-lg: 1.125rem
--text-xl: 1.25rem
--text-2xl: 1.5rem
--text-3xl: 1.875rem

--radius-sm: 6px
--radius-md: 12px
--radius-lg: 16px
--radius-xl: 24px
--radius-round: 9999px
```

### 颜色
```css
--brand: #c96031
--owner-base: #8e3a18
--puppy-base: #5b6b8f
--ok: #5b8c6f
--warning: #d4a574
--danger: #8b2d2d
```

### 动画
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-smooth: 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-bounce: 400ms cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## 🔥 Pro Tips

### Tip 1: 自定义延迟
```css
.card {
  animation: slideInUp var(--transition-slow);
  animation-delay: 200ms;  /* 延迟 200ms */
}
```

### Tip 2: 组合动画
```tsx
<div className="fade-in hover-scale shadow-lift">
  淡入 + 缩放 + 阴影提升
</div>
```

### Tip 3: 级联效果
```tsx
{items.map((item, i) => (
  <div 
    key={item.id}
    style={{ animationDelay: `${i * 100}ms` }}
  >
    {item.name}
  </div>
))}
```

### Tip 4: 禁用动画（可访问性）
```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
}
```

---

## 📊 文件快速导航

| 文件 | 用途 | 行数 |
|------|------|------|
| globals.css | 核心样式 | 680 |
| login.css | 登录页面 | 88 |
| dashboard.css | 仪表板 | 156 |
| LoadingState.tsx | 加载组件 | 60 |
| EmptyState.tsx | 空状态 | 50 |
| ErrorState.tsx | 错误态 | 115 |

---

## 🎬 动画演示

### 按钮点击
涟漪扩散 → 向上平移 3px → 阴影增强

### 卡片出现
从下往上滑入 → 级联延迟 100ms

### 加载中
圆圈旋转 + 柔和弹跳 + 脉冲点

### 悬停卡片
向上平移 4px + 阴影增强 + 边框变色

---

## ⚙️ 性能检查

```javascript
// 检查 GPU 加速是否生效
const card = document.querySelector('.card');
const animation = card.getAnimations()[0];
console.log(animation); // 应该显示 CSS animation
```

---

## 🆘 常见问题

**Q: 动画太快？**
A: 增加延迟或改变持续时间
```css
animation-duration: 500ms;  /* 改为 500ms */
```

**Q: 颜色不对？**
A: 检查 CSS 变量
```css
background: var(--brand);  /* 应该是 #c96031 */
```

**Q: Emoji 不显示？**
A: 检查浏览器字体支持，改用 Unicode 码
```css
content: '\23F3';  /* ⏳ */
```

**Q: 动画卡顿？**
A: 检查 transform 使用
```css
transform: translateY(-4px);  /* ✅ 好 */
top: -4px;   /* ❌ 坏 */
```

---

## 📚 深入学习

详见：
- `UI_UX_IMPROVEMENTS.md` - 完整指南
- `DESIGN_TOKENS.md` - 设计系统
- `COMPONENT_EXAMPLES.md` - 实战示例
- `CHANGES_SUMMARY.md` - 改进总结

---

## 🎉 现在就开始用吧！

```bash
# 清除缓存后刷新
Ctrl/Cmd + Shift + R

# 享受丝滑可爱的 UI 体验！
```

---

**完整设计系统已就绪** ✨  
**性能优化完成** ⚡  
**移动端友好** 📱  
**无障碍标准** ♿  

**Happy Coding!** 💖
