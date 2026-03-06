# 评论前端规范

## 概述

评论前端包括两个主要组件（CommentForm 和 CommentList）和一个自定义 Hook（useComments），处理评论的展示、发表和删除交互。

---

## 需求一：评论表单组件

系统 SHALL 提供评论表单组件，允许用户输入、签名和发表评论。

### 场景：成功发表评论

- **当** 用户在 `<CommentForm contentId={123} />` 中输入评论文本
- **那么** 组件显示一个 textarea，maxLength 为 500 字符
- **并** 显示实时字符计数器（已输入 X / 500）
- **当** 用户点击"发表评论"按钮
- **那么** 组件调用 `useSignMessage` Hook（来自 wagmi）签名消息：
  ```
  Comment on content 123 at {timestamp}:
  {text}
  ```
- **并** 如果用户未连接钱包，显示："请先连接钱包"
- **并** 弹出钱包签名窗口（MetaMask / Coinbase Wallet / RainbowKit）
- **当** 用户在钱包中确认签名
- **那么** 组件调用 `postComment()` Hook 发送 POST 请求
- **并** 显示加载态："发表中..."
- **当** API 返回成功（HTTP 201）
- **那么** 清空输入框
- **并** 显示成功提示："评论发表成功！"
- **并** 关闭提示（3 秒后自动消失）
- **并** 通知 CommentList 组件刷新列表（通过父组件 state 或回调）

### 场景：签名被用户取消

- **当** 用户在钱包签名窗口点击"拒绝"或关闭窗口
- **那么** 组件捕获错误，显示："签名已取消"
- **并** 输入框内容保留，用户可重试

### 场景：签名验证失败（后端）

- **当** API 返回 HTTP 401 Unauthorized
- **那么** 组件显示错误提示："签名验证失败，请重新签名"
- **并** 清空输入框

### 场景：文本验证

- **当** 用户尝试提交空白评论（仅空格或无内容）
- **那么** 前端防止提交，显示："评论不能为空"
- **当** 文本超过 500 字符
- **那么** 提交按钮变灰（disabled），计数器变红
- **并** 显示："评论过长（最多 500 字符）"

### 场景：速率限制（前端反馈）

- **当** API 返回 HTTP 429 Too Many Requests
- **那么** 组件显示错误提示："发表过于频繁，请稍候"
- **并** 禁用提交按钮 30 秒

### 场景：网络错误处理

- **当** API 请求超时或网络错误
- **那么** 组件显示错误提示："发表失败，请检查网络"
- **并** 显示"重试"按钮，用户可重新发表

### 样式需求

- CommentForm 应为卡片式样式，顶部显示 Tailwind 风格
- textarea 高度 80-120px，支持自适应高度
- 字符计数器颜色：< 400 字符时绿色，400-500 时黄色，> 500 时红色
- 提交按钮为主色（参考项目设计）
- 移动端（sm）响应式适配

---

## 需求二：评论列表组件

系统 SHALL 提供评论列表组件，按最新优先显示，支持分页和删除操作。

### 场景：加载并显示评论列表

- **当** 页面加载 `<CommentList contentId={123} />`
- **那么** 组件立即调用 `useComments()` Hook，执行 `fetchComments(contentId, 0, 20)`
- **并** 显示加载态：骨架屏（skeleton）或加载动画
- **当** API 返回数据（< 500ms）
- **那么** 显示评论列表，每条评论包含：
  - 用户地址（缩写显示，如 `0x1234...5678`）
  - 评论文本（最多 500 字符）
  - 发表时间（相对时间，如"2 小时前"或"3 天前"）
  - 用户头像（可选，默认地址缩写）
- **并** 评论按 `createdAt DESC` 排序（最新优先）

### 场景：无评论时的占位符

- **当** 内容没有任何评论（`total: 0`）
- **那么** 列表显示占位符："暂无评论，成为第一个评论者吧"
- **并** 仍显示 CommentForm（鼓励用户发表评论）

### 场景：分页 — 加载更多

- **当** 用户滚动到列表底部或点击"加载更多"按钮
- **那么** 组件计算下一个 offset（当前已加载数量）
- **并** 调用 `fetchComments(contentId, offset, 20)`
- **并** 显示加载态："加载中..."
- **当** API 返回
- **那么** 新评论追加到列表末尾（页面不跳转）
- **当** 所有评论已加载（`offset + limit >= total`）
- **那么** 隐藏或禁用"加载更多"按钮
- **并** 显示："已加载全部评论" 或按钮消失

### 场景：只有所有人看到删除按钮

- **当** 当前用户的地址与评论的 `commenter` 一致
- **那么** 该评论显示"删除"按钮（可放在评论右上角或悬停显示）
- **当** 用户地址与评论的 `commenter` 不一致
- **那么** 不显示删除按钮
- **当** 用户未连接钱包
- **那么** 其他用户的评论也不显示删除按钮

### 场景：删除自己的评论

- **当** 用户点击评论旁的"删除"按钮
- **那么** 显示确认对话框："确定要删除这条评论吗？"（可选）
- **当** 用户确认
- **那么** 组件调用 `deleteComment(commentId)` Hook
- **并** Hook 构建删除消息：`Delete comment {commentId}`
- **并** 调用 `useSignMessage` 请求签名
- **当** 用户确认签名
- **那么** Hook 发送 DELETE 请求到 `/api/comments/:id`
- **并** 列表显示临时加载态（该评论变淡或显示"删除中..."）
- **当** API 返回成功
- **那么** 评论从列表中立即移除（无动画或淡出动画）
- **并** 显示成功提示："评论已删除"

