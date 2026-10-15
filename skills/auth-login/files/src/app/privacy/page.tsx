import type { Metadata } from "next";

export const metadata: Metadata = { title: "隐私政策" };

// auth-login (episode 006): Google asks for a public privacy policy link before
// "Sign in with Google" can be published. This is a plain starting template:
// the owner should read it and change anything that doesn't match their site.
const site = process.env.NEXT_PUBLIC_SITE_NAME || "本网站";
const contact = process.env.EMAIL_REPLY_TO || "";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-16 leading-relaxed">
      <h1 className="text-3xl font-black">隐私政策</h1>
      <p className="text-sm text-muted">适用于「{site}」。</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">我们收集什么</h2>
        <p>你登录时，我们只保存登录所需的信息：邮箱地址、名字和头像（使用 Google 登录时由 Google 提供），以及登录记录（登录时间、IP 地址、浏览器类型），用来保持你的登录状态和防止滥用。</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">怎么使用</h2>
        <p>这些信息只用来让你登录、识别你的账号，以及发送登录验证码等与账号相关的邮件。我们不会出售你的信息，也不会用它投放广告。</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">存在哪里</h2>
        <p>数据保存在本网站自己的数据库中。邮件通过邮件服务商发送，网站托管在云服务商上，它们只为提供服务而处理必要的数据。</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">你的权利</h2>
        <p>你可以随时退出登录。如果想查看或删除你的账号数据，请联系我们{contact ? `：${contact}` : "。"}</p>
      </section>
    </main>
  );
}
