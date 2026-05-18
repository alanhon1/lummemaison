# Deploy to Vercel

> Repo: `alanhon1/lummemaison` on GitHub. Production domain: `lumemaison.com` (single 'm').

## 1. Import the repo into Vercel (one-time, ~5 min)

1. Open https://vercel.com/new
2. Sign in / select your team
3. Click **Import** next to `alanhon1/lummemaison`
4. **Framework Preset:** Vercel auto-detects Next.js — leave it.
5. **Root Directory:** leave at the repo root (do not enter a subdirectory).
6. **Build & Output Settings:** leave defaults. Next.js 16 needs no overrides.

## 2. Set environment variables (before first deploy)

In the Vercel project's **Settings → Environment Variables**, add the three values from `.env.example`. Use **Production, Preview, Development** for all three.

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://lumemaison.com` |
| `ADMIN_USERNAME` | `manzura` *(or your preferred admin username)* |
| `ADMIN_PASSWORD` | *your real password — do not commit this anywhere* |
| `SESSION_SECRET` | Run `openssl rand -hex 32` locally and paste the 64-char hex string. Use a **fresh** secret, not the one currently in `.env.local`. |

After saving, click **Deploy** on the project overview.

## 3. First build will succeed without code changes

The repo's `npm run build` is already green. Vercel will run it, generate the 38 static + dynamic routes, and deploy to a `lummemaison.vercel.app` style preview URL within ~2-3 minutes.

Open that preview URL and confirm:
- Home page renders with the new sparkle + orb effects
- `/en/catalogue` shows the stats sidebar (Products / Categories / Countries / B2B Specialist)
- `/en/about` shows the new Process timeline
- Product detail pages show the DESCRIPTION / INDICATION / PACKAGING / PROTOCOL section
- Admin login at `/manzura` works with your `ADMIN_USERNAME` + `ADMIN_PASSWORD`

If anything looks wrong, check the **Functions** → **Logs** tab in Vercel for runtime errors.

## 4. Attach `lumemaison.com` to the deployment

1. Vercel project → **Settings → Domains** → **Add** → enter `lumemaison.com`
2. Vercel will show DNS records (an A record pointing at `76.76.21.21` plus possibly a CNAME for `www`)
3. Log into your domain registrar (the one showing the Italian "SSL Error" page) and:
   - Delete the current A record pointing at `195.110.124.133`
   - Add the A record Vercel showed
   - (optional) Add the `www` CNAME
4. Wait 5-60 minutes for DNS propagation. Vercel auto-provisions a Let's Encrypt SSL cert once DNS resolves.

To check propagation: `nslookup lumemaison.com 8.8.8.8` should return the Vercel IP (`76.76.21.21`).

## 5. Going forward: auto-deploy

Once linked, every push to `main` triggers a Vercel build automatically. The 4-6 minutes from `git push` → live site is the new normal. There's nothing else to configure.

## Notes

- `.env.local` is gitignored so your local secrets stay private. Vercel's env vars are the source of truth for production.
- `data/products.json` is committed, so all 438 products + their fields ship with the deploy. No DB setup needed.
- `public/images/products/*.webp` are committed (345 files). They serve directly from `/images/products/...`.
- The admin route `/manzura` uses iron-session. Make sure `SESSION_SECRET` is set in Vercel before testing admin login — without it, sessions fail.
- The data is currently read-only from `data/products.json` at request time. Admin edits via `/manzura` write to the JSON file — but **on Vercel, the filesystem is read-only at runtime**. Admin write operations won't persist across deploys. If you need persistent admin edits in production, that's a separate task (move to a database or commit-on-edit via the GitHub API).
