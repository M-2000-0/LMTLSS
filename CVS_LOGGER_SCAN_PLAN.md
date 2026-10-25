# CSV logger integrity — scan plan and behavioral pattern

## Goal

Treat every CSV export from the logger as a possible partial journal, not a guaranteed clean tree. Scan each export, report the anomalies we can detect, and when the raw binary leaves enough signal, rebuild the parent-child and sibling structure instead of silently reshaping the output.

## What “integrity” means here

- We do not claim a CSV is “good” just because it is non-empty or has the expected columns.
- We treat duplicates, orphans, broken parent pointers, missing root, and inconsistent depth as evidence worth reporting.
- When file-system metadata survives, we use it to verify or refute what the CSV implies.
- When only raw binary survives, we try to reconstruct structure from naming patterns, ordering, timestamps, and other residual signals — and we say explicitly when that reconstruction is a best-effort guess.

## Inputs we may have

- A CSV export from the logger.
- Optionally, the raw binary of the underlying journal or filesystem image.
- Optionally, metadata from the capture environment: approximate capture time, device/host identity, mount points, known naming conventions.

If we only have the CSV, our conclusions are limited to what the CSV can support. If we also have raw binary, we can do stronger verification and reconstruction.

## First-pass scan

For each CSV:

1. Read the header and confirm the column set we expect.
2. Count rows, count distinct keys/paths, count explicit parent references.
3. Classify every row into one of:
   - **rooted**: has a resolvable parent within the export,
   - **orphan**: parent reference is missing or does not resolve,
   - **duplicate key**: same identity appears more than once,
   - **self-referential or malformed**: parent points to itself or is unparseable,
   - **metadata-only**: row is a marker, summary, or non-entry record rather than a file/directory node.
4. Identify the apparent root(s). If there is no single root, say so explicitly.
5. Compute apparent depth per entry where parent links exist.
6. Flag any suspicious transitions:
   - a child whose depth is inconsistent with its parent,
   - a directory entry with children but no own record,
   - a file entry whose apparent path implies missing intermediates.

At this stage we produce an anomaly summary, not a cleaned tree.

## Raw-binary reconstruction pattern

When raw binary is available, do the following, in order:

1. Preserve the original bytes before any scan that mutates or indexes them.
2. Identify journal or filesystem structure: magic, record framing, offsets, key/name fields, parent pointers, timestamps, free-space markers, delete tombstones, and any version or seq fields.
3. Walk structure from any recoverable root or entry point. Prefer explicit structural pointers over naming heuristics.
4. For each entry, record:
   - identity/key,
   - parent reference,
   - name,
   - type if available,
   - timestamps if available,
   - delete/cancel markers if available,
   - raw offset and any surrounding record context.
5. Rebuild the tree:
   - attach children to resolved parents,
   - detect orphans and detach them into a separate “unresolved” bucket,
   - detect duplicates and preserve both occurrences with their contexts rather than collapsing silently.
6. Cross-check with CSV where both exist:
   - do CSV rows match the reconstructed records?
   - are there CSV rows with no binary counterpart, or binary records with no CSV representation?
   - do timestamps or ordering agree?
7. When naming is the only recoverable signal, use it as a fallback and label it as such. Do not present naming inference as confirmed structure.

## Heuristics when structure is degraded

Use these only when stronger signals are absent, and label them as heuristics:

- Common root name patterns or required prefix/suffix conventions.
- Lexical ordering that implies hierarchy in the source journal.
- Timestamp monotonicity to order sibling chunks or detect out-of-sequence writes.
- Repeated record sizes or framing alignment to recover record boundaries.
- Partial parent keys that can be matched by prefix or trailing segment.

Every reconstructed node should carry a confidence note:
- **confirmed**: resolved by explicit structural pointer or metadata,
- **inferred**: resolved by naming/ordering/timestamp heuristics,
- **unresolved**: parent or identity could not be determined.

## What we report

For each CSV or binary source, report:

- Source identity and capture context if known.
- Row/record counts.
- Root status: single root, multiple roots, or no recoverable root.
- Anomaly list:
  - duplicate identities and where they occur,
  - orphan count and examples,
  - self-references or malformed parent pointers,
  - depth inconsistencies,
  - any metadata/malformed/marker rows that should not be treated as tree nodes.
- Reconstruction status if raw binary was used:
  - what we recovered explicitly,
  - what we inferred,
  - what remained unresolved,
  - cross-check result against the CSV.
- Any evidence that the export is truncated, reordered, or partially written.

## What we do not do

- We do not silently drop duplicates or orphans to make the output look tidy.
- We do not claim a single clean hierarchy when the evidence supports multiple roots or unresolved branches.
- We do not treat a clean-looking CSV as proof that the underlying journal was clean.
- We do not guess timestamps or parent links beyond what the data supports.

## Output artifact

Produce:
- a scan summary,
- an anomaly table,
- a reconstructed tree only where confidence is high enough to be useful,
- a separate unresolved/inferred bucket with its own notes.

Keep the original CSV and any raw binary referenced by name so the result can be re-checked.
