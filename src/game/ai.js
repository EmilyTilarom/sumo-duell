import {
  BASE_RADIUS,
  BRACE_DRAG,
  DODGE_COST,
  EXHAUSTED_BELOW,
  NEUTRAL_INPUT,
  RUSH_COST,
  rushTravel,
} from "./actions.js";
import { DRAG } from "./physics.js";
import { createRng } from "./rng.js";

const CONTACT = BASE_RADIUS * 2;
const CHARGE_OPTIONS = [1, 0.75, 0.5, 0.25];
const CLOSE_RANGE = 70;
const CIRCLE_FROM = 180;
const AIM_TOLERANCE = 0.22;
const RUSH_LEAD_STEPS = 18;
const MATE_SPACING = 160;

export function createAi(profile, seed) {
  return { profile, rng: createRng(seed), wait: 0, input: NEUTRAL_INPUT, chargeGoal: 0 };
}

function unit(x, y) {
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

function isInside(world, x, y, margin) {
  return Math.hypot(x, y) <= world.ring.radius - margin;
}

function saveYourself(me, world, profile) {
  const stopX = me.x + me.vx / (1 - DRAG);
  const stopY = me.y + me.vy / (1 - DRAG);
  if (isInside(world, stopX, stopY, profile.edgeMargin)) return null;

  const home = unit(-me.x, -me.y);
  const canBrace = me.stamina >= EXHAUSTED_BELOW || me.state === "bracing";
  const brace = canBrace && Math.hypot(me.vx, me.vy) > 1.5;
  return { ...NEUTRAL_INPUT, x: home.x, y: home.y, brace };
}

function safeCharge(me, world, goal, profile) {
  const dirX = Math.cos(me.facing);
  const dirY = Math.sin(me.facing);
  for (const charge of CHARGE_OPTIONS) {
    if (charge > goal) continue;
    const travel = rushTravel(charge) * profile.rushCaution;
    if (isInside(world, me.x + dirX * travel, me.y + dirY * travel, 0)) return charge;
  }
  return 0;
}

function sidestep(me, toFoe) {
  const side = me.x * toFoe.y - me.y * toFoe.x > 0 ? 1 : -1;
  return { ...NEUTRAL_INPUT, x: -toFoe.y * side, y: toFoe.x * side, dodge: true };
}

// Aus kurzer Entfernung bleibt nach dem Loslassen keine Zeit, also liest die KI schon das Aufladen.
function readCharge(ai, me, foe, dist, toFoe) {
  const p = ai.profile;
  if (dist > CONTACT + CLOSE_RANGE || ai.rng() > p.readChance) return null;
  if (foe.charge >= 1) return p.useDodge && me.stamina >= DODGE_COST ? sidestep(me, toFoe) : null;
  if (p.useBrace && me.stamina >= EXHAUSTED_BELOW) return { ...NEUTRAL_INPUT, x: toFoe.x, y: toFoe.y, brace: true };
  return null;
}

function defend(ai, me, foe, dist, toFoe) {
  const p = ai.profile;
  if (foe.state === "charging") return readCharge(ai, me, foe, dist, toFoe);

  const foeSpeed = Math.hypot(foe.vx, foe.vy);
  const headingAtMe = Math.cos(foe.facing) * -toFoe.x + Math.sin(foe.facing) * -toFoe.y > 0.6;
  if (foe.state !== "rushing" || !headingAtMe) return null;
  if (dist > CONTACT + foeSpeed * 16 || ai.rng() > p.readChance) return null;

  const full = foe.rushCharge >= 1;
  if ((full || !p.useBrace) && p.useDodge && me.stamina >= DODGE_COST) return sidestep(me, toFoe);
  if (!full && p.useBrace && me.stamina >= EXHAUSTED_BELOW) {
    return { ...NEUTRAL_INPUT, x: toFoe.x, y: toFoe.y, brace: true };
  }
  return null;
}

function aimAt(me, foe) {
  const x = foe.x + foe.vx * RUSH_LEAD_STEPS - me.x;
  const y = foe.y + foe.vy * RUSH_LEAD_STEPS - me.y;
  const angle = Math.atan2(y, x) - me.facing;
  return { aim: unit(x, y), error: Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) };
}

// Steht ein Teamkamerad zwischen mir und dem Ziel, wäre der Stoß verschenkt.
function laneBlocked(me, foe, mates) {
  const dx = foe.x - me.x;
  const dy = foe.y - me.y;
  const length = Math.hypot(dx, dy) || 1;
  return mates.some((mate) => {
    const along = ((mate.x - me.x) * dx + (mate.y - me.y) * dy) / length;
    const across = Math.abs((mate.x - me.x) * dy - (mate.y - me.y) * dx) / length;
    return along > 0 && along < length && across < me.radius + mate.radius;
  });
}

