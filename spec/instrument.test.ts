import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// This week's spec (crit 04, "An instrument"): the checkable half of the
// contract. Expressiveness, approachability and feel are judged live at the
// crit — see PROCESS.md / the reflection for those. These tests hold the two
// lines a script can actually verify.
const distPath = resolve("dist/index.html");
const html = readFileSync(distPath, "utf8");
const doc = new JSDOM(html).window.document;

// The built JS bundle is what actually ships; grep it directly rather than
// re-deriving its filename from index.html.
const scriptSrcs = [...doc.querySelectorAll("script[src]")].map((el) =>
  el.getAttribute("src"),
);
const bundle = scriptSrcs
  .filter((src): src is string => !!src && !src.startsWith("http"))
  .map((src) => readFileSync(resolve("dist", src.replace(/^\.\//, "")), "utf8"))
  .join("\n");

describe("instrument: sound is made live, not played back", () => {
  it("ships no autoplaying prerecorded audio or video", () => {
    const prerecorded = [...doc.querySelectorAll("audio, video")].filter(
      (el) => el.hasAttribute("autoplay") || el.hasAttribute("src"),
    );
    expect(
      prerecorded,
      "an <audio>/<video> element with a src or autoplay suggests playback of a recording, not live synthesis",
    ).toHaveLength(0);
  });

  it("uses the Web Audio API to synthesise sound", () => {
    expect(
      bundle,
      "no reference to AudioContext in the shipped JS — the spec asks for sound made live in the page via Web Audio, not some other playback mechanism",
    ).toMatch(/AudioContext/);
  });
});

describe("instrument: playable with whatever is at hand", () => {
  it("listens for keyboard input", () => {
    expect(
      bundle,
      "no keydown/keyup listener in the shipped JS — the spec asks for keyboard to work as an input",
    ).toMatch(/key(down|up|press)/);
  });

  it("listens for pointer or touch input", () => {
    expect(
      bundle,
      "no pointer/mouse/touch listener in the shipped JS — the spec asks for mouse or touch to work as an input",
    ).toMatch(/pointer(down|up|move)|mouse(down|up)|touch(start|end)/);
  });
});