### 场景：删除失败 — 权限不足

- **当** API 返回 HTTP 403 Forbidden
- **那么** 列表显示错误提示："无权删除此评论"
- **并** 但评论仍保留在列表中（未被删除）

### 场景：删除失败 — 签名验证失败

- **当** API 返回 HTTP 401 Unauthorized
- **那么** 列表显示错误提示："签名验证失败，请重试"

### 场景：评论列表实时更新

- **当** CommentForm 成功发表新评论后
- **那么** 通知 CommentList 刷新（新评论应立即出现在顶部）
- **方式**：父组件回调、Context、或重新查询

### 样式需求

- 评论列表应为卡片式样式，每条评论为独立的卡片 / 边框区域
- 地址显示为 `0x` 开头的缩写（提供 copy 功能可选）
- 时间戳应为浅灰色小字体
- 删除按钮为红色或警告色，悬停时显示确认提示
- 加载态和空态应清晰可见
- 移动端响应式适配（评论卡片全宽）
- 支持深色模式（如果项目有）

---

## 需求三：useComments 自定义 Hook

系统 SHALL 提供 `useComments()` Hook 处理所有内容评论的数据逻辑。

### 场景：初始化

- **当** 组件调用 `const { comments, loading, error, total, fetchComments, postComment, deleteComment } = useComments(contentId)`
- **那么** Hook 返回以下状态和方法：
  ```typescript
  {
    comments: Comment[],         // 当前已加载的评论数组
    loading: boolean,            // 是否在加载中
    error: string | null,        // 错误消息
    total: number,               // 评论总数
    fetchComments: (offset, limit) => Promise<void>,
    postComment: (text) => Promise<void>,
    deleteComment: (id) => Promise<void>
  }
  ```
- **并** Hook 初始化时不自动调用 API（等待组件显式调用 fetchComments）

### 场景：fetchComments 方法

- **当** 组件调用 `fetchComments(0, 20)` 获取第一页
- **那么** Hook 设置 `loading = true`
- **并** 发送 GET `/api/comments?contentId={contentId}&limit=20&offset=0`
- **并** 如果成功（HTTP 200）
  - 更新 `comments = data.data`（覆盖或追加）
  - 更新 `total = data.total`
  - 清空 `error`
  - 设置 `loading = false`
- **并** 如果失败
  - 设置 `error = "Failed to load comments"`
  - 设置 `loading = false`

### 场景：postComment 方法

- **当** 组件调用 `postComment("很好的内容！")`
- **那么** Hook 执行以下步骤：
  1. 获取当前用户地址（从 wagmi useAccount）
  2. 如果未连接钱包，抛出错误："Please connect wallet"
  3. 生成时间戳：`timestamp = Math.floor(Date.now() / 1000)`
  4. 生成消息：`message = "Comment on content {contentId} at {timestamp}:\n{text}"`
  5. 调用 `signMessageAsync({ message })`（来自 wagmi）获得签名
  6. 发送 POST `/api/comments` 请求，包含 `{ contentId, text, message, signature, timestamp }`
  7. 如果成功（HTTP 201）
     - 在 `comments` 数组头部追加新评论
     - 增加 `total += 1`
     - 清空 `error`
     - 返回成功
  8. 如果失败，设置 `error` 并抛出异常

### 场景：deleteComment 方法

- **当** 组件调用 `deleteComment(456)`
- **那么** Hook 执行以下步骤：
  1. 获取当前用户地址
  2. 生成时间戳和删除消息：`message = "Delete comment 456"`
  3. 调用 `signMessageAsync({ message })` 获得签名
  4. 发送 DELETE `/api/comments/456` 请求，包含 `{ signature, message, timestamp }`
  5. 如果成功（HTTP 200）
     - 从 `comments` 数组中移除该评论
     - 清空 `error`
     - 返回成功
  6. 如果失败（403、401 等），设置 `error` 并抛出异常

### 场景：错误处理

- Hook 应捕获以下错误类型并设置对应的 `error` 消息：
  - 网络错误："Network error，please check your connection"
  - API 返回 401："Unauthorized，please sign again"
  - API 返回 403："Forbidden，you don't have permission"
  - API 返回 404："Not found"
  - API 返回 429："Rate limited，please wait"
  - API 返回其他：`"Error: {statusCode} {message}"`

### 场景：与 wagmi 集成

- Hook 内部使用 `wagmi v2` 的以下 Hook：
  - `useAccount()` — 获取当前连接的地址
  - `useSignMessage()` — 获得 `signMessageAsync()` 方法
  - 签名时使用 `personal_sign` 方法（EIP-191）

---

## 不包含的需求

以下不属于本规范范围：

- ❌ 编辑评论（删除并重新发表）
- ❌ 评论点赞/反应
- ❌ 评论回复/嵌套
- ❌ @ 提及通知
- ❌ 链上评论锚定
- ❌ AI 内容审核
- ❌ 评论搜索功能
- ❌ 头像/用户资料卡
