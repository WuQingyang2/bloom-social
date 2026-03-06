# Change: 添加评论功能

## Why

BloomSocial 当前只有点赞和关注两种互动方式，缺乏评论功能。评论是内容社交平台的核心交互能力：
- 用户无法在内容下进行深度讨论
- 无法表达对内容的具体看法和反馈
- 这限制了内容的传播深度和社区凝聚力

添加评论功能将显著提升用户参与度和平台活跃度。

## What Changes

### 1. 数据库基础设施（新增 PostgreSQL）

- 在 `frontend-project` 中新增 PostgreSQL 数据库配置
- 创建 `comments` 表，存储评论正文、签名、元数据
- 在 `.env.local` 中添加数据库凭证

### 2. API 路由（链下存储）

在 `frontend-project/src/app/api/` 中新增：
- `POST /api/comments` - 创建评论（含 EIP-191 签名验证）
- `GET /api/comments?contentId=xxx` - 获取评论列表（分页）
- `DELETE /api/comments/:id` - 删除评论（仅评论人）

### 3. 前端组件

- `CommentForm.tsx` - 评论发表组件（含钱包签名流程）
- `CommentList.tsx` - 评论列表组件（分页、删除）
- 集成到 `content/[id]/page.tsx` 内容详情页

### 4. 签名验证机制

- 使用 EIP-191 `personal_sign` 进行身份认证
- 签名格式：`Comment on content ${contentId} at ${timestamp}:\n${text}`
- 前端与后端双重验证签名有效性

## Impact

- **Affected Specs**: 新增 `comment` 能力规范
- **Affected Code**:
  - `frontend-project/src/app/api/comments/` - 新增 API 路由（3 个文件）
  - `frontend-project/src/components/` - 新增 CommentForm、CommentList 组件
  - `frontend-project/src/hooks/useComments.ts` - 新增评论数据管理 hook
  - `frontend-project/src/lib/db.ts` - 新增数据库连接池
  - `frontend-project/src/lib/signature.ts` - 新增签名验证工具
  - `frontend-project/src/app/content/[id]/page.tsx` - 集成评论组件
  - `frontend-project/.env.local` - 新增 PostgreSQL 凭证
  - `frontend-project/package.json` - 新增 `pg` 依赖
- **Database**: 新增 PostgreSQL 配置和 `comments` 表
- **Subgraph**: 不涉及（评论不上链）
- **Contract**: 不涉及（评论无需链上事件）
- **BREAKING**: None（纯新增功能，不影响现有代码）

## Out of Scope (MVP)

- 编辑评论（使用删除 + 重新发表代替）
- 评论点赞/踩（V1.2+）
- 评论回复/嵌套（V1.2+）
- 评论全文搜索（V1.2+）
- AI 内容审核/过滤（V1.2+）
- 链上哈希锚定（可选升级，V1.1+）
- IPFS 备份（可选升级，V1.1+）
- @ 提及用户（V1.2+）
- Markdown / 富文本支持（V1.2+）