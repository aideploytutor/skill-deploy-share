---
name: file-upload
description: Let signed-in users upload images and PDFs on an app-foundation site, stored in Vercel Blob (free 1 GB, no card) with the file list in Postgres, plus a /files page. Use when the user says "add file upload", "let users upload images/avatars/photos", "my uploads disappear after deploy", "upload works locally but fails on Vercel", or a later skill (shop products, reviews with photos) requires file-upload.
license: MIT
metadata:
  version: "1.0.1"
  episode: "008"
  requires: "app-foundation, db-connect, auth-login"
  provides: "files_uploads table; src/lib/storage.ts (UPLOAD_LIMITS, recordUpload, listFiles, deleteFile, getUsage); /api/files/upload; /files page; files.uploaded and files.deleted events"
---

# file-upload

Goal: signed-in users can upload images and PDFs, see them in `/files`, and delete them. Files survive every deploy. Follow `../../STACK.md`.

## Why not save files in the project folder

AI tools often write uploads to `public/uploads` with `fs.writeFile`. That works on your computer and fails once deployed: on Vercel and Cloudflare the site's folder is read-only and replaced on every deploy (on Vercel the error is `ENOENT ... mkdir '/var/task/public'` or `EROFS: read-only file system`). Files belong in object storage; the database keeps only their address. `apply.mjs` warns if it finds such code.

## Choices made

- **Vercel Blob, public store.** Created from the Vercel dashboard in a few clicks, **no card needed**. Hobby includes 1 GB storage, 10 GB downloads, 10,000 simple and **2,000 advanced operations a month** (each upload is one). Past the limit Blob stops for the rest of the 30 days; it never charges a Hobby account. Re-check https://vercel.com/docs/vercel-blob/usage-and-pricing before quoting numbers.
- **Browser uploads straight to Blob** (client upload), so files aren't capped by the 4.5 MB function body limit. `/api/files/upload` only issues a one-time permit.
- **Only signed-in users, only into `files/<userId>/`**, JPG/PNG/WebP/GIF/PDF, 5 MB per file, 20 files and 25 MB per person (`UPLOAD_LIMITS` in `src/lib/storage.ts`). Without sign-in, strangers could fill the free quota.
- **The list comes from Postgres, not from Blob**, so viewing `/files` costs no Blob operation. Each upload is verified with `head()` before it's recorded. Deleting is free.
- All Blob calls live in `src/lib/storage.ts` and the upload route, so another provider (Cloudflare R2 for 10 GB) can replace them later without touching pages.

## Rules

- Creating the Blob store changes the owner's Vercel project: ask for an OK first, and let the owner watch or click.
- Never copy, print or ask for `BLOB_READ_WRITE_TOKEN`. Vercel adds it to the project by itself.
- Don't raise the limits or allow other file types (HTML, SVG, executables) without asking. A public store means anyone with a link can open the file; tell the owner not to use it for private documents.

## Steps

### 1. Check dependencies

`stack.json` → `installed` needs `db-connect` and `auth-login`. If either is missing, offer to install it first.

### 2. Add the code

```bash
node <skill-dir>/scripts/apply.mjs --dir "<project>" --json
```

It adds `src/db/schema/files.ts`, `src/lib/storage.ts`, `/api/files/upload`, `/files` (page, uploader, actions), the `@vercel/blob` dependency, an `.env.example` note, `stack.json` → `installed`, and a git save point. It runs `drizzle-kit generate --name file_upload` when `node_modules` exists; if `manual` says so, run `npm install && npm run db:generate -- --name file_upload` and commit `drizzle/`. Read `warnings`: if it lists files that save to `public/`, offer to switch them to `src/lib/storage.ts`.

Push. The next build creates the table.

### 3. Owner: connect a Blob store (with OK)

In Vercel → the project → **Storage** → **Create Storage** → **Blob** → **Continue**:
- **Access: Public** (the code uploads public files; a Private store rejects them)
- tick **Add a read-write token env var to this connection** (Vercel's dialog leaves it off by default, and uploads need it)
- **Create**

Then **Deployments → Redeploy** (or push). Variables only reach new deployments.

### 4. Verify

- Signed out, `/files` redirects to `/login`.
- Signed in: upload a picture → it appears with the space bar updated. Too-large or wrong-type files get a clear message.
- Redeploy, open `/files` again: the picture is still there. This is the whole point.
- Delete it: it disappears from the list and from the Blob store's Browser tab.

## Using it in code

```ts
import { listFiles, UPLOAD_LIMITS } from "@/lib/storage";
const files = await listFiles(user.id); // { id, url, name, contentType, size, createdAt }[]
```

Other systems react to `files.uploaded` / `files.deleted` in `core_events`, or keep a file's `url` in their own table (e.g. `shop_products.image_url`).

## Troubleshooting

See `references/troubleshooting.md`.
