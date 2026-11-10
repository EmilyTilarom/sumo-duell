import { describe, expect, it } from "vitest";
import { NEUTRAL_INPUT } from "../src/game/actions.js";
import { COUNTDOWN_STEPS } from "../src/game/rules.js";
import { createWorld } from "../src/game/world.js";
import { RENDER_DELAY_MS, createClient, interpolate } from "../src/net/client.js";
import { GUEST_TIMEOUT_MS, createHost } from "../src/net/host.js";
import {
  PROTOCOL_VERSION,
  buildLabels,
  decodeInput,
  decodeSeats,
  decodeState,
  encodeInput,
  encodeState,
  makeCode,
  normalizeCode,
} from "../src/net/protocol.js";

function fakeConnection() {
  const conn = {
    sent: [],
    closed: false,
    send(msg) {
      // Wie im Netz: nur was sich als JSON übertragen lässt, kommt an.
      conn.sent.push(JSON.parse(JSON.stringify(msg)));
    },
    close() {
      conn.closed = true;
    },
    last(type) {
      return conn.sent.filter((m) => m.t === type).at(-1);
    },
  };
  return conn;
}

function setupHost() {
  let time = 0;
  const host = createHost({ code: "ABCDE", hostSkin: "apple", now: () => time, seed: 1 });
  const join = (skin = "btc") => {
    const conn = fakeConnection();
    host.connect(conn);
    host.receive(conn, { t: "hello", v: PROTOCOL_VERSION, skin });
    return conn;
  };
  return { host, join, advanceTime: (ms) => (time += ms) };
}

describe("Raumcode", () => {
  it("hat 5 gut lesbare Zeichen", () => {
    const code = makeCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(normalizeCode(` ${code.toLowerCase()} `)).toBe(code);
  });

  it.each(["", "ABCD", "ABCDEF", "AB0DE", "ABCD!"])("lehnt %s ab", (text) => {
    expect(normalizeCode(text)).toBeNull();
  });
});

describe("Eingaben", () => {
  it("überstehen den Weg durchs Netz", () => {
    const input = { x: 0.7071, y: -0.7071, charge: true, brace: false, dodge: true };
    const decoded = decodeInput(JSON.parse(JSON.stringify(encodeInput(input))));
    expect(decoded).toEqual({ x: 0.71, y: -0.71, charge: true, brace: false, dodge: true });
  });

  it("werden begrenzt und geprüft", () => {
    expect(decodeInput({ t: "in", x: 50, y: -9, c: "ja" })).toEqual({ x: 1, y: -1, charge: false, brace: false, dodge: false });
    expect(decodeInput({ t: "in", x: "1", y: 0 })).toBeNull();
    expect(decodeInput({ t: "st" })).toBeNull();
  });
});

describe("Zustand", () => {
  it("überträgt alle Ringer und Ereignisse", () => {
    const world = createWorld({ masses: [1, 1, 1], teams: [0, 1, 1] });
    const state = decodeState(JSON.parse(JSON.stringify(encodeState(world, [{ type: "hit", x: 1.234, y: 2 }, { type: "böse" }]))));
    expect(state.fighters).toHaveLength(3);
    expect(state.fighters[1]).toMatchObject({ x: world.fighters[1].x, team: 1, state: "idle" });
    expect(state.scores).toEqual([0, 0]);
    expect(state.events).toEqual([{ type: "hit", x: 1.23, y: 2 }]);
  });

  it("verwirft kaputte Pakete", () => {
    const good = JSON.parse(JSON.stringify(encodeState(createWorld(), [])));
    expect(decodeState({ ...good, phase: "hack" })).toBeNull();
    expect(decodeState({ ...good, f: [good.f[0]] })).toBeNull();
    expect(decodeState({ ...good, f: [good.f[0], [...good.f[1].slice(0, 5), "fliegen", ...good.f[1].slice(6)]] })).toBeNull();
    expect(decodeState({ ...good, matchWinner: 7 })).toBeNull();
  });
});

