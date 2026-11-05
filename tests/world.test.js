import { describe, expect, it } from "vitest";
import { createWorld, stepWorld } from "../src/game/world.js";

describe("world", () => {
  it("startet bei Schritt 0 mit einem Ring", () => {
    const world = createWorld();
    expect(world.step).toBe(0);
    expect(world.ring.radius).toBeGreaterThan(0);
  });

  it("zählt pro Schritt um eins hoch und lässt den Ring unverändert", () => {
    const world = createWorld();
    const ring = { ...world.ring };
    stepWorld(world);
    stepWorld(world);
    expect(world.step).toBe(2);
    expect(world.ring).toEqual(ring);
  });
});
