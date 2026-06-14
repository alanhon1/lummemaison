# Mobile Checkout Gate-Button Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three checkout gate buttons (Shipping "Continue", Disclaimers "Continue", Payment "Place order") always pressable and, when a requirement is unmet, show a visible inline error and scroll/highlight the missing field — so mobile customers never tap a button that silently does nothing.

**Architecture:** One shared client helper (`highlightField`) scrolls an element into view and flashes it. Each of the three step components drops its hard block (`disabled` / native `required`), validates on press, and on failure calls `highlightField` + sets an inline error rendered next to the button. The server (`createOrder`) already re-validates everything, so removing the client blocks does not weaken correctness.

**Tech Stack:** Next.js 16 (App Router) client components, React 19, next-intl, Tailwind v4, Zustand. No unit-test runner in this repo — verification is `npx tsc --noEmit`, `npm run lint`, and manual phone testing via the `ALANTEST` postal-code bypass.

**Spec:** `docs/superpowers/specs/2026-06-14-mobile-checkout-gate-feedback-design.md`

---

## File Structure

- **Create** `lib/checkout/highlightField.ts` — shared scroll-into-view + flash helper.
- **Modify** `app/globals.css` — add `.checkout-highlight` flash animation (with reduced-motion fallback).
- **Modify** `messages/en.json` + `messages/ru.json` — add `checkout.errors.fillHighlighted` and `checkout.errors.phoneRequired`. (Disclaimers and Payment reuse existing keys `checkout.disclaimers.mustAccept` and `checkout.payment.proof.requireScreenshot`.)
- **Modify** `components/checkout/ShippingForm.tsx` — explicit required-field validation + inline error + highlight.
- **Modify** `components/checkout/DisclaimerStep.tsx` — remove `disabled`, validate on press, highlight checkbox row.
- **Modify** `components/checkout/PaymentStep.tsx` — remove `disabled={!confirmEnabled}`, intercept submit via `onSubmit`, highlight proof section.

---

## Task 1: Shared highlight helper + CSS

**Files:**
- Create: `lib/checkout/highlightField.ts`
- Modify: `app/globals.css` (append at end of file, after line 727)

- [ ] **Step 1: Create the helper**

Create `lib/checkout/highlightField.ts`:

```ts
'use client';

/**
 * Scrolls an element into view and briefly flashes it, so a customer always
 * sees *where* an unmet checkout requirement is. Critical on mobile, where the
 * blocking field/section is usually off-screen when they tap the CTA.
 *
 * Pass `focus: true` for form inputs so the on-screen keyboard opens on the
 * field that needs attention. Harmless for non-focusable containers.
 */
export function highlightField(
  el: HTMLElement | null,
  opts: { focus?: boolean } = {},
) {
  if (!el) return;
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });

  // Restart the animation if it's already on the element.
  el.classList.remove('checkout-highlight');
  void el.offsetWidth; // force reflow
  el.classList.add('checkout-highlight');
  window.setTimeout(() => el.classList.remove('checkout-highlight'), 1300);

  if (opts.focus && typeof el.focus === 'function') {
    el.focus({ preventScroll: true });
  }
}
```

- [ ] **Step 2: Add the flash animation to globals.css**

Append to the end of `app/globals.css`:

```css
/* Checkout: flash a field/section the customer must act on. Provides the
   mobile feedback that a gated CTA otherwise lacks (see ShippingForm /
   DisclaimerStep / PaymentStep + lib/checkout/highlightField.ts). */
@keyframes checkout-flash {
  0%   { box-shadow: 0 0 0 0 rgba(160, 130, 80, 0); }
  20%  { box-shadow: 0 0 0 3px rgba(160, 130, 80, 0.55); }
  100% { box-shadow: 0 0 0 0 rgba(160, 130, 80, 0); }
}
.checkout-highlight {
  animation: checkout-flash 1.3s ease-out;
  border-radius: 0.5rem;
}
@media (prefers-reduced-motion: reduce) {
  .checkout-highlight {
    animation: none;
    outline: 2px solid var(--accent-dark);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/checkout/highlightField.ts app/globals.css
git commit -m "feat(checkout): add highlightField helper + flash animation"
```

---

## Task 2: i18n error keys

**Files:**
- Modify: `messages/en.json` (insert after the `fields` block closes, line 188)
- Modify: `messages/ru.json` (same location, line 188)

- [ ] **Step 1: Add `errors` to en.json**

In `messages/en.json`, the `checkout` object currently has (around line 188):

