# AI Assistant Mascot — Design Spec

**Date:** 2026-06-10
**Component:** `components/layout/ChatWidget.tsx`

## Context

The Lumée Maison site (lumeemaison.com) has a floating AI assistant chat widget at the
bottom-right. Today its launcher button is a generic gold `MessageCircle` icon, and the open
chat panel's header shows a tiny 8px pulsing gold dot next to the "Lumée Maison" label.

The owner has two custom assets — a cute round AI-robot mascot photo and a short clip of that
mascot waving its hand — and wants them used to make the assistant feel friendly and clearly
"AI". This is purely a visual/asset change; chat logic is untouched.

## Goal

1. **Launcher button (closed state):** show the mascot photo instead of the `MessageCircle` icon.
2. **Chat header:** replace the 8px gold dot with the waving-mascot video, looping silently in a
   small circle to the left of the "Lumée Maison" text.

## Assets

Source files currently in project root:
- `IMG_9437.PNG` (1 MB) — mascot photo (cream background, round mascot, decorative chat bubbles).
- `IMG_9441.MP4` (7.95 MB) — mascot waving hand.

Processing → output to `public/`:
- `public/ai-assistant.png` — mascot optimized to ~256×256 square.
- `public/ai-assistant-wave.mp4` — waving clip compressed to ~240×240 square, muted, web-optimized
  (`-movflags +faststart`), target well under 1 MB.
- `public/ai-assistant-wave.webm` — WebM sibling for smaller size / broad support.

ffmpeg is not installed; it will be installed during implementation (winget, falling back to the
npm `ffmpeg-static` binary for one-time use).

## Changes — `ChatWidget.tsx`

### Launcher button (lines 229–257)
- Background: `bg-gold` → `bg-cream` (mascot photo has a cream background; gold clashes).
- Closed state: replace `<MessageCircle size={22} />` (line 253) with the mascot image filling the
  56px circle (`next/image`, ~48px, `rounded-full`).
- Open state: keep the `X` icon; button background also `bg-cream` for consistency (X color set to
  `text-charcoal` so it stays visible on cream).
- Preserve existing `rounded-full`, `shadow-lg`, `hover:scale-110`, `transition-all` behavior.

### Header avatar (lines 126–130)
- Replace the `w-2 h-2 rounded-full bg-gold animate-pulse` dot (line 128) with a video avatar.
- Container: `w-9 h-9 rounded-full overflow-hidden` (36px) so the waving clip is visible.
- `<video autoPlay muted loop playsInline preload="metadata" poster="/ai-assistant.png">` with both
  `webm` and `mp4` sources; `object-cover` to fill the circle.
- "Lumée Maison" label unchanged, still to the right.

## Accessibility / performance
- Mascot image `alt="Lumée Maison AI assistant"`.
- Video `muted` + `playsInline` to guarantee mobile autoplay; `poster` = mascot photo to avoid flash.
- `preload="metadata"` keeps initial load light; video only matters once the panel is open.

## Verification
- `npm run dev` → bottom-right launcher shows the mascot.
- Click it → header shows the waving clip looping silently in a small circle.
- DevTools mobile viewport → confirm autoplay works on mobile widths.

## Out of scope
- No changes to chat logic, limits, localization, or login gating.
- No unrelated refactoring of `ChatWidget.tsx`.
