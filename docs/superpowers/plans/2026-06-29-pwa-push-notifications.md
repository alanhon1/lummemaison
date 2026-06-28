# PWA + Admin Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the storefront installable (Add to Home Screen) and let an admin broadcast a push notification (with a red app-icon badge) to all opted-in clients via a manual "Announce" button.

**Architecture:** All manual / static — no PWA plugin (the build is Turbopack, so webpack plugins don't apply). A static `app/manifest.ts` + static `public/sw.js` + the `web-push` library. Subscriptions live in a Supabase `push_subscriptions` table; the admin Announce form POSTs to an admin-guarded route that fans out via `web-push` and prunes expired endpoints.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Supabase (service client), `web-push`, Web Push API + service worker, `sharp` (icon generation), next-intl (en/ru).

## Global Constraints

- **No PWA plugin** — static manifest + static `public/sw.js` only (Turbopack-safe).
- **No offline caching in v1** — the SW's `fetch` handler is a pass-through; no cache storage.
- **Manual Announce only** — nothing auto-sends on product create/sale.
- Push opt-in button appears **only in standalone/installed mode**; permission is requested **from a user tap**, never on load. iOS web push requires Add-to-Home-Screen first (iOS 16.4+).
- VAPID: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client), `VAPID_PRIVATE_KEY` (server), `VAPID_SUBJECT` = `mailto:info@lumeemaison.com`.
- Admin routes use `requireAdmin()` from `@/lib/admin-guard` (`const denied = await requireAdmin(); if (denied) return denied;`).
- Money/unused here. Customer-facing strings are en/ru; admin strings stay English.
- After every task: `npx tsc --noEmit` passes before commit. There is **no unit-test framework**; pure helpers are checked with a `tsx` script + `node:assert/strict`, everything else with `tsc`/`next build` + the manual device checklist in the final task.
- Icons: a gold **"L"** (Lumée) monogram. Brand colours: cream `#F5F0E8`, charcoal `#3A342C`, gold `#A88A4A`.

---

## File Structure

**New**
- `scripts/generate-pwa-icons.ts` — sharp script, writes `public/icons/*`.
- `public/icons/{icon-192,icon-512,maskable-512,apple-touch-180,badge-72}.png`.
- `app/manifest.ts` — web app manifest.
- `public/sw.js` — static service worker (push, notificationclick, badge, passthrough fetch).
- `components/pwa/PwaRegister.tsx` — registers the SW + clears the badge.
- `components/pwa/pushClient.ts` — `urlBase64ToUint8Array` + `subscribeToPush()` browser helper.
- `components/pwa/EnableAlertsButton.tsx` — standalone-only opt-in button.
- `lib/push/webPush.ts` — server `web-push` wrapper (VAPID config + `sendPush`).
- `app/api/push/subscribe/route.ts` — upsert a subscription.
- `app/api/push/send/route.ts` — admin broadcast + prune.
- `components/admin/AnnounceForm.tsx` — admin Announce UI.
- `supabase/migrations/031_push_subscriptions.sql`.
- `scripts/verify-push-helper.ts` — asserts the base64→Uint8Array helper.

**Edit**
- `app/layout.tsx` — `metadata.manifest`, `metadata.appleWebApp`, `metadata.icons.apple`, `viewport.themeColor`, mount `<PwaRegister/>`.
- `components/account/DashboardClient.tsx` — mount `<EnableAlertsButton/>`.
- `components/admin/DashboardClient.tsx` — mount `<AnnounceForm/>`.
- `messages/en.json`, `messages/ru.json` — `pwa.*` keys.
- `package.json` — add `web-push` + `@types/web-push`.

---

## Phase A — Installability

### Task 1: Generate the gold-"L" PWA icons

**Files:**
- Create: `scripts/generate-pwa-icons.ts`
- Create (output): `public/icons/*.png`

**Interfaces:** Produces static PNGs at fixed paths used by the manifest, SW, and layout.

- [ ] **Step 1: Write the generator.**

```ts
// scripts/generate-pwa-icons.ts — run: npx tsx scripts/generate-pwa-icons.ts
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'public', 'icons');
const GOLD = '#A88A4A';
const CREAM = '#F5F0E8';

// A full-bleed gold tile with a centred cream "L" (serif). `pad` leaves safe
// area for maskable icons. `mono` makes a transparent tile with a white "L"
// for the Android notification badge.
function svg(size: number, pad: number, mono: boolean): Buffer {
  const bg = mono ? 'none' : GOLD;
  const fg = mono ? '#FFFFFF' : CREAM;
  const fontSize = Math.round(size * (1 - pad * 2) * 0.9);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
       <rect width="${size}" height="${size}" rx="${mono ? 0 : Math.round(size * 0.18)}" fill="${bg}"/>
       <text x="50%" y="52%" text-anchor="middle" dominant-baseline="central"
             font-family="Georgia, 'Times New Roman', serif" font-weight="500"
             font-size="${fontSize}" fill="${fg}">L</text>
     </svg>`,
  );
}