function attack(ai, me, foe, world, dist, mates) {
  const p = ai.profile;
  const { aim, error } = aimAt(me, foe);

  if (me.state === "charging") {
    if (dist > p.rushMax * 1.5 || safeCharge(me, world, me.charge, p) === 0) {
      return { ...NEUTRAL_INPUT, brace: true };
    }
    const ready = me.charge >= ai.chargeGoal && error < AIM_TOLERANCE && !laneBlocked(me, foe, mates);
    return { ...NEUTRAL_INPUT, x: aim.x, y: aim.y, charge: !ready };
  }
  if (me.stamina < RUSH_COST) return null;

  const exposed = foe.state === "recovering" || foe.state === "staggered";
  const wantsRush = exposed
    ? ai.rng() < p.punish && dist < p.rushMax
    : dist > p.rushMin && dist < p.rushMax && ai.rng() < p.aggression;
  if (!wantsRush) return null;

  const goal = exposed ? Math.min(p.chargeGoal, 0.25) : p.chargeGoal;
  const charge = safeCharge(me, world, goal, p);
  if (charge === 0 || error > AIM_TOLERANCE * 2 || laneBlocked(me, foe, mates)) return null;
  ai.chargeGoal = charge;
  return { ...NEUTRAL_INPUT, x: aim.x, y: aim.y, charge: true };
}

function position(ai, me, world, toFoe, dist, mates) {
  const p = ai.profile;
  const edgeShare = Math.hypot(me.x, me.y) / Math.max(world.ring.radius, 1);
  const home = unit(-me.x, -me.y);
  const circle = dist > CIRCLE_FROM ? p.circle : 0;
  let x = toFoe.x + home.x * edgeShare * p.centering - toFoe.y * circle;
  let y = toFoe.y + home.y * edgeShare * p.centering + toFoe.x * circle;
  // Teamkameraden verteilen sich, statt sich gegenseitig im Weg zu stehen.
  for (const mate of mates) {
    const gap = Math.hypot(me.x - mate.x, me.y - mate.y);
    if (gap > 0 && gap < MATE_SPACING) {
      x += ((me.x - mate.x) / gap) * (1 - gap / MATE_SPACING);
      y += ((me.y - mate.y) / gap) * (1 - gap / MATE_SPACING);
    }
  }
  const walk = unit(x, y);
  return { ...NEUTRAL_INPUT, x: walk.x, y: walk.y };
}

function nearest(me, others) {
  return others.reduce((best, f) => (Math.hypot(f.x - me.x, f.y - me.y) < Math.hypot(best.x - me.x, best.y - me.y) ? f : best));
}

function decide(ai, world, index) {
  const me = world.fighters[index];
  const foes = world.fighters.filter((f) => !f.out && f.team !== me.team);
  if (me.out || foes.length === 0) return NEUTRAL_INPUT;
  const mates = world.fighters.filter((f) => f !== me && !f.out && f.team === me.team);

  const rescue = saveYourself(me, world, ai.profile);
  if (rescue) return rescue;

  // Zuerst gegen jeden absichern, der gerade angreift, dann den nächsten Gegner angehen.
  for (const threat of foes) {
    const toThreat = unit(threat.x - me.x, threat.y - me.y);
    const defense = defend(ai, me, threat, Math.hypot(threat.x - me.x, threat.y - me.y), toThreat);
    if (defense) return defense;
  }

  const foe = nearest(me, foes);
  const toFoe = unit(foe.x - me.x, foe.y - me.y);
  const dist = Math.hypot(foe.x - me.x, foe.y - me.y);

  if (ai.rng() < ai.profile.errorRate) {
    const angle = ai.rng() * Math.PI * 2;
    return { ...NEUTRAL_INPUT, x: Math.cos(angle), y: Math.sin(angle) };
  }

  return attack(ai, me, foe, world, dist, mates) ?? position(ai, me, world, toFoe, dist, mates);
}

// Liefert dieselbe Eingabe wie eine Tastatur. Entschieden wird nur alle paar Schritte (Reaktionszeit).
export function thinkAi(ai, world, index) {
  if (world.phase !== "fight") {
    ai.input = NEUTRAL_INPUT;
    ai.wait = 0;
    return NEUTRAL_INPUT;
  }
  ai.wait -= 1;
  if (ai.wait <= 0) {
    ai.input = decide(ai, world, index);
    ai.wait = ai.profile.reaction * (0.5 + ai.rng() * 0.5);
  }
  return ai.input;
}
