import { describe, expect, it } from "vitest";
import { COUNTDOWN_STEPS, RING_RADIUS } from "../src/game/rules.js";
import { createWorld, stepWorld } from "../src/game/world.js";

describe("world", () => {
  it("startet mit Countdown, zwei Ringern und vollem Ring", () => {
    const world = createWorld();
    expect(world.phase).toBe("countdown");
    expect(world.fighters).toHaveLength(2);
    expect(world.ring.radius).toBe(RING_RADIUS);
    expect(world.fighters[0].x).toBeLessThan(0);
    expect(world.fighters[1].x).toBeGreaterThan(0);
  });

  it("ignoriert Eingaben im Countdown und beginnt danach den Kampf", () => {
    const world = createWorld();
    const start = world.fighters[0].x;
    for (let i = 0; i < COUNTDOWN_STEPS - 1; i += 1) stepWorld(world, [{ x: 1, y: 0 }, undefined]);
    expect(world.fighters[0].x).toBe(start);
    stepWorld(world);
    expect(world.phase).toBe("fight");
  });

  it("nimmt die Masse jedes Ringers aus den Optionen", () => {
    const world = createWorld({ masses: [1, 1.2] });
    expect(world.fighters[1].mass).toBe(1.2);
    expect(world.fighters[1].radius).toBeGreaterThan(world.fighters[0].radius);
  });
});
