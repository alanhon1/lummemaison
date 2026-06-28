# PWA + Admin Push Notifications — Design

**Date:** 2026-06-29
**Sub-project:** lumee3 ③ (`lumee3/pwa-notifications-task.md`)
**Stack:** Next.js 16.2.6 (App Router, **Turbopack**) · TypeScript · Supabase · Nodemailer (unrelated) · Vercel

## 1. Overview
Make the storefront **installable** ("Add to Home Screen") on iPhone (Safari) and Android (Chrome), and let an **admin broadcast a push notification** (banner + red app-icon badge) to all opted-in clients via a manual **"Announce"** button. Nothing auto-fires.

## 2. Approach — manual, no PWA plugin
The build runs on **Turbopack**, so webpack-based plugins (`@ducanh2912/next-pwa`) do not apply. Everything is built by hand from static files and standard Web APIs — which also sidesteps any plugin/Turbopack incompatibility:
- Manifest via `app/manifest.ts` (Next serves `/manifest.webmanifest`).
- Service worker as a **static** `public/sw.js` (served as-is, root scope).
- Push via the `web-push` library (server) + the browser Push API (client).

## 3. Confirmed decisions
- **Icons:** generated gold **"L" monogram** (Lumée) via a `sharp` script → `public/icons/`.
- **Announce placement:** a button/card on the **admin dashboard home** (`/manzura`) near News/Promos (the nav already has 12 tabs).
- **No offline caching in v1** (dynamic commerce — risky/YAGNI). The SW carries a trivial network-passthrough `fetch` handler only to satisfy installability.
- **Manual Announce only** — no auto-send on product create/sale.
- Customer-facing strings (the opt-in button, permission hints) are **en/ru**.

## 4. One-time setup (manual — cannot be automated here)
1. `npx web-push generate-vapid-keys` → set in Vercel env (+ local `.env.local`): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. (`VAPID_SUBJECT` = `mailto:info@lumeemaison.com`.)
2. Run migration `031_push_subscriptions.sql` in the Supabase SQL editor.
3. `web-push` npm dependency is added by the implementation (no manual step beyond install during build).

## 5. Architecture / pieces

### 5.1 Installability
- `app/manifest.ts` → `MetadataRoute.Manifest`: `name: "Lumée Maison"`, `short_name: "Lumée"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `background_color`/`theme_color` (brand cream/charcoal), `icons` (192, 512, **maskable** 512).
- `app/layout.tsx` `metadata`: add `manifest: "/manifest.webmanifest"`, `appleWebApp: { capable: true, title: "Lumée Maison", statusBarStyle: "default" }`, and `icons.apple` = the 180×180 apple-touch icon. `themeColor` via `viewport` export.

### 5.2 Icons — `scripts/generate-pwa-icons.ts` (sharp)
Generates from a gold-background "L" monogram into `public/icons/`: `icon-192.png`, `icon-512.png`, `maskable-512.png` (extra safe-area padding), `apple-touch-180.png`, `badge-72.png` (monochrome white "L" on transparent — Android notification badge). Committed as static assets.

### 5.3 Service worker — `public/sw.js` (static)
- `push`: parse `event.data.json()` → `showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', data: { url } })`; then `self.navigator.setAppBadge?.(count ?? 1)`.
- `notificationclick`: close, then focus an existing client or `openWindow(data.url || '/')`.
- `install`/`activate`: `skipWaiting()` + `clients.claim()`.
- `fetch`: pass-through (`event.respondWith(fetch(event.request))` only where needed) — no caching.

