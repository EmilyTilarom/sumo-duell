import { DRAG, MOVE_ACCEL, bounce, integrate, isOverlapping, normalBetween, separate } from "./physics.js";

export const NEUTRAL_INPUT = Object.freeze({ x: 0, y: 0, charge: false, brace: false, dodge: false });

export const BASE_RADIUS = 44;
export const MAX_STAMINA = 100;
export const STAMINA_REGEN = 0.13;
export const EXHAUSTED_BELOW = 10;
export const EXHAUSTED_MASS = 0.6;

const TURN_RATE = 0.06;
const CHARGE_MOVE = 0.3;

export const CHARGE_STEPS = 40;
export const RUSH_MIN_SPEED = 3.5;
export const RUSH_MAX_SPEED = 7;
export const RUSH_STEPS = 20;
export const RUSH_DRAG = 0.985;
export const RUSH_RECOVER = 18;
export const RUSH_COST = 12;
export const RUSH_CHARGE_COST = 10;
export const KNOCK_MIN = 3.4;
export const KNOCK_MAX = 7.5;
export const AFTER_DODGE_BONUS = 1.5;
export const HIT_STAGGER = 34;

export const BRACE_MASS = 5;
export const BRACE_DRAG = 0.9;
export const BRACE_COST = 0.45;
export const BRACE_BREAK_FACTOR = 0.8;
export const BRACE_BREAK_STAGGER = 36;
export const BLOCK_STAGGER = 34;
const BLOCK_REBOUND = 3;
const BLOCK_STAMINA = 10;

export const DODGE_STEPS = 16;
export const DODGE_SPEED = 5.5;
export const DODGE_DRAG = 0.95;
export const DODGE_LOCK = 30;
export const DODGE_COST = 20;
export const MISS_STAGGER = 28;
export const NO_CONTACT_STEPS = 18;

export function createFighter({ x = 0, y = 0, facing = 0, mass = 1 } = {}) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing,
    mass,
    radius: BASE_RADIUS * Math.cbrt(mass),
    stamina: MAX_STAMINA,
    state: "idle",
    timer: 0,
    charge: 0,
    rushCharge: 0,
    wasDodgeDown: false,
    out: false,
    fall: 0,
  };
}

export function effectiveMass(f) {
  let mass = f.mass;
  if (f.state === "bracing") mass *= BRACE_MASS;
  if (f.stamina < EXHAUSTED_BELOW) mass *= EXHAUSTED_MASS;
  return mass;
}

// Wie weit ein Stoß trägt, wenn er ins Leere geht und der Ringer danach bremst.
export function rushTravel(charge) {
  let speed = RUSH_MIN_SPEED + (RUSH_MAX_SPEED - RUSH_MIN_SPEED) * charge;
  let travel = 0;
  for (let i = 0; i < RUSH_STEPS; i += 1) {
    speed *= RUSH_DRAG;
    travel += speed;
  }
  for (let i = 0; i < RUSH_RECOVER; i += 1) {
    speed *= DRAG;
    travel += speed;
  }
  return travel + (speed * BRACE_DRAG) / (1 - BRACE_DRAG);
}

function setState(f, state, timer = 0) {
  f.state = state;
  f.timer = timer;
  if (state !== "charging") f.charge = 0;
}

function turnToward(f, x, y, rate) {
  if (x === 0 && y === 0) return;
  const target = Math.atan2(y, x);
  const delta = Math.atan2(Math.sin(target - f.facing), Math.cos(target - f.facing));
  const limit = rate / Math.sqrt(f.mass);
  f.facing += Math.max(-limit, Math.min(limit, delta));
}

function walk(f, input, factor) {
  const length = Math.hypot(input.x, input.y);
  const scale = length > 1 ? 1 / length : 1;
  const accel = (MOVE_ACCEL * factor * scale) / f.mass;
  turnToward(f, input.x, input.y, TURN_RATE * (factor < 1 ? 0.5 : 1));
  integrate(f, input.x * accel, input.y * accel, DRAG);
}

function startRush(f, events) {
  const charge = f.charge;
  const speed = RUSH_MIN_SPEED + (RUSH_MAX_SPEED - RUSH_MIN_SPEED) * charge;
  f.vx = Math.cos(f.facing) * speed;
  f.vy = Math.sin(f.facing) * speed;
  f.stamina = Math.max(0, f.stamina - RUSH_COST - RUSH_CHARGE_COST * charge);
  f.rushCharge = charge;
  setState(f, "rushing", RUSH_STEPS);
  events.push({ type: "rush", x: f.x, y: f.y, charge });
}

function startDodge(f, input, events) {
  const sideX = -Math.sin(f.facing);
  const sideY = Math.cos(f.facing);
  const side = input.x * sideX + input.y * sideY < 0 ? -1 : 1;
  f.vx = f.vx * 0.3 + sideX * side * DODGE_SPEED;
  f.vy = f.vy * 0.3 + sideY * side * DODGE_SPEED;
  f.stamina -= DODGE_COST;
  setState(f, "dodging", DODGE_STEPS);
  events.push({ type: "dodge", x: f.x, y: f.y });
}

