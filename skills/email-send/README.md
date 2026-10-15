# email-send（第 005 期）

让网站用**你自己的域名**发邮件，比如登录验证码、订单收据、通知，而且不进垃圾箱。用的是 Resend，免费档每月 3000 封，每天最多 100 封。

## 对 AI 说

> 用 email-send 让我的网站能发邮件

## 你需要做的（AI 会一步步带你）

1. 注册 Resend（用 Google 登录最省事）
2. 在 Resend 里添加发信子域名，比如 `mail.你的域名.com`
3. 同意 AI 的方案后，在域名后台加 3 条记录（再加 1 条推荐的 DMARC）
4. 在 Resend 创建 API Key，**自己**粘贴到 Vercel 的环境变量里，不要发给任何人，包括 AI
5. 打开 `你的网址/email-test`，点按钮给自己发一封测试邮件

## 为什么一定要自己的域名

没验证域名时，Resend 只允许发给你自己的邮箱。想给用户发验证码，必须先有域名（第 004 期），并验证通过。

## 为什么用子域名 mail.xxx.com 发信

Resend 官方推荐这样做：发信的声誉和你主域名的邮箱分开，主域名原来的邮箱完全不受影响。

## 常见问题

| 现象 | 原因 |
|---|---|
| 检查脚本提示 `doubled-host` | Namecheap、GoDaddy 的 Host 栏会自动补上域名，只填 `resend._domainkey.mail`，别填完整域名 |
| Resend 一直显示 Pending | DNS 还没生效，通常 15 分钟内验证通过，最长 72 小时 |
| 邮件进了垃圾箱 | 补上 DMARC 记录；内容别像广告；刚开始发信量别太大 |
| 页面提示"还没配置好" | 加完环境变量要重新部署一次才生效 |

## 检查脚本（只读，不需要密钥）

```bash
node scripts/check.mjs --domain mail.example.com --wait 900
```

## 在代码里用

```ts
import { sendEmail } from "@/lib/email";
await sendEmail({ to: "user@example.com", subject: "你的验证码", text: "验证码：123456" });
```
