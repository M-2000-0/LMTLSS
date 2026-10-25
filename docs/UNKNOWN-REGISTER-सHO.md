## 7.3 OpenFreeMap public instance — provider quiescence (spike: "can I rely on a free tile host, or does it disappear next quarter?")

Each value was read from an official OpenFreeMap page in **October 2026** and is cited inline. Treat the source as the truth for the provider's own words; where a fact is not stated on one of those pages, it is listed as *still open* rather than guessed.

| Item | Verified value (October 2026) | Source |
|---|---|---|
| Provider identity | Hyperknot Software Kft. (Zsolt Ero), donation-funded, single maintainer | [openfreemap.org](https://openfreemap.org/), [openfreemap.org/tos/](https://openfreemap.org/tos/) |
| Cost | **Free for all uses of the public instance, including commercial** — no API key, no registration | [openfreemap.org](https://openfreemap.org/), [openfreemap.org/tos/](https://openfreemap.org/tos/) |
| Offline use in a mobile app | **Allowed within bounds** — each offline download ≤ 3,000 tiles **or** 50 MB, ≤ 4 parallel requests, unique User-Agent; anything larger requires contacting `info@openfreemap.org` | [openfreemap.org/tos/](https://openfreemap.org/tos/), [openfreemap.org/](https://openfreemap.org/) |
| SLA / availability guarantees | **None provided** — the service is provided "as-is"; the maintainer explicitly states "I don't offer SLA guarantees" | [openfreemap.org/tos/](https://openfreemap.org/tos/), [openfreemap.org/](https://openfreemap.org/) |
| Termination / discontinuance | **May be discontinued at any time without notice** — a small infrastructure project run by one person | [openfreemap.org/tos/](https://openfreemap.org/tos/) |
| Sustainability model | The maintainer rents servers and aims to keep them running until bandwidth is covered, with an intent to introduce a Pro plan if there is enough interest; no subscription or support plan exists yet | [openfreemap.org](https://openfreemap.org/) |
| Governance | **One-person, no board or foundation behind it** — bus factor 1; there is no announced successor process | [openfreemap.org](https://openfreemap.org/), [openfreemap.org/tos/](https://openfreemap.org/tos/) |
| Self-hosting escape hatch | **Exists and is documented** — the full production setup is open-source (MIT) and can be run yourself or by a host | [openfreemap.org](https://openfreemap.org/) |
| MapTiler as hosted fallback | The OpenFreeMap page points at MapTiler Cloud for hosted map tiles, so a commercial tile provider is a recognized alternative, not something this project rules out | [openfreemap.org](https://openfreemap.org/) |
| Cache / IP / rate-limit details | **Not published** — no concrete successor rules, per-IP or per-session limits, or daily map-view counts are stated on the official pages | [openfreemap.org](https://openfreemap.org/), [openfreemap.org/tos/](https://openfreemap.org/tos/) |
| Offline MB measurement | **Not defined** — the provider states "50 MB" without saying how it is measured, so plan against both the tile count and the byte ceiling | [openfreemap.org/tos/](https://openfreemap.org/tos/) |

*Still open (not confirmable from the official pages as of October 2026):* concrete successor rules and any notice period for discontinuance; the exact daily map-view count served; whether there is a per-IP or per-session hidden rate limit in front of nginx; whether the maintainer's personal commitments or infrastructure choices make continuation more or less likely.

**Read:** OpenFreeMap is the cheapest and legally cleanest tile source for M2 — free, commercial use, no key, offline downloads allowed within bounds. But it is a quiet, single-maintainer project that may disappear without notice, so it is the right choice for **M2 development and pilot**, and the right *first* choice for nothing more. The production gate in §6 is not bureaucratic pedantry: it is the response to a tile source that the provider itself says can go away any time.

---

### 7.4 Compliance skeleton of the map adapter decision

The decision is not just a vendor pick — it makes a few explicit legal/technical guardrails that follow from what MapLibre, OpenFreeMap, Mapbox, MapTiler, Protomaps, the OSMF tiles policy, OSM copyright, and each vendor's pricing page actually say in October 2026. These are the rules that the adapter interface and the map screen implementation have to satisfy, not opinions about maps.

1. **Tiles must come from a source that the app's terms allow.** For M2 that is OpenFreeMap's public instance. The commercial-use and no-key facts are first-class, verified facts here, not a belief — they are the reason OpenFreeMap beats MapTiler's free tier (non-commercial only) and OSMF's tile policy (no production app endpoint).

2. **Attribution is non-negotiable and must be visible.** OSM data is ODbL with the attribution obligation, the OpenMapTiles schema is CC-BY, and the requested attribution string for OpenFreeMap is "OpenFreeMap © OpenMapTiles Data from OpenStreetMap". MapLibre's attribution control adds the required attribution automatically if it is visible; if the map screen ever makes that control invisible or unreadable, it is a live infringement risk, not a style issue — so the acceptance criteria gate on the attribution control being present and readable.

3. **No tile host may receive recorded route coordinates or user identity.** The route is a local GPX/GIS overlay drawn from points collected by the device; it is never sent to a tile server. Any analytics on the map screen is out of scope for this decision because it would change the privacy profile of the map surface in a way the docs do not currently account for.

4. **No provider secret in the bundle.** A key would live in the client by construction; that is one reason the chosen stack has none. MapTiler and Mapbox in particular require account keys for their hosted tiles, which is a secret-in-the-bundle problem if used directly from the client — another reason those are fallbacks behind a build-time config, not first-class choices.

5. **Offline must degrade without fabricating a map.** MapLibre has offline packs, OpenFreeMap permits bounded offline downloads, and Mapbox's offline story is provider-specific (Mapbox-hosted tilesets only). The map screen must render honestly when offline or when a pack is missing, and must never manufacture a basemap it does not have.

6. **The provider can be swapped without touching screens.** The adapter contract in §7 of the decision record exists so that moving from OpenFreeMap to MapTiler or self-hosted changes a style URL and an attribution string and possibly an offline-pack configuration — not any map-screen logic.

**Open question for the adapter author:** confirm on-device that MapLibre's attribution control actually renders the OSM/OpenMapTiles attribution visibly and with a live link to `openstreetmap.org/copyright`; this is the single most concrete compliance check in §8 and the one that cannot be verified from the documentation.
