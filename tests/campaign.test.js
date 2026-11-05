import { describe, expect, it } from "vitest";
import { LEVELS, isUnlocked, loadProgress, recordWin, saveProgress } from "../src/game/campaign.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; }, data };
}

describe("Level", () => {
  it("es gibt 10 Level mit eigenen Gegnern", () => {
    expect(LEVELS).toHaveLength(10);
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(10);
    expect(LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("Reaktion und Fehlerquote werden von Level zu Level besser", () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(LEVELS[i].reaction).toBeLessThan(LEVELS[i - 1].reaction);
      expect(LEVELS[i].errorRate).toBeLessThan(LEVELS[i - 1].errorRate);
    }
    expect(LEVELS[9].mass).toBeGreaterThan(LEVELS[0].mass);
  });
});

describe("Fortschritt", () => {
  it("am Anfang ist nur Level 1 frei", () => {
    const progress = { beaten: 0 };
    expect(isUnlocked(progress, 1)).toBe(true);
    expect(isUnlocked(progress, 2)).toBe(false);
  });

  it("ein Sieg schaltet das nächste Level frei", () => {
    const progress = recordWin({ beaten: 0 }, 1);
    expect(isUnlocked(progress, 2)).toBe(true);
    expect(isUnlocked(progress, 3)).toBe(false);
  });

  it("ein alter Sieg nimmt keinen Fortschritt weg", () => {
    expect(recordWin({ beaten: 5 }, 2)).toEqual({ beaten: 5 });
  });

  it("gesperrte Level zählen nicht", () => {
    expect(recordWin({ beaten: 1 }, 7)).toEqual({ beaten: 1 });
  });

  it("nach Level 10 ist alles frei und nichts läuft über", () => {
    const progress = recordWin({ beaten: 9 }, 10);
    expect(progress.beaten).toBe(10);
    expect(isUnlocked(progress, 10)).toBe(true);
    expect(isUnlocked(progress, 11)).toBe(false);
  });
});

describe("Speichern", () => {
  it("Fortschritt übersteht Speichern und Laden", () => {
    const storage = memoryStorage();
    saveProgress(storage, { beaten: 4 });
    expect(loadProgress(storage)).toEqual({ beaten: 4 });
  });

  it("ohne gespeicherte Daten beginnt man bei null", () => {
    expect(loadProgress(memoryStorage())).toEqual({ beaten: 0 });
  });

  it.each(["kaputt{", '{"beaten":99}', '{"beaten":-1}', '{"beaten":"3"}', "null"])("ungültige Daten %s werden verworfen", (value) => {
    expect(loadProgress(memoryStorage({ "sumoDuell.progress": value }))).toEqual({ beaten: 0 });
  });

  it("ein blockierter Speicher bringt das Spiel nicht zum Absturz", () => {
    const broken = {
      getItem() {
        throw new Error("gesperrt");
      },
      setItem() {
        throw new Error("gesperrt");
      },
    };
    expect(loadProgress(broken)).toEqual({ beaten: 0 });
    expect(() => saveProgress(broken, { beaten: 1 })).not.toThrow();
  });
});
