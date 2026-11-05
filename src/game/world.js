import { NEUTRAL_INPUT, NO_CONTACT_STEPS, createFighter, resolveContact, updateFighter } from "./actions.js";
import { RING_RADIUS, advanceRules, resetRound } from "./rules.js";

export const STEPS_PER_SECOND = 60;

const ROUND_END_DRAG = 0.9;

export function createWorld({ masses = [1, 1] } = {}) {
  const world = {
    step: 0,
    ring: { x: 0, y: 0, radius: RING_RADIUS },
    fighters: masses.map((mass) => createFighter({ mass })),
    scores: [0, 0],
    round: 1,
    draws: 0,
    roundWinner: null,
    matchWinner: null,
    events: [],
  };
  resetRound(world);
  return world;
}

export function stepWorld(world, inputs = []) {
  world.step += 1;
  world.events = [];
  const playing = world.phase === "fight" || world.phase === "ringout";
  const [a, b] = world.fighters;

  world.fighters.forEach((f, i) => {
    updateFighter(f, playing ? inputs[i] ?? NEUTRAL_INPUT : NEUTRAL_INPUT, world.events);
    if (world.phase === "roundEnd" && !f.out) {
      f.vx *= ROUND_END_DRAG;
      f.vy *= ROUND_END_DRAG;
    }
  });

  if (world.noContact > 0) world.noContact -= 1;
  else if (playing && !a.out && !b.out && resolveContact(a, b, world.events)) {
    world.noContact = NO_CONTACT_STEPS;
  }

  advanceRules(world);
}
