import { del, head } from "@vercel/blob";
import { and, count, desc, eq, sum } from "drizzle-orm";
import { getDb } from "@/db";
import { filesUploads } from "@/db/schema";
import { emitEvent } from "@/lib/events";

/**
 * file-upload (episode 008). Files go to object storage, never into the
 * website's own folder: on Vercel and Cloudflare that folder is read-only and
 * replaced on every deploy. Everything storage-specific stays in this file and
 * in src/app/api/files/upload/route.ts, so another provider can replace it.
 */
export const UPLOAD_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024, // 5 MB per file
  maxFilesPerUser: 20,
  maxBytesPerUser: 25 * 1024 * 1024, // 25 MB per user
  types: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"],
};

/** True once a Blob store is connected to the project (it adds BLOB_READ_WRITE_TOKEN). */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Every user's files sit under their own folder; the upload route enforces it. */
export function userFolder(userId: string): string {
  return `files/${userId}/`;
}

export async function getUsage(userId: string): Promise<{ files: number; bytes: number }> {
  const [row] = await getDb()
    .select({ files: count(), bytes: sum(filesUploads.size) })
    .from(filesUploads)
    .where(eq(filesUploads.userId, userId));
  return { files: Number(row?.files ?? 0), bytes: Number(row?.bytes ?? 0) };
}

export async function listFiles(userId: string) {
  return getDb()
    .select()
    .from(filesUploads)
    .where(eq(filesUploads.userId, userId))
    .orderBy(desc(filesUploads.createdAt));
}

/**
 * Record a finished upload. The URL is checked with the storage service, so a
 * browser can't register a file it didn't upload or one in someone else's folder.
 * Safe to call twice for the same file.
 */
export async function recordUpload(userId: string, url: string): Promise<void> {
  const blob = await head(url); // throws if the file doesn't exist
  if (!blob.pathname.startsWith(userFolder(userId))) throw new Error("That file isn't yours.");
  const name = decodeURIComponent(blob.pathname.slice(userFolder(userId).length)).replace(/-[A-Za-z0-9]{20,}(?=\.[^.]+$|$)/, "");
  const inserted = await getDb()
    .insert(filesUploads)
    .values({ userId, url: blob.url, pathname: blob.pathname, name, contentType: blob.contentType, size: blob.size })
    .onConflictDoNothing({ target: filesUploads.url })
    .returning({ id: filesUploads.id });
  if (inserted[0]) {
    await emitEvent({
      type: "files.uploaded",
      source: "file-upload",
      subjectId: inserted[0].id,
      payload: { userId, contentType: blob.contentType, size: blob.size },
    });
  }
}

/** Delete a file from storage and from the table. Only the owner can. Deleting is free on Vercel Blob. */
export async function deleteFile(userId: string, id: string): Promise<void> {
  const db = getDb();
  const [file] = await db
    .select()
    .from(filesUploads)
    .where(and(eq(filesUploads.id, id), eq(filesUploads.userId, userId)));
  if (!file) return;
  await del(file.url);
  await db.delete(filesUploads).where(eq(filesUploads.id, file.id));
  await emitEvent({ type: "files.deleted", source: "file-upload", subjectId: file.id, payload: { userId } });
}
