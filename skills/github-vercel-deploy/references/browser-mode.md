# Browser mode

Use this mode when the agent **cannot** run `scripts/deploy.mjs` on a machine that can reach both
api.github.com and api.vercel.com. A typical case is a cloud chat session with a browser tool and a
sandbox whose network blocks Vercel. This flow was verified end-to-end in a Claude cloud session using
the built-in browser.

The user signs in and changes account settings. The agent pushes code, fills in forms, and clicks
Create, Import, and Deploy.

## 0. Preflight

1. **Code-push access.** The agent needs a git credential for the user's GitHub account. In Claude,
   this means the GitHub connector:
   - Run `gh api user --jq .login`.
   - If it says "No linked GitHub account", give the user the link it prints.
   - After they authorize, wait about 30s and check again.
2. **Account match.** In the browser, open `https://vercel.com/account/settings/authentication`. The
   **GitHub** row must show the same user that will own the repo.
   - If it doesn't, ask the user to Disconnect it and Connect the right account. Agents are usually
     not allowed to change account links.
   - Symptom of a mismatch: on the import page, **Deploy does nothing**, and the network request
     `/api/v1/integrations/get-repo` returns 404 "The repository was not found".
3. **Vercel GitHub App.** Open `https://github.com/apps/vercel/installations/new`. Repository access
   must be All, or include the target repo.

## 1. Create the repo (browser)

Sandboxed sessions often can't call `POST /user/repos`, so create the repo in the browser:

1. Open `https://github.com/new?name=<repo>&visibility=private&description=<text>`.
2. If GitHub shows a sign-in page, ask the user to sign in in the browser pane.
3. Click **Create repository**. Don't tick "Add README", so the repo stays empty.
4. In Claude, attach the repo to the session with push access (`add_repo`, `access: "push"`).

Some agents may be blocked from creating a **public** repo. In that case, create it private and tell
the user they can switch it in Settings → General → Danger Zone → Change visibility.

## 2. Push

```bash
git init -b main
git config user.name <login>
git config user.email <login>@users.noreply.github.com
git add -A && git commit -m "Initial commit"
git remote add origin https://github.com/<owner>/<repo>
git push -u origin main
```

Before `git add`, run the same secret checks as the script: `.gitignore` must cover `.env*`, and no
key files may be committed.

## 3. Import and deploy on Vercel (browser)

1. Open `https://vercel.com/new/import?s=https://github.com/<owner>/<repo>`.
   - Not signed in? Ask the user to click **Continue with GitHub**.
   - Their first sign-in creates the Vercel account and accepts the terms, so it must be the user's
     own action.
2. Confirm `get-repo` returns 200 with a network-requests tool. A 404 means going back to step 0.2.
3. Check the Framework Preset ("Other" is fine for static HTML), the Root Directory, and the env vars.
4. Click **Deploy**. Narrow browser panes make coordinate clicks land on the wrong element, so click by
   script instead:

   ```js
   [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Deploy').click()
   ```

   Wait about 15s. The URL switches to `/new/<team>/success?...deploymentUrl=...`.

## 4. Verify auto-deploy

1. Push a tiny change.
2. Open `https://vercel.com/<team>/<project>`. Status should show **Ready**, with Source set to the new
   commit.
3. Open `https://<project>.vercel.app` and read the page text to confirm the change is live.
