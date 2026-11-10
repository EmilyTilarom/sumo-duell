import { describe, expect, it } from "vitest";
import { NEUTRAL_INPUT } from "../src/game/actions.js";
import { combineInputs } from "../src/input.js";

describe("Tastatur und Touch zusammen", () => {
  it("die Tastatur hat bei der Richtung Vorrang", () => {
    const combined = combineInputs({ ...NEUTRAL_INPUT, x: 1 }, { ...NEUTRAL_INPUT, x: -0.5, y: 0.5 });
    expect([combined.x, combined.y]).toEqual([1, 0]);
  });

  it("ohne Tastatur zählt der Joystick", () => {
    const combined = combineInputs(NEUTRAL_INPUT, { ...NEUTRAL_INPUT, x: -0.5, y: 0.5 });
    expect([combined.x, combined.y]).toEqual([-0.5, 0.5]);
  });

  it("Aktionen zählen von beiden Seiten", () => {
    const combined = combineInputs({ ...NEUTRAL_INPUT, brace: true }, { ...NEUTRAL_INPUT, charge: true });
    expect(combined).toMatchObject({ charge: true, brace: true, dodge: false });
  });
});