### 5.4 Client — register + subscribe
- `components/pwa/PwaRegister.tsx` (`'use client'`, rendered once in root layout body): registers `/sw.js`; on app load and `visibilitychange` calls `navigator.clearAppBadge?.()`.
- `components/pwa/EnableAlertsButton.tsx` (`'use client'`): a "Turn on alerts" button shown in the **account dashboard**. Visible only in standalone/installed mode (`matchMedia('(display-mode: standalone)')` or iOS `navigator.standalone`). On tap (user gesture): `Notification.requestPermission()` → `reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(NEXT_PUBLIC_VAPID_PUBLIC_KEY) })` → `POST /api/push/subscribe`. If not standalone on iOS, show "Add to Home Screen first" hint instead. Includes the standard `urlBase64ToUint8Array` helper.

### 5.5 Storage — migration `031_push_subscriptions.sql`
`push_subscriptions`: `id bigserial pk`, `endpoint text unique not null`, `p256dh text not null`, `auth text not null`, `client_code text` (nullable; set to the customer id when logged in), `created_at timestamptz default now()`. RLS: writes go through service-role API routes only.

### 5.6 API routes
- `app/api/push/subscribe/route.ts` (POST): validate the subscription JSON; **upsert by `endpoint`** (service client). Attach `client_code` if the caller is authenticated.
- `app/api/push/send/route.ts` (POST, **admin-auth** via the existing `iron-session` `requireAdmin` pattern): body `{ title, body, url? }`; load all `push_subscriptions`; `web-push.sendNotification(sub, JSON.stringify({ title, body, url, count: 1 }))` for each; on `404`/`410` delete that row. `web-push.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)`.

### 5.7 Admin Announce UI
- `components/admin/AnnounceForm.tsx` (`'use client'`) on `/manzura` home: Title, Message, optional URL (or product picker → product URL), Send → `/api/push/send`. Confirms before sending; shows sent/failed counts.

### 5.8 i18n
`messages/en.json` + `ru.json`: `pwa.enableAlerts`, `pwa.iosHint`, `pwa.enabled`, `pwa.blocked` (permission denied), etc. (Admin strings stay English, matching the admin UI.)

## 6. CSP note
`next.config.ts` CSP is `default-src 'self'` with Supabase added to `connect-src`. The SW, manifest, icons, and the `/api/push/*` POSTs are all **same-origin** → allowed. `web-push` sends server→push-service (FCM/Apple), not subject to the page CSP. No CSP change expected; verify the SW registers without a CSP violation and add `worker-src 'self'` only if a browser complains.

## 7. Files map
**New:** `app/manifest.ts` · `public/sw.js` · `scripts/generate-pwa-icons.ts` · `public/icons/*` · `components/pwa/PwaRegister.tsx` · `components/pwa/EnableAlertsButton.tsx` · `components/admin/AnnounceForm.tsx` · `app/api/push/subscribe/route.ts` · `app/api/push/send/route.ts` · `supabase/migrations/031_push_subscriptions.sql` · `lib/push/web-push.ts` (server helper wrapping `web-push` + VAPID).
**Edit:** `app/layout.tsx` (manifest + appleWebApp + apple icon + `<PwaRegister/>`, `viewport.themeColor`) · the account dashboard page (mount `<EnableAlertsButton/>`) · `/manzura` home page (mount `<AnnounceForm/>`) · `messages/en.json` + `ru.json` · `package.json` (`web-push` + `@types/web-push`).

## 8. Verification
- `tsc --noEmit` + `next build` pass. `/manifest.webmanifest` serves valid JSON; Lighthouse "Installable" check passes.
- **Android (Chrome):** install → "Turn on alerts" → receive a test Announce with a red icon badge; badge clears on open.
- **iPhone (Safari, iOS 16.4+):** Add to Home Screen → open → "Turn on alerts" (from a tap) → receive a test notification. Before install, the iOS hint shows instead of the button.
- Admin Announce reaches all subscribers; expired (404/410) subscriptions are pruned.

## 9. Open items / non-goals
- No offline caching, no background sync (v1).
- Product picker in Announce can start as a plain URL field; a richer picker is a later enhancement.
- fr/es opt-in strings deferred to sub-project ② (English/Russian now, English fallback).
