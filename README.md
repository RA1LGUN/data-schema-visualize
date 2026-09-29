# Post-train Schema Atlas

代码仓库：[RA1LGUN/data-schema-visualize](https://github.com/RA1LGUN/data-schema-visualize)。网站与 Dockerfile 均位于仓库根目录；Railway 连接此仓库时，Root Directory 保持默认即可。

用于浏览 post-training 数据抽象、实体关系和跨 benchmark 映射的交互式网站。浏览器端的示例用于解释 schema，不代表已接入真实训练流水线或在线评测系统。Node 服务仅提供静态文件；无需数据库、API 密钥、持久化卷或第三方 npm 依赖。

## 本地运行（Windows PowerShell）

需要 Node.js 24 或更高版本。在本文件所在目录打开终端：

```powershell
node --version
node server.mjs
```

打开 [http://localhost:4177](http://localhost:4177)。`localhost` 仅是本机地址；生成 Railway 公网域名后才可通过公网分享。按 `Ctrl+C` 停止。也可运行 `npm start`，无需先执行 `npm install`。

指定其他端口：

```powershell
$env:PORT = '4180'
node server.mjs
```

在另一个 PowerShell 终端检查服务：

```powershell
Invoke-RestMethod 'http://localhost:4177/healthz'
npm test
```

若修改过 `PORT`，将检查地址的端口同步修改。服务器绑定 `0.0.0.0`，默认端口为 `4177`；部署时优先读取 Railway 注入的 `PORT`。这符合 Railway 的 [主机与端口要求](https://docs.railway.com/networking/troubleshooting/application-failed-to-respond)。

编辑 `public/case-data.mjs` 后，在部署前运行 `npm run build`，将案例重新导出为 `public/docs/synthetic-case.json`。网站通过静态链接提供该文件下载；内容测试会检查下载文件与当前案例数据完全一致。生成脚本同样只使用 Node 内置功能，无需安装依赖。

## Railway 界面部署

1. 将本目录的内容放到 GitHub 仓库根目录，保留 `Dockerfile`、`server.mjs`、`package.json` 和完整 `public/`。也可以将本目录作为较大仓库的子目录。
2. Railway 中选择 **New Project → Deploy from GitHub repo**，或在已有项目选择 **+ New → GitHub Repo**，然后选择仓库。
3. 如果网站在仓库子目录，在服务的 **Settings** 中设置 **Root Directory** 为该目录相对于仓库根的路径，例如 `/outputs/schema-atlas`。本目录本身作为仓库根时保持默认。
4. 检查构建使用根目录的 **Dockerfile**。保持自定义 Build Command 和 Start Command 为空，使用镜像中的 `CMD ["node", "server.mjs"]`。镜像使用官方 `node:24-alpine`，以非 root 的 `node` 用户运行。[Dockerfile 检测](https://docs.railway.com/builds/dockerfiles)；[启动命令行为](https://docs.railway.com/builds/build-and-start-commands)。
5. 在服务 **Settings → Deploy** 中，将 **Healthcheck Path** 设为 `/healthz`、超时设为 `60` 秒；重启策略可设为 **On Failure**、最大重试 `3` 次。应用返回 HTTP 200 和 `{"status":"ok"}`。Railway 使用 `PORT` 做启动健康检查；该检查不等同于持续可用性监控。[健康检查文档](https://docs.railway.com/deployments/healthchecks)。
6. 部署成功后，在 **Settings → Networking / Public Networking → Generate Domain** 生成公网域名。若要求填写 Target Port，填写运行日志中实际监听的端口，保持与 `PORT` 一致。[界面部署与域名说明](https://docs.railway.com/guides/docker-compose)。
7. 使用生成的 HTTPS 地址访问首页和 `/healthz`，检查浏览器模块和样式已加载，再分享地址。

**关于 `railway.json`：** 本包保留该文件供旧服务读取，内容对应上述 Dockerfile、健康检查和重启设置。2026-09-30 核对的 Railway 官方文档已将 Config as Code 标记为 deprecated，并说明旧服务的兼容期限为 2026-12-01。新服务请按上述界面明确配置，不依赖这个文件自动生效；需要完整声明式部署时，按 Railway 当前的 Infrastructure as Code 方案迁移。[官方说明](https://docs.railway.com/config-as-code/reference)。

## Railway CLI 部署（PowerShell）

先在 Railway 界面创建或选定一个项目与空服务，配置上文的健康检查。在本目录打开 PowerShell：

```powershell
# 尚未安装 CLI 时运行这一行；这不是网站的运行依赖。
npm install -g @railway/cli
railway login
railway link
railway up . --path-as-root
railway domain
```

`railway link` 中选择目标项目、环境和服务。CLI 路径上传方式以当前目录为归档根，因此服务的 Root Directory 保持 `/` 或为空；不要沿用 GitHub 子目录方式的 `/outputs/schema-atlas`。`--path-as-root` 可避免 CLI 误将上层 Git 仓库作为上传根。`railway up` 上传并部署代码，`railway domain` 才生成公网域名。CLI 命令由用户在选定账户中执行；本交付未执行这些云端操作。[CLI 安装](https://docs.railway.com/cli)；[目录上传](https://docs.railway.com/cli/deploying)；[域名命令](https://docs.railway.com/cli/domain)。

## 文件与服务边界

```text
schema-atlas/
  public/             浏览器页面、数据、可下载说明文档
  server.mjs          无依赖 HTTP 静态服务
  scripts/            将案例数据导出为可下载 JSON
  package.json        start / test 命令
  Dockerfile          Railway / Docker 运行镜像
  .dockerignore       仅将运行所需文件加入镜像
  railway.json        旧版 Railway Config as Code 兼容配置
  tests/              HTTP 路由、安全边界与展示内容完整性测试
```

服务只允许 GET/HEAD，并且仅暴露 `public/` 内允许类型的文件和 `/healthz`。未知地址返回真实 404；不提供目录列表或 SPA 任意路由回退。显式 MIME 类型、CSP 等响应头限制资源加载；编码路径穿越、Windows 反斜杠与备用数据流、点文件、目录外符号链接均被拒绝。`README.md`、`server.mjs` 和仓库源文件不会因位于网站根目录而公开；有意发布的说明放在 `public/docs/`。

`node:24-alpine` 会随官方发布更新，若需要字节级构建复现，应在验证部署后记录并固定镜像 digest。

## 已验证与未验证

2026-09-30 在 Windows 原生 Node.js v24.15.0 上执行 `node --test tests/*.test.mjs`：16/16 通过，包含 8 项内容完整性测试与 8 项静态服务测试。浏览器交互验收已覆盖四类字段、8 个 profile、12 个案例阶段、8 个压力场景及记录弹窗。

测试分为两部分：`server.test.mjs` 使用独立临时 fixture，覆盖首页与 HEAD、模块/JSON/Markdown MIME、健康检查、真实 404、方法限制、编码与 Windows 路径攻击、目录外文件与符号链接隔离、PORT 校验和启动前入口检查；`content.test.mjs` 检查字段唯一性及条件说明、展示 ID 与精确版本引用、Target 路径、criterion、版本继承与阶段图无环，并通过真实 HTTP 检查页面链接、下载文档和模块依赖。内容测试只验证已交付的简化教学数据完整性，不声称这些记录通过完整 v3 schema 校验，也不代替前端交互验收。

`npm test` 执行全部测试。在限制子进程创建的执行沙箱中，npm 间接启动 Node 测试工作进程可能出现 `spawn EPERM`；这属于运行环境限制，不表示网站启动失败。可在正常 PowerShell 中运行 `npm test`，或在该沙箱中使用允许的直接命令 `node --test tests/*.test.mjs`；需要禁用测试工作进程时，参数必须位于文件路径之前：`node --test --test-isolation=none tests/*.test.mjs`。

本包已准备部署配置，但未实际发布到 Railway，没有生产域名或线上成功记录。本机未提供 Docker 和 Railway CLI，Docker 镜像构建及 Railway 运行尚未实测。
