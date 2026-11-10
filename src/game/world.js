import { NEUTRAL_INPUT, NO_CONTACT_STEPS, createFighter, resolveContact, updateFighter } from "./actions.js";
import { RING_RADIUS, advanceRules, resetRound } from "./rules.js";

export const STEPS_PER_SECOND = 60;

const ROUND_END_DRAG = 0.9;

export const MAX_FIGHTERS = 4;

// teams[i] ist das Team von Ringer i. Ohne Angabe kämpft jeder für sich.
export function createWorld({ masses = [1, 1], teams = masses.map((_, i) => i) } = {}) {
  if (masses.length < 2 || masses.length > MAX_FIGHTERS || teams.length !== masses.length) {
    throw new Error("2 bis 4 Ringer mit je einem Team");
  }
  const world = {
    step: 0,
    ring: { x: 0, y: 0, radius: RING_RADIUS },
    fighters: masses.map((mass, i) => ({ ...createFighter({ mass }), team: teams[i] })),
    scores: Array(Math.max(...teams) + 1).fill(0),
    noContact: {},
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
  const { fighters, noContact } = world;

  world.fighters.forEach((f, i) => {
    updateFighter(f, playing ? inputs[i] ?? NEUTRAL_INPUT : NEUTRAL_INPUT, world.events);
    if (world.phase === "roundEnd" && !f.out) {
      f.vx *= ROUND_END_DRAG;
      f.vy *= ROUND_END_DRAG;
    }
  });

  for (let i = 0; i < fighters.length; i += 1) {
    for (let j = i + 1; j < fighters.length; j += 1) {
      const pair = `${i}-${j}`;
      const a = fighters[i];
      const b = fighters[j];
      if (noContact[pair] > 0) noContact[pair] -= 1;
      else if (playing && !a.out && !b.out && resolveContact(a, b, world.events, a.team === b.team)) {
        noContact[pair] = NO_CONTACT_STEPS;
      }
    }
  }

  advanceRules(world);
}
