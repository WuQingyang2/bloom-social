# 评论功能实现任务清单

## 1. 数据库环境配置

- [ ] 1.1 安装 PostgreSQL（选择 Docker 或 Homebrew）
  - Docker: `docker run --name bloom-postgres -e POSTGRES_PASSWORD=yourpass -p 5432:5432 -d postgres:15`
  - Homebrew: `brew install postgresql@15 && brew services start postgresql@15`
- [ ] 1.2 创建数据库 `bloom_social`
  - `CREATE DATABASE bloom_social;`
- [ ] 1.3 创建 migration 文件 `migrations/001_create_comments.sql`
- [ ] 1.4 执行 migration 创建 `comments` 表和索引
- [ ] 1.5 在 `frontend-project/.env.local` 添加数据库凭证
  ```
  DB_USER=postgres
  DB_PASSWORD=yourpass
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=bloom_social
  ```
- [ ] 1.6 验证数据库连接（运行测试 SQL 查询）

## 2. 后端 API 开发 (frontend-project)

### 2.1 基础设施

- [ ] 2.1.1 安装 PostgreSQL 驱动：`npm install pg @types/pg`（在 frontend-project）
- [ ] 2.1.2 创建 `src/lib/db.ts` — PostgreSQL 连接池
- [ ] 2.1.3 创建 `src/lib/signature.ts` — 签名验证工具函数
  - `recoverAddressFromMessage(message, signature)` - 使用 viem
  - `validateCommentMessage(message, contentId, timestamp, text)` - 验证消息格式

### 2.2 API 路由：POST /api/comments

- [ ] 2.2.1 创建 `src/app/api/comments/route.ts`
- [ ] 2.2.2 实现 POST 处理器（创建评论）
  - 解析请求 body（contentId, text, signature, message, timestamp）
  - 验证签名，恢复地址
  - 验证消息格式
  - 验证时间戳在 ± 5 分钟内
  - 验证文本长度 ≤ 500
  - 插入数据库
  - 返回新建评论

### 2.3 API 路由：GET /api/comments

- [ ] 2.3.1 在 `src/app/api/comments/route.ts` 实现 GET 处理器
- [ ] 2.3.2 支持查询参数：`contentId`, `limit`, `offset`
- [ ] 2.3.3 查询逻辑：过滤 `deleted_at IS NULL`，按 `created_at DESC` 排序
- [ ] 2.3.4 返回评论列表和总数

### 2.4 API 路由：DELETE /api/comments/:id

- [ ] 2.4.1 创建 `src/app/api/comments/[id]/route.ts`
- [ ] 2.4.2 实现 DELETE 处理器
  - 查询评论获取 commenter 地址
  - 验证删除签名
  - 比对地址是否匹配
  - 更新 `deleted_at` 标记软删除
  - 返回成功或 403 错误

### 2.5 错误处理与验证

- [ ] 2.5.1 统一错误响应格式
- [ ] 2.5.2 添加速率限制（可选，防止spam）
- [ ] 2.5.3 添加请求日志记录

## 3. 前端逻辑层 (frontend-project)

### 3.1 Hooks

- [ ] 3.1.1 创建 `src/hooks/useComments.ts`
  - `fetchComments(contentId, offset, limit)` - 调用 GET API
  - `postComment(contentId, text)` - 签名并调用 POST API
  - `deleteComment(commentId)` - 签名并调用 DELETE API
  - 管理状态：comments, loading, error, total
- [ ] 3.1.2 测试 hook（手动或单元测试）

### 3.2 组件开发

- [ ] 3.2.1 创建 `src/components/CommentForm.tsx`
  - 输入框（maxLength 500）
  - 字符计数器
  - "Post Comment" 按钮
  - 请求钱包签名（useSignMessage）
  - 调用 postComment
  - 错误提示和加载态
- [ ] 3.2.2 创建 `src/components/CommentList.tsx`
  - 展示评论列表（地址、文本、时间）
  - 地址缩写显示（0x1234...5678）
  - 时间格式化（使用 date-fns 或 relative time）
  - 仅评论人看到"Delete"按钮
  - 分页控件（Load More 或 上一页/下一页）
  - 加载中、空状态展示
- [ ] 3.2.3 样式优化（Tailwind CSS）

