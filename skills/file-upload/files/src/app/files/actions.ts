"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { deleteFile, recordUpload } from "@/lib/storage";

export async function saveUpload(url: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser(await headers());
  if (!user) return { ok: false, error: "Please sign in first." };
  try {
    await recordUpload(user.id, url);
    revalidatePath("/files");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeFile(formData: FormData): Promise<void> {
  const user = await getCurrentUser(await headers());
  if (!user) return;
  await deleteFile(user.id, String(formData.get("id") || ""));
  revalidatePath("/files");
}
