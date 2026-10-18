import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

// auth-login (episode 006): Google asks for a public privacy policy link before
// "Sign in with Google" can be published. This is a plain starting template:
// the owner should read it and change anything that doesn't match their site.
const site = process.env.NEXT_PUBLIC_SITE_NAME || "this website";
const contact = process.env.EMAIL_REPLY_TO || "";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-16 leading-relaxed">
      <h1 className="text-3xl font-black">Privacy policy</h1>
      <p className="text-sm text-muted">Applies to {site}.</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">What we collect</h2>
        <p>When you sign in, we store only what sign-in needs: your email address, name and profile picture (provided by Google if you use Google sign-in), and session records (sign-in time, IP address, browser type) to keep you signed in and prevent abuse.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">How we use it</h2>
        <p>This information is used only to sign you in, identify your account, and send account emails such as sign-in codes. We never sell your information or use it for advertising.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Where it's stored</h2>
        <p>Data is stored in this website's own database. Email is sent through an email provider and the site is hosted by a cloud provider; they process only the data needed to provide their service.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Your rights</h2>
        <p>You can sign out at any time. To see or delete your account data, contact us{contact ? `: ${contact}` : "."}</p>
      </section>
    </main>
  );
}
