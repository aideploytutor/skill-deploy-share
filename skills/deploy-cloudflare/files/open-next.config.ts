import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// deploy-cloudflare (episode 009). No R2 cache: pages here are dynamic, and R2 needs a card on file.
export default defineCloudflareConfig({});
