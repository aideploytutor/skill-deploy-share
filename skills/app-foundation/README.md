# app-foundation（第 002 期）

一句话搭好你的产品底座：网站框架、数据库接口和项目规则一次装好。后面每一期的 Skill（数据库、登录、收款、订单、商城……）都装在它上面。

## 对 AI 说

> 用 app-foundation 给我创建一个新项目底座，产品叫「我的小店」

AI 会帮你检查电脑环境、创建项目、安装依赖，最后在浏览器里打开给你看。

## 你会得到

- 一个能在本地运行、也能部署上线的网站（Next.js + TypeScript + Tailwind）
- 已经写好的数据库接口（Drizzle + 标准 Postgres），第 003 期连上数据库就能用，以后换数据库供应商也不用改代码
- 系统之间互相通知的事件表 `core_events`：订单、会员、积分这些系统靠它打通
- `/api/health` 健康检查，`/status` 底座状态页
- `stack.json`：记录装了哪些 Skill，后面的 Skill 会根据它检查依赖
- 项目自己的 `AGENTS.md`：以后任何 AI 打开这个项目，都会照着同一套规则来写代码

## 前置条件

- Node.js 20.9 或更高版本（https://nodejs.org 下载 LTS 版）
- git（部署时才需要）

## 直接当命令行工具用

```bash
node scripts/create.mjs --dir ./my-shop --name "我的小店"
node scripts/create.mjs --dir ./my-shop --check     # 检查是否为底座项目
node scripts/create.mjs --help
```

| 退出码 | 含义 |
|---|---|
| 0 | 成功 |
| 3 | Node/npm 缺失或版本太旧 |
| 4 | npm install 失败 |
| 10 | 目标文件夹不是空的 |

## 底座里有什么

```
src/
  app/             页面（page.tsx 首页、status/、api/health/）
  db/              数据库：index.ts 客户端，schema/ 数据表
  lib/events.ts    系统之间的事件通知
  modules/         每个系统的业务代码放这里
stack.json         已安装的 Skill
AGENTS.md          给 AI 的项目规则
```
