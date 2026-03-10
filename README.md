# 海外仓 WMS 待办管理系统

## 项目结构

```
overseas-wms-todo/
├── app/
│   ├── api/
│   │   ├── todos/route.ts          # 待办 CRUD API
│   │   ├── lingxing/
│   │   │   ├── bind/route.ts       # 绑定/解绑/查询绑定状态
│   │   │   └── sync/route.ts       # 手动触发同步
│   └── wms/
│       └── settings/page.tsx       # 领星账号绑定页面（前端）
├── lib/
│   ├── supabase.ts                 # Supabase 客户端封装
│   ├── lingxing.ts                 # 领星 API 完整封装
│   └── todo-generator.ts          # 待办自动生成逻辑
├── sync-worker/
│   ├── index.js                    # 定时同步任务（部署到 Railway）
│   └── package.json
├── supabase/
│   └── migrations/
│       └── 001_init_schema.sql     # 完整数据库结构
└── .env.example                    # 环境变量模板
```

---

## 🚀 部署步骤（Serverless 免费方案）

### Step 1：Supabase 初始化数据库

1. 访问 [supabase.com](https://supabase.com) 注册并创建项目
2. 进入 **SQL Editor**，粘贴并执行 `supabase/migrations/001_init_schema.sql`
3. 在 **Project Settings → API** 中复制：
   - `Project URL`
   - `anon/public key`
   - `service_role key`（保密！）

### Step 2：部署前端到 Vercel

```bash
# 1. Fork 或上传代码到 GitHub

# 2. 在 Vercel 导入 GitHub 仓库

# 3. 配置环境变量（Vercel Dashboard → Settings → Environment Variables）：
NEXT_PUBLIC_SUPABASE_URL=      # Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=     # Supabase service_role key
ENCRYPTION_SECRET=             # 32位随机字符串（用于加密AppSecret）
LINGXING_AUTH_URL=https://openapi.lingxing.com/erp/sc/auth/token
LINGXING_API_BASE_URL=https://openapi.lingxing.com

# 4. 点击 Deploy，完成！
```

### Step 3：部署定时同步到 Railway

```bash
# 1. 访问 railway.app 注册账号

# 2. New Project → Deploy from GitHub → 选择仓库

# 3. 配置 Root Directory 为 sync-worker/

# 4. 配置环境变量（同 Vercel 的环境变量）

# 5. Deploy 完成后，Worker 会每15分钟自动拉取领星数据
```

---

## 🔑 领星账号绑定流程

1. 登录你的领星 WMS 系统（管理员账号）
2. 进入：设置 → 开放平台 → 创建应用
3. 填写应用名称，勾选权限：入库/出库/库存/退货/工单
4. 复制 AppKey 和 AppSecret
5. 在本系统：WMS端 → 系统设置 → 领星账号绑定 → 填入并保存

---

## 🔄 迁移到 VPS

当需要迁移到自有 VPS 时，只需：

```bash
# 1. 导出 Supabase 数据
pg_dump "postgresql://..." > backup.sql

# 2. VPS 上安装 PostgreSQL，导入数据
psql -d wms_todo < backup.sql

# 3. 修改环境变量指向本地数据库
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321

# 4. Docker Compose 启动
docker-compose up -d

# 代码无需任何修改！
```

---

## 📊 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 | 全栈框架，前后端一体 |
| 部署 | Vercel | 自动构建部署，免费 |
| 数据库 | Supabase PostgreSQL | 托管数据库，含RLS |
| 定时任务 | Railway + node-cron | 每15分钟同步领星数据 |
| 加密 | AES-256（crypto-js） | 加密存储领星凭证 |
| 状态管理 | Zustand | 轻量客户端状态 |
