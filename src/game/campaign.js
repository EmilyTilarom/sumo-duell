const STORAGE_KEY = "sumoDuell.progress";

function style(values) {
  return {
    aggression: 0.1,
    chargeGoal: 0.5,
    rushMin: 110,
    rushMax: 240,
    rushCaution: 1,
    readChance: 0,
    useBrace: false,
    useDodge: false,
    punish: 0,
    centering: 0.5,
    circle: 0,
    edgeMargin: 40,
    ...values,
  };
}

const LEVEL_DATA = [
  {
    name: "Knödel Kuno", style: "Tapst geradeaus", body: "#f2b56b", belt: "#7a4a21", hair: "bun",
    mass: 0.85, reaction: 40, errorRate: 0.34,
    ai: style({ aggression: 0.05, chargeGoal: 0.25 }),
  },
  {
    name: "Pudding Pia", style: "Wackelt und schubst", body: "#f58fb0", belt: "#8a2650", hair: "band",
    mass: 0.9, reaction: 34, errorRate: 0.28,
    ai: style({ aggression: 0.08, chargeGoal: 0.25, readChance: 0.15, useBrace: true }),
  },
  {
    name: "Rüben Rolf", style: "Stur nach vorn", body: "#c65fc0", belt: "#4e1d6e", hair: "spikes",
    mass: 0.95, reaction: 30, errorRate: 0.22,
    ai: style({ aggression: 0.12, chargeGoal: 0.5, rushMin: 60, readChance: 0.3, useBrace: true, centering: 0.8 }),
  },
  {
    name: "Graupel Greta", style: "Weicht gern aus", body: "#74c7e8", belt: "#17527a", hair: "bun",
    mass: 1, reaction: 27, errorRate: 0.18,
    ai: style({ aggression: 0.13, chargeGoal: 0.5, rushMin: 60, readChance: 0.45, useDodge: true, punish: 0.3, circle: 0.4, centering: 1 }),
  },
  {
    name: "Brocken Bodo", style: "Schwer und geduldig", body: "#a4a9b3", belt: "#3a3f4b", hair: "bald",
    mass: 1.05, reaction: 25, errorRate: 0.15,
    ai: style({ aggression: 0.12, chargeGoal: 0.75, rushMin: 0, readChance: 0.5, useBrace: true, punish: 0.4, centering: 1.2, rushCaution: 0.85 }),
  },
  {
    name: "Wirbel Wanda", style: "Umkreist und sticht zu", body: "#7fd07a", belt: "#1f6b35", hair: "band",
    mass: 1.05, reaction: 22, errorRate: 0.12,
    ai: style({ aggression: 0.18, chargeGoal: 0.75, rushMin: 0, readChance: 0.6, useDodge: true, useBrace: true, punish: 0.55, circle: 0.7, centering: 1.2, rushCaution: 0.8 }),
  },
  {
    name: "Hammer Hanno", style: "Wartet auf den vollen Stoß", body: "#ef6a4c", belt: "#7b1f12", hair: "spikes",
    mass: 1.05, reaction: 20, errorRate: 0.1,
    ai: style({ aggression: 0.13, chargeGoal: 1, rushMin: 0, rushMax: 280, readChance: 0.6, useBrace: true, useDodge: true, punish: 0.6, centering: 1.4, rushCaution: 0.75 }),
  },
  {
    name: "Nebel Nora", style: "Kontert jeden Fehler", body: "#b7a4f0", belt: "#3f2d91", hair: "bun",
    mass: 1.1, reaction: 18, errorRate: 0.08,
    ai: style({ aggression: 0.15, chargeGoal: 1, rushMin: 0, readChance: 0.7, useBrace: true, useDodge: true, punish: 0.9, circle: 0.5, centering: 1.6, rushCaution: 0.7 }),
  },
  {
    name: "Eisen Ida", style: "Drängt an den Rand", body: "#6f8fae", belt: "#1b2c3f", hair: "bald",
    mass: 1.15, reaction: 17, errorRate: 0.07,
    ai: style({ aggression: 0.2, chargeGoal: 1, rushMin: 0, rushMax: 280, readChance: 0.75, useBrace: true, useDodge: true, punish: 0.9, centering: 1.8, rushCaution: 0.65 }),
  },
  {
    name: "Großmeister Gongo", style: "Beherrscht alles", body: "#f4cf45", belt: "#b0221f", hair: "spikes",
    mass: 1.2, reaction: 15, errorRate: 0.05,
    ai: style({ aggression: 0.25, chargeGoal: 1, rushMin: 0, rushMax: 280, readChance: 0.85, useBrace: true, useDodge: true, punish: 0.95, circle: 0.3, centering: 2, rushCaution: 0.6 }),
  },
];

export const LEVELS = LEVEL_DATA.map((entry, i) => ({
  ...entry,
  level: i + 1,
  ai: { ...entry.ai, reaction: entry.reaction, errorRate: entry.errorRate },
}));

// Der Fortschritt merkt sich nur das höchste geschlagene Level.
export function isUnlocked(progress, level) {
  return level <= Math.min(progress.beaten + 1, LEVELS.length);
}

export function recordWin(progress, level) {
  if (!isUnlocked(progress, level)) return progress;
  return { beaten: Math.max(progress.beaten, level) };
}

export function loadProgress(storage) {
  try {
    const beaten = JSON.parse(storage.getItem(STORAGE_KEY))?.beaten;
    return Number.isInteger(beaten) && beaten >= 0 && beaten <= LEVELS.length ? { beaten } : { beaten: 0 };
  } catch {
    return { beaten: 0 };
  }
}

export function saveProgress(storage, progress) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ohne Speicher läuft das Spiel weiter, der Fortschritt endet dann mit der Sitzung.
  }
}
