import { describe, expect, it } from "vitest";
import {
  CHARGE_STEPS,
  DODGE_COST,
  EXHAUSTED_BELOW,
  NEUTRAL_INPUT,
  RUSH_MAX_SPEED,
  RUSH_MIN_SPEED,
  STAMINA_REGEN,
  createFighter,
  effectiveMass,
  resolveContact,
  rushTravel,
  updateFighter,
} from "../src/game/actions.js";

const HOLD_CHARGE = { ...NEUTRAL_INPUT, charge: true };
const HOLD_BRACE = { ...NEUTRAL_INPUT, brace: true };
const PRESS_DODGE = { ...NEUTRAL_INPUT, dodge: true };

function step(f, input, steps = 1) {
  const events = [];
  for (let i = 0; i < steps; i += 1) updateFighter(f, input, events);
  return events;
}

function rushWith(charge) {
  const f = createFighter({ x: -80 });
  f.state = "rushing";
  f.timer = 10;
  f.rushCharge = charge;
  f.vx = RUSH_MIN_SPEED + (RUSH_MAX_SPEED - RUSH_MIN_SPEED) * charge;
  return f;
}

function target(state = "idle") {
  const f = createFighter({ x: 0, facing: Math.PI });
  f.state = state;
  f.timer = 20;
  return f;
}

describe("Stoß", () => {
  it("lädt beim Halten auf und stürmt beim Loslassen nach vorn", () => {
    const f = createFighter();
    step(f, HOLD_CHARGE, CHARGE_STEPS + 2);
    expect(f.state).toBe("charging");
    expect(f.charge).toBe(1);
    step(f, NEUTRAL_INPUT);
    expect(f.state).toBe("rushing");
    expect(f.vx).toBeGreaterThan(RUSH_MAX_SPEED * 0.9);
  });

  it("voll geladen trägt er weiter als ungeladen", () => {
    expect(rushTravel(1)).toBeGreaterThan(rushTravel(0) * 1.5);
  });

  it("wirft ein stehendes Ziel zurück, geladen stärker", () => {
    const weak = target();
    resolveContact(rushWith(0), weak, []);
    const strong = target();
    resolveContact(rushWith(1), strong, []);
    expect(weak.vx).toBeGreaterThan(0);
    expect(strong.vx).toBeGreaterThan(weak.vx * 1.5);
    expect(strong.state).toBe("staggered");
  });
});

describe("Aktionstabelle", () => {
  it("voll geladener Stoß schlägt Stemmen", () => {
    const events = [];
    const rusher = rushWith(1);
    const blocker = target("bracing");
    resolveContact(rusher, blocker, events);
    expect(events.map((e) => e.type)).toContain("braceBroken");
    expect(blocker.state).toBe("staggered");
    expect(blocker.vx).toBeGreaterThan(3);
    expect(rusher.state).not.toBe("staggered");
  });

  it("Stemmen schlägt den ungeladenen Stoß", () => {
    const events = [];
    const rusher = rushWith(0.5);
    const blocker = target("bracing");
    resolveContact(rusher, blocker, events);
    expect(events.map((e) => e.type)).toContain("blocked");
    expect(rusher.state).toBe("staggered");
    expect(rusher.vx).toBeLessThan(0);
    expect(blocker.state).toBe("bracing");
    expect(blocker.vx).toBeCloseTo(0);
  });

  it("Ausweichen schlägt den Stoß: der Gegner rutscht vorbei", () => {
    const events = [];
    const rusher = rushWith(1);
    const speed = rusher.vx;
    const dodger = target("dodging");
    expect(resolveContact(rusher, dodger, events)).toBe(true);
    expect(events.map((e) => e.type)).toContain("dodged");
    expect(rusher.state).toBe("staggered");
    expect(rusher.vx).toBe(speed);
    expect(dodger.vx).toBe(0);
    expect(dodger.state).toBe("dodging");
  });

  it("Stoß nach dem Ausweichen schlägt das Ausweichen", () => {
    const normal = target();
    resolveContact(rushWith(0.5), normal, []);
    const events = [];
    const dodger = target("recovering");
    resolveContact(rushWith(0.5), dodger, events);
    expect(events.map((e) => e.type)).toContain("punish");
    expect(dodger.vx).toBeGreaterThan(normal.vx * 1.4);
  });
});

describe("Stemmen", () => {
  it("macht den Ringer kaum verschiebbar", () => {
    const f = createFighter();
    const free = effectiveMass(f);
    step(f, HOLD_BRACE);
    expect(f.state).toBe("bracing");
    expect(effectiveMass(f)).toBeGreaterThan(free * 3);
  });

  it("verbraucht Ausdauer und endet bei null", () => {
    const f = createFighter();
    step(f, HOLD_BRACE, 400);
    expect(f.state).toBe("idle");
    expect(f.stamina).toBeLessThan(EXHAUSTED_BELOW);
  });
});

describe("Ausweichen", () => {
  it("ist ein Seitenschritt mit Sperre danach", () => {
    const f = createFighter();
    const events = step(f, PRESS_DODGE);
    expect(events.map((e) => e.type)).toContain("dodge");
    expect(f.state).toBe("dodging");
    expect(Math.abs(f.vy)).toBeGreaterThan(Math.abs(f.vx));
    step(f, NEUTRAL_INPUT, 20);
    expect(f.state).toBe("recovering");
    step(f, HOLD_CHARGE, 5);
    expect(f.state).toBe("recovering");
  });

  it("gedrückt halten löst nur einen Schritt aus", () => {
    const f = createFighter();
    step(f, PRESS_DODGE, 80);
    expect(f.stamina).toBeGreaterThan(100 - DODGE_COST * 1.1);
  });
});

describe("Ausdauer", () => {
  it("Aktionen verbrauchen sie, danach füllt sie sich langsam auf", () => {
    const f = createFighter();
    step(f, PRESS_DODGE);
    const after = f.stamina;
    step(f, NEUTRAL_INPUT, 60);
    expect(f.stamina).toBeCloseTo(after + 60 * STAMINA_REGEN, 1);
  });

  it("ohne Ausdauer sind Aktionen gesperrt", () => {
    const f = createFighter();
    f.stamina = 1;
    step(f, PRESS_DODGE);
    expect(f.state).toBe("idle");
    step(f, HOLD_BRACE);
    expect(f.state).toBe("idle");
    step(f, HOLD_CHARGE);
    expect(f.state).toBe("idle");
  });

  it("ohne Ausdauer ist man leichter zu schieben", () => {
    const rested = target();
    resolveContact(rushWith(0.5), rested, []);
    const tired = target();
    tired.stamina = 0;
    resolveContact(rushWith(0.5), tired, []);
    expect(tired.vx).toBeGreaterThan(rested.vx * 1.4);
  });
});

describe("Schwerfälligkeit", () => {
  it("schwere Ringer kommen langsamer in Fahrt", () => {
    const light = createFighter({ mass: 0.85 });
    const heavy = createFighter({ mass: 1.2 });
    const walk = { ...NEUTRAL_INPUT, x: 1 };
    step(light, walk, 30);
    step(heavy, walk, 30);
    expect(light.vx).toBeGreaterThan(heavy.vx);
  });

  it("die Drehung braucht Zeit", () => {
    const f = createFighter({ facing: 0 });
    step(f, { ...NEUTRAL_INPUT, x: -1 }, 10);
    expect(Math.abs(f.facing)).toBeLessThan(1);
  });
});