```json
      "discountCode": "Discount code (optional)",
      "discountCodeHint": "If you have a code, enter it here. We will verify and apply any adjustment manually before shipping."
    },
    "emptyCart": {
```

Insert a new `"errors"` block between the `fields` close (`},`) and `"emptyCart"`:

```json
      "discountCode": "Discount code (optional)",
      "discountCodeHint": "If you have a code, enter it here. We will verify and apply any adjustment manually before shipping."
    },
    "errors": {
      "fillHighlighted": "Please fill in the highlighted field.",
      "phoneRequired": "Please enter your phone number."
    },
    "emptyCart": {
```

- [ ] **Step 2: Add `errors` to ru.json**

In `messages/ru.json`, at the matching location (after the `fields` block closes, before `emptyCart`), insert:

```json
    "errors": {
      "fillHighlighted": "Пожалуйста, заполните выделенное поле.",
      "phoneRequired": "Пожалуйста, введите номер телефона."
    },
```

(Make sure the preceding `fields` block still ends with `},` and the JSON stays valid.)

- [ ] **Step 3: Validate both JSON files parse**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ru.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/ru.json
git commit -m "i18n(checkout): add shipping validation error strings (en/ru)"
```

---

## Task 3: ShippingForm — explicit validation + feedback

**Files:**
- Modify: `components/checkout/ShippingForm.tsx`

The current form relies on native `required` (silently blocks on mobile). Replace with explicit validation that shows an inline error and highlights the first empty field. Keep all fields required by business rule (incl. phone) — we just validate them ourselves.

- [ ] **Step 1: Import the helper and add error state**

At the top of `components/checkout/ShippingForm.tsx`, add the import (after the existing `localePath` import on line 9):

```ts
import { highlightField } from '@/lib/checkout/highlightField';
```

Inside the component, after `const [hydrated, setHydrated] = useState(false);` (line 44), add:

```ts
  const [error, setError] = useState('');
```

- [ ] **Step 2: Replace `handleSubmit` with explicit validation**

Replace the existing `handleSubmit` (lines 58-62):

```ts
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    writeDraft({ shipping: form });
    router.push(localePath(locale, '/checkout/disclaimers'));
  }
```

with:

```ts
  // Required fields, in visual order. We validate explicitly (instead of native
  // `required`) so the customer gets a visible error + scroll-to-field on
  // mobile, where the native validation bubble is easy to miss.
  const REQUIRED: Array<{ key: keyof ShippingSnapshot; id: string }> = [
    { key: 'fullName', id: 'ship-fullName' },
    { key: 'email', id: 'ship-email' },
    { key: 'phone', id: 'ship-phone' },
    { key: 'country', id: 'ship-country' },
    { key: 'street', id: 'ship-street' },
    { key: 'city', id: 'ship-city' },
    { key: 'postalCode', id: 'ship-postalCode' },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing = REQUIRED.find(f => !String(form[f.key] ?? '').trim());
    if (missing) {
      setError(missing.key === 'phone' ? t('errors.phoneRequired') : t('errors.fillHighlighted'));
      highlightField(document.getElementById(missing.id), { focus: true });
      return;
    }
    setError('');
    writeDraft({ shipping: form });
    router.push(localePath(locale, '/checkout/disclaimers'));
  }
```

- [ ] **Step 3: Remove native `required` and add `id`s to the fields**

In the JSX, remove the `required` attribute from each input/select and add the matching `id`. Apply these exact edits:

- Full name input (line ~71-78): remove `required`, add `id="ship-fullName"`.
- Email input (line ~83-90): remove `required`, add `id="ship-email"`.
- Phone input (line ~93-101): remove `required`, add `id="ship-phone"`.
- Country select (line ~106): change `<CountrySelect value={form.country} onChange={code => set('country', code)} required />` to `<CountrySelect id="ship-country" value={form.country} onChange={code => set('country', code)} />`.
- Street input (line ~110-117): remove `required`, add `id="ship-street"`.
- City input (line ~122-129): remove `required`, add `id="ship-city"`.
- Postal code input (line ~141-148): remove `required`, add `id="ship-postalCode"`.

Leave the `*` asterisks in the `<Field>` labels (they still signal "required" to the user).

Example — the phone field becomes:

```tsx
        <Field label={t('fields.phone')} required>
          <input
            id="ship-phone"
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            className={inputClass}
          />
        </Field>
```

(`CountrySelect` already accepts an `id` prop — `components/account/CountrySelect.tsx:13`.)

- [ ] **Step 4: Render the inline error next to the Continue button**

Replace the submit button (lines 185-187):

```tsx
      <button type="submit" className="btn-gold w-full">
        {t('shipping.continue')}
      </button>