async function png(size: number, pad: number, mono: boolean, name: string) {
  await sharp(svg(size, pad, mono)).png().toFile(join(OUT, name));
  console.log('  wrote', name);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await png(192, 0.1, false, 'icon-192.png');
  await png(512, 0.1, false, 'icon-512.png');
  await png(512, 0.2, false, 'maskable-512.png'); // extra safe-area padding
  await png(180, 0.1, false, 'apple-touch-180.png');
  await png(72, 0.15, true, 'badge-72.png'); // monochrome, transparent
  console.log('✓ pwa icons generated');
}

main();
```

- [ ] **Step 2: Run it.** Run: `npx tsx scripts/generate-pwa-icons.ts` → Expected: prints `✓ pwa icons generated` and 5 files appear. Verify: `ls public/icons` shows all five PNGs.
- [ ] **Step 3: Commit.**

```bash
git add scripts/generate-pwa-icons.ts public/icons
git commit -m "feat(pwa): generate gold-L monogram app icons"
```

### Task 2: Web app manifest + layout metadata

**Files:**
- Create: `app/manifest.ts`
- Modify: `app/layout.tsx` (metadata + a `viewport` export)

**Interfaces:** Produces `/manifest.webmanifest`. Consumes the Task 1 icons.

- [ ] **Step 1: Manifest.**

```ts
// app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lumée Maison',
    short_name: 'Lumée',
    description: 'Premium Korean aesthetic products — wholesale.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F5F0E8',
    theme_color: '#3A342C',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

- [ ] **Step 2: Layout metadata + viewport.** In `app/layout.tsx`, extend the exported `metadata` and add a `viewport` export:

```ts
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  // …existing fields unchanged…
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Lumée Maison', statusBarStyle: 'default' },
  icons: {
    icon: '/favicon.png',
    apple: '/icons/apple-touch-180.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#3A342C',
};
```

(Merge into the existing `metadata` object — keep title/description/openGraph/etc. The only change to `icons` is the `apple` path.)

- [ ] **Step 3: Verify.** `npx tsc --noEmit` (no errors) → `npx next build` (succeeds). After build, `npx next start` and confirm `GET /manifest.webmanifest` returns valid JSON with the three icons (or trust the build + check in the device test later).
- [ ] **Step 4: Commit.**

```bash
git add app/manifest.ts app/layout.tsx
git commit -m "feat(pwa): web app manifest + apple/theme metadata"
```

### Task 3: Service worker + registration + badge clearing

**Files:**
- Create: `public/sw.js`
- Create: `components/pwa/PwaRegister.tsx`
- Modify: `app/layout.tsx` (mount `<PwaRegister/>`)

**Interfaces:**
- Produces: a registered SW at scope `/` handling `push`/`notificationclick`; `PwaRegister` (client, no props).

- [ ] **Step 1: Service worker (plain JS, not transpiled).**

```js
// public/sw.js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'Lumée Maison';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    if (self.navigator.setAppBadge) {
      try { await self.navigator.setAppBadge(data.count || 1); } catch (e) {}
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});

// Pass-through fetch — required for installability; no caching in v1.
self.addEventListener('fetch', () => {});
```

- [ ] **Step 2: Registration + badge-clear component.**

```tsx
// components/pwa/PwaRegister.tsx
'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});

    const clear = () => {
      // @ts-expect-error clearAppBadge is not in the TS lib yet
      navigator.clearAppBadge?.().catch?.(() => {});
    };
    clear();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') clear();
    });
  }, []);

  return null;
}
```

- [ ] **Step 3: Mount it.** In `app/layout.tsx`, render `<PwaRegister />` inside `<body>` (e.g. right before `<Analytics />`). Add `import PwaRegister from '@/components/pwa/PwaRegister';`.

- [ ] **Step 4: Verify.** `npx tsc --noEmit` (no errors) → `npx next build` (succeeds). Browser manual check happens in Task 9.
- [ ] **Step 5: Commit.**

```bash
git add public/sw.js components/pwa/PwaRegister.tsx app/layout.tsx
git commit -m "feat(pwa): static service worker + registration + badge clearing"
```

