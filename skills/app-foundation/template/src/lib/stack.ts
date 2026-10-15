import stack from "../../stack.json";
import { isDbConfigured } from "@/db";

export type StackInfo = typeof stack;

/** Skills that build on this foundation, in the order the series introduces them. */
export const NEXT_STEPS = [
  { skill: "db-connect", episode: "003", label: "数据库", hint: "让网站能存东西" },
  { skill: "domain-setup", episode: "004", label: "域名", hint: "绑定你自己的网址" },
  { skill: "email-send", episode: "005", label: "发邮件", hint: "验证码、通知" },
  { skill: "auth-login", episode: "006", label: "登录", hint: "Google 和邮箱验证码登录" },
  { skill: "pay-checkout", episode: "011", label: "收款", hint: "接上付款按钮" },
] as const;

export function getStackStatus() {
  const installed = stack.installed as Record<string, string>;
  return {
    name: stack.name,
    createdAt: stack.createdAt,
    installed,
    steps: NEXT_STEPS.map((s) => ({
      ...s,
      done: s.skill === "db-connect" ? isDbConfigured() && Boolean(installed[s.skill]) : Boolean(installed[s.skill]),
    })),
  };
}
