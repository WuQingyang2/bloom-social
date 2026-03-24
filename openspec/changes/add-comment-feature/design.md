# 评论功能技术设计

## Context

BloomSocial 是一个链上内容平台，当前用户互动仅限于点赞和关注。评论功能需要在保持去中心化理念的同时，兼顾性能、成本和用户体验。

**关键约束**：
- 评论是高频文本数据，全上链成本高且不可编辑
- 需要证明"评论来自某地址"，不能匿名或伪造
- 需要支持分页、排序、删除等基本操作
- 教学项目，优先简洁可维护而非极致优化

**设计原则**：
- 链下优先：评论正文存 PostgreSQL，快速且低成本
- 签名防伪：EIP-191 钱包签名，无需交易费用
- 可升级：预留字段支持后续链上锚定或 IPFS 备份

## Goals / Non-Goals

**Goals**:
- ✅ 用户能快速发表评论（< 2 秒响应）
- ✅ 评论列表能分页查询（< 500ms 加载）
- ✅ 评论人能删除自己的评论（软删除）
- ✅ 可追溯"谁在什么时间说了什么"（签名 + 时间戳）
- ✅ 后期可无缝升级为链上锚定或 IPFS 备份

**Non-Goals**:
- ❌ 链上写入评论正文（成本高，不可编辑）
- ❌ 评论编辑功能（复杂度高，暂用删除代替）
- ❌ AI 内容审核（可后续集成第三方 API）
- ❌ 全文搜索（V1.2+）
- ❌ 实时评论推送（V1.2+）

---

## Decisions

### D1: 存储架构 — PostgreSQL + 可选链上锚定

#### 选择

评论正文和元数据存储在 **PostgreSQL 数据库**，预留 `message_hash` 字段支持后续链上锚定。

#### 数据模型

```sql
CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  content_id BIGINT NOT NULL,                -- 所属内容 ID
  commenter BYTEA NOT NULL,                  -- 评论人地址（20 字节）
  text TEXT NOT NULL CHECK (char_length(text) <= 500),  -- 评论正文
  signature TEXT NOT NULL,                   -- EIP-191 签名（0x 开头）
  message_hash BYTEA,                        -- 签名消息哈希（预留）
  created_at BIGINT NOT NULL,                -- 创建时间戳（Unix 秒）
  deleted_at BIGINT,                         -- 软删除时间戳
  content_uri VARCHAR(255),                  -- IPFS/Arweave URI（预留）
  
  CONSTRAINT comments_unique_idx UNIQUE(content_id, commenter, created_at)
);

-- 索引优化查询
CREATE INDEX idx_comments_content_time ON comments(content_id, created_at DESC) 
  WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_commenter ON comments(commenter);
```

#### 理由

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **PostgreSQL（选择）** | 查询快（毫秒级）、免费、易管理、SQL 标准 | 中心化、需自建 | ✅ 最优 |
| 全上链 | 完全去中心化、不可篡改 | Gas 费高、不可编辑、难合规 | ❌ 不适合高频文本 |
| IPFS 主存 | 去中心化、内容寻址 | 查询慢（秒级）、分页复杂 | ❌ 不适合动态查询 |
| MongoDB | 灵活 schema、写入快 | 事务弱、空间占用大 | ⚠️ 评论是结构化数据，关系型更优 |
| Firebase | 托管、实时同步 | 按流量付费、厂商锁定 | ❌ 教学项目成本高 |

**为什么选 PostgreSQL**：
1. **性能** — 索引优化后查询 < 100ms
2. **成本** — 完全免费（自建）
3. **灵活** — 可随时加字段、改索引、迁移数据
4. **生态** — Web3 项目常用（Uniswap、Aave 都用 PG）
5. **可升级** — 预留 `message_hash` 和 `content_uri` 支持后续链上锚定

---

### D2: 身份认证 — EIP-191 钱包签名

#### 选择

