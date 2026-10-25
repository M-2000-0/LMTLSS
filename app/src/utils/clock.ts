// Small time helpers for the run/tracking screen.
//
// We deliberately keep this tiny and focused:
//  - elapsedMsBetween(a, b) is a pure utility,
//  - formatElapsed(ms) is the display helper,
//  - stoppedClock semantics are documented in the buffer/screen,
//    not hidden inside a generic clock abstraction.
//
// The important invariant for this skeleton:
//  - while paused, elapsed running time should not advance,
//  - the buffer/screen is the place that decides what counts as
//    “running time” vs “paused wall-clock time.”

/** Format milliseconds into HH:MM:SS or MM:SS as appropriate. */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** True when a time value is worth showing as more than zero. */
export function isMeaningfulDuration(ms: number): boolean {
  return Number.isFinite(ms) && ms >= 1000;
}
