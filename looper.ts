// A 5-second looper scheduled off the AudioContext clock, not setTimeout —
// timer drift would slowly desync overdubbed layers from each other.
export type Phase = "idle" | "recording" | "playing" | "armed" | "overdubbing" | "maxed";

export const LOOP_SECONDS = 5;
export const MAX_LAYERS = 5;

const LOOKAHEAD = 0.12;
const TICK_MS = 25;

interface RecordedEvent {
  key: string;
  offset: number; // seconds from the start of the loop cycle
}

export class Looper {
  phase: Phase = "idle";
  private layers: RecordedEvent[][] = [];
  private currentLayer: RecordedEvent[] = [];
  private loopStartTime = 0;
  private recordStartTime = 0;
  private armedBoundary = 0;
  private readonly scheduled = new Set<string>();
  private prunedThroughCycle = -1;

  constructor(
    private readonly ctx: AudioContext,
    private readonly onTrigger: (key: string, when: number) => void,
    private readonly onChange: () => void,
  ) {
    window.setInterval(() => this.tick(), TICK_MS);
  }

  get layerCount(): number {
    return this.layers.length;
  }

  /** Seconds left in the 5s window currently being captured, or null outside one. */
  get countdown(): number | null {
    if (this.phase !== "recording" && this.phase !== "overdubbing") return null;
    return Math.max(0, LOOP_SECONDS - (this.ctx.currentTime - this.recordStartTime));
  }

  /** Seconds until an armed overdub reaches the loop boundary and starts capturing. */
  get waitTime(): number | null {
    if (this.phase !== "armed") return null;
    return Math.max(0, this.armedBoundary - this.ctx.currentTime);
  }

  /** Record/Overdub control: starts the first take, or arms the next layer. */
  primaryAction(): void {
    if (this.phase === "idle") this.beginRecording();
    else if (this.phase === "playing") this.arm();
  }

  clear(): void {
    this.layers = [];
    this.currentLayer = [];
    this.scheduled.clear();
    this.setPhase("idle");
  }

  /** Called on every note keydown; only captured while a window is open. */
  noteOn(key: string): void {
    if (this.phase === "recording" || this.phase === "overdubbing") {
      this.currentLayer.push({ key, offset: this.ctx.currentTime - this.recordStartTime });
    }
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.onChange();
  }

  private beginRecording(): void {
    this.recordStartTime = this.ctx.currentTime;
    this.currentLayer = [];
    this.setPhase("recording");
  }

  private arm(): void {
    // Freeze the target boundary now: nextBoundary() always reports the
    // boundary strictly after "now", so recomputing it after crossing the
    // target would silently jump to the following one and the crossing
    // check below would never fire.
    this.armedBoundary = this.nextBoundary();
    this.setPhase("armed");
  }

  private nextBoundary(): number {
    const elapsed = this.ctx.currentTime - this.loopStartTime;
    const cyclesElapsed = Math.floor(elapsed / LOOP_SECONDS);
    return this.loopStartTime + (cyclesElapsed + 1) * LOOP_SECONDS;
  }

  private finishLayer(): void {
    this.layers.push(this.currentLayer);
    this.currentLayer = [];
    this.setPhase(this.layers.length >= MAX_LAYERS ? "maxed" : "playing");
  }

  private tick(): void {
    const now = this.ctx.currentTime;

    if (this.phase === "recording" && now - this.recordStartTime >= LOOP_SECONDS) {
      this.loopStartTime = this.recordStartTime; // the first take defines the loop grid
      this.finishLayer();
    }

    // Arming waits for the next loop boundary so the new layer lands in phase
    // with the ones already playing, instead of starting wherever the button
    // happened to be pressed.
    if (this.phase === "armed" && now >= this.armedBoundary) {
      this.recordStartTime = this.armedBoundary;
      this.currentLayer = [];
      this.setPhase("overdubbing");
    }

    if (this.phase === "overdubbing" && now - this.recordStartTime >= LOOP_SECONDS) {
      this.finishLayer();
    }

    if (this.layers.length > 0 && this.phase !== "recording" && this.phase !== "idle") {
      this.scheduleDue(now);
    }
  }

  private scheduleDue(now: number): void {
    const cycleIndex = Math.floor((now - this.loopStartTime) / LOOP_SECONDS);
    for (const cycle of [cycleIndex, cycleIndex + 1]) {
      const cycleStart = this.loopStartTime + cycle * LOOP_SECONDS;
      this.layers.forEach((layer, layerIdx) => {
        layer.forEach((event, eventIdx) => {
          const when = cycleStart + event.offset;
          if (when < now || when >= now + LOOKAHEAD) return;
          const id = `${cycle}:${layerIdx}:${eventIdx}`;
          if (this.scheduled.has(id)) return;
          this.scheduled.add(id);
          this.onTrigger(event.key, when);
        });
      });
    }
    if (cycleIndex > this.prunedThroughCycle) {
      this.prunedThroughCycle = cycleIndex;
      for (const id of this.scheduled) {
        if (Number(id.split(":")[0]) < cycleIndex - 1) this.scheduled.delete(id);
      }
    }
  }
}
