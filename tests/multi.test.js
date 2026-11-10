import { describe, expect, it } from "vitest";
import { NEUTRAL_INPUT, createFighter, resolveContact } from "../src/game/actions.js";
import { LEVELS } from "../src/game/campaign.js";
import { COUNTDOWN_STEPS, DRAW_WINDOW, RING_RADIUS, ROUND_END_STEPS } from "../src/game/rules.js";
import { createWorld, stepWorld } from "../src/game/world.js";
import { MAX_MATCH_STEPS, aiController, playMatch } from "./simulate.js";

function run(world, steps) {
  for (let i = 0; i < steps; i += 1) stepWorld(world);
}

function fighting(options) {
  const world = createWorld(options);
  run(world, COUNTDOWN_STEPS);
  return world;
}

function knockOut(world, ...indices) {
  for (const i of indices) world.fighters[i].x = RING_RADIUS + 30 + i * 100;
}

describe("Aufstellung", () => {
  it.each([2, 3, 4])("%i Ringer stehen getrennt im Kreis und schauen zur Mitte", (count) => {
    const world = createWorld({ masses: Array(count).fill(1) });
    const [first, second] = world.fighters;
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThan(first.radius * 2);
    for (const f of world.fighters) {
      expect(Math.cos(f.facing) * -f.x + Math.sin(f.facing) * -f.y).toBeGreaterThan(0.99 * Math.hypot(f.x, f.y));
    }
  });

  it("weniger als 2 oder mehr als 4 Ringer gibt es nicht", () => {
    expect(() => createWorld({ masses: [1] })).toThrow();
    expect(() => createWorld({ masses: [1, 1, 1, 1, 1] })).toThrow();
  });
});

describe("Jeder gegen jeden", () => {
  it("die Runde läuft weiter, solange zwei stehen", () => {
    const world = fighting({ masses: [1, 1, 1, 1] });
    knockOut(world, 1, 2);
    run(world, DRAW_WINDOW + 5);
    expect(world.phase).toBe("fight");
  });

  it("der Letzte auf der Plattform gewinnt die Runde", () => {
    const world = fighting({ masses: [1, 1, 1, 1] });
    knockOut(world, 0, 1, 3);
    run(world, DRAW_WINDOW + 2);
    expect(world.roundWinner).toBe(2);
    expect(world.scores).toEqual([0, 0, 1, 0]);
  });

  it("fallen die letzten beiden zugleich, wird die Runde wiederholt", () => {
    const world = fighting({ masses: [1, 1, 1] });
    knockOut(world, 0);
    run(world, 30);
    knockOut(world, 1, 2);
    run(world, DRAW_WINDOW + 2);
    expect(world.roundWinner).toBe("draw");
    expect(world.scores).toEqual([0, 0, 0]);
    run(world, ROUND_END_STEPS);
    expect(world.fighters.every((f) => !f.out)).toBe(true);
  });

  it("zwei Rundensiege gewinnen das Match", () => {
    const world = fighting({ masses: [1, 1, 1] });
    for (let round = 0; round < 2; round += 1) {
      knockOut(world, 0, 2);
      run(world, DRAW_WINDOW + ROUND_END_STEPS + COUNTDOWN_STEPS);
    }
    expect(world.matchWinner).toBe(1);
    expect(world.phase).toBe("matchEnd");
  });
});

describe("Einer gegen Team", () => {
  const teams = [0, 1, 1, 1];

  it("das Team gewinnt, wenn der Einzelne fällt", () => {
    const world = fighting({ masses: [1, 1, 1, 1], teams });
    knockOut(world, 0);
    run(world, DRAW_WINDOW + 2);
    expect(world.roundWinner).toBe(1);
    expect(world.scores).toEqual([0, 1]);
  });

  it("der Einzelne gewinnt erst, wenn das ganze Team gefallen ist", () => {
    const world = fighting({ masses: [1, 1, 1, 1], teams });
    knockOut(world, 1, 2);
    run(world, DRAW_WINDOW + 5);
    expect(world.phase).toBe("fight");
    knockOut(world, 3);
    run(world, DRAW_WINDOW + 2);
    expect(world.roundWinner).toBe(0);
  });

  it("ein Stoß gegen den Teamkameraden wirft ihn nicht weg", () => {
    const rusher = createFighter({ x: -80 });
    Object.assign(rusher, { state: "rushing", timer: 10, rushCharge: 1, vx: 7 });
    const mate = createFighter({ x: 0 });
    const events = [];
    resolveContact(rusher, mate, events, true);
    expect(mate.state).toBe("idle");
    expect(mate.vx).toBeLessThan(7);
    expect(events.map((e) => e.type)).not.toContain("hit");
  });
});

function countHits(world, teamHits) {
  for (const e of world.events) {
    if (e.type !== "hit" && e.type !== "punish" && e.type !== "braceBroken") continue;
    const near = world.fighters
      .filter((f) => !f.out)
      .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y));
    if (near.length >= 2 && near[0].team === near[1].team) teamHits.count += 1;
  }
}

describe.each([
  ["Jeder gegen jeden, 3 Ringer", [0, 1, 2]],
  ["Jeder gegen jeden, 4 Ringer", [0, 1, 2, 3]],
  ["Einer gegen Team, 1 gegen 2", [0, 1, 1]],
  ["Einer gegen Team, 1 gegen 3", [0, 1, 1, 1]],
])("KI-Simulation %s", (_, teams) => {
  it("jeder Kampf endet mit einem Sieger, Teamkameraden treffen sich nicht", () => {
    const wins = Array(Math.max(...teams) + 1).fill(0);
    const teamHits = { count: 0 };
    let steps = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const profiles = teams.map((_, i) => LEVELS[(seed + i * 3) % LEVELS.length].ai);
      const controllers = profiles.map((profile, i) => aiController(profile, seed * 10 + i));
      const world = playMatch(controllers, teams.map(() => 1), (w) => countHits(w, teamHits), teams);
      expect(world.phase).toBe("matchEnd");
      expect(world.step).toBeLessThan(MAX_MATCH_STEPS);
      wins[world.matchWinner] += 1;
      steps += world.step;
    }
    console.log(`${_}: Siege je Team ${wins.join("/")}, Ø ${Math.round(steps / 12 / 60)} s pro Match, Treffer im Team ${teamHits.count}`);
    expect(teamHits.count).toBe(0);
  });

  it("eine KI läuft ohne Gegnerdruck nicht selbst von der Plattform", () => {
    const world = createWorld({ masses: teams.map(() => 1), teams });
    const solo = aiController(LEVELS[5].ai, 3);
    let selfFall = false;
    for (let i = 0; i < 1500; i += 1) {
      const inputs = teams.map((_, k) => (k === 1 ? solo(world, 1) : NEUTRAL_INPUT));
      stepWorld(world, inputs);
      if (world.fighters[1].out && world.events.some((e) => e.type === "fall")) selfFall = true;
    }
    expect(selfFall).toBe(false);
  });
});