---

## Phase B — Push backend

### Task 4: `push_subscriptions` table + web-push server helper

**Files:**
- Create: `supabase/migrations/031_push_subscriptions.sql`
- Create: `lib/push/webPush.ts`
- Modify: `package.json` (add `web-push`, `@types/web-push`)

**Interfaces:**
- Produces: `sendPush(sub, payload): Promise<{ ok: true } | { ok: false; gone: boolean; error: string }>`; `PushSubRow` type.

- [ ] **Step 1: Install deps.**

```bash
npm install web-push
npm install -D @types/web-push
```

- [ ] **Step 2: Migration.**

```sql
-- supabase/migrations/031_push_subscriptions.sql
create table if not exists public.push_subscriptions (
  id           bigserial primary key,
  endpoint     text unique not null,
  p256dh       text not null,
  auth         text not null,
  client_code  text,                      -- set to the customer id when logged in; null for anon
  created_at   timestamptz not null default now()
);
-- Writes happen only via service-role API routes; enable RLS with no public policy.
alter table public.push_subscriptions enable row level security;
```

> Run manually in the Supabase SQL editor.

- [ ] **Step 3: Server helper.**

```ts
// lib/push/webPush.ts
import webpush from 'web-push';

export interface PushSubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:info@lumeemaison.com';
  if (!pub || !priv) throw new Error('VAPID keys are not configured');
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export async function sendPush(
  sub: PushSubRow,
  payload: { title: string; body: string; url?: string; count?: number },
): Promise<{ ok: true } | { ok: false; gone: boolean; error: string }> {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode;
    const gone = status === 404 || status === 410; // subscription expired/unsubscribed
    return { ok: false, gone, error: (e as Error).message };
  }
}
```

- [ ] **Step 4: Verify + apply migration.** `npx tsc --noEmit` (no errors). Run the SQL in Supabase.
- [ ] **Step 5: Commit.**

```bash
git add package.json package-lock.json lib/push/webPush.ts supabase/migrations/031_push_subscriptions.sql
git commit -m "feat(push): push_subscriptions table + web-push server helper"
```

### Task 5: Subscribe API route

**Files:**
- Create: `app/api/push/subscribe/route.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (writes the table from Task 4).
- Produces: `POST /api/push/subscribe` accepting `{ endpoint, keys: { p256dh, auth } }`.

- [ ] **Step 1: Route.**

```ts
// app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: 'invalid subscription' }, { status: 400 });
  }

  // Link to the customer if signed in (anon subscriptions are allowed — client_code null).
  let clientCode: string | null = null;
  try {
    const supa = await createClient();
    const { data: { user } } = await supa.auth.getUser();
    clientCode = user?.id ?? null;
  } catch { clientCode = null; }

  const admin = createServiceClient();
  const { error } = await admin
    .from('push_subscriptions')
    .upsert({ endpoint, p256dh, auth, client_code: clientCode }, { onConflict: 'endpoint' });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

> Confirm `@/lib/supabase/server` exports `createClient` (anon, cookie-bound) and `createServiceClient` (service role) — both are used elsewhere in `app/[locale]/checkout/actions.ts`. Match the real import names.

- [ ] **Step 2: Verify.** `npx tsc --noEmit` (no errors).
- [ ] **Step 3: Commit.**

```bash
git add app/api/push/subscribe/route.ts
git commit -m "feat(push): subscribe endpoint (upsert by endpoint)"
```

### Task 6: Admin send/broadcast API route

**Files:**
- Create: `app/api/push/send/route.ts`

**Interfaces:**
- Consumes: `sendPush`, `PushSubRow` from `lib/push/webPush.ts`; `requireAdmin` from `@/lib/admin-guard`.
- Produces: `POST /api/push/send` body `{ title, body, url? }` → `{ ok, sent, failed, pruned }`.

- [ ] **Step 1: Route.**

```ts
// app/api/push/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPush } from '@/lib/push/webPush';

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { title?: string; body?: string; url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const title = (body?.title ?? '').trim();
  const message = (body?.body ?? '').trim();
  const url = (body?.url ?? '').trim() || '/';
  if (!title || !message) {
    return NextResponse.json({ ok: false, error: 'Title and message are required' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth');

  let sent = 0, failed = 0;
  const goneIds: number[] = [];
  for (const s of subs ?? []) {
    const r = await sendPush(
      { endpoint: s.endpoint as string, p256dh: s.p256dh as string, auth: s.auth as string },
      { title, body: message, url, count: 1 },
    );
    if (r.ok) sent++;
    else { failed++; if (r.gone) goneIds.push(s.id as number); }
  }
  if (goneIds.length) await admin.from('push_subscriptions').delete().in('id', goneIds);

  return NextResponse.json({ ok: true, sent, failed, pruned: goneIds.length });
}
```

