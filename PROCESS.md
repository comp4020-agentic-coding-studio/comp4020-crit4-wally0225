# Process overview

## What I built

A Random Sound Looper: ten keys (Q–P) each trigger a distinct short percussive
sound synthesized live with the Web Audio API, and a single Record/Overdub
control layers up to five 5-second takes into a loop, so the instrument is
just you, the keyboard, and whatever rhythm falls out of pressing keys while
it plays back.

## The moments that mattered

**The armed overdub hung forever, and the test suite couldn't see it.**
`pnpm check` was green the whole time — it only inspects the built bundle for
API usage, not runtime timing — but driving the actual instrument in a
browser showed overdub #2 stuck on "Get ready…" indefinitely. The bug: the
loop scheduler recomputed "the next boundary after now" on every tick, and
that boundary silently jumps forward the instant `now` crosses it, so unless
a 25ms tick happened to land in the ~5ms window before the crossing, the
target leapfrogged a full cycle ahead before the check could fire. I fixed it
by freezing the target boundary once, at the moment of arming, instead of
re-evaluating it live
([`704163c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-wally0225/commit/704163c)).
Only a real end-to-end run through all five layers confirmed it — a passing
`pnpm check` alone would have shipped the hang.

**Keyboard-only vs. the repo's own pointer check.** I wanted every
interaction reachable from the keyboard (Space to record/overdub, Delete to
clear), but the starter's own `spec/instrument.test.ts` requires a real
pointer/touch listener. Rather than dropping the on-screen buttons to chase a
"keyboard-only" feel, I kept Record/Clear as genuine `pointerdown` controls
and layered the keyboard shortcuts on top, so both are first-class
([`704163c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-wally0225/commit/704163c)).
