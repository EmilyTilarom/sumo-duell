import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAcceptableConnection } from "../src/net/protocol.js";

// PeerJS braucht einen Browser. Für den Test reicht eine Attrappe, die Ereignisse von Hand auslösen lässt.
const peers = [];
vi.mock("peerjs", () => ({
  Peer: class {
    constructor(id) {
      this.id = id;
      this.handlers = {};
      peers.push(this);
    }
    on(event, handler) {
      this.handlers[event] = handler;
    }
    emit(event, value) {
      this.handlers[event]?.(value);
    }
    destroy() {}
  },
}));

const { openRoom } = await import("../src/net/peer.js");

function fakeConnection(options) {
  const handlers = {};
  return {
    serialization: "json",
    reliable: true,
    metadata: undefined,
    ...options,
    closed: false,
    open: true,
    on(event, handler) {
      handlers[event] = handler;
    },
    emit(event, value) {
      handlers[event]?.(value);
    },
    close() {
      this.closed = true;
    },
    send() {},
  };
}

function hostWithGuests() {
  const guests = [];
  openRoom({ onCode: () => {}, onGuest: (guest) => guests.push(guest), onError: () => {} });
  const peer = peers.at(-1);
  const arrive = (options) => {
    const connection = fakeConnection(options);
    peer.emit("connection", connection);
    connection.emit("open");
    return connection;
  };
  return { guests, arrive };
}

describe("Host nimmt nur JSON-Verbindungen an", () => {
  beforeEach(() => {
    peers.length = 0;
  });

  it("eine normale JSON-Verbindung wird Gast", () => {
    const { guests, arrive } = hostWithGuests();
    const connection = arrive({});
    expect(connection.closed).toBe(false);
    expect(guests).toHaveLength(1);
  });

  it.each([
    ["binary", { serialization: "binary" }],
    ["binary-utf8", { serialization: "binary-utf8" }],
    ["raw", { serialization: "raw" }],
    ["default", { serialization: "default" }],
    ["unzuverlässig", { reliable: false }],
    ["mit metadata", { metadata: { name: "x" } }],
  ])("%s wird sofort geschlossen und landet nie bei onGuest", (_, options) => {
    const { guests, arrive } = hostWithGuests();
    const connection = arrive(options);
    expect(connection.closed).toBe(true);
    expect(guests).toHaveLength(0);
  });

  it("die Prüfung selbst lässt nur JSON, zuverlässig und ohne Zusatzdaten durch", () => {
    expect(isAcceptableConnection({ serialization: "json", reliable: true })).toBe(true);
    expect(isAcceptableConnection({ serialization: "json", reliable: true, metadata: null })).toBe(true);
    expect(isAcceptableConnection({ serialization: "json", reliable: "true" })).toBe(false);
    expect(isAcceptableConnection(null)).toBe(false);
  });
});
