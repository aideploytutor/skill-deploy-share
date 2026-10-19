# file-upload troubleshooting

| What you see | Why | Fix |
|---|---|---|
| `/files` says "Storage isn't connected yet" | No `BLOB_READ_WRITE_TOKEN` in this deployment | Connect a Blob store with **Add a read-write token env var** ticked, then redeploy. If the store already exists: Storage → the store → Projects → ⋯ → Update Project Connection |
| "Upload failed: Failed to retrieve the client token" | The upload route refused: not signed in, quota full, or the token is missing | Sign in again; check the space bar; check the variable exists in Production |
| Upload fails with an access error | The store was created as **Private** | Create a new **Public** store and connect it (a store's access can't be changed) |
| `ENOENT ... mkdir '/var/task/public'` or `EROFS: read-only file system` | Some code saves uploads to the project folder | Use `src/lib/storage.ts` instead; `apply.mjs` lists such files under `warnings` |
| Works on the live site, not on your computer | Local runs don't have the token | `vercel env pull` after adding **Development** to the store's project connection, or test on a preview deployment |
| Blob stops working for weeks | Hobby limits reached (storage, downloads, or 2,000 uploads a month) | Wait for the 30-day window, delete unused files, or move to Pro / Cloudflare R2 |
| Picture uploaded but isn't in the list | The browser closed before saving; Vercel's callback normally records it a moment later | Reload `/files`. If still missing, upload again (the old copy can be deleted in the Blob store's Browser tab) |
