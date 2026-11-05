import { describe, expect, it } from "vitest";
import { COUNTDOWN_STEPS, DRAW_WINDOW, RING_RADIUS, ROUND_END_STEPS, ROUND_STEPS, SHRINK_PER_STEP } from "../src/game/rules.js";
import { createWorld, stepWorld } from "../src/game/world.js";

function run(world, steps) {
  for (let i = 0; i < steps; i += 1) stepWorld(world);
}

function fightingWorld() {
  const world = createWorld();
  run(world, COUNTDOWN_STEPS);
  expect(world.phase).toBe("fight");
  return world;
}

function pushOut(world, index) {
  world.fighters[index].x = RING_RADIUS + 20;
}

function finishRoundAgainst(world, loser) {
  pushOut(world, loser);
  run(world, DRAW_WINDOW + 2);
}

describe("Ring-out", () => {
  it("wer den Rand übertritt, verliert die Runde", () => {
    const world = fightingWorld();
    finishRoundAgainst(world, 1);
    expect(world.phase).toBe("roundEnd");
    expect(world.roundWinner).toBe(0);
    expect(world.scores).toEqual([1, 0]);
  });

  it("auf der Plattform passiert nichts", () => {
    const world = fightingWorld();
    world.fighters[0].x = RING_RADIUS - 1;
    run(world, 1);
    expect(world.phase).toBe("fight");
  });
});

describe("Unentschieden", () => {
  it("fallen beide zugleich, wird die Runde wiederholt", () => {
    const world = fightingWorld();
    pushOut(world, 0);
    run(world, DRAW_WINDOW - 3);
    pushOut(world, 1);
    world.fighters[1].x = -RING_RADIUS - 20;
    run(world, 5);
    expect(world.roundWinner).toBe("draw");
    expect(world.scores).toEqual([0, 0]);
    run(world, ROUND_END_STEPS);
    expect(world.phase).toBe("countdown");
    expect(world.round).toBe(1);
  });
});

describe("Best of 3", () => {
  it("zwei Rundensiege gewinnen das Match", () => {
    const world = fightingWorld();
    finishRoundAgainst(world, 1);
    expect(world.matchWinner).toBeNull();
    run(world, ROUND_END_STEPS);
    expect(world.round).toBe(2);
    expect(world.fighters[1].x).toBeLessThan(RING_RADIUS);
    run(world, COUNTDOWN_STEPS);
    finishRoundAgainst(world, 1);
    expect(world.matchWinner).toBe(0);
    run(world, ROUND_END_STEPS);
    expect(world.phase).toBe("matchEnd");
  });

  it("bei 1:1 entscheidet die dritte Runde", () => {
    const world = fightingWorld();
    for (const loser of [0, 1]) {
      finishRoundAgainst(world, loser);
      run(world, ROUND_END_STEPS + COUNTDOWN_STEPS);
    }
    expect(world.round).toBe(3);
    expect(world.matchWinner).toBeNull();
    finishRoundAgainst(world, 0);
    expect(world.matchWinner).toBe(1);
  });
});

describe("Rundenzeit", () => {
  it("nach 60 Sekunden schrumpft die Plattform", () => {
    const world = fightingWorld();
    run(world, ROUND_STEPS - 1);
    expect(world.ring.radius).toBe(RING_RADIUS);
    run(world, 11);
    expect(world.ring.radius).toBeCloseTo(RING_RADIUS - 11 * SHRINK_PER_STEP);
  });

  it("zwei Untätige fallen irgendwann, die Runde endet also immer", () => {
    const world = fightingWorld();
    run(world, ROUND_STEPS + RING_RADIUS / SHRINK_PER_STEP);
    expect(world.round + world.draws + world.scores[0]).toBeGreaterThan(1);
  });

  it("die neue Runde beginnt wieder mit voller Plattform", () => {
    const world = fightingWorld();
    run(world, ROUND_STEPS + 100);
    finishRoundAgainst(world, 1);
    run(world, ROUND_END_STEPS);
    expect(world.ring.radius).toBe(RING_RADIUS);
  });
});