- [ ] **Step 2: Verify.** `npx tsc --noEmit` (no errors) → `npx next build` (succeeds).
- [ ] **Step 3: Commit.**

```bash
git add app/api/push/send/route.ts
git commit -m "feat(push): admin broadcast endpoint with expired-subscription pruning"
```

---

## Phase C — Client opt-in + admin Announce

### Task 7: Opt-in button (standalone-only) + account-dashboard mount

**Files:**
- Create: `components/pwa/pushClient.ts`
- Create: `scripts/verify-push-helper.ts`
- Create: `components/pwa/EnableAlertsButton.tsx`
- Modify: `components/account/DashboardClient.tsx`, `messages/en.json`, `messages/ru.json`

**Interfaces:**
- Produces: `urlBase64ToUint8Array(base64: string): Uint8Array`, `subscribeToPush(vapidPublicKey: string): Promise<'ok' | 'denied' | 'unsupported'>`.

- [ ] **Step 1: Write the helper test (tsx + assert).**

```ts
// scripts/verify-push-helper.ts — run: npx tsx scripts/verify-push-helper.ts
import assert from 'node:assert/strict';
import { urlBase64ToUint8Array } from '../components/pwa/pushClient';

// "AQID" base64url decodes to bytes [1,2,3]
const out = urlBase64ToUint8Array('AQID');
assert.deepEqual(Array.from(out), [1, 2, 3]);
// padding + url-safe chars (- _) must not throw and must round-trip length
const k = urlBase64ToUint8Array('BNcRd-_h'.padEnd(12, 'A'));
assert.ok(k instanceof Uint8Array && k.length > 0);
console.log('✓ verify-push-helper: passed');
```

