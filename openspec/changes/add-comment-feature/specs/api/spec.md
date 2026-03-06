# 评论 API 规范

## 概述

评论 API 提供三个核心路由，支持用户发表、查看和删除评论。所有请求/响应均采用 JSON 格式，使用 EIP-191 签名进行身份验证。

---

## 需求一：创建评论（POST）

系统 SHALL 允许经过身份验证的用户在内容下发表文本评论。

### 场景：成功创建评论

- **当** 前端向 `POST /api/comments` 发送请求，包含以下 body：
  ```json
  {
    "contentId": 123,
    "text": "这是一个很好的内容！",
    "message": "Comment on content 123 at 1704067200:\n这是一个很好的内容！",
    "signature": "0xabcd...xyz",
    "timestamp": 1704067200
  }
  ```
- **那么** 后端验证签名并恢复用户地址
- **并** 验证消息格式：`Comment on content {contentId} at {timestamp}:\n{text}`
- **并** 验证时间戳在 ±5 分钟内
- **并** 验证内容 ID 存在
- **并** 验证文本长度 ≤ 500 字符
- **并** 将评论插入数据库，包含：
  - `id`: 主键（自增）
  - `content_id`: 内容 ID
  - `commenter`: 恢复的地址（BYTEA）
  - `text`: 评论文本
  - `signature`: 完整签名
  - `message`: 原始消息（用于验证）
  - `created_at`: 服务器时间戳
  - `deleted_at`: NULL（活跃评论）
- **并** 返回 HTTP 201 Created，包含新建评论的完整对象：
  ```json
  {
    "id": "comment-456",
    "contentId": 123,
    "commenter": "0x1234567890abcdef...",
    "text": "这是一个很好的内容！",
    "createdAt": 1704067200,
    "signature": "0xabcd...xyz"
  }
  ```

### 场景：签名验证失败

- **当** 用户签名无效或伪造
- **那么** 后端返回 HTTP 401 Unauthorized，message: `"Signature verification failed"`
- **并** 评论不被存储
- **并** 前端显示错误提示："签名验证失败"

### 场景：内容 ID 无效

- **当** contentId 缺失、非数字或指向不存在的内容
- **那么** 后端返回 HTTP 400 Bad Request，message: `"Invalid content ID"`
- **并** 评论不被存储

### 场景：评论文本为空或过长

- **当** 评论文本为空或超过 500 字符
- **那么** 前端防止提交，显示验证错误
- **并** 后端也验证并拒绝（如果绕过前端检查）
- **那么** 返回 HTTP 400 Bad Request，message: `"Comment text must be 1-500 characters"`

### 场景：时间戳过期

- **当** 签名的时间戳与当前时间相差 > 5 分钟
- **那么** 后端返回 HTTP 400 Bad Request，message: `"Timestamp expired (must be within ±5 minutes)"`
- **并** 评论不被存储（防止重放攻击）

### 场景：速率限制

- **当** 同一地址在 60 秒内发送 > 10 个 POST 请求
- **那么** 后端返回 HTTP 429 Too Many Requests，message: `"Rate limit exceeded. Please wait before posting another comment"`
- **并** 前端显示："请稍候再发表评论"

---

## 需求二：列表评论（GET）

系统 SHALL 按内容检索所有评论，按最新优先排序，支持分页。

### 场景：成功列表查询

- **当** 前端向 `GET /api/comments?contentId=123&limit=20&offset=0` 发送请求
- **那么** 后端查询所有 `deleted_at IS NULL` 的评论
- **并** 按 `created_at DESC`（最新优先）排序
- **并** 返回 HTTP 200 OK，包含：
  ```json
  {
    "data": [
      {
        "id": "comment-456",
        "contentId": 123,
        "commenter": "0x1234567890abcdef...",
        "text": "非常好的内容！",
        "createdAt": 1704067200
      },
      {
        "id": "comment-455",
        "contentId": 123,
        "commenter": "0xfedcba9876543210...",
        "text": "我同意这个观点",
        "createdAt": 1704066800
      }
    ],
    "total": 42,
    "limit": 20,
    "offset": 0
  }
  ```
- **并** 响应时间 < 500ms（p95）

### 场景：分页 — 加载下一页

