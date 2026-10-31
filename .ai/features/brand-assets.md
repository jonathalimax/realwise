# Feature: Brand assets (logo "Sinal")

The mark is seven rounded bars (a sliced orb) that slide sideways, the top one green. No letters. Colors come from the Realwise design system: violet `#7c3aed` (`#a78bfa` on dark), green `#10b981` (`#34d399` on dark), page `#f5f6f9` / `#0b0f17`.

## Files (`apps/web/public`, mirrored in `apps/admin/public` where noted)

- `logo.png` / `logo.jpg` (also in `apps/admin/public`): violet square tile with the white mark. Used as `<img>` everywhere in the UI (CSS rounds the corners), as `apple-touch-icon`, and as the PNG favicon fallback.
- `favicon.svg` (also in admin): bolder 5-bar version for tab-size rendering; follows `prefers-color-scheme`.
- `pwa-192x192.png`, `pwa-512x512.png`: maskable tiles (mark inside the 80% safe zone). Manifest `theme_color`/`background_color` are `#7c3aed`.
- `email/logo.png`: 128px tile shown at 32px in the e-mail header (`LOGO_URL` in `notifications/email-layout.ts`). One image for both themes: the violet tile reads on the light and the dark card.
- `brand/`: transparent marks (`mark-light|dark|white.svg`, `.png`), squares with the background color for WhatsApp and Instagram profile pictures (`social-light|dark|violet.svg`, `.png`), and `bimi.svg` (SVG Tiny-PS for BIMI).
- `landing/og-image.jpg`: share image with the new tile (and the two tiles inside the phone screenshots).

## Sender name and photo in inboxes

- `senderWithName` in `notifications.service.ts` always sends as `Realwise <address>` (`EMAIL_FROM_NAME` overrides the name). Without a display name inboxes show the address ("contato") and a letter avatar.
- The sender photo is not set by the e-mail itself. It comes from BIMI (needs `p=quarantine|reject` DMARC and a VMC/CMC certificate) or, for Gmail, from the Google profile photo of the sending address. See the PR notes for the DNS record.
