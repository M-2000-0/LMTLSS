## 1. Decision

For M2 route rendering, use **MapLibre React Native `11.5.0`** with the **OpenFreeMap public tile instance**, behind a provider-swappable adapter in `app/src/map/`.

This is a *renderer + source* decision, not a vendor lock-in: the adapter contract in §7 exists so the tile source can move later without touching map screens.

## 2. Requirements this decision is measured against

| # | Requirement | Why it is binding |
|---|---|---|
| R1 | Route line from recorded GPS points, camera fit to bounds | The M2 vertical slice's core visual |
| R2 | No fabricated route when coordinates are absent | Product honesty invariant (share cards already follow it) |
| R3 | Offline or degraded-network behaviour for runs | A run may start or continue with weak signal |
| R4 | Attribution honest to OSM/ODbL and the tile source's actual terms | Legal and trust, not decoration |
| R5 | No provider secret in the client bundle | A mobile bundle is a shipped secret if it contains a tile key |
| R6 | Cost must not block M2 from starting | €0 tile cost keeps the milestone unblocked |
| R7 | production readiness is separate from M2 start | The app does not market a map as SLA-backed until it is one |

## 3. Provider / SDK comparison

Comparison axis: renderer SDK, tile source terms, offline story, attribution, cost, and whether the combination can actually ship.

### 3.1 MapLibre React Native + OpenFreeMap (chosen)

- Renderer: MapLibre React Native `11.5.0` — native map renderer, GL-style based, offline packs supported.
- Tile source (M2): OpenFreeMap public instance — no API key, commercial use allowed, offline downloads allowed within stated bounds.
- Cost: $0 for both renderer (OSS) and the M2 tile source.
- Offline: MapLibre offline packs + OpenFreeMap's permitted offline downloads (bounded — see §5).
- Attribution: the required attribution string is documented and the MapLibre attribution control can render it; acceptance criteria gate on it being visible and linked.
- Lock-in: low — provider is swappable through the adapter contract.

### 3.2 MapLibre + MapTiler Cloud (fallback)

- Renderer: same MapLibre.
- Tile source: MapTiler Cloud Flex — keyed, $30/mo, published quotas (500k requests + 25k sessions), overage per 1k.
- Good fallback if OpenFreeMap disappears or if commercial/SLA review demands a keyed provider; but not the M2 start because it adds a monthly cost and a key.

### 3.3 Mapbox Maps SDK (iOS/Android) (not chosen)

- Renderer + tiles are Mapbox's own SDK and hosted tilesets.
- Pricing is per monthly active user, first 25,000 MAU free — attractive at small scale, but:
  - it is a different SDK, different tile vocabulary, and a different offline model than MapLibre; choosing it now would be a bigger fork than a provider swap;
  - the contractual treatment of the SDK used purely as a renderer could not be confirmed from the publicly readable docs during this spike (the Product Terms PDF could not be read), so it is not chosen on a documentation-first basis;
  - Mapbox-hosted offline tilesets are provider-specific.

### 3.4 Raw OSMF tiles (`tile.openstreetmap.org`) (not chosen for a production app)

- No published numeric request limit and no SLA.
- Requires a stable `User-Agent`, tile caching ≥ 7 days, and forbids offline/bulk/prefetch.
- OSMF explicitly does not treat this as a production app endpoint.
- Not viable as the primary source for a shipped app; usable only as a short-lived dev convenience behind a provider that can be swapped away.

### 3.5 Self-hosted Protomaps / OpenMapTiles (fallback / independence path)

- Self-hosting the same tile stack the public OpenFreeMap instance is built from is MIT and documented.
- Real cost is not just the VM (Hetzner CX33 ≈ €8.49/mo, CPX32 ≈ €35.49/mo, instance price only) — it also includes dataset build, storage, backups, monitoring, and admin time.
- Valid independence move if a team/wallet wants to own the tile path; not the M2 start because it adds operational cost and work.

## 4. Why this pair, specifically