describe("Plätze", () => {
  it("unbekannte Skins werden zum Standard, ungültige Plätze verworfen", () => {
    const seats = decodeSeats([{ kind: "human", skin: "<img>" }, { kind: "ai", level: 3 }]);
    expect(seats).toEqual([{ kind: "human", skin: null }, { kind: "ai", level: 3 }]);
    expect(decodeSeats([{ kind: "human" }])).toBeNull();
    expect(decodeSeats([{ kind: "human" }, { kind: "ai", level: 99 }])).toBeNull();
  });

  it("jeder sieht sich selbst als Du", () => {
    const labels = buildLabels([{ kind: "human", skin: "apple" }, { kind: "human", skin: null }, { kind: "ai", level: 1 }], "team", 1);
    expect(labels.tags).toEqual(["P1", "Du", null]);
    expect(labels.teamNames).toEqual(["Spieler 1", "Team"]);
    expect(labels.names[2]).toBe("Knödel Kuno");
  });
});

describe("Host", () => {
  it("nimmt bis zu 3 Gäste auf und weist Plätze zu", () => {
    const { host, join } = setupHost();
    const guests = [join(), join(), join()];
    expect(guests.map((g) => g.last("welcome").seat)).toEqual([1, 2, 3]);
    expect(guests[0].last("lobby").players).toHaveLength(4);
    const fifth = join();
    expect(fifth.last("full")).toBeTruthy();
    expect(fifth.closed).toBe(true);
    expect(host.lobby.players).toHaveLength(4);
  });

  it("lehnt eine andere Spielversion ab", () => {
    const { host } = setupHost();
    const conn = fakeConnection();
    host.connect(conn);
    host.receive(conn, { t: "hello", v: 999 });
    expect(conn.last("version")).toBeTruthy();
    expect(conn.closed).toBe(true);
  });

  it("ignoriert Eingaben von Verbindungen ohne Begrüßung", () => {
    const { host } = setupHost();
    const conn = fakeConnection();
    host.connect(conn);
    host.receive(conn, { t: "in", x: 1, y: 0 });
    expect(conn.sent).toEqual([]);
  });

  it("füllt freie Plätze mit KI und schickt jedem Gast seinen Platz", () => {
    const { host, join } = setupHost();
    const guest = join();
    host.setSetup({ mode: "team", count: 4 });
    const match = host.start();
    expect(match.seats.map((s) => s.kind)).toEqual(["human", "human", "ai", "ai"]);
    expect(match.world.fighters.map((f) => f.team)).toEqual([0, 1, 1, 1]);
    const start = guest.last("start");
    expect(start.seat).toBe(1);
    expect(start.seats[0].skin).toBe("apple");
  });

  it("die Eingabe des Gastes bewegt seinen Ringer, der Zustand kommt bei ihm an", () => {
    const { host, join } = setupHost();
    const guest = join();
    host.setSetup({ count: 2 });
    host.start();
    for (let i = 0; i < COUNTDOWN_STEPS; i += 1) host.tick(NEUTRAL_INPUT);
    host.receive(guest, encodeInput({ ...NEUTRAL_INPUT, y: -1 }));
    for (let i = 0; i < 40; i += 1) host.tick(NEUTRAL_INPUT);
    expect(host.match.world.fighters[1].vy).toBeLessThan(-1);
    expect(host.match.world.fighters[0].vy).toBe(0);
    const state = decodeState(guest.last("st"));
    expect(state.fighters[1].y).toBeLessThan(0);
  });

  it("bricht ein Gast ab, übernimmt die KI und alle erfahren es", () => {
    const { host, join } = setupHost();
    const leaver = join();
    const stayer = join();
    host.setSetup({ count: 3 });
    host.start();
    host.disconnect(leaver);
    expect(host.match.brains.has(1)).toBe(true);
    expect(stayer.last("note").text).toContain("Spieler 2");
    expect(host.takeNotices()).toHaveLength(1);
    for (let i = 0; i < COUNTDOWN_STEPS + 300; i += 1) host.tick(NEUTRAL_INPUT);
    expect(host.match.world.step).toBe(COUNTDOWN_STEPS + 300);
  });

  it("ein stiller Gast fliegt nach dem Timeout raus, das Spiel läuft weiter", () => {
    const { host, join, advanceTime } = setupHost();
    const silent = join();
    host.start();
    advanceTime(GUEST_TIMEOUT_MS + 1);
    host.tick(NEUTRAL_INPUT);
    expect(silent.closed).toBe(true);
    expect(host.match.brains.has(1)).toBe(true);
  });

  it("während eines Matches kommt niemand dazu, danach geht es zurück in die Lobby", () => {
    const { host, join } = setupHost();
    join();
    host.start();
    const late = join();
    expect(late.last("busy")).toBeTruthy();
    host.backToLobby();
    expect(host.match).toBeNull();
    expect(join().last("welcome").seat).toBe(2);
  });

  it("schließt der Host, erfahren es alle Gäste", () => {
    const { host, join } = setupHost();
    const guest = join();
    host.close();
    expect(guest.last("bye")).toBeTruthy();
    expect(guest.closed).toBe(true);
  });
});