使用 **EIP-191 `personal_sign`** 进行身份认证，前后端双重验证。

#### 签名流程

```typescript
// 前端：用户发表评论
const timestamp = Math.floor(Date.now() / 1000);
const message = `Comment on content ${contentId} at ${timestamp}:\n${text}`;
const signature = await signMessage({ message });

// 调用 API
await fetch('/api/comments', {
  method: 'POST',
  body: JSON.stringify({ contentId, text, signature, message, timestamp })
});
```

```typescript
// 后端：验证签名
import { recoverMessageAddress } from 'viem';

const recoveredAddress = await recoverMessageAddress({
  message,
  signature
});

if (recoveredAddress.toLowerCase() !== expectedCommenter.toLowerCase()) {
  throw new Error('Invalid signature');
}
```

#### 消息格式

```
Comment on content ${contentId} at ${timestamp}:\n${commentText}
```

**示例**：
```
Comment on content 123 at 1704067200:
Great article! Thanks for sharing.
```

#### 理由

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **EIP-191（选择）** | 无 Gas 费、wagmi 原生支持、简单快速 | 需要用户确认弹窗 | ✅ 最优 |
| EIP-712 | 类型化签名、可读性好 | 实现复杂、overkill | ⚠️ 过度设计 |
| JWT Token | Web2 标准、无弹窗 | 无法证明链上身份 | ❌ 不适合 Web3 |
| 链上交易 | 完全去中心化 | Gas 费用、速度慢 | ❌ 不适合高频操作 |

**为什么选 EIP-191**：
1. **免费** — 不需要发交易，无 Gas 费
2. **快速** — 签名在本地完成，< 1 秒
3. **标准** — wagmi `useSignMessage` 开箱即用
4. **可验证** — 后端用 `viem` 恢复地址，100% 可靠

---

### D3: API 设计 — RESTful 风格

#### API 路由结构

```
frontend-project/src/app/api/comments/
├── route.ts                    # POST /api/comments, GET /api/comments
└── [id]/route.ts               # DELETE /api/comments/:id
```

#### API 1: POST /api/comments

**创建评论**

```typescript
// 请求
POST /api/comments
Content-Type: application/json

{
  "contentId": 123,
  "text": "Great article!",
  "signature": "0xabcd...",
  "message": "Comment on content 123 at 1704067200:\nGreat article!",
  "timestamp": 1704067200
}

// 响应 200 OK
{
  "id": "456",
  "contentId": 123,
  "commenter": "0x1234...",
  "text": "Great article!",
  "createdAt": 1704067200
}

// 错误 400 Bad Request
{
  "error": "Invalid signature"
}
```

**验证逻辑**：
1. 验证签名有效性（恢复地址）
2. 验证消息格式符合约定
3. 验证时间戳在合理范围内（防止重放攻击，± 5分钟）
4. 验证文本长度 ≤ 500 字符
5. 检查 contentId 是否存在（可选：调用合约 view 函数）

#### API 2: GET /api/comments

**获取评论列表**

```typescript
// 请求
GET /api/comments?contentId=123&limit=20&offset=0

// 响应 200 OK
{
  "data": [
    {
      "id": "456",
      "contentId": 123,
      "commenter": "0x1234...",
      "text": "Great article!",
      "createdAt": 1704067200
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**查询逻辑**：
```sql
SELECT * FROM comments
WHERE content_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

**性能优化**：
- 使用复合索引 `(content_id, created_at DESC)` 加速查询
- 部分索引 `WHERE deleted_at IS NULL` 减少索引大小
- 限制 `limit` 最大值为 100（防止恶意查询）

#### API 3: DELETE /api/comments/:id

**删除评论（软删除）**

```typescript
// 请求
DELETE /api/comments/456
Content-Type: application/json

{
  "signature": "0xabcd...",
  "message": "Delete comment 456 at 1704068000"
}

// 响应 200 OK
{
  "success": true
}

// 错误 403 Forbidden
{
  "error": "Unauthorized. Only the commenter can delete this comment."
}
```

