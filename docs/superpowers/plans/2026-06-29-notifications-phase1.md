# Notifications Phase 1 — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans or subagent-driven-development. Steps use `- [ ]`.

**Goal:** Build the notification foundation — push ON/OFF, targeted broadcast that saves to the existing inbox, public News (replacing the auto-popup), and remove the untargeted "blast to all".

**Architecture:** Reuse `user_messages` (existing read/unread inbox) as the personal push store; reuse `announcements` as the public News source; a single server helper performs targeted sends (inbox row + Web Push to users whose push is ON). Branch `feat/notifications-phase1`.

**Tech Stack:** Next.js (App Router, this repo's pinned version — read `node_modules/next/dist/docs/` before API-level changes), TypeScript, Supabase (service role), web-push, next-intl, Tailwind tokens (cream/bone/gold/charcoal/mist).

## Global Constraints
- Verify every task with `npx tsc --noEmit` and `npx next build` (no unit-test runner exists).
- DB migrations are applied MANUALLY in Supabase (never auto-run); provide SQL.
- Admin endpoints use `requireAdmin()` (`lib/admin-guard.ts`). Public/user endpoints use Supabase auth (`createClient().auth.getUser()`).
- Match existing Tailwind tokens; mobile-first.
- Do NOT push to main; work on `feat/notifications-phase1`; deploy only after owner approval.

---

### Task 1: Migration — extend `user_messages` for click-through + kind

**Files:** Create `supabase/migrations/032_notifications_phase1.sql`

- [ ] Step 1: Write the migration

```sql
-- 032_notifications_phase1.sql
alter table public.user_messages
  add column if not exists url text,
  add column if not exists kind text not null default 'message',
  add column if not exists product_id integer;
-- kind ∈ message | announcement | product | system  (free text; app-enforced)
```

- [ ] Step 2: Note in the PR/owner report that migration 032 MUST be run manually in Supabase before the broadcast/inbox features work. (Existing rows default to kind='message', url null → render unchanged.)

---

### Task 2: Targeted send helper (`notifyUsers`)

**Files:** Modify `lib/push/notify.ts`

**Interfaces:**
- Consumes: `sendPush` (lib/push/webPush.ts), `createServiceClient`.
- Produces: `notifyUsers(opts)` and existing `pushToUser`.

- [ ] Step 1: Add the broadcast helper. It targets every user with an ACTIVE push subscription (push ON), inserts an inbox row per user, and Web-Pushes each of their devices.

```ts
export interface BroadcastOpts {
  title: string;
  body: string;
  url?: string;
  kind?: 'announcement' | 'product' | 'system';
  productId?: number;
}

// Send to every logged-in user whose push is ON (has a push_subscriptions row).
// Inserts one inbox row per user (so it shows in /account/inbox unread) AND
// Web-Pushes their devices. Users with push OFF get neither (owner rule).
export async function notifyUsers(opts: BroadcastOpts): Promise<{ users: number; pushed: number }> {
  const admin = createServiceClient();
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('client_code')
    .not('client_code', 'is', null);
  const userIds = [...new Set((subs ?? []).map(s => s.client_code as string))];
  if (userIds.length === 0) return { users: 0, pushed: 0 };

  // Inbox rows (subject = title; url/kind/product_id power the click-through).
  const rows = userIds.map(uid => ({
    user_id: uid,
    subject: opts.title,
    body: opts.body,
    url: opts.url ?? null,
    kind: opts.kind ?? 'announcement',
    product_id: opts.productId ?? null,
  }));
  await admin.from('user_messages').insert(rows);

  let pushed = 0;
  for (const uid of userIds) {
    const r = await pushToUser(uid, { title: opts.title, body: opts.body, url: opts.url, count: 1 });
    pushed += r.sent;
  }
  return { users: userIds.length, pushed };
}
```

- [ ] Step 2: `npx tsc --noEmit` → PASS.
- [ ] Step 3: Commit `feat(push): notifyUsers targeted broadcast helper`.

---

### Task 3: Account push ON/OFF toggle

**Files:** Create `app/api/push/unsubscribe/route.ts`; Modify `components/pwa/pushClient.ts`, `components/pwa/EnableAlertsButton.tsx`; add i18n keys `pwa.disable`, `pwa.disabling`, `pwa.off` to all 4 message catalogs.

- [ ] Step 1: Unsubscribe route (delete the subscription row by endpoint).

```ts
// app/api/push/unsubscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  let body: { endpoint?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!body.endpoint) return NextResponse.json({ ok: false, error: 'missing endpoint' }, { status: 400 });
  const admin = createServiceClient();
  const { error } = await admin.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] Step 2: Add `unsubscribeFromPush()` to `pushClient.ts`.

```ts
export async function unsubscribeFromPush(): Promise<'ok' | 'error'> {
  if (!('serviceWorker' in navigator)) return 'ok';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return 'ok';
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }) }).catch(() => {});
  navigator.clearAppBadge?.().catch?.(() => {});
  return 'ok';
}