```

with:

```tsx
      {error && (
        <p className="text-sm text-red-600 -mb-2" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-gold w-full">
        {t('shipping.continue')}
      </button>
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/checkout/ShippingForm.tsx
git commit -m "fix(checkout): shipping Continue shows error + scrolls to empty field (mobile)"
```

---

## Task 4: DisclaimerStep — remove disabled, feedback on press

**Files:**
- Modify: `components/checkout/DisclaimerStep.tsx`

- [ ] **Step 1: Import helper, add error state + checkbox ref**

Change the React import on line 3 from:

```ts
import { useEffect, useState } from 'react';
```

to add `useRef` (one import line, so ESLint's no-duplicates rule stays happy):

```ts
import { useEffect, useRef, useState } from 'react';
```

Then add the helper import after line 7 (`import { localePath } ...`):

```ts
import { highlightField } from '@/lib/checkout/highlightField';
```

Inside the component, after `const [hydrated, setHydrated] = useState(false);` (line 33), add:

```ts
  const [error, setError] = useState('');
  const checkboxRef = useRef<HTMLLabelElement | null>(null);
```

- [ ] **Step 2: Update `handleSubmit` to give feedback**

Replace the existing `handleSubmit` (lines 55-69):

```ts
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allChecked) return;
    writeDraft({
```

with (only the top of the function changes — keep the rest of the body):

```ts
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allChecked) {
      setError(t('disclaimers.mustAccept'));
      highlightField(checkboxRef.current);
      return;
    }
    setError('');
    writeDraft({
```

- [ ] **Step 3: Attach the ref to the "agree all" label**

On the `<label>` at line 101, add the ref:

```tsx
      <label
        ref={checkboxRef}
        className="flex items-start gap-3 bg-white border border-bone rounded-lg p-5 cursor-pointer select-none [touch-action:manipulation]"
      >
```

- [ ] **Step 4: Remove `disabled` from the Continue button and show the error**

The current footer (lines 120-134) shows the `mustAccept` hint only when `!allChecked` and disables the button. Replace it with an always-enabled button plus the click-triggered error:

```tsx
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-end">
        {error && (
          <p className="text-xs text-red-600 sm:mr-auto" role="alert">{error}</p>
        )}
        <button
          type="button"
          onClick={() => router.push(localePath(locale, '/checkout/shipping'))}
          className="text-xs font-semibold tracking-widest uppercase px-6 py-3 rounded-md border border-charcoal/30 text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors [touch-action:manipulation]"
        >
          {t('back')}
        </button>
        <button type="submit" className="btn-gold">
          {t('disclaimers.continue')}
        </button>
      </div>
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/checkout/DisclaimerStep.tsx
git commit -m "fix(checkout): disclaimers Continue always pressable, flags unchecked box (mobile)"
```

---

## Task 5: PaymentStep — remove disabled, intercept submit

**Files:**
- Modify: `components/checkout/PaymentStep.tsx`

The "Place order" button is `disabled` until a proof uploads. Make it always pressable; intercept the form submit and, if no proof, prevent it, show an error, and highlight the proof section.

- [ ] **Step 1: Import helper, add submit-error state + proof ref**

Add the import after line 11 (`import CopyButton ...`):

```ts
import { highlightField } from '@/lib/checkout/highlightField';
```

Inside the component, after `const fileInputRef = useRef<HTMLInputElement | null>(null);` (line 64), add:

```ts
  const proofSectionRef = useRef<HTMLElement | null>(null);
  const [submitError, setSubmitError] = useState('');
```

- [ ] **Step 2: Attach the ref to the payment-proof `<article>`**

The proof section opens at line 306:

```tsx
      <article className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <header className="flex items-center gap-2 mb-2">
          <FileCheck2 size={20} className="text-gold-dark" aria-hidden />
```

Add the ref:

```tsx
      <article ref={proofSectionRef} className="bg-white border border-bone rounded-lg p-5 md:p-6">
```

- [ ] **Step 3: Intercept submit and drop the hard disable**

Replace the final `<form>` block (lines 391-410):

```tsx
      <form
        action={async fd => {
          setSubmitting(true);
          await placeOrderAction(fd);
        }}
        className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="payload" value={payload} />
        <button
          type="button"
          onClick={() => router.push(localePath(locale, '/checkout/disclaimers'))}
          className="text-xs font-semibold tracking-widest uppercase px-6 py-3 rounded-md border border-charcoal/30 text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors"
        >
          {t('back')}
        </button>
        <button type="submit" disabled={!confirmEnabled} className="btn-gold disabled:opacity-60">
          {submitting ? t('payment.submitting') : t('payment.confirm')}
        </button>
      </form>
```

with:

```tsx
      {submitError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3" role="alert">
          {submitError}
        </p>
      )}

      <form
        onSubmit={e => {
          // Always pressable: if the screenshot is missing, stop the submit and
          // point the customer at the upload box instead of doing nothing.
          if (!proofPath) {
            e.preventDefault();
            setSubmitError(t('payment.proof.requireScreenshot'));
            highlightField(proofSectionRef.current);
          }
        }}
        action={async fd => {
          setSubmitting(true);
          await placeOrderAction(fd);
        }}
        className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="payload" value={payload} />
        <button
          type="button"
          onClick={() => router.push(localePath(locale, '/checkout/disclaimers'))}
          className="text-xs font-semibold tracking-widest uppercase px-6 py-3 rounded-md border border-charcoal/30 text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors"
        >
          {t('back')}
        </button>
        <button type="submit" disabled={submitting} className="btn-gold disabled:opacity-60">
          {submitting ? t('payment.submitting') : t('payment.confirm')}
        </button>
      </form>
```

Note: when `onSubmit` calls `preventDefault()`, React does not run the form `action`, so a missing proof is blocked client-side; with a proof present, the action runs as before. The button is disabled only while `submitting` (which shows the "Confirming…" label, so that state has feedback).

- [ ] **Step 4: Clear the submit error once a proof is attached**

`confirmEnabled` (line 130) is now unused — remove the line:

```ts
  const confirmEnabled = !submitting && !!proofPath;
```

In `handleFile`, after a successful upload sets the proof path (after `setProofFileName(file.name);`, line 152), clear any stale submit error:

```ts
      setProofPath(res.path);
      setProofFileName(file.name);
      setSubmitError('');
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors (and no "confirmEnabled is declared but never read").

- [ ] **Step 6: Commit**

```bash
git add components/checkout/PaymentStep.tsx
git commit -m "fix(checkout): Place order always pressable, flags missing screenshot (mobile)"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 2: Manual desktop smoke (dev server)**

Run: `npm run dev`, open `/checkout`, and confirm the happy path still works end-to-end (each Continue/Place order proceeds when requirements are met).

- [ ] **Step 3: Manual mobile verification (real phone or device emulation)**

For each gate, with the requirement UNMET, tap the button and confirm it now reacts (inline red error + smooth scroll + gold flash) instead of doing nothing:
- Shipping: clear the phone field → tap "Continue" → expect "Please enter your phone number" + scroll/flash on the phone field (keyboard opens).
- Shipping: clear another required field (e.g. city) → expect "Please fill in the highlighted field." + flash on that field.
- Disclaimers: leave the box unchecked → tap "Continue" → expect the mustAccept message + flash on the checkbox row.
- Payment: don't upload a screenshot → tap "Place order" → expect the requireScreenshot message + scroll/flash on the upload section.

- [ ] **Step 4: Manual full order via test bypass**

Complete a real run with all requirements met, using postal/ZIP code `ALANTEST` so it creates a hidden TEST order (no stock/email/analytics impact). Confirm it reaches the confirmation page.

- [ ] **Step 5 (optional): Verify iPhone HEIC upload**

On an iPhone, upload an actual photo (HEIC) as the payment proof and confirm it uploads (server converts HEIC→JPG) and the "Place order" button then submits. If it fails, the existing `uploadError` text should explain why — this is the secondary trap noted in the spec.

---

## Self-Review Notes

- **Spec coverage:** pattern (always-clickable + reveal) applied to all 3 gates ✓; phone kept required ✓; shared scroll/highlight helper with reduced-motion ✓; i18n en/ru ✓; relies on existing server re-validation ✓. iPhone HEIC is verification-only (Task 6 Step 5), matching the spec's "stretch/secondary" framing.
- **Reused keys:** disclaimers → `checkout.disclaimers.mustAccept`; payment → `checkout.payment.proof.requireScreenshot` (both already exist in en/ru), so only two new keys added — avoids duplicate copy per the spec.
- **Type consistency:** helper name `highlightField` used identically in Tasks 3/4/5; `proofSectionRef`/`checkboxRef`/`submitError`/`error` names consistent within each file; `confirmEnabled` removed in Task 5 to avoid an unused-var lint error.
