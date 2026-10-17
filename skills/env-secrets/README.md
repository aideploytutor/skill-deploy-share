# env-secrets（第 007 期）

API Key 就是你在某个服务上的「家门钥匙」，谁拿到谁就能冒充你：用你的域名发邮件，花你的额度。这个 Skill 帮你把钥匙放对地方，万一泄露了也知道怎么补救。

## 对 AI 说

> 用 env-secrets 检查我的项目有没有泄露密钥

## 装好后会怎样

- **扫描**：检查项目里的所有文件和每一次历史提交，找出写进代码里的钥匙（Resend、Stripe、OpenAI、Google、GitHub、数据库密码……）
- **拦截**：以后提交代码时，如果里面有钥匙，会自动拦下来不让提交
- **兜底**：`.env` 文件永远不会被传到 GitHub

随时可以运行：`npm run secrets:scan`

## 钥匙已经发出去了怎么办

**删消息、删文件都没用，要去服务商那里把旧钥匙作废，再新建一把。** 新钥匙直接粘到 Vercel 的环境变量里，打开 Sensitive。

各家服务怎么换钥匙，见 [references/rotate.md](references/rotate.md)。

## 钥匙放哪

| ✗ 别放 | ✓ 放这里 |
|---|---|
| 聊天框（发给 AI 或任何人） | Vercel → Settings → Environment Variables |
| 代码里 | 自己电脑上的 `.env.local`（不会被上传） |
| GitHub | |
