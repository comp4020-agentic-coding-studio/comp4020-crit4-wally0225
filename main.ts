import { SoundEngine, isNoteKey } from "./audio.ts";
import { Looper } from "./looper.ts";

const sound = new SoundEngine();
const looper = new Looper(sound.ctx, (key, when) => {
  if (isNoteKey(key)) sound.play(key, when);
}, render);

const recordBtn = document.querySelector<HTMLButtonElement>("#record-btn")!;
const clearBtn = document.querySelector<HTMLButtonElement>("#clear-btn")!;
const countdownEl = document.querySelector<HTMLElement>("#countdown")!;
const layersEl = document.querySelector<HTMLElement>("#layers")!;
const dots = [...layersEl.querySelectorAll<HTMLElement>(".dot")];
const keyEls = new Map(
  [...document.querySelectorAll<HTMLElement>(".key")].map((el) => [el.dataset.key ?? "", el]),
);

const LABELS: Record<string, string> = {
  idle: "Record",
  playing: "Overdub",
  armed: "Get ready…",
  recording: "Recording…",
  overdubbing: "Overdubbing…",
  maxed: "Max layers",
};

function flashKey(key: string): void {
  keyEls.get(key)?.classList.add("active");
}

function unflashKey(key: string): void {
  keyEls.get(key)?.classList.remove("active");
}

window.addEventListener("keydown", (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();

  if (isNoteKey(key)) {
    event.preventDefault();
    sound.resume();
    sound.play(key);
    looper.noteOn(key);
    flashKey(key);
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    sound.resume();
    looper.primaryAction();
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    looper.clear();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (isNoteKey(key)) unflashKey(key);
});

recordBtn.addEventListener("pointerdown", () => {
  sound.resume();
  looper.primaryAction();
});

clearBtn.addEventListener("pointerdown", () => {
  looper.clear();
});

function render(): void {
  recordBtn.dataset.phase = looper.phase;
  recordBtn.disabled = looper.phase !== "idle" && looper.phase !== "playing";
  recordBtn.textContent = LABELS[looper.phase];

  dots.forEach((dot, i) => dot.classList.toggle("filled", i < looper.layerCount));
  layersEl.classList.toggle("maxed", looper.phase === "maxed");
}

function tickCountdown(): void {
  const remaining = looper.countdown ?? looper.waitTime;
  countdownEl.hidden = remaining === null;
  if (remaining !== null) countdownEl.textContent = String(Math.ceil(remaining));
  requestAnimationFrame(tickCountdown);
}

render();
tickCountdown();