export function updateFighter(f, input, events) {
  if (f.out) {
    f.fall += 1;
    f.x += f.vx;
    f.y += f.vy;
    return;
  }

  if (f.state !== "bracing" && f.state !== "charging") {
    f.stamina = Math.min(MAX_STAMINA, f.stamina + STAMINA_REGEN);
  }

  const dodgePressed = input.dodge && !f.wasDodgeDown;
  f.wasDodgeDown = input.dodge;
  const canDodge = dodgePressed && f.stamina >= DODGE_COST;

  switch (f.state) {
    case "rushing":
      integrate(f, 0, 0, RUSH_DRAG);
      if (--f.timer <= 0) setState(f, "recovering", RUSH_RECOVER);
      break;
    case "dodging":
      integrate(f, 0, 0, DODGE_DRAG);
      if (--f.timer <= 0) setState(f, "recovering", DODGE_LOCK);
      break;
    case "recovering":
    case "staggered":
      integrate(f, 0, 0, DRAG);
      if (--f.timer <= 0) setState(f, "idle");
      break;
    case "bracing":
      f.stamina = Math.max(0, f.stamina - BRACE_COST);
      turnToward(f, input.x, input.y, TURN_RATE);
      integrate(f, 0, 0, BRACE_DRAG);
      if (!input.brace || f.stamina === 0) setState(f, "idle");
      break;
    case "charging":
      if (canDodge) startDodge(f, input, events);
      else if (input.brace) setState(f, "bracing");
      else if (!input.charge) startRush(f, events);
      else {
        const before = f.charge;
        f.charge = Math.min(1, f.charge + 1 / CHARGE_STEPS);
        if (before < 1 && f.charge === 1) events.push({ type: "chargeFull", x: f.x, y: f.y });
        walk(f, input, CHARGE_MOVE);
      }
      break;
    default:
      if (canDodge) startDodge(f, input, events);
      else if (input.charge && f.stamina >= RUSH_COST) {
        setState(f, "charging");
        walk(f, input, CHARGE_MOVE);
      } else if (input.brace && f.stamina >= EXHAUSTED_BELOW) {
        setState(f, "bracing");
        integrate(f, 0, 0, BRACE_DRAG);
      } else walk(f, input, 1);
  }
}

function pushAlong(f, n, speed) {
  f.vx += n.x * speed;
  f.vy += n.y * speed;
}

function knockStrength(rusher) {
  return KNOCK_MIN + (KNOCK_MAX - KNOCK_MIN) * rusher.rushCharge;
}

function hit(rusher, target, events) {
  const n = normalBetween(rusher, target);
  const at = { x: (rusher.x + target.x) / 2, y: (rusher.y + target.y) / 2 };
  const massRatio = rusher.mass / Math.min(target.mass, effectiveMass(target));
  const knock = knockStrength(rusher) * massRatio;

  if (target.state === "bracing") {
    if (rusher.rushCharge >= 1) {
      pushAlong(target, n, knock * BRACE_BREAK_FACTOR);
      setState(target, "staggered", BRACE_BREAK_STAGGER);
      rusher.vx *= 0.3;
      rusher.vy *= 0.3;
      setState(rusher, "recovering", RUSH_RECOVER);
      events.push({ type: "braceBroken", ...at });
    } else {
      rusher.vx = -n.x * BLOCK_REBOUND;
      rusher.vy = -n.y * BLOCK_REBOUND;
      setState(rusher, "staggered", BLOCK_STAGGER);
      target.stamina = Math.max(0, target.stamina - BLOCK_STAMINA);
      events.push({ type: "blocked", ...at });
    }
    return;
  }

  const punished = target.state === "recovering";
  pushAlong(target, n, knock * (punished ? AFTER_DODGE_BONUS : 1));
  setState(target, "staggered", HIT_STAGGER);
  rusher.vx *= 0.35;
  rusher.vy *= 0.35;
  setState(rusher, "recovering", RUSH_RECOVER);
  events.push({ type: punished ? "punish" : "hit", ...at, charge: rusher.rushCharge });
}

function headOn(a, b, events) {
  const n = normalBetween(a, b);
  const forceOfA = a.mass * knockStrength(a);
  const forceOfB = b.mass * knockStrength(b);
  a.vx = a.vy = b.vx = b.vy = 0;
  pushAlong(a, n, -forceOfB / a.mass);
  pushAlong(b, n, forceOfA / b.mass);
  setState(a, "staggered", HIT_STAGGER);
  setState(b, "staggered", HIT_STAGGER);
  events.push({ type: "hit", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, charge: 1 });
}

// Gibt true zurück, wenn ein Ausweichen den Stoß ins Leere laufen ließ.
// Teamkameraden rempeln sich nur an, ihre Stöße werfen sich nicht gegenseitig weg.
export function resolveContact(a, b, events, friendly = false) {
  if (!isOverlapping(a, b)) return false;

  if (friendly) {
    separate(a, b, effectiveMass(a), effectiveMass(b));
    bounce(a, b, effectiveMass(a), effectiveMass(b));
    return false;
  }

  for (const [rusher, other] of [[a, b], [b, a]]) {
    if (rusher.state === "rushing" && other.state === "dodging") {
      setState(rusher, "staggered", MISS_STAGGER);
      events.push({ type: "dodged", x: other.x, y: other.y });
      return true;
    }
  }

  separate(a, b, effectiveMass(a), effectiveMass(b));

  if (a.state === "rushing" && b.state === "rushing") headOn(a, b, events);
  else if (a.state === "rushing") hit(a, b, events);
  else if (b.state === "rushing") hit(b, a, events);
  else if (bounce(a, b, effectiveMass(a), effectiveMass(b)) > 1.5) {
    events.push({ type: "bump", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return false;
}
