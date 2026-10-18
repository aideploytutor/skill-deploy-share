# auth-login (episode 006)

Add sign-in to your site: **Sign in with Google**, or **a 6-digit code by email**. No passwords; the first sign-in creates the account. Users live in your own database, with no per-user fees (open-source Better Auth).

## Tell your AI

> Use auth-login to add Google and email-code sign-in to my site

## You need first

- Episode 002 (foundation) and episode 003 (database)
- Episode 005 (email) for email codes; not needed for Google-only
- Ideally your own domain (episode 004)

## What you'll do (the AI walks you through it)

1. Open `yoursite/login`, click "Generate", and paste the secret into Vercel as `BETTER_AUTH_SECRET` **yourself**
2. In Google Cloud: agreeing to the terms is your click, and you copy the Client ID / Client secret into Vercel **yourself** when they appear
3. The AI fills in everything else: project, consent screen, callback URL, privacy policy link, and publishing to production

Never paste any key into a chat.

## Common problems

| Symptom | Cause |
|---|---|
| Google says `redirect_uri_mismatch` | The callback must be exactly `https://yourdomain/api/auth/callback/google` |
| The login page says sign-in isn't set up | An environment variable is missing; **redeploy** after adding it |
| Other people's Google sign-in is blocked | The consent screen is still in Testing; go to Audience → Publish app |
| The code never arrives | Check spam; Resend's free tier allows 100 emails a day |
| "Too many requests" | Abuse protection: one code per 60 seconds |
| "Invalid code" right after requesting one | Enter the code in the same browser that requested it |

`/privacy` is a privacy policy template (Google requires the link). Edit it to match your site.

## Other sign-in methods

Better Auth supports many more providers (GitHub, Apple, Microsoft, WeChat…) and passkeys. They can be added later without changing the user tables.
