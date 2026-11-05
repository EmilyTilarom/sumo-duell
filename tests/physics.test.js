import { describe, expect, it } from "vitest";
import { DRAG, bounce, integrate, separate } from "../src/game/physics.js";

function body(x, vx = 0) {
  return { x, y: 0, vx, vy: 0, radius: 40 };
}

describe("physics", () => {
  it("Reibung bremst einen Körper langsam ab", () => {
    const b = body(0, 3);
    integrate(b, 0, 0, DRAG);
    expect(b.vx).toBeCloseTo(3 * DRAG);
    for (let i = 0; i < 600; i += 1) integrate(b, 0, 0, DRAG);
    expect(b.vx).toBeLessThan(0.01);
    expect(b.x).toBeCloseTo((3 * DRAG) / (1 - DRAG), -1);
  });

  it("Kraft beschleunigt erst allmählich: Trägheit", () => {
    const b = body(0);
    integrate(b, 0.07, 0, DRAG);
    expect(b.vx).toBeLessThan(0.1);
  });

  it("Stoß erhält den Impuls", () => {
    const a = body(0, 4);
    const b = body(70);
    const before = 1 * a.vx + 2 * b.vx;
    bounce(a, b, 1, 2);
    expect(1 * a.vx + 2 * b.vx).toBeCloseTo(before);
  });

  it("der leichtere Körper bekommt mehr Tempo", () => {
    const light = body(70);
    bounce(body(0, 4), light, 1, 0.5);
    const heavy = body(70);
    bounce(body(0, 4), heavy, 1, 2);
    expect(light.vx).toBeGreaterThan(heavy.vx);
  });

  it("Körper, die sich entfernen, stoßen nicht", () => {
    const a = body(0, -1);
    const b = body(70, 1);
    expect(bounce(a, b, 1, 1)).toBe(0);
    expect(a.vx).toBe(-1);
  });

  it("trennt überlappende Körper, der leichtere weicht weiter", () => {
    const a = body(0);
    const b = body(60);
    separate(a, b, 3, 1);
    expect(b.x - a.x).toBeCloseTo(80);
    expect(b.x - 60).toBeGreaterThan(-a.x);
  });
});
