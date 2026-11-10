// Der Host rechnet das ganze Spiel. Gäste schicken nur Eingaben und bekommen den Zustand zurück.
// Die Verbindungen sind austauschbar ({ send, close }), damit Tests ohne Netzwerk auskommen.
import { NEUTRAL_INPUT } from "../game/actions.js";
import { createAi, thinkAi } from "../game/ai.js";
import { LEVELS } from "../game/campaign.js";
import { createWorld, stepWorld } from "../game/world.js";
import { MAX_PLAYERS, PROTOCOL_VERSION, STRENGTHS, decodeInput, decodeSetup, encodeState, teamsFor } from "./protocol.js";

export const STATE_EVERY = 2;
export const GUEST_TIMEOUT_MS = 8000;
// Wer sich verbindet, muss sich schnell mit "hello" melden.
export const HELLO_TIMEOUT_MS = 5000;
// Eine Eingabe ist rund 60 Byte groß, alles deutlich Größere ist kein Spielzug.
export const MAX_MESSAGE_BYTES = 512;
// Ein Gast schickt etwa 20 Eingaben pro Sekunde. Erlaubt sind doppelt so viele wie 60 pro Sekunde,
// kurze Schübe (etwa nach einem Hintergrund-Tab) fängt der Vorrat ab.
export const MESSAGES_PER_SECOND = 120;
export const MESSAGE_BURST = 240;
// Erst wer über längere Zeit zu viel schickt, wird getrennt.
export const FLOOD_LIMIT = 120;