describe("Gast", () => {
  function joinedClient() {
    let time = 0;
    const client = createClient({ now: () => time });
    const { host, join } = setupHost();
    const conn = join();
    const deliver = () => {
      for (const msg of conn.sent.splice(0)) client.receive(msg);
    };
    return { client, host, deliver, setTime: (t) => (time = t) };
  }

  it("folgt Lobby, Start und Zustand des Hosts", () => {
    const { client, host, deliver, setTime } = joinedClient();
    deliver();
    expect(client.phase).toBe("lobby");
    expect(client.lobby.players).toHaveLength(2);
    host.setSetup({ count: 3 });
    host.start();
    for (let i = 0; i < 4; i += 1) host.tick(NEUTRAL_INPUT);
    setTime(500);
    deliver();
    expect(client.phase).toBe("match");
    expect(client.match.labels.tags[1]).toBe("Du");
    expect(client.latest().fighters).toHaveLength(3);
    expect(client.view(500).fighters).toHaveLength(3);
  });

  it("merkt, wenn der Host schweigt oder den Raum schließt", () => {
    const { client, host, deliver, setTime } = joinedClient();
    deliver();
    setTime(10000);
    expect(client.timedOut()).toBe(true);
    host.close();
    deliver();
    expect(client.phase).toBe("closed");
    expect(client.closedReason).toContain("geschlossen");
  });

  it("glättet zwischen zwei Paketen und nimmt bei Drehungen den kurzen Weg", () => {
    const a = { fighters: [{ x: 0, y: 0, facing: 3.1 }] };
    const b = { fighters: [{ x: 10, y: -20, facing: -3.1 }], phase: "fight" };
    const mid = interpolate(a, b, 0.5);
    expect(mid.fighters[0].x).toBe(5);
    expect(mid.fighters[0].y).toBe(-10);
    expect(Math.abs(Math.cos(mid.fighters[0].facing) + 1)).toBeLessThan(0.01);
    expect(mid.phase).toBe("fight");
  });

  it("zeigt den Stand leicht verzögert", () => {
    let time = 0;
    const client = createClient({ now: () => time });
    client.receive({ t: "start", seat: 1, mode: "ffa", seats: [{ kind: "human" }, { kind: "human" }] });
    const world = createWorld();
    const first = encodeState(world, []);
    world.fighters[0].x = 100;
    const second = { ...encodeState(world, []), step: world.step + 2 };
    time = 1000;
    client.receive(first);
    time = 1033;
    client.receive(second);
    const shown = client.view(1033 + RENDER_DELAY_MS - 16).fighters[0].x;
    expect(shown).toBeGreaterThan(-150);
    expect(shown).toBeLessThan(100);
  });
});
