# Notifications — Phase 3 design (app separation + forced login + admin push)

Spec parent: `2026-06-29-notifications-system-design.md` (§Phase 3). Builds on
Phases 1–2 (commit `1b2838f`). Branch: `feat/notifications-phase3`.

**Decisions (this session):**
- Forced login in standalone applies to the **customer app** (installed PWA →
  must be logged in; the browser site stays public for SEO). The admin `/manzura`
  pages already redirect to `/manzura/login`, so they're gated already.
- **Admin order Web Push: yes.** Mom taps "Enable alerts" once in the admin app;
  new orders/quotes then push to her device (in addition to the Phase-2 inbox +
  badge).

## Part A — Separate installable admin PWA
- New static manifest `public/manzura.webmanifest`: name "Lumée Admin",
  short_name "Admin", `start_url:/manzura`, `scope:/manzura`, display standalone,
  distinct theme/background, distinct icons → installs as its own home-screen app.
- Distinct admin icons generated with `sharp` (charcoal field + gold mark):
  `public/icons/admin-{192,512}.png`, `admin-maskable-512.png`,
  `admin-apple-180.png`. One-off generator: `scripts/gen-admin-icons.mjs`.
- `app/manzura/layout.tsx` metadata overrides `manifest` → `/manzura.webmanifest`
  and `appleWebApp.title` → "Lumée Admin", apple icon → admin-apple. (Child
  metadata overrides the root for /manzura routes.) The root `/sw.js` is registered
  at scope `/`, so it already covers /manzura — no second service worker.

## Part B — Forced login in the installed customer app
- `app/[locale]/layout.tsx` already resolves `user`. Pass `isAuthed={!!user}` to a
  new client guard `StandaloneAuthGate`.
- Guard: on mount, if `display-mode: standalone` (or iOS `navigator.standalone`)
  AND `!isAuthed` AND not already on an auth route (`/account/login`,
  `/account/signup`, `/account/forgot-password`, `/account/reset-password`,
  `/auth/...`) → `router.replace` to `/{locale}/account/login`. Browser
  (non-standalone) does nothing → public site unchanged.

## Part C — Admin Web Push
- Sentinel: admin subscriptions stored in `push_subscriptions` with
  `client_code = '__admin__'` (`ADMIN_PUSH_CODE` in `lib/push/notify.ts`). No
  migration — reuses the existing table.
- `pushClient.ts`: `subscribeToPush(vapid, apiBase='/api/push')` and
  `unsubscribeFromPush(apiBase='/api/push')` gain an apiBase arg so the admin
  flow can target `/api/admin/push`.
- New routes (iron-session): `POST /api/admin/push/subscribe` (upsert endpoint
  with `client_code='__admin__'`) and `POST /api/admin/push/unsubscribe`
  (delete by endpoint).
- `notifyAdmin()` (already inserts the inbox row) also Web-Pushes every
  `client_code='__admin__'` subscription (best-effort, prunes 404/410).
- `EnableAdminAlertsButton` (client) on `/manzura/notifications`, shown only in
  standalone (mirrors the customer button, plain English, targets `/api/admin/push`).

## Verify
- tsc + build clean.
- Admin manifest served at `/manzura.webmanifest`; `/manzura` head links it.
- In a customer standalone context, logged-out → bounced to login; browser → not.
- Admin "Enable alerts" subscribes; placing an order pushes to the admin device
  and still creates the inbox row + badge.

## Deploy
No migration. Owner says "deploy" → merge `feat/notifications-phase3` → main.
(Installing the new admin app is a manual step on the device afterward.)
