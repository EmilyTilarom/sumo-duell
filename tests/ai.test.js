import { describe, expect, it } from "vitest";
import { NEUTRAL_INPUT } from "../src/game/actions.js";
import { createAi, thinkAi } from "../src/game/ai.js";
import { LEVELS } from "../src/game/campaign.js";
import { COUNTDOWN_STEPS, ROUND_STEPS } from "../src/game/rules.js";
import { createWorld, stepWorld } from "../src/game/world.js";
import { MAX_MATCH_STEPS, SKILLED_PROFILE, aiController, createSimplePlayer, playMatch, winRate } from "./simulate.js";

const MATCHES = 60;
const idle = () => NEUTRAL_INPUT;

function percent(rate) {
  return `${Math.round(rate * 100)} %`;
}

describe("KI ohne Sonderregeln", () => {
  it("liefert genau die Eingabe einer Tastatur", () => {
    const world = createWorld();
    const ai = createAi(LEVELS[9].ai, 1);
    for (let i = 0; i < COUNTDOWN_STEPS + 300; i += 1) {
      const input = thinkAi(ai, world, 1);
      expect(Object.keys(input).sort()).toEqual(Object.keys(NEUTRAL_INPUT).sort());
      expect(Math.hypot(input.x, input.y)).toBeLessThanOrEqual(1.001);
      stepWorld(world, [NEUTRAL_INPUT, input]);
    }
  });

  it("gleicher Seed, gleicher Kampf", () => {
    const fight = () => playMatch([aiController(LEVELS[4].ai, 7), aiController(LEVELS[5].ai, 8)], [1, 1]);
    const first = fight();
    const second = fight();
    expect(second.step).toBe(first.step);
    expect(second.scores).toEqual(first.scores);
  });
});

describe.each(LEVELS)("Level $level: $name", (entry) => {
  it("jeder Kampf endet", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const world = playMatch([aiController(SKILLED_PROFILE, seed), aiController(entry.ai, seed + 500)], [1, entry.mass]);
      expect(world.phase).toBe("matchEnd");
      expect(world.step).toBeLessThan(MAX_MATCH_STEPS);
    }
  });

  it("läuft gegen einen untätigen Gegner nicht selbst von der Plattform und bleibt nicht hängen", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      let selfFalls = 0;
      let actions = 0;
      const world = playMatch([idle, aiController(entry.ai, seed)], [1, entry.mass], (w) => {
        actions += w.events.filter((e) => e.type === "rush" || e.type === "bump").length;
        if (w.roundWinner === 0 && w.phaseTimer === 1) selfFalls += 1;
      });
      expect(selfFalls).toBe(0);
      expect(actions).toBeGreaterThan(0);
      expect(world.matchWinner).toBe(1);
      expect(world.step).toBeLessThan(ROUND_STEPS * 2);
    }
  });

  it("fällt fast nie ohne Fremdeinwirkung", () => {
    let contactStep = 0;
    let unforced = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      contactStep = 0;
      playMatch([createSimplePlayer(), aiController(entry.ai, seed)], [1, entry.mass], (w) => {
        if (w.events.some((e) => ["hit", "punish", "bump", "blocked", "braceBroken", "dodged"].includes(e.type))) contactStep = w.step;
        const f = w.fighters[1];
        if (f.out && f.fall === 1 && w.step - contactStep > 240) unforced += 1;
      });
    }
    expect(unforced).toBe(0);
  });

  it("ist gegen den Könner-Testspieler gewinnbar", () => {
    const rate = winRate((s) => [aiController(SKILLED_PROFILE, s * 7 + 1), aiController(entry.ai, s * 13)], [1, entry.mass], MATCHES);
    console.log(`Könner gegen Level ${entry.level}: ${percent(rate)}`);
    expect(rate).toBeGreaterThanOrEqual(0.3);
  });
});

describe("Schwierigkeitskurve", () => {
  it("Level 1 ist gegen den einfachen Testspieler schlagbar", () => {
    const rate = winRate((s) => [createSimplePlayer(), aiController(LEVELS[0].ai, s)], [1, LEVELS[0].mass], MATCHES);
    console.log(`Einfacher Testspieler gegen Level 1: ${percent(rate)}`);
    expect(rate).toBeGreaterThanOrEqual(0.8);
  });

  it("stärkere Level schlagen schwächere deutlich öfter", () => {
    for (let weak = 0; weak + 2 < LEVELS.length; weak += 1) {
      const low = LEVELS[weak];
      const high = LEVELS[weak + 2];
      const rate = winRate((s) => [aiController(high.ai, s * 3), aiController(low.ai, s * 5 + 2)], [high.mass, low.mass], MATCHES);
      console.log(`Level ${high.level} gegen Level ${low.level}: ${percent(rate)}`);
      expect(rate).toBeGreaterThanOrEqual(0.6);
    }
  });
});
