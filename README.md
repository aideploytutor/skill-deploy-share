# skill-deploy-share

一个存放可复用 AI Agent 技能（skills）的仓库。每个技能都遵循开放的 **Agent Skills** 格式，即 `SKILL.md`、`scripts/` 和 `references/` 三部分。同一份文件可以用在：

| 工具 | 安装位置（用户级） | 安装位置（项目级） |
|---|---|---|
| Claude Code / Claude 桌面版 | `~/.claude/skills/` | `.claude/skills/` |
| Cursor | `~/.cursor/skills/` | `.cursor/skills/` |
| VS Code + GitHub Copilot | `~/.copilot/skills/` | `.github/skills/` |
| OpenAI Codex | `~/.agents/skills/` | `.agents/skills/` |
| Gemini CLI | `~/.gemini/skills/` | `.gemini/skills/` |
| 其他 Agent、自己写的软件、CI | 直接调用 `scripts/` 里的脚本 | 读取 `AGENTS.md` |

## 技能列表

| 技能 | 作用 |
|---|---|
| [github-vercel-deploy](skills/github-vercel-deploy/SKILL.md) | 把本地项目从零推到 GitHub，连接 Vercel，部署上线，之后每次 push 自动更新 |

## 安装

```bash
git clone https://github.com/aideploytutor/skill-deploy-share
cd skill-deploy-share

node install.mjs                          # 所有技能装到所有工具（用户级）
node install.mjs --agent claude,cursor    # 只装到指定工具
node install.mjs --project ../my-app      # 装到某个项目里，跟着项目走
node install.mjs --list                   # 查看技能和安装路径
```

装好后重启 IDE 或新开一个对话，然后直接说"把这个项目部署到 GitHub 和 Vercel"就行。

也可以用社区的通用安装器：`npx skills add aideploytutor/skill-deploy-share`。仓库是私有的话，需要先登录有权限的 GitHub 账号。

## 不用 AI，直接当软件用

`github-vercel-deploy` 的核心是一个独立的命令行工具，只依赖 git 和 Node.js 18 及以上版本，Windows、macOS、Linux 都能用：

```bash
# 令牌放在 .env.deploy（项目里或用户目录下），不会被提交到仓库
#   GITHUB_TOKEN=...   https://github.com/settings/tokens/new?scopes=repo&description=skill-deploy
#   VERCEL_TOKEN=...   https://vercel.com/account/tokens

node skills/github-vercel-deploy/scripts/deploy.mjs --dir ../my-app --check   # 只检查，不做改动
node skills/github-vercel-deploy/scripts/deploy.mjs --dir ../my-app --yes     # 部署（默认私有仓库）
node skills/github-vercel-deploy/scripts/deploy.mjs --dir ../my-app --yes --json   # 给程序调用，输出 JSON
```

退出码有固定含义（2 令牌、5 发现密钥、6 Vercel 看不到仓库、7 构建失败、10 需要确认），方便别的软件或 CI 判断结果。

## v2 修复的问题（来自实测）

| 第一版遇到的问题 | 现在的做法 |
|---|---|
| Windows 装完 `gh` 之后提示 "not recognized"（PATH 没刷新） | 不再需要 `gh` 和 `vercel` CLI，只用 git 加 Node 调 API |
| `vercel login` 一直停在 "Waiting for authentication..." | 改用 `VERCEL_TOKEN`，脚本不会进入交互式登录 |
| 需要双击 `.bat` 才能运行，不能在对话里完成 | Agent 直接运行脚本；遇到需要确认的地方返回退出码 10，由 Agent 在对话里问你 |
| PowerShell 脚本里的中文显示成乱码 | 改用 Node 脚本，跨平台、没有编码问题 |
| Vercel 绑定的 GitHub 账号（Dr-Banana）和仓库所有者（aideploytutor）不一致，Deploy 点了没反应 | 自动识别这个情况并给出修复步骤；文档把它列为第一项检查 |
| 云端会话不能用 API 创建仓库 | 另外提供浏览器模式（`references/browser-mode.md`），已实测跑通 |
| 令牌可能被写进 `.git/config` 或误提交 | 令牌通过环境变量传给 git；推送前扫描密钥，发现就停止 |

## 添加新技能

1. 复制 `templates/SKILL.template.md` 到 `skills/<新名字>/SKILL.md`。
2. 填写 `name`（必须和文件夹名一致）和 `description`（写清楚什么时候用）。
3. 在本文件和 `AGENTS.md` 的技能表里各加一行。
4. 脚本优先用 Node（`.mjs`）或 Python，保证 Windows、macOS、Linux 都能用。
