// Ein Gast zeigt, was der Host schickt, etwas verzögert und dazwischen geglättet.
import { buildLabels, decodeSeats, decodeSetup, decodeState, MODES } from "./protocol.js";

export const HOST_TIMEOUT_MS = 6000;
export const RENDER_DELAY_MS = 100;
const KEEP_SNAPSHOTS = 12;

const REASONS = {
  full: "Der Raum ist voll.",
  busy: "In diesem Raum läuft gerade ein Match.",
  version: "Der Host hat eine andere Spielversion. Bitte beide die Seite neu laden.",
  bye: "Der Host hat den Raum geschlossen.",
  kicked: "Der Host hat dich aus dem Raum entfernt.",
  flood: "Zu viele Nachrichten, die Verbindung wurde getrennt.",
};

function lerpAngle(a, b, t) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}

export function interpolate(older, newer, t) {
  return {
    ...newer,
    fighters: newer.fighters.map((f, i) => {
      const before = older.fighters[i];
      if (!before) return f;
      return {
        ...f,
        x: before.x + (f.x - before.x) * t,
        y: before.y + (f.y - before.y) * t,
        facing: lerpAngle(before.facing, f.facing, t),
      };
    }),
  };
}

export function createClient({ now = () => Date.now() } = {}) {
  let snapshots = [];
  let events = [];
  let notices = [];
  let lastSeen = now();

  const client = {
    phase: "joining",
    seat: null,
    code: null,
    lobby: null,
    match: null,
    closedReason: null,

    receive(msg) {
      lastSeen = now();
      switch (msg?.t) {
        case "welcome":
          if (Number.isInteger(msg.seat)) client.seat = msg.seat;
          break;
        case "lobby":
          if (!Array.isArray(msg.players)) return;
          client.phase = "lobby";
          client.match = null;
          snapshots = [];
          client.lobby = {
            players: msg.players.filter((p) => Number.isInteger(p?.seat) && (p.kind === "host" || p.kind === "guest")),
            setup: decodeSetup(msg.setup),
          };
          break;
        case "start": {
          const seats = decodeSeats(msg.seats);
          if (!seats || !MODES.includes(msg.mode) || !Number.isInteger(msg.seat) || msg.seat >= seats.length) return;
          client.seat = msg.seat;
          client.phase = "match";
          client.match = { seats, mode: msg.mode, labels: buildLabels(seats, msg.mode, msg.seat) };
          snapshots = [];
          break;
        }
        case "st": {
          const state = client.phase === "match" ? decodeState(msg) : null;
          if (!state || state.fighters.length !== client.match.seats.length) return;
          snapshots.push({ ...state, at: now() });
          if (snapshots.length > KEEP_SNAPSHOTS) snapshots.shift();
          events.push(...state.events);
          break;
        }
        case "note":
          if (typeof msg.text === "string") notices.push(msg.text.slice(0, 120));
          break;
        default:
          if (REASONS[msg?.t]) {
            client.phase = "closed";
            client.closedReason = REASONS[msg.t];
          }
      }
    },

    latest() {
      return snapshots.at(-1) ?? null;
    },

    // Zeigt den Stand von vor RENDER_DELAY_MS und glättet zwischen den beiden umliegenden Paketen.
    view(time = now()) {
      if (snapshots.length === 0) return null;
      const target = time - RENDER_DELAY_MS;
      for (let i = snapshots.length - 1; i > 0; i -= 1) {
        const older = snapshots[i - 1];
        const newer = snapshots[i];
        if (older.at <= target) {
          const span = newer.at - older.at;
          const t = span > 0 ? Math.min(1, (target - older.at) / span) : 1;
          return interpolate(older, newer, t);
        }
      }
      return snapshots[0];
    },

    timedOut(time = now()) {
      return time - lastSeen > HOST_TIMEOUT_MS;
    },

    takeEvents() {
      const list = events;
      events = [];
      return list;
    },

    takeNotices() {
      const list = notices;
      notices = [];
      return list;
    },
  };
  return client;
}
