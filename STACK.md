# 底座约定（所有 Skill 必须遵守）

这个仓库的目标：**每期一个 Skill，一句话装好一个成熟系统**，成本尽量低，技术栈不会过时，以后能平滑扩容。为了让 100 个 Skill 能互相叠加、随时换供应商，所有 Skill 共用下面这套底座和约定。

## 1. 三条原则

1. **成熟的部分交给成熟的服务。**支付、邮件、登录、存储这类功能用现成的服务或开源库，AI 只负责写"连接"代码和界面。
2. **只依赖开放标准。**数据库只用标准 Postgres，文件只用 S3 兼容接口，登录走 OAuth，系统之间用 Webhook 通知。任何一家服务商都能整体换掉，代码不用重写。
3. **免费档起步，扩容只升级套餐。**同一套代码要能跑在免费档，也要能跑在付费档，升级时只改配置。

## 2. 默认底座

| 部分 | 默认 | 可替换为 | 选它的理由 |
|---|---|---|---|
| 网站框架 | Next.js（TypeScript） | — | AI 生成质量最高，社区最大 |
| 数据库 | Postgres，托管在 Neon | Supabase / 任何 Postgres | 免费版闲置后自动休眠，但不会被停用 |
| 数据库访问 | Drizzle ORM | — | 写法贴近 SQL，换数据库供应商时不受影响 |
| 登录 | Better Auth | 任何 OAuth 方案 | 用户数据存在自己的数据库里，没有月活上限 |
| 文件存储 | Cloudflare R2（S3 接口） | AWS S3 / Supabase Storage | 用的是 S3 标准接口 |
| 收款 | Stripe | Lemon Squeezy / Paddle | 没有月费，按交易抽成 |
| 邮件 | Resend | 任何 SMTP 服务 | 免费额度够小项目起步 |
| 托管（不收钱） | Vercel Hobby | Cloudflare | 部署最简单 |
| 托管（收钱） | Cloudflare Workers | Vercel Pro | Vercel 免费版禁止商用 |

## 3. 已核实的免费额度（2026-10-12）

每期发布前，都要重新核对一遍官网，并更新这张表。

| 服务 | 免费额度 | 要注意 | 来源 |
|---|---|---|---|
| Vercel Hobby | 每月 100GB 流量、100 万次函数调用 | **仅限非商业用途**：收款、广告、接单做站都算商用 | [Fair Use](https://vercel.com/docs/limits/fair-use-guidelines) |
| Cloudflare Workers | 每天 10 万次请求，每次最多 10ms CPU 时间 | 付费版最低每月 5 美元；定价页没有提到禁止商用 | [Pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Neon | 每个项目 1GB 存储、100 CU 小时计算量，最多 100 个项目 | 闲置 5 分钟后自动休眠，有人访问就唤醒 | [Pricing](https://neon.com/pricing) |
| Supabase | 500MB 数据库、5 万月活、1GB 存储、最多 2 个项目 | **连续 7 天没人访问，项目会被暂停** | [Pricing](https://supabase.com/pricing) |
| Resend | 每月 3000 封，每天最多 100 封，3 个域名 | 付费版每月 20 美元 | [Pricing](https://resend.com/pricing) |
| Stripe | 没有月费 | 美国本地卡每笔收 2.9% + 30 美分；国际卡另加 1.5% | [Pricing](https://stripe.com/pricing) |

## 4. 每个 Skill 必须遵守的约定

- **声明依赖和产出。**在 SKILL.md 的 `metadata` 里写 `requires`（必须先装哪些 Skill）和 `provides`（装完后新增了什么）。依赖没装时，先提示用户安装。
- **数据表加前缀。**每个 Skill 建的表都以自己的系统名开头，例如 `orders_`、`shop_`，避免和其他 Skill 冲突。用户相关的表由 `auth-login`（第 004 期）统一创建，其他 Skill 只引用、不另建。
- **数据库改动要可回滚。**所有表结构变更都用 Drizzle 生成迁移文件，不直接手改数据库。
- **密钥只放环境变量。**变量名统一用大写加系统前缀，例如 `STRIPE_SECRET_KEY`。代码里不写死任何密钥，也不让用户把密钥贴进聊天。
- **系统之间通过事件打通。**一个系统发生的事，比如订单已支付，用 `emitEvent()` 写进 `app-foundation` 建好的 `core_events` 事件表，其他系统读取事件后自己处理，不直接改别的系统的表。
- **登记已安装的 Skill。**装完一个 Skill 后，在项目的 `stack.json` → `installed` 里记下 `"<skill>": "<版本>"`。后面的 Skill 靠这份记录检查依赖有没有装好。
- **两种托管都能部署。**同一份代码要能部署到 Vercel，也要能部署到 Cloudflare。
- **账号操作留给用户。**注册、登录、授权、开通收款这类步骤由用户本人完成，Skill 只负责一步步带着做。
- **实测通过才能发布。**每个 Skill 都要在真实账号上从零跑通一次，截图和发布小红书都以这次实测为准。
