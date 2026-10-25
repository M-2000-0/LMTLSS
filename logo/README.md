# LMTLSS Logo — master + derivatives

## Master

- `logo/lmtlss-logo.svg` — vector master (transparent background).
  - Rounded green pill, brand accent green gradient (`#7CFF3E → #00E000 → #00A800`), glossy top highlight + specular glints, black `LMTLSS` wordmark, wide tracked sans-serif.
  - viewBox `0 0 1000 1000`; nothing painted behind the pill (true transparency).

## Derivatives

| File | Type | Purpose | Size |
|------|------|---------|------|
| `logo/lmtlss-sharecard-embed.svg` | SVG | Inline embed in web share cards (`sharecards.js` / UI header) | 84×84 (render), viewBox 120×120 |
| `logo/lmtlss-sharecard-embed.png` | PNG | Fallback / static card render for the same embed slot | 120×120 |
| `logo/lmtlss-icon-1024.png` | PNG | App icon source (iOS/Android/expo icon) | 1024×1024 |
| `logo/lmtlss-favicon-48.png` | PNG | Browser favicon | 48×48 |
| `logo/lmtlss-android-foreground-1080.png` | PNG | Android adaptive-icon foreground | 1080×1080 |

All PNGs are RGBA (transparent background), generated from the same master SVG via `logo/gen-assets.js` (Sharp).

## Where they go

- `app/assets/icon.png` ← `lmtlss-icon-1024.png` (Expo app icon)
- `app/assets/favicon.png` ← `lmtlss-favicon-48.png` (web favicon)
- `app/assets/logo.png` ← `lmtlss-sharecard-embed.png` (web screens: Home/Progress/Profile headers via `UI.logo(40)`)
- `app/assets/android-icon-foreground.png` ← `lmtlss-android-foreground-1080.png` (Android adaptive-icon foreground)

The old `logo/image-removebg-preview.png` was the previous emblem PNG used as a stopgap for the same slots; this set replaces it with assets derived from the same vector master.

## Regenerate

From repo root:

```
node logo/gen-assets.js
```

Requires `npm install sharp` (already present in this workspace's root `node_modules`).