export function createHost({ code, hostSkin, now = () => Date.now(), seed = Date.now() }) {
  const guests = [];
  let setup = { mode: "ffa", count: 4, strength: "medium" };
  let match = null;
  let pending = [];
  let notices = [];

  const seated = () => guests.filter((g) => g.seat !== null);
  const humans = () => 1 + seated().length;

  function send(guest, msg) {
    try {
      guest.conn.send(msg);
    } catch {
      // Eine kaputte Verbindung fällt beim nächsten Timeout raus.
    }
  }

  function broadcast(msg) {
    for (const guest of seated()) send(guest, msg);
  }

  function lobbyMessage() {
    const players = [{ seat: 0, kind: "host" }, ...seated().map((g) => ({ seat: g.seat, kind: "guest" }))];
    return { t: "lobby", code, players: players.sort((a, b) => a.seat - b.seat), setup: { ...setup, count: Math.max(setup.count, humans()) } };
  }

  function sendLobby() {
    broadcast(lobbyMessage());
  }

  function reject(guest, type) {
    send(guest, { t: type });
    const wasSeated = guest.seat !== null;
    const index = guests.indexOf(guest);
    if (index !== -1) guests.splice(index, 1);
    guest.conn.close();
    if (wasSeated && !match) sendLobby();
  }

  // Token-Eimer: füllt sich mit MESSAGES_PER_SECOND auf. Ist er leer, wird die Nachricht verworfen und gezählt.
  function withinRate(guest) {
    const time = now();
    guest.tokens = Math.min(MESSAGE_BURST, guest.tokens + ((time - guest.lastRefill) / 1000) * MESSAGES_PER_SECOND);
    guest.lastRefill = time;
    if (guest.tokens >= 1) {
      guest.tokens -= 1;
      return true;
    }
    guest.overflow += 1;
    return false;
  }

  function tooLarge(msg) {
    try {
      return JSON.stringify(msg).length > MAX_MESSAGE_BYTES;
    } catch {
      return true;
    }
  }

  // Trennt stumme Verbindungen, auch in der Lobby. Gibt true zurück, wenn jemand gegangen ist.
  function checkTimeouts() {
    let changed = false;
    for (const guest of [...guests]) {
      const limit = guest.seat === null ? HELLO_TIMEOUT_MS : GUEST_TIMEOUT_MS;
      const since = now() - (guest.seat === null ? guest.connectedAt : guest.lastSeen);
      if (since <= limit) continue;
      guest.conn.close();
      dropGuest(guest);
      changed = true;
    }
    return changed;
  }

  function freeSeat() {
    for (let seat = 1; seat < MAX_PLAYERS; seat += 1) if (!guests.some((g) => g.seat === seat)) return seat;
    return null;
  }

  function aiFor(seat) {
    return createAi(LEVELS[STRENGTHS[setup.strength] - 1].ai, (seed + seat * 7919) >>> 0);
  }

  function dropGuest(guest) {
    const index = guests.indexOf(guest);
    if (index === -1) return;
    guests.splice(index, 1);
    if (match && guest.matchSeat !== undefined) {
      match.brains.set(guest.matchSeat, aiFor(guest.matchSeat));
      const text = `Spieler ${guest.matchSeat + 1} hat die Verbindung verloren, die KI übernimmt.`;
      notices.push(text);
      broadcast({ t: "note", text });
    } else if (guest.seat !== null) {
      sendLobby();
    }
  }

  return {
    get code() {
      return code;
    },
    get match() {
      return match;
    },
    get lobby() {
      return lobbyMessage();
    },

    connect(conn) {
      const time = now();
      guests.push({ conn, seat: null, input: NEUTRAL_INPUT, connectedAt: time, lastSeen: time, skin: null, tokens: MESSAGE_BURST, lastRefill: time, overflow: 0 });
    },

    receive(conn, msg) {
      const guest = guests.find((g) => g.conn === conn);
      if (!guest) return;
      if (!withinRate(guest)) {
        if (guest.overflow > FLOOD_LIMIT) {
          if (guest.matchSeat !== undefined) {
            guest.conn.close();
            dropGuest(guest);
          } else {
            reject(guest, "flood");
          }
        }
        return;
      }
      if (tooLarge(msg)) return;
      guest.lastSeen = now();
      if (guest.seat === null) {
        if (msg?.t !== "hello") return;
        if (msg.v !== PROTOCOL_VERSION) return reject(guest, "version");
        if (match) return reject(guest, "busy");
        const seat = freeSeat();
        if (seat === null) return reject(guest, "full");
        guest.seat = seat;
        guest.skin = typeof msg.skin === "string" ? msg.skin : null;
        send(guest, { t: "welcome", seat, code });
        sendLobby();
        return;
      }
      const input = decodeInput(msg);
      if (input) guest.input = input;
    },

    checkTimeouts,

    // Nur in der Lobby: Der Host entfernt einen Gast, der Gast erfährt warum.
    kick(seat) {
      const guest = guests.find((g) => g.seat === seat);
      if (!guest || match) return false;
      reject(guest, "kicked");
      return true;
    },

    disconnect(conn) {
      const guest = guests.find((g) => g.conn === conn);
      if (guest) dropGuest(guest);
    },

    setSetup(next) {
      setup = decodeSetup({ ...setup, ...next });
      sendLobby();
    },

    start() {
      const { mode, strength } = setup;
      const count = Math.max(setup.count, humans());
      const players = seated().sort((a, b) => a.seat - b.seat);
      const seats = [{ kind: "human", skin: hostSkin }];
      players.forEach((guest, i) => {
        guest.matchSeat = i + 1;
        seats.push({ kind: "human", skin: guest.skin });
      });
      const level = STRENGTHS[strength];
      for (let i = seats.length; i < count; i += 1) seats.push({ kind: "ai", level: ((level + i * 3) % LEVELS.length) + 1 });

      const brains = new Map();
      seats.forEach((seat, i) => {
        if (seat.kind === "ai") brains.set(i, aiFor(i));
      });
      const world = createWorld({ masses: seats.map(() => 1), teams: teamsFor(mode, count) });
      match = { world, seats, mode, brains };
      pending = [];
      for (const guest of players) send(guest, { t: "start", seat: guest.matchSeat, seats, mode });
      return match;
    },

    // Ein Spielschritt. Gibt die Ereignisse dieses Schritts für Ton und Effekte beim Host zurück.
    tick(localInput) {
      if (!match || match.world.phase === "matchEnd") return [];
      checkTimeouts();
      const { world, brains } = match;
      const inputs = match.seats.map((_, i) => {
        if (i === 0) return localInput;
        if (brains.has(i)) return thinkAi(brains.get(i), world, i);
        return guests.find((g) => g.matchSeat === i)?.input ?? NEUTRAL_INPUT;
      });
      stepWorld(world, inputs);
      pending.push(...world.events);
      if (world.step % STATE_EVERY === 0 || world.phase === "matchEnd") {
        broadcast(encodeState(world, pending));
        pending = [];
      }
      return world.events;
    },

    takeNotices() {
      const list = notices;
      notices = [];
      return list;
    },

    backToLobby() {
      match = null;
      for (const guest of guests) delete guest.matchSeat;
      sendLobby();
    },

    close() {
      broadcast({ t: "bye" });
      for (const guest of guests) guest.conn.close();
      guests.length = 0;
      match = null;
    },
  };
}
