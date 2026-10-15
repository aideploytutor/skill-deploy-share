# domain-setup（第 004 期）

把你自己的域名，或者一个子域名（比如 `shop.你的域名.com`），绑定到 Vercel 上的网站，HTTPS 证书自动签发、自动续期。下一期用自己的域名发邮件，也要靠这一步。

## 对 AI 说

> 用 domain-setup 把我的域名绑到网站上

## 实测记录（2026-10-14）

- 域名注册商：Namecheap，绑定的是子域名 `shop.labpencil.com`，主站完全没受影响
- 添加 1 条 CNAME 记录，约 2 分钟后网站可以访问；最开始 1 分钟打不开，是因为 HTTPS 证书还在签发
- 踩到的坑：从 Vercel 接口拿到的是旧值 `cname.vercel-dns.com`，而域名设置页显示"DNS Change Recommended"，推荐使用项目专属的 `xxxx.vercel-dns-017.com`。旧值也能用，但请以 **Vercel 域名设置页上显示的值为准**

## 还没有域名？

- 推荐 **Cloudflare Registrar**：按成本价卖，续费和首年同价（`.com` 在 2026-10-14 核实为 $10.46/年）
- 小心"首年 1 块、续费 100"的套路，买之前一定看清续费价
- 优先选 `.com`，冷门后缀可能被邮件系统当成垃圾邮件来源

## 常见问题

| 现象 | 原因 |
|---|---|
| 刚加完记录打不开 | DNS 还在生效，或者证书还在签发，等几分钟 |
| 提示"重定向次数过多"或证书错误 | Cloudflare 的橙色云朵代理开着，改成灰色（DNS only） |
| 访问到的还是旧网站 | 同一个主机名还有旧的 A/CNAME 记录，经你确认后删掉 |
| 国内访问慢或打不开 | Vercel 官方说明 `.vercel.app` 在国内可能被拦截，自己的域名会好一些，但不保证能访问 |

## 检查脚本（只读，不会改任何东西）

```bash
node scripts/check.mjs --domain shop.example.com --wait 600
node scripts/check.mjs --domain example.com --www
```

脚本会检查 DNS 记录、HTTPS、是否开了橙色云朵代理、CAA 记录，以及是否还在用 Vercel 的旧值。
