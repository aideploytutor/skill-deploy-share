import stack from "../../stack.json";
import { isDbConfigured } from "@/db";

export type StackInfo = typeof stack;

/** Skills that build on this foundation, in the order the series introduces them. */
export const NEXT_STEPS = [
  { skill: "db-connect", episode: "003", label: "Database", hint: "Let your site save data" },
  { skill: "domain-setup", episode: "004", label: "Domain", hint: "Use your own web address" },
  { skill: "email-send", episode: "005", label: "Email", hint: "Sign-in codes, notifications" },
  { skill: "auth-login", episode: "006", label: "Sign-in", hint: "Google and email-code sign-in" },
  { skill: "pay-checkout", episode: "011", label: "Payments", hint: "Add a pay button" },
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
