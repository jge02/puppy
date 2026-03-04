# 🎯 Smooth & Cute Components - 使用示例

## 快速示例集合

### 1. 流畅的按钮

#### 主按钮 - 点击有涟漪效果
```tsx
<Button variant="primary" size="md">
  👆 点击我
</Button>
```
效果：涟漪 + 向上平移 3px + 阴影增强 (0 8px 20px)

#### 角色按钮
```tsx
<Button role="owner" variant="primary">
  主人的命令
</Button>

<Button role="puppy" variant="primary">
  仆人的行动
</Button>
```

#### 所有尺寸
```tsx
<Button size="sm">小</Button>      {/* 快速操作 */}
<Button size="md">中</Button>      {/* 常用 */}
<Button size="lg">大</Button>      {/* 重要操作 */}
```

#### 次要按钮
```tsx
<Button variant="secondary">
  取消
</Button>
```

---

## 2. 可爱的卡片

### 基础卡片 - 带动画
```tsx
<Card role="owner">
  <CardHeader>
    <h3>📋 任务标题</h3>
  </CardHeader>
  <CardBody>
    <p>这个卡片会从下往上平滑滑入</p>
    <p>hover 时会向上提升 4px</p>
  </CardBody>
  <CardFooter>
    <ButtonGroup>
      <Button variant="primary">完成</Button>
      <Button variant="secondary">取消</Button>
    </ButtonGroup>
  </CardFooter>
</Card>
```

### 可交互卡片
```tsx
<Card interactive role="puppy">
  {/* 有光泽层级效果 */}
  <div style={{ cursor: 'pointer' }}>
    点击我！
  </div>
</Card>
```

### Grid 布局 - 级联动画
```tsx
<div className="grid-2">
  {relationships.map((rel, i) => (
    <Card 
      key={rel.id} 
      className="list-item"  /* 自动延迟动画 */
    >
      {/* 第1个: 0ms, 第2个: 100ms, 第3个: 200ms... */}
      <h3>{rel.name}</h3>
    </Card>
  ))}
</div>
```

---

## 3. 优雅的表单

### 输入框焦点效果
```tsx
<FormField 
  label="邮箱" 
  required
  error={errors.email}
>
  <Input 
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="你的邮箱"
    error={!!errors.email}
  />
</FormField>
```

**聚焦效果**:
- 边框变成品牌色
- 4px 彩色光晕
- 背景色变化
- 平滑过渡 (250ms)

### 文本区域
```tsx
<FormField label="描述" hint="最多 500 字">
  <Textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="请输入详细描述..."
  />
</FormField>
```

### 选择框
```tsx
<FormField label="选择角色">
  <Select
    options={[
      { value: 'owner', label: '主人 👑' },
      { value: 'puppy', label: '仆人 🐕' },
    ]}
    value={role}
    onChange={(e) => setRole(e.target.value)}
  />
</FormField>
```

---

## 4. 可爱的加载状态

### 加载中
```tsx
<LoadingState message="正在加载数据..." />
```

**效果**:
- 旋转加载圈 (spin 1s 循环)
- 柔和弹跳动画 (gentle-bounce)
- 脉冲加载点 (3个点级联)

### 加载骨架屏
```tsx
<div className="loading-skeleton" 
  style={{ 
    height: '200px',
    marginBottom: 'var(--space-4)'
  }} 
/>
```

---

## 5. 友好的空状态

### 没有任务
```tsx
<EmptyState
  title="没有任务"
  description="现在没有要做的事情，来放松一下吧！"
  icon="🌸"
  action={<Button variant="primary">创建任务</Button>}
/>
```

**效果**:
- 大的 emoji (4rem)
- 柔和弹跳 3 秒循环
- 级联淡入动画

### 没有关系
```tsx
<EmptyState
  title="还没有主仆关系"
  description="邀请某人或接受邀请来开始"
  icon="💝"
/>
```

---

## 6. 错误提示

### 错误状态
```tsx
<ErrorState
  title="加载失败"
  description="请检查网络连接后重试"
  error="Network error: 连接超时"
  onRetry={() => window.location.reload()}
  icon="⚠️"
/>
```

**效果**:
- 脉冲 emoji (pulse 2s)
- 可展开的错误详情
- 重试按钮
- 柔和的红色背景

---

## 7. 状态徽章 - 带 Emoji

### 任务状态
```tsx
<Badge className="badge-pending">待处理</Badge>   {/* ⏳ */}
<Badge className="badge-submitted">已提交</Badge>   {/* 📤 */}
<Badge className="badge-approved">已批准</Badge>   {/* ✅ */}
<Badge className="badge-rejected">已拒绝</Badge>   {/* ❌ */}
```

### 关系状态
```tsx
<Badge className="badge-active">活跃</Badge>      {/* 💚 */}
<Badge className="badge-paused">暂停</Badge>      {/* ⏸️ */}
```

**效果**:
- 自动带 emoji 前缀
- Hover 时缩放 1.05
- 圆形胶囊外观
- 清晰的颜色代码

---

## 8. 模态框 - 平滑过渡

### 基础模态框
```tsx
const [isOpen, setIsOpen] = useState(false);

return (
  <>
    <Button onClick={() => setIsOpen(true)}>
      打开对话框
    </Button>

    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="确认操作"
      size="md"
    >
      <p>你确定要删除吗？</p>
      <ModalFooter>
        <Button 
          variant="secondary"
          onClick={() => setIsOpen(false)}
        >
          取消
        </Button>
        <Button variant="danger">删除</Button>
      </ModalFooter>
    </Modal>
  </>
);
```