## 4. 前端集成

- [ ] 4.1 在 `src/app/content/[id]/page.tsx` 引入 CommentForm 和 CommentList
- [ ] 4.2 在点赞组件下方放置评论区块
- [ ] 4.3 确保响应式布局（移动端适配）
- [ ] 4.4 测试钱包未连接时的状态展示

## 5. 测试

### 5.1 单元测试

- [ ] 5.1.1 签名验证函数测试
  - 正确签名 → 恢复正确地址
  - 错误签名 → 抛出异常
  - 消息格式验证
- [ ] 5.1.2 API 参数验证测试
  - 缺少必需字段 → 400 错误
  - 文本超长 → 400 错误
  - 时间戳过期 → 400 错误

### 5.2 集成测试

- [ ] 5.2.1 完整流程测试：发表 → 列表 → 删除
- [ ] 5.2.2 并发测试（多用户同时评论）
- [ ] 5.2.3 边界测试（500 字符、空评论、特殊字符）

### 5.3 手动 E2E 测试

- [ ] 5.3.1 连接钱包（MetaMask / Coinbase Wallet）
- [ ] 5.3.2 进入某内容页
- [ ] 5.3.3 发表评论（确保签名弹出、评论立即显示）
- [ ] 5.3.4 刷新页面，评论仍存在
- [ ] 5.3.5 删除自己的评论，验证删除成功
- [ ] 5.3.6 尝试删除他人评论，验证被拒绝（403）
- [ ] 5.3.7 测试分页功能（发表 > 20 条评论）

## 6. 文档与部署

- [ ] 6.1 更新 `README.md`
  - 添加评论功能说明
  - 添加 PostgreSQL 安装指南
  - 添加环境变量配置说明
- [ ] 6.2 创建开发指南文档
  - 如何本地启动 PostgreSQL
  - 如何运行 migration
  - 如何测试 API
- [ ] 6.3 性能测试
  - 评论列表加载时间（目标 < 500ms）
  - 发表评论响应时间（目标 < 2 秒）
  - 数据库连接池监控
- [ ] 6.4 数据库备份计划
  - 定期备份脚本（pg_dump）
  - 恢复测试

## 7. 可选增强（不在 MVP 中）

- [ ] 7.1 评论哈希锚定到链上
  - 新增 `CommentAnchored` 合约事件
  - 修改 API 同时调用合约
  - Subgraph 索引评论事件
- [ ] 7.2 IPFS 备份
  - 评论存储到 IPFS
  - `content_uri` 字段记录 IPFS CID
- [ ] 7.3 Subgraph 索引（如果有链上事件）
  - 更新 schema.graphql
  - 新增 Comment entity
  - 实现 mapping
- [ ] 7.4 评论搜索功能
  - PostgreSQL 全文搜索（tsvector + gin 索引）
  - 前端搜索框组件
- [ ] 7.5 评论点赞功能
  - 新增 comment_likes 表
  - API 路由：POST /api/comments/:id/like
  - 前端点赞按钮

---

## 预期时间线

| 任务块 | 预期天数 | 里程碑 |
|--------|---------|--------|
| 1. 数据库环境配置 | 0.5 day | PostgreSQL 可用，migration 完成 |
| 2. 后端 API 开发 | 1.5 days | 3 个 API 路由全部通过测试 |
| 3. 前端逻辑层 | 1 day | Hooks + Components 实现 |
| 4. 前端集成 | 0.5 day | 内容页能看到评论区块 |
| 5. 测试 | 1 day | 单元测试、集成测试、E2E 全部通过 |
| 6. 文档与部署 | 0.5 day | README 更新，性能验证 |
| **总计** | **~5 days** | 含缓冲和 code review |

---

## Success Criteria（完成标准）

- ✅ 用户能发表评论（签名、存储、立即显示）
- ✅ 评论列表能正确加载、分页、排序
- ✅ 用户能删除自己的评论（软删除）
- ✅ 无法删除他人评论（403 错误）
- ✅ API 响应时间 < 500ms（p95）
- ✅ 单元测试覆盖率 > 80%
- ✅ 手动 E2E 测试全部通过
- ✅ 数据库备份和恢复流程验证
- ✅ README 和开发指南完整更新
