# 100 期 Skill 路线图

「穷人版生产级指南」小红书系列，每期配一个 Skill。✅ 表示已发布到本仓库，其余为计划中。所有 Skill 遵守 [STACK.md](STACK.md) 的底座约定。


## 底座：一次搭好，所有系统共用

| 期 | Skill | 做什么 | 先装 |
|---|---|---|---|
| 001 | ✅ [github-vercel-deploy](skills/github-vercel-deploy/) | 一句话让 AI 把项目部署上线 | — |
| 002 | ✅ [app-foundation](skills/app-foundation/) | 一句话搭好你的产品底座 | — |
| 003 | ✅ [db-connect](skills/db-connect/) | 免费又不会被暂停的数据库 | app-foundation |
| 004 | ✅ [domain-setup](skills/domain-setup/) | 绑定你自己的域名 | github-vercel-deploy |
| 005 | ✅ [email-send](skills/email-send/) | 让网站能发邮件 | domain-setup, app-foundation |
| 006 | ✅ [auth-login](skills/auth-login/) | Google 和邮箱验证码登录 | db-connect, email-send |
| 007 | `env-secrets` | 密钥放对地方，永远不泄露 | — |
| 008 | `file-upload` | 用户上传图片和文件 | app-foundation |
| 009 | `deploy-cloudflare` | 要收钱了：换到能商用的托管 | app-foundation |
| 010 | `db-backup` | 每天自动备份数据库 | db-connect |

## 收钱：所有系统的收款底座

| 期 | Skill | 做什么 | 先装 |
|---|---|---|---|
| 011 | `pay-checkout` | 一句话接上收款 | auth-login |
| 012 | `pay-webhook` | 付款成功自动处理，不漏单 | pay-checkout |
| 013 | `pay-subscription` | 按月订阅收费 | pay-webhook |
| 014 | `pay-mor` | 不想管各国的税？用代收平台 | auth-login |
| 015 | `pay-cn-guide` | 国内用户怎么付款 | — |
| 016 | `pay-coupons` | 优惠码和免费试用 | pay-checkout |
| 017 | `pay-receipts` | 付款后自动发收据 | pay-webhook, email-send |
| 018 | `pay-refunds` | 退款一键处理 | pay-webhook |
| 019 | `pricing-page` | 一个让人想买的定价页 | pay-checkout |
| 020 | `revenue-report` | 每天看一眼收入 | pay-webhook, email-send |

## 系统篇：卖东西

| 期 | Skill | 做什么 | 先装 |
|---|---|---|---|
| 021 | `orders-core` | 一句话搭好订单系统 | app-foundation, auth-login |
| 022 | `orders-admin` | 订单后台：查单、改状态、导出 | orders-core |
| 023 | `orders-notify` | 订单状态变化自动通知用户 | orders-core |
| 024 | `shop-core` | 一句话搭好商城 | app-foundation, pay-webhook |
| 025 | `shop-admin` | 商品管理后台 | shop-core |
| 026 | `shop-rules` | 运费和缺货规则 | shop-core |
| 027 | `digital-core` | 卖电子书、模板、素材 | app-foundation, pay-webhook |
| 028 | `digital-secure` | 下载链接防分享 | digital-core |
| 029 | `digital-license` | 激活码和授权码 | digital-core |
| 030 | `courses-core` | 一句话搭好课程系统 | app-foundation, pay-webhook |
| 031 | `courses-sales` | 课程售卖和试看 | courses-core |
| 032 | `courses-certificates` | 结课证书和作业 | courses-core |

## 系统篇：留住用户

| 期 | Skill | 做什么 | 先装 |
|---|---|---|---|
| 033 | `membership-core` | 一句话搭好会员系统 | app-foundation, pay-webhook |
| 034 | `membership-tiers` | 会员等级和权益 | membership-core |
| 035 | `membership-retention` | 会员到期提醒和挽留 | membership-core |
| 036 | `rewards-core` | 一句话搭好积分系统 | app-foundation, auth-login |
| 037 | `rewards-coupons` | 优惠券发放和核销 | rewards-core |
| 038 | `rewards-tasks` | 签到和任务奖励 | rewards-core |
| 039 | `referral-core` | 一句话搭好邀请系统 | app-foundation, auth-login |
| 040 | `referral-payout` | 邀请返现和结算 | referral-core |
| 041 | `referral-antifraud` | 防刷邀请 | referral-core |
| 042 | `notifications-core` | 一句话搭好站内通知 | app-foundation, auth-login |
| 043 | `notifications-channels` | 一条消息发多个渠道 | notifications-core |
| 044 | `notifications-preferences` | 用户自己选接收哪些通知 | notifications-core |

## 系统篇：预约与活动

| 期 | Skill | 做什么 | 先装 |
|---|---|---|---|
| 045 | `booking-core` | 一句话搭好预约系统 | app-foundation, auth-login |
| 046 | `booking-deposit` | 预约付定金 | booking-core |
| 047 | `booking-reminders` | 预约提醒和改期 | booking-core |
| 048 | `events-core` | 一句话搭好活动报名 | app-foundation, auth-login |
| 049 | `events-tickets` | 付费门票和二维码签到 | events-core |
| 050 | `events-waitlist` | 候补名单 | events-core |

