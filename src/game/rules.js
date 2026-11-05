export const RING_RADIUS = 320;
export const ROUND_STEPS = 3600;
export const SHRINK_PER_STEP = 0.4;
export const COUNTDOWN_STEPS = 150;
export const DRAW_WINDOW = 12;
export const ROUND_END_STEPS = 130;
export const WINS_NEEDED = 2;

const SPAWN_X = 150;

export function resetRound(world) {
  world.ring.radius = RING_RADIUS;
  world.roundStep = 0;
  world.roundWinner = null;
  world.noContact = 0;
  world.phase = "countdown";
  world.phaseTimer = COUNTDOWN_STEPS;
  world.fighters.forEach((f, i) => {
    Object.assign(f, {
      x: i === 0 ? -SPAWN_X : SPAWN_X,
      y: 0,
      vx: 0,
      vy: 0,
      facing: i === 0 ? 0 : Math.PI,
      state: "idle",
      timer: 0,
      charge: 0,
      rushCharge: 0,
      wasDodgeDown: false,
      stamina: 100,
      out: false,
      fall: 0,
    });
  });
  world.events.push({ type: "roundStart", round: world.round });
}

function shrinkRing(world) {
  if (world.roundStep < ROUND_STEPS) return;
  if (world.roundStep === ROUND_STEPS) world.events.push({ type: "shrink" });
  world.ring.radius = Math.max(0, world.ring.radius - SHRINK_PER_STEP);
}

function checkRingOut(world) {
  for (const f of world.fighters) {
    if (f.out || Math.hypot(f.x - world.ring.x, f.y - world.ring.y) <= world.ring.radius) continue;
    f.out = true;
    world.events.push({ type: "fall", x: f.x, y: f.y });
  }
}

function finishRound(world) {
  const [first, second] = world.fighters;
  world.phase = "roundEnd";
  world.phaseTimer = ROUND_END_STEPS;
  if (first.out && second.out) {
    world.roundWinner = "draw";
    world.draws += 1;
  } else {
    const winner = first.out ? 1 : 0;
    world.roundWinner = winner;
    world.scores[winner] += 1;
    if (world.scores[winner] >= WINS_NEEDED) world.matchWinner = winner;
  }
  world.events.push({ type: "roundEnd", winner: world.roundWinner });
}

export function advanceRules(world) {
  switch (world.phase) {
    case "countdown":
      world.phaseTimer -= 1;
      if (world.phaseTimer <= 0) {
        world.phase = "fight";
        world.events.push({ type: "go" });
      } else if (world.phaseTimer % 50 === 0) {
        world.events.push({ type: "tick" });
      }
      break;
    case "fight":
      world.roundStep += 1;
      shrinkRing(world);
      checkRingOut(world);
      if (world.fighters.some((f) => f.out)) {
        world.phase = "ringout";
        world.phaseTimer = DRAW_WINDOW;
      }
      break;
    case "ringout":
      world.roundStep += 1;
      shrinkRing(world);
      checkRingOut(world);
      world.phaseTimer -= 1;
      if (world.phaseTimer <= 0) finishRound(world);
      break;
    case "roundEnd":
      world.phaseTimer -= 1;
      if (world.phaseTimer > 0) break;
      if (world.matchWinner !== null) {
        world.phase = "matchEnd";
        world.events.push({ type: "matchEnd", winner: world.matchWinner });
      } else {
        if (world.roundWinner !== "draw") world.round += 1;
        resetRound(world);
      }
      break;
    default:
  }
}