- M2 needs a route map that works offline-degraded and does not fabricate a path when there are no coordinates. MapLibre gives a renderer that supports offline packs and a GL-style tile pipeline; OpenFreeMap gives a $0, no-key, commercial-use-allowed source within documented bounds.
- The combination keeps M2 at $0 tile cost while the source holds, and it keeps the tile source behind an adapter so the production gate is a config + monitoring + fallback problem, not a rewrite.
- MapTiler Flex and self-hosting remain available as documented fallbacks; that is the point of the adapter contract.

## 5. Costs and risks of this choice

| Risk | Reality | Mitigation |
|---|---|---|
| **No SLA** | Public instance is as-is; can be discontinued without notice | Treat it as a pilot dependency. Keep the style URL + attribution in config, and prove the MapTiler Flex swap before any paid launch (§6). |
| **Bus factor 1** | One maintainer, donation-funded | Self-hosting is documented and MIT; keep a tested fallback style URL. |
| **Offline quota** | ≤ 3,000 tiles **or** 50 MB per download; ≤ 4 parallel; unique UA | Measure a real 10 km corridor pack during M2; if it exceeds 50 MB, request a larger arrangement (`info@openfreemap.org`) or switch to self-host for offline regions. |
| **Privacy** | Tile requests reveal IP and viewed area; no account or cookie | Never send recorded route coordinates to any tile host — the route is a local overlay. Offer offline packs for sensitive areas. Do not add analytics to the map screen. |
| **Expo Go incompatibility** | MapLibre is native; Expo Go cannot load it | M2 requires a **development build**. No EAS account is connected, so on-device M2 work is blocked until one is. |
| **Attribution errors** | ODbL requires visible, linked attribution | Acceptance test asserts the attribution control is present and readable at default zoom; link to `openstreetmap.org/copyright`. |
| **Terms drift** | Terms updated 2026-10-14 | Re-read `openfreemap.org/tos` at each milestone gate; record the date in this file. |

## 6. Production gate (must pass before public launch)

M2 can ship behind this adapter. Promoting to a public, paid launch requires **one** of:

1. **Stay on OpenFreeMap** with: a written tolerance for no-SLA risk, availability monitoring, a documented 1-line style-URL fallback to MapTiler Flex ($30/mo) or self-host, and a measured offline pack within the 50 MB/download limit; or
2. **Move to MapTiler Flex** (key + $30/mo + 25k sessions) if commercial volume or SLA review demands it; or
3. **Self-host OpenFreeMap** (operational cost + admin time) if independence outweighs $30/mo.

The adapter contract below exists so any of those is a config change.

## 7. Adapter contract (to implement in M2)

Planned seam: `app/src/map/` — screens never import the MapLibre package directly.

```ts
export interface MapProvider {
  readonly id: "openfreemap" | "maptiler" | "self-hosted";
  readonly styleUrl: string;
  readonly attribution: { text: string; url: string };
  readonly capabilities: {
    offlinePacks: boolean;
    maxOfflineTiles: number | null;
    maxOfflineBytes: number | null;
    requiresKey: boolean;
  };
}

export interface RouteMapProps {
  /** Empty/null must render the typographic fallback, never a guessed line. */
  route: { lat: number; lon: number }[] | null;
  onMapError?: (reason: "offline" | "tiles-unavailable" | "unknown") => void;
}
```

Rules:

- The map is **read-only** in M2 (no pan-to-edit, no route dragging).
- A null/empty route renders the existing typographic card, not an empty basemap.
- Map errors surface as an honest "map unavailable offline" state, never a spinner forever.
- No provider key may enter the bundle; providers requiring one are configured at build time only.

Install notes for M2: `npx expo install @maplibre/maplibre-react-native` plus the `@types/geojson` peer, then `npx expo prebuild` and a development build. The README's `--go` path cannot load it; plain `npm --prefix app start` already serves the dev client and becomes the only viable start command.

## 8. Acceptance criteria for M2 (device-tested, currently unverified)

| # | Check | Status |
|---|---|---|
| A1 | Route polyline matches recorded points; `fitBounds` frames it | **[D]** not run — no dev build |
| A2 | Session without coordinates shows no route (no fabricated path) | **[D]** |
| A3 | Attribution visible and linked to OSM copyright | **[D]** |
| A4 | Airplane-mode start: map degrades honestly; recorded run still saves | **[D]** |
| A5 | One 10 km corridor offline pack measured (tiles and MB, ≤ 3,000 / 50 MB) | **[D]** |
| A6 | Map cold start and memory on a mid-range Android device | **[D]** |
| A7 | Provider swap is config-only (style URL + attribution) | [U] until adapter exists |

