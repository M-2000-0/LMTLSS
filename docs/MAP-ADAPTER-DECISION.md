# Map adapter decision — MapLibre + OpenFreeMap (M2)

Status: **Accepted for M2 development; conditional for production**
Date: 2026-10-19 · Scope: route map rendering for GPS runs (milestone M2)
Closes: the vendor item in [BUILD-PLAN §7.2](BUILD-PLAN.md#72-mapbox-vs-osm-tile-pricing-spike-map-costs-needed-for-m2-route-rendering)

### 1. Decision

Adopt **`@maplibre/maplibre-react-native`** as the renderer and the **OpenFreeMap public
instance** as the tile/style source for M2 route maps, behind a provider-swappable adapter.

- **Renderer:** MapLibre React Native `11.5.0` (MIT, published 2026-10-04), New Architecture only.
  Registry peer ranges are `expo >=54.0.0`, `react-native >=0.80.0`, `react >=19.1.0` — this repo's
  app is Expo `~58.0.14` / RN `0.88.0` / React `19.3.0`, inside every range, plus `@types/geojson`
  `^7946.0.0` as a required peer.
- **Tiles/styles:** `https://tiles.openfreemap.org/styles/dark` as the first style, no API key.
- **Not** Mapbox SDK: no token in the repo, no per-MAU meter, no Mapbox-hosted-tiles-only offline rule.
- **Production is gated**, not granted: OpenFreeMap publishes **no SLA** and may discontinue the
  service at any time. M2 may ship behind this adapter; public production must first pass §3.

This closes the open vendor item in BUILD-PLAN §7.2. It does **not** install anything: the adapter is
M2 work and requires a development build.

##### 2. Requirements this decision is measured against

| # | Requirement | Why it is binding |
|---|---|---|
| R1 | Route line from recorded GPS points, camera fit to bounds | The M2 vertical slice's core visual |
| R2 | No fabricated route when coordinates are absent | Product honesty invariant (share cards already follow it) |
| R3 | Offline or degraded-network behaviour for runs | Athletes run where signal is poor; the app is local-first |
| R4 | No provider secret in the repo or client bundle | Repository security rule |
| R5 | Attribution is visible and legally sufficient (OSM ODbL) | Licence obligation, not decoration |
| R6 | Swap provider without touching screens | BUILD-PLAN §2: map SDK behind a licensed adapter |
| R7 | Predictable cost at pre-launch and early growth | Solo project; no surprise invoice |

#### 3. Capability matrix (verified October 2026)

Evidence key: **[V]** verified from a primary source in this spike · **[U]** unverified or docs do
not state it · **[D]** requires a physical-device run (cannot be claimed from documentation).

| Capability | **MapLibre + OpenFreeMap** (chosen) | Mapbox Maps SDK | MapTiler Cloud | Protomaps self-hosted |
|---|---|---|---|---|
| React Native integration | `@maplibre/maplibre-react-native` 11.5.0; peers `expo ≥54`, RN ≥0.80, React ≥19.1; New Architecture required; app is Expo 58.0.14 / RN 0.88.0 / React 19.3.0 [V] | Official RN SDK, native module [V] | Via MapLibre RN + MapTiler style/key [V] | Via MapLibre RN reading PMTiles [V] |
| Expo Go | **No** — needs a development build; Expo config plugin required on iOS [V] | No (native module) [U] | No (same renderer path) [U] | No (same renderer path) [U] |
| Android / iOS floor | Android API 23+ [V]; iOS floor not stated by MapLibre [U]; Expo SDK 58 requires iOS 16.4 [V] | Vendor SDK floors [U] | Inherits MapLibre RN floors | Inherits MapLibre RN floors |
| Renderer licence | **MIT** [V] | Proprietary SDK licence, token required [V] | Commercial terms [V] | MIT tooling; basemap is ODbL Produced Work [V] |
| Tile/data licence + attribution | OSM **ODbL**, OpenMapTiles schema **CC-BY**; requested text: **“OpenFreeMap © OpenMapTiles Data from OpenStreetMap”**; MapLibre attribution control adds it automatically [V] | Mapbox attribution + logo for Mapbox data; third-party-only data may omit text but keeps logo [V] | “MapTiler attribution required on screen”; logo mandatory on Free, not Flex [V] | Protomaps + OpenStreetMap attribution required [V] |
| API key / secret | **None** [V] | Required; each request needs an account key [V] | Required; requests without a key fail [V] | None for your own PMTiles file; hosted API requires one [V] |
| Cost at ≤ 25k MAU | **$0**, stated “no limits on the number of map views or requests” [V] | **$0 up to 25,000 MAU**, then **$4.00 / 1,000 MAU** (25k–125k) [V] | **Free is non-commercial only**; **Flex $30/mo** (25k sessions, 500k requests) [V] | Own storage/CDN; illustrative 625k-session/1 TB estimate **$11.45/mo Cloudflare**, **$119.56/mo AWS** (estimate, not a quote) [V] |
| Offline maps | `OfflineManager`/`OfflinePack`; caller sets tile cap. Provider allows **≤ 3,000 tiles or 50 MB per download, ≤ 4 parallel requests, unique User-Agent** [V] | SDK offline exists but **only Mapbox-hosted tilesets**; offline data may not be bundled or preloaded [V] | SDK can show local MBTiles; Cloud terms allow only temporary personal cache and prohibit bulk download [V] | PMTiles is a single file; regional extracts are practical, full planet ≈ **120 GB** [V] |
| SLA / availability | **None**: “I don’t offer SLA guarantees”; as-is; may discontinue any time without notice [V] | Commercial terms; SLA not verified in this spike [U] | Commercial plan; SLA not verified here [U] | Whatever you operate |
| Governance / bus factor | One maintainer (Zsolt Ero / Hyperknot Software Kft.), donation-funded; self-hosting documented (MIT) [V] | Vendor | Vendor | Open-source project + your ops |
| Privacy exposure | No cookies, no user database, **no API key** [V]; tile requests still reveal IP + viewed area; Cloudflare is used as CDN and its request processing is accepted in the ToS [V]; log retention is not stated in the ToS [U] | Account/MAU metering implies account-level telemetry [V for token requirement] | Key-bound usage metering [V] | Only your own infrastructure |
| Route overlay APIs | `GeoJSONSource` + line `Layer`; `Marker`; `Camera.fitBounds([west, south, east, north])` [V] | Native annotations + layers [V] | Same MapLibre renderer [V] | Same MapLibre renderer [V] |
| Fit for M2 | **Yes, dev + pilot** | Overkill for M2; token + licence complexity | Viable paid fallback | Best exit path for long-term independence |
| Fit for public production | **Conditional** — see §6 | Viable if budget justifies; vehicle-use clause needs legal check [V] | Viable fallback at $30/mo | Viable at infrastructure cost |

Sources for this table: [MapLibre RN getting started](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/),
[Expo setup](https://maplibre.org/maplibre-react-native/docs/setup/expo/),
[OfflineManager](https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/),
[Camera](https://maplibre.org/maplibre-react-native/docs/components/camera/),
[MapLibre v11.5.0 release](https://github.com/maplibre/maplibre-react-native/releases),
[OpenFreeMap](https://openfreemap.org/), [OpenFreeMap ToS](https://openfreemap.org/tos/),
[OpenFreeMap quick start](https://openfreemap.org/quick_start/),
[OSM copyright](https://www.openstreetmap.org/copyright),
[Mapbox pricing](https://www.mapbox.com/pricing),
[Mapbox offline concepts](https://docs.mapbox.com/android/maps/guides/offline/concepts/),
[Mapbox attribution](https://docs.mapbox.com/help/dive-deeper/attribution/),
[MapLibre RN on npm](https://www.npmjs.com/package/@maplibre/maplibre-react-native),
[MapTiler pricing](https://www.maptiler.com/cloud/pricing/),
[MapTiler Cloud terms](https://www.maptiler.com/terms/cloud/),
[Protomaps cost calculator](https://docs.protomaps.com/deploy/cost),
[Protomaps downloads](https://docs.protomaps.com/basemaps/downloads).

##### 4. Why this pair, specifically

1. **It is the only option that is $0 with written permission and no key.** MapTiler's free tier
   forbids commercial use; Stadia's free tier forbids it as well; OSMF's tile servers are not a
   production endpoint. OpenFreeMap states commercial use is allowed and requires no registration.
2. **No secret to leak.** A Mapbox or MapTiler key would live in the client bundle — public by
   construction. Removing that class of secret is worth more than the SLA it costs at this stage.
3. **The renderer is MIT and provider-agnostic.** MapLibre consumes any MapLibre GL style URL, so
   switching to MapTiler or to a self-hosted OpenFreeMap instance changes a style URL and an
   attribution string, not screen code. (Mapbox-style URLs are *not* portable this way — another
   reason the Mapbox SDK is not the base.)
4. **Offline is first-class.** `OfflineManager` supports packs with progress and pause/resume, and
   OpenFreeMap's terms explicitly permit bounded offline downloads — unlike Mapbox (Mapbox-hosted
   tilesets only) and MapTiler (bulk download prohibited).
5. **The costs are understood, not assumed.** Mapbox becomes $4/1,000 MAU after 25k; MapTiler is
   $30/mo commercial; self-hosting is infrastructure plus operations. None of those is cheaper than
   $0 while the public instance holds.

##### 5. Costs and risks of this choice

| Risk | Reality | Mitigation |
|---|---|---|
| **No SLA** | Public instance is as-is; can be discontinued without notice | Treat it as a pilot dependency. Keep the style URL + attribution in config, and prove the MapTiler Flex swap before any paid launch (§6). |
| **Bus factor 1** | One maintainer, donation-funded | Self-hosting is documented and MIT; keep a tested fallback style URL. |
| **Offline quota** | ≤ 3,000 tiles **or** 50 MB per download; ≤ 4 parallel; unique UA | Measure a real 10 km corridor pack during M2; if it exceeds 50 MB, request a larger arrangement (`info@openfreemap.org`) or switch to self-host for offline regions. |
| **Privacy** | Tile requests reveal IP and viewed area; no account or cookie | Never send recorded route coordinates to any tile host — the route is a local overlay. Offer offline packs for sensitive areas. Do not add analytics to the map screen. |
| **Expo Go incompatibility** | MapLibre is native; Expo Go cannot load it | M2 requires a **development build**. No EAS account is connected, so on-device M2 work is blocked until one is. |
| **Attribution errors** | ODbL requires visible, linked attribution | Acceptance test asserts the attribution control is present and readable at default zoom; link to `openstreetmap.org/copyright`. |
| **Terms drift** | Terms updated 2026-10-14 | Re-read `openfreemap.org/tos` at each milestone gate; record the date in this file. |

###### 6. Production gate (must pass before public launch)

M2 can ship behind this adapter. Promoting to a public, paid launch requires **one** of:

1. **Stay on OpenFreeMap** with: a written tolerance for no-SLA risk, availability monitoring, a
   documented 1-line style-URL fallback to MapTiler Flex ($30/mo) or self-host, and a measured
   offline pack within the 50 MB/download limit; or
2. **Move to MapTiler Flex** (key + $30/mo + 25k sessions) if commercial volume or SLA review
   demands it; or
3. **Self-host OpenFreeMap** (operational cost + admin time) if independence outweighs $30/mo.

The adapter contract below exists so any of those is a config change.

###### 7. Adapter contract (to implement in M2)

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

Install notes for M2: `npx expo install @maplibre/maplibre-react-native` plus the `@types/geojson`
peer, then `npx expo prebuild` and a development build. The README's `--go` path cannot load it; plain
`npm --prefix app start` already serves the dev client and becomes the only viable start command.

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

###### 9. What this spike did not verify

- No MapLibre build was created; **no map has been rendered on a device** (no EAS account, no
  Android SDK/JDK on this machine).
- MapLibre's minimum iOS version is not stated in its docs; Expo SDK 58 requires iOS 16.4.
- Mapbox's current Product Terms PDF (2026-07-21) could not be read, so the contractual treatment
  of a Mapbox SDK used only as a renderer is unconfirmed — one reason it is not chosen.
- MapTiler's native-SDK billing classification (sessions vs requests) is unconfirmed.
- OpenFreeMap does not define how "50 MB" is measured; plan against both ceilings.
- No availability or latency measurements were taken against the public instance.

### 10. Reversal triggers

Reopen this decision if any of these occurs:

1. OpenFreeMap changes terms, adds keys/limits, or is unavailable for more than a day during pilot.
2. Offline packs for a normal long run exceed the 50 MB/download allowance.
3. The product needs geocoding or turn-by-turn routing — a separate service and cost, not a
   renderer swap.
4. A MapLibre release breaks Expo SDK compatibility (New Architecture requirement is a moving
   target).
5. Legal or store review requires an SLA/indemnity that a donation-funded service cannot give.