- [ ] **Step 2: Run it — expect FAIL.** Run: `npx tsx scripts/verify-push-helper.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement the helper.**

```ts
// components/pwa/pushClient.ts
// Standard VAPID key decoder (base64url → Uint8Array) + push subscribe flow.

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribeToPush(vapidPublicKey: string): Promise<'ok' | 'denied' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  return res.ok ? 'ok' : 'unsupported';
}
```

- [ ] **Step 4: Run the test — expect PASS.** Run: `npx tsx scripts/verify-push-helper.ts` → Expected: `✓ verify-push-helper: passed`.

- [ ] **Step 5: i18n keys.** Add to `messages/en.json` (and ru with natural Russian) a `pwa` block:

```json
"pwa": {
  "enableAlerts": "Turn on alerts",
  "enabling": "Turning on…",
  "enabled": "Alerts are on ✓",
  "denied": "Notifications are blocked in your browser settings.",
  "iosHint": "Add this site to your Home Screen first, then open it to turn on alerts.",
  "unsupported": "Your browser doesn't support alerts."
}
```

- [ ] **Step 6: Button component.**

```tsx
// components/pwa/EnableAlertsButton.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { subscribeToPush } from './pushClient';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export default function EnableAlertsButton() {
  const t = useTranslations('pwa');
  const [mounted, setMounted] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'denied' | 'unsupported'>('idle');

  useEffect(() => {
    setMounted(true);
    const mm = window.matchMedia('(display-mode: standalone)').matches;
    // iOS Safari standalone flag:
    const ios = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setStandalone(mm || ios);
  }, []);

  if (!mounted || !VAPID) return null;

  if (!standalone) {
    return <p className="text-xs text-mist">{t('iosHint')}</p>;
  }

  async function enable() {
    setState('busy');
    const r = await subscribeToPush(VAPID);
    setState(r === 'ok' ? 'ok' : r === 'denied' ? 'denied' : 'unsupported');
  }

  if (state === 'ok') return <p className="text-xs text-gold-dark">{t('enabled')}</p>;

  return (
    <div className="space-y-1">
      <button onClick={enable} disabled={state === 'busy'} className="btn-gold text-xs">
        {state === 'busy' ? t('enabling') : t('enableAlerts')}
      </button>
      {state === 'denied' && <p className="text-xs text-red-600">{t('denied')}</p>}
      {state === 'unsupported' && <p className="text-xs text-mist">{t('unsupported')}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Mount it.** In `components/account/DashboardClient.tsx`, import and render `<EnableAlertsButton />` in a sensible spot (e.g. near the profile/sign-out area). Add `import EnableAlertsButton from '@/components/pwa/EnableAlertsButton';`.

- [ ] **Step 8: Verify.** `npx tsx scripts/verify-push-helper.ts` (pass) → `npx tsc --noEmit` (no errors).
- [ ] **Step 9: Commit.**

```bash
git add components/pwa/pushClient.ts scripts/verify-push-helper.ts components/pwa/EnableAlertsButton.tsx components/account/DashboardClient.tsx messages/en.json messages/ru.json
git commit -m "feat(pwa): standalone-only push opt-in button on the account dashboard"
```

### Task 8: Admin Announce form

**Files:**
- Create: `components/admin/AnnounceForm.tsx`
- Modify: `components/admin/DashboardClient.tsx` (mount it)

**Interfaces:**
- Consumes: `POST /api/push/send` (`{ title, body, url? }` → `{ ok, sent, failed, pruned }`).

- [ ] **Step 1: Form component.**

```tsx
// components/admin/AnnounceForm.tsx
'use client';

import { useState } from 'react';

export default function AnnounceForm() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  async function send() {
    if (!title.trim() || !body.trim()) { setResult('Title and message are required.'); return; }
    if (!window.confirm('Send this notification to all opted-in clients?')) return;
    setBusy(true); setResult('');
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setResult(data.error || 'Send failed.'); return; }
      setResult(`Sent to ${data.sent}, failed ${data.failed}, pruned ${data.pruned}.`);
      setTitle(''); setBody(''); setUrl('');
    } finally { setBusy(false); }
  }

  const input = 'w-full border border-bone rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-charcoal';

  return (
    <div className="bg-white border border-bone rounded-lg p-5 space-y-3">
      <h2 className="font-display italic text-lg text-charcoal">Announce to clients</h2>
      <input className={input} placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className={input} placeholder="Message" rows={3} value={body} onChange={e => setBody(e.target.value)} />
      <input className={input} placeholder="Optional link (e.g. /catalogue or a product URL)" value={url} onChange={e => setUrl(e.target.value)} />
      <div className="flex items-center gap-3">
        <button onClick={send} disabled={busy} className="btn-gold text-xs">{busy ? 'Sending…' : 'Send announcement'}</button>
        {result && <span className="text-xs text-mist">{result}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it.** In `components/admin/DashboardClient.tsx`, render `<AnnounceForm />` near the News/Promos area. Add `import AnnounceForm from '@/components/admin/AnnounceForm';`.

- [ ] **Step 3: Verify.** `npx tsc --noEmit` (no errors) → `npx next build` (succeeds).
- [ ] **Step 4: Commit.**

```bash
git add components/admin/AnnounceForm.tsx components/admin/DashboardClient.tsx
git commit -m "feat(admin): Announce-to-clients form on the dashboard"
```

---

## Phase D — Verification

### Task 9: End-to-end verification

**Files:** none.

- [ ] **Step 1: Static.** `npx tsx scripts/verify-push-helper.ts` (pass) → `npx tsc --noEmit` (no errors) → `npx next build` (succeeds).
- [ ] **Step 2: Pre-reqs in place.** Confirm `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` are set (Vercel + local), and migration `031` is applied in Supabase. Without these, subscribe/send fail by design.
- [ ] **Step 3: Installability.** Production URL → Chrome desktop/Android shows "Install"; `/manifest.webmanifest` valid; icons load.
- [ ] **Step 4: Android (Chrome).** Install → account dashboard shows "Turn on alerts" → tap → grant → admin sends an Announce → notification arrives with a red icon badge → opening the app clears the badge.
- [ ] **Step 5: iPhone (Safari, iOS 16.4+).** Before install: the account dashboard shows the "Add to Home Screen first" hint (no button). Add to Home Screen → open → "Turn on alerts" (tap) → grant → receive a test Announce.
- [ ] **Step 6: Pruning.** Unsubscribe/uninstall on one device, send again → that subscription is pruned (`pruned ≥ 1` in the result) and no error surfaces.

---

## Notes / sequencing
- **Phases A–B are independent of C** and can be built first; the app becomes installable after Phase A even before push works.
- The migration (Task 4) and the VAPID env vars must be in place before push can be tested (Task 9), but they don't block writing/compiling the code.
- `clearAppBadge`/`setAppBadge` are not yet in the TS DOM lib — the `@ts-expect-error` in `PwaRegister` and the optional-call guards are intentional; do not "fix" them by typing the global.