export async function getPushState(): Promise<'on' | 'off' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}
```

- [ ] Step 3: Make `EnableAlertsButton` a toggle — on mount read `getPushState()`; show ON state with a "Turn off" action and OFF state with "Turn on". Wire `subscribeToPush`/`unsubscribeFromPush`. Keep the standalone-only + iOS-hint gating.
- [ ] Step 4: `npx tsc --noEmit` + `npx next build` → PASS.
- [ ] Step 5: Commit `feat(push): account alerts ON/OFF toggle`.

---

### Task 4: Remove auto-popup; add public News page + Header link

**Files:** Modify `app/[locale]/layout.tsx` (remove `AnnouncementModal` + its data load); Create `app/[locale]/news/page.tsx`; Modify `components/layout/Header.tsx` (add News link); add `nav.news` to 4 catalogs. Keep `components/announcements/AnnouncementModal.tsx` file but unused (or delete import only).

- [ ] Step 1: In `app/[locale]/layout.tsx` remove the `AnnouncementModal` import, the `loadActiveAnnouncements()` call, and the `<AnnouncementModal .../>` element.
- [ ] Step 2: Create `app/[locale]/news/page.tsx` — server component, public, lists active announcements (title, body, image, date) using `loadActiveAnnouncements()`; localized heading via a small UI dict (en/ru/fr/es) like the FAQ page; render `body` with the same `**bold**`/newline handling pattern.
- [ ] Step 3: Add a localized "News" link to the Header nav (`nav.news`: News / Новости / Actualités / Novedades).
- [ ] Step 4: `npx next build` → PASS (verify `/news` and `/ru/news` build; no modal on home/catalogue).
- [ ] Step 5: Commit `feat(news): public News page replaces auto-popup announcement modal`.

---

### Task 5: Inbox renders click-through link + kind

**Files:** Modify `app/[locale]/account/inbox/page.tsx`.

- [ ] Step 1: Extend the select to include `url, kind`; when `url` is set, wrap the item in a link to `localePath(locale, url)` (internal) or a plain anchor for absolute URLs; otherwise render as today. Keep the mark-as-read behaviour.
- [ ] Step 2: `npx next build` → PASS.
- [ ] Step 3: Commit `feat(inbox): click-through links for pushed notifications`.

---

### Task 6: Announcement create → optional push to users

**Files:** Modify `app/manzura/announcements/actions.ts` (`createAnnouncement`), `components/admin/AnnouncementsClient.tsx` (add a "Also push to subscribed users" checkbox to the create form).

- [ ] Step 1: In the create form add `<input type="checkbox" name="push">`.
- [ ] Step 2: In `createAnnouncement`, after a successful insert, if `formData.get('push') != null`, call `notifyUsers({ title, body, url: '/news', kind: 'announcement' })`. Best-effort; do not fail the announcement if push errors. Return the send summary in the result for the toast.
- [ ] Step 3: `npx tsc --noEmit` + `npx next build` → PASS.
- [ ] Step 4: Commit `feat(announcements): optional Web Push + inbox on create`.

---

### Task 7: Dashboard cleanup + remove the untargeted blast

**Files:** Modify `components/admin/DashboardClient.tsx` (remove prominent `AnnounceForm` + `PushDiagPanel`; add a single "Notifications" nav button to a new `/manzura/notifications` page); Create `app/manzura/notifications/page.tsx` (admin-guarded) hosting `PushDiagPanel` (read-only diag) ; **Delete** `app/api/push/test/route.ts` (the all-blast) and the "Send test push to all" button from `PushDiagPanel`; keep `/api/push/diag`. Remove the standalone broadcast `AnnounceForm`/`/api/push/send` all-blast (superseded by Task 6 targeted send) — or convert `/api/push/send` to admin-only and unused; simplest: delete `AnnounceForm` + `/api/push/send`.

- [ ] Step 1: Remove `<AnnounceForm/>` and `<PushDiagPanel/>` blocks from `DashboardClient.tsx`; add a "Notifications" button alongside Promos/News/Requests linking to `/manzura/notifications`.
- [ ] Step 2: Create `app/manzura/notifications/page.tsx` (force-dynamic, admin session check like other manzura pages) rendering `PushDiagPanel`.
- [ ] Step 3: Edit `PushDiagPanel` — remove the "Send test push to all" button + its handler; keep "Run diagnostics".
- [ ] Step 4: Delete `app/api/push/test/route.ts`, `app/api/push/send/route.ts`, and `components/admin/AnnounceForm.tsx` (broadcast now flows through announcements). Revert the `sendPush` `status` field if unused — keep it (harmless).
- [ ] Step 5: `npx tsc --noEmit` + `npx next build` → PASS (fix any dangling imports).
- [ ] Step 6: Commit `refactor(admin): relocate push diagnostics, remove untargeted blast`.

---

## Verification (whole Phase 1)
- `npx tsc --noEmit` ✅, `npx next build` ✅ on `feat/notifications-phase1`.
- Migration 032 run in Supabase.
- Manual: (a) account in standalone → toggle ON subscribes (row appears), OFF removes row; (b) admin creates an announcement with "push" checked → ON user gets banner + inbox unread (click → /news) ; OFF user gets News entry only; (c) no auto-popup; (d) no "send to all" button anywhere.

## Self-review notes
- Spec coverage: ON/OFF (T3), News+remove popup (T4), inbox click-through (T5), targeted send saves to inbox only for ON users (T2+T6), remove blast (T7), reuse user_messages/announcements (T1/T4). Personal 1:1 messages always saved: unchanged (existing sendMessage still inserts + 899b29f push if ON). ✅
- Phase 2 (composer/product picker/order admin push) and Phase 3 (app split/forced login) intentionally excluded.