## 系统篇：用户与内容

| 期 | Skill | 做什么 | 先装 |
|---|---|---|---|
| 051 | `reviews-core` | 一句话加上评价系统 | app-foundation, auth-login |
| 052 | `reviews-moderation` | 评论审核和防垃圾 | reviews-core |
| 053 | `reviews-showcase` | 好评展示和晒图 | reviews-core |
| 054 | `forms-core` | 一句话搭好表单系统 | app-foundation, auth-login |
| 055 | `forms-results` | 表单结果统计和导出 | forms-core |
| 056 | `forms-automation` | 表单提交后自动处理 | forms-core |
| 057 | `cms-core` | 一句话搭好博客系统 | app-foundation, auth-login |
| 058 | `cms-paywall` | 付费文章和订阅阅读 | cms-core |
| 059 | `cms-newsletter` | Newsletter 邮件订阅 | cms-core |
| 060 | `helpdesk-core` | 一句话搭好客服工单 | app-foundation, auth-login |
| 061 | `helpdesk-faq` | 常见问题自助中心 | helpdesk-core |
| 062 | `helpdesk-sla` | 工单超时提醒 | helpdesk-core |
| 063 | `ai-support-core` | 一句话加上 AI 客服 | app-foundation, auth-login |
| 064 | `ai-support-handoff` | AI 答不了自动转人工 | ai-support-core |
| 065 | `ai-support-limits` | AI 用量和成本控制 | ai-support-core |

## 系统篇：经营管理

| 期 | Skill | 做什么 | 先装 |
|---|---|---|---|
| 066 | `admin-core` | 一句话搭好管理后台 | app-foundation, auth-login |
| 067 | `admin-roles` | 后台权限：谁能看、谁能改 | admin-core |
| 068 | `admin-audit` | 后台操作记录 | admin-core |
| 069 | `dashboard-core` | 一句话搭好经营看板 | app-foundation, auth-login |
| 070 | `dashboard-weekly` | 每周经营周报自动发 | dashboard-core |
| 071 | `dashboard-alerts` | 指标异常自动提醒 | dashboard-core |
| 072 | `crm-core` | 一句话搭好客户管理 | app-foundation, auth-login |
| 073 | `crm-segments` | 客户分组和标签 | crm-core |
| 074 | `crm-campaigns` | 给一组客户群发邮件 | crm-core |
| 075 | `inventory-core` | 一句话搭好库存系统 | app-foundation, auth-login |
| 076 | `inventory-alerts` | 低库存自动提醒补货 | inventory-core |
| 077 | `inventory-audit` | 库存盘点和调整记录 | inventory-core |
| 078 | `teams-core` | 一句话让产品支持团队使用 | app-foundation, auth-login |
| 079 | `teams-roles` | 团队成员权限 | teams-core |
| 080 | `teams-billing` | 按团队人数收费 | teams-core |

## 运维篇：扛得住、不翻车

| 期 | Skill | 做什么 | 先装 |
|---|---|---|---|
| 081 | `uptime-alert` | 网站挂了第一时间知道 | — |
| 082 | `error-tracking` | 用户遇到报错，你马上看到 | app-foundation |
| 083 | `security-check` | 上线前做一次安全体检 | — |
| 084 | `rate-limit` | 防刷：限制访问频率 | app-foundation |
| 085 | `cost-guard` | 给每个服务设账单上限 | — |
| 086 | `legal-docs` | 隐私政策和用户协议 | — |
| 087 | `seo-kit` | 让 Google 搜得到你 | app-foundation |
| 088 | `share-cards` | 分享出去有图有标题 | app-foundation |
| 089 | `i18n-kit` | 中英文双语，卖向全世界 | app-foundation |
| 090 | `analytics-kit` | 免费、合规的访问统计 | app-foundation |

## 成长篇：不会老、能长大

| 期 | Skill | 做什么 | 先装 |
|---|---|---|---|
| 091 | `speed-check` | 网站打开太慢？一键体检 | — |
| 092 | `load-test` | 流量暴涨 100 倍会怎样 | — |
| 093 | `db-migrate-provider` | 数据库换供应商，一句话搬家 | db-connect |
| 094 | `restore-drill` | 备份能恢复吗？演练一次 | db-backup |
| 095 | `upgrade-check` | 什么时候该升级付费套餐 | — |
| 096 | `status-page` | 一份服务状态页 | uptime-alert |
| 097 | `postmortem` | 出事后写一页复盘 | — |
| 098 | `skill-template` | 把你常做的事做成 Skill | — |
| 099 | `stack-upgrade` | 升级底座不推倒重来 | app-foundation |
| 100 | `starter-kit` | 100 期合集：一句话开一家完整的线上店 | — |
