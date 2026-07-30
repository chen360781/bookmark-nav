# Bookmark Nav

多功能简洁书签导航站。前台是一个干净的公开导航页,后台提供完整的书签管理能力,数据完全存放在你自己的 Cloudflare 账号里。

## 功能特性

- 📌 **前台导航页**:分类分组展示、置顶、点击计数、实时搜索、深色/浅色/跟随系统主题
- 🗂 **多级分类**:分类无限嵌套,支持拖拽排序、批量删除(级联)
- 🔒 **私密书签**:书签和分类均可设为私密,仅登录后可见;私密分类整棵子树对外隐藏
- 📥 **导入导出**:兼容 Chrome / Edge / Firefox 的 HTML 书签格式,多级文件夹结构完整保留
- 🔗 **死链检测**:后台一键批量检测失效书签,支持筛选和批量清理
- ✂️ **批量操作**:书签批量移动分类、批量删除;分类多选全选
- 🏷 **标签**:书签支持多标签,搜索时一并匹配
- 📱 **移动端适配**:前后台均适配小屏幕

## 部署

1. 点击本仓库右上角 **Fork**
2. 在 [Cloudflare 控制台](https://dash.cloudflare.com) → **存储和数据库 → D1** → 创建数据库(名称随意,如 `bookmark-nav-db`),复制其**数据库 ID**
3. 控制台 → **Workers 和 Pages → 创建 → 导入存储库**,选择你 fork 的仓库,构建配置(三项都要填,不能留默认值):
   - 构建命令:`npm run build`
   - 部署命令:`npm run deploy`
   - 构建变量:添加 `D1_DATABASE_ID`,值为第 2 步复制的数据库 ID
4. 首次部署后,进入该 Worker → **设置 → 变量和机密**(注意不是“构建”里的变量),添加变量 `JWT_SECRET`,**类型必须选「机密(Secret)」**(值为随机长字符串,可用 `openssl rand -hex 32` 生成)
5. 访问 Worker 域名,首次打开会引导你创建管理员账号

> Fork 部署不需要修改仓库里的任何文件(数据库 ID 通过构建变量在部署时自动注入),你的 fork 与本仓库永远保持零差异,因此可以随时用 GitHub 的 **Sync fork** 按钮一键同步新版本。

## 更新版本

在你 fork 的仓库页面点 **Sync fork → Update branch**,同步后 Cloudflare 自动重新构建部署,完成。

你的书签数据存在自己账号的 D1 里,更新代码不会影响数据;若新版本包含数据库变更,部署时会自动执行增量迁移(`deploy` 脚本内置 `wrangler d1 migrations apply`)。

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars   # 填入任意 JWT_SECRET
npx wrangler d1 migrations apply DB --local
npm run dev                      # http://localhost:5173
```

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 · Vite · TanStack Query · shadcn/ui · Tailwind CSS v4 |
| 后端 | Hono(RPC 模式,前后端类型共享) |
| 数据库 | Cloudflare D1(SQLite)+ Drizzle ORM |
| 部署 | Cloudflare Workers(静态资源 + API 同一 Worker) |

后端仅依赖标准 Web API 与 SQLite,如需迁移到自托管环境(Node + SQLite/Postgres),只需替换 D1 绑定与部署配置。

## 许可证

[GPL-3.0](./LICENSE)
