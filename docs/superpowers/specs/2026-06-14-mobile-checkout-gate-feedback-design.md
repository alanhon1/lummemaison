# Mobile Checkout — Gate Buttons Give No Feedback (Design)

Date: 2026-06-14
Status: Approved (owner approved direction; phone stays required)

## Problem

Customers on mobile report that checkout "does nothing" — they tap the button
and there is no reaction. Reports include "requesting a phone number", "stuck at
checkout", "can't click place order".

This is **not** a floating-button overlap (already ruled out / hidden on
`/checkout` in fe0f9b7) and **not** a broken click handler. The buttons are
genuinely gated:

| Step | File | Gate | What blocks |
|------|------|------|-------------|
| 1. Shipping "Continue" | `components/checkout/ShippingForm.tsx:185` | native HTML5 `required` | empty required field (incl. `phone`) silently blocks `submit` |
| 2. Disclaimers "Continue" | `components/checkout/DisclaimerStep.tsx:131` | `disabled={!allChecked}` | "agree all" unchecked |
| 3. Payment "Place order" | `components/checkout/PaymentStep.tsx:407` | `disabled={!confirmEnabled}` where `confirmEnabled = !submitting && !!proofPath` | payment screenshot not uploaded |

**Why it's mobile-specific (a perception/feedback failure, not platform bug):**

- A `disabled` button fires no `onClick` on touch — zero feedback (no hover
  state exists on touch either). `disabled:opacity-60` looks nearly active on a
  phone screen.
- The "why" hint (`payment.proof.requireScreenshot`, `disclaimers.mustAccept`)
  sits far **above** the button on a long mobile page, so it is off-screen when
  the customer taps.
- Native `required` validation focuses the offending field, but on mobile the
  bubble/scroll is subtle, so "Continue" reads as "frozen". The `phone` field
  being `required` is exactly the "requesting a phone number" report.
- iPhone secondary trap: receipt photos are HEIC. If `heicToJpegBuffer`
  conversion fails (`app/[locale]/checkout/actions.ts:94`) the error renders in
  the proof section only, and the Place Order button stays disabled forever.

The unifying root cause: **gate buttons that look tappable but do nothing, with
the reason off-screen on mobile.**

## Approach

Chosen: **buttons are always visually enabled; validate on tap and show the
reason in-place.** Rejected "keep disabled + bigger hint" (button still inert on
tap) and "reproduce-first only" (the silent-gate anti-pattern is already proven
in code across all three buttons; we will still verify on a real phone after the
fix). Apply one consistent pattern to all three gates.

### Pattern: "always-clickable + reveal what's missing"

For each of the three gate buttons:

1. Remove the hard block (`disabled` attribute / reliance on native `required`).
   The button is always pressable.
2. On press, run a validation function. If everything passes, proceed as today.
3. If something is missing:
   - `preventDefault()` (do not submit / navigate).
   - Set an inline error message rendered **directly adjacent to the button**
     (always in view when the button is in view).
   - **Scroll the first offending field/section into view** and apply a brief
     highlight (e.g. ring/pulse) so the customer sees where to act.

This guarantees identical, visible feedback on every device.

### Per-step specifics

**1. ShippingForm (`ShippingForm.tsx`)**
- Keep `phone` (and the other fields) **required** — owner decision.
- Replace silent native blocking with explicit validation in `handleSubmit`:
  check `fullName, email, phone, country, street, city, postalCode`.
- On first missing field: show inline error near the Continue button, scroll to
  + highlight that field. (We may keep `required` on inputs as a fallback, but
  the explicit path is what guarantees mobile feedback. Decide during impl to
  avoid double messaging — prefer explicit-only.)
- Error copy: a generic "Please fill in the highlighted fields" plus, for phone
  specifically, "Please enter your phone number" so the ask is obvious.

**2. DisclaimerStep (`DisclaimerStep.tsx`)**
- Remove `disabled={!allChecked}` from the Continue button.
- On press without all checked: `preventDefault`, show inline error by the
  button, scroll to + highlight the "agree all" checkbox row.

**3. PaymentStep (`PaymentStep.tsx`)**
- Remove `disabled={!confirmEnabled}` (keep the `submitting` guard so it can't
  double-submit — disable only while a submit is in flight, which has its own
  spinner text, so that case has feedback).
- On press without `proofPath`: prevent submit, show inline error by the button,
  scroll to + highlight the payment-proof upload section.
- Surface upload failures more visibly: on HEIC/type/size errors keep the
  existing `uploadError` text, and (stretch) also reflect a short note near the
  button so a failed upload isn't only visible up-page.
- Note: the server (`createOrder`) already re-validates proof, disclaimers, and
  shipping completeness — so removing the client `disabled` does not weaken the
  guarantee; a bad submit is rejected server-side and returns via the existing
  `?error=` redirect.

### Highlight + scroll helper

A small shared client helper (e.g. `lib/checkout/focusField.ts` or inline util):
given a ref/element, `scrollIntoView({ behavior: 'smooth', block: 'center' })`
and toggle a highlight class for ~1.2s. Reused by all three steps to keep
behavior consistent. Respect `prefers-reduced-motion` (skip smooth scroll).

### i18n

Add keys under `checkout` in both `en` and `ru` message files:
- `checkout.errors.fillHighlighted`
- `checkout.errors.phoneRequired`
- `checkout.errors.mustAcceptAll`
- `checkout.errors.uploadProofFirst`

(Reuse existing `disclaimers.mustAccept` / `payment.proof.requireScreenshot`
copy where wording already fits, rather than duplicating.)

## Out of scope

- Phone made optional (owner chose to keep required).
- Server-side price re-validation (audit item D — deferred).
- Any floating-button work (already handled).

## Testing / verification

- `tsc` passes; `en`/`ru` keys aligned.
- Manual: on a real phone, walk shipping → disclaimers → payment with each gate
  unmet, confirm the button reacts (error + scroll + highlight) instead of doing
  nothing. Then complete a real flow.
- Use postal/ZIP `ALANTEST` to place a test order end-to-end without touching
  stock/email.
