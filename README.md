# skill-deploy-share

这里统一存放可复用的 AI Agent 技能（skills）。

每个技能是一个独立文件夹，采用开放的 **Agent Skills** 格式（`SKILL.md` + 脚本 + 参考文档）。写一次，就能在不同的 AI 编程工具里使用，也能脱离 AI 直接当命令行工具运行。

## 不会写代码？从这里开始

你不需要看懂下面的内容。打开你平时用的 AI 编程工具（Claude Code、Cursor、VS Code Copilot 等），把这句话发给它：

> 帮我安装 github.com/aideploytutor/skill-deploy-share 里的技能

装好后，直接用大白话告诉 AI 你想做什么，比如：

> 把这个项目部署到 GitHub 和 Vercel

遇到要登录、要授权的地方，AI 会停下来告诉你点哪里。密码和登录都由你自己完成，AI 不会碰你的账号。

## 路线图与底座

- [ROADMAP.md](ROADMAP.md)：100 期 Skill 路线图，从底座、收款到 20 个成熟系统
- [STACK.md](STACK.md)：所有 Skill 共用的底座和约定，附已核实的免费额度

## 技能目录

| 技能 | 作用 | 说明 |
|---|---|---|
| [github-vercel-deploy](skills/github-vercel-deploy/) | 把本地项目从零推到 GitHub，连接 Vercel，部署上线，之后每次 push 自动更新 | [使用说明](skills/github-vercel-deploy/README.md) |
| [app-foundation](skills/app-foundation/) | 一句话搭好产品底座：网站框架 + 数据库接口 + 项目规则，后面所有系统都装在上面 | [使用说明](skills/app-foundation/README.md) |
| [db-connect](skills/db-connect/) | 接上免费数据库（Neon，在 Vercel 后台创建），部署时自动建表，网站真正能存东西 | [使用说明](skills/db-connect/README.md) |
| [domain-setup](skills/domain-setup/) | 把自己的域名或子域名绑到网站上，HTTPS 自动配好，附带检查脚本 | [使用说明](skills/domain-setup/README.md) |
| [email-send](skills/email-send/) | 让网站用自己的域名发邮件（Resend，每月 3000 封免费），附带 DNS 检查脚本和测试页 | [使用说明](skills/email-send/README.md) |

> 新增技能后，在上表加一行（`AGENTS.md` 里的表也要同步加）。

## 支持的工具

| 工具 | 用户级目录 | 项目级目录 |
|---|---|---|
| Claude Code / Claude 桌面版 | `~/.claude/skills/` | `.claude/skills/` |
| Cursor | `~/.cursor/skills/` | `.cursor/skills/` |
| VS Code + GitHub Copilot | `~/.copilot/skills/` | `.github/skills/` |
| OpenAI Codex | `~/.agents/skills/` | `.agents/skills/` |
| Gemini CLI | `~/.gemini/skills/` | `.gemini/skills/` |
| 其他 Agent / 自己的软件 / CI | 让 Agent 读 `AGENTS.md`，或直接运行技能里的 `scripts/` | |

如果某个工具的版本换了目录，改 `install.mjs` 开头的 `AGENTS` 配置即可。

## 安装

需要 Node.js 18 或更高版本。

```bash
git clone https://github.com/aideploytutor/skill-deploy-share
cd skill-deploy-share

node install.mjs                               # 所有技能装到所有工具（用户级）
node install.mjs --agent claude,cursor         # 只装到指定工具
node install.mjs github-vercel-deploy          # 只装指定技能
node install.mjs --project ../my-app           # 装进某个项目，提交后团队成员都能用
node install.mjs --list                        # 列出技能和安装路径
```

也可以用社区的通用安装器：`npx skills add aideploytutor/skill-deploy-share`。

更新技能：先运行 `git pull`，再重新运行 `node install.mjs`，会覆盖旧版本。

## 使用

安装后重启 IDE，或者新开一个对话。然后直接用自然语言描述需求就行，不用记命令。Agent 会根据每个技能 `description` 里写的使用场景，自动选用对应的技能，比如"把这个项目部署到 GitHub 和 Vercel"。

大多数技能的核心逻辑都放在 `scripts/` 里，不经过 AI 也能直接运行，具体用法见各技能自己的 README。

## 仓库结构

```
skill-deploy-share/
├── README.md              ← 本文件：总目录
├── AGENTS.md              ← 给各种 Agent 读的通用说明和技能索引
├── CLAUDE.md              ← 指向 AGENTS.md
├── install.mjs            ← 跨平台安装器
├── templates/
│   └── SKILL.template.md  ← 新技能模板
└── skills/
    └── <技能名>/
        ├── SKILL.md       ← 必需：何时用 + 步骤（Agent 读这个）
        ├── README.md      ← 推荐：给人看的使用说明
        ├── scripts/       ← 可选：可执行脚本
        └── references/    ← 可选：排错、进阶文档（按需加载）
```

## 添加新技能

1. **建文件夹**：`skills/<技能名>/`。名字只用小写字母、数字和短横线。
2. **写 SKILL.md**：复制 `templates/SKILL.template.md` 改写。
   - `name` 必须和文件夹名一致。
   - `description` 是 Agent 判断用不用这个技能的唯一依据，要写清楚做什么，以及用户会怎么说（中英文触发词都写上）。
   - 正文写步骤，控制在 500 行以内。细节放进 `references/`。
3. **写脚本**（如果需要）：
   - 优先用 Node（`.mjs`）或 Python，保证 Windows、macOS、Linux 都能运行，避免 `.sh`、`.ps1` 只能在单一平台用。
   - 不弹交互式输入。需要确认时，用退出码或 `--yes` 参数交给 Agent 去问用户。
   - 提供 `--help`；能给程序调用的，提供 `--json` 输出。
4. **写 README.md**：给人看的说明，包括用途、前置条件、示例和已知问题。
5. **登记**：在本文件和 `AGENTS.md` 的技能目录里各加一行。
6. **测试**：用 `node install.mjs <技能名> --project <测试目录>` 装到一个测试项目里，在至少一个 Agent 里实际跑一遍。

## 所有技能共同遵守的原则

- **账号操作交给用户**：Agent 不输入密码、不注册账号、不处理验证码、不修改账号设置。遇到这些步骤，就请用户自己完成。
- **密钥不进聊天、不进仓库**：令牌放环境变量或被 `.gitignore` 忽略的文件里；脚本在提交前要检查有没有泄露密钥。
- **改动前先确认**：创建、发布、删除这类操作，先告诉用户要做什么，用户同意后再执行。
- **可以重复运行**：已经完成的步骤要能自动跳过，失败后修复了直接重跑即可。

## 许可证

MIT。详见 [LICENSE](LICENSE)。