## 9. What this spike did not verify

- No MapLibre build was created; **no map has been rendered on a device** (no EAS account, no Android SDK/JDK on this machine).
- MapLibre's minimum iOS version is not stated in its docs; Expo SDK 58 requires iOS 16.4.
- Mapbox's current Product Terms PDF (2026-07-21) could not be read, so the contractual treatment of a Mapbox SDK used only as a renderer is unconfirmed — one reason it is not chosen.
- MapTiler's native-SDK billing classification (sessions vs requests) is unconfirmed.
- OpenFreeMap does not define how "50 MB" is measured; plan against both ceilings.
- No availability or latency measurements were taken against the public instance.

## 10. Reversal triggers

Reopen this decision if any of these occurs:

1. OpenFreeMap changes terms, adds keys/limits, or is unavailable for more than a day during pilot.
2. Offline packs for a normal long run exceed the 50 MB/download allowance.
3. The product needs geocoding or turn-by-turn routing — a separate service and cost, not a renderer swap.
4. A MapLibre release breaks Expo SDK compatibility (New Architecture requirement is a moving target).
5. Legal or store review requires an SLA/indemnity that a donation-funded service cannot give.

## 11. Sink / source rules that follow from this decision

The decision is not just a vendor pick — it makes a few explicit legal/technical guardrails that follow from what MapLibre, OpenFreeMap, Mapbox, MapTiler, Protomaps, the OSMF tiles policy, OSM copyright, and each vendor's pricing page actually say in October 2026. These are the rules the adapter interface and the map screen must satisfy, not opinions about maps.

1. **Tiles must come from a source the app's terms allow.** For M2 that is the OpenFreeMap public instance. The commercial-use and no-key facts are first-class verified facts in this register, not a belief — they are the reason OpenFreeMap beats MapTiler's free tier (non-commercial only) and OSMF's tile policy (no production app endpoint).

2. **Attribution is non-negotiable and must be visible.** OSM data is ODbL with an attribution obligation, the OpenMapTiles schema is CC-BY, and the requested attribution string for OpenFreeMap is `OpenFreeMap © OpenMapTiles Data from OpenStreetMap`. MapLibre's attribution control adds the required attribution automatically if it remains visible; if a map screen ever makes that control invisible or unreadable, it is a live infringement risk, not a style issue — so the acceptance criteria gate on the attribution control being present and readable.

3. **No tile host may receive recorded route coordinates or user identity.** The route is a local GPX/overlay drawn from device-collected points and is never sent to a tile server. Any analytics on the map surface is out of scope here because it would change the privacy profile of the screen in a way the docs do not currently account for.

4. **No provider secret in the bundle.** A key would live in the client by construction. MapTiler and Mapbox in particular need account keys for their hosted tiles, which is a secret-in-the-bundle problem if used directly from the client — another reason those are fallbacks behind build-time config, not first-class choices.

5. **Offline must degrade without fabricating a map.** MapLibre has offline packs, OpenFreeMap permits bounded offline downloads, and Mapbox's offline story is provider-specific (Mapbox-hosted tilesets only). The map screen must render honestly when offline or when a pack is missing, and must never manufacture a basemap it does not have.

6. **The provider can be swapped without touching screens.** The adapter contract in §7 exists so that moving from OpenFreeMap to MapTiler or self-hosted changes a style URL and an attribution string and possibly an offline-pack config — not any map-screen logic.

7. **No bidirectionality beyond the read-only adapter.** The adapter contract reflects a read-only map (no pan-to-edit, no route dragging). Bidirectional editing support would expand this skeleton; do not add it under the MapLibre decision without a separate review.

**Still open:** none of these skeleton items is unverified *if OpenFreeMap is the provider*; the one concrete compliance check that cannot be verified from documentation is on-device attestation that MapLibre's attribution control renders the required OSM/OpenMapTiles attribution visibly with a live link to `openstreetmap.org/copyright` (already in [MAP-ADAPTER-DECISION §8 A3/A7](MAP-ADAPTER-DECISION.md)).
