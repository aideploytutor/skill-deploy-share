import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";
import { UPLOAD_LIMITS, getUsage, recordUpload, userFolder } from "@/lib/storage";

/**
 * file-upload (episode 008). The browser sends the file straight to Vercel Blob
 * (so it isn't limited by the 4.5 MB function body limit). This route only hands
 * out a one-time upload permit, and only to a signed-in user within their quota.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser(request.headers);
        if (!user) throw new Error("Please sign in first.");
        if (!pathname.startsWith(userFolder(user.id))) throw new Error("Files can only go into your own folder.");
        const usage = await getUsage(user.id);
        if (usage.files >= UPLOAD_LIMITS.maxFilesPerUser) throw new Error("You've reached the file limit. Delete a file first.");
        const room = UPLOAD_LIMITS.maxBytesPerUser - usage.bytes;
        if (room <= 0) throw new Error("You've used all your storage. Delete a file first.");
        return {
          allowedContentTypes: UPLOAD_LIMITS.types,
          maximumSizeInBytes: Math.min(UPLOAD_LIMITS.maxFileBytes, room),
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      // Vercel calls this after the upload, as a backup in case the browser closed early.
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { userId } = JSON.parse(tokenPayload || "{}") as { userId?: string };
        if (userId) await recordUpload(userId, blob.url);
      },
    });
    return Response.json(json);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