**受支持的尺寸**:
- `sm`: 400px
- `md`: 600px (默认)
- `lg`: 800px
- `xl`: 1000px

---

## 9. 实践示例：完整的页面

### 登录页面 - 丝滑的表单
```tsx
<div className="login-container">
  <Card className="login-card">
    <CardHeader>
      <h1>💖 欢迎回来</h1>
    </CardHeader>
    <CardBody>
      <Form onSubmit={handleLogin}>
        <FormField label="邮箱" required>
          <Input
            type="email"
            placeholder="your@email.com"
            error={!!errors.email}
          />
        </FormField>
        
        <FormField label="密码" required>
          <Input
            type="password"
            placeholder="••••••••"
            error={!!errors.password}
          />
        </FormField>

        {error && <ErrorState error={error} />}

        <Button 
          variant="primary" 
          size="lg"
          style={{ width: '100%' }}
        >
          登录
        </Button>
      </Form>
    </CardBody>
  </Card>
</div>
```

### 仪表板 - 多卡片布局
```tsx
<div className="container">
  <h1>📊 仪表板</h1>
  
  <div className="grid-2">
    {relationships.map((rel) => (
      <Card key={rel.id} role={rel.myRole} interactive>
        <div className="relationship-header">
          <div className="relationship-avatar">
            {rel.name[0].toUpperCase()}
          </div>
          <div className="relationship-info">
            <p className="relationship-name">
              {rel.name}
            </p>
            <Badge className={`badge-${rel.status}`}>
              {rel.status}
            </Badge>
          </div>
        </div>
        
        <div className="intimacy-score">
          <span>亲密度</span>
          <div className="intimacy-bar">
            <div 
              className="intimacy-fill"
              style={{ width: `${rel.intimacyScore}%` }}
            />
          </div>
        </div>
      </Card>
    ))}
  </div>

  <Card className="task-card">
    <h2>📋 最近的任务</h2>
    {tasks.map((task) => (
      <div key={task.id} className="task-item">
        <h4 className="task-title">{task.title}</h4>
        <p className="task-description">{task.description}</p>
        <div className="task-meta">
          <Badge className={`badge-${task.status}`}>
            {task.status}
          </Badge>
          <span className="task-reward">
            💰 {task.reward} 个硬币
          </span>
        </div>
      </div>
    ))}
  </Card>
</div>
```

---

## 10. 工具类用法

### 普通样式类
```tsx
{/* 淡入效果 */}
<div className="fade-in">内容</div>

{/* 缩放交互 */}
<div className="hover-scale">悬停时缩放 1.02</div>

{/* 阴影提升 */}
<div className="shadow-lift">悬停时增强阴影</div>

{/* 脉冲加载 */}
<div className="pulse">脉冲效果</div>

{/* 加载骨架屏 */}
<div className="loading-skeleton" style={{ height: '100px' }} />
```

### 组合使用
```tsx
<Card className="fade-in hover-scale">
  <h3>淡入 + 缩放的卡片</h3>
</Card>
```

---

## 11. 动画延迟技巧

### 列表项级联
```tsx
<div className="grid-2">
  {items.map((item, index) => (
    <div
      key={item.id}
      className="list-item"  /* 自动延迟 */
      style={{
        animationDelay: `${index * 100}ms`
      }}
    >
      {item.name}
    </div>
  ))}
</div>
```

### 自定义延迟
```tsx
<div style={{
  animation: 'slideInUp var(--transition-slow)',
  animationDelay: '200ms'
}}>
  延迟 200ms 后滑入
</div>
```

---

## 12. 颜色应用

### 角色配色
```tsx
<Card role="owner">
  {/* 左边框: #8e3a18 (主人的棕色) */}
</Card>

<Card role="puppy">
  {/* 左边框: #5b6b8f (仆人的蓝紫色) */}
</Card>
```

### 状态颜色
```tsx
{/* 自动应用颜色和 emoji */}
<Badge className="badge-approved" />      {/* ✅ 绿色 */}
<Badge className="badge-pending" />       {/* ⏳ 黄色 */}
<Badge className="badge-rejected" />      {/* ❌ 红色 */}
```

---

## 性能提示

### ✅ 推荐
```css
/* 使用 CSS 动画（GPU 强化） */
animation: slideInUp var(--transition-slow);

/* 使用 transform */
transform: translateY(-4px);

/* 使用 opacity */
opacity: 0.5;
```

### ❌ 避免
```css
/* 避免频繁重排 */
width: calculations...

/* 避免过多 box-shadow */
box-shadow: multiple...

/* 避免重复计算 */
top, left, right, bottom...
```

---

## 无障碍性

### 焦点样式
自动应用焦点可见样式：
```css
:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
```

### 颜色对比
- 所有文本: 4.5:1 对比度
- 所有 UI: 3:1 对比度
- 支持深色模式（后续）

---

## 🚀 开发快速参考

| 需求 | CSS 类 | React 组件 |
|------|---------|----------|
| 淡入 | `.fade-in` | ✨ 自动 |
| 加载 | `.loading-skeleton` | `<LoadingState>` |
| 空状态 | N/A | `<EmptyState>` |
| 错误 | N/A | `<ErrorState>` |
| 按钮 | `.btn-*` | `<Button>` |
| 卡片 | `.card` | `<Card>` |
| 表单 | N/A | `<FormField>` |
| 徽章 | `.badge-*` | `<Badge>` |
| Grid | `.grid-2` | N/A |

---

**现在就开始使用这些丝滑可爱的组件吧！** 🎉
