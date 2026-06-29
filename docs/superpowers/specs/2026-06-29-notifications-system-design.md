# Notifications System Redesign — Design Spec (2026-06-29)

Owner request (lm3 follow-up). Confirmed: PWA Web Push works end-to-end (test
banner delivered). Now build a controlled, targeted notification system + app
separation. Big scope → split into **3 phases**, each its own spec→plan→build→deploy.

## Locked decisions (from owner Q&A)
- **Admin tooling placement = BOTH**: announcement push folds into the existing
  *Announcements* feature (no new button for it); the *diagnostics / other* tools
  move off the prominent dashboard into a new dashboard button.
- **Forced login = installed app only**: standalone (home-screen) PWA requires
  login to use; the normal web browser keeps the public catalogue (SEO preserved).
- **Auto-popup announcement modal = REMOVED**, replaced by push + a public News list.
- **Storage model = News (public) + personal push inbox (per-user, read/unread)**,
  separated. Broadcasts save + notify only when that user's push is ON.

## Reuse-first findings (avoid duplicate systems)
- A **personal inbox with read/unread already exists**: `user_messages`
  (`is_read`), surfaced at `/account/inbox` with an unread count in the Header
  (`/api/user/inbox-count`). → The "personal push mailbox" is this inbox; do NOT
  create a parallel table.
- A **News source already exists**: the `announcements` table (currently shown as
  the placement-driven `AnnouncementModal` popup). → Repurpose it as the public
  **News** list; remove the popup.
- Push subscriptions live in `push_subscriptions` (`client_code` = user id). Only
  an "enable" path exists today (`EnableAlertsButton`) — no explicit OFF.

---

## Phase 1 — Notification foundation + safety  (BUILD FIRST)

### 1.1 Personal push inbox = existing `user_messages` (extended)
Add optional columns (migration): `url text null`, `kind text null default 'message'`
(`message|announcement|product|system`), `product_id int null`.
- The inbox UI (`/account/inbox`) renders an item as a link when `url` is set
  (click → deep-link). Existing items (no url/kind) render unchanged.
- Unread/read continues to use `is_read` (already wired).

### 1.2 Send semantics (targeting + ON/OFF rule)
A shared server helper decides who gets what:
- **Direct personal message** (existing `sendMessage`, order messages): always
  insert the inbox row (so the customer always has the record); send a Web Push
  **only if** the user has push ON. (Push wiring already added in 899b29f.)
- **Broadcast announcement / product push**: for each **logged-in user with push
  ON** (an active `push_subscriptions` row), insert a `user_messages` row **and**
  send a Web Push. Users with push OFF get **neither** an inbox row nor a banner
  (owner rule: "only when ON does it save").
- No untargeted "blast to every subscription" remains in product code (see 1.5).

### 1.3 News (public) = repurposed `announcements`
- Remove `AnnouncementModal` from the locale layout (no more auto-popup).
- Add a public **`/news`** page (and a Header "News" link, localized) listing
  active `announcements` (title, body, image, date), viewable logged-out.
- Admin *Announcements* create/edit stays; on create, the admin chooses whether
  to also push it to logged-in ON users (Phase 1 wires the push; the composer
  options come in Phase 2). A pushed announcement also appears in each ON user's
  inbox (kind=`announcement`).

### 1.4 Account push ON/OFF
- `EnableAlertsButton` becomes a real toggle: ON = subscribe (existing); OFF =
  `pushManager.getSubscription().unsubscribe()` + delete the `push_subscriptions`
  row (new `/api/push/unsubscribe`). Reflect current state on load.
- "Saved only when ON" follows naturally: broadcasts key off an active subscription.

### 1.5 Safety — remove the untargeted blast
- The temporary `/api/push/test` ("send to ALL") + `PushDiagPanel` "Send test push
  to all" are **removed** from the dashboard, OR kept strictly as an admin-only
  "send test to MYSELF" (the logged-in admin's own subscription only). Decision:
  keep a **self-only** test; delete the all-subscribers blast.
- `/api/push/diag` (read-only) is retained but moved under the new dashboard button.

### 1.6 Non-goals for Phase 1
- The typed composer (product picker / message+link / third type), product-create
  "notify?" popup, order-received admin push + admin inbox → **Phase 2**.
- Separate admin PWA + forced login → **Phase 3**.

### 1.7 Verification (Phase 1)
- `tsc --noEmit` + `next build` pass.
- Migration SQL provided (run manually in Supabase per project workflow).
- Manual: announcement create with "push" → ON user gets banner + inbox row +
  News entry; OFF user gets News entry only (no banner/inbox). Popup no longer
  appears. Account toggle ON/OFF subscribes/unsubscribes (row added/removed).

---

## Phase 2 — Composer + triggers (summary; spec when reached)
- Admin notification composer with types: **(1) product** (product picker;
  subtype new / restock / benefit), **(2) custom message** (title + body + click
  link), **(3) proposed: general announcement** (title+body+image → News + push).
- **Product create flow**: on new-product save in `admin>products>new`, a popup
  "Notify users about this new product?" → sends a product push (deep-link to the
  product) using the Phase-1 broadcast helper.
- **Admin push inbox**: new `admin_notifications` table + an admin inbox; an
  **order received** event creates an admin notification (+ admin Web Push).

## Phase 3 — App separation + forced login (summary; spec when reached)
- Separate installable **admin PWA** at `/manzura` (own manifest/scope/start_url/
  icons) so it installs as a distinct home-screen app from the user app, iOS+Android.
- **Forced login in standalone**: when running as an installed app (display-mode
  standalone), gate usage behind login; browser stays public.

## Risks / contradictions resolved
- "new button" vs "merge into Announcements" → BOTH (announcement push in
  Announcements; diagnostics in a new button).
- "force login to use the app" → installed-app only (protects SEO/public catalogue).
- Broadcast volume: inserting one `user_messages` row per ON user is acceptable at
  current scale; revisit if subscriber count grows large.
