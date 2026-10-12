# github-vercel-deploy

把本地项目从零推到 GitHub，在 Vercel 上建项目并连接仓库，部署上线。之后每次 push 到 main 会自动更新网站，其他分支会生成预览链接。

## 在 Agent 里使用

安装好技能后（见[总 README](../../README.md#安装)），在项目里对 Agent 说：

> 把这个项目部署到 GitHub 和 Vercel

Agent 会依次：
1. 检查环境和账号；
2. 和你确认仓库名、公开还是私有（默认私有）；
3. 运行部署脚本；
4. 把仓库地址和网址告诉你。

## 前置条件

- git，以及 Node.js 18 或更高版本
- 两个令牌，放进项目里的 `.env.deploy`，或者用户目录下的 `~/.env.deploy`。这个文件会自动被 git 忽略，**不要贴到聊天里**：

```
GITHUB_TOKEN=...   # https://github.com/settings/tokens/new?scopes=repo&description=skill-deploy
VERCEL_TOKEN=...   # https://vercel.com/account/tokens
```

如果电脑上已经装了 `gh` 并且登录过，GitHub 令牌会自动读取，不用另外配置。

## 直接当命令行工具用

```bash
node scripts/deploy.mjs --dir ../my-app --check        # 只检查，不做改动
node scripts/deploy.mjs --dir ../my-app --yes          # 部署（私有仓库）
node scripts/deploy.mjs --dir ../my-app --yes --public # 部署（公开仓库）
node scripts/deploy.mjs --dir ../my-app --yes --json   # 输出 JSON，给程序或 CI 用
node scripts/deploy.mjs --help                         # 全部参数
```

| 退出码 | 含义 |
|---|---|
| 0 | 成功 |
| 2 | 缺少令牌，或令牌无效 |
| 3 | 缺少 git 或 Node |
| 5 | 发现疑似密钥，已停止，没有推送 |
| 6 | Vercel 看不到这个 GitHub 仓库（多半是账号不一致） |
| 7 | 部署或构建失败 |
| 10 | 需要用户确认（加上 `--yes` 后重新运行） |

## 没有命令行的环境

有些环境不能在本机运行脚本，或者网络连不上 Vercel，比如云端对话。这种情况见 [references/browser-mode.md](references/browser-mode.md)：由 Agent 操作浏览器完成建仓库和导入 Vercel。这套流程已经实测跑通。

## 已知问题与修复记录

| 问题 | 处理 |
|---|---|
| Windows 装完 `gh` 后提示 "not recognized" | 不再依赖 `gh` 和 `vercel` CLI |
| `vercel login` 一直停在 "Waiting for authentication..." | 改用 `VERCEL_TOKEN`，不进入交互式登录 |
| 必须双击 `.bat` 才能运行 | 改由 Agent 运行脚本；需要确认时返回退出码 10，Agent 在对话里问用户 |
| PowerShell 脚本里的中文乱码 | 改用 Node 脚本 |
| Vercel 绑定的 GitHub 账号和仓库所有者不一致，Deploy 点了没反应 | 自动识别并给出修复步骤 |
| 云端会话不能用 API 创建仓库 | 用浏览器模式 |

更多排错见 [references/troubleshooting.md](references/troubleshooting.md)。
