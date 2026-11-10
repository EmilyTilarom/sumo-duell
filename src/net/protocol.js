// Nachrichten zwischen Host und Gästen. Alles, was ankommt, wird geprüft, bevor das Spiel es benutzt.
import { LEVELS } from "../game/campaign.js";
import { skinById } from "../game/skins.js";

export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 4;
export const CODE_LENGTH = 6;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const STATES = new Set(["idle", "charging", "rushing", "bracing", "dodging", "recovering", "staggered"]);
const PHASES = new Set(["countdown", "fight", "ringout", "roundEnd", "matchEnd"]);
const EVENTS = new Set([
  "tick", "go", "chargeFull", "rush", "dodge", "dodged", "bump", "hit", "punish", "blocked", "braceBroken", "fall", "shrink", "roundStart", "roundEnd", "matchEnd",
]);
export const MODES = ["ffa", "team"];
export const STRENGTHS = { easy: 2, medium: 5, hard: 8 };

// Kryptografischer Zufall. Das Alphabet hat 32 Zeichen, 256 ist durch 32 teilbar: kein Zeichen kommt häufiger vor.
export function makeCode(randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  return [...randomBytes(CODE_LENGTH)].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export function normalizeCode(text) {
  const code = String(text ?? "").trim().toUpperCase();
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

export function peerIdFor(code) {
  return `sumoduell-${code.toLowerCase()}`;
}

const round2 = (n) => Math.round(n * 100) / 100;
const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function encodeInput(input) {
  return { t: "in", x: round2(input.x), y: round2(input.y), c: input.charge, b: input.brace, d: input.dodge };
}

export function decodeInput(msg) {
  if (msg?.t !== "in" || !isNum(msg.x) || !isNum(msg.y)) return null;
  return { x: clamp(msg.x, -1, 1), y: clamp(msg.y, -1, 1), charge: msg.c === true, brace: msg.b === true, dodge: msg.d === true };
}

export function encodeState(world, events) {
  return {
    t: "st",
    step: world.step,
    phase: world.phase,
    phaseTimer: world.phaseTimer,
    roundStep: world.roundStep,
    round: world.round,
    roundWinner: world.roundWinner,
    matchWinner: world.matchWinner,
    scores: world.scores,
    ring: round2(world.ring.radius),
    f: world.fighters.map((f) => [
      round2(f.x), round2(f.y), round2(f.vx), round2(f.vy), round2(f.facing), f.state, round2(f.charge), round2(f.stamina), f.out, f.fall, round2(f.radius), f.team,
    ]),
    ev: events.filter((e) => EVENTS.has(e.type)).map((e) => [e.type, isNum(e.x) ? round2(e.x) : null, isNum(e.y) ? round2(e.y) : null]),
  };
}

function decodeFighter(row) {
  if (!Array.isArray(row) || row.length !== 12) return null;
  const [x, y, vx, vy, facing, state, charge, stamina, out, fall, radius, team] = row;
  if (![x, y, vx, vy, facing, charge, stamina, fall, radius, team].every(isNum) || !STATES.has(state)) return null;
  return { x, y, vx, vy, facing, state, charge: clamp(charge, 0, 1), stamina: clamp(stamina, 0, 100), out: out === true, fall, radius: clamp(radius, 10, 100), team };
}

export function decodeState(msg) {
  if (msg?.t !== "st" || !isNum(msg.step) || !PHASES.has(msg.phase) || !Array.isArray(msg.f)) return null;
  if (msg.f.length < 2 || msg.f.length > MAX_PLAYERS || !Array.isArray(msg.scores) || !isNum(msg.ring)) return null;
  const fighters = msg.f.map(decodeFighter);
  if (fighters.includes(null) || !msg.scores.every(isNum)) return null;
  const winnerOk = (w) => w === null || w === "draw" || (Number.isInteger(w) && w >= 0 && w < msg.scores.length);
  if (!winnerOk(msg.roundWinner) || !winnerOk(msg.matchWinner) || msg.matchWinner === "draw") return null;
  const events = Array.isArray(msg.ev)
    ? msg.ev
        .filter((e) => Array.isArray(e) && EVENTS.has(e[0]))
        .map(([type, x, y]) => (isNum(x) && isNum(y) ? { type, x, y } : { type }))
    : [];
  return {
    step: msg.step,
    phase: msg.phase,
    phaseTimer: isNum(msg.phaseTimer) ? msg.phaseTimer : 0,
    roundStep: isNum(msg.roundStep) ? msg.roundStep : 0,
    round: isNum(msg.round) ? msg.round : 1,
    roundWinner: msg.roundWinner,
    matchWinner: msg.matchWinner,
    scores: msg.scores,
    ring: { x: 0, y: 0, radius: msg.ring },
    fighters,
    events,
  };
}

export function decodeSetup(setup) {
  const mode = MODES.includes(setup?.mode) ? setup.mode : "ffa";
  const count = Number.isInteger(setup?.count) ? clamp(setup.count, 2, MAX_PLAYERS) : 4;
  const strength = setup?.strength in STRENGTHS ? setup.strength : "medium";
  return { mode, count, strength };
}

// seats: [{ kind: "human" | "ai", skin?, level? }]. Daraus baut jeder Rechner Namen und Aussehen selbst.
export function decodeSeats(seats) {
  if (!Array.isArray(seats) || seats.length < 2 || seats.length > MAX_PLAYERS) return null;
  const decoded = seats.map((seat) => {
    if (seat?.kind === "human") return { kind: "human", skin: skinById(seat.skin) ? seat.skin : null };
    if (seat?.kind === "ai" && Number.isInteger(seat.level) && seat.level >= 1 && seat.level <= LEVELS.length) {
      return { kind: "ai", level: seat.level };
    }
    return null;
  });
  return decoded.includes(null) ? null : decoded;
}

export function teamsFor(mode, count) {
  return mode === "team" ? [0, ...Array(count - 1).fill(1)] : [...Array(count).keys()];
}

const DEFAULT_LOOKS = [skinById("classic-red").look, skinById("classic-blue").look, { body: "#7fd07a", belt: "#1f6b35", hair: "band" }, { body: "#b7a4f0", belt: "#3f2d91", hair: "bun" }];

export function buildLabels(seats, mode, mySeat) {
  const names = seats.map((seat, i) => (seat.kind === "human" ? `Spieler ${i + 1}` : LEVELS[seat.level - 1].name));
  const looks = seats.map((seat, i) => (seat.kind === "human" ? skinById(seat.skin)?.look ?? DEFAULT_LOOKS[i] : LEVELS[seat.level - 1]));
  const tags = seats.map((seat, i) => (i === mySeat ? "Du" : seat.kind === "human" ? `P${i + 1}` : null));
  const teamNames = mode === "team" ? [names[0], "Team"] : names;
  return { names, teamNames, looks, tags };
}
