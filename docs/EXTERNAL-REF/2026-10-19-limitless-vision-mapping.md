# External vision reference: Limitless club doc → LMTLSS scope mapping

Source: pasted doc "LIMITLESS: EL CLUB PRIVADO DE ALTO RENDIMIENTO — Documento Ejecutivo de Presentación y Arquitectura de Ecosistema" (read during the 2026-10-19 turn).

Purpose: record what parts of that doc overlap the current LMTLSS plans and what parts do not, so the idea is preserved without silently expanding the current spec.

## Alignment summary

| Limitless module | LMTLSS alignment | Status vs current plan |
|---|---|---|
| One interface instead of many fragmented apps | Aligned in intent | Already a PRD thesis: one athlete identity, one place for training + progress + identity. Not new scope. |
| Data-driven calibration from personal context | Aligned in intent | PRD J2 (onboarding), J3 (choose/configure sports), MOBILE-SPEC profile model. |
| Sport-specific behavior, not generic templates | Aligned, with a different mechanism | PRD §6 Sport System Specification: no generic sport builder; each sport must be specified before UI ships. Limitless says "150+ sports" as a feature; LMTLSS says graduate sports one at a time after validation. |
| Manual + automatic logging | Aligned | PRD J4/J5/J6; MOBILE-SPEC session engine + GPS/background model. |
| Anomaly / sanity checking on bad progress entries | Aligned in spirit | PRD data-quality + provenance rules; Limitless frames it as a product voice ("common-sense filter"). Implementation shape in LMTLSS is validation + provenance, not a personality feature. |
| Fatigue / readiness question | Aligned partially | PRD/MOBILE-SPEC readiness context exists in the model; Limitless emphasizes a single daily readiness prompt. That is a UX choice, not yet a binding LMTLSS feature. |
| Friends ranking / local circle | Aligned as optional social | PRD pillars Club + Identity; J10; social is an amplifier, not the core loop. |
| Global outdoor competitive battles (run/hike/ride/ski/snow) | Partially aligned | PRD includes events/challenges, but keeps leaderboards configurable and sport-appropriate, seeded with real partners first. Limitless's weekly global outdoor battle is not yet a LMTLSS commitment. |
| Voluntary elite Top-1000 gate with a historical-effort threshold | Not aligned as written | PRD avoids one universal score and global elite gating by default; "no invented universal athletic scores" is explicit. A threshold-gated leaderboard would need a sport-specific spec and a strong justification. |
| Brand "private groups" with zero visual noise | Partially aligned | PRD allows brand/club spaces and sponsorship-flavored features, but commercial presence is not yet specified as "private brand groups." This is future scope, not MVP. |
| Daily streak + Sunday recap card like Spotify Wrapped | Aligned in part | PRD has activity cards + weekly recap ideas and shareable artifacts; Limitless's specific "streak + Sunday wrap" packaging is a product-design direction, not yet a committed LMTLSS feature. |
| Nutrition/supplement biochemistry guidance | Out of current scope | PRD §3.2 excludes nutrition/sleep/recovery from MVP; MOBILE-SPEC AI nutrition assistant is research/validated-data only and explicitly non-prescriptive. |
| Gym-photo AI mapping of equipment | Out of current scope for now | Not in MVP; would also need an AI task spec, safety review, and device/permissions story. |
| Heavy sponsorship as a core aesthetic rule | Not yet aligned | LMTLSS brand rules (AGENTS.md, tokens) emphasize restraint; sponsorship would need explicit design rules before it could enter the UI. |

## What from that doc is already covered by LMTLSS today

- Unified athlete context and onboarding that leads to a useful first action.
- Sport-aware training models, with strength and running as the implemented reference.
- Session capture with manual/GPS options and provenance.
- Shareable activity artifacts as a growth surface, with private-by-default behavior.
- Clubs/events/social as optional amplifiers layered on top of solo value.
- Deterministic metrics with AI used selectively, not as the primary interface.

## What from that doc is out of current LMTLSS scope

- Generic multiplatform "all sports everywhere" as a launch feature.
- Nutrition/supplement biochemistry coaching.
- Gym-photo AI equipment mapping.
- Global weekly outdoor competitive battles as a hardwired product feature.
- Universal elite gating / one global Top-1000 ladder.

## Recommended treatment

- Keep this doc as an external vision reference rather than merging it into PRD.md or MOBILE-SPEC.md.
- If any idea should enter LMTLSS, bring it in as its own requirement with the same bar as everything else: a spec, data model implications, acceptance criteria, and a scope decision about whether it strengthens one of the five pillars.

## Follow-up options

- Turn the single most promising idea (for example the Sunday recap card packaging, or private brand/club spaces) into a concrete product note with scope, privacy implications, and whether it belongs in core or community.
- Build the mapping into a feature triage list: keep / park / spec-first / reject.

## Notes

- This is an external reference file, not a commitment to build any of this.
- If a row should move into the active plan, the next step is a spec or product note, not another mapping table.
