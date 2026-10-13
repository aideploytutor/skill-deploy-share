import type { Metadata } from "next";
import "./globals.css";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "__APP_NAME__";

export const metadata: Metadata = {
  title: { default: siteName, template: `%s · ${siteName}` },
  description: `${siteName}`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
