import { NEUTRAL_INPUT } from "../src/game/actions.js";
import { createAi, thinkAi } from "../src/game/ai.js";
import { DRAG } from "../src/game/physics.js";
import { createWorld, stepWorld } from "../src/game/world.js";

export const MAX_MATCH_STEPS = 60 * 60 * 15;

// Einfacher Testspieler: läuft auf den Gegner zu, stößt halb geladen und bremst am Rand.
export function createSimplePlayer() {
  return (world, index) => {
    const me = world.fighters[index];
    const foe = world.fighters[1 - index];
    if (world.phase !== "fight" || me.out || foe.out) return NEUTRAL_INPUT;
    const stop = Math.hypot(me.x + me.vx / (1 - DRAG), me.y + me.vy / (1 - DRAG));
    if (stop > world.ring.radius - 50) return { ...NEUTRAL_INPUT, x: -me.x, y: -me.y };
    const x = foe.x - me.x;
    const y = foe.y - me.y;
    const dist = Math.hypot(x, y);
    const toFoe = { x: x / dist, y: y / dist };
    if (me.state === "charging") return { ...NEUTRAL_INPUT, ...toFoe, charge: me.charge < 0.5 };
    return { ...NEUTRAL_INPUT, ...toFoe, charge: dist < 200 && world.step % 90 < 5 };
  };
}

// Könner-Testspieler: nutzt die KI ohne Sonderregeln mit menschlicher Reaktionszeit von rund 0,2 Sekunden.
export const SKILLED_PROFILE = {
  reaction: 16,
  errorRate: 0.05,
  aggression: 0.3,
  chargeGoal: 1,
  rushMin: 0,
  rushMax: 280,
  rushCaution: 0.6,
  readChance: 0.85,
  useBrace: true,
  useDodge: true,
  punish: 0.95,
  centering: 2,
  circle: 0.3,
  edgeMargin: 40,
};

export function aiController(profile, seed) {
  const ai = createAi(profile, seed);
  return (world, index) => thinkAi(ai, world, index);
}

export function playMatch(controllers, masses, onStep) {
  const world = createWorld({ masses });
  while (world.phase !== "matchEnd" && world.step < MAX_MATCH_STEPS) {
    const inputs = controllers.map((control, i) => control(world, i));
    stepWorld(world, inputs);
    onStep?.(world);
  }
  return world;
}

export function winRate(createControllers, masses, matches) {
  let wins = 0;
  for (let seed = 1; seed <= matches; seed += 1) {
    if (playMatch(createControllers(seed), masses).matchWinner === 0) wins += 1;
  }
  return wins / matches;
}