- **当** 前端向 `GET /api/comments?contentId=123&limit=20&offset=20` 发送请求
- **那么** 后端返回第二批 20 条评论
- **并** 当 `offset + limit >= total` 时，前端隐藏"加载更多"按钮

### 场景：无评论时

- **当** 内容的评论总数为 0（`total: 0`）
- **那么** 后端返回空的 `data: []`
- **并** 前端显示占位符："暂无评论，成为第一个评论者吧"

### 场景：查询参数缺失或无效

- **当** 缺失 contentId 或 contentId 非数字
- **那么** 后端返回 HTTP 400 Bad Request，message: `"Missing or invalid contentId"`
- **当** limit 或 offset 为负数或非数字
- **那么** 返回 HTTP 400，使用默认值（limit=20, offset=0）

### 场景：隐藏软删除评论

- **当** 评论被软删除（`deleted_at IS NOT NULL`）
- **那么** 该评论不出现在列表中
- **并** 总数不包括已删除的评论

---

## 需求三：删除评论（DELETE）

系统 SHALL 允许用户仅删除自己的评论。删除采用软删除（逻辑标记，物理数据保留）。

### 场景：成功删除自己的评论

- **当** 评论所有人向 `DELETE /api/comments/456` 发送请求，包含 body：
  ```json
  {
    "signature": "0xabcd...xyz",
    "message": "Delete comment 456",
    "timestamp": 1704068000
  }
  ```
- **那么** 后端验证签名并恢复地址
- **并** 将恢复的地址与评论的 `commenter` 字段比对
- **并** 如果地址匹配，更新 `deleted_at = NOW()`
- **并** 返回 HTTP 200 OK，message: `"Comment deleted successfully"`
- **并** 返回已删除的评论对象（包含新的 `deletedAt` 字段）

### 场景：地址不匹配（无权限删除）

- **当** 不同地址的用户尝试使用他人的签名删除评论
- **那么** 签名验证失败，恢复的地址与评论的 `commenter` 不匹配
- **并** 后端返回 HTTP 403 Forbidden，message: `"You cannot delete this comment"`
- **并** 评论不被删除

### 场景：评论 ID 不存在

- **当** 请求的评论 ID 不存在或已被删除
- **那么** 后端返回 HTTP 404 Not Found，message: `"Comment not found"`

### 场景：签名验证失败

- **当** 删除消息的签名无效
- **那么** 后端返回 HTTP 401 Unauthorized，message: `"Signature verification failed"`
- **并** 评论不被删除

### 场景：时间戳过期

- **当** 删除签名的时间戳与当前时间相差 > 5 分钟
- **那么** 后端返回 HTTP 400 Bad Request，message: `"Timestamp expired"`
- **并** 评论不被删除

---

## 需求四：数据真实性保证

系统 SHALL 通过签名和时间戳证明评论的归属和时间。

### 场景：评论签名可验证

- **已知** 数据库中存在评论，包含：
  - `commenter` = `0x1234...`
  - `text` = "很好的内容！"
  - `signature` = `0xabcd...xyz`（EIP-191 签名）
  - `message` = `"Comment on content 123 at 1704067200:\n很好的内容！"`
- **当** 系统管理员或审计工具运行 `recoverMessageAddress(message, signature)`（使用 viem）
- **那么** 恢复的地址与 `commenter` 相匹配
- **并** 这证明了评论由该地址签名，且时间戳准确

### 场景：评论时间戳被记录

- **已知** 评论被发表
- **当** 从数据库检索评论时
- **那么** `created_at` 字段被设置为发表时的服务器时间戳
- **并** 此时间戳显示给用户（例如"2 小时前发表"）

### 场景：无法篡改历史评论

- **已知** 评论已存储，包含 `signature` 和 `message`
- **当** 攻击者尝试修改数据库中的 `text` 字段
- **那么** `message` 和 `signature` 不再匹配
- **并** 审计验证 `recoverMessageAddress()` 时失败
- **并** 表明评论已被篡改

---

## 不包含的需求

以下不属于本规范范围：

- ❌ 编辑评论（用户删除并重新发表）
- ❌ 评论点赞/反应（后续版本）
- ❌ 评论回复/嵌套（后续版本）
- ❌ @ 提及用户（后续版本）
- ❌ 链上评论锚定（当前仅离链存储）
- ❌ AI 内容审核（后续可添加）
- ❌ 评论全文搜索（后续版本）
