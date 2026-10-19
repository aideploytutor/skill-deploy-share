# file-upload

Let signed-in users upload images and PDFs to your site. Files go to **Vercel Blob** (free, no card), the list lives in your own database, and nothing is lost when you redeploy.

## Why you need this

Ask an AI for "an upload button" and it often saves files into the project folder (`public/uploads`). That works on your computer. Deployed, it fails: the site's folder on Vercel or Cloudflare is read-only and replaced on every deploy.

```
❌ ENOENT: no such file or directory, mkdir '/var/task/public'
```

The fix is to keep files in object storage and only keep their address in the database. That's what this skill sets up.

## What you get

- `/files`: drag-and-drop upload, thumbnails, delete, and a bar showing how much space each person has used
- Only signed-in users can upload, each into their own folder
- JPG, PNG, WebP, GIF and PDF; 5 MB per file; 20 files and 25 MB per person (change `UPLOAD_LIMITS` in `src/lib/storage.ts`)
- `files.uploaded` / `files.deleted` events for other systems

## Before you start

- `app-foundation`, `db-connect` and `auth-login` installed
- A Vercel project (Hobby is fine)

## Use it

Tell your AI:

> Add file upload with the file-upload skill

Or run it yourself:

```bash
node skills/file-upload/scripts/apply.mjs --dir ./my-shop
```

Then, in Vercel → your project → **Storage** → **Create Storage** → **Blob**:

1. Access: **Public**
2. Tick **Add a read-write token env var to this connection**
3. **Create**, then redeploy

You never copy the key: Vercel adds `BLOB_READ_WRITE_TOKEN` to the project itself.

## Free limits (Vercel Hobby, checked 2026-10-18)

1 GB storage, 10 GB downloads, 2,000 uploads a month. If you go over, Blob pauses until the 30-day window resets; you're never charged. Source: [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing).

Need more? Cloudflare R2 gives 10 GB free with free downloads (needs a card on file). All storage code is in `src/lib/storage.ts`, so switching later is contained.

## Known issues

- Files in a public store can be opened by anyone who has the link. Don't use it for private documents.
- Uploading from `npm run dev` needs the token locally (`vercel env pull`).

More in [references/troubleshooting.md](references/troubleshooting.md).