**验证逻辑**：
1. 查询评论，获取 `commenter` 地址
2. 验证签名，恢复地址
3. 比对地址是否匹配
4. 标记软删除：`UPDATE comments SET deleted_at = ? WHERE id = ?`

**理由**：
- 软删除保留审计痕迹（可事后审查）
- 防止误删（可恢复）
- 不影响数据库外键关系

---

### D4: 前端集成 — React Hooks + Components

#### 组件架构

```
src/
├── app/content/[id]/page.tsx   # 集成评论到内容页
├── components/
│   ├── CommentForm.tsx          # 发表评论表单
│   └── CommentList.tsx          # 评论列表
├── hooks/
│   └── useComments.ts           # 评论数据管理
└── lib/
    ├── db.ts                    # PostgreSQL 连接池
    └── signature.ts             # 签名验证工具
```

#### useComments Hook（简化版）

```typescript
export function useComments(contentId: number) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const { signMessageAsync } = useSignMessage();

  const fetchComments = async () => {
    const res = await fetch(`/api/comments?contentId=${contentId}`);
    const data = await res.json();
    setComments(data.data);
  };

  const postComment = async (text: string) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `Comment on content ${contentId} at ${timestamp}:\n${text}`;
    const signature = await signMessageAsync({ message });

    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId, text, signature, message, timestamp }),
    });

    await fetchComments();
  };

  return { comments, loading, postComment };
}
```

---

### D5: 数据库连接 — PostgreSQL Pool

```typescript
// src/lib/db.ts
import { Pool } from 'pg';

export const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'bloom_social',
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 辅助函数：地址格式转换
export function addressToBytes(address: string): Buffer {
  return Buffer.from(address.slice(2), 'hex');
}

export function bytesToAddress(bytes: Buffer): string {
  return '0x' + bytes.toString('hex');
}
```

---

## Risks & Trade-offs

| 风险 | 影响 | 缓解方案 |
|------|------|--------|
| 链下存储依赖数据库可用性 | 数据库宕机 → 评论不可用 | 定期备份、使用数据库集群（主从复制） |
| 无链上证明，难以确权 | 后期若需审计，改造成本高 | 预留 `message_hash` 字段，快速升级锚定 |
| 签名可伪造时间戳 | 用户可提前签名多条评论 | 后端验证时间戳在 ± 5 分钟内 |
| 评论审核、合规风险 | 不当言论难处理 | 日志完整、软删除机制、后续可加 AI 过滤 |
| SQL 注入攻击 | 数据库被攻击 | 使用参数化查询（`pg` 库自动防护） |

---

## Open Questions

1. **评论是否需要哈希锚定到链上？** → MVP 不做，V1.1+ 按需升级
2. **是否支持 @ 提及用户？** → MVP 不做，V1.2+ 可加
3. **是否需要 GraphQL 替代 REST？** → 可选，当前 REST 已足够
4. **评论字符限制多少合理？** → 500 字（类似 Twitter 早期）
5. **是否支持 Markdown？** → MVP 纯文本，V1.2+ 可加

---

## Migration Plan

因为是新功能，无向后兼容性问题。

**部署步骤**：
1. 在开发环境安装 PostgreSQL（Docker 或 Homebrew）
2. 运行 migration SQL 创建 `comments` 表和索引
3. 在 `.env.local` 配置数据库凭证
4. 部署 API routes 到 frontend-project
5. 上线前端组件（CommentForm + CommentList）
6. E2E 测试：发表 → 查看 → 删除
7. 监控数据库性能（查询延迟、连接池使用率）

**回滚计划**：
- API routes 可直接移除或禁用
- 数据库表可保留（软删除不影响现有功能）
- 前端组件可条件渲染（feature flag 控制）
