# BloomSocial

一个基于区块链的去中心化内容社交平台，实现「创作即挖矿、点赞即投资」的 Web3 社交新范式。

## 项目简介

BloomSocial 通过智能合约实现了一套创新的内容激励机制：

- **创作者**发布内容可以获得点赞收益的 70%
- **早期点赞者**通过权重衰减算法获得更高的分红回报
- **平台**收取 5% 的协议费用维持运营

### 核心玩法

```
创作者发布内容 → 用户付费点赞 → 截止后各方领取收益
```

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                           │
│              (Next.js + wagmi + RainbowKit)             │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────────┐         ┌───────────────────┐
│   Smart Contracts │         │   The Graph       │
│   (Solidity)      │────────▶│   (Subgraph)      │
│   - BloomToken    │  events │   - 索引链上事件   │
│   - BloomContent  │         │   - 提供查询 API   │
└───────────────────┘         └───────────────────┘
                        │
                        ▼
               ┌───────────────────┐
               │   PostgreSQL      │
               │   (评论系统)       │
               └───────────────────┘
```

## 项目结构

```
bloom-social/
├── contract-project/          # 智能合约
│   ├── contracts/
│   │   ├── BloomToken.sol     # ERC-20 代币合约
│   │   ├── BloomContent.sol   # 核心业务合约
│   │   └── WeightLib.sol      # 权重计算库
│   ├── test/                  # 合约测试
│   ├── ignition/              # 部署脚本
│   └── docs/                  # 合约文档
│
├── frontend-project/          # 前端应用
│   ├── migrations/            # 数据库迁移
│   └── src/
│       ├── app/               # Next.js App Router
│       │   └── api/comments/  # 评论 API
│       ├── components/        # React 组件
│       ├── hooks/             # 自定义 Hooks
│       └── lib/               # 工具库
│
├── graph-project/             # Subgraph 索引器
│   ├── schema.graphql         # GraphQL Schema
│   ├── subgraph.yaml          # Subgraph 配置
│   └── src/mapping.ts         # 事件映射
│
└── openspec/                  # 项目规范文档
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 智能合约 | Solidity 0.8.24, Hardhat, OpenZeppelin |
| 前端 | Next.js 15, React 19, TypeScript |
| Web3 集成 | wagmi v2, viem, RainbowKit |
| 数据索引 | The Graph, GraphQL |
| 评论存储 | PostgreSQL |
| 样式 | Tailwind CSS |

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm / npm / yarn
- Docker Desktop（评论数据库）

### 1. 安装依赖

```bash
# 合约项目
cd contract-project
npm install

# 前端项目
cd ../frontend-project
npm install
```

### 2. 配置环境变量

```bash
# contract-project/.env
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# frontend-project/.env.local
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_BLOOM_TOKEN_ADDRESS=deployed_token_address
NEXT_PUBLIC_BLOOM_CONTENT_ADDRESS=deployed_content_address
NEXT_PUBLIC_GRAPH_URL=your_graph_endpoint

# 评论数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=123456
DB_NAME=bloom_social
```

### 3. 启动 PostgreSQL（评论功能）

```bash
docker run --name bloom-postgres \
  -e POSTGRES_PASSWORD=123456 \
  -e POSTGRES_DB=bloom_social \
  -p 5432:5432 \
  -d postgres:15
```

### 4. 初始化评论表

```bash
cd frontend-project
node test-db.js
# 或手动执行 migrations/001_create_comments.sql
```

### 5. 编译和测试合约

```bash
cd ../contract-project

# 编译
npm run compile

# 测试
npm run test
```

### 6. 部署合约

```bash
# 部署到 Sepolia 测试网
npm run deploy:sepolia
```

### 7. 启动前端

```bash
cd ../frontend-project
npm run dev
```

访问 http://localhost:3000

## 经济模型

### 收益分配

每次点赞支付的代币按以下比例分配：

| 接收方 | 比例 | 说明 |
|--------|------|------|
| 作者 | 70% | 内容创作者的主要收益 |
| 点赞者池 | 25% | 按权重分配给所有点赞者 |
| 协议费 | 5% | 平台运营费用 |

### 权重衰减公式

```
w(i) = 0.2 + 0.8 × exp(-0.20 × (i-1))
```

- 第 1 个点赞者：权重 1.0（最高）
- 第 10 个点赞者：权重 0.33
- 第 50+ 个点赞者：权重趋近 0.2（保底）

**设计目的**：激励用户尽早发现和支持优质内容。

### API

```http
POST   /api/comments
GET    /api/comments?contentId=123&limit=20&offset=0
DELETE /api/comments/[id]
```

## 开发指南

### 合约开发

```bash
cd contract-project

# 运行本地节点
npx hardhat node

# 部署到本地
npx hardhat ignition deploy ./ignition/modules/BloomSocial.ts --network localhost

# 运行测试（带覆盖率）
npx hardhat coverage
```

### 前端开发

```bash
cd frontend-project

# 开发模式
npm run dev

# 构建
npm run build

# 类型检查
npm run lint
```

### Subgraph 开发

```bash
cd graph-project

# 生成类型
npm run codegen

# 构建
npm run build

# 部署（需要 Graph Studio 账号）
npm run deploy
```
